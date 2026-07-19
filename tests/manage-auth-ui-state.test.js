const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

{
  const ctx = loadSandbox(['modules/manage-ui-state.js']);
  assert.equal(ctx.ManageUIState.manageTab, 'instruments', 'Cấu hình chung mở thẳng Máy xét nghiệm, không còn thẻ Tổng quan');
  run(ctx, "manageTab='targets'; manageTargetGroup='G1'; configNavScroll=24; targetSwitchCtx={groupId:'G1'};");
  assert.equal(ctx.ManageUIState.manageTab, 'targets');
  assert.equal(ctx.ManageUIState.manageTargetGroup, 'G1');
  assert.equal(ctx.ManageUIState.configNavScroll, 24);
  assert.equal(ctx.ManageUIState.targetSwitchCtx.groupId, 'G1');
  ctx.ManageUIState.manageQ = 'glucose';
  assert.equal(ctx.manageQ, 'glucose');
}

{
  const ctx = loadSandbox(['modules/auth-ui-state.js']);
  run(ctx, "currentUser={id:'U1'}; loginFails=2; loginLockUntil=12345;");
  assert.equal(ctx.AuthUIState.currentUser.id, 'U1');
  assert.equal(ctx.AuthUIState.loginFails, 2);
  assert.equal(ctx.AuthUIState.loginLockUntil, 12345);
  ctx.AuthUIState.currentUser = null;
  assert.equal(ctx.currentUser, null);
}

console.log('Manage/Auth UI state tests passed');
