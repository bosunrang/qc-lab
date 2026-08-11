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
import { createAuditService, type AuditServiceApi } from '../application/audit/audit-service';
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
import { qcPointRunNumber } from '../domain/qc/qc-point-run';
import { qcCusumConfig } from '../domain/qc/cusum-config';
import { normalizeSearchText } from '../domain/qc/search-text';
import { qcLevelTargetValid } from '../domain/qc/level-target';
import { qcLotMeanSd, qcLotTargetSnapshot } from '../domain/qc/lot-target';
import { createReportLevelStats } from '../domain/qc/report-level-stats';
import { createQcErrorDetail } from '../domain/qc/error-detail';
import { qcPlannedTarget } from '../domain/qc/planned-target';
import { createQcPointVoidVerdict } from '../domain/qc/point-void-verdict';
import { qcLotGroupOperational } from '../domain/qc/lot-group-status';
import { createQcDerivedIndex } from '../domain/qc/derived-index';
import { createAcceptedLotPoints } from '../domain/qc/accepted-lot-points';
import { createActiveWestgard } from '../domain/qc/active-westgard';
import { createCusumSeries } from '../domain/qc/cusum-series';
import { createParallelWestgard } from '../domain/qc/parallel-westgard';
import { createQcEntryColumns } from '../domain/qc/entry-columns';
import { selectEntryColumnPoints } from '../domain/qc/entry-column-points';
import { syncCanon, syncedShape, syncJsonMap } from '../domain/sync/snapshot-compare';
import { mergeSyncArray, mergeSyncBranch } from '../domain/sync/array-merge';
import { createSyncStateMerge, uniqueSyncUsers } from '../domain/sync/state-merge';
import { createSyncUpdateBuilder } from '../domain/sync/update-payload';
import { createSyncSnapshot } from '../domain/sync/snapshot-keys';
import { createSyncRetryScheduler } from '../domain/sync/retry-scheduler';
import { createFirstConnectMerge, hasSyncContent } from '../domain/sync/first-connect';
import { createRunIdNormalizer } from '../domain/qc/run-id-normalizer';
import { createPointLotNormalizer } from '../domain/qc/point-lot-normalizer';
import { qcLotLineage } from '../domain/qc/lot-lineage';
import { createQcOperationalAccess, qcLevelConfig } from '../domain/qc/operational-access';
import { createParallelLotLookup } from '../domain/qc/parallel-lot-lookup';
import { createWestgardWorkerJob } from '../domain/westgard/worker-job';
import { createWestgardWorkerRevisionService } from '../domain/westgard/worker-revision';
import { hydrateWestgardWorkerResult as hydrateWestgardWorkerResultTs } from '../domain/westgard/worker-hydrate';
import { createWestgardWorkerPrewarmPlanner } from '../domain/westgard/worker-prewarm';
import { previousLotHistory, lotGroupLevels } from '../domain/qc/lot-history-view-model';
import { createPointCacheService } from '../application/qc/point-cache-service';
import { createStorageSerializePolicy } from '../application/storage/storage-serialize-policy';
import { createSaveScheduler } from '../application/storage/save-scheduler';
import { storageRetryDelay } from '../application/storage/retry-delay';
import { saveDerivedTestIds } from '../application/storage/derived-save-policy';
import { saveCommandPlan } from '../application/storage/save-command-policy';
import { createStorageBootService } from '../application/storage/storage-boot-service';
import { createIndexedDbRecoveryService } from '../application/storage/indexeddb-recovery-service';
import { createPartitionHydrationService } from '../application/storage/partition-hydration-service';
import { createIndexedDbMirrorService } from '../application/storage/indexeddb-mirror-service';
import { createLocalStorageLoadService } from '../application/storage/local-storage-load-service';
import { createLocalStorageSnapshotWriter } from '../application/storage/local-storage-snapshot-writer';
import { createPartitionedSnapshotWriter } from '../application/storage/partitioned-snapshot-writer';
import { createSaveService } from '../application/storage/save-service';
import { createFirebaseLocalStoreService } from '../application/sync/firebase-local-store-service';
import { createFirebaseDisconnectService } from '../application/sync/firebase-disconnect-service';
import { createFirebasePushService } from '../application/sync/firebase-push-service';
import { createFirebaseFullSyncService } from '../application/sync/firebase-full-sync-service';
import { createFirebasePushScheduler } from '../application/sync/firebase-push-scheduler';
import { createFirebaseEmptySnapshotService } from '../application/sync/firebase-empty-snapshot-service';
import { createFirebaseOwnSnapshotService } from '../application/sync/firebase-own-snapshot-service';
import { createFirebaseInvalidSnapshotService } from '../application/sync/firebase-invalid-snapshot-service';
import { createFirebaseAuditRejectionService } from '../application/sync/firebase-audit-rejection-service';
import { createFirebaseRemoteRenderService } from '../application/sync/firebase-remote-render-service';
import { createFirebaseSessionStartService } from '../application/sync/firebase-session-start-service';
import { createFirebaseMergeCommitService } from '../application/sync/firebase-merge-commit-service';
import { createFirebaseConflictDialogService } from '../presentation/sync/firebase-conflict-dialog-service';
import { createFirebaseCloudStatusPresentation } from '../presentation/sync/firebase-cloud-status-presentation';
import { createFirebaseSaveStatusService } from '../presentation/sync/firebase-save-status-service';
import { createFirebaseRemoteRenderSafetyService } from '../presentation/sync/firebase-remote-render-safety-service';
import { createFirebaseAppService } from '../application/sync/firebase-app-service';
import { createFirebaseConfigSourceService } from '../application/sync/firebase-config-source-service';
import { firebaseReadyState } from '../domain/sync/firebase-ready-state';
import { createIndexedDbOpenService } from '../application/storage/indexeddb-open-service';
import { createIndexedDbRecordService } from '../application/storage/indexeddb-record-service';
import { createPartitionedIndexedDbWriteService } from '../application/storage/partitioned-indexeddb-write-service';
import { createPartitionedIndexedDbReadService } from '../application/storage/partitioned-indexeddb-read-service';
import { createIndexedDbClearService } from '../application/storage/indexeddb-clear-service';
import { passwordChangeError, passwordPolicyError } from '../domain/auth/password-policy';
import { createPbkdf2PasswordService, isPbkdf2PasswordHash, passwordHashNeedsUpgrade } from '../domain/auth/pbkdf2-password-service';
import { createLegacyPasswordHashService } from '../domain/auth/legacy-password-hash-service';
import { createLoginLockoutPolicy } from '../domain/auth/login-lockout-policy';
import { createBlankAppState } from '../application/state/blank-app-state';
import { createDefaultAdminUser } from '../domain/auth/default-admin-user';
import { newUserValidationError } from '../domain/auth/new-user-validation';
import { selectUserPermissions } from '../domain/auth/user-permission-selection';
import { createActivityAuditFilter } from '../presentation/audit/activity-audit-filter';
import { activityAuditPagination } from '../presentation/audit/activity-audit-pagination';
import { createActivityAuditCsv } from '../presentation/audit/activity-audit-csv';
import { updateActivityAuditDateRange } from '../presentation/audit/activity-audit-date-range';
import { ACTIVITY_AUDIT_PAGE_SIZES, activityAuditFilterState } from '../presentation/audit/activity-audit-filter-state';
import { activityAuditArchiveWindow } from '../presentation/audit/activity-audit-archive-window';
import { userListModel } from '../presentation/auth/user-list-model';
import { planPartitionWrite } from '../application/storage/partition-write-policy';
import { createQcValueFormat } from '../domain/qc/value-format';
import { createQcStaffIdentity } from '../domain/qc/staff-identity';
import { createQcDateFormat } from '../domain/qc/date-format';
import { createLotTargetHistory } from '../domain/qc/lot-target-history';
import { createTeaAnalyteMeta } from '../domain/tea/analyte-meta';
import { createQcLevelReconciliation } from '../domain/qc/level-reconciliation';
import { createRangeLimitRepair } from '../domain/qc/range-limit-repair';
import { createDerivedCacheInvalidation } from '../application/state/derived-cache-invalidation';
import { reconcileConfigurationRelations } from '../application/state/configuration-relations';
import { normalizeTestConfiguration } from '../application/state/test-configuration-normalization';
import { normalizeStateFoundation } from '../application/state/foundation-normalization';
import { normalizeStateLifecycle } from '../application/state/state-lifecycle-normalization';
import { createCsvDownload } from '../presentation/export/csv-download';
import { cssTokenPixel } from '../presentation/style/css-token-pixel';
import { createBlobDownload } from '../presentation/export/blob-download';
import { createQcReportCsvRows } from '../presentation/report/qc-report-csv-rows';
import { createBasicFormat } from '../presentation/format/basic-format';
import { createWestgardRulePolicy } from '../domain/westgard/rule-policy';
import { createWestgardMemoCache } from '../domain/westgard/memo-cache';
import { createCusumMemoCache } from '../domain/qc/cusum-memo-cache';
import { createAcceptedMemoCache } from '../domain/qc/accepted-memo-cache';
import { createWestgardRuleSettings } from '../domain/westgard/rule-settings';
import { createRangeCandidateService } from '../domain/qc/range-candidate';
import { rangeBiasEvaluation, rangeSafetyGate } from '../domain/qc/range-safety-gate';
import { csvCell as csvCellTs } from '../domain/export/csv-cell';
import { reportExportHelpers } from '../presentation/report/export-helpers';
import { createActionReportSummary } from '../presentation/nce/action-report-summary';
import { createActionReportModel } from '../presentation/nce/action-report-model';
import { createActionCsvRow } from '../presentation/nce/action-csv-row';
import { createSigmaCanvas } from '../presentation/sigma/sigma-canvas';
import { createSigmaChartRenderer } from '../presentation/sigma/sigma-chart-renderer';
import { createSigmaMdcRenderer } from '../presentation/sigma/sigma-mdc-renderer';
import { renameXlsxSheet } from '../presentation/sigma/rename-xlsx-sheet';
import { createXlsxCells } from '../presentation/export/xlsx-cell';
import { createXlsxZip } from '../presentation/export/xlsx-zip';
import { xlsxPeriodNumber } from '../presentation/export/xlsx-period';
import { createXlsxDrawing } from '../presentation/export/xlsx-drawing';
import { sigmaXlsxStyles } from '../presentation/sigma/sigma-xlsx-styles';
import { reportXlsxStyles } from '../presentation/report/report-xlsx-styles';
import { createReportXlsxDrawing } from '../presentation/report/report-xlsx-drawing';
import { createReportXlsxSheet } from '../presentation/report/report-xlsx-sheet';
import { createReportXlsxBuilder } from '../presentation/report/report-xlsx-builder';
import { xlsxEscape } from '../presentation/export/xlsx-escape';
import { REPORT_XLSX_STYLE_IDS } from '../presentation/report/report-xlsx-style-ids';
import { XLSX_COLUMNS } from '../presentation/export/xlsx-columns';
import { xlsxEmu } from '../presentation/export/xlsx-emu';
import { xlsxUtf8 } from '../presentation/export/xlsx-utf8';
import { xlsxRound } from '../presentation/export/xlsx-rounding';
import { sigmaReportMetric as sigmaReportMetricTs } from '../presentation/sigma/sigma-report-metric';
import { sigmaMdcItems as sigmaMdcItemsTs } from '../presentation/sigma/sigma-mdc-items';
import { sigmaMdcLabelPlacements as sigmaMdcLabelPlacementsTs } from '../presentation/sigma/sigma-mdc-label-placement';
import { sigmaExportPixelRatio as sigmaExportPixelRatioTs } from '../presentation/sigma/sigma-export-pixel-ratio';
import { createSigmaReportRows } from '../presentation/sigma/sigma-report-rows';
import { createQcReportRows } from '../presentation/report/qc-report-rows';
import { createQcReportContext } from '../presentation/report/qc-report-context';
import { dataUrlBytes } from '../presentation/sigma/data-url-bytes';
import { createSigmaExportMeta } from '../presentation/sigma/sigma-export-meta';
import { createExportMetaRows } from '../presentation/report/export-meta-rows';
import { createQcExportValueFormat } from '../presentation/report/qc-export-value-format';
import { createCanvasFont } from '../presentation/sigma/canvas-font';
import { createReportLabels } from '../presentation/report/report-labels';
import { createReportSelection } from '../presentation/report/report-selection';
import { createReportSearch } from '../presentation/report/report-search';
import { createSigmaMuTrace } from '../presentation/sigma/sigma-mu-trace';
import { createSigmaPrintRows } from '../presentation/sigma/sigma-print-rows';
import { createSigmaMuPrintRows } from '../presentation/sigma/sigma-mu-print-rows';
import { createReportPointsTable } from '../presentation/report/report-points-table';
import { createActionReportHtml } from '../presentation/nce/action-report-html';
import { createSigmaDraftService } from '../application/storage/sigma-draft-service';
import { createStateAdoptionService } from '../application/storage/state-adoption-service';
import { createCorruptLocalQuarantine } from '../application/storage/corrupt-local-quarantine';
import { createSyncValueCodec } from '../domain/sync/value-codec';
import { createFirebaseConfigSelection } from '../domain/sync/firebase-config-selection';
import { createFirebaseConnectionGate } from '../domain/sync/firebase-connection-gate';
import { syncSnapshotSignature } from '../domain/sync/snapshot-signature';
import { createFirebaseIdentity } from '../domain/sync/firebase-identity';
import { createFirebaseAuditGate } from '../domain/sync/firebase-audit-gate';
import { createFirebasePollingService } from '../application/sync/firebase-polling-service';
import { firebaseDisconnectedState } from '../domain/sync/firebase-lifecycle-state';
import { firebaseCanPull } from '../domain/sync/firebase-pull-gate';
import { createFirebasePullService } from '../application/sync/firebase-pull-service';
import { createFirebaseMergeApplication } from '../application/sync/firebase-merge-application';
import { createLocalPartitionHelpers } from '../application/storage/local-partition-helpers';
import { createLocalSnapshotRecord } from '../application/storage/local-snapshot-record';
import { localPartitionValid } from '../application/storage/local-partition-validation';
import { localRecoverySlots } from '../application/storage/local-recovery-slots';
import { createLocalPartitionTransaction } from '../application/storage/local-partition-transaction';
import { createLocalPartitionRecovery } from '../application/storage/local-partition-recovery';
import { createLocalClearKeys } from '../application/storage/local-clear-keys';
import { firebaseSnapshotGate } from '../domain/sync/firebase-snapshot-gate';
import { firebaseEmptySnapshotPlan } from '../domain/sync/firebase-empty-snapshot';
import { createFirebaseRemoteSnapshot } from '../domain/sync/firebase-remote-snapshot';
import { firebaseOwnSnapshotPlan } from '../domain/sync/firebase-own-snapshot';
import { firebaseFirstConnectPlan } from '../domain/sync/firebase-first-connect-plan';
import {
  createReagentComparisonService,
  type ReagentComparisonServiceApi,
} from '../application/reagent/reagent-comparison-service';
import { reagentReportPresentation } from '../presentation/reagent/reagent-report-presentation';
import { reagentChartPresentation } from '../presentation/reagent/reagent-chart-range';
import { reagentReportItemPresentation } from '../presentation/reagent/reagent-report-items';
import { reagentComparisonLabelPresentation } from '../presentation/reagent/reagent-comparison-label';
import { reagentQuickLabelPresentation } from '../presentation/reagent/reagent-quick-label';
import { reagentToolIconPresentation } from '../presentation/reagent/reagent-tool-icon';
import { reagentPairMath } from '../domain/reagent/reagent-pairs';
import { reagentStatistics } from '../domain/reagent/reagent-statistics';
import { reagentTDistribution } from '../domain/reagent/reagent-t-distribution';
import { createReagentComparisonCalculator } from '../domain/reagent/reagent-comparison-calculation';
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
import { westgardRowsWindow } from '../presentation/westgard/westgard-row-window';
import { westgardArchivedGroups } from '../presentation/westgard/westgard-archived-groups';
import { westgardArchivedMultiViews } from '../presentation/westgard/westgard-archived-multi-views';
import { westgardArchivedGroupMatches } from '../presentation/westgard/westgard-archived-group-match';
import { westgardArchivedTestSelection } from '../presentation/westgard/westgard-archived-test-selection';
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
import { actionInvestigationPresentation, type ActionInvestigationPresentation } from '../presentation/nce/action-investigation-presentation';
import { createActionChecklistPresentation, type ActionChecklistPresentation } from '../presentation/nce/action-checklist-presentation';
import { createReportPeriodPresentation, type ReportPeriodPresentation } from '../presentation/report/report-period-presentation';
import { reportSearchValuePresentation } from '../presentation/report/report-search-values';
import { reportActionIconPresentation } from '../presentation/report/report-action-icon';
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
import { createActionRerunService, type ActionRerunService } from '../application/nce/action-rerun-service';
import { createActionPointIndexService, type ActionPointIndexService } from '../application/nce/action-point-index-service';
import {
  createAnalysisUiState,
  createAuthUiState,
  createEntryUiState,
  createManageUiState,
  createReagentUiState,
  createSigmaUiState,
  installUiState,
} from '../presentation/state/ui-state';

