// Dòng báo thành công tự tắt (U8 của đánh giá 2026-10-31): lưu xong không bật
// hộp thoại chặn thao tác. Lỗi và cảnh báo vẫn đi qua `dialog-store`.
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export interface Toast { id: number; message: string }

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

export function showToast(message: string): void {
  const id = nextId++;
  toastStore.setState((s) => ({ toasts: [...s.toasts, { id, message }].slice(-MAX_TOASTS) }));
  setTimeout(() => dismissToast(id), toastDuration(message));
}
