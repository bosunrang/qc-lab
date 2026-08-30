import { closeModal } from '../dialogs/modal-store';

type GuideStep = { phase: string; title: string; text: string };

/* Modal ĐẦU TIÊN của Giai đoạn 3 chuyển hẳn sang 'react' (không còn 'html'
   qua modalTemplate()/action-guide-content.ts, cả hai đã xóa) — chọn vì đây
   là modal đơn giản nhất: thuần thông tin, không có form/state/re-auth.
   Tái dùng ĐÚNG dữ liệu 8 bước cũ (root.ActionGuidePresentation.steps, lộ
   qua kernel.actions.actionGuideSteps) để không tách rời hai bản sao có thể
   trôi lệch nhau. Tự khai role/aria-modal/aria-labelledby/tabIndex ngay
   trong JSX — không cần ModalOverlay.tsx's useHtmlModalA11y (hậu-xử lý DOM
   đó chỉ dành cho nội dung 'html'). */
export function ActionGuideModal({ steps }: { steps: GuideStep[] }) {
  return (
    <div className="modal action-guide-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabIndex={-1}>
      <div className="modal-h">
        <h3 id="modalTitle">Quy trình 8 bước xử lý hồ sơ NCE</h3>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => closeModal()}>✕</button>
      </div>
      <div className="modal-b" tabIndex={0} aria-label="Nội dung quy trình 8 bước">
        <div className="action-guide-intro">
          <b>Nguyên tắc thực hiện</b>
          <p>Lưu hồ sơ ngay sau bước 1 ở trạng thái <strong>Đang điều tra</strong>, sau đó hoàn thiện theo tiến độ xử lý.</p>
        </div>
        <ol className="action-guide-list">
          {steps.map((step, i) => (
            <li className="action-guide-card" key={i}>
              <span className="action-guide-number">{i + 1}</span>
              <div><small>{step.phase}</small><b>{step.title}</b><p>{step.text}</p></div>
            </li>
          ))}
        </ol>
      </div>
      <div className="modal-f">
        <div className="action-guide-footer-note">
          <b>Điều kiện khép vòng</b>
          <span>Đủ bằng chứng QC, quyết định cho phép trở lại khi cần, đánh giá nguy cơ còn lại và phê duyệt độc lập.</span>
        </div>
        <button type="button" className="btn ghost" onClick={() => closeModal()}>Đóng</button>
      </div>
    </div>
  );
}
