// Khoảng nghi ngờ và quyết định ảnh hưởng kết quả bệnh nhân (D-05).
//
// Với sự cố phân tích, kết quả bệnh nhân bị nghi ngờ từ SAU lần chạy QC đạt
// cuối cùng trước sự cố cho tới lần rerun được chấp nhận (NCE-PLAN 7.5; ISO
// 15189:2022 7.5). QC chạy lại đạt không làm các kết quả trong khoảng đó mặc
// nhiên hợp lệ, nên phải có một quyết định có người chịu trách nhiệm.
import type { NceMissing, NcePatientImpact, NcePatientImpactCoverage, NceRunKey, NceSource, NceValidation } from './types';
import { isOneOf, NCE_PATIENT_OUTCOMES } from './types';
import { compareRun, runLabel } from './format';

/** Luật Westgard đã đánh dấu trên một mức của lần chạy: luật nổ tại điểm đó
 * và luật mà điểm đó là bằng chứng (điểm trước trong cùng chuỗi đếm). */
export interface NceRunMark { level: number; rules: readonly string[] }

export interface NceRunOutcome extends NceRunKey { rejected: boolean; complete: boolean; marks?: readonly NceRunMark[] }

/** Luật LOẠI BỎ của lần chạy khởi đầu và các mức mang luật đó — dùng để lần
 * ngược chuỗi đếm nhiều lần chạy (10x, 4-1s, 2-2s…) về lần chạy đầu tiên. */
export interface NceSuspectChain { rules: readonly string[]; levels: readonly number[] }

export interface NceSuspectWindow {
  /** Lần chạy đạt cuối cùng trước khi sai số bắt đầu; `null` khi không có lần đạt nào trước đó. */
  lastAccepted: NceRunKey | null;
  /** Lần chạy đầu tiên thuộc chuỗi vi phạm; bằng `trigger` khi luật chỉ xét một lần chạy. */
  onset: NceRunKey;
  /** Luật làm khoảng mở rộng về trước lần khởi đầu (rỗng nếu không mở rộng). */
  onsetRules: string[];
  trigger: NceRunKey;
  /** Lần rerun; `null` khi chưa cho chạy lại (khoảng còn mở). */
  rerun: NceRunKey | null;
  /** Các lần chạy nằm giữa `lastAccepted` và `rerun` (không gồm hai đầu mút). */
  runs: NceRunKey[];
}

const keyOf = (run: NceRunKey): NceRunKey => ({ date: run.date, runId: run.runId });

/** Lần chạy đầu tiên của chuỗi vi phạm. Luật đếm nhiều lần chạy (10x, 8x,
 * 4-1s, 2-2s qua lần chạy…) nổ ở lần chạy cuối, nhưng các lần trước trong
 * chuỗi đã mang sai số dù từng được chấp nhận; lấy "lần đạt cuối" ngay trước
 * lần khởi đầu sẽ bỏ sót kết quả bệnh nhân của các lần đó. Đi ngược từ lần
 * khởi đầu: lần chạy có điểm mang luật của chuỗi thì thuộc chuỗi; lần chạy có
 * điểm ở mức của chuỗi mà không mang luật thì chuỗi đã dừng; lần chạy không
 * đo mức đó thì bỏ qua (chuỗi đếm theo mức không tính lần chạy ấy). */
function chainOnset(sorted: readonly NceRunOutcome[], trigger: NceRunKey, chain: NceSuspectChain | undefined): { onset: NceRunKey; rules: string[] } {
  if (!chain?.rules.length) return { onset: keyOf(trigger), rules: [] };
  const chainRules = new Set(chain.rules), chainLevels = new Set(chain.levels);
  let onset = keyOf(trigger);
  const used = new Set<string>();
  const before = sorted.filter((run) => compareRun(run, trigger) < 0);
  for (let i = before.length - 1; i >= 0; i--) {
    const marks = before[i].marks ?? [];
    const hits = marks.flatMap((mark) => mark.rules.filter((rule) => chainRules.has(rule)));
    if (hits.length) { onset = keyOf(before[i]); hits.forEach((rule) => used.add(rule)); continue; }
    if (marks.some((mark) => chainLevels.has(mark.level))) break;
  }
  return { onset, rules: [...used].sort() };
}

