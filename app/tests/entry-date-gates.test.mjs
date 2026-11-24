// N9 (2026-11-03): nhập điểm QC chặn ngày tương lai và lô quá hạn dùng; điểm
// nhập lùi ngày mang Mean/SD hiệu lực của chính ngày chạy, không phải dải
// hiện hành — snapshot trên điểm quyết định z và kết luận Westgard.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { must } from './helpers/nce-flow.mjs';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { meanSdOnDate } = require('../../app-dist/main/domain/manage-validation.js');
const { isoLocalDate, isoLocalDateAfter } = require('../../app-dist/main/domain/local-date.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };

test('Mean/SD hiệu lực theo ngày từ lịch sử dải', () => {
  const history = JSON.stringify([
    { at: 'x', qcLotId: 'L1', mean: 100, sd: 2, effectiveFrom: '2026-01-01', effectiveTo: '2026-03-01' },
    { at: 'x', qcLotId: 'L0', mean: 50, sd: 1, effectiveFrom: '2025-06-01', effectiveTo: '2026-01-01' },
    { at: 'x', qcLotId: 'L1', mean: 90, sd: 0, effectiveFrom: '2025-12-01', effectiveTo: '2026-01-01' },
  ]);
  const current = { mean: 104, sd: 2.5, effectiveFrom: '2026-03-01' };
  assert.deepEqual(meanSdOnDate(history, 'L1', '2026-02-15', current), { mean: 100, sd: 2, fromHistory: true });
  assert.deepEqual(meanSdOnDate(history, 'L1', '2026-03-01', current), { mean: 104, sd: 2.5, fromHistory: false }, 'ngày đổi dải dùng dải mới');
  assert.equal(meanSdOnDate(history, 'L1', '2025-12-15', current).fromHistory, false, 'mốc SD = 0 và mốc khác lô không dùng được');
  assert.equal(meanSdOnDate('[]', 'L1', '2026-02-15', { ...current, effectiveFrom: '' }).mean, 104, 'thiếu ngày hiệu lực: dải hiện hành');
  assert.equal(meanSdOnDate('hỏng', 'L1', '2026-02-15', current).mean, 104);
});

function scenario({ exp = '' } = {}) {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db), entry = createEntryHandlers(db);
  const inst = must(config.saveInstrument({ data: { name: 'Máy A' } }, actor), 'máy');
  const t = must(config.saveTest({ data: { name: 'Natri', instrumentId: inst.id, unit: 'mmol/L' } }, actor), 'xét nghiệm');
  must(config.savePanel({ data: { name: 'Panel', instrumentId: inst.id, testIds: [t.id] } }, actor), 'panel');
  const lot = must(config.saveLot({ data: { lotNo: 'LOT-1', level: 1, exp } }, actor), 'lô');
  db.prepare("INSERT INTO lot_groups(id,name,active,status) VALUES ('g1','Nhóm',1,'')").run();
  db.prepare("UPDATE qc_lots SET group_id='g1' WHERE id=?").run(lot.id);
  must(config.saveTestLevel({ testId: t.id, data: { level: 1, mean: 140, sd: 2, qcLotId: lot.id } }, actor), 'mức');
  return { db, entry, testId: t.id, lotId: lot.id };
}
const add = (entry, testId, date, val = 140) => entry.addPoint({ data: { testId, level: 1, date, runId: `${date}-1`, val } }, actor);

test('chặn ngày tương lai, nhận hôm nay', () => {
  const { entry, testId } = scenario();
  assert.equal(add(entry, testId, isoLocalDateAfter(1)).error?.code, 'future-date');
  assert.equal(add(entry, testId, isoLocalDate()).ok, true);
});

test('chặn kết quả chạy sau hạn dùng của lô', () => {
  const { entry, testId } = scenario({ exp: '2026-06-30' });
  assert.equal(add(entry, testId, '2026-06-30').ok, true, 'đúng ngày hết hạn vẫn còn dùng được');
  const late = add(entry, testId, '2026-07-01');
  assert.equal(late.error?.code, 'lot-expired');
  assert.match(late.error.message, /30\/06\/2026/);
});

test('điểm nhập lùi ngày mang dải của chính ngày chạy', () => {
  const { db, entry, testId, lotId } = scenario();
  // Dải 140/2 có hiệu lực tới 01/10/2026, từ đó là 150/3.
  db.prepare('UPDATE test_levels SET mean=150, sd=3, mean_sd_effective_from=?, mean_sd_history_json=? WHERE test_id=? AND level=1')
    .run('2026-10-01', JSON.stringify([{ at: '2026-10-01T03:00:00.000Z', qcLotId: lotId, mean: 140, sd: 2, effectiveFrom: '2026-01-01', effectiveTo: '2026-10-01' }]), testId);
  const stored = (id) => ({ ...db.prepare('SELECT qc_mean, qc_sd FROM qc_points WHERE id=?').get(id) });
  const back = must(add(entry, testId, '2026-09-15', 147), 'nhập lùi ngày');
  assert.deepEqual(stored(back.id), { qc_mean: 140, qc_sd: 2 });
  assert.equal(back.verdict, 'rej', '147 là +3,5SD theo dải cũ, chỉ −1SD theo dải mới');
  const now = must(add(entry, testId, '2026-10-02', 146), 'nhập sau ngày đổi dải');
  assert.deepEqual(stored(now.id), { qc_mean: 150, qc_sd: 3 });
  const audit = db.prepare("SELECT detail FROM activity WHERE type='Nhập QC' ORDER BY seq").all().map((row) => row.detail);
  assert.match(audit[0], /Mean\/SD hiệu lực ngày chạy 140\/2/);
  assert.doesNotMatch(audit[1], /hiệu lực ngày chạy/);
});
