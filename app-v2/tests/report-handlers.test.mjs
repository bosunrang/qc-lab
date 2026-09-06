// Kiem chung end-to-end trang Bao cao: khoa/mo khoa ky bao cao va xem lai
// diem QC theo khoang ngay. Kiem chung viec KHOA THAT SU chan them/huy diem
// QC nam o tests/period-lock-enforcement.test.mjs (giao giua entry-handlers
// va report-handlers), khong lap lai o day.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createReportHandlers } = require('../../app-v2-dist/main/ipc/report-handlers.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-v2-dist/main/ipc/entry-handlers.js');

const db = openDatabase(':memory:');
const report = createReportHandlers(db);
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

// 1) Dinh dang ky sai phai bi chan
const badFormat = report.lockPeriod({ data: { ym: '2026/08' } }, actor);
assert.equal(badFormat.ok, false);
assert.equal(badFormat.error.code, 'invalid-period');

// 2) Khoa hop le
const locked = report.lockPeriod({ data: { ym: '2026-08', note: 'Da chot bao cao thang 8' } }, actor);
assert.equal(locked.ok, true);
assert.equal(locked.data.ym, '2026-08');
assert.equal(report.isPeriodLocked('2026-08'), true);

// 3) Khoa lai ky da khoa phai bi chan
const dupLock = report.lockPeriod({ data: { ym: '2026-08' } }, actor);
assert.equal(dupLock.ok, false);
assert.equal(dupLock.error.code, 'already-locked');

// 4) Mo khoa thieu ly do (< 5 ky tu) phai bi chan
const shortNote = report.unlockPeriod({ data: { ym: '2026-08', note: 'x' } }, actor);
assert.equal(shortNote.ok, false);
assert.equal(shortNote.error.code, 'missing-note');

// 5) Mo khoa ky CHUA khoa phai bi chan
const notLocked = report.unlockPeriod({ data: { ym: '2099-01', note: 'Ly do hop le du dai' } }, actor);
assert.equal(notLocked.ok, false);
assert.equal(notLocked.error.code, 'not-locked');

// 6) Mo khoa hop le
const unlocked = report.unlockPeriod({ data: { ym: '2026-08', note: 'Phat hien can bo sung them so lieu' } }, actor);
assert.equal(unlocked.ok, true);
assert.equal(report.isPeriodLocked('2026-08'), false);

// 7) listPeriodLocks phan anh dung trang thai hien tai (da mo khoa nen rong)
assert.equal(report.listPeriodLocks().length, 0);

// 8) queryReport: loc dung theo xet nghiem + khoang ngay, bo qua xet nghiem khac
const instrument = config.saveInstrument({ data: { name: 'May Report' } }, actor).data;
const testA = config.saveTest({ data: { name: 'Test A', instrumentId: instrument.id } }, actor).data;
const testB = config.saveTest({ data: { name: 'Test B', instrumentId: instrument.id } }, actor).data;
makeOperationalQc(db, { testId: testA.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });
makeOperationalQc(db, { testId: testB.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });
entry.addPoint({ data: { testId: testA.id, level: 1, date: '2026-08-01', val: 5, runId: 'r1' } }, actor);
entry.addPoint({ data: { testId: testA.id, level: 1, date: '2026-08-15', val: 6, runId: 'r1' } }, actor);
entry.addPoint({ data: { testId: testA.id, level: 1, date: '2026-09-01', val: 7, runId: 'r1' } }, actor);
entry.addPoint({ data: { testId: testB.id, level: 1, date: '2026-08-10', val: 8, runId: 'r1' } }, actor);

const rowsAll = report.queryReport({ testId: testA.id });
assert.equal(rowsAll.length, 3, 'khong loc ngay phai tra ve ca 3 diem cua Test A');

const rowsRanged = report.queryReport({ testId: testA.id, from: '2026-08-01', to: '2026-08-31' });
assert.equal(rowsRanged.length, 2, 'loc theo khoang ngay phai chi con 2 diem trong thang 8');
assert.ok(rowsRanged.every(r => r.test_id === testA.id), 'khong duoc lan diem cua Test B khac');

console.log('app-v2 report-handlers end-to-end tests passed');
