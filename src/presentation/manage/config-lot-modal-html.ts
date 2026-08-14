export type ConfigLotModalInput = {
  title: string;
  lotNo: string;
  levelOptionsHtml: string;
  description: string;
  supplier: string;
  openedDateHtml: string;
  expiryDateHtml: string;
  note: string;
  cancelButtonHtml: string;
  saveButtonHtml: string;
};

export function configLotModalHtml(input: ConfigLotModalInput) {
  return `<div class="modal rcfg-modal"><div class="modal-h"><div><h3>${input.title}</h3></div><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
    <div class="grid2"><div><label>Số lô</label><input id="cfgLotNo" value="${input.lotNo}" placeholder="VD: 1234UE"></div><div><label>Mức QC</label><select id="cfgLotLevel" aria-label="Mức QC">${input.levelOptionsHtml}</select></div></div>
    <div class="grid2"><div><label>Mô tả</label><input id="cfgLotDescription" value="${input.description}" placeholder="VD: Acusera Assayed Chemistry Control"></div><div><label>Nhà cung cấp</label><input id="cfgLotSupplier" value="${input.supplier}" placeholder="Randox"></div></div>
    <div class="grid2"><div><label>Ngày mở (dd/mm/yyyy)</label>${input.openedDateHtml}</div><div><label>Hạn sử dụng (dd/mm/yyyy)</label>${input.expiryDateHtml}</div></div>
    <label>Ghi chú</label><textarea id="cfgLotNote" aria-label="Ghi chú">${input.note}</textarea></div>
    <div class="modal-f">${input.cancelButtonHtml}${input.saveButtonHtml}</div></div>`;
}
