// Cổng của từng bước hồ sơ NCE (kế hoạch mục 5). Mỗi hàm trả danh sách còn
// thiếu bằng tiếng Việt; rỗng là qua cổng. Quyền và tính độc lập của người
// thao tác nằm ở `permissions.ts`, không lặp lại ở đây.
import type { NceDossier, NceMissing, NcePhase, NceRunKey, NceSource, NceValidation } from './types';
import { isOneOf, NCE_PHASES, NCE_SOURCES } from './types';
import { cleanDate, compareRun, textLength } from './format';
import { checklistMissing } from './checklist';
import { nceRiskScore, nceTierMissing } from './tier';
import { ncePatientImpactCoverageMissing, ncePatientImpactMissing, type NceSuspectWindow } from './patient-impact';
import { nceTechnicalAssessmentMissing } from './technical-assessment';
import { latestActionDoneDate, nceEffectivenessBasis } from './actions';
import type { NceRerunResult } from './rerun';
import { NCE_DRAFT_BLANK } from './containment-draft';

// ---------------------------------------------------------------- 5.1 Tạo

export interface NceCreateDraft {
  source: NceSource; phase: NcePhase; testId: string | null; trigger: NceRunKey | null;
  description: string; correction: string; holdResults: boolean;
  detectedAt: string; ownerUserId: string; dueDate: string;
}

/** Kiểm dữ liệu lập hồ sơ. Với IQC chỉ nhận khoá lần chạy; xét nghiệm, mức,
 * lô, luật và verdict do main tự đọc từ lần chạy (sửa R-08). `dueDate` rỗng
 * thì handler đặt hạn mặc định theo cấu hình. */
export function validateNceCreate(raw: unknown, today: string): NceValidation<NceCreateDraft> {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (!isOneOf(NCE_SOURCES, input.source)) return { ok: false, code: 'invalid-source', message: 'Chọn nguồn phát hiện sự cố.' };
  const source = input.source;
  const phase = isOneOf(NCE_PHASES, input.phase) ? input.phase : 'exam';
  const testId = String(input.testId ?? '').trim() || null;
  let trigger: NceRunKey | null = null;
  if (source === 'iqc') {
    const run = input.trigger && typeof input.trigger === 'object' ? input.trigger as Record<string, unknown> : {};
    const date = cleanDate(run.date), runId = String(run.runId ?? '').trim();
    if (!testId || !date) return { ok: false, code: 'missing-trigger', message: 'Sự cố nội kiểm phải gắn một lần chạy QC bị loại.' };
    trigger = { date, runId };
  }
  const description = String(input.description ?? '').trim().slice(0, 4000);
  if (description.length < 10) return { ok: false, code: 'missing-description', message: 'Mô tả sự kiện và yêu cầu không được đáp ứng (ít nhất 10 ký tự).' };
  const correction = String(input.correction ?? '').trim().slice(0, 4000);
  if (correction.length < 5) return { ok: false, code: 'missing-correction', message: 'Ghi xử lý tức thời đã thực hiện (ít nhất 5 ký tự).' };
  if (typeof input.holdResults !== 'boolean') return { ok: false, code: 'missing-hold', message: 'Chọn có dừng/giữ kết quả liên quan hay không.' };
  const detectedAt = cleanDate(input.detectedAt);
  if (!detectedAt || detectedAt > today) return { ok: false, code: 'invalid-detected', message: 'Ngày phát hiện không hợp lệ hoặc ở tương lai.' };
  if (trigger && detectedAt < trigger.date) return { ok: false, code: 'detected-before-run', message: 'Ngày phát hiện không được trước ngày chạy QC bị loại.' };
  const ownerUserId = String(input.ownerUserId ?? '').trim();
  if (!ownerUserId) return { ok: false, code: 'missing-owner', message: 'Chọn người phụ trách hồ sơ.' };
  const rawDue = String(input.dueDate ?? '').trim(), dueDate = cleanDate(rawDue);
  if (rawDue && !dueDate) return { ok: false, code: 'invalid-due-date', message: 'Hạn hoàn thành không hợp lệ.' };
  if (dueDate && dueDate < detectedAt) return { ok: false, code: 'due-before-detected', message: 'Hạn hoàn thành không được trước ngày phát hiện.' };
  return { ok: true, data: { source, phase, testId, trigger, description, correction, holdResults: input.holdResults, detectedAt, ownerUserId, dueDate } };
}

