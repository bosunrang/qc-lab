// Cổng dữ liệu chạy song song trước khi chấp nhận lô QC mới (N12).
//
// Mean/SD của lô mới phải dựa trên dữ liệu chính lô đó đo trên hệ thống của
// phòng xét nghiệm. CLSI C24-Ed4 và Westgard cho phép lập giá trị TẠM THỜI từ
// tối thiểu 10 kết quả ở các lần chạy khác nhau, rồi lập lại khi đủ 20 (cổng
// 20 kết quả / 20 ngày của `evaluateRangeCandidate()`). Ở đây đòi 10 kết quả
// trên 10 ngày khác nhau để giá trị tạm thời đã chứa biến thiên giữa ngày.
// Kết quả thuộc lần chạy bị loại không được đếm — cùng nguyên tắc N10: lần
// chạy hỏng bị bỏ khỏi phép tính, không chặn cả quy trình.

export const PARALLEL_MIN_RESULTS = 10;
export const PARALLEL_MIN_DAYS = 10;

export interface ParallelRunStats { n: number; days: number; rejected: number; enough: boolean }

export function parallelRunStats(points: readonly { date: string; verdict: string; runRejectedBy?: readonly unknown[] }[]): ParallelRunStats {
  const included = points.filter((point) => point.verdict !== 'rej' && !point.runRejectedBy?.length);
  const days = new Set(included.map((point) => point.date)).size;
  return {
    n: included.length, days, rejected: points.length - included.length,
    enough: included.length >= PARALLEL_MIN_RESULTS && days >= PARALLEL_MIN_DAYS,
  };
}

/** "Natri M1: 6 kết quả / 4 ngày, bỏ 1 điểm thuộc lần chạy bị loại". */
export function parallelStatsText(label: string, stats: ParallelRunStats): string {
  return `${label}: ${stats.n} kết quả / ${stats.days} ngày${stats.rejected ? `, bỏ ${stats.rejected} điểm thuộc lần chạy bị loại` : ''}`;
}
