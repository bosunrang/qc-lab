// Lọc, sắp xếp và chia trang bảng điểm Phân tích Westgard (đánh giá giao diện
// 09/11/2026). Mỗi mức có thể tới hàng trăm điểm, phần lớn "Đạt", nên vài
// dòng vi phạm bị chìm và chuyện gần nhất nằm cuối trang. Toàn bộ điểm vẫn có
// trên biểu đồ L-J phía trên; bảng mặc định chỉ hiện điểm có vi phạm, mới
// nhất trước. Chỉ đổi phần HIỂN THỊ: thống kê đầu bảng, xuất Excel/PDF vẫn
// dùng đủ mọi điểm.
import type { LevelAnalysis } from '../../../shared/qc-api';

type Point = LevelAnalysis['points'][number];

export type PointFilter = 'issues' | 'warn' | 'rej' | 'all';

export const POINT_FILTERS: readonly { key: PointFilter; label: string }[] = [
  { key: 'issues', label: 'Có vi phạm' },
  { key: 'warn', label: 'Cảnh báo' },
  { key: 'rej', label: 'Loại bỏ' },
  { key: 'all', label: 'Tất cả' },
];

export const POINT_PAGE_SIZE = 25;

/** Điểm thuộc lần chạy bị loại: tự nó Loại bỏ, hoặc mức khác cùng lần chạy
 * vi phạm (điểm không vào thống kê). */
const isRejected = (point: Point) => point.verdict === 'rej' || !!point.runRejected;
/** Cảnh báo không làm loại lần chạy, kể cả tín hiệu xu hướng CUSUM. */
const isWarning = (point: Point) => !isRejected(point) && (point.verdict === 'warn' || !!point.cusumSignal);

export function matchesFilter(point: Point, filter: PointFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'rej') return isRejected(point);
  if (filter === 'warn') return isWarning(point);
  return isRejected(point) || isWarning(point);
}

export function filterCounts(points: readonly Point[]): Record<PointFilter, number> {
  const counts: Record<PointFilter, number> = { issues: 0, warn: 0, rej: 0, all: points.length };
  for (const point of points) {
    if (isRejected(point)) counts.rej++;
    else if (isWarning(point)) counts.warn++;
  }
  counts.issues = counts.rej + counts.warn;
  return counts;
}

/** Bộ lọc đang áp: người dùng đã chọn thì theo lựa chọn đó; chưa chọn thì
 * "Có vi phạm", trừ khi không có vi phạm nào — khi đó hiện tất cả để bảng
 * không trống. */
export function effectiveFilter(chosen: PointFilter | null, counts: Record<PointFilter, number>): PointFilter {
  if (chosen) return chosen;
  return counts.issues > 0 ? 'issues' : 'all';
}

/** Dòng của một trang: điểm khớp bộ lọc, mới nhất trước. `seq` là số thứ tự
 * theo thời gian trong cả chuỗi (cột "#"), không đổi theo bộ lọc. */
export function pointRows(points: readonly Point[], filter: PointFilter, page: number, pageSize = POINT_PAGE_SIZE) {
  const matched = points.map((point, index) => ({ point, seq: index + 1 })).filter((row) => matchesFilter(row.point, filter)).reverse();
  const pageCount = Math.max(1, Math.ceil(matched.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return { rows: matched.slice((current - 1) * pageSize, current * pageSize), total: matched.length, page: current, pageCount };
}
