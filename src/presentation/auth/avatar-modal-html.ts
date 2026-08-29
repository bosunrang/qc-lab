export type AvatarModalInput = { previewHtml: string; pickButtonHtml: string; fileNameText: string; clearButtonHtml: string; closeButtonHtml: string };

export function avatarModalHtml(input: AvatarModalInput) {
  return `<div class="modal avatar-modal"><div class="modal-h"><h3>Ảnh đại diện</h3><button class="modal-close" data-action="closeModal">✕</button></div>
    <div class="modal-b">
      <div class="avatar-modal-preview">${input.previewHtml}</div>
      <label>Chọn ảnh mới</label>
      <div class="file-pick">${input.pickButtonHtml}<span id="avatarFileName" class="hint">${input.fileNameText}</span></div>
      <input id="avatarPick" type="file" accept="image/*" style="display:none" data-action="pickAvatar" data-action-on="change" aria-label="Chọn ảnh đại diện mới">
      <div class="hint flow-note">Ảnh sẽ được cắt vuông và thu nhỏ tự động.</div>
    </div>
    <div class="modal-f">${input.clearButtonHtml}${input.closeButtonHtml}</div></div>`;
}
