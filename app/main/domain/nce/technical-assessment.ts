// Đánh giá kỹ thuật IQC theo hướng dẫn xử lý nội kiểm ngoài kiểm soát.
//
// App tính và lưu snapshot các đại lượng kỹ thuật; kết luận ảnh hưởng bệnh
// nhân vẫn là quyết định riêng có người chịu trách nhiệm. Không dùng một điểm
// rerun đơn lẻ làm ước lượng Bias nếu SOP không cho phép.
//
// SEobs đo độ dịch chuyển lúc sự cố so với CÙNG mốc Bias ổn định mà ΔSEcrit
// dùng: |Bias sự cố − Bias ổn định| / SD. Khi dịch chuyển cùng phía với Bias
// nền, SEobs ≥ ΔSEcrit tương đương |Bias sự cố| + 1,65·SD ≥ TEa — tức kết quả
// lúc sự cố có thể vượt sai số tổng cho phép. Mọi số liệu này có trước khi
// cho hoạt động trở lại; Bias sau khắc phục (cần nhiều lần chạy sau sửa) chỉ
// bắt buộc khi xét xây lại Mean/SD, không chặn release (D-02).
import type { NceDossier, NceMissing, NceTechnicalAssessment, NceValidation } from './types';
import {
  isOneOf, NCE_MEAN_RESET_DECISIONS, NCE_TECHNICAL_ERROR_NATURES, NCE_TECHNICAL_METRIC_MODES,
} from './types';

export type NceTechnicalAssessmentInput = Omit<NceTechnicalAssessment, 'decidedAt' | 'actorUserId'>;

const LONG_SHIFT_RULES = new Set(['8x', '9x', '10x', '12x']);
const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
const finite = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const rounded = (value: number) => Math.round(value * 10000) / 10000;

/** Luật chuỗi một phía dài cần quyết định riêng trước khi đặt Mean/SD mới. */
export function nceRequiresMeanResetReview(dossier: Pick<NceDossier, 'runs'>): boolean {
  return dossier.runs
    .filter((run) => run.role !== 'rerun')
    .some((run) => run.snapshot.points.some((point) => point.rules.some((rule) => LONG_SHIFT_RULES.has(rule))));
}

