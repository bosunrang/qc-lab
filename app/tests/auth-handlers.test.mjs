import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createAuthHandlers } = require('../../app-dist/main/ipc/auth-handlers.js');
const { verifyAuditChain } = require('../../app-dist/main/domain/audit-chain.js');

const db = openDatabase(':memory:');
const auth = createAuthHandlers(db);

assert.equal(auth.hasAnyUsers(), false);

const weak = await auth.bootstrapAdmin({ data: { username: 'admin', name: 'Quan tri vien', password: '123' } });
assert.equal(weak.ok, false);
assert.equal(weak.error.code, 'weak-password');

const boot = await auth.bootstrapAdmin({ data: { username: 'admin', name: 'Quan tri vien', password: 'admin12345' } });
assert.equal(boot.ok, true);
assert.equal(boot.data.role, 'admin');
assert.equal(boot.data.mustChangePassword, false);
assert.equal(auth.hasAnyUsers(), true);

const bootAgain = await auth.bootstrapAdmin({ data: { username: 'admin2', name: 'X', password: 'admin12345' } });
assert.equal(bootAgain.ok, false);
assert.equal(bootAgain.error.code, 'already-bootstrapped');

const badLogin = await auth.login({ data: { username: 'admin', password: 'sai-mat-khau' } });
assert.equal(badLogin.ok, false);
assert.equal(badLogin.error.code, 'invalid-credentials');

const login = await auth.login({ data: { username: 'admin', password: 'admin12345' } });
assert.equal(login.ok, true);
const adminActor = { userId: login.data.id, username: login.data.username, name: login.data.name, role: login.data.role, clientId: 'test-client' };

const technicianActor = { userId: 'kts1', username: 'kts1', name: 'KTV', role: 'technician', clientId: 'test-client' };
const forbiddenList = auth.listUsers(technicianActor);
assert.equal(forbiddenList.ok, false);
assert.equal(forbiddenList.error.code, 'forbidden');

const created = await auth.createUser({ data: { username: 'kts1', name: 'Nguyen Van A', role: 'technician', password: 'ktv-pass-123' } }, adminActor);
assert.equal(created.ok, true);
assert.equal(created.data.mustChangePassword, true, 'tai khoan admin tao ho phai bi buoc doi mat khau lan dau');

const dup = await auth.createUser({ data: { username: 'KTS1', name: 'Trung ten', role: 'technician', password: 'ktv-pass-123' } }, adminActor);
assert.equal(dup.ok, false);
assert.equal(dup.error.code, 'duplicate-username');

const selfDemote = auth.updateUser({ id: adminActor.userId, data: { name: 'Quan tri vien', role: 'technician', active: true } }, adminActor);
assert.equal(selfDemote.ok, false);
assert.equal(selfDemote.error.code, 'last-admin');
const selfLock = auth.updateUser({ id: adminActor.userId, data: { name: 'Quan tri vien', role: 'admin', active: false } }, adminActor);
assert.equal(selfLock.ok, false);
assert.equal(selfLock.error.code, 'last-admin');

// 11) Tu sua quyen CHINH MINH bi chan (Giai doan D3.1) — hệ thống khong co
const secondAdmin = await auth.createUser({ data: { username: 'admin2', name: 'Quan tri vien 2', role: 'admin', password: 'admin2-pass-123' } }, adminActor);
assert.equal(secondAdmin.ok, true);
const secondAdminActor = { userId: secondAdmin.data.id, username: secondAdmin.data.username, name: secondAdmin.data.name, role: 'admin', clientId: 'test-client' };

