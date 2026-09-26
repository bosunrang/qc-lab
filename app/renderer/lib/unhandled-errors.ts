// Báo cho người dùng khi một thao tác hỏng mà không chỗ nào bắt lỗi: promise
// bị từ chối không có `catch` (vd một lệnh đọc IPC lỗi trong store) và lỗi ném
// ra trong trình xử lý sự kiện (`onClick`…) — hai loại mà `PageErrorBoundary`
// không bắt được. Trước đây các lỗi này chỉ nằm trong console: nút bấm im
// lặng, người dùng không biết thao tác đã không xong.
import { dialogStore, infoDialog } from '../state/dialog-store';

/** Lỗi trình duyệt tự phát, vô hại, không phải lỗi của thao tác. */
const BENIGN = [/ResizeObserver loop/i];

export function unhandledMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message || reason.name;
  if (typeof reason === 'string') return reason;
  return 'không có mô tả';
}

/** Gửi lỗi về main để ghi vào tệp log của máy chính (kế hoạch G.2). Không
 * bao giờ ném hay để lại promise bị từ chối: lỗi của chính bước báo lỗi không
 * được sinh thêm một lỗi không được bắt nữa. Máy trạm LAN không có kênh này
 * (main trả `unknown-operation`), nên ở đó lệnh gọi không làm gì. */
export function sendClientError(reason: unknown): void {
  try {
    const stack = reason instanceof Error ? reason.stack : undefined;
    void window.qcApi?.reportClientError?.({ message: unhandledMessage(reason), ...(stack ? { stack } : {}) })?.catch(() => {});
  } catch { /* bỏ qua */ }
}

export interface UnhandledReporterDeps {
  /** Có hộp thoại nào đang mở không. */
  dialogOpen: () => boolean;
  show: (message: string) => void;
  log: (...args: unknown[]) => void;
  /** Ghi vào tệp log của máy chính. */
  report?: (reason: unknown) => void;
}

const defaultDeps: UnhandledReporterDeps = {
  dialogOpen: () => dialogStore.getState().dialog.kind !== 'none',
  show: (message) => { void infoDialog(message, { title: 'Thao tác không hoàn tất', type: 'warn' }); },
  log: (...args) => console.error(...args),
  report: sendClientError,
};

/** Ghi console và, nếu không có hộp thoại nào đang mở, hiện một thông báo.
 * Không mở đè: `infoDialog` thay hộp thoại hiện tại, nên một hộp xác nhận
 * đang chờ sẽ mất `resolve` và thao tác đang đợi nó treo mãi. */
export function reportUnhandled(reason: unknown, deps: UnhandledReporterDeps = defaultDeps): void {
  const message = unhandledMessage(reason);
  if (BENIGN.some((pattern) => pattern.test(message))) return;
  deps.log('Lỗi không được xử lý', reason);
  deps.report?.(reason);
  if (deps.dialogOpen()) return;
  deps.show(`Có lỗi xảy ra: ${message}. Dữ liệu đã lưu không bị ảnh hưởng; hãy thử lại hoặc tải lại ứng dụng.`);
}

export function installUnhandledErrorReporting(target: Window = window): void {
  target.addEventListener('unhandledrejection', (event) => reportUnhandled(event.reason));
  target.addEventListener('error', (event) => reportUnhandled(event.error ?? event.message));
}
