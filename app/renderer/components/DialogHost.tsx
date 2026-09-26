// Mount 1 lần, cố định (portal vào #dialogRoot) — render confirm/info/
// reauth theo dialog-store.ts. Đặt trong AppShell, ngoài <Outlet/>, nên tồn
// tại xuyên suốt vòng đời app, không unmount khi chuyển trang.
//
// **2026-09-03**: viết lại theo cấu trúc `.confirm-modal` — bản trước chỉ
// dùng khung modal trơn (`.modal-h`/`.modal-b`), thiếu kicker đỏ "Thao tác
// được kiểm soát", icon tròn theo mức độ (nguy hiểm/thông tin/cảnh báo/thành
// công), và dòng "Tài khoản: ..." của hộp xác thực lại mật khẩu.
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogState, closeDialog } from '../state/dialog-store';
import { useFocusTrap } from './useFocusTrap';
import { useAuthStore } from '../store/auth-store';

export function DialogHost() {
  const dialog = useDialogState();
  const boxRef = useRef<HTMLDivElement>(null);
  const active = dialog.kind !== 'none';
  useFocusTrap(active, () => {
    if (dialog.kind === 'confirm') dialog.resolve(false);
    else if (dialog.kind === 'info') dialog.resolve();
    else if (dialog.kind === 'reauth') dialog.resolve(false);
    else if (dialog.kind === 'choice') dialog.resolve(null);
    closeDialog();
  }, boxRef);

  const root = document.getElementById('dialogRoot');
  if (!root || dialog.kind === 'none') return null;

  function close() { closeDialog(); }

  if (dialog.kind === 'confirm') {
    const { title = '', message, confirmLabel = 'Đồng ý', cancelLabel = 'Hủy', danger = true } = dialog.opts;
    return createPortal(
      <div className="modal-bg dialog-layer" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) { dialog.resolve(false); close(); } }}>
        <div className="modal confirm-modal" ref={boxRef} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}>
          <div className="confirm-modal-h">
            <div />
            <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => { dialog.resolve(false); close(); }}>✕</button>
          </div>
          {title && <h3 className="confirm-modal-title" id="dialog-title">{title}</h3>}
          <div className="confirm-modal-body">
            <div className={`confirm-modal-icon${danger ? '' : ' info'}`} aria-hidden="true">!</div>
            <div className="confirm-modal-text"><b id={title ? undefined : 'dialog-title'}>{message}</b></div>
          </div>
          <div className="confirm-modal-actions">
            <button type="button" className="btn ghost" onClick={() => { dialog.resolve(false); close(); }}>{cancelLabel}</button>
            <button type="button" className={`btn ${danger ? 'danger' : 'teal'}`} onClick={() => { dialog.resolve(true); close(); }}>{confirmLabel}</button>
          </div>
        </div>
      </div>,
      root,
    );
  }

  if (dialog.kind === 'choice') {
    const { title = '', message, options, cancelLabel = 'Hủy' } = dialog.opts;
    return createPortal(
      <div className="modal-bg dialog-layer" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) { dialog.resolve(null); close(); } }}>
        <div className="modal confirm-modal" ref={boxRef} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}>
          <div className="confirm-modal-h">
            <div />
            <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => { dialog.resolve(null); close(); }}>✕</button>
          </div>
          {title && <h3 className="confirm-modal-title" id="dialog-title">{title}</h3>}
          <div className="confirm-modal-body">
            <div className="confirm-modal-icon info" aria-hidden="true">!</div>
            <div className="confirm-modal-text">
              <b id={title ? undefined : 'dialog-title'}>{message}</b>
              {options.filter((option) => option.hint).map((option) => (
                <p key={option.key}><b>{option.label}</b> — {option.hint}</p>
              ))}
            </div>
          </div>
          <div className="confirm-modal-actions">
            <button type="button" className="btn ghost" onClick={() => { dialog.resolve(null); close(); }}>{cancelLabel}</button>
            {options.map((option) => (
              <button key={option.key} type="button" className={`btn ${option.variant || 'teal'}`}
                onClick={() => { dialog.resolve(option.key); close(); }}>{option.label}</button>
            ))}
          </div>
        </div>
      </div>,
      root,
    );
  }

  if (dialog.kind === 'info') {
    const { title = '', type = 'warn' } = dialog.opts;
    const glyph = type === 'success' ? '✓' : '!';
    return createPortal(
      <div className="modal-bg dialog-layer" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) { dialog.resolve(); close(); } }}>
        <div className="modal confirm-modal info-modal" ref={boxRef} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}>
          <div className="confirm-modal-h">
            <div />
            <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => { dialog.resolve(); close(); }}>✕</button>
          </div>
          {title && <h3 className="confirm-modal-title" id="dialog-title">{title}</h3>}
          <div className="confirm-modal-body">
            <div className={`confirm-modal-icon info-modal-icon ${type}`} aria-hidden="true">{glyph}</div>
            <div className="confirm-modal-text"><b id={title ? undefined : 'dialog-title'}>{dialog.message}</b></div>
          </div>
          <div className="confirm-modal-actions">
            <button type="button" className="btn teal" onClick={() => { dialog.resolve(); close(); }}>Đã hiểu</button>
          </div>
        </div>
      </div>,
      root,
    );
  }

  return createPortal(
    <div className="modal-bg dialog-layer" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) { dialog.resolve(false); close(); } }}>
      <div className="modal confirm-modal" ref={boxRef} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}>
        <ReauthForm title={dialog.opts.title || 'Xác thực lại'} message={dialog.opts.message} onResolve={(ok) => { dialog.resolve(ok); close(); }} />
      </div>
    </div>,
    root,
  );
}

