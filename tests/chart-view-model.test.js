const assert = require('node:assert/strict');
const { loadSandbox } = require('./helpers/sandbox');

const ctx = loadSandbox(['modules/chart-view-model.js']);
const plain = value => JSON.parse(JSON.stringify(value));

const lj = plain(ctx.ChartViewModel.buildLeveyJennings({
  points: [
    { id: 'old', date: '2026-07-01', lot: 'OLD', val: 9 },
    { id: 'inside', date: '2026-07-10', lot: 'L1', val: 10 },
    { id: 'after', date: '2026-07-20', lot: 'L1', val: 11 },
  ],
  start: '2026-07-01', end: '2026-07-15', lot: 'L1', mean: '10', sd: '1.5',
}));
assert.deepEqual(lj.points.map(point => point.id), ['inside']);
assert.equal(lj.mean, 10);
assert.equal(lj.sd, 1.5);

const cusum = plain(ctx.ChartViewModel.buildCusum({
  points: [{ id: 'p1' }],
  series: { cPos: [1], cNeg: [0], ma: [0.5], flags: ['ok'], h: 4, k: 0.5 },
}));
assert.equal(cusum.points.length, 1);
assert.equal(cusum.series.h, 4);

const multi = plain(ctx.ChartViewModel.buildMultiLevel({ views: [{ level: 1, pts: null }] }));
assert.deepEqual(multi, [{ level: 1, pts: [] }]);

const signal = Array.from({ length: 1000 }, (_, i) => Math.sin(i / 20));
signal[345] = -99;signal[678] = 99;
const sampled = plain(ctx.ChartViewModel.sampleIndices({ length: signal.length, maxPoints: 100, valueAt: i => signal[i], preserve: [555] }));
assert.equal(sampled[0], 0, 'first point is retained');
assert.equal(sampled[sampled.length - 1], 999, 'last point is retained');
assert(sampled.includes(345), 'negative spike is retained');
assert(sampled.includes(678), 'positive spike is retained');
assert(sampled.includes(555), 'explicitly preserved violation is retained');
assert(sampled.length <= 100, 'ordinary samples stay within the display budget');
assert.deepEqual(plain(ctx.ChartViewModel.sampleIndices({ length: 4, maxPoints: 10 })), [0, 1, 2, 3]);

console.log('Chart view-model tests passed');
