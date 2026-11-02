// Kiểu và hằng số nghiệp vụ của hồ sơ NCE (protocol 4) — xem
// `docs/NCE-REDESIGN-2026-10-12.md`. Đây là mô hình miền dùng chung cho các
// hàm thuần trong `domain/nce/`; hợp đồng IPC (dòng đọc từ SQLite) sẽ khai ở
// `app/shared/qc-api.d.ts` khi làm handler, không khai lại ở đây.
import type { RuleVerdict } from '../westgard-engine';

export const NCE_STATUSES = ['open', 'released', 'pending_approval', 'closed', 'cancelled'] as const;
export type NceStatus = typeof NCE_STATUSES[number];

export const NCE_SOURCES = ['iqc', 'eqa', 'instrument', 'reagent', 'calibration', 'other'] as const;
export type NceSource = typeof NCE_SOURCES[number];

export const NCE_PHASES = ['pre', 'exam', 'post'] as const;
export type NcePhase = typeof NCE_PHASES[number];

/** `low` = xử lý nhanh; `capa` = bắt buộc nguyên nhân, hành động, hiệu lực (D-06). */
export const NCE_TIERS = ['low', 'capa'] as const;
export type NceTier = typeof NCE_TIERS[number];

export const NCE_RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type NceRiskLevel = typeof NCE_RISK_LEVELS[number];

export const NCE_CAUSE_STATUSES = ['identified', 'suspected', 'undetermined'] as const;
export type NceCauseStatus = typeof NCE_CAUSE_STATUSES[number];

export const NCE_CAUSE_CATEGORIES = ['qc_material', 'operator', 'instrument', 'reagent', 'calibration', 'environment', 'method', 'sample', 'information_system', 'other'] as const;
export type NceCauseCategory = typeof NCE_CAUSE_CATEGORIES[number];

export const NCE_ACTION_KINDS = ['corrective', 'preventive', 'system_change'] as const;
export type NceActionKind = typeof NCE_ACTION_KINDS[number];

export const NCE_ACTION_STATUSES = ['open', 'done', 'cancelled'] as const;
export type NceActionStatus = typeof NCE_ACTION_STATUSES[number];

/** Kết luận ảnh hưởng kết quả bệnh nhân trong khoảng nghi ngờ (D-05). */
export const NCE_PATIENT_OUTCOMES = ['not_reported', 'reported_no_impact', 'reported_corrected', 'not_applicable'] as const;
export type NcePatientOutcome = typeof NCE_PATIENT_OUTCOMES[number];

/** `extend` = cần theo dõi thêm, chưa kết luận được. */
export const NCE_EFFECTIVENESS_RESULTS = ['effective', 'ineffective', 'extend'] as const;
export type NceEffectivenessResult = typeof NCE_EFFECTIVENESS_RESULTS[number];

export const NCE_CHECK_STATUSES = ['ok', 'abnormal', 'na'] as const;
export type NceCheckStatus = typeof NCE_CHECK_STATUSES[number];

export const NCE_TECHNICAL_ERROR_NATURES = ['systematic', 'random', 'mixed', 'undetermined'] as const;
export type NceTechnicalErrorNature = typeof NCE_TECHNICAL_ERROR_NATURES[number];

export const NCE_TECHNICAL_METRIC_MODES = ['calculated', 'not_applicable'] as const;
export type NceTechnicalMetricMode = typeof NCE_TECHNICAL_METRIC_MODES[number];

export const NCE_MEAN_RESET_DECISIONS = ['not_applicable', 'not_allowed', 'eligible'] as const;
export type NceMeanResetDecision = typeof NCE_MEAN_RESET_DECISIONS[number];

export const NCE_CAPABILITIES = ['nce.release', 'nce.approve'] as const;
export type NceCapability = typeof NCE_CAPABILITIES[number];

/** Một lần chạy QC định danh bằng ngày + mã run (cùng khoá `qcRunKey()`). */
export interface NceRunKey { date: string; runId: string }

/** Một điểm trong snapshot lần chạy. `verdict` là kết luận Westgard tại thời
 * điểm chụp; `none` = mức chưa có Mean/SD hợp lệ nên không đánh giá được. */
export interface NceRunPoint {
  pointId: string; level: number; lot: string; voided: boolean;
  verdict: RuleVerdict | 'none'; rules: readonly string[];
  val: number; mean: number | null; sd: number | null; z: number | null;
}

export interface NceRunSnapshot extends NceRunKey { testId: string; points: readonly NceRunPoint[] }

export type NceRunRole = 'trigger' | 'repeat_reject' | 'rerun';

