// Schema SQLite cho QC Lab app mới. Xem kế hoạch kiến trúc (Kế hoạch: Viết
// lại QC Lab thành app mới) mục "Schema SQLite" cho lý do tách bảng vs giữ
// cột JSON. Nguyên tắc: tách bảng quan hệ thật khi có truy vấn
// WHERE/JOIN/sort thật cần (đặc biệt `qc_points`); giữ cột *_json khi cấu
// trúc luôn đọc/ghi nguyên khối theo cha, không filter xuyên hàng.
import type { SqliteLike } from './sqlite-like';

export const SCHEMA_VERSION = 1;

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
  -- (inUse, tính ở listLotGroups()), không phải giá trị lưu cứng. Chỉ
  -- 'stopped'/'planned' là trạng thái tự đặt thật — port đúng logic
  -- qcLotGroupOperational() app cũ (status field vắng mặt = "hoạt động
  -- bình thường", không có literal 'active' nào từng được lưu).
  status TEXT NOT NULL DEFAULT '',
  stopped_at TEXT NOT NULL DEFAULT '',
  -- Ảnh chụp thành viên NGUYÊN VẸN tại thời điểm lưu trữ (JSON mảng id lô,
  -- '' = không có ảnh chụp — mọi nhóm ĐANG hoạt động dùng giá trị này,
  -- listLotGroups() suy lotIds SỐNG từ qc_lots.group_id như bình thường).
  -- Chỉ nhóm "Đã lưu trữ" (do CHẤP NHẬN chuyển tiếp lô tạo ra) mới có giá
  -- trị khác rỗng — port đúng applyAcceptedLotTransition() app cũ: nhóm lưu
  -- trữ giữ NGUYÊN mọi lô cũ (kể cả lô KHÔNG chuyển tiếp, vd lô B khi A→C)
  -- làm thành viên, dù lô đó (B) đã thật sự chuyển sang thuộc nhóm ĐANG
  -- hoạt động qua group_id (1 lô chỉ có 1 group_id tại 1 thời điểm — khác
  -- app cũ dùng mảng lotIds không loại trừ lẫn nhau nên 1 lô lưu được trong
  -- CẢ HAI nhóm cùng lúc). Không có cột này thì card "Đã lưu trữ" chỉ hiện
  -- đúng lô đã chuyển tiếp, thiếu hẳn lô B dù tên nhóm "A/B" vẫn ngụ ý đủ 2.
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
  tea_ref_key TEXT NOT NULL DEFAULT '',
  eflm_analyte TEXT NOT NULL DEFAULT '',
  eflm_aps TEXT NOT NULL DEFAULT 'desirable',
  eflm_lookup_date TEXT NOT NULL DEFAULT '',
  eflm_ref TEXT NOT NULL DEFAULT '',
  sigma_tracked INTEGER NOT NULL DEFAULT 1,
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
  -- Ngày cấu hình Mean/SD ĐANG HOẠT ĐỘNG bắt đầu có hiệu lực — port
  -- effectiveFrom:isoToday() app cũ (commitTargetMatrix()/
  -- applyLotGroupActivation()): mọi lần lưu qua Bảng Mean/SD đều đóng dấu
  -- NGÀY LƯU, không chỉ khi giá trị đổi. '' = chưa từng lưu qua các luồng
  -- này (vd Mức 1 tự tạo lúc thêm xét nghiệm, chưa ai gán Mean/SD).
  mean_sd_effective_from TEXT NOT NULL DEFAULT '',
  UNIQUE (test_id, level)
);

-- Mean/SD "Dự kiến": số đã nhập sẵn cho lô của một nhóm lô CHƯA dùng đến,
-- chờ tới khi bấm "Kích hoạt nhóm lô" mới áp vào test_levels. Bảng RIÊNG,
-- KHÔNG nhét cờ planned vào mean_sd_history_json như app cũ: lịch sử là
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
  voided_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_qc_points_test_level_date ON qc_points(test_id, level, date);
