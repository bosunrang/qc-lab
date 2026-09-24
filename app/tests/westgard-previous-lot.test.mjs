//
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quan tri', role: 'admin', clientId: 'test-client' };

function scenario() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const inst = config.saveInstrument({ data: { name: 'May A' } }, actor).data;
  const test = config.saveTest({ data: { name: 'Natri', instrumentId: inst.id, unit: 'mmol/L' } }, actor).data;

  db.prepare('INSERT INTO qc_panels(id,name,instrument_id,active) VALUES (?,?,?,1)').run('p1', 'Panel', inst.id);
  db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id) VALUES (?,?)').run('p1', test.id);
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('g1','Nhom A',1,'')").run();
  db.prepare("INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('lOld','g1','OLD-1',1),('lNew','g1','NEW-1',1)").run();

  config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 100, sd: 2, qcLotId: 'lNew' } }, actor);
  db.prepare('UPDATE test_levels SET mean_sd_history_json=? WHERE test_id=? AND level=1')
    .run(JSON.stringify([{ at: '2026-07-01T00:00:00.000Z', qcLotId: 'lOld', mean: 200, sd: 4 }]), test.id);

  db.prepare(`INSERT INTO lot_transitions(id,panel_id,from_lot_id,to_lot_id,status,start_date,approved_at)
    VALUES ('tr1','p1','lOld','lNew','accepted','2026-07-01','2026-07-01T00:00:00.000Z')`).run();

  const ins = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  ins.run('o1', test.id, 1, '2026-06-01', '2026-06-01-1', 200, 'OLD-1', 200, 4);
  ins.run('o2', test.id, 1, '2026-06-02', '2026-06-02-1', 214, 'OLD-1', 200, 4);
  ins.run('n1', test.id, 1, '2026-07-02', '2026-07-02-1', 101, 'NEW-1', 100, 2);
  return { db, test, westgard: createWestgardHandlers(db), entry: createEntryHandlers(db) };
}

{
  const { westgard, test } = scenario();
  const blocks = westgard.listPreviousLotBlocks(test.id);
  assert.equal(blocks.length, 1, 'dung 1 lo cu tren chuoi chuyen tiep');
  const [block] = blocks;
  assert.equal(block.level, 1);
  assert.equal(block.lotNo, 'OLD-1');
  assert.equal(block.mean, 200, 'Mean phai la cua LO CU, khong phai muc hien hanh');
  assert.equal(block.sd, 4);
  assert.equal(block.analysis.points.length, 2, 'chi diem cua lo cu');
  assert.deepEqual(block.analysis.points.map((p) => p.id), ['o1', 'o2']);
  const flagged = block.analysis.points[1];
  assert.equal(flagged.verdict, 'rej');
  assert.ok(flagged.rules.includes('1-3s'), `mong doi 1-3s, nhan duoc ${flagged.rules}`);
  assert.ok(Math.abs(flagged.z - 3.5) < 1e-9, `z phai tinh theo Mean/SD lo cu, nhan duoc ${flagged.z}`);
  assert.equal(flagged.errorType, 'RE — Sai số ngẫu nhiên');
  assert.notEqual(flagged.errorDesc, '');
  assert.equal(block.analysis.cusumOn, false);
}

{
  const { westgard, entry, test } = scenario();
  const blocks = westgard.listPreviousLotBlocks(test.id);
  const series = entry.listPreviousLotSeries(test.id);
  assert.equal(blocks.length, series.length, 'hai trang phai thay cung so chuoi lo cu');
  for (const [index, block] of blocks.entries()) {
    const item = series[index];
    assert.equal(block.lotId, item.lotId, 'cung lo cu');
    assert.equal(block.lotNo, item.lot);
    assert.equal(block.mean, item.mean, 'cung Mean cho lo cu');
    assert.equal(block.sd, item.sd, 'cung SD cho lo cu');
    assert.deepEqual(block.analysis.points.map((p) => p.id), item.points.map((p) => p.id), 'cung tap diem');
    assert.deepEqual(block.analysis.points.map((p) => p.verdict), item.points.map((p) => p.verdict), 'cung ket luan');
  }
}

for (const status of ['planned', 'active', 'rejected']) {
  const { db, westgard, test } = scenario();
  db.prepare('UPDATE lot_transitions SET status=? WHERE id=?').run(status, 'tr1');
  assert.deepEqual(westgard.listPreviousLotBlocks(test.id), [],
    `ho so trang thai "${status}" chua tao ra lo cu`);
}

{
  const { db, westgard, test } = scenario();
  db.prepare("UPDATE lot_groups SET status='stopped' WHERE id='g1'").run();
  assert.deepEqual(westgard.listPreviousLotBlocks(test.id), []);
}

{
  const { db, westgard, test } = scenario();
  db.prepare("UPDATE test_levels SET mean_sd_history_json='[]' WHERE test_id=?").run(test.id);
  assert.equal(westgard.listPreviousLotBlocks(test.id)[0].mean, 200, 'fallback snapshot tren diem');
  db.prepare("UPDATE qc_points SET qc_mean=NULL, qc_sd=NULL WHERE lot='OLD-1'").run();
  assert.deepEqual(westgard.listPreviousLotBlocks(test.id), [], 'het nguon Mean/SD thi bo qua');
}

console.log('app Westgard previous-lot blocks tests passed');

{
  const { db, test, westgard, entry } = scenario();
  db.prepare("UPDATE qc_lots SET group_id=NULL WHERE id='lOld'").run();
  const block = westgard.listPreviousLotBlocks(test.id)[0];
  assert.equal(block.lotNo, 'OLD-1');
  assert.ok(block.analysis.evaluationNote);
  assert.deepEqual(block.analysis.points.map(p => p.accepted), [true, false]);
  assert.deepEqual(entry.listPreviousLotSeries(test.id)[0].points.map(p => p.accepted), [true, false]);
}


