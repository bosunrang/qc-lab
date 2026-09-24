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


