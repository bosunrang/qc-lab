import type { ArchivedBlock, LevelAnalysis } from '../../shared/qc-api';

/** Shared selection for the visible table and its exports. */
export function displayedWestgardBlocks(
  levels: readonly { level: number; mean: number | null; sd: number | null; lot: string }[],
  analysis: Record<number, LevelAnalysis>, previous: readonly ArchivedBlock[],
  isPrevious: (level: number) => boolean,
) {
  return levels.map(level => {
    const old = isPrevious(level.level) ? previous.find(block => block.level === level.level) : undefined;
    return { level: level.level, lot: old?.lotNo ?? level.lot, mean: old?.mean ?? level.mean,
      sd: old?.sd ?? level.sd, analysis: old?.analysis ?? analysis[level.level], previous: !!old };
  });
}

export function observedStats(points: readonly { val: number; accepted: boolean; date?: string }[]) {
  const accepted = points.filter(point => point.accepted && Number.isFinite(point.val));
  const n = accepted.length, days = new Set(accepted.map(point => point.date).filter(Boolean)).size;
  const mean = n ? accepted.reduce((sum, point) => sum + point.val, 0) / n : null;
  const sd = n >= 2 && mean != null ? Math.sqrt(accepted.reduce((sum, point) => sum + (point.val - mean) ** 2, 0) / (n - 1)) : null;
  return { n, days, mean, sd, cv: sd != null && mean ? sd / Math.abs(mean) * 100 : null, provisional: n < 20 || days < 10 };
}

/** Do not render a small but nonzero SD as zero. */
export function statText(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const digits = Math.max(2, Math.min(6, decimals));
  return value !== 0 && Number(value.toFixed(digits)) === 0 ? value.toPrecision(3) : value.toFixed(digits);
}

export const WESTGARD_EXPORT_HEADERS = ['Mức', 'Lô', 'Ngày', 'Lần chạy', 'Giá trị', 'Mean đích', 'SD đích', 'Z', 'Kết luận điểm', 'Lần chạy bị loại', 'Dùng thống kê', 'Luật', 'Bằng chứng lịch sử'];
const verdictLabels: Record<string, string> = { ok: 'Đạt', warn: 'Cảnh báo', rej: 'Loại bỏ', none: 'Chưa đánh giá' };
export function westgardExportRows(blocks: ReturnType<typeof displayedWestgardBlocks>) {
  return blocks.flatMap(block => (block.analysis?.points || []).map(point => [
    `Mức ${block.level}`, block.lot, point.date.split('-').reverse().join('/'), point.runId, point.val,
    point.targetMean ?? '—', point.targetSd ?? '—', Number.isFinite(point.z) ? Number(point.z.toFixed(2)) : '—',
    verdictLabels[point.verdict] + (point.cusumSignal ? ' · Cảnh báo CUSUM' : ''),
    point.runRejected ? 'Có' : 'Không', point.accepted ? 'Có' : 'Không',
    [...point.rules, point.cusumSignal].filter(Boolean).join(', '), point.supportRules.join(', '),
  ]));
}

export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
