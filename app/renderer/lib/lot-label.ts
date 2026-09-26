// Số lô ĐANG GÁN cho một mức QC, hiện cạnh tên mức ở Nhập QC và Westgard (kế
// hoạch kiến trúc D.8 — trước đây mỗi trang một bản chép). Chưa gán lô, hoặc
// lô không còn trong danh mục, thì hiện "—".
export function lotNoOfLevel(
  levels: readonly { level: number; qc_lot_id?: string | null }[],
  lots: readonly { id: string; lot_no: string }[],
  level: number,
): string {
  const lv = levels.find((l) => l.level === level);
  const lot = lv?.qc_lot_id ? lots.find((l) => l.id === lv.qc_lot_id) : null;
  return lot?.lot_no || '—';
}
