// Chọn mẫu ngoại kiểm làm Bias cho Six Sigma (docs/SIGMA-REVIEW-2026-11-17.md,
// SB-2..SB-6). Hàm thuần: main gom dữ liệu, hàm này chỉ lọc và tính.
import { eqaRoundsStats } from './sigma-metrics';

/** Giá trị mặc định chờ SOP của khoa. */
export const SIGMA_EQA_BIAS_RULES = { windowMonths: 3, minSamples: 3 } as const;

export interface SigmaEqaSample {
  resultId: string;
  /** Nhãn hiển thị: chương trình · đợt/năm · mẫu. */
  label: string;
  reportDate: string;
  result: number;
  assigned: number;
  /** Giá trị ấn định kém chắc chắn (u(x_pt) > 0,3·σp, N-05). */
  assignedUncertain: boolean;
  /** Nhóm nguyên nhân của hồ sơ NCE gắn với kết quả (nếu có). */
  ncCauseCategory: string;
}

export type SigmaEqaExclusion = 'after-period' | 'outside-window' | 'nce-cause' | 'assigned-uncertain' | 'invalid';
export const SIGMA_EQA_EXCLUSION_LABEL: Readonly<Record<SigmaEqaExclusion, string>> = {
  'after-period': 'Báo cáo sau kỳ Sigma',
  'outside-window': 'Báo cáo trước khoảng thời gian đã chọn',
  'nce-cause': 'Điều tra kết luận lỗi hành chính hoặc chương trình/mẫu',
  'assigned-uncertain': 'Giá trị ấn định kém chắc chắn',
  invalid: 'Thiếu kết quả hoặc giá trị ấn định',
};

export interface SigmaEqaBiasSelection {
  included: (SigmaEqaSample & { bias: number })[];
  excluded: (SigmaEqaSample & { reason: SigmaEqaExclusion })[];
  /** Trung bình có dấu (dùng cho Sigma), RMS (chỉ cho MU), sai số chuẩn. */
  mean: number | null; rms: number | null; sem: number | null; n: number;
  mixedSigns: boolean; enough: boolean;
  window: { start: string; end: string };
  windowMonths: number;
}

/** Ngày cuối tháng `YYYY-MM`. */
function monthEnd(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Ngày đầu của đủ `months` tháng báo cáo, không bị tràn ngày ở tháng nhuận. */
function windowStart(end: string, months: number): string {
  const [year, month] = end.split('-').map(Number);
  return new Date(Date.UTC(year, month - months, 1)).toISOString().slice(0, 10);
}

/** Nhận số tháng nguyên từ 1 trở lên; không áp trần tuỳ ý cho cửa sổ người dùng chọn. */
export function resolveSigmaEqaWindow(period: string, windowMonths: unknown = SIGMA_EQA_BIAS_RULES.windowMonths) {
  if (typeof windowMonths !== 'number' || !Number.isSafeInteger(windowMonths) || windowMonths < 1) throw new RangeError('Số tháng phải là số nguyên từ 1 trở lên.');
  const end = monthEnd(period);
  // Date.UTC tự kiểm giới hạn biểu diễn của lịch, kể cả khi số tháng rất lớn.
  const start = windowStart(end, windowMonths);
  return { windowMonths, window: { start, end } };
}

export function selectSigmaEqaBias(samples: readonly SigmaEqaSample[], options: { period: string; windowMonths?: number }): SigmaEqaBiasSelection {
  const { windowMonths, window: { start, end } } = resolveSigmaEqaWindow(options.period, options.windowMonths);
  const included: SigmaEqaBiasSelection['included'] = [];
  const excluded: SigmaEqaBiasSelection['excluded'] = [];
  for (const s of [...samples].sort((a, b) => b.reportDate.localeCompare(a.reportDate) || a.label.localeCompare(b.label, 'vi'))) {
    const reason: SigmaEqaExclusion | null =
      !Number.isFinite(s.result) || !Number.isFinite(s.assigned) || s.assigned === 0 ? 'invalid'
      : s.reportDate > end ? 'after-period'
      : s.reportDate < start ? 'outside-window'
      : ['eqa_administrative', 'eqa_program'].includes(s.ncCauseCategory) ? 'nce-cause'
      : s.assignedUncertain ? 'assigned-uncertain'
      : null;
    if (reason) excluded.push({ ...s, reason });
    else included.push({ ...s, bias: (s.result - s.assigned) / Math.abs(s.assigned) * 100 });
  }
  const stats = eqaRoundsStats(included.map((s) => s.bias));
  return {
    included, excluded, n: included.length,
    mean: stats?.mean ?? null, rms: stats?.rms ?? null, sem: stats?.biasSem ?? null,
    mixedSigns: stats?.mixedSigns ?? false, enough: included.length >= SIGMA_EQA_BIAS_RULES.minSamples,
    window: { start, end },
    windowMonths,
  };
}
