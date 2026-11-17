// Sửa nội dung hồ sơ NCE (thao tác `update`, chỉ khi trạng thái cho phép —
// `state.ts`). Chỉ nhận các trường trong danh sách dưới đây; nguồn, xét
// nghiệm, lần chạy và mọi quyết định không sửa qua đường này. Hàm trả đúng các
// trường có trong bản nháp, đã kiểm; `nceFieldChanges()` dựng phần chênh lệch
// để ghi lịch sử sửa đổi (sửa R-15).
import type { NceChecklistItem, NceDossier, NcePhase, NceValidation } from './types';
import { isOneOf, NCE_CAUSE_CATEGORIES, NCE_CAUSE_STATUSES, NCE_PHASES, NCE_RISK_LEVELS, NCE_TIERS } from './types';
import { cleanDate, localDateOf } from './format';
import { prepareChecklist } from './checklist';

export const NCE_EDITABLE_FIELDS = [
  'description', 'correction', 'holdResults', 'containmentNote', 'occurredNote', 'phase', 'ownerUserId', 'dueDate',
  'tier', 'tierReason', 'riskSeverity', 'riskProbability', 'riskLevel', 'riskBasis', 'checklist',
  'causeStatus', 'causeCategory', 'causeText', 'causeCheckPlan', 'effectivenessCriteria', 'effectivenessReviewDue',
] as const;
export type NceEditableField = typeof NCE_EDITABLE_FIELDS[number];

export type NceEditable = Pick<NceDossier, Exclude<NceEditableField, 'phase'>> & { phase: NcePhase };
export type NcePatch = Partial<NceEditable>;

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

function scale(value: unknown): number | null {
  const n = Number(value ?? 0);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : null;
}

/** Kiểm bản nháp sửa hồ sơ. `context.detectedAt` để chặn hạn trước ngày phát hiện. */
export function prepareNcePatch(raw: unknown, context: Pick<NceDossier, 'source' | 'detectedAt' | 'eqaLinked'>): NceValidation<NcePatch> {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const unknown = Object.keys(input).filter((key) => !(NCE_EDITABLE_FIELDS as readonly string[]).includes(key));
  if (unknown.length) return { ok: false, code: 'field-not-editable', message: `Không sửa được trường ${unknown.join(', ')} qua thao tác này.` };
  const has = (key: NceEditableField) => Object.prototype.hasOwnProperty.call(input, key);
  const out: NcePatch = {};
  const fail = (code: string, message: string): NceValidation<NcePatch> => ({ ok: false, code, message });

  if (has('description')) { out.description = text(input.description, 4000); if (out.description.length < 10) return fail('missing-description', 'Mô tả sự kiện ít nhất 10 ký tự.'); }
  if (has('correction')) { out.correction = text(input.correction, 4000); if (out.correction.length < 5) return fail('missing-correction', 'Xử lý tức thời ít nhất 5 ký tự.'); }
  if (has('containmentNote')) out.containmentNote = text(input.containmentNote, 4000);
  if (has('occurredNote')) out.occurredNote = text(input.occurredNote, 2000);
  if (has('holdResults')) { if (typeof input.holdResults !== 'boolean') return fail('invalid-hold', 'Chọn có dừng/giữ kết quả liên quan hay không.'); out.holdResults = input.holdResults; }
  if (has('phase')) { if (!isOneOf(NCE_PHASES, input.phase)) return fail('invalid-phase', 'Giai đoạn quá trình không hợp lệ.'); out.phase = input.phase; }
  if (has('ownerUserId')) { out.ownerUserId = text(input.ownerUserId, 80); if (!out.ownerUserId) return fail('missing-owner', 'Chọn người phụ trách hồ sơ.'); }
  if (has('dueDate')) {
    out.dueDate = cleanDate(input.dueDate);
    if (!out.dueDate) return fail('invalid-due-date', 'Hạn hoàn thành không hợp lệ.');
    if (out.dueDate < context.detectedAt) return fail('due-before-detected', 'Hạn hoàn thành không được trước ngày phát hiện.');
  }
  if (has('tier')) { if (input.tier !== '' && !isOneOf(NCE_TIERS, input.tier)) return fail('invalid-tier', 'Tầng xử lý không hợp lệ.'); out.tier = input.tier as NcePatch['tier']; }
  if (has('tierReason')) out.tierReason = text(input.tierReason, 2000);
  for (const key of ['riskSeverity', 'riskProbability'] as const) {
    if (!has(key)) continue;
    const n = scale(input[key]);
    if (n === null) return fail('invalid-risk-scale', 'Mức độ và khả năng xảy ra chấm từ 1 đến 5.');
    out[key] = n;
  }
  if (has('riskLevel')) { if (input.riskLevel !== '' && !isOneOf(NCE_RISK_LEVELS, input.riskLevel)) return fail('invalid-risk-level', 'Phân loại nguy cơ không hợp lệ.'); out.riskLevel = input.riskLevel as NcePatch['riskLevel']; }
  if (has('riskBasis')) out.riskBasis = text(input.riskBasis, 2000);
  if (has('checklist')) out.checklist = prepareChecklist(context.source, input.checklist, context.eqaLinked);
  if (has('causeStatus')) { if (input.causeStatus !== '' && !isOneOf(NCE_CAUSE_STATUSES, input.causeStatus)) return fail('invalid-cause-status', 'Kết luận nguyên nhân không hợp lệ.'); out.causeStatus = input.causeStatus as NcePatch['causeStatus']; }
  if (has('causeCategory')) { if (input.causeCategory !== '' && !isOneOf(NCE_CAUSE_CATEGORIES, input.causeCategory)) return fail('invalid-cause-category', 'Nhóm nguyên nhân không hợp lệ.'); out.causeCategory = input.causeCategory as NcePatch['causeCategory']; }
  if (has('causeText')) out.causeText = text(input.causeText, 4000);
  if (has('causeCheckPlan')) out.causeCheckPlan = text(input.causeCheckPlan, 4000);
  if (has('effectivenessCriteria')) out.effectivenessCriteria = text(input.effectivenessCriteria, 2000);
  if (has('effectivenessReviewDue')) {
    const raw = text(input.effectivenessReviewDue, 20);
    out.effectivenessReviewDue = raw ? cleanDate(raw) : '';
    if (raw && !out.effectivenessReviewDue) return fail('invalid-review-due', 'Ngày dự kiến đánh giá hiệu lực không hợp lệ.');
  }
  return { ok: true, data: out };
}

