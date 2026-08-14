'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'assets','modules','users-auth.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(route,/const users=globalThis\.userListModel\(state\.users,currentUser&&currentUser\.id\);/,'Trang người dùng phải dùng model TypeScript');
assert.match(route,/const AUDIT_PAGE_SIZES=globalThis\.activityAuditPageSizes;/,'Kích thước trang nhật ký phải dùng bridge TypeScript');
assert.match(route,/return globalThis\.activityAuditFilter\.dateKey\(a\);/,'Khóa ngày nhật ký phải dùng bridge TypeScript');
assert.match(route,/return globalThis\.activityAuditFilter\.filter\(items,auditQ,auditFrom,auditTo\);/,'Bộ lọc nhật ký phải dùng bridge TypeScript');
assert.match(route,/globalThis\.activityAuditFilterState\.withQuery\(/,'State tìm kiếm nhật ký phải dùng bridge TypeScript');
assert.match(route,/globalThis\.updateActivityAuditDateRange\(/,'Khoảng ngày nhật ký phải dùng bridge TypeScript');
assert.match(route,/pageInfo=globalThis\.activityAuditPagination\(filtered,auditPage,auditPageSize\)/,'Phân trang nhật ký phải dùng bridge TypeScript');
assert.match(route,/globalThis\.userPermissionsModalHtml\(/,'Popup quyền người dùng phải dùng bridge TypeScript');
assert.match(route,/globalThis\.resetPasswordModalHtml\(/,'Popup đặt lại mật khẩu phải dùng bridge TypeScript');
assert.match(bridge,/userListModel: typeof userListModel;/,'Model người dùng phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/activityAuditFilter: ReturnType<typeof createActivityAuditFilter>;/,'Bộ lọc nhật ký phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/activityAuditFilterState: typeof activityAuditFilterState;/,'State lọc nhật ký phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/updateActivityAuditDateRange: typeof updateActivityAuditDateRange;/,'Khoảng ngày nhật ký phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/activityAuditPagination: typeof activityAuditPagination;/,'Phân trang nhật ký phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/activityAuditPageSizes: typeof ACTIVITY_AUDIT_PAGE_SIZES;/,'Kích thước trang nhật ký phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/userPermissionsModalHtml: typeof userPermissionsModalHtml;/,'Popup quyền người dùng phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/resetPasswordModalHtml: typeof resetPasswordModalHtml;/,'Popup đặt lại mật khẩu phải là hợp đồng bridge bắt buộc');

console.log('Users page TypeScript bridge tests passed');
