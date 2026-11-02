// Migration schema 3: chuyển hồ sơ NCE protocol 3 (bảng `actions`) sang các
// bảng `nce_*` (docs/NCE-REDESIGN-2026-10-12.md mục 6.1). Ca nghiệm thu 18.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { applySchema } = require('../../app-dist/main/db/schema.js');

function legacyDb() {
  const db = openDatabase(':memory:');
  db.prepare("INSERT INTO users(id,username,name,role,active) VALUES ('u-an','an','KTV An','technician',1), ('u-b1','b1','Trùng Tên','technician',1), ('u-b2','b2','Trùng Tên','technician',1)").run();
  db.prepare("INSERT INTO instruments(id,name) VALUES ('m','Máy')").run();
  db.prepare("INSERT INTO tests(id,name,instrument_id) VALUES ('t','Glucose','m')").run();
  const point = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  point.run('p1', 't', 1, '2026-09-01', 'r1', 107, 'L1', 100, 2);
  point.run('p2', 't', 2, '2026-09-01', 'r1', 100, 'L2', 100, 2);
  const insert = db.prepare(`INSERT INTO actions(id,date,created_at,updated_at,created_by_user_id,created_by_username,test_id,level,lot,point_id,rule,error_type,qc_verdict,nce_id,
    protocol_version,approval_status,effectiveness_status,record_status,due_date,action_completed_date,detail_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,3,?,?,?,?,?,?)`);
  insert.run('a1', '2026-09-01', '2026-09-01T02:00:00Z', '2026-09-06T02:00:00Z', 'u-an', 'an', 't', 1, 'L1', 'p1', '1-3s', 'RE', 'rej', 'NCE-20260901-01',
    'approved', 'effective', 'active', '2026-09-08', '2026-09-05', JSON.stringify({
      eventSource: 'iqc', processPhase: 'exam', owner: 'KTV An', correction: 'Dừng trả kết quả, hiệu chuẩn lại', containmentStatus: 'held',
      riskSeverity: 3, riskOccurrence: 2, riskDetectability: 4, riskLevel: 'medium', riskBasis: 'SOP-QC-07',
      qcMaterialStatus: 'ok', instrumentStatus: 'checked-ok', reagentStatus: 'abnormal', reagentNote: 'Lô hoá chất mới', calibrationStatus: 'ok', lotToLotStatus: 'not-needed',
      causeCategory: 'calibration', cause: 'Hiệu chuẩn quá hạn', approvedBy: 'Người duyệt',
    }));
  insert.run('a2', '2026-09-02', '2026-09-02T02:00:00Z', '', 'u-an', 'an', null, null, '', null, '', '', '', 'NCE-20260902-01',
    'pending', 'pending', 'active', '', '', JSON.stringify({ eventSource: 'clinical', owner: 'Trùng Tên', correction: 'Liên hệ khoa lâm sàng' }));
  insert.run('a3', '2026-09-03', '2026-09-03T02:00:00Z', '', 'u-an', 'an', 't', 1, 'L1', null, '', '', '', 'NCE-20260903-01',
    'pending', 'pending', 'cancelled', '', '', JSON.stringify({ correction: 'Mở nhầm' }));
  insert.run('a4', '2026-09-04', '2026-09-04T02:00:00Z', '', 'u-an', 'an', 't', 1, 'L1', null, 'Thiết lập dải QC mới', '', '', 'NCE-20260904-01',
    'pending', 'pending', 'active', '', '', JSON.stringify({ correction: 'Đổi dải', rangeWorkflow: true }));
  insert.run('a5', '2026-09-05', '2026-09-05T02:00:00Z', '', 'u-an', 'an', 't', 1, 'L1', null, '2-2s', 'SE', '', 'NCE-20260905-01',
    'approved', 'ineffective', 'active', '', '2026-09-06', JSON.stringify({ correction: 'Hiệu chuẩn lại' }));
  // Mô phỏng CSDL schema 2 vừa được mở bằng bản mới.
  db.prepare("UPDATE app_meta SET value='2' WHERE key='schemaVersion'").run();
  return db;
}