CREATE INDEX IF NOT EXISTS idx_qc_points_test_run ON qc_points(test_id, run_id);
CREATE INDEX IF NOT EXISTS idx_qc_points_active ON qc_points(test_id, level, date) WHERE voided = 0;

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
  -- nhưng hồ sơ NCE phải giữ NGUYÊN VẸN (port đúng removeAssay() app cũ —
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
  avatar TEXT NOT NULL DEFAULT ''
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
`;

/** Mở kết nối và áp schema (idempotent — mọi CREATE TABLE đều IF NOT EXISTS).
 * `CREATE TABLE IF NOT EXISTS` KHÔNG tự thêm cột mới vào bảng đã tồn tại sẵn
 * trên đĩa — mọi cột thêm SAU lần tạo bảng đầu tiên (như `tests.active`,
 * 2026-09-01) cần 1 bước ALTER TABLE idempotent riêng ở đây, kiểm tra qua
 * `PRAGMA table_info` trước khi thêm để chạy lại nhiều lần không lỗi. */
export function applySchema(db: { exec: (sql: string) => void; prepare?: (sql: string) => { all: () => unknown[] } }): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);
  if (db.prepare) {
    const cols = db.prepare("PRAGMA table_info('tests')").all() as { name: string }[];
    if (!cols.some((c) => c.name === 'active')) {
      db.exec('ALTER TABLE tests ADD COLUMN active INTEGER NOT NULL DEFAULT 1;');
    }
    if (!cols.some((c) => c.name === 'analyte_id')) {
      db.exec("ALTER TABLE tests ADD COLUMN analyte_id TEXT NOT NULL DEFAULT '';");
    }
    if (!cols.some((c) => c.name === 'sigma_tracked')) {
      db.exec('ALTER TABLE tests ADD COLUMN sigma_tracked INTEGER NOT NULL DEFAULT 1;');
    }
    for (const [name, sql] of [['eflm_analyte', "TEXT NOT NULL DEFAULT ''"], ['eflm_aps', "TEXT NOT NULL DEFAULT 'desirable'"], ['eflm_lookup_date', "TEXT NOT NULL DEFAULT ''"], ['eflm_ref', "TEXT NOT NULL DEFAULT ''"]] as const) {
      if (!cols.some((c) => c.name === name)) db.exec(`ALTER TABLE tests ADD COLUMN ${name} ${sql};`);
    }
    // Không đoán EFLM từ `tea`: cột cũ có thể đã bị nguồn CLIA/Ricos ghi đè.
    // Giữ nguyên giá trị cũ để truy xuất; yêu cầu xác nhận lại EFLM một lần.
    if (!cols.some(c => c.name === 'eflm_tea')) db.exec('ALTER TABLE tests ADD COLUMN eflm_tea REAL;');
    const groupCols = db.prepare("PRAGMA table_info('lot_groups')").all() as { name: string }[];
    if (!groupCols.some((c) => c.name === 'archived_lot_ids_json')) {
      db.exec("ALTER TABLE lot_groups ADD COLUMN archived_lot_ids_json TEXT NOT NULL DEFAULT '';");
    }
    const userCols = db.prepare("PRAGMA table_info('users')").all() as { name: string }[];
    if (!userCols.some((c) => c.name === 'avatar')) {
      db.exec("ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT '';");
    }
    const levelCols = db.prepare("PRAGMA table_info('test_levels')").all() as { name: string }[];
    if (!levelCols.some((c) => c.name === 'mean_sd_effective_from')) {
      db.exec("ALTER TABLE test_levels ADD COLUMN mean_sd_effective_from TEXT NOT NULL DEFAULT '';");
    }
    const panelTestCols = db.prepare("PRAGMA table_info('qc_panel_tests')").all() as { name: string }[];
    if (!panelTestCols.some((c) => c.name === 'position')) {
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
    // `actions.error_type` chỉ được chứa MÃ `SE`/`RE`/`''`. Ba nguồn ghi từng
    // dùng ba bộ từ vựng khác nhau — form NCE ghi `SE`, huỷ điểm ghi
    // "SE — Sai số hệ thống", luồng quản lý dải ghi "Quản lý dải kiểm soát" —
    // nên `ActionsPage` so `=== 'SE'` hiện NGƯỢC thành "Sai số ngẫu nhiên" cho
    // hai nguồn sau. Mọi cổng ghi đã chuyển sang `normalizeErrorClass()`; bước
    // này dọn nốt dữ liệu đã lưu. Idempotent: dòng đã chuẩn bị `WHERE` loại ra.
    // Phép ánh xạ phải khớp `normalizeErrorClass()` trong
    // `main/domain/westgard-rules.ts`.
    // KHÔNG dùng `UPPER()`: nó chỉ gấp chữ ASCII nên "số"/"hệ" giữ nguyên và
    // mẫu so sánh viết hoa sẽ trượt. `LIKE` mặc định của SQLite đã không phân
    // biệt hoa/thường cho phần ASCII, còn ký tự có dấu thì so khớp nguyên văn.
    db.exec(`UPDATE actions SET error_type = CASE
      WHEN TRIM(error_type) LIKE 'SE %' OR TRIM(error_type) LIKE '%sai số hệ thống%' THEN 'SE'
      WHEN TRIM(error_type) LIKE 'RE %' OR TRIM(error_type) LIKE '%sai số ngẫu nhiên%' THEN 'RE'
      ELSE '' END
      WHERE error_type NOT IN ('SE', 'RE', '');`);
  }
}

/** Chèn các dòng khởi tạo bắt buộc cho một database CÒN RỖNG: mốc
 * `schemaVersion` trong `app_meta` và dòng `lab` id=1 (hồ sơ phòng xét
 * nghiệm, mọi trang Cài đặt đều đọc/ghi đúng dòng này).
 *
 * Tách ra khỏi `openDatabase()` (2026-09-09) vì bản xem trước qua trình duyệt
 * mở SQLite bằng sql.js/WASM chứ không qua `node:sqlite`, nên không gọi được
 * `openDatabase()` — mà nếu nó tự chèn lại 2 dòng này thì đó lại đúng là kiểu
 * nhân bản logic mà cả đợt này đang đi gỡ. Idempotent: chỉ chạy khi chưa có
 * mốc `schemaVersion`.
 */
export function seedInitialRows(db: SqliteLike): void {
  const row = db.prepare("SELECT value FROM app_meta WHERE key='schemaVersion'").get() as { value: string } | undefined;
  if (row) return;
  db.prepare("INSERT INTO app_meta(key,value) VALUES('schemaVersion',?)").run(String(SCHEMA_VERSION));
  db.prepare('INSERT OR IGNORE INTO lab(id) VALUES (1)').run();
}
