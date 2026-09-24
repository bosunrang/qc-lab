import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');

const TOTAL_POINTS = 500_000;
const POINTS_PER_LEVEL = TOTAL_POINTS / 2;
const MAX_SEED_MS = Number(process.env.QC_PERF_MAX_SEED_MS || 60_000);
const MAX_SUMMARY_MS = Number(process.env.QC_PERF_MAX_SUMMARY_MS || 60_000);
const MAX_ENTRY_MS = Number(process.env.QC_PERF_MAX_ENTRY_MS || 60_000);

function elapsed(work) {
  const started = performance.now();
  const value = work();
  return { value, ms: performance.now() - started };
}

function assertWithinBudget(label, ms, budget) {
  assert.ok(ms <= budget, `${label} mất ${ms.toFixed(0)} ms, vượt ngưỡng ${budget} ms.`);
}

test('hiệu năng với 500.000 điểm QC', { timeout: 240_000 }, () => {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const entry = createEntryHandlers(db);
  const westgard = createWestgardHandlers(db);
  const actor = { userId: 'performance-user', username: 'performance', name: 'Kiểm thử hiệu năng', role: 'admin', clientId: 'performance-client' };

  // Phần cấu hình nằm ngoài phép đo để kết quả chỉ phản ánh dữ liệu QC thật.
  const instrument = config.saveInstrument({ data: { name: 'Máy hiệu năng' } }, actor).data;
  const assay = config.saveTest({ data: { name: 'Xét nghiệm hiệu năng', instrumentId: instrument.id, unit: 'mmol/L', cusumOn: true, cusumK: 0.5, cusumH: 6 } }, actor).data;
  config.saveTestLevel({ testId: assay.id, data: { level: 1, mean: 100, sd: 2 } }, actor);
  config.saveTestLevel({ testId: assay.id, data: { level: 2, mean: 100, sd: 2 } }, actor);
  makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: [{ level: 1 }, { level: 2 }] });
  const lots = db.prepare(`SELECT l.level, q.lot_no FROM test_levels l
    JOIN qc_lots q ON q.id=l.qc_lot_id WHERE l.test_id=? ORDER BY l.level`).all(assay.id);
  const lot1 = lots.find((item) => item.level === 1)?.lot_no;
  const lot2 = lots.find((item) => item.level === 2)?.lot_no;
  assert.ok(lot1 && lot2, 'Hai mức QC phải có lô đang vận hành trước khi đo.');

  const seed = elapsed(() => db.exec(`
    BEGIN;
    WITH RECURSIVE sequence(i) AS (
      VALUES(1) UNION ALL SELECT i + 1 FROM sequence WHERE i < ${TOTAL_POINTS}
    )
    INSERT INTO qc_points(id,test_id,level,date,run_id,lot,val,value_decimals,qc_mean,qc_sd)
    SELECT
      'perf-' || i,
      '${assay.id}',
      CASE WHEN i % 2 = 0 THEN 2 ELSE 1 END,
      date('2020-01-01', '+' || ((i - 1) / 20) || ' days'),
      printf('run-%06d', ((i + 1) / 2)),
      CASE WHEN i % 2 = 0 THEN '${lot2}' ELSE '${lot1}' END,
      100 + ((i % 5) - 2) * 0.4,
      2,
      100,
      2
    FROM sequence;
    COMMIT;
  `));
  assertWithinBudget('Tạo 500.000 điểm QC', seed.ms, MAX_SEED_MS);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM qc_points WHERE test_id=?').get(assay.id).count, TOTAL_POINTS);

  const summary = elapsed(() => westgard.listTestSummaries());
  assertWithinBudget('Mở tổng quan Westgard với 500.000 điểm QC', summary.ms, MAX_SUMMARY_MS);
  assert.equal(summary.value[0]?.levels[0]?.pointCount, POINTS_PER_LEVEL);
  assert.equal(summary.value[0]?.levels[1]?.pointCount, POINTS_PER_LEVEL);

  const points = elapsed(() => entry.queryPoints(assay.id, 1));
  assertWithinBudget('Mở mức QC từ Nhập QC với 500.000 điểm', points.ms, MAX_ENTRY_MS);
  assert.equal(points.value.length, POINTS_PER_LEVEL);

  const heapMb = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`PERF500K | tạo: ${seed.ms.toFixed(0)} ms | Westgard: ${summary.ms.toFixed(0)} ms | Nhập QC: ${points.ms.toFixed(0)} ms | heap: ${heapMb.toFixed(0)} MB`);
});
