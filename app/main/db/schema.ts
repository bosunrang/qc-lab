// Schema SQLite cho QC Lab app mới. Xem kế hoạch kiến trúc (Kế hoạch: Viết
// lại QC Lab thành app mới) mục "Schema SQLite" cho lý do tách bảng vs giữ
// cột JSON. Nguyên tắc: tách bảng quan hệ thật khi có truy vấn
// WHERE/JOIN/sort thật cần (đặc biệt `qc_points`); giữ cột *_json khi cấu
// trúc luôn đọc/ghi nguyên khối theo cha, không filter xuyên hàng.
import type { SqliteLike } from './sqlite-like';
import { withTransaction } from './transaction';
import { cleanId, uid } from '../domain/text-utils';
import { DEFAULT_REAGENT_NAME, prepareReagentRows } from '../domain/reagent-validation';
import { quoteIdent } from './sql-ident';
import { mapLegacyAction, type LegacyActionRow } from '../domain/nce/legacy';
import { eqaRoundNumber } from '../domain/eqa/evaluation';

/** Phiên bản schema hiện tại = `version` của bước cuối trong `MIGRATIONS`. */
export const SCHEMA_VERSION = 13;

const LIS_IMPORTS_SQL = `
CREATE TABLE IF NOT EXISTS lis_imports (
  id TEXT PRIMARY KEY,
  gateway_origin TEXT NOT NULL,
  message_id TEXT NOT NULL,
  point_id TEXT NOT NULL REFERENCES qc_points(id) ON DELETE CASCADE,
  record_json TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  imported_by TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL DEFAULT '',
  UNIQUE(gateway_origin, message_id)
);
`;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lab (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  dept TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  brand_title TEXT NOT NULL DEFAULT 'QC Lab',
  brand_sub TEXT NOT NULL DEFAULT 'Nội kiểm xét nghiệm',
  logo_text TEXT NOT NULL DEFAULT 'QC',
  logo_data TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS instruments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  manufacturer TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  serial TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS assay_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS assay_group_tests (
  group_id TEXT NOT NULL REFERENCES assay_groups(id) ON DELETE CASCADE,
  test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, test_id)
);

CREATE TABLE IF NOT EXISTS qc_panels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  instrument_id TEXT NOT NULL REFERENCES instruments(id),
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS qc_panel_tests (
  panel_id TEXT NOT NULL REFERENCES qc_panels(id) ON DELETE CASCADE,
  test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  -- Thứ tự xét nghiệm TRONG panel là dữ liệu nghiệp vụ, không phải chi tiết
  -- trình bày: người dùng tick Na/K/Cl đúng thứ tự trả kết quả của bảng điện
  -- giải. Trước 2026-09-13 không có cột này, và câu đọc không ORDER BY nên
  -- SQLite trả theo index khoá chính, tức SẮP THEO test_id — một chuỗi
  -- ngẫu nhiên 7 ký tự. Hai panel cùng 3 xét nghiệm hiện ra hai thứ tự khác
  -- nhau, không thứ tự nào là của người dùng.
  -- Để NULL được (không NOT NULL) là có chủ đích: restoreAllTables() bind
  -- null cho field vắng mặt, nên backup xuất TRƯỚC khi có cột này vẫn phục
  -- hồi được; mọi câu đọc tie-break bằng rowid cho đúng các dòng đó.
  position INTEGER,
  PRIMARY KEY (panel_id, test_id)
);

