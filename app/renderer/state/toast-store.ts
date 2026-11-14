// Thông báo thao tác tự tắt: lưu xong không chặn nhập tiếp. Màu cảnh báo QC
// đi theo kết luận; lỗi không lưu được vẫn qua `dialog-store` hoặc ngay ô nhập.
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export type ToastKind = 'ok' | 'warn' | 'rej';
export interface Toast { id: number; message: string; kind: ToastKind }

interface ToastStoreShape { toasts: Toast[] }

export const toastStore = createStore<ToastStoreShape>(() => ({ toasts: [] }));

/** Giữ tối đa 3 dòng; dòng cũ nhất nhường chỗ. */
const MAX_TOASTS = 3;
let nextId = 1;

/** Thời gian hiện theo độ dài câu: đủ đọc câu dài, câu ngắn không đứng lâu. */
export function toastDuration(message: string): number {
  return Math.min(8000, Math.max(4000, message.length * 60));
}

export function useToasts() {
  return useStore(toastStore, (s) => s.toasts);
}

export function dismissToast(id: number): void {
  toastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function showToast(message: string, kind: ToastKind = 'ok'): void {
  const id = nextId++;
  toastStore.setState((s) => ({ toasts: [...s.toasts, { id, message, kind }].slice(-MAX_TOASTS) }));
  setTimeout(() => dismissToast(id), toastDuration(message));
}
