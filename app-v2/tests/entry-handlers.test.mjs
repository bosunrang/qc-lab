// Kiem chung end-to-end module Entry: SQLite that + IPC handler + engine
// Westgard + audit - dung index (test_id, level, date) that trong schema.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-v2-dist/main/ipc/entry-handlers.js');
const { createNceHandlers } = require('../../app-v2-dist/main/ipc/nce-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const nce = createNceHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

// Chuan bi: 1 may, 1 xet nghiem, muc 1 co Mean=10 SD=1
const instrument = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mg/dL' } }, actor).data;
const levelSetup = config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 10, sd: 1 } }, actor);
assert.equal(levelSetup.ok, true, 'chuẩn bị Mean/SD cho Mức 1 phải thành công: ' + JSON.stringify(levelSetup));

// Cổng app cũ: Mean/SD riêng lẻ chưa đủ; phải có Panel + lô trong nhóm đang chạy.
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

// 1) Them diem QC binh thuong
const p1 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-01', val: 10.1, runId: '2026-08-01-1' } }, actor);
assert.equal(p1.ok, true);
assert.equal(p1.data.verdict, 'ok');

// Cổng ghi phải chặn trùng cùng mức/lô/ngày/run, kể cả khi caller không đi
// qua worksheet (LIS và IPC trực tiếp). Điểm voided được phép dùng lại run.
const duplicateRun = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-01', val: 10.2, runId: '2026-08-01-1' } }, actor);
assert.equal(duplicateRun.ok, false);
assert.equal(duplicateRun.error.code, 'duplicate-run');
assert.equal(entry.queryPoints(test.id, 1).length, 1, 'từ chối trùng không được tạo thêm điểm QC');

// 2) Them diem vuot 3SD -> phai bi 'rej' voi luat 1-3s
const p2 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-02', val: 14, runId: '2026-08-02-1' } }, actor);
assert.equal(p2.ok, true);
assert.equal(p2.data.verdict, 'rej');
assert.ok(p2.data.rules.includes('1-3s'));

// 3) Sai muc khong ton tai phai bi chan
const badLevel = entry.addPoint({ data: { testId: test.id, level: 9, date: '2026-08-03', val: 10 } }, actor);
assert.equal(badLevel.ok, false);
assert.equal(badLevel.error.code, 'invalid-level');

// 4) queryPoints tra dung 2 diem, dung thu tu ngay
const points = entry.queryPoints(test.id, 1);
assert.equal(points.length, 2);
assert.deepEqual(points.map(p => p.date), ['2026-08-01', '2026-08-02']);

// 5) Huy diem thu 2 - ly do qua ngan phai bi chan
const shortReason = entry.voidPoint({ data: { pointId: p2.data.id, reason: 'x' } }, actor);
assert.equal(shortReason.ok, false);
assert.equal(shortReason.error.code, 'reason-too-short');

const voided = entry.voidPoint({ data: { pointId: p2.data.id, reason: 'Nhap sai gia tri, da kiem tra lai may' } }, actor);
assert.equal(voided.ok, true);

// 6) Sau khi huy, queryPoints (khong gom diem da huy) chi con 1 diem
const pointsAfterVoid = entry.queryPoints(test.id, 1);
assert.equal(pointsAfterVoid.length, 1);
assert.equal(pointsAfterVoid[0].id, p1.data.id);
const voidedRows = entry.listVoidedPoints(test.id);
assert.equal(voidedRows.length, 1, 'điểm đã hủy phải có endpoint tra cứu riêng');
assert.equal(voidedRows[0].id, p2.data.id);
assert.equal(voidedRows[0].voided_by, actor.username);
assert.match(voidedRows[0].void_reason, /Nhap sai gia tri/);

// 7) Huy lan 2 cung 1 diem phai bi chan
const voidAgain = entry.voidPoint({ data: { pointId: p2.data.id, reason: 'Nhap sai gia tri lan nua' } }, actor);
assert.equal(voidAgain.ok, false);
assert.equal(voidAgain.error.code, 'already-voided');

const rerunAfterVoid = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-02', val: 10.2, runId: '2026-08-02-1' } }, actor);
assert.equal(rerunAfterVoid.ok, true, 'điểm đã hủy không được chặn lần chạy thay thế cùng run ID');

