import { chartViewModel, type ChartViewModelApi } from '../domain/charts/chart-view-model';
import { createEntryService, type EntryServiceApi } from '../application/entry/entry-service';
import {
  BACKUP_IMPORT_MAX_BYTES,
  BACKUP_IMPORT_WARN_BYTES,
  createBackupService,
  type BackupServiceApi,
} from '../application/backup/backup-service';
import {
  createManageConfigService,
  type ManageConfigServiceApi,
} from '../application/manage/manage-config-service';
import { createPeriodService, type PeriodServiceApi } from '../application/period/period-service';
import {
  createLisClient,
  createLisGatewayRuntime,
  LIS_GATEWAY_STORAGE_KEY,
  LIS_POLL_MS,
  type LisClientApi,
  type LisGatewayRuntime,
} from '../application/lis/lis-client-service';
import {
  createQcPointWarnings,
  type QcPointWarnings,
  type QcWarningStats,
} from '../domain/qc/qc-point-warnings';
import {
  createReagentComparisonService,
  type ReagentComparisonServiceApi,
} from '../application/reagent/reagent-comparison-service';
import {
  createSigmaCohortService,
  type CohortStats,
  type SigmaCohortServiceApi,
} from '../domain/sigma/sigma-cohort-service';
import { sigmaPresentation, type SigmaPresentation } from '../domain/sigma/sigma-presentation';
import { createSigmaPeriodViewModel, type SigmaPeriodViewModel } from '../domain/sigma/sigma-period-view-model';
import { createSigmaBiasService, type SigmaBiasService } from '../domain/sigma/sigma-bias-service';
import { createSigmaCohortImportService, type SigmaCohortImportService } from '../application/sigma/sigma-cohort-import-service';
import { createSigmaPeriodRecordService, type SigmaPeriodRecordService } from '../application/sigma/sigma-period-record-service';
import { createSigmaLevelEditService, type SigmaLevelEditService } from '../application/sigma/sigma-level-edit-service';
import { createSigmaTrackedTestService, type SigmaTrackedTestService } from '../application/sigma/sigma-tracked-test-service';
import { createSigmaBiasWorkflowService, type SigmaBiasWorkflowService } from '../application/sigma/sigma-bias-workflow-service';
import { createSigmaMuWorkflowService, type SigmaMuWorkflowService } from '../application/sigma/sigma-mu-workflow-service';
import { createSigmaCohortSelectionService, type SigmaCohortSelectionService } from '../application/sigma/sigma-cohort-selection-service';
import { createSigmaTeaEditService, type SigmaTeaEditService } from '../application/sigma/sigma-tea-edit-service';
import { createSigmaTeaSnapshotService, type SigmaTeaSnapshotService } from '../application/sigma/sigma-tea-snapshot-service';
import { createSigmaLevelSelectionService, type SigmaLevelSelectionService } from '../domain/sigma/sigma-level-selection-service';
import { createSigmaPeriodSelectionService, type SigmaPeriodSelectionService } from '../presentation/sigma/sigma-period-selection-service';
import { createLotTransitionPickerService, type LotTransitionPickerServiceApi } from '../presentation/manage/lot-transition-picker-service';
import { westgardViewModel, type WestgardViewModelApi } from '../domain/westgard/westgard-view-model';
import { nceActionLabels, type NceActionLabels } from '../domain/nce/action-labels';
import { nceActionBasics, type NceActionBasics } from '../domain/nce/action-basics';
import { createNceActionIdentityService, type NceActionIdentityService } from '../application/nce/action-identity-service';
import { createActionApprovalGates, type ActionApprovalGates } from '../domain/nce/action-approval-gates';
import { createActionQcLink, type ActionQcLink } from '../domain/nce/action-qc-link';
import { createActionBiasService, type ActionBiasService } from '../domain/nce/action-bias-service';
import { createActionBiasPresentation, type ActionBiasPresentation } from '../presentation/nce/action-bias-presentation';
import { createActionViolationService, type ActionViolationService } from '../domain/nce/action-violation-service';
import { createActionListPresentation, type ActionListPresentation } from '../presentation/nce/action-list-presentation';
import { createActionEvidencePresentation, type ActionEvidencePresentation } from '../presentation/nce/action-evidence-presentation';
import { createActionRerunEvidencePresentation, type ActionRerunEvidencePresentation } from '../presentation/nce/action-rerun-evidence-presentation';
import { createActionStatusPresentation, type ActionStatusPresentation } from '../presentation/nce/action-status-presentation';
import { createActionReviewPresentation, type ActionReviewPresentation } from '../presentation/nce/action-review-presentation';
import { createActionDetailPresentation, type ActionDetailPresentation } from '../presentation/nce/action-detail-presentation';
import { createActionGuidePresentation, type ActionGuidePresentation } from '../presentation/nce/action-guide-presentation';
import { createReportPeriodPresentation, type ReportPeriodPresentation } from '../presentation/report/report-period-presentation';
import { nceActionRerunPolicy, type NceActionRerunPolicy } from '../domain/nce/action-rerun-policy';
import { nceActionRerunCacheKey, type NceActionRerunCacheKey } from '../domain/nce/action-rerun-cache-key';
import { nceActionQcIndex, type NceActionQcIndex } from '../domain/nce/action-qc-index';
import { nceActionRerunEvaluator, type NceActionRerunEvaluator } from '../domain/nce/action-rerun-evaluator';
import { createActionWorkflowStatus, type ActionWorkflowStatus } from '../domain/nce/action-workflow-status';
import { createPointWorkflowService } from '../application/nce/point-workflow-service';
import { createActionDraftStatus } from '../domain/nce/action-draft-status';
import { createActionProtocolService, type ActionProtocolService } from '../domain/nce/action-protocol-service';
import { createActionReviewService, type ActionReviewService } from '../application/nce/action-review-service';
import { createActionEscalationService, type ActionEscalationService } from '../application/nce/action-escalation-service';
import { createActionRecordService, type ActionRecordService } from '../application/nce/action-record-service';
import {
  createAnalysisUiState,
  createAuthUiState,
  createEntryUiState,
  createManageUiState,
  createReagentUiState,
  createSigmaUiState,
  installUiState,
} from '../presentation/state/ui-state';

