// Kiem chung end-to-end trang Six Sigma: luu 1 ky (CV/Bias/u(cal) da review
// thu cong), tinh lai sigma/MU dung tu du lieu da luu, cap nhat ky da co
// (khong tao dong moi), va cac dieu kien loi.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createSigmaHandlers } = require('../../app-v2-dist/main/ipc/sigma-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const sigmaHandlers = createSigmaHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

const instrument = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mg/dL' } }, actor).data;

// 1) Ky khong hop le
const badPeriod = sigmaHandlers.savePeriod({ testId: test.id, period: '2026/08', levels: [{ level: 1, cv: 2 }] }, actor);
assert.equal(badPeriod.ok, false);
assert.equal(badPeriod.error.code, 'invalid-period');

const badTea = sigmaHandlers.savePeriod({ testId: test.id, period: '2026-08', tea: -1, levels: [{ level: 1, cv: 2 }] }, actor);
assert.equal(badTea.ok, false);
assert.equal(badTea.error.code, 'invalid-tea');

// 2) Luu ky hop le: TEa=15, Muc 1 co CV=3, Bias=1.2, u(cal)=0.5
const saved = sigmaHandlers.savePeriod({
  testId: test.id, period: '2026-08', tea: 15, teaSource: 'CLIA',
  levels: [{ level: 1, cv: 3, biasEqa: 1.2, uCal: 0.5 }],
}, actor);
assert.equal(saved.ok, true);
const lv = saved.data.levels[0];
assert.ok(lv.sigma, 'phai tinh duoc sigma khi co du TEa/CV/Bias');
// sigma = (15 - |1.2|) / 3
assert.ok(Math.abs(lv.sigma.sigma - (15 - 1.2) / 3) < 1e-9);
assert.ok(lv.mu, 'phai tinh duoc MU khi co CV');
assert.equal(lv.mu.complete, true, 'du ca 3 thanh phan (cv/bias/cal) phai la complete');

// 3) listPeriods phai tra dung 1 ky, tinh LAI dung nhu luc luu
const periods = sigmaHandlers.listPeriods(test.id);
assert.equal(periods.length, 1);
assert.equal(periods[0].period, '2026-08');
assert.ok(Math.abs(periods[0].levels[0].sigma.sigma - lv.sigma.sigma) < 1e-9);

// 4) Luu lai CUNG ky (thang 08) phai CAP NHAT, khong tao dong moi
const resaved = sigmaHandlers.savePeriod({
  testId: test.id, period: '2026-08', tea: 15, teaSource: 'CLIA',
  levels: [{ level: 1, cv: 4, biasEqa: 0.5, uCal: 0.3 }],
}, actor);
assert.equal(resaved.ok, true);
assert.equal(sigmaHandlers.listPeriods(test.id).length, 1, 'van dung 1 ky, khong nhan doi');
assert.equal(sigmaHandlers.listPeriods(test.id)[0].levels[0].cv, 4);

// 5) Ky KHONG co u(cal) phai bi danh dau "chua du" (missing), KHONG duoc coi
// nhu 0 - dung dung nguyen tac da chot trong ke hoach kien truc.
const noCoA = sigmaHandlers.savePeriod({
  testId: test.id, period: '2026-09', tea: 15, levels: [{ level: 1, cv: 3, biasEqa: 1 }],
}, actor);
assert.equal(noCoA.ok, true);
assert.equal(noCoA.data.levels[0].mu.complete, false);
assert.ok(noCoA.data.levels[0].mu.missing.includes('u(cal)'));
assert.equal(noCoA.data.levels[0].mu.uCal, null, 'u(cal) chua danh gia phai la null, khong duoc la 0');

// 6) Nhieu vong EQA/EQC -> Bias% dung RMS, KHONG dung trung binh cong co dau
// (2 vong doi dau [-2,2] trung binh cong = 0, RMS phai la 2).
const eqaSaved = sigmaHandlers.savePeriod({
  testId: test.id, period: '2026-10', tea: 15,
  levels: [{ level: 1, cv: 3, eqaRounds: [-2, 2], uCal: 0.5 }],
}, actor);
assert.equal(eqaSaved.ok, true);
const eqaLv = eqaSaved.data.levels[0];
assert.ok(Math.abs(eqaLv.biasEqa - 2) < 1e-9, 'bias phai la RMS=2, khong phai trung binh cong=0');
assert.equal(eqaLv.mixedSigns, true, 'phai bao dau trai nhau de canh bao tren UI');
assert.deepEqual(eqaLv.eqaRounds, [-2, 2]);
// u(bias) phai tinh duoc tu bias RMS + biasRefU (SD giua cac vong/can(n))
assert.ok(eqaLv.mu.uBias != null, 'co eqaRounds phai tinh duoc u(bias), khong con null');

console.log('app-v2 sigma-handlers end-to-end tests passed');