// 8) Audit: 3 lần thêm điểm thành công + 1 lần hủy thành công = 4 dòng (không
// tinh cac thao tac config o buoc chuan bi)
const activity = config.listActivity();
const entryRelated = activity.filter(a => a.type === 'Nhập QC' || a.type === 'Hủy điểm QC');
assert.equal(entryRelated.length, 4, 'chi thao tac thanh cong moi ghi audit');

// 9) Huy voi kind='analytical' (mac dinh) -> TU MO 1 ho so NCE moi, gan dung
// pointId/rule/errorType/qcVerdict cua diem vua huy (diem p2 vuot 3SD, luat
// 1-3s, RE). Ly do khong bat buoc (chi khuyen nghi) khi kind khac 'other'.
const p3 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-04', val: 14, runId: '2026-08-04-1' } }, actor);
assert.equal(p3.ok, true);
assert.equal(p3.data.verdict, 'rej');
const voidAnalytical = entry.voidPoint({ data: { pointId: p3.data.id, kind: 'analytical' } }, actor);
assert.equal(voidAnalytical.ok, true, JSON.stringify(voidAnalytical));
assert.equal(voidAnalytical.data.reusedAction, false);
assert.ok(voidAnalytical.data.nceId, 'kind analytical phai tu mo 1 ho so NCE moi');
const nceRecords = nce.listRecords();
const opened = nceRecords.find(r => r.nce_id === voidAnalytical.data.nceId);
assert.ok(opened, 'ho so NCE vua mo phai doc lai duoc');
assert.equal(opened.point_id, p3.data.id);
assert.equal(opened.rule, '1-3s');
assert.equal(opened.qc_verdict, 'rej');
assert.equal(opened.error_type, 'RE — Sai số ngẫu nhiên');

// 10) Huy voi kind='data-entry' -> KHONG mo NCE nao ca, du diem cung vi pham.
const p4 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-05', val: 14, runId: '2026-08-05-1' } }, actor);
const voidDataEntry = entry.voidPoint({ data: { pointId: p4.data.id, kind: 'data-entry' } }, actor);
assert.equal(voidDataEntry.ok, true);
assert.equal(voidDataEntry.data.nceId, null, "kind data-entry khong duoc mo NCE");

// 11) Huy voi kind='other' thieu ly do -> bi chan; du >=5 ky tu va openNce
// tu chon (khong bi khoa cung nhu 2 kind tren).
const p5 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-06', val: 10.2, runId: '2026-08-06-1' } }, actor);
const voidOtherShort = entry.voidPoint({ data: { pointId: p5.data.id, kind: 'other', reason: 'x' } }, actor);
assert.equal(voidOtherShort.ok, false);
assert.equal(voidOtherShort.error.code, 'reason-too-short');
const voidOtherOk = entry.voidPoint({ data: { pointId: p5.data.id, kind: 'other', reason: 'Nhap sai gia tri do nham lan may', openNce: true } }, actor);
assert.equal(voidOtherOk.ok, true);
assert.ok(voidOtherOk.data.nceId, "kind other tu chon openNce=true phai mo NCE");

// 12) Diem da co san 1 ho so NCE thu cong (tao qua nce.create, gan dung
// pointId) -> huy voi kind='analytical' phai DUNG LAI ho so do, khong mo moi.
const p6 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-07', val: 14, runId: '2026-08-07-1' } }, actor);
const manualNce = nce.create({ data: { testId: test.id, level: 1, date: '2026-08-07', pointId: p6.data.id, correction: 'Da kiem tra lai may truoc khi huy diem' } }, actor);
assert.equal(manualNce.ok, true, JSON.stringify(manualNce));
const voidReuse = entry.voidPoint({ data: { pointId: p6.data.id, kind: 'analytical' } }, actor);
assert.equal(voidReuse.ok, true);
assert.equal(voidReuse.data.reusedAction, true, 'phai dung lai ho so NCE da gan san cho diem nay');
assert.equal(voidReuse.data.nceId, manualNce.data.nce_id);

// 13) Muc dang gan lo thuoc nhom lo da "Dung" -> khong duoc nhap QC nua (gate
// moi, cong "nhom lo con van hanh" — trai voi truoc day IPC khong kiem gi).
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

console.log('app-v2 entry-handlers end-to-end tests passed');
