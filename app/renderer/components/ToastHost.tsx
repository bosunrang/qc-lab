// Mount 1 lần trong AppShell, cạnh DialogHost. Vùng `role="status"` luôn có
// trong DOM để trình đọc màn hình đọc dòng mới thêm vào.
import { createPortal } from 'react-dom';
import { dismissToast, useToasts } from '../state/toast-store';

export function ToastHost() {
  const toasts = useToasts();
  const root = document.getElementById('dialogRoot');
  if (!root) return null;
  return createPortal(
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`}>
          <span className="toast-icon" aria-hidden="true">{toast.kind === 'ok' ? '✓' : '⚠'}</span>
          <span className="toast-text">{toast.message}</span>
          <button type="button" className="toast-close" aria-label="Đóng thông báo" onClick={() => dismissToast(toast.id)}>✕</button>
        </div>
      ))}
    </div>,
    root,
  );
}
