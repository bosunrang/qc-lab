// Nhóm dữ liệu IQC phục vụ Six Sigma. CV phải được lấy từ các điểm QC cùng
// mức/cùng lô; không giới hạn theo tháng vì vòng đời lô có thể đi qua nhiều
// kỳ, nhưng một nhóm phải còn dữ liệu trong chính kỳ đang đánh giá.
export interface SigmaCohortPoint {
  level: number; date: string; lot: string; val: number; voided?: number;
  qc_mean?: number | null; qc_sd?: number | null;
}

export type SigmaCohortStatus = 'insufficient' | 'provisional' | 'eligible' | 'unstable';
export interface SigmaCohort {
  level: number; lot: string; n: number; cv: number | null; start: string; end: string;
  targetMean: number | null; targetSd: number | null; issues: string[];
  excluded: { voided: number; invalidValue: number }; status: SigmaCohortStatus;
}

/** `today` là THAM SỐ BẮT BUỘC, không có mặc định: mốc "hôm nay" phải theo
 * giờ địa phương (`main/domain/local-date.ts`), mà file này cố ý không import
 * module nào để test oracle nạp thẳng `.ts` qua ESM được. Để mặc định
 * `new Date().toISOString()` ở đây chính là chỗ đã lẻn vào ngày UTC. */
export function periodCutoff(period: string, today: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!match) return '';
  const end = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).toISOString().slice(0, 10);
  return end < today ? end : today;
}

export function cohortStatus(n: number, issues: string[]): SigmaCohortStatus {
  if (issues.length) return 'unstable';
  if (n < 20) return 'insufficient';
  if (n < 30) return 'provisional';
  return 'eligible';
}

function uniqueFinite(points: SigmaCohortPoint[], key: 'qc_mean' | 'qc_sd', positive = false): number[] {
  const values: number[] = [];
  for (const point of points) {
    const value = Number(point[key]);
    if (Number.isFinite(value) && (!positive || value > 0) && !values.some((item) => Object.is(item, value))) values.push(value);
  }
  return values;
}

export function buildSigmaCohorts(points: SigmaCohortPoint[], period: string, levels: number[], today: string): SigmaCohort[] {
  const cutoff = periodCutoff(period, today);
  const start = `${period}-01`;
  if (!cutoff) return [];
  const wanted = new Set(levels);
  const groups = new Map<string, SigmaCohortPoint[]>();
  for (const point of points) {
    if (!wanted.has(point.level) || point.date > cutoff) continue;
    const lot = String(point.lot || '').trim();
    const key = `${point.level}\u0000${lot}`;
    const rows = groups.get(key) || [];
    rows.push(point); groups.set(key, rows);
  }
  const out: SigmaCohort[] = [];
  for (const [key, rows] of groups) {
    const [levelText, lot] = key.split('\u0000');
    const excluded = { voided: 0, invalidValue: 0 };
    const valid: SigmaCohortPoint[] = [];
    for (const point of rows) {
      if (point.voided) { excluded.voided++; continue; }
      if (!Number.isFinite(Number(point.val))) { excluded.invalidValue++; continue; }
      valid.push(point);
    }
    valid.sort((a, b) => a.date.localeCompare(b.date));
    // Nhóm chỉ liên quan tới kỳ nếu có ít nhất một điểm từ đầu kỳ tới cutoff.
    if (!valid.some((point) => point.date >= start)) continue;
    const values = valid.map((point) => Number(point.val));
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const sd = values.length > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)) : 0;
    const targetMeans = uniqueFinite(valid, 'qc_mean');
    const targetSds = uniqueFinite(valid, 'qc_sd', true);
    const issues: string[] = [];
    if (!lot) issues.push('Thiếu mã lô QC');
    if (targetMeans.length > 1) issues.push('Mean mục tiêu thay đổi');
    if (targetSds.length > 1) issues.push('SD mục tiêu thay đổi');
    out.push({
      level: Number(levelText), lot, n: values.length,
      cv: mean ? sd / Math.abs(mean) * 100 : null,
      start: valid[0]?.date || '', end: valid[valid.length - 1]?.date || '',
      targetMean: targetMeans.length === 1 ? targetMeans[0] : null,
      targetSd: targetSds.length === 1 ? targetSds[0] : null,
      issues, excluded, status: cohortStatus(values.length, issues),
    });
  }
  return out.sort((a, b) => a.level - b.level || a.start.localeCompare(b.start) || a.lot.localeCompare(b.lot, 'vi'));
}
