import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createReagentHandlers } = require('../../app-dist/main/ipc/reagent-handlers.js');

const db = openDatabase(':memory:');
const reagent = createReagentHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

const initial = reagent.listComparisons();
assert.equal(initial.length, 1, 'CSDL moi da co san 1 phep so sanh trong');
assert.equal(initial[0].result, null, 'chua nhap so lieu thi ket qua phai la null');

// Lệnh đọc không được ghi: bảng rỗng thì trả rỗng, không tự chèn dòng mẫu.
{
  const readOnlyDb = openDatabase(':memory:');
  readOnlyDb.exec('DELETE FROM reagent_tests');
  assert.deepEqual(createReagentHandlers(readOnlyDb).listComparisons(), []);
  assert.equal(readOnlyDb.prepare('SELECT COUNT(*) AS n FROM reagent_tests').get().n, 0, 'listComparisons khong ghi vao CSDL');
}

const firstId = initial[0].id;

const created = reagent.createComparison({ data: { name: 'Glucose', unit: 'mmol/L' } }, actor);
assert.equal(created.ok, true);
assert.equal(created.data.reagent, 'Glucose');
assert.equal(reagent.listComparisons().length, 2);

const metaSaved = reagent.saveMetadata({ id: created.data.id, data: { lotOld: 'L1', lotNew: 'L2', biasTarget: 8, coverageConfirmed: true } }, actor);
assert.equal(metaSaved.ok, true);
assert.equal(metaSaved.data.lot_old, 'L1');
assert.equal(metaSaved.data.bias_target, 8);
assert.equal(metaSaved.data.coverage_confirmed, 1);
// Giao diện lưu từng ô riêng khi rời ô: cập nhật một field không được xoá
// lô, ngưỡng, coverage hay đơn vị đã có từ lượt lưu trước.
const partialMetaSaved = reagent.saveMetadata({ id: created.data.id, data: { operator: 'KTV A' } }, actor);
assert.equal(partialMetaSaved.ok, true);
assert.equal(partialMetaSaved.data.operator, 'KTV A');
assert.equal(partialMetaSaved.data.lot_old, 'L1');
assert.equal(partialMetaSaved.data.lot_new, 'L2');
assert.equal(partialMetaSaved.data.unit, 'mmol/L');
assert.equal(partialMetaSaved.data.bias_target, 8);
assert.equal(partialMetaSaved.data.coverage_confirmed, 1);
// Rời ô mà không sửa gì không được ghi thêm một audit giả, nếu không nhật ký
// sẽ đầy các dòng "cập nhật" vô nghĩa trong thao tác nhập liệu thường ngày.
const auditBeforeNoop = db.prepare('SELECT COUNT(*) AS c FROM activity').get().c;
const sameMetaSaved = reagent.saveMetadata({ id: created.data.id, data: { operator: 'KTV A' } }, actor);
assert.equal(sameMetaSaved.ok, true);
assert.equal(db.prepare('SELECT COUNT(*) AS c FROM activity').get().c, auditBeforeNoop);
const badBias = reagent.saveMetadata({ id: created.data.id, data: { biasTarget: 0 } }, actor);
assert.equal(badBias.ok, false);
assert.equal(badBias.error.code, 'invalid-bias-target');
const badAlpha = reagent.saveMetadata({ id: created.data.id, data: { alpha: 1 } }, actor);
assert.equal(badAlpha.ok, false);
assert.equal(badAlpha.error.code, 'invalid-alpha');
const badOneTailAlpha = reagent.saveMetadata({ id: created.data.id, data: { alpha: 0.5 } }, actor);
assert.equal(badOneTailAlpha.ok, false);
assert.equal(badOneTailAlpha.error.code, 'invalid-alpha');

const oldVals = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 15, 25, 35, 45, 55, 65, 75, 85, 95, 105];
const rows = oldVals.map(v => [String(v), String(v * 1.01)]);
const rowsSaved = reagent.saveRows({ id: created.data.id, rows }, actor);
assert.equal(rowsSaved.ok, true);
assert.notEqual(rowsSaved.data.result, null);
assert.equal(rowsSaved.data.result.N, 20);
assert.equal(rowsSaved.data.result.passScreen, true, 'bias 1% + coverage confirmed + du 20 cap phai dat sang loc');