function same(a: unknown, b: unknown): boolean {
  if (a && b && typeof a === 'object' && typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

/** `{ trường: [trước, sau] }` cho các trường thật sự đổi; rỗng thì không có gì để ghi. */
export function nceFieldChanges(current: Partial<NceEditable>, patch: NcePatch): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {};
  for (const [key, value] of Object.entries(patch) as [NceEditableField, unknown][]) {
    if (!same(current[key], value)) changes[key] = [current[key] ?? null, value];
  }
  return changes;
}

/** Checklist rỗng theo nguồn, dùng khi lập hồ sơ. */
export function emptyChecklist(source: NceDossier['source'], eqaLinked = false): Record<string, NceChecklistItem> { return prepareChecklist(source, {}, eqaLinked); }

/** Đính chính hành chính riêng, không cho sửa ngày qua patch nội dung chung.
 * Thời điểm lập/quyết định và ngày QC gốc tuyệt đối không đổi. */
export function prepareNceDetectedAtCorrection(raw: unknown, dossier: NceDossier, createdAt: string, today: string): NceValidation<{ detectedAt: string; reason: string }> {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const detectedAt = cleanDate(input.detectedAt), reason = text(input.reason, 2000);
  const fail = (code: string, message: string): NceValidation<never> => ({ ok: false, code, message });
  if (dossier.status !== 'open' || dossier.release) return fail('status', 'Chỉ đính chính ngày phát hiện khi hồ sơ chưa được cho hoạt động trở lại.');
  if (!detectedAt || detectedAt > today || (localDateOf(createdAt) && detectedAt > localDateOf(createdAt))) return fail('invalid-detected', 'Ngày phát hiện phải có thật, không sau ngày lập hồ sơ hoặc ở tương lai.');
  if (reason.length < 10) return fail('missing-date-correction-reason', 'Ghi lý do và căn cứ đính chính ngày phát hiện (ít nhất 10 ký tự).');
  const trigger = dossier.runs.find((run) => run.role === 'trigger');
  if (trigger && detectedAt < trigger.snapshot.date) return fail('detected-before-run', 'Ngày phát hiện không được trước ngày chạy QC gây sự cố.');
  const boundaries = [dossier.dueDate, dossier.effectivenessReviewDue, ...dossier.actions.flatMap((action) => action.status === 'cancelled' ? [] : [action.dueDate, localDateOf(action.doneAt)])].filter(Boolean);
  if (boundaries.some((date) => date < detectedAt)) return fail('detected-after-related-date', 'Ngày phát hiện mới sau hạn hoặc ngày hoàn thành đang có. Rà soát các mốc liên quan trước khi đính chính.');
  return { ok: true, data: { detectedAt, reason } };
}
