'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

// users-auth.js đã retire vào src/compat/modular-pilot.global.ts (2026-08-20, Pha G nhóm C lát 2).
assert.match(bridge,/const users\s*=\s*root\.userListModel\(state\.users,\s*currentUser\s*&&\s*currentUser\.id\)/,'Trang người dùng phải dùng model TypeScript');
assert.match(bridge,/root\.AUDIT_PAGE_SIZES\s*=\s*ACTIVITY_AUDIT_PAGE_SIZES/,'Kích thước trang nhật ký phải dùng bridge TypeScript');
assert.match(bridge,/root\.auditDateKey\s*=\s*activity\s*=>\s*root\.activityAuditFilter\.dateKey\(activity\)/,'Khóa ngày nhật ký phải dùng bridge TypeScript');
assert.match(bridge,/root\.auditFilteredActivities\s*=\s*\(items\s*=\s*state\.activity\s*\|\|\s*\[\]\)\s*=>\s*root\.activityAuditFilter\.filter\(items,\s*auditQ,\s*auditFrom,\s*auditTo\)/,'Bộ lọc nhật ký phải dùng bridge TypeScript');
assert.match(bridge,/root\.activityAuditFilterState\.withQuery\(/,'State tìm kiếm nhật ký phải dùng bridge TypeScript');
assert.match(bridge,/root\.updateActivityAuditDateRange\(/,'Khoảng ngày nhật ký phải dùng bridge TypeScript');
assert.match(bridge,/pageInfo\s*=\s*root\.activityAuditPagination\(filtered,\s*auditPage,\s*auditPageSize\)/,'Phân trang nhật ký phải dùng bridge TypeScript');
assert.match(bridge,/root\.userPermissionsModalHtml\(/,'Popup quyền người dùng phải dùng bridge TypeScript');
assert.match(bridge,/root\.resetPasswordModalHtml\(/,'Popup đặt lại mật khẩu phải dùng bridge TypeScript');
assert.match(bridge,/userListModel: typeof userListModel;/,'Model người dùng phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/activityAuditFilter: ReturnType<typeof createActivityAuditFilter>;/,'Bộ lọc nhật ký phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/activityAuditFilterState: typeof activityAuditFilterState;/,'State lọc nhật ký phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/updateActivityAuditDateRange: typeof updateActivityAuditDateRange;/,'Khoảng ngày nhật ký phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/activityAuditPagination: typeof activityAuditPagination;/,'Phân trang nhật ký phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/activityAuditPageSizes: typeof ACTIVITY_AUDIT_PAGE_SIZES;/,'Kích thước trang nhật ký phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/userPermissionsModalHtml: typeof userPermissionsModalHtml;/,'Popup quyền người dùng phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/resetPasswordModalHtml: typeof resetPasswordModalHtml;/,'Popup đặt lại mật khẩu phải là hợp đồng bridge bắt buộc');

console.log('Users page TypeScript bridge tests passed');