CREATE TABLE IF NOT EXISTS lot_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  manufacturer TEXT NOT NULL DEFAULT '',
  material TEXT NOT NULL DEFAULT '',
  catalog TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  -- '' = KHÔNG có trạng thái tự đặt (mặc định) — "Đang hoạt động"/"Chưa
  -- dùng" được SUY từ việc lô của nhóm có đang gán vào xét nghiệm nào không
  -- (inUse, tính ở listLotGroups()), không phải giá trị lưu cứng. '' nghĩa
  -- là "hoạt động bình thường"; không có literal 'active' nào được lưu.
  status TEXT NOT NULL DEFAULT '',
  stopped_at TEXT NOT NULL DEFAULT '',
  -- Ảnh chụp thành viên NGUYÊN VẸN tại thời điểm lưu trữ (JSON mảng id lô,
  -- '' = không có ảnh chụp — mọi nhóm ĐANG hoạt động dùng giá trị này,
  -- listLotGroups() suy lotIds SỐNG từ qc_lots.group_id như bình thường).
  -- Chỉ nhóm "Đã lưu trữ" (do CHẤP NHẬN chuyển tiếp lô tạo ra) mới có giá
  -- trữ giữ NGUYÊN mọi lô cũ (kể cả lô KHÔNG chuyển tiếp, vd lô B khi A→C)
  -- làm thành viên, dù lô đó (B) đã thật sự chuyển sang thuộc nhóm ĐANG
  -- hoạt động qua group_id (1 lô chỉ có 1 group_id tại 1 thời điểm nên
  -- không thể thuộc CẢ HAI nhóm cùng lúc). Không có cột này thì card "Đã
  -- lưu trữ" chỉ hiện đúng lô đã chuyển tiếp, thiếu hẳn lô B dù tên nhóm
  -- "A/B" vẫn ngụ ý đủ 2.
  archived_lot_ids_json TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS qc_lots (
  id TEXT PRIMARY KEY,
  group_id TEXT REFERENCES lot_groups(id),
  lot_no TEXT NOT NULL,
  level INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  program TEXT NOT NULL DEFAULT '',
  exp TEXT NOT NULL DEFAULT '',
  opened TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  depleted INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_qc_lots_group_level ON qc_lots(group_id, level);

CREATE TABLE IF NOT EXISTS lot_transitions (
  id TEXT PRIMARY KEY,
  panel_id TEXT NOT NULL REFERENCES qc_panels(id),
  from_lot_id TEXT NOT NULL REFERENCES qc_lots(id),
  to_lot_id TEXT NOT NULL REFERENCES qc_lots(id),
  start_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned',
  criteria_json TEXT NOT NULL DEFAULT '{}',
  conclusion TEXT NOT NULL DEFAULT '',
  approved_at TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tests (
  id TEXT PRIMARY KEY,
  analyte_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  standard_name TEXT NOT NULL DEFAULT '',
  abbreviation TEXT NOT NULL DEFAULT '',
  aliases_json TEXT NOT NULL DEFAULT '[]',
  matrix TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  decimal_places INTEGER NOT NULL DEFAULT 2,
  instrument_id TEXT NOT NULL REFERENCES instruments(id),
  section TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT '',
  reagent TEXT NOT NULL DEFAULT '',
  tea REAL NOT NULL DEFAULT 0,
  tea_source TEXT NOT NULL DEFAULT '',
  operational_tea_source TEXT NOT NULL DEFAULT '',
  tea_ref_key TEXT NOT NULL DEFAULT '',
  eflm_analyte TEXT NOT NULL DEFAULT '',
  eflm_aps TEXT NOT NULL DEFAULT 'desirable',
  eflm_lookup_date TEXT NOT NULL DEFAULT '',
  eflm_ref TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  rule_actions_json TEXT NOT NULL DEFAULT '{}',
  rule_scopes_json TEXT NOT NULL DEFAULT '{}',
  cusum_on INTEGER NOT NULL DEFAULT 0,
  cusum_k REAL NOT NULL DEFAULT 0.5,
  cusum_h REAL NOT NULL DEFAULT 4
);

CREATE TABLE IF NOT EXISTS test_levels (
  id TEXT PRIMARY KEY, -- '<testId>:<level>'
  test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  qc_lot_id TEXT REFERENCES qc_lots(id),
  mean REAL, sd REAL, low REAL, high REAL, range_k REAL NOT NULL DEFAULT 2,
  mfg_mean REAL, mfg_sd REAL,
  applied TEXT NOT NULL DEFAULT 'mfg',
  mean_sd_history_json TEXT NOT NULL DEFAULT '[]',
  -- Ngày cấu hình Mean/SD ĐANG HOẠT ĐỘNG bắt đầu có hiệu lực (ghi khi lưu
  -- Bảng Mean/SD và ở applyLotGroupActivation()): mọi lần lưu qua Bảng
  -- Mean/SD đều đóng dấu NGÀY LƯU, không chỉ khi giá trị đổi. '' = chưa
  -- từng lưu qua các luồng này (vd Mức 1 tự tạo lúc thêm xét nghiệm, chưa
  -- ai gán Mean/SD).
  mean_sd_effective_from TEXT NOT NULL DEFAULT '',
  UNIQUE (test_id, level)
);

-- Mean/SD "Dự kiến": số đã nhập sẵn cho lô của một nhóm lô CHƯA dùng đến,
-- chờ tới khi bấm "Kích hoạt nhóm lô" mới áp vào test_levels. Bảng RIÊNG,
-- KHÔNG nhét cờ planned vào mean_sd_history_json: lịch sử là
-- những giai đoạn ĐÃ có hiệu lực (trang Lịch sử dữ liệu, cảnh báo điểm QC và
-- lotTargetSnapshot() đều đọc nó), trộn số chưa từng áp vào đó là mời gọi
-- đúng lớp lỗi "áp nhầm số chưa duyệt". Xoá lô/xét nghiệm thì hàng dự kiến
-- theo nó biến mất luôn (ON DELETE CASCADE) — số dự kiến cho một lô không
-- còn tồn tại thì vô nghĩa.
CREATE TABLE IF NOT EXISTS planned_targets (
  id TEXT PRIMARY KEY, -- '<testId>:<level>:<lotId>'
  test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  qc_lot_id TEXT NOT NULL REFERENCES qc_lots(id) ON DELETE CASCADE,
  mean REAL, sd REAL, low REAL, high REAL,
  saved_at TEXT NOT NULL DEFAULT '',
  saved_by TEXT NOT NULL DEFAULT '',
  UNIQUE (test_id, level, qc_lot_id)
);

-- Bảng nóng nhất của toàn hệ thống: mọi Levey-Jennings/Westgard/Sigma/CUSUM
-- đều truy vấn theo (test_id, level, date). KHÔNG có "xoá thật" — chỉ có
-- voided (soft-delete), khớp chính sách sản phẩm "không xoá dữ liệu QC".
CREATE TABLE IF NOT EXISTS qc_points (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL REFERENCES tests(id),
  level INTEGER NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  run_id TEXT NOT NULL DEFAULT '',
  lot TEXT NOT NULL DEFAULT '',
  val REAL NOT NULL,
  value_decimals INTEGER NOT NULL DEFAULT 2,
  qc_mean REAL, qc_sd REAL,
  note TEXT NOT NULL DEFAULT '',
  operator_id TEXT NOT NULL DEFAULT '',
  operator_username TEXT NOT NULL DEFAULT '',
  operator_name TEXT NOT NULL DEFAULT '',
  operator_code TEXT NOT NULL DEFAULT '',
  voided INTEGER NOT NULL DEFAULT 0,
  void_reason TEXT NOT NULL DEFAULT '',
  void_kind TEXT NOT NULL DEFAULT '',
  void_requires_rerun INTEGER NOT NULL DEFAULT 0,
  voided_at TEXT NOT NULL DEFAULT '',
  voided_by TEXT NOT NULL DEFAULT '',
  entry_seq INTEGER NOT NULL DEFAULT 0, -- thứ tự nhập, xem POST_MIGRATION_SQL
  -- Lần chạy của điểm bị loại lúc huỷ: JSON {rules, rejectedLevels}; rỗng nếu
  -- không. Giữ bằng chứng run bị loại sau khi huỷ/nhập lại (N4, migration 9).
  void_rejection_json TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_qc_points_test_level_date ON qc_points(test_id, level, date);
CREATE INDEX IF NOT EXISTS idx_qc_points_test_run ON qc_points(test_id, run_id);
CREATE INDEX IF NOT EXISTS idx_qc_points_active ON qc_points(test_id, level, date) WHERE voided = 0;
-- Chuỗi điểm của MỘT lô (lô đang vận hành, lô cũ, lô song song) lọc theo
-- (test_id, level, lot). Thiếu cột lot, SQLite phải đọc mọi điểm của mức qua
-- nhiều năm rồi mới lọc: bài đo 60 xét nghiệm × 5 năm (2026-09-26) mở Tổng
-- quan mất 3,2 s, có chỉ mục này còn 0,6 s.
CREATE INDEX IF NOT EXISTS idx_qc_points_lot_active ON qc_points(test_id, level, lot, date) WHERE voided = 0;
-- Danh sách điểm đã huỷ của một xét nghiệm (Nhập QC nạp lại sau mỗi lần ghi):
-- thiếu chỉ mục này phải đọc mọi điểm của xét nghiệm rồi sắp lại, ~20 ms trên
-- bộ 5 năm (2026-11-03).
CREATE INDEX IF NOT EXISTS idx_qc_points_voided ON qc_points(test_id, date, run_id) WHERE voided = 1;

${LIS_IMPORTS_SQL}

CREATE TABLE IF NOT EXISTS sigma_data (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL REFERENCES tests(id),
  period TEXT NOT NULL, -- YYYY-MM
  tea REAL, tea_source TEXT NOT NULL DEFAULT '', tea_label TEXT NOT NULL DEFAULT '',
  tea_reference TEXT NOT NULL DEFAULT '', tea_captured_at TEXT NOT NULL DEFAULT '',
  lv_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE (test_id, period)
);

-- NCE / hành động khắc phục — cột thật cho các trường được lọc/hiển thị ở
-- Dashboard/Report/danh sách NCE; detail_json gom phần văn bản tự do + FMEA
-- chi tiết (không có truy vấn WHERE nào chạy trên các trường đó).
CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT NOT NULL DEFAULT '',
  created_by_username TEXT NOT NULL DEFAULT '',
  -- CỐ Ý KHÔNG khoá ngoại tới tests(id) — cùng nguyên tắc activity.user_id/
  -- username (chuỗi phẳng, không FK tới users): xoá xét nghiệm ở
  -- config-handlers.ts's removeTest() là xoá THẬT (không soft-delete),
  -- không đụng state.actions). Có FK ở đây sẽ khiến DELETE FROM tests
  -- ném lỗi FOREIGN KEY constraint (schema bật PRAGMA foreign_keys=ON)
  -- ngay khi xét nghiệm đó còn hồ sơ NCE — đúng trường hợp cần giữ lại,
  -- không phải trường hợp cần chặn.
  test_id TEXT,
  level INTEGER,
  lot TEXT NOT NULL DEFAULT '',
  -- CỐ Ý KHÔNG khoá ngoại tới qc_points(id) — cùng lý do như test_id ở trên:
  -- xoá xét nghiệm cũng xoá THẬT mọi qc_points của nó, nhưng hồ sơ NCE vẫn
  -- phải giữ nguyên point_id (dangling) làm bằng chứng lịch sử.
  point_id TEXT,
  rule TEXT NOT NULL DEFAULT '',
  error_type TEXT NOT NULL DEFAULT '',
  qc_verdict TEXT NOT NULL DEFAULT '',
  nce_id TEXT NOT NULL DEFAULT '',
  parent_nce_id TEXT NOT NULL DEFAULT '',
  follow_up_nce_id TEXT NOT NULL DEFAULT '',
  protocol_version INTEGER NOT NULL DEFAULT 3,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  effectiveness_status TEXT NOT NULL DEFAULT 'pending',
  record_status TEXT NOT NULL DEFAULT 'active',
  risk_level TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  action_completed_date TEXT NOT NULL DEFAULT '',
  detail_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_actions_test ON actions(test_id);
CREATE INDEX IF NOT EXISTS idx_actions_approval ON actions(approval_status);
CREATE INDEX IF NOT EXISTS idx_actions_due ON actions(due_date);

-- Hồ sơ NCE protocol 4 (docs/NCE-REDESIGN-2026-10-12.md mục 6). Bảng
-- actions ở trên giữ nguyên để migration đọc và để phục hồi được backup cũ;
-- mã nghiệp vụ không đọc/ghi nó nữa. test_id cố ý không khoá ngoại, cùng lý
-- do với actions.test_id: xoá xét nghiệm không được xoá hồ sơ NCE.
CREATE TABLE IF NOT EXISTS nce_records (
  id TEXT PRIMARY KEY,
  nce_id TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'other',
  phase TEXT NOT NULL DEFAULT 'exam',
  test_id TEXT,
  detected_at TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  correction TEXT NOT NULL DEFAULT '',
  -- NULL = chưa xác định (hồ sơ tự mở khi hủy điểm).
  hold_results INTEGER,
  containment_note TEXT NOT NULL DEFAULT '',
  occurred_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  tier TEXT NOT NULL DEFAULT '',
  tier_reason TEXT NOT NULL DEFAULT '',
  risk_severity INTEGER NOT NULL DEFAULT 0,
  risk_probability INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT '',
  risk_basis TEXT NOT NULL DEFAULT '',
  checklist_json TEXT NOT NULL DEFAULT '{}',
  cause_status TEXT NOT NULL DEFAULT '',
  cause_category TEXT NOT NULL DEFAULT '',
  cause_text TEXT NOT NULL DEFAULT '',
  cause_check_plan TEXT NOT NULL DEFAULT '',
  effectiveness_criteria TEXT NOT NULL DEFAULT '',
  effectiveness_review_due TEXT NOT NULL DEFAULT '',
  owner_user_id TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  reported_by_user_id TEXT NOT NULL DEFAULT '',
  reported_by_name TEXT NOT NULL DEFAULT '',
  -- SE/RE của lần chạy khởi đầu: dùng cho phát hiện tái diễn và cổng đổi dải.
  error_class TEXT NOT NULL DEFAULT '',
  -- 1 = điểm bị loại của hồ sơ đã được xử lý trọn vẹn (Sigma, D-11). Hồ sơ mới
  -- đặt khi duyệt đóng; hồ sơ cũ chỉ khi đã duyệt VÀ hiệu quả, giữ đúng cách
  -- tính trước khi đổi.
  qc_resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  -- Khoá lạc quan: mọi lệnh sửa gửi kèm phiên bản đang xem.
  row_version INTEGER NOT NULL DEFAULT 1,
  protocol_version INTEGER NOT NULL DEFAULT 4,
  legacy_action_id TEXT,
  legacy_json TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_nce_records_test ON nce_records(test_id);
CREATE INDEX IF NOT EXISTS idx_nce_records_status ON nce_records(status);
CREATE INDEX IF NOT EXISTS idx_nce_records_nce_id ON nce_records(nce_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nce_records_legacy ON nce_records(legacy_action_id) WHERE legacy_action_id IS NOT NULL;

-- Lần chạy gắn với hồ sơ: khởi đầu, bị loại thêm, rerun. Snapshot chụp giá
-- trị, Mean/SD, z, luật và kết luận của mọi mức tại lúc gắn.
CREATE TABLE IF NOT EXISTS nce_runs (
  id TEXT PRIMARY KEY,
  nce_record_id TEXT NOT NULL REFERENCES nce_records(id),
  test_id TEXT NOT NULL,
  date TEXT NOT NULL,
  run_id TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL,
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  attached_at TEXT NOT NULL DEFAULT '',
  attached_by_user_id TEXT NOT NULL DEFAULT '',
  attached_by_name TEXT NOT NULL DEFAULT '',
  UNIQUE (nce_record_id, test_id, date, run_id)
);
CREATE INDEX IF NOT EXISTS idx_nce_runs_run ON nce_runs(test_id, date, run_id);

CREATE TABLE IF NOT EXISTS nce_actions (
  id TEXT PRIMARY KEY,
  nce_record_id TEXT NOT NULL REFERENCES nce_records(id),
  kind TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_user_id TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  done_at TEXT NOT NULL DEFAULT '',
  done_by_user_id TEXT NOT NULL DEFAULT '',
  done_by_name TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '',
  cancel_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_nce_actions_record ON nce_actions(nce_record_id);

-- Quyết định append-only: cho chạy lại, ảnh hưởng bệnh nhân, hiệu lực, nộp,
-- duyệt, trả lại, hủy. Không sửa, không xoá.
CREATE TABLE IF NOT EXISTS nce_decisions (
  id TEXT PRIMARY KEY,
  nce_record_id TEXT NOT NULL REFERENCES nce_records(id),
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  actor_user_id TEXT NOT NULL DEFAULT '',
  actor_name TEXT NOT NULL DEFAULT '',
  decided_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_nce_decisions_record ON nce_decisions(nce_record_id);

-- Lịch sử sửa nội dung, append-only: changes_json = { trường: [trước, sau] }.
CREATE TABLE IF NOT EXISTS nce_revisions (
  id TEXT PRIMARY KEY,
  nce_record_id TEXT NOT NULL REFERENCES nce_records(id),
  actor_user_id TEXT NOT NULL DEFAULT '',
  actor_name TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL DEFAULT '',
  changes_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_nce_revisions_record ON nce_revisions(nce_record_id);

-- Mốc bắt đầu lại chuỗi Westgard/CUSUM (domain/qc-cuts.ts). run_id NULL là
-- mốc theo ngày của hồ sơ cũ (giai đoạn mới từ ngày sau date).
CREATE TABLE IF NOT EXISTS nce_cuts (
  id TEXT PRIMARY KEY,
  nce_record_id TEXT NOT NULL REFERENCES nce_records(id),
  test_id TEXT NOT NULL,
  date TEXT NOT NULL,
  run_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_nce_cuts_test ON nce_cuts(test_id);

-- Ngoại kiểm (docs/EQA-PLAN-2026-10-28.md). Chương trình của một đơn vị tổ chức;
-- ánh xạ mã thông số × tên máy của chương trình sang xét nghiệm trong danh
-- mục, dùng lại cho các kỳ sau.
CREATE TABLE IF NOT EXISTS eqa_programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  program_code TEXT NOT NULL DEFAULT '',
  unit_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  sample_type TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS eqa_test_map (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES eqa_programs(id),
  pair_key TEXT NOT NULL,
  code TEXT NOT NULL,
  instrument_label TEXT NOT NULL,
  test_id TEXT NOT NULL REFERENCES tests(id),
  UNIQUE(program_id, pair_key)
);
-- Một kỳ (đợt) của chương trình. Nhập lại tăng version; kết quả các phiên
-- bản cũ vẫn giữ trong eqa_results. Không xoá cứng: huỷ có lý do.
CREATE TABLE IF NOT EXISTS eqa_rounds (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES eqa_programs(id),
  year INTEGER NOT NULL,
  round TEXT NOT NULL,
  round_no INTEGER NOT NULL DEFAULT 0,
  report_code TEXT NOT NULL DEFAULT '',
  -- received_date, entered_by: cột của luồng nhập Excel đã bỏ; báo cáo PDF
  -- không ghi nên bản ghi mới để trống, app không đọc.
  received_date TEXT NOT NULL DEFAULT '',
  report_date TEXT NOT NULL DEFAULT '',
  assigned_level TEXT NOT NULL DEFAULT '',
  entered_by TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'pdf',
  source_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  version INTEGER NOT NULL DEFAULT 1,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  UNIQUE(program_id, year, round)
);
CREATE TABLE IF NOT EXISTS eqa_results (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES eqa_rounds(id),
  version INTEGER NOT NULL,
  test_id TEXT NOT NULL REFERENCES tests(id),
  code TEXT NOT NULL,
  instrument_label TEXT NOT NULL,
  level_label TEXT NOT NULL DEFAULT '',
  sample TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  result REAL NOT NULL,
  assigned REAL NOT NULL,
  sigma_p REAL NOT NULL,
  z REAL NOT NULL,
  z_provider REAL,
  z_official REAL NOT NULL,
  pct REAL,
  class TEXT NOT NULL,
  provider_check TEXT NOT NULL DEFAULT 'none',
  -- swapped, tolerance_pct, within_tolerance, run_date, reagent_lot, operator,
  -- iqc_note, level_label: cột của luồng nhập Excel đã bỏ; báo cáo PDF không
  -- có các thông tin này nên bản ghi mới để mặc định, app không đọc.
  swapped INTEGER NOT NULL DEFAULT 0,
  tolerance_pct REAL,
  within_tolerance INTEGER,
  run_date TEXT NOT NULL DEFAULT '',
  reagent_lot TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT '',
  operator TEXT NOT NULL DEFAULT '',
  iqc_note TEXT NOT NULL DEFAULT '',
  peer_group TEXT NOT NULL DEFAULT '',
  peer_json TEXT NOT NULL DEFAULT '{}',
  warnings_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_eqa_results_round ON eqa_results(round_id, version);
CREATE INDEX IF NOT EXISTS idx_eqa_results_test ON eqa_results(test_id);
-- Lịch đợt ngoại kiểm: ngày nhận mẫu, ngày chạy, hạn nộp kết quả cho trung tâm.
-- Gắn với đợt có báo cáo (eqa_rounds) theo chương trình + năm + số đợt. Nộp trễ
-- hạn thì đợt bị tính không đạt, nên app nhắc trước hạn.
CREATE TABLE IF NOT EXISTS eqa_schedule (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES eqa_programs(id),
  year INTEGER NOT NULL,
  round TEXT NOT NULL,
  round_no INTEGER NOT NULL,
  receive_date TEXT NOT NULL DEFAULT '',
  run_date TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL,
  assignee TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL DEFAULT '',
  submitted_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  UNIQUE(program_id, year, round_no)
);
CREATE INDEX IF NOT EXISTS idx_eqa_schedule_due ON eqa_schedule(due_date);
-- Máy chạy mẫu của một đợt trong lịch. Mỗi máy nộp phiếu kết quả riêng (mã đơn
-- vị riêng), nên "đã nộp" ghi theo từng máy; đợt chỉ tính đã nộp khi đủ máy.
CREATE TABLE IF NOT EXISTS eqa_schedule_instruments (
  schedule_id TEXT NOT NULL REFERENCES eqa_schedule(id),
  instrument_id TEXT NOT NULL REFERENCES instruments(id),
  submitted_at TEXT NOT NULL DEFAULT '',
  submitted_by TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(schedule_id, instrument_id)
);
-- Quyết định append-only của kỳ: nhập, bổ sung máy, nhập lại, huỷ.
CREATE TABLE IF NOT EXISTS eqa_decisions (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES eqa_rounds(id),
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  actor_user_id TEXT NOT NULL DEFAULT '',
  actor_name TEXT NOT NULL DEFAULT '',
  decided_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_eqa_decisions_round ON eqa_decisions(round_id);

-- Nhật ký audit — append-only, chuỗi hash tamper-evident. Xem
-- app/main/domain/audit-chain.ts cho thuật toán hash.
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL,
  ts TEXT NOT NULL,
  user TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  target TEXT NOT NULL DEFAULT '',
  client_id TEXT NOT NULL DEFAULT '',
  prev_hash TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_activity_seq ON activity(seq);
CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity(ts);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  initials TEXT NOT NULL DEFAULT '',
  external_code TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'technician',
  page_perms_json TEXT,
  pass_hash TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  avatar TEXT NOT NULL DEFAULT '',
  -- Quyền nghiệp vụ NCE cấp riêng cho KTV (nce.release, nce.approve); quản
  -- trị viên mặc nhiên có cả hai (domain/nce/permissions.ts).
  capabilities_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS reagent_tests (
  id TEXT PRIMARY KEY,
  reagent TEXT NOT NULL DEFAULT '',
  lot_old TEXT NOT NULL DEFAULT '',
  lot_new TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  operator TEXT NOT NULL DEFAULT '',
  sample_type TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  bias_target REAL,
  alpha REAL,
  coverage_confirmed INTEGER NOT NULL DEFAULT 0,
  extra_json TEXT NOT NULL DEFAULT '{}',
  rows_json TEXT NOT NULL DEFAULT '[]'
);

-- Biên bản xem xét dữ liệu QC theo tháng (GV4 mục 2, ISO 15189:2022 7.3.7.2).
-- Mỗi lần ký một dòng; dòng mới nhất của tháng là kết luận hiện hành. summary_json
-- là ảnh chụp số liệu lúc ký, vì dữ liệu tháng còn đổi được khi kỳ chưa khoá.
CREATE TABLE IF NOT EXISTS qc_month_reviews (
  id TEXT PRIMARY KEY,
  ym TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  reviewer_user_id TEXT NOT NULL DEFAULT '',
  reviewer_username TEXT NOT NULL DEFAULT '',
  reviewer_name TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT NOT NULL DEFAULT '',
  summary_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_qc_month_reviews_ym ON qc_month_reviews(ym);

CREATE TABLE IF NOT EXISTS period_locks (
  id TEXT PRIMARY KEY,
  ym TEXT NOT NULL UNIQUE,
  locked_at TEXT NOT NULL DEFAULT '',
  locked_by TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tea_refs (
  id TEXT PRIMARY KEY,
  analyte_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  standard_name TEXT NOT NULL DEFAULT '',
  abbreviation TEXT NOT NULL DEFAULT '',
  aliases_json TEXT NOT NULL DEFAULT '[]',
  matrix TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  clia REAL, ricos REAL, lab REAL,
  lab_source TEXT NOT NULL DEFAULT '',
  lab_prepared_by TEXT NOT NULL DEFAULT '',
  lab_next_review_date TEXT NOT NULL DEFAULT '',
  clia_rule TEXT NOT NULL DEFAULT '',
  clia_absolute REAL,
  clia_absolute_unit TEXT NOT NULL DEFAULT '',
  sources_json TEXT NOT NULL DEFAULT '{}'
);

-- TEa theo SỐ MỨC QC của analyte, không phụ thuộc xét nghiệm đã được gán
-- máy hay chưa. Đây là cấu hình người dùng quản lý trực tiếp trong hồ sơ TEa.
CREATE TABLE IF NOT EXISTS tea_ref_level_defaults (
  tea_ref_id TEXT NOT NULL REFERENCES tea_refs(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level > 0),
  tea REAL NOT NULL CHECK (tea > 0),
  PRIMARY KEY (tea_ref_id, level)
);

-- Phiên bản hồ sơ TEa của PXN (N8, ISO 15189:2022 8.3): mỗi lần lưu hoặc xoá
-- giữ nguyên ảnh chụp, vì TEa PXN là căn cứ của cổng lập dải và ngoại kiểm.
-- action: 'baseline' (hồ sơ có từ trước khi lưu phiên bản), 'save', 'remove'.
-- Không khoá ngoại tới tea_refs: xoá hồ sơ không được xoá lịch sử của nó;
-- analyte_id/name giữ để nối lại khi hồ sơ được lập lại.
CREATE TABLE IF NOT EXISTS tea_ref_versions (
  id TEXT PRIMARY KEY,
  tea_ref_id TEXT NOT NULL,
  analyte_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT 'save',
  saved_at TEXT NOT NULL DEFAULT '',
  saved_by TEXT NOT NULL DEFAULT '',
  lab REAL,
  levels_json TEXT NOT NULL DEFAULT '[]',
  lab_source TEXT NOT NULL DEFAULT '',
  lab_prepared_by TEXT NOT NULL DEFAULT '',
  lab_next_review_date TEXT NOT NULL DEFAULT '',
  sources_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_tea_ref_versions_ref ON tea_ref_versions(tea_ref_id);

-- Lịch sử cấu hình luật Westgard (GV2): mỗi lần đổi ghi một phiên bản, để
-- kết luận của các lần chạy đã có không đổi theo cấu hình mới. scope =
-- 'global' (cấu hình chung) hoặc id xét nghiệm. boundary_entry_seq: số thứ tự
-- nhập lớn nhất của qc_points lúc đổi; NULL là dòng gốc (cấu hình trước lần
-- đổi đầu tiên, áp từ đầu). Xem db/rule-config-history.ts.
CREATE TABLE IF NOT EXISTS rule_config_history (
  id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL,
  scope TEXT NOT NULL,
  rules_json TEXT NOT NULL DEFAULT '{}',
  scopes_json TEXT NOT NULL DEFAULT '{}',
  boundary_entry_seq INTEGER,
  changed_at TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_rule_config_history_scope ON rule_config_history(scope, seq);
`;

/** Chạy SAU mọi bước migration (cột `qc_points.entry_seq` có từ bước 8), mỗi
 * lần mở và sau mỗi lần phục hồi. `entry_seq` là thứ tự nhập điểm QC trong
 * toàn CSDL — DB không có giờ nhập, mà ngày của điểm có thể là ngày lùi.
 * Trigger tự đánh số cho mọi đường chèn (nhập QC, LIS, phục hồi backup cũ
 * thiếu cột này); dòng chèn kèm sẵn số (phục hồi backup mới) giữ nguyên. */
const POST_MIGRATION_SQL = `
CREATE INDEX IF NOT EXISTS idx_qc_points_entry_seq ON qc_points(entry_seq);
-- Thứ tự nhập theo lần chạy (\`runEntrySeqs\`, chạy ở mọi lần đánh giá sau khi
-- đã đổi cấu hình luật): chỉ mục phủ đủ cột nên không phải đọc từng dòng của
-- bảng. Bộ 5 năm (2026-11-03): một lượt nhập điểm 630 → 280 ms. Cố ý để
-- entry_seq đứng trước date: chỉ mục bắt đầu bằng (test_id, date) làm SQLite
-- bỏ \`idx_qc_points_lot_active\` cho câu đọc theo lô có ORDER BY date
-- (test \`qc-points-index\`).
CREATE INDEX IF NOT EXISTS idx_qc_points_test_run_seq ON qc_points(test_id, entry_seq, date, run_id);
CREATE TRIGGER IF NOT EXISTS qc_points_entry_seq AFTER INSERT ON qc_points WHEN NEW.entry_seq = 0
BEGIN
  UPDATE qc_points SET entry_seq = (SELECT COALESCE(MAX(entry_seq), 0) FROM qc_points) + 1 WHERE rowid = NEW.rowid;
END;
`;

function hasColumn(db: SqliteLike, table: string, column: string): boolean {
  return (db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all() as { name: string }[]).some((c) => c.name === column);
}
function addColumnIfMissing(db: SqliteLike, table: string, column: string, definition: string): void {
  if (!hasColumn(db, table, column)) db.exec(`ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${quoteIdent(column)} ${definition};`);
}

interface Migration { version: number; name: string; up(db: SqliteLike): void }

/** Các bước nâng schema, theo thứ tự. Mỗi bước chạy trong một transaction và
 * ghi số phiên bản ngay trong transaction đó, nên hoặc xong trọn bước, hoặc
 * chưa hề chạy. `CREATE TABLE IF NOT EXISTS` KHÔNG tự thêm cột vào bảng đã có
 * trên đĩa, nên mọi cột thêm sau phải có một bước ở đây.
 *
 * Mỗi bước phải chạy lại được (kiểm tra trước khi ALTER): CSDL tạo trước
 * 2026-09-25 đều ghi `schemaVersion = 1` dù đã chạy một phần các lệnh ALTER
 * của bước 2 — hồi đó chúng chạy ở mỗi lần mở mà không tăng số phiên bản.
 *
 * Thêm thay đổi schema mới: thêm một bước với `version` kế tiếp và tăng
 * `SCHEMA_VERSION`. Không sửa bước đã phát hành. */
const MIGRATIONS: Migration[] = [
  { version: 1, name: 'Schema gốc', up: () => { /* các bảng tạo bởi SCHEMA_SQL */ } },
  {
    version: 2,
    name: 'Cột bổ sung tháng 9/2026 và chuẩn hoá mã loại sai số',
    up(db) {
      addColumnIfMissing(db, 'tests', 'active', 'INTEGER NOT NULL DEFAULT 1');
      addColumnIfMissing(db, 'tests', 'analyte_id', "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing(db, 'tests', 'eflm_analyte', "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing(db, 'tests', 'eflm_aps', "TEXT NOT NULL DEFAULT 'desirable'");
      addColumnIfMissing(db, 'tests', 'eflm_lookup_date', "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing(db, 'tests', 'eflm_ref', "TEXT NOT NULL DEFAULT ''");
      // Không đoán EFLM từ `tea`: cột cũ có thể đã bị nguồn CLIA/Ricos ghi đè.
      // Giữ nguyên giá trị cũ để truy xuất; yêu cầu xác nhận lại EFLM một lần.
      addColumnIfMissing(db, 'tests', 'eflm_tea', 'REAL');
      addColumnIfMissing(db, 'lot_groups', 'archived_lot_ids_json', "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing(db, 'users', 'avatar', "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing(db, 'test_levels', 'mean_sd_effective_from', "TEXT NOT NULL DEFAULT ''");
      if (!hasColumn(db, 'qc_panel_tests', 'position')) {
        db.exec('ALTER TABLE qc_panel_tests ADD COLUMN position INTEGER;');
        // Lấp lại từ `rowid`: handler LUÔN chèn theo đúng thứ tự người dùng
        // tick (`for (const testId of validTestIds)`), nên thứ tự đó vẫn nằm
        // nguyên trong DB — chỉ là chưa ai đọc theo nó. Nhờ vậy panel đã tạo
        // trước bản này lấy lại đúng thứ tự cũ, người dùng không phải tick lại.
        db.exec(`UPDATE qc_panel_tests SET position = (
          SELECT COUNT(*) FROM qc_panel_tests older
          WHERE older.panel_id = qc_panel_tests.panel_id AND older.rowid < qc_panel_tests.rowid
        );`);
      }
      normalizeErrorTypes(db);
    },
  },
  {
    version: 3,
    name: 'Hồ sơ NCE protocol 4: bảng nce_*, quyền NCE, chuyển hồ sơ cũ',
    up(db) {
      addColumnIfMissing(db, 'users', 'capabilities_json', "TEXT NOT NULL DEFAULT '[]'");
      migrateLegacyNce(db);
    },
  },
  {
    version: 4,
    name: 'NCE: phạm vi kiểm soát, thông báo và diễn biến thời gian',
    up(db) {
      addColumnIfMissing(db, 'nce_records', 'containment_note', "TEXT NOT NULL DEFAULT ''");
      addColumnIfMissing(db, 'nce_records', 'occurred_note', "TEXT NOT NULL DEFAULT ''");
    },
  },
  {
    version: 5,
    // Các bảng eqa_* do SCHEMA_SQL tạo (CREATE TABLE IF NOT EXISTS); bước này
    // chỉ đánh dấu phiên bản để bản cũ hơn từ chối mở CSDL có dữ liệu ngoại kiểm.
    name: 'Ngoại kiểm: bảng eqa_*',
    up() { /* bảng đã tạo trong SCHEMA_SQL */ },
  },
  {
    version: 6,
    // `tea_ref_level_defaults` do SCHEMA_SQL tạo; bước này đánh dấu phiên bản
    // để bản cũ hơn từ chối mở CSDL đã có TEa theo mức QC.
    name: 'TEa chuẩn hóa theo số mức QC của analyte',
    up() { /* bảng đã tạo trong SCHEMA_SQL */ },
  },
  {
    version: 7,
    // Bản phát triển từng có bảng `tea_ref_levels` (TEa theo cặp xét
    // nghiệm–máy) nhưng chưa phát hành. Bỏ hẳn để chỉ còn một mô hình; CSDL
    // xem trước đã lên số 7 vẫn mở được vì không hạ số phiên bản.
    name: 'Bỏ bảng TEa theo xét nghiệm–máy của bản phát triển',
    up(db) { db.exec('DROP TABLE IF EXISTS tea_ref_levels;'); },
  },
  {
    version: 8,
    // `rule_config_history` do SCHEMA_SQL tạo. Không nạp sẵn dòng gốc: lần
    // đổi luật đầu tiên tự ghi cấu hình trước đó làm dòng gốc
    // (`recordRuleConfigChange`). Điểm đã có lấy thứ tự theo rowid — thứ tự
    // đúng giữa chúng không quan trọng vì mọi điểm này có trước mọi lần đổi.
    // Bản cũ hơn — vốn tính lại mọi kết luận theo cấu hình hiện hành — từ chối
    // mở CSDL từ bước này.
    name: 'Lịch sử cấu hình luật Westgard (không hồi tố)',
    up(db) {
      addColumnIfMissing(db, 'qc_points', 'entry_seq', 'INTEGER NOT NULL DEFAULT 0');
      db.exec('UPDATE qc_points SET entry_seq = rowid WHERE entry_seq = 0;');
    },
  },
  {
    version: 9,
    // Điểm huỷ trước bước này để rỗng: không tính lại kết luận lúc huỷ được,
    // vì điểm đã ra khỏi chuỗi đánh giá.
    name: 'Điểm huỷ giữ bằng chứng lần chạy bị loại',
    up(db) { addColumnIfMissing(db, 'qc_points', 'void_rejection_json', "TEXT NOT NULL DEFAULT ''"); },
  },
  {
    version: 10,
    name: 'Loại mẫu của chương trình ngoại kiểm',
    up(db) { addColumnIfMissing(db, 'eqa_programs', 'sample_type', "TEXT NOT NULL DEFAULT ''"); },
  },
  {
    version: 11,
    // Bản trước lấy "CYCLE 23" làm kỳ của RIQAS, nên sample sau ghi đè sample
    // trước của cùng máy. Từ bước này mỗi sample là một đợt (N-16). Kỳ cũ chỉ
    // từng có MỘT sample (mọi phiên bản) thì đổi tên đúng như bộ đọc mới đặt;
    // kỳ đã lẫn nhiều sample giữ nguyên để không đoán lại lịch sử phiên bản.
    name: 'Ngoại kiểm RIQAS: mỗi sample là một đợt',
    up(db) { splitRiqasCycleRounds(db); },
  },
  {
    version: 12,
    name: 'Nguồn TEa vận hành được chọn riêng cho xét nghiệm',
    up(db) { addColumnIfMissing(db, 'tests', 'operational_tea_source', "TEXT NOT NULL DEFAULT ''"); },
  },
  {
    version: 13,
    name: 'Dấu vết nhận bản tin LIS và trạng thái xác nhận Gateway',
    up(db) { db.exec(LIS_IMPORTS_SQL); },
  },
];

function splitRiqasCycleRounds(db: SqliteLike): void {
  const rounds = db.prepare(`SELECT r.id, r.program_id, r.year, r.round FROM eqa_rounds r JOIN eqa_programs p ON p.id=r.program_id
    WHERE p.provider LIKE 'RIQAS%'`).all() as { id: string; program_id: string; year: number; round: string }[];
  for (const round of rounds) {
    const cycle = round.round.trim().match(/^CYCLE\s+(\d+)$/i)?.[1];
    if (!cycle) continue;
    const samples = db.prepare('SELECT DISTINCT sample FROM eqa_results WHERE round_id=?').all(round.id) as { sample: string }[];
    const sample = samples.length === 1 ? samples[0].sample.trim() : '';
    if (!/^\d+$/.test(sample)) continue;
    const name = `CYCLE ${cycle} SAMPLE ${sample}`;
    if (db.prepare('SELECT 1 FROM eqa_rounds WHERE program_id=? AND year=? AND round=?').get(round.program_id, round.year, name)) continue;
    const roundNo = Number(cycle) * 100 + Number(sample);
    db.prepare('UPDATE eqa_rounds SET round=?, round_no=? WHERE id=?').run(name, roundNo, round.id);
    db.prepare("UPDATE eqa_results SET sample='' WHERE round_id=?").run(round.id);
    // Lịch nối với đợt theo (chương trình, năm, số đợt): dòng lịch đang trỏ vào
    // kỳ cũ ("CYCLE 23" → 23) đi theo đợt vừa đổi số. Dòng lịch ghi sẵn
    // "CYCLE x SAMPLE y" thì để vòng dưới tính theo chính tên của nó.
    const schedule = db.prepare('SELECT id, round FROM eqa_schedule WHERE program_id=? AND year=? AND round_no=?')
      .get(round.program_id, round.year, Number(cycle)) as { id: string; round: string } | undefined;
    if (schedule && !RIQAS_SAMPLE_ROUND.test(schedule.round)
      && !db.prepare('SELECT 1 FROM eqa_schedule WHERE program_id=? AND year=? AND round_no=?').get(round.program_id, round.year, roundNo)) {
      db.prepare('UPDATE eqa_schedule SET round=?, round_no=? WHERE id=?').run(name, roundNo, schedule.id);
    }
  }
  // Số đợt của lịch được tính khi lưu bằng `eqaRoundNumber` bản cũ, nên
  // "CYCLE 23 SAMPLE 7" từng thành 23; tính lại theo cách đánh số mới. Trùng
  // với một dòng lịch khác thì giữ nguyên để không vỡ ràng buộc duy nhất.
  const scheduleRows = db.prepare('SELECT id, program_id, year, round, round_no FROM eqa_schedule').all() as
    { id: string; program_id: string; year: number; round: string; round_no: number }[];
  for (const row of scheduleRows) {
    if (!RIQAS_SAMPLE_ROUND.test(row.round)) continue;
    const roundNo = eqaRoundNumber(row.round);
    if (roundNo === row.round_no) continue;
    if (db.prepare('SELECT 1 FROM eqa_schedule WHERE program_id=? AND year=? AND round_no=?').get(row.program_id, row.year, roundNo)) continue;
    db.prepare('UPDATE eqa_schedule SET round_no=? WHERE id=?').run(roundNo, row.id);
  }
}

const RIQAS_SAMPLE_ROUND = /CYCLE\s*\d+\D+?SAMPLE\s*\d+/i;

/** Chuyển các dòng `actions` sang mô hình NCE mới (kế hoạch mục 6.1). Chạy lại
 * được: dòng đã chuyển (theo `legacy_action_id`) bị bỏ qua, và lần chạy/mốc
 * cắt chỉ ghi cho hồ sơ vừa được chèn. Hồ sơ đổi dải QC không chuyển (D-12). */
function migrateLegacyNce(db: SqliteLike): void {
  const users = db.prepare("SELECT id, name FROM users WHERE name<>''").all() as { id: string; name: string }[];
  const counts = new Map<string, number>();
  for (const user of users) counts.set(user.name.trim(), (counts.get(user.name.trim()) ?? 0) + 1);
  // Chỉ nhận tên khớp đúng MỘT tài khoản; trùng tên thì không đoán.
  const ownerIdByName = new Map(users.filter((user) => counts.get(user.name.trim()) === 1).map((user) => [user.name.trim(), user.id]));
  const rows = db.prepare('SELECT * FROM actions ORDER BY created_at, id').all() as unknown as LegacyActionRow[];
  for (const row of rows) {
    const mapped = mapLegacyAction(row, ownerIdByName);
    if (mapped.skip) continue;
    const cols = Object.keys(mapped.record);
    const inserted = db.prepare(`INSERT OR IGNORE INTO nce_records(${cols.map(quoteIdent).join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map((col) => mapped.record[col]));
    if (Number(inserted.changes) !== 1) continue;
    const point = row.point_id
      ? db.prepare('SELECT test_id, date, run_id FROM qc_points WHERE id=?').get(row.point_id) as { test_id: string; date: string; run_id: string } | undefined
      : undefined;
    if (point) {
      const points = db.prepare('SELECT id, level, lot, val, voided, qc_mean, qc_sd FROM qc_points WHERE test_id=? AND date=? AND run_id=? ORDER BY level')
        .all(point.test_id, point.date, point.run_id) as { id: string; level: number; lot: string; val: number; voided: number; qc_mean: number | null; qc_sd: number | null }[];
      // Migration không chạy lại engine: chỉ điểm của hồ sơ mang kết luận đã
      // lưu; các mức khác ghi "chưa đánh giá".
      const verdict = row.qc_verdict === 'rej' || row.qc_verdict === 'warn' ? row.qc_verdict : 'none';
      const snapshot = {
        legacy: true, testId: point.test_id, date: point.date, runId: point.run_id,
        points: points.map((p) => ({
          pointId: p.id, level: p.level, lot: p.lot, voided: !!p.voided, val: p.val, mean: p.qc_mean, sd: p.qc_sd, z: null,
          verdict: p.id === row.point_id ? verdict : 'none',
          rules: p.id === row.point_id && row.rule ? row.rule.split(',').map((r) => r.trim()).filter(Boolean) : [],
        })),
      };
      db.prepare(`INSERT OR IGNORE INTO nce_runs(id,nce_record_id,test_id,date,run_id,role,snapshot_json,attached_at,attached_by_user_id,attached_by_name)
        VALUES (?,?,?,?,?,'trigger',?,?,?,?)`).run(uid(), row.id, point.test_id, point.date, point.run_id, JSON.stringify(snapshot), row.created_at || '', row.created_by_user_id || '', row.created_by_username || '');
    }
    if (mapped.cutDate && row.test_id) {
      db.prepare('INSERT INTO nce_cuts(id,nce_record_id,test_id,date,run_id) VALUES (?,?,?,?,NULL)').run(uid(), row.id, row.test_id, mapped.cutDate);
    }
  }
}

/** `actions.error_type` chỉ được chứa MÃ `SE`/`RE`/`''`. Ba nguồn ghi từng
 * dùng ba bộ từ vựng khác nhau — form NCE ghi `SE`, huỷ điểm ghi
 * "SE — Sai số hệ thống", luồng quản lý dải ghi "Quản lý dải kiểm soát" —
 * nên `ActionsPage` so `=== 'SE'` hiện NGƯỢC thành "Sai số ngẫu nhiên" cho
 * hai nguồn sau. Mọi cổng ghi đã chuyển sang `normalizeErrorClass()`; bước
 * này dọn nốt dữ liệu đã lưu (kể cả dữ liệu vừa phục hồi từ backup cũ).
 * Phép ánh xạ phải khớp `normalizeErrorClass()`.
 * KHÔNG dùng `UPPER()`: nó chỉ gấp chữ ASCII nên "số"/"hệ" giữ nguyên và
 * mẫu so sánh viết hoa sẽ trượt. `LIKE` mặc định của SQLite đã không phân
 * biệt hoa/thường cho phần ASCII, còn ký tự có dấu thì so khớp nguyên văn. */
function normalizeErrorTypes(db: SqliteLike): void {
  db.exec(`UPDATE actions SET error_type = CASE
    WHEN TRIM(error_type) LIKE 'SE %' OR TRIM(error_type) LIKE '%sai số hệ thống%' THEN 'SE'
    WHEN TRIM(error_type) LIKE 'RE %' OR TRIM(error_type) LIKE '%sai số ngẫu nhiên%' THEN 'RE'
    ELSE '' END
    WHERE error_type NOT IN ('SE', 'RE', '');`);
}

/** Phiên bản schema đang ghi trong CSDL; 0 khi CSDL còn rỗng. */
export function readSchemaVersion(db: SqliteLike): number {
  const row = db.prepare("SELECT value FROM app_meta WHERE key='schemaVersion'").get() as { value: string } | undefined;
  const version = Number(row?.value ?? 0);
  return Number.isInteger(version) && version > 0 ? version : 0;
}

/** Tạo bảng còn thiếu rồi chạy các bước migration chưa chạy. Gọi khi mở CSDL
 * và ngay sau khi phục hồi dữ liệu (backup/Firebase) để dữ liệu cũ được nâng
 * cấp mà không phải khởi động lại app. Từ chối CSDL tạo bởi phiên bản mới hơn:
 * chạy tiếp trên schema mà app không hiểu dễ làm hỏng dữ liệu. */
export function applySchema(db: SqliteLike): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);
  const current = readSchemaVersion(db);
  if (current > SCHEMA_VERSION) {
    throw new Error(`Dữ liệu được tạo bởi phiên bản QC Lab mới hơn (schema ${current}, bản này hỗ trợ tới ${SCHEMA_VERSION}). Hãy cập nhật QC Lab.`);
  }
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    withTransaction(db, () => {
      migration.up(db);
      db.prepare("INSERT INTO app_meta(key,value) VALUES('schemaVersion',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
        .run(String(migration.version));
    });
  }
  db.exec(POST_MIGRATION_SQL);
}

/** Chèn các dòng khởi tạo bắt buộc: dòng `lab` id=1 (hồ sơ phòng xét nghiệm,
 * mọi trang Cài đặt đều đọc/ghi đúng dòng này) và một phép so sánh hoá chất
 * trống (trang So sánh hoá chất luôn giữ ít nhất một phép so sánh, xem
 * `removeComparison()`). Còn số phiên bản schema thì do bước migration trong
 * `applySchema()` ghi. Gọi khi mở CSDL và sau mỗi lần thay toàn bộ dữ liệu
 * (phục hồi, xoá sạch), vì đó là lúc các bảng này có thể trở về rỗng.
 * Trước 2026-09-26 dòng so sánh trống do `listComparisons()` chèn ngay trong
 * một lệnh đọc.
 *
 * Tách ra khỏi `openDatabase()` (2026-09-09) vì bản xem trước qua trình duyệt
 * mở SQLite bằng sql.js/WASM chứ không qua `node:sqlite`, nên không gọi được
 * `openDatabase()` — mà nếu nó tự chèn lại dòng này thì đó lại đúng là kiểu
 * nhân bản logic mà cả đợt này đang đi gỡ. Idempotent.
 */
export function seedInitialRows(db: SqliteLike): void {
  db.prepare('INSERT OR IGNORE INTO lab(id) VALUES (1)').run();
  if (!db.prepare('SELECT 1 FROM reagent_tests LIMIT 1').get()) {
    db.prepare(`INSERT INTO reagent_tests(id,reagent,lot_old,lot_new,date,operator,sample_type,unit,bias_target,alpha,coverage_confirmed,rows_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,0,?)`)
      .run(cleanId(uid()), DEFAULT_REAGENT_NAME, '', '', '', '', 'Mẫu bệnh nhân', '', 6, 0.05, JSON.stringify(prepareReagentRows(null)));
  }
}


