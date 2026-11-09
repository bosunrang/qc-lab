import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export interface ConfirmOptions { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
/** `error`: thao tác thất bại (nền đỏ); `warn`: lưu ý/hướng dẫn trước khi làm
 * tiếp. Lưu thành công thì dùng `showToast()` (toast-store), trừ khi thông báo
 * có thông tin phải đọc kỹ (đường dẫn tệp, bước làm tiếp). */
export interface InfoOptions { title?: string; type?: 'warn' | 'success' | 'error' }
export interface ReauthOptions { title?: string; message?: string }
/** Hộp thoại nhiều hơn 2 đường đi (Huỷ + N lựa chọn) — `confirmDialog` chỉ có
 * đúng 2. Dựng khi bảng Mean/SD cần 3 đường: Huỷ / Dự kiến / Lưu và chuyển
 * lô. Trả `key` của nút được bấm, `null` nếu người dùng huỷ. */
export interface ChoiceOption { key: string; label: string; variant?: 'teal' | 'ghost' | 'danger'; hint?: string }
export interface ChoiceOptions { title?: string; message: string; options: ChoiceOption[]; cancelLabel?: string }
/** Hỏi một lý do bằng chữ trước khi làm tiếp (vd nhập lùi ngày làm đổi kết
 * luận lần chạy đã có). Trả lý do đã cắt khoảng trắng, `null` nếu huỷ. */
export interface ReasonOptions { title?: string; message: string; label?: string; minLength: number; confirmLabel?: string; placeholder?: string }

type DialogState =
  | { kind: 'none' }
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'info'; message: string; opts: InfoOptions; resolve: () => void }
  | { kind: 'reauth'; opts: ReauthOptions; resolve: (v: boolean) => void }
  | { kind: 'choice'; opts: ChoiceOptions; resolve: (v: string | null) => void }
  | { kind: 'reason'; opts: ReasonOptions; resolve: (v: string | null) => void };

interface DialogStoreShape { dialog: DialogState }

export const dialogStore = createStore<DialogStoreShape>(() => ({ dialog: { kind: 'none' } }));

export function useDialogState() {
  return useStore(dialogStore, (s) => s.dialog);
}

export function confirmDialog(message: string, opts: Omit<ConfirmOptions, 'message'> = {}): Promise<boolean> {
  return new Promise((resolve) => {
    dialogStore.setState({ dialog: { kind: 'confirm', opts: { message, ...opts }, resolve } });
  });
}

export function infoDialog(message: string, opts: InfoOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    dialogStore.setState({ dialog: { kind: 'info', message, opts, resolve } });
  });
}

/** Báo thao tác không thực hiện được — thường là `result.error.message`. */
export function errorDialog(message: string, opts: Omit<InfoOptions, 'type'> = {}): Promise<void> {
  return infoDialog(message, { ...opts, type: 'error' });
}

/** Mở dialog xác thực lại mật khẩu người dùng hiện tại — resolve true nếu
 * đúng mật khẩu, false nếu người dùng huỷ. Không throw khi sai mật khẩu, để
 * gọi ở dạng `if (!(await reauthDialog())) return;`. */
export function reauthDialog(opts: ReauthOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    dialogStore.setState({ dialog: { kind: 'reauth', opts, resolve } });
  });
}

export function choiceDialog(opts: ChoiceOptions): Promise<string | null> {
  return new Promise((resolve) => {
    dialogStore.setState({ dialog: { kind: 'choice', opts, resolve } });
  });
}

export function reasonDialog(opts: ReasonOptions): Promise<string | null> {
  return new Promise((resolve) => {
    dialogStore.setState({ dialog: { kind: 'reason', opts, resolve } });
  });
}

export function closeDialog(): void {
  dialogStore.setState({ dialog: { kind: 'none' } });
}


