// Modal form dùng chung (CRUD: máy/xét nghiệm/lô/panel/...) — portal thật
// vào #modalRoot, KHÔNG dangerouslySetInnerHTML/chuỗi HTML như app cũ đang
// phải strangler-fig dần (xem docs/APP-V2-PLAN.md mục "Giống app cũ nghĩa
// là gì" → mục 3). Tách lớp với Dialog (confirm/info/reauth, #dialogRoot) để
// dialog luôn nổi trên modal, đúng lý do bản cũ đã ghi lại.
//
// **2026-09-03**: đổi TÊN CLASS về đúng app cũ (`.modal-bg`/`.modal`/
// `.modal-h`/`.modal-b`/`.modal-f`/`.modal-close`) thay cho bộ tên tự đặt
// (`.overlay-backdrop`/`.modal-box`/`.modal-box-header`/…). Giá trị CSS
// trước đó đã copy đúng, nhưng TÊN khác làm app-v2 mất sạch những rule của
// app cũ scope theo tên đó — `.modal-b>label:first-child{margin-top:0}`,
// `.modal-h h3`, `.rcfg-modal input[type=checkbox]`, breakpoint 760px biến
// modal thành sheet dán đáy (`.modal{width:100%;border-radius:12px 12px 0 0}`)
// — và làm gate `css-parity` không thể canh (nó chỉ hỏi về class app-v2 ĐANG
// dùng). Phát hiện khi đo thật bên trong modal: KHÔNG một class modal nào của
// app cũ tồn tại ở app-v2, mà cả 3 gate đều xanh vì không gate nào MỞ modal.
//
// `width` (prop số) vẫn giữ cho các chỗ gọi cũ, nhưng mặc định giờ là 560px
// đúng `.modal` app cũ; cách app cũ làm là mỗi modal thêm 1 class riêng
// (`.rcfg-modal{width:700px}`) — `className` phục vụ đúng việc đó.
import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from './useFocusTrap';

export function Modal({ title, onClose, children, footer, width, className }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number; className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, onClose, boxRef);

  const root = document.getElementById('modalRoot');
  if (!root) return null;

  return createPortal(
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${className ? ' ' + className : ''}`} ref={boxRef} role="dialog" aria-modal="true" aria-labelledby="modal-title" style={width ? { width } : undefined}>
        <div className="modal-h">
          <h3 id="modal-title">{title}</h3>
          <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={onClose}>✕</button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>,
    root,
  );
}