declare const state: { data?: Record<string, Record<string, any>[]>; tests?: Record<string, any>[] };
declare function isoToday(): string;
declare function vnDate(value: unknown): string;
declare function fmt(value: unknown, decimals?: number): string;
declare function formatDateTimeVN(value: string): string;
declare function requireWrite(): boolean;
declare function lvlCfg(test: Record<string, any>, level: unknown): Record<string, any>;
declare function logAct(action: string, detail: string, target?: string): void;
declare function save(options: Record<string, any>): void;
declare function userName(): string;
declare function rerender(): void;
declare function infoDialog(message: string, options?: Record<string, any>): Promise<unknown>;
declare function auditSha256(text: string): Promise<string>;
declare function uid(): string;
declare function isoDate(value: Date): string;

type QCLabGlobal = typeof globalThis & {
  QCLAB_APP?: { version?: string };
  NceActionLabels?: NceActionLabels;
  NceActionBasics?: NceActionBasics;
  NceActionIdentityService?: NceActionIdentityService;
  ActionApprovalGates?: ActionApprovalGates;
  ActionQcLink?: ActionQcLink;
  NceActionRerunPolicy?: NceActionRerunPolicy;
  NceActionRerunCacheKey?: NceActionRerunCacheKey;
  NceActionQcIndex?: NceActionQcIndex;
  NceActionRerunEvaluator?: NceActionRerunEvaluator;
  ActionWorkflowStatusService?: ActionWorkflowStatus;
  PointWorkflowService?: ReturnType<typeof createPointWorkflowService>;
  ActionDraftStatusService?: ReturnType<typeof createActionDraftStatus>;
  ActionProtocolService?: ActionProtocolService;
  ActionReviewService?: ActionReviewService;
  ActionEscalationService?: ActionEscalationService;
  ActionRecordService?: ActionRecordService;
  ActionBiasService?: ActionBiasService;
  ActionBiasPresentation?: ActionBiasPresentation;
  ActionViolationService?: ActionViolationService;
  ActionListPresentation?: ActionListPresentation;
  ActionEvidencePresentation?: ActionEvidencePresentation;
  ActionRerunEvidencePresentation?: ActionRerunEvidencePresentation;
  ActionStatusPresentation?: ActionStatusPresentation;
  ActionReviewPresentation?: ActionReviewPresentation;
  ActionDetailPresentation?: ActionDetailPresentation;
  ActionGuidePresentation?: ActionGuidePresentation;
  ReportPeriodPresentation?: ReportPeriodPresentation;
  ChartViewModel?: ChartViewModelApi;
  EntryService?: EntryServiceApi;
  ManageConfigService?: ManageConfigServiceApi;
  LotTransitionPickerService?: LotTransitionPickerServiceApi;
  PeriodService?: PeriodServiceApi;
  qcPointWarnings?: (test: Record<string, any>, config: Record<string, any>, date: string,
    runId: string, value: number) => string[];
  ReagentComparisonService?: ReagentComparisonServiceApi;
  SigmaCohortService?: SigmaCohortServiceApi;
  SigmaPresentation?: SigmaPresentation;
  SigmaPeriodViewModel?: SigmaPeriodViewModel;
  SigmaBiasService?: SigmaBiasService;
  SigmaCohortImportService?: SigmaCohortImportService;
  SigmaPeriodRecordService?: SigmaPeriodRecordService;
  SigmaLevelEditService?: SigmaLevelEditService;
  SigmaTrackedTestService?: SigmaTrackedTestService;
  SigmaBiasWorkflowService?: SigmaBiasWorkflowService;
  SigmaMuWorkflowService?: SigmaMuWorkflowService;
  SigmaCohortSelectionService?: SigmaCohortSelectionService;
  SigmaTeaEditService?: SigmaTeaEditService;
  SigmaTeaSnapshotService?: SigmaTeaSnapshotService;
  SigmaLevelSelectionService?: SigmaLevelSelectionService;
  SigmaPeriodSelectionService?: SigmaPeriodSelectionService;
  WestgardViewModel?: WestgardViewModelApi;
  LISClientService?: LisClientApi;
  BackupService?: BackupServiceApi;
  BACKUP_IMPORT_MAX_BYTES?: number;
  BACKUP_IMPORT_WARN_BYTES?: number;
  serializeBackupData?: BackupServiceApi['serializeBackupData'];
  backupTextBytes?: BackupServiceApi['backupTextBytes'];
  backupSizeMB?: BackupServiceApi['backupSizeMB'];
  backupImportSizeError?: BackupServiceApi['backupImportSizeError'];
  backupSizeWarning?: BackupServiceApi['backupSizeWarning'];
  backupChecksum?: BackupServiceApi['backupChecksum'];
  createBackupPackage?: BackupServiceApi['createBackupPackage'];
  parseBackupPackage?: BackupServiceApi['parseBackupPackage'];
  prepareBackupState?: BackupServiceApi['prepareBackupState'];
  prepareBackupImport?: BackupServiceApi['prepareBackupImport'];
  backupSummary?: BackupServiceApi['backupSummary'];
  inspectBackupText?: BackupServiceApi['inspectBackupText'];
  lisGatewayRuntime?: LisGatewayRuntime;
  LIS_GATEWAY_STORAGE_KEY?: string;
  LIS_POLL_MS?: number;
  lisGatewayConfig?: LisClientApi['gatewayConfig'];
  lisNormalizeGatewayUrl?: LisClientApi['normalizeGatewayUrl'];
  lisGatewaySetStatus?: LisClientApi['setStatus'];
  lisGatewayStatusText?: LisClientApi['statusText'];
  lisGatewayFetch?: LisClientApi['gatewayFetch'];
  lisGatewayHealth?: LisClientApi['gatewayHealth'];
  lisGatewayPull?: LisClientApi['pull'];
  lisResultToPointInput?: LisClientApi['resultToPointInput'];
  lisImportResult?: LisClientApi['importResult'];
  lisRejectResult?: LisClientApi['rejectResult'];
  lisGatewayStart?: LisClientApi['start'];
  QCCore?: {
    stats: (values: number[]) => CohortStats & QcWarningStats;
    cleanText: (value: unknown, maximumLength?: number) => string;
    cleanId: (value: unknown) => string;
    targetFromLimits: (low: number, high: number) => Record<string, any> | null;
    limitsFromTarget: (mean: number, sd: number) => Record<string, any> | null;
    systematicShiftCritical: (tea: number, bias: number, sd: number) => Record<string, any> | null;
  };
  qcValueDecimals?: (value: unknown) => number;
};

