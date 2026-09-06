// Kiem chung end-to-end trang Phan tich Westgard: tong quan nhieu xet
// nghiem, chi tiet 1 muc kem CUSUM, bat/tat tung luat rieng theo xet
// nghiem - va xac nhan Entry + Westgard tra CUNG mot verdict (khong lech
// nhau vi dung chung ham isOn).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
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
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });

// 1) Chua co diem nao - tong quan phai bao "ok" (khong co diem de reject)
const summary0 = westgardHandlers.listTestSummaries();
assert.equal(summary0.length, 1);
assert.equal(summary0[0].testName, 'Glucose');
assert.equal(summary0[0].instrumentName, 'May A');
assert.equal(summary0[0].levels[0].worstVerdict, 'ok');
assert.equal(summary0[0].unit, 'mg/dL');
assert.equal(summary0[0].levels[0].latest, null);

// 2) Them 1 diem vuot 3SD qua Entry
entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-01', val: 14, runId: '2026-08-01-1' } }, actor);

// 3) Tong quan Westgard phai phan anh dung verdict te nhat = 'rej'
const summary1 = westgardHandlers.listTestSummaries();
assert.equal(summary1[0].levels[0].worstVerdict, 'rej');
assert.equal(summary1[0].levels[0].pointCount, 1);
assert.equal(summary1[0].levels[0].latest.val, 14);
assert.equal(summary1[0].levels[0].latest.date, '2026-08-01');

// 4) analyzeLevel phai tra dung diem, z-score, verdict, va CUSUM
const analysis = westgardHandlers.analyzeLevel(test.id, 1);
assert.equal(analysis.points.length, 1);
assert.equal(analysis.points[0].verdict, 'rej');
assert.ok(analysis.points[0].rules.includes('1-3s'));
assert.equal(analysis.points[0].z, 4); // (14-10)/1
assert.equal(analysis.cusum.cPos.length, 1);
const ruleSettings = westgardHandlers.listRuleSettings();
assert.ok(ruleSettings.some(r => r.id === '1-3s' && r.on === true));

// 5) Tat luat 1-3s cho xet nghiem nay
const toggled = westgardHandlers.saveRuleAction(test.id, '1-3s', false, actor);
assert.equal(toggled.ok, true);
assert.equal(toggled.data.action, 'inactive', 'boolean V2 cu phai duoc chuyen sang action tuong minh');

// 6) Sau khi tat, diem do KHONG con bi 'rej' theo luat 1-3s nua (nhung van
// co the bi 1-2s vi |z|=4>2)
const analysisAfterToggle = westgardHandlers.analyzeLevel(test.id, 1);
assert.ok(!analysisAfterToggle.points[0].rules.includes('1-3s'), '1-3s da tat khong duoc xuat hien');
assert.equal(analysisAfterToggle.points[0].verdict, 'warn', '|z|>2 van con canh bao qua 1-2s');

// 7) Entry's queryPoints PHAI dung chung cau hinh luat (khong lech voi trang Westgard)
const entryPoints = entry.queryPoints(test.id, 1);
assert.equal(entryPoints[0].verdict, 'warn', 'Entry va Westgard phai tra CUNG mot verdict sau khi tat luat');
assert.ok(!entryPoints[0].rules.includes('1-3s'));

// 8) Ba hanh dong theo xet nghiem phai tac dong den verdict va chuoi chap
// nhan, khong chi duoc luu de hien thi.
const alertOverride = westgardHandlers.saveRuleAction(test.id, '1-3s', 'alert', actor);
assert.equal(alertOverride.ok, true);
assert.equal(alertOverride.data.action, 'alert');
const analysisAsAlert = westgardHandlers.analyzeLevel(test.id, 1);
assert.equal(analysisAsAlert.points[0].verdict, 'warn', '1-3s doi thanh canh bao khong duoc loai bo');
assert.equal(analysisAsAlert.points[0].accepted, true, 'diem chi canh bao van nam trong chuoi chap nhan');

const rejectOverride = westgardHandlers.saveRuleAction(test.id, '1-2s', 'reject', actor);
assert.equal(rejectOverride.ok, true);
const pointAt25Sd = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-02', val: 12.5, runId: '2026-08-02-1' } }, actor);
assert.equal(pointAt25Sd.ok, true);
const analysisAsReject = westgardHandlers.analyzeLevel(test.id, 1);
assert.equal(analysisAsReject.points.at(-1).verdict, 'rej', '1-2s doi thanh loai bo phai reject diem 2.5SD');

const followShared = westgardHandlers.saveRuleAction(test.id, '1-3s', '', actor);
assert.equal(followShared.ok, true);
assert.equal(followShared.data.action, '');
const storedActions = JSON.parse(db.prepare('SELECT rule_actions_json FROM tests WHERE id=?').get(test.id).rule_actions_json);
assert.equal(Object.hasOwn(storedActions, '1-3s'), false, 'chon theo cau hinh chung phai xoa ghi de rieng');

// 9) Xet nghiem/luat/hanh dong khong hop le phai bi chan
const badTest = westgardHandlers.saveRuleAction('khong-ton-tai', '1-3s', true, actor);
assert.equal(badTest.ok, false);
assert.equal(badTest.error.code, 'not-found');
const badRule = westgardHandlers.saveRuleAction(test.id, 'luat-gia', true, actor);
assert.equal(badRule.ok, false);
assert.equal(badRule.error.code, 'invalid-rule');
const badAction = westgardHandlers.saveRuleAction(test.id, '1-3s', 'danger', actor);
assert.equal(badAction.ok, false);
assert.equal(badAction.error.code, 'invalid-action');

console.log('app-v2 westgard-handlers end-to-end tests passed');
