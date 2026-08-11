// Ambient declarations for `tsc --checkJs` (see tsconfig.json / `npm run typecheck`).
//
// Phần classic còn lại vẫn chạy trong shared global scope; các module đã chuyển
// được Vite bundle thành một IIFE compatibility artifact. Một số API được tạo
// động nên TypeScript không nhìn thấy declaration cú pháp:
//   - `src/presentation/state/ui-state.ts` cài accessor qua
//     `Object.defineProperty(globalThis, key, {...})`.
//   - Some service modules (`action-workflow-service.js`, `entry-service.js`)
//     do `root.Foo = {...}` and/or `Object.assign(root, {...})`.
//   - `core.js` (UMD) exposes itself as `window.QCCore`.
// TypeScript can't see any of these as declarations, so it reports every
// (correctly spelled) reference as "Cannot find name" — this file lists them
// so real typos still get caught instead of being drowned in that noise.
// Keep this in sync when a UI state bag or a service's exported
// name set changes.

// --- UI state accessors (cài từ modular compatibility artifact) ---
declare var selTest: any, statusMemo: any, wgTestQ: any, dashTestQ: any, dashTestStatus: any,
  wgPrevOpen: any, wgExpandedRows: any, wgViewMode: any, wgArchivedGroupId: any,
  wgArchivedTestId: any, wgArchivedTestQ: any, wgChartMode: any;
declare var currentUser: any, loginFails: any, loginLockUntil: any;
declare var entrySel: any, entryDays: any, entryStart: any, entryEnd: any, entrySheetMonth: any,
  entryQ: any, entryMachine: any, entryLastMsg: any, entryAutoOpenKey: any,
  entryPendingSheetFocus: any, entryJumpToday: any, entryLjRenderCache: any,
  entryPartialRenderCache: any, entryPrevOpen: any, entryExpandedTables: any, entryDetailOpen: any, treeOpen: any,
  entryExtraRun: any, entryTreeCollapsed: any;
declare var manageQ: any, manageTab: any, manageTargetPanel: any, manageTargetGroup: any,
  manageTargetLevel: any, manageHistoryTest: any, targetSwitchCtx: any, configNavScroll: any;
declare var rcId: any, rcSaveT: any, rcModalQ: any, rcCreateModalQ: any, rcQuickType: any, rcMetaBefore: any;
declare var sgTest: any, sgRefreshT: any, sgBiasCtx: any, sgMuCtx: any, sgAddTestQ: any, sgSelectedPeriods: any;

// --- UI state namespace bags (`root.XxxUIState = state`) ---
declare var AnalysisUIState: any, AuthUIState: any, EntryUIState: any, ManageUIState: any,
  ReagentUIState: any, SigmaUIState: any;

// --- Service / view-model namespaces (`root.Foo = {...}`) ---
declare var EntryService: any, PeriodService: any, ReagentComparisonService: any, ChartViewModel: any,
  SigmaCohortService: any, SigmaPresentation: any, SigmaPeriodViewModel: any, SigmaBiasService: any, SigmaCohortImportService: any, SigmaPeriodRecordService: any, SigmaLevelEditService: any, SigmaTrackedTestService: any, SigmaBiasWorkflowService: any, SigmaMuWorkflowService: any, SigmaCohortSelectionService: any, SigmaTeaEditService: any, SigmaTeaSnapshotService: any, SigmaLevelSelectionService: any, SigmaPeriodSelectionService: any, WestgardViewModel: any, ActionWorkflowService: any, ActionReviewService: any, ActionEscalationService: any, ActionRecordService: any, ActionBiasService: any, ActionBiasPresentation: any, ActionViolationService: any, ActionListPresentation: any, ActionEvidencePresentation: any, ActionRerunEvidencePresentation: any, ActionStatusPresentation: any, ActionReviewPresentation: any, ActionDetailPresentation: any, ActionGuidePresentation: any, ReportPeriodPresentation: any, ManageConfigService: any, LotTransitionPickerService: any,
  qcPointWarnings: any, AuditService: any, ActionRerunService: any, ActionPointIndexService: any;