const root = globalThis as QCLabGlobal;
if (!root.QCCore || typeof root.QCCore.stats !== 'function'
  || typeof root.QCCore.cleanText !== 'function' || typeof root.QCCore.cleanId !== 'function'
  || typeof root.QCCore.targetFromLimits !== 'function' || typeof root.QCCore.limitsFromTarget !== 'function'
  || typeof root.QCCore.systematicShiftCritical !== 'function') {
  throw new Error('QCCore phải được nạp đủ dependency trước các module TypeScript');
}

let loginLockout: { fails?: unknown; until?: unknown } | null = null;
try { loginLockout = JSON.parse(localStorage.getItem('qclab_login_lockout') || 'null'); } catch { loginLockout = null; }
installUiState(root, 'AnalysisUIState', createAnalysisUiState());
installUiState(root, 'AuthUIState', createAuthUiState(loginLockout));
installUiState(root, 'EntryUIState', createEntryUiState());
installUiState(root, 'ManageUIState', createManageUiState());
installUiState(root, 'ReagentUIState', createReagentUiState());
installUiState(root, 'SigmaUIState', createSigmaUiState());

// Adapter tạm thời: caller cũ tiếp tục dùng global trong lúc nguồn nghiệp vụ
// đã được chuyển sang ES Modules có kiểu dữ liệu và dependency rõ ràng.
root.ChartViewModel = chartViewModel;
root.SigmaPresentation = sigmaPresentation;
root.SigmaPeriodViewModel = createSigmaPeriodViewModel({
  sigmaMetric: (tea, bias, cv) => (root.QCCore as any).sigmaMetric(tea, bias, cv),
  teaFor: (test, entry, level, refs) => (globalThis as any).sgEntryTea(test, entry, level, refs),
  teaMeta: (test, source) => (globalThis as any).sgTeaSourceMeta(test, source),
  teaSource: test => (globalThis as any).sgTeaSource(test), teaLabel: source => (globalThis as any).sgTeaLabel(source), teaReference: test => (globalThis as any).sgTeaRefText(test),
  readiness: level => sigmaPresentation.sigmaReadiness(level), muFor: (test, entry, level, tea, refs) => (globalThis as any).sgMU(test, entry, level, tea, refs),
  zone: sigma => sigmaPresentation.sigmaZone(sigma), runPlan: sigma => sigmaPresentation.sigmaRunPlan(sigma),
});
root.SigmaBiasService = createSigmaBiasService({ stats: values => root.QCCore!.stats(values) });
root.SigmaCohortImportService = createSigmaCohortImportService({
  assess: cohort => root.SigmaCohortService!.assess(cohort as any), setTeaSnapshot: (test, entry, level, force) => (globalThis as any).sgSetLevelTeaSnapshot(test, entry, level, force),
  isCurrentPeriod: period => period === (globalThis as any).isoMonth(),
});
root.SigmaPeriodRecordService = createSigmaPeriodRecordService();
root.SigmaLevelEditService = createSigmaLevelEditService({ cleanText: (value, maximumLength) => root.QCCore!.cleanText(value, maximumLength) });
root.SigmaTrackedTestService = createSigmaTrackedTestService({
  orderedTracked: tests => tests.filter(test => test.sgTracked).sort((left, right) => (globalThis as any).operationalTestOrder(left) - (globalThis as any).operationalTestOrder(right) || String((globalThis as any).testDisplayName(left)).localeCompare(String((globalThis as any).testDisplayName(right)), 'vi')),
});
root.SigmaBiasWorkflowService = createSigmaBiasWorkflowService({
  stats: rounds => root.SigmaBiasService!.stats(rounds),
  apply: (records, periodIds, level, bias, rounds, batchId) => root.SigmaBiasService!.applyToPeriods(records, periodIds, level, bias, rounds, batchId),
  createId: () => uid(),
});
root.SigmaMuWorkflowService = createSigmaMuWorkflowService({
  cleanText: (value, maximumLength) => root.QCCore!.cleanText(value, maximumLength),
  parseDate: value => {
    const parse = (globalThis as any).parseVN;
    if (typeof parse === 'function') return parse(value);
    const text = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  },
});
root.SigmaCohortSelectionService = createSigmaCohortSelectionService({
  normalizePeriod: period => root.SigmaCohortService!.normalizePeriod(period),
  today: () => (globalThis as any).isoToday(),
  cohortsForLevelByLot: (data, options) => root.SigmaCohortService!.cohortsForLevelByLot(data, options),
});
root.SigmaTeaEditService = createSigmaTeaEditService({
  cleanText: (value, maximumLength) => root.QCCore!.cleanText(value, maximumLength),
  parseDate: value => {
    const parse = (globalThis as any).parseVN;
    if (typeof parse === 'function') return parse(value);
    const text = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  },
});
root.SigmaTeaSnapshotService = createSigmaTeaSnapshotService();
root.SigmaLevelSelectionService = createSigmaLevelSelectionService();
root.SigmaPeriodSelectionService = createSigmaPeriodSelectionService();
root.NceActionLabels = nceActionLabels;
root.NceActionBasics = nceActionBasics;
root.NceActionIdentityService = createNceActionIdentityService({
  createId: () => uid(), now: () => new Date(), isoDate: value => isoDate(value),
  isCancelled: action => nceActionBasics.actionCancelled(action),
});
root.ActionApprovalGates = createActionApprovalGates({
  todayIso: () => isoToday(), isCancelled: action => nceActionBasics.actionCancelled(action),
  isRecorded: action => nceActionBasics.actionRecorded(action),
  workflowComplete: action => typeof (root as any).actionWorkflowStatus === 'function' && !!(root as any).actionWorkflowStatus(action).complete,
});
root.ActionQcLink = createActionQcLink({
  pointForAction: action => typeof (root as any).actionPoint === 'function' ? (root as any).actionPoint(action) : null,
  findTest: testId => (state.tests || []).find(test => test.id === testId),
  westgard: test => (globalThis as any).activeWestgard(test),
});
root.NceActionRerunPolicy = nceActionRerunPolicy;
root.NceActionRerunCacheKey = nceActionRerunCacheKey;
root.NceActionQcIndex = nceActionQcIndex;
root.NceActionRerunEvaluator = nceActionRerunEvaluator;
root.ActionWorkflowStatusService = createActionWorkflowStatus({
  isCancelled: action => nceActionBasics.actionCancelled(action),
  isRecorded: action => nceActionBasics.actionRecorded(action),
  rerunStatus: action => (root as any).actionRerunStatus(action),
  approvalStatus: action => nceActionBasics.actionApprovalStatus(action),
  protocolStatus: action => (root as any).actionProtocolStatus(action),
  effectivenessStatus: action => (root as any).actionEffectivenessStatus(action),
});
root.PointWorkflowService = createPointWorkflowService({
  isCancelled: action => nceActionBasics.actionCancelled(action), isRecorded: action => nceActionBasics.actionRecorded(action),
  status: action => (root as any).actionWorkflowStatus(action),
});
root.ActionDraftStatusService = createActionDraftStatus({
  todayIso: () => isoToday(), isRecorded: action => nceActionBasics.actionRecorded(action),
  pointForAction: action => typeof (root as any).actionPoint === 'function' ? (root as any).actionPoint(action) : null,
});
root.ActionProtocolService = createActionProtocolService({
  todayIso: () => isoToday(),
  draftStatus: action => root.ActionDraftStatusService!(action),
  needsRerun: action => typeof (root as any).actionNeedsRerun === 'function' && !!(root as any).actionNeedsRerun(action),
  rerunStatus: action => typeof (root as any).actionRerunStatus === 'function'
    ? (root as any).actionRerunStatus(action) : { needed: false, ok: false, point: null },
  activeFollowUp: action => {
    const id = String(action.followUpNceId || '').trim();
    return id ? ((state as any).actions || []).find((candidate: Record<string, any>) => candidate.nceId === id && !nceActionBasics.actionCancelled(candidate)) || null : null;
  },
  isCancelled: action => nceActionBasics.actionCancelled(action), formatDate: value => vnDate(value),
});
root.ActionReviewService = createActionReviewService({
  now: () => new Date().toISOString(),
  isCancelled: action => nceActionBasics.actionCancelled(action),
  approvalStatus: action => nceActionBasics.actionApprovalStatus(action),
  recordStatus: action => nceActionBasics.actionRecordStatus(action),
  workflowStatus: action => typeof (root as any).actionWorkflowStatus === 'function' ? (root as any).actionWorkflowStatus(action) : {},
  activeFollowUp: action => {
    const id = String(action.followUpNceId || '').trim();
    return id ? ((state as any).actions || []).find((candidate: Record<string, any>) => candidate.nceId === id && !nceActionBasics.actionCancelled(candidate)) || null : null;
  },
  isRecorded: action => typeof (root as any).actionRecorded === 'function' && !!(root as any).actionRecorded(action),
  protocolStatus: action => typeof (root as any).actionProtocolStatus === 'function' ? (root as any).actionProtocolStatus(action) : { complete: false, missing: [] },
  rerunStatus: action => typeof (root as any).actionRerunStatus === 'function' ? (root as any).actionRerunStatus(action) : { needed: false, ok: false },
  effectivenessStatus: action => typeof (root as any).actionEffectivenessStatus === 'function' ? (root as any).actionEffectivenessStatus(action) : { complete: false },
  canApproveByUser: (action, user) => typeof (root as any).actionCanApprove === 'function' && !!(root as any).actionCanApprove(action, user),
});
root.ActionEscalationService = createActionEscalationService({
  now: () => new Date().toISOString(), today: () => isoToday(), createId: () => uid(),
  nextNceId: (actions, today) => root.NceActionIdentityService!.nextNceId(actions, today),
  dueDate: days => root.NceActionIdentityService!.dueDate(days),
  isCancelled: action => nceActionBasics.actionCancelled(action),
  approvalStatus: action => nceActionBasics.actionApprovalStatus(action),
  activeFollowUp: (actions, action) => root.NceActionIdentityService!.activeFollowUp(actions, action),
});
root.ActionRecordService = createActionRecordService({
  now: () => new Date().toISOString(), createId: () => uid(),
  isCancelled: action => nceActionBasics.actionCancelled(action), approvalStatus: action => nceActionBasics.actionApprovalStatus(action),
});
root.ActionViolationService = createActionViolationService({
  pointForAction: action => typeof (root as any).actionPoint === 'function' ? (root as any).actionPoint(action) : null,
  findTest: testId => (state.tests || []).find(test => test.id === testId) || null,
  levelFor: (test, level) => lvlCfg(test, level) || null,
  errorType: rules => (globalThis as any).errorType(rules),
});
root.ActionListPresentation = createActionListPresentation({
  levelFor: (test, level) => lvlCfg(test, level) || null,
});
root.ActionEvidencePresentation = createActionEvidencePresentation({
  pointForAction: action => typeof (root as any).actionPoint === 'function' ? (root as any).actionPoint(action) : null,
  eventDate: action => typeof (root as any).actionEventDate === 'function' ? (root as any).actionEventDate(action) : String(action.date || ''),
  formatDate: value => vnDate(value), formatDateTime: value => formatDateTimeVN(value),
});
root.ActionRerunEvidencePresentation = createActionRerunEvidencePresentation({
  pointForAction: action => typeof (root as any).actionPoint === 'function' ? (root as any).actionPoint(action) : null,
  levelShort: (test, level, lot) => root.ActionListPresentation!.levelShort(test, level, lot),
});
root.ActionStatusPresentation = createActionStatusPresentation({
  checkLabels: nceActionLabels.actionLabels.check,
});
root.ActionReviewPresentation = createActionReviewPresentation();
root.ActionDetailPresentation = createActionDetailPresentation({
  sourceLabels: nceActionLabels.actionLabels.source, phaseLabels: nceActionLabels.actionLabels.phase,
  riskLabels: nceActionLabels.actionLabels.risk,
});
root.ActionGuidePresentation = createActionGuidePresentation();
root.ReportPeriodPresentation = createReportPeriodPresentation();
root.ActionBiasService = createActionBiasService({
  teaFor: (test, level) => (globalThis as any).sgTeaBySource(test, (globalThis as any).sgTeaSource(test), level.mean),
  systematicShiftCritical: (tea, bias, sd) => root.QCCore!.systematicShiftCritical(tea, bias, sd),
  sigmaBiasValue: level => typeof (globalThis as any).sgBiasVal === 'function' ? (globalThis as any).sgBiasVal(level) : level.biasEqa ?? level.bias,
});
root.ActionBiasPresentation = createActionBiasPresentation(value => (globalThis as any).fmt(value));
const qcPointWarnings: QcPointWarnings = createQcPointWarnings({
  stats: root.QCCore.stats,
  todayIso: () => isoToday(),
  formatDate: value => vnDate(value),
  formatNumber: (value, decimals) => fmt(value, decimals),
});
root.qcPointWarnings = (test, config, date, runId, value) => qcPointWarnings(
  (state.data && state.data[test.id]) || [], config, date, runId, value,
);
root.PeriodService = createPeriodService({ cleanText: root.QCCore.cleanText });
root.EntryService = createEntryService({
  cleanText: root.QCCore.cleanText,
  cleanId: root.QCCore.cleanId,
  valueDecimals: value => {
    if (typeof root.qcValueDecimals !== 'function') throw new Error('qcValueDecimals chưa được nạp');
    return root.qcValueDecimals(value);
  },
  isPeriodLocked: (state, date) => {
    const period = root.PeriodService;
    return !!(period && typeof period.findLock === 'function' && typeof period.periodForDate === 'function'
      && period.findLock(state, period.periodForDate(date)));
  },
});
const backupTextBytes = (text: string): number => {
  if (typeof Blob !== 'undefined') return new Blob([text]).size;
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return unescape(encodeURIComponent(text)).length;
};
const backupHash = async (text: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
  }
  if (typeof auditSha256 === 'function' && backupTextBytes(text) <= 16 * 1024 * 1024) return auditSha256(text);
  return '';
};
const backupCore = root.QCCore as QCLabGlobal['QCCore'] & {
  validateBackup: (value: unknown) => string[];
  sanitizeBackup: (value: unknown, options: { owned: boolean }) => Record<string, any>;
  validateStateInvariants: (value: Record<string, any>, options: { sanitized: boolean }) => string[];
  verifyAuditChain: (activity: unknown[], anchor: string) => { ok: boolean; brokenIndex: number; reason: string };
  STATE_SCHEMA_VERSION: number;
};
const backupService = createBackupService({
  validateBackup: backupCore.validateBackup,
  sanitizeBackup: backupCore.sanitizeBackup,
  validateStateInvariants: backupCore.validateStateInvariants,
  verifyAuditChain: backupCore.verifyAuditChain,
  schemaVersion: backupCore.STATE_SCHEMA_VERSION,
  hash: backupHash,
  textBytes: backupTextBytes,
  nowIso: () => new Date().toISOString(),
  appVersion: () => root.QCLAB_APP?.version || '',
});
root.BackupService = backupService;
root.BACKUP_IMPORT_MAX_BYTES = BACKUP_IMPORT_MAX_BYTES;
root.BACKUP_IMPORT_WARN_BYTES = BACKUP_IMPORT_WARN_BYTES;
root.serializeBackupData = backupService.serializeBackupData;
root.backupTextBytes = backupService.backupTextBytes;
root.backupSizeMB = backupService.backupSizeMB;
root.backupImportSizeError = backupService.backupImportSizeError;
root.backupSizeWarning = backupService.backupSizeWarning;
root.backupChecksum = backupService.backupChecksum;
root.createBackupPackage = backupService.createBackupPackage;
root.parseBackupPackage = backupService.parseBackupPackage;
root.prepareBackupState = backupService.prepareBackupState;
root.prepareBackupImport = backupService.prepareBackupImport;
root.backupSummary = backupService.backupSummary;
root.inspectBackupText = backupService.inspectBackupText;
const lisRuntime = createLisGatewayRuntime();
let lisClient: LisClientApi;
const lisStorage = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null };
const renderLisStatus = () => {
  const element = typeof document !== 'undefined' && document.getElementById('lisGatewayStatus');
  if (!element) return;
  element.className = 'alert ' + (lisRuntime.status === 'ok' ? 'ok' : lisRuntime.status === 'syncing' ? 'warn' : lisRuntime.status === 'off' ? '' : 'rej');
  element.textContent = lisClient.statusText();
};
lisClient = createLisClient({
  runtime: lisRuntime,
  storage: lisStorage,
  fetch: async (url, options) => fetch(url, options) as any,
  makeUrl: value => new URL(value),
  createAbortController: () => new AbortController(),
  setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
  clearTimeout: timer => clearTimeout(timer as number),
  setInterval: (callback, milliseconds) => setInterval(callback, milliseconds),
  clearInterval: timer => clearInterval(timer as number),
  nowIso: () => new Date().toISOString(),
  formatDateTime: value => formatDateTimeVN(value),
  renderStatus: renderLisStatus,
  notify: (message, options) => infoDialog(message, options),
  requireWrite: () => requireWrite(),
  getState: () => state,
  levelConfig: (test, level) => lvlCfg(test, level),
  recordPoint: (targetState, input) => {
    if (!root.EntryService) throw new Error('EntryService chưa được nạp');
    return root.EntryService.recordPoint(targetState, input);
  },
  log: (action, detail, target) => logAct(action, detail, target),
  save: options => save(options),
  userName: () => userName(),
  formatNumber: (value, decimals) => fmt(value, decimals),
  rerender: () => rerender(),
});
root.LISClientService = lisClient;
root.lisGatewayRuntime = lisRuntime;
root.LIS_GATEWAY_STORAGE_KEY = LIS_GATEWAY_STORAGE_KEY;
root.LIS_POLL_MS = LIS_POLL_MS;
root.lisGatewayConfig = lisClient.gatewayConfig;
root.lisNormalizeGatewayUrl = lisClient.normalizeGatewayUrl;
root.lisGatewaySetStatus = lisClient.setStatus;
root.lisGatewayStatusText = lisClient.statusText;
root.lisGatewayFetch = lisClient.gatewayFetch;
root.lisGatewayHealth = lisClient.gatewayHealth;
root.lisGatewayPull = lisClient.pull;
root.lisResultToPointInput = lisClient.resultToPointInput;
root.lisImportResult = lisClient.importResult;
root.lisRejectResult = lisClient.rejectResult;
root.lisGatewayStart = lisClient.start;
root.ManageConfigService = createManageConfigService({
  cleanText: root.QCCore.cleanText,
  cleanId: root.QCCore.cleanId,
  targetFromLimits: root.QCCore.targetFromLimits,
  limitsFromTarget: root.QCCore.limitsFromTarget,
});
root.LotTransitionPickerService = createLotTransitionPickerService({
  searchText: value => (globalThis as any).searchText(value), formatDate: value => (globalThis as any).vnDate(value),
  transitionToNo: lotId => (globalThis as any).lotTransitionToNo(lotId),
});
root.ReagentComparisonService = createReagentComparisonService({
  cleanText: root.QCCore.cleanText,
  cleanId: root.QCCore.cleanId,
});
root.SigmaCohortService = createSigmaCohortService({ stats: root.QCCore.stats });
root.WestgardViewModel = westgardViewModel;