declare let state: Record<string, any> & { data?: Record<string, Record<string, any>[]>; tests?: Record<string, any>[] };
declare function isoToday(): string;
declare function vnDate(value: unknown): string;
declare function fmt(value: unknown, decimals?: number): string;
declare function formatDateTimeVN(value: string): string;
declare function requireWrite(): boolean;
declare function lvlCfg(test: Record<string, any>, level: unknown): Record<string, any>;
declare function logAct(action: string, detail: string, target?: string): void;
declare function save(options: Record<string, any>): void;
declare function hydratePartitionedState(): Promise<boolean>;
declare function restoreFromIndexedDb(): Promise<boolean>;
declare const StateStorageLegacy: { load: () => boolean; hydrate: () => Promise<boolean>; restore: () => Promise<boolean> };
declare function adoptValidatedState(value: unknown): void;
declare function recoverPendingSigmaDraft(): boolean;
declare function ensureShape(options?: Record<string, any>): void;
declare function quarantineCorruptLocal(raw: string, error: unknown): void;
declare const LocalStore: { supported: () => boolean };
declare let partitionSlot: string, localLoadStatus: string, storageHydrationPromise: Promise<boolean>;
declare let mem: any, startupProblem: any;
declare let lsDirty: boolean, lsFullDirty: boolean, lsSaveFailures: number, lsIncrementalStreak: number, lsLastFullSaveAt: number, lsRevision: number;
declare const lsDirtyTestIds: Set<string>;
declare let partitionWrite: Promise<boolean>;
declare function clearDerived(): void;
declare function clearDerivedForTest(testId: unknown): void;
declare function scheduleLocalSave(): void;
declare function scheduleLocalRetry(): void;
declare function markSaved(status: string, detail: string): void;
declare function saveTime(): string;
declare function sigmaDraftNeedsCloud(): boolean;
declare function clearSigmaDraftThrough(stamp: number): void;
declare function persistSigmaDraft(testId: unknown): boolean;
declare function scheduleFbPush(): void;
declare const fb: any;
declare let fbSaveT: any;
declare function fbStopPull(): void;
declare function fbResetRetry(): void;
declare function fbCanWrite(): boolean;
declare function fbNetworkOnline(): boolean;
declare function fbAuditMaySync(snapshot: unknown, source: string): boolean;
declare function fbClone(value: unknown): any;
declare function fbBuildUpdate(value: unknown): { payload: Record<string, any> };
declare function sigmaDraftStamp(): number;
declare function fbStoreLocal(): void;
declare function fbScheduleRetry(): void;
declare function fbFlushPush(): Promise<unknown>;
declare function fbSetReady(): void;
declare function hasLocalQcContent(value: unknown): boolean;
declare function setCloudStatus(text: string, connected: boolean): void;
declare function updateSaveStatus(): void;
declare let saveLabel: string, saveDetail: string;
declare function fbStatusLabel(): string;
declare function fbDataPath(): string;
declare function fbDisconnect(clearAuthUser?: boolean): void;
declare function remoteRenderUnsafe(): boolean;
declare function focusLoginField(): void;
declare let currentUser: any;
declare const firebase: any;
declare function initFirebase(): Promise<unknown>;
declare function ensureFirebaseApp(config: any): Promise<unknown>;
declare function fbHandleValue(value: any, options?: Record<string, any>): Promise<unknown>;
declare function fbStartPull(): void;
declare function auditRelinkChain(entries: any[], anchor: string): any[];
declare function fbHasLocalChanges(): boolean;
declare function ensureAdmin(): void;
declare function renderBrand(): void;
declare function fbMerge(local: any, remote: any, base: any): any;
declare function fbFirstConnectMerge(local: any, remote: any): any;
declare function applyRemoteRender(): void;
declare function confirmDialog(options: Record<string, any>): Promise<boolean>;
declare function getFbCfg(): Record<string, any> | null;
declare function fbConfigSig(config: any): string;
declare function getDeployFbCfg(): any;
declare function getStoredFbCfg(): any;
declare function persistLocalSnapshot(options?: Record<string, any>): boolean;
declare function mirrorIndexedDb(raw: string): boolean;
declare function userName(): string;
declare function rerender(): void;
declare function infoDialog(message: string, options?: Record<string, any>): Promise<unknown>;
declare function auditSha256(text: string): Promise<string>;
declare function uid(): string;
declare function isoDate(value: Date): string;
declare const TEA_ANALYTE_CATALOG: any[];
declare function role(): string;
declare function auditActor(): { user: string; username: string; userId: string; role: string; clientId: string };
declare function auditRuntimeConfig(): { hardCap: number; rotateTo: number; autoVerifyMax: number };
declare function auditEntryHash(entry: Record<string, any>): string;
declare function auditVerifyChain(activity?: Record<string, any>[], anchor?: string): Record<string, any>;
declare function role(): string;

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
  ActionRerunService?: ActionRerunService;
  ActionPointIndexService?: ActionPointIndexService;
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
  ActionInvestigationPresentation?: ActionInvestigationPresentation;
  ActionChecklistPresentation?: ActionChecklistPresentation;
  ReportPeriodPresentation?: ReportPeriodPresentation;
  reportSearchValuePresentation?: typeof reportSearchValuePresentation;
  reportActionIconPresentation?: typeof reportActionIconPresentation;
  ChartViewModel?: ChartViewModelApi;
  EntryService?: EntryServiceApi;
  ManageConfigService?: ManageConfigServiceApi;
  LotTransitionPickerService?: LotTransitionPickerServiceApi;
  PeriodService?: PeriodServiceApi;
  qcPointWarnings?: (test: Record<string, any>, config: Record<string, any>, date: string,
    runId: string, value: number) => string[];
  ReagentComparisonService?: ReagentComparisonServiceApi;
  reagentReportPresentation?: typeof reagentReportPresentation;
  reagentChartPresentation?: typeof reagentChartPresentation;
  reagentReportItemPresentation?: typeof reagentReportItemPresentation;
  reagentComparisonLabelPresentation?: typeof reagentComparisonLabelPresentation;
  reagentQuickLabelPresentation?: typeof reagentQuickLabelPresentation;
  reagentToolIconPresentation?: typeof reagentToolIconPresentation;
  reagentPairMath?: typeof reagentPairMath;
  reagentStatistics?: typeof reagentStatistics;
  reagentTDistribution?: typeof reagentTDistribution;
  reagentComparisonCalculator?: ReturnType<typeof createReagentComparisonCalculator>;
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
  westgardRowsWindow?: typeof westgardRowsWindow;
  westgardArchivedGroups?: typeof westgardArchivedGroups;
  westgardArchivedMultiViews?: typeof westgardArchivedMultiViews;
  westgardArchivedGroupMatches?: typeof westgardArchivedGroupMatches;
  westgardArchivedTestSelection?: typeof westgardArchivedTestSelection;
  LISClientService?: LisClientApi;
  BackupService?: BackupServiceApi;
  AuditService?: AuditServiceApi;
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
  qcPointRunNumber?: typeof qcPointRunNumber;
  qcCusumConfig?: typeof qcCusumConfig;
  normalizeSearchText?: typeof normalizeSearchText;
  qcLevelTargetValid?: typeof qcLevelTargetValid;
  qcLotMeanSd?: typeof qcLotMeanSd; qcLotTargetSnapshot?: typeof qcLotTargetSnapshot;
  reportLevelStatsService?: ReturnType<typeof createReportLevelStats>;
  qcErrorDetail?: ReturnType<typeof createQcErrorDetail>;
  qcPlannedTarget?: typeof qcPlannedTarget;
  qcPointVoidVerdict?: ReturnType<typeof createQcPointVoidVerdict>;
  qcLotGroupOperational?: typeof qcLotGroupOperational;
  qcDerivedIndex?: ReturnType<typeof createQcDerivedIndex>;
  qcAcceptedLotPoints?: ReturnType<typeof createAcceptedLotPoints>;
  qcActiveWestgard?: ReturnType<typeof createActiveWestgard>;
  qcCusumSeries?: ReturnType<typeof createCusumSeries>;
  qcParallelWestgard?: ReturnType<typeof createParallelWestgard>;
  qcEntryColumns?: ReturnType<typeof createQcEntryColumns>;
  qcEntryColumnPoints?: typeof selectEntryColumnPoints;
  syncCanon?: typeof syncCanon; syncedShape?: typeof syncedShape; syncJsonMap?: typeof syncJsonMap;
  mergeSyncArray?: typeof mergeSyncArray; mergeSyncBranch?: typeof mergeSyncBranch;
  uniqueSyncUsers?: typeof uniqueSyncUsers;
  syncStateMerge?: ReturnType<typeof createSyncStateMerge>;
  syncUpdateBuilder?: ReturnType<typeof createSyncUpdateBuilder>;
  syncSnapshot?: ReturnType<typeof createSyncSnapshot>;
  syncRetryScheduler?: ReturnType<typeof createSyncRetryScheduler>;
  syncFirstConnectMerge?: ReturnType<typeof createFirstConnectMerge>;
  syncHasContent?: typeof hasSyncContent;
  qcNormalizeDuplicateRunIds?: ReturnType<typeof createRunIdNormalizer>;
  qcNormalizePointLots?: ReturnType<typeof createPointLotNormalizer>;
  qcLotLineage?: typeof qcLotLineage;
  qcLevelConfig?: typeof qcLevelConfig;
  qcOperationalAccess?: ReturnType<typeof createQcOperationalAccess>;
  qcParallelLotLookup?: ReturnType<typeof createParallelLotLookup>;
  westgardWorkerJobBuilder?: ReturnType<typeof createWestgardWorkerJob>;
  westgardWorkerRevisionService?: ReturnType<typeof createWestgardWorkerRevisionService>;
  westgardWorkerHydrate?: typeof hydrateWestgardWorkerResultTs;
  westgardWorkerPrewarmPlanner?: ReturnType<typeof createWestgardWorkerPrewarmPlanner>;
  qcPreviousLotHistory?: typeof previousLotHistory; qcLotGroupLevels?: typeof lotGroupLevels;
  qcPointCache?: ReturnType<typeof createPointCacheService>;
  storageSerializePolicy?: ReturnType<typeof createStorageSerializePolicy>;
  localSaveScheduler?: ReturnType<typeof createSaveScheduler>;
  storageRetryDelay?: typeof storageRetryDelay;
  saveDerivedTestIds?: typeof saveDerivedTestIds;
  saveCommandPolicy?: typeof saveCommandPlan;
  storageBootService?: ReturnType<typeof createStorageBootService>;
  indexedDbRecoveryService?: ReturnType<typeof createIndexedDbRecoveryService>;
  partitionHydrationService?: ReturnType<typeof createPartitionHydrationService>;
  indexedDbMirrorService?: ReturnType<typeof createIndexedDbMirrorService>;
  localStorageLoadService?: ReturnType<typeof createLocalStorageLoadService>;
  localStorageSnapshotWriter?: ReturnType<typeof createLocalStorageSnapshotWriter>;
  partitionedSnapshotWriter?: ReturnType<typeof createPartitionedSnapshotWriter>;
  saveService?: ReturnType<typeof createSaveService>;
  firebaseLocalStoreService?: ReturnType<typeof createFirebaseLocalStoreService>;
  firebaseDisconnectService?: ReturnType<typeof createFirebaseDisconnectService>;
  firebasePushService?: ReturnType<typeof createFirebasePushService>;
  firebaseFullSyncService?: ReturnType<typeof createFirebaseFullSyncService>;
  firebasePushScheduler?: ReturnType<typeof createFirebasePushScheduler>;
  firebaseEmptySnapshotService?: ReturnType<typeof createFirebaseEmptySnapshotService>;
  firebaseOwnSnapshotService?: ReturnType<typeof createFirebaseOwnSnapshotService>;
  firebaseInvalidSnapshotService?: ReturnType<typeof createFirebaseInvalidSnapshotService>;
  firebaseAuditRejectionService?: ReturnType<typeof createFirebaseAuditRejectionService>;
  firebaseRemoteRenderService?: ReturnType<typeof createFirebaseRemoteRenderService>;
  firebaseSessionStartService?: ReturnType<typeof createFirebaseSessionStartService>;
  firebaseMergeCommitService?: ReturnType<typeof createFirebaseMergeCommitService>;
  firebaseConflictDialogService?: ReturnType<typeof createFirebaseConflictDialogService>;
  firebaseCloudStatusPresentation?: ReturnType<typeof createFirebaseCloudStatusPresentation>;
  firebaseSaveStatusService?: ReturnType<typeof createFirebaseSaveStatusService>;
  firebaseRemoteRenderSafetyService?: ReturnType<typeof createFirebaseRemoteRenderSafetyService>;
  firebaseAppService?: ReturnType<typeof createFirebaseAppService>;
  firebaseConfigSourceService?: ReturnType<typeof createFirebaseConfigSourceService>;
  firebaseReadyState?: typeof firebaseReadyState;
  indexedDbOpenService?: ReturnType<typeof createIndexedDbOpenService>;
  indexedDbRecordService?: ReturnType<typeof createIndexedDbRecordService>;
  partitionedIndexedDbWriteService?: ReturnType<typeof createPartitionedIndexedDbWriteService>;
  partitionedIndexedDbReadService?: ReturnType<typeof createPartitionedIndexedDbReadService>;
  indexedDbClearService?: ReturnType<typeof createIndexedDbClearService>;
  passwordPolicyError?: typeof passwordPolicyError;
  passwordChangeError?: typeof passwordChangeError;
  pbkdf2PasswordService?: ReturnType<typeof createPbkdf2PasswordService>;
  isPbkdf2PasswordHash?: typeof isPbkdf2PasswordHash;
  passwordHashNeedsUpgrade?: typeof passwordHashNeedsUpgrade;
  legacyPasswordHashService?: ReturnType<typeof createLegacyPasswordHashService>;
  loginLockoutPolicy?: ReturnType<typeof createLoginLockoutPolicy>;
  blankAppStateFactory?: (users: unknown) => Record<string, any>;
  defaultAdminUserFactory?: (id: unknown, passHash: unknown) => Record<string, any>;
  newUserValidationError?: typeof newUserValidationError;
  selectUserPermissions?: typeof selectUserPermissions;
  activityAuditFilter?: ReturnType<typeof createActivityAuditFilter>;
  activityAuditPagination?: typeof activityAuditPagination;
  activityAuditCsv?: ReturnType<typeof createActivityAuditCsv>;
  updateActivityAuditDateRange?: typeof updateActivityAuditDateRange;
  activityAuditFilterState?: typeof activityAuditFilterState;
  activityAuditPageSizes?: typeof ACTIVITY_AUDIT_PAGE_SIZES;
  activityAuditArchiveWindow?: typeof activityAuditArchiveWindow;
  userListModel?: typeof userListModel;
  planPartitionWrite?: typeof planPartitionWrite;
  qcValueFormat?: ReturnType<typeof createQcValueFormat>;
  qcStaffIdentity?: ReturnType<typeof createQcStaffIdentity>;
  qcDateFormat?: ReturnType<typeof createQcDateFormat>;
  qcLotTargetHistory?: ReturnType<typeof createLotTargetHistory>;
  teaAnalyteMetaService?: ReturnType<typeof createTeaAnalyteMeta>;
  qcLevelReconciliation?: ReturnType<typeof createQcLevelReconciliation>;
  qcRangeLimitRepair?: ReturnType<typeof createRangeLimitRepair>;
  derivedCacheInvalidation?: ReturnType<typeof createDerivedCacheInvalidation>;
  qcConfigurationRelations?: typeof reconcileConfigurationRelations;
  qcTestConfiguration?: typeof normalizeTestConfiguration;
  qcStateFoundation?: typeof normalizeStateFoundation;
  qcStateLifecycle?: typeof normalizeStateLifecycle;
  csvDownload?: ReturnType<typeof createCsvDownload>;
  cssTokenPixel?: typeof cssTokenPixel;
  blobDownload?: ReturnType<typeof createBlobDownload>;
  qcReportCsvRows?: ReturnType<typeof createQcReportCsvRows>;
  nceCsvRow?: ReturnType<typeof createActionCsvRow>;
  sigmaCanvasFactory?: ReturnType<typeof createSigmaCanvas>;
  sigmaChartRenderer?: ReturnType<typeof createSigmaChartRenderer>;
  sigmaMdcRenderer?: ReturnType<typeof createSigmaMdcRenderer>;
  renameSigmaXlsxSheet?: typeof renameXlsxSheet;
  xlsxCells?: ReturnType<typeof createXlsxCells>;
  xlsxZip?: ReturnType<typeof createXlsxZip>;
  xlsxPeriodNumber?: typeof xlsxPeriodNumber;
  xlsxDrawing?: ReturnType<typeof createXlsxDrawing>;
  sigmaXlsxStyles?: typeof sigmaXlsxStyles;
  reportXlsxStyles?: typeof reportXlsxStyles;
  reportXlsxDrawing?: ReturnType<typeof createReportXlsxDrawing>;
  reportXlsxSheet?: ReturnType<typeof createReportXlsxSheet>;
  reportXlsxBuild?: ReturnType<typeof createReportXlsxBuilder>;
  xlsxEscape?: typeof xlsxEscape;
  reportXlsxStyleIds?: typeof REPORT_XLSX_STYLE_IDS;
  xlsxColumns?: typeof XLSX_COLUMNS;
  xlsxEmu?: typeof xlsxEmu;
  xlsxUtf8?: typeof xlsxUtf8;
  xlsxRound?: typeof xlsxRound;
  qcBasicFormat?: ReturnType<typeof createBasicFormat>;
  westgardRulePolicy?: ReturnType<typeof createWestgardRulePolicy>;
  westgardMemoCache?: ReturnType<typeof createWestgardMemoCache>;
  qcCusumMemoCache?: ReturnType<typeof createCusumMemoCache>;
  qcAcceptedMemoCache?: ReturnType<typeof createAcceptedMemoCache>;
  westgardRuleSettings?: ReturnType<typeof createWestgardRuleSettings>;
  qcRangeCandidateService?: ReturnType<typeof createRangeCandidateService>;
  qcRangeSafetyGate?: typeof rangeSafetyGate;
  qcRangeBiasEvaluation?: typeof rangeBiasEvaluation;
  csvCellService?: typeof csvCellTs;
  reportExportHelpers?: typeof reportExportHelpers;
  actionReportSummary?: ReturnType<typeof createActionReportSummary>;
  actionReportModel?: ReturnType<typeof createActionReportModel>;
  sigmaReportMetricService?: typeof sigmaReportMetricTs;
  sigmaMdcItemsService?: typeof sigmaMdcItemsTs;
  sigmaMdcLabelPlacementService?: typeof sigmaMdcLabelPlacementsTs;
  sigmaExportPixelRatioService?: typeof sigmaExportPixelRatioTs;
  sigmaReportRowsService?: ReturnType<typeof createSigmaReportRows>;
  qcReportRowsService?: ReturnType<typeof createQcReportRows>;
  qcReportContext?: ReturnType<typeof createQcReportContext>;
  sigmaDataUrlBytes?: typeof dataUrlBytes;
  sigmaExportMetaService?: ReturnType<typeof createSigmaExportMeta>;
  exportMetaRowsService?: ReturnType<typeof createExportMetaRows>;
  qcExportValueFormat?: ReturnType<typeof createQcExportValueFormat>;
  sigmaCanvasFont?: ReturnType<typeof createCanvasFont>;
  reportLabels?: ReturnType<typeof createReportLabels>;
  reportSelection?: ReturnType<typeof createReportSelection>;
  reportSearch?: ReturnType<typeof createReportSearch>;
  sigmaMuTraceService?: ReturnType<typeof createSigmaMuTrace>;
  sigmaPrintRowsService?: ReturnType<typeof createSigmaPrintRows>;
  sigmaMuPrintRowsService?: ReturnType<typeof createSigmaMuPrintRows>;
  reportPointsTableService?: ReturnType<typeof createReportPointsTable>;
  actionReportHtml?: ReturnType<typeof createActionReportHtml>;
  sigmaDraftService?: ReturnType<typeof createSigmaDraftService>;
  stateAdoptionService?: ReturnType<typeof createStateAdoptionService>;
  corruptLocalQuarantine?: ReturnType<typeof createCorruptLocalQuarantine>;
  syncValueCodec?: ReturnType<typeof createSyncValueCodec>;
  firebaseConfigSelection?: ReturnType<typeof createFirebaseConfigSelection>;
  firebaseConnectionGate?: ReturnType<typeof createFirebaseConnectionGate>;
  syncSnapshotSignature?: typeof syncSnapshotSignature;
  firebaseIdentity?: ReturnType<typeof createFirebaseIdentity>;
  firebaseAuditGate?: ReturnType<typeof createFirebaseAuditGate>;
  firebasePollingService?: ReturnType<typeof createFirebasePollingService>;
  firebaseDisconnectedState?: typeof firebaseDisconnectedState;
  firebaseCanPull?: typeof firebaseCanPull;
  firebasePullService?: ReturnType<typeof createFirebasePullService>;
  firebaseMergeApplication?: ReturnType<typeof createFirebaseMergeApplication>;
  localPartitionHelpers?: ReturnType<typeof createLocalPartitionHelpers>;
  localSnapshotRecord?: ReturnType<typeof createLocalSnapshotRecord>;
  localPartitionValid?: typeof localPartitionValid;
  localRecoverySlots?: typeof localRecoverySlots;
  localPartitionTransaction?: ReturnType<typeof createLocalPartitionTransaction>;
  localPartitionRecovery?: ReturnType<typeof createLocalPartitionRecovery>;
  localClearKeys?: ReturnType<typeof createLocalClearKeys>;
  firebaseSnapshotGate?: typeof firebaseSnapshotGate;
  firebaseEmptySnapshotPlan?: typeof firebaseEmptySnapshotPlan;
  firebaseRemoteSnapshot?: ReturnType<typeof createFirebaseRemoteSnapshot>;
  firebaseOwnSnapshotPlan?: typeof firebaseOwnSnapshotPlan;
  firebaseFirstConnectPlan?: typeof firebaseFirstConnectPlan;
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
root.qcPointRunNumber = qcPointRunNumber;
root.qcCusumConfig = qcCusumConfig;
root.normalizeSearchText = normalizeSearchText;
root.qcLevelTargetValid = qcLevelTargetValid;
root.qcLotMeanSd = qcLotMeanSd; root.qcLotTargetSnapshot = qcLotTargetSnapshot;
root.reportLevelStatsService = createReportLevelStats(root.QCCore.stats);
root.qcErrorDetail = createQcErrorDetail({ errorType: (rules: string[]) => (root.QCCore as any).errorType(rules), primaryRule: (rules: string[]) => (root.QCCore as any).primaryErrorRule(rules), descriptions: (root.QCCore as any).WG_RULE_DESCRIPTIONS });
root.qcPlannedTarget = qcPlannedTarget;
root.qcPointVoidVerdict = createQcPointVoidVerdict({
  configuredLot: (test, level) => ((root as any).lvlCfg(test, level) || {}).lot || '',
  activeVerdict: (test, pointId) => (root as any).activeWestgard(test).byPoint.get(pointId),
  parallelVerdict: (test, input, pointId) => (root as any).parallelWestgard(test, input).byPoint.get(pointId),
});
root.qcLotGroupOperational = qcLotGroupOperational;
root.qcDerivedIndex = createQcDerivedIndex({ operationalGroup: qcLotGroupOperational, switchesLot: transition => (root as any).transitionSwitchesLot(transition) });
root.qcAcceptedLotPoints = createAcceptedLotPoints({ pointTarget: (root.QCCore as any).pointTarget, latestRules: (root.QCCore as any).westgardLatestRulesFromZ });
root.qcActiveWestgard = createActiveWestgard({ single: (root.QCCore as any).westgardByPoint, multi: (root.QCCore as any).westgardMultiByPoint });
root.qcCusumSeries = createCusumSeries((root.QCCore as any).cusumMovingAverage);
root.qcParallelWestgard = createParallelWestgard((root.QCCore as any).westgardByPoint);
root.qcEntryColumns = createQcEntryColumns({ levels: test => (root as any).operationalLevels(test), parallel: (test, level) => (root as any).parallelLotForLevel(test, level) });
root.qcEntryColumnPoints = selectEntryColumnPoints;
root.syncCanon = syncCanon; root.syncedShape = syncedShape; root.syncJsonMap = syncJsonMap;
root.mergeSyncArray = mergeSyncArray; root.mergeSyncBranch = mergeSyncBranch;
root.uniqueSyncUsers = uniqueSyncUsers;
const syncConfig=(root as any).fbSyncMergeConfig;
if(syncConfig){root.syncSnapshot = createSyncSnapshot(syncConfig.top, syncJsonMap);root.syncStateMerge = createSyncStateMerge(syncConfig);root.syncUpdateBuilder = createSyncUpdateBuilder({...syncConfig,snapshot:root.syncSnapshot});root.syncFirstConnectMerge=createFirstConnectMerge({...syncConfig,merge:root.syncStateMerge,uniqueUsers:uniqueSyncUsers});root.syncHasContent=source=>hasSyncContent(source,syncConfig.contentKeys);}
root.syncRetryScheduler = createSyncRetryScheduler({setTimeout:(fn,delay)=>globalThis.setTimeout(fn,delay),clearTimeout:timer=>globalThis.clearTimeout(timer)});
root.qcPreviousLotHistory = previousLotHistory; root.qcLotGroupLevels = lotGroupLevels;
root.qcPointCache = createPointCacheService(() => state.data || {}, point => (root as any).pointRunNo(point));
root.qcNormalizeDuplicateRunIds = createRunIdNormalizer(point => (root as any).pointRunNo(point));
root.qcNormalizePointLots = createPointLotNormalizer({id:()=> (root as any).uid(),today:()=> (root as any).isoToday(),normalizeRuns:source=>root.qcNormalizeDuplicateRunIds?.(source)});
root.qcLotLineage = qcLotLineage;
root.qcLevelConfig = qcLevelConfig;
root.qcOperationalAccess = createQcOperationalAccess({test:(test:any)=>(root as any).isOperationalTest(test),levels:(test:any)=>(root as any).operationalLevels(test),panel:(test:any)=>(root as any).operationalPanelForTest(test),group:(level:any)=>(root as any).operationalLotGroupForLevel(level),activePoints:(test:any,level:any,withIndex:any)=>(root as any).activeLotPoints(test,level,withIndex),display:(test:any)=>(root as any).testDisplayName(test)});
root.qcParallelLotLookup = createParallelLotLookup({level:qcLevelConfig,panel:(test:any)=>(root as any).operationalPanelForTest(test),transitions:()=>((state as any).lotTransitions||[]),lots:()=>((state as any).qcLots||[]),target:(test:any,level:any,lotId:any,lotNo:any)=>(root as any).lotTargetSnapshot(test,level,lotId,lotNo)});
root.westgardWorkerJobBuilder = createWestgardWorkerJob({globalRules:()=>((state as any).westgardRules||{}),levels:(test:any)=>(root as any).operationalLevels(test),points:(testId:any)=>(state.data?.[testId]||[])});
root.westgardWorkerRevisionService = createWestgardWorkerRevisionService();
root.westgardWorkerHydrate = hydrateWestgardWorkerResultTs;
root.westgardWorkerPrewarmPlanner = createWestgardWorkerPrewarmPlanner(3000);
root.storageSerializePolicy = createStorageSerializePolicy(() => typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
root.localSaveScheduler = createSaveScheduler({setTimeout:(fn:()=>void,delay:number)=>globalThis.setTimeout(fn,delay),clearTimeout:(timer:any)=>globalThis.clearTimeout(timer),cancelIdle:typeof globalThis.cancelIdleCallback==='function'?(handle:any)=>globalThis.cancelIdleCallback(handle):null});
root.storageRetryDelay = storageRetryDelay;
root.saveDerivedTestIds = saveDerivedTestIds;
root.saveCommandPolicy = saveCommandPlan;
root.localStorageLoadService = createLocalStorageLoadService({
  read: () => localStorage.getItem('qclab'),
  adoptEmpty: () => {
    localLoadStatus = 'missing'; if (mem) state = mem; ensureShape();
    const errors = (root.QCCore as any).validateStateInvariants(state);
    if (errors.length) { startupProblem = {raw:'',message:errors.join('\n')}; return false; }
    return true;
  },
  adopt: value => adoptValidatedState(value),
  accepted: () => { localLoadStatus = 'local'; },
  rejectedRead: () => { startupProblem = {raw:'',message:'TrÃ¬nh duyá»‡t khÃ´ng cho phÃ©p Ä‘á»c vÃ¹ng lÆ°u trá»¯ cá»¥c bá»™.'}; },
  rejectedInvalid: (raw, error) => { localLoadStatus = 'invalid'; quarantineCorruptLocal(raw, error); startupProblem = {raw,message:error && (error as Error).message ? (error as Error).message : 'Dá»¯ liá»‡u cá»¥c bá»™ khÃ´ng há»£p lá»‡.'}; },
});
root.localStorageSnapshotWriter = createLocalStorageSnapshotWriter({
  set: (key, value) => localStorage.setItem(key, value),
  remove: key => localStorage.removeItem(key),
  saved: quiet => { if (!quiet) markSaved('Ä‘Ã£ lÆ°u cá»¥c bá»™','LÃºc '+saveTime()); },
  failed: quiet => { if (!quiet) markSaved('lá»—i lÆ°u cá»¥c bá»™','Kiá»ƒm tra dung lÆ°á»£ng trÃ¬nh duyá»‡t'); },
});
root.partitionedSnapshotWriter = createPartitionedSnapshotWriter({
  plan: input => {
    let plan: { dirtyTestIds: string[] | null; streak: number; lastFull: number };
    if (root.planPartitionWrite) plan = root.planPartitionWrite({fullDirty:input.fullDirty,streak:input.streak,lastFull:input.lastFull,now:input.now,maxIncrementals:input.maxIncrementals,maxMs:input.maxMs,dirtyTestIds:input.dirtyTestIds});
    else { const full = input.fullDirty || input.streak >= input.maxIncrementals || input.now - input.lastFull >= input.maxMs; plan = {dirtyTestIds:full?null:input.dirtyTestIds,streak:full?0:input.streak+1,lastFull:full?input.now:input.lastFull}; }
    lsIncrementalStreak = plan.streak; lsLastFullSaveAt = plan.lastFull; lsFullDirty = false; lsDirtyTestIds.clear();
    return plan.dirtyTestIds;
  },
  defer: () => { lsDirty = true; scheduleLocalSave(); },
  writePartitioned: (value, slot, dirtyTestIds) => partitionWrite.catch(() => false).then(() => (LocalStore as any).writePartitioned(value, slot, {dirtyTestIds})),
  setPending: pending => { partitionWrite = pending; },
  completed: (result, input) => {
    partitionSlot = String(result.slot || ''); lsSaveFailures = 0;
    try { localStorage.setItem('qclab_boot',JSON.stringify({format:1,slot:result.slot,savedAt:result.savedAt,shell:result.shell})); localStorage.setItem('qclab_saved_at',String(result.savedAt)); localStorage.removeItem('qclab'); } catch {}
    if (!sigmaDraftNeedsCloud()) clearSigmaDraftThrough(input.localDraftStamp);
    if (!input.quiet) markSaved('Ä‘Ã£ lÆ°u cá»¥c bá»™','IndexedDB phÃ¢n vÃ¹ng Â· LÃºc '+saveTime());
  },
  failed: input => { lsDirty = true; lsFullDirty = true; lsSaveFailures++; scheduleLocalRetry(); if (!input.quiet) markSaved('lá»—i lÆ°u cá»¥c bá»™','KhÃ´ng thá»ƒ ghi IndexedDB phÃ¢n vÃ¹ng'); },
});
root.saveService = createSaveService({
  plan: options => saveCommandPlan(options),
  invalidate: ids => { if (ids === null) return; if (ids.length) [...new Set(ids.filter(Boolean))].forEach(clearDerivedForTest); else clearDerived(); },
  captureState: () => { mem = state; },
  touchCloud: () => { state._ts = Date.now(); state._client = fb.clientId; },
  prepareStorage: (plan, options) => {
    if (plan.storageTestIds.length) plan.storageTestIds.forEach(id => lsDirtyTestIds.add(String(id)));
    else if (plan.fullDirty) lsFullDirty = true;
    if (plan.persistSigmaDraft) persistSigmaDraft(options.sigmaTestId);
  },
  beginLocalSave: () => { lsRevision++; lsDirty = true; markSaved('Ä‘ang lÆ°u','...'); scheduleLocalSave(); },
  scheduleCloud: () => { fb.dirty = true; scheduleFbPush(); },
});
root.firebaseLocalStoreService = createFirebaseLocalStoreService({
  persistSnapshot: () => { if (typeof persistLocalSnapshot !== 'function') return false; persistLocalSnapshot({changed:true,quiet:true}); return true; },
  serialize: value => JSON.stringify(value),
  writeLocal: raw => localStorage.setItem('qclab',raw),
  mirror: raw => { if (typeof mirrorIndexedDb === 'function') mirrorIndexedDb(raw); },
});
if (typeof (root as any).fbDisconnect === 'function') root.firebaseDisconnectService = createFirebaseDisconnectService({
  stopPolling: () => fbStopPull(),
  cancelPendingPush: () => { if (fbSaveT) { clearTimeout(fbSaveT); fbSaveT = null; } },
  resetRetry: () => fbResetRetry(),
  detachListener: () => { if (fb.ref) fb.ref.off(); },
  resetSession: clearAuthUser => {
    if (root.firebaseDisconnectedState) { Object.assign(fb,root.firebaseDisconnectedState(fb,clearAuthUser)); return; }
    fb.ready=false;fb.initialized=false;fb.ref=null;fb.synced=null;fb.seenSig=null;if(clearAuthUser)fb.authUser=null;
  },
});
if (typeof (root as any).fbFlushPush === 'function') root.firebasePushService = createFirebasePushService({
  canPush: () => fbCanWrite() && fbNetworkOnline(),
  auditMaySync: () => fbAuditMaySync(state,'Nhật ký cục bộ'),
  prepare: () => {
    state._ts=Date.now();state._client=fb.clientId;
    const current=fbClone(state),{payload}=fbBuildUpdate(current),draftStamp=typeof sigmaDraftStamp==='function'?sigmaDraftStamp():0;
    return {current,payload,draftStamp};
  },
  noChanges: draftStamp => { fb.dirty=false;fbResetRetry();if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(draftStamp);markSaved('đã đồng bộ','Lúc '+saveTime()); },
  beforeWrite: () => markSaved('đang đồng bộ','Firebase'),
  update: (ref,payload) => ref.update(payload),
  succeeded: (current,draftStamp) => { fb.synced=current;fb.dirty=false;fbResetRetry();markSaved('đã đồng bộ','Lúc '+saveTime());if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(draftStamp);fbStoreLocal(); },
  failed: () => { fb.dirty=true;markSaved('lỗi đồng bộ','Dữ liệu cục bộ vẫn còn · sẽ tự thử lại');fbScheduleRetry(); },
});
if (typeof (root as any).syncNow === 'function') root.firebaseFullSyncService = createFirebaseFullSyncService({
  canSync: () => fbCanWrite(),
  auditMaySync: () => fbAuditMaySync(state,'Nhật ký cục bộ'),
  prepare: () => { mem=state;state._ts=Date.now();state._client=fb.clientId;return {payload:fbClone(state),draftStamp:typeof sigmaDraftStamp==='function'?sigmaDraftStamp():0}; },
  beforeWrite: () => markSaved('đang đồng bộ','Firebase'),
  write: (ref,payload) => ref.set(payload),
  succeeded: (payload,draftStamp) => { fb.synced=payload;fb.dirty=false;markSaved('đã đồng bộ','Lúc '+saveTime());if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(draftStamp);fbStoreLocal(); },
  failed: () => markSaved('lỗi đồng bộ','Dữ liệu cục bộ vẫn còn'),
});
if (typeof (root as any).scheduleFbPush === 'function') root.firebasePushScheduler = createFirebasePushScheduler({
  canWrite: () => fbCanWrite(),
  networkOnline: () => fbNetworkOnline(),
  resetRetry: () => fbResetRetry(),
  clearTimer: timer => clearTimeout(timer),
  setTimer: (fn,delay) => setTimeout(fn,delay),
  flush: () => fbFlushPush(),
  offline: () => markSaved('cục bộ','Mạng ngoại tuyến · sẽ tự đồng bộ khi có mạng'),
  queued: () => markSaved('chờ đồng bộ','Firebase'),
});
if (typeof (root as any).fbHandleValue === 'function') root.firebaseEmptySnapshotService = createFirebaseEmptySnapshotService({
  setReady: () => fbSetReady(),
  clearSynced: () => { fb.synced=null; },
  connected: () => setCloudStatus(fbStatusLabel(),true),
  schedulePush: () => scheduleFbPush(),
  readyWithoutPush: () => markSaved('đám mây','Sẵn sàng đồng bộ · '+fbDataPath()),
});
if (typeof (root as any).fbHandleValue === 'function') root.firebaseOwnSnapshotService = createFirebaseOwnSnapshotService({
  setReady: () => fbSetReady(),
  setBaseline: remote => { fb.synced=remote; },
  clearDirty: () => { fb.dirty=false; },
  resetRetry: () => fbResetRetry(),
  connected: () => setCloudStatus(fbStatusLabel(),true),
  synchronized: () => markSaved('đã đồng bộ','Lúc '+saveTime()),
});
if (typeof (root as any).fbHandleValue === 'function') root.firebaseInvalidSnapshotService = createFirebaseInvalidSnapshotService({
  setReady: () => fbSetReady(),
  report: firstError => markSaved('dữ liệu đám mây không hợp lệ',firstError+' · '+fbDataPath()),
});
if (typeof (root as any).fbRejectBrokenAudit === 'function') root.firebaseAuditRejectionService = createFirebaseAuditRejectionService({
  disconnect: () => fbDisconnect(),
  disconnected: () => setCloudStatus('Đã ngắt đồng bộ để bảo vệ nhật ký',false),
  report: detail => markSaved('audit không hợp lệ',detail),
});
if (typeof (root as any).applyRemoteRender === 'function') root.firebaseRemoteRenderService = createFirebaseRemoteRenderService({
  loggedIn: () => typeof currentUser !== 'undefined' && !!currentUser,
  focusLogin: () => { if(typeof focusLoginField==='function'){try{focusLoginField();}catch{}} },
  unsafe: () => remoteRenderUnsafe(),
  clearPending: () => clearTimeout(fb.pendingRenderT),
  defer: (fn,delay) => { fb.pendingRenderT=setTimeout(fn,delay); },
  received: () => markSaved('đã nhận đồng bộ','Lúc '+saveTime()),
  deferred: () => markSaved('có dữ liệu mới','Sẽ hiển thị khi bạn xong thao tác'),
  rerender: () => rerender(),
});
if (typeof (root as any).initFirebase === 'function') root.firebaseSessionStartService = createFirebaseSessionStartService({
  ensureApp: config => ensureFirebaseApp(config),
  persistAuth: () => firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL),
  currentAuthUser: () => new Promise(resolve => { let off:any=null;off=firebase.auth().onAuthStateChanged((user:any)=>{if(off)off();resolve(user||null);},()=>resolve(null)); }),
  signInAnonymously: async () => { const credential=await firebase.auth().signInAnonymously();return credential&&credential.user||firebase.auth().currentUser||null; },
  unauthenticated: () => { fbDisconnect(true);setCloudStatus('Cần đăng nhập Firebase',false);markSaved('cục bộ','Firebase chưa xác thực'); },
  setAuthUser: user => { fb.authUser=user; },
  disconnect: () => fbDisconnect(),
  createRef: () => firebase.database().ref(fbDataPath()),
  setRef: ref => { fb.ref=ref; },
  subscribe: ref => ref.on('value',(snapshot:any)=>{fbHandleValue(snapshot.val());},(error:any)=>{fbDisconnect();setCloudStatus(error&&error.message&&error.message.indexOf('permission_denied')>=0?'Chưa được cấp quyền Firebase':'Lỗi đọc Firebase',false);markSaved('lỗi kết nối',error&&error.message?error.message:'Firebase');}),
  startPull: () => fbStartPull(),
  loading: () => { setCloudStatus('Đang tải dữ liệu Firebase · '+fbDataPath(),true);markSaved('đang tải dữ liệu','Firebase'); },
  failed: error => { fbDisconnect();setCloudStatus('Lỗi xác thực/kết nối Firebase',false);markSaved('lỗi kết nối',error&&(error as Error).message?(error as Error).message:'Firebase'); },
});
if (typeof (root as any).fbHandleValue === 'function') root.firebaseMergeCommitService = createFirebaseMergeCommitService({
  state: () => state,
  replaceState: value => { state=value; },
  merge: (base,mergeFirstConnect,local,remote) => root.firebaseMergeApplication ? root.firebaseMergeApplication(base,mergeFirstConnect,local,remote) : (base?fbMerge(local,remote,base):(mergeFirstConnect?fbFirstConnectMerge(local,remote):remote)),
  relinkAudit: value => { if(typeof auditRelinkChain==='function'&&Array.isArray(value.activity))value.activity=auditRelinkChain(value.activity,value.activityAnchor||''); },
  clearDerived: () => clearDerived(),
  ensureShape: () => ensureShape(),
  invariantErrors: value => (root.QCCore as any).validateStateInvariants(value),
  rejected: (previous,hadLocalChanges,error) => { state=previous;fb.dirty=hadLocalChanges;fbSetReady();markSaved('dữ liệu đồng bộ không hợp lệ',error); },
  accepted: (merged,remote) => {
    mem=merged;fb.synced=fbClone(remote);fbStoreLocal();
    if(typeof currentUser!=='undefined'&&currentUser){const user=(merged.users||[]).find((x:any)=>x.id===currentUser.id)||(merged.users||[]).find((x:any)=>x.username===currentUser.username);if(user)currentUser=user;}
    if(!merged.users.length)ensureAdmin();try{renderBrand();}catch{}
    fbSetReady();setCloudStatus(fbStatusLabel(),true);applyRemoteRender();if(fbHasLocalChanges())scheduleFbPush();
  },
});
if (typeof (root as any).fbHandleValue === 'function' && typeof confirmDialog === 'function') root.firebaseConflictDialogService = createFirebaseConflictDialogService(confirmDialog);
if (typeof (root as any).setCloudStatus === 'function') root.firebaseCloudStatusPresentation = createFirebaseCloudStatusPresentation(id => document.getElementById(id));
if (typeof (root as any).markSaved === 'function') root.firebaseSaveStatusService = createFirebaseSaveStatusService(id => document.getElementById(id));
if (typeof (root as any).remoteRenderUnsafe === 'function') root.firebaseRemoteRenderSafetyService = createFirebaseRemoteRenderSafetyService({
  modalOpen: () => { const modal=document.getElementById('modalRoot');return !!(modal&&modal.children&&modal.children.length); },
  editingFieldFocused: () => { const active=document.activeElement,main=document.getElementById('main');return !!(active&&main&&main.contains(active)&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)); },
});
if (typeof (root as any).ensureFirebaseApp === 'function') root.firebaseAppService = createFirebaseAppService({sdk: () => firebase,signature: config => fbConfigSig(config)});
if (typeof (root as any).getDeployFbCfg === 'function') root.firebaseConfigSourceService = createFirebaseConfigSourceService({cloud: () => (window as any).QCLAB_CLOUD,readStored: () => localStorage.getItem('qclab_fb')});
root.firebaseReadyState = firebaseReadyState;
if (typeof LocalStore !== 'undefined') root.indexedDbOpenService = createIndexedDbOpenService({indexedDb: () => typeof indexedDB === 'undefined' ? null : indexedDB});
if (root.indexedDbOpenService) root.indexedDbRecordService = createIndexedDbRecordService({open: () => root.indexedDbOpenService!.open()});
root.partitionedIndexedDbWriteService = createPartitionedIndexedDbWriteService({
  supported: () => typeof indexedDB !== 'undefined',
  key: (slot,type,id) => root.localPartitionHelpers ? root.localPartitionHelpers.key(slot,type,id) : 'partition:'+slot+':'+type+(id==null?'':':'+id),
  draft: (state,currentSlot,dirtyTestIds,manifest) => root.localPartitionTransaction!.draft(state,currentSlot,dirtyTestIds,manifest),
  finalize: (state,manifest,slotManifest,draft) => root.localPartitionTransaction!.finalize(state,manifest,slotManifest,draft),
});
root.partitionedIndexedDbReadService = createPartitionedIndexedDbReadService({
  supported: () => typeof indexedDB !== 'undefined',
  key: (slot,type,id) => root.localPartitionHelpers ? root.localPartitionHelpers.key(slot,type,id) : 'partition:'+slot+':'+type+(id==null?'':':'+id),
  slots: preferred => root.localRecoverySlots ? root.localRecoverySlots(preferred) : [preferred,preferred==='a'?'b':'a'],
  recover: (slot,manifest,shell,rows) => root.localPartitionRecovery!(slot,manifest,shell,rows),
});
root.indexedDbClearService = createIndexedDbClearService({
  supported: () => typeof indexedDB !== 'undefined',
  key: (slot,type,id) => root.localPartitionHelpers ? root.localPartitionHelpers.key(slot,type,id) : 'partition:'+slot+':'+type+(id==null?'':':'+id),
  keys: manifests => root.localClearKeys!(manifests),
});
root.passwordPolicyError = passwordPolicyError;
root.passwordChangeError = passwordChangeError;
root.pbkdf2PasswordService = createPbkdf2PasswordService({
  crypto: () => (globalThis as { crypto?: Crypto }).crypto || null,
  textEncoder: () => new TextEncoder(),
});
root.isPbkdf2PasswordHash = isPbkdf2PasswordHash;
root.passwordHashNeedsUpgrade = passwordHashNeedsUpgrade;
root.legacyPasswordHashService = createLegacyPasswordHashService({
  crypto: () => (globalThis as { crypto?: Crypto }).crypto || null,
  textEncoder: () => new TextEncoder(),
});
root.loginLockoutPolicy = createLoginLockoutPolicy();
root.blankAppStateFactory = users => createBlankAppState({ users, teaRegistryVersion: Number((root as any).teaReferenceSchemaVersion) || 3,
  schemaVersion: (root.QCCore as any).STATE_SCHEMA_VERSION,
  westgardDefaults: Object.fromEntries((root.QCCore as any).WG_RULES.map((rule: string) => [rule, (root.QCCore as any).WG_DEFAULT_ON.has(rule)])) });
