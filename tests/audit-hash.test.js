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
  const sanitized = ctx.QCCore.sanitizeBackup({ lab: {}, tests: [], data: {}, actions: [], activity, users: [] });
  assert.equal(Object.hasOwn(sanitized.activity[0], 'mergePrevHashes'), false);
  run(ctx, `state.activity = ${JSON.stringify(JSON.parse(JSON.stringify(sanitized.activity)))};`);
  assert.equal(ctx.auditVerifyChain().ok, true, 'sanitizing a legacy linear hash chain must not change its payload');
}

{
  run(ctx, `state.activity[0].detail = 'đã bị sửa';`);
  const verified = ctx.auditVerifyChain();
  assert.equal(verified.ok, false);
  assert.equal(verified.brokenIndex, 0);
  assert.equal(verified.reason, 'hash không khớp');
}

{
  const merged = run(ctx, `
    state.activity = [];
    fb.clientId = 'machine-a';
    logAct('Đăng nhập', 'Bản ghi chung', 'Tài khoản');
    var shared = JSON.parse(JSON.stringify(state.activity));

    state.activity = JSON.parse(JSON.stringify(shared));
    logAct('Nhập QC', 'Nhánh máy A', 'Glucose');
    var branchA = JSON.parse(JSON.stringify(state.activity));

    fb.clientId = 'machine-b';
    state.activity = JSON.parse(JSON.stringify(shared));
    logAct('Nhập QC', 'Nhánh máy B', 'ALT');
    var branchB = JSON.parse(JSON.stringify(state.activity));

    var fork = branchA.concat([branchB[1]]);
    var historicalHashes = fork.map(function(a){ return a.hash; });
    var result = auditMergeChains(fork);
    state.activity = result.activity;
    var anchor = state.activity[state.activity.length - 1];
    ({
      ok: result.ok,
      verified: auditVerifyChain(),
      length: state.activity.length,
      hashesPreserved: historicalHashes.every(function(hash, i){ return state.activity[i].hash === hash; }),
      parents: anchor.mergePrevHashes,
      anchorType: anchor.type
    });
  `);
  const result = JSON.parse(JSON.stringify(merged));
  assert.equal(result.ok, true);
  assert.equal(result.verified.ok, true);
  assert.equal(result.verified.roots, 1);
  assert.equal(result.length, 4);
  assert.equal(result.hashesPreserved, true);
  assert.equal(result.parents.length, 2);
  assert.equal(result.anchorType, 'Hợp nhất nhật ký');

  const rejected = run(ctx, `
    var tampered = JSON.parse(JSON.stringify(state.activity));
    tampered[1].detail = 'HACKED';
    auditMergeChains(tampered);
  `);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.brokenIndex, 1);
}

{
  const clean = ctx.QCCore.sanitizeBackup({
    lab: {},
    tests: [],
    data: {},
    actions: [],
    activity: [{
      id: 'a1',
      seq: 1,
      ts: '2026-07-11T00:00:00.000Z',
      role: 'admin',
      hash: 'a'.repeat(64),
      prevHash: 'b'.repeat(64),
      mergePrevHashes: ['b'.repeat(64), 'c'.repeat(64), 'b'.repeat(64)],
    }],
    users: [],
  });
  assert.equal(clean.activity[0].hash, 'a'.repeat(64));
  assert.equal(clean.activity[0].prevHash, 'b'.repeat(64));
  assert.deepEqual(JSON.parse(JSON.stringify(clean.activity[0].mergePrevHashes)), ['b'.repeat(64), 'c'.repeat(64)]);
}

console.log('Audit hash chain tests passed');
