// Validate cho ho so khac phuc su co (NCE/CAPA) - pham vi rut gon cho giai
// doan dau (chua co protocol-v3 day du FMEA S/O/D, chua co gate "chua hieu
// luc chan khep vong" - de danh cho dot sau khi module nay on dinh). Tham
// khao cac gate chinh tu action-form-controller.ts/action-workflow-status.ts
// ban cu: bat buoc co xu ly tuc thoi (correction) va han hoan thanh.
import { cleanId, cleanText } from './text-utils';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface NceCreateInput {
  testId?: unknown; level?: unknown; lot?: unknown; date?: unknown; pointId?: unknown;
  rule?: unknown; errorType?: unknown; correction?: unknown; dueDate?: unknown;
}
export interface PreparedNceCreate {
  testId: string; level: number | null; lot: string; date: string; pointId: string;
  rule: string; errorType: string; correction: string; dueDate: string;
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export function validateNceCreate(input: NceCreateInput): ValidationResult<PreparedNceCreate> {
  const date = cleanText(input.date, 20).trim();
  if (!DATE_RE.test(date)) return { ok: false, code: 'invalid-date', message: 'Ngay ghi nhan su co khong hop le.' };
  const correction = cleanText(input.correction, 2000).trim();
  if (correction.length < 10) return { ok: false, code: 'missing-correction', message: 'Xu ly tuc thoi phai co it nhat 10 ky tu.' };
  const dueDate = cleanText(input.dueDate, 20).trim();
  if (dueDate && !DATE_RE.test(dueDate)) return { ok: false, code: 'invalid-due-date', message: 'Han hoan thanh khong hop le.' };
  if (dueDate && dueDate < date) return { ok: false, code: 'due-before-date', message: 'Han hoan thanh khong duoc truoc ngay ghi nhan su co.' };
  return {
    ok: true,
    data: {
      testId: cleanId(input.testId),
      level: input.level == null || input.level === '' ? null : Math.round(Number(input.level)),
      lot: cleanText(input.lot, 80).trim(),
      date,
      pointId: cleanId(input.pointId),
      rule: cleanText(input.rule, 200).trim(),
      errorType: cleanText(input.errorType, 120).trim(),
      correction,
      dueDate,
    },
  };
}

export interface NceReviewInput { id?: unknown; note?: unknown }
export interface PreparedNceReview { id: string; note: string }

export function validateNceReview(input: NceReviewInput, requireNote = false): ValidationResult<PreparedNceReview> {
  const id = cleanId(input.id);
  if (!id) return { ok: false, code: 'missing-id', message: 'Thieu ma ho so.' };
  const note = cleanText(input.note, 2000).trim();
  if (requireNote && note.length < 5) return { ok: false, code: 'missing-note', message: 'Phai nhap ly do (it nhat 5 ky tu).' };
  return { ok: true, data: { id, note } };
}