root.defaultAdminUserFactory = (id, passHash) => createDefaultAdminUser({ id, passHash });
root.newUserValidationError = newUserValidationError;
root.selectUserPermissions = selectUserPermissions;
root.activityAuditFilter = createActivityAuditFilter({
  searchText: value => (globalThis as any).searchText(value), isoDate: value => (globalThis as any).isoDate(value),
  formatDateTime: value => (globalThis as any).formatDateTimeVN(value), roleLabel: value => (globalThis as any).roleLabel(value),
});
root.activityAuditPagination = activityAuditPagination;
root.activityAuditCsv = createActivityAuditCsv({
  formatDateTime: value => (globalThis as any).formatDateTimeVN(value), roleLabel: value => (globalThis as any).roleLabel(value),
});
root.updateActivityAuditDateRange = updateActivityAuditDateRange;
root.activityAuditFilterState = activityAuditFilterState;
root.activityAuditPageSizes = ACTIVITY_AUDIT_PAGE_SIZES;
root.activityAuditArchiveWindow = activityAuditArchiveWindow;
root.userListModel = userListModel;
if (typeof StateStorageLegacy !== 'undefined') root.storageBootService = createStorageBootService({
  partitionedSupported: () => typeof LocalStore !== 'undefined' && LocalStore.supported(),
  readBootRecord: () => localStorage.getItem('qclab_boot'),
  discardBootRecord: () => localStorage.removeItem('qclab_boot'),
  activatePartitionShell: (shell, slot) => { adoptValidatedState(shell); partitionSlot = slot; localLoadStatus = 'partition-shell'; storageHydrationPromise = hydratePartitionedState(); },
  loadLegacy: () => root.localStorageLoadService!.load(),
  localLoadStatus: () => localLoadStatus,
  recoverPendingSigmaDraft,
  restoreFromIndexedDb,
});
if (typeof StateStorageLegacy !== 'undefined') root.indexedDbRecoveryService = createIndexedDbRecoveryService({
  supported: () => typeof LocalStore !== 'undefined' && LocalStore.supported(),
  readPartitioned: () => typeof (LocalStore as any).readPartitioned === 'function' ? (LocalStore as any).readPartitioned() : Promise.resolve(null),
  readLegacy: () => (LocalStore as any).read(),
  adopt: value => adoptValidatedState(value),
  acceptPartitioned: record => {
    mem = state; partitionSlot = String(record.slot || ''); localLoadStatus = 'partitioned'; startupProblem = null;
    try { localStorage.setItem('qclab_boot', JSON.stringify({format:1,slot:record.slot,savedAt:record.savedAt,shell:{...state,data:{}}})); } catch {}
  },
  acceptLegacy: () => { mem = state; localLoadStatus = 'indexeddb'; startupProblem = null; try { localStorage.setItem('qclab', JSON.stringify(state)); } catch {} },
  reportFailure: (kind, error, raw = '') => {
    const message = kind === 'partitioned' ? 'Dá»¯ liá»‡u phÃ¢n vÃ¹ng IndexedDB khÃ´ng há»£p lá»‡.' : 'Dá»¯ liá»‡u IndexedDB khÃ´ng há»£p lá»‡.';
    startupProblem = {raw,message:error && (error as Error).message ? (error as Error).message : message};
    if (raw) startupProblem.raw = raw;
  },
});
if (typeof StateStorageLegacy !== 'undefined') root.partitionHydrationService = createPartitionHydrationService({
  read: () => (LocalStore as any).readPartitioned(),
  adopt: value => adoptValidatedState(value),
  recoverPendingSigmaDraft,
  accept: record => { mem = state; partitionSlot = String(record.slot || ''); localLoadStatus = 'partitioned'; clearDerived(); startupProblem = null; if (lsDirty) scheduleLocalSave(); },
  reportFailure: error => { startupProblem = {raw:'',message:error && (error as Error).message ? (error as Error).message : 'KhÃ´ng thá»ƒ táº£i cÃ¡c phÃ¢n vÃ¹ng dá»¯ liá»‡u QC.'}; },
});
root.indexedDbMirrorService = createIndexedDbMirrorService({
  supported: () => typeof LocalStore !== 'undefined' && LocalStore.supported(),
  writeSerialized: raw => typeof (LocalStore as any).writeSerialized === 'function' ? (LocalStore as any).writeSerialized(raw) : null,
  writeState: value => (LocalStore as any).write(value),
  failed: () => { lsDirty = true; lsSaveFailures++; scheduleLocalRetry(); },
});
root.planPartitionWrite = planPartitionWrite;
root.qcValueFormat = createQcValueFormat();
root.qcStaffIdentity = createQcStaffIdentity();
root.qcDateFormat = createQcDateFormat();
root.qcLotTargetHistory = createLotTargetHistory(() => uid());
root.teaAnalyteMetaService = createTeaAnalyteMeta(()=>typeof TEA_ANALYTE_CATALOG==='undefined'?[]:TEA_ANALYTE_CATALOG);
root.qcLevelReconciliation = createQcLevelReconciliation();
root.qcRangeLimitRepair = createRangeLimitRepair((mean,sd,k)=>(root.QCCore as any).limitsFromTarget(mean,sd,k));
root.qcConfigurationRelations=reconcileConfigurationRelations;
root.qcTestConfiguration=normalizeTestConfiguration;
root.qcStateFoundation=normalizeStateFoundation;
root.qcStateLifecycle=normalizeStateLifecycle;
root.csvDownload=createCsvDownload({createBlob:text=>new Blob([text],{type:'text/csv;charset=utf-8'}),createUrl:blob=>URL.createObjectURL(blob),revokeUrl:url=>URL.revokeObjectURL(url),download:(url,name)=>{const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();},schedule:(work,delay)=>globalThis.setTimeout(work,delay)});
root.cssTokenPixel=(token,fallback)=>cssTokenPixel(token,fallback,key=>typeof getComputedStyle==='function'&&typeof document!=='undefined'?getComputedStyle(document.documentElement).getPropertyValue('--'+key):'');
root.blobDownload=createBlobDownload({createUrl:blob=>URL.createObjectURL(blob),revokeUrl:url=>URL.revokeObjectURL(url),download:(url,name)=>{const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();},schedule:(work,delay)=>globalThis.setTimeout(work,delay)});
root.qcReportCsvRows=createQcReportCsvRows({test:(id:any)=>(state.tests||[]).find((test:any)=>test.id===id),lab:()=>(state as any).lab||{},meta:(kind:any)=>(root as any).exportMetaRows(kind),range:(start:any,end:any)=>(root as any).reportRangeText(start,end),testName:(test:any)=>(root as any).testDisplayName(test),tea:(test:any)=>(root as any).sgTea(test),teaSource:(test:any)=>(root as any).sgTeaSource(test),teaLabel:(source:any)=>(root as any).sgTeaLabel(source),teaReference:(test:any)=>(root as any).sgTeaRefText(test),levels:(test:any)=>(root as any).operationalLevels(test),previous:(test:any,level:any)=>(root as any).previousLotSeries(test,level),rows:(root as any).qcReportRowsService,westgard:(test:any)=>(root as any).activeWestgard(test),staff:(point:any)=>(root as any).pointStaff(point),date:(value:any)=>(root as any).vnDate(value),number:(value:any,decimals?:any)=>(root as any).fmt(value,decimals),state:(value:any)=>(root as any).stateName(value),error:(rules:any)=>(root as any).errorType(rules),stats:(points:any,mean:any,tea:any)=>(root as any).reportLevelStats(points,mean,tea),levelLabel:(test:any,level:any,lot:any)=>(root as any).actionLevelShort(test,level,lot),workflow:(action:any)=>(root as any).actionWorkflowStatus(action),rerun:(action:any)=>(root as any).actionRerunStatus(action),protocol:(action:any)=>(root as any).actionProtocolSummary(action),approval:(action:any)=>(root as any).actionApprovalLabel(action)});
const legacyDerivedCacheState=(root as any).legacyDerivedCacheState;
if(legacyDerivedCacheState)root.derivedCacheInvalidation=createDerivedCacheInvalidation({...legacyDerivedCacheState,pointCache:()=>root.qcPointCache,westgardCache:()=>root.westgardMemoCache,acceptedCache:()=>root.qcAcceptedMemoCache,cusumCache:()=>root.qcCusumMemoCache,invalidateWestgardWorker:testId=>(root as any).invalidateWestgardWorker(testId),invalidateActionCaches:testId=>(root as any).invalidateActionCaches(testId)});
root.qcBasicFormat = createBasicFormat();
root.westgardRulePolicy=createWestgardRulePolicy({rules:(root.QCCore as any).WG_RULES,enabled:(rule:string)=>(root.QCCore as any).ruleEnabled((state as any).westgardRules,rule),levels:(test:any)=>(root as any).operationalLevels(test),resolveAction:(root.QCCore as any).resolveRuleAction,resolveScope:(root.QCCore as any).resolveRuleScope,onInScope:(root.QCCore as any).ruleOnInScope,verdict:(root.QCCore as any).ruleVerdictLevel});
root.westgardMemoCache=createWestgardMemoCache();
root.qcCusumMemoCache=createCusumMemoCache();
root.qcAcceptedMemoCache=createAcceptedMemoCache();
root.westgardRuleSettings=createWestgardRuleSettings({defaults:(root.QCCore as any).WG_DEFAULT_ON?Object.fromEntries((root.QCCore as any).WG_RULES.map((rule:string)=>[rule,(root.QCCore as any).WG_DEFAULT_ON.has(rule)])): {},getState:()=>state,ruleEnabled:(rules:any,rule:string)=>(root.QCCore as any).ruleEnabled(rules,rule),requireWrite:()=>requireWrite(),save:()=>save({}),rerender:()=>rerender()});
root.qcRangeCandidateService=createRangeCandidateService({tests:()=>state.tests||[],actions:()=>((state as any).actions||[]),levelConfig:(test:any,level:any)=>lvlCfg(test,level),points:(test:any,level:any)=>(globalThis as any).operationalLotPoints(test,level),westgard:(test:any)=>(globalThis as any).activeWestgard(test),pointZ:(point:any,mean:any,sd:any)=>(root.QCCore as any).pointZ(point,mean,sd),stats:(values:number[])=>(root.QCCore as any).stats(values),actionCancelled:(action:any)=>typeof (globalThis as any).actionCancelled==='function'&&(globalThis as any).actionCancelled(action),systematicRules:(root.QCCore as any).WG_SE_RULES,limitsFromTarget:(mean:any,sd:any,k:number)=>(root.QCCore as any).limitsFromTarget(mean,sd,k)});
root.qcRangeSafetyGate=rangeSafetyGate;
root.qcRangeBiasEvaluation=rangeBiasEvaluation;
root.csvCellService=csvCellTs;
root.reportExportHelpers=reportExportHelpers;
root.actionReportSummary=createActionReportSummary({labels:()=>typeof (globalThis as any).ACTION_LABELS==='object'?(globalThis as any).ACTION_LABELS:{},excerpt:(value:any,max?:number)=>root.reportExportHelpers!.nceExcerpt(value,max)});
root.actionReportModel=createActionReportModel({labels:()=>typeof (globalThis as any).ACTION_LABELS==='object'?(globalThis as any).ACTION_LABELS:{},rerunStatus:(action:any)=>typeof (globalThis as any).actionRerunStatus==='function'?(globalThis as any).actionRerunStatus(action):{label:''},workflowStatus:(action:any)=>typeof (globalThis as any).actionWorkflowStatus==='function'?(globalThis as any).actionWorkflowStatus(action):{label:'Chưa hoàn tất'},effectivenessStatus:(action:any)=>typeof (globalThis as any).actionEffectivenessStatus==='function'?(globalThis as any).actionEffectivenessStatus(action):{label:'Chưa đánh giá'},riskScore:(action:any)=>typeof (globalThis as any).actionRiskScore==='function'?(globalThis as any).actionRiskScore(action):0,residualRiskScore:(action:any)=>typeof (globalThis as any).actionResidualRiskScore==='function'?(globalThis as any).actionResidualRiskScore(action):0,eventDate:(action:any)=>typeof (globalThis as any).actionEventDate==='function'?(globalThis as any).actionEventDate(action):action.date,approvalLabel:(action:any)=>typeof (globalThis as any).actionApprovalLabel==='function'?(globalThis as any).actionApprovalLabel(action):(action.approvalStatus||'Chờ duyệt'),pointValue:(point:any,test:any)=>(globalThis as any).dataIoQcPoint(point,test),formatDate:(value:any)=>vnDate(value),formatDateTime:(value:any)=>formatDateTimeVN(value),testName:(test:any)=>(globalThis as any).testDisplayName(test),levelShort:(test:any,level:any,lot:any)=>(globalThis as any).actionLevelShort(test,level,lot)});
root.nceCsvRow=createActionCsvRow({test:(id:any)=>(state.tests||[]).find((test:any)=>test.id===id),workflow:(action:any)=>(root as any).actionWorkflowStatus(action),rerun:(action:any)=>(root as any).actionRerunStatus(action),labels:()=>((globalThis as any).ACTION_LABELS||{}),date:(value:any)=>(root as any).vnDate(value),dateTime:(value:any)=>(root as any).formatDateTimeVN(value),eventDate:(action:any)=>(root as any).actionEventDate(action),testName:(test:any)=>(root as any).testDisplayName(test),level:(test:any,level:any,lot:any)=>(root as any).actionLevelShort(test,level,lot),protocol:(action:any)=>(root as any).actionProtocolSummary(action),risk:(action:any)=>(root as any).actionRiskScore(action),residualRisk:(action:any)=>(root as any).actionResidualRiskScore(action),approval:(action:any)=>(root as any).actionApprovalLabel(action)});
root.sigmaCanvasFactory=createSigmaCanvas({scale:(width,height,value)=>(root as any).sigmaExportPixelRatio(width,height,value),create:()=>document.createElement('canvas')});
root.sigmaChartRenderer=createSigmaChartRenderer({levels:row=>(root as any).sigmaLevelsOf(row),canvas:(width,height,scale)=>(root as any).sigmaCanvas(width,height,scale),font:(weight,token,fallback)=>(root as any).dataIoCanvasFont(weight,token,fallback),zone:sigma=>(root as any).sgZone(sigma),bytes:url=>(root as any).sigmaDataURLBytes(url)});
root.sigmaMdcRenderer=createSigmaMdcRenderer({items:rows=>(root as any).sigmaMdcItems(rows),canvas:(width,height,scale)=>(root as any).sigmaCanvas(width,height,scale),font:(weight,token,fallback)=>(root as any).dataIoCanvasFont(weight,token,fallback),zone:sigma=>(root as any).sgZone(sigma),placements:(items,x,y,ctx,bounds)=>(root as any).sigmaMdcLabelPlacements(items,x,y,ctx,bounds),bytes:url=>(root as any).sigmaDataURLBytes(url)});
root.renameSigmaXlsxSheet=(bytes,sheetName)=>renameXlsxSheet(bytes,sheetName,{escape:(value:any)=>(root as any).XlsxCore.escX(value),bytes:(value:any)=>(root as any).XlsxCore.u8(value),zip:(files:any)=>(root as any).XlsxCore.zip(files)});
root.xlsxCells=createXlsxCells(value=>(root as any).XlsxCore.escX(value));
root.xlsxZip=createXlsxZip(value=>new TextEncoder().encode(value));
root.xlsxPeriodNumber=xlsxPeriodNumber;
root.xlsxDrawing=createXlsxDrawing(pixels=>(root as any).XlsxCore.emu(pixels));
root.sigmaXlsxStyles=sigmaXlsxStyles;
root.reportXlsxStyles=reportXlsxStyles;
root.reportXlsxDrawing=createReportXlsxDrawing(pixels=>(root as any).XlsxCore.emu(pixels));
root.reportXlsxSheet=doc=>{const core=(root as any).XlsxCore;return createReportXlsxSheet({columns:core.COLS,text:core.cellStr,number:core.cellNum})(doc);};
root.reportXlsxBuild=doc=>{const core=(root as any).XlsxCore;return createReportXlsxBuilder({bytes:core.u8,escape:core.escX,styles:()=>root.reportXlsxStyles!(),sheet:item=>root.reportXlsxSheet!(item),drawing:images=>root.reportXlsxDrawing!(images),zip:core.zip})(doc);};
root.xlsxEscape=xlsxEscape;
root.reportXlsxStyleIds=REPORT_XLSX_STYLE_IDS;
root.xlsxColumns=XLSX_COLUMNS;
root.xlsxEmu=xlsxEmu;
root.xlsxUtf8=xlsxUtf8;
root.xlsxRound=xlsxRound;
root.sigmaReportMetricService=sigmaReportMetricTs;
root.sigmaMdcItemsService=(rows:any[])=>(sigmaMdcItemsTs(rows,(globalThis as any).sigmaLevelsOf));
root.sigmaMdcLabelPlacementService=(items:any[],X:any,Y:any,ctx:any,bounds:any)=>sigmaMdcLabelPlacementsTs(items,X,Y,ctx,bounds,(globalThis as any).sigmaMdcPeriodLabel);
root.sigmaExportPixelRatioService=sigmaExportPixelRatioTs;
root.sigmaReportRowsService=createSigmaReportRows({trackedTests:()=>typeof (globalThis as any).sgTrackedTests==='function'?(globalThis as any).sgTrackedTests():[],visibleLevels:(test:any)=>typeof (globalThis as any).sgVisibleLevels==='function'?(globalThis as any).sgVisibleLevels(test):(test.levels||[]).map((level:any)=>level.level),rows:(test:any,data:any,levels:any[])=>(globalThis as any).sgRows(test,data,levels),data:(id:any)=>(globalThis as any).sgData(id),teaSource:(test:any)=>typeof (globalThis as any).sgTeaSource==='function'?(globalThis as any).sgTeaSource(test):(test.teaSource||'ricos'),entryTea:(test:any,entry:any)=>typeof (globalThis as any).sgEntryTea==='function'?(globalThis as any).sgEntryTea(test,entry):(globalThis as any).sgTea(test),testName:(test:any)=>(globalThis as any).testDisplayName(test),periodLabel:(value:any)=>(globalThis as any).vnPeriod(value),metric:(value:any)=>root.sigmaReportMetricService!(value),teaMeta:(test:any,source:any)=>typeof (globalThis as any).sgTeaSourceMeta==='function'?(globalThis as any).sgTeaSourceMeta(test,source):{},teaLabel:(source:any)=>typeof (globalThis as any).sgTeaLabel==='function'?(globalThis as any).sgTeaLabel(source):source,teaReference:(test:any)=>typeof (globalThis as any).sgTeaRefText==='function'?(globalThis as any).sgTeaRefText(test):''});
root.qcReportRowsService=createQcReportRows({westgardByPoint:(points:any[],mean:any,sd:any,on:any)=>(root.QCCore as any).westgardByPoint(points,mean,sd,on),ruleOnWithin:(test:any,rule:any)=>(globalThis as any).testRuleOnWithin(test,rule),resultLevel:(test:any,rules:any[])=>(globalThis as any).ruleResultLevel(test,rules),points:(test:any,level:any)=>(globalThis as any).operationalLotPoints(test,level),actions:()=>((state as any).actions||[]),eventDate:(action:any)=>typeof (globalThis as any).actionEventDate==='function'?(globalThis as any).actionEventDate(action):action.date});
root.qcReportContext=createQcReportContext({tea:(test:any)=>typeof (globalThis as any).sgTea==='function'?(globalThis as any).sgTea(test):(test.tea||0),teaSource:(test:any)=>typeof (globalThis as any).sgTeaSource==='function'?(globalThis as any).sgTeaSource(test):'',teaLabel:(source:any)=>typeof (globalThis as any).sgTeaLabel==='function'?(globalThis as any).sgTeaLabel(source):'Ricos / Westgard biological variation',levels:(test:any)=>(globalThis as any).operationalLevels(test),points:(test:any,level:any)=>(globalThis as any).operationalLotPoints(test,level)});
root.sigmaDataUrlBytes=(value:string)=>dataUrlBytes(value,encoded=>atob(encoded));
root.sigmaExportMetaService=createSigmaExportMeta({app:()=>typeof window!=='undefined'?(window as any).QCLAB_APP||{}:{},rules:()=>((state as any).westgardRules||{}),formatDate:(value:any)=>vnDate(value),periodLabel:(value:any)=>(globalThis as any).sigmaPeriodLabel(value)});
root.exportMetaRowsService=createExportMetaRows({app:()=>typeof window!=='undefined'?(window as any).QCLAB_APP||{version:'dev'}:{version:'dev'},rules:()=>((state as any).westgardRules||{}),userName:()=>userName(),formatDateTime:(value:any)=>formatDateTimeVN(value),now:()=>new Date().toISOString()});
root.qcExportValueFormat=createQcExportValueFormat({testValue:(test:any,value:any,number:any)=>typeof (globalThis as any).fmtTestValue==='function'?(globalThis as any).fmtTestValue(test,value):number(value,3),testStat:(test:any,value:any,number:any)=>typeof (globalThis as any).fmtTestStat==='function'?(globalThis as any).fmtTestStat(test,value):number(value,3),pointValue:(point:any,test:any,number:any)=>typeof (globalThis as any).fmtPointValue==='function'?(globalThis as any).fmtPointValue(point,test):number(point&&point.val,Math.max(2,Number(point&&point.valueDecimals)||0)),number:(value:any,decimals:any)=>fmt(value,decimals)});
root.sigmaCanvasFont=createCanvasFont((token:string,fallback:number)=>{if(typeof getComputedStyle==='function'&&typeof document!=='undefined'){const value=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--'+token));if(Number.isFinite(value))return value;}return fallback;});
root.reportLabels=createReportLabels((value:any)=>vnDate(value));
root.reportSelection=createReportSelection();
root.reportSearch=createReportSearch();
root.sigmaMuTraceService=createSigmaMuTrace({escape:(value:any)=>typeof (globalThis as any).esc==='function'?(globalThis as any).esc(value):String(value??''),formatDate:(value:any)=>vnDate(value)});
root.sigmaPrintRowsService=createSigmaPrintRows({escape:(value:any)=>typeof (globalThis as any).esc==='function'?(globalThis as any).esc(value):String(value??''),escapeAttr:(value:any)=>typeof (globalThis as any).escAttr==='function'?(globalThis as any).escAttr(value):String(value??''),format:(value:any,decimals?:number)=>fmt(value,decimals),dpmo:(value:any)=>(globalThis as any).sgFmtDPMO(value),period:(value:any)=>typeof (globalThis as any).vnPeriod==='function'?(globalThis as any).vnPeriod(value):String(value??'')});
root.sigmaMuPrintRowsService=createSigmaMuPrintRows({mu:(test:any,entry:any,level:any)=>typeof (globalThis as any).sgMU==='function'?(globalThis as any).sgMU(test,entry,level):undefined,format:(value:any,decimals?:number)=>fmt(value,decimals),escape:(value:any)=>typeof (globalThis as any).esc==='function'?(globalThis as any).esc(value):String(value??''),period:(value:any)=>typeof (globalThis as any).vnPeriod==='function'?(globalThis as any).vnPeriod(value):String(value??'')});
root.reportPointsTableService=createReportPointsTable({formatDate:(value:any)=>vnDate(value),escape:(value:any)=>typeof (globalThis as any).esc==='function'?(globalThis as any).esc(value):String(value??''),pointValue:(point:any,test:any)=>typeof (globalThis as any).reportQcPoint==='function'?(globalThis as any).reportQcPoint(point,test):fmt(point&&point.val,3),format:(value:any,decimals?:number)=>fmt(value,decimals),verdict:(value:any)=>typeof (globalThis as any).qcVerdictLabel==='function'?(globalThis as any).qcVerdictLabel(value):String(value??''),staff:(point:any)=>typeof (globalThis as any).pointStaff==='function'?(globalThis as any).pointStaff(point):{}});
root.actionReportHtml=createActionReportHtml((value:any)=>typeof (globalThis as any).esc==='function'?(globalThis as any).esc(value):String(value??''));
root.sigmaDraftService=createSigmaDraftService({get:(key:string)=>localStorage.getItem(key),set:(key:string,value:string)=>localStorage.setItem(key,value),remove:(key:string)=>localStorage.removeItem(key),now:()=>Date.now(),clone:(value:any)=>JSON.parse(JSON.stringify(value)),key:'qclab_sigma_draft',savedAtKey:'qclab_saved_at'});
root.stateAdoptionService=createStateAdoptionService({validate:(value:any)=>(root.QCCore as any).validateBackup(value),sanitize:(value:any,options:any)=>(root.QCCore as any).sanitizeBackup(value,options),invariants:(value:any,options:any)=>(root.QCCore as any).validateStateInvariants(value,options)});
root.corruptLocalQuarantine=createCorruptLocalQuarantine(()=>new Date().toISOString());
root.syncValueCodec=createSyncValueCodec();
root.firebaseConfigSelection=createFirebaseConfigSelection(['apiKey','authDomain','databaseURL','projectId','appId']);
root.firebaseConnectionGate=createFirebaseConnectionGate();
root.syncSnapshotSignature=syncSnapshotSignature;
root.firebaseIdentity=createFirebaseIdentity();
root.firebaseAuditGate=createFirebaseAuditGate((entries:any[],anchor:string)=>(root.QCCore as any).verifyAuditChain(entries,anchor));
root.firebasePollingService=createFirebasePollingService({setInterval:(fn:()=>void,ms:number)=>globalThis.setInterval(fn,ms),clearInterval:(timer:any)=>globalThis.clearInterval(timer)});
root.firebaseDisconnectedState=firebaseDisconnectedState;
root.firebaseCanPull=firebaseCanPull;
root.firebasePullService=createFirebasePullService({read:(ref:any)=>ref.once('value'),handle:(value:any,options:any)=>(globalThis as any).fbHandleValue(value,options),canPull:firebaseCanPull});
root.firebaseMergeApplication=createFirebaseMergeApplication({merge:(local:any,remote:any,base:any)=>(globalThis as any).fbMerge(local,remote,base),firstMerge:(local:any,remote:any)=>(globalThis as any).fbFirstConnectMerge(local,remote)});
root.localPartitionHelpers=createLocalPartitionHelpers();
root.localSnapshotRecord=createLocalSnapshotRecord({clone:(value:any)=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)),now:()=>Date.now(),key:'state'});
root.localPartitionValid=localPartitionValid;
root.localRecoverySlots=localRecoverySlots;
root.localPartitionTransaction=createLocalPartitionTransaction({nextSlot:(value:any)=>root.localPartitionHelpers!.nextSlot(value),shell:(value:any)=>root.localPartitionHelpers!.shell(value),now:()=>Date.now()});
root.localPartitionRecovery=createLocalPartitionRecovery(localPartitionValid);
root.localClearKeys=createLocalClearKeys((slot:any,type:any,id?:any)=>root.localPartitionHelpers!.key(slot,type,id),'state');
root.firebaseSnapshotGate=firebaseSnapshotGate;
root.firebaseEmptySnapshotPlan=firebaseEmptySnapshotPlan;
root.firebaseRemoteSnapshot=createFirebaseRemoteSnapshot((value:any)=>(root.QCCore as any).validateBackup(value),(value:any)=>(root.QCCore as any).sanitizeBackup(value));
root.firebaseOwnSnapshotPlan=firebaseOwnSnapshotPlan;
root.firebaseFirstConnectPlan=firebaseFirstConnectPlan;
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
root.ActionInvestigationPresentation = actionInvestigationPresentation;
root.ActionChecklistPresentation = createActionChecklistPresentation({
  checkLabels: nceActionLabels.actionLabels.check,
  effectivenessStatus: form => typeof (root as any).actionEffectivenessStatus === 'function'
    ? (root as any).actionEffectivenessStatus(form) : { cls: 'none', label: 'Chưa đánh giá', complete: false },
});
root.ReportPeriodPresentation = createReportPeriodPresentation();
root.reportSearchValuePresentation = reportSearchValuePresentation;
root.reportActionIconPresentation = reportActionIconPresentation;
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
root.AuditService = createAuditService({
  getState: () => state as { activity?: Record<string, any>[]; activityAnchor?: string },
  uid: () => typeof (root as any).uid === 'function' ? (root as any).uid() : '', nowIso: () => new Date().toISOString(),
  actor: () => typeof (root as any).auditActor === 'function'
    ? (root as any).auditActor() : { user: '', username: '', userId: '', role: '', clientId: '' },
  entryHash: entry => typeof (root as any).auditEntryHash === 'function' ? (root as any).auditEntryHash(entry) : '',
  verifyChain: (activity, anchor) => typeof (root as any).auditVerifyChain === 'function'
    ? (root as any).auditVerifyChain(activity, anchor) : { ok: true, checked: 0, legacy: 0 },
  limits: () => {
    const config = typeof (root as any).auditRuntimeConfig === 'function'
      ? (root as any).auditRuntimeConfig() : { hardCap: 50000, rotateTo: 40000 };
    return { hardCap: config.hardCap, rotateTo: config.rotateTo };
  },
  autoVerifyMax: typeof (root as any).auditRuntimeConfig === 'function' ? (root as any).auditRuntimeConfig().autoVerifyMax : 5000,
});
root.ActionRerunService = createActionRerunService({
  pointsFor: testId => state.data?.[testId], testFor: testId => state.tests?.find(test => test.id === testId),
  runNumber: point => (root as any).pointRunNo(point),
  lotPoints: (points, level, lot, runNumber) => root.NceActionQcIndex!.actionLotPoints(points, level, lot, runNumber),
  pointIndex: points => root.NceActionQcIndex!.actionPointIndex(points),
  needsRerun: action => (root as any).actionNeedsRerun(action), gateDate: (action, point) => (root as any).actionRerunGateDate(action, point),
  evaluate: input => root.NceActionRerunEvaluator!.evaluateActionRerun(input),
  verdictFor: (test, pointId) => ((root as any).activeWestgard(test).byPoint.get(pointId) || { level: 'ok' }),
  formatValue: (point, test) => (root as any).fmtPointValue(point, test), formatDate: value => vnDate(value),
});
root.ActionPointIndexService = createActionPointIndexService(() => (state as any).actions || []);
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
root.reagentReportPresentation = reagentReportPresentation;
root.reagentChartPresentation = reagentChartPresentation;
root.reagentReportItemPresentation = reagentReportItemPresentation;
root.reagentComparisonLabelPresentation = reagentComparisonLabelPresentation;
root.reagentQuickLabelPresentation = reagentQuickLabelPresentation;
root.reagentToolIconPresentation = reagentToolIconPresentation;
root.reagentPairMath = reagentPairMath;
root.reagentStatistics = reagentStatistics;
root.reagentTDistribution = reagentTDistribution;
root.reagentComparisonCalculator = createReagentComparisonCalculator({
  validPairs: reagentPairMath.validPairs, mean: reagentStatistics.mean, variance: reagentStatistics.variance,
  max: reagentStatistics.max, min: reagentStatistics.min, pearson: reagentStatistics.pearson,
  ols: reagentStatistics.ols, passingBablok: reagentStatistics.passingBablok,
  twoSidedPValue: reagentTDistribution.twoSidedPValue, tCritical: reagentTDistribution.tCritical,
});
root.SigmaCohortService = createSigmaCohortService({ stats: root.QCCore.stats });
root.WestgardViewModel = westgardViewModel;
root.westgardRowsWindow = westgardRowsWindow;
root.westgardArchivedGroups = westgardArchivedGroups;
root.westgardArchivedMultiViews = westgardArchivedMultiViews;
root.westgardArchivedGroupMatches = westgardArchivedGroupMatches;
root.westgardArchivedTestSelection = westgardArchivedTestSelection;
