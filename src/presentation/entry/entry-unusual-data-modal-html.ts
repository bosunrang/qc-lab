type EntryUnusualDataModalInput = { issuesHtml: string; confirmAction: string };

type EntryUnusualDataModalDependencies = {
  button: (label: string, action: string, variant: string) => string;
};

export function createEntryUnusualDataModalHtml(deps: EntryUnusualDataModalDependencies) {
  return (input: EntryUnusualDataModalInput) => `<div class="modal">
      <div class="modal-h"><h3>Cảnh báo dữ liệu bất thường</h3><button class="modal-close" onclick="closeModal();entryRenderKeepScroll()">×</button></div>
      <div class="modal-b">${input.issuesHtml}<div class="hint">Bạn vẫn muốn lưu điểm QC này?</div></div>
      <div class="modal-f">${deps.button('Hủy','closeModal();entryRenderKeepScroll()','ghost')}${deps.button('Vẫn lưu',input.confirmAction,'teal')}</div>
    </div>`;
}
