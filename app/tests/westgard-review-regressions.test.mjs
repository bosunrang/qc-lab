import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { combinedWestgardByPoint, westgardByPoint, westgardMultiByPoint, acceptedRunPoints } = require('../../app-dist/main/domain/westgard-engine.js');
const { qcRunKey, compareQcRunKey } = require('../../app-dist/main/domain/sort-order.js');
const actor = { userId: 'u1', username: 'admin', name: 'Admin', role: 'admin', clientId: 'review' };

function fixture() {
  const db = openDatabase(':memory:'), config = createConfigHandlers(db);
  const instrument = config.saveInstrument({ data: { name: 'Review instrument' } }, actor).data;
  const item = config.saveTest({ data: { name: 'Review analyte', instrumentId: instrument.id } }, actor).data;
  db.prepare("INSERT INTO qc_panels(id,name,instrument_id,active) VALUES ('p','Panel',?,1)").run(instrument.id);
  db.prepare("INSERT INTO qc_panel_tests(panel_id,test_id) VALUES ('p',?)").run(item.id);
  db.exec("INSERT INTO lot_groups(id,name,active,status) VALUES ('g','Group',1,''); INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('l1','g','L1',1),('l2','g','L2',2)");
  for (const level of [1, 2]) config.saveTestLevel({ testId: item.id, data: { level, mean: 100, sd: 2, qcLotId: `l${level}` } }, actor);
  const insert = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  function point(id, level, date, run, z, mean = 100, sd = 2) { insert.run(id, item.id, level, date, run, mean + z * sd, `L${level}`, mean, sd); }
  return { db, item, point, wg: createWestgardHandlers(db), entry: createEntryHandlers(db) };
}

test('WG01: archived values use each point target, not the last lot target', () => {
  const { db, item, point, wg } = fixture();
  point('original', 1, '2026-09-01', '1', 3.5);
  db.prepare('UPDATE test_levels SET mean=110 WHERE test_id=? AND level=1').run(item.id);
  const p = wg.listArchivedBlocks(item.id, 'g')[0].analysis.points[0];
  assert.equal(p.z, 3.5); assert.equal(p.verdict, 'rej'); assert.equal(p.targetMean, 100); assert.equal(p.accepted, false);
  db.close();
});

test('WG02: archived run1, run2, run10 order does not introduce false 2-2s', () => {
  const { db, item, point, wg } = fixture();
  point('a', 1, '2026-09-01', 'run1', 2.5);
  point('b', 1, '2026-09-01', 'run2', 0);
  point('c', 1, '2026-09-01', 'run10', 2.5);
  const points = wg.listArchivedBlocks(item.id, 'g')[0].analysis.points;
  assert.deepEqual(points.map(p => p.runId), ['run1', 'run2', 'run10']);
  assert.equal(points[2].verdict, 'warn');
  db.close();
});

test('WG03: previous lot and archived view share cross-level rules and acceptance', () => {
  const { db, item, point, wg, entry } = fixture();
  point('a', 1, '2026-09-01', 'run1', 2.5); point('b', 2, '2026-09-01', 'run1', -2.5);
  db.exec(`INSERT INTO lot_groups(id,name,active,status,archived_lot_ids_json) VALUES ('archive','Archive',0,'stopped','["l1","l2"]');
    INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('new1','g','NEW1',1),('new2','g','NEW2',2)`);
  for (const level of [1, 2]) {
    db.prepare('UPDATE test_levels SET qc_lot_id=?,mean_sd_history_json=? WHERE test_id=? AND level=?')
      .run(`new${level}`, JSON.stringify([{ qcLotId: `l${level}`, mean: 100, sd: 2 }]), item.id, level);
    db.prepare("INSERT INTO lot_transitions(id,panel_id,from_lot_id,to_lot_id,status,start_date,approved_at) VALUES (?,'p',?,?,'accepted','2026-09-02','2026-09-02')")
      .run(`tr${level}`, `l${level}`, `new${level}`);
  }
  const previous = wg.listPreviousLotBlocks(item.id), archived = wg.listArchivedBlocks(item.id, 'archive');
  assert.equal(previous.length, 2);
  assert.deepEqual(previous.map(b => b.analysis.points), archived.map(b => b.analysis.points));
  assert.ok(previous.every(b => b.analysis.points[0].rules.includes('R4s') && !b.analysis.points[0].accepted));
  assert.ok(entry.listPreviousLotSeries(item.id).every(s => s.points[0].rules.includes('R4s')));
  db.close();
});