// ---------------------------------------------------- 5.2 Cho chạy lại

export interface NceReleaseDraft { notApplicable: boolean; reason: string; rerun: NceRunKey | null; lotChangeNote: string }

export function validateNceReleaseInput(raw: unknown, source: NceSource): NceValidation<NceReleaseDraft> {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const reason = String(input.reason ?? '').trim().slice(0, 2000);
  const lotChangeNote = String(input.lotChangeNote ?? '').trim().slice(0, 2000);
  if (source === 'iqc') {
    const run = input.rerun && typeof input.rerun === 'object' ? input.rerun as Record<string, unknown> : {};
    const date = cleanDate(run.date);
    if (!date) return { ok: false, code: 'missing-rerun', message: 'Chọn lần chạy QC rerun làm bằng chứng.' };
    if (reason.length < 5) return { ok: false, code: 'missing-reason', message: 'Ghi căn cứ cho phép hoạt động trở lại (ít nhất 5 ký tự).' };
    return { ok: true, data: { notApplicable: false, reason, rerun: { date, runId: String(run.runId ?? '').trim() }, lotChangeNote } };
  }
  // Nguồn khác IQC: ghi căn cứ trở lại hoạt động, hoặc xác nhận không phải
  // dừng dịch vụ; cả hai đều là một quyết định có người chịu trách nhiệm. Có
  // thể kèm một lần chạy QC xác minh để bắt đầu lại chuỗi Westgard/CUSUM.
  if (reason.length < 10) return { ok: false, code: 'missing-reason', message: 'Ghi căn cứ cho phép hoạt động trở lại hoặc lý do không cần dừng dịch vụ (ít nhất 10 ký tự).' };
  const run = input.rerun && typeof input.rerun === 'object' ? input.rerun as Record<string, unknown> : null;
  const date = run ? cleanDate(run.date) : '';
  if (run && !date) return { ok: false, code: 'invalid-rerun', message: 'Lần chạy QC xác minh không hợp lệ.' };
  const rerun = run && date ? { date, runId: String(run.runId ?? '').trim() } : null;
  return { ok: true, data: { notApplicable: !rerun && input.notApplicable === true, reason, rerun, lotChangeNote: '' } };
}

/** Còn thiếu gì để cho chạy lại. `rerun` là kết quả `checkNceRerun()` cho lần
 * chạy ứng viên (chỉ với IQC; `null` khi chưa chọn). `suspect` là khoảng nghi
 * ngờ main tính tới lần rerun ứng viên, để kiểm quyết định ảnh hưởng bệnh nhân
 * bao phủ đúng khoảng đó (`undefined` chỉ dùng trong test thuần không có dữ
 * liệu QC). Không đòi hành động khắc phục đã xong (D-02, sửa R-01). */
export function nceReleaseMissing(
  dossier: Pick<NceDossier, 'status' | 'source' | 'patientImpacts' | 'technicalAssessments' | 'runs' | 'holdResults' | 'containmentNote' | 'checklist' | 'eqaLinked' | 'causeCategory'>,
  rerun: NceRerunResult | null,
  suspect?: NceSuspectWindow | null,
): NceMissing[] {
  if (dossier.status !== 'open') return [{ code: 'status', message: 'Chỉ cho chạy lại hồ sơ đang xử lý.' }];
  const missing: NceMissing[] = [];
  if (dossier.holdResults === null) missing.push({ code: 'hold', message: 'Chưa ghi có dừng/giữ kết quả liên quan hay không.' });
  missing.push(...checklistMissing(dossier.source, dossier.checklist, dossier.eqaLinked));
  if (dossier.source === 'iqc') {
    if (dossier.holdResults === false) missing.push({ code: 'hold-iqc', message: 'Nội kiểm ngoài kiểm soát phải dừng/giữ kết quả liên quan cho đến khi đánh giá xong.' });
    if (textLength(dossier.containmentNote) < 10) missing.push({ code: 'containment', message: 'Ghi phạm vi kết quả đã giữ, thiết bị/khu vực bị ảnh hưởng và người đã được thông báo.' });
    else if (dossier.containmentNote.includes(NCE_DRAFT_BLANK)) missing.push({ code: 'containment-blank', message: `Bổ sung các chỗ ${NCE_DRAFT_BLANK} trong phạm vi kiểm soát và thông báo (giữ kết quả từ lúc nào, đã báo cho ai).` });
    // Diễn biến/mốc thời gian: app tự dựng từ dữ liệu đã lưu (domain/nce/timeline.ts,
    // quyết định 10/11/2026), ô ghi thêm là tuỳ chọn nên không còn là cổng.
    if (!dossier.runs.some((run) => run.role === 'trigger')) missing.push({ code: 'no-trigger', message: 'Hồ sơ nội kiểm chưa gắn lần chạy bị loại.' });
    missing.push(...nceTechnicalAssessmentMissing(dossier));
    if (!rerun) missing.push({ code: 'missing-rerun', message: 'Chưa chốt bằng chứng QC rerun bằng quyết định cho hoạt động trở lại.' });
    else missing.push(...rerun.problems);
  } else if (rerun) missing.push(...rerun.problems);
  missing.push(...ncePatientImpactMissing(dossier.patientImpacts, dossier.source, dossier));
  missing.push(...ncePatientImpactCoverageMissing(dossier.patientImpacts.at(-1), suspect ?? null));
  return missing;
}

