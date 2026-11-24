// Bộ nhớ đệm "lô cũ" (2026-11-03): Nhập QC nạp phần lô cũ sau mỗi lần nhập
// điểm, tính mới mất hàng trăm ms trên dữ liệu nhiều năm. Điểm mới chỉ vào
// lô đang vận hành/lô song song nên KHÔNG được làm bộ nhớ đệm tính lại; mọi
// thay đổi chạm tới lô cũ thì PHẢI tính lại — giữ nhầm là sai số liệu QC.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { PreviousLotCache, PREVIOUS_LOT_IGNORED_TABLES, PREVIOUS_LOT_PER_TEST_TABLES } = require('../../app-dist/main/ipc/previous-lot-cache.js');
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createHistoricalWestgard } = require('../../app-dist/main/db/historical-westgard.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };

test('quy tắc bỏ kết quả lô cũ đã giữ', () => {
  const cache = new PreviousLotCache();
  let computed = [];
  const read = (id) => cache.get(id, () => { computed.push(id); return { series: [{ lot: `OLD-${id}` }] }; });
  const fill = () => { read('A'); read('B'); computed = []; };

  fill();
  read('A'); read('B');
  assert.deepEqual(computed, [], 'không có thay đổi thì không tính lại');

  cache.onChanged({ tables: ['qc_points'], testIds: ['A'], lots: ['NEW-A'] });
  read('A'); read('B');
  assert.deepEqual(computed, [], 'điểm mới vào lô không phải lô cũ: giữ nguyên');

  cache.onChanged({ tables: ['qc_points'], testIds: ['A'], lots: ['OLD-A'] });
  read('A'); read('B');
  assert.deepEqual(computed, ['A'], 'đổi đúng lô cũ của A: chỉ tính lại A');

  fill();
  cache.onChanged({ tables: ['qc_points'], testIds: ['A'] });
  read('A'); read('B');
  assert.deepEqual(computed, ['A'], 'không biết lô nào (huỷ điểm, ghi chú ngày): tính lại A');

  fill();
  cache.onChanged({ tables: ['qc_points', 'nce_cuts'], testIds: ['A'], lots: ['NEW-A'] });
  read('A'); read('B');
  assert.deepEqual(computed, ['A'], '`lots` chỉ có nghĩa khi chỉ `qc_points` đổi');

  for (const payload of [
    { tables: ['qc_points'], testIds: [], lots: ['NEW-A'] }, // không nói xét nghiệm nào
    { tables: ['lot_transitions'], testIds: ['A'] }, // chuỗi chuyển tiếp lô
    { tables: ['qc_lots'], testIds: [] },
    { tables: ['lot_groups'], testIds: [] },
    { tables: ['app_meta'], testIds: [] }, // luật Westgard chung
    { tables: ['bang_moi_chua_biet'], testIds: ['A'] },
  ]) {
    fill();
    cache.onChanged(payload);
    read('A'); read('B');
    assert.deepEqual(computed, ['A', 'B'], `bỏ hết với ${JSON.stringify(payload)}`);
  }

  fill();
  for (const table of ['users', 'sigma_data', 'nce_records', 'eqa_results']) cache.onChanged({ tables: [table], testIds: ['A'] });
  read('A'); read('B');
  assert.deepEqual(computed, [], 'bảng lô cũ không đọc tới thì giữ nguyên');

  fill();
  cache.onChanged({ tables: ['activity'], testIds: [] });
  read('A'); read('B');
  assert.deepEqual(computed, ['A', 'B'], 'ghi nhật ký mà chưa báo bảng: bỏ hết');

  for (const table of PREVIOUS_LOT_PER_TEST_TABLES) assert.equal(PREVIOUS_LOT_IGNORED_TABLES.has(table), false, table);
  assert.equal(PREVIOUS_LOT_IGNORED_TABLES.has('lot_transitions'), false, 'lô cũ đọc chuỗi chuyển tiếp');
});

function scenario() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const inst = config.saveInstrument({ data: { name: 'Máy A' } }, actor).data;
  const t = config.saveTest({ data: { name: 'Natri', instrumentId: inst.id, unit: 'mmol/L' } }, actor).data;
  db.prepare('INSERT INTO qc_panels(id,name,instrument_id,active) VALUES (?,?,?,1)').run('p1', 'Panel', inst.id);
  db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id) VALUES (?,?)').run('p1', t.id);
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('g1','Nhóm A',1,'')").run();
  db.prepare("INSERT INTO qc_lots(id,group_id,lot_no,level) VALUES ('lOld','g1','OLD-1',1),('lNew','g1','NEW-1',1)").run();
  config.saveTestLevel({ testId: t.id, data: { level: 1, mean: 100, sd: 2, qcLotId: 'lNew' } }, actor);
  db.prepare('UPDATE test_levels SET mean_sd_history_json=? WHERE test_id=? AND level=1')
    .run(JSON.stringify([{ at: '2026-07-01T00:00:00.000Z', qcLotId: 'lOld', mean: 200, sd: 4 }]), t.id);
  db.prepare(`INSERT INTO lot_transitions(id,panel_id,from_lot_id,to_lot_id,status,start_date,approved_at)
    VALUES ('tr1','p1','lOld','lNew','accepted','2026-07-01','2026-07-01T00:00:00.000Z')`).run();
  const ins = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  ins.run('o1', t.id, 1, '2026-06-01', '2026-06-01-1', 200, 'OLD-1', 200, 4);
  ins.run('o2', t.id, 1, '2026-06-02', '2026-06-02-1', 214, 'OLD-1', 200, 4);
  ins.run('o3', t.id, 1, '2026-07-02', '2026-07-02-1', 201, 'OLD-1', 200, 4);
  ins.run('n1', t.id, 1, '2026-07-02', '2026-07-02-1', 101, 'NEW-1', 100, 2);
  return { db, testId: t.id, westgard: createWestgardHandlers(db), entry: createEntryHandlers(db) };
}

