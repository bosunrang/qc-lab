// Kiem chung end-to-end module Users/Auth: khoi tao admin dau tien, dang
// nhap, tao/sua nguoi dung, dat lai mat khau, tu doi mat khau, va cac gate
// bao ve (khong tu khoa/ha quyen admin active cuoi cung, chi admin duoc CRUD).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createAuthHandlers } = require('../../app-v2-dist/main/ipc/auth-handlers.js');
const { verifyAuditChain } = require('../../app-v2-dist/main/domain/audit-chain.js');

const db = openDatabase(':memory:');
const auth = createAuthHandlers(db);

// 1) Chua co user nao
assert.equal(auth.hasAnyUsers(), false);

// 2) bootstrapAdmin tu choi mat khau yeu
const weak = auth.bootstrapAdmin({ data: { username: 'admin', name: 'Quan tri vien', password: '123' } });
assert.equal(weak.ok, false);
assert.equal(weak.error.code, 'weak-password');

// 3) bootstrapAdmin thanh cong tao admin dau tien
const boot = auth.bootstrapAdmin({ data: { username: 'admin', name: 'Quan tri vien', password: 'admin12345' } });
assert.equal(boot.ok, true);
assert.equal(boot.data.role, 'admin');
assert.equal(boot.data.mustChangePassword, false);
assert.equal(auth.hasAnyUsers(), true);

// 4) bootstrapAdmin lan 2 phai bi chan
const bootAgain = auth.bootstrapAdmin({ data: { username: 'admin2', name: 'X', password: 'admin12345' } });
assert.equal(bootAgain.ok, false);
assert.equal(bootAgain.error.code, 'already-bootstrapped');

// 5) Dang nhap sai mat khau
const badLogin = auth.login({ data: { username: 'admin', password: 'sai-mat-khau' } });
assert.equal(badLogin.ok, false);
assert.equal(badLogin.error.code, 'invalid-credentials');

// 6) Dang nhap dung
const login = auth.login({ data: { username: 'admin', password: 'admin12345' } });
assert.equal(login.ok, true);
const adminActor = { userId: login.data.id, username: login.data.username, name: login.data.name, role: login.data.role, clientId: 'test-client' };

// 7) Nguoi khong phai admin khong duoc CRUD user
const technicianActor = { userId: 'kts1', username: 'kts1', name: 'KTV', role: 'technician', clientId: 'test-client' };
const forbiddenList = auth.listUsers(technicianActor);
assert.equal(forbiddenList.ok, false);
assert.equal(forbiddenList.error.code, 'forbidden');

// 8) Admin tao them 1 tai khoan ky thuat vien
const created = auth.createUser({ data: { username: 'kts1', name: 'Nguyen Van A', role: 'technician', password: 'ktv-pass-123' } }, adminActor);
assert.equal(created.ok, true);
assert.equal(created.data.mustChangePassword, true, 'tai khoan admin tao ho phai bi buoc doi mat khau lan dau');

// 9) Trung ten dang nhap phai bi chan
const dup = auth.createUser({ data: { username: 'KTS1', name: 'Trung ten', role: 'technician', password: 'ktv-pass-123' } }, adminActor);
assert.equal(dup.ok, false);
assert.equal(dup.error.code, 'duplicate-username');

// 10) Khong the tu ha quyen/khoa admin active CUOI CUNG
const selfDemote = auth.updateUser({ id: adminActor.userId, data: { name: 'Quan tri vien', role: 'technician', active: true } }, adminActor);
assert.equal(selfDemote.ok, false);
assert.equal(selfDemote.error.code, 'last-admin');
const selfLock = auth.updateUser({ id: adminActor.userId, data: { name: 'Quan tri vien', role: 'admin', active: false } }, adminActor);
assert.equal(selfLock.ok, false);
assert.equal(selfLock.error.code, 'last-admin');

// 11) Them admin thu 2 roi ha quyen admin dau tien phai duoc phep
const secondAdmin = auth.createUser({ data: { username: 'admin2', name: 'Quan tri vien 2', role: 'admin', password: 'admin2-pass-123' } }, adminActor);
assert.equal(secondAdmin.ok, true);
const demoteOk = auth.updateUser({ id: adminActor.userId, data: { name: 'Quan tri vien', role: 'technician', active: true } }, adminActor);
assert.equal(demoteOk.ok, true, 'con admin thu 2 active thi duoc ha quyen admin dau tien');

// 12) Admin (thu 2) dat lai mat khau cho ky thuat vien
const secondAdminActor = { userId: secondAdmin.data.id, username: secondAdmin.data.username, name: secondAdmin.data.name, role: 'admin', clientId: 'test-client' };
const reset = auth.resetPassword({ id: created.data.id, data: { newPassword: 'mat-khau-moi-123' } }, secondAdminActor);
assert.equal(reset.ok, true);
const loginAfterReset = auth.login({ data: { username: 'kts1', password: 'mat-khau-moi-123' } });
assert.equal(loginAfterReset.ok, true);
assert.equal(loginAfterReset.data.mustChangePassword, true);

// 13) Tu doi mat khau: sai mat khau cu phai bi chan
const kts1Actor = { userId: created.data.id, username: 'kts1', name: 'Nguyen Van A', role: 'technician', clientId: 'test-client' };
const wrongOld = auth.changeOwnPassword({ data: { oldPassword: 'sai', newPassword: 'mat-khau-moi-456' } }, kts1Actor);
assert.equal(wrongOld.ok, false);
assert.equal(wrongOld.error.code, 'wrong-password');

// 14) Tu doi mat khau dung — tat co mustChangePassword
const changeOwn = auth.changeOwnPassword({ data: { oldPassword: 'mat-khau-moi-123', newPassword: 'mat-khau-moi-456' } }, kts1Actor);
assert.equal(changeOwn.ok, true);
const loginAfterOwnChange = auth.login({ data: { username: 'kts1', password: 'mat-khau-moi-456' } });
assert.equal(loginAfterOwnChange.ok, true);
assert.equal(loginAfterOwnChange.data.mustChangePassword, false);

// 15) Tai khoan bi khoa (active=0) khong dang nhap duoc
const lockKts1 = auth.updateUser({ id: created.data.id, data: { name: 'Nguyen Van A', role: 'technician', active: false } }, secondAdminActor);
assert.equal(lockKts1.ok, true);
const lockedLogin = auth.login({ data: { username: 'kts1', password: 'mat-khau-moi-456' } });
assert.equal(lockedLogin.ok, false);
assert.equal(lockedLogin.error.code, 'inactive');

// 16) Chuoi audit hash-chain van hop le sau tung ay thao tac
const chronological = require('../../app-v2-dist/main/ipc/config-handlers.js')
  .createConfigHandlers(db).listActivity(1000).slice().reverse();
const verify = verifyAuditChain(chronological, '');
assert.equal(verify.ok, true, 'chuoi audit phai hop le: ' + JSON.stringify(verify));

console.log('app-v2 auth-handlers end-to-end tests passed');
