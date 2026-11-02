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
  /** Số ngày độc lập của các điểm ĐƯỢC TÍNH (không thuộc lần chạy bị loại). */
  days: number;
  /** Số điểm thuộc lần chạy bị loại — đã bỏ khỏi phép tính. */
  rejected: number;
  warnings: number;
  eligible: boolean;
}

/** Dải PXN đề xuất (CLSI C24-Ed4): Mean/SD tính trên kết quả của các lần chạy
 * KHÔNG bị loại; lần chạy bị loại chỉ bị bỏ khỏi phép tính, không chặn việc
 * lập dải. Vẫn đòi ≥ 20 kết quả trên ≥ 20 ngày độc lập, đếm trên chính các
 * điểm được tính. Cảnh báo (1-2s) là dao động bình thường nên vẫn được tính.
 *
 * Trước 2026-11-02 một lần chạy bị loại bất kỳ chặn lập dải vĩnh viễn (N10),
 * đẩy người dùng sang huỷ điểm để "làm sạch" dữ liệu (N4). */
export function evaluateRangeCandidate(points: readonly RangeCandidatePoint[]): RangeCandidateStats | null {
  const isRejected = (point: RangeCandidatePoint) => point.runRejected || point.verdict === 'rej';
  const included = points.filter((point) => !isRejected(point));
  const calculated = stats(included.map((point) => point.val));
  if (!calculated) return null;
  const days = new Set(included.map((point) => point.date)).size;
  return {
    ...calculated,
    days,
    rejected: points.length - included.length,
    warnings: included.filter((point) => point.verdict === 'warn').length,
    eligible: calculated.n >= 20 && days >= 20 && calculated.sd > 0,
  };
}

/** Ngưỡng cảnh báo khi Mean/SD nhập tay lệch khỏi dải đề xuất (tính từ dữ
 * liệu quan sát). Đây là ngưỡng nội bộ để làm nổi bật, không phải giá trị
 * của chuẩn nào: CLSI C24-Ed4 chỉ yêu cầu giới hạn kiểm soát dựa trên SD quan
 * sát, và SD tay rộng hơn nhiều làm luật Westgard gần như không còn bắt lỗi. */
export const MANUAL_SD_RATIO_LIMIT = 1.5;
export const MANUAL_MEAN_SHIFT_LIMIT_SD = 1;

export interface ManualRangeDeviation {
  /** SD tay / SD quan sát. */
  sdRatio: number;
  /** |Mean tay − Mean quan sát| tính theo số SD quan sát. */
  meanShiftSd: number;
  exceeds: boolean;
}

export function manualRangeDeviation(proposed: { mean: number; sd: number }, manual: { mean: number; sd: number }): ManualRangeDeviation | null {
  if (!(proposed.sd > 0) || !(manual.sd > 0) || !Number.isFinite(proposed.mean) || !Number.isFinite(manual.mean)) return null;
  const sdRatio = manual.sd / proposed.sd;
  const meanShiftSd = Math.abs(manual.mean - proposed.mean) / proposed.sd;
  return { sdRatio, meanShiftSd, exceeds: sdRatio > MANUAL_SD_RATIO_LIMIT || meanShiftSd > MANUAL_MEAN_SHIFT_LIMIT_SD };
}

export function validateRangeReason(value: unknown, minimum: number): string | null {
  const reason = String(value ?? '').trim();
  return reason.length >= minimum ? reason.slice(0, 1000) : null;
}


