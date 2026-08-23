const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'generated/modular-pilot.js']);

run(ctx, "selTest='T1'; wgTestQ='glucose'; dashTestStatus='warn'; wgPrevOpen.add('T1|1'); wgVisibleRows.set('current:T1|1|L1', 240);");
assert.equal(ctx.AnalysisUIState.selTest, 'T1');
assert.equal(ctx.AnalysisUIState.wgTestQ, 'glucose');
assert.equal(ctx.AnalysisUIState.dashTestStatus, 'warn');
assert.equal(ctx.AnalysisUIState.wgPrevOpen.has('T1|1'), true);
assert.equal(ctx.AnalysisUIState.wgVisibleRows.get('current:T1|1|L1'), 240);

ctx.AnalysisUIState.selTest = null;
assert.equal(ctx.selTest, null, 'legacy analysis aliases must stay synchronized during migration');

console.log('Analysis UI state tests passed');
