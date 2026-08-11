const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js']);
run(ctx, `
  var currentUser = { id: 'u1', username: 'admin', name: 'Admin', role: 'admin' };
  var fb = { clientId: 'client-a' };
  function userName(){ return currentUser.name; }
  function role(){ return currentUser.role; }
  function __getState(){ return state; }
`);
const auditCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'modules', 'audit.js'), 'utf8');
vm.runInContext(auditCode, ctx, { filename: 'modules/audit.js' });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'generated', 'modular-pilot.js'), 'utf8'), ctx, { filename: 'generated/modular-pilot.js' });
run(ctx, `currentUser={id:'u1',username:'admin',name:'Admin',role:'admin'};`);

assert.equal(ctx.auditSha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

{
  run(ctx, `
    state.activity = [];
    logAct('Đăng nhập', 'Đăng nhập thành công', 'Tài khoản');
    logAct('Thêm điểm QC', 'Ngày 01/07/2026', 'Glucose');
  `);
  const activity = JSON.parse(JSON.stringify(ctx.__getState().activity));
  assert.equal(activity.length, 2);
  assert.equal(activity[0].prevHash, '');
  assert.ok(/^[0-9a-f]{64}$/.test(activity[0].hash));
  assert.equal(activity[1].prevHash, activity[0].hash);
  assert.equal(ctx.auditVerifyChain().ok, true);
  assert.equal(ctx.auditVerifyChain().checked, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.QCCore.verifyAuditChain(activity,''))),JSON.parse(JSON.stringify(ctx.auditVerifyChain(activity,''))),'cổng kiểm tra thuần trong core phải khớp với trang audit');
}

{
  run(ctx, `state.activity[0].detail = 'đã bị sửa';`);
  const verified = ctx.auditVerifyChain();
  assert.equal(verified.ok, false);
  assert.equal(verified.brokenIndex, 0);
  assert.equal(verified.reason, 'hash không khớp');
}

{
  const clean = ctx.QCCore.sanitizeBackup({
    lab: {},
    tests: [],
    data: {},
    actions: [],
    activity: [{ id: 'a1', seq: 1, ts: '2026-07-11T00:00:00.000Z', role: 'admin', hash: 'a'.repeat(64), prevHash: 'b'.repeat(64) }],
    users: [],
  });
  assert.equal(clean.activity[0].hash, 'a'.repeat(64));
  assert.equal(clean.activity[0].prevHash, 'b'.repeat(64));
}

console.log('Audit hash chain tests passed');
