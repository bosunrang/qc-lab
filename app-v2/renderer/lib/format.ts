// Định dạng dùng chung cho lớp trình bày. Trước 2026-09-03, `vnDate()` được
// viết lại ở 4 file trang (ActionsPage/WestgardPage/ManagePage/manage/
// HistoryTab) với 3 hành vi fallback KHÁC NHAU khi chuỗi không phải ngày ISO
// — `'—'`, `value`, hoặc `''`. Gom về một hàm nhưng GIỮ tham số `fallback` để
// từng chỗ gọi vẫn hiện đúng như trước (đổi fallback là đổi hiển thị, không
// phải refactor thuần).

/** ISO `yyyy-mm-dd` (chấp cả chuỗi có phần giờ phía sau) → `dd/mm/yyyy`.
 * Chuỗi không khớp trả `fallback`; mặc định trả lại chính chuỗi vào. */
export function vnDate(value: string | null | undefined, fallback?: string): string {
  const text = value || '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return fallback === undefined ? text : fallback;
}