test('WG04: equal custom run ids on different days cannot trigger within-run R4s', () => {
  const p = { val: 105, date: '2026-09-01', runId: 'morning' }, q = { val: 95, date: '2026-09-02', runId: 'morning' };
  const result = combinedWestgardByPoint([{ level: 1, pts: [p], mean: 100, sd: 2 }, { level: 2, pts: [q], mean: 100, sd: 2 }], () => true, () => true);
  assert.ok(!result.get(p).rules.includes('R4s')); assert.ok(!result.get(q).rules.includes('R4s'));
  q.date = p.date;
  assert.ok(combinedWestgardByPoint([{ level: 1, pts: [p], mean: 100, sd: 2 }, { level: 2, pts: [q], mean: 100, sd: 2 }], () => true, () => true).get(p).rules.includes('R4s'));
});

test('WG05/06: no rejected point or sibling level in a failed run enters statistics', () => {
  const { db, item, point, wg } = fixture();
  point('a', 1, '2026-09-01', 'run1', 3.5); point('b', 2, '2026-09-01', 'run1', 0);
  const a = wg.analyzeLevel(item.id, 1).points[0], b = wg.analyzeLevel(item.id, 2).points[0];
  assert.equal(a.verdict, 'rej'); assert.equal(a.accepted, false);
  assert.equal(b.verdict, 'ok'); assert.equal(b.accepted, false); assert.equal(b.runRejected, true);
  assert.equal(wg.listTestSummaries()[0].levels[1].cv, null);
  db.close();
});

test('WG07: only approved effective corrections reset rules, from the next day, in both entry and Westgard', () => {
  const { db, item, point, wg, entry } = fixture();
  for (let day = 1; day <= 5; day++) point(`p${day}`, 1, `2026-09-0${day}`, 'morning', day === 5 ? 1.1 : 1.5);
  assert.equal(wg.analyzeLevel(item.id, 1).points[4].verdict, 'rej');
  db.prepare(`INSERT INTO actions(id,date,created_at,updated_at,test_id,level,nce_id,approval_status,effectiveness_status,record_status,action_completed_date)
    VALUES ('fix','2026-09-04','','',?,1,'NCE','pending','effective','active','2026-09-04')`).run(item.id);
  assert.equal(wg.analyzeLevel(item.id, 1).points[4].verdict, 'rej');
  db.exec("UPDATE actions SET approval_status='approved' WHERE id='fix'");
  const points = wg.analyzeLevel(item.id, 1).points;
  assert.equal(points[3].verdict, 'rej'); assert.equal(points[4].verdict, 'ok'); assert.equal(points[4].accepted, true);
  assert.equal(entry.queryPoints(item.id, 1)[4].verdict, 'ok');
  db.exec("UPDATE actions SET record_status='cancelled' WHERE id='fix'");
  assert.equal(wg.analyzeLevel(item.id, 1).points[4].verdict, 'rej');
  db.close();
});

test('WG08: alert-only 1-3s cannot hide a rejecting 1-2s override', () => {
  const result = westgardByPoint([{ val: 107 }], 100, 2, r => ['1-2s', '1-3s'].includes(r), r => r === '1-2s' ? 'reject' : 'alert');
  assert.equal(result.F[0].level, 'rej'); assert.deepEqual(new Set(result.F[0].rules), new Set(['1-3s', '1-2s']));
});

test('WG11: shared chart run axis distinguishes same-day runs and orders numerically', () => {
  const points = ['run10', 'run2', 'run1'].map(runId => ({ date: '2026-09-01', runId }));
  const keys = [...new Set(points.map(qcRunKey))].sort(compareQcRunKey);
  assert.equal(keys.length, 3); assert.deepEqual(keys.map(k => k.split('\u0000')[1]), ['run1', 'run2', 'run10']);
});

