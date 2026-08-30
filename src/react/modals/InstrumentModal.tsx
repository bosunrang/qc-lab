import { closeModal } from '../dialogs/modal-store';
import { getKernel } from '../state/kernel';

export type InstrumentModel = { id: string; name: string; section: string; manufacturer: string; serial: string; active: boolean };

/* Modal thứ sáu của Giai đoạn 3 chuyển sang 'react' — Manage's máy xét
   nghiệm (openConfigInstrument). Cùng nhóm "giao hẳn cho command đã có sẵn"
   như ArchiveLogModal: không có state cục bộ nào — mọi ô đều uncontrolled
   (defaultValue/defaultChecked), saveConfigInstrument(id) (không đổi) đọc
   DOM #cfgInst* trực tiếp lúc submit. openConfigInstrument()'s data còn được
   gọi lại từ MỘT nơi khác trong classic bundle: openConfigAssay() tự mở modal
   này khi chưa có máy nào (qua deps.openReactInstrumentModal(), trỏ tới
   window.QCLabReact.openConfigInstrument() — cùng hàm bridge này). */
export function InstrumentModal({ id, name, section, manufacturer, serial, active }: InstrumentModel) {
  return (
    <div className="modal rcfg-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h">
        <div><h3 id="modalTitle">{id ? 'Sửa máy xét nghiệm' : 'Thêm máy xét nghiệm'}</h3></div>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => closeModal()}>✕</button>
      </div>
      <div className="modal-b">
        <div className="grid2">
          <div><label>Tên hiển thị</label><input id="cfgInstName" defaultValue={name} placeholder="VD: AU5800-01" /></div>
          <div><label>Khoa / Khu vực</label><input id="cfgInstSection" defaultValue={section} placeholder="Hóa sinh" /></div>
        </div>
        <div className="grid2">
          <div><label>Nhà sản xuất</label><input id="cfgInstMfr" defaultValue={manufacturer} placeholder="Beckman Coulter" /></div>
          <div><label>Số sê-ri</label><input id="cfgInstSerial" aria-label="Số sê-ri" defaultValue={serial} /></div>
        </div>
        <label className="rcfg-check"><input id="cfgInstActive" type="checkbox" defaultChecked={active} /> Máy đang hoạt động</label>
      </div>
      <div className="modal-f">
        <button type="button" className="btn ghost" onClick={() => closeModal()}>Hủy</button>
        <button type="button" className="btn teal" onClick={() => getKernel().manage.saveConfigInstrument(id)}>{id ? 'Lưu thay đổi' : 'Thêm máy xét nghiệm'}</button>
      </div>
    </div>
  );
}
