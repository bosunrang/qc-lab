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

/** ISO `yyyy-mm-dd` → `dd/mm`, dùng cho nhãn trục biểu đồ có không gian hẹp. */
export function vnDayMonth(value: string | null | undefined, fallback?: string): string {
  const text = value || '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) return `${match[3]}/${match[2]}`;
  return fallback === undefined ? text : fallback;
}

/** Hôm nay theo GIỜ ĐỊA PHƯƠNG, dạng ISO `yyyy-mm-dd`.
 * `new Date().toISOString().slice(0,10)` cho ngày UTC — ở VN (UTC+7) từ 00:00
 * tới 07:00 nó vẫn là NGÀY HÔM TRƯỚC, làm ca QC sáng sớm bị đánh dấu sai
 * (hàng "Hôm nay"/vệt cam "thiếu QC" của bảng nhập, bộ lọc NCE quá hạn).
 * Cùng nguyên tắc giờ địa phương đã chốt cho LIS Gateway. */
export function todayIso(at: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}


