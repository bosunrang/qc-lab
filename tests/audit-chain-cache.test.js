const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

/* auditChainStatus() ghi de len auditVerifyChain() (O(n) SHA-256, xem comment trong
 * audit.js) bang cache theo chu ky auditChainSignature() = so dong + hash cuoi + neo.
 * auditVerifyChain() da co test rieng (audit-hash.test.js) nhung lop cache/nguong idle
 * bao quanh no thi chua — day la dung loai loi im lang ma cache tu kiem chung o
 * action-workflow-service.js/qc-domain.js dang bat: nguong AUDIT_AUTO_VERIFY_MAX sai,
 * hoac cache khong xa khi nhat ky doi, se khien pageAudit() hien trang thai chuoi cu
 * hoac treo giao dien tren nhat ky lon ma khong test nao bat duoc.
 */
const ctx = loadSandbox(['core.js', 'modules/state.js']);
run(ctx, `
  var currentUser = { id: 'u1', username: 'admin', name: 'Admin', role: 'admin' };
  var fb = { clientId: 'client-a' };
  var __rerenderCalls = 0;
  function userName(){ return currentUser.name; }
  function role(){ return currentUser.role; }
  function rerender(){ __rerenderCalls++; }
`);
run(ctx, require('fs').readFileSync(require('path').join(__dirname, '..', 'assets', 'modules', 'audit.js'), 'utf8'));
run(ctx, require('fs').readFileSync(require('path').join(__dirname, '..', 'assets', 'generated', 'modular-pilot.js'), 'utf8'));
run(ctx, `currentUser={id:'u1',username:'admin',name:'Admin',role:'admin'};`);

run(ctx, `
  state.activity = [];
  logAct('Đăng nhập', 'Đăng nhập thành công', 'Tài khoản');
  logAct('Thêm điểm QC', 'Ngày 01/07/2026', 'Glucose');
`);

// 1) Ket qua dau tien phai la ket qua that (khong idle), va dung.
{
  const status = run(ctx, 'auditChainStatus()');
  assert.equal(status.idle, false);
  assert.equal(status.ok, true);
  assert.equal(status.checked, 2);
}

// 2) Goi lai voi state khong doi phai la CACHE HIT — khong duoc chay lai auditVerifyChain().
{
  run(ctx, `
    var __verifyCalls = 0;
    var __realVerify = auditVerifyChain;
    auditVerifyChain = function(){ __verifyCalls++; return __realVerify(); };
  `);
  run(ctx, 'auditChainStatus()');
  assert.equal(run(ctx, '__verifyCalls'), 0, 'chu ky khong doi thi khong duoc kiem lai chuoi');
}

// 3) Them mot dong nhat ky (doi chu ky) phai lam cache tu tro nen cu va kiem lai.
{
  run(ctx, `logAct('Sửa điểm QC', 'Ngày 02/07/2026', 'Glucose');`);
  const status = run(ctx, 'auditChainStatus()');
  assert.equal(status.checked, 3);
  assert.equal(run(ctx, '__verifyCalls'), 1, 'nhat ky doi (chu ky khac) phai kich hoat kiem lai chuoi');
}

// 4) Vuot nguong AUDIT_AUTO_VERIFY_MAX ma khong force: tra ve idle, KHONG duoc kiem toan chuoi.
{
  run(ctx, `
    __verifyCalls = 0;
    for (var i = state.activity.length; i <= AUDIT_AUTO_VERIFY_MAX; i++) {
      state.activity.push({ id: 'fake' + i, seq: i, ts: '2026-07-11T00:00:00.000Z', role: 'admin', hash: '', prevHash: '' });
    }
  `);
  const idleStatus = run(ctx, 'auditChainStatus()');
  assert.equal(idleStatus.idle, true);
  assert.equal(idleStatus.total, run(ctx, 'state.activity.length'));
  assert.equal(run(ctx, '__verifyCalls'), 0, 'tren nguong thi khong duoc tu dong kiem toan chuoi');
}

// 5) auditVerifyChainNow() phai bo qua idle (force=true) VA render lai giao dien.
{
  const before = run(ctx, '__rerenderCalls');
  run(ctx, 'auditVerifyChainNow()');
  assert.equal(run(ctx, '__verifyCalls') > 0, true, 'auditVerifyChainNow() phai buoc kiem toan chuoi du vuot nguong');
  assert.equal(run(ctx, '__rerenderCalls'), before + 1, 'auditVerifyChainNow() phai goi rerender() de cap nhat man hinh');
}

console.log('Audit chain cache tests passed');
