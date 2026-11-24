// Báo "phiên đăng nhập đã kết thúc" từ lớp gọi API lên store đăng nhập (GV5).
// Máy trạm LAN nhận 401 khi tài khoản bị khoá, bị xoá, đổi mật khẩu hoặc phiên
// hết hạn; app phải quay về màn đăng nhập thay vì để trang vỡ vì dữ liệu lỗi.
// Dùng sự kiện của `window` để `lan/http-api.ts` không phụ thuộc vào store.

export const SESSION_ENDED_EVENT = 'qclab:session-ended';

export const SESSION_ENDED_MESSAGE = 'Phiên đăng nhập đã kết thúc (hết hạn, tài khoản bị khoá hoặc mật khẩu vừa đổi). Vui lòng đăng nhập lại.';

export function announceSessionEnded(): void {
  window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
}

export function onSessionEnded(listener: () => void): () => void {
  // Test chạy store trong Node, nơi không có `window`.
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SESSION_ENDED_EVENT, listener);
  return () => window.removeEventListener(SESSION_ENDED_EVENT, listener);
}
