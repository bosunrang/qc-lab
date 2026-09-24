// Một mục danh mục xét nghiệm có thể gán nhiều máy, nhưng mỗi máy vẫn giữ
// một test_id độc lập cho toàn bộ dữ liệu QC phía sau.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test-client' };

const machine1 = config.saveInstrument({ data: { name: 'Máy 1', section: 'Khu vực 1' } }, actor).data;
const machine2 = config.saveInstrument({ data: { name: 'Máy 2', section: 'Khu vực 2' } }, actor).data;
const machine3 = config.saveInstrument({ data: { name: 'Máy 3', section: 'Khu vực 2' } }, actor).data;
const machine4 = config.saveInstrument({ data: { name: 'Máy 4', section: 'Khu vực 3' } }, actor).data;

const created = config.saveTest({ data: {
  name: 'Sodium (Na)', teaRefKey: 'qclab-sodium', unit: 'mmol/L', tea: 0.73,
  instrumentIds: [machine1.id, machine2.id],
} }, actor);
assert.equal(created.ok, true);
assert.equal(created.data.assignment_ids.length, 2);

let rows = config.listTests();
assert.equal(rows.length, 2);
assert.equal(new Set(rows.map(row => row.analyte_id)).size, 1, 'mọi máy phải cùng analyte_id');
assert.deepEqual(rows.map(row => row.section).sort(), ['Khu vực 1', 'Khu vực 2']);
assert.ok(rows.every(row => config.listTestLevels(row.id).length === 1), 'mỗi cấu hình máy có Mức 1 độc lập');

const updated = config.saveTest({ id: created.data.id, data: {
  name: 'Sodium (Na)', teaRefKey: 'qclab-sodium', unit: 'mmol/L', tea: 0.73,
  analyteId: rows[0].analyte_id, assignmentIds: rows.map(row => row.id),
  instrumentIds: [machine1.id, machine2.id, machine3.id],
} }, actor);
assert.equal(updated.ok, true);
assert.equal(updated.data.assignment_ids.length, 3);
rows = config.listTests();
assert.equal(rows.length, 3, 'thêm máy không được nhân đôi các máy đã gán');

// Sửa từ dropdown chỉ cập nhật cấu hình của máy đang chọn. Đây là điều kiện
// bắt buộc khi cùng một xét nghiệm dùng hóa chất khác nhau trên từng máy.
const machine2Row = rows.find(row => row.instrument_id === machine2.id);
const singleUpdated = config.saveTest({ id: machine2Row.id, data: {
  name: 'Sodium (Na)', instrumentId: machine2.id, section: 'Khu vực 2',
  teaRefKey: 'qclab-sodium', unit: 'mmol/L', tea: 0.73, reagent: 'Hóa chất máy 2',
} }, actor);
assert.equal(singleUpdated.ok, true);
rows = config.listTests();
assert.equal(rows.find(row => row.instrument_id === machine2.id).reagent, 'Hóa chất máy 2');
assert.equal(rows.find(row => row.instrument_id === machine1.id).reagent, '', 'không được ghi đè hóa chất máy khác');

const assignedMore = config.saveTest({ id: machine2Row.id, data: {
  name: 'Sodium (Na)', teaRefKey: 'qclab-sodium', unit: 'mmol/L', tea: 0.73,
  reagent: 'Hóa chất máy 2', analyteId: machine2Row.analyte_id,
  assignmentIds: rows.map(row => row.id), instrumentIds: [...rows.map(row => row.instrument_id), machine4.id],
  preserveExistingAssignments: true,
} }, actor);
assert.equal(assignedMore.ok, true);
rows = config.listTests();
assert.equal(rows.length, 4);
assert.equal(rows.find(row => row.instrument_id === machine1.id).reagent, '', 'gán máy mới phải giữ hóa chất máy cũ');
assert.equal(rows.find(row => row.instrument_id === machine2.id).reagent, 'Hóa chất máy 2');
assert.equal(rows.find(row => row.instrument_id === machine4.id).reagent, 'Hóa chất máy 2', 'máy mới nhận thông số đang hiển thị');

const machine3Row = rows.find(row => row.instrument_id === machine3.id);
const removedAssignment = config.removeTest({ id: machine3Row.id, ids: [machine3Row.id] }, actor);
assert.equal(removedAssignment.ok, true);
rows = config.listTests();
assert.equal(rows.length, 3, 'gỡ một máy phải giữ lại các máy còn lại trong cùng danh mục');

const removed = config.removeTest({ id: rows[0].id, ids: rows.map(row => row.id) }, actor);
assert.equal(removed.ok, true);
assert.equal(config.listTests().length, 0);
assert.equal(db.prepare('SELECT COUNT(*) n FROM test_levels').get().n, 0);

db.close();
console.log('app multi-instrument test catalog tests passed');


