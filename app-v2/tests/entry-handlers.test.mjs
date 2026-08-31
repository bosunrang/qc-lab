// Kiem chung end-to-end module Entry: SQLite that + IPC handler + engine
// Westgard + audit - dung index (test_id, level, date) that trong schema.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-v2-dist/main/ipc/entry-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

// Chuan bi: 1 may, 1 xet nghiem, muc 1 co Mean=10 SD=1
const instrument = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mg/dL' } }, actor).data;
const levelSetup = config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 10, sd: 1 } }, actor);
assert.equal(levelSetup.ok, true, 'chuẩn bị Mean/SD cho Mức 1 phải thành công: ' + JSON.stringify(levelSetup));

// 1) Them diem QC binh thuong
const p1 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-01', val: 10.1, runId: '2026-08-01-1' } }, actor);
assert.equal(p1.ok, true);
assert.equal(p1.data.verdict, 'ok');

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

// 7) Huy lan 2 cung 1 diem phai bi chan
const voidAgain = entry.voidPoint({ data: { pointId: p2.data.id, reason: 'Nhap sai gia tri lan nua' } }, actor);
assert.equal(voidAgain.ok, false);
assert.equal(voidAgain.error.code, 'already-voided');

// 8) Audit: 2 lan them diem thanh cong + 1 lan huy thanh cong = 3 dong (khong
// tinh cac thao tac config o buoc chuan bi)
const activity = config.listActivity();
const entryRelated = activity.filter(a => a.type === 'Nhap QC' || a.type === 'Huy diem QC');
assert.equal(entryRelated.length, 3, 'chi thao tac thanh cong moi ghi audit');

console.log('app-v2 entry-handlers end-to-end tests passed');
