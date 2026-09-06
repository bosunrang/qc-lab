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
  investigation?: unknown; causeCategory?: unknown; causeDescription?: unknown;
}
export interface PreparedNceCreate {
  testId: string; level: number | null; lot: string; date: string; pointId: string;
  rule: string; errorType: string; correction: string; dueDate: string;
  investigation: string; causeCategory: 'SE' | 'RE' | ''; causeDescription: string;
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

function cleanCauseCategory(value: unknown): 'SE' | 'RE' | '' {
  return value === 'SE' || value === 'RE' ? value : '';
}

export function validateNceCreate(input: NceCreateInput): ValidationResult<PreparedNceCreate> {
  const date = cleanText(input.date, 20).trim();
  if (!DATE_RE.test(date)) return { ok: false, code: 'invalid-date', message: 'Ngày ghi nhận sự cố không hợp lệ.' };
  const correction = cleanText(input.correction, 2000).trim();
  if (correction.length < 10) return { ok: false, code: 'missing-correction', message: 'Xử lý tức thời phải có ít nhất 10 ký tự.' };
  const dueDate = cleanText(input.dueDate, 20).trim();
  if (dueDate && !DATE_RE.test(dueDate)) return { ok: false, code: 'invalid-due-date', message: 'Hạn hoàn thành không hợp lệ.' };
  if (dueDate && dueDate < date) return { ok: false, code: 'due-before-date', message: 'Hạn hoàn thành không được trước ngày ghi nhận sự cố.' };
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
      investigation: cleanText(input.investigation, 4000).trim(),
      causeCategory: cleanCauseCategory(input.causeCategory),
      causeDescription: cleanText(input.causeDescription, 2000).trim(),
    },
  };
}

export interface NceReviewInput { id?: unknown; note?: unknown }
export interface PreparedNceReview { id: string; note: string }

export function validateNceReview(input: NceReviewInput, requireNote = false): ValidationResult<PreparedNceReview> {
  const id = cleanId(input.id);
  if (!id) return { ok: false, code: 'missing-id', message: 'Thiếu mã hồ sơ.' };
  const note = cleanText(input.note, 2000).trim();
  if (requireNote && note.length < 5) return { ok: false, code: 'missing-note', message: 'Phải nhập lý do (ít nhất 5 ký tự).' };
  return { ok: true, data: { id, note } };
}

export interface ReleaseDecisionInput { id?: unknown; decision?: unknown; note?: unknown }
export interface PreparedReleaseDecision { id: string; decision: 'held' | 'released'; note: string }

/** Quyết định release-to-service SAU KHI kết quả bệnh nhân bị giữ lại vì
 * nghi ngờ QC — "held" (tiếp tục giữ, chờ khắc phục) hay "released" (đã đủ
 * cơ sở phát hành) đều phải có lý do, không phải checkbox suông. */
export function validateReleaseDecision(input: ReleaseDecisionInput): ValidationResult<PreparedReleaseDecision> {
  const id = cleanId(input.id);
  if (!id) return { ok: false, code: 'missing-id', message: 'Thiếu mã hồ sơ.' };
  if (input.decision !== 'held' && input.decision !== 'released') {
    return { ok: false, code: 'invalid-decision', message: 'Chọn quyết định release-to-service.' };
  }
  const note = cleanText(input.note, 2000).trim();
  if (note.length < 5) return { ok: false, code: 'missing-note', message: 'Phải nhập cơ sở cho quyết định (ít nhất 5 ký tự).' };
  return { ok: true, data: { id, decision: input.decision, note } };
}

export interface RerunEvidenceInput { id?: unknown; rerunPointId?: unknown; note?: unknown }
export interface PreparedRerunEvidence { id: string; rerunPointId: string; note: string }

export function validateRerunEvidence(input: RerunEvidenceInput): ValidationResult<PreparedRerunEvidence> {
  const id = cleanId(input.id);
  if (!id) return { ok: false, code: 'missing-id', message: 'Thiếu mã hồ sơ.' };
  const rerunPointId = cleanId(input.rerunPointId);
  if (!rerunPointId) return { ok: false, code: 'missing-point', message: 'Chọn điểm QC rerun làm bằng chứng.' };
  return { ok: true, data: { id, rerunPointId, note: cleanText(input.note, 1000).trim() } };
}

export interface ResidualRiskInput { id?: unknown; status?: unknown; residualRisk?: unknown; note?: unknown }
export interface PreparedResidualRisk { id: string; status: 'effective' | 'ineffective'; residualRisk: string; note: string }

/** Đánh giá lại rủi ro còn lại BẮT BUỘC trước khi kết luận "hiệu quả" — kết
 * luận "không hiệu quả" không cần (sẽ mở vòng NCE tiếp theo, chưa đóng). */
export function validateResidualRisk(input: ResidualRiskInput): ValidationResult<PreparedResidualRisk> {
  const id = cleanId(input.id);
  if (!id) return { ok: false, code: 'missing-id', message: 'Thiếu mã hồ sơ.' };
  if (input.status !== 'effective' && input.status !== 'ineffective') {
    return { ok: false, code: 'invalid-status', message: 'Trạng thái hiệu lực không hợp lệ.' };
  }
  const residualRisk = cleanText(input.residualRisk, 2000).trim();
  if (input.status === 'effective' && residualRisk.length < 5) {
    return { ok: false, code: 'missing-residual-risk', message: 'Phải đánh giá rủi ro còn lại trước khi kết luận hiệu quả.' };
  }
  return { ok: true, data: { id, status: input.status, residualRisk, note: cleanText(input.note, 2000).trim() } };
}
