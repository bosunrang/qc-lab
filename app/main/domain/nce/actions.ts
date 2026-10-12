// Hành động khắc phục nhiều dòng và đánh giá hiệu lực (D-02, D-08).
// Mỗi hành động có người chịu trách nhiệm là một tài khoản, hạn, và chỉ hoàn
// thành được khi có bằng chứng. Đánh giá hiệu lực là bản ghi riêng, nhiều lần:
// "không hiệu quả" thì bổ sung hành động rồi đánh giá lại trong cùng hồ sơ.
import type { NceAction, NceActionKind, NceDossier, NceEffectivenessReview, NceValidation } from './types';
import { isOneOf, NCE_ACTION_KINDS, NCE_EFFECTIVENESS_RESULTS, NCE_RISK_LEVELS } from './types';
import { cleanDate, localDateOf, textLength } from './format';
import { nceRiskScore } from './tier';

export const NCE_ACTION_KIND_LABEL: Readonly<Record<NceActionKind, string>> = {
  corrective: 'Hành động khắc phục (loại bỏ nguyên nhân)',
  preventive: 'Phòng ngừa nguy cơ tương tự ở nơi khác',
  system_change: 'Thay đổi hệ thống (SOP, đào tạo, cấu hình)',
};

export interface NceActionDraft { kind: NceActionKind; description: string; ownerUserId: string; dueDate: string }

/** `detectedDate` là ngày phát hiện sự cố: hạn hành động không được trước đó. */
export function validateNceActionDraft(raw: unknown, detectedDate: string): NceValidation<NceActionDraft> {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (!isOneOf(NCE_ACTION_KINDS, input.kind)) return { ok: false, code: 'invalid-kind', message: 'Chọn loại hành động.' };
  const description = String(input.description ?? '').trim().slice(0, 2000);
  if (description.length < 10) return { ok: false, code: 'missing-description', message: 'Mô tả hành động ít nhất 10 ký tự.' };
  const ownerUserId = String(input.ownerUserId ?? '').trim();
  if (!ownerUserId) return { ok: false, code: 'missing-owner', message: 'Chọn người chịu trách nhiệm hành động.' };
  const dueDate = cleanDate(input.dueDate);
  if (!dueDate) return { ok: false, code: 'invalid-due-date', message: 'Hạn hoàn thành hành động không hợp lệ.' };
  if (dueDate < detectedDate) return { ok: false, code: 'due-before-detected', message: 'Hạn hành động không được trước ngày phát hiện sự cố.' };
  return { ok: true, data: { kind: input.kind, description, ownerUserId, dueDate } };
}

export interface NceActionCompletion { doneAt: string; evidence: string }

export function validateNceActionCompletion(action: Pick<NceAction, 'status'>, raw: unknown, detectedDate: string, today: string): NceValidation<NceActionCompletion> {
  if (action.status !== 'open') return { ok: false, code: 'action-not-open', message: 'Hành động đã hoàn thành hoặc đã hủy.' };
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const doneAt = cleanDate(input.doneAt);
  if (!doneAt) return { ok: false, code: 'invalid-done-date', message: 'Ngày hoàn thành không hợp lệ.' };
  if (doneAt < detectedDate || doneAt > today) return { ok: false, code: 'invalid-done-order', message: 'Ngày hoàn thành phải từ ngày phát hiện sự cố đến hôm nay.' };
  const evidence = String(input.evidence ?? '').trim().slice(0, 4000);
  if (evidence.length < 5) return { ok: false, code: 'missing-evidence', message: 'Ghi bằng chứng hoàn thành (mã phiếu, tài liệu, kết quả…), ít nhất 5 ký tự.' };
  return { ok: true, data: { doneAt, evidence } };
}

