const assert = require('node:assert/strict');
const { loadSandbox } = require('./helpers/sandbox');

const ctx = loadSandbox(['modules/westgard-view-model.js']);
const plain = value => JSON.parse(JSON.stringify(value));

const rows = plain(ctx.WestgardViewModel.buildPointRows({
  points: [
    { id: 'p1', date: '2026-07-14', val: 12 },
    { id: 'p2', date: '2026-07-15', val: 8 },
  ],
  verdicts: [
    { level: 'warn', rules: ['1-2s', '1-2s'] },
    { level: 'ok', rules: [] },
  ],
  mean: 10,
  sd: 1,
}));

assert.equal(rows[0].index, 1);
assert.equal(rows[0].z, 2);
assert.deepEqual(rows[0].rules, ['1-2s']);
assert.equal(rows[0].level, 'warn');
assert.equal(rows[1].z, -2);

const mapped = plain(ctx.WestgardViewModel.buildPointRows({
  points: [{ id: 'p3', date: '2026-07-16', val: 11 }, { id: 'p4', date: '2026-07-17', val: 10.5 }],
  verdicts: new Map([['p3', { level: 'rej', rules: ['1-3s'], z: 3.5 }], ['p4', { level: 'ok', rules: [], supportRules: ['6x'], z: .5 }]]),
  mean: 10,
  sd: 1,
}));
assert.equal(mapped[0].z, 3.5, 'explicit verdict z-score takes precedence');
assert.equal(mapped[0].level, 'rej');
assert.deepEqual(mapped[1].supportRules, ['6x'], 'historical evidence remains visible without changing the verdict');
assert.equal(mapped[1].level, 'ok');

const summary = plain(ctx.WestgardViewModel.summarizeTestStatus({
  today: '2026-07-14',
  views: [
    { l: { level: 1 }, pts: [{ id: 'p1', date: '2026-07-14', val: 10 }] },
    { l: { level: 2 }, pts: [{ id: 'p2', date: '2026-07-13', val: 12 }] },
  ],
  verdicts: new Map([
    ['p1', { level: 'ok', rules: [] }],
    ['p2', { level: 'rej', rules: ['1-3s'] }],
  ]),
}));
assert.equal(summary.status, 'rej');
assert.equal(summary.todayCount, 1);
assert.equal(summary.totalPoints, 2);
assert.equal(summary.alerts[0].rules[0], '1-3s');
assert.equal(summary.lastPoints[1]._level, 2);

const multi = plain(ctx.WestgardViewModel.buildMultiViews({
  levels: [{ level: 1, lot: 'NEW', mean: 10, sd: 1, pts: [{ id: 'new' }] }],
  previousByLevel: { 1: [{ lot: 'OLD', mean: 9, sd: 1, pts: [{ id: 'old' }] }] },
  openLevels: [1],
}));
assert.deepEqual(multi.map(view => view.lot), ['NEW', 'OLD']);

console.log('Westgard view-model tests passed');