export function nceSuspectWindow(allRuns: readonly NceRunOutcome[], trigger: NceRunKey, rerun: NceRunKey | null, chain?: NceSuspectChain): NceSuspectWindow {
  const sorted = [...allRuns].sort(compareRun);
  const { onset, rules: onsetRules } = chainOnset(sorted, trigger, chain);
  const before = sorted.filter((run) => compareRun(run, onset) < 0 && !run.rejected && run.complete);
  const lastAccepted = before.length ? keyOf(before.at(-1)!) : null;
  const runs = sorted
    .filter((run) => (!lastAccepted || compareRun(run, lastAccepted) > 0) && (!rerun || compareRun(run, rerun) < 0))
    .map(keyOf);
  return { lastAccepted, onset, onsetRules, trigger: keyOf(trigger), rerun, runs };
}

/** Phạm vi một quyết định ảnh hưởng bệnh nhân đã rà soát, chụp tại lúc ghi:
 * khoảng nghi ngờ hiện hành và lần chạy QC mới nhất khi đó. Khi đã cho chạy
 * lại, quyết định rà soát đúng tới lần rerun. */
export function ncePatientImpactCoverage(window: NceSuspectWindow, latestRun: NceRunKey | null): NcePatientImpactCoverage {
  const through = window.rerun ?? latestRun ?? window.trigger;
  return { lastAccepted: window.lastAccepted, onset: window.onset, through: keyOf(through), runCount: window.runs.length };
}

/** Quyết định ảnh hưởng hiện hành có bao phủ khoảng nghi ngờ hiện tại không.
 * Bắt đầu: không muộn hơn lần đạt cuối hiện tính (dữ liệu QC đổi, chuỗi vi
 * phạm dài hơn đều làm khoảng lùi về trước). Kết thúc: đã rà tới ít nhất lần
 * rerun. `window` = `null` khi hồ sơ không có khoảng nghi ngờ (không phải IQC). */
export function ncePatientImpactCoverageMissing(impact: NcePatientImpact | undefined, window: NceSuspectWindow | null): NceMissing[] {
  if (!window || !impact) return [];
  const coverage = impact.coverage;
  if (!coverage?.through) return [{ code: 'patient-impact-scope', message: 'Quyết định ảnh hưởng bệnh nhân chưa ghi phạm vi khoảng nghi ngờ đã rà soát: ghi lại quyết định.' }];
  const missing: NceMissing[] = [];
  const startCovered = !coverage.lastAccepted || (!!window.lastAccepted && compareRun(coverage.lastAccepted, window.lastAccepted) <= 0);
  if (!startCovered) {
    const now = window.lastAccepted ? `sau lần đạt ${runLabel(window.lastAccepted)}` : 'từ lần chạy đầu tiên đang có';
    missing.push({ code: 'patient-impact-start', message: `Khoảng nghi ngờ hiện bắt đầu ${now}, sớm hơn phạm vi quyết định ảnh hưởng bệnh nhân đã rà soát (sau lần đạt ${runLabel(coverage.lastAccepted!)}): ghi lại quyết định.` });
  }
  if (window.rerun && compareRun(coverage.through, window.rerun) < 0) {
    missing.push({ code: 'patient-impact-end', message: `Quyết định ảnh hưởng bệnh nhân chỉ rà soát tới lần chạy ${runLabel(coverage.through)}, chưa tới lần rerun ${runLabel(window.rerun)}: ghi lại quyết định.` });
  }
  return missing;
}

export const NCE_PATIENT_OUTCOME_LABEL: Readonly<Record<string, string>> = {
  not_reported: 'Chưa trả kết quả nào trong khoảng nghi ngờ (đã giữ kịp)',
  reported_no_impact: 'Đã trả kết quả, rà soát không có ảnh hưởng lâm sàng',
  reported_corrected: 'Đã trả kết quả, phải sửa báo cáo / thông báo người sử dụng',
  not_applicable: 'Không liên quan kết quả bệnh nhân',
};

export type NcePatientImpactInput = Pick<NcePatientImpact, 'outcome' | 'description' | 'resultCount' | 'reference' | 'notified'>;