test('WG13: a failed audit rolls back global, reset, and per-test rule writes', () => {
  const { db, item, wg } = fixture();
  const before = wg.listRuleSettings();
  db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON activity BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
  assert.throws(() => wg.saveRuleSetting('1-3s', false, actor), /injected/);
  assert.deepEqual(wg.listRuleSettings(), before);
  assert.throws(() => wg.saveRuleAction(item.id, '1-3s', 'inactive', actor), /injected/);
  assert.equal(db.prepare('SELECT rule_actions_json FROM tests WHERE id=?').get(item.id).rule_actions_json, '{}');
  assert.throws(() => wg.resetRuleSettings(actor), /injected/);
  assert.deepEqual(wg.listRuleSettings(), before);
  assert.equal(wg.saveRuleSetting('1-3s', 'false', actor).ok, false);
  db.close();
});

test('WG14: a level without a valid target is unassessed, not a rejected sibling run', () => {
  const assessed = { date: '2026-09-01', runId: 'r1', val: 101 };
  const unassessed = { date: '2026-09-01', runId: 'r1', val: 101 };
  const flags = new Map([
    [assessed, { level: 'ok', rules: [], supportRules: [], crossRules: [], z: 1 }],
    [unassessed, { level: 'ok', rules: [], supportRules: [], crossRules: [], z: Number.NaN }],
  ]);
  const accepted = acceptedRunPoints(flags);
  assert.equal(accepted.has(assessed), true, 'mức có Mean/SD hợp lệ vẫn được tính thống kê');
  assert.equal(accepted.has(unassessed), false, 'mức thiếu Mean/SD chỉ bị loại riêng nó');

  flags.set(unassessed, { level: 'rej', rules: ['1-3s'], supportRules: [], crossRules: [], z: 3.5 });
  assert.equal(acceptedRunPoints(flags).has(assessed), false, 'một vi phạm thật vẫn loại toàn bộ cùng lần chạy');
});

test('WG15: sequence rules and 2of3 windows cannot cross a Mean/SD change', () => {
  const changedTarget = [
    { val: 103, qcMean: 100, qcSd: 2 },
    { val: 103, qcMean: 100, qcSd: 2 },
    { val: 103, qcMean: 100, qcSd: 2 },
    { val: 203, qcMean: 200, qcSd: 2 },
  ];
  const sequence = westgardByPoint(changedTarget, 100, 2, rule => rule === '4-1s');
  assert.ok(sequence.F.every(flag => !flag.rules.includes('4-1s')), '4-1s không mang chuỗi qua target mới');

  const twoOfThree = westgardByPoint([
    { val: 105, qcMean: 100, qcSd: 2 },
    { val: 105, qcMean: 100, qcSd: 2 },
    { val: 200, qcMean: 200, qcSd: 2 },
  ], 100, 2, rule => rule === '2of3-2s');
  assert.ok(!twoOfThree.F[2].rules.includes('2of3-2s'), '2of3-2s không dùng bằng chứng trước đổi target');
});

test('WG16: archived concurrent lots with the same level retain each material in cross-level evaluation', () => {
  const highLotA = { date: '2026-09-01', runId: 'r1', val: 106 };
  const lowLotB = { date: '2026-09-01', runId: 'r1', val: 94 };
  const normalM2 = { date: '2026-09-01', runId: 'r1', val: 100 };
  const flags = westgardMultiByPoint([
    { level: 1, key: '1:lot-a', pts: [highLotA], mean: 100, sd: 2 },
    { level: 1, key: '1:lot-b', pts: [lowLotB], mean: 100, sd: 2 },
    { level: 2, key: '2:lot-c', pts: [normalM2], mean: 100, sd: 2 },
  ], rule => rule === 'R4s');
  assert.ok(flags.get(highLotA)?.includes('R4s'));
  assert.ok(flags.get(lowLotB)?.includes('R4s'));
  assert.equal(flags.has(normalM2), false);
});


