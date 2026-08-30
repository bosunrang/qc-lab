import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { queryFocusable, createFocusTrapKeydown } from '../../presentation/modal/modal-focus-trap';
import { dialogStore, closeDialogOverlay } from './dialog-store';
import { getKernel } from '../state/kernel';

/* Cổng của modal-focus-trap.ts (Escape đóng, Tab/Shift+Tab bọc vòng, focus
   quay lại phần tử cũ sau khi đóng) — port sang React effect thay vì
   deps.requestFrame/addEventListener thủ công của bản cũ. modal-focus-trap.ts
   là hàm thuần không đụng DOM ở top-level nên import thẳng an toàn (giống
   cách Giai đoạn 1 đã làm với các hàm thuần khác — xem CLAUDE.md). */
function useDialogFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const returnFocus = document.activeElement && document.activeElement !== document.body ? (document.activeElement as HTMLElement) : null;
    const keydown = createFocusTrapKeydown({
      activeContainer: () => containerRef.current,
      activeElement: () => document.activeElement,
      onEscape: () => closeDialogOverlay(),
    });
    document.addEventListener('keydown', keydown);
    const raf = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const preferred = container.querySelector('[autofocus]') as HTMLElement | null;
      const first = preferred || queryFocusable(container)[0];
      (first || container).focus({ preventScroll: true });
    });
    return () => {
      document.removeEventListener('keydown', keydown);
      cancelAnimationFrame(raf);
      if (returnFocus && returnFocus.isConnected && returnFocus.focus) {
        requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
      }
    };
  }, [active]);
}

/* reauthenticateCurrentUser() cũ (classic modular-pilot.global.ts, đã xóa) —
   xác minh mật khẩu vẫn qua kernel.pres.reauthVerify() (PBKDF2 nằm bên
   modular-pilot.js), form chỉ giữ password/lỗi tại chỗ. Enter trong ô mật
   khẩu VÀ nút "Xác thực" đều gọi cùng submit(), khớp hành vi
   data-keydown-action cũ. */
function ReauthForm({ title, message, accountLabel }: { title: string; message: string; accountLabel: string }) {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = async () => {
    let ok = false;
    try { ok = await getKernel().pres.reauthVerify(password); } catch (e) { /* mật khẩu không xác thực được coi như sai */ }
    setPassword('');
    if (!ok) { setErr(true); inputRef.current?.focus(); return; }
    closeDialogOverlay(true);
  };
  return (
    <>
      <div className="confirm-modal-h"><div className="confirm-modal-kicker">Thao tác được kiểm soát</div><button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => closeDialogOverlay(false)}>✕</button></div>
      <h3 className="confirm-modal-title" id="dialogTitle">{title}</h3>
      <div className="confirm-modal-body"><div className="confirm-modal-icon info" aria-hidden="true">✓</div><div className="confirm-modal-text"><b>{message}</b><p>Tài khoản: {accountLabel}</p></div></div>
      <div className="reauth-modal-field">
        <label htmlFor="reauthPassword">Mật khẩu hiện tại</label>
        <input ref={inputRef} id="reauthPassword" type="password" autoComplete="current-password" autoFocus value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
        <div id="reauthError" className="auth-err" hidden={!err}>Mật khẩu không đúng.</div>
      </div>
      <div className="confirm-modal-actions">
        <button type="button" className="btn ghost" onClick={() => closeDialogOverlay(false)}>Hủy</button>
        <button type="button" className="btn teal" onClick={submit}>Xác thực</button>
      </div>
    </>
  );
}

export function DialogOverlay() {
  const state = useStore(dialogStore);
  const containerRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(state.kind !== 'none', containerRef);

  if (state.kind === 'none') return null;
  const handleBgClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) closeDialogOverlay(); };

  if (state.kind === 'confirm') {
    const { kicker = '', title = '', message = '', detail = '', confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', danger = true } = state.opts;
    return (
      <div className="modal-bg" role="presentation" onClick={handleBgClick}>
        <div className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="dialogTitle" tabIndex={-1} ref={containerRef}>
          <div className="confirm-modal-h">
            {kicker ? <div className="confirm-modal-kicker">{kicker}</div> : <div></div>}
            <button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => closeDialogOverlay()}>✕</button>
          </div>
          <h3 className="confirm-modal-title" id="dialogTitle">{title}</h3>
          <div className="confirm-modal-body">
            <div className={`confirm-modal-icon${danger ? '' : ' info'}`} aria-hidden="true">!</div>
            <div className="confirm-modal-text"><b>{message}</b>{detail ? <p>{detail}</p> : null}</div>
          </div>
          <div className="confirm-modal-actions">
            <button type="button" className="btn ghost" onClick={() => closeDialogOverlay(false)}>{cancelLabel}</button>
            <button type="button" className={`btn ${danger ? 'danger' : 'teal'}`} onClick={() => closeDialogOverlay(true)}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'reauth') {
    return (
      <div className="modal-bg" role="presentation" onClick={handleBgClick}>
        <div className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="dialogTitle" tabIndex={-1} ref={containerRef}>
          <ReauthForm title={state.title} message={state.message} accountLabel={state.accountLabel} />
        </div>
      </div>
    );
  }

  const { title = '', type = 'warn' } = state.opts;
  const glyph = type === 'success' ? '✓' : '!';
  return (
    <div className="modal-bg" role="presentation" onClick={handleBgClick}>
      <div className="modal confirm-modal info-modal" role="dialog" aria-modal="true" aria-labelledby="dialogTitle" tabIndex={-1} ref={containerRef}>
        <div className="confirm-modal-h"><div></div><button type="button" className="modal-close" aria-label="Đóng hộp thoại" onClick={() => closeDialogOverlay()}>✕</button></div>
        {title ? <h3 className="confirm-modal-title" id="dialogTitle">{title}</h3> : null}
        <div className="confirm-modal-body">
          <div className={`confirm-modal-icon info-modal-icon ${type}`} aria-hidden="true">{glyph}</div>
          <div className="confirm-modal-text"><b id={title ? undefined : 'dialogTitle'}>{state.message}</b></div>
        </div>
        <div className="confirm-modal-actions">
          <button type="button" className="btn teal" onClick={() => closeDialogOverlay()}>Đã hiểu</button>
        </div>
      </div>
    </div>
  );
}
