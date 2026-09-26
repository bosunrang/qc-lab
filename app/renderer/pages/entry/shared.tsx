// Phần dùng chung giữa các khối của trang Nhập QC: hằng hiển thị, hàm thuần
// định dạng và kiểu cột nhập. Tách khỏi `EntryPage.tsx` (2026-09-26, kế hoạch
// kiến trúc D.6) cùng lúc với các khối con.
import { pointZ } from '../../../main/domain/westgard-engine';
import { vnDate as formatVnDate } from '../../lib/format';
import type { QcChartPoint } from '../../components/QcChart';
import type { QcPointView } from '../../../shared/qc-api';

export const VERDICT_LABEL: Record<string, string> = { ok: 'Đạt', warn: 'Cảnh báo', rej: 'Loại bỏ', none: 'Chưa đánh giá' };

/** Nhãn phụ cho điểm KHÔNG vào Mean/SD/CV thực mà TỰ NÓ không vi phạm: cả
 * lần chạy bị loại vì một mức khác (`acceptedRunPoints()` loại theo run).
 * Không có nhãn này thì điểm hiện "Đạt" rồi lặng lẽ bị trừ khỏi n — người
 * dùng đếm 11 chấm trên hình mà thống kê ghi n=9 và không có cách nào biết
 * vì sao. Điểm tự bị loại đã có nhãn "Loại bỏ" nên không lặp lại ở đây. */
export function runExcludedNote(point: QcPointView): string | null {
  const by = point.runRejectedBy || [];
  if (point.accepted !== false || point.verdict === 'rej' || !by.length) return null;
  return `Lần chạy bị loại ở ${by.map((level) => `Mức ${level}`).join(', ')}`;
}

export const vnDate = (iso: string) => formatVnDate(iso, iso || '—');
export function pad2(n: number): string { return String(n).padStart(2, '0'); }

export type EntryColumn = {
  key: string; level: number; lot: string; mean: number | null; sd: number | null; exp: string;
  parallel: boolean; applied: 'mfg' | 'lab'; points: QcPointView[]; chartPoints: QcChartPoint[];
};
export type DisplayColumn = EntryColumn & { previous: boolean };

/** Giá trị QC in theo số thập phân của xét nghiệm, không dùng định dạng mặc định của JS. */
export function formatQcValue(val: number, decimals: number): string {
  return val.toFixed(decimals);
}

/** z-score của một điểm: `+0.40s` / `-1.20s` (có dấu, hậu tố 's').
 *
 * Dùng `pointZ()` của main — ĐÚNG quy tắc Westgard dùng khi kết luận: Mean/SD
 * đã CHỐT lúc nhập (`qc_mean`/`qc_sd`, phải đủ cả cặp) rồi mới tới Mean/SD
 * đang gán của mức. Lấy thẳng Mean/SD hiện hành thì sau một lần đổi dải,
 * cùng một điểm hiện "Z = +3,80s · Đạt" — Z nói theo dải mới còn kết luận
 * vẫn theo dải cũ. */
export function zText(point: QcPointView, level: { mean: number | null; sd: number | null }): string {
  const z = pointZ({ val: point.val, qcMean: point.qc_mean, qcSd: point.qc_sd }, level.mean, level.sd);
  if (!Number.isFinite(z)) return '—';
  return `${z >= 0 ? '+' : ''}${z.toFixed(2)}s`;
}

/** Lọc điểm theo cửa sổ Từ/Đến của biểu đồ. Ô trống = không giới hạn đầu tương ứng. */
export function inLjWindow<T extends { date: string }>(points: T[], ljFrom: string, ljTo: string): T[] {
  return points.filter((p) => (!ljFrom || p.date >= ljFrom) && (!ljTo || p.date <= ljTo));
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="m6.5 7 .8 13h9.4l.8-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}
