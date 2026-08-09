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
import { westgardViewModel, type WestgardViewModelApi } from '../domain/westgard/westgard-view-model';
import { nceActionLabels, type NceActionLabels } from '../domain/nce/action-labels';
import { nceActionBasics, type NceActionBasics } from '../domain/nce/action-basics';
import { createNceActionIdentityService, type NceActionIdentityService } from '../application/nce/action-identity-service';
import { createActionApprovalGates, type ActionApprovalGates } from '../domain/nce/action-approval-gates';
import { createActionQcLink, type ActionQcLink } from '../domain/nce/action-qc-link';
import { nceActionRerunPolicy, type NceActionRerunPolicy } from '../domain/nce/action-rerun-policy';
import { nceActionRerunCacheKey, type NceActionRerunCacheKey } from '../domain/nce/action-rerun-cache-key';
import { nceActionQcIndex, type NceActionQcIndex } from '../domain/nce/action-qc-index';
import { nceActionRerunEvaluator, type NceActionRerunEvaluator } from '../domain/nce/action-rerun-evaluator';
import { createActionWorkflowStatus, type ActionWorkflowStatus } from '../domain/nce/action-workflow-status';
import { createPointWorkflowService } from '../application/nce/point-workflow-service';
import { createActionDraftStatus } from '../domain/nce/action-draft-status';
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
  ChartViewModel?: ChartViewModelApi;
  EntryService?: EntryServiceApi;
  ManageConfigService?: ManageConfigServiceApi;
  PeriodService?: PeriodServiceApi;
  qcPointWarnings?: (test: Record<string, any>, config: Record<string, any>, date: string,
    runId: string, value: number) => string[];
  ReagentComparisonService?: ReagentComparisonServiceApi;
  SigmaCohortService?: SigmaCohortServiceApi;
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
  };
  qcValueDecimals?: (value: unknown) => number;
};

const root = globalThis as QCLabGlobal;
if (!root.QCCore || typeof root.QCCore.stats !== 'function'
  || typeof root.QCCore.cleanText !== 'function' || typeof root.QCCore.cleanId !== 'function') {
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
});
root.ReagentComparisonService = createReagentComparisonService({
  cleanText: root.QCCore.cleanText,
  cleanId: root.QCCore.cleanId,
});
root.SigmaCohortService = createSigmaCohortService({ stats: root.QCCore.stats });
root.WestgardViewModel = westgardViewModel;
