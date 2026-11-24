// Biên bản xem xét dữ liệu QC theo tháng (GV4 mục 2, ISO 15189:2022 7.3.7.2):
// PXN phải định kỳ xem xét dữ liệu nội kiểm để phát hiện xu hướng và sai số
// hệ thống mà luật Westgard từng lần chạy không bắt được. Hàm thuần: main tổng
// hợp số liệu, người có quyền `qc.config` đọc và ký kết luận.
//
// Không tự đặt ngưỡng đạt/không đạt cho CV hay độ dịch Mean: tiêu chí đó do
// PXN quy định trong SOP; biên bản đưa đủ số liệu để người xem xét kết luận.
import { cleanText } from './text-utils';
import { observedStats } from './observed-stats';

const YM_RE = /^\d{4}-\d{2}$/;

export type ReviewPointStatus = 'accepted' | 'rejected' | 'unevaluated';
export interface ReviewPoint { date: string; val: number; qcMean: number | null; qcSd: number | null; status: ReviewPointStatus }

export interface ReviewGroupStats {
  /** Kết quả chưa huỷ trong tháng. */
  n: number;
  /** Dùng thống kê (lần chạy không bị loại). */
  accepted: number;
  /** Thuộc lần chạy bị loại. */
  rejected: number;
  /** Chưa đánh giá được (mức chưa có Mean/SD hợp lệ). */
  unevaluated: number;
  /** Mean/SD/CV quan sát trên các kết quả được chấp nhận. */
  mean: number | null; sd: number | null; cv: number | null;
  /** Mean/SD đích lấy từ ảnh chụp trên điểm mới nhất của tháng. */
  targetMean: number | null; targetSd: number | null; targetCv: number | null;
  /** Đích đổi trong tháng (lập dải mới, hoàn dải): so sánh chỉ là tham khảo. */
  targetChanged: boolean;
  /** (Mean quan sát − Mean đích) / SD đích. */
  shiftSd: number | null;
  /** (Mean quan sát − Mean đích) / |Mean đích| × 100. */
  biasPct: number | null;
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function summarizeReviewGroup(points: readonly ReviewPoint[]): ReviewGroupStats {
  const accepted = points.filter((point) => point.status === 'accepted');
  const stats = observedStats(accepted);
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = [...sorted].reverse().find((point) => finite(point.qcMean) && finite(point.qcSd) && point.qcSd > 0);
  const targetMean = latest?.qcMean ?? null, targetSd = latest?.qcSd ?? null;
  const targets = new Set(points.filter((point) => finite(point.qcMean)).map((point) => `${point.qcMean}|${point.qcSd}`));
  return {
    n: points.length, accepted: accepted.length,
    rejected: points.filter((point) => point.status === 'rejected').length,
    unevaluated: points.filter((point) => point.status === 'unevaluated').length,
    mean: stats.mean, sd: stats.sd, cv: stats.cv,
    targetMean, targetSd, targetCv: targetMean && targetSd != null ? targetSd / Math.abs(targetMean) * 100 : null,
    targetChanged: targets.size > 1,
    shiftSd: stats.mean != null && targetMean != null && targetSd ? (stats.mean - targetMean) / targetSd : null,
    biasPct: stats.mean != null && targetMean ? (stats.mean - targetMean) / Math.abs(targetMean) * 100 : null,
  };
}

/** Các trường của một dòng biên bản mà chữ ký xác nhận. */
interface FingerprintRow {
  test_id?: unknown; level?: unknown; lot?: unknown; n?: unknown; accepted?: unknown; rejected?: unknown; unevaluated?: unknown;
  mean?: unknown; sd?: unknown; target_mean?: unknown; target_sd?: unknown; voided?: unknown; voided_rejected?: unknown;
}

/** Dấu vân tay số liệu QC mà một lần ký xác nhận (ISO 15189:2022 7.3.7.2,
 * 8.4): dùng để biết số liệu tháng có đổi sau lần ký cuối hay không. Chỉ gồm
 * số liệu QC theo xét nghiệm/mức/lô và số lần chạy bị loại. Không gồm tên xét
 * nghiệm hay máy (đổi tên không đổi số liệu), cũng không gồm hồ sơ NCE và việc
 * còn tồn (đóng hồ sơ là việc tiếp theo của kết luận, cổng khoá kỳ kiểm riêng).
 * Số thực làm tròn 12 chữ số để tính lại cùng dữ liệu luôn ra cùng chuỗi. */
export function reviewDataFingerprint(summary: { rows?: readonly FingerprintRow[]; totals?: { rejected_runs?: unknown } } | null | undefined): string {
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Number(value.toPrecision(12)) : null);
  const rows = (summary?.rows ?? []).map((row) => [
    String(row.test_id ?? ''), num(row.level), String(row.lot ?? ''), num(row.n), num(row.accepted), num(row.rejected), num(row.unevaluated),
    num(row.mean), num(row.sd), num(row.target_mean), num(row.target_sd), num(row.voided), num(row.voided_rejected),
  ]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify({ rows, rejectedRuns: num(summary?.totals?.rejected_runs) });
}

export const REVIEW_CONCLUSIONS = ['ok', 'monitor', 'action'] as const;
export type ReviewConclusion = typeof REVIEW_CONCLUSIONS[number];
export const REVIEW_CONCLUSION_LABELS: Record<ReviewConclusion, string> = {
  ok: 'Đạt — không cần hành động',
  monitor: 'Cần theo dõi thêm',
  action: 'Cần hành động khắc phục',
};

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

/** Kết luận "Cần theo dõi"/"Cần hành động" phải nói rõ theo dõi gì, làm gì. */
export function validateReviewSignature(input: { ym?: unknown; conclusion?: unknown; note?: unknown }, today: string): ValidationResult<{ ym: string; conclusion: ReviewConclusion; note: string }> {
  const ym = cleanText(input.ym, 7).trim();
  if (!YM_RE.test(ym)) return { ok: false, code: 'invalid-period', message: 'Kỳ phải có định dạng YYYY-MM.' };
  if (ym > today.slice(0, 7)) return { ok: false, code: 'future-period', message: 'Không ký xem xét cho tháng chưa tới.' };
  const conclusion = String(input.conclusion || '') as ReviewConclusion;
  if (!REVIEW_CONCLUSIONS.includes(conclusion)) return { ok: false, code: 'invalid-conclusion', message: 'Chọn kết luận xem xét.' };
  const note = cleanText(input.note, 2000).trim();
  if (conclusion !== 'ok' && note.length < 10) return { ok: false, code: 'note-required', message: 'Ghi rõ cần theo dõi hoặc khắc phục gì (tối thiểu 10 ký tự).' };
  return { ok: true, data: { ym, conclusion, note } };
}
