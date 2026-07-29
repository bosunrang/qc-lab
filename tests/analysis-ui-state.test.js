const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['modules/analysis-ui-state.js']);

run(ctx, "selTest='T1'; wgTestQ='glucose'; dashTestStatus='warn'; dashKpiPeriod='90'; dashKpiInstrument='I1'; dashKpiTest='T1'; wgPrevOpen.add('T1|1'); wgExpandedRows.add('current:T1|1|L1');");
assert.equal(ctx.AnalysisUIState.selTest, 'T1');
assert.equal(ctx.AnalysisUIState.wgTestQ, 'glucose');
assert.equal(ctx.AnalysisUIState.dashTestStatus, 'warn');
assert.equal(ctx.AnalysisUIState.dashKpiPeriod, '90');
assert.equal(ctx.AnalysisUIState.dashKpiInstrument, 'I1');
assert.equal(ctx.AnalysisUIState.dashKpiTest, 'T1');
assert.equal(ctx.AnalysisUIState.wgPrevOpen.has('T1|1'), true);
assert.equal(ctx.AnalysisUIState.wgExpandedRows.has('current:T1|1|L1'), true);

ctx.AnalysisUIState.selTest = null;
assert.equal(ctx.selTest, null, 'legacy analysis aliases must stay synchronized during migration');

console.log('Analysis UI state tests passed');
