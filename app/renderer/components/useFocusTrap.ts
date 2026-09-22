// Bẫy focus dùng chung cho Modal/Dialog: Escape đóng, Tab/Shift+Tab quẩn
// trong hộp thoại, trả focus về phần tử trước khi mở lại sau khi đóng — cùng
// hợp đồng với modal-focus-trap.ts của app cũ, viết lại thành hook React
// chuẩn (không thao tác DOM ngoài React như bản cũ phải làm để tương thích
// ngược với code cổ điển).
import { useEffect, useRef } from 'react';

// Cùng hợp đồng `queryFocusable()`/`createFocusTrapKeydown()` của app cũ
// (`src/presentation/modal/modal-focus-trap.ts`) — loại `[disabled]` NGAY
// TRONG selector (không phải lọc sau, tránh sót ở lượt tìm phần tử focus
// đầu tiên khi mở) và loại phần tử đang ẩn (`offsetParent!==null`, vd nằm
// trong 1 nhánh `display:none` của form).
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function queryFocusable(box: HTMLElement): HTMLElement[] {
  return Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
}

export function useFocusTrap(active: boolean, onClose: () => void, boxRef: React.RefObject<HTMLElement | null>) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  // Hàm onClose thường được truyền dưới dạng callback nội tuyến từ component
  // gọi Modal. Giữ bản mới nhất trong ref để một lần render nội dung modal
  // không tháo/lắp lại focus trap, trả focus ra ngoài rồi focus vào lại.
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!active) return;
    returnFocusRef.current = document.activeElement !== document.body ? (document.activeElement as HTMLElement) : null;
    const box = boxRef.current;
    // Ưu tiên phần tử mang `autoFocus` (vd ô nhập chính của form) trước khi
    // rơi về phần tử focusable đầu tiên trong DOM — khớp `ModalOverlay.tsx`
    // app cũ (`container.querySelector('[autofocus]')`).
    const preferred = box?.querySelector<HTMLElement>('[autofocus]');
    (preferred || (box && queryFocusable(box)[0]))?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !box) return;
      const items = queryFocusable(box);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [active, boxRef]);
}
