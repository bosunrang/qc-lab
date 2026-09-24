// Cầu nối quyền cho renderer — nội dung THẬT nằm ở
// `main/domain/page-roles.ts` (nguồn duy nhất cho cả 2 tiến trình, xem ghi
// chú đầu file đó). File này chỉ re-export để renderer không phải viết
// đường dẫn `../../main/domain/...` ở chục chỗ, và để chỗ đặt tên quen
// thuộc phía renderer không đổi khi bảng gốc di chuyển.
//
// Nhắc lại cho rõ: đây là lớp HIỂN THỊ. Chặn thật nằm ở main
// (`requireWrite`/`requireAdmin` trong `main/ipc/shared.ts`, thu hẹp
export {
  PAGE_DEFS, ROLE_LIST, roleOf, pageById, rolePageIds, selectUserPermissions, userPageIds,
  canAccessPage, canUserAccessPage, firstAccessPath, roleLabel,
  canWriteRole as canWrite, isAdminRole as isAdmin,
  type Role, type PageDef,
} from '../../main/domain/page-roles';