const removedFirst = reagent.removeComparison({ id: firstId }, actor);
assert.equal(removedFirst.ok, true);
assert.equal(reagent.listComparisons().length, 1);
const removedLast = reagent.removeComparison({ id: created.data.id }, actor);
assert.equal(removedLast.ok, false);
assert.equal(removedLast.error.code, 'last-comparison');

const notFound = reagent.saveMetadata({ id: 'khong-ton-tai', data: {} }, actor);
assert.equal(notFound.ok, false);
assert.equal(notFound.error.code, 'not-found');
const malformedSave = reagent.saveRows(null, actor);
assert.equal(malformedSave.ok, false);
assert.equal(malformedSave.error.code, 'not-found');
const malformedQuickList = reagent.listQuickValues(null);
assert.equal(malformedQuickList.ok, false);
assert.equal(malformedQuickList.error.code, 'invalid-type');

const fallbackCreated = reagent.createComparison(null, actor);
assert.equal(fallbackCreated.ok, true);
assert.equal(fallbackCreated.data.reagent, 'Hóa chất mới');
// Bản ghi lỗi từ backup cũ không được làm trang So sánh hóa chất crash.
db.prepare('UPDATE reagent_tests SET rows_json=? WHERE id=?').run('{"khong":"phai mang cap"}', fallbackCreated.data.id);
const recovered = reagent.listComparisons().find((row) => row.id === fallbackCreated.data.id);
assert.equal(recovered.result, null);
assert.deepEqual(recovered.rows, [['', ''], ['', ''], ['', ''], ['', ''], ['', '']]);

const defaultSampleTypes = reagent.listQuickValues({ type: 'sampleType' });
assert.equal(defaultSampleTypes.ok, true);
assert.deepEqual(defaultSampleTypes.data, ['Mẫu bệnh nhân', 'Mẫu nội kiểm (IQC)', 'Mẫu ngoại kiểm (EQA)']);
const defaultOperators = reagent.listQuickValues({ type: 'operator' });
assert.deepEqual(defaultOperators.data, []);
const badType = reagent.listQuickValues({ type: 'khong-hop-le' });
assert.equal(badType.ok, false);
assert.equal(badType.error.code, 'invalid-type');

const addedOp = reagent.addQuickListValue({ type: 'operator', value: '  Nguyễn Văn A  ' }, actor);
assert.equal(addedOp.ok, true);
assert.deepEqual(addedOp.data.items, ['Nguyễn Văn A']);
assert.equal(addedOp.data.value, 'Nguyễn Văn A');
const addedDup = reagent.addQuickListValue({ type: 'operator', value: 'nguyen van a' }, actor);
assert.equal(addedDup.ok, true);
assert.deepEqual(addedDup.data.items, ['Nguyễn Văn A'], 'them trung khong duoc tao dong moi');
assert.equal(addedDup.data.value, 'Nguyễn Văn A');
const addedEmpty = reagent.addQuickListValue({ type: 'operator', value: '   ' }, actor);
assert.equal(addedEmpty.ok, false);
assert.equal(addedEmpty.error.code, 'empty-value');

const addedOp2 = reagent.addQuickListValue({ type: 'operator', value: 'Trần Thị B' }, actor);
assert.deepEqual(addedOp2.data.items, ['Nguyễn Văn A', 'Trần Thị B']);
const removedOp = reagent.removeQuickListValue({ type: 'operator', index: 0 }, actor);
assert.equal(removedOp.ok, true);
assert.deepEqual(removedOp.data.items, ['Trần Thị B'], 'xoa dung vi tri, giu lai dung nguoi con lai');
const removedBadIndex = reagent.removeQuickListValue({ type: 'operator', index: 99 }, actor);
assert.equal(removedBadIndex.ok, false);
assert.equal(removedBadIndex.error.code, 'invalid-index');
assert.deepEqual(reagent.listQuickValues({ type: 'operator' }).data, ['Trần Thị B']);

console.log('app reagent-handlers end-to-end tests passed');