export function validateNceTechnicalAssessment(
  raw: unknown,
  dossier: Pick<NceDossier, 'source' | 'runs'>,
): NceValidation<NceTechnicalAssessmentInput> {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (dossier.source !== 'iqc') return { ok: false, code: 'technical-not-iqc', message: 'Đánh giá định lượng này chỉ áp dụng cho hồ sơ nội kiểm (IQC).' };
  if (!isOneOf(NCE_TECHNICAL_ERROR_NATURES, input.errorNature)) return { ok: false, code: 'technical-error-nature', message: 'Chọn bản chất sai số kỹ thuật.' };
  const verificationMethod = text(input.verificationMethod, 2000);
  const correctiveEvidence = text(input.correctiveEvidence, 4000);
  const technicalConclusion = text(input.technicalConclusion, 4000);
  if (verificationMethod.length < 10) return { ok: false, code: 'technical-method', message: 'Ghi phương pháp xác minh kỹ thuật (ít nhất 10 ký tự).' };
  if (correctiveEvidence.length < 10) return { ok: false, code: 'technical-evidence', message: 'Ghi xử lý kỹ thuật và bằng chứng sau khắc phục (ít nhất 10 ký tự).' };
  if (technicalConclusion.length < 10) return { ok: false, code: 'technical-conclusion', message: 'Ghi kết luận kỹ thuật (ít nhất 10 ký tự).' };
  if (!isOneOf(NCE_TECHNICAL_METRIC_MODES, input.metricMode)) return { ok: false, code: 'technical-metric-mode', message: 'Chọn có tính đánh giá định lượng hay không áp dụng.' };

  const metricReason = text(input.metricReason, 2000);
  const unit = text(input.unit, 40);
  const tea = finite(input.tea);
  const teaSource = text(input.teaSource, 500);
  const stableBias = finite(input.stableBias);
  const incidentBias = finite(input.incidentBias);
  const postCorrectionBias = finite(input.postCorrectionBias);
  const sd = finite(input.sd);
  const sdSource = text(input.sdSource, 500);
  const observedDispersion = finite(input.observedDispersion);
  const sampleCount = finite(input.sampleCount);

  let deltaSeCrit: number | null = null;
  let deltaReCrit: number | null = null;
  let seObs: number | null = null;
  let reObs: number | null = null;
  let technicalSignal: NceTechnicalAssessmentInput['technicalSignal'] = 'not_calculated';

  if (input.metricMode === 'not_applicable') {
    if (metricReason.length < 10) return { ok: false, code: 'technical-metric-reason', message: 'Ghi lý do không áp dụng đánh giá TEa/Bias/SD (ít nhất 10 ký tự).' };
    if (input.errorNature === 'systematic') return { ok: false, code: 'technical-systematic-metrics', message: 'Sai số hệ thống phải có đánh giá định lượng TEa, Bias và SD.' };
  } else {
    if (!unit) return { ok: false, code: 'technical-unit', message: 'Ghi đơn vị chung của TEa, Bias, SD và độ phân tán.' };
    if (tea === null || tea <= 0) return { ok: false, code: 'technical-tea', message: 'TEa phải là số lớn hơn 0.' };
    if (teaSource.length < 5) return { ok: false, code: 'technical-tea-source', message: 'Ghi nguồn TEa/APS và phiên bản áp dụng.' };
    if (stableBias === null || incidentBias === null) return { ok: false, code: 'technical-bias', message: 'Nhập Bias ổn định trước sự cố và Bias lúc sự cố.' };
    if (sd === null || sd <= 0) return { ok: false, code: 'technical-sd', message: 'SD nội bộ phải là số lớn hơn 0.' };
    if (sdSource.length < 5) return { ok: false, code: 'technical-sd-source', message: 'Ghi nguồn và khoảng dữ liệu SD/CV nội bộ.' };
    if (observedDispersion === null || observedDispersion < 0) return { ok: false, code: 'technical-dispersion', message: 'Độ phân tán quan sát phải là số không âm.' };
    if (sampleCount === null || !Number.isInteger(sampleCount) || sampleCount < 2) return { ok: false, code: 'technical-sample-count', message: 'Cỡ dữ liệu xác minh phải là số nguyên từ 2 trở lên.' };
    deltaSeCrit = rounded(((tea - Math.abs(stableBias)) / sd) - 1.65);
    deltaReCrit = rounded((tea - Math.abs(stableBias)) / (1.65 * sd));
    seObs = rounded(Math.abs(incidentBias - stableBias) / sd);
    reObs = rounded(observedDispersion / sd);
    technicalSignal = seObs >= deltaSeCrit || reObs >= deltaReCrit ? 'exceeds_threshold' : 'below_threshold';
  }

  const requiresMeanReview = nceRequiresMeanResetReview(dossier);
  const meanResetDecision = isOneOf(NCE_MEAN_RESET_DECISIONS, input.meanResetDecision) ? input.meanResetDecision : 'not_applicable';
  const meanResetReason = text(input.meanResetReason, 2000);
  const meanResetEvidence = text(input.meanResetEvidence, 4000);
  if (requiresMeanReview && meanResetDecision === 'not_applicable') return { ok: false, code: 'technical-mean-reset', message: 'Luật dịch chuyển dài yêu cầu kết luận có được xây lại Mean/SD hay không.' };
  if (requiresMeanReview && meanResetReason.length < 10) return { ok: false, code: 'technical-mean-reset-reason', message: 'Ghi căn cứ quyết định về Mean/SD mới (ít nhất 10 ký tự).' };
  if (meanResetDecision === 'eligible') {
    if (input.metricMode !== 'calculated' || tea === null || postCorrectionBias === null) return { ok: false, code: 'technical-mean-reset-metrics', message: 'Chỉ xem xét Mean/SD mới khi đã có TEa và Bias sau khắc phục.' };
    if (Math.abs(postCorrectionBias) > tea / 4) return { ok: false, code: 'technical-mean-reset-bias', message: 'Bias sau khắc phục vượt 1/4 TEa nên không đủ điều kiện xây lại Mean/SD theo hướng dẫn.' };
    if (meanResetEvidence.length < 10) return { ok: false, code: 'technical-mean-reset-evidence', message: 'Ghi bằng chứng thay đổi hợp lệ và số liệu dùng xây lại Mean/SD.' };
  }

  return { ok: true, data: {
    errorNature: input.errorNature, verificationMethod, correctiveEvidence, technicalConclusion,
    metricMode: input.metricMode, metricReason, unit,
    tea, teaSource, stableBias, incidentBias, postCorrectionBias, sd, sdSource, observedDispersion, sampleCount,
    deltaSeCrit, deltaReCrit, seObs, reObs, technicalSignal,
    meanResetDecision, meanResetReason, meanResetEvidence,
  } };
}

export function nceTechnicalAssessmentMissing(
  dossier: Pick<NceDossier, 'source' | 'runs' | 'technicalAssessments'>,
): NceMissing[] {
  if (dossier.source !== 'iqc') return [];
  const latest = dossier.technicalAssessments.at(-1);
  if (!latest) return [{ code: 'technical-assessment', message: 'Chưa có đánh giá xác minh kỹ thuật IQC.' }];
  const checked = validateNceTechnicalAssessment(latest, dossier);
  return checked.ok ? [] : [{ code: 'technical-assessment-invalid', message: checked.message }];
}

export const NCE_TECHNICAL_ERROR_LABEL: Readonly<Record<string, string>> = {
  systematic: 'Sai số hệ thống', random: 'Sai số ngẫu nhiên', mixed: 'Hỗn hợp', undetermined: 'Chưa xác định',
};

export const NCE_TECHNICAL_SIGNAL_LABEL: Readonly<Record<string, string>> = {
  below_threshold: 'Dưới ngưỡng kỹ thuật', exceeds_threshold: 'Vượt ngưỡng kỹ thuật', not_calculated: 'Không tính định lượng',
};

export const NCE_MEAN_RESET_LABEL: Readonly<Record<string, string>> = {
  not_applicable: 'Không áp dụng', not_allowed: 'Không được xây lại Mean/SD', eligible: 'Đủ điều kiện xem xét Mean/SD mới',
};