function ReauthForm({ title, message, onResolve }: { title: string; message?: string; onResolve: (ok: boolean) => void }) {
  const currentUser = useAuthStore((s) => s.user);
  const accountLabel = currentUser ? (currentUser.name || currentUser.username || '') : '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    // Xác thực lại mật khẩu: một phép kiểm, không phải dữ liệu — không có
    // gì để giữ trong store.
    const result = await window.qcApi.verifyOwnPassword({ data: { password } });
    setBusy(false);
    setPassword('');
    if (!result.ok) { setError(result.error.message); inputRef.current?.focus(); return; }
    onResolve(true);
  }

  return (
    <>
      <div className="confirm-modal-h">
        <div className="confirm-modal-kicker">Thao tác được kiểm soát</div>
        <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => onResolve(false)}>✕</button>
      </div>
      <h3 className="confirm-modal-title" id="dialog-title">{title}</h3>
      <div className="confirm-modal-body">
        <div className="confirm-modal-icon info" aria-hidden="true">✓</div>
        <div className="confirm-modal-text"><b>{message || 'Thao tác này cần xác thực lại mật khẩu.'}</b><p>Tài khoản: {accountLabel}</p></div>
      </div>
      <form className="reauth-modal-field" onSubmit={(e) => { e.preventDefault(); if (!busy) submit(); }}>
        {/* Ô "username" ẩn (không dùng type="hidden" — trình duyệt bỏ qua
         * field đó khi tự động điền mật khẩu đã lưu) ghép cặp với ô mật khẩu
         * ngay dưới, chỉ để Chrome tự điền ĐÚNG VÀO ĐÂY khi phát hiện có mật
         * khẩu đã lưu cho tài khoản đang đăng nhập — không có ô này, modal
         * chỉ có 1 ô mật khẩu trơ, Chrome tự chọn Ô VĂN BẢN GẦN NHẤT khác
         * trên trang (vd ô tìm kiếm của bảng phía sau modal) làm "username"
         * để điền — người dùng phát hiện đúng lỗi này: ô tìm kiếm tự có chữ
         * "admin" ngay khi modal vừa mở, lọc mất toàn bộ danh sách phía sau,
         * tạo cảm giác sai là dữ liệu đã bị xoá trước khi xác nhận. */}
        <input type="text" name="username" autoComplete="username" defaultValue={currentUser?.username || ''}
          tabIndex={-1} aria-hidden="true" className="sr-only" />
        <div className="field">
          <label htmlFor="reauth-password">Mật khẩu hiện tại</label>
          <input
            ref={inputRef} id="reauth-password" name="current-password" type="password" autoComplete="current-password" autoFocus value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="field-error">{error}</p>}
      </form>
      <div className="confirm-modal-actions">
        <button type="button" className="btn ghost" onClick={() => onResolve(false)}>Hủy</button>
        <button type="button" className="btn teal" disabled={busy} onClick={submit}>Xác thực</button>
      </div>
    </>
  );
}