const selfPerms = auth.updateUser({ id: adminActor.userId, data: { name: 'Quan tri vien', role: 'technician', active: true } }, adminActor);
assert.equal(selfPerms.ok, false, 'khong the tu ha quyen chinh minh du con admin khac');
assert.equal(selfPerms.error.code, 'self-perms');
const selfPagePerms = auth.updateUser({ id: adminActor.userId, data: { name: 'Quan tri vien', role: 'admin', active: true, pagePerms: ['dash'] } }, adminActor);
assert.equal(selfPagePerms.ok, false, 'khong the tu sua the duoc phep dung cua chinh minh');
assert.equal(selfPagePerms.error.code, 'self-perms');
const selfRename = auth.updateUser({ id: adminActor.userId, data: { name: 'Quan tri vien (doi ten)', role: 'admin', active: true } }, adminActor);
assert.equal(selfRename.ok, true, 'doi ten chinh minh khong phai sua quyen, phai duoc phep');

const demoteOk = auth.updateUser({ id: adminActor.userId, data: { name: 'Quan tri vien', role: 'technician', active: true } }, secondAdminActor);
assert.equal(demoteOk.ok, true, 'con admin thu 2 active thi duoc ha quyen admin dau tien');

const reset = await auth.resetPassword({ id: created.data.id, data: { newPassword: 'mat-khau-moi-123' } }, secondAdminActor);
assert.equal(reset.ok, true);
const loginAfterReset = await auth.login({ data: { username: 'kts1', password: 'mat-khau-moi-123' } });
assert.equal(loginAfterReset.ok, true);
assert.equal(loginAfterReset.data.mustChangePassword, true);

const kts1Actor = { userId: created.data.id, username: 'kts1', name: 'Nguyen Van A', role: 'technician', clientId: 'test-client' };
const wrongOld = await auth.changeOwnPassword({ data: { oldPassword: 'sai', newPassword: 'mat-khau-moi-456' } }, kts1Actor);
assert.equal(wrongOld.ok, false);
assert.equal(wrongOld.error.code, 'wrong-password');

const changeOwn = await auth.changeOwnPassword({ data: { oldPassword: 'mat-khau-moi-123', newPassword: 'mat-khau-moi-456' } }, kts1Actor);
assert.equal(changeOwn.ok, true);
const loginAfterOwnChange = await auth.login({ data: { username: 'kts1', password: 'mat-khau-moi-456' } });
assert.equal(loginAfterOwnChange.ok, true);
assert.equal(loginAfterOwnChange.data.mustChangePassword, false);

const lockKts1 = auth.updateUser({ id: created.data.id, data: { name: 'Nguyen Van A', role: 'technician', active: false } }, secondAdminActor);
assert.equal(lockKts1.ok, true);
const lockedLogin = await auth.login({ data: { username: 'kts1', password: 'mat-khau-moi-456' } });
assert.equal(lockedLogin.ok, false);
assert.equal(lockedLogin.error.code, 'inactive');


const withPerms = await auth.createUser({
  data: { username: 'kts2', name: 'Nguyen Thi Lan', initials: 'XYZ', role: 'technician', password: 'mat-khau-kts2-1', pagePerms: ['dash', 'entry'] },
}, secondAdminActor);
assert.equal(withPerms.ok, true);
assert.equal(withPerms.data.initials, 'NTL', 'ma viet tat phai lay tu ho ten, khong dung gia tri client gui len');
assert.deepEqual(withPerms.data.pagePerms, ['dash', 'entry']);

const overreach = await auth.createUser({
  data: { username: 'kts3', name: 'Tran Van B', role: 'technician', password: 'mat-khau-kts3-1', pagePerms: ['dash', 'manage', 'users'] },
}, secondAdminActor);
assert.equal(overreach.ok, true);
assert.deepEqual(overreach.data.pagePerms, ['dash'], 'the admin-only bi loai bo, khong duoc luu');

const emptyPerms = await auth.createUser({
  data: { username: 'kts4', name: 'Le Thi C', role: 'viewer', password: 'mat-khau-kts4-1', pagePerms: ['manage'] },
}, secondAdminActor);
assert.equal(emptyPerms.ok, false);
assert.equal(emptyPerms.error.code, 'missing-page-perms');

