export type ResetPasswordModalInput = { title: string; message: string; enterAction: string; cancelButtonHtml: string; saveButtonHtml: string };

export function resetPasswordModalHtml(input: ResetPasswordModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>${input.title}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b">
      <div class="hint">${input.message}</div>
      <label>Mật khẩu mới</label><input id="resetPass1" type="password" autocomplete="new-password">
      <label>Nhập lại mật khẩu</label><input id="resetPass2" type="password" autocomplete="new-password" onkeydown="${input.enterAction}">
      <div id="resetPassMsg"></div>
    </div>
    <div class="modal-f">${input.cancelButtonHtml}${input.saveButtonHtml}</div></div>`;
}
