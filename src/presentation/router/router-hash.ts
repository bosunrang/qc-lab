/* Giai đoạn 6 (Router chuẩn, 2026-08-30) — thay biến `page` toàn cục (chỉ
   sống trong bộ nhớ, mất khi tải lại trang, không back/forward được) bằng
   điều hướng có URL thật, dùng hash (`#/entry`) thay vì path: ứng dụng là
   một file tĩnh (chạy qua file://, Electron, hoặc HTTP server bất kỳ, xem
   CLAUDE.md "Running it"), không có route phía server để trả lại
   index.html cho một đường dẫn tuỳ ý — hash là cơ chế DUY NHẤT hoạt động ở
   cả ba môi trường mà không cần cấu hình rewrite. Không thêm thư viện router
   (react-router...) vì đây là 11 trang PHẲNG, không route lồng nhau/tham số
   động — đúng mức tối giản mà CLAUDE.md đã chọn cho các phụ thuộc khác
   (zustand là ngoại lệ duy nhất, có lý do rõ). Hai hàm thuần, không đụng DOM,
   để dễ test và dùng lại từ cả `modular-pilot.global.ts` lẫn (nếu cần sau
   này) từ react-pilot.js. */
export function pageIdFromHash(hash: string): string {
  return String(hash || '').replace(/^#\/?/, '').trim();
}

export function hashForPage(id: string): string {
  return `#/${id}`;
}
