import { closeModal } from '../dialogs/modal-store';

export type ActionDetailModel = { bodyHtml: string };

/* Modal cuối cùng của Giai đoạn 3 chuyển sang 'react' — Actions' "Chi tiết
   phiếu xử lý sự cố" (viewActionDetail), thuần hiển thị (không có trường
   nhập/nút lưu nào, chỉ "Đóng"). Nội dung do >10 hàm dựng HTML khác nhau
   ghép lại tùy theo hồ sơ cũ/mới/đã hủy (actionDetailMetaHtml,
   actionEvidenceTimelineHtml, actionContainmentDetailHtml, ...) — GIỮ
   NGUYÊN toàn bộ logic ghép chuỗi đó (viewActionDetailModel() trả đúng
   `body` đã tính như trước, chỉ không tự mở modal nữa) và render qua
   dangerouslySetInnerHTML thay vì viết lại thành >10 component JSX. Nút
   "Xem điểm QC" nhúng trong bằng chứng chạy lại (action-rerun-evidence-
   html.ts) vẫn dùng data-action="openActionQcEvidence" cổ điển — vẫn hoạt
   động đúng vì action-dispatcher.ts lắng nghe ở mức document, và
   root.openActionQcEvidence không đổi. */
export function ActionDetailModal({ bodyHtml }: ActionDetailModel) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h">
        <h3 id="modalTitle">Chi tiết phiếu xử lý sự cố</h3>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={closeModal}>✕</button>
      </div>
      <div className="modal-b" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <div className="modal-f">
        <button type="button" className="btn teal" onClick={closeModal}>Đóng</button>
      </div>
    </div>
  );
}
