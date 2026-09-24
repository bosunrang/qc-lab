import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { qcRunKey, compareQcRunKey } from '../main/domain/sort-order.ts';
import { displayedWestgardBlocks, observedStats, statText, westgardExportRows, escapeHtml } from '../renderer/lib/westgard-view.ts';

test('WG10/14: displayed historical lot is also exported with targets, run and evidence', () => {
  const point = { id: 'old', date: '2026-09-01', runId: 'run2', val: 107, z: 3.5, targetMean: 100, targetSd: 2, verdict: 'rej', runRejected: true, accepted: false, rules: ['1-3s'], supportRules: ['2-2s'], cusumSignal: null };
  const levels = [{ level: 1, mean: 110, sd: 3, lot: 'NEW' }];
  const current = { 1: { points: [{ ...point, id: 'new', val: 110 }] } };
  const old = [{ level: 1, lotNo: 'OLD', mean: 100, sd: 2, analysis: { points: [point] } }];
  const displayed = displayedWestgardBlocks(levels, current, old, () => true);
  assert.equal(displayed[0].analysis.points[0].id, 'old');
  assert.deepEqual(westgardExportRows(displayed)[0], ['Mức 1', 'OLD', '01/09/2026', 'run2', 107, 100, 2, 3.5, 'Loại bỏ', 'Có', 'Không', '1-3s', '2-2s']);
  assert.equal(displayedWestgardBlocks(levels, current, old, () => false)[0].analysis.points[0].id, 'new');
  assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
});

test('WG14: actual sample size, small SD, single point and zero mean are explicit', () => {
  const stats = observedStats([{ val: 0.101, accepted: true, date: '2026-09-01' }, { val: 0.102, accepted: true, date: '2026-09-02' }, { val: 10, accepted: false }]);
  assert.equal(stats.n, 2); assert.equal(stats.days, 2); assert.equal(stats.provisional, true);
  assert.ok(Math.abs(stats.sd - 0.00070710678) < 1e-10); assert.notEqual(Number(statText(stats.sd)), 0);
  assert.equal(observedStats([{ val: 1, accepted: true }]).sd, null);
  assert.equal(observedStats([]).mean, null);
  assert.equal(observedStats([{ val: -1, accepted: true }, { val: 1, accepted: true }]).cv, null);
});

function storeFor(qcApi) {
  let state;
  const create = initialize => {
    state = initialize(update => { state = { ...state, ...update }; }, () => state);
    return { getState: () => state };
  };
  const source = readFileSync(new URL('../renderer/store/westgard-store.ts', import.meta.url), 'utf8');
  const stripped = stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm, '').replace('export const useWestgardStore', 'const useWestgardStore'));
  const context = vm.createContext({ create, window: { qcApi }, output: null });
  vm.runInContext(stripped + '\noutput = useWestgardStore;', context);
  return context.output;
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('WG09: delayed old response cannot overwrite the selected test or empty selection', async () => {
  const a = deferred(), b = deferred();
  const store = storeFor({ analyzeLevel: id => id === 'A' ? a.promise : b.promise, listPreviousLotBlocks: async () => [] });
  const first = store.getState().loadAnalysis('A', [1]), second = store.getState().loadAnalysis('B', [1]);
  b.resolve({ points: ['B'] }); await second;
  a.resolve({ points: ['A'] }); await first;
  assert.equal(store.getState().analysisTestId, 'B'); assert.equal(store.getState().analysisByLevel[1].points[0], 'B');
  const delayed = deferred();
  const other = storeFor({ analyzeLevel: () => delayed.promise, listPreviousLotBlocks: async () => [] });
  const pending = other.getState().loadAnalysis('A', [1]);
  await other.getState().loadAnalysis('', []); delayed.resolve({ points: ['A'] }); await pending;
  assert.equal(Object.keys(other.getState().analysisByLevel).length, 0);
  assert.equal(other.getState().analysisTestId, '');
});

test('WG09/13: errors clear stale analysis and rejected configuration writes surface', async () => {
  const store = storeFor({ analyzeLevel: async () => { throw Error('connection'); }, listPreviousLotBlocks: async () => [], saveRuleSetting: async () => ({ ok: false, error: { message: 'Denied' } }) });
  await store.getState().loadAnalysis('A', [1]);
  assert.equal(store.getState().analysisLoading, false); assert.ok(store.getState().analysisError);
  await assert.rejects(store.getState().saveRuleSetting('1-3s', false), /Denied/);
});

test('WG11/12: chart and invalidation wiring use the shared run key and all evaluation inputs', () => {
  const chart = readFileSync(new URL('../renderer/components/QcChart.tsx', import.meta.url), 'utf8');
  assert.match(chart, /dateIndex\.get\(qcRunKey\(point\)\)/);
  assert.match(chart, /dateIndex\.get\(qcRunKey\(p\)\)/);
  assert.match(chart, /map\(keyOf\)\)\)\)\.sort\(compareQcRunKey\)/);
  assert.match(chart, /lot: hit\.lot/);
  const page = readFileSync(new URL('../renderer/pages/WestgardPage.tsx', import.meta.url), 'utf8');
  const subscriptions = [...page.matchAll(/useStoreInvalidation\(\[([^\]]+)\]/g)];
  assert.equal(subscriptions.length, 2);
  for (const subscription of subscriptions) for (const table of ['actions', 'app_meta', 'qc_panels', 'qc_panel_tests', 'lot_transitions']) assert.ok(subscription[1].includes(`'${table}'`));
});

