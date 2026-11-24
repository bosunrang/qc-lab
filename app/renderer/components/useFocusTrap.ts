import { useEffect, useRef } from 'react';
import { registerLayer } from '../lib/layer-stack';

// `queryFocusable()` loại `[disabled]` NGAY TRONG selector (không phải lọc
// sau, tránh sót ở lượt tìm phần tử focus đầu tiên khi mở) và loại phần tử
// đang ẩn (`offsetParent!==null`, vd nằm trong 1 nhánh `display:none`
// của form).
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FIELD = 'input:not([disabled]):not([type=hidden]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled])';

function queryFocusable(box: HTMLElement): HTMLElement[] {
  return Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
}

/** Phần tử nhận focus khi lớp mở mà focus CHƯA nằm trong lớp: ô nhập đầu
 * tiên, rồi tới phần tử focusable đầu tiên không phải nút ✕ (bấm Enter trên ✕
 * là đóng hộp thoại), cuối cùng là chính khung lớp. */
function initialFocus(box: HTMLElement): HTMLElement {
  const field = Array.from(box.querySelectorAll<HTMLElement>(FIELD)).find((el) => el.offsetParent !== null);
  return field || queryFocusable(box).find((el) => !el.classList.contains('modal-close')) || box;
}

/** Giữ focus trong một lớp phủ (modal, hộp xác nhận) và đăng ký lớp vào
 * ngăn xếp: Esc chỉ đóng lớp trên cùng (`lib/layer-stack.ts`). Trả `isTop()`
 * để lớp tự bỏ qua thao tác khi có lớp khác đè lên (vd bấm ra nền khi lịch
 * chọn ngày đang mở). */
export function useFocusTrap(active: boolean, onClose: () => void, boxRef: React.RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose);
  const layerRef = useRef<ReturnType<typeof registerLayer> | null>(null);
  // Nút đã mở lớp, chụp NGAY lần render chuyển sang mở (U2). Tới lúc effect
  // chạy thì React đã focus ô `autoFocus` bên trong lớp, `activeElement` không
  // còn là nút đã mở — bản trước chụp ở effect nên trả focus về chính ô trong
  // lớp (đã bị gỡ) thay vì nút đã mở. Ghi ref trong lúc render là cố ý: render
  // đôi (StrictMode) vẫn chụp cùng một phần tử vì chưa có commit nào.
  const openerRef = useRef<HTMLElement | null>(null);
  const wasActiveRef = useRef(false);
  if (active && !wasActiveRef.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
  }
  wasActiveRef.current = active;

  // Hàm onClose thường được truyền dưới dạng callback nội tuyến từ component
  // gọi Modal. Giữ bản mới nhất trong ref để một lần render nội dung modal
  // không tháo/lắp lại focus trap, trả focus ra ngoài rồi focus vào lại.
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const box = boxRef.current;
    // React đã focus ô `autoFocus` trong lớp thì giữ nguyên; chưa thì chọn ô
    // nhập đầu tiên — không rơi vào nút ✕ như trước (U2).
    if (box && !box.contains(document.activeElement)) initialFocus(box).focus();
    const layer = registerLayer(() => onCloseRef.current());
    layerRef.current = layer;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !box || !layer.isTop()) return;
      const items = queryFocusable(box);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }

    document.addEventListener('keydown', onKeyDown);
    const opener = openerRef.current;
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      layer.release();
      layerRef.current = null;
      if (opener?.isConnected) opener.focus();
    };
  }, [active, boxRef]);

  return { isTop: () => layerRef.current?.isTop() ?? false };
}
