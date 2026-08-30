import { createStore } from 'zustand/vanilla';
import { getKernel } from '../state/kernel';

/**
 * Thay confirmDialog()/infoDialog() cũ (dialog-overlay-controller.ts, dựng
 * chuỗi HTML rồi gán innerHTML vào #dialogRoot) bằng store Zustand thuần +
 * component React thật (DialogOverlay.tsx), render qua createPortal — bước
 * đầu của Giai đoạn 3 (modal → React portal). Store này CHỈ sống trong
 * react-pilot.js — không qua window.__QC_KERNEL__ — vì cả hai phía gọi nó
 * (confirmDialog/infoDialog xuất ra ngoài qua window.QCLabReact cho
 * modular-pilot.js gọi, và DialogOverlay tự đọc bằng useStore) đều nằm
 * trong CÙNG bundle này.
 */
export type ConfirmOpts = { kicker?: string; title?: string; message?: string; detail?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
export type InfoOpts = { title?: string; type?: 'warn' | 'success' };

export type ReauthOpts = { title?: string; message?: string };

export type DialogState =
  | { kind: 'none' }
  | { kind: 'confirm'; opts: ConfirmOpts; resolve: (result: boolean) => void }
  | { kind: 'info'; message: string; opts: InfoOpts; resolve: () => void }
  | { kind: 'reauth'; title: string; message: string; accountLabel: string; resolve: (ok: boolean) => void };

export const dialogStore = createStore<DialogState>(() => ({ kind: 'none' }));

/* Giống hệt bản cũ: chỉ một hộp thoại loại này mở cùng lúc — mở cái mới
   trong lúc cái cũ chưa đóng thì Promise của cái cũ không bao giờ resolve
   (bị bỏ quên), đúng hành vi "chỉ giữ một resolver" của bản gốc. */
export function confirmDialog(opts: ConfirmOpts = {}): Promise<boolean> {
  return new Promise<boolean>(resolve => { dialogStore.setState({ kind: 'confirm', opts, resolve }); });
}

export function infoDialog(message: string, opts: InfoOpts = {}): Promise<void> {
  return new Promise<void>(resolve => { dialogStore.setState({ kind: 'info', message, opts, resolve }); });
}

/* reauthenticateCurrentUser() thay bản cũ (root.reauthenticateCurrentUser
   trong modular-pilot.global.ts, đã xóa) — cổng xác thực lại trước các thao
   tác quan trọng (duyệt/trả NCE, khóa/mở kỳ báo cáo, đổi Mean/SD, chuyển
   tiếp lô, xóa sạch dữ liệu...). Logic xác minh mật khẩu (PBKDF2) VẪN nằm
   bên modular-pilot.js (root.reauthVerify) — React chỉ nhận kết quả
   đúng/sai, không bao giờ thấy passHash. */
export function reauthenticateCurrentUser(opts: ReauthOpts = {}): Promise<boolean> {
  const { title = 'Xác thực lại', message = 'Nhập lại mật khẩu để tiếp tục.' } = opts;
  const accountLabel = getKernel().pres.reauthAccountLabel();
  if (accountLabel === null) return Promise.resolve(false);
  return new Promise<boolean>(resolve => { dialogStore.setState({ kind: 'reauth', title, message, accountLabel, resolve }); });
}

export function closeDialogOverlay(result?: unknown): void {
  const s = dialogStore.getState();
  if (s.kind === 'confirm' || s.kind === 'reauth') s.resolve(!!result);
  else if (s.kind === 'info') s.resolve();
  dialogStore.setState({ kind: 'none' });
}
