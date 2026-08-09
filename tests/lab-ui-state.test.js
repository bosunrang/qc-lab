const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

{
  const ctx = loadSandbox(['core.js', 'generated/modular-pilot.js']);
  run(ctx, "sgTest='T1'; sgBiasCtx={eid:'E1',level:1,rounds:[]};");
  assert.equal(ctx.SigmaUIState.sgTest, 'T1');
  assert.equal(ctx.SigmaUIState.sgBiasCtx.eid, 'E1');
  ctx.SigmaUIState.sgTest = null;
  assert.equal(ctx.sgTest, null);
}

{
  const ctx = loadSandbox(['core.js', 'generated/modular-pilot.js']);
  run(ctx, "rcId='R1'; rcQuickType='operator'; rcModalQ='glucose';");
  assert.equal(ctx.ReagentUIState.rcId, 'R1');
  assert.equal(ctx.ReagentUIState.rcQuickType, 'operator');
  assert.equal(ctx.rcModalQ, 'glucose');
  ctx.ReagentUIState.rcId = null;
  assert.equal(ctx.rcId, null);
}

console.log('Lab UI state tests passed');
