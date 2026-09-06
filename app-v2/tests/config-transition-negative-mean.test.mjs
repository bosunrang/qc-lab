// Mean mục tiêu có thể bằng 0 hoặc âm (ví dụ Base excess). Hồ sơ chuyển lô
// phải kiểm Mean hữu hạn + SD dương, không được áp điều kiện Mean > 0.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
const instrument = config.saveInstrument({ data: { name: 'Máy khí máu' } }, actor).data;
const test = config.saveTest({ data: { name: 'Base excess', instrumentId: instrument.id } }, actor).data;
const panel = config.savePanel({ data: { name: 'Panel khí máu', instrumentId: instrument.id, testIds: [test.id] } }, actor).data;
const oldLot = config.saveLot({ data: { lotNo: 'BE-OLD', level: 1 } }, actor).data;
const newLot = config.saveLot({ data: { lotNo: 'BE-NEW', level: 1 } }, actor).data;
config.saveTestLevel({ testId: test.id, data: { level: 1, mean: -2, sd: 1, qcLotId: oldLot.id } }, actor);

const planned = config.createLotTransition({ data: {
  panelId: panel.id, fromLotId: oldLot.id, toLotId: newLot.id,
  criteria: [{ testId: test.id, level: 1, mean: -1.5, sd: 0.5 }],
} }, actor);
assert.equal(planned.ok, true);
const accepted = config.createLotTransition({ id: planned.data.id, data: {
  panelId: panel.id, fromLotId: oldLot.id, toLotId: newLot.id, status: 'accepted',
  criteria: [{ testId: test.id, level: 1, mean: -1.5, sd: 0.5 }],
} }, actor);
assert.equal(accepted.ok, true, JSON.stringify(accepted));
const level = config.listTestLevels(test.id)[0];
assert.equal(level.qc_lot_id, newLot.id);
assert.equal(level.mean, -1.5);
assert.equal(level.sd, 0.5);

console.log('app-v2 negative-mean lot-transition test passed');
