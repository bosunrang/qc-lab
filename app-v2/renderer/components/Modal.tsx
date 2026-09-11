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
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from './useFocusTrap';

/** Nút CHÍNH của modal = nút `.btn.teal` trong `.modal-f`, đúng quy ước màu
 * của app (teal = hành động chính, ghost = phụ/hủy, danger = phá hủy).
 *
 * CỐ Ý không nhận `danger`: Enter là phím dễ bấm nhầm, còn "Hủy điểm này" hay
 * "Xác nhận mở khóa" là thao tác không rút lại được — những modal đó phải bấm
 * chuột. Modal chỉ có nút "Đóng" (picker, hướng dẫn) cũng không có gì để chạy,
 * nên Enter không làm gì. */
function primaryButton(box: HTMLElement | null): HTMLButtonElement | null {
  const footer = box?.querySelector('.modal-f');
  if (!footer) return null;
  for (const button of Array.from(footer.querySelectorAll('button'))) {
    if (button.classList.contains('teal') && !button.disabled) return button;
  }
  return null;
}

export function Modal({ title, onClose, children, footer, width, className }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number; className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, onClose, boxRef);

  /** Enter = bấm nút chính. Làm ở ĐÂY, không phải ở từng modal, vì cả ~20 modal
   * đều cần và một bản cài đặt riêng cho mỗi modal sẽ lệch nhau.
   *
   * Bốn cổng loại trừ, mỗi cổng là một lỗi thật nếu thiếu:
   *  - `isComposing`: bộ gõ tiếng Việt (Telex/VNI) dùng Enter để chốt ký tự
   *    đang gõ. Thiếu cổng này thì đang gõ giữa từ mà modal tự lưu.
   *  - `defaultPrevented`: ô nào tự xử lý Enter rồi (gợi ý tên xét nghiệm ở
   *    Cấu hình chung, thêm cặp mẫu ở So sánh hóa chất, ô ngày, ô năm của lịch)
   *    thì handler của nó chạy TRƯỚC (bubble từ trong ra) và đã `preventDefault`
   *    — tôn trọng, không lưu đè lên.
   *  - `textarea`/`contenteditable`: Enter ở đó là xuống dòng.
   *  - `button`/`a`: Enter đã là "bấm chính nó".
   *
   * `preventDefault()` là thứ chặn submit CHẠY HAI LẦN với modal dùng `<form>`
   * thật: nó huỷ implicit submission của trình duyệt, rồi `click()` chạy đúng
   * một lần. Bỏ nó đi là form submit đôi. */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' || event.defaultPrevented) return;
    if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || target?.isContentEditable) return;
    const button = primaryButton(boxRef.current);
    if (!button) return;
    event.preventDefault();
    button.click();
  }

  const root = document.getElementById('modalRoot');
  if (!root) return null;

  return createPortal(
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${className ? ' ' + className : ''}`} ref={boxRef} role="dialog" aria-modal="true" aria-labelledby="modal-title" style={width ? { width } : undefined} onKeyDown={onKeyDown}>
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
