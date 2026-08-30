import { useEffect } from 'react';
import { useStore } from 'zustand';
import { queryFocusable, createFocusTrapKeydown } from '../../presentation/modal/modal-focus-trap';
import { modalStore, closeModal } from './modal-store';

const activeModalEl = (): HTMLElement | null => document.querySelector('#modalRoot .modal');

/* Cổng modal-focus-trap.ts giống hệt DialogOverlay.tsx, nhưng KHÔNG dùng ref
   — tra #modalRoot .modal trực tiếp mỗi lần (giống activeModal() bản cũ)
   vì nội dung 'html' không phải cây React nên không có ref ổn định để giữ
   qua mỗi lần render lại. */
function useModalFocusTrap(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const modalReturnFocus = document.activeElement && document.activeElement !== document.body ? (document.activeElement as HTMLElement) : null;
    const keydown = createFocusTrapKeydown({
      activeContainer: activeModalEl,
      activeElement: () => document.activeElement,
      onEscape: () => closeModal(),
    });
    document.addEventListener('keydown', keydown);
    const raf = requestAnimationFrame(() => {
      const container = activeModalEl();
      if (!container) return;
      const preferred = container.querySelector('[autofocus]') as HTMLElement | null;
      const first = preferred || queryFocusable(container)[0];
      (first || container).focus({ preventScroll: true });
    });
    return () => {
      document.removeEventListener('keydown', keydown);
      cancelAnimationFrame(raf);
      if (modalReturnFocus && modalReturnFocus.isConnected && modalReturnFocus.focus) {
        requestAnimationFrame(() => modalReturnFocus.focus({ preventScroll: true }));
      }
    };
  }, [active]);
}

/* Chỉ nội dung 'html' (chuỗi modalTemplate() cũ, chưa chuyển sang JSX) cần
   hậu-xử lý DOM này — bản 'react' tự khai role/aria-modal/aria-labelledby/
   tabIndex ngay trong JSX của chính nó, giống DialogOverlay.tsx. */
function useHtmlModalA11y(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const modal = activeModalEl();
    if (!modal) return;
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.tabIndex = -1;
    const title = modal.querySelector('.modal-h h3');
    if (title) { if (!title.id) title.id = 'modalTitle'; modal.setAttribute('aria-labelledby', title.id); }
    modal.querySelectorAll('.modal-close').forEach(button => { if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', 'Đóng hộp thoại'); });
  });
}

export function ModalOverlay() {
  const state = useStore(modalStore);
  const active = state.kind !== 'none';
  useModalFocusTrap(active);
  useHtmlModalA11y(state.kind === 'html');

  if (state.kind === 'none') return null;
  const handleBgClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) closeModal(); };

  return (
    <div className="modal-bg" role="presentation" onClick={handleBgClick}>
      {state.kind === 'html'
        ? <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: state.html }} />
        : state.render()}
    </div>
  );
}
