// Kiểm chứng end-to-end module thí điểm: SQLite thật (in-memory) + IPC
// handler + validate + audit hash-chain — chứng minh cả 4 lớp kiến trúc
// hoạt động đúng cùng nhau (không phải unit test cô lập).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { verifyAuditChain } = require('../../app-v2-dist/main/domain/audit-chain.js');

const db = openDatabase(':memory:');
const handlers = createConfigHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test-client' };

// 1) Thêm máy xét nghiệm
const instrumentResult = handlers.saveInstrument({ data: { name: 'Máy A', manufacturer: 'Siemens' } }, actor);
assert.equal(instrumentResult.ok, true);
const instrument = instrumentResult.data;
assert.equal(instrument.name, 'Máy A');
assert.ok(instrument.id);

// 2) Trùng tên (không phân biệt dấu) phải bị chặn
const dup = handlers.saveInstrument({ data: { name: 'máy a' } }, actor);
assert.equal(dup.ok, false);
assert.equal(dup.error.code, 'duplicate-name');

// 3) Thêm xét nghiệm — tự động có Mức 1 mặc định
const testResult = handlers.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mg/dL', decimalPlaces: 1 } }, actor);
assert.equal(testResult.ok, true);
const test = testResult.data;
assert.equal(test.name, 'Glucose');
const levels1 = handlers.listTestLevels(test.id);
assert.equal(levels1.length, 1);
assert.equal(levels1[0].level, 1);

// 4) Xét nghiệm chưa có máy phải bị chặn
const noInstrument = handlers.saveTest({ data: { name: 'Ure', instrumentId: 'khong-ton-tai' } }, actor);
assert.equal(noInstrument.ok, false);
assert.equal(noInstrument.error.code, 'missing-instrument');

// 5) Thêm Mức 2 với Mean/SD
const levelResult = handlers.saveTestLevel({ testId: test.id, data: { level: 2, mean: 5.5, sd: 0.2 } }, actor);
assert.equal(levelResult.ok, true);
assert.equal(levelResult.data.mean, 5.5);
const levels2 = handlers.listTestLevels(test.id);
assert.equal(levels2.length, 2);

// 6) saveTestLevel là UPSERT — lưu lại ĐÚNG mức đã có (Mức 2) là cập nhật,
// không phải lỗi trùng.
const resave = handlers.saveTestLevel({ testId: test.id, data: { level: 2, mean: 1, sd: 1 } }, actor);
assert.equal(resave.ok, true);
assert.equal(resave.data.mean, 1, 'lưu lại đúng mức phải CẬP NHẬT Mean/SD, không tạo dòng mới');
assert.equal(handlers.listTestLevels(test.id).length, 2, 'vẫn đúng 2 mức, không nhân đôi');

// 7) Danh sách phải phản ánh đúng số lượng
assert.equal(handlers.listInstruments().length, 1);
assert.equal(handlers.listTests().length, 1);

// 8) Audit log: mỗi thao tác GHI THÀNH CÔNG phải có đúng 1 dòng (4 thao tác
// thành công: thêm máy, thêm xét nghiệm, thêm mức 2, sửa lại mức 2 — các
// thao tác BỊ CHẶN không ghi audit).
const activity = handlers.listActivity();
assert.equal(activity.length, 4, 'chỉ thao tác thành công mới ghi audit');
assert.deepEqual(activity.map(a => a.type).sort(), ['Sửa mức QC', 'Thêm mức QC', 'Thêm máy xét nghiệm', 'Thêm xét nghiệm'].sort());

// 9) Chuỗi hash-chain phải verify OK (đọc lại theo đúng thứ tự seq tăng dần).
const chronological = handlers.listActivity().slice().reverse();
const verify = verifyAuditChain(chronological, '');
assert.equal(verify.ok, true, 'chuỗi audit phải hợp lệ: ' + JSON.stringify(verify));
assert.equal(verify.checked, 4);

console.log('app-v2 config-handlers end-to-end tests passed');
