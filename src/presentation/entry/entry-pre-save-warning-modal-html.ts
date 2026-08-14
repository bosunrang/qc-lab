type EntryPreSaveWarningModalInput = { issuesHtml: string; cancelButtonHtml: string; saveButtonHtml: string };

export function entryPreSaveWarningModalHtml(input: EntryPreSaveWarningModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>Cảnh báo dữ liệu bất thường</h3><button class="modal-close" onclick="closeModal();entryRenderKeepScroll()">×</button></div><div class="modal-b">${input.issuesHtml}<div class="hint">Bạn vẫn muốn lưu điểm QC này?</div></div><div class="modal-f">${input.cancelButtonHtml}${input.saveButtonHtml}</div></div>`;
}
