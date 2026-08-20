export type ConfigInstrumentModalInput = {
  title: string;
  name: string;
  section: string;
  manufacturer: string;
  serial: string;
  active: boolean;
  cancelButtonHtml: string;
  saveButtonHtml: string;
};

export function configInstrumentModalHtml(input: ConfigInstrumentModalInput) {
  return `<div class="modal rcfg-modal"><div class="modal-h"><div><h3>${input.title}</h3></div><button class="modal-close" data-action="closeModal">✕</button></div><div class="modal-b">
    <div class="grid2"><div><label>Tên hiển thị</label><input id="cfgInstName" value="${input.name}" placeholder="VD: AU5800-01"></div><div><label>Khoa / Khu vực</label><input id="cfgInstSection" value="${input.section}" placeholder="Hóa sinh"></div></div>
    <div class="grid2"><div><label>Nhà sản xuất</label><input id="cfgInstMfr" value="${input.manufacturer}" placeholder="Beckman Coulter"></div><div><label>Số sê-ri</label><input id="cfgInstSerial" aria-label="Số sê-ri" value="${input.serial}"></div></div>
    <label class="rcfg-check"><input id="cfgInstActive" type="checkbox" ${input.active ? 'checked' : ''}> Máy đang hoạt động</label></div>
    <div class="modal-f">${input.cancelButtonHtml}${input.saveButtonHtml}</div></div>`;
}
