import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { listActivity } from './helpers/activity.mjs';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
import { createIqcNce, ensureUser } from './helpers/nce-flow.mjs';

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const nce = createNceHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

const instrument = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mg/dL' } }, actor).data;
const levelSetup = config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 10, sd: 1 } }, actor);
assert.equal(levelSetup.ok, true, 'chuẩn bị Mean/SD cho Mức 1 phải thành công: ' + JSON.stringify(levelSetup));

// Mean/SD riêng lẻ chưa đủ; phải có Panel và lô trong nhóm đang chạy.
const notOperational = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-07-31', val: 10 } }, actor);
assert.equal(notOperational.ok, false);
assert.equal(notOperational.error.code, 'level-not-operational');
const operational = makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });
db.prepare('UPDATE qc_panels SET active=0 WHERE id=?').run(operational.panelId);
assert.equal(entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-07-31', val: 10 } }, actor).error.code, 'level-not-operational');
db.prepare('UPDATE qc_panels SET active=1 WHERE id=?').run(operational.panelId);
db.prepare('UPDATE tests SET active=0 WHERE id=?').run(test.id);
assert.equal(entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-07-31', val: 10 } }, actor).error.code, 'level-not-operational');
db.prepare('UPDATE tests SET active=1 WHERE id=?').run(test.id);

const p1 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-01', val: 10.1, runId: '2026-08-01-1' } }, actor);
assert.equal(p1.ok, true);
assert.equal(p1.data.verdict, 'ok');
assert.equal(p1.data.operator_code, 'QTV', 'điểm QC phải chốt mã nhân viên để bảng worksheet hiển thị');

// Cổng ghi phải chặn trùng cùng mức/lô/ngày/run, kể cả khi caller không đi
// qua worksheet (LIS và IPC trực tiếp). Điểm voided được phép dùng lại run.
const duplicateRun = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-01', val: 10.2, runId: '2026-08-01-1' } }, actor);
assert.equal(duplicateRun.ok, false);
assert.equal(duplicateRun.error.code, 'duplicate-run');
assert.equal(entry.queryPoints(test.id, 1).length, 1, 'từ chối trùng không được tạo thêm điểm QC');

const p2 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-02', val: 14, runId: '2026-08-02-1' } }, actor);
assert.equal(p2.ok, true);
assert.equal(p2.data.verdict, 'rej');
assert.ok(p2.data.rules.includes('1-3s'));

const badLevel = entry.addPoint({ data: { testId: test.id, level: 9, date: '2026-08-03', val: 10 } }, actor);
assert.equal(badLevel.ok, false);
assert.equal(badLevel.error.code, 'invalid-level');

const points = entry.queryPoints(test.id, 1);
assert.equal(points.length, 2);
assert.deepEqual(points.map(p => p.date), ['2026-08-01', '2026-08-02']);

const shortReason = entry.voidPoint({ data: { pointId: p2.data.id, reason: 'x' } }, actor);
assert.equal(shortReason.ok, false);
assert.equal(shortReason.error.code, 'reason-too-short');

const voided = entry.voidPoint({ data: { pointId: p2.data.id, reason: 'Nhap sai gia tri, da kiem tra lai may' } }, actor);
assert.equal(voided.ok, true);

const pointsAfterVoid = entry.queryPoints(test.id, 1);
assert.equal(pointsAfterVoid.length, 1);
assert.equal(pointsAfterVoid[0].id, p1.data.id);
const voidedRows = entry.listVoidedPoints(test.id);
assert.equal(voidedRows.length, 1, 'điểm đã huỷ phải có endpoint tra cứu riêng');
assert.equal(voidedRows[0].id, p2.data.id);
assert.equal(voidedRows[0].voided_by, actor.username);
assert.equal(voidedRows[0].voided_by_name, actor.username, 'không còn tài khoản thì vẫn đối chiếu được username gốc');
assert.match(voidedRows[0].void_reason, /Nhap sai gia tri/);

// Điểm cũ tự hiển thị họ tên khi tra được tài khoản, kể cả tài khoản đã tắt.
db.prepare('INSERT INTO users(id,username,name,role,active) VALUES (?,?,?,?,0)')
  .run('void-display-user', actor.username, 'Nguyễn Văn Cần', 'admin');
assert.equal(entry.listVoidedPoints(test.id)[0].voided_by_name, 'Nguyễn Văn Cần');
assert.equal(entry.listVoidedPoints(test.id)[0].voided_by, actor.username, 'họ tên hiển thị không được thay username truy vết');
db.prepare("UPDATE users SET name='   ' WHERE id='void-display-user'").run();
assert.equal(entry.listVoidedPoints(test.id)[0].voided_by_name, actor.username, 'tên trống không che mất người huỷ gốc');
db.prepare("DELETE FROM users WHERE id='void-display-user'").run();
assert.equal(entry.listVoidedPoints(test.id)[0].voided_by_name, actor.username);

const voidAgain = entry.voidPoint({ data: { pointId: p2.data.id, reason: 'Nhap sai gia tri lan nua' } }, actor);
assert.equal(voidAgain.ok, false);
assert.equal(voidAgain.error.code, 'already-voided');

const rerunAfterVoid = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-02', val: 10.2, runId: '2026-08-02-1' } }, actor);
assert.equal(rerunAfterVoid.ok, true, 'điểm đã huỷ không được chặn lần chạy thay thế cùng run ID');

// 8) Audit: 3 lần thêm điểm thành công + 1 lần huỷ thành công = 4 dòng (không
const activity = listActivity(db);
const entryRelated = activity.filter(a => a.type === 'Nhập QC' || a.type === 'Huỷ điểm QC');
assert.equal(entryRelated.length, 4, 'chi thao tac thanh cong moi ghi audit');

const p3 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-04', val: 14, runId: '2026-08-04-1' } }, actor);
assert.equal(p3.ok, true);
assert.equal(p3.data.verdict, 'rej');
const voidAnalytical = entry.voidPoint({ data: { pointId: p3.data.id, kind: 'analytical', reason: 'Máy báo lỗi hút mẫu lúc chạy QC' } }, actor);
assert.equal(voidAnalytical.ok, true, JSON.stringify(voidAnalytical));
assert.equal(voidAnalytical.data.reusedAction, false);
assert.ok(voidAnalytical.data.nceId, 'kind analytical phai tu mo 1 ho so NCE moi');
const opened = nce.listNce().find(r => r.nce_id === voidAnalytical.data.nceId);
assert.ok(opened, 'ho so NCE vua mo phai doc lai duoc');
assert.equal(opened.source, 'iqc');
assert.equal(opened.error_class, 'RE');
assert.equal(opened.status, 'open');
// Hồ sơ tự mở có người phụ trách (người huỷ) và hạn, nên được tính quá hạn (sửa R-11).
assert.equal(opened.owner_user_id, actor.userId);
assert.match(opened.due_date, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(opened.hold_results, null, 'chưa biết có giữ kết quả hay không, phải ghi trước khi cho chạy lại');
const openedDossier = nce.getNce(opened.id, actor);
assert.equal(openedDossier.runs.length, 1);
assert.equal(openedDossier.runs[0].role, 'trigger');
assert.equal(openedDossier.runs[0].run_id, '2026-08-04-1');
const triggerPoint = JSON.parse(openedDossier.runs[0].snapshot_json).points.find((p) => p.pointId === p3.data.id);
assert.equal(triggerPoint.verdict, 'rej', 'snapshot chụp TRƯỚC khi huỷ nên còn kết luận loại');
assert.deepEqual(triggerPoint.rules, ['1-3s']);
assert.equal(triggerPoint.voided, false);

const p4 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-05', val: 14, runId: '2026-08-05-1' } }, actor);
// N4: điểm Loại bỏ — kể cả nhập sai dữ liệu — phải có lý do ≥ 10 ký tự.
assert.equal(entry.voidPoint({ data: { pointId: p4.data.id, kind: 'data-entry' } }, actor).error.code, 'reason-required-rejected-run');
const voidDataEntry = entry.voidPoint({ data: { pointId: p4.data.id, kind: 'data-entry', reason: 'Gõ nhầm 14 thay cho 10.4' } }, actor);
assert.equal(voidDataEntry.ok, true);
assert.equal(voidDataEntry.data.nceId, null, "kind data-entry khong duoc mo NCE");

const p5 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-06', val: 10.2, runId: '2026-08-06-1' } }, actor);
const voidOtherShort = entry.voidPoint({ data: { pointId: p5.data.id, kind: 'other', reason: 'x' } }, actor);
assert.equal(voidOtherShort.ok, false);
assert.equal(voidOtherShort.error.code, 'reason-too-short');
const voidOtherOk = entry.voidPoint({ data: { pointId: p5.data.id, kind: 'other', reason: 'Nhap sai gia tri do nham lan may', openNce: true } }, actor);
assert.equal(voidOtherOk.ok, true);
assert.ok(voidOtherOk.data.nceId, "kind other tu chon openNce=true phai mo NCE");

const p6 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-07', val: 14, runId: '2026-08-07-1' } }, actor);
ensureUser(db, actor);
const manualNce = createIqcNce(nce, actor, test.id, { date: '2026-08-07', runId: '2026-08-07-1' });
const voidReuse = entry.voidPoint({ data: { pointId: p6.data.id, kind: 'analytical', reason: 'Máy báo lỗi hút mẫu lúc chạy QC' } }, actor);
assert.equal(voidReuse.ok, true);
assert.equal(voidReuse.data.reusedAction, true, 'phai dung lai ho so NCE dang xu ly cua chinh lan chay nay');
assert.equal(voidReuse.data.nceId, manualNce.record.nce_id);

const lotA = config.saveLot({ data: { lotNo: 'GRP-A', level: 1 } }, actor).data;
const lotB = config.saveLot({ data: { lotNo: 'GRP-B', level: 1 } }, actor).data;
const group = config.saveLotGroup({ data: { name: 'Nhom test GRP', lotIds: [lotA.id, lotB.id] } }, actor).data;
config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 10, sd: 1, qcLotId: lotA.id } }, actor);
const beforeStop = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-08', val: 10 } }, actor);
assert.equal(beforeStop.ok, true, 'nhom lo con hoat dong thi van nhap QC binh thuong');
config.stopLotGroup({ id: group.id }, actor);
const afterStop = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-09', val: 10 } }, actor);
assert.equal(afterStop.ok, false, 'nhom lo da Dung phai chan nhap QC');
assert.equal(afterStop.error.code, 'level-not-operational');

console.log('app entry-handlers end-to-end tests passed');