export function validateNcePatientImpact(raw: unknown, source: NceSource, context?: { eqaLinked?: boolean; causeCategory?: string; causeStatus?: string }): NceValidation<NcePatientImpactInput> {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (!isOneOf(NCE_PATIENT_OUTCOMES, input.outcome)) return { ok: false, code: 'invalid-outcome', message: 'Chọn kết luận ảnh hưởng kết quả bệnh nhân.' };
  // Sự cố IQC luôn có thể chạm tới kết quả bệnh nhân của khoảng nghi ngờ.
  if (input.outcome === 'not_applicable' && source === 'iqc') return { ok: false, code: 'outcome-not-applicable', message: 'Sự cố nội kiểm không được kết luận "không liên quan kết quả bệnh nhân".' };
  if (input.outcome === 'not_applicable' && context?.eqaLinked && context.causeCategory === 'eqa_technical') return { ok: false, code: 'outcome-not-applicable', message: 'Lỗi kỹ thuật phải rà soát kết quả bệnh nhân; không được chọn Không liên quan.' };
  // N-12: chỉ lỗi hành chính ở khâu ngoại kiểm hoặc vấn đề chương trình/mẫu mới được
  // kết luận không ảnh hưởng; chưa phân loại hoặc chưa xác định nguyên nhân thì phải rà soát.
  if (input.outcome === 'not_applicable' && context?.eqaLinked && (context.causeStatus === 'undetermined' || !['eqa_administrative', 'eqa_program'].includes(context.causeCategory ?? ''))) return { ok: false, code: 'outcome-not-applicable', message: 'Chỉ lỗi hành chính ở khâu ngoại kiểm hoặc vấn đề chương trình/mẫu mới được chọn Không liên quan. Phân loại nguyên nhân ở bước Rà soát trước.' };
  const description = String(input.description ?? '').trim().slice(0, 4000);
  if (description.length < 5) return { ok: false, code: 'missing-description', message: 'Ghi căn cứ/cách rà soát kết quả (ít nhất 5 ký tự).' };
  let resultCount: number | null = null;
  if (input.resultCount !== undefined && input.resultCount !== null && input.resultCount !== '') {
    const n = Number(input.resultCount);
    if (!Number.isInteger(n) || n < 0) return { ok: false, code: 'invalid-count', message: 'Số kết quả cần rà soát phải là số nguyên không âm.' };
    resultCount = n;
  }
  if (source === 'iqc' && resultCount === null) return { ok: false, code: 'missing-count', message: 'Ghi số kết quả bệnh nhân đã rà soát trong khoảng nghi ngờ.' };
  if (context?.eqaLinked && input.outcome !== 'not_applicable' && resultCount === null) return { ok: false, code: 'missing-count', message: 'Ghi số kết quả bệnh nhân đã rà soát đối với sự cố ngoại kiểm.' };
  const reference = String(input.reference ?? '').trim().slice(0, 200);
  const notified = String(input.notified ?? '').trim().slice(0, 1000);
  if (input.outcome === 'reported_corrected') {
    if (!resultCount) return { ok: false, code: 'missing-affected-count', message: 'Kết luận có sửa báo cáo phải ghi số kết quả bị ảnh hưởng lớn hơn 0.' };
    if (reference.length < 2) return { ok: false, code: 'missing-reference', message: 'Ghi mã phiếu sửa báo cáo / tham chiếu kết quả đã sửa.' };
    if (notified.length < 5) return { ok: false, code: 'missing-notified', message: 'Ghi người sử dụng đã được thông báo, thời điểm và kênh thông báo.' };
  }
  return { ok: true, data: { outcome: input.outcome, description, resultCount, reference, notified } };
}

/** Quyết định ảnh hưởng hiện hành có đủ để cho chạy lại không. */
export function ncePatientImpactMissing(impacts: readonly NcePatientImpact[], source: NceSource, context?: { eqaLinked?: boolean; causeCategory?: string; causeStatus?: string }): NceMissing[] {
  const latest = impacts.at(-1);
  if (!latest) return [{ code: 'patient-impact', message: 'Chưa có quyết định ảnh hưởng kết quả bệnh nhân cho khoảng nghi ngờ.' }];
  const checked = validateNcePatientImpact(latest, source, context);
  return checked.ok ? [] : [{ code: 'patient-impact-invalid', message: checked.message }];
}

export function ncePatientImpactLabel(impact: Pick<NcePatientImpact, 'outcome'> | null | undefined): string {
  return impact ? NCE_PATIENT_OUTCOME_LABEL[impact.outcome] ?? impact.outcome : '—';
}