export interface NceChecklistItem { status: NceCheckStatus | ''; note: string }

export interface NceAction {
  id: string; kind: NceActionKind; description: string; ownerUserId: string; dueDate: string;
  status: NceActionStatus; doneAt: string; doneByUserId: string; evidence: string; cancelReason: string;
}

/** Phạm vi khoảng nghi ngờ mà một quyết định ảnh hưởng bệnh nhân đã rà soát
 * (main chụp lúc ghi, không nhận từ client). */
export interface NcePatientImpactCoverage {
  lastAccepted: NceRunKey | null; onset: NceRunKey; through: NceRunKey; runCount: number;
}

export interface NcePatientImpact {
  outcome: NcePatientOutcome; description: string; resultCount: number | null;
  reference: string; notified: string; decidedAt: string; actorUserId: string;
  /** Không có ở quyết định ghi trước khi ràng buộc phạm vi: phải ghi lại. */
  coverage?: NcePatientImpactCoverage | null;
}

/** Đánh giá kỹ thuật IQC được lưu append-only. Các đại lượng định lượng phải
 * dùng cùng đơn vị; kết quả so ngưỡng chỉ là tín hiệu kỹ thuật, không tự thay
 * quyết định ảnh hưởng lâm sàng của người có thẩm quyền. */
export interface NceTechnicalAssessment {
  errorNature: NceTechnicalErrorNature;
  verificationMethod: string;
  correctiveEvidence: string;
  technicalConclusion: string;
  metricMode: NceTechnicalMetricMode;
  metricReason: string;
  unit: string;
  tea: number | null;
  teaSource: string;
  stableBias: number | null;
  incidentBias: number | null;
  postCorrectionBias: number | null;
  sd: number | null;
  sdSource: string;
  observedDispersion: number | null;
  sampleCount: number | null;
  deltaSeCrit: number | null;
  deltaReCrit: number | null;
  seObs: number | null;
  reObs: number | null;
  technicalSignal: 'below_threshold' | 'exceeds_threshold' | 'not_calculated';
  meanResetDecision: NceMeanResetDecision;
  meanResetReason: string;
  meanResetEvidence: string;
  decidedAt: string;
  actorUserId: string;
}

export interface NceRelease {
  notApplicable: boolean; reason: string; rerun: NceRunKey | null; lotChangeNote: string;
  decidedAt: string; actorUserId: string;
}

export interface NceEffectivenessReview {
  result: NceEffectivenessResult; evidence: string; reviewedAt: string; reviewerUserId: string;
  residualSeverity: number; residualProbability: number; residualLevel: NceRiskLevel | ''; residualBasis: string;
  /** Nội dung thực sự được đánh giá; không lấy dấu vân tay do client gửi. */
  basis: string;
}

/** Toàn bộ hồ sơ ở dạng miền: bản ghi chính + các tập nhiều dòng. Các mảng
 * quyết định xếp theo thời gian tăng dần; phần tử cuối là quyết định hiện hành. */
export interface NceDossier {
  status: NceStatus; source: NceSource; testId: string | null;
  reportedByUserId: string; ownerUserId: string; detectedAt: string; dueDate: string;
  /** `null` = chưa xác định (hồ sơ tự mở khi huỷ điểm); phải chọn trước khi cho chạy lại. */
  description: string; correction: string; holdResults: boolean | null;
  containmentNote: string; occurredNote: string;
  tier: NceTier | ''; tierReason: string;
  riskSeverity: number; riskProbability: number; riskLevel: NceRiskLevel | ''; riskBasis: string;
  checklist: Readonly<Record<string, NceChecklistItem>>;
  causeStatus: NceCauseStatus | ''; causeCategory: NceCauseCategory | ''; causeText: string; causeCheckPlan: string;
  effectivenessCriteria: string; effectivenessReviewDue: string;
  runs: readonly { role: NceRunRole; snapshot: NceRunSnapshot }[];
  actions: readonly NceAction[];
  patientImpacts: readonly NcePatientImpact[];
  technicalAssessments: readonly NceTechnicalAssessment[];
  release: NceRelease | null;
  effectivenessReviews: readonly NceEffectivenessReview[];
  /** Có hồ sơ cùng xét nghiệm, cùng loại sai số trong cửa sổ tái diễn (tính ở `tier.ts`). */
  recurrence: boolean;
}

/** Thiếu gì để qua một cổng: mã máy đọc + câu tiếng Việt cho người dùng. */
export interface NceMissing { code: string; message: string }

export type NceValidation<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}
