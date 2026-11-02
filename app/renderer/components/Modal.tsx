import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from './useFocusTrap';
import { ModalBusyContext } from './AsyncButton';
import { modalEnterSubmits } from '../lib/modal-enter';
import { decideModalClose, FIELD_EDIT_EVENT } from '../lib/modal-close';
import { confirmDialog } from '../state/dialog-store';

/** Nút CHÍNH của modal = nút `.btn.teal` trong `.modal-f`, đúng quy ước màu
 * của app (teal = hành động chính, ghost = phụ/huỷ, danger = phá huỷ).
 *
 * CỐ Ý không nhận `danger`: Enter là phím dễ bấm nhầm, còn "Huỷ điểm này" hay
 * "Xác nhận mở khoá" là thao tác không rút lại được — những modal đó phải bấm
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

/** Bốn cỡ modal, khoá bằng design-system.test.mjs — không đặt độ rộng riêng:
 * `sm` 440px hộp hỏi nhanh, 1–2 ô; `md` 600px form thường (mặc định);
 * `lg` 800px form nhiều cột; `xl` 1120px modal chứa bảng dữ liệu.
 * Trước 2026-09-24 có 16 độ rộng khác nhau, từ 400 đến 1160px. */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export function Modal({ title, onClose, children, footer, size = 'md', className, guardUnsaved = true, busy = false }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: ModalSize;
  /** Chỉ cho bố cục bên trong modal; độ rộng lấy theo `size`. */
  className?: string;
  /** Hỏi trước khi Esc/✕/bấm ra nền bỏ những gì người dùng đã gõ. Tắt cho
   * modal chỉ để xem mà có ô lọc/tìm kiếm. */
  guardUnsaved?: boolean;
  /** Form lưu bằng `useAsyncAction` ở component cha (nút submit nằm ngoài
   * `ModalBusyContext`) báo đang lưu qua đây; `AsyncButton` trong modal tự báo. */
  busy?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  // Ref, không phải state: đổi cờ không cần vẽ lại modal.
  const dirtyRef = useRef(false);
  const busyRef = useRef(0);
  const confirmingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const busyPropRef = useRef(busy);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { busyPropRef.current = busy; }, [busy]);

  /** Esc, nút ✕ và bấm ra nền đi qua đây (U3, U7); nút "Huỷ/Đóng" ở chân
   * form gọi thẳng `onClose` vì đó là chủ ý bỏ. */
  const requestClose = useCallback(async () => {
    const decision = decideModalClose({ busy: busyRef.current > 0 || busyPropRef.current, dirty: dirtyRef.current, guarded: guardUnsaved });
    if (decision === 'ignore' || confirmingRef.current) return;
    if (decision === 'confirm') {
      confirmingRef.current = true;
      const discard = await confirmDialog('Những gì bạn vừa nhập trong biểu mẫu chưa được lưu.', {
        title: 'Bỏ thay đổi chưa lưu?', confirmLabel: 'Bỏ thay đổi', cancelLabel: 'Tiếp tục sửa',
      });
      confirmingRef.current = false;
      if (!discard) return;
    }
    onCloseRef.current();
  }, [guardUnsaved]);
  const trap = useFocusTrap(true, () => { void requestClose(); }, boxRef);

  const reportBusy = useCallback((running: boolean) => { busyRef.current = Math.max(0, busyRef.current + (running ? 1 : -1)); }, []);
  const markDirty = useCallback(() => { dirtyRef.current = true; }, []);
  // Chọn ngày trên lịch không phát `input` qua modal (lịch nằm ngoài khung).
  useEffect(() => {
    const box = boxRef.current;
    box?.addEventListener(FIELD_EDIT_EVENT, markDirty);
    return () => box?.removeEventListener(FIELD_EDIT_EVENT, markDirty);
  }, [markDirty]);

  /** Enter = bấm nút chính. Làm ở ĐÂY, không phải ở từng modal, vì cả ~20 modal
   * đều cần và một bản cài đặt riêng cho mỗi modal sẽ lệch nhau. Các cổng loại
   * trừ (bộ gõ tiếng Việt, textarea, danh sách `select` đang mở…) nằm ở
   * `modalEnterSubmits()` để test được.
   *
   * `preventDefault()` là thứ chặn submit CHẠY HAI LẦN với modal dùng `<form>`
   * thật: nó huỷ implicit submission của trình duyệt, rồi `click()` chạy đúng
   * một lần. Bỏ nó đi là form submit đôi. */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!modalEnterSubmits({
      key: event.key, defaultPrevented: event.defaultPrevented, isComposing: event.nativeEvent.isComposing,
      ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey,
      target: event.target as HTMLElement | null,
    })) return;
    const button = primaryButton(boxRef.current);
    if (!button) return;
    event.preventDefault();
    button.click();
  }

  const root = document.getElementById('modalRoot');
  if (!root) return null;

  return createPortal(
    // Bấm ra nền khi có lớp khác đè lên (lịch chọn ngày) chỉ đóng lớp đó.
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget && trap.isTop()) void requestClose(); }}>
      <div className={`modal modal-${size}${className ? ' ' + className : ''}`} ref={boxRef} role="dialog" aria-modal="true" aria-labelledby="modal-title"
        onKeyDown={onKeyDown} onInputCapture={markDirty} onChangeCapture={markDirty}>
        <div className="modal-h">
          <h3 id="modal-title">{title}</h3>
          <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => { void requestClose(); }}>✕</button>
        </div>
        <ModalBusyContext.Provider value={reportBusy}>
          <div className="modal-b">{children}</div>
          {footer && <div className="modal-f">{footer}</div>}
        </ModalBusyContext.Provider>
      </div>
    </div>,
    root,
  );
}


