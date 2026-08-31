// Kiem chung end-to-end trang Phan tich Westgard: tong quan nhieu xet
// nghiem, chi tiet 1 muc kem CUSUM, bat/tat tung luat rieng theo xet
// nghiem - va xac nhan Entry + Westgard tra CUNG mot verdict (khong lech
// nhau vi dung chung ham isOn).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-v2-dist/main/ipc/entry-handlers.js');
const { createWestgardHandlers } = require('../../app-v2-dist/main/ipc/westgard-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const westgardHandlers = createWestgardHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };

const instrument = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mg/dL' } }, actor).data;
config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 10, sd: 1 } }, actor);

// 1) Chua co diem nao - tong quan phai bao "ok" (khong co diem de reject)
const summary0 = westgardHandlers.listTestSummaries();
assert.equal(summary0.length, 1);
assert.equal(summary0[0].testName, 'Glucose');
assert.equal(summary0[0].instrumentName, 'May A');
assert.equal(summary0[0].levels[0].worstVerdict, 'ok');

// 2) Them 1 diem vuot 3SD qua Entry
entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-01', val: 14, runId: '2026-08-01-1' } }, actor);

// 3) Tong quan Westgard phai phan anh dung verdict te nhat = 'rej'
const summary1 = westgardHandlers.listTestSummaries();
assert.equal(summary1[0].levels[0].worstVerdict, 'rej');
assert.equal(summary1[0].levels[0].pointCount, 1);

// 4) analyzeLevel phai tra dung diem, z-score, verdict, va CUSUM
const analysis = westgardHandlers.analyzeLevel(test.id, 1);
assert.equal(analysis.points.length, 1);
assert.equal(analysis.points[0].verdict, 'rej');
assert.ok(analysis.points[0].rules.includes('1-3s'));
assert.equal(analysis.points[0].z, 4); // (14-10)/1
assert.equal(analysis.cusum.cPos.length, 1);
assert.ok(analysis.ruleActions.some(r => r.id === '1-3s' && r.on === true));

// 5) Tat luat 1-3s cho xet nghiem nay
const toggled = westgardHandlers.saveRuleAction(test.id, '1-3s', false, actor);
assert.equal(toggled.ok, true);

// 6) Sau khi tat, diem do KHONG con bi 'rej' theo luat 1-3s nua (nhung van
// co the bi 1-2s vi |z|=4>2)
const analysisAfterToggle = westgardHandlers.analyzeLevel(test.id, 1);
assert.ok(!analysisAfterToggle.points[0].rules.includes('1-3s'), '1-3s da tat khong duoc xuat hien');
assert.equal(analysisAfterToggle.points[0].verdict, 'warn', '|z|>2 van con canh bao qua 1-2s');

// 7) Entry's queryPoints PHAI dung chung cau hinh luat (khong lech voi trang Westgard)
const entryPoints = entry.queryPoints(test.id, 1);
assert.equal(entryPoints[0].verdict, 'warn', 'Entry va Westgard phai tra CUNG mot verdict sau khi tat luat');
assert.ok(!entryPoints[0].rules.includes('1-3s'));

// 8) Xet nghiem/luat khong hop le phai bi chan
const badTest = westgardHandlers.saveRuleAction('khong-ton-tai', '1-3s', true, actor);
assert.equal(badTest.ok, false);
assert.equal(badTest.error.code, 'not-found');
const badRule = westgardHandlers.saveRuleAction(test.id, 'luat-gia', true, actor);
assert.equal(badRule.ok, false);
assert.equal(badRule.error.code, 'invalid-rule');

console.log('app-v2 westgard-handlers end-to-end tests passed');