const count = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

test('ca 18: chuyển hồ sơ cũ, không bịa dữ liệu, chạy lại không tạo trùng', () => {
  const db = legacyDb();
  applySchema(db);
  assert.equal(db.prepare("SELECT value FROM app_meta WHERE key='schemaVersion'").get().value, '9');
  const rows = Object.fromEntries(db.prepare('SELECT * FROM nce_records').all().map((r) => [r.id, r]));
  assert.deepEqual(Object.keys(rows).sort(), ['a1', 'a2', 'a3', 'a5'], 'hồ sơ đổi dải không chuyển (D-12)');

  const a1 = rows.a1;
  assert.equal(a1.status, 'closed');
  assert.equal(a1.qc_resolved, 1, 'đã duyệt và hiệu quả');
  assert.equal(a1.protocol_version, 3);
  assert.equal(a1.source, 'iqc');
  assert.equal(a1.owner_user_id, 'u-an', 'tên người phụ trách khớp đúng một tài khoản');
  assert.equal(a1.hold_results, 1);
  assert.equal(a1.risk_probability, 2, 'khả năng xảy ra lấy từ riskOccurrence cũ');
  assert.equal(a1.cause_category, 'calibration');
  assert.equal(a1.cause_status, 'identified');
  assert.equal(a1.error_class, 'RE');
  assert.equal(a1.tier, '', 'không tự phân tầng');
  const checklist = JSON.parse(a1.checklist_json);
  assert.deepEqual(checklist.instrument, { status: 'ok', note: '' });
  assert.deepEqual(checklist.reagent, { status: 'abnormal', note: 'Lô hoá chất mới' });
  assert.deepEqual(checklist.lotChange, { status: 'na', note: '' });
  assert.equal(JSON.parse(a1.legacy_json).id, 'a1', 'giữ nguyên dòng cũ');
  assert.match(JSON.parse(a1.legacy_json).detail_json, /approvedBy/);

  const runs = db.prepare("SELECT * FROM nce_runs WHERE nce_record_id='a1'").all();
  assert.equal(runs.length, 1);
  assert.equal(runs[0].role, 'trigger');
  assert.equal(runs[0].run_id, 'r1');
  const points = JSON.parse(runs[0].snapshot_json).points;
  assert.deepEqual(points.map((p) => [p.pointId, p.verdict]), [['p1', 'rej'], ['p2', 'none']], 'chỉ điểm của hồ sơ mang kết luận đã lưu');

  // Mốc cắt theo ngày giữ đúng cách tính trước khi đổi (giai đoạn mới từ ngày sau).
  assert.deepEqual(db.prepare('SELECT nce_record_id, test_id, date, run_id FROM nce_cuts').all().map((r) => ({ ...r })),
    [{ nce_record_id: 'a1', test_id: 't', date: '2026-09-05', run_id: null }]);

  assert.equal(rows.a2.status, 'open', 'chưa duyệt thành đang xử lý, không tự cho chạy lại');
  assert.equal(rows.a2.source, 'other');
  assert.equal(rows.a2.owner_user_id, '', 'tên trùng hai tài khoản thì không đoán');
  assert.equal(rows.a2.hold_results, null);
  assert.equal(rows.a3.status, 'cancelled');
  assert.equal(rows.a5.status, 'closed');
  assert.equal(rows.a5.qc_resolved, 0, 'duyệt nhưng không hiệu quả thì không tính là đã xử lý');

  // Chạy lại (ví dụ phục hồi cùng bản backup lần nữa): không tạo trùng.
  db.prepare("UPDATE app_meta SET value='2' WHERE key='schemaVersion'").run();
  applySchema(db);
  assert.equal(count(db, 'nce_records'), 4);
  assert.equal(count(db, 'nce_runs'), 1);
  assert.equal(count(db, 'nce_cuts'), 1);
  assert.equal(count(db, 'actions'), 5, 'bảng cũ giữ nguyên');
  db.close();
});
