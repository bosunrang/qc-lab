export type ConfigPanelModalInput = {
  title: string;
  name: string;
  instrumentsHtml: string;
  testRowsHtml: string;
  note: string;
  active: boolean;
  cancelButtonHtml: string;
  saveButtonHtml: string;
};

export function configPanelModalHtml(input: ConfigPanelModalInput) {
  return `<div class="modal rcfg-modal"><div class="modal-h"><div><h3>${input.title}</h3></div><button class="modal-close" data-action="closeModal">✕</button></div><div class="modal-b">
    <div class="grid2"><div><label>Tên Panel QC</label><input id="cfgPanelName" value="${input.name}" placeholder="VD: Sinh hóa AU5800"></div><div><label>Máy xét nghiệm</label><select id="cfgPanelInstrument" data-action="renderConfigPanelTests" data-action-on="change">${input.instrumentsHtml}</select></div></div>
    <label>Chọn xét nghiệm trong panel</label><div id="cfgPanelTests" class="group-lot-picker assay-group-picker">${input.testRowsHtml}</div>
    <label>Ghi chú</label><textarea id="cfgPanelNote">${input.note}</textarea>
    <label class="rcfg-check"><input id="cfgPanelActive" type="checkbox" ${input.active ? 'checked' : ''}> Panel đang sử dụng</label></div>
    <div class="modal-f">${input.cancelButtonHtml}${input.saveButtonHtml}</div></div>`;
}