// ------------------------------------------------------- 5.4 Nộp duyệt

/** Nội dung hồ sơ có đủ để nộp duyệt không — dùng cho cả nộp (5.4) lẫn kiểm
 * lại khi duyệt (5.5). Không kiểm trạng thái. `suspect`: khoảng nghi ngờ tính
 * trên dữ liệu QC hiện tại tới lần rerun đã chốt; dữ liệu đổi sau khi cho
 * chạy lại thì quyết định ảnh hưởng bệnh nhân phải được ghi lại. */
export function nceContentMissing(dossier: NceDossier, suspect?: NceSuspectWindow | null): NceMissing[] {
  const missing: NceMissing[] = [];
  const add = (code: string, message: string) => missing.push({ code, message });
  if (!dossier.ownerUserId) add('owner', 'Chưa có người phụ trách.');
  if (!cleanDate(dossier.dueDate)) add('due-date', 'Chưa có hạn hoàn thành hợp lệ.');
  if (!dossier.release) add('release', 'Chưa có quyết định cho phép hoạt động trở lại.');
  if (!nceRiskScore(dossier.riskSeverity, dossier.riskProbability) || !dossier.riskLevel) add('risk', 'Chưa đánh giá nguy cơ ban đầu (mức độ, khả năng xảy ra, phân loại).');
  else if (textLength(dossier.riskBasis) < 5) add('risk-basis', 'Ghi căn cứ phân loại nguy cơ theo SOP.');
  missing.push(...checklistMissing(dossier.source, dossier.checklist, dossier.eqaLinked));
  if (dossier.eqaLinked) {
    if (dossier.causeStatus !== 'undetermined' && !['eqa_administrative', 'eqa_technical', 'eqa_program'].includes(dossier.causeCategory)) add('cause-eqa-category', 'Phân loại nguyên nhân ngoại kiểm: hành chính, kỹ thuật hoặc chương trình/mẫu.');
    missing.push(...ncePatientImpactMissing(dossier.patientImpacts, dossier.source, dossier));
  }
  missing.push(...nceTechnicalAssessmentMissing(dossier));
  missing.push(...nceTierMissing(dossier));
  missing.push(...ncePatientImpactCoverageMissing(dossier.patientImpacts.at(-1), suspect ?? null));

  const live = dossier.actions.filter((action) => action.status !== 'cancelled');
  const open = live.filter((action) => action.status === 'open');
  if (open.length) add('actions-open', `Còn ${open.length} hành động chưa hoàn thành (hoàn thành hoặc huỷ có lý do).`);

  if (dossier.tier === 'capa') {
    if (!dossier.causeStatus) add('cause', 'Chưa kết luận nguyên nhân (đã xác định, nghi ngờ hoặc chưa xác định).');
    else if (dossier.causeStatus === 'undetermined') {
      if (textLength(dossier.causeCheckPlan) < 10) add('cause-plan', 'Nguyên nhân chưa xác định phải có kế hoạch kiểm tra tiếp (ít nhất 10 ký tự).');
    } else if (!dossier.causeCategory || textLength(dossier.causeText) < 10) add('cause-text', 'Ghi nhóm nguyên nhân và mô tả nguyên nhân (ít nhất 10 ký tự).');
    if (!live.some((action) => action.kind === 'corrective' && action.status === 'done')) add('corrective', 'Tầng CAPA phải có ít nhất một hành động khắc phục đã hoàn thành.');
    if (textLength(dossier.effectivenessCriteria) < 10) add('criteria', 'Chưa đặt tiêu chí đánh giá hiệu lực.');
    const last = dossier.effectivenessReviews.at(-1);
    if (!last) add('effectiveness', 'Chưa đánh giá hiệu lực hành động khắc phục.');
    else if (last.result !== 'effective') add('effectiveness-not-effective', last.result === 'ineffective'
      ? 'Lần đánh giá gần nhất kết luận không hiệu quả: bổ sung hành động và đánh giá lại.'
      : 'Lần đánh giá gần nhất cần theo dõi thêm: đánh giá lại khi đủ dữ liệu.');
    else if (last.reviewedAt < latestActionDoneDate(dossier.actions)) add('effectiveness-stale', 'Có hành động hoàn thành sau lần đánh giá hiệu lực gần nhất: phải đánh giá lại.');
    else if (last.basis !== nceEffectivenessBasis(dossier)) add('effectiveness-basis-changed', 'Tiêu chí, nguy cơ, nguyên nhân hoặc hành động đã thay đổi so với bằng chứng hiệu lực: phải đánh giá lại.');
    if (last?.result === 'effective' && nceRiskScore(last.residualSeverity, last.residualProbability) > nceRiskScore(dossier.riskSeverity, dossier.riskProbability)) {
      add('residual-above-initial', 'Nguy cơ còn lại cao hơn nguy cơ ban đầu hiện hành: phải rà soát và đánh giá lại.');
    }
  }
  return missing;
}

