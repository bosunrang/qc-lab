import { cleanId, cleanText, finiteNumber } from './text-utils';

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;


export const TEA_LAB_SOURCES = ['regulation', 'pt', 'eflm', 'ricos', 'professional', 'other'] as const;

/** Nhãn tiếng Việt cho từng khoá — dùng để ghi audit log đọc được, thay vì
 * chỉ ghi khoá thô ('pt', 'eflm'...). Khớp đúng nhãn renderer hiển thị
 * trong `<select>` (`TEA_LAB_SOURCE_OPTIONS` ở `TeaRefsTab.tsx`). */
export const TEA_LAB_SOURCE_LABELS: Record<string, string> = {
  regulation: 'Quy định pháp lý / CLIA / quốc gia',
  pt: 'Chương trình ngoại kiểm / PT',
  eflm: 'EFLM Biological Variation',
  ricos: 'Ricos / Westgard BV (nguồn cũ)',
  professional: 'Hiệp hội / ủy ban chuyên môn',
  other: 'Nguồn khác đã thẩm định',
};

export interface TeaRefInput {
  analyteId?: unknown; name?: unknown; unit?: unknown; section?: unknown;
  labValue?: unknown; labSource?: unknown; reference?: unknown; sourceUrl?: unknown; reason?: unknown;
  effectiveDate?: unknown; approvedDate?: unknown; nextReviewDate?: unknown;
  preparedBy?: unknown; approvedBy?: unknown;
  levelValues?: unknown;
}

export interface PreparedTeaRefLevel { level: number; tea: number }

export interface PreparedTeaRef {
  analyteId: string; name: string; unit: string; section: string;
  labValue: number | null; levelValues: PreparedTeaRefLevel[]; labSource: string; reference: string; sourceUrl: string; reason: string;
  effectiveDate: string; approvedDate: string; nextReviewDate: string;
  preparedBy: string; approvedBy: string;
}

export function prepareTeaRef(input: TeaRefInput = {}): PreparedTeaRef {
  const effectiveDate = cleanText(input.effectiveDate, 10).trim();
  const approvedDate = cleanText(input.approvedDate, 10).trim();
  const nextReviewDate = cleanText(input.nextReviewDate, 10).trim();
  const rawLabValue = String(input.labValue ?? '').trim();
  const rawLevels = Array.isArray(input.levelValues) ? input.levelValues.slice(0, 200) : [];
  return {
    analyteId: cleanId(input.analyteId),
    name: cleanText(input.name, 200).trim(),
    unit: cleanText(input.unit, 60).trim(),
    section: cleanText(input.section, 200).trim(),
    labValue: rawLabValue === '' ? null : finiteNumber(rawLabValue, NaN),
    levelValues: rawLevels.map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      // Ô bỏ trống phải thành NaN (không phải 0) để báo đúng mức còn thiếu.
      const rawTea = String(row.tea ?? '').trim();
      return { level: finiteNumber(row.level, NaN), tea: rawTea === '' ? NaN : finiteNumber(rawTea, NaN) };
    }),
    labSource: cleanText(input.labSource, 200).trim(),
    reference: cleanText(input.reference, 500).trim(),
    sourceUrl: cleanText(input.sourceUrl, 500).trim(),
    reason: cleanText(input.reason, 1000).trim(),
    effectiveDate: DATE_RE.test(effectiveDate) ? effectiveDate : '',
    approvedDate: DATE_RE.test(approvedDate) ? approvedDate : '',
    nextReviewDate: DATE_RE.test(nextReviewDate) ? nextReviewDate : '',
    preparedBy: cleanText(input.preparedBy, 200).trim(),
    approvedBy: cleanText(input.approvedBy, 200).trim(),
  };
}

/** 6 điều kiện bắt buộc, y hệt thứ tự kiểm tra của `teaLabProfileSave()` bản
 * cũ — giữ đúng thứ tự để thông báo lỗi hiện ra khớp với thói quen người
 * dùng cũ (sửa lỗi đầu tiên trước, không nhảy cóc). */
