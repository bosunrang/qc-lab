// Oracle cho bảng TRANG × VAI TRÒ + quyền theo từng trang
// (`main/domain/page-roles.ts` — nguồn dùng chung cho cả 2 tiến trình, file
// đó KHÔNG import gì nên test được thẳng trên .ts qua ESM).
// Bảng nằm ở main vì main cần chính bảng này để thu hẹp `pagePerms` phía
// server (không tin danh sách renderer gửi); `renderer/lib/permissions.ts`
// chỉ xuất lại.
import assert from 'node:assert/strict';
import {
  PAGE_DEFS, ROLE_LIST, roleOf, canWriteRole, isAdminRole, pageById, rolePageIds,
  selectUserPermissions, userPageIds, canAccessPage, canUserAccessPage, firstAccessPath, roleLabel,
} from '../main/domain/page-roles.ts';

// ── 1) Đúng 11 trang, đúng thứ tự/id/nhãn ─────────────────────────────────
assert.deepEqual(
  PAGE_DEFS.map((p) => p.id),
  ['dash', 'entry', 'westgard', 'sigma', 'reagent', 'actions', 'report', 'manage', 'users', 'audit', 'settings'],
);
// Nhãn hiện ở 2 nơi nhìn thấy được (sidebar + lưới "Thẻ được phép dùng") nên
// khoá luôn từng chuỗi — kể cả "Cài đặt & Đám mây".
assert.deepEqual(PAGE_DEFS.map((p) => p.label), [
  'Tổng quan', 'Nhập QC & Biểu đồ', 'Phân tích Westgard', 'Six Sigma & Sai số', 'So sánh hóa chất',
  'Khắc phục sự cố', 'Báo cáo & Biểu mẫu', 'Cấu hình chung', 'Người dùng', 'Nhật ký hoạt động', 'Cài đặt & Đám mây',
]);
assert.deepEqual([...ROLE_LIST], ['admin', 'technician', 'viewer']);

// ── 2) Vai trò lạ/rỗng/null đều là 'viewer' — không mặc định mở ───────────
for (const bad of [null, undefined, '', 'ADMIN', 'superuser']) {
  assert.equal(roleOf(bad), 'viewer', `roleOf(${JSON.stringify(bad)}) phải là viewer`);
  assert.equal(canWriteRole(bad), false);
  assert.equal(isAdminRole(bad), false);
}
assert.equal(canWriteRole('admin'), true);
assert.equal(canWriteRole('technician'), true);
assert.equal(canWriteRole('viewer'), false);
assert.equal(isAdminRole('admin'), true);
assert.equal(isAdminRole('technician'), false);

// ── 3) rolePageIds: trần trên theo vai trò ───────────────────────────────
assert.equal(rolePageIds('admin').length, 11, 'admin thấy đủ 11 trang');
assert.deepEqual(rolePageIds('technician'), ['dash', 'entry', 'westgard', 'sigma', 'reagent', 'actions', 'report']);
assert.deepEqual(rolePageIds('viewer'), ['dash', 'entry', 'westgard', 'sigma', 'reagent', 'report']);
assert.equal(rolePageIds('viewer').includes('actions'), false, 'chỉ-xem không thấy Khắc phục sự cố');

for (const id of ['manage', 'users', 'audit', 'settings']) {
  assert.equal(canAccessPage(id, 'admin'), true);
  assert.equal(canAccessPage(id, 'technician'), false);
  assert.equal(canAccessPage(id, 'viewer'), false);
}
assert.equal(canAccessPage('khong-ton-tai', 'admin'), false, 'trang không tồn tại luôn bị từ chối');
assert.equal(pageById('khong-ton-tai'), undefined);

// ── 5) selectUserPermissions: chỉ giữ id vừa chọn VÀ được phép, bỏ trùng ─
// Đây là cổng chặn "renderer gửi lên id trang mà vai trò đó không được xem".
assert.deepEqual(selectUserPermissions(['dash', 'manage', 'entry'], rolePageIds('technician')), ['dash', 'entry']);
assert.deepEqual(selectUserPermissions(['dash', 'dash', 'entry'], rolePageIds('technician')), ['dash', 'entry']);
assert.deepEqual(selectUserPermissions(['manage', 'users'], rolePageIds('viewer')), [], 'chọn toàn trang không được phép ra rỗng');
assert.deepEqual(selectUserPermissions('khong-phai-mang', rolePageIds('admin')), []);
assert.deepEqual(selectUserPermissions(['dash'], 'khong-phai-mang'), []);

// ── 6) userPageIds: pagePerms thu hẹp, không bao giờ mở rộng ─────────────
// null/không có = KHÔNG thu hẹp → đủ trần của vai trò.
assert.deepEqual(userPageIds({ role: 'technician' }), rolePageIds('technician'));
assert.deepEqual(userPageIds({ role: 'technician', pagePerms: null }), rolePageIds('technician'));
// Thu hẹp thật.
assert.deepEqual(userPageIds({ role: 'technician', pagePerms: ['dash', 'entry'] }), ['dash', 'entry']);
// KHÔNG mở rộng vượt vai trò: KTV kèm pagePerms có 'manage' vẫn không được.
assert.deepEqual(userPageIds({ role: 'technician', pagePerms: ['dash', 'manage'] }), ['dash']);
assert.deepEqual(userPageIds({ role: 'viewer', pagePerms: ['manage', 'users'] }), ['dash']);
// Không có user = hẹp nhất.
assert.deepEqual(userPageIds(null), rolePageIds('viewer'));

// ── 7) canUserAccessPage: có xét pagePerms (khác canAccessPage) ──────────
const narrowed = { role: 'technician', pagePerms: ['dash', 'report'] };
assert.equal(canAccessPage('entry', narrowed.role), true, 'vai trò KTV vẫn cho phép trang Nhập QC');
assert.equal(canUserAccessPage('entry', narrowed), false, 'nhưng tài khoản này đã bị thu hẹp, không vào được');
assert.equal(canUserAccessPage('report', narrowed), true);
assert.equal(canUserAccessPage('manage', { role: 'admin' }), true);

// ── 8) firstAccessPath: đích điều hướng khi mở route không có quyền ──────
assert.equal(firstAccessPath({ role: 'admin' }), '/dashboard');
assert.equal(firstAccessPath({ role: 'viewer' }), '/dashboard');
assert.equal(firstAccessPath(null), '/dashboard');
// Tài khoản bị thu hẹp, không còn Tổng quan → về trang đầu tiên CÒN quyền.
assert.equal(firstAccessPath({ role: 'technician', pagePerms: ['report'] }), '/report');
assert.equal(firstAccessPath({ role: 'admin', pagePerms: ['settings', 'audit'] }), '/audit', 'theo thứ tự bảng, không theo thứ tự pagePerms');

// ── 9) Nhãn vai trò hiển thị (roleLabel) ────────────────────────────────────
assert.equal(roleLabel('admin'), 'Quản trị');
assert.equal(roleLabel('technician'), 'KTV');
assert.equal(roleLabel('viewer'), 'Chỉ xem');
assert.equal(roleLabel(null), 'Chỉ xem');

console.log('app page-roles oracle tests passed');