export function validateNceActionCancel(action: Pick<NceAction, 'status'>, reason: unknown): NceValidation<{ reason: string }> {
  if (action.status !== 'open') return { ok: false, code: 'action-not-open', message: 'Chỉ hủy được hành động chưa hoàn thành.' };
  const text = String(reason ?? '').trim().slice(0, 2000);
  return text.length < 10 ? { ok: false, code: 'missing-reason', message: 'Hủy hành động phải ghi lý do (ít nhất 10 ký tự).' } : { ok: true, data: { reason: text } };
}

/** Ngày hoàn thành muộn nhất trong các hành động đã xong; rỗng nếu chưa có. */
export function latestActionDoneDate(actions: readonly Pick<NceAction, 'status' | 'doneAt'>[]): string {
  return actions.filter((action) => action.status === 'done' && action.doneAt).map((action) => localDateOf(action.doneAt)).sort().at(-1) ?? '';
}

export type NceEffectivenessDraft = Omit<NceEffectivenessReview, 'reviewerUserId'>;

/** Kiểm một lần đánh giá hiệu lực mới. Phải có tiêu chí đặt TRƯỚC (D-08,
 * NCE-PLAN bước 7), ít nhất một hành động khắc phục đã xong, và ngày đánh giá
 * không trước ngày hoàn thành hành động cuối. Kết luận "hiệu quả" phải đánh
 * giá lại nguy cơ theo cùng thang và không cao hơn nguy cơ ban đầu. */
export function validateNceEffectivenessReview(
  raw: unknown,
  dossier: Pick<NceDossier, 'effectivenessCriteria' | 'actions' | 'riskSeverity' | 'riskProbability'>,
  today: string,
): NceValidation<NceEffectivenessDraft> {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (textLength(dossier.effectivenessCriteria) < 10) return { ok: false, code: 'missing-criteria', message: 'Phải ghi tiêu chí đánh giá hiệu lực trước khi đánh giá.' };
  if (!dossier.actions.some((action) => action.kind === 'corrective' && action.status === 'done')) {
    return { ok: false, code: 'no-done-action', message: 'Chưa có hành động khắc phục nào hoàn thành để đánh giá hiệu lực.' };
  }
  if (!isOneOf(NCE_EFFECTIVENESS_RESULTS, input.result)) return { ok: false, code: 'invalid-result', message: 'Chọn kết luận hiệu lực.' };
  const reviewedAt = cleanDate(input.reviewedAt);
  const lastDone = latestActionDoneDate(dossier.actions);
  if (!reviewedAt || reviewedAt > today) return { ok: false, code: 'invalid-review-date', message: 'Ngày đánh giá không hợp lệ hoặc ở tương lai.' };
  if (reviewedAt < lastDone) return { ok: false, code: 'review-before-action', message: 'Ngày đánh giá không được trước ngày hoàn thành hành động cuối cùng.' };
  const evidence = String(input.evidence ?? '').trim().slice(0, 4000);
  if (evidence.length < 10) return { ok: false, code: 'missing-evidence', message: 'Ghi bằng chứng đánh giá theo tiêu chí đã đặt (ít nhất 10 ký tự).' };
  const residualSeverity = Number(input.residualSeverity) || 0, residualProbability = Number(input.residualProbability) || 0;
  const residualLevel = isOneOf(NCE_RISK_LEVELS, input.residualLevel) ? input.residualLevel : '';
  const residualBasis = String(input.residualBasis ?? '').trim().slice(0, 2000);
  if (input.result === 'effective') {
    const residual = nceRiskScore(residualSeverity, residualProbability);
    if (!residual || !residualLevel || residualBasis.length < 5) return { ok: false, code: 'missing-residual', message: 'Kết luận hiệu quả phải đánh giá nguy cơ còn lại (mức độ, khả năng, phân loại và căn cứ).' };
    const initial = nceRiskScore(dossier.riskSeverity, dossier.riskProbability);
    if (initial && residual > initial) return { ok: false, code: 'residual-above-initial', message: 'Nguy cơ còn lại không được cao hơn nguy cơ ban đầu.' };
  }
  return { ok: true, data: { result: input.result, evidence, reviewedAt, residualSeverity, residualProbability, residualLevel, residualBasis } };
}
