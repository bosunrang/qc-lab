import { stats, type StatsResult } from './westgard-engine';

export interface RangeCandidatePoint {
  date: string;
  val: number;
  verdict: 'ok' | 'warn' | 'rej';
  /** Lần chạy chứa điểm này có bị loại không — KỂ CẢ khi chính điểm này đạt
   * mà một MỨC KHÁC trong cùng lần chạy vi phạm. Bỏ trống thì rơi về verdict
   * riêng của điểm (hợp đồng cũ). */
  runRejected?: boolean;
}

export interface RangeCandidateStats extends StatsResult {
  days: number;
  rejected: number;
  warnings: number;
  eligible: boolean;
}

/** Điều kiện lập dải PXN: dùng toàn bộ điểm còn hiệu lực của lô đang vận
 * hành; cần >=20 kết quả trên >=20 ngày độc lập, SD mẫu >0 và không có LẦN
 * CHẠY nào bị loại. Không tự bỏ điểm xấu để làm đẹp Mean/SD đề xuất — cổng
 * đóng, chứ không lặng lẽ lọc.
 *
 * Hai điểm ĐÃ SỬA 23/09/2026 so với bản port từ app cũ, đều theo CLSI
 * C24-Ed4 ("dải riêng của phòng xét nghiệm lập từ dữ liệu IN-CONTROL của tối
 * thiểu 20 ngày"):
 *
 * 1. `rejected` đếm theo LẦN CHẠY, không theo verdict riêng của mức. Một
 *    điểm nằm trong lần chạy đã hỏng vì mức khác vi phạm KHÔNG phải dữ liệu
 *    in-control, dù bản thân nó đẹp — cùng nguyên tắc `acceptedRunPoints()`.
 *
 * 2. `warnings` KHÔNG còn nằm trong `eligible`. Với giới hạn ±2SD, dữ liệu
 *    in-control chuẩn PHẢI có ~4,6% điểm nằm ngoài, nên đòi bằng 0 là đòi
 *    một thứ thống kê không cho phép tồn tại: xác suất đạt là 0,9545^n —
 *    39% ở n=20, 25% ở n=30, 6% ở n=60. Càng gom nhiều dữ liệu càng khó lập
 *    dải, ngược hẳn ý đồ "20 kết quả / 20 ngày". `1-2s` theo Westgard là
 *    luật CẢNH BÁO, không phải căn cứ loại bỏ. Outlier thật vẫn bị chặn:
 *    điểm vượt ±3SD nổ `1-3s` nên rơi vào `rejected`. Con số vẫn được trả
 *    về để hiển thị, chỉ không còn chặn. */
export function evaluateRangeCandidate(points: readonly RangeCandidatePoint[]): RangeCandidateStats | null {
  const calculated = stats(points.map((point) => point.val));
  if (!calculated) return null;
  const days = new Set(points.map((point) => point.date)).size;
  const rejected = points.filter((point) => point.runRejected || point.verdict === 'rej').length;
  const warnings = points.filter((point) => point.verdict === 'warn').length;
  return {
    ...calculated,
    days,
    rejected,
    warnings,
    eligible: calculated.n >= 20 && days >= 20 && rejected === 0 && calculated.sd > 0,
  };
}

export function validateRangeReason(value: unknown, minimum: number): string | null {
  const reason = String(value ?? '').trim();
  return reason.length >= minimum ? reason.slice(0, 1000) : null;
}
