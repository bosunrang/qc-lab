// Điểm nhận log dùng chung cho main process (kế hoạch kiến trúc G.2). Module
// này KHÔNG import `node:fs`: `ipc/operations.ts` gọi nó và cũng chạy trong
// bản xem trước qua trình duyệt, nơi Vite biến builtin của Node thành proxy
// ném lỗi ngay khi nạp module. `main/index.ts` gắn bộ ghi tệp thật lúc khởi
// động; chưa gắn (test, bản xem trước) thì `logEvent()` không làm gì.
import { redactText, redactValue } from '../domain/log-redact';

export type LogLevel = 'error' | 'warn' | 'info';

export interface LogEntry {
  level: LogLevel;
  /** Nơi phát sinh: `ipc`, `renderer`, `lan`, `main`, `app`. */
  source: string;
  message: string;
  /** Ngăn xếp lỗi hoặc dữ liệu kèm theo. Đã được che trước khi tới sink. */
  detail?: unknown;
}

let sink: ((entry: LogEntry) => void) | null = null;

export function setLogSink(next: ((entry: LogEntry) => void) | null): void {
  sink = next;
}

/** Ghi một sự kiện. Không bao giờ ném: lỗi của chính việc ghi log không được
 * làm hỏng thao tác đang chạy. */
export function logEvent(entry: LogEntry): void {
  if (!sink) return;
  try {
    sink({
      level: entry.level,
      source: entry.source,
      message: redactText(String(entry.message ?? '')),
      ...(entry.detail === undefined ? {} : { detail: redactValue(entry.detail) }),
    });
  } catch { /* bỏ qua lỗi ghi log */ }
}

/** Thông báo và ngăn xếp của một lỗi bất kỳ, dạng ghi log được. */
export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message || error.name, ...(error.stack ? { stack: error.stack } : {}) };
  return { message: typeof error === 'string' ? error : 'Lỗi không có mô tả' };
}
