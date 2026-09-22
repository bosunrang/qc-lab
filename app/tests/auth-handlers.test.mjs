// Kiem chung end-to-end module Users/Auth: khoi tao admin dau tien, dang
// nhap, tao/sua nguoi dung, dat lai mat khau, tu doi mat khau, va cac gate
// bao ve (khong tu khoa/ha quyen admin active cuoi cung, chi admin duoc CRUD).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createAuthHandlers } = require('../../app-dist/main/ipc/auth-handlers.js');
const { verifyAuditChain } = require('../../app-dist/main/domain/audit-chain.js');

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

// 11) Tu sua quyen CHINH MINH bi chan (Giai doan D3.1) — app cu khong co
// duong nao doi vai tro cua chinh minh: dong cua ban chi co "(ban)" +
// "Doi mat khau", va applyUserPerms() tu choi thang. Doi TEN chinh minh thi
// van duoc (khong phai sua quyen).
const secondAdmin = auth.createUser({ data: { username: 'admin2', name: 'Quan tri vien 2', role: 'admin', password: 'admin2-pass-123' } }, adminActor);
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

// 11b) Admin KHAC ha quyen admin dau tien: duoc phep vi con admin thu 2 active
const demoteOk = auth.updateUser({ id: adminActor.userId, data: { name: 'Quan tri vien', role: 'technician', active: true } }, secondAdminActor);
assert.equal(demoteOk.ok, true, 'con admin thu 2 active thi duoc ha quyen admin dau tien');

// 12) Admin (thu 2) dat lai mat khau cho ky thuat vien
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

// ── Giai doan D3.1: initials + pagePerms + xoa tai khoan ─────────────────

// 15b) Ma viet tat LUON lay tu chu cai dau cua ho ten, khong tin gia tri client gui len.
const withPerms = auth.createUser({
  data: { username: 'kts2', name: 'Nguyen Thi Lan', initials: 'XYZ', role: 'technician', password: 'mat-khau-kts2-1', pagePerms: ['dash', 'entry'] },
}, secondAdminActor);
assert.equal(withPerms.ok, true);
assert.equal(withPerms.data.initials, 'NTL', 'ma viet tat phai lay tu ho ten, khong dung gia tri client gui len');
assert.deepEqual(withPerms.data.pagePerms, ['dash', 'entry']);

// 15c) pagePerms LUON bi thu hep theo vai tro o phia main — khong tin
// danh sach renderer gui len (day la cong bao mat, khong phai tien ich UI)
const overreach = auth.createUser({
  data: { username: 'kts3', name: 'Tran Van B', role: 'technician', password: 'mat-khau-kts3-1', pagePerms: ['dash', 'manage', 'users'] },
}, secondAdminActor);
assert.equal(overreach.ok, true);
assert.deepEqual(overreach.data.pagePerms, ['dash'], 'the admin-only bi loai bo, khong duoc luu');

// 15d) Chon rong bi chan — mang rong se khoa tai khoan khoi moi trang
const emptyPerms = auth.createUser({
  data: { username: 'kts4', name: 'Le Thi C', role: 'viewer', password: 'mat-khau-kts4-1', pagePerms: ['manage'] },
}, secondAdminActor);
assert.equal(emptyPerms.ok, false);
assert.equal(emptyPerms.error.code, 'missing-page-perms');

// 15e) KHONG gui pagePerms = mac dinh du the cua vai tro (khong phai rong)
const defaultPerms = auth.createUser({
  data: { username: 'kts5', name: 'Pham Van D', role: 'viewer', password: 'mat-khau-kts5-1' },
}, secondAdminActor);
assert.equal(defaultPerms.ok, true);
assert.deepEqual(defaultPerms.data.pagePerms, ['dash', 'entry', 'westgard', 'sigma', 'reagent', 'report']);

// 15f) Sua the duoc phep dung; thieu field = GIU NGUYEN, khong phai xoa
const narrowed = auth.updateUser({ id: withPerms.data.id, data: { name: 'Nguyen Thi Lan', role: 'technician', active: true, pagePerms: ['report'] } }, secondAdminActor);
assert.equal(narrowed.ok, true);
assert.deepEqual(narrowed.data.pagePerms, ['report']);
const toggledOnly = auth.updateUser({ id: withPerms.data.id, data: { name: 'Nguyen Thi Lan', role: 'technician', active: false } }, secondAdminActor);
assert.equal(toggledOnly.ok, true);
assert.deepEqual(toggledOnly.data.pagePerms, ['report'], 'nut Khoa/Mo khoa khong duoc xoa quyen theo trang');
assert.equal(toggledOnly.data.initials, 'NTL', 'cung khong duoc xoa ma viet tat');

// 15g) Xoa tai khoan: chi admin, khong tu xoa, khong xoa admin active cuoi
const viewerActor = { userId: defaultPerms.data.id, username: 'kts5', name: 'Pham Van D', role: 'viewer', clientId: 'test-client' };
const denyDelete = auth.deleteUser({ id: withPerms.data.id }, viewerActor);
assert.equal(denyDelete.ok, false);
assert.equal(denyDelete.error.code, 'forbidden');
const selfDelete = auth.deleteUser({ id: secondAdminActor.userId }, secondAdminActor);
assert.equal(selfDelete.ok, false);
assert.equal(selfDelete.error.code, 'self-delete', 'admin duy nhat con lai cung la chinh minh — chan o cong tu-xoa truoc');
// Cho chinh kts2 lam 1 thao tac de co dong audit DO HO dung ten, roi moi xoa
const kts2Actor = { userId: withPerms.data.id, username: 'kts2', name: 'Nguyen Thi Lan', role: 'technician', clientId: 'test-client' };
assert.equal(auth.changeOwnPassword({ data: { oldPassword: 'mat-khau-kts2-1', newPassword: 'mat-khau-kts2-2' } }, kts2Actor).ok, true);

const deleteOk = auth.deleteUser({ id: withPerms.data.id }, secondAdminActor);
assert.equal(deleteOk.ok, true);
assert.equal(auth.listUsers(secondAdminActor).data.some(u => u.id === withPerms.data.id), false, 'da xoa that khoi bang users');
// Nhat ky hoat dong cua nguoi da xoa VAN CON: bang `activity` luu username/
// user_id dang chuoi phang, khong khoa ngoai toi `users` — day la ly do xoa
// that (khong soft-delete) van an toan cho truy xuat nguoc.
const activityRows = require('../../app-dist/main/ipc/config-handlers.js').createConfigHandlers(db).listActivity(1000);
assert.ok(activityRows.some(row => row.username === 'kts2'), 'thao tac DO kts2 thuc hien phai con trong nhat ky');
assert.ok(activityRows.some(row => row.target === 'kts2' && row.type === 'Xoá người dùng'), 'phai co dong audit ghi lai viec xoa');

// 15h) Doi/xoa anh dai dien — chi tu phuc vu (actor.userId), khong nhan id
// nguoi khac. Validate chan chuoi khong phai data URL anh.
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

// 16) Chuoi audit hash-chain van hop le sau tung ay thao tac
const chronological = require('../../app-dist/main/ipc/config-handlers.js')
  .createConfigHandlers(db).listActivity(1000).slice().reverse();
const verify = verifyAuditChain(chronological, '');
assert.equal(verify.ok, true, 'chuoi audit phai hop le: ' + JSON.stringify(verify));

console.log('app auth-handlers end-to-end tests passed');
