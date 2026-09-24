// Thứ tự xét nghiệm TRONG một Panel QC là dữ liệu nghiệp vụ, không phải chi
// tiết trình bày: người dùng tick Na/K/Cl đúng thứ tự trả kết quả của bảng
// điện giải.
//
// Trước 2026-09-13 bảng nối `qc_panel_tests` không có cột nào ghi vị trí, và
// câu đọc không có `ORDER BY` — SQLite lấy thẳng từ index khoá chính
// `(panel_id, test_id)` nên trả về SẮP THEO test_id, một chuỗi ngẫu nhiên 7
// ký tự. Hai panel cùng 3 xét nghiệm hiện ra hai thứ tự khác nhau, không thứ
// tự nào là của người dùng.
//
// File này khoá cả 3 nửa của cách sửa:
//   1. NÂNG CẤP: DB tạo theo schema cũ phải LẤY LẠI đúng thứ tự đã tick —
//      lấp `position` từ `rowid`, vì handler luôn chèn theo đúng thứ tự
//      người dùng chọn nên thứ tự đó vẫn nằm nguyên trong DB.
//   2. GHI/ĐỌC: lưu thứ tự nào đọc ra đúng thứ tự đó, kể cả khi lưu lại với
//      thứ tự khác.
//   3. BACKUP CŨ: dòng có `position` NULL (xuất trước khi có cột, phục hồi
//      qua `restoreAllTables()` vốn bind null) vẫn giữ thứ tự trong backup.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
const require = createRequire(import.meta.url);

const { applySchema } = require('../../app-dist/main/db/schema.js');

const NA = 'j24t1sc', K = 'b9nwjaf', CL = 'mm9fzkt'; // id thật, cố ý KHÔNG theo thứ tự chữ cái
const doc = (db, panelId) => db.prepare(
  'SELECT test_id FROM qc_panel_tests WHERE panel_id=? ORDER BY position, rowid',
).all(panelId).map((r) => r.test_id);

// ── 1. Nâng cấp từ schema CŨ ──────────────────────────────────────────────
const db = new DatabaseSync(':memory:');
db.exec(`
CREATE TABLE instruments(id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE tests(id TEXT PRIMARY KEY, name TEXT NOT NULL, instrument_id TEXT NOT NULL REFERENCES instruments(id));
CREATE TABLE qc_panels(id TEXT PRIMARY KEY, name TEXT NOT NULL, instrument_id TEXT NOT NULL REFERENCES instruments(id),
  note TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE qc_panel_tests(
  panel_id TEXT NOT NULL REFERENCES qc_panels(id) ON DELETE CASCADE,
  test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  PRIMARY KEY (panel_id, test_id));
INSERT INTO instruments(id,name) VALUES ('i1','AU480');
INSERT INTO tests(id,name,instrument_id) VALUES ('${NA}','Sodium','i1'),('${K}','Potassium','i1'),('${CL}','Chloride','i1');
INSERT INTO qc_panels(id,name,instrument_id) VALUES ('p1','DG 1','i1'),('p2','DG 2','i1');
`);
// Hai panel cùng 3 xét nghiệm nhưng tick NGƯỢC nhau — nếu thứ tự bị mất thì
// cả hai đọc ra giống hệt, đó chính là triệu chứng người dùng gặp.
for (const t of [NA, K, CL]) db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id) VALUES (?,?)').run('p1', t);
for (const t of [CL, K, NA]) db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id) VALUES (?,?)').run('p2', t);

const truocP1 = db.prepare('SELECT test_id FROM qc_panel_tests WHERE panel_id=?').all('p1').map((r) => r.test_id);
const truocP2 = db.prepare('SELECT test_id FROM qc_panel_tests WHERE panel_id=?').all('p2').map((r) => r.test_id);
assert.deepEqual(truocP1, truocP2, 'schema cu: hai panel tick nguoc nhau van doc ra cung mot thu tu (chinh la loi)');

applySchema(db);
assert.ok(
  db.prepare("PRAGMA table_info('qc_panel_tests')").all().some((c) => c.name === 'position'),
  'ALTER TABLE phai them cot position vao DB da ton tai',
);
assert.deepEqual(doc(db, 'p1'), [NA, K, CL], 'panel cu phai lay lai dung thu tu da tick');
assert.deepEqual(doc(db, 'p2'), [CL, K, NA], 'panel cu thu hai phai lay lai thu tu RIENG cua no');

applySchema(db);
assert.deepEqual(doc(db, 'p1'), [NA, K, CL], 'applySchema phai idempotent, chay lai khong lap de len vi tri da co');

// ── 2. Ghi rồi đọc lại (đúng cách handler làm: DELETE hết rồi INSERT lại) ──
const luu = (panelId, ids) => {
  db.prepare('DELETE FROM qc_panel_tests WHERE panel_id=?').run(panelId);
  ids.forEach((testId, position) => {
    db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id,position) VALUES (?,?,?)').run(panelId, testId, position);
  });
};
luu('p1', [K, CL, NA]);
assert.deepEqual(doc(db, 'p1'), [K, CL, NA], 'luu lai voi thu tu khac thi doc ra thu tu MOI');
luu('p1', [NA, K, CL]);
assert.deepEqual(doc(db, 'p1'), [NA, K, CL], 'luu lai lan nua van bam dung thu tu vua luu');

// ── 3. Backup xuất TRƯỚC khi có cột: position NULL ────────────────────────
db.exec("INSERT INTO qc_panels(id,name,instrument_id) VALUES ('p3','Phuc hoi backup cu','i1')");
for (const t of [K, CL, NA]) db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id,position) VALUES (?,?,NULL)').run('p3', t);
assert.deepEqual(doc(db, 'p3'), [K, CL, NA], 'dong position NULL phai giu thu tu trong backup (tie-break bang rowid)');

// ── 4. Qua HANDLER thật: savePanel/listPanels phải giữ thứ tự ─────────────
// Nửa này khoá câu `ORDER BY position, rowid` trong `listPanels()`. Thiếu nó
// thì SQLite đọc từ index khoá chính và trả theo test_id — 4 phép kiểm ở trên
// vẫn xanh (chúng tự viết SQL) trong khi app thì sai.
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');

const live = openDatabase(':memory:');
const handlers = createConfigHandlers(live);
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test-client' };
const may = handlers.saveInstrument({ data: { name: 'AU480' } }, actor).data;
// Tên CỐ Ý không theo thứ tự chữ cái so với thứ tự tick, để phân biệt được
// "giữ thứ tự người dùng" với "sắp theo tên".
const xn = ['Sodium', 'Potassium', 'Chloride']
  .map((name) => handlers.saveTest({ data: { name, instrumentId: may.id } }, actor).data.id);

const panel = handlers.savePanel({ data: { name: 'Điện giải', instrumentId: may.id, testIds: xn } }, actor);
assert.equal(panel.ok, true);
const docPanel = () => handlers.listPanels().find((p) => p.id === panel.data.id).testIds;
assert.deepEqual(docPanel(), xn, 'listPanels phai tra ve dung thu tu da luu, khong sap theo test_id');

const daoNguoc = [...xn].reverse();
assert.equal(handlers.savePanel({ id: panel.data.id, data: { name: 'Điện giải', instrumentId: may.id, testIds: daoNguoc } }, actor).ok, true);
assert.deepEqual(docPanel(), daoNguoc, 'luu lai voi thu tu khac thi listPanels phai tra ve thu tu MOI');

console.log('app panel test order tests passed');


