import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createReportHandlers } = require('../../app-dist/main/ipc/report-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const report = createReportHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

const instrument = config.saveInstrument({ data: { name: 'May Lock' } }, actor).data;
const test = config.saveTest({ data: { name: 'Test Lock', instrumentId: instrument.id } }, actor).data;
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });

const beforeLock = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-05', val: 5, runId: 'r1' } }, actor);
assert.equal(beforeLock.ok, true);

const lock = report.lockPeriod({ data: { ym: '2026-08', note: 'Chot ky' } }, actor);
assert.equal(lock.ok, true);

const blockedAdd = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-20', val: 6, runId: 'r1' } }, actor);
assert.equal(blockedAdd.ok, false);
assert.equal(blockedAdd.error.code, 'period-locked');

const otherMonth = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-01', val: 7, runId: 'r1' } }, actor);
assert.equal(otherMonth.ok, true);

const blockedVoid = entry.voidPoint({ data: { pointId: beforeLock.data.id, reason: 'Nhap sai gia tri' } }, actor);
assert.equal(blockedVoid.ok, false);
assert.equal(blockedVoid.error.code, 'period-locked');

const voidOther = entry.voidPoint({ data: { pointId: otherMonth.data.id, reason: 'Nhap sai gia tri' } }, actor);
assert.equal(voidOther.ok, true);

const unlock = report.unlockPeriod({ data: { ym: '2026-08', note: 'Can bo sung so lieu con thieu' } }, actor);
assert.equal(unlock.ok, true);
const afterUnlockAdd = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-20', val: 6, runId: 'r1' } }, actor);
assert.equal(afterUnlockAdd.ok, true);
const afterUnlockVoid = entry.voidPoint({ data: { pointId: beforeLock.data.id, reason: 'Nhap sai gia tri' } }, actor);
assert.equal(afterUnlockVoid.ok, true);

console.log('app period-lock-enforcement end-to-end tests passed');