const defaultPerms = await auth.createUser({
  data: { username: 'kts5', name: 'Pham Van D', role: 'viewer', password: 'mat-khau-kts5-1' },
}, secondAdminActor);
assert.equal(defaultPerms.ok, true);
assert.deepEqual(defaultPerms.data.pagePerms, ['dash', 'entry', 'westgard', 'sigma', 'reagent', 'report']);

const narrowed = auth.updateUser({ id: withPerms.data.id, data: { name: 'Nguyen Thi Lan', role: 'technician', active: true, pagePerms: ['report'] } }, secondAdminActor);
assert.equal(narrowed.ok, true);
assert.deepEqual(narrowed.data.pagePerms, ['report']);
const toggledOnly = auth.updateUser({ id: withPerms.data.id, data: { name: 'Nguyen Thi Lan', role: 'technician', active: false } }, secondAdminActor);
assert.equal(toggledOnly.ok, true);
assert.deepEqual(toggledOnly.data.pagePerms, ['report'], 'nut Khoa/Mo khoa khong duoc xoa quyen theo trang');
assert.equal(toggledOnly.data.initials, 'NTL', 'cung khong duoc xoa ma viet tat');

const viewerActor = { userId: defaultPerms.data.id, username: 'kts5', name: 'Pham Van D', role: 'viewer', clientId: 'test-client' };
const denyDelete = auth.deleteUser({ id: withPerms.data.id }, viewerActor);
assert.equal(denyDelete.ok, false);
assert.equal(denyDelete.error.code, 'forbidden');
const selfDelete = auth.deleteUser({ id: secondAdminActor.userId }, secondAdminActor);
assert.equal(selfDelete.ok, false);
assert.equal(selfDelete.error.code, 'self-delete', 'admin duy nhat con lai cung la chinh minh — chan o cong tu-xoa truoc');
const kts2Actor = { userId: withPerms.data.id, username: 'kts2', name: 'Nguyen Thi Lan', role: 'technician', clientId: 'test-client' };
assert.equal((await auth.changeOwnPassword({ data: { oldPassword: 'mat-khau-kts2-1', newPassword: 'mat-khau-kts2-2' } }, kts2Actor)).ok, true);

const deleteOk = auth.deleteUser({ id: withPerms.data.id }, secondAdminActor);
assert.equal(deleteOk.ok, true);
assert.equal(auth.listUsers(secondAdminActor).data.some(u => u.id === withPerms.data.id), false, 'da xoa that khoi bang users');
const activityRows = require('../../app-dist/main/ipc/config-handlers.js').createConfigHandlers(db).listActivity(1000);
assert.ok(activityRows.some(row => row.username === 'kts2'), 'thao tac DO kts2 thuc hien phai con trong nhat ky');
assert.ok(activityRows.some(row => row.target === 'kts2' && row.type === 'Xoá người dùng'), 'phai co dong audit ghi lai viec xoa');

const badAvatar = auth.setAvatar({ data: { dataUrl: 'not-an-image' } }, secondAdminActor);
assert.equal(badAvatar.ok, false);
assert.equal(badAvatar.error.code, 'invalid-image');
const fakePng = 'data:image/png;base64,iVBORw0KGgo=';
const setOk = auth.setAvatar({ data: { dataUrl: fakePng } }, secondAdminActor);
assert.equal(setOk.ok, true, JSON.stringify(setOk));
assert.equal(setOk.data.avatar, fakePng);
assert.equal(auth.getUser(secondAdminActor.userId).avatar, fakePng, 'phai doc lai dung anh vua luu');
const clearOk = auth.clearAvatar(secondAdminActor);
assert.equal(clearOk.ok, true);
assert.equal(auth.getUser(secondAdminActor.userId).avatar, '', 'xoa anh phai tro ve rong, khong con anh cu');

const chronological = require('../../app-dist/main/ipc/config-handlers.js')
  .createConfigHandlers(db).listActivity(1000).slice().reverse();
const verify = verifyAuditChain(chronological, '');
assert.equal(verify.ok, true, 'chuoi audit phai hop le: ' + JSON.stringify(verify));

console.log('app auth-handlers end-to-end tests passed');


