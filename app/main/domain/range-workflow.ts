import { stats, type StatsResult } from './westgard-engine';

export interface RangeCandidatePoint {
  date: string;
  val: number;
  verdict: 'ok' | 'warn' | 'rej';
}

export interface RangeCandidateStats extends StatsResult {
  days: number;
  rejected: number;
  warnings: number;
  eligible: boolean;
}

/** Điều kiện lập dải PXN của app cũ: dùng toàn bộ điểm còn hiệu lực của lô
 * đang vận hành; cần >=20 kết quả trên >=20 ngày độc lập, SD mẫu >0 và
 * không có điểm cảnh báo/loại bỏ chưa xử lý. Không tự bỏ điểm xấu để làm
 * đẹp Mean/SD đề xuất. */
export function evaluateRangeCandidate(points: readonly RangeCandidatePoint[]): RangeCandidateStats | null {
  const calculated = stats(points.map((point) => point.val));
  if (!calculated) return null;
  const days = new Set(points.map((point) => point.date)).size;
  const rejected = points.filter((point) => point.verdict === 'rej').length;
  const warnings = points.filter((point) => point.verdict === 'warn').length;
  return {
    ...calculated,
    days,
    rejected,
    warnings,
    eligible: calculated.n >= 20 && days >= 20 && rejected === 0 && warnings === 0 && calculated.sd > 0,
  };
}

export function validateRangeReason(value: unknown, minimum: number): string | null {
  const reason = String(value ?? '').trim();
  return reason.length >= minimum ? reason.slice(0, 1000) : null;
}
