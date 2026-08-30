import { closeModal } from '../dialogs/modal-store';
import { roleSelectOptionsHtml, userPermChecksHtml, syncUserPermChecks } from '../bridge/usersBridge';
import { getKernel } from '../state/kernel';

export type UserPermissionsModel = { userId: string; userName: string; username: string; role: string; pagePerms: string[] };

/* Modal thứ năm của Giai đoạn 3 chuyển sang 'react' — Users' "Sửa quyền"
   (openUserPerms). Khác các modal trước: LƯỚI CHECKBOX vẫn giữ nguyên
   dangerouslySetInnerHTML — cùng cách UsersPage.tsx's "Thêm người dùng" form
   đã làm từ Giai đoạn 2 (RoleSelect ở đó cũng dùng data-action-on="change"
   → onChange gọi syncUserPermChecks() trực tiếp). syncUserPermChecks() tự
   query #editUserPerms rồi bật/tắt disabled + bỏ check ô không hợp lệ NGAY
   TRÊN DOM, không qua state React — an toàn với dangerouslySetInnerHTML vì
   React không theo dõi bên trong node đó. applyUserPerms() (không đổi) cũng
   đọc DOM #editUserRole/#editUserPerms trực tiếp lúc submit. */
export function UserPermissionsModal({ userId, userName, username, role, pagePerms }: UserPermissionsModel) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h">
        <h3 id="modalTitle">Sửa quyền người dùng</h3>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => closeModal()}>✕</button>
      </div>
      <div className="modal-b">
        <div className="hint"><b>{userName}</b> · @{username}</div>
        <label>Vai trò</label>
        <select id="editUserRole" aria-label="Vai trò" defaultValue={role} onChange={e => syncUserPermChecks('editUserPerms', e.target.value)} dangerouslySetInnerHTML={{ __html: roleSelectOptionsHtml(role) }} />
        <label className="flow-section">Thẻ được phép dùng</label>
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: userPermChecksHtml(pagePerms, 'editUserPerms', role) }} />
        <div className="hint flow-control">Vai trò quyết định quyền sửa/quản trị; danh sách thẻ chỉ quyết định người dùng thấy và mở được màn hình nào.</div>
      </div>
      <div className="modal-f">
        <button type="button" className="btn ghost" onClick={() => closeModal()}>Hủy</button>
        <button type="button" className="btn teal" onClick={() => getKernel().users.applyUserPerms(userId)}>Lưu quyền</button>
      </div>
    </div>
  );
}
