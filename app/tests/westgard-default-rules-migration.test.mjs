// WG-26: luật Westgard bật sẵn theo số mức QC. Nâng schema 17 phải giữ kết
// luận của lần chạy đã nhập (GV2) — 6x cũ vẫn loại — còn lần chạy nhập sau
// nâng cấp dùng mặc định mới. Dữ liệu giả lập trên SQLite bộ nhớ.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { ensureUser, must } from './helpers/nce-flow.mjs';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { applySchema, SCHEMA_VERSION } = require('../../app-dist/main/db/schema.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');

const admin = { userId: 'a', username: 'a', name: 'Quản trị thử', role: 'admin', clientId: 'test' };

function setup(levels = [1, 2]) {
  const db = openDatabase(':memory:');
  ensureUser(db, admin);
  const config = createConfigHandlers(db), entry = createEntryHandlers(db);
  const instrument = must(config.saveInstrument({ data: { name: 'Máy thử' } }, admin), 'máy');
  const assay = must(config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, admin), 'xét nghiệm');
  for (const level of levels) must(config.saveTestLevel({ testId: assay.id, data: { level, mean: 100, sd: 2 } }, admin), 'mức');
  makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: levels.map((level) => ({ level })) });
  let day = 1;
  const addRun = (zs) => {
    const date = `2026-09-${String(day++).padStart(2, '0')}`;
    zs.forEach((z, i) => must(entry.addPoint({ data: { testId: assay.id, level: levels[i], date, runId: '1', val: 100 + 2 * z } }, admin), 'điểm'));
    return date;
  };
  const verdictOf = (date, level = levels[0]) => createWestgardHandlers(db).analyzeLevel(assay.id, level).points.find((p) => p.date === date);
  return { db, addRun, verdictOf, testId: assay.id };
}

/** Đưa CSDL về trạng thái trước nâng cấp: schema 16, cấu hình chung theo mặc định cũ. */
function downgradeToV16(db, globalRules) {
  db.prepare("DELETE FROM rule_config_history WHERE scope='global'").run();
  if (globalRules === undefined) db.prepare("DELETE FROM app_meta WHERE key='westgardRules'").run();
  else db.prepare("INSERT INTO app_meta(key,value) VALUES('westgardRules',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(globalRules));
  db.prepare("UPDATE app_meta SET value='16' WHERE key='schemaVersion'").run();
}

test('xét nghiệm 2 mức mới: 6x không bật sẵn, ba lần chạy cùng phía Mean vẫn Đạt', () => {
  const { addRun, verdictOf } = setup();
  addRun([0.3, 0.4]); addRun([0.5, 0.2]);
  const third = addRun([0.6, 0.3]);
  assert.equal(verdictOf(third).verdict, 'ok');
});

test('xét nghiệm 3 mức mới: 3-1s và 2of3-2s bật sẵn, 2-2s không', () => {
  const { addRun, verdictOf } = setup([1, 2, 3]);
  const run = addRun([1.2, 1.4, 1.1]);
  assert.equal(verdictOf(run).verdict, 'rej');
  assert.ok(verdictOf(run).rules.includes('3-1s'));
  addRun([0.2, -0.3, 0.1]); // tách chuỗi 3-1s khỏi lần chạy kế tiếp
  const twoOfThree = addRun([2.3, 2.5, 0.2]);
  assert.deepEqual([...verdictOf(twoOfThree).rules].sort(), ['1-2s', '2of3-2s']);
});

test('nâng schema 17: lần chạy cũ giữ kết luận 6x, lần chạy mới theo mặc định theo số mức', () => {
  assert.equal(SCHEMA_VERSION, 17);
  const { db, addRun, verdictOf } = setup();
  // Dữ liệu cũ: 6x (mặc định trước WG-26) đã loại lần chạy thứ ba.
  addRun([0.3, 0.4]); addRun([0.5, 0.2]);
  const oldRun = addRun([0.6, 0.3]);
  // Cấu hình chung đầy đủ như sau khi bấm "Khôi phục" ở bản cũ, kèm một luật đã đặt khác mặc định cũ.
  downgradeToV16(db, { '1-2s': true, '1-3s': true, '2-2s': true, 'R4s': true, '3-1s': false, '4-1s': true, '6x': true, '8x': false, '9x': false, '10x': true, '12x': false, '7T': true, '2of3-2s': false });
  applySchema(db);
  assert.equal(db.prepare("SELECT value FROM app_meta WHERE key='schemaVersion'").get().value, '17');
  assert.deepEqual(JSON.parse(db.prepare("SELECT value FROM app_meta WHERE key='westgardRules'").get().value), { '7T': true }, 'chỉ giữ luật đã đặt khác mặc định cũ');
  const oldVerdict = verdictOf(oldRun);
  assert.equal(oldVerdict.verdict, 'rej', 'lần chạy đã có giữ kết luận Loại bỏ');
  assert.ok(oldVerdict.rules.includes('6x'));
  // Lần chạy nhập sau nâng cấp: chuỗi cùng phía tiếp tục nhưng 6x không còn bật sẵn.
  const newRun = addRun([0.4, 0.5]);
  assert.equal(verdictOf(newRun).verdict, 'ok');
});

test('nâng schema 17 trên CSDL chưa có điểm QC và chưa cấu hình luật: không ghi gì thêm', () => {
  const db = openDatabase(':memory:');
  downgradeToV16(db, undefined);
  applySchema(db);
  assert.equal(db.prepare("SELECT 1 FROM app_meta WHERE key='westgardRules'").get(), undefined);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM rule_config_history WHERE scope='global'").get().n, 0);
});