test('thao tác ghi thật: lô cũ có bộ nhớ đệm trùng lượt tính mới', () => {
  const { db, testId, westgard, entry } = scenario();
  const fresh = () => createHistoricalWestgard(db).listPreviousLotBlocks(testId);
  const check = (label) => assert.deepEqual(westgard.listPreviousLotBlocks(testId), fresh(), label);

  const before = westgard.listPreviousLotBlocks(testId);
  check('lần đầu');

  const added = entry.addPoint({ data: { testId, level: 1, date: '2026-07-03', runId: '2026-07-03-1', val: 102 } }, actor);
  assert.equal(added.ok, true, JSON.stringify(added));
  assert.equal(westgard.listPreviousLotBlocks(testId), before, 'nhập điểm vào lô đang vận hành không tính lại lô cũ');
  check('sau khi nhập điểm');

  // Lô cũ dùng chung với Nhập QC: cùng điểm, cùng kết luận.
  const series = entry.listPreviousLotSeries(testId);
  assert.deepEqual(series[0].points.map((p) => [p.id, p.verdict]), before[0].analysis.points.map((p) => [p.id, p.verdict]));

  const voided = entry.voidPoint({ data: { pointId: 'o2', kind: 'analytical', reason: 'Máy báo lỗi hút mẫu lúc chạy QC' } }, actor);
  assert.equal(voided.ok, true, JSON.stringify(voided));
  check('sau khi huỷ điểm của lô cũ');
  assert.deepEqual(westgard.listPreviousLotBlocks(testId)[0].analysis.points.map((p) => p.id), ['o1', 'o3']);

  const noted = entry.setDayNote({ data: { testId, date: '2026-07-02', note: 'Đổi bóng đèn' } }, actor);
  assert.equal(noted.ok, true, JSON.stringify(noted));
  assert.equal(entry.listPreviousLotSeries(testId)[0].points.find((p) => p.id === 'o3').note, 'Đổi bóng đèn', 'ghi chú ngày hiện cả trên điểm lô cũ');

  const rule = westgard.saveRuleSetting('1-2s', false, actor);
  assert.equal(rule.ok, true, JSON.stringify(rule));
  check('sau khi đổi luật chung');
});
