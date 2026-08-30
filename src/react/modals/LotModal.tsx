import { closeModal } from '../dialogs/modal-store';
import { getKernel } from '../state/kernel';
import { DateField } from '../components/DateField';

export type LotModel = { id: string; lotNo: string; level: number; description: string; supplier: string; opened: string; exp: string; note: string };

const LOT_LEVELS = [1, 2, 3, 4, 5, 6];

/* Modal thứ bảy của Giai đoạn 3 chuyển sang 'react' — Manage's lô QC
   (openConfigLot). Cùng nhóm CRUD thuần như InstrumentModal, có 2 trường
   ngày (Ngày mở/Hạn sử dụng) — Giai đoạn 5 (5c) đổi hẳn sang <DateField>
   JSX thật (không truyền onChange: saveConfigLot() vẫn đọc DOM
   #cfgLotOpened/#cfgLotExp trực tiếp lúc submit, không có logic nào khác
   trong modal phụ thuộc giá trị ngày đang gõ dở). Mức QC (Giai đoạn 5, dọn
   dangerouslySetInnerHTML) đổi hẳn sang JSX <option> thật — danh sách tĩnh
   1-6, không có lý do giữ dạng chuỗi HTML (configLotLevelOptionsHtml cũ đã
   xóa hẳn). */
export function LotModal({ id, lotNo, level, description, supplier, opened, exp, note }: LotModel) {
  return (
    <div className="modal rcfg-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h">
        <div><h3 id="modalTitle">{id ? 'Sửa thông tin lô QC' : 'Thêm lô QC'}</h3></div>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => closeModal()}>✕</button>
      </div>
      <div className="modal-b">
        <div className="grid2">
          <div><label>Số lô</label><input id="cfgLotNo" defaultValue={lotNo} placeholder="VD: 1234UE" /></div>
          <div><label>Mức QC</label><select id="cfgLotLevel" aria-label="Mức QC" defaultValue={String(level)}>
            {LOT_LEVELS.map(l => <option value={l} key={l}>{l}</option>)}
          </select></div>
        </div>
        <div className="grid2">
          <div><label>Mô tả</label><input id="cfgLotDescription" defaultValue={description} placeholder="VD: Acusera Assayed Chemistry Control" /></div>
          <div><label>Nhà cung cấp</label><input id="cfgLotSupplier" defaultValue={supplier} placeholder="Randox" /></div>
        </div>
        <div className="grid2">
          <div><label>Ngày mở (dd/mm/yyyy)</label><DateField id="cfgLotOpened" value={opened} /></div>
          <div><label>Hạn sử dụng (dd/mm/yyyy)</label><DateField id="cfgLotExp" value={exp} /></div>
        </div>
        <label>Ghi chú</label>
        <textarea id="cfgLotNote" aria-label="Ghi chú" defaultValue={note} />
      </div>
      <div className="modal-f">
        <button type="button" className="btn ghost" onClick={() => closeModal()}>Hủy</button>
        <button type="button" className="btn teal" onClick={() => getKernel().manage.saveConfigLot(id)}>{id ? 'Lưu thay đổi' : 'Thêm lô QC'}</button>
      </div>
    </div>
  );
}
