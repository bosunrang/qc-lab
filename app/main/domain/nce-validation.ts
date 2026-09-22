// Validate cho hồ sơ khắc phục sự cố (NCE/CAPA). Hồ sơ được phép lưu ở trạng
// thái đang điều tra sau khi đã kiểm soát tức thời; các điều kiện khép vòng
// được kiểm ở `nceApprovalReadiness()` tại IPC trước khi phê duyệt. Tách hai
// việc này là cố ý: bắt người dùng điền đủ mọi ô trước khi lưu sẽ làm mất khả
// năng lập NCE ngay tại thời điểm xảy ra sự cố.
import { cleanId, cleanText } from './text-utils';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface NceCreateInput {
  testId?: unknown; level?: unknown; lot?: unknown; date?: unknown; pointId?: unknown;
  rule?: unknown; errorType?: unknown; correction?: unknown; dueDate?: unknown;
  investigation?: unknown; causeCategory?: unknown; causeDescription?: unknown;
  protocol?: unknown;
}
export interface PreparedNceCreate {
  testId: string; level: number | null; lot: string; date: string; pointId: string;
  rule: string; errorType: string; correction: string; dueDate: string;
  investigation: string; causeCategory: string; causeDescription: string; protocol: PreparedNceProtocol;
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

const EVENT_SOURCES = ['iqc', 'eqa', 'instrument', 'clinical', 'audit', 'other'] as const;
const PROCESS_PHASES = ['pre', 'exam', 'post'] as const;
const CONTAINMENT = ['held', 'none'] as const;
const CHECKS = ['ok', 'abnormal', 'na', 'not-needed', 'checked-ok', 'checked-abnormal'] as const;
const CAUSES = ['qc', 'operator', 'instrument', 'reagent', 'calibration', 'environment', 'unknown'] as const;
const RISK = ['low', 'medium', 'high', 'critical'] as const;
const RELEASE = ['released'] as const;
const PATIENT = ['none', 'held', 'affected'] as const;
const EFFECTIVENESS = ['pending', 'effective', 'ineffective'] as const;
const CHECK_KEYS = ['qcMaterial', 'instrument', 'reagent', 'calibration', 'lotToLot'] as const;

type EnumValue<T extends readonly string[]> = T[number] | '';
function cleanEnum<T extends readonly string[]>(value: unknown, values: T): EnumValue<T> {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? value as EnumValue<T> : '';
}
function cleanDate(value: unknown): string { return cleanText(value, 20).trim(); }
function cleanRiskNumber(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 0;
}

export interface PreparedNceProtocol {
  eventSource: EnumValue<typeof EVENT_SOURCES>; processPhase: EnumValue<typeof PROCESS_PHASES>; owner: string;
  correction: string; investigation: string;
  containmentStatus: EnumValue<typeof CONTAINMENT>; containmentNote: string;
  riskSeverity: number; riskOccurrence: number; riskDetectability: number; riskLevel: EnumValue<typeof RISK>; riskBasis: string;
  qcMaterialStatus: EnumValue<typeof CHECKS>; qcMaterialNote: string; instrumentStatus: EnumValue<typeof CHECKS>; instrumentNote: string;
  reagentStatus: EnumValue<typeof CHECKS>; reagentNote: string; calibrationStatus: EnumValue<typeof CHECKS>; calibrationNote: string;
  lotToLotStatus: EnumValue<typeof CHECKS>; lotToLotNote: string;
  causeCategory: EnumValue<typeof CAUSES>; cause: string; action: string; biasBefore: string; biasAfter: string;
  actionCompletedDate: string; releaseStatus: EnumValue<typeof RELEASE>; releaseDate: string; releaseBy: string; releaseNote: string;
  patientImpact: EnumValue<typeof PATIENT>; patientAction: string;
  effectivenessStatus: EnumValue<typeof EFFECTIVENESS>; effectivenessDate: string; effectivenessNote: string;
  residualSeverity: number; residualOccurrence: number; residualDetectability: number; residualRiskLevel: EnumValue<typeof RISK>; residualRiskBasis: string;
}

export function prepareNceProtocol(input: unknown): PreparedNceProtocol {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const text = (key: string, max = 4000) => cleanText(raw[key], max).trim();
  return {
    eventSource: cleanEnum(raw.eventSource, EVENT_SOURCES), processPhase: cleanEnum(raw.processPhase, PROCESS_PHASES), owner: text('owner', 120), correction: text('correction'), investigation: text('investigation'),
    containmentStatus: cleanEnum(raw.containmentStatus, CONTAINMENT), containmentNote: text('containmentNote'),
    riskSeverity: cleanRiskNumber(raw.riskSeverity), riskOccurrence: cleanRiskNumber(raw.riskOccurrence), riskDetectability: cleanRiskNumber(raw.riskDetectability), riskLevel: cleanEnum(raw.riskLevel, RISK), riskBasis: text('riskBasis'),
    qcMaterialStatus: cleanEnum(raw.qcMaterialStatus, CHECKS), qcMaterialNote: text('qcMaterialNote'),
    instrumentStatus: cleanEnum(raw.instrumentStatus, CHECKS), instrumentNote: text('instrumentNote'),
    reagentStatus: cleanEnum(raw.reagentStatus, CHECKS), reagentNote: text('reagentNote'),
    calibrationStatus: cleanEnum(raw.calibrationStatus, CHECKS), calibrationNote: text('calibrationNote'),
    lotToLotStatus: cleanEnum(raw.lotToLotStatus, CHECKS), lotToLotNote: text('lotToLotNote'),
    causeCategory: cleanEnum(raw.causeCategory, CAUSES), cause: text('cause'), action: text('action'), biasBefore: text('biasBefore', 30), biasAfter: text('biasAfter', 30),
    actionCompletedDate: cleanDate(raw.actionCompletedDate), releaseStatus: cleanEnum(raw.releaseStatus, RELEASE), releaseDate: cleanDate(raw.releaseDate), releaseBy: text('releaseBy', 120), releaseNote: text('releaseNote'),
    patientImpact: cleanEnum(raw.patientImpact, PATIENT), patientAction: text('patientAction'),
    effectivenessStatus: cleanEnum(raw.effectivenessStatus, EFFECTIVENESS) || 'pending', effectivenessDate: cleanDate(raw.effectivenessDate), effectivenessNote: text('effectivenessNote'),
    residualSeverity: cleanRiskNumber(raw.residualSeverity), residualOccurrence: cleanRiskNumber(raw.residualOccurrence), residualDetectability: cleanRiskNumber(raw.residualDetectability), residualRiskLevel: cleanEnum(raw.residualRiskLevel, RISK), residualRiskBasis: text('residualRiskBasis'),
  };
}

export function nceRiskScore(values: Pick<PreparedNceProtocol, 'riskSeverity' | 'riskOccurrence' | 'riskDetectability'> | Pick<PreparedNceProtocol, 'residualSeverity' | 'residualOccurrence' | 'residualDetectability'>): number {
  // Không dùng `Object.values(values)`: caller có thể truyền cả protocol và
  // khi đó các trường văn bản rỗng làm điểm FMEA sai thành 0.
  const v = 'riskSeverity' in values
    ? [values.riskSeverity, values.riskOccurrence, values.riskDetectability]
    : [values.residualSeverity, values.residualOccurrence, values.residualDetectability];
  return v.every((n) => Number.isInteger(n) && n >= 1 && n <= 5) ? v.reduce((total, n) => total * n, 1) : 0;
}

export interface NceApprovalData { date: string; dueDate: string; actionCompletedDate: string; effectivenessStatus: string; followUpNceId: string; protocol: PreparedNceProtocol; hasAcceptedRerun: boolean; }
export interface NceReadiness { ok: boolean; missing: string[]; }

/** Cổng duyệt/khép vòng port từ `action-protocol-service.ts` app cũ.  Hàm
 * thuần để Electron handler và browser preview gọi cùng một quy tắc. */
export function nceApprovalReadiness(data: NceApprovalData, today: string): NceReadiness {
  const p = data.protocol, missing: string[] = [];
  const need = (condition: boolean, label: string) => { if (condition) missing.push(label); };
  const validDate = (value: string) => DATE_RE.test(value);
  need(!p.eventSource, 'nguồn phát hiện'); need(!p.processPhase, 'giai đoạn quá trình'); need(!p.owner, 'người phụ trách');
  need(!validDate(data.dueDate), 'hạn hoàn thành'); need(!p.containmentStatus, 'kiểm soát tức thời');
  need(p.correction?.length < 5, 'xử lý tức thời');
  need(!p.riskLevel || !nceRiskScore(p), 'đánh giá nguy cơ FMEA (S×O×D và mức)'); need(p.riskBasis.length < 5, 'căn cứ phân loại nguy cơ theo SOP');
  for (const key of CHECK_KEYS) {
    const status = p[`${key}Status`] as string;
    const note = p[`${key}Note`] as string;
    need(!status, `checklist ${key}`);
    need(['abnormal', 'na', 'checked-abnormal'].includes(status) && note.length < 3, `ghi chú checklist ${key}`);
  }
  need(!p.causeCategory || p.cause.length < 5, 'nguyên nhân gốc'); need(p.action.length < 5, 'hành động khắc phục');
  need(!validDate(data.actionCompletedDate), 'ngày hoàn thành hành động');
  need(validDate(data.actionCompletedDate) && (data.actionCompletedDate < data.date || data.actionCompletedDate > today), 'ngày hoàn thành hành động hợp lệ');
  if (p.containmentStatus === 'held') {
    need(!p.releaseStatus, 'quyết định cho phép hoạt động/trả kết quả'); need(!validDate(p.releaseDate), 'ngày cho phép trở lại');
    need(p.releaseBy.length < 2, 'người cho phép trở lại'); need(p.releaseNote.length < 5, 'căn cứ cho phép trở lại');
    need(validDate(p.releaseDate) && (p.releaseDate < data.actionCompletedDate || p.releaseDate > today), 'ngày cho phép trở lại hợp lệ');
    need(!data.hasAcceptedRerun, 'bằng chứng QC chạy lại được chấp nhận');
  }
  need(!p.patientImpact, 'đánh giá ảnh hưởng bệnh nhân');
  need(['held', 'affected'].includes(p.patientImpact) && p.patientAction.length < 5, 'xử lý mẫu/kết quả bệnh nhân');
  need(p.containmentStatus === 'none' && ['held', 'affected'].includes(p.patientImpact), 'tính nhất quán giữa kiểm soát và ảnh hưởng bệnh nhân');
  need(p.effectivenessStatus === 'pending', 'đánh giá hiệu lực');
  need(p.effectivenessStatus !== 'pending' && (!validDate(p.effectivenessDate) || p.effectivenessNote.length < 5), 'ngày và bằng chứng hiệu lực');
  const prereq = [data.date, data.actionCompletedDate, p.releaseDate].filter(validDate).sort().pop() || '';
  need(validDate(p.effectivenessDate) && (p.effectivenessDate < prereq || p.effectivenessDate > today), 'ngày đánh giá hiệu lực hợp lệ');
  if (p.effectivenessStatus === 'effective') {
    const initial = nceRiskScore(p);
    const residual = nceRiskScore({ riskSeverity: p.residualSeverity, riskOccurrence: p.residualOccurrence, riskDetectability: p.residualDetectability });
    need(!p.residualRiskLevel || !residual || p.residualRiskBasis.length < 5, 'đánh giá nguy cơ còn lại');
    need(!!initial && !!residual && residual > initial, 'RPN còn lại không được cao hơn RPN ban đầu');
  }
  if (p.effectivenessStatus === 'ineffective') need(!data.followUpNceId, 'mở hồ sơ NCE vòng tiếp theo');
  return { ok: !missing.length, missing };
}

export function validateNceCreate(input: NceCreateInput): ValidationResult<PreparedNceCreate> {
  const date = cleanText(input.date, 20).trim();
  if (!DATE_RE.test(date)) return { ok: false, code: 'invalid-date', message: 'Ngày ghi nhận sự cố không hợp lệ.' };
  const correction = cleanText(input.correction, 2000).trim();
  // Khớp `action-draft-status.ts` app cũ: đủ để lưu NCE đang điều tra là
  // một mô tả ngắn có nghĩa; phê duyệt sau đó còn có gate protocol đầy đủ.
  if (correction.length < 5) return { ok: false, code: 'missing-correction', message: 'Xử lý tức thời phải có ít nhất 5 ký tự.' };
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
      causeCategory: cleanText(input.causeCategory, 40).trim(),
      causeDescription: cleanText(input.causeDescription, 2000).trim(),
      protocol: prepareNceProtocol(input.protocol),
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
