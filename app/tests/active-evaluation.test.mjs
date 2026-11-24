// Đánh giá các mức đang vận hành dùng chung trong một lượt nạp (2026-11-03):
// sau mỗi lần nhập điểm, Nhập QC gọi `queryPoints`/`analyzeLevel` cho từng mức
// và `rangeCandidate`, mỗi lời gọi từng tự đánh giá lại toàn bộ các mức. Kết
// quả giữ lại chỉ được dùng khi CSDL chắc chắn chưa đổi.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { activeEvaluationOf } = require('../../app-dist/main/ipc/active-evaluation.js');
const { withTransaction } = require('../../app-dist/main/db/transaction.js');
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };

function scenario() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const inst = config.saveInstrument({ data: { name: 'Máy A' } }, actor).data;
  const t = config.saveTest({ data: { name: 'Natri', instrumentId: inst.id, unit: 'mmol/L' } }, actor).data;
  db.prepare('INSERT INTO qc_panels(id,name,instrument_id,active) VALUES (?,?,?,1)').run('p1', 'Panel', inst.id);
  db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id) VALUES (?,?)').run('p1', t.id);
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('g1','Nhóm A',1,'')").run();
  db.prepare("INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('l1','g1','LOT-1',1),('l2','g1','LOT-2',2)").run();
  config.saveTestLevel({ testId: t.id, data: { level: 1, mean: 100, sd: 2, qcLotId: 'l1' } }, actor);
  config.saveTestLevel({ testId: t.id, data: { level: 2, mean: 200, sd: 4, qcLotId: 'l2' } }, actor);
  const ins = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  ins.run('a1', t.id, 1, '2026-06-01', '2026-06-01-1', 101, 'LOT-1', 100, 2);
  ins.run('b1', t.id, 2, '2026-06-01', '2026-06-01-1', 202, 'LOT-2', 200, 4);
  return { db, testId: t.id, ins, westgard: createWestgardHandlers(db), entry: createEntryHandlers(db) };
}

const idsOf = (evaluation) => evaluation.levels.flatMap((level) => level.pts.map((point) => point.id));

test('các lời gọi liền nhau dùng chung một lượt đánh giá', () => {
  const { db, testId } = scenario();
  const first = activeEvaluationOf(db, testId);
  assert.equal(activeEvaluationOf(db, testId), first);
});

test('ghi thẳng bằng SQL, không báo thay đổi: vẫn tính lại', () => {
  const { db, testId, ins } = scenario();
  activeEvaluationOf(db, testId);
  ins.run('a2', testId, 1, '2026-06-02', '2026-06-02-1', 99, 'LOT-1', 100, 2);
  assert.deepEqual(idsOf(activeEvaluationOf(db, testId)), ['a1', 'a2', 'b1']);
  db.prepare("UPDATE qc_points SET voided=1 WHERE id='a2'").run();
  assert.deepEqual(idsOf(activeEvaluationOf(db, testId)), ['a1', 'b1']);
});

test('kết quả tính giữa transaction bị huỷ không được giữ lại', () => {
  const { db, testId, ins } = scenario();
  assert.throws(() => withTransaction(db, () => {
    ins.run('ghost', testId, 1, '2026-06-02', '2026-06-02-1', 130, 'LOT-1', 100, 2);
    assert.deepEqual(idsOf(activeEvaluationOf(db, testId)), ['a1', 'ghost', 'b1']);
    throw new Error('huỷ');
  }), /huỷ/);
  assert.deepEqual(idsOf(activeEvaluationOf(db, testId)), ['a1', 'b1'], 'điểm đã bị huỷ theo transaction không được hiện lại');
});

test('nhập điểm qua handler: các endpoint thấy điểm mới và cùng kết luận', () => {
  const { testId, westgard, entry } = scenario();
  entry.queryPoints(testId, 1);
  westgard.analyzeLevel(testId, 1);
  const added = entry.addPoint({ data: { testId, level: 1, date: '2026-06-02', runId: '2026-06-02-1', val: 107 } }, actor);
  assert.equal(added.ok, true, JSON.stringify(added));
  assert.equal(added.data.verdict, 'rej', '1-3s');
  for (const level of [1, 2]) {
    const points = entry.queryPoints(testId, level), analysis = westgard.analyzeLevel(testId, level);
    assert.deepEqual(points.map((p) => [p.id, p.verdict, p.accepted]), analysis.points.map((p) => [p.id, p.verdict, p.accepted]));
  }
  assert.ok(entry.queryPoints(testId, 1).some((p) => p.id === added.data.id));
  const summary = westgard.listTestSummaries().find((item) => item.testId === testId);
  assert.equal(summary.levels[0].latestVerdict, 'rej');
  assert.equal(entry.rangeCandidate(testId, 1).data.proposed?.n ?? 0, 1, 'dải PXN bỏ lần chạy bị loại');
});
