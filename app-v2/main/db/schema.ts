// Schema SQLite cho QC Lab app mới. Xem kế hoạch kiến trúc (Kế hoạch: Viết
// lại QC Lab thành app mới) mục "Schema SQLite" cho lý do tách bảng vs giữ
// cột JSON. Nguyên tắc: tách bảng quan hệ thật khi có truy vấn
// WHERE/JOIN/sort thật cần (đặc biệt `qc_points`); giữ cột *_json khi cấu
// trúc luôn đọc/ghi nguyên khối theo cha, không filter xuyên hàng.
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
  status TEXT NOT NULL DEFAULT 'active',
  stopped_at TEXT NOT NULL DEFAULT ''
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
  UNIQUE (test_id, level)
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
  test_id TEXT REFERENCES tests(id),
  level INTEGER,
  lot TEXT NOT NULL DEFAULT '',
  point_id TEXT REFERENCES qc_points(id),
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
-- app-v2/main/domain/audit-chain.ts cho thuật toán hash.
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
  must_change_password INTEGER NOT NULL DEFAULT 0
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

/** Mở kết nối và áp schema (idempotent — mọi CREATE TABLE đều IF NOT EXISTS). */
export function applySchema(db: { exec: (sql: string) => void }): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);
}
