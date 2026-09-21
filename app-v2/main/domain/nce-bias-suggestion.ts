import type { SigmaLevelResult, SigmaPeriodView } from '../../shared/qc-api';

/** Dữ liệu tối thiểu cần đọc từ một kỳ Sigma; tránh tạo bản sao hợp đồng
 * riêng cho NCE khi nguồn thật đã là `SigmaPeriodView`. */
type NceBiasPeriod = Pick<SigmaPeriodView, 'period'> & {
  levels: ReadonlyArray<Pick<SigmaLevelResult, 'level' | 'biasEqa'>>;
};

export interface NceBiasSuggestion { value: number; period: string }

export function latestNceSigmaBias(periods: readonly NceBiasPeriod[], level: number): NceBiasSuggestion | null {
  if (!Number.isFinite(level) || level <= 0) return null;
  const latest = periods.reduce<NceBiasPeriod | null>((current, period) =>
    !current || period.period.localeCompare(current.period) > 0 ? period : current,
  null);
  const value = latest?.levels.find((item) => item.level === level)?.biasEqa;
  return latest && value != null && Number.isFinite(value) ? { value, period: latest.period } : null;
}