test('WG11: actual canvas drawing places same-day runs at distinct increasing X coordinates', () => {
  const source = readFileSync(new URL('../renderer/components/QcChart.tsx', import.meta.url), 'utf8');
  const sections = [
    // `drawMulti` dùng chung helper này với `drawLJ` — nạp kèm, nếu không
    // sandbox ném ReferenceError thay vì kiểm được toạ độ.
    source.slice(source.indexOf('function isRunCollateral('), source.indexOf('export interface QcChartCusum')),
    source.slice(source.indexOf('function geometry('), source.indexOf('function ticksOf(')),
    source.slice(source.indexOf('function drawMulti('), source.indexOf('function drawCusum(')),
    source.slice(source.indexOf('function drawMultiCusum(')),
  ].join('\n');
  const context = vm.createContext({ qcRunKey, compareQcRunKey, vnDayMonth: date => date,
    LJ: {}, BANDS: [], MULTI_COLORS: ['teal'], MULTI_CUSUM_COLORS: [['teal', 'blue']], CUSUM_COLORS: {} });
  vm.runInContext(stripTypeScriptTypes(sections), context);
  const circles = [];
  const canvas = new Proxy({}, { get: (_, key) => key === 'arc' ? (x, y) => circles.push({ x, y }) : key === 'measureText' ? () => ({ width: 20 }) : () => {}, set: () => true });
  const points = ['run1', 'run2', 'run10'].map(runId => ({ runId, date: '2026-09-01', val: 100, z: 0, verdict: 'ok' }));
  context.drawMulti(canvas, 1000, 300, [{ level: 1, points }]);
  assert.equal(circles.length, 3);
  assert.ok(circles[0].x < circles[1].x && circles[1].x < circles[2].x);
  circles.length = 0;
  context.drawMultiCusum(canvas, 1000, 300, [{ level: 1, points, cusum: { cPos: [1, 2, 3], cNeg: [0, 0, 0], ma: [], flags: ['ok', 'ok', 'ok'], k: 0.5, h: 4 } }]);
  assert.equal(circles.length, 6);
  assert.ok(circles[0].x < circles[2].x && circles[2].x < circles[4].x);
});

test('WG17: lý do lần chạy bị loại đọc từ main, không tự dò lại ở renderer', () => {
  // Điểm TỰ NÓ đạt nhưng cả lần chạy bị Mức 2 làm hỏng.
  const collateral = { id: 'p1', date: '2026-09-01', runId: 'run1', val: 100, z: 0.2, targetMean: 100, targetSd: 2,
    verdict: 'ok', runRejected: true, runRejectedBy: [2], accepted: false, rules: [], supportRules: [], cusumSignal: null };
  const blocks = displayedWestgardBlocks([{ level: 1, mean: 100, sd: 2, lot: 'L1' }], { 1: { points: [collateral] } }, [], () => false);
  const row = westgardExportRows(blocks)[0];
  assert.equal(row[8], 'Đạt', 'kết luận riêng của điểm không đổi');
  assert.equal(row[9], 'Có (Mức 2)', 'cột "Lần chạy bị loại" nêu luôn mức làm hỏng');
  assert.equal(row[10], 'Không', 'và điểm không vào thống kê');

  // Điểm TỰ vi phạm thì cột "Kết luận điểm" đã nói rồi, không lặp lại mức.
  const selfRejected = { ...collateral, verdict: 'rej', rules: ['1-3s'], runRejectedBy: [1] };
  const selfRow = westgardExportRows(displayedWestgardBlocks([{ level: 1, mean: 100, sd: 2, lot: 'L1' }], { 1: { points: [selfRejected] } }, [], () => false))[0];
  assert.equal(selfRow[9], 'Có');

  // Nhãn trên bảng phải ĐỌC `runRejectedBy`, không quét lại `analysisByLevel`:
  // bản dò lại chỉ nêu được một mức, và khi bảng đang mở "Xem lô cũ" thì nó
  // tra nhầm sang chuỗi của lô đang chạy.
  const page = readFileSync(new URL('../renderer/pages/WestgardPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /const runExclusionLabel = \(point: \{ runRejectedBy\?: number\[\] \}\)/);
  assert.equal((page.match(/runExclusionLabel\(p\)/g) || []).length, 2, 'cả bảng lô hiện hành lẫn tab nhóm lô đã dừng đều dùng chung nhãn');
  assert.doesNotMatch(page, /candidate\.verdict === 'rej'/, 'không còn vòng dò lại ở renderer');
});


