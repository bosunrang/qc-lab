// Khoảng nghi ngờ và quyết định ảnh hưởng kết quả bệnh nhân (D-05).
//
// Với sự cố phân tích, kết quả bệnh nhân bị nghi ngờ từ SAU lần chạy QC đạt
// cuối cùng trước sự cố cho tới lần rerun được chấp nhận (NCE-PLAN 7.5; ISO
// 15189:2022 7.5). QC chạy lại đạt không làm các kết quả trong khoảng đó mặc
// nhiên hợp lệ, nên phải có một quyết định có người chịu trách nhiệm.
import type { NceMissing, NcePatientImpact, NceRunKey, NceSource, NceValidation } from './types';
import { isOneOf, NCE_PATIENT_OUTCOMES } from './types';
import { compareRun } from './format';

export interface NceRunOutcome extends NceRunKey { rejected: boolean }

export interface NceSuspectWindow {
  /** Lần chạy đạt cuối cùng trước sự cố; `null` khi không có lần đạt nào trước đó. */
  lastAccepted: NceRunKey | null;
  trigger: NceRunKey;
  /** Lần rerun; `null` khi chưa cho chạy lại (khoảng còn mở). */
  rerun: NceRunKey | null;
  /** Các lần chạy nằm giữa `lastAccepted` và `rerun` (không gồm hai đầu mút). */
  runs: NceRunKey[];
}

export function nceSuspectWindow(allRuns: readonly NceRunOutcome[], trigger: NceRunKey, rerun: NceRunKey | null): NceSuspectWindow {
  const sorted = [...allRuns].sort(compareRun);
  const before = sorted.filter((run) => compareRun(run, trigger) < 0 && !run.rejected);
  const lastAccepted = before.length ? { date: before.at(-1)!.date, runId: before.at(-1)!.runId } : null;
  const runs = sorted
    .filter((run) => (!lastAccepted || compareRun(run, lastAccepted) > 0) && (!rerun || compareRun(run, rerun) < 0))
    .map((run) => ({ date: run.date, runId: run.runId }));
  return { lastAccepted, trigger, rerun, runs };
}

export const NCE_PATIENT_OUTCOME_LABEL: Readonly<Record<string, string>> = {
  not_reported: 'Chưa trả kết quả nào trong khoảng nghi ngờ (đã giữ kịp)',
  reported_no_impact: 'Đã trả kết quả, rà soát không có ảnh hưởng lâm sàng',
  reported_corrected: 'Đã trả kết quả, phải sửa báo cáo / thông báo người sử dụng',
  not_applicable: 'Không liên quan kết quả bệnh nhân',
};

export type NcePatientImpactInput = Pick<NcePatientImpact, 'outcome' | 'description' | 'resultCount' | 'reference' | 'notified'>;

export function validateNcePatientImpact(raw: unknown, source: NceSource): NceValidation<NcePatientImpactInput> {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (!isOneOf(NCE_PATIENT_OUTCOMES, input.outcome)) return { ok: false, code: 'invalid-outcome', message: 'Chọn kết luận ảnh hưởng kết quả bệnh nhân.' };
  // Sự cố IQC luôn có thể chạm tới kết quả bệnh nhân của khoảng nghi ngờ.
  if (input.outcome === 'not_applicable' && source === 'iqc') return { ok: false, code: 'outcome-not-applicable', message: 'Sự cố nội kiểm không được kết luận "không liên quan kết quả bệnh nhân".' };
  const description = String(input.description ?? '').trim().slice(0, 4000);
  if (description.length < 5) return { ok: false, code: 'missing-description', message: 'Ghi căn cứ/cách rà soát kết quả (ít nhất 5 ký tự).' };
  let resultCount: number | null = null;
  if (input.resultCount !== undefined && input.resultCount !== null && input.resultCount !== '') {
    const n = Number(input.resultCount);
    if (!Number.isInteger(n) || n < 0) return { ok: false, code: 'invalid-count', message: 'Số kết quả cần rà soát phải là số nguyên không âm.' };
    resultCount = n;
  }
  const reference = String(input.reference ?? '').trim().slice(0, 200);
  const notified = String(input.notified ?? '').trim().slice(0, 1000);
  if (input.outcome === 'reported_corrected') {
    if (reference.length < 2) return { ok: false, code: 'missing-reference', message: 'Ghi mã phiếu sửa báo cáo / tham chiếu kết quả đã sửa.' };
    if (notified.length < 5) return { ok: false, code: 'missing-notified', message: 'Ghi người sử dụng đã được thông báo, thời điểm và kênh thông báo.' };
  }
  return { ok: true, data: { outcome: input.outcome, description, resultCount, reference, notified } };
}

/** Quyết định ảnh hưởng hiện hành có đủ để cho chạy lại không. */
export function ncePatientImpactMissing(impacts: readonly NcePatientImpact[], source: NceSource): NceMissing[] {
  const latest = impacts.at(-1);
  if (!latest) return [{ code: 'patient-impact', message: 'Chưa có quyết định ảnh hưởng kết quả bệnh nhân cho khoảng nghi ngờ.' }];
  const checked = validateNcePatientImpact(latest, source);
  return checked.ok ? [] : [{ code: 'patient-impact-invalid', message: checked.message }];
}

export function ncePatientImpactLabel(impact: Pick<NcePatientImpact, 'outcome'> | null | undefined): string {
  return impact ? NCE_PATIENT_OUTCOME_LABEL[impact.outcome] ?? impact.outcome : '—';
}
