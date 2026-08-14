export type LotGroupModalInput = {
  title: string;
  levelLayout: string;
  lotColumnsHtml: string;
  name: string;
  note: string;
  cancelButtonHtml: string;
  saveButtonHtml: string;
};

export function lotGroupModalHtml(input: LotGroupModalInput) {
  return `<div class="modal rcfg-modal rcfg-group-modal ${input.levelLayout}"><div class="modal-h"><div><h3>${input.title}</h3></div><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
    <label>Chọn các lô QC</label>
    <div class="lot-level-picker">${input.lotColumnsHtml}</div>
    <label>Tên nhóm lô</label><input id="cfgGroupName" value="${input.name}" placeholder="Tự động: 1102/1103">
    <label>Ghi chú</label><textarea id="cfgGroupNote">${input.note}</textarea></div>
    <div class="modal-f">${input.cancelButtonHtml}${input.saveButtonHtml}</div></div>`;
}
