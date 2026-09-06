// Kiem chung THAT SU cua khoa ky bao cao: khong chi ban ghi period_locks
// (report-handlers.ts) ma con phai CHAN duoc addPoint/voidPoint trong
// entry-handlers.ts - day la "tinh nang", khong phai chi UI. Neu ai do them
// duong ghi diem QC moi ma quen goi isPeriodLocked(), test nay phai bao do.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-v2-dist/main/ipc/entry-handlers.js');
const { createReportHandlers } = require('../../app-v2-dist/main/ipc/report-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const report = createReportHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

const instrument = config.saveInstrument({ data: { name: 'May Lock' } }, actor).data;
const test = config.saveTest({ data: { name: 'Test Lock', instrumentId: instrument.id } }, actor).data;
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });

// 1) Truoc khi khoa: them diem QC binh thuong duoc
const beforeLock = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-05', val: 5, runId: 'r1' } }, actor);
assert.equal(beforeLock.ok, true);

// 2) Khoa ky 2026-08
const lock = report.lockPeriod({ data: { ym: '2026-08', note: 'Chot ky' } }, actor);
assert.equal(lock.ok, true);

// 3) Sau khi khoa: them diem QC moi trong ky do phai bi chan
const blockedAdd = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-20', val: 6, runId: 'r1' } }, actor);
assert.equal(blockedAdd.ok, false);
assert.equal(blockedAdd.error.code, 'period-locked');

// 4) Them diem QC o ky KHAC (chua khoa) van duoc, khong bi chan nham toan bo
const otherMonth = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-01', val: 7, runId: 'r1' } }, actor);
assert.equal(otherMonth.ok, true);

// 5) Huy diem QC da nhap TRUOC do (nam trong ky vua khoa) cung phai bi chan
const blockedVoid = entry.voidPoint({ data: { pointId: beforeLock.data.id, reason: 'Nhap sai gia tri' } }, actor);
assert.equal(blockedVoid.ok, false);
assert.equal(blockedVoid.error.code, 'period-locked');

// 6) Huy diem QC o ky khac (chua khoa) van duoc
const voidOther = entry.voidPoint({ data: { pointId: otherMonth.data.id, reason: 'Nhap sai gia tri' } }, actor);
assert.equal(voidOther.ok, true);

// 7) Mo khoa ky 2026-08 roi thi them/huy lai duoc binh thuong
const unlock = report.unlockPeriod({ data: { ym: '2026-08', note: 'Can bo sung so lieu con thieu' } }, actor);
assert.equal(unlock.ok, true);
const afterUnlockAdd = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-20', val: 6, runId: 'r1' } }, actor);
assert.equal(afterUnlockAdd.ok, true);
const afterUnlockVoid = entry.voidPoint({ data: { pointId: beforeLock.data.id, reason: 'Nhap sai gia tri' } }, actor);
assert.equal(afterUnlockVoid.ok, true);

console.log('app-v2 period-lock-enforcement end-to-end tests passed');
