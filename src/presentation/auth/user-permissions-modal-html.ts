export type UserPermissionsModalInput = { userName: string; username: string; roleSelectHtml: string; permissionChecksHtml: string; cancelButtonHtml: string; saveButtonHtml: string };

export function userPermissionsModalHtml(input: UserPermissionsModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>Sửa quyền người dùng</h3><button class="modal-close" data-action="closeModal">✕</button></div>
    <div class="modal-b">
      <div class="hint"><b>${input.userName}</b> · @${input.username}</div>
      <label>Vai trò</label>${input.roleSelectHtml}
      <label class="flow-section">Thẻ được phép dùng</label>${input.permissionChecksHtml}
      <div class="hint flow-control">Vai trò quyết định quyền sửa/quản trị; danh sách thẻ chỉ quyết định người dùng thấy và mở được màn hình nào.</div>
    </div>
    <div class="modal-f">${input.cancelButtonHtml}${input.saveButtonHtml}</div></div>`;
}
