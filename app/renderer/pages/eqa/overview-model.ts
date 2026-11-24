// Mô hình trình bày chỉ tổng hợp xếp loại main đã trả về, không đánh giá lại z.
import type { EqaInstrumentGridRow, EqaRoundRow } from '../../../shared/qc-api';
import type { EqaSelection } from './useEqaScope';

export type EqaOverviewFilter = 'all' | 'ok' | 'warn' | 'rej' | 'attention';

/** Mỗi dòng là một máy trong đợt; bộ lọc trống giữ tất cả máy riêng biệt. */
export function overviewRoundRows(rounds: readonly EqaRoundRow[], year: number, programId: string, instrumentId: string) {
  return rounds.filter((round) => round.year === year && round.program_id === programId).flatMap((round) =>
    round.by_instrument.filter((item) => !instrumentId || item.instrument_id === instrumentId).map((instrument) => ({ round, instrument })));
}

export function overviewTotals(rows: readonly EqaInstrumentGridRow[]) {
  const cells = rows.flatMap((row) => row.cells);
  const ok = cells.filter((cell) => cell.class === 'ok').length;
  const warn = cells.filter((cell) => cell.class === 'warn').length;
  const rej = cells.filter((cell) => cell.class === 'rej').length;
  return { total: cells.length, ok, warn, rej, acceptPct: cells.length ? 100 * ok / cells.length : null };
}

export function filterOverviewRows(rows: readonly EqaInstrumentGridRow[], filter: EqaOverviewFilter) {
  return filter === 'all' ? rows : rows.filter((row) => row.cells.some((cell) => filter === 'attention'
    ? cell.class === 'warn' || cell.class === 'rej' : cell.class === filter));
}

/** Chỉ mở chi tiết khi URL chỉ đúng một ô thuộc phạm vi hiện tại. */
export function overviewSelection(rows: readonly EqaInstrumentGridRow[], rounds: readonly EqaRoundRow[], params: URLSearchParams): EqaSelection | undefined {
  const row = rows.find((item) => item.test_id === params.get('assay'));
  const roundId = params.get('round');
  if (!row || !rounds.some((round) => round.id === roundId)) return undefined;
  const point = params.get('point');
  const cell = row.cells.find((item) => item.result_id === point && item.round_id === roundId);
  if (point && !cell) return undefined;
  return { testId: row.test_id, roundId: roundId!, resultId: cell?.result_id, sample: cell?.sample ?? params.get('sample') ?? '' };
}

/** Mỗi mẫu một đường riêng; thiếu một đợt thì ngắt đường, không lấp dữ liệu. */
export function overviewSparkline(row: EqaInstrumentGridRow, rounds: readonly EqaRoundRow[], extent = Math.max(3.5, ...row.cells.map((cell) => Math.abs(cell.z)))) {
  const samples = [...new Set(row.cells.map((cell) => cell.sample))];
  const series = samples.map((sample) => {
    let connected = false;
    let path = '';
    const points = rounds.flatMap((round, index) => {
      const cell = row.cells.find((item) => item.round_id === round.id && item.sample === sample);
      if (!cell || !Number.isFinite(cell.z)) { connected = false; return []; }
      const x = rounds.length > 1 ? 6 + 100 * index / (rounds.length - 1) : 56;
      const y = 20 - 16 * cell.z / extent;
      path += `${connected ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)} `;
      connected = true;
      return [{ ...cell, x, y }];
    });
    return { sample, path, points };
  });
  return series;
}
