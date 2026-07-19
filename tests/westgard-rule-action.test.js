const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js']);
run(ctx, "state.westgardRules=Object.fromEntries(QCCore.WG_RULES.map(rule=>[rule,true]));");

assert.equal(run(ctx, "defaultRuleAction('6x')"), 'alert', '6x must default to warning');
assert.equal(run(ctx, "defaultRuleAction('10x')"), 'reject', '10x remains a rejection rule');
assert.equal(run(ctx, "testRuleAction({ruleActions:{'6x':'reject'}},'6x')"), 'reject', 'per-test SOP may promote 6x to reject');
assert.equal(run(ctx, "testRuleAction({ruleActions:{'6x':'inactive'}},'6x')"), 'inactive', 'per-test SOP may disable 6x');

run(ctx, "state.tests=[{id:'T2',levels:[{level:1},{level:2}]}];");
assert.equal(run(ctx, "testRuleScope(state.tests[0],'6x')"), 'across', 'Nx defaults to cross-level protocol when multiple controls are run');
assert.equal(run(ctx, "testRuleScope(state.tests[0],'R4s')"), 'across', 'R4s is a within-run cross-level rule');
assert.equal(run(ctx, "testRuleScope(state.tests[0],'1-3s')"), 'within', 'single-point rules remain within each level');
assert.equal(run(ctx, "testRuleScope({...state.tests[0],ruleScopes:{'6x':'both'}},'6x')"), 'both', 'SOP may explicitly enable both scopes');

run(ctx, "state.westgardRules['6x']=false;");
assert.equal(run(ctx, "defaultRuleAction('6x')"), 'inactive', 'global switch still disables 6x');

console.log('Westgard rule-action tests passed');