export function validateTeaRef(input: TeaRefInput): ValidationResult<PreparedTeaRef> {
  const cleaned = prepareTeaRef(input);
  if (!cleaned.name) return { ok: false, code: 'missing-name', message: 'Nhập tên xét nghiệm.' };
  if (cleaned.labValue != null && (!Number.isFinite(cleaned.labValue) || cleaned.labValue <= 0)) {
    return { ok: false, code: 'invalid-value', message: 'TEa chung phải là số dương.' };
  }
  const seenLevels = new Set<number>();
  for (const row of cleaned.levelValues) {
    if (!Number.isInteger(row.level) || row.level <= 0) {
      return { ok: false, code: 'invalid-level-value', message: 'Mức QC của TEa theo mức không hợp lệ.' };
    }
    if (!Number.isFinite(row.tea) || row.tea <= 0) {
      return { ok: false, code: 'invalid-level-value', message: `Nhập TEa mức ${row.level} là số dương, hoặc bỏ chọn mức đó.` };
    }
    if (seenLevels.has(row.level)) return { ok: false, code: 'duplicate-level', message: `Mức ${row.level} chỉ được khai một giá trị TEa.` };
    seenLevels.add(row.level);
  }
  if (cleaned.labValue == null && !cleaned.levelValues.length) {
    return { ok: false, code: 'invalid-value', message: 'Nhập TEa chung hoặc ít nhất một giá trị TEa theo mức QC.' };
  }
  if (!cleaned.labSource) return { ok: false, code: 'missing-source', message: 'Chọn nguồn TEa.' };
  if (!(TEA_LAB_SOURCES as readonly string[]).includes(cleaned.labSource)) {
    return { ok: false, code: 'invalid-source', message: 'Nguồn TEa không hợp lệ.' };
  }
  if (cleaned.reference.length < 3) return { ok: false, code: 'invalid-reference', message: 'Tham chiếu cần ít nhất 3 ký tự.' };
  // Link nguồn mở được từ app (trang Cấu hình chung) nên chỉ nhận http(s).
  // "Nguồn khác đã thẩm định" không nằm trong danh mục chuẩn nào, nên bắt buộc
  // có link để người xem xét mở lại đúng tài liệu đã dùng.
  if (cleaned.sourceUrl && !/^https?:\/\/[^\s]+$/i.test(cleaned.sourceUrl)) {
    return { ok: false, code: 'invalid-source-url', message: 'Link nguồn phải bắt đầu bằng http:// hoặc https://.' };
  }
  if (cleaned.labSource === 'other' && !cleaned.sourceUrl) {
    return { ok: false, code: 'missing-source-url', message: 'Nguồn khác đã thẩm định cần có link tới tài liệu nguồn.' };
  }
  if (cleaned.reason.length < 10) return { ok: false, code: 'invalid-reason', message: 'Lý do cần ít nhất 10 ký tự.' };
  if (!cleaned.effectiveDate || !cleaned.approvedDate) {
    return { ok: false, code: 'missing-dates', message: 'Nhập đủ ngày hiệu lực và ngày duyệt.' };
  }
  if (cleaned.approvedDate > cleaned.effectiveDate) {
    return { ok: false, code: 'approved-after-effective', message: 'Ngày duyệt không được sau ngày hiệu lực.' };
  }
  if (cleaned.nextReviewDate && cleaned.nextReviewDate < cleaned.effectiveDate) {
    return { ok: false, code: 'review-before-effective', message: 'Ngày xem lại kế tiếp không được trước ngày hiệu lực.' };
  }
  if (!cleaned.preparedBy || !cleaned.approvedBy) {
    return { ok: false, code: 'missing-signoff', message: 'Nhập đủ người chuẩn bị và người duyệt.' };
  }
  return { ok: true, data: cleaned };
}