export function nceSubmitMissing(dossier: NceDossier, suspect?: NceSuspectWindow | null): NceMissing[] {
  if (dossier.status !== 'released') return [{ code: 'status', message: 'Chỉ nộp duyệt hồ sơ đã cho chạy lại.' }];
  return nceContentMissing(dossier, suspect);
}

// ---------------------------------------------------------- 5.5 Duyệt

/** `releaseRecheck`: kết quả kiểm lại lần rerun trên dữ liệu hiện tại (ví dụ
 * điểm rerun bị huỷ sau khi cho chạy lại); `null` với hồ sơ không phải IQC. */
export function nceApproveMissing(dossier: NceDossier, releaseRecheck: NceRerunResult | null, suspect?: NceSuspectWindow | null): NceMissing[] {
  if (dossier.status !== 'pending_approval') return [{ code: 'status', message: 'Chỉ duyệt hồ sơ đang chờ duyệt.' }];
  const missing = nceContentMissing(dossier, suspect);
  if (releaseRecheck && !releaseRecheck.ok) missing.push(...releaseRecheck.problems.map((p) => ({ code: `recheck-${p.code}`, message: `Bằng chứng rerun không còn hợp lệ: ${p.message}` })));
  return missing;
}

// --------------------------------------------------------- Bước tiếp theo

export interface NceNextStep { step: 'release' | 'submit' | 'approve' | null; missing: NceMissing[] }

/** Bước kế tiếp và những gì còn thiếu, để giao diện hiển thị "còn thiếu gì". */
export function nceNextStep(dossier: NceDossier, rerunPreview: NceRerunResult | null = null, suspect?: NceSuspectWindow | null): NceNextStep {
  switch (dossier.status) {
    case 'open': return { step: 'release', missing: nceReleaseMissing(dossier, rerunPreview, suspect) };
    case 'released': return { step: 'submit', missing: nceSubmitMissing(dossier, suspect) };
    case 'pending_approval': return { step: 'approve', missing: nceContentMissing(dossier, suspect) };
    default: return { step: null, missing: [] };
  }
}

/** Các lần chạy hỏng của hồ sơ, theo thứ tự chạy. */
export function nceFailureRuns(dossier: Pick<NceDossier, 'runs'>) {
  return dossier.runs.filter((run) => run.role !== 'rerun').map((run) => run.snapshot).sort(compareRun);
}
