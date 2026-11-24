/** Giữ snapshot số; null chỉ là thiếu dữ liệu, không chặn nguồn hợp lệ. */
export function resolvePeriodTea(
  stored: { tea: number | null; teaLocked?: boolean },
  periodTea: number | null,
  bySource?: () => number | null,
  fallback?: () => number | null,
): number | null {
  // Bản trước từng ghi teaLocked cho cả null. Bỏ qua cờ đó khi chưa có số
  // để kỳ đang thiếu nhận được TEa mà không phải xoá rồi tạo lại.
  return stored.tea ?? bySource?.() ?? periodTea ?? fallback?.() ?? null;
}
