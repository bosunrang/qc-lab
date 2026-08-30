import { closeModal } from '../dialogs/modal-store';
import { getKernel } from '../state/kernel';

/* Modal thứ hai của Giai đoạn 3 chuyển sang 'react'. Nút "Xuất CSV và lưu
   trữ" gọi confirmArchiveActivityLog() — hàm này (qua kernel.audit, vẫn ở
   modular-pilot.js) tự lo toàn bộ luồng confirm/reauth/đóng modal bên trong
   ActivityArchiveCommand.execute(), y hệt lúc còn là modal 'html': component
   này chỉ cần dựng đúng form ban đầu, không giữ state cục bộ nào (không có
   nhánh lỗi cần hiển thị tại chỗ — mọi nhánh hủy/lỗi đều qua confirmDialog/
   infoDialog, đã là React thật từ bước 1). */
export function ArchiveLogModal({ total }: { total: number }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h">
        <h3 id="modalTitle">Lưu trữ nhật ký cũ</h3>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => closeModal()}>✕</button>
      </div>
      <div className="modal-b">
        <div className="hint">Nhật ký hiện có <b>{total}</b> dòng. Các dòng cũ hơn mốc chọn sẽ được <b>xuất ra file CSV</b> (kèm PrevHash/Hash), sau đó mới bị gỡ khỏi hệ thống — hash dòng cuối file trở thành điểm nối vào chuỗi còn lại nên phần lưu trữ vẫn kiểm chứng được.</div>
        <label className="flow-section">Chỉ giữ lại nhật ký trong</label>
        <select id="auditArchiveMonths" aria-label="Mốc tuổi nhật ký được giữ lại" defaultValue="24">
          <option value="12">12 tháng gần nhất</option>
          <option value="24">24 tháng gần nhất</option>
          <option value="36">36 tháng gần nhất</option>
        </select>
      </div>
      <div className="modal-f">
        <button type="button" className="btn ghost" onClick={() => closeModal()}>Hủy</button>
        <button type="button" className="btn teal" onClick={() => getKernel().audit.confirmArchiveActivityLog()}>Xuất CSV và lưu trữ</button>
      </div>
    </div>
  );
}