declare var LISClientService: any, lisGatewayRuntime: any, LIS_GATEWAY_STORAGE_KEY: any, LIS_POLL_MS: any,
  lisGatewayConfig: any, lisNormalizeGatewayUrl: any, lisGatewaySetStatus: any, lisGatewayStatusText: any,
  lisGatewayFetch: any, lisGatewayHealth: any, lisGatewayPull: any, lisResultToPointInput: any,
  lisImportResult: any, lisRejectResult: any, lisGatewayStart: any;
declare var BackupService: any, BACKUP_IMPORT_MAX_BYTES: any, BACKUP_IMPORT_WARN_BYTES: any,
  serializeBackupData: any, backupTextBytes: any, backupSizeMB: any, backupImportSizeError: any,
  backupSizeWarning: any, backupChecksum: any, createBackupPackage: any, parseBackupPackage: any,
  prepareBackupState: any, prepareBackupImport: any, backupSummary: any, inspectBackupText: any;

// action-workflow-service.js does Object.assign(root, root.ActionWorkflowService)
declare var actionApprovalStatus: any, actionRecordStatus: any, actionCancelled: any, actionApprovalLabel: any, actionRecorded: any, actionCanApprove: any,
  actionPoint: any, actionEventDate: any, actionNeedsRerun: any, actionRerunStatus: any, actionWorkflowStatus: any,
  actionDraftStatus: any, actionProtocolStatus: any, actionProtocolSummary: any, actionRiskScore: any, actionResidualRiskScore: any, actionActiveFollowUp: any, actionEffectivenessStatus: any,
  ACTION_LABELS: any, RISK_SCALE: any, invalidateActionCaches: any, nextNceId: any, nceDueDate: any, actionOverdue: any,
  actionRerunGateDate: any, pointActions: any, pointRealActions: any, pointWorkflowComplete: any, pointWorkflowSummary: any;

// core.js (UMD) exposes itself as window.QCCore; referenced bare everywhere else
declare var QCCore: any;
declare var qcPointRunNumber: any;
declare var qcCusumConfig: any;
declare var normalizeSearchText: any;
declare var qcLevelTargetValid: any;
declare var qcLotMeanSd: any, qcLotTargetSnapshot: any;
declare var reportLevelStatsService: any;
declare var qcErrorDetail: any;
declare var qcPlannedTarget: any;
declare var qcPointVoidVerdict: any;
declare var qcLotGroupOperational: any;
declare var qcDerivedIndex: any;
declare var qcAcceptedLotPoints: any;
declare var qcCusumSeries: any;
declare var qcEntryColumns: any;
declare var syncStateMerge: any;
declare var syncUpdateBuilder: any;
declare var syncSnapshot: any;
declare var syncRetryScheduler: any;
declare var syncFirstConnectMerge: any, syncHasContent: any;
declare var qcNormalizeDuplicateRunIds: any;
declare var qcNormalizePointLots: any;
declare var qcLotLineage: any;
declare var qcLevelConfig: any, qcOperationalAccess: any;
declare var qcParallelLotLookup: any;
declare var westgardWorkerJobBuilder: any;
declare var westgardWorkerRevisionService: any;
declare var westgardWorkerHydrate: any;
declare var westgardWorkerPrewarmPlanner: any;
declare var planPartitionWrite: any;

// Firebase compat SDK, loaded from CDN <script> tags in index.html (no @types installed)
declare var firebase: any;

// Electron preload bridge / license check, only present under electron/preload.js
declare var qcDialog: any;

interface Window {
  QCLAB_APP: any;
  QCLAB_CLOUD: any;
  qcLicense: any;
  qcDialog: any;
  // Catch-all: any other ad-hoc window.* property this dense, no-framework
  // codebase reaches for that isn't worth naming individually above.
  [key: string]: any;
}

// The DOM lib types `document.getElementById` as `HTMLElement | null`, which
// makes every `.value`/`.checked`/`.disabled` read on a known <input>/<select>
// a type error unless each call site is cast. This codebase never does that
// (see CLAUDE.md "dense/minified-looking by convention") — loosen the return
// type app-wide instead of retrofitting hundreds of casts.
interface Document {
  getElementById(elementId: string): any;
}

// Same reasoning as Document.getElementById above: querySelector/closest/
// event.target etc. return the strict DOM Element/EventTarget types, but
// every call site here reads arbitrary `.value`/`.dataset`/`.style`/`.checked`
// straight off the result without narrowing or casting.
interface Element {
  [key: string]: any;
}
interface EventTarget {
  [key: string]: any;
}
