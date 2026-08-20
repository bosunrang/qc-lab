import { chartViewModel, type ChartViewModelApi } from '../domain/charts/chart-view-model';
import { createEntryService, type EntryServiceApi } from '../application/entry/entry-service';
import { createEntryRecordCommand } from '../application/entry/entry-record-command';
import { createEntryRecordWorkflowCommand, type EntryRecordWorkflowCommand } from '../application/entry/entry-record-workflow-command';
import { createEntryVoidCommand } from '../application/entry/entry-void-command';
import { createEntryVoidWorkflowCommand, type EntryVoidWorkflowCommand } from '../application/entry/entry-void-workflow-command';
import { createEntryDateNoteWorkflowCommand, type EntryDateNoteWorkflowCommand } from '../application/entry/entry-date-note-workflow-command';
import { createRangeTargetCommand } from '../application/range/range-target-command';
import { createRangeWorkflowCommand, type RangeWorkflowCommand } from '../application/range/range-workflow-command';
import { createReagentComparisonWorkflowCommand, type ReagentComparisonWorkflowCommand } from '../application/reagent/reagent-comparison-workflow-command';
import { createReagentPageController } from '../presentation/reagent/reagent-page-controller';
import {
  BACKUP_IMPORT_MAX_BYTES,
  BACKUP_IMPORT_WARN_BYTES,
  createBackupService,
  type BackupServiceApi,
} from '../application/backup/backup-service';
import { createBackupRestoreCommand, type BackupRestoreCommand } from '../application/backup/backup-restore-command';
import { createBackupExportCommand, type BackupExportCommand } from '../application/backup/backup-export-command';
import { createBackupImportCommand, type BackupImportCommand } from '../application/backup/backup-import-command';
import { createBackupInspectionCommand, type BackupInspectionCommand } from '../application/backup/backup-inspection-command';
import { createBackupStatusCommand, type BackupStatusCommand } from '../application/backup/backup-status-command';
import { createBackupLocalMarker } from '../application/backup/backup-local-marker';
import { createBackupInspectionSummary } from '../presentation/backup/backup-inspection-summary';
import { createBackupInspectionMessage } from '../presentation/backup/backup-inspection-message';
import { createBackupFileName } from '../presentation/backup/backup-file-name';
import { createBackupSnapshotFileName } from '../presentation/backup/backup-snapshot-file-name';
import { createBackupSizeConfirmation } from '../presentation/backup/backup-size-confirmation';
import { createBackupSizeWarningConfirmation } from '../presentation/backup/backup-size-warning-confirmation';
import { createBackupExportMessage } from '../presentation/backup/backup-export-message';
import { createResetOperationalDataCommand, type ResetOperationalDataCommand } from '../application/auth/reset-operational-data-command';
import { createUserManagementCommand } from '../application/auth/user-management-command';
import { createLoginCommand } from '../application/auth/login-command';
import { createRequiredPasswordCommand } from '../application/auth/required-password-command';
import { createLoginWorkflowCommand, type LoginWorkflowCommand } from '../application/auth/login-workflow-command';
import { createRequiredPasswordWorkflowCommand, type RequiredPasswordWorkflowCommand } from '../application/auth/required-password-workflow-command';
import { createAdminBootstrapCommand, type AdminBootstrapCommand } from '../application/auth/admin-bootstrap-command';
import { createUserLifecycleCommand, type UserLifecycleCommand } from '../application/auth/user-lifecycle-command';
import { createBackupImportConfirmation } from '../presentation/backup/backup-import-confirmation';
import { createBackupImportMessage } from '../presentation/backup/backup-import-message';
import { createBackupOversizeConfirmation } from '../presentation/backup/backup-oversize-confirmation';
import {
  createManageConfigService,
  type ManageConfigServiceApi,
} from '../application/manage/manage-config-service';
import { createManageAssayCommand } from '../application/manage/manage-assay-command';
import { createManageAssayRemovalCommand } from '../application/manage/manage-assay-removal-command';
import { createManageInstrumentCommand } from '../application/manage/manage-instrument-command';
import { createManageInstrumentWorkflowCommand, type ManageInstrumentWorkflowCommand } from '../application/manage/manage-instrument-workflow-command';
import { createManagePanelCommand } from '../application/manage/manage-panel-command';
import { createManagePanelWorkflowCommand, type ManagePanelWorkflowCommand } from '../application/manage/manage-panel-workflow-command';
import { createManageLotGroupCommand } from '../application/manage/manage-lot-group-command';
import { createManageLotGroupActivationCommand } from '../application/manage/manage-lot-group-activation-command';
import { createManageLotTransitionCommand, type ManageLotTransitionCommand } from '../application/manage/manage-lot-transition-command';
import { createManageLotCommand } from '../application/manage/manage-lot-command';
import { createManageLotWorkflowCommand, type ManageLotWorkflowCommand } from '../application/manage/manage-lot-workflow-command';
import { createManageAssayWorkflowCommand, type ManageAssayWorkflowCommand } from '../application/manage/manage-assay-workflow-command';
import { createManageLotTransitionWorkflowCommand, type ManageLotTransitionWorkflowCommand } from '../application/manage/manage-lot-transition-workflow-command';
import { createManageLotGroupWorkflowCommand, type ManageLotGroupWorkflowCommand } from '../application/manage/manage-lot-group-workflow-command';
import { createManageTargetMatrixWorkflowCommand, type ManageTargetMatrixWorkflowCommand } from '../application/manage/manage-target-matrix-workflow-command';
import { createTargetMatrixCommand } from '../application/manage/target-matrix-command';
import { createTeaReferenceService, type TeaReferenceServiceApi } from '../application/manage/tea-reference-service';
import { createTeaReferenceWorkflowCommand, type TeaReferenceWorkflowCommand } from '../application/manage/tea-reference-workflow-command';
import { createPeriodService, type PeriodServiceApi } from '../application/period/period-service';
import { createReportPeriodCommand, type ReportPeriodCommand } from '../application/period/report-period-command';
import { createReportPeriodWorkflowCommand, type ReportPeriodWorkflowCommand } from '../application/period/report-period-workflow-command';
import { createAuditService, type AuditServiceApi } from '../application/audit/audit-service';
import { createActivityArchiveCommand, type ActivityArchiveCommand } from '../application/audit/activity-archive-command';
import {
  createLisClient,
  createLisGatewayRuntime,
  LIS_GATEWAY_STORAGE_KEY,
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
import { syncedShape, syncedStatesEqual, syncJsonMap } from '../domain/sync/snapshot-compare';
import { mergeSyncArray, mergeSyncBranch } from '../domain/sync/array-merge';
import { createSyncStateMerge, uniqueSyncUsers } from '../domain/sync/state-merge';
import { createSyncUpdateBuilder } from '../domain/sync/update-payload';
import { createSyncSnapshot } from '../domain/sync/snapshot-keys';
import { createSyncRetryScheduler } from '../domain/sync/retry-scheduler';
import { createFirstConnectMerge, hasSyncContent } from '../domain/sync/first-connect';
import { FIREBASE_SYNC_TOP, FIREBASE_SYNC_LISTS, FIREBASE_SYNC_CONTENT_KEYS, FIREBASE_SYNC_COMPARE_KEYS } from '../domain/sync/sync-config';
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
import { createLocalStoreService, type LocalStoreApi } from '../application/storage/local-store-service';
import { createStorageSnapshotService, type StorageSnapshotService } from '../application/storage/storage-snapshot-service';
import { createStorageLifecycleService, type StorageLifecycleApi } from '../application/storage/storage-lifecycle-service';
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
import { parseFirebaseConfig as parseFirebaseConfigTs } from '../application/sync/firebase-config-parser';
import { storageUsageText as storageUsageTextTs } from '../presentation/settings/storage-usage';
import { createBrandProfile } from '../presentation/settings/brand-profile';
import { firebaseAclHelp as firebaseAclHelpTs } from '../presentation/settings/firebase-acl-help';
import { firebaseRulesText as firebaseRulesTextTs } from '../presentation/settings/firebase-rules';
import { firebaseGuideHtml as firebaseGuideHtmlTs } from '../presentation/settings/firebase-guide-html';
import { createBackupReminder } from '../presentation/backup/backup-reminder';
import { createLisQueuePresentation } from '../presentation/lis/lis-queue-presentation';
import { createLisSettingsService } from '../application/lis/lis-settings-service';
import { createLisGatewayCommand, type LisGatewayCommand } from '../application/lis/lis-gateway-command';
import { createLisQueueController } from '../presentation/lis/lis-queue-controller';
import { createLabProfileService } from '../application/settings/lab-profile-service';
import { createSettingsProfileCommand, type SettingsProfileCommand } from '../application/settings/settings-profile-command';
import { createSettingsFirebaseCommand, type SettingsFirebaseCommand } from '../application/settings/settings-firebase-command';
import { createSettingsPageController } from '../presentation/settings/settings-page-controller';
import { createFirebaseSettingsService } from '../application/sync/firebase-settings-service';
import { createBrandPreviewHtml } from '../presentation/settings/brand-preview-html';
import { createUnitProfileHtml } from '../presentation/settings/unit-profile-html';
import { createBrandPanelHtml } from '../presentation/settings/brand-panel-html';
import { createAdminToolsHtml } from '../presentation/settings/admin-tools-html';
import { createFirebaseRulesPanelHtml } from '../presentation/settings/firebase-rules-panel-html';
import { createLisGatewayPanelHtml } from '../presentation/settings/lis-gateway-panel-html';
import { createFirebaseConnectionPanelHtml } from '../presentation/settings/firebase-connection-panel-html';
import { createSettingsPageLayoutHtml } from '../presentation/settings/settings-page-layout-html';
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
import { createActivityAuditPageHtml } from '../presentation/audit/activity-audit-page-html';
import { activityAuditPagination } from '../presentation/audit/activity-audit-pagination';
import { createActivityAuditCsv } from '../presentation/audit/activity-audit-csv';
import { updateActivityAuditDateRange } from '../presentation/audit/activity-audit-date-range';
import { ACTIVITY_AUDIT_PAGE_SIZES, activityAuditFilterState } from '../presentation/audit/activity-audit-filter-state';
import { activityAuditArchiveWindow } from '../presentation/audit/activity-audit-archive-window';
import { activityAuditArchiveModalHtml } from '../presentation/audit/activity-audit-archive-modal-html';
import { activityAuditRowHtml } from '../presentation/audit/activity-audit-row-html';
import { userListModel } from '../presentation/auth/user-list-model';
import { createUserRowHtml } from '../presentation/auth/user-row-html';
import { createUsersPageHtml } from '../presentation/auth/users-page-html';
import { createReagentSelectOptionsHtml } from '../presentation/reagent/reagent-select-options-html';
import { createReagentResultHtml } from '../presentation/reagent/reagent-result-html';
import { createReagentPairRowHtml } from '../presentation/reagent/reagent-pair-row-html';
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
import { createCanvasFont as createChartCanvasFont } from '../presentation/chart/canvas-font';
import { createChartDataUrl } from '../presentation/chart/chart-data-url';
import { createVisibleCanvasService } from '../presentation/render/visible-canvas-service';
import { createAfterRenderController } from '../presentation/render/after-render-controller';
import { createRouterPagePolicy } from '../presentation/router/router-page-policy';
import { createRouterShellController } from '../presentation/router/router-shell-controller';
import { createModalTemplate } from '../presentation/modal/modal-template';
import { createModalController } from '../presentation/modal/modal-controller';
import { createDialogOverlayController } from '../presentation/modal/dialog-overlay-controller';
import { createVnDatePickerController } from '../presentation/router/vn-date-picker-controller';
import { createChartTooltipService } from '../presentation/chart/chart-tooltip-service';
import { createLeveyJenningsTooltipController } from '../presentation/chart/levey-jennings-tooltip-controller';
import { createHiDpiCanvasSetup } from '../presentation/chart/hi-dpi-canvas';
import { leveyJenningsGeometry } from '../presentation/chart/levey-jennings-geometry';
import { createWestgardRuleScope } from '../presentation/chart/westgard-rule-scope';
import { LEVEY_JENNINGS_COLORS } from '../presentation/chart/levey-jennings-colors';
import { createLeveyJenningsTicks } from '../presentation/chart/levey-jennings-ticks';
import { createLeveyJenningsYAxisLabels } from '../presentation/chart/levey-jennings-y-axis';
import { createLeveyJenningsHoverModel } from '../presentation/chart/levey-jennings-hover-model';
import { leveyJenningsPointStyle } from '../presentation/chart/levey-jennings-point-style';
import { createLeveyJenningsDisplayPlan } from '../presentation/chart/levey-jennings-display-plan';
import { createLeveyJenningsPointRenderModel } from '../presentation/chart/levey-jennings-point-render-model';
import { leveyJenningsBandRects } from '../presentation/chart/levey-jennings-bands';
import { leveyJenningsGridLines } from '../presentation/chart/levey-jennings-grid';
import { leveyJenningsMultiSeries } from '../presentation/chart/levey-jennings-multi-series';
import { createLeveyJenningsMultiRunTicks } from '../presentation/chart/levey-jennings-multi-run-ticks';
import { createLeveyJenningsLegendLayout } from '../presentation/chart/levey-jennings-legend-layout';
import { createLeveyJenningsMultiDisplayPlan } from '../presentation/chart/levey-jennings-multi-display-plan';
import { createLeveyJenningsMultiHoverModel } from '../presentation/chart/levey-jennings-multi-hover-model';
import { createLeveyJenningsMultiPointRenderModel } from '../presentation/chart/levey-jennings-multi-point-render-model';
import { leveyJenningsMultiDividers } from '../presentation/chart/levey-jennings-multi-dividers';
import { cusumChartGeometry } from '../presentation/chart/cusum-chart-geometry';
import { cusumPointRenderModel } from '../presentation/chart/cusum-point-render-model';
import { cusumReferenceLines } from '../presentation/chart/cusum-reference-lines';
import { cusumLinePoints } from '../presentation/chart/cusum-line-points';
import { createCusumDisplayPlan } from '../presentation/chart/cusum-display-plan';
import { createCusumHoverModel } from '../presentation/chart/cusum-hover-model';
import { createQcChartRenderer } from '../presentation/chart/qc-chart-renderer';
import { createBlobDownload } from '../presentation/export/blob-download';
import { createQcReportCsvRows } from '../presentation/report/qc-report-csv-rows';
import { createReportPrintController } from '../presentation/report/report-print-controller';
import { createDataIoController } from '../presentation/export/data-io-controller';
import { escapeHtml, escapeHtmlAttr } from '../presentation/shared/html-escape';
import { createBasicFormat } from '../presentation/format/basic-format';
import { createWestgardRulePolicy } from '../domain/westgard/rule-policy';
import { createWestgardMemoCache } from '../domain/westgard/memo-cache';
import { createCusumMemoCache } from '../domain/qc/cusum-memo-cache';
import { createAcceptedMemoCache } from '../domain/qc/accepted-memo-cache';
import { createWestgardRuleSettings } from '../domain/westgard/rule-settings';
import { createRangeCandidateService } from '../domain/qc/range-candidate';
import { rangeBiasEvaluation, rangeSafetyGate } from '../domain/qc/range-safety-gate';
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
import { createReportXlsxHeader } from '../presentation/report/report-xlsx-header';
import { reportHeaderPresentation } from '../presentation/report/report-header';
import { createReportNceAppendix, type ReportNceAppendixApi } from '../presentation/report/report-nce-appendix';
import { createReportNceDetailHtml } from '../presentation/report/report-nce-detail-html';
import { reportSignBlock } from '../presentation/report/report-sign-block';
import { createReportLockListHtml } from '../presentation/report/report-lock-list-html';
import { createReportUnlockReason } from '../presentation/report/report-unlock-reason';
import { reportUnlockModalHtml } from '../presentation/report/report-unlock-modal-html';
import { createReportPageController } from '../presentation/report/report-page-controller';
import { reportLockPicker } from '../presentation/report/report-lock-picker';
import { createReportLockPanelHtml } from '../presentation/report/report-lock-panel-html';
import { createReportPageHtml } from '../presentation/report/report-page-html';
import { createReportRangePickerHtml } from '../presentation/report/report-range-picker-html';
import { createDashboardLoading } from '../presentation/dashboard/dashboard-loading';
import { createDashboardStatusFilter } from '../presentation/dashboard/dashboard-status-filter';
import { dashboardExpiringLots } from '../domain/qc/dashboard-expiring-lots';
import { dashboardShiftStatus } from '../presentation/dashboard/dashboard-shift-status';
import { dashboardKpis } from '../domain/qc/dashboard-kpis';
import { createDashboardStatusTabsHtml } from '../presentation/dashboard/dashboard-status-tabs-html';
import { createDashboardExpiringLotsHtml } from '../presentation/dashboard/dashboard-expiring-lots-html';
import { createDashboardQcFollowupItemHtml } from '../presentation/dashboard/dashboard-qc-followup-item-html';
import { createDashboardMissingTargetItemHtml } from '../presentation/dashboard/dashboard-missing-target-item-html';
import { createDashboardOverdueActionItemHtml } from '../presentation/dashboard/dashboard-overdue-action-item-html';
import { dashboardTestStatusTags } from '../presentation/dashboard/dashboard-test-status-tags';
import { createDashboardLevelPillHtml } from '../presentation/dashboard/dashboard-level-pill-html';
import { dashboardTestRank } from '../presentation/dashboard/dashboard-test-rank';
import { createDashboardLatestPointText } from '../presentation/dashboard/dashboard-latest-point-text';
import { dashboardFollowupPanelHtml } from '../presentation/dashboard/dashboard-followup-panel-html';
import { createDashboardTestSearchText } from '../presentation/dashboard/dashboard-test-search-text';
import { createDashboardLatestPoint } from '../presentation/dashboard/dashboard-latest-point';
import { dashboardKpisHtml } from '../presentation/dashboard/dashboard-kpis-html';
import { dashboardProgressHtml } from '../presentation/dashboard/dashboard-progress-html';
import { createDashboardHeadHtml } from '../presentation/dashboard/dashboard-head-html';
import { createDashboardTestPanelHtml } from '../presentation/dashboard/dashboard-test-panel-html';
import { createDashboardTestRowHtml } from '../presentation/dashboard/dashboard-test-row-html';
import { dashboardKpiItems } from '../presentation/dashboard/dashboard-kpi-items';
import { createDashboardEmptyTestsHtml } from '../presentation/dashboard/dashboard-empty-tests-html';
import { CUSUM_COLORS } from '../presentation/chart/cusum-colors';
import { LEVEY_JENNINGS_MULTI_COLORS } from '../presentation/chart/levey-jennings-multi-colors';
import { createCusumChartTitle } from '../presentation/chart/cusum-chart-title';
import { LEVEY_JENNINGS_CHART_TITLE } from '../presentation/chart/levey-jennings-chart-title';
import { CHART_EMPTY_LABELS } from '../presentation/chart/chart-empty-labels';
import { leveyJenningsMultiYAxis } from '../presentation/chart/levey-jennings-multi-y-axis';
import { leveyJenningsMultiGeometry } from '../presentation/chart/levey-jennings-multi-geometry';
import { createConfigNavScrollService } from '../presentation/render/config-nav-scroll-service';
import { createEntryJumpScrollService } from '../presentation/render/entry-jump-scroll-service';
import { createDefaultDateFieldsService } from '../presentation/render/default-date-fields-service';
import { createPostRenderPageActions } from '../presentation/render/post-render-page-actions';
import { createDashboardOverdueActions } from '../presentation/dashboard/dashboard-overdue-actions';
import { createDashboardOverdueActionListHtml } from '../presentation/dashboard/dashboard-overdue-action-list-html';
import { createDashboardQcFollowupListHtml } from '../presentation/dashboard/dashboard-qc-followup-list-html';
import { createDashboardMissingTargetListHtml } from '../presentation/dashboard/dashboard-missing-target-list-html';
import { dashboardExpiringLotItems } from '../presentation/dashboard/dashboard-expiring-lot-items';
import { dashboardWestgardAlerts } from '../presentation/dashboard/dashboard-westgard-alerts';
import { dashboardMissingTargetItems } from '../presentation/dashboard/dashboard-missing-target-items';
import { createDashboardLevelData } from '../presentation/dashboard/dashboard-level-data';
import { createDashboardTestAction } from '../presentation/dashboard/dashboard-test-action';
import { createDashboardLevelPillsHtml } from '../presentation/dashboard/dashboard-level-pills-html';
import { createDashboardTestRowsHtml } from '../presentation/dashboard/dashboard-test-rows-html';
import { createDashboardTestItems } from '../presentation/dashboard/dashboard-test-items';
import { dashboardTestListHtml } from '../presentation/dashboard/dashboard-test-list-html';
import { createDashboardPageHtml } from '../presentation/dashboard/dashboard-page-html';
import { createDashboardPageController } from '../presentation/dashboard/dashboard-page-controller';
import { icon, icoCal, icoDownload, icoPrint, icoRefArrow } from '../presentation/router/router-icons';
import { createRouterPermission } from '../presentation/router/router-permission';
import { createLiveRowFilter } from '../presentation/router/live-row-filter';
import { createDateBoxHtml } from '../presentation/router/date-box-html';
import { createRangeActionsHtml } from '../presentation/range/range-actions-html';
import { createUiPrimitives } from '../presentation/shared/ui-primitives';
import { createRouterDispatchController } from '../presentation/router/router-dispatch-controller';
import { createReportQcFormat } from '../presentation/report/report-qc-format';
import { createRangeTea } from '../domain/qc/range-tea';
import { entryRowsWindow as entryRowsWindowTs, entryLotLabels as entryLotLabelsTs } from '../presentation/entry/entry-rows-window';
import { entryDayPresetButtons, createEntryLeveyJenningsMiniHtml, createEntrySheetLevelHeads } from '../presentation/entry/entry-chart-html';
import { createEntryTreeHeaderHtml, createEntryTreeItemHtml } from '../presentation/entry/entry-tree-html';
import { entryRangeSummaryHtml } from '../presentation/entry/entry-range-summary-html';
import { entryWorksheetHtml } from '../presentation/entry/entry-worksheet-html';
import { entryLeveyPanelHtml } from '../presentation/entry/entry-levey-panel-html';
import { entryPageLayoutHtml } from '../presentation/entry/entry-page-layout-html';
import { entryVoidedPointsHtml } from '../presentation/entry/entry-voided-points-html';
import { entryPointsPanelHtml } from '../presentation/entry/entry-points-panel-html';
import { entryCumulativeStatsHtml } from '../presentation/entry/entry-cumulative-stats-html';
import { entryTableWindowNoteHtml } from '../presentation/entry/entry-table-window-note-html';
import { entryPointTableCardHtml } from '../presentation/entry/entry-point-table-card-html';
import { entryPointTableRowHtml } from '../presentation/entry/entry-point-table-row-html';
import { entryVoidedPointRowHtml } from '../presentation/entry/entry-voided-point-row-html';
import { entrySheetDayRowHtml } from '../presentation/entry/entry-sheet-day-row-html';
import { createEntrySheetDaySummaryHtml } from '../presentation/entry/entry-sheet-day-summary-html';
import { entryVoidModalHtml } from '../presentation/entry/entry-void-modal-html';
import { entryPreSaveWarningModalHtml } from '../presentation/entry/entry-pre-save-warning-modal-html';
import { entrySheetEmptyRunHtml, entrySheetSavedRunHtml } from '../presentation/entry/entry-sheet-run-slot-html';
import { entrySheetCellHtml } from '../presentation/entry/entry-sheet-cell-html';
import { entrySheetAddRunHtml, entrySheetNoteHtml } from '../presentation/entry/entry-sheet-day-detail-html';
import { createEntryEmptyPageHtml } from '../presentation/entry/entry-empty-page-html';
import { targetSwitchModalHtml } from '../presentation/manage/target-switch-modal-html';
import { configPanelTestRows } from '../presentation/manage/config-panel-test-rows';
import { configPanelModalHtml } from '../presentation/manage/config-panel-modal-html';
import { lotTransitionChoiceHtml as lotTransitionChoiceHtmlPresentation } from '../presentation/manage/lot-transition-choice-html';
import { lotTransitionModalHtml } from '../presentation/manage/lot-transition-modal-html';
import { lotTransitionTargetsHtml as lotTransitionTargetsHtmlPresentation } from '../presentation/manage/lot-transition-targets-html';
import { lotGroupColumnsHtml } from '../presentation/manage/lot-group-columns-html';
import { lotGroupModalHtml } from '../presentation/manage/lot-group-modal-html';
import { configLotModalHtml } from '../presentation/manage/config-lot-modal-html';
import { configInstrumentModalHtml } from '../presentation/manage/config-instrument-modal-html';
import { configAssayModalHtml } from '../presentation/manage/config-assay-modal-html';
import { qcHistoryDetailModalHtml } from '../presentation/manage/qc-history-detail-modal-html';
import { configAssayRuleRowsHtml } from '../presentation/manage/config-assay-rule-rows-html';
import { configAssayTeaOptionsHtml } from '../presentation/manage/config-assay-tea-options-html';
import { configAssayInstrumentOptionsHtml } from '../presentation/manage/config-assay-instrument-options-html';
import { configAssayDecimalOptionsHtml } from '../presentation/manage/config-assay-decimal-options-html';
import { configPanelInstrumentOptionsHtml } from '../presentation/manage/config-panel-instrument-options-html';
import { configLotLevelOptionsHtml } from '../presentation/manage/config-lot-level-options-html';
import { qcHistoryMeanSdRowsHtml, qcHistoryPointRowsHtml } from '../presentation/manage/qc-history-detail-rows-html';
import { createTargetNumberText } from '../presentation/manage/target-number-text';
import { parseVnDate } from '../presentation/shared/parse-vn-date';
import { createTargetRangeSync } from '../presentation/manage/target-range-sync';
import { targetOverwritePicks } from '../presentation/manage/target-overwrite-picks';
import { lotGroupLotPillsHtml } from '../presentation/manage/lot-group-lot-pills-html';
import { lotGroupStatus as lotGroupStatusPresentation } from '../presentation/manage/lot-group-status';
import { lotGroupToggleAction } from '../presentation/manage/lot-group-toggle-action';
import { targetSwitchAssayNames } from '../presentation/manage/target-switch-assay-names';
import { targetLockedBackfillNote } from '../presentation/manage/target-locked-backfill-note';
import { rangeWorkflowModalHtml } from '../presentation/range/range-workflow-modal-html';
import { rangeApplyConfirmationModalHtml } from '../presentation/range/range-apply-confirmation-modal-html';
import { rangeRevertConfirmationModalHtml } from '../presentation/range/range-revert-confirmation-modal-html';
import { rangeSafetyGateHtml } from '../presentation/range/range-safety-gate-html';
import { rangeWorkflowChecklistRowsHtml } from '../presentation/range/range-workflow-checklist-rows-html';
import { rangeNceNoticeHtml } from '../presentation/range/range-nce-notice-html';
import { rangeWorkflowComparisonRowsHtml } from '../presentation/range/range-workflow-comparison-rows-html';
import { userPermissionsModalHtml } from '../presentation/auth/user-permissions-modal-html';
import { resetPasswordModalHtml } from '../presentation/auth/reset-password-modal-html';
import { sigmaAddTestModalHtml } from '../presentation/sigma/sigma-add-test-modal-html';
import { sigmaAddTestRowsHtml } from '../presentation/sigma/sigma-add-test-rows-html';
import { sigmaBiasModalHtml } from '../presentation/sigma/sigma-bias-modal-html';
import { sigmaMuModalHtml } from '../presentation/sigma/sigma-mu-modal-html';
import { sigmaCohortModalHtml } from '../presentation/sigma/sigma-cohort-modal-html';
import { sigmaFrequencyPanelHtml } from '../presentation/sigma/sigma-frequency-panel-html';
import { sigmaMuSummaryHtml } from '../presentation/sigma/sigma-mu-summary-html';
import { sigmaStatusCardHtml } from '../presentation/sigma/sigma-status-card-html';
import { sigmaStatusPanelHtml } from '../presentation/sigma/sigma-status-panel-html';
import { sigmaOpSpecCellHtml } from '../presentation/sigma/sigma-opspec-cell-html';
import { sigmaMuStateChipHtml } from '../presentation/sigma/sigma-mu-state-chip-html';
import { sigmaMuDominantText } from '../presentation/sigma/sigma-mu-dominant-text';
import { sigmaBiasSummaryHtml } from '../presentation/sigma/sigma-bias-summary-html';
import { sigmaCohortRowsHtml } from '../presentation/sigma/sigma-cohort-rows-html';
import { sigmaBiasRowsHtml } from '../presentation/sigma/sigma-bias-rows-html';
import { sigmaMuRowsHtml } from '../presentation/sigma/sigma-mu-rows-html';
import { sigmaMuPreviewHtml } from '../presentation/sigma/sigma-mu-preview-html';
import { sigmaTrackedOptionsHtml } from '../presentation/sigma/sigma-tracked-options-html';
import { sigmaInputDisplayValue } from '../presentation/sigma/sigma-input-display-value';
import { sigmaGoverningRuleBlockHtml } from '../presentation/sigma/sigma-governing-rule-block-html';
import { sigmaFrequencyRowsHtml } from '../presentation/sigma/sigma-frequency-rows-html';
import { sigmaPeriodTableHtml } from '../presentation/sigma/sigma-period-table-html';
import { sigmaAnalysisSetupHtml } from '../presentation/sigma/sigma-analysis-setup-html';
import { sigmaPeriodRowHtml } from '../presentation/sigma/sigma-period-row-html';
import { sigmaChartsPanelHtml } from '../presentation/sigma/sigma-charts-panel-html';
import { sigmaPeriodTableHeadHtml } from '../presentation/sigma/sigma-period-table-head-html';
import { sigmaNoLevelsPanelHtml } from '../presentation/sigma/sigma-no-levels-panel-html';
import { actionFormClosedHtml as actionFormClosedPresentation } from '../presentation/nce/action-form-closed-html';
import { actionFormPanelHtml as actionFormPanelPresentation } from '../presentation/nce/action-form-panel-html';
import { actionImmediateStepHtml as actionImmediateStepPresentation, actionRiskStepHtml as actionRiskStepPresentation, actionInvestigationStepHtml as actionInvestigationStepPresentation, actionCauseStepHtml as actionCauseStepPresentation, actionPatientStepHtml as actionPatientStepPresentation, actionEffectivenessStepHtml as actionEffectivenessStepPresentation } from '../presentation/nce/action-form-steps-html';
import { actionIncidentBannerHtml as actionIncidentBannerPresentation } from '../presentation/nce/action-incident-banner-html';
import { actionFormSectionHtml as actionFormSectionPresentation } from '../presentation/nce/action-form-section-html';
import { actionInvestigationFieldHtml as actionInvestigationFieldPresentation } from '../presentation/nce/action-investigation-field-html';
import { actionBiasContext as actionBiasContextPresentation } from '../presentation/nce/action-bias-context';
import { actionLevelContext as actionLevelContextPresentation } from '../presentation/nce/action-level-context';
import { actionLevelLabel as actionLevelLabelPresentation } from '../presentation/nce/action-level-label';
import { actionSelectHtml as actionSelectPresentation } from '../presentation/nce/action-select-html';
import { actionSuggestRowHtml as actionSuggestRowPresentation } from '../presentation/nce/action-suggest-row-html';
import { actionSuggestBoxHtml as actionSuggestBoxPresentation } from '../presentation/nce/action-suggest-box-html';
import { actionStaffOptionsHtml as actionStaffOptionsPresentation } from '../presentation/nce/action-staff-options-html';
import { actionRuleOptions as actionRuleOptionsPresentation } from '../presentation/nce/action-rule-options';
import { actionCausePhrases as actionCausePhrasesPresentation, actionPhrases as actionPhrasesPresentation } from '../presentation/nce/action-suggest-phrases';
import { userPermissionChecksHtml } from '../presentation/auth/user-permission-checks-html';
import { userRoleSelectHtml } from '../presentation/auth/user-role-select-html';
import { ActionFormUiState } from '../application/nce/action-form-ui-state';
import { actionFormRenderState } from '../application/nce/action-form-render-state';
import { targetConfigAssigned as targetConfigAssignedPresentation, createTargetRangeDraft } from '../presentation/manage/target-config-state';
import { entrySheetMonthPart, entrySheetMonthValue } from '../presentation/entry/entry-sheet-month';
import { createEntryTreeState } from '../presentation/entry/entry-tree-state';
import { createEntrySheetNavigation } from '../presentation/entry/entry-sheet-navigation';
import { createEntrySheetInputOrder } from '../presentation/entry/entry-sheet-input-order';
import { entryTreeGroupState } from '../presentation/entry/entry-tree-group-state';
import { createEntryTreeNavigation } from '../presentation/entry/entry-tree-navigation';
import { createEntrySheetFocus } from '../presentation/entry/entry-sheet-focus';
import { createEntryColumnConfig } from '../presentation/entry/entry-column-config';
import { entryRangePreset } from '../presentation/entry/entry-range-preset';
import { readEntryTreeCollapsed, writeEntryTreeCollapsed } from '../presentation/entry/entry-tree-collapse-preference';
import { entryTreeVisibility } from '../presentation/entry/entry-tree-visibility';
import { entryTreeKeyCommand } from '../presentation/entry/entry-tree-key-command';
import { entrySelectionState } from '../presentation/entry/entry-selection-state';
import { entryExpandedTablesToggle } from '../presentation/entry/entry-expanded-tables-state';
import { entryPointContext } from '../presentation/entry/entry-point-context';
import { entryVoidNceChoice, entryVoidReasonValid } from '../presentation/entry/entry-void-nce-choice';
import { entryRecordErrorMessage } from '../presentation/entry/entry-record-error-message';
import { entrySaveFeedback } from '../presentation/entry/entry-save-feedback';
import { entryExtraRunRequest } from '../presentation/entry/entry-extra-run-request';
import { entryDateNoteFeedback, entryDateNoteErrorMessage } from '../presentation/entry/entry-date-note-feedback';
import { createEntryDateRangeInput } from '../presentation/entry/entry-date-range-input';
import { westgardUiState } from '../presentation/westgard/westgard-ui-state';
import { westgardModeTabs } from '../presentation/westgard/westgard-mode-tabs';
import { createWestgardTestSearch } from '../presentation/westgard/westgard-test-search';
import { createWestgardMultiViews } from '../presentation/westgard/westgard-multi-views';
import { createWestgardCusumLevels } from '../presentation/westgard/westgard-cusum-levels';
import { createWestgardPointRowsHtml } from '../presentation/westgard/westgard-point-rows-html';
import { createWestgardRowsControl } from '../presentation/westgard/westgard-rows-control';
import { createWestgardCusumPageHtml } from '../presentation/westgard/westgard-cusum-page-html';
import { createWestgardLotBlockHtml } from '../presentation/westgard/westgard-lot-block-html';
import { createWestgardPageController } from '../presentation/westgard/westgard-page-controller';
import { createWestgardRuleGuideHtml } from '../presentation/westgard/westgard-rule-guide-html';
import { createWestgardRuleTogglesHtml } from '../presentation/westgard/westgard-rule-toggles-html';
import { createWestgardExportActionsHtml } from '../presentation/westgard/westgard-export-actions-html';
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
import { createCanvasFont as createSigmaCanvasFont } from '../presentation/sigma/canvas-font';
import { createReportLabels } from '../presentation/report/report-labels';
import { createReportSelection } from '../presentation/report/report-selection';
import { createReportSearch } from '../presentation/report/report-search';
import { createSigmaMuTrace } from '../presentation/sigma/sigma-mu-trace';
import { createSigmaPrintRows } from '../presentation/sigma/sigma-print-rows';
import { createSigmaMuPrintRows } from '../presentation/sigma/sigma-mu-print-rows';
import { createReportPointsTable } from '../presentation/report/report-points-table';
import { createActionReportHtml } from '../presentation/nce/action-report-html';
import { createActionGuideContent } from '../presentation/nce/action-guide-content';
import { createActionPageHtml } from '../presentation/nce/action-page-html';
import { createActionSideChipsHtml } from '../presentation/nce/action-side-chips-html';
import { createActionDetailCheckHtml } from '../presentation/nce/action-detail-check-html';
import { createActionEvidenceTimelineHtml } from '../presentation/nce/action-evidence-timeline-html';
import { createActionReviewButtonsHtml } from '../presentation/nce/action-review-buttons-html';
import { createActionRerunEvidenceHtml } from '../presentation/nce/action-rerun-evidence-html';
import { createActionIssueRowHtml } from '../presentation/nce/action-issue-row-html';
import { createActionOpenIssueHtml } from '../presentation/nce/action-open-issue-html';
import { createActionIssueGroupHtml } from '../presentation/nce/action-issue-group-html';
import { createActionLogRowHtml } from '../presentation/nce/action-log-row-html';
import { createActionApprovalTagHtml } from '../presentation/nce/action-approval-tag-html';
import { createActionDetailMetaHtml } from '../presentation/nce/action-detail-meta-html';
import { createActionCancelledAlertHtml } from '../presentation/nce/action-cancelled-alert-html';
import { actionCancelModalHtml } from '../presentation/nce/action-cancel-modal-html';
import { actionReviewNoteModalHtml } from '../presentation/nce/action-review-note-modal-html';
import { actionReopenModalHtml } from '../presentation/nce/action-reopen-modal-html';
import { actionDetailModalHtml } from '../presentation/nce/action-detail-modal-html';
import { createActionLegacyDetailHtml } from '../presentation/nce/action-legacy-detail-html';
import { createActionContainmentDetailHtml } from '../presentation/nce/action-containment-detail-html';
import { createActionInspectionDetailsHtml } from '../presentation/nce/action-inspection-details-html';
import { createActionPatientImpactHtml } from '../presentation/nce/action-patient-impact-html';
import { createActionCauseDetailHtml } from '../presentation/nce/action-cause-detail-html';
import { createActionEffectivenessDetailHtml } from '../presentation/nce/action-effectiveness-detail-html';
import { createActionLogPanelHtml } from '../presentation/nce/action-log-panel-html';
import { actionIssuesPanelHtml } from '../presentation/nce/action-issues-panel-html';
import { createManageToolbarHtml } from '../presentation/manage/manage-toolbar-html';
import { createManagePageHtml } from '../presentation/manage/manage-page-html';
import { createManageShellHtml } from '../presentation/manage/manage-shell-html';
import { createManageInstrumentRowHtml } from '../presentation/manage/manage-instrument-row-html';
import { manageInstrumentTableHtml } from '../presentation/manage/manage-instrument-table-html';
import { createManagePanelRowHtml } from '../presentation/manage/manage-panel-row-html';
import { managePanelTableHtml } from '../presentation/manage/manage-panel-table-html';
import { createManageLotRowHtml } from '../presentation/manage/manage-lot-row-html';
import { manageLotConfigLayoutHtml } from '../presentation/manage/manage-lot-config-layout-html';
import { createManageLotGroupCardHtml } from '../presentation/manage/manage-lot-group-card-html';
import { createManageTransitionRowHtml } from '../presentation/manage/manage-transition-row-html';
import { manageTransitionTableHtml } from '../presentation/manage/manage-transition-table-html';
import { manageTransitionDetailsHtml } from '../presentation/manage/manage-transition-details-html';
import { teaReferenceAddModalHtml } from '../presentation/manage/tea-reference-add-modal-html';
import { teaReferenceLabProfileBodyHtml } from '../presentation/manage/tea-reference-lab-profile-body-html';
import { teaReferenceLabProfileModalHtml } from '../presentation/manage/tea-reference-lab-profile-modal-html';
import { teaReferenceRowHtml } from '../presentation/manage/tea-reference-row-html';
import { teaReferenceTableHtml } from '../presentation/manage/tea-reference-table-html';
import { createTeaSourceRegistryHtml } from '../presentation/manage/tea-source-registry-html';
import { createManageHistoryRowHtml } from '../presentation/manage/manage-history-row-html';
import { manageSearchPlaceholder } from '../presentation/manage/manage-search-placeholder';
import { createManageAssayRowHtml } from '../presentation/manage/manage-assay-row-html';
import { manageAssayTableHtml } from '../presentation/manage/manage-assay-table-html';
import { teaReferenceStatusHtml } from '../presentation/manage/tea-reference-status-html';
import { manageTransitionStatus } from '../presentation/manage/manage-transition-status';
import { createManageLotStatus } from '../presentation/manage/manage-lot-status';
import { manageInstrumentName } from '../presentation/manage/manage-instrument-name';
import { manageLotLabel } from '../presentation/manage/manage-lot-label';
import { managePanelName } from '../presentation/manage/manage-panel-name';
import { manageLotGroupLabels } from '../presentation/manage/manage-lot-group-labels';
import { groupsOfLot as groupsOfLotTs } from '../presentation/manage/groups-of-lot';
import { targetGroupLots as targetGroupLotsTs } from '../presentation/manage/target-group-lots';
import { targetGroupLabel } from '../presentation/manage/target-group-label';
import { targetGroupStatusSuffix } from '../presentation/manage/target-group-status-suffix';
import { targetPanelLabel } from '../presentation/manage/target-panel-label';
import { targetPanelTests } from '../presentation/manage/target-panel-tests';
import { targetPanelOptionsHtml } from '../presentation/manage/target-panel-options-html';
import { targetGroupOptionsHtml } from '../presentation/manage/target-group-options-html';
import { targetSelection } from '../presentation/manage/target-selection';
import { targetLevelSelection } from '../presentation/manage/target-level-selection';
import { historySearchValues } from '../presentation/manage/history-search-values';
import { teaLabBasisLabel } from '../presentation/manage/tea-lab-basis-label';
import { targetLevelLots } from '../presentation/manage/target-level-lots';
import { targetSearchValues } from '../presentation/manage/target-search-values';
import { historyAssayOptionsHtml } from '../presentation/manage/history-assay-options-html';
import { historyAssaySelection } from '../presentation/manage/history-assay-selection';
import { historyVisibleRows } from '../presentation/manage/history-visible-rows';
import { sortHistoryRows } from '../presentation/manage/history-row-sort';
import { historySummary } from '../presentation/manage/history-summary';
import { teaSourceRegistryItems } from '../presentation/manage/tea-source-registry-items';
import { manageSearchMatch } from '../presentation/manage/manage-search-match';
import { lotTransitionTargetNumber } from '../presentation/manage/lot-transition-target-number';
import { historyPeriodLabel } from '../presentation/manage/history-period-label';
import { targetRowState } from '../presentation/manage/target-row-state';
import { targetMatrixStats } from '../presentation/manage/target-matrix-stats';
import { targetMatrixItems } from '../presentation/manage/target-matrix-items';
import { targetLevelTabsHtml } from '../presentation/manage/target-level-tabs-html';
import { targetSummaryHtml } from '../presentation/manage/target-summary-html';
import { targetMatrixRowHtml } from '../presentation/manage/target-matrix-row-html';
import { targetMatrixPanelHtml } from '../presentation/manage/target-matrix-panel-html';
import { historyRows } from '../presentation/manage/history-rows';
import { historySelectorHtml } from '../presentation/manage/history-selector-html';
import { targetSelectorHtml } from '../presentation/manage/target-selector-html';
import { historyTableHtml } from '../presentation/manage/history-table-html';
import { historyPanelHtml } from '../presentation/manage/history-panel-html';
import { manageEmptyPanelHtml } from '../presentation/manage/manage-empty-panel-html';
import { targetEmptyState } from '../presentation/manage/target-empty-state';
import { targetMatrixTableHtml } from '../presentation/manage/target-matrix-table-html';
import { targetMatrixActionsHtml } from '../presentation/manage/target-matrix-actions-html';
import { targetPrerequisite } from '../presentation/manage/target-prerequisite';
import { targetLevelToolbarHtml } from '../presentation/manage/target-level-toolbar-html';
import { teaReferenceKind } from '../presentation/manage/tea-reference-kind';
import { teaReferenceRowActions } from '../presentation/manage/tea-reference-row-actions';
import { sortTeaReferences } from '../presentation/manage/tea-reference-sort';
import { teaReferenceNamingTitle } from '../presentation/manage/tea-reference-naming-title';
import { teaReferenceEmptyState } from '../presentation/manage/tea-reference-empty-state';
import { teaReferenceLabValueHtml } from '../presentation/manage/tea-reference-lab-value-html';
import { teaReferenceInputValue } from '../presentation/manage/tea-reference-input-value';
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
import { reagentQuickPickerModalHtml } from '../presentation/reagent/reagent-quick-picker-modal-html';
import { reagentPickerModalHtml } from '../presentation/reagent/reagent-picker-modal-html';
import { reagentCreateModalHtml } from '../presentation/reagent/reagent-create-modal-html';
import { reagentEmptyPageHtml } from '../presentation/reagent/reagent-empty-page-html';
import { reagentToolbarHtml } from '../presentation/reagent/reagent-toolbar-html';
import { reagentPairPanelHtml } from '../presentation/reagent/reagent-pair-panel-html';
import { reagentInfoPanelHtml } from '../presentation/reagent/reagent-info-panel-html';
import { reagentChartsPanelHtml } from '../presentation/reagent/reagent-charts-panel-html';
import { reagentResultsPanelsHtml } from '../presentation/reagent/reagent-results-panels-html';
import { reagentChartAxis } from '../presentation/reagent/reagent-chart-axis';
import { reagentScatterSvg } from '../presentation/reagent/reagent-scatter-svg';
import { reagentBlandSvg } from '../presentation/reagent/reagent-bland-svg';
import { reagentQuickPickerRowsHtml } from '../presentation/reagent/reagent-quick-picker-rows-html';
import { reagentPickerRowsHtml } from '../presentation/reagent/reagent-picker-rows-html';
import { reagentCreateReferenceRowsHtml } from '../presentation/reagent/reagent-create-reference-rows-html';
import { reagentCreateTypedRowHtml } from '../presentation/reagent/reagent-create-typed-row-html';
import { reagentReportDetailCardHtml, reagentReportChartGridHtml } from '../presentation/reagent/reagent-report-detail-card-html';
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
import { createSigmaMuWorkflowCommand, type SigmaMuWorkflowCommand } from '../application/sigma/sigma-mu-workflow-command';
import { createSigmaCohortSelectionService, type SigmaCohortSelectionService } from '../application/sigma/sigma-cohort-selection-service';
import { createSigmaTeaEditService, type SigmaTeaEditService } from '../application/sigma/sigma-tea-edit-service';
import { createSigmaTeaSnapshotService, type SigmaTeaSnapshotService } from '../application/sigma/sigma-tea-snapshot-service';
import { createSigmaLevelSelectionService, type SigmaLevelSelectionService } from '../domain/sigma/sigma-level-selection-service';
import { createSigmaTeaResolution, type SigmaTeaResolution } from '../domain/sigma/sigma-tea-resolution';
import { createSigmaPeriodSelectionService, type SigmaPeriodSelectionService } from '../presentation/sigma/sigma-period-selection-service';
import { createLotTransitionPickerService, type LotTransitionPickerServiceApi } from '../presentation/manage/lot-transition-picker-service';
import { createManagePageController } from '../presentation/manage/manage-page-controller';
import { createManageTestsActionsController } from '../presentation/manage/manage-tests-actions-controller';
import { createEntryPageController } from '../presentation/entry/entry-page-controller';
import { createActionFormController } from '../presentation/actions/action-form-controller';
import { createActionsPageController } from '../presentation/actions/actions-page-controller';
import { createSigmaPageController } from '../presentation/sigma/sigma-page-controller';
import { jsq } from '../presentation/shared/js-string-literal';
import { westgardViewModel, type WestgardViewModelApi } from '../domain/westgard/westgard-view-model';
import { westgardRowsWindow } from '../presentation/westgard/westgard-row-window';
import { createWestgardXlsxRows, type WestgardXlsxRows } from '../presentation/westgard/westgard-xlsx-rows';
import { createWestgardXlsxHeader } from '../presentation/westgard/westgard-xlsx-header';
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
import { createActionFormModel, type ActionFormModelApi } from '../presentation/nce/action-form-model';
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
import { actionReviewMessages } from '../presentation/nce/action-review-messages';
import { createActionEscalationService, type ActionEscalationService } from '../application/nce/action-escalation-service';
import { createActionRecordService, type ActionRecordService } from '../application/nce/action-record-service';
import { createNceFormCommand } from '../application/nce/nce-form-command';
import { createNceFormWorkflowCommand, type NceFormWorkflowCommand } from '../application/nce/nce-form-workflow-command';
import { createNceLifecycleCommand } from '../application/nce/nce-lifecycle-command';
import { createNceLifecycleWorkflowCommand, type NceLifecycleWorkflowCommand } from '../application/nce/nce-lifecycle-workflow-command';
import { createActionRerunService, type ActionRerunService } from '../application/nce/action-rerun-service';
import { createActionPointIndexService, type ActionPointIndexService } from '../application/nce/action-point-index-service';
import { createActionCurrentIssues, type ActionCurrentIssuesApi } from '../application/nce/action-current-issues';
import {
  createAnalysisUiState,
  createAuthUiState,
  createEntryUiState,
  createManageUiState,
  createReagentUiState,
  createSigmaUiState,
  createRouterUiState,
  installUiState,
} from '../presentation/state/ui-state';

declare let state: Record<string, any> & { data?: Record<string, Record<string, any>[]>; tests?: Record<string, any>[] };
declare let entryLjRenderCache:any,entryJumpToday:any;
declare const ChartViewModel:any;
declare function acceptedLotPoints(test:any,level:number):any[];
declare function wgMultiViews(test:any):any[];
declare function levelsForLotGroup(group:any):any[];
declare function wgArchivedMultiViews(levels:any[]):any[];
declare function operationalLotPoints(test:any,level:number):any[];
declare function cusumSeries(test:any,level:any):any;
declare function rcCompute():void;
declare function sgRefresh():void;
declare function updateBackupBanner():void;
declare function isoToday(): string;
declare function vnDate(value: unknown): string;
declare function requireWrite(): boolean;
declare function rerender(): void;
declare function fmt(value: unknown, decimals?: number): string;
declare function formatDateTimeVN(value: string): string;
declare function lvlCfg(test: Record<string, any>, level: unknown): Record<string, any>;
declare function logAct(action: string, detail: string, target?: string): void;
declare function save(options: Record<string, any>): void;
declare function hydratePartitionedState(): Promise<boolean>;
declare function restoreFromIndexedDb(): Promise<boolean>;
declare function adoptValidatedState(value: unknown): void;
declare function recoverPendingSigmaDraft(): boolean;
declare function ensureShape(options?: Record<string, any>): void;
declare function quarantineCorruptLocal(raw: string, error: unknown): void;
declare let partitionSlot: string, localLoadStatus: string, storageHydrationPromise: Promise<boolean>;
declare let mem: any, startupProblem: any;
declare let wgMemo: Map<string, any>;
declare let lsDirty: boolean, lsFullDirty: boolean, lsSaveFailures: number, lsIncrementalStreak: number, lsLastFullSaveAt: number, lsRevision: number;
declare let LS_FULL_ROTATE_MAX_INCREMENTALS: number, LS_FULL_ROTATE_MAX_MS: number;
declare const lsDirtyTestIds: Set<string>;
declare let partitionWrite: Promise<boolean>;
declare function clearDerived(): void;
declare function clearDerivedForTest(testId: unknown): void;
declare function scheduleLocalSave(): void;
declare function cancelLocalSaveSchedule(): void;
declare function scheduleLocalRetry(): void;
declare function serializeStateForStorage(): string;
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
declare let page: string;
declare let loginFails: number, loginLockUntil: number;
declare let auditQ: string, auditFrom: string, auditTo: string, auditPage: number, auditPageSize: number;
declare const firebase: any;
declare function initFirebase(): Promise<unknown>;
declare function ensureFirebaseApp(config: any): Promise<unknown>;
declare function fbHandleValue(value: any, options?: Record<string, any>): Promise<unknown>;
declare function fbStartPull(): void;
declare function auditRelinkChain(entries: any[], anchor?: string): any[];
declare function fbHasLocalChanges(): boolean;
declare function ensureAdmin(): void;
declare function renderBrand(): void;
declare function fbMerge(local: any, remote: any, base: any): any;
declare function fbFirstConnectMerge(local: any, remote: any): any;
declare function applyRemoteRender(): void;
declare function getFbCfg(): Record<string, any> | null;
declare function fbConfigSig(config: any): string;
declare function getDeployFbCfg(): any;
declare function getStoredFbCfg(): any;
declare function persistLocalSnapshot(options?: Record<string, any>): boolean;
declare function mirrorIndexedDb(raw: string): boolean;
declare function userName(): string;
declare function auditSha256(text: string): string;
declare function uid(): string;
declare function isoDate(value: Date): string;
declare const TEA_ANALYTE_CATALOG: any[];
// `REFTESTS`/`TEA_SOURCE_REGISTRY` là `const` global lexical của state.js, không
// phải property trên `window`/`globalThis`. Service TEa chạy sau state.js nên đọc
// hai binding này trực tiếp — (globalThis as any).TEA_SOURCE_REGISTRY từng bị dùng
// nhầm ở TeaReferenceService's wiring (luôn undefined, làm sửa CLIA/Ricos trong tab
// "Bảng TEa tham chiếu" ném lỗi), đã sửa về tham chiếu trần đúng quy tắc này.
declare const REFTESTS: readonly any[][];
declare const TEA_SOURCE_REGISTRY: Record<string, any>;
// Cùng lớp với hai binding trên — `WG_RULES`/`QC_DECIMALS_DEFAULT` cũng là `const`
// global lexical của state.js.
declare const WG_RULES: readonly string[];
declare const QC_DECIMALS_DEFAULT: number;
// `teaAnalyteKey` là `const` arrow function của state.js (const, không phải
// `function`) — cũng KHÔNG phải property trên globalThis, phải tham chiếu trần.
declare function teaAnalyteKey(value: unknown): string;
declare function role(): string;

type QCLabGlobal = typeof globalThis & {
  QCLAB_APP: { name: string; version: string; releaseDate: string };
  QCLAB_CLOUD: { labCode: string; anonymous: boolean; locked: boolean; config: Record<string, string> };
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
  PointWorkflowService: ReturnType<typeof createPointWorkflowService>;
  ActionDraftStatusService?: ReturnType<typeof createActionDraftStatus>;
  ActionProtocolService: ActionProtocolService;
  ActionReviewService: ActionReviewService;
  ActionReviewMessages: typeof actionReviewMessages;
  ActionEscalationService: ActionEscalationService;
  NceFormWorkflowCommand: NceFormWorkflowCommand;
  NceLifecycleWorkflowCommand: NceLifecycleWorkflowCommand;
  ActionRerunService: ActionRerunService;
  ActionPointIndexService: ActionPointIndexService;
  // Retire classic action-workflow-service.js (2026-08-20, Pha G nhóm C lát 1) — glue thuần
  // quanh các service NCE phía trên, không có logic mới.
  nextNceId: (today: string) => string;
  nceDueDate: (days?: number) => string;
  actionApprovalStatus: (action: Record<string, any> | null | undefined) => string;
  actionRecordStatus: (action: Record<string, any> | null | undefined) => string;
  actionCancelled: (action: Record<string, any> | null | undefined) => boolean;
  actionApprovalLabel: (action: Record<string, any> | null | undefined) => string;
  actionRecorded: (action: Record<string, any> | null | undefined) => boolean;
  actionDraftStatus: (action: Record<string, any> | null | undefined) => Record<string, any>;
  actionProtocolStatus: (action: Record<string, any> | null | undefined) => Record<string, any>;
  actionProtocolSummary: (action: Record<string, any> | null | undefined) => string;
  actionRiskScore: (action: Record<string, any> | null | undefined) => number;
  actionResidualRiskScore: (action: Record<string, any> | null | undefined) => number;
  actionActiveFollowUp: (action: Record<string, any> | null | undefined) => Record<string, any> | null;
  actionEffectivenessStatus: (action: Record<string, any> | null | undefined) => Record<string, any>;
  actionOverdue: (action: Record<string, any> | null | undefined) => Record<string, any>;
  actionCanApprove: (action: Record<string, any> | null | undefined, user: Record<string, any> | null | undefined) => boolean;
  invalidateActionCaches: (testId?: string) => void;
  actionPoint: (action: Record<string, any> | null | undefined) => Record<string, any> | null;
  actionEventDate: (action: Record<string, any> | null | undefined) => string;
  actionNeedsRerun: (action: Record<string, any> | null | undefined) => boolean;
  actionRerunGateDate: (action: Record<string, any> | null | undefined, point: Record<string, any> | null | undefined) => string;
  actionRerunStatus: (action: Record<string, any> | null | undefined) => Record<string, any>;
  actionWorkflowStatus: (action: Record<string, any> | null | undefined) => Record<string, any>;
  pointActions: (pointId: string) => Record<string, any>[];
  pointRealActions: (pointId: string) => Record<string, any>[];
  pointWorkflowComplete: (pointId: string) => boolean;
  pointWorkflowSummary: (pointId: string) => Record<string, any>;
  ACTION_LABELS: NceActionLabels['actionLabels'];
  RISK_SCALE: NceActionLabels['riskScale'];
  ActionCurrentIssues?: ActionCurrentIssuesApi;
  ActionBiasService: ActionBiasService;
  ActionBiasPresentation: ActionBiasPresentation;
  ActionViolationService: ActionViolationService;
  ActionListPresentation: ActionListPresentation;
  ActionEvidencePresentation: ActionEvidencePresentation;
  ActionRerunEvidencePresentation?: ActionRerunEvidencePresentation;
  ActionStatusPresentation: ActionStatusPresentation;
  ActionReviewPresentation: ActionReviewPresentation;
  ActionDetailPresentation: ActionDetailPresentation;
  ActionGuidePresentation?: ActionGuidePresentation;
  ActionInvestigationPresentation: ActionInvestigationPresentation;
  ActionChecklistPresentation: ActionChecklistPresentation;
  ActionFormModel: ActionFormModelApi;
  ReportPeriodPresentation: ReportPeriodPresentation;
  reportSearchValuePresentation: typeof reportSearchValuePresentation;
  reportActionIconPresentation: typeof reportActionIconPresentation;
  ChartViewModel?: ChartViewModelApi;
  EntryService: EntryServiceApi;
  EntryRecordWorkflowCommand: EntryRecordWorkflowCommand;
  EntryVoidWorkflowCommand: EntryVoidWorkflowCommand;
  EntryDateNoteWorkflowCommand: EntryDateNoteWorkflowCommand;
  RangeWorkflowCommand: RangeWorkflowCommand;
  rangeSystematicNce: (tid: string, level: unknown) => any;
  rangeCandidate: (tid: string, level: unknown) => any;
  openRangeWorkflow: (tid: string, level: unknown) => void;
  rangeTeaPercent: (t: any, l: any) => number | null;
  rangeGateHtml: (r: any, tid: string, level: unknown) => string;
  rangeUpdateBiasHint: (tid: string, level: unknown) => void;
  rangeGatePasses: (r: any) => boolean;
  applyNewRange: (tid: string, level: unknown) => Promise<void>;
  confirmApplyNewRange: (tid: string, level: unknown) => Promise<void>;
  revertRange: (tid: string, level: unknown) => void;
  confirmRevertRange: (tid: string, level: unknown) => Promise<void>;
  ReagentComparisonWorkflowCommand: ReagentComparisonWorkflowCommand;
  ManageConfigService: ManageConfigServiceApi;
  ManageInstrumentWorkflowCommand: ManageInstrumentWorkflowCommand;
  ManagePanelWorkflowCommand: ManagePanelWorkflowCommand;
  ManageLotTransitionCommand: ManageLotTransitionCommand;
  ManageLotWorkflowCommand: ManageLotWorkflowCommand;
  ManageAssayWorkflowCommand: ManageAssayWorkflowCommand;
  ManageLotTransitionWorkflowCommand: ManageLotTransitionWorkflowCommand;
  ManageLotGroupWorkflowCommand: ManageLotGroupWorkflowCommand;
  ManageTargetMatrixWorkflowCommand: ManageTargetMatrixWorkflowCommand;
  TeaReferenceService: TeaReferenceServiceApi;
  TeaReferenceWorkflowCommand: TeaReferenceWorkflowCommand;
  LotTransitionPickerService: LotTransitionPickerServiceApi;
  manageSearchSet?: (v: unknown) => void;
  manageMatch?: (values: unknown[]) => boolean;
  manageSearchPlaceholder?: () => string;
  groupsOfLot?: (id: unknown) => Record<string, any>[];
  lotGroupLabels?: (id: unknown) => string;
  instrumentName?: (id: unknown, fallback?: string) => string;
  panelName?: (id: unknown) => string;
  lotLabel?: (id: unknown) => string;
  lotTransitionToNo?: (lotId: unknown) => unknown;
  lotStatus?: (l: Record<string, any>) => unknown;
  manageShell?: (body: string) => string;
  manageToolbar?: (title: string, sub: string, action?: string, label?: string) => string;
  manageLots?: () => string;
  manageInstruments?: () => string;
  managePanels?: () => string;
  manageTransitionsV2?: () => string;
  targetGroupLots?: (group: Record<string, any>) => Record<string, any>[];
  targetGroupOptions?: () => string;
  ensureTargetSelection?: () => void;
  manageTargets?: () => string;
  manageAssays?: () => string;
  manageHistorySearchValues?: (t: Record<string, any>) => unknown[];
  manageHistory?: () => string;
  teaRefFind?: (refKey: unknown) => Record<string, any>;
  teaRefNumOrNull?: (v: unknown) => number | null;
  teaRefExternalChanged?: (row: Record<string, any>, refKey: unknown) => boolean;
  teaRefEnsure?: (refKey: unknown) => Record<string, any>;
  teaRefEdit?: (name: unknown, field: string, val: unknown) => void;
  teaRefRemove?: (refKey: unknown) => void;
  teaSourceRegistryHtml?: () => string;
  teaRefOpenAdd?: () => void;
  teaRefAddSubmit?: () => Promise<void>;
  teaLabProfileOpen?: (refKey: unknown) => void;
  teaLabProfileSave?: (refKey: unknown) => Promise<void>;
  teaLabProfileRemove?: (refKey: unknown) => Promise<void>;
  manageTeaRefs?: () => string;
  manageView?: () => string;
  renderManageBody?: () => void;
  pageManage?: () => string;
  parseVN?: (value: unknown) => string;
  setManageTab?: (tab: unknown) => void;
  setTargetPanel?: (id: unknown) => void;
  setTargetGroup?: (id: unknown) => void;
  setTargetLevel?: (level: unknown) => void;
  setHistoryTest?: (id: unknown) => void;
  openTargetMatrix?: (panelId?: string, groupId?: string) => void;
  targetNumberText?: (value: unknown, test?: Record<string, any> | null, kind?: string) => string;
  targetConfigAssigned?: (cfg: Record<string, any>) => Record<string, any>;
  targetRangeDraft?: (cfg?: Record<string, any>) => Record<string, any>;
  syncTargetRange?: (el: Record<string, any>, source: unknown) => void;
  toggleTargetRow?: (el: Record<string, any>) => void;
  targetCheckAll?: (on: unknown) => void;
  targetPickBackfillPoints?: (t: Record<string, any>, lot: Record<string, any>, pick: Record<string, any>) => Record<string, any>[];
  applyTargetPick?: (t: Record<string, any>, lot: Record<string, any>, pick: Record<string, any>, effectiveFrom: unknown, note: unknown) => unknown;
  applyPlannedTarget?: (t: Record<string, any>, lot: Record<string, any>, pick: Record<string, any>, note: unknown) => unknown;
  readTargetMatrixPicks?: () => Promise<Record<string, any>[] | null>;
  saveTargetMatrix?: () => Promise<void>;
  openTargetSwitchModal?: () => void;
  resolveTargetSwitch?: (mode: unknown) => Promise<void>;
  commitTargetMatrix?: (picked: Record<string, any>, group: Record<string, any>, mode: unknown, overwrites: Record<string, any>) => void;
  openQcHistoryDetail?: (tid: unknown, level: unknown, lotNo?: string) => void;
  openConfigPanel?: (id?: string) => Promise<void>;
  renderConfigPanelTests?: () => void;
  saveConfigPanel?: (id: unknown) => Promise<void>;
  deleteConfigPanel?: (id: unknown) => Promise<void>;
  deleteLotTransition?: (id: unknown) => Promise<void>;
  lotTransitionChoiceLabel?: (lot: Record<string, any>) => string;
  lotTransitionChoiceLots?: (selectedId?: string) => Record<string, any>[];
  lotTransitionChoiceMatch?: (value: unknown, selectedId?: string) => Record<string, any>;
  lotTransitionSelectedId?: (inputId: string) => string;
  lotTransitionChoiceInput?: (el: Record<string, any>, commit?: boolean) => void;
  lotTransitionChoiceHtml?: (inputId: string, selectedId: unknown) => string;
  openLotTransitionV2?: (id?: string) => Promise<void>;
  lotTransitionTargetsHtml?: (panelId: unknown, fromLotId: unknown, toLotId: unknown) => string;
  filterLotTransitionTargets?: (term: unknown) => void;
  refreshLotTransitionTargets?: () => void;
  readLotTransitionTargetPicks?: (rows: Record<string, any>[]) => Promise<Record<string, any>[] | null>;
  saveLotTransitionV2?: (id: unknown) => Promise<void>;
  openConfigGroup?: (id?: string) => Promise<void>;
  suggestConfigGroupName?: () => void;
  saveConfigGroup?: (id: unknown) => Promise<void>;
  deleteConfigGroup?: (id: unknown) => Promise<void>;
  toggleLotGroupStatus?: (id: unknown) => void;
  activateLotGroup?: (id: unknown) => Promise<void>;
  openConfigLot?: (id?: string) => void;
  saveConfigLot?: (id: unknown) => Promise<void>;
  renameLotAcrossPoints?: (oldLevel: unknown, oldLotNo: unknown, newLotNo: unknown) => unknown;
  deleteConfigLot?: (id: unknown) => Promise<void>;
  openConfigInstrument?: (id?: string) => void;
  saveConfigInstrument?: (id: unknown) => Promise<void>;
  deleteConfigInstrument?: (id: unknown) => Promise<void>;
  defaultAssayLevels?: () => Record<string, any>[];
  configAssayTeaRefs?: () => Record<string, any>[];
  configAssayRefRecord?: (name: unknown, analyteId?: string) => Record<string, any>;
  configAssayNaming?: (ref: Record<string, any>) => Record<string, any>;
  configAssayFindRef?: (value: unknown) => Record<string, any>;
  configAssaySuggestionInput?: (value: unknown) => void;
  openConfigAssay?: (id?: string) => void;
  saveConfigAssay?: (id: unknown) => Promise<void>;
  delTest?: (id: unknown) => Promise<void>;
  jsq?: (value: unknown) => string;
  pageEntry?: (rightOnly?: boolean) => string;
  entryWindow?: () => Record<string, any>;
  entryWindowFor?: (testId: unknown, level: unknown, endOverride?: string, startOverride?: string) => Record<string, any>;
  entryRowsWindow?: (rows: Record<string, any>[], key: string) => Record<string, any>;
  entryToggleRows?: (key: string) => void;
  entryDetailToggled?: (key: string, open: boolean) => void;
  entryTreeIsCollapsed?: () => boolean;
  treeToggle?: (key: unknown) => void;
  toggleEntryTree?: () => void;
  entryTreeKey?: (event: Record<string, any>) => void;
  entryFilter?: (value: unknown) => void;
  entryPick?: (testId: unknown, level: unknown) => void;
  entryFocusLevel?: (level: unknown) => void;
  entryShowPrevLot?: (level: unknown, lot: unknown) => void;
  entryShowCurrentLot?: (level: unknown) => void;
  entryFocusPendingSheet?: () => void;
  entrySheetInputs?: () => Record<string, any>[];
  entrySheetTarget?: (inputs: Record<string, any>[], current: Record<string, any>, key: string, shiftKey?: boolean) => Record<string, any>;
  entrySheetKey?: (event: Record<string, any>) => void;
  entryLatestTreeState?: (test: Record<string, any>) => string;
  entrySyncTreeState?: (testId: unknown) => void;
  entryRenderKeepScroll?: () => void;
  entrySetLastMsg?: (html: string) => void;
  entryUnlockExtraRun?: (tid: unknown, colKey: unknown, date: unknown, levelIdx: unknown, runNo: unknown) => void;
  entryDateNoteSave?: (tid: unknown, date: string, value: unknown) => Promise<void>;
  entryColumnCfg?: (test: Record<string, any>, level: unknown, lotNo: unknown) => Record<string, any>;
  entryInlineSave?: (tid: unknown, level: unknown, date: string, value: unknown, runIdHint?: string, lotNo?: string) => Promise<void>;
  entryInlineSaveCommit?: (tid: unknown, level: unknown, date: string, val: unknown, runId: unknown, lotNo?: unknown, valueDecimals?: number) => void;
  syncVoidNceChoice?: () => void;
  voidQcPoint?: (tid: unknown, pointId: unknown) => Promise<void>;
  confirmVoidQcPoint?: (tid: unknown, pointId: unknown) => Promise<void>;
  entrySetSheetMonth?: (value: unknown) => void;
  entryGoToday?: () => void;
  entrySetSheetPart?: (part: string, value: unknown) => void;
  entrySetDays?: (n: unknown) => void;
  entrySetStart?: (value: unknown) => void;
  entrySetEnd?: (value: unknown) => void;
  actionUi?: () => Record<string, any>;
  actionSectionToggled?: (key: string, open: boolean) => void;
  actionDefaultOpenSections?: (editing: unknown, protocol: unknown) => Record<string, any>;
  actionRuleOptions?: () => [string, string][];
  actionStaffOptions?: () => string;
  captureActionDraft?: () => void;
  actionFormChanged?: () => void;
  actionDraftValues?: () => Record<string, any>;
  clearActionDraft?: () => void;
  actionSourceOptions?: (qcBound: boolean, current: unknown) => [string, string][];
  actionCausePhrases?: (category: unknown) => string[];
  actionActionPhrases?: (errorType: unknown) => string[];
  actionSuggestRow?: (targetId: string, phrases: string[]) => string;
  actionSuggestBox?: (targetId: string, phrases: string[], label?: string) => string;
  actionInsertSuggestion?: (targetId: string, phrase: string) => void;
  syncActionSuggestions?: () => void;
  actSel?: (id: string, label: string, list: unknown, cur: unknown, extra?: string) => string;
  actionLevelLabel?: (l: Record<string, any>, t?: Record<string, any> | null) => string;
  syncActLevels?: () => void;
  actionLevelContext?: (testId: unknown, level: unknown, lot: unknown) => string;
  beginActionManual?: () => void;
  closeActionForm?: () => void;
  actionFormClosedHtml?: (issueCount: number) => string;
  actionIncidentBanner?: (form: Record<string, any>, editing: unknown) => string;
  beginActionFromIssue?: (tid: unknown, level: unknown, rule: unknown, err: unknown, act: unknown, pointId?: string, pointDate?: string) => void;
  actionFieldValue?: (id: string, max?: number) => string;
  readActionProtocolForm?: (version?: number) => Record<string, any>;
  actionEffectivenessMissingKey?: (a: Record<string, any>) => string;
  addAction?: () => Promise<void>;
  syncActionRiskScore?: () => void;
  syncActionResidualRiskScore?: () => void;
  editAction?: (i: number) => Promise<void>;
  actionInvestigationField?: (statusId: string, noteId: string, title: string, hint: string, form: Record<string, any>, statusKey: string, noteKey: string, lotToLot?: boolean) => string;
  actionInvestigationChoiceLabel?: (value: unknown, label: unknown) => string;
  actionInvestigationStateClass?: (value: unknown) => string;
  actionInvestigationChoose?: (statusId: string, value: string) => void;
  actionInvestigationSync?: (statusId: string) => void;
  actionChecklistRefresh?: () => void;
  actionSectionChip?: (missing: unknown) => Record<string, any>;
  actionChecklistChip?: (form: Record<string, any>) => Record<string, any>;
  actionEffSectionChip?: (form: Record<string, any>) => Record<string, any>;
  actionUpdateSectionChip?: (key: string, info: Record<string, any>) => void;
  actionRefreshSectionChips?: () => void;
  actionSection?: (key: string, badge: string, title: string, hint: string, bodyHtml: string, chipInfo: Record<string, any>, openSet: Set<string>) => string;
  actionFormModel?: (editing: unknown, tests: Record<string, any>[]) => Record<string, any>;
  actionFormDefaults?: (tests: Record<string, any>[]) => Record<string, any>;
  focusActionField?: (key: string) => void;
  actionBiasInfo?: (t: unknown, l: unknown, biasBeforeRaw: unknown, biasAfterRaw: unknown) => Record<string, any>;
  actionBiasContext?: (form: Record<string, any>, editing: unknown) => Record<string, any>;
  actionLatestSigmaBias?: (t: unknown, level: unknown) => Record<string, any> | null;
  actionFillBias?: (targetId: string, value: unknown) => void;
  actionBiasThresholdHtml?: (info: Record<string, any>) => string;
  actionBiasReferenceHtml?: (info: Record<string, any>) => string;
  actionUpdateBiasHint?: () => void;
  actionFormHtml?: (issueCount: number) => string;
  actionLevelShort?: (t: unknown, level: unknown, lotSnap: unknown) => string;
  currentIssues?: () => Record<string, any>[];
  cancelAction?: (i: number) => Promise<void>;
  confirmCancelAction?: (id: unknown, token: unknown) => void;
  actionApprovalTag?: (a: Record<string, any>) => string;
  actionApprovalToken?: (a: Record<string, any>) => string;
  approveAction?: (i: number) => Promise<void>;
  confirmApproveAction?: (id: unknown, token: unknown) => void;
  returnAction?: (i: number) => Promise<void>;
  confirmReturnAction?: (id: unknown, token: unknown) => void;
  actionCanEscalate?: (a: Record<string, any>) => boolean;
  escalateAction?: (i: number) => Promise<void>;
  actionCanReopen?: (a: Record<string, any>) => boolean;
  reopenAction?: (i: number) => Promise<void>;
  confirmReopenAction?: (i: number) => void;
  actionReviewButtons?: (i: number, a: Record<string, any>) => string;
  actionSideChips?: (a: Record<string, any>, stage: string) => string;
  actionDetailCheck?: (label: string, status: unknown, note: unknown) => string;
  actionEvidenceTimelineHtml?: (a: Record<string, any>, rr: unknown) => string;
  actionRerunEvidenceHtml?: (a: Record<string, any>, rr: unknown, t: unknown) => string;
  openActionQcEvidence?: (tid: unknown, level: unknown, pointId: unknown, date: unknown, lot: unknown) => void;
  viewActionDetail?: (i: number) => void;
  openActionGuide?: () => void;
  groupIssuesByTestDate?: (issues: Record<string, any>[]) => Record<string, any>[];
  issueRowHtml?: (o: Record<string, any>) => string;
  actionViolationInfo?: (a: Record<string, any>) => Record<string, any>;
  actionQcVerdictLabel?: (a: Record<string, any>) => string;
  openActionIssueHtml?: (a: Record<string, any>, idx: number) => string;
  actionIssueGroupHtml?: (model: Record<string, any>) => string;
  pageActionsV4?: () => string;
  sgZone?: (s: unknown) => string;
  sgFmtDPMO?: (n: unknown) => string;
  sgData?: (tid: string) => Record<string, any>[];
  sgInputValue?: (v: unknown) => string;
  sgInputDisplayValue?: (v: unknown, digits?: number) => string;
  sgCleanCell?: (field: string, val: unknown) => unknown;
  sgBiasVal?: (L: Record<string, any>) => number | undefined;
  sgIsAutoCV?: (L: Record<string, any>) => boolean;
  sgReadiness?: (L: Record<string, any>) => Record<string, any>;
  sgBiasRefU?: (rounds: Record<string, any>[]) => number | null;
  sgMuBiasMode?: (L: Record<string, any>) => string;
  sgMU?: (t: unknown, e: unknown, level: unknown, tea?: unknown, refs?: Record<string, any>[]) => Record<string, any>;
  sgComp?: (t: unknown, e: unknown, level: unknown, refs?: Record<string, any>[]) => Record<string, any> | null;
  sgRows?: (t: unknown, data: Record<string, any>[], levels: unknown[]) => Record<string, any>[];
  sgSyncCurrentPeriodTea?: (t: Record<string, any>) => Record<string, any>;
  sgReconcileAllTeaSnapshots?: () => void;
  sgSetTea?: (v: unknown) => void;
  sgSetTeaSource?: (v: unknown) => void;
  sgSetTeaMeta?: (field: string, val: unknown) => void;
  sgRefreshSoon?: () => void;
  sgTrackedTests?: () => Record<string, any>[];
  sgTrackedOptions?: (tests: Record<string, any>[], selectedId: unknown) => string;
  sgHistoricalLevels?: (t: Record<string, any>) => unknown[];
  sgVisibleLevels?: (t: Record<string, any>) => unknown[];
  sgPeriodLevels?: (t: Record<string, any>, e: Record<string, any>) => unknown[];
  sgPickTest?: (v: unknown) => void;
  sgStatusPeriodId?: (tid: string, data: Record<string, any>[]) => string | undefined;
  sgSelectPeriod?: (eid: string) => void;
  sgRemoveTracked?: (id: unknown) => void;
  sgOpenAddTest?: () => void;
  sgAddTestSearchSet?: (v: unknown) => void;
  sgViewTrackedTest?: (id: unknown) => void;
  sgRenderAddTestModal?: () => void;
  sgTrackTest?: (id: unknown) => void;
  pageSigma?: () => string;
  sgOpSpecCell?: (spec: Record<string, any>) => string;
  sgFrequencyHTML?: (t: unknown, selectedRow: unknown, levels: unknown[]) => string;
  sgMuDominant?: (mu: Record<string, any>) => string;
  sgMuStateChip?: (mu: Record<string, any>) => string;
  sgMuHTML?: (t: unknown, row: unknown, levels: unknown[]) => string;
  sgRefresh?: () => void;
  sgTips?: (t: unknown, r: unknown, lvl: unknown) => string;
  sgPointTipShow?: (event: Record<string, any>, html: string) => void;
  sgPointTipHide?: () => void;
  sgTrendSVG?: (t: unknown, valid: Record<string, any>[], levels: unknown[]) => string;
  sgMDCSVG?: (t: unknown, valid: Record<string, any>[], levels: unknown[]) => string;
  sgBiasRowsFromDom?: () => Record<string, any>[];
  sgBiasPeriodsFromDom?: () => string[];
  sgBiasStats?: (rounds: Record<string, any>[]) => Record<string, any>;
  sgBiasRoundsKey?: (rounds: Record<string, any>[]) => string;
  sgBiasLinkedPeriodIds?: (data: Record<string, any>[], eid: string, level: unknown) => string[];
  sgOpenBias?: (eid: string, level: unknown) => void;
  sgRenderBiasModal?: () => void;
  sgBiasUpdateSummary?: () => void;
  sgBiasSelectPeriods?: (checked: boolean) => void;
  sgBiasAdd?: () => void;
  sgBiasDel?: (i: number) => void;
  sgApplyBiasToPeriods?: (data: Record<string, any>[], periodIds: string[], level: unknown, bias: number, rounds: Record<string, any>[], batchId?: string) => number;
  sgBiasApply?: () => Promise<void>;
  sgMuRowsFromDom?: () => Record<string, any>[];
  sgMuPeriodsFromDom?: () => string[];
  sgMuCaptureDom?: () => void;
  sgMuPreview?: (level: unknown) => Record<string, any> | null;
  sgMuUpdatePreview?: () => void;
  sgOpenMU?: (eid: string) => void;
  sgRenderMuModal?: () => void;
  sgMuSelectPeriods?: (checked: boolean) => void;
  sgMuApply?: () => Promise<void>;
  sgCell?: (eid: string, level: unknown, field: string, val: unknown) => void;
  sgPeriodSel?: (e: Record<string, any>, ro: string) => string;
  sgPart?: (eid: string, part: string, val: unknown) => Promise<void>;
  sgAddPeriod?: () => Promise<void>;
  sgDelPeriod?: (eid: string) => void;
  sgClearImportedCV?: (L: Record<string, any>) => unknown;
  sgCohortCutoff?: (period: unknown) => unknown;
  sgCohortGroups?: (t: unknown, e: unknown) => Record<string, any>[];
  sgCohortStatusText?: (a: Record<string, any>) => string;
  sgImportCohort?: (t: unknown, e: unknown, level: unknown, cohort: Record<string, any>) => unknown;
  sgApplyCohortChoices?: (t: unknown, e: unknown, groups: Record<string, any>[], choices: Record<string, any>) => Record<string, any>;
  sgCohortImportMessage?: (e: Record<string, any>, s: Record<string, any>) => string;
  sgRenderCohortModal?: () => void;
  sgCohortClose?: () => void;
  sgCohortApply?: () => Promise<void>;
  sgPullCV?: (eid?: string) => Promise<void>;
  PeriodService: PeriodServiceApi;
  qcPointWarnings?: (test: Record<string, any>, config: Record<string, any>, date: string,
    runId: string, value: number) => string[];
  ReagentComparisonService: ReagentComparisonServiceApi;
  reagentReportPresentation: typeof reagentReportPresentation;
  reagentChartPresentation: typeof reagentChartPresentation;
  reagentReportItemPresentation: typeof reagentReportItemPresentation;
  reagentComparisonLabelPresentation: typeof reagentComparisonLabelPresentation;
  reagentQuickLabelPresentation: typeof reagentQuickLabelPresentation;
  reagentToolIconPresentation: typeof reagentToolIconPresentation;
  reagentQuickPickerModalPresentation: typeof reagentQuickPickerModalHtml;
  reagentPickerModalPresentation: typeof reagentPickerModalHtml;
  reagentCreateModalPresentation: typeof reagentCreateModalHtml;
  reagentEmptyPageHtml: typeof reagentEmptyPageHtml;
  reagentToolbarHtml: typeof reagentToolbarHtml;
  reagentPairPanelHtml: typeof reagentPairPanelHtml;
  reagentInfoPanelHtml: typeof reagentInfoPanelHtml;
  reagentChartsPanelHtml: typeof reagentChartsPanelHtml;
  reagentResultsPanelsHtml: typeof reagentResultsPanelsHtml;
  reagentChartAxis: typeof reagentChartAxis;
  reagentScatterSvg: typeof reagentScatterSvg;
  reagentBlandSvg: typeof reagentBlandSvg;
  reagentQuickPickerRowsHtml: typeof reagentQuickPickerRowsHtml;
  reagentPickerRowsHtml: typeof reagentPickerRowsHtml;
  reagentCreateReferenceRowsHtml: typeof reagentCreateReferenceRowsHtml;
  reagentCreateTypedRowHtml: typeof reagentCreateTypedRowHtml;
  reagentReportDetailCardHtml: typeof reagentReportDetailCardHtml;
  reagentReportChartGridHtml: typeof reagentReportChartGridHtml;
  reagentPairMath: typeof reagentPairMath;
  reagentComparisonCalculator: ReturnType<typeof createReagentComparisonCalculator>;
  SigmaCohortService: SigmaCohortServiceApi;
  SigmaPresentation: SigmaPresentation;
  SigmaPeriodViewModel?: SigmaPeriodViewModel;
  SigmaBiasService: SigmaBiasService;
  SigmaCohortImportService: SigmaCohortImportService;
  SigmaPeriodRecordService: SigmaPeriodRecordService;
  SigmaLevelEditService: SigmaLevelEditService;
  SigmaTrackedTestService: SigmaTrackedTestService;
  SigmaBiasWorkflowService: SigmaBiasWorkflowService;
  SigmaMuWorkflowService: SigmaMuWorkflowService;
  SigmaMuWorkflowCommand: SigmaMuWorkflowCommand;
  SigmaCohortSelectionService: SigmaCohortSelectionService;
  SigmaTeaEditService: SigmaTeaEditService;
  SigmaTeaSnapshotService: SigmaTeaSnapshotService;
  SigmaLevelSelectionService: SigmaLevelSelectionService;
  SigmaPeriodSelectionService: SigmaPeriodSelectionService;
  SigmaTeaResolution?: SigmaTeaResolution;
  SG_TEA_SOURCES?: [string, string][];
  SG_CLIA_FIXED?: Record<string, { absolute: number; unit: string }>;
  teaRefName?: (v: unknown) => string;
  teaRefIsDefault?: (value: unknown) => boolean;
  testDisplayName?: (t: Record<string, any>) => string;
  sgUnitKey?: (v: unknown) => string;
  sgUnitsMatch?: (a: unknown, b: unknown) => boolean;
  sgTeaSourceMeta?: (t: Record<string, any>, src?: string) => Record<string, any>;
  effectiveTeaRefs?: () => Record<string, any>[];
  sgRef?: (t: Record<string, any>, refs?: Record<string, any>[]) => Record<string, any>;
  sgTeaSource?: (t: Record<string, any>) => string;
  sgTeaInfo?: (t: Record<string, any>, src: string, target?: unknown, refs?: Record<string, any>[]) => Record<string, any>;
  sgTeaBySource?: (t: Record<string, any>, src: string, target?: unknown, refs?: Record<string, any>[]) => number;
  sgTea?: (t: Record<string, any>) => number;
  sgTeaCriterionText?: (t: Record<string, any>, src?: string) => string;
  sgTeaLabel?: (src: string) => string;
  sgTeaRefText?: (t: Record<string, any>) => string;
  sgTeaSnapshot?: (t: Record<string, any>) => Record<string, any>;
  sgEnsureTeaSnapshot?: (t: Record<string, any>, e: Record<string, any>) => Record<string, any>;
  sgLevelTarget?: (t: Record<string, any>, L: Record<string, any>, level: unknown) => number | null;
  sgSetLevelTeaSnapshot?: (t: Record<string, any>, e: Record<string, any>, level: unknown, force?: boolean) => Record<string, any>;
  sgEntryTea?: (t: Record<string, any>, e: Record<string, any>, level: unknown, refs?: Record<string, any>[]) => number;
  WestgardViewModel?: WestgardViewModelApi;
  westgardRowsWindow?: typeof westgardRowsWindow;
  westgardXlsxRows: WestgardXlsxRows;
  westgardXlsxHeader: typeof createWestgardXlsxHeader;
  westgardArchivedGroups?: typeof westgardArchivedGroups;
  westgardArchivedMultiViews?: typeof westgardArchivedMultiViews;
  westgardArchivedGroupMatches?: typeof westgardArchivedGroupMatches;
  westgardArchivedTestSelection?: typeof westgardArchivedTestSelection;
  LISClientService?: LisClientApi;
  AuditService?: AuditServiceApi;
  ACTIVITY_HARD_CAP?: number;
  ACTIVITY_ROTATE_TO?: number;
  AUDIT_AUTO_VERIFY_MAX?: number;
  auditEntryHash?: (entry: Record<string, any>) => string;
  auditVerifyChain?: (activity?: Record<string, any>[], anchor?: string) => Record<string, any>;
  auditActor?: () => { user: string; username: string; userId: string; role: string; clientId: string };
  auditChainStatus?: (force?: boolean) => Record<string, any>;
  logAct: (action: string, detail: string, target?: string) => void;
  auditSha256: (text: string) => string;
  auditRelinkChain: (entries: Record<string, any>[], anchor?: string) => Record<string, any>[];
  auditVerifyChainNow?: () => void;
  auditLastHashOf?: (activity?: Record<string, any>[]) => string;
  auditArchiveCut?: (activity: Record<string, any>[], cutoffIso: unknown) => { segment: Record<string, any>[]; retained: Record<string, any>[]; tipHash: string };
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
  lisGatewayConfig?: LisClientApi['gatewayConfig'];
  lisNormalizeGatewayUrl?: LisClientApi['normalizeGatewayUrl'];
  lisGatewayStatusText?: LisClientApi['statusText'];
  lisGatewayPull?: LisClientApi['pull'];
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
  syncedShape?: typeof syncedShape; syncedStatesEqual?: typeof syncedStatesEqual;
  syncStateMerge?: ReturnType<typeof createSyncStateMerge>;
  syncUpdateBuilder?: ReturnType<typeof createSyncUpdateBuilder>;
  syncRetryScheduler?: ReturnType<typeof createSyncRetryScheduler>;
  syncFirstConnectMerge?: ReturnType<typeof createFirstConnectMerge>;
  syncHasContent?: typeof hasSyncContent;
  syncCompareKeys?: string[];
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
  indexedDbMirrorService?: ReturnType<typeof createIndexedDbMirrorService>;
  saveService?: ReturnType<typeof createSaveService>;
  localStoreService?: LocalStoreApi;
  LocalStore?: LocalStoreApi;
  storageSnapshotService?: StorageSnapshotService;
  storageLifecycleService?: StorageLifecycleApi;
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
  settingsStorageUsageText: typeof storageUsageTextTs;
  settingsBrandProfile: ReturnType<typeof createBrandProfile>;
  settingsFirebaseAclHelp: typeof firebaseAclHelpTs;
  settingsFirebaseRulesText: typeof firebaseRulesTextTs;
  settingsFirebaseGuideHtml: typeof firebaseGuideHtmlTs;
  backupReminderService: ReturnType<typeof createBackupReminder>;
  backupLocalMarker: ReturnType<typeof createBackupLocalMarker>;
  backupInspectionSummary: ReturnType<typeof createBackupInspectionSummary>;
  backupInspectionMessage: ReturnType<typeof createBackupInspectionMessage>;
  backupFileName: ReturnType<typeof createBackupFileName>;
  backupSnapshotFileName: ReturnType<typeof createBackupSnapshotFileName>;
  backupSizeConfirmation: ReturnType<typeof createBackupSizeConfirmation>;
  backupSizeWarningConfirmation: ReturnType<typeof createBackupSizeWarningConfirmation>;
  backupExportMessage: ReturnType<typeof createBackupExportMessage>;
  backupImportConfirmation: ReturnType<typeof createBackupImportConfirmation>;
  backupImportMessage: ReturnType<typeof createBackupImportMessage>;
  backupOversizeConfirmation: ReturnType<typeof createBackupOversizeConfirmation>;
  BackupRestoreCommand: BackupRestoreCommand;
  BackupExportCommand: BackupExportCommand;
  BackupImportCommand: BackupImportCommand;
  BackupInspectionCommand: BackupInspectionCommand;
  BackupStatusCommand: BackupStatusCommand;
  confirmOversizedBackup: (size: number, opts: {title: string; detail: any}) => Promise<boolean>;
  exportData: () => Promise<void>;
  downloadBackupText: (name: string, json: string) => boolean;
  backupCurrentData: (prefix?: string) => Promise<boolean>;
  importData: (e: any) => Promise<void>;
  verifyBackupFile: (e: any) => Promise<void>;
  markBackupDone: (bytes: number) => void;
  backupStatusText: () => string;
  backupCapacityText: () => string;
  updateBackupBanner: () => void;
  ResetOperationalDataCommand: ResetOperationalDataCommand;
   LoginWorkflowCommand: LoginWorkflowCommand;
   RequiredPasswordWorkflowCommand: RequiredPasswordWorkflowCommand;
   AdminBootstrapCommand: AdminBootstrapCommand;
   UserLifecycleCommand: UserLifecycleCommand;
   ActivityArchiveCommand: ActivityArchiveCommand;
  lisQueuePresentation: ReturnType<typeof createLisQueuePresentation>;
  lisSettingsService: ReturnType<typeof createLisSettingsService>;
  LisGatewayCommand: LisGatewayCommand;
  lisGatewaySaveSettings: ReturnType<typeof createLisQueueController>['lisGatewaySaveSettings'];
  lisQueueValueText: ReturnType<typeof createLisQueueController>['lisQueueValueText'];
  lisOnclick: ReturnType<typeof createLisQueueController>['lisOnclick'];
  lisQueueRowHtml: ReturnType<typeof createLisQueueController>['lisQueueRowHtml'];
  lisQueueSectionHtml: ReturnType<typeof createLisQueueController>['lisQueueSectionHtml'];
  lisRenderQueueModal: ReturnType<typeof createLisQueueController>['lisRenderQueueModal'];
  lisOpenQueueModal: ReturnType<typeof createLisQueueController>['lisOpenQueueModal'];
  lisQueueRefresh: ReturnType<typeof createLisQueueController>['lisQueueRefresh'];
  lisQueueImport: ReturnType<typeof createLisQueueController>['lisQueueImport'];
  lisQueueReject: ReturnType<typeof createLisQueueController>['lisQueueReject'];
  SettingsProfileCommand: SettingsProfileCommand;
  SettingsFirebaseCommand: SettingsFirebaseCommand;
  firebaseSettingsService: ReturnType<typeof createFirebaseSettingsService>;
  settingsBrandPreviewHtml: ReturnType<typeof createBrandPreviewHtml>;
  settingsUnitProfileHtml: ReturnType<typeof createUnitProfileHtml>;
  settingsBrandPanelHtml: ReturnType<typeof createBrandPanelHtml>;
  settingsAdminToolsHtml: ReturnType<typeof createAdminToolsHtml>;
  settingsFirebaseRulesPanelHtml: ReturnType<typeof createFirebaseRulesPanelHtml>;
  settingsLisGatewayPanelHtml: ReturnType<typeof createLisGatewayPanelHtml>;
  settingsFirebaseConnectionPanelHtml: ReturnType<typeof createFirebaseConnectionPanelHtml>;
  settingsPageLayoutHtml: ReturnType<typeof createSettingsPageLayoutHtml>;
  checkStorageUsage: ReturnType<typeof createSettingsPageController>['checkStorageUsage'];
  saveLab: ReturnType<typeof createSettingsPageController>['saveLab'];
  ensureLabBrandShape: ReturnType<typeof createSettingsPageController>['ensureLabBrandShape'];
  saveBrand: ReturnType<typeof createSettingsPageController>['saveBrand'];
  readBrandInputs: ReturnType<typeof createSettingsPageController>['readBrandInputs'];
  pickLogo: ReturnType<typeof createSettingsPageController>['pickLogo'];
  clearLogo: ReturnType<typeof createSettingsPageController>['clearLogo'];
  saveFb: ReturnType<typeof createSettingsPageController>['saveFb'];
  clearFb: ReturnType<typeof createSettingsPageController>['clearFb'];
  copyFirebaseRules: ReturnType<typeof createSettingsPageController>['copyFirebaseRules'];
  pageSettings: ReturnType<typeof createSettingsPageController>['pageSettings'];
  partitionedIndexedDbWriteService?: ReturnType<typeof createPartitionedIndexedDbWriteService>;
  partitionedIndexedDbReadService?: ReturnType<typeof createPartitionedIndexedDbReadService>;
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
  activityAuditFilter: ReturnType<typeof createActivityAuditFilter>;
  activityAuditPageHtml: ReturnType<typeof createActivityAuditPageHtml>;
  activityAuditPagination: typeof activityAuditPagination;
  activityAuditCsv: ReturnType<typeof createActivityAuditCsv>;
  updateActivityAuditDateRange: typeof updateActivityAuditDateRange;
  activityAuditFilterState: typeof activityAuditFilterState;
  activityAuditPageSizes: typeof ACTIVITY_AUDIT_PAGE_SIZES;
  activityAuditArchiveWindow?: typeof activityAuditArchiveWindow;
  activityAuditArchiveModalHtml: typeof activityAuditArchiveModalHtml;
  activityAuditRowHtml: typeof activityAuditRowHtml;
  userListModel: typeof userListModel;
  userRowHtml: ReturnType<typeof createUserRowHtml>;
  usersPageHtml: ReturnType<typeof createUsersPageHtml>;
  // Retire classic users-auth.js (2026-08-20, Pha G nhóm C lát 2) — Users/Audit/Auth pages.
  AUDIT_PAGE_SIZES: typeof ACTIVITY_AUDIT_PAGE_SIZES;
  pageUsers: () => string;
  auditDateKey: (activity: Record<string, any>) => string;
  auditFilteredActivities: (items?: Record<string, any>[]) => Record<string, any>[];
  auditSetQuery: (value: string) => void;
  auditSetDate: (field: string, value: string) => void;
  auditSetPageSize: (value: unknown) => void;
  auditSetPage: (value: unknown) => void;
  auditClearFilters: () => void;
  pageAudit: () => string;
  activityCSVRows: (items: Record<string, any>[]) => unknown[][];
  exportActivityCSV: () => void;
  archiveActivityLog: () => void;
  confirmArchiveActivityLog: () => Promise<void>;
  addUser: () => Promise<void>;
  userPermChecks: (selectedIds: string[] | null | undefined, groupId: string, roleValue: string) => string;
  syncUserPermChecks: (groupId: string, roleValue: string) => void;
  collectUserPerms: (groupId: string, roleValue: string) => Promise<string[] | null>;
  openUserPerms: (id: string) => Promise<void>;
  applyUserPerms: (id: string) => Promise<void>;
  resetPass: (id: string) => void;
  applyResetPass: (id: string) => Promise<void>;
  toggleUser: (id: string) => void;
  delUser: (id: string) => Promise<void>;
  passwordError: (password: string) => string;
  legacyHashPass: (password: string) => Promise<string>;
  hashPass: (password: string) => Promise<string>;
  verifyPass: (password: string, stored: string) => Promise<boolean>;
  confirmReauthentication: () => Promise<void>;
  reauthenticateCurrentUser: (options?: { title?: string; message?: string }) => Promise<boolean>;
  ensureAdmin: () => Promise<void>;
  blankAppState: (users: unknown) => Record<string, any>;
  resetAllData: () => Promise<void>;
  downloadStartupData: () => void;
  resetStartupData: () => Promise<void>;
  authBrandMark: () => string;
  showStartupRecovery: () => void;
  showLogin: (msg?: string) => void;
  focusLoginField: () => void;
  persistLoginLockout: () => void;
  doLogin: () => Promise<void>;
  showPasswordChange: (msg?: string) => void;
  changeRequiredPassword: () => Promise<void>;
  logout: () => void;
  showApp: () => void;
  reagentSelectOptionsHtml: ReturnType<typeof createReagentSelectOptionsHtml>;
  reagentResultHtml: ReturnType<typeof createReagentResultHtml>;
  reagentPairRowHtml: ReturnType<typeof createReagentPairRowHtml>;
  qcValueFormat?: ReturnType<typeof createQcValueFormat>;
  qcStaffIdentity?: ReturnType<typeof createQcStaffIdentity>;
  qcDateFormat?: ReturnType<typeof createQcDateFormat>;
  qcLotTargetHistory?: ReturnType<typeof createLotTargetHistory>;
  teaAnalyteMetaService?: ReturnType<typeof createTeaAnalyteMeta>;
  qcLevelReconciliation?: ReturnType<typeof createQcLevelReconciliation>;
  qcRangeLimitRepair?: ReturnType<typeof createRangeLimitRepair>;
  derivedCacheInvalidation?: ReturnType<typeof createDerivedCacheInvalidation>;
  installDerivedCacheInvalidation?: (legacy: Record<string, unknown>) => ReturnType<typeof createDerivedCacheInvalidation>;
  qcConfigurationRelations?: typeof reconcileConfigurationRelations;
  qcTestConfiguration?: typeof normalizeTestConfiguration;
  qcStateFoundation?: typeof normalizeStateFoundation;
  qcStateLifecycle?: typeof normalizeStateLifecycle;
  csvDownload?: ReturnType<typeof createCsvDownload>;
  cssTokenPixel?: typeof cssTokenPixel;
  canvasFont: ReturnType<typeof createChartCanvasFont>;
  chartDataUrl: ReturnType<typeof createChartDataUrl>;
  afterRenderCanvasService: ReturnType<typeof createVisibleCanvasService>;
  afterRender: ReturnType<typeof createAfterRenderController>['afterRender'];
  routerPagePolicy: ReturnType<typeof createRouterPagePolicy>;
  routerShell: ReturnType<typeof createRouterShellController>;
  PAGES: [string, string][];
  role: ReturnType<typeof createRouterPermission>['role'];
  canWrite: ReturnType<typeof createRouterPermission>['canWrite'];
  requireWrite: ReturnType<typeof createRouterPermission>['requireWrite'];
  requireAdmin: ReturnType<typeof createRouterPermission>['requireAdmin'];
  roleLabel: ReturnType<typeof createRouterPermission>['roleLabel'];
  roleSelectOptions: ReturnType<typeof createRouterPermission>['roleSelectOptions'];
  rolePageIds: (role?: string) => string[];
  userPageIds: (user?: any) => string[];
  canAccessPage: (id: string, user?: any) => boolean;
  firstAccessPage: (user?: any) => string;
  icon: typeof icon;
  icoCal: typeof icoCal;
  icoDownload: typeof icoDownload;
  icoPrint: typeof icoPrint;
  icoRefArrow: typeof icoRefArrow;
  setSearchCount: ReturnType<typeof createLiveRowFilter>['setSearchCount'];
  showSearchEmpty: ReturnType<typeof createLiveRowFilter>['showSearchEmpty'];
  replaceSelectItems: ReturnType<typeof createLiveRowFilter>['replaceSelectItems'];
  liveRowFilter: ReturnType<typeof createLiveRowFilter>['liveRowFilter'];
  scheduleSearchRender: ReturnType<typeof createLiveRowFilter>['scheduleSearchRender'];
  dateBox: ReturnType<typeof createDateBoxHtml>;
  rangeActions: ReturnType<typeof createRangeActionsHtml>;
  btn: ReturnType<typeof createUiPrimitives>['btn'];
  emptyState: ReturnType<typeof createUiPrimitives>['emptyState'];
  topUserBox: ReturnType<typeof createUiPrimitives>['topUserBox'];
  headOnly: ReturnType<typeof createUiPrimitives>['headOnly'];
  brandTitle: () => string;
  brandSub: () => string;
  brandMarkText: () => string;
  brandLogo: () => string;
  renderBrand: () => void;
  nav: () => void;
  licensedLabName: () => string;
  trialInfo: () => any;
  sideFoot: () => void;
  toggleSidebarNav: () => void;
  vnPickerParse: (value: unknown) => string;
  vnPickerValid: (year: any, month: any, day: any) => string;
  vnPickerText: (iso: any) => string;
  vnPickerOpen: (datebox: any) => void;
  vnPickerClose: () => void;
  vnPickerMove: (months: number) => void;
  vnPickerMode: (mode: string) => void;
  vnPickerSetYear: (year: any) => void;
  vnPickerSetMonth: (month: number) => void;
  vnPickerPick: (iso: string) => void;
  stateName: (value: string) => string;
  qcVerdictLabel: (value: string) => string;
  page: string;
  go: ReturnType<typeof createRouterDispatchController>['go'];
  resetMainScroll: ReturnType<typeof createRouterDispatchController>['resetMainScroll'];
  render: ReturnType<typeof createRouterDispatchController>['render'];
  restoreRouteFilters: ReturnType<typeof createRouterDispatchController>['restoreRouteFilters'];
  rerender: ReturnType<typeof createRouterDispatchController>['rerender'];
  modalTemplate: ReturnType<typeof createModalTemplate>['modalTemplate'];
  modalCloseButton: ReturnType<typeof createModalTemplate>['modalCloseButton'];
  openModal: ReturnType<typeof createModalController>['openModal'];
  closeModal: ReturnType<typeof createModalController>['closeModal'];
  modalKeydown: ReturnType<typeof createModalController>['modalKeydown'];
  openDialogOverlay: ReturnType<typeof createDialogOverlayController>['openDialogOverlay'];
  closeDialogOverlay: ReturnType<typeof createDialogOverlayController>['closeDialogOverlay'];
  dialogKeydown: ReturnType<typeof createDialogOverlayController>['dialogKeydown'];
  confirmDialog: ReturnType<typeof createDialogOverlayController>['confirmDialog'];
  confirmDialogAnswer: ReturnType<typeof createDialogOverlayController>['confirmDialogAnswer'];
  infoDialog: ReturnType<typeof createDialogOverlayController>['infoDialog'];
  infoDialogAnswer: ReturnType<typeof createDialogOverlayController>['infoDialogAnswer'];
  vnDatePickerController: ReturnType<typeof createVnDatePickerController>;
  qcTooltip: ReturnType<typeof createChartTooltipService>;
  leveyJenningsTooltipController: ReturnType<typeof createLeveyJenningsTooltipController>;
  hiDpiCanvasSetup: ReturnType<typeof createHiDpiCanvasSetup>;
  leveyJenningsGeometry: typeof leveyJenningsGeometry;
  westgardRuleScope: ReturnType<typeof createWestgardRuleScope>;
  leveyJenningsColors: typeof LEVEY_JENNINGS_COLORS;
  leveyJenningsTicks: ReturnType<typeof createLeveyJenningsTicks>;
  leveyJenningsYAxisLabels: ReturnType<typeof createLeveyJenningsYAxisLabels>;
  leveyJenningsPointRenderModel: ReturnType<typeof createLeveyJenningsPointRenderModel>;
  leveyJenningsBandRects: typeof leveyJenningsBandRects;
  leveyJenningsGridLines: typeof leveyJenningsGridLines;
  leveyJenningsMultiSeries: typeof leveyJenningsMultiSeries;
  leveyJenningsMultiRunTicks: ReturnType<typeof createLeveyJenningsMultiRunTicks>;
  leveyJenningsLegendLayout: (levels:any[],colors:string[],startX:number,measure:(text:string)=>{width:number})=>ReturnType<ReturnType<typeof createLeveyJenningsLegendLayout>>;
  leveyJenningsMultiPointRenderModel: ReturnType<typeof createLeveyJenningsMultiPointRenderModel>;
  leveyJenningsMultiDividers: typeof leveyJenningsMultiDividers;
  cusumChartGeometry: typeof cusumChartGeometry;
  cusumPointRenderModel: typeof cusumPointRenderModel;
  cusumReferenceLines: typeof cusumReferenceLines;
  cusumLinePoints: typeof cusumLinePoints;
  cusumDisplayPlan: ReturnType<typeof createCusumDisplayPlan>;
  cusumHoverModel: ReturnType<typeof createCusumHoverModel>;
  drawLJ: ReturnType<typeof createQcChartRenderer>['drawLJ'];
  ljDataURL: ReturnType<typeof createQcChartRenderer>['ljDataURL'];
  drawLJMultiZ: ReturnType<typeof createQcChartRenderer>['drawLJMultiZ'];
  ljMultiDataURL: ReturnType<typeof createQcChartRenderer>['ljMultiDataURL'];
  drawCUSUM: ReturnType<typeof createQcChartRenderer>['drawCUSUM'];
  blobDownload?: ReturnType<typeof createBlobDownload>;
  qcReportCsvRows?: ReturnType<typeof createQcReportCsvRows>;
  nceCsvRow?: ReturnType<typeof createActionCsvRow>;
  sigmaCanvasFactory: ReturnType<typeof createSigmaCanvas>;
  sigmaChartRenderer: ReturnType<typeof createSigmaChartRenderer>;
  sigmaMdcRenderer: ReturnType<typeof createSigmaMdcRenderer>;
  renameSigmaXlsxSheet: typeof renameXlsxSheet;
  xlsxCells: ReturnType<typeof createXlsxCells>;
  xlsxZip: ReturnType<typeof createXlsxZip>;
  xlsxPeriodNumber: typeof xlsxPeriodNumber;
  xlsxDrawing: ReturnType<typeof createXlsxDrawing>;
  sigmaXlsxStyles: typeof sigmaXlsxStyles;
  reportXlsxStyles: typeof reportXlsxStyles;
  reportXlsxDrawing: ReturnType<typeof createReportXlsxDrawing>;
  reportXlsxSheet: ReturnType<typeof createReportXlsxSheet>;
  reportXlsxBuild: ReturnType<typeof createReportXlsxBuilder>;
  reportXlsxHeader: typeof createReportXlsxHeader;
  reportHeaderPresentation: typeof reportHeaderPresentation;
  reportNceAppendixPresentation: ReportNceAppendixApi;
  reportSignBlock: typeof reportSignBlock;
  reportLockListHtmlPresentation: ReturnType<typeof createReportLockListHtml<any>>;
  reportUnlockReason?: ReturnType<typeof createReportUnlockReason>;
  reportUnlockModalHtml: typeof reportUnlockModalHtml;
  reportLockPicker: typeof reportLockPicker;
  reportLockPanelHtmlPresentation: ReturnType<typeof createReportLockPanelHtml>;
  reportPageHtml: ReturnType<typeof createReportPageHtml>;
  reportRangePickerHtml: ReturnType<typeof createReportRangePickerHtml>;
  reportLockYmValue: ReturnType<typeof createReportPageController>['reportLockYmValue'];
  reportSetLockPart: ReturnType<typeof createReportPageController>['reportSetLockPart'];
  reportLockPeriod: ReturnType<typeof createReportPageController>['reportLockPeriod'];
  reportUnlockPeriod: ReturnType<typeof createReportPageController>['reportUnlockPeriod'];
  reportConfirmUnlockPeriod: ReturnType<typeof createReportPageController>['reportConfirmUnlockPeriod'];
  reportLockListHtml: ReturnType<typeof createReportPageController>['reportLockListHtml'];
  reportSearchValues: ReturnType<typeof createReportPageController>['reportSearchValues'];
  reportSearchSet: ReturnType<typeof createReportPageController>['reportSearchSet'];
  reportApplySearch: ReturnType<typeof createReportPageController>['reportApplySearch'];
  reportRangeDefaults: ReturnType<typeof createReportPageController>['reportRangeDefaults'];
  reportDateRange: ReturnType<typeof createReportPageController>['reportDateRange'];
  reportExportSelection: ReturnType<typeof createReportPageController>['reportExportSelection'];
  reportRangeChanged: ReturnType<typeof createReportPageController>['reportRangeChanged'];
  reportRangeText: ReturnType<typeof createReportPageController>['reportRangeText'];
  reportActionIcon: ReturnType<typeof createReportPageController>['reportActionIcon'];
  reportLockPanelHtml: ReturnType<typeof createReportPageController>['reportLockPanelHtml'];
  pageReportV2: ReturnType<typeof createReportPageController>['pageReportV2'];
  reportRangePicker: ReturnType<typeof createReportPageController>['reportRangePicker'];
  ReportPeriodWorkflowCommand: ReportPeriodWorkflowCommand;
  dashboardLoadingPresentation: ReturnType<typeof createDashboardLoading>;
  dashboardStatusFilter: ReturnType<typeof createDashboardStatusFilter>;
  dashboardExpiringLots: typeof dashboardExpiringLots;
  dashboardShiftStatus: typeof dashboardShiftStatus;
  dashboardKpis: typeof dashboardKpis;
  reportQcFormat: ReturnType<typeof createReportQcFormat>;
  qcRangeTea: ReturnType<typeof createRangeTea>;
  entryRowsWindowTs: typeof entryRowsWindowTs;
  entryLotLabelsTs: typeof entryLotLabelsTs;
  entryDayPresetButtons: typeof entryDayPresetButtons;
  entryLeveyJenningsMiniHtml: ReturnType<typeof createEntryLeveyJenningsMiniHtml>;
  entrySheetLevelHeads: ReturnType<typeof createEntrySheetLevelHeads>;
  entryTreeHeaderHtml: ReturnType<typeof createEntryTreeHeaderHtml>;
  entryTreeItemHtml: ReturnType<typeof createEntryTreeItemHtml>;
  entryRangeSummaryHtml: typeof entryRangeSummaryHtml;
  entryWorksheetHtml: typeof entryWorksheetHtml;
  entryLeveyPanelHtml: typeof entryLeveyPanelHtml;
  entryPageLayoutHtml: typeof entryPageLayoutHtml;
  entryVoidedPointsHtml: typeof entryVoidedPointsHtml;
  entryPointsPanelHtml: typeof entryPointsPanelHtml;
  entryCumulativeStatsHtml: typeof entryCumulativeStatsHtml;
  entryTableWindowNoteHtml: typeof entryTableWindowNoteHtml;
  entryPointTableCardHtml: typeof entryPointTableCardHtml;
  entryPointTableRowHtml: typeof entryPointTableRowHtml;
  entryVoidedPointRowHtml: typeof entryVoidedPointRowHtml;
  entrySheetDayRowHtml: typeof entrySheetDayRowHtml;
  entrySheetDaySummaryHtml: ReturnType<typeof createEntrySheetDaySummaryHtml>;
  entryVoidModalHtml: typeof entryVoidModalHtml;
  entryPreSaveWarningModalHtml: typeof entryPreSaveWarningModalHtml;
  entrySheetEmptyRunHtml: typeof entrySheetEmptyRunHtml;
  entrySheetSavedRunHtml: typeof entrySheetSavedRunHtml;
  entrySheetCellHtml: typeof entrySheetCellHtml;
  entrySheetAddRunHtml: typeof entrySheetAddRunHtml;
  entrySheetNoteHtml: typeof entrySheetNoteHtml;
  entryEmptyPageHtml: ReturnType<typeof createEntryEmptyPageHtml>;
  targetSwitchModalHtml: typeof targetSwitchModalHtml;
  configPanelTestRows: typeof configPanelTestRows;
  configPanelModalHtml: typeof configPanelModalHtml;
  lotTransitionChoiceHtmlPresentation: typeof lotTransitionChoiceHtmlPresentation;
  lotTransitionModalHtml: typeof lotTransitionModalHtml;
  lotTransitionTargetsHtmlPresentation: typeof lotTransitionTargetsHtmlPresentation;
  lotGroupColumnsHtml: typeof lotGroupColumnsHtml;
  lotGroupModalHtml: typeof lotGroupModalHtml;
  configLotModalHtml: typeof configLotModalHtml;
  configInstrumentModalHtml: typeof configInstrumentModalHtml;
  configAssayModalHtml: typeof configAssayModalHtml;
  qcHistoryDetailModalHtml: typeof qcHistoryDetailModalHtml;
  configAssayRuleRowsHtml: typeof configAssayRuleRowsHtml;
  configAssayTeaOptionsHtml: typeof configAssayTeaOptionsHtml;
  configAssayInstrumentOptionsHtml: typeof configAssayInstrumentOptionsHtml;
  configAssayDecimalOptionsHtml: typeof configAssayDecimalOptionsHtml;
  configPanelInstrumentOptionsHtml: typeof configPanelInstrumentOptionsHtml;
  configLotLevelOptionsHtml: typeof configLotLevelOptionsHtml;
  qcHistoryMeanSdRowsHtml: typeof qcHistoryMeanSdRowsHtml;
  qcHistoryPointRowsHtml: typeof qcHistoryPointRowsHtml;
  targetNumberTextPresentation: ReturnType<typeof createTargetNumberText>;
  targetConfigAssignedPresentation: typeof targetConfigAssignedPresentation;
  targetRangeDraftPresentation: ReturnType<typeof createTargetRangeDraft>;
  parseVnDatePresentation: typeof parseVnDate;
  targetRangeSyncPresentation: ReturnType<typeof createTargetRangeSync>;
  targetOverwritePicksPresentation: typeof targetOverwritePicks;
  lotGroupLotPillsHtml: typeof lotGroupLotPillsHtml;
  lotGroupStatusPresentation: typeof lotGroupStatusPresentation;
  lotGroupToggleActionPresentation: typeof lotGroupToggleAction;
  targetSwitchAssayNamesPresentation: typeof targetSwitchAssayNames;
  targetLockedBackfillNotePresentation: typeof targetLockedBackfillNote;
  rangeWorkflowModalHtml: typeof rangeWorkflowModalHtml;
  rangeApplyConfirmationModalHtml: typeof rangeApplyConfirmationModalHtml;
  rangeRevertConfirmationModalHtml: typeof rangeRevertConfirmationModalHtml;
  rangeSafetyGateHtml: typeof rangeSafetyGateHtml;
  rangeWorkflowChecklistRowsHtml: typeof rangeWorkflowChecklistRowsHtml;
  rangeNceNoticeHtml: typeof rangeNceNoticeHtml;
  rangeWorkflowComparisonRowsHtml: typeof rangeWorkflowComparisonRowsHtml;
  userPermissionsModalHtml: typeof userPermissionsModalHtml;
  resetPasswordModalHtml: typeof resetPasswordModalHtml;
  sigmaAddTestModalHtml: typeof sigmaAddTestModalHtml;
  sigmaAddTestRowsHtml: typeof sigmaAddTestRowsHtml;
  sigmaBiasModalHtml: typeof sigmaBiasModalHtml;
  sigmaMuModalHtml: typeof sigmaMuModalHtml;
  sigmaCohortModalHtml: typeof sigmaCohortModalHtml;
  sigmaFrequencyPanelHtml: typeof sigmaFrequencyPanelHtml;
  sigmaMuSummaryHtml: typeof sigmaMuSummaryHtml;
  sigmaStatusCardHtml: typeof sigmaStatusCardHtml;
  sigmaStatusPanelHtml: typeof sigmaStatusPanelHtml;
  sigmaOpSpecCellHtml: typeof sigmaOpSpecCellHtml;
  sigmaMuStateChipHtml: typeof sigmaMuStateChipHtml;
  sigmaMuDominantText: typeof sigmaMuDominantText;
  sigmaBiasSummaryHtml: typeof sigmaBiasSummaryHtml;
  sigmaCohortRowsHtml: typeof sigmaCohortRowsHtml;
  sigmaBiasRowsHtml: typeof sigmaBiasRowsHtml;
  sigmaMuRowsHtml: typeof sigmaMuRowsHtml;
  sigmaMuPreviewHtml: typeof sigmaMuPreviewHtml;
  sigmaTrackedOptionsHtml: typeof sigmaTrackedOptionsHtml;
  sigmaInputDisplayValue: typeof sigmaInputDisplayValue;
  sigmaGoverningRuleBlockHtml: typeof sigmaGoverningRuleBlockHtml;
  sigmaFrequencyRowsHtml: typeof sigmaFrequencyRowsHtml;
  sigmaPeriodTableHtml: typeof sigmaPeriodTableHtml;
  sigmaAnalysisSetupHtml: typeof sigmaAnalysisSetupHtml;
  sigmaPeriodRowHtml: typeof sigmaPeriodRowHtml;
  sigmaChartsPanelHtml: typeof sigmaChartsPanelHtml;
  sigmaPeriodTableHeadHtml: typeof sigmaPeriodTableHeadHtml;
  sigmaNoLevelsPanelHtml: typeof sigmaNoLevelsPanelHtml;
  actionFormClosedPresentation: typeof actionFormClosedPresentation;
  actionFormPanelPresentation: typeof actionFormPanelPresentation;
  actionImmediateStepPresentation: typeof actionImmediateStepPresentation;
  actionRiskStepPresentation: typeof actionRiskStepPresentation;
  actionInvestigationStepPresentation: typeof actionInvestigationStepPresentation;
  actionCauseStepPresentation: typeof actionCauseStepPresentation;
  actionPatientStepPresentation: typeof actionPatientStepPresentation;
  actionEffectivenessStepPresentation: typeof actionEffectivenessStepPresentation;
  actionIncidentBannerPresentation: typeof actionIncidentBannerPresentation;
  actionFormSectionPresentation: typeof actionFormSectionPresentation;
  actionInvestigationFieldPresentation: typeof actionInvestigationFieldPresentation;
  actionBiasContextPresentation: typeof actionBiasContextPresentation;
  actionLevelContextPresentation: typeof actionLevelContextPresentation;
  actionLevelLabelPresentation: typeof actionLevelLabelPresentation;
  actionSelectPresentation: typeof actionSelectPresentation;
  actionSuggestRowPresentation: typeof actionSuggestRowPresentation;
  actionSuggestBoxPresentation: typeof actionSuggestBoxPresentation;
  actionStaffOptionsPresentation: typeof actionStaffOptionsPresentation;
  actionRuleOptionsPresentation: typeof actionRuleOptionsPresentation;
  actionCausePhrasesPresentation: typeof actionCausePhrasesPresentation;
  actionPhrasesPresentation: typeof actionPhrasesPresentation;
  userPermissionChecksHtml: typeof userPermissionChecksHtml;
  userRoleSelectHtml: typeof userRoleSelectHtml;
  actionFormUiState: ActionFormUiState;
  actionFormRenderState: typeof actionFormRenderState;
  entrySheetMonthPart: typeof entrySheetMonthPart;
  entrySheetMonthValue: typeof entrySheetMonthValue;
  entryTreeState: ReturnType<typeof createEntryTreeState>;
  entrySheetNavigation: ReturnType<typeof createEntrySheetNavigation<any>>;
  entrySheetInputOrder: ReturnType<typeof createEntrySheetInputOrder<any>>;
  entryTreeGroupState: typeof entryTreeGroupState;
  entryTreeNavigation: ReturnType<typeof createEntryTreeNavigation<any>>;
  entrySheetFocus: ReturnType<typeof createEntrySheetFocus<any>>;
  entryColumnConfig: ReturnType<typeof createEntryColumnConfig>;
  entryRangePreset: typeof entryRangePreset;
  entryTreeCollapsePreference: { read: typeof readEntryTreeCollapsed; write: typeof writeEntryTreeCollapsed };
  entryTreeVisibility: typeof entryTreeVisibility;
  entryTreeKeyCommand: typeof entryTreeKeyCommand;
  entrySelectionState: typeof entrySelectionState;
  entryExpandedTablesToggle: typeof entryExpandedTablesToggle;
  entryVoidNceChoice: typeof entryVoidNceChoice;
  entryVoidReasonValid: typeof entryVoidReasonValid;
  entryRecordErrorMessage: typeof entryRecordErrorMessage;
  entrySaveFeedback: typeof entrySaveFeedback;
  entryExtraRunRequest: typeof entryExtraRunRequest;
  entryDateNoteFeedback: typeof entryDateNoteFeedback;
  entryDateNoteErrorMessage: typeof entryDateNoteErrorMessage;
  entryDateRangeInput: ReturnType<typeof createEntryDateRangeInput>;
  westgardUiState: typeof westgardUiState;
  westgardModeTabs: typeof westgardModeTabs;
  westgardTestSearch: ReturnType<typeof createWestgardTestSearch<any>>;
  westgardMultiViews: ReturnType<typeof createWestgardMultiViews<any, any>>;
  westgardCusumLevels: ReturnType<typeof createWestgardCusumLevels<any, any, any>>;
  westgardPointRowsHtml: ReturnType<typeof createWestgardPointRowsHtml<any>>;
  westgardRowsControl: ReturnType<typeof createWestgardRowsControl>;
  westgardCusumPageHtml: ReturnType<typeof createWestgardCusumPageHtml<any>>;
  westgardLotBlockHtml: ReturnType<typeof createWestgardLotBlockHtml>;
  westgardRuleGuideHtml: ReturnType<typeof createWestgardRuleGuideHtml>;
  westgardRuleTogglesHtml: ReturnType<typeof createWestgardRuleTogglesHtml>;
  westgardExportActionsHtml: ReturnType<typeof createWestgardExportActionsHtml>;
  dashboardStatusTabsHtml: ReturnType<typeof createDashboardStatusTabsHtml>;
  dashboardExpiringLotsHtml: ReturnType<typeof createDashboardExpiringLotsHtml>;
  dashboardFollowupPanelHtml: typeof dashboardFollowupPanelHtml;
  dashboardKpisHtml: typeof dashboardKpisHtml;
  dashboardProgressHtml: typeof dashboardProgressHtml;
  dashboardHeadHtml: ReturnType<typeof createDashboardHeadHtml>;
  dashboardTestPanelHtml: ReturnType<typeof createDashboardTestPanelHtml>;
  dashboardKpiItems: typeof dashboardKpiItems;
  dashboardEmptyTestsHtml: ReturnType<typeof createDashboardEmptyTestsHtml>;
  cusumColors: typeof CUSUM_COLORS;
  leveyJenningsMultiColors: typeof LEVEY_JENNINGS_MULTI_COLORS;
  cusumChartTitle: ReturnType<typeof createCusumChartTitle>;
  leveyJenningsChartTitle: typeof LEVEY_JENNINGS_CHART_TITLE;
  chartEmptyLabels: typeof CHART_EMPTY_LABELS;
  leveyJenningsMultiYAxis: typeof leveyJenningsMultiYAxis;
  leveyJenningsMultiGeometry: typeof leveyJenningsMultiGeometry;
  configNavScrollService: ReturnType<typeof createConfigNavScrollService>;
  entryJumpScrollService: ReturnType<typeof createEntryJumpScrollService>;
  defaultDateFieldsService: ReturnType<typeof createDefaultDateFieldsService>;
  postRenderPageActions: ReturnType<typeof createPostRenderPageActions>;
  dashboardOverdueActions: ReturnType<typeof createDashboardOverdueActions>;
  dashboardOverdueActionListHtml: ReturnType<typeof createDashboardOverdueActionListHtml>;
  dashboardQcFollowupListHtml: ReturnType<typeof createDashboardQcFollowupListHtml>;
  dashboardMissingTargetListHtml: ReturnType<typeof createDashboardMissingTargetListHtml>;
  dashboardExpiringLotItems: typeof dashboardExpiringLotItems;
  dashboardWestgardAlerts: typeof dashboardWestgardAlerts;
  dashboardMissingTargetItems: typeof dashboardMissingTargetItems;
  dashboardTestRowsHtml: ReturnType<typeof createDashboardTestRowsHtml>;
  dashboardTestItems: ReturnType<typeof createDashboardTestItems>;
  dashboardTestListHtml: typeof dashboardTestListHtml;
  dashboardPageHtml: ReturnType<typeof createDashboardPageHtml>;
  pageDash: ReturnType<typeof createDashboardPageController>['pageDash'];
  pageDashLoading: ReturnType<typeof createDashboardPageController>['pageDashLoading'];
  dashTestFilter: ReturnType<typeof createDashboardPageController>['dashTestFilter'];
  dashTestSetStatus: ReturnType<typeof createDashboardPageController>['dashTestSetStatus'];
  actionGuideContent: ReturnType<typeof createActionGuideContent>;
  actionPageHtml: ReturnType<typeof createActionPageHtml>;
  actionSideChipsHtml: ReturnType<typeof createActionSideChipsHtml>;
  actionDetailCheckHtml: ReturnType<typeof createActionDetailCheckHtml>;
  actionEvidenceTimelinePresentation: ReturnType<typeof createActionEvidenceTimelineHtml>;
  actionReviewButtonsHtml: ReturnType<typeof createActionReviewButtonsHtml>;
  actionRerunEvidencePresentation: ReturnType<typeof createActionRerunEvidenceHtml<any>>;
  actionIssueRowPresentation: ReturnType<typeof createActionIssueRowHtml>;
  actionOpenIssuePresentation: ReturnType<typeof createActionOpenIssueHtml>;
  actionIssueGroupPresentation: ReturnType<typeof createActionIssueGroupHtml>;
  actionLogRowPresentation: ReturnType<typeof createActionLogRowHtml>;
  actionApprovalTagPresentation: ReturnType<typeof createActionApprovalTagHtml>;
  actionDetailMetaHtml: ReturnType<typeof createActionDetailMetaHtml>;
  actionCancelledAlertHtml: ReturnType<typeof createActionCancelledAlertHtml>;
  actionCancelModalHtml: typeof actionCancelModalHtml;
  actionReviewNoteModalHtml: typeof actionReviewNoteModalHtml;
  actionReopenModalHtml: typeof actionReopenModalHtml;
  actionDetailModalHtml: typeof actionDetailModalHtml;
  actionLegacyDetailHtml: ReturnType<typeof createActionLegacyDetailHtml>;
  actionContainmentDetailHtml: ReturnType<typeof createActionContainmentDetailHtml>;
  actionInspectionDetailsHtml: ReturnType<typeof createActionInspectionDetailsHtml>;
  actionPatientImpactHtml: ReturnType<typeof createActionPatientImpactHtml>;
  actionCauseDetailHtml: ReturnType<typeof createActionCauseDetailHtml>;
  actionEffectivenessDetailHtml: ReturnType<typeof createActionEffectivenessDetailHtml>;
  actionLogPanelHtml: ReturnType<typeof createActionLogPanelHtml>;
  actionIssuesPanelHtml: typeof actionIssuesPanelHtml;
  manageToolbarPresentation: ReturnType<typeof createManageToolbarHtml>;
  managePageHtml: ReturnType<typeof createManagePageHtml>;
  manageShellPresentation: ReturnType<typeof createManageShellHtml>;
  manageInstrumentRowPresentation: ReturnType<typeof createManageInstrumentRowHtml>;
  manageInstrumentTablePresentation: typeof manageInstrumentTableHtml;
  managePanelRowPresentation: ReturnType<typeof createManagePanelRowHtml>;
  managePanelTablePresentation: typeof managePanelTableHtml;
  manageLotRowPresentation: ReturnType<typeof createManageLotRowHtml>;
  manageLotConfigLayoutPresentation: typeof manageLotConfigLayoutHtml;
  manageLotGroupCardPresentation: ReturnType<typeof createManageLotGroupCardHtml>;
  manageTransitionRowPresentation: ReturnType<typeof createManageTransitionRowHtml>;
  manageTransitionTablePresentation: typeof manageTransitionTableHtml;
  manageTransitionDetailsPresentation: typeof manageTransitionDetailsHtml;
  teaReferenceAddModalPresentation: typeof teaReferenceAddModalHtml;
  teaReferenceLabProfileBodyPresentation: typeof teaReferenceLabProfileBodyHtml;
  teaReferenceLabProfileModalHtml: typeof teaReferenceLabProfileModalHtml;
  teaReferenceRowPresentation: typeof teaReferenceRowHtml;
  teaReferenceTablePresentation: typeof teaReferenceTableHtml;
  teaSourceRegistryPresentation: ReturnType<typeof createTeaSourceRegistryHtml>;
  manageHistoryRowPresentation: ReturnType<typeof createManageHistoryRowHtml>;
  manageSearchPlaceholderPresentation: typeof manageSearchPlaceholder;
  manageAssayRowPresentation: ReturnType<typeof createManageAssayRowHtml>;
  manageAssayTablePresentation: typeof manageAssayTableHtml;
  teaReferenceStatusPresentation: typeof teaReferenceStatusHtml;
  manageTransitionStatusPresentation: typeof manageTransitionStatus;
  manageLotStatusPresentation: ReturnType<typeof createManageLotStatus>;
  manageInstrumentNamePresentation: typeof manageInstrumentName;
  manageLotLabelPresentation: typeof manageLotLabel;
  managePanelNamePresentation: typeof managePanelName;
  manageLotGroupLabelsPresentation: typeof manageLotGroupLabels;
  groupsOfLotPresentation: typeof groupsOfLotTs;
  targetGroupLotsPresentation: typeof targetGroupLotsTs;
  targetGroupLabelPresentation: typeof targetGroupLabel;
  targetGroupStatusSuffixPresentation: typeof targetGroupStatusSuffix;
  targetPanelLabelPresentation: typeof targetPanelLabel;
  targetPanelTestsPresentation: typeof targetPanelTests;
  targetPanelOptionsPresentation: typeof targetPanelOptionsHtml;
  targetGroupOptionsPresentation: typeof targetGroupOptionsHtml;
  targetSelectionPresentation: typeof targetSelection;
  targetLevelSelectionPresentation: typeof targetLevelSelection;
  historySearchValuesPresentation: typeof historySearchValues;
  teaLabBasisLabelPresentation: typeof teaLabBasisLabel;
  targetLevelLotsPresentation: typeof targetLevelLots;
  targetSearchValuesPresentation: typeof targetSearchValues;
  historyAssayOptionsPresentation: typeof historyAssayOptionsHtml;
  historyAssaySelectionPresentation: typeof historyAssaySelection;
  historyVisibleRowsPresentation: typeof historyVisibleRows;
  historyRowSortPresentation: typeof sortHistoryRows;
  historySummaryPresentation: typeof historySummary;
  teaSourceRegistryItemsPresentation: typeof teaSourceRegistryItems;
  manageSearchMatchPresentation: typeof manageSearchMatch;
  lotTransitionTargetNumberPresentation: typeof lotTransitionTargetNumber;
  historyPeriodLabelPresentation: typeof historyPeriodLabel;
  targetRowStatePresentation: typeof targetRowState;
  targetMatrixStatsPresentation: typeof targetMatrixStats;
  targetMatrixItemsPresentation: typeof targetMatrixItems;
  targetLevelTabsPresentation: typeof targetLevelTabsHtml;
  targetSummaryPresentation: typeof targetSummaryHtml;
  targetMatrixRowPresentation: typeof targetMatrixRowHtml;
  targetMatrixPanelPresentation: typeof targetMatrixPanelHtml;
  historyRowsPresentation: typeof historyRows;
  historySelectorPresentation: typeof historySelectorHtml;
  targetSelectorPresentation: typeof targetSelectorHtml;
  historyTablePresentation: typeof historyTableHtml;
  historyPanelPresentation: typeof historyPanelHtml;
  manageEmptyPanelPresentation: typeof manageEmptyPanelHtml;
  targetEmptyStatePresentation: typeof targetEmptyState;
  targetMatrixTablePresentation: typeof targetMatrixTableHtml;
  targetMatrixActionsPresentation: typeof targetMatrixActionsHtml;
  targetPrerequisitePresentation: typeof targetPrerequisite;
  targetLevelToolbarPresentation: typeof targetLevelToolbarHtml;
  teaReferenceKindPresentation: typeof teaReferenceKind;
  teaReferenceRowActionsPresentation: typeof teaReferenceRowActions;
  teaReferenceSortPresentation: typeof sortTeaReferences;
  teaReferenceNamingTitlePresentation: typeof teaReferenceNamingTitle;
  teaReferenceEmptyStatePresentation: typeof teaReferenceEmptyState;
  teaReferenceLabValuePresentation: typeof teaReferenceLabValueHtml;
  teaReferenceInputValuePresentation: typeof teaReferenceInputValue;
  xlsxEscape: typeof xlsxEscape;
  reportXlsxStyleIds: typeof REPORT_XLSX_STYLE_IDS;
  xlsxColumns: typeof XLSX_COLUMNS;
  xlsxEmu: typeof xlsxEmu;
  xlsxUtf8: typeof xlsxUtf8;
  xlsxRound: typeof xlsxRound;
  qcBasicFormat?: ReturnType<typeof createBasicFormat>;
  westgardRulePolicy?: ReturnType<typeof createWestgardRulePolicy>;
  westgardMemoCache?: ReturnType<typeof createWestgardMemoCache>;
  qcCusumMemoCache?: ReturnType<typeof createCusumMemoCache>;
  qcAcceptedMemoCache?: ReturnType<typeof createAcceptedMemoCache>;
  westgardRuleSettings?: ReturnType<typeof createWestgardRuleSettings>;
  qcRangeCandidateService: ReturnType<typeof createRangeCandidateService>;
  qcRangeSafetyGate: typeof rangeSafetyGate;
  qcRangeBiasEvaluation: typeof rangeBiasEvaluation;
  reportExportHelpers?: typeof reportExportHelpers;
  actionReportSummary?: ReturnType<typeof createActionReportSummary>;
  actionReportModel?: ReturnType<typeof createActionReportModel>;
  sigmaReportMetricService: typeof sigmaReportMetricTs;
  sigmaMdcItemsService: typeof sigmaMdcItemsTs;
  sigmaMdcLabelPlacementService: typeof sigmaMdcLabelPlacementsTs;
  sigmaExportPixelRatioService: typeof sigmaExportPixelRatioTs;
  sigmaReportRowsService: ReturnType<typeof createSigmaReportRows>;
  qcReportRowsService?: ReturnType<typeof createQcReportRows>;
  qcReportContext?: ReturnType<typeof createQcReportContext>;
  sigmaDataUrlBytes?: typeof dataUrlBytes;
  sigmaExportMetaService: ReturnType<typeof createSigmaExportMeta>;
  exportMetaRowsService: ReturnType<typeof createExportMetaRows>;
  qcExportValueFormat: ReturnType<typeof createQcExportValueFormat>;
  sigmaCanvasFont: ReturnType<typeof createSigmaCanvasFont>;
  reportLabels: ReturnType<typeof createReportLabels>;
  reportSelection: ReturnType<typeof createReportSelection>;
  reportSearch: ReturnType<typeof createReportSearch>;
  sigmaMuTraceService: ReturnType<typeof createSigmaMuTrace>;
  sigmaPrintRowsService: ReturnType<typeof createSigmaPrintRows>;
  sigmaMuPrintRowsService: ReturnType<typeof createSigmaMuPrintRows>;
  reportPointsTableService: ReturnType<typeof createReportPointsTable>;
  actionReportHtml: ReturnType<typeof createActionReportHtml>;
  reportNceDetailHtmlPresentation: ReturnType<typeof createReportNceDetailHtml>;
  esc: typeof escapeHtml;
  escAttr: typeof escapeHtmlAttr;
  reportQcValue: ReturnType<typeof createReportPrintController>['reportQcValue'];
  reportQcStat: ReturnType<typeof createReportPrintController>['reportQcStat'];
  reportQcPoint: ReturnType<typeof createReportPrintController>['reportQcPoint'];
  reportHeader: ReturnType<typeof createReportPrintController>['reportHeader'];
  signBlock: ReturnType<typeof createReportPrintController>['signBlock'];
  openPrint: ReturnType<typeof createReportPrintController>['openPrint'];
  sigmaPeriodPrintRows: ReturnType<typeof createReportPrintController>['sigmaPeriodPrintRows'];
  sigmaPeriodsPrintRows: ReturnType<typeof createReportPrintController>['sigmaPeriodsPrintRows'];
  sigmaMuPrintRows: ReturnType<typeof createReportPrintController>['sigmaMuPrintRows'];
  sigmaMuPeriodsPrintRows: ReturnType<typeof createReportPrintController>['sigmaMuPeriodsPrintRows'];
  sigmaMuTrace: ReturnType<typeof createReportPrintController>['sigmaMuTrace'];
  sigmaMuPrintCard: ReturnType<typeof createReportPrintController>['sigmaMuPrintCard'];
  printSigmaPeriod: ReturnType<typeof createReportPrintController>['printSigmaPeriod'];
  printSigmaPeriods: ReturnType<typeof createReportPrintController>['printSigmaPeriods'];
  printWestgard: ReturnType<typeof createReportPrintController>['printWestgard'];
  reportPointsTableHtml: ReturnType<typeof createReportPrintController>['reportPointsTableHtml'];
  reportNceSummaryHtml: ReturnType<typeof createReportPrintController>['reportNceSummaryHtml'];
  reportNceDetailField: ReturnType<typeof createReportPrintController>['reportNceDetailField'];
  reportNceDetailHtml: ReturnType<typeof createReportPrintController>['reportNceDetailHtml'];
  reportNceAppendixHtml: ReturnType<typeof createReportPrintController>['reportNceAppendixHtml'];
  printReport: ReturnType<typeof createReportPrintController>['printReport'];
  printRangeForm: ReturnType<typeof createReportPrintController>['printRangeForm'];
  dataIoTypePx: ReturnType<typeof createDataIoController>['dataIoTypePx'];
  dataIoCanvasFont: ReturnType<typeof createDataIoController>['dataIoCanvasFont'];
  exportMetaRows: ReturnType<typeof createDataIoController>['exportMetaRows'];
  reportInRange: ReturnType<typeof createDataIoController>['reportInRange'];
  reportTeaInfo: ReturnType<typeof createDataIoController>['reportTeaInfo'];
  reportMultiViews: ReturnType<typeof createDataIoController>['reportMultiViews'];
  reportPrevLotRows: ReturnType<typeof createDataIoController>['reportPrevLotRows'];
  reportLevelRows: ReturnType<typeof createDataIoController>['reportLevelRows'];
  reportActionsInRange: ReturnType<typeof createDataIoController>['reportActionsInRange'];
  reportNceExcerpt: ReturnType<typeof createDataIoController>['reportNceExcerpt'];
  reportNceSummaryParts: ReturnType<typeof createDataIoController>['reportNceSummaryParts'];
  reportNceModel: ReturnType<typeof createDataIoController>['reportNceModel'];
  exportReportCSV: ReturnType<typeof createDataIoController>['exportReportCSV'];
  exportActionsCSV: ReturnType<typeof createDataIoController>['exportActionsCSV'];
  downloadBlob: ReturnType<typeof createDataIoController>['downloadBlob'];
  sigmaReportMetric: ReturnType<typeof createDataIoController>['sigmaReportMetric'];
  sigmaReportRows: ReturnType<typeof createDataIoController>['sigmaReportRows'];
  sigmaLevelsOf: ReturnType<typeof createDataIoController>['sigmaLevelsOf'];
  sigmaDataURLBytes: ReturnType<typeof createDataIoController>['sigmaDataURLBytes'];
  sigmaExportPixelRatio: ReturnType<typeof createDataIoController>['sigmaExportPixelRatio'];
  sigmaCanvas: ReturnType<typeof createDataIoController>['sigmaCanvas'];
  drawSigmaReportChart: ReturnType<typeof createDataIoController>['drawSigmaReportChart'];
  sigmaMdcItems: ReturnType<typeof createDataIoController>['sigmaMdcItems'];
  sigmaPeriodLabel: ReturnType<typeof createDataIoController>['sigmaPeriodLabel'];
  sigmaMdcPeriodLabel: ReturnType<typeof createDataIoController>['sigmaMdcPeriodLabel'];
  sigmaExportPeriods: ReturnType<typeof createDataIoController>['sigmaExportPeriods'];
  sigmaMdcLabelPlacements: ReturnType<typeof createDataIoController>['sigmaMdcLabelPlacements'];
  SIGMA_EXPORT_PIXEL_RATIO: ReturnType<typeof createDataIoController>['SIGMA_EXPORT_PIXEL_RATIO'];
  XlsxCore: ReturnType<typeof createDataIoController>['XlsxCore'];
  SigmaXlsx: ReturnType<typeof createDataIoController>['SigmaXlsx'];
  drawSigmaReportMDC: ReturnType<typeof createDataIoController>['drawSigmaReportMDC'];
  renameSigmaSheet: ReturnType<typeof createDataIoController>['renameSigmaSheet'];
  RXST: ReturnType<typeof createDataIoController>['RXST'];
  ReportXlsx: ReturnType<typeof createDataIoController>['ReportXlsx'];
  reportXlsxDoc: ReturnType<typeof createDataIoController>['reportXlsxDoc'];
  exportReportXLSX: ReturnType<typeof createDataIoController>['exportReportXLSX'];
  westgardXlsxDoc: ReturnType<typeof createDataIoController>['westgardXlsxDoc'];
  exportWestgardXLSX: ReturnType<typeof createDataIoController>['exportWestgardXLSX'];
  sigmaExportMeta: ReturnType<typeof createDataIoController>['sigmaExportMeta'];
  sigmaTeaTrace: ReturnType<typeof createDataIoController>['sigmaTeaTrace'];
  buildSigmaXlsx: ReturnType<typeof createDataIoController>['buildSigmaXlsx'];
  exportSigmaPeriodXLSX: ReturnType<typeof createDataIoController>['exportSigmaPeriodXLSX'];
  exportSigmaPeriodsXLSX: ReturnType<typeof createDataIoController>['exportSigmaPeriodsXLSX'];
  sigmaDraftService?: ReturnType<typeof createSigmaDraftService>;
  corruptLocalQuarantine?: ReturnType<typeof createCorruptLocalQuarantine>;
  syncValueCodec?: ReturnType<typeof createSyncValueCodec>;
  firebaseConfigSelection?: ReturnType<typeof createFirebaseConfigSelection>;
  firebaseConnectionGate?: ReturnType<typeof createFirebaseConnectionGate>;
  syncSnapshotSignature?: typeof syncSnapshotSignature;
  firebaseIdentity?: ReturnType<typeof createFirebaseIdentity>;
  firebaseAuditGate?: ReturnType<typeof createFirebaseAuditGate>;
  firebasePollingService?: ReturnType<typeof createFirebasePollingService>;
  firebasePullService?: ReturnType<typeof createFirebasePullService>;
  firebaseSnapshotGate?: typeof firebaseSnapshotGate;
  firebaseRemoteSnapshot?: ReturnType<typeof createFirebaseRemoteSnapshot>;
  firebaseOwnSnapshotPlan?: typeof firebaseOwnSnapshotPlan;
  firebaseFirstConnectPlan?: typeof firebaseFirstConnectPlan;
};

const root = globalThis as QCLabGlobal;
root.QCLAB_APP = { name: 'QC Lab', version: '2.7.6', releaseDate: '2026-08-06' };
/* Cấu hình đám mây khi deploy (tùy chọn). BẢO MẬT: KHÔNG bật anonymous cho dữ
   liệu thật. Với anonymous:false, mỗi máy chỉ tự nạp sẵn config; người dùng vẫn
   phải đăng nhập email/mật khẩu Firebase một lần trong "Cài đặt & Đám mây"
   (phiên được nhớ trên máy đó). locked:false nghĩa là người dùng có thể thay
   config/labCode ngay trong Cài đặt mà không sửa code. Đặt locked:true nếu
   muốn bản deploy cố định một kho Firebase. Đồng thời Firebase Rules phải giới
   hạn theo UID qua nhánh qclab-acl — xem firebase/database.rules.json và
   firebase/HUONG-DAN-FIREBASE-RULES.md. */
root.QCLAB_CLOUD = root.QCLAB_CLOUD || {
  labCode: 'khoaXN',
  anonymous: false,
  locked: false,
  config: {
    apiKey: 'AIzaSyBJvYHn1h8smBgP0WUXO2ZNppgFmt2Blus',
    authDomain: 'qclab1102.firebaseapp.com',
    databaseURL: 'https://qclab1102-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'qclab1102',
    storageBucket: 'qclab1102.firebasestorage.app',
    messagingSenderId: '389167813426',
    appId: '1:389167813426:web:ebaea398d7b5d547477d2b',
  },
};
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
installUiState(root, 'RouterUIState', createRouterUiState());

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
root.syncedShape = syncedShape; root.syncedStatesEqual = syncedStatesEqual;
const modularSyncCodec=createSyncValueCodec(),modularSyncLists=new Set(FIREBASE_SYNC_LISTS),modularSyncSnapshot=createSyncSnapshot(FIREBASE_SYNC_TOP,syncJsonMap),modularSyncMerge=createSyncStateMerge({clone:modularSyncCodec.clone,snap:modularSyncSnapshot,top:FIREBASE_SYNC_TOP,lists:modularSyncLists,array:(local:any,remote:any,base:any,deletes:boolean)=>mergeSyncArray(local,remote,base,deletes).map(modularSyncCodec.clone),branch:mergeSyncBranch,cloud:modularSyncCodec.cloudValue});
root.syncValueCodec=modularSyncCodec;
root.syncStateMerge=modularSyncMerge;
root.syncUpdateBuilder=createSyncUpdateBuilder({top:FIREBASE_SYNC_TOP,snapshot:modularSyncSnapshot});
root.syncFirstConnectMerge=createFirstConnectMerge({top:FIREBASE_SYNC_TOP,lists:modularSyncLists,cloud:modularSyncCodec.cloudValue,merge:modularSyncMerge,uniqueUsers:uniqueSyncUsers});
root.syncHasContent=source=>hasSyncContent(source,FIREBASE_SYNC_CONTENT_KEYS);root.syncCompareKeys=FIREBASE_SYNC_COMPARE_KEYS;
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
const modularLocalStorageLoadService = createLocalStorageLoadService({
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
const modularLocalStorageSnapshotWriter = createLocalStorageSnapshotWriter({
  set: (key, value) => localStorage.setItem(key, value),
  remove: key => localStorage.removeItem(key),
  saved: quiet => { if (!quiet) markSaved('Ä‘Ã£ lÆ°u cá»¥c bá»™','LÃºc '+saveTime()); },
  failed: quiet => { if (!quiet) markSaved('lá»—i lÆ°u cá»¥c bá»™','Kiá»ƒm tra dung lÆ°á»£ng trÃ¬nh duyá»‡t'); },
});
const modularPartitionedSnapshotWriter = createPartitionedSnapshotWriter({
  plan: input => {
    const plan = planPartitionWrite({fullDirty:input.fullDirty,streak:input.streak,lastFull:input.lastFull,now:input.now,maxIncrementals:input.maxIncrementals,maxMs:input.maxMs,dirtyTestIds:input.dirtyTestIds});
    lsIncrementalStreak = plan.streak; lsLastFullSaveAt = plan.lastFull; lsFullDirty = false; lsDirtyTestIds.clear();
    return plan.dirtyTestIds;
  },
  defer: () => { lsDirty = true; scheduleLocalSave(); },
  writePartitioned: (value, slot, dirtyTestIds) => partitionWrite.catch(() => false).then(() => root.localStoreService!.writePartitioned(value, slot, {dirtyTestIds})),
  setPending: pending => { partitionWrite = pending; },
  completed: (result, input) => {
    partitionSlot = String(result.slot || ''); lsSaveFailures = 0;
    try { localStorage.setItem('qclab_boot',JSON.stringify({format:1,slot:result.slot,savedAt:result.savedAt,shell:result.shell})); localStorage.setItem('qclab_saved_at',String(result.savedAt)); localStorage.removeItem('qclab'); } catch {}
    if (!sigmaDraftNeedsCloud()) clearSigmaDraftThrough(input.localDraftStamp);
    if (!input.quiet) markSaved('Ä‘Ã£ lÆ°u cá»¥c bá»™','IndexedDB phÃ¢n vÃ¹ng Â· LÃºc '+saveTime());
  },
  failed: input => { lsDirty = true; lsFullDirty = true; lsSaveFailures++; scheduleLocalRetry(); if (!input.quiet) markSaved('lá»—i lÆ°u cá»¥c bá»™','KhÃ´ng thá»ƒ ghi IndexedDB phÃ¢n vÃ¹ng'); },
});
root.storageSnapshotService = createStorageSnapshotService({
  markChanged: () => { lsRevision++; lsDirty = true; lsFullDirty = true; },
  dirty: () => lsDirty,
  cancelScheduled: () => cancelLocalSaveSchedule(),
  clearDirty: () => { lsDirty = false; },
  draftStamp: () => sigmaDraftStamp(),
  usePartitioned: () => typeof root.localStoreService !== 'undefined' && root.localStoreService!.supported() && typeof root.localStoreService!.writePartitioned === 'function',
  writePartitioned: input => modularPartitionedSnapshotWriter.write({state,slot:partitionSlot,localLoadStatus,fullDirty:lsFullDirty,dirtyTestIds:[...lsDirtyTestIds],streak:lsIncrementalStreak,lastFull:lsLastFullSaveAt,now:Date.now(),maxIncrementals:LS_FULL_ROTATE_MAX_INCREMENTALS,maxMs:LS_FULL_ROTATE_MAX_MS,localDraftStamp:input.draftStamp,quiet:input.quiet}),
  serialize: () => serializeStateForStorage(),
  writeLocal: (raw,savedAt,quiet) => modularLocalStorageSnapshotWriter.write(raw,savedAt,quiet),
  mirror: raw => mirrorIndexedDb(raw),
  needsCloud: () => sigmaDraftNeedsCloud(),
  clearDraftThrough: stamp => clearSigmaDraftThrough(stamp),
  resetFailures: () => { lsSaveFailures = 0; },
  markDirty: () => { lsDirty = true; },
  incrementFailures: () => { lsSaveFailures++; },
  retry: () => scheduleLocalRetry(),
  markSaved: (label,detail) => markSaved(label,detail),
  now: () => Date.now(),
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
    Object.assign(fb,firebaseDisconnectedState(fb,clearAuthUser));
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
const firebaseMergeApplication=createFirebaseMergeApplication({merge:(local:any,remote:any,base:any)=>(globalThis as any).fbMerge(local,remote,base),firstMerge:(local:any,remote:any)=>(globalThis as any).fbFirstConnectMerge(local,remote)});
if (typeof (root as any).fbHandleValue === 'function') root.firebaseMergeCommitService = createFirebaseMergeCommitService({
  state: () => state,
  replaceState: value => { state=value; },
  merge: (base,mergeFirstConnect,local,remote) => firebaseMergeApplication(base,mergeFirstConnect,local,remote),
  relinkAudit: value => { if(Array.isArray(value.activity))value.activity=auditRelinkChain(value.activity,value.activityAnchor||''); },
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
if (typeof (root as any).fbHandleValue === 'function') root.firebaseConflictDialogService = createFirebaseConflictDialogService(options => root.confirmDialog(options));
if (typeof (root as any).setCloudStatus === 'function') root.firebaseCloudStatusPresentation = createFirebaseCloudStatusPresentation(id => document.getElementById(id));
if (typeof (root as any).markSaved === 'function') root.firebaseSaveStatusService = createFirebaseSaveStatusService(id => document.getElementById(id));
if (typeof (root as any).remoteRenderUnsafe === 'function') root.firebaseRemoteRenderSafetyService = createFirebaseRemoteRenderSafetyService({
  modalOpen: () => { const modal=document.getElementById('modalRoot');return !!(modal&&modal.children&&modal.children.length); },
  editingFieldFocused: () => { const active=document.activeElement,main=document.getElementById('main');return !!(active&&main&&main.contains(active)&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)); },
});
if (typeof (root as any).ensureFirebaseApp === 'function') root.firebaseAppService = createFirebaseAppService({sdk: () => firebase,signature: config => fbConfigSig(config)});
if (typeof (root as any).getDeployFbCfg === 'function') root.firebaseConfigSourceService = createFirebaseConfigSourceService({cloud: () => (window as any).QCLAB_CLOUD,readStored: () => localStorage.getItem('qclab_fb')});
root.firebaseReadyState = firebaseReadyState;
root.settingsStorageUsageText = storageUsageTextTs;
root.settingsBrandProfile = createBrandProfile((value, limit) => (root.QCCore as any).cleanText(value, limit));
root.settingsFirebaseAclHelp = firebaseAclHelpTs;
root.settingsFirebaseRulesText = firebaseRulesTextTs;
root.settingsFirebaseGuideHtml = firebaseGuideHtmlTs;
root.backupReminderService = createBackupReminder({now: () => Date.now()});
root.backupLocalMarker=createBackupLocalMarker({storage:typeof localStorage==='undefined'?{getItem:()=>null,setItem:()=>{}}:localStorage,now:()=>new Date().toISOString()});
root.backupInspectionSummary=createBackupInspectionSummary({size:value=>(root as any).backupSizeMB(value)});
root.backupInspectionMessage=createBackupInspectionMessage();
root.backupFileName=createBackupFileName(value=>(root as any).vnDate(value));
root.backupSnapshotFileName=createBackupSnapshotFileName(()=>new Date().toISOString());
root.backupSizeConfirmation=createBackupSizeConfirmation({error:value=>(root as any).backupImportSizeError(value),size:value=>(root as any).backupSizeMB(value)});
root.backupSizeWarningConfirmation=createBackupSizeWarningConfirmation(value=>(root as any).backupSizeWarning(value));
root.backupExportMessage=createBackupExportMessage();
root.backupImportConfirmation=createBackupImportConfirmation();
root.backupImportMessage=createBackupImportMessage();
root.backupOversizeConfirmation=createBackupOversizeConfirmation();
root.lisQueuePresentation = createLisQueuePresentation({test:id=>(state.tests||[]).find((test:any)=>test.id===id),formatTestValue:(test,value)=>(root as any).fmtTestValue(test,value),format:(value,decimals)=>(root as any).fmt(value,decimals),escape:value=>(root as any).esc(value),escapeAttribute:value=>(root as any).escAttr(value),quoteJs:value=>(root as any).jsq(value),formatDateTime:value=>(root as any).formatDateTimeVN(value),testDisplayName:test=>typeof (root as any).testDisplayName==='function'?(root as any).testDisplayName(test):'',button:(label,action,variant)=>(root as any).btn(label,action,variant),emptyState:(title,message,action)=>(root as any).emptyState(title,message,action),modalCloseButton:action=>root.modalCloseButton(action)});
root.lisSettingsService = createLisSettingsService(value => root.lisNormalizeGatewayUrl!(value));
root.LisGatewayCommand=createLisGatewayCommand({store:settings=>localStorage.setItem(LIS_GATEWAY_STORAGE_KEY,JSON.stringify(settings)),clearToken:()=>{const input=document.getElementById('lisGatewayToken') as any;if(input)input.value='';},disable:()=>{const runtime=(root as any).lisGatewayRuntime;clearInterval(runtime.pollT);runtime.pollT=null;runtime.pending=[];runtime.unresolved=[];lisClient.setStatus('off','Đã tắt');},start:()=>(root as any).lisGatewayStart(),pull:()=>(root as any).lisGatewayPull({manual:true})});
const lisQueueController=createLisQueueController({
  document:typeof document!=='undefined'?document:({getElementById:()=>null} as unknown as Document),
  presentation:root.lisQueuePresentation,
  settingsService:{prepare:input=>root.lisSettingsService.prepare(input)},
  gatewayCommand:root.LisGatewayCommand,
  normalizeGatewayUrl:value=>root.lisNormalizeGatewayUrl!(value),
  gatewayConfig:()=>root.lisGatewayConfig!(),
  gatewayRuntime:()=>(root as any).lisGatewayRuntime,
  gatewayPull:opts=>root.lisGatewayPull!(opts as any),
  importResult:messageId=>root.lisImportResult!(messageId as any),
  rejectResult:messageId=>root.lisRejectResult!(messageId as any),
  requireAdmin:message=>root.requireAdmin(message),
  infoDialog:(message,opts)=>root.infoDialog(message,opts),
  confirmDialog:opts=>root.confirmDialog(opts),
  openModal:html=>root.openModal(html),
});
root.lisGatewaySaveSettings=lisQueueController.lisGatewaySaveSettings;
root.lisQueueValueText=lisQueueController.lisQueueValueText;
root.lisOnclick=lisQueueController.lisOnclick;
root.lisQueueRowHtml=lisQueueController.lisQueueRowHtml;
root.lisQueueSectionHtml=lisQueueController.lisQueueSectionHtml;
root.lisRenderQueueModal=lisQueueController.lisRenderQueueModal;
root.lisOpenQueueModal=lisQueueController.lisOpenQueueModal;
root.lisQueueRefresh=lisQueueController.lisQueueRefresh;
root.lisQueueImport=lisQueueController.lisQueueImport;
root.lisQueueReject=lisQueueController.lisQueueReject;
const labProfileService=createLabProfileService((value, limit) => (root.QCCore as any).cleanText(value, limit), value => root.settingsBrandProfile!(value));
root.SettingsProfileCommand=createSettingsProfileCommand({current:()=>state.lab||{},set:lab=>{state.lab=lab;},profile:labProfileService,save:()=>save({clearDerived:false}),renderBrand:()=>renderBrand(),render:()=>rerender()});
root.SettingsFirebaseCommand=createSettingsFirebaseCommand({available:()=>typeof firebase!=='undefined'&&typeof firebase.auth==='function',ensureApp:cfg=>ensureFirebaseApp(cfg),persist:()=>firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL),signIn:(email,password)=>firebase.auth().signInWithEmailAndPassword(email,password),store:plan=>localStorage.setItem('qclab_fb',JSON.stringify({labCode:plan.labCode,email:plan.email,anonymous:false,config:plan.config})),disconnect:()=>fbDisconnect(),connected:plan=>{setCloudStatus(plan.email+' · '+plan.labCode,true);},clearPassword:()=>{const input=document.getElementById('fbPassword') as any;if(input)input.value='';},init:()=>initFirebase(),hasRemote:()=>!!fb.ref,remoteExists:async()=>{const snap=await fb.ref.once('value');if(snap.exists()){markSaved('đã kết nối','Đã tải dữ liệu từ Firebase');return true;}return false;},remoteReady:()=>{fb.ready=true;fb.initialized=true;},sync:()=>(root as any).syncNow(),clearStore:()=>localStorage.removeItem('qclab_fb'),signOut:()=>typeof firebase!=='undefined'&&typeof firebase.auth==='function'?firebase.auth().signOut():Promise.resolve(),local:()=>{fb.authUser=null;setCloudStatus('Đang chạy cục bộ',false);markSaved('đã lưu cục bộ','Đã ngắt Firebase');}});
root.firebaseSettingsService = createFirebaseSettingsService(value => parseFirebaseConfigTs(value));
root.settingsBrandPreviewHtml = createBrandPreviewHtml(value => (root as any).esc(value), value => (root as any).escAttr(value));
root.settingsUnitProfileHtml = createUnitProfileHtml({escapeAttribute:value=>(root as any).escAttr(value),button:(label,action,variant)=>(root as any).btn(label,action,variant)});
root.settingsBrandPanelHtml = createBrandPanelHtml({escapeAttribute:value=>(root as any).escAttr(value),button:(label,action,variant,title,options)=>(root as any).btn(label,action,variant,title,options)});
root.settingsAdminToolsHtml = createAdminToolsHtml((label,action,variant)=>(root as any).btn(label,action,variant));
root.settingsFirebaseRulesPanelHtml = createFirebaseRulesPanelHtml({escape:value=>(root as any).esc(value),button:(label,action,variant)=>(root as any).btn(label,action,variant)});
root.settingsLisGatewayPanelHtml = createLisGatewayPanelHtml({escape:value=>(root as any).esc(value),escapeAttribute:value=>(root as any).escAttr(value),button:(label,action,variant)=>(root as any).btn(label,action,variant)});
root.settingsFirebaseConnectionPanelHtml = createFirebaseConnectionPanelHtml({escape:value=>(root as any).esc(value),escapeAttribute:value=>(root as any).escAttr(value),button:(label,action,variant)=>(root as any).btn(label,action,variant)});
root.settingsPageLayoutHtml = createSettingsPageLayoutHtml((title,subtitle)=>(root as any).headOnly(title,subtitle));
const settingsPageController=createSettingsPageController({
  document:typeof document!=='undefined'?document:({getElementById:()=>null,createElement:()=>({}),body:{appendChild:()=>{}},execCommand:()=>{}} as unknown as Document),
  navigator:()=>typeof navigator!=='undefined'?navigator:null,
  createImage:()=>new Image(),
  createFileReader:()=>new FileReader(),
  getState:()=>state,
  infoDialog:(message,opts)=>root.infoDialog(message,opts),
  requireAdmin:()=>root.requireAdmin(),
  cloud:{
    setStatus:(text,connected)=>setCloudStatus(text,connected),
    markSaved:(status,detail)=>markSaved(status,detail),
    dataPath:()=>fbDataPath(),
    getConfig:()=>getFbCfg(),
    authUser:()=>(typeof firebase!=='undefined'&&firebase.auth&&firebase.auth().currentUser)||fb.authUser||null,
  },
  profileCommand:{
    saveLab:input=>root.SettingsProfileCommand.saveLab(input),
    saveBrand:input=>root.SettingsProfileCommand.saveBrand(input),
    updateDraft:input=>root.SettingsProfileCommand.updateDraft(input),
    saveLogo:(input,dataUrl)=>root.SettingsProfileCommand.saveLogo(input,dataUrl),
    clearLogo:()=>root.SettingsProfileCommand.clearLogo(),
  },
  firebaseCommand:{connect:input=>root.SettingsFirebaseCommand.connect(input),clear:()=>root.SettingsFirebaseCommand.clear()},
  firebaseSettingsService:{prepare:input=>root.firebaseSettingsService.prepare(input)},
  brand:{logo:()=>root.brandLogo(),markText:()=>root.brandMarkText(),title:()=>root.brandTitle(),subtitle:()=>root.brandSub(),profile:lab=>root.settingsBrandProfile!(lab)},
  html:{
    storageUsageText:(data,estimate)=>root.settingsStorageUsageText!(data,estimate),
    brandPreviewHtml:input=>root.settingsBrandPreviewHtml(input),
    firebaseRulesPanelHtml:(guideHtml,rulesText)=>root.settingsFirebaseRulesPanelHtml(guideHtml,rulesText),
    firebaseGuideHtml:()=>root.settingsFirebaseGuideHtml!(),
    firebaseRulesText:()=>root.settingsFirebaseRulesText!(),
    pageLayoutHtml:input=>root.settingsPageLayoutHtml(input),
    unitProfileHtml:lab=>root.settingsUnitProfileHtml(lab),
    brandPanelHtml:input=>root.settingsBrandPanelHtml(input),
    adminToolsHtml:(statusText,capacityText)=>root.settingsAdminToolsHtml(statusText,capacityText),
    firebaseConnectionPanelHtml:input=>root.settingsFirebaseConnectionPanelHtml(input),
    lisGatewayPanelHtml:input=>root.settingsLisGatewayPanelHtml(input),
    firebaseAclHelp:(labCode,uid)=>root.settingsFirebaseAclHelp!(labCode,uid),
  },
  lis:{config:()=>root.lisGatewayConfig!(),runtime:()=>(root as any).lisGatewayRuntime,statusText:()=>root.lisGatewayStatusText!()},
  backup:{statusText:()=>(root as any).backupStatusText(),capacityText:()=>(root as any).backupCapacityText()},
});
root.checkStorageUsage=settingsPageController.checkStorageUsage;
root.saveLab=settingsPageController.saveLab;
root.ensureLabBrandShape=settingsPageController.ensureLabBrandShape;
root.saveBrand=settingsPageController.saveBrand;
root.readBrandInputs=settingsPageController.readBrandInputs;
root.pickLogo=settingsPageController.pickLogo;
root.clearLogo=settingsPageController.clearLogo;
root.saveFb=settingsPageController.saveFb;
root.clearFb=settingsPageController.clearFb;
root.copyFirebaseRules=settingsPageController.copyFirebaseRules;
root.pageSettings=settingsPageController.pageSettings;
const modularIndexedDbOpenService=createIndexedDbOpenService({indexedDb:()=>typeof indexedDB === 'undefined'?null:indexedDB});
const modularIndexedDbRecordService=createIndexedDbRecordService({open:()=>modularIndexedDbOpenService.open()});
root.partitionedIndexedDbWriteService = createPartitionedIndexedDbWriteService({
  supported: () => typeof indexedDB !== 'undefined',
  key: (slot,type,id) => modularLocalPartitionHelpers.key(slot,type,id),
  draft: (state,currentSlot,dirtyTestIds,manifest) => modularLocalPartitionTransaction.draft(state,currentSlot,dirtyTestIds,manifest),
  finalize: (state,manifest,slotManifest,draft) => modularLocalPartitionTransaction.finalize(state,manifest,slotManifest,draft),
});
root.partitionedIndexedDbReadService = createPartitionedIndexedDbReadService({
  supported: () => typeof indexedDB !== 'undefined',
  key: (slot,type,id) => modularLocalPartitionHelpers.key(slot,type,id),
  slots: preferred => modularLocalRecoverySlots(preferred),
  recover: (slot,manifest,shell,rows) => modularLocalPartitionRecovery(slot,manifest,shell,rows),
});
const modularIndexedDbClearService = createIndexedDbClearService({
  supported: () => typeof indexedDB !== 'undefined',
  key: (slot,type,id) => modularLocalPartitionHelpers.key(slot,type,id),
  keys: manifests => modularLocalClearKeys(manifests),
});
root.localStoreService = createLocalStoreService({
  indexedDbAvailable: () => typeof indexedDB !== 'undefined',
  get: key => modularIndexedDbRecordService.get(key),
  put: record => modularIndexedDbRecordService.put(record),
  remove: key => modularIndexedDbRecordService.delete(key),
  stateRecord: value => modularLocalSnapshotRecord.state(value),
  serializedRecord: value => modularLocalSnapshotRecord.serialized(value),
  writePartitioned: input => root.partitionedIndexedDbWriteService!.write(input),
  readPartitioned: (slot, get) => root.partitionedIndexedDbReadService!.read(slot,get),
  clear: (get, remove) => modularIndexedDbClearService.clear(get,remove),
});
root.LocalStore = Object.freeze({
  supported: () => root.localStoreService!.supported(),
  read: () => root.localStoreService!.read(),
  write: (value: any) => root.localStoreService!.write(value),
  writeSerialized: (value: string) => root.localStoreService!.writeSerialized(value),
  writePartitioned: (value: any, slot: string, options?: {dirtyTestIds?: string[] | null}) => root.localStoreService!.writePartitioned(value, slot, options),
  readPartitioned: (slot?: string) => root.localStoreService!.readPartitioned(slot),
  clear: () => root.localStoreService!.clear(),
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
root.activityAuditPageHtml = createActivityAuditPageHtml();
root.activityAuditPagination = activityAuditPagination;
root.activityAuditCsv = createActivityAuditCsv({
  formatDateTime: value => (globalThis as any).formatDateTimeVN(value), roleLabel: value => (globalThis as any).roleLabel(value),
});
root.updateActivityAuditDateRange = updateActivityAuditDateRange;
root.activityAuditFilterState = activityAuditFilterState;
root.activityAuditPageSizes = ACTIVITY_AUDIT_PAGE_SIZES;
root.activityAuditArchiveWindow = activityAuditArchiveWindow;
root.activityAuditArchiveModalHtml = activityAuditArchiveModalHtml;
root.activityAuditRowHtml = activityAuditRowHtml;
root.userListModel = userListModel;
root.userRowHtml = createUserRowHtml();
root.usersPageHtml = createUsersPageHtml();
root.reagentSelectOptionsHtml = createReagentSelectOptionsHtml();
root.reagentResultHtml = createReagentResultHtml();
root.reagentPairRowHtml = createReagentPairRowHtml();
const modularStorageBootService = createStorageBootService({
  partitionedSupported: () => typeof root.localStoreService !== 'undefined' && root.localStoreService!.supported(),
  readBootRecord: () => localStorage.getItem('qclab_boot'),
  discardBootRecord: () => localStorage.removeItem('qclab_boot'),
  activatePartitionShell: (shell, slot) => { (globalThis as any).adoptValidatedState(shell); partitionSlot = slot; localLoadStatus = 'partition-shell'; storageHydrationPromise = (globalThis as any).hydratePartitionedState(); },
  loadLegacy: () => modularLocalStorageLoadService.load(),
  localLoadStatus: () => localLoadStatus,
  recoverPendingSigmaDraft: () => (globalThis as any).recoverPendingSigmaDraft(),
  restoreFromIndexedDb: () => (globalThis as any).restoreFromIndexedDb(),
});
const modularIndexedDbRecoveryService = createIndexedDbRecoveryService({
  supported: () => typeof root.localStoreService !== 'undefined' && root.localStoreService!.supported(),
  readPartitioned: () => typeof root.localStoreService!.readPartitioned === 'function' ? root.localStoreService!.readPartitioned() : Promise.resolve(null),
  readLegacy: () => root.localStoreService!.read(),
  adopt: value => (globalThis as any).adoptValidatedState(value),
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
const modularPartitionHydrationService = createPartitionHydrationService({
  read: () => root.localStoreService!.readPartitioned(),
  adopt: value => (globalThis as any).adoptValidatedState(value),
  recoverPendingSigmaDraft: () => (globalThis as any).recoverPendingSigmaDraft(),
  accept: record => { mem = state; partitionSlot = String(record.slot || ''); localLoadStatus = 'partitioned'; clearDerived(); startupProblem = null; if (lsDirty) scheduleLocalSave(); },
  reportFailure: error => { startupProblem = {raw:'',message:error && (error as Error).message ? (error as Error).message : 'KhÃ´ng thá»ƒ táº£i cÃ¡c phÃ¢n vÃ¹ng dá»¯ liá»‡u QC.'}; },
});
root.storageLifecycleService = createStorageLifecycleService({
  sanitize: value => modularStateAdoptionService.sanitize(value),
  normalize: value => { state = value; ensureShape({sanitized:true}); return state; },
  assertInvariants: value => modularStateAdoptionService.assertInvariants(value),
  boot: modularStorageBootService,
  hydrate: () => modularPartitionHydrationService.hydrate(),
  restore: () => modularIndexedDbRecoveryService.restore(),
});
root.indexedDbMirrorService = createIndexedDbMirrorService({
  supported: () => typeof root.localStoreService !== 'undefined' && root.localStoreService!.supported(),
  writeSerialized: raw => typeof root.localStoreService!.writeSerialized === 'function' ? root.localStoreService!.writeSerialized(raw) : null,
  writeState: value => root.localStoreService!.write(value),
  failed: () => { lsDirty = true; lsSaveFailures++; scheduleLocalRetry(); },
});
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
root.canvasFont=createChartCanvasFont((token,fallback)=>(root.cssTokenPixel as any)(token,fallback));
root.chartDataUrl=createChartDataUrl({createCanvas:()=>document.createElement('canvas')});
root.afterRenderCanvasService=createVisibleCanvasService({requestFrame:work=>requestAnimationFrame(work),intersectionObserver:typeof IntersectionObserver==='function'?onVisible=>new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))onVisible();},{rootMargin:'160px'}):undefined,resizeObserver:typeof ResizeObserver==='function'?onResize=>new ResizeObserver(onResize):undefined,isConnected:canvas=>canvas.isConnected!==false});
root.routerPagePolicy=createRouterPagePolicy();
root.routerShell=createRouterShellController({find:id=>typeof document==='undefined'?null:document.getElementById(id),findShell:()=>typeof document==='undefined'?null:document.getElementById('appShell'),lab:()=>state.lab||{},pages:()=>root.routerPagePolicy.pages,canAccess:(id,user)=>root.routerPagePolicy.canAccessPage(id,user),escape:value=>(root as any).esc(value),escapeAttr:value=>(root as any).escAttr(value),app:()=>typeof window==='undefined'?{version:'dev'}:(window as any).QCLAB_APP||{version:'dev'},license:()=>typeof window==='undefined'?null:(window as any).qcLicense,storage:typeof localStorage==='undefined'?{setItem:()=>{}}:localStorage});
const modalDocument=()=>typeof document!=='undefined'?document:({querySelectorAll:()=>[]} as unknown as Document);
const modalTemplateApi=createModalTemplate({escapeAttr:value=>(root as any).escAttr(value)});
root.modalTemplate=modalTemplateApi.modalTemplate;root.modalCloseButton=modalTemplateApi.modalCloseButton;
const modalControllerApi=createModalController({document:modalDocument(),requestFrame:work=>requestAnimationFrame(work)});
root.openModal=modalControllerApi.openModal;root.closeModal=modalControllerApi.closeModal;root.modalKeydown=modalControllerApi.modalKeydown;
const dialogOverlayApi=createDialogOverlayController({document:modalDocument(),requestFrame:work=>requestAnimationFrame(work),modalCloseButton:action=>root.modalCloseButton(action),escape:value=>(root as any).esc(value),button:(label,action,cls)=>(root as any).btn(label,action,cls)});
root.openDialogOverlay=dialogOverlayApi.openDialogOverlay;root.closeDialogOverlay=dialogOverlayApi.closeDialogOverlay;root.dialogKeydown=dialogOverlayApi.dialogKeydown;root.confirmDialog=dialogOverlayApi.confirmDialog;root.confirmDialogAnswer=dialogOverlayApi.confirmDialogAnswer;root.infoDialog=dialogOverlayApi.infoDialog;root.infoDialogAnswer=dialogOverlayApi.infoDialogAnswer;
root.vnDatePickerController=createVnDatePickerController({document:typeof document==='undefined'?null:document,window:typeof window==='undefined'?{innerWidth:0,innerHeight:0}:window,today:()=>isoToday()});
const chartTooltip=createChartTooltipService({find:()=>document.getElementById('qcTooltip'),create:()=>document.createElement('div'),append:element=>document.body.appendChild(element)});
root.qcTooltip=chartTooltip;
root.leveyJenningsTooltipController=createLeveyJenningsTooltipController({tooltip:chartTooltip,viewport:()=>({width:innerWidth,height:innerHeight}),bind:(canvas,event,handler)=>(canvas as Element).addEventListener(event,handler as unknown as EventListener)});
root.hiDpiCanvasSetup=createHiDpiCanvasSetup(()=>window.devicePixelRatio||1);
root.leveyJenningsGeometry=leveyJenningsGeometry;
const legacyWestgardRuleScope=globalThis as any;
root.westgardRuleScope=createWestgardRuleScope({within:(test:any,rule:string)=>typeof legacyWestgardRuleScope.testRuleOnWithin==='function'?legacyWestgardRuleScope.testRuleOnWithin(test,rule):legacyWestgardRuleScope.testRuleOn(test,rule),across:(test:any,rule:string)=>typeof legacyWestgardRuleScope.testRuleOnAcross==='function'?legacyWestgardRuleScope.testRuleOnAcross(test,rule):legacyWestgardRuleScope.testRuleOn(test,rule),default:(test:any,rule:string)=>legacyWestgardRuleScope.testRuleOn(test,rule)});
root.leveyJenningsColors=LEVEY_JENNINGS_COLORS;
root.leveyJenningsTicks=createLeveyJenningsTicks(value=>vnDate(value));
const legacyLeveyJenningsAxis=globalThis as any;
root.leveyJenningsYAxisLabels=createLeveyJenningsYAxisLabels((test,value)=>legacyLeveyJenningsAxis.fmtTestValue(test,value));
const legacyLeveyJenningsHover=globalThis as any;
const leveyJenningsHoverModel=createLeveyJenningsHoverModel({date:value=>legacyLeveyJenningsHover.vnDate(value),escape:value=>legacyLeveyJenningsHover.esc(value),pointValue:(point,test)=>legacyLeveyJenningsHover.fmtPointValue(point,test),number:value=>legacyLeveyJenningsHover.fmt(value)});
const leveyJenningsDisplayPlan=createLeveyJenningsDisplayPlan(input=>chartViewModel.sampleIndices(input));
root.leveyJenningsPointRenderModel=createLeveyJenningsPointRenderModel({displayPlan:(points,results,width)=>leveyJenningsDisplayPlan(points,results,width),verdict:(test,rules)=>(globalThis as any).ruleResultLevel(test,rules),style:status=>leveyJenningsPointStyle(status,LEVEY_JENNINGS_COLORS),hover:input=>leveyJenningsHoverModel(input)});
root.leveyJenningsBandRects=leveyJenningsBandRects;
root.leveyJenningsGridLines=leveyJenningsGridLines;
root.leveyJenningsMultiSeries=leveyJenningsMultiSeries;
root.leveyJenningsMultiRunTicks=createLeveyJenningsMultiRunTicks(value=>(globalThis as any).vnDate(value));
root.leveyJenningsLegendLayout=(levels,colors,startX,measure)=>createLeveyJenningsLegendLayout(text=>measure(text).width)(levels,colors,startX);
const leveyJenningsMultiDisplayPlan=createLeveyJenningsMultiDisplayPlan(input=>chartViewModel.sampleIndices(input));
const legacyLeveyJenningsMultiHover=globalThis as any;
const leveyJenningsMultiHoverModel=createLeveyJenningsMultiHoverModel({date:value=>legacyLeveyJenningsMultiHover.vnDate(value),escape:value=>legacyLeveyJenningsMultiHover.esc(value),pointValue:(point,test)=>legacyLeveyJenningsMultiHover.fmtPointValue(point,test),number:value=>legacyLeveyJenningsMultiHover.fmt(value)});
root.leveyJenningsMultiPointRenderModel=createLeveyJenningsMultiPointRenderModel({displayPlan:input=>leveyJenningsMultiDisplayPlan(input),verdict:(test,rules)=>(globalThis as any).ruleResultLevel(test,rules),hover:input=>leveyJenningsMultiHoverModel(input)});
root.leveyJenningsMultiDividers=leveyJenningsMultiDividers;
root.cusumChartGeometry=cusumChartGeometry;
root.cusumPointRenderModel=cusumPointRenderModel;
root.cusumReferenceLines=cusumReferenceLines;
root.cusumLinePoints=cusumLinePoints;
root.blobDownload=createBlobDownload({createUrl:blob=>URL.createObjectURL(blob),revokeUrl:url=>URL.revokeObjectURL(url),download:(url,name)=>{const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();},schedule:(work,delay)=>globalThis.setTimeout(work,delay)});
root.qcReportCsvRows=createQcReportCsvRows({test:(id:any)=>(state.tests||[]).find((test:any)=>test.id===id),lab:()=>(state as any).lab||{},meta:(kind:any)=>(root as any).exportMetaRows(kind),range:(start:any,end:any)=>(root as any).reportRangeText(start,end),testName:(test:any)=>(root as any).testDisplayName(test),tea:(test:any)=>(root as any).sgTea(test),teaSource:(test:any)=>(root as any).sgTeaSource(test),teaLabel:(source:any)=>(root as any).sgTeaLabel(source),teaReference:(test:any)=>(root as any).sgTeaRefText(test),levels:(test:any)=>(root as any).operationalLevels(test),previous:(test:any,level:any)=>(root as any).previousLotSeries(test,level),rows:(root as any).qcReportRowsService,westgard:(test:any)=>(root as any).activeWestgard(test),staff:(point:any)=>(root as any).pointStaff(point),date:(value:any)=>(root as any).vnDate(value),number:(value:any,decimals?:any)=>(root as any).fmt(value,decimals),state:(value:any)=>(root as any).stateName(value),error:(rules:any)=>(root as any).errorType(rules),stats:(points:any,mean:any,tea:any)=>(root as any).reportLevelStats(points,mean,tea),levelLabel:(test:any,level:any,lot:any)=>(root as any).actionLevelShort(test,level,lot),workflow:(action:any)=>(root as any).actionWorkflowStatus(action),rerun:(action:any)=>(root as any).actionRerunStatus(action),protocol:(action:any)=>(root as any).actionProtocolSummary(action),approval:(action:any)=>(root as any).actionApprovalLabel(action)});
root.installDerivedCacheInvalidation=legacy=>root.derivedCacheInvalidation=createDerivedCacheInvalidation({...legacy,resetQcDerivedIndex:()=>root.qcDerivedIndex?.clear(),pointCache:()=>root.qcPointCache,westgardCache:()=>root.westgardMemoCache,acceptedCache:()=>root.qcAcceptedMemoCache,cusumCache:()=>root.qcCusumMemoCache,invalidateWestgardWorker:(testId:unknown)=>(root as any).invalidateWestgardWorker(testId),invalidateActionCaches:(testId:unknown)=>(root as any).invalidateActionCaches(testId)} as any);
const legacyDerivedCacheState=(root as any).legacyDerivedCacheState;
if(legacyDerivedCacheState)root.installDerivedCacheInvalidation(legacyDerivedCacheState);
root.qcBasicFormat = createBasicFormat();
root.westgardRulePolicy=createWestgardRulePolicy({rules:(root.QCCore as any).WG_RULES,enabled:(rule:string)=>(root.QCCore as any).ruleEnabled((state as any).westgardRules,rule),levels:(test:any)=>(root as any).operationalLevels(test),resolveAction:(root.QCCore as any).resolveRuleAction,resolveScope:(root.QCCore as any).resolveRuleScope,onInScope:(root.QCCore as any).ruleOnInScope,verdict:(root.QCCore as any).ruleVerdictLevel});
root.westgardMemoCache=createWestgardMemoCache();
root.qcCusumMemoCache=createCusumMemoCache();
root.qcAcceptedMemoCache=createAcceptedMemoCache();
root.westgardRuleSettings=createWestgardRuleSettings({defaults:(root.QCCore as any).WG_DEFAULT_ON?Object.fromEntries((root.QCCore as any).WG_RULES.map((rule:string)=>[rule,(root.QCCore as any).WG_DEFAULT_ON.has(rule)])): {},getState:()=>state,ruleEnabled:(rules:any,rule:string)=>(root.QCCore as any).ruleEnabled(rules,rule),requireWrite:()=>requireWrite(),save:()=>save({}),rerender:()=>rerender()});
root.qcRangeCandidateService=createRangeCandidateService({tests:()=>state.tests||[],actions:()=>((state as any).actions||[]),levelConfig:(test:any,level:any)=>lvlCfg(test,level),points:(test:any,level:any)=>(globalThis as any).operationalLotPoints(test,level),westgard:(test:any)=>(globalThis as any).activeWestgard(test),pointZ:(point:any,mean:any,sd:any)=>(root.QCCore as any).pointZ(point,mean,sd),stats:(values:number[])=>(root.QCCore as any).stats(values),actionCancelled:(action:any)=>typeof (globalThis as any).actionCancelled==='function'&&(globalThis as any).actionCancelled(action),systematicRules:(root.QCCore as any).WG_SE_RULES,limitsFromTarget:(mean:any,sd:any,k:number)=>(root.QCCore as any).limitsFromTarget(mean,sd,k)});
root.qcRangeSafetyGate=rangeSafetyGate;
root.qcRangeBiasEvaluation=rangeBiasEvaluation;
root.reportExportHelpers=reportExportHelpers;
root.actionReportSummary=createActionReportSummary({labels:()=>typeof (globalThis as any).ACTION_LABELS==='object'?(globalThis as any).ACTION_LABELS:{},excerpt:(value:any,max?:number)=>root.reportExportHelpers!.nceExcerpt(value,max)});
root.actionReportModel=createActionReportModel({labels:()=>typeof (globalThis as any).ACTION_LABELS==='object'?(globalThis as any).ACTION_LABELS:{},rerunStatus:(action:any)=>typeof (globalThis as any).actionRerunStatus==='function'?(globalThis as any).actionRerunStatus(action):{label:''},workflowStatus:(action:any)=>typeof (globalThis as any).actionWorkflowStatus==='function'?(globalThis as any).actionWorkflowStatus(action):{label:'Chưa hoàn tất'},effectivenessStatus:(action:any)=>typeof (globalThis as any).actionEffectivenessStatus==='function'?(globalThis as any).actionEffectivenessStatus(action):{label:'Chưa đánh giá'},riskScore:(action:any)=>typeof (globalThis as any).actionRiskScore==='function'?(globalThis as any).actionRiskScore(action):0,residualRiskScore:(action:any)=>typeof (globalThis as any).actionResidualRiskScore==='function'?(globalThis as any).actionResidualRiskScore(action):0,eventDate:(action:any)=>typeof (globalThis as any).actionEventDate==='function'?(globalThis as any).actionEventDate(action):action.date,approvalLabel:(action:any)=>typeof (globalThis as any).actionApprovalLabel==='function'?(globalThis as any).actionApprovalLabel(action):(action.approvalStatus||'Chờ duyệt'),pointValue:(point:any,test:any)=>root.qcExportValueFormat.point(point,test),formatDate:(value:any)=>vnDate(value),formatDateTime:(value:any)=>formatDateTimeVN(value),testName:(test:any)=>(globalThis as any).testDisplayName(test),levelShort:(test:any,level:any,lot:any)=>(globalThis as any).actionLevelShort(test,level,lot)});
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
root.reportXlsxHeader=createReportXlsxHeader;
root.reportHeaderPresentation=reportHeaderPresentation;
root.reportNceAppendixPresentation=createReportNceAppendix({detail:(action,test)=>(globalThis as any).reportNceDetailHtml(action,test)});
root.reportNceDetailHtmlPresentation=createReportNceDetailHtml({model:(action,test)=>(globalThis as any).reportNceModel(action,test),field:(label,value,wide)=>(globalThis as any).reportNceDetailField(label,value,wide),escape:(value:any)=>typeof (globalThis as any).esc==='function'?(globalThis as any).esc(value):String(value??'')});
root.reportSignBlock=reportSignBlock;
root.reportLockListHtmlPresentation=createReportLockListHtml<any>({sorted:(locks:any[])=>(root as any).ReportPeriodPresentation.sortedLocks(locks),month:(ym:any)=>(root as any).monthVN(ym),dateTime:(value:any)=>(root as any).formatDateTimeVN(value),escape:(value:any)=>(root as any).esc(value),button:(label,action,variant)=>(root as any).btn(label,action,variant),quote:(value:any)=>(root as any).jsq(value)});
root.reportUnlockReason=createReportUnlockReason({clean:(value:any,maxLength:number)=>(root as any).QCCore.cleanText(value,maxLength)});
root.reportUnlockModalHtml=reportUnlockModalHtml;
root.reportLockPicker=reportLockPicker;
root.reportLockPanelHtmlPresentation=createReportLockPanelHtml({button:(label,action,variant,title,options)=>(root as any).btn(label,action,variant,title,options)});
root.reportPageHtml=createReportPageHtml({head:(title,subtitle)=>(root as any).headOnly(title,subtitle),empty:(title,message,action)=>(root as any).emptyState(title,message,action),button:(label,action,variant,title,options)=>(root as any).btn(label,action,variant,title,options),escape:(value:any)=>(root as any).esc(value),escapeAttr:(value:any)=>(root as any).escAttr(value),label:(test:any,tests:any[])=>(root as any).testSelectLabel(test,tests),rangePicker:(start,end)=>(root as any).reportRangePicker(start,end),actionIcon:(type)=>(root as any).reportActionIcon(type)});
root.reportRangePickerHtml=createReportRangePickerHtml({dateBox:(id,value,placeholder,attrs)=>(root as any).dateBox(id,value,placeholder,attrs)});
const reportPageController=createReportPageController({
  document:typeof document!=='undefined'?document:({getElementById:()=>null,querySelectorAll:()=>[]} as unknown as Document),
  getState:()=>state,
  infoDialog:(message,opts)=>root.infoDialog(message,opts),
  confirmDialog:opts=>root.confirmDialog(opts),
  requireAdmin:()=>root.requireAdmin(),
  openModal:html=>root.openModal(html),
  closeModal:()=>root.closeModal(),
  reauthenticate:opts=>(root as any).reauthenticateCurrentUser(opts),
  rerender:()=>rerender(),
  requestFrame:(work,delay)=>setTimeout(work,delay),
  esc:value=>(root as any).esc(value),
  jsq:value=>(root as any).jsq(value),
  button:(label,action,variant,title,options)=>(root as any).btn(label,action,variant,title,options),
  isoMonth:()=>(root as any).isoMonth(),
  isoToday:()=>isoToday(),
  monthVN:ym=>(root as any).monthVN(ym),
  parseVN:value=>(root as any).parseVN(value),
  userName:()=>userName(),
  uid:()=>uid(),
  searchText:value=>root.normalizeSearchText!(value),
  operationalTests:()=>(root as any).operationalTests(),
  testSelectLabel:(test,tests)=>(root as any).testSelectLabel(test,tests),
  operationalLevels:test=>(root as any).operationalLevels(test),
  operationalPanelForTest:test=>(root as any).operationalPanelForTest(test),
  operationalLotGroupForTest:test=>(root as any).operationalLotGroupForTest(test),
  replaceSelectItems:(select,items,emptyText)=>root.replaceSelectItems(select,items,emptyText),
  scheduleSearchRender:(owner,apply,focusId)=>root.scheduleSearchRender(owner,apply,focusId),
  periodPresentation:{currentYearMonth:(value,fallback)=>root.ReportPeriodPresentation.currentYearMonth(value,fallback),setPart:(ym,part,value)=>root.ReportPeriodPresentation.setPart(ym,part as any,value)},
  periodWorkflow:{lock:input=>root.ReportPeriodWorkflowCommand.lock(input),unlock:input=>root.ReportPeriodWorkflowCommand.unlock(input)},
  findLock:(s,ym)=>root.PeriodService.findLock(s,ym),
  unlockModalHtml:input=>root.reportUnlockModalHtml(input),
  unlockReason:value=>root.reportUnlockReason!(value),
  lockListHtml:(locks,isAdmin)=>root.reportLockListHtmlPresentation(locks,isAdmin),
  lockPanelHtml:input=>root.reportLockPanelHtmlPresentation(input),
  lockPicker:(ym,year)=>root.reportLockPicker(ym,year),
  searchValuePresentation:{values:(test,d)=>root.reportSearchValuePresentation.values(test,d) as string[]},
  reportSearch:{select:(tests,q,selected,values,st)=>(root as any).reportSearch.select(tests,q,selected,values,st)},
  reportSelection:{defaults:(start,end,im,it)=>(root as any).reportSelection.defaults(start,end,im,it),dateRange:(start,end)=>(root as any).reportSelection.dateRange(start,end),exportSelection:(tests,tid,start,end,includeNce)=>(root as any).reportSelection.exportSelection(tests,tid,start,end,includeNce)},
  rangeText:(start,end)=>root.reportLabels.rangeText(start,end),
  actionIconPresentation:{icon:type=>root.reportActionIconPresentation.icon(type)},
  role:()=>root.role(),
  pageHtml:input=>root.reportPageHtml(input),
  rangePickerHtml:(start,end)=>root.reportRangePickerHtml(start,end),
});
root.reportLockYmValue=reportPageController.reportLockYmValue;
root.reportSetLockPart=reportPageController.reportSetLockPart;
root.reportLockPeriod=reportPageController.reportLockPeriod;
root.reportUnlockPeriod=reportPageController.reportUnlockPeriod;
root.reportConfirmUnlockPeriod=reportPageController.reportConfirmUnlockPeriod;
root.reportLockListHtml=reportPageController.reportLockListHtml;
root.reportSearchValues=reportPageController.reportSearchValues;
root.reportSearchSet=reportPageController.reportSearchSet;
root.reportApplySearch=reportPageController.reportApplySearch;
root.reportRangeDefaults=reportPageController.reportRangeDefaults;
root.reportDateRange=reportPageController.reportDateRange;
root.reportExportSelection=reportPageController.reportExportSelection;
root.reportRangeChanged=reportPageController.reportRangeChanged;
root.reportRangeText=reportPageController.reportRangeText;
root.reportActionIcon=reportPageController.reportActionIcon;
root.reportLockPanelHtml=reportPageController.reportLockPanelHtml;
root.pageReportV2=reportPageController.pageReportV2;
root.reportRangePicker=reportPageController.reportRangePicker;
const reportPeriodCommand=createReportPeriodCommand({lock:(s,input)=>root.PeriodService.lock(s as any,input),unlock:(s,input)=>root.PeriodService.unlock(s as any,input)});
root.ReportPeriodWorkflowCommand=createReportPeriodWorkflowCommand({current:()=>state,period:reportPeriodCommand,log:(type,detail,target)=>logAct(type,detail,target),save:options=>save(options),render:()=>rerender()});
root.ActionCurrentIssues=createActionCurrentIssues({operationalTests:()=>typeof (globalThis as any).operationalTests==='function'?(globalThis as any).operationalTests():[],activeWestgard:test=>(globalThis as any).activeWestgard(test),pointWorkflowComplete:pointId=>typeof (globalThis as any).pointWorkflowComplete==='function'?(globalThis as any).pointWorkflowComplete(pointId):false});
root.ActionReviewMessages=actionReviewMessages;
root.dashboardLoadingPresentation=createDashboardLoading({headHtml:createDashboardHeadHtml({escape:(value:any)=>(root as any).esc(value),topUserBox:()=>typeof (globalThis as any).topUserBox==='function'?(globalThis as any).topUserBox():''}),kpisHtml:dashboardKpisHtml});
root.dashboardStatusFilter=createDashboardStatusFilter();
root.dashboardExpiringLots=dashboardExpiringLots;
root.dashboardShiftStatus=dashboardShiftStatus;
root.dashboardKpis=dashboardKpis;
root.reportQcFormat=createReportQcFormat({testValue:(test,value)=>typeof (globalThis as any).fmtTestValue==='function'?(globalThis as any).fmtTestValue(test,value):(globalThis as any).fmt(value,3),testStat:(test,value)=>typeof (globalThis as any).fmtTestStat==='function'?(globalThis as any).fmtTestStat(test,value):(globalThis as any).fmt(value,3),pointValue:(point,test)=>typeof (globalThis as any).fmtPointValue==='function'?(globalThis as any).fmtPointValue(point,test):(globalThis as any).fmt(point&&point.val,Math.max(2,Number(point&&point.valueDecimals)||0)),format:(value,decimals)=>(globalThis as any).fmt(value,decimals)});
root.qcRangeTea=createRangeTea({teaBySource:(test,source,target)=>(globalThis as any).sgTeaBySource(test,source,target),teaSource:test=>(globalThis as any).sgTeaSource(test)});
root.entryRowsWindowTs=entryRowsWindowTs;
root.entryLotLabelsTs=entryLotLabelsTs;
root.entryDayPresetButtons=entryDayPresetButtons;
root.entryLeveyJenningsMiniHtml=createEntryLeveyJenningsMiniHtml({escape:(value:any)=>(root as any).esc(value),escapeAttribute:(value:any)=>(root as any).escAttr(value)});
root.entrySheetLevelHeads=createEntrySheetLevelHeads({escape:(value:any)=>(root as any).esc(value),escapeAttribute:(value:any)=>(root as any).escAttr(value)});
root.entryTreeHeaderHtml=createEntryTreeHeaderHtml({escapeAttribute:(value:any)=>(root as any).escAttr(value)});
root.entryTreeItemHtml=createEntryTreeItemHtml({escape:(value:any)=>(root as any).esc(value),escapeAttribute:(value:any)=>(root as any).escAttr(value)});
root.entryRangeSummaryHtml=entryRangeSummaryHtml;
root.entryWorksheetHtml=entryWorksheetHtml;
root.entryLeveyPanelHtml=entryLeveyPanelHtml;
root.entryPageLayoutHtml=entryPageLayoutHtml;
root.entryVoidedPointsHtml=entryVoidedPointsHtml;
root.entryPointsPanelHtml=entryPointsPanelHtml;
root.entryCumulativeStatsHtml=entryCumulativeStatsHtml;
root.entryTableWindowNoteHtml=entryTableWindowNoteHtml;
root.entryPointTableCardHtml=entryPointTableCardHtml;
root.entryPointTableRowHtml=entryPointTableRowHtml;
root.entryVoidedPointRowHtml=entryVoidedPointRowHtml;
root.entrySheetDayRowHtml=entrySheetDayRowHtml;
root.entrySheetDaySummaryHtml=createEntrySheetDaySummaryHtml({escape:(value:any)=>(root as any).esc(value),escapeAttribute:(value:any)=>(root as any).escAttr(value)});
root.entryVoidModalHtml=entryVoidModalHtml;
root.entryPreSaveWarningModalHtml=entryPreSaveWarningModalHtml;
root.entrySheetEmptyRunHtml=entrySheetEmptyRunHtml;
root.entrySheetSavedRunHtml=entrySheetSavedRunHtml;
root.entrySheetCellHtml=entrySheetCellHtml;
root.entrySheetAddRunHtml=entrySheetAddRunHtml;
root.entrySheetNoteHtml=entrySheetNoteHtml;
root.entryEmptyPageHtml=createEntryEmptyPageHtml({head:(title,subtitle)=>(root as any).headOnly(title,subtitle),empty:(title,message,action)=>(root as any).emptyState(title,message,action)});
root.targetSwitchModalHtml=targetSwitchModalHtml;
root.configPanelTestRows=configPanelTestRows;
root.configPanelModalHtml=configPanelModalHtml;
root.lotTransitionChoiceHtmlPresentation=lotTransitionChoiceHtmlPresentation;
root.lotTransitionModalHtml=lotTransitionModalHtml;
root.lotTransitionTargetsHtmlPresentation=lotTransitionTargetsHtmlPresentation;
root.lotGroupColumnsHtml=lotGroupColumnsHtml;
root.lotGroupModalHtml=lotGroupModalHtml;
root.configLotModalHtml=configLotModalHtml;
root.configInstrumentModalHtml=configInstrumentModalHtml;
root.configAssayModalHtml=configAssayModalHtml;
root.qcHistoryDetailModalHtml=qcHistoryDetailModalHtml;
root.configAssayRuleRowsHtml=configAssayRuleRowsHtml;
root.configAssayTeaOptionsHtml=configAssayTeaOptionsHtml;
root.configAssayInstrumentOptionsHtml=configAssayInstrumentOptionsHtml;
root.configAssayDecimalOptionsHtml=configAssayDecimalOptionsHtml;
root.configPanelInstrumentOptionsHtml=configPanelInstrumentOptionsHtml;
root.configLotLevelOptionsHtml=configLotLevelOptionsHtml;
root.qcHistoryMeanSdRowsHtml=qcHistoryMeanSdRowsHtml;
root.qcHistoryPointRowsHtml=qcHistoryPointRowsHtml;
/* QC_DECIMALS_DEFAULT là `const` global lexical của state.js (như REFTESTS/
   TEA_SOURCE_REGISTRY), không phải property trên globalThis — (globalThis as
   any).QC_DECIMALS_DEFAULT từng luôn undefined, làm targetNumberText(value,null)
   gọi Number(value).toFixed(undefined) (làm tròn về số nguyên, vd "3.7"→"4")
   bất cứ khi nào gọi không kèm xét nghiệm. Tham chiếu trần đúng quy tắc, kèm
   fallback bằng đúng giá trị mặc định của state.js cho sandbox chưa nạp nó. */
root.targetNumberTextPresentation=createTargetNumberText({valueDecimals:test=>(globalThis as any).testDecimalPlaces(test),statDecimals:test=>(globalThis as any).testStatDecimals(test),defaultDecimals:typeof QC_DECIMALS_DEFAULT!=='undefined'?QC_DECIMALS_DEFAULT:2});
root.targetConfigAssignedPresentation=targetConfigAssignedPresentation;
root.targetRangeDraftPresentation=createTargetRangeDraft({targetFromLimits:(low,high)=>(globalThis as any).QCCore.targetFromLimits(low,high),limitsFromTarget:(mean,sd)=>(globalThis as any).QCCore.limitsFromTarget(mean,sd)});
root.parseVnDatePresentation=parseVnDate;
root.targetRangeSyncPresentation=createTargetRangeSync({targetFromLimits:(low,high)=>(globalThis as any).QCCore.targetFromLimits(low,high),limitsFromTarget:(mean,sd)=>(globalThis as any).QCCore.limitsFromTarget(mean,sd)});
root.targetOverwritePicksPresentation=targetOverwritePicks;
root.lotGroupLotPillsHtml=lotGroupLotPillsHtml;
root.lotGroupStatusPresentation=lotGroupStatusPresentation;
root.lotGroupToggleActionPresentation=lotGroupToggleAction;
root.targetSwitchAssayNamesPresentation=targetSwitchAssayNames;
root.targetLockedBackfillNotePresentation=targetLockedBackfillNote;
root.rangeWorkflowModalHtml=rangeWorkflowModalHtml;
root.rangeApplyConfirmationModalHtml=rangeApplyConfirmationModalHtml;
root.rangeRevertConfirmationModalHtml=rangeRevertConfirmationModalHtml;
root.rangeSafetyGateHtml=rangeSafetyGateHtml;
root.rangeWorkflowChecklistRowsHtml=rangeWorkflowChecklistRowsHtml;
root.rangeNceNoticeHtml=rangeNceNoticeHtml;
root.rangeWorkflowComparisonRowsHtml=rangeWorkflowComparisonRowsHtml;
root.userPermissionsModalHtml=userPermissionsModalHtml;
root.resetPasswordModalHtml=resetPasswordModalHtml;
root.sigmaAddTestModalHtml=sigmaAddTestModalHtml;
root.sigmaAddTestRowsHtml=sigmaAddTestRowsHtml;
root.sigmaBiasModalHtml=sigmaBiasModalHtml;
root.sigmaMuModalHtml=sigmaMuModalHtml;
root.sigmaCohortModalHtml=sigmaCohortModalHtml;
root.sigmaFrequencyPanelHtml=sigmaFrequencyPanelHtml;
root.sigmaMuSummaryHtml=sigmaMuSummaryHtml;
root.sigmaStatusCardHtml=sigmaStatusCardHtml;
root.sigmaStatusPanelHtml=sigmaStatusPanelHtml;
root.sigmaOpSpecCellHtml=sigmaOpSpecCellHtml;
root.sigmaMuStateChipHtml=sigmaMuStateChipHtml;
root.sigmaMuDominantText=sigmaMuDominantText;
root.sigmaBiasSummaryHtml=sigmaBiasSummaryHtml;
root.sigmaCohortRowsHtml=sigmaCohortRowsHtml;
root.sigmaBiasRowsHtml=sigmaBiasRowsHtml;
root.sigmaMuRowsHtml=sigmaMuRowsHtml;
root.sigmaMuPreviewHtml=sigmaMuPreviewHtml;
root.sigmaTrackedOptionsHtml=sigmaTrackedOptionsHtml;
root.sigmaInputDisplayValue=sigmaInputDisplayValue;
root.sigmaGoverningRuleBlockHtml=sigmaGoverningRuleBlockHtml;
root.sigmaFrequencyRowsHtml=sigmaFrequencyRowsHtml;
root.sigmaPeriodTableHtml=sigmaPeriodTableHtml;
root.sigmaAnalysisSetupHtml=sigmaAnalysisSetupHtml;
root.sigmaPeriodRowHtml=sigmaPeriodRowHtml;
root.sigmaChartsPanelHtml=sigmaChartsPanelHtml;
root.sigmaPeriodTableHeadHtml=sigmaPeriodTableHeadHtml;
root.sigmaNoLevelsPanelHtml=sigmaNoLevelsPanelHtml;
root.actionFormClosedPresentation=actionFormClosedPresentation;
root.actionFormPanelPresentation=actionFormPanelPresentation;
root.actionImmediateStepPresentation=actionImmediateStepPresentation;
root.actionRiskStepPresentation=actionRiskStepPresentation;
root.actionInvestigationStepPresentation=actionInvestigationStepPresentation;
root.actionCauseStepPresentation=actionCauseStepPresentation;
root.actionPatientStepPresentation=actionPatientStepPresentation;
root.actionEffectivenessStepPresentation=actionEffectivenessStepPresentation;
root.actionIncidentBannerPresentation=actionIncidentBannerPresentation;
root.actionFormSectionPresentation=actionFormSectionPresentation;
root.actionInvestigationFieldPresentation=actionInvestigationFieldPresentation;
root.actionBiasContextPresentation=actionBiasContextPresentation;
root.actionLevelContextPresentation=actionLevelContextPresentation;
root.actionLevelLabelPresentation=actionLevelLabelPresentation;
root.actionSelectPresentation=actionSelectPresentation;
root.actionSuggestRowPresentation=actionSuggestRowPresentation;
root.actionSuggestBoxPresentation=actionSuggestBoxPresentation;
root.actionStaffOptionsPresentation=actionStaffOptionsPresentation;
root.actionRuleOptionsPresentation=actionRuleOptionsPresentation;
root.actionCausePhrasesPresentation=actionCausePhrasesPresentation;
root.actionPhrasesPresentation=actionPhrasesPresentation;
root.userPermissionChecksHtml=userPermissionChecksHtml;
root.userRoleSelectHtml=userRoleSelectHtml;
root.actionFormUiState=new ActionFormUiState();
root.actionFormRenderState=actionFormRenderState;
root.entrySheetMonthPart=entrySheetMonthPart;
root.entrySheetMonthValue=entrySheetMonthValue;
root.entryTreeState=createEntryTreeState({activeWestgard:test=>(globalThis as any).activeWestgard(test),operationalLevels:test=>(globalThis as any).operationalLevels(test),pointsForLot:(testId,level,lot)=>(globalThis as any).pointsForLot(testId,level,lot)});
root.entrySheetNavigation=createEntrySheetNavigation<any>({date:element=>String(element.dataset.focusDate||''),run:element=>String(element.dataset.focusRun||''),level:element=>String(element.dataset.focusLevel||'')});
root.entrySheetInputOrder=createEntrySheetInputOrder<any>({date:element=>String(element.dataset.focusDate||''),run:element=>Number(element.dataset.focusRun||0),level:element=>Number(element.dataset.focusLevel||0)});
root.entryTreeGroupState=entryTreeGroupState;
root.entryTreeNavigation=createEntryTreeNavigation<any>();
root.entrySheetFocus=createEntrySheetFocus<any>(element=>!!element.classList.contains('empty'));
root.entryColumnConfig=createEntryColumnConfig({levelConfig:qcLevelConfig,parallelLot:(test,level)=>(root as any).qcParallelLotLookup(test,level)});
root.entryRangePreset=entryRangePreset;
root.entryTreeCollapsePreference={read:readEntryTreeCollapsed,write:writeEntryTreeCollapsed};
root.entryTreeVisibility=entryTreeVisibility;
root.entryTreeKeyCommand=entryTreeKeyCommand;
root.entrySelectionState=entrySelectionState;
root.entryExpandedTablesToggle=entryExpandedTablesToggle;
root.entryVoidNceChoice=entryVoidNceChoice;
root.entryVoidReasonValid=entryVoidReasonValid;
root.entryRecordErrorMessage=entryRecordErrorMessage;
root.entrySaveFeedback=entrySaveFeedback;
root.entryExtraRunRequest=entryExtraRunRequest;
root.entryDateNoteFeedback=entryDateNoteFeedback;
root.entryDateNoteErrorMessage=entryDateNoteErrorMessage;
root.entryDateRangeInput=createEntryDateRangeInput(value=>(root as any).parseVN(value));
root.westgardUiState=westgardUiState;
root.westgardModeTabs=westgardModeTabs;
root.westgardTestSearch=createWestgardTestSearch<any>({text:(value:any)=>(root as any).searchText(value),label:(test:any)=>(root as any).testSelectLabel(test),id:(test:any)=>test.id});
root.westgardMultiViews=createWestgardMultiViews<any,any>({levels:(test:any)=>(root as any).operationalLevels(test),points:(test:any,level:any)=>(root as any).operationalLotPoints(test,level),previous:(test:any,level:any)=>(root as any).previousLotSeries(test,level),build:(input:any)=>(root as any).WestgardViewModel.buildMultiViews(input)});
root.westgardCusumLevels=createWestgardCusumLevels<any,any,any>({levels:(test:any)=>(root as any).operationalLevels(test),points:(test:any,level:any)=>(root as any).operationalLotPoints(test,level)});
root.westgardPointRowsHtml=createWestgardPointRowsHtml<any>({verdictLabel:(level:any)=>(root as any).qcVerdictLabel(level),errorParts:(rules:any)=>(root as any).errorTypeDetailParts(rules),escape:(value:any)=>(root as any).esc(value),date:(value:any)=>(root as any).vnDate(value),testValue:(test:any,value:any)=>(root as any).fmtTestValue(test,value),format:(value:any)=>(root as any).fmt(value),referenceIcon:()=> (root as any).icoRefArrow()});
root.westgardRowsControl=createWestgardRowsControl({button:(label,action,variant)=>(root as any).btn(label,action,variant),quote:(value:any)=>(root as any).jsq(value)});
root.westgardCusumPageHtml=createWestgardCusumPageHtml<any>({empty:(title,message,action)=>(root as any).emptyState(title,message,action),button:(label,action,variant)=>(root as any).btn(label,action,variant),escape:(value:any)=>(root as any).esc(value),testValue:(test:any,value:any)=>(root as any).fmtTestValue(test,value),format:(value:any,decimals?:number)=>(root as any).fmt(value,decimals),quote:(value:any)=>(root as any).jsq(value)});
root.westgardLotBlockHtml=createWestgardLotBlockHtml({testValue:(test:any,value:any)=>(root as any).fmtTestValue(test,value),empty:(title,message)=>(root as any).emptyState(title,message),buildRows:(test:any,level:any,lotNo:any,mean:any,sd:any,points:any[])=>{const wgP=(root as any).QCCore.westgardByPoint(points,mean,sd,(rule:any)=>(root as any).testRuleOnWithin(test,rule)),rows=(root as any).WestgardViewModel.buildPointRows({points,verdicts:wgP.F.map((f:any)=>({rules:f.rules,supportRules:f.supportRules,level:(root as any).ruleResultLevel(test,f.rules)})),zs:wgP.zs,mean,sd}),key=`lot:${test.id}|${level}|${lotNo}`;return{key,view:(root as any).wgRowsWindow(rows,key)};},pointRows:(rows:any[],test:any)=>(root as any).westgardPointRowsHtml(rows,test),rowsControl:(view:any,key:string)=>(root as any).westgardRowsControl(view,key,120)});
root.westgardRuleGuideHtml=createWestgardRuleGuideHtml({escape:(value:any)=>(root as any).esc(value),referenceIcon:()=> (root as any).icoRefArrow()});
root.westgardRuleTogglesHtml=createWestgardRuleTogglesHtml({button:(label,action,variant)=>(root as any).btn(label,action,variant)});
root.westgardExportActionsHtml=createWestgardExportActionsHtml({button:(label,action,variant,title)=>(root as any).btn(label,action,variant,title),downloadIcon:()=> (root as any).icoDownload(),printIcon:()=> (root as any).icoPrint()});
const westgardPageController=createWestgardPageController({
  document:typeof document!=='undefined'?document:({getElementById:()=>null} as unknown as Document),
  getState:()=>state,
  ui:()=>(root as any).AnalysisUIState,
  rerender:()=>rerender(),
  ruleRegistry:()=>(root.QCCore as any).WG_RULE_REGISTRY,
  wgOn:rule=>(root as any).wgOn(rule),
  searchText:value=>root.normalizeSearchText!(value),
  esc:value=>(root as any).esc(value),
  escapeAttr:value=>(root as any).escAttr(value),
  vnDate:value=>vnDate(value),
  headOnly:(title,subtitle,actions)=>(root as any).headOnly(title,subtitle,actions),
  emptyState:(title,body,actions)=>(root as any).emptyState(title,body,actions),
  button:(label,action,cls,title,options)=>(root as any).btn(label,action,cls,title,options),
  role:()=>root.role(),
  canWrite:()=>root.canWrite(),
  fmtTestValue:(test,value)=>(root as any).fmtTestValue(test,value),
  operationalTests:()=>(root as any).operationalTests(),
  operationalTestOrder:test=>(root as any).operationalTestOrder(test),
  levelsForLotGroup:group=>(root as any).levelsForLotGroup(group),
  lotPointsByNo:(testId,level,lotNo)=>(root as any).lotPointsByNo(testId,level,lotNo),
  testDisplayName:test=>(root as any).testDisplayName(test),
  instrumentName:test=>(root as any).instrumentName(test),
  activeWestgard:test=>(root as any).activeWestgard(test),
  testSelectLabel:test=>(root as any).testSelectLabel(test),
  previousLotSeries:(test,level)=>(root as any).previousLotSeries(test,level),
  levelTargetOk:level=>(root as any).levelTargetOk(level),
  testCusumConfig:test=>(root as any).testCusumConfig(test),
  scheduleSearchRender:(owner,apply,focusId)=>root.scheduleSearchRender(owner,apply,focusId),
  replaceSelectItems:(select,items,emptyText)=>root.replaceSelectItems(select,items,emptyText),
  westgardViewModel:{buildPointRows:input=>(root as any).WestgardViewModel.buildPointRows(input)},
  qcLotById:id=>((state as any).qcLots||[]).find((x:any)=>x.id===id),
  westgardMultiViews:(test,prevOpen)=>(root as any).westgardMultiViews(test,prevOpen),
  westgardUiState:(root as any).westgardUiState,
  westgardArchivedGroups:groups=>root.westgardArchivedGroups!(groups),
  westgardModeTabs:{chart:mode=>(root as any).westgardModeTabs.chart(mode),view:(mode,count)=>(root as any).westgardModeTabs.view(mode,count)},
  westgardCusumLevels:test=>(root as any).westgardCusumLevels(test),
  westgardCusumPageHtml:input=>(root as any).westgardCusumPageHtml(input),
  westgardRowsWindow:(rows,expanded,initial)=>(root as any).westgardRowsWindow(rows,expanded,initial),
  westgardRowsControl:(view,key,initial)=>(root as any).westgardRowsControl(view,key,initial),
  westgardLotBlockHtml:input=>root.westgardLotBlockHtml(input),
  westgardArchivedMultiViews:(rows,points)=>root.westgardArchivedMultiViews!(rows,points),
  westgardArchivedGroupMatches:(group,q,st,lotById)=>root.westgardArchivedGroupMatches!(group,q,st,lotById),
  westgardArchivedTestSelection:(entries,q,selected,d)=>root.westgardArchivedTestSelection!(entries,q,selected,d),
  westgardPointRowsHtml:(rows,test)=>(root as any).westgardPointRowsHtml(rows,test),
  westgardRuleTogglesHtml:(registry,wgOn,canWrite)=>(root as any).westgardRuleTogglesHtml(registry,wgOn,canWrite),
  westgardExportActionsHtml:chartMode=>(root as any).westgardExportActionsHtml(chartMode),
  westgardRuleGuideHtml:registry=>(root as any).westgardRuleGuideHtml(registry),
  westgardTestSearch:{select:(tests,q,selected)=>(root as any).westgardTestSearch.select(tests,q,selected)},
});
(root as any).wgMultiViews=westgardPageController.wgMultiViews;
(root as any).wgTogglePrevLot=westgardPageController.wgTogglePrevLot;
(root as any).wgArchivedGroups=westgardPageController.wgArchivedGroups;
(root as any).wgSetViewMode=westgardPageController.wgSetViewMode;
(root as any).wgSetChartMode=westgardPageController.wgSetChartMode;
(root as any).wgChartModeTabs=westgardPageController.wgChartModeTabs;
(root as any).pageWestgardCusum=westgardPageController.pageWestgardCusum;
(root as any).wgSetArchivedGroup=westgardPageController.wgSetArchivedGroup;
(root as any).wgSetArchivedTest=westgardPageController.wgSetArchivedTest;
(root as any).wgViewModeTabs=westgardPageController.wgViewModeTabs;
(root as any).wgRowsWindow=westgardPageController.wgRowsWindow;
(root as any).wgToggleRows=westgardPageController.wgToggleRows;
(root as any).wgRowsControl=westgardPageController.wgRowsControl;
(root as any).wgLotBlock=westgardPageController.wgLotBlock;
(root as any).wgArchivedMultiViews=westgardPageController.wgArchivedMultiViews;
(root as any).wgArchivedGroupMatches=westgardPageController.wgArchivedGroupMatches;
(root as any).pageWestgardArchived=westgardPageController.pageWestgardArchived;
(root as any).pageWestgard=westgardPageController.pageWestgard;
(root as any).wgFilterTests=westgardPageController.wgFilterTests;
(root as any).wgFilterArchivedTests=westgardPageController.wgFilterArchivedTests;
root.dashboardStatusTabsHtml=createDashboardStatusTabsHtml({matches:(item:any,key:string)=>(root as any).dashboardStatusFilter.matches(item,key)});
root.dashboardExpiringLotsHtml=createDashboardExpiringLotsHtml({escape:(value:any)=>(root as any).esc(value)});
const dashboardQcFollowupItemHtml=createDashboardQcFollowupItemHtml({escape:(value:any)=>(root as any).esc(value),testLabel:(test:any)=>(root as any).testDisplayName(test),date:(value:any)=>(root as any).vnDate(value),pointValue:(point:any,test:any)=>(root as any).fmtPointValue(point,test),button:(label,action,variant)=>(root as any).btn(label,action,variant),quote:(value:any)=>(root as any).jsq(value)});
const dashboardMissingTargetItemHtml=createDashboardMissingTargetItemHtml({escape:(value:any)=>(root as any).esc(value),testLabel:(test:any)=>(root as any).testDisplayName(test),button:(label,action,variant)=>(root as any).btn(label,action,variant)});
const dashboardOverdueActionItemHtml=createDashboardOverdueActionItemHtml({escape:(value:any)=>(root as any).esc(value),testLabel:(test:any)=>(root as any).testDisplayName(test),date:(value:any)=>(root as any).vnDate(value),button:(label,action,variant)=>(root as any).btn(label,action,variant)});
const dashboardStatusTags=dashboardTestStatusTags;
const dashboardLevelPillHtml=createDashboardLevelPillHtml({escape:(value:any)=>(root as any).esc(value),format:(value:any)=>(root as any).fmt(value)});
const dashboardRank=dashboardTestRank;
const dashboardLatestPointText=createDashboardLatestPointText({date:(value:any)=>(root as any).vnDate(value),pointValue:(point:any,test:any)=>(root as any).fmtPointValue(point,test)});
root.dashboardFollowupPanelHtml=dashboardFollowupPanelHtml;
const dashboardTestSearchText=createDashboardTestSearchText({normalize:(value:any)=>(root as any).searchText(value),label:(test:any)=>(root as any).testDisplayName(test)});
const dashboardLatestPoint=createDashboardLatestPoint<any>({runNumber:(point:any)=>(root as any).pointRunNo(point)});
root.dashboardKpisHtml=dashboardKpisHtml;
root.dashboardProgressHtml=dashboardProgressHtml;
root.dashboardHeadHtml=createDashboardHeadHtml({escape:(value:any)=>(root as any).esc(value),topUserBox:()=>typeof (globalThis as any).topUserBox==='function'?(globalThis as any).topUserBox():''});
root.dashboardTestPanelHtml=createDashboardTestPanelHtml({escapeAttr:(value:any)=>(root as any).escAttr(value)});
const dashboardTestRowHtml=createDashboardTestRowHtml({escape:(value:any)=>(root as any).esc(value),escapeAttr:(value:any)=>(root as any).escAttr(value)});
root.dashboardKpiItems=dashboardKpiItems;
root.dashboardEmptyTestsHtml=createDashboardEmptyTestsHtml({emptyState:(title,detail,action)=>(root as any).emptyState(title,detail,action),button:(label,action,variant)=>(root as any).btn(label,action,variant)});
root.cusumColors=CUSUM_COLORS;
root.leveyJenningsMultiColors=LEVEY_JENNINGS_MULTI_COLORS;
root.cusumChartTitle=createCusumChartTitle({format:(value:number,digits:number)=>(root as any).fmt(value,digits)});
root.leveyJenningsChartTitle=LEVEY_JENNINGS_CHART_TITLE;
root.chartEmptyLabels=CHART_EMPTY_LABELS;
root.leveyJenningsMultiYAxis=leveyJenningsMultiYAxis;
root.leveyJenningsMultiGeometry=leveyJenningsMultiGeometry;
root.cusumDisplayPlan=createCusumDisplayPlan(input=>chartViewModel.sampleIndices(input));
root.cusumHoverModel=createCusumHoverModel({date:value=>vnDate(value),number:(value,decimals)=>(root as any).fmt(value,decimals)});
const qcChartRenderer=createQcChartRenderer({
  hiDpiCanvasSetup:canvas=>root.hiDpiCanvasSetup!(canvas),
  leveyJenningsGeometry:input=>root.leveyJenningsGeometry!(input),
  leveyJenningsColors:root.leveyJenningsColors as any,
  leveyJenningsBandRects:input=>root.leveyJenningsBandRects!(input),
  findTest:id=>(state.tests||[]).find((test:any)=>test.id===id),
  leveyJenningsYAxisLabels:(test,mean,sd)=>root.leveyJenningsYAxisLabels!(test,mean,sd),
  leveyJenningsGridLines:(axis,mean,sd,y)=>root.leveyJenningsGridLines!(axis,mean,sd,y),
  canvasFont:(weight,token,fallback)=>root.canvasFont!(weight,token,fallback),
  leveyJenningsChartTitle:root.leveyJenningsChartTitle as any,
  chartEmptyLabels:root.chartEmptyLabels as any,
  leveyJenningsTooltipController:canvas=>root.leveyJenningsTooltipController!(canvas),
  lvlCfg:(test,level)=>lvlCfg(test,level),
  westgard:(points,mean,sd,scope)=>(root.QCCore as any).westgard(points,mean,sd,scope),
  westgardRuleScope:root.westgardRuleScope as any,
  leveyJenningsPointRenderModel:input=>root.leveyJenningsPointRenderModel!(input),
  leveyJenningsTicks:points=>root.leveyJenningsTicks!(points),
  chartDataUrl:input=>root.chartDataUrl!(input),
  leveyJenningsMultiGeometry:input=>root.leveyJenningsMultiGeometry!(input),
  leveyJenningsMultiSeries:input=>root.leveyJenningsMultiSeries!(input),
  leveyJenningsMultiColors:root.leveyJenningsMultiColors as any,
  westgardMultiByPoint:(levels,scope)=>(root.QCCore as any).westgardMultiByPoint(levels,scope),
  westgardByPoint:(points,mean,sd,scope)=>(root.QCCore as any).westgardByPoint(points,mean,sd,scope),
  leveyJenningsMultiPointRenderModel:input=>root.leveyJenningsMultiPointRenderModel!(input),
  leveyJenningsMultiDividers:(levels,runs,runIndex,xOfRun)=>root.leveyJenningsMultiDividers!(levels,runs,runIndex,xOfRun),
  leveyJenningsMultiRunTicks:(runs,all)=>root.leveyJenningsMultiRunTicks!(runs,all),
  leveyJenningsLegendLayout:(levels,colors,startX,measure)=>root.leveyJenningsLegendLayout!(levels,colors,startX,measure),
  leveyJenningsMultiYAxis:()=>root.leveyJenningsMultiYAxis!(),
  cusumChartGeometry:input=>root.cusumChartGeometry!(input),
  cusumReferenceLines:input=>root.cusumReferenceLines!(input),
  cusumColors:root.cusumColors as any,
  cusumChartTitle:(k,h)=>root.cusumChartTitle!(k,h),
  format:(value,decimals)=>fmt(value,decimals),
  cusumDisplayPlan:input=>root.cusumDisplayPlan!(input),
  cusumLinePoints:input=>root.cusumLinePoints!(input),
  cusumPointRenderModel:input=>root.cusumPointRenderModel!(input),
  cusumHoverModel:input=>root.cusumHoverModel!(input),
});
root.drawLJ=qcChartRenderer.drawLJ;
root.ljDataURL=qcChartRenderer.ljDataURL;
root.drawLJMultiZ=qcChartRenderer.drawLJMultiZ;
root.ljMultiDataURL=qcChartRenderer.ljMultiDataURL;
root.drawCUSUM=qcChartRenderer.drawCUSUM;
root.configNavScrollService=createConfigNavScrollService({find:()=>typeof document==='undefined'?null:document.querySelector('.config-shell-nav') as any,getPosition:()=>Number((root as any).__configNavScrollPosition)||0,setPosition:value=>{(root as any).__configNavScrollPosition=value;}});
root.entryJumpScrollService=createEntryJumpScrollService({findWrap:()=>typeof document==='undefined'?null:document.querySelector('.qc-sheet-wrap') as any,findTodayRow:()=>typeof document==='undefined'?null:document.querySelector('.qc-sheet tbody tr.today') as any});
root.defaultDateFieldsService=createDefaultDateFieldsService({find:id=>typeof document==='undefined'?null:document.getElementById(id) as any});
root.postRenderPageActions=createPostRenderPageActions({requestFrame:work=>requestAnimationFrame(work)});
root.afterRender=createAfterRenderController({document:typeof document!=='undefined'?document:({querySelectorAll:()=>[]} as unknown as Document),canvas:root.afterRenderCanvasService,tests:()=>state.tests||[],levelConfig:(test,level)=>lvlCfg(test,level),buildLeveyJennings:input=>ChartViewModel.buildLeveyJennings(input),acceptedLotPoints:(test,level)=>acceptedLotPoints(test,level),drawLeveyJennings:(canvas,points,mean,sd)=>qcChartRenderer.drawLJ(canvas,points,mean,sd),entryCache:()=>entryLjRenderCache,multiViews:test=>wgMultiViews(test),buildMultiLevel:input=>ChartViewModel.buildMultiLevel(input),drawMultiLevel:(canvas,chart,test)=>qcChartRenderer.drawLJMultiZ(canvas,chart,test),lotGroups:()=>((state as any).lotGroups||[]),levelsForLotGroup:group=>levelsForLotGroup(group),archivedMultiViews:levels=>wgArchivedMultiViews(levels),operationalLotPoints:(test,level)=>operationalLotPoints(test,level),cusumSeries:(test,level)=>cusumSeries(test,level),buildCusum:input=>ChartViewModel.buildCusum(input),drawCusum:(canvas,points,series)=>qcChartRenderer.drawCUSUM(canvas,points,series),fillDefaultDates:()=>root.defaultDateFieldsService.fill(['eDate','aDate'],vnDate(isoToday())),runPageActions:()=>root.postRenderPageActions.run(page,{reagent:rcCompute,sigma:sgRefresh}),consumeEntryJump:()=>{if(!entryJumpToday)return false;entryJumpToday=false;return true;},requestFrame:work=>requestAnimationFrame(work),scrollEntryJump:()=>root.entryJumpScrollService.scroll(),updateSaveStatus:()=>updateSaveStatus(),updateBackupBanner:()=>updateBackupBanner(),restoreConfigNavScroll:()=>root.configNavScrollService.restore()}).afterRender;
root.dashboardOverdueActions=createDashboardOverdueActions({overdue:action=>(root as any).actionOverdue(action)});
root.dashboardOverdueActionListHtml=createDashboardOverdueActionListHtml({render:item=>dashboardOverdueActionItemHtml(item)});
root.dashboardQcFollowupListHtml=createDashboardQcFollowupListHtml({render:(item,kind)=>dashboardQcFollowupItemHtml(item,kind)});
root.dashboardMissingTargetListHtml=createDashboardMissingTargetListHtml({render:item=>dashboardMissingTargetItemHtml(item)});
root.dashboardExpiringLotItems=dashboardExpiringLotItems;
root.dashboardWestgardAlerts=dashboardWestgardAlerts;
root.dashboardMissingTargetItems=dashboardMissingTargetItems;
const dashboardLevelData=createDashboardLevelData({stats:(values:number[])=>(root as any).stats(values)});
const dashboardTestAction=createDashboardTestAction({button:(label,action,variant)=>(root as any).btn(label,action,variant)});
const dashboardLevelPillsHtml=createDashboardLevelPillsHtml({targetOk:level=>(root as any).levelTargetOk(level),render:input=>dashboardLevelPillHtml(input)});
root.dashboardTestRowsHtml=createDashboardTestRowsHtml({statusTag:status=>dashboardStatusTags.westgard(status),todayTag:(count,total)=>dashboardStatusTags.today(count,total),levelsHtml:levels=>dashboardLevelPillsHtml(levels),latestText:(point,test)=>dashboardLatestPointText(point,test),rank:(status,count,total)=>dashboardRank(status,count,total),rowHtml:input=>dashboardTestRowHtml(input),actionHtml:(testId,level)=>dashboardTestAction(testId,Number(level)),testDisplayName:test=>(root as any).testDisplayName(test)});
root.dashboardTestItems=createDashboardTestItems({activeWestgard:test=>(root as any).activeWestgard(test),summarize:input=>(root as any).WestgardViewModel.summarizeTestStatus(input),levelData:(views,today)=>dashboardLevelData(views,today),latestPoint:points=>dashboardLatestPoint(points),searchText:(test,levels)=>dashboardTestSearchText(test,levels),markStatus:(testId,status)=>(root as any).statusMemo.set(testId,status)});
root.dashboardTestListHtml=dashboardTestListHtml;
root.dashboardPageHtml=createDashboardPageHtml();
const dashboardPageController=createDashboardPageController({
  operationalTests:()=>(root as any).operationalTests(),
  isWestgardMemoized:testId=>wgMemo.has(testId),
  scheduleWestgardPrewarm:tests=>(root as any).scheduleWestgardPrewarm(tests),
  isoToday:()=>isoToday(),
  stateData:()=>state.data||{},
  stateLab:()=>state.lab,
  stateActions:()=>state.actions||[],
  stateTests:()=>state.tests||[],
  role:()=>role(),
  vnDate:iso=>vnDate(iso),
  levelsMissingTarget:test=>(root as any).levelsMissingTarget(test),
  daysToExp:value=>(root as any).daysToExp(value),
  dashboardTestItems:root.dashboardTestItems,
  dashboardKpis:root.dashboardKpis,
  dashboardMissingTargetItems:root.dashboardMissingTargetItems,
  dashboardWestgardAlerts:root.dashboardWestgardAlerts,
  dashboardExpiringLotItems:root.dashboardExpiringLotItems,
  dashboardExpiringLots:root.dashboardExpiringLots,
  dashboardQcFollowupListHtml:root.dashboardQcFollowupListHtml,
  dashboardOverdueActions:root.dashboardOverdueActions,
  dashboardOverdueActionListHtml:root.dashboardOverdueActionListHtml,
  dashboardMissingTargetListHtml:root.dashboardMissingTargetListHtml,
  dashboardFollowupPanelHtml:root.dashboardFollowupPanelHtml,
  dashboardExpiringLotsHtml:root.dashboardExpiringLotsHtml,
  dashboardStatusTabsHtml:root.dashboardStatusTabsHtml,
  dashboardStatusFilter:root.dashboardStatusFilter,
  dashboardTestRowsHtml:root.dashboardTestRowsHtml,
  dashboardTestListHtml:root.dashboardTestListHtml,
  dashboardShiftStatus:root.dashboardShiftStatus,
  dashboardHeadHtml:root.dashboardHeadHtml,
  dashboardProgressHtml:root.dashboardProgressHtml,
  dashboardKpisHtml:root.dashboardKpisHtml,
  dashboardKpiItems:root.dashboardKpiItems,
  dashboardTestPanelHtml:root.dashboardTestPanelHtml,
  dashboardEmptyTestsHtml:root.dashboardEmptyTestsHtml,
  dashboardPageHtml:root.dashboardPageHtml,
  dashboardLoadingPresentation:root.dashboardLoadingPresentation,
  dashTestQ:()=>(root as any).dashTestQ,
  dashTestStatus:()=>(root as any).dashTestStatus,
  setDashTestQ:value=>{(root as any).AnalysisUIState.dashTestQ=value;},
  setDashTestStatus:value=>{(root as any).AnalysisUIState.dashTestStatus=value;},
  liveRowFilter:(selector,query,opts)=>(root as any).liveRowFilter(selector,query,opts),
  rerender:()=>rerender(),
});
root.pageDash=dashboardPageController.pageDash;
root.pageDashLoading=dashboardPageController.pageDashLoading;
root.dashTestFilter=dashboardPageController.dashTestFilter;
root.dashTestSetStatus=dashboardPageController.dashTestSetStatus;
root.icon=icon;root.icoCal=icoCal;root.icoDownload=icoDownload;root.icoPrint=icoPrint;root.icoRefArrow=icoRefArrow;
const routerPermission=createRouterPermission({currentUser:()=>currentUser,infoDialog:message=>root.infoDialog(message),roles:()=>root.routerPagePolicy.roles});
root.role=routerPermission.role;root.canWrite=routerPermission.canWrite;root.requireWrite=routerPermission.requireWrite;root.requireAdmin=routerPermission.requireAdmin;root.roleLabel=routerPermission.roleLabel;root.roleSelectOptions=routerPermission.roleSelectOptions;
root.PAGES=root.routerPagePolicy.pages;
root.rolePageIds=(r=routerPermission.role())=>root.routerPagePolicy.rolePageIds(r);
root.userPageIds=(u=currentUser)=>root.routerPagePolicy.userPageIds(u);
root.canAccessPage=(id,u=currentUser)=>root.routerPagePolicy.canAccessPage(id,u);
root.firstAccessPage=(u=currentUser)=>root.routerPagePolicy.firstAccessPage(u);
const liveRowFilterService=createLiveRowFilter({document:typeof document!=='undefined'?document:({querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>({})} as unknown as Document),searchText:value=>root.normalizeSearchText!(value)});
root.setSearchCount=liveRowFilterService.setSearchCount;root.showSearchEmpty=liveRowFilterService.showSearchEmpty;root.replaceSelectItems=liveRowFilterService.replaceSelectItems;root.liveRowFilter=liveRowFilterService.liveRowFilter;root.scheduleSearchRender=liveRowFilterService.scheduleSearchRender;
root.dateBox=createDateBoxHtml({vnPickerParse:value=>root.vnDatePickerController.parse(value),parseVN:value=>root.parseVnDatePresentation!(value),escapeAttr:value=>(root as any).escAttr(value),formatVnDate:value=>vnDate(value)});
const uiPrimitives=createUiPrimitives({currentUser:()=>currentUser,escape:value=>(root as any).esc(value),escapeAttr:value=>(root as any).escAttr(value),roleLabel:r=>routerPermission.roleLabel(r)});
root.btn=uiPrimitives.btn;root.emptyState=uiPrimitives.emptyState;root.topUserBox=uiPrimitives.topUserBox;root.headOnly=uiPrimitives.headOnly;
root.rangeActions=createRangeActionsHtml({button:(label,action,cls,title)=>root.btn(label,action,cls,title),canWrite:()=>routerPermission.canWrite()});
root.brandTitle=()=>root.routerShell.brandTitle();
root.brandSub=()=>root.routerShell.brandSub();
root.brandMarkText=()=>root.routerShell.brandMarkText();
root.brandLogo=()=>root.routerShell.brandLogo();
root.renderBrand=()=>root.routerShell.renderBrand();
root.nav=()=>root.routerShell.nav({page:root.page,user:currentUser,icon:id=>root.icon(id)});
root.licensedLabName=()=>root.routerShell.licensedLabName();
root.trialInfo=()=>root.routerShell.trialInfo();
root.sideFoot=()=>root.routerShell.sideFoot();
root.toggleSidebarNav=()=>root.routerShell.toggleSidebarNav();
root.vnPickerParse=value=>root.vnDatePickerController.parse(value);
root.vnPickerValid=(y,m,d)=>root.vnDatePickerController.valid(y,m,d);
root.vnPickerText=iso=>root.vnDatePickerController.text(iso);
root.vnPickerOpen=datebox=>root.vnDatePickerController.open(datebox);
root.vnPickerClose=()=>root.vnDatePickerController.close();
root.vnPickerMove=months=>root.vnDatePickerController.move(months);
root.vnPickerMode=mode=>root.vnDatePickerController.mode(mode);
root.vnPickerSetYear=year=>root.vnDatePickerController.setYear(year);
root.vnPickerSetMonth=month=>root.vnDatePickerController.setMonth(month);
root.vnPickerPick=iso=>root.vnDatePickerController.pick(iso);
root.vnDatePickerController.bind();
root.stateName=s=>root.reportLabels.stateName(s);
root.qcVerdictLabel=level=>root.reportLabels.verdictLabel(level);
const routerDispatch=createRouterDispatchController({
  document:typeof document!=='undefined'?document:({querySelectorAll:()=>[],getElementById:()=>null,querySelector:()=>null} as unknown as Document),
  window:typeof window!=='undefined'?window:{scrollTo:()=>{}},
  canAccessPage:id=>root.canAccessPage(id),
  firstAccessPage:()=>root.firstAccessPage(),
  page:()=>root.page,
  setPage:id=>{(root as any).RouterUIState.page=id;},
  nav:()=>root.nav(),
  requestFrame:work=>requestAnimationFrame(work),
  resetStatusMemo:()=>{(root as any).AnalysisUIState.statusMemo=new Map();},
  pageMap:()=>({dash:root.pageDash,entry:(root as any).pageEntry,westgard:(root as any).pageWestgard,sigma:(root as any).pageSigma,reagent:(root as any).pageReagent,actions:(root as any).pageActionsV4,report:(root as any).pageReportV2,manage:(root as any).pageManage,users:(root as any).pageUsers,audit:(root as any).pageAudit,settings:(root as any).pageSettings}),
  afterRender:p=>root.afterRender(p),
  dashTestQ:()=>(root as any).dashTestQ,
  entryQ:()=>(root as any).entryQ,
  dashTestFilter:v=>root.dashTestFilter(v),
  entryFilter:v=>(root as any).entryFilter(v),
});
root.go=routerDispatch.go;root.resetMainScroll=routerDispatch.resetMainScroll;root.render=routerDispatch.render;root.restoreRouteFilters=routerDispatch.restoreRouteFilters;root.rerender=routerDispatch.rerender;
root.actionGuideContent=createActionGuideContent({escape:(value:any)=>(root as any).esc(value),button:(label,action,variant)=>(root as any).btn(label,action,variant)});
root.actionPageHtml=createActionPageHtml();
root.actionSideChipsHtml=createActionSideChipsHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionDetailCheckHtml=createActionDetailCheckHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionEvidenceTimelinePresentation=createActionEvidenceTimelineHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionReviewButtonsHtml=createActionReviewButtonsHtml({button:(label,action,variant,title)=>(root as any).btn(label,action,variant,title)});
root.actionRerunEvidencePresentation=createActionRerunEvidenceHtml<any>({escape:(value:any)=>(root as any).esc(value),pointValue:(point:any,test:any)=>(root as any).fmtPointValue(point,test),date:(value:any)=>(root as any).vnDate(value),button:(label,action,variant,title)=>(root as any).btn(label,action,variant,title),quote:(value:any)=>(root as any).jsq(value)});
root.actionIssueRowPresentation=createActionIssueRowHtml({escape:(value:any)=>(root as any).esc(value),button:(label,action,variant)=>(root as any).btn(label,action,variant),quote:(value:any)=>(root as any).jsq(value)});
root.actionOpenIssuePresentation=createActionOpenIssueHtml({escape:(value:any)=>(root as any).esc(value),button:(label,action,variant)=>(root as any).btn(label,action,variant)});
root.actionIssueGroupPresentation=createActionIssueGroupHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionLogRowPresentation=createActionLogRowHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionApprovalTagPresentation=createActionApprovalTagHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionDetailMetaHtml=createActionDetailMetaHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionCancelledAlertHtml=createActionCancelledAlertHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionCancelModalHtml=actionCancelModalHtml;
root.actionReviewNoteModalHtml=actionReviewNoteModalHtml;
root.actionReopenModalHtml=actionReopenModalHtml;
root.actionDetailModalHtml=actionDetailModalHtml;
root.actionLegacyDetailHtml=createActionLegacyDetailHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionContainmentDetailHtml=createActionContainmentDetailHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionInspectionDetailsHtml=createActionInspectionDetailsHtml();
root.actionPatientImpactHtml=createActionPatientImpactHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionCauseDetailHtml=createActionCauseDetailHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionEffectivenessDetailHtml=createActionEffectivenessDetailHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionLogPanelHtml=createActionLogPanelHtml({button:(label,action,variant)=>(root as any).btn(label,action,variant),emptyState:(title,text)=>(root as any).emptyState(title,text)});
root.actionIssuesPanelHtml=actionIssuesPanelHtml;
root.manageToolbarPresentation=createManageToolbarHtml({escape:(value:any)=>(root as any).esc(value),escapeAttr:(value:any)=>(root as any).escAttr(value),button:(label,action,variant)=>(root as any).btn(label,action,variant)});
root.managePageHtml=createManagePageHtml();
root.manageShellPresentation=createManageShellHtml({escape:(value:any)=>(root as any).esc(value)});
root.manageInstrumentRowPresentation=createManageInstrumentRowHtml({escape:(value:any)=>(root as any).esc(value),button:(label,action,variant)=>(root as any).btn(label,action,variant),quote:(value:any)=>(root as any).jsq(value)});
root.manageInstrumentTablePresentation=manageInstrumentTableHtml;
root.managePanelRowPresentation=createManagePanelRowHtml({escape:(value:any)=>(root as any).esc(value),button:(label,action,variant)=>(root as any).btn(label,action,variant),quote:(value:any)=>(root as any).jsq(value)});
root.managePanelTablePresentation=managePanelTableHtml;
root.manageLotRowPresentation=createManageLotRowHtml({escape:(value:any)=>(root as any).esc(value),button:(label,action,variant)=>(root as any).btn(label,action,variant),quote:(value:any)=>(root as any).jsq(value)});
root.manageLotConfigLayoutPresentation=manageLotConfigLayoutHtml;
root.manageLotGroupCardPresentation=createManageLotGroupCardHtml({escape:(value:any)=>(root as any).esc(value)});
root.manageTransitionRowPresentation=createManageTransitionRowHtml({escape:(value:any)=>(root as any).esc(value),button:(label,action,variant)=>(root as any).btn(label,action,variant),quote:(value:any)=>(root as any).jsq(value)});
root.manageTransitionTablePresentation=manageTransitionTableHtml;
root.manageTransitionDetailsPresentation=manageTransitionDetailsHtml;
root.teaReferenceAddModalPresentation=teaReferenceAddModalHtml;
root.teaReferenceLabProfileBodyPresentation=teaReferenceLabProfileBodyHtml;
root.teaReferenceLabProfileModalHtml=teaReferenceLabProfileModalHtml;
root.teaReferenceRowPresentation=teaReferenceRowHtml;
root.teaReferenceTablePresentation=teaReferenceTableHtml;
root.teaSourceRegistryPresentation=createTeaSourceRegistryHtml({escape:(value:any)=>(root as any).esc(value),escapeAttr:(value:any)=>(root as any).escAttr(value)});
root.manageHistoryRowPresentation=createManageHistoryRowHtml({escape:(value:any)=>(root as any).esc(value),button:(label,action,variant)=>(root as any).btn(label,action,variant),quote:(value:any)=>(root as any).jsq(value)});
root.manageSearchPlaceholderPresentation=manageSearchPlaceholder;
root.manageAssayRowPresentation=createManageAssayRowHtml({escape:(value:any)=>(root as any).esc(value),button:(label,action,variant)=>(root as any).btn(label,action,variant),quote:(value:any)=>(root as any).jsq(value)});
root.manageAssayTablePresentation=manageAssayTableHtml;
root.teaReferenceStatusPresentation=teaReferenceStatusHtml;
root.manageTransitionStatusPresentation=manageTransitionStatus;
root.manageLotStatusPresentation=createManageLotStatus({daysToExpiry:(value:any)=>(root as any).daysToExp(value)});
root.manageInstrumentNamePresentation=manageInstrumentName;
root.manageLotLabelPresentation=manageLotLabel;
root.managePanelNamePresentation=managePanelName;
root.manageLotGroupLabelsPresentation=manageLotGroupLabels;
root.groupsOfLotPresentation=groupsOfLotTs;
root.targetGroupLotsPresentation=targetGroupLotsTs;
root.targetGroupLabelPresentation=targetGroupLabel;
root.targetGroupStatusSuffixPresentation=targetGroupStatusSuffix;
root.targetPanelLabelPresentation=targetPanelLabel;
root.targetPanelTestsPresentation=targetPanelTests;
root.targetPanelOptionsPresentation=targetPanelOptionsHtml;
root.targetGroupOptionsPresentation=targetGroupOptionsHtml;
root.targetSelectionPresentation=targetSelection;
root.targetLevelSelectionPresentation=targetLevelSelection;
root.historySearchValuesPresentation=historySearchValues;
root.teaLabBasisLabelPresentation=teaLabBasisLabel;
root.targetLevelLotsPresentation=targetLevelLots;
root.targetSearchValuesPresentation=targetSearchValues;
root.historyAssayOptionsPresentation=historyAssayOptionsHtml;
root.historyAssaySelectionPresentation=historyAssaySelection;
root.historyVisibleRowsPresentation=historyVisibleRows;
root.historyRowSortPresentation=sortHistoryRows;
root.historySummaryPresentation=historySummary;
root.teaSourceRegistryItemsPresentation=teaSourceRegistryItems;
root.manageSearchMatchPresentation=manageSearchMatch;
root.lotTransitionTargetNumberPresentation=lotTransitionTargetNumber;
root.historyPeriodLabelPresentation=historyPeriodLabel;
root.targetRowStatePresentation=targetRowState;
root.targetMatrixStatsPresentation=targetMatrixStats;
root.targetMatrixItemsPresentation=targetMatrixItems;
root.targetLevelTabsPresentation=targetLevelTabsHtml;
root.targetSummaryPresentation=targetSummaryHtml;
root.targetMatrixRowPresentation=targetMatrixRowHtml;
root.targetMatrixPanelPresentation=targetMatrixPanelHtml;
root.historyRowsPresentation=historyRows;
root.historySelectorPresentation=historySelectorHtml;
root.targetSelectorPresentation=targetSelectorHtml;
root.historyTablePresentation=historyTableHtml;
root.historyPanelPresentation=historyPanelHtml;
root.manageEmptyPanelPresentation=manageEmptyPanelHtml;
root.targetEmptyStatePresentation=targetEmptyState;
root.targetMatrixTablePresentation=targetMatrixTableHtml;
root.targetMatrixActionsPresentation=targetMatrixActionsHtml;
root.targetPrerequisitePresentation=targetPrerequisite;
root.targetLevelToolbarPresentation=targetLevelToolbarHtml;
root.teaReferenceKindPresentation=teaReferenceKind;
root.teaReferenceRowActionsPresentation=teaReferenceRowActions;
root.teaReferenceSortPresentation=sortTeaReferences;
root.teaReferenceNamingTitlePresentation=teaReferenceNamingTitle;
root.teaReferenceEmptyStatePresentation=teaReferenceEmptyState;
root.teaReferenceLabValuePresentation=teaReferenceLabValueHtml;
root.teaReferenceInputValuePresentation=teaReferenceInputValue;
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
root.sigmaCanvasFont=createSigmaCanvasFont((token:string,fallback:number)=>{if(typeof getComputedStyle==='function'&&typeof document!=='undefined'){const value=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--'+token));if(Number.isFinite(value))return value;}return fallback;});
root.reportLabels=createReportLabels((value:any)=>vnDate(value));
root.reportSelection=createReportSelection();
root.reportSearch=createReportSearch();
root.sigmaMuTraceService=createSigmaMuTrace({escape:(value:any)=>typeof (globalThis as any).esc==='function'?(globalThis as any).esc(value):String(value??''),formatDate:(value:any)=>vnDate(value)});
root.sigmaPrintRowsService=createSigmaPrintRows({escape:(value:any)=>typeof (globalThis as any).esc==='function'?(globalThis as any).esc(value):String(value??''),escapeAttr:(value:any)=>typeof (globalThis as any).escAttr==='function'?(globalThis as any).escAttr(value):String(value??''),format:(value:any,decimals?:number)=>fmt(value,decimals),dpmo:(value:any)=>(globalThis as any).sgFmtDPMO(value),period:(value:any)=>typeof (globalThis as any).vnPeriod==='function'?(globalThis as any).vnPeriod(value):String(value??'')});
root.sigmaMuPrintRowsService=createSigmaMuPrintRows({mu:(test:any,entry:any,level:any)=>typeof (globalThis as any).sgMU==='function'?(globalThis as any).sgMU(test,entry,level):undefined,format:(value:any,decimals?:number)=>fmt(value,decimals),escape:(value:any)=>typeof (globalThis as any).esc==='function'?(globalThis as any).esc(value):String(value??''),period:(value:any)=>typeof (globalThis as any).vnPeriod==='function'?(globalThis as any).vnPeriod(value):String(value??'')});
root.reportPointsTableService=createReportPointsTable({formatDate:(value:any)=>vnDate(value),escape:(value:any)=>typeof (globalThis as any).esc==='function'?(globalThis as any).esc(value):String(value??''),pointValue:(point:any,test:any)=>typeof (globalThis as any).reportQcPoint==='function'?(globalThis as any).reportQcPoint(point,test):fmt(point&&point.val,3),format:(value:any,decimals?:number)=>fmt(value,decimals),verdict:(value:any)=>typeof (globalThis as any).qcVerdictLabel==='function'?(globalThis as any).qcVerdictLabel(value):String(value??''),staff:(point:any)=>typeof (globalThis as any).pointStaff==='function'?(globalThis as any).pointStaff(point):{}});
root.actionReportHtml=createActionReportHtml((value:any)=>typeof (globalThis as any).esc==='function'?(globalThis as any).esc(value):String(value??''));
root.sigmaDraftService=createSigmaDraftService({get:(key:string)=>localStorage.getItem(key),set:(key:string,value:string)=>localStorage.setItem(key,value),remove:(key:string)=>localStorage.removeItem(key),now:()=>Date.now(),clone:(value:any)=>JSON.parse(JSON.stringify(value)),key:'qclab_sigma_draft',savedAtKey:'qclab_saved_at'});
const modularStateAdoptionService=createStateAdoptionService({validate:(value:any)=>(root.QCCore as any).validateBackup(value),sanitize:(value:any,options:any)=>(root.QCCore as any).sanitizeBackup(value,options),invariants:(value:any,options:any)=>(root.QCCore as any).validateStateInvariants(value,options)});
root.corruptLocalQuarantine=createCorruptLocalQuarantine(()=>new Date().toISOString());
root.firebaseConfigSelection=createFirebaseConfigSelection(['apiKey','authDomain','databaseURL','projectId','appId']);
root.firebaseConnectionGate=createFirebaseConnectionGate();
root.syncSnapshotSignature=syncSnapshotSignature;
root.firebaseIdentity=createFirebaseIdentity();
root.firebaseAuditGate=createFirebaseAuditGate((entries:any[],anchor:string)=>(root.QCCore as any).verifyAuditChain(entries,anchor));
root.firebasePollingService=createFirebasePollingService({setInterval:(fn:()=>void,ms:number)=>globalThis.setInterval(fn,ms),clearInterval:(timer:any)=>globalThis.clearInterval(timer)});
root.firebasePullService=createFirebasePullService({read:(ref:any)=>ref.once('value'),handle:(value:any,options:any)=>(globalThis as any).fbHandleValue(value,options),canPull:firebaseCanPull});
const modularLocalPartitionHelpers=createLocalPartitionHelpers(),modularLocalSnapshotRecord=createLocalSnapshotRecord({clone:(value:any)=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)),now:()=>Date.now(),key:'state'}),modularLocalRecoverySlots=localRecoverySlots,modularLocalPartitionTransaction=createLocalPartitionTransaction({nextSlot:(value:any)=>modularLocalPartitionHelpers.nextSlot(value),shell:(value:any)=>modularLocalPartitionHelpers.shell(value),now:()=>Date.now()}),modularLocalPartitionRecovery=createLocalPartitionRecovery(localPartitionValid),modularLocalClearKeys=createLocalClearKeys((slot:any,type:any,id?:any)=>modularLocalPartitionHelpers.key(slot,type,id),'state');
root.firebaseSnapshotGate=firebaseSnapshotGate;
root.firebaseRemoteSnapshot=createFirebaseRemoteSnapshot((value:any)=>(root.QCCore as any).validateBackup(value),(value:any)=>(root.QCCore as any).sanitizeBackup(value));
root.firebaseOwnSnapshotPlan=firebaseOwnSnapshotPlan;
root.firebaseFirstConnectPlan=firebaseFirstConnectPlan;
/* Khởi tạo có điều kiện: SG_CLIA_FIXED được dựng MỘT LẦN ngay lúc gọi factory (đọc
   TEA_SOURCE_REGISTRY/TEA_ANALYTE_CATALOG/REFTESTS trực tiếp, không lazy) — y hệt
   cách sigma-tea.js cũ tự thực hiện lúc file nạp. Một số sandbox test tải bundle mà
   không nạp (hoặc nạp SAU) state.js/analyte-catalog.js — không guard sẽ ném
   ReferenceError ngay khi nạp bundle dù sandbox đó không hề gọi tới sgTea/... */
if (typeof TEA_SOURCE_REGISTRY !== 'undefined' && typeof TEA_ANALYTE_CATALOG !== 'undefined' && typeof REFTESTS !== 'undefined') {
  root.SigmaTeaResolution = createSigmaTeaResolution({
    teaSourceRegistry: TEA_SOURCE_REGISTRY, teaAnalyteCatalog: TEA_ANALYTE_CATALOG, refTests: REFTESTS as any,
    getState: () => state as { teaRefs?: any[] },
    teaAnalyteMeta: (name, record) => (globalThis as any).teaAnalyteMeta(name, record),
    teaAnalyteDisplay: (name, record) => (globalThis as any).teaAnalyteDisplay(name, record),
    searchText: typeof (globalThis as any).searchText === 'function' ? (value: unknown) => (globalThis as any).searchText(value) : undefined,
    fmt: (value, decimals) => fmt(value, decimals), vnDate: value => vnDate(value),
  });
  root.SG_TEA_SOURCES = root.SigmaTeaResolution.SG_TEA_SOURCES;
  root.SG_CLIA_FIXED = root.SigmaTeaResolution.SG_CLIA_FIXED;
  root.teaRefName = root.SigmaTeaResolution.teaRefName;
  root.teaRefIsDefault = root.SigmaTeaResolution.teaRefIsDefault;
  root.testDisplayName = root.SigmaTeaResolution.testDisplayName;
  root.sgUnitKey = root.SigmaTeaResolution.sgUnitKey;
  root.sgUnitsMatch = root.SigmaTeaResolution.sgUnitsMatch;
  root.sgTeaSourceMeta = root.SigmaTeaResolution.sgTeaSourceMeta;
  root.effectiveTeaRefs = root.SigmaTeaResolution.effectiveTeaRefs;
  root.sgRef = root.SigmaTeaResolution.sgRef;
  root.sgTeaSource = root.SigmaTeaResolution.sgTeaSource;
  root.sgTeaInfo = root.SigmaTeaResolution.sgTeaInfo;
  root.sgTeaBySource = root.SigmaTeaResolution.sgTeaBySource;
  root.sgTea = root.SigmaTeaResolution.sgTea;
  root.sgTeaCriterionText = root.SigmaTeaResolution.sgTeaCriterionText;
  root.sgTeaLabel = root.SigmaTeaResolution.sgTeaLabel;
  root.sgTeaRefText = root.SigmaTeaResolution.sgTeaRefText;
  root.sgTeaSnapshot = root.SigmaTeaResolution.sgTeaSnapshot;
  root.sgEnsureTeaSnapshot = root.SigmaTeaResolution.sgEnsureTeaSnapshot;
  root.sgLevelTarget = root.SigmaTeaResolution.sgLevelTarget;
  root.sgSetLevelTeaSnapshot = root.SigmaTeaResolution.sgSetLevelTeaSnapshot;
  root.sgEntryTea = root.SigmaTeaResolution.sgEntryTea;
}
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
root.SigmaMuWorkflowCommand=createSigmaMuWorkflowCommand({service:root.SigmaMuWorkflowService,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>root.closeModal(),render:()=>rerender()});
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
const actionRecordService: ActionRecordService = createActionRecordService({
  now: () => new Date().toISOString(), createId: () => uid(),
  isCancelled: action => nceActionBasics.actionCancelled(action), approvalStatus: action => nceActionBasics.actionApprovalStatus(action),
});
const nceFormCommand = createNceFormCommand({
  todayIso: () => isoToday(),
  draftStatus: action => root.ActionDraftStatusService!(action),
  effectivenessStatus: action => typeof (root as any).actionEffectivenessStatus === 'function' ? (root as any).actionEffectivenessStatus(action) : { complete: false, label: 'Chưa thể đánh giá hiệu lực' },
  effectivenessMissingKey: action => typeof (root as any).actionEffectivenessMissingKey === 'function' ? (root as any).actionEffectivenessMissingKey(action) : 'effectivenessNote',
  isCancelled: action => nceActionBasics.actionCancelled(action),
  approvalStatus: action => nceActionBasics.actionApprovalStatus(action),
  records: actionRecordService,
});
const nceLifecycleCommand = createNceLifecycleCommand({ review: root.ActionReviewService, escalation: root.ActionEscalationService });
root.NceLifecycleWorkflowCommand=createNceLifecycleWorkflowCommand({current:()=>state as {actions?:Record<string,any>[]},lifecycle:nceLifecycleCommand,log:(action,detail,target)=>logAct(action,detail,target),save:()=>save({clearDerived:false}),render:()=>rerender()});
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
root.ActionFormModel = createActionFormModel({
  todayIso: () => isoToday(), dueDate: days => root.NceActionIdentityService!.dueDate(days),
  operationalLevels: test => (root as any).operationalLevels(test),
  effectivenessComplete: action => typeof (root as any).actionEffectivenessStatus === 'function' && (root as any).actionEffectivenessStatus(action).complete,
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
/* Ngưỡng xoay vòng/tự-kiểm-chuỗi nhật ký hoạt động. Cố tình giữ dạng property có thể
   ghi trực tiếp (không phải hằng số đóng gói) — test và (nếu cần) UI cũ chỉnh trực
   tiếp các ngưỡng này để mô phỏng nhật ký lớn mà không phải chờ hàng chục nghìn dòng
   thật; xem tests/audit-retention.test.js. */
root.ACTIVITY_HARD_CAP = 50000;
root.ACTIVITY_ROTATE_TO = 40000;
root.AUDIT_AUTO_VERIFY_MAX = 5000;
root.auditActor = () => ({ user: userName(), username: currentUser && currentUser.username || '', userId: currentUser && currentUser.id || '', role: role(), clientId: fb && fb.clientId || '' });
root.auditEntryHash = entry => (root.QCCore as any).auditEntryHash(entry);
root.auditVerifyChain = (activity = state.activity || [], anchor = state.activityAnchor || '') => (root.QCCore as any).verifyAuditChain(activity, anchor);
root.AuditService = createAuditService({
  getState: () => state as { activity?: Record<string, any>[]; activityAnchor?: string },
  uid: () => typeof (root as any).uid === 'function' ? (root as any).uid() : '', nowIso: () => new Date().toISOString(),
  actor: () => root.auditActor!(),
  entryHash: entry => root.auditEntryHash!(entry),
  verifyChain: (activity, anchor) => root.auditVerifyChain!(activity, anchor),
  limits: () => ({ hardCap: root.ACTIVITY_HARD_CAP!, rotateTo: root.ACTIVITY_ROTATE_TO! }),
  autoVerifyMax: root.AUDIT_AUTO_VERIFY_MAX!,
});
/* logAct/auditSha256/auditRelinkChain còn được tham chiếu TRẦN (không qua root.) ở
   nhiều chỗ khác trong file này — xem ambient declare cùng tên phía trên, cùng cơ chế
   với rerender/requireWrite. Gán qua root.X= vẫn đủ vì bare reference rơi qua property
   của globalThis khi không có let/const cùng tên nào che trước nó. */
root.logAct = (action, detail, target = '') => { root.AuditService!.log(action, detail, target); };
root.auditSha256 = text => (root.QCCore as any).auditSha256(text);
root.auditRelinkChain = (entries, anchor = '') => root.AuditService!.relinkChain(entries, anchor);
root.auditChainStatus = (force = false) => root.AuditService!.chainStatus(force);
root.auditVerifyChainNow = () => { root.AuditService!.resetChainCache(); root.auditChainStatus!(true); rerender(); };
root.auditLastHashOf = activity => root.AuditService!.lastHashOf(activity);
root.auditArchiveCut = (activity, cutoffIso) => root.AuditService!.archiveCut(activity, cutoffIso);
root.NceFormWorkflowCommand=createNceFormWorkflowCommand({current:()=>state as {actions?:Record<string,any>[]},form:nceFormCommand,log:(action,detail,target)=>logAct(action,detail,target),reset:()=>{const ui=(root as any).actionFormUiState;if(ui)ui.reset();},save:()=>save({clearDerived:false}),render:()=>rerender()});
root.ActivityArchiveCommand=createActivityArchiveCommand({current:()=>state as {activity?:Record<string,any>[];activityAnchor?:string},window:value=>root.activityAuditArchiveWindow!(value),cut:(activity,cutoff)=>root.AuditService!.archiveCut(activity,cutoff),confirm:dialog=>root.confirmDialog(dialog),reauthenticate:input=>(root as any).reauthenticateCurrentUser(input),download:(name,rows)=>(root as any).csvDownload(name,(root as any).activityAuditCsv(rows)),log:(type,detail,target)=>logAct(type,detail,target),save:()=>save({clearDerived:false}),close:()=>root.closeModal(),render:()=>rerender(),info:(message,options)=>root.infoDialog(message,options),dateLabel:iso=>vnDate(iso)});
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
/* ===== ACTION WORKFLOW SERVICE ===== Retire classic action-workflow-service.js (2026-08-20,
   Pha G nhóm C lát 1) — mọi hàm bên dưới vốn đã chỉ `return root.X.Y(...)` trong bản classic,
   không có logic mới. Ba hàm classic `actionLotPoints(testId,level,lot)`/`actionPointIndex(testId)`/
   `actionOpenedFromVoid(a,p)` KHÔNG mang sang: xác nhận bằng rg không còn caller nào (kể cả
   trong chính file cũ) — tên trùng với `NceActionQcIndex.actionLotPoints/actionPointIndex`
   (nhận `points[]` thay vì `testId`) chỉ là trùng tên, không phải cùng hàm. `actionWorkflowStatus`
   bỏ nhánh fallback JS cũ (dead từ khi `ActionWorkflowStatusService` có mặt — xem gán phía trên,
   luôn tồn tại trong cùng bundle này); `ACTION_LABELS`/`RISK_SCALE` không cần kiểu
   `root.NceActionLabels&&...||...` nữa vì `NceActionLabels` đã được gán TRƯỚC ở dòng phía trên
   trong CÙNG một script — khác bản classic phải chờ file khác nạp sau. */
root.nextNceId = today => root.NceActionIdentityService!.nextNceId((state as any).actions || [], today);
root.nceDueDate = (days = 7) => root.NceActionIdentityService!.dueDate(days);
root.actionApprovalStatus = action => root.NceActionBasics!.actionApprovalStatus(action);
root.actionRecordStatus = action => root.NceActionBasics!.actionRecordStatus(action);
root.actionCancelled = action => root.NceActionBasics!.actionCancelled(action);
root.actionApprovalLabel = action => root.NceActionBasics!.actionApprovalLabel(action);
root.actionRecorded = action => root.NceActionBasics!.actionRecorded(action);
root.actionDraftStatus = action => root.ActionDraftStatusService!(action);
root.actionProtocolStatus = action => root.ActionProtocolService!.protocolStatus(action);
root.actionProtocolSummary = action => root.ActionProtocolService!.protocolSummary(action);
root.actionRiskScore = action => root.NceActionBasics!.actionRiskScore(action);
root.actionResidualRiskScore = action => root.NceActionBasics!.actionResidualRiskScore(action);
root.actionActiveFollowUp = action => root.NceActionIdentityService!.activeFollowUp((state as any).actions || [], action);
root.actionEffectivenessStatus = action => root.ActionProtocolService!.effectivenessStatus(action);
root.actionOverdue = action => root.ActionApprovalGates!.overdue(action);
root.actionCanApprove = (action, user) => root.ActionApprovalGates!.canApprove(action, user);
root.invalidateActionCaches = testId => { root.ActionRerunService!.invalidate(testId); root.ActionPointIndexService!.invalidate(); };
root.actionPoint = action => root.ActionRerunService!.point(action);
root.actionEventDate = action => root.ActionQcLink!.eventDate(action);
root.actionNeedsRerun = action => root.ActionQcLink!.needsRerun(action);
root.actionRerunGateDate = (action, point) => root.NceActionRerunPolicy!.rerunGateDate(action, point);
root.actionRerunStatus = action => root.ActionRerunService!.status(action);
root.actionWorkflowStatus = action => root.ActionWorkflowStatusService!(action);
root.pointActions = pointId => root.ActionPointIndexService!.forPoint(pointId);
root.pointRealActions = pointId => root.PointWorkflowService!.real(root.pointActions(pointId));
root.pointWorkflowComplete = pointId => root.PointWorkflowService!.complete(root.pointActions(pointId));
root.pointWorkflowSummary = pointId => root.PointWorkflowService!.summary(root.pointActions(pointId));
root.ACTION_LABELS = root.NceActionLabels!.actionLabels;
root.RISK_SCALE = root.NceActionLabels!.riskScale;
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
const entryRecordCommand = createEntryRecordCommand({
  recordPoint: (targetState, input) => root.EntryService.recordPoint(targetState, input),
  canEnter: (test, level) => typeof (root as any).canEnterQcForLevel === 'function' && !!(root as any).canEnterQcForLevel(test, level),
  pointContext: (testId, level, lot, activeLot) => entryPointContext(testId, level, lot, activeLot),
  verdict: (test, input, point, parallel) => {
    if (typeof (root as any).clearDerivedForTest === 'function') (root as any).clearDerivedForTest(input.testId);
    if (parallel && typeof (root as any).parallelWestgard === 'function') return (root as any).parallelWestgard(test, { level: +input.level, lot: String(input.lotNo || ''), mean: +input.cfg.mean, sd: +input.cfg.sd, parallel: true }).byPoint.get(point.id) || { level: 'ok', rules: [] };
    return typeof (root as any).activeWestgard === 'function' ? (root as any).activeWestgard(test).byPoint.get(point.id) || { level: 'ok', rules: [] } : { level: 'ok', rules: [] };
  },
});
const entryVoidCommand = createEntryVoidCommand({
  voidPoint: (targetState, input) => root.EntryService.voidPoint(targetState, input),
  clearDerived: testId => { if (typeof (root as any).clearDerivedForTest === 'function') (root as any).clearDerivedForTest(testId); },
});
root.EntryRecordWorkflowCommand=createEntryRecordWorkflowCommand({current:()=>state,record:entryRecordCommand,log:(action,detail,target)=>logAct(action,detail,target),save:options=>save(options)});
root.EntryVoidWorkflowCommand=createEntryVoidWorkflowCommand({current:()=>state,voidCommand:entryVoidCommand,log:(action,detail,target)=>logAct(action,detail,target),save:options=>save(options)});
root.EntryDateNoteWorkflowCommand=createEntryDateNoteWorkflowCommand({current:()=>state,entry:root.EntryService,formatDate:date=>(globalThis as any).vnDate(date),log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options)});
const rangeTargetCommand=createRangeTargetCommand({assignTarget:(config,mean,sd,source)=>root.qcRangeCandidateService!.assignTarget(config,mean,sd,source)});
root.RangeWorkflowCommand=createRangeWorkflowCommand({current:()=>state,target:rangeTargetCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),render:()=>rerender()});
/* ===== NEW QC RANGE ===== Retire classic range.js (2026-08-19, Pha G hạ tầng lát 4) —
   glue quanh qcRangeCandidateService/qcRangeTea/qcRangeSafetyGate/qcRangeBiasEvaluation/
   RangeWorkflowCommand đã có sẵn, không có logic mới. */
root.rangeSystematicNce=(tid,level)=>root.qcRangeCandidateService!.systematicNce(tid,level);
root.rangeCandidate=(tid,level)=>root.qcRangeCandidateService!.candidate(tid,level);
root.openRangeWorkflow=(tid,level)=>{
  const r=root.rangeCandidate(tid,level);if(!r.t||!r.l)return;
  const rows=[['Tổng số kết quả',r.c?r.c.n:0,'≥20',r.c&&r.c.n>=20],['Số ngày độc lập',r.days,'≥20 ngày',r.days>=20],['Điểm bị loại Westgard',r.bad,'Phải bằng 0; không tự loại điểm để làm đẹp SD',r.bad===0],['Điểm cảnh báo',r.warn,'Phải bằng 0 trước khi phê duyệt dải',r.warn===0],['SD đề xuất hợp lệ',r.c?(root as any).fmtTestValue(r.t,r.c.sd):'—','>0',r.c&&r.c.sd>0]];
  const checklist=root.rangeWorkflowChecklistRowsHtml(rows.map(x=>({condition:x[0],current:x[1],requirement:x[2],passed:x[3]})));
  const c=r.c;
  const nceNotice=r.nce?root.rangeNceNoticeHtml({nceId:(root as any).esc(r.nce.nceId||'NCE'),rule:(root as any).esc(r.nce.rule||''),cause:(root as any).esc((r.nce.cause||'').slice(0,200))}):'';
  const contextHtml=`<b>${(root as any).esc((root as any).testDisplayName(r.t))}</b> · Mức ${level} · Lô ${(root as any).esc(r.l.lot||'?')} · ${(root as any).esc(r.t.machine||'')}`,comparisonRowsHtml=root.rangeWorkflowComparisonRowsHtml({label:`Đang dùng (${r.l.applied==='lab'?'PXN':'NSX'})`,mean:(root as any).fmtTestValue(r.t,r.l.mean),sd:(root as any).fmtTestValue(r.t,r.l.sd),cv:fmt(r.l.mean?r.l.sd/Math.abs(r.l.mean)*100:0),limits:`${(root as any).fmtTestValue(r.t,r.l.mean-2*r.l.sd)} – ${(root as any).fmtTestValue(r.t,r.l.mean+2*r.l.sd)}`},c?{label:'Đề xuất PXN',mean:(root as any).fmtTestValue(r.t,c.m),sd:(root as any).fmtTestValue(r.t,c.sd),cv:fmt(c.cv),limits:`${(root as any).fmtTestValue(r.t,c.m-2*c.sd)} – ${(root as any).fmtTestValue(r.t,c.m+2*c.sd)}`,proposed:true}:null);
  root.openModal(root.rangeWorkflowModalHtml({contextHtml,nceNoticeHtml:nceNotice,checklistRowsHtml:checklist,currentRangeRowHtml:comparisonRowsHtml,proposedRangeRowHtml:'',printButtonHtml:(root as any).btn('In biểu mẫu',`printRangeForm('${tid}',${level})`,'ghost'),applyButtonHtml:root.canWrite()?(root as any).btn('Áp dụng dải PXN',`closeModal();applyNewRange('${tid}',${level})`,'teal','',{disabled:!r.eligible}):'',closeButtonHtml:(root as any).btn('Đóng','closeModal()','ghost')}));
};
root.rangeTeaPercent=(t,l)=>root.qcRangeTea!.percent(t,l);
root.rangeGateHtml=(r,tid,level)=>{
  if(!r.nce)return'';
  const tea=root.rangeTeaPercent(r.t,r.l),threshold=root.qcRangeTea!.quarter(tea);
  return root.rangeSafetyGateHtml({nceId:(root as any).esc(r.nce.nceId||'NCE'),rule:(root as any).esc(r.nce.rule||''),biasInputAction:`rangeUpdateBiasHint('${tid}',${level})`,thresholdText:threshold!=null?fmt(threshold)+'%':'—',noTeaHint:tea?'':'Chưa có TEa% cho xét nghiệm này — vào Cấu hình Sigma để bổ sung, hoặc vẫn có thể xác nhận thủ công nếu ngưỡng đã biết theo cách khác.'});
};
root.rangeUpdateBiasHint=(tid,level)=>{
  const r=root.rangeCandidate(tid,level),biasEl=document.getElementById('rangeBiasInput') as HTMLInputElement|null,hint=document.getElementById('rangeBiasHint');
  if(!r.nce||!biasEl||!hint)return;
  const bias=parseFloat(String(biasEl.value).replace(',','.')),tea=root.rangeTeaPercent(r.t,r.l);
  if(!tea){hint.textContent='Chưa có TEa% cho xét nghiệm này — vào Cấu hình Sigma để bổ sung.';return;}
  if(!Number.isFinite(bias)){hint.textContent='';return;}
  const result=root.qcRangeBiasEvaluation(tea,bias,r.l.sd,(root.QCCore as any).systematicShiftCritical);
  hint.innerHTML=`${result.withinThreshold?'✔ Đạt':'✘ Vượt'} ngưỡng: |Bias| ${fmt(Math.abs(bias))}% so với ${fmt(result.threshold)}%.`+(result.critical?` <span style="color:var(--muted)">Tham khảo (không phải kết luận chính thức): ΔSEcrit ${fmt(result.critical.dSEcrit)} · ΔREcrit ${fmt(result.critical.dREcrit)}.</span>`:'');
};
root.rangeGatePasses=r=>{
  if(!r.nce)return true;
  const causeEl=document.getElementById('rangeCauseConfirm') as HTMLInputElement|null,biasEl=document.getElementById('rangeBiasInput') as HTMLInputElement|null,bias=parseFloat(String(biasEl?biasEl.value:'').replace(',','.')),tea=root.rangeTeaPercent(r.t,r.l);
  return root.qcRangeSafetyGate(r.nce,tea,!!(causeEl&&causeEl.checked),bias).passes;
};
root.applyNewRange=async(tid,level)=>{
  if(!requireWrite())return;
  const r=root.rangeCandidate(tid,level),{t,l,c,days,bad,warn,eligible}=r;
  if(!eligible){await root.infoDialog(`Chưa đủ điều kiện: cần ≥20 kết quả trên ≥20 ngày, không có điểm vi phạm/cảnh báo chưa xử lý và SD >0.\nHiện tại: n=${c?c.n:0}, ngày=${days}, điểm loại=${bad}, điểm cảnh báo=${warn}.`);return;}
  root.openModal(root.rangeApplyConfirmationModalHtml({changeSummaryHtml:`X̄: ${(root as any).fmtTestValue(t,l.mean)} → ${(root as any).fmtTestValue(t,c.m)}<br>SD: ${(root as any).fmtTestStat(t,l.sd)} → ${(root as any).fmtTestStat(t,c.sd)}<br>Dải nhà sản xuất vẫn được lưu để hoàn về.`,gateHtml:root.rangeGateHtml(r,tid,level),cancelButtonHtml:(root as any).btn('Hủy','closeModal()','ghost'),applyButtonHtml:(root as any).btn('Áp dụng',`confirmApplyNewRange('${tid}',${level})`,'teal')}));
  setTimeout(()=>{const e=document.getElementById('rangeReasonInput');if(e)e.focus();},50);
};
root.confirmApplyNewRange=async(tid,level)=>{
  const r=root.rangeCandidate(tid,level),{t,l,c,days,nce}=r;
  if(!root.rangeGatePasses(r)){const err=document.getElementById('rangeGateErr');if(err)(err as HTMLElement).style.display='';return;}
  const input=document.getElementById('rangeReasonInput') as HTMLInputElement|null;
  const reason=(root.QCCore as any).cleanText(input?input.value:'',1000).trim();
  if(reason.length<10){const err=document.getElementById('rangeReasonErr');if(err)(err as HTMLElement).style.display='';return;}
  root.closeModal();if(!await (root as any).reauthenticateCurrentUser({title:'Xác thực thay đổi dải QC',message:'Nhập lại mật khẩu trước khi áp dụng Mean/SD của phòng xét nghiệm.'}))return;
  const oldM=l.mean,oldSd=l.sd;
  const gateNote=nce?` Điều kiện dịch chuyển hệ thống: đã xác nhận nguyên nhân theo hồ sơ NCE ${nce.nceId||nce.id}, Bias đo lại trong ngưỡng cho phép (≤ TEa/4).`:'';
  const detail=`M${level}: Mean ${(root as any).fmtTestValue(t,oldM)}→${(root as any).fmtTestValue(t,c.m)}, SD ${(root as any).fmtTestStat(t,oldSd)}→${(root as any).fmtTestStat(t,c.sd)}`;
  const actionText=`Áp dụng dải PXN: Mean ${(root as any).fmtTestValue(t,oldM)}→${(root as any).fmtTestValue(t,c.m)}, SD ${(root as any).fmtTestStat(t,oldSd)}→${(root as any).fmtTestStat(t,c.sd)}, n=${c.n}, ${days} ngày. Phê duyệt: ${reason}${gateNote}`;
  const result=root.RangeWorkflowCommand.applyLab({level:l,testId:tid,levelNo:level,lot:l.lot||'',testName:t?t.name:'',mean:c.m,sd:c.sd,cv:c.cv,reason,gateNote,detail,actionText,historyId:uid(),actionId:uid(),today:isoToday(),createdAt:new Date().toISOString(),userId:currentUser&&currentUser.id||'',username:currentUser&&currentUser.username||'',userName:currentUser?(currentUser.name||currentUser.username):''});
  if(!result.ok){await root.infoDialog(result.message);return;}
};
root.revertRange=(tid,level)=>{
  if(!requireWrite())return;
  root.openModal(root.rangeRevertConfirmationModalHtml({cancelButtonHtml:(root as any).btn('Hủy','closeModal()','ghost'),revertButtonHtml:(root as any).btn('Hoàn về dải NSX',`confirmRevertRange('${tid}',${level})`,'danger')}));
  setTimeout(()=>{const e=document.getElementById('rangeReasonInput');if(e)e.focus();},50);
};
root.confirmRevertRange=async(tid,level)=>{
  const t=state.tests!.find(x=>x.id===tid) as any;const l=lvlCfg(t,level);
  const input=document.getElementById('rangeReasonInput') as HTMLInputElement|null;
  const reason=(root.QCCore as any).cleanText(input?input.value:'',1000).trim();
  if(reason.length<5){const err=document.getElementById('rangeReasonErr');if(err)(err as HTMLElement).style.display='';return;}
  root.closeModal();if(!await (root as any).reauthenticateCurrentUser({title:'Xác thực hoàn dải QC',message:'Nhập lại mật khẩu trước khi hoàn về Mean/SD nhà sản xuất.'}))return;
  const oldM=l.mean,oldSd=l.sd;
  const detail=`M${level}: Mean ${(root as any).fmtTestValue(t,oldM)}→${(root as any).fmtTestValue(t,l.mfgMean)}, SD ${(root as any).fmtTestValue(t,oldSd)}→${(root as any).fmtTestValue(t,l.mfgSd)} · ${reason}`;
  const actionText=`Hoàn về dải NSX: Mean ${(root as any).fmtTestValue(t,oldM)}→${(root as any).fmtTestValue(t,l.mfgMean)}, SD ${(root as any).fmtTestValue(t,oldSd)}→${(root as any).fmtTestValue(t,l.mfgSd)}. Lý do: ${reason}`;
  const result=root.RangeWorkflowCommand.revertMfg({level:l,testId:tid,levelNo:level,lot:l.lot||'',testName:t?t.name:'',reason,detail,actionText,historyId:uid(),actionId:uid(),today:isoToday(),createdAt:new Date().toISOString(),userId:currentUser&&currentUser.id||'',username:currentUser&&currentUser.username||'',userName:currentUser?(currentUser.name||currentUser.username):''});
  if(!result.ok){await root.infoDialog(result.message);return;}
};
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
  if (backupTextBytes(text) <= 16 * 1024 * 1024) return auditSha256(text);
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
root.BackupRestoreCommand=createBackupRestoreCommand({current:()=>state,replace:value=>{state=value;},normalize:()=>ensureShape({sanitized:true}),invariantErrors:()=>(root.QCCore as any).validateStateInvariants(state,{sanitized:true}),clearSigmaDraft:()=>{if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(Number.MAX_SAFE_INTEGER);},ensureAdmin:()=>ensureAdmin(),setActivity:activity=>{state.activity=activity;},logImported:fileName=>logAct('Nhập backup','Nhập dữ liệu đã kiểm tra từ file '+fileName,'Dữ liệu'),save:()=>save({}),render:()=>rerender()});
root.BackupExportCommand=createBackupExportCommand({current:()=>state,log:()=>logAct('Xuất backup','Xuất toàn bộ dữ liệu JSON có checksum','Dữ liệu'),save:()=>save({clearDerived:false}),create:value=>backupService.createBackupPackage(value),confirmOversized:(bytes,detail)=>root.confirmOversizedBackup(bytes,detail),warning:bytes=>backupService.backupImportSizeError(bytes)?null:root.backupSizeWarningConfirmation({bytes}),confirm:dialog=>root.confirmDialog(dialog),download:(name,text)=>root.downloadBackupText(name,text),mark:bytes=>root.markBackupDone(bytes),update:()=>root.updateBackupBanner()});
root.BackupImportCommand=createBackupImportCommand({prepare:text=>backupService.prepareBackupImport(text),sizeWarning:bytes=>backupService.backupSizeWarning(bytes),snapshot:prefix=>root.BackupExportCommand.snapshot(prefix),restore:input=>root.BackupRestoreCommand.restore(input)});
root.BackupInspectionCommand=createBackupInspectionCommand({inspect:(text,bytes)=>backupService.inspectBackupText(text,bytes)});
root.BackupStatusCommand=createBackupStatusCommand({reminder:root.backupReminderService,marker:root.backupLocalMarker,maxBytes:BACKUP_IMPORT_MAX_BYTES,size:bytes=>backupService.backupSizeMB(bytes),warning:bytes=>backupService.backupSizeWarning(bytes)});
/* ===== BACKUP / RESTORE UI ===== Retire classic backup-ui.js (2026-08-19, Pha G hạ tầng
   lát 2) — thuần glue quanh các command TypeScript ở trên, không có logic mới. */
root.confirmOversizedBackup=async(size,{title,detail})=>{const dialog=root.backupSizeConfirmation({bytes:size,title,detail});return dialog?await root.confirmDialog(dialog):true;};
root.exportData=async()=>{const result=await root.BackupExportCommand.exportFull(root.backupFileName(isoToday()),root.backupOversizeConfirmation.exportFull());if(result.status==='create-error'){await root.infoDialog(root.backupExportMessage.createError(result.error));return;}if(result.status==='download-error')await root.infoDialog(root.backupExportMessage.downloadError);};
root.downloadBackupText=(name,json)=>{try{root.blobDownload!(name,new Blob([json],{type:'application/json'}));return true;}catch(e){return false;}};
root.backupCurrentData=(prefix='before-change')=>root.BackupExportCommand.snapshot(root.backupSnapshotFileName(prefix));
root.importData=async e=>{
  if(!root.requireAdmin('Chỉ quản trị mới được nhập backup.')){if(e&&e.target)e.target.value='';return;}
  const f=e.target.files[0];if(!f)return;try{
    const result=await root.BackupImportCommand.importFile({fileName:f.name,size:f.size,text:await f.text(),oldActivity:[...(state.activity||[])],confirmOversized:()=>root.confirmOversizedBackup(f.size,root.backupOversizeConfirmation.importFile(f.name)),confirmImport:input=>root.confirmDialog(root.backupImportConfirmation(input)),reauthenticate:()=>(root as any).reauthenticateCurrentUser({title:'Xác thực nhập backup',message:'Nhập lại mật khẩu trước khi thay thế dữ liệu nghiệp vụ hiện tại.'}),snapshotFailureMessage:root.backupImportMessage.preImportSnapshotFailure});
    if(result.status==='imported')await root.infoDialog(root.backupImportMessage.success,{type:'success'});
  }catch(err){await root.infoDialog(root.backupImportMessage.invalid(err));}finally{if(e&&e.target)e.target.value='';}
};
root.verifyBackupFile=async e=>{if(!root.requireAdmin('Chỉ quản trị mới được kiểm tra file backup.')){if(e&&e.target)e.target.value='';return;}const f=e&&e.target&&e.target.files&&e.target.files[0];if(!f)return;try{const result=await root.BackupInspectionCommand.inspectFile({text:await f.text(),size:f.size,confirmOversized:()=>root.confirmOversizedBackup(f.size,root.backupOversizeConfirmation.inspectFile(f.name))});if(result.status==='inspected')await root.infoDialog(root.backupInspectionSummary(result.report),{type:'success'});}catch(err){await root.infoDialog(root.backupInspectionMessage.invalid(err));}finally{if(e&&e.target)e.target.value='';}};
const BACKUP_REMIND_DAYS=7;
root.markBackupDone=bytes=>{root.backupLocalMarker.mark(bytes);};
root.backupStatusText=()=>root.BackupStatusCommand.status(typeof fb!=='undefined'&&fb&&fb.ready);
root.backupCapacityText=()=>root.BackupStatusCommand.capacity();
root.updateBackupBanner=()=>{
  const dot=document.getElementById('backupDot');if(!dot)return;
  const model=root.BackupStatusCommand.banner({cloudReady:typeof fb!=='undefined'&&fb&&fb.ready,user:typeof currentUser==='undefined'?null:currentUser,days:BACKUP_REMIND_DAYS});(dot as HTMLElement).hidden=model.hidden;if(!model.hidden){(dot as HTMLElement).className=model.className;dot.textContent=model.text;(dot as HTMLElement).title=model.title;}
};
root.ResetOperationalDataCommand=createResetOperationalDataCommand({current:()=>state,clearPersistence:()=>{localStorage.removeItem('qclab');localStorage.removeItem('qclab_boot');if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(Number.MAX_SAFE_INTEGER);if(typeof root.localStoreService!=='undefined')root.localStoreService!.clear().catch(()=>{});},blank:users=>(root as any).blankAppStateFactory(users),replace:value=>{state=value;},normalize:()=>ensureShape(),ensureAdmin:()=>ensureAdmin(),log:()=>logAct('Xóa sạch dữ liệu test','Đưa app về trạng thái trắng, giữ người dùng và nhật ký audit','Dữ liệu'),save:()=>save({}),render:()=>rerender()});
const userManagementCommand=createUserManagementCommand();
const loginCommand=createLoginCommand({isLocked:(until,now)=>root.loginLockoutPolicy!.isLocked(until,now),lockedMessage:(until,now)=>root.loginLockoutPolicy!.message(until,now),recordFailure:(lock,now)=>root.loginLockoutPolicy!.recordFailure(lock,now),resetLock:()=>root.loginLockoutPolicy!.reset(),verify:(password,stored)=>(root as any).verifyPass(password,stored),hash:password=>(root as any).hashPass(password),isPbkdf2:stored=>root.isPbkdf2PasswordHash!(stored),hashNeedsUpgrade:stored=>root.passwordHashNeedsUpgrade!(stored)});
root.LoginWorkflowCommand=createLoginWorkflowCommand({login:loginCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options)});
const requiredPasswordCommand=createRequiredPasswordCommand({validate:(password,confirmation)=>root.passwordChangeError!(password,confirmation),hash:password=>(root as any).hashPass(password)});
root.RequiredPasswordWorkflowCommand=createRequiredPasswordWorkflowCommand({command:requiredPasswordCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options)});
root.AdminBootstrapCommand=createAdminBootstrapCommand({current:()=>state as {users?:Record<string,any>[]},id:()=>(root as any).uid(),hashDefault:()=>(root as any).legacyHashPass('admin'),createDefault:(id,passHash)=>root.defaultAdminUserFactory!(id,passHash),save:()=>save({cloud:false,clearDerived:false})});
root.UserLifecycleCommand=createUserLifecycleCommand({current:()=>state as {users?:Record<string,any>[]},manage:userManagementCommand,hash:password=>(root as any).hashPass(password),log:(type,detail,target)=>logAct(type,detail,target),save:()=>save({clearDerived:false})});
/* ===== USERS / AUDIT / AUTH ===== Retire classic users-auth.js (2026-08-20, Pha G nhóm C
   lát 2) — mọi hàm bên dưới vốn đã chỉ gọi thẳng service/command TypeScript đã có sẵn ở
   trên (password/PBKDF2, login/reset/admin/user-lifecycle command, activity audit filter/
   pagination/csv, user list/row/permission HTML); không có logic mới. `auditQ`/`auditFrom`/
   `auditTo`/`auditPage`/`auditPageSize` chuyển vào `AuthUIState` (xem createAuthUiState() ở
   ui-state.ts) thay vì `let` cục bộ, cùng lý do `currentUser`/`loginFails`/`loginLockUntil`
   đã ở đó từ trước — test vm sandbox gán bare `auditQ='...'` phải trúng đúng accessor
   property của globalThis, một `let` bên trong IIFE của bundle sẽ không thấy được. */
root.AUDIT_PAGE_SIZES = ACTIVITY_AUDIT_PAGE_SIZES;
root.pageUsers = () => {
  const users = root.userListModel(state.users, currentUser && currentUser.id);
  const rows = users.map((u: Record<string, any>) => root.userRowHtml({ user: u, currentUserId: currentUser && currentUser.id, esc: escapeHtml, roleLabel: (r: unknown) => root.roleLabel(r as string), btn: root.btn })).join('');
  return root.usersPageHtml({ head: root.headOnly('Quản lý người dùng', 'Phân quyền thao tác và kiểm soát tài khoản'), rows, roleOptions: root.roleSelectOptions('technician'), permissionChecks: root.userPermChecks(root.rolePageIds('technician'), 'newUserPerms', 'technician'), addButton: root.btn('Thêm', 'addUser()', 'teal') });
};
root.auditDateKey = activity => root.activityAuditFilter.dateKey(activity);
root.auditFilteredActivities = (items = state.activity || []) => root.activityAuditFilter.filter(items, auditQ, auditFrom, auditTo);
root.auditSetQuery = value => {
  const next = root.activityAuditFilterState.withQuery({ query: auditQ, from: auditFrom, to: auditTo, page: auditPage, pageSize: auditPageSize }, value);
  auditQ = next.query; auditPage = next.page; root.scheduleSearchRender(root.auditSetQuery, rerender, 'auditSearch');
};
root.auditSetDate = (field, value) => {
  const iso = value ? (root.vnPickerParse(value) || root.parseVN!(value) || '') : '';
  const next = root.updateActivityAuditDateRange({ from: auditFrom, to: auditTo }, field, iso);
  auditFrom = next.from; auditTo = next.to; auditPage = 1; rerender();
};
root.auditSetPageSize = value => {
  const next = root.activityAuditFilterState.withPageSize({ query: auditQ, from: auditFrom, to: auditTo, page: auditPage, pageSize: auditPageSize }, value, root.AUDIT_PAGE_SIZES as unknown as number[]);
  auditPageSize = next.pageSize; auditPage = next.page; rerender();
};
root.auditSetPage = value => {
  auditPage = root.activityAuditFilterState.withPage({ query: auditQ, from: auditFrom, to: auditTo, page: auditPage, pageSize: auditPageSize }, value).page; rerender();
};
root.auditClearFilters = () => {
  const next = root.activityAuditFilterState.cleared({ query: auditQ, from: auditFrom, to: auditTo, page: auditPage, pageSize: auditPageSize });
  auditQ = next.query; auditFrom = next.from; auditTo = next.to; auditPage = next.page; rerender();
};
root.pageAudit = () => {
  const total = (state.activity || []).length;
  const oversizeWarn = total > root.ACTIVITY_ROTATE_TO! ? ` <span class="tag warn">Nhật ký đang rất lớn</span> <span class="hint">Nên lưu trữ bớt dòng cũ — hệ thống sẽ tự xoay vòng ở ${root.ACTIVITY_HARD_CAP} dòng (không xuất CSV).</span>` : '';
  const chain = typeof root.auditChainStatus === 'function' ? root.auditChainStatus() : { ok: true, checked: 0, legacy: total, idle: false } as Record<string, any>;
  const chainHtml = chain.idle
    ? `<span class="tag none">Chưa kiểm chuỗi hash</span> ${root.btn('Kiểm tra chuỗi hash', 'auditVerifyChainNow()', 'ghost sm')} <span class="hint">Nhật ký lớn (${chain.total} dòng) nên không tự kiểm mỗi lần mở trang.</span>`
    : chain.ok ? `<span class="tag ok">Chuỗi hash hợp lệ</span> <span class="hint">${chain.checked} dòng đã khóa hash${chain.legacy ? ` · ${chain.legacy} dòng cũ chưa có hash` : ''}</span>` : `<span class="tag rej">Audit có dấu hiệu bị sửa</span> <span class="hint">Lỗi tại dòng #${((state.activity as any)[chain.brokenIndex] || {}).seq || chain.brokenIndex + 1}: ${escapeHtml(chain.reason)}</span>`;
  const filtered = root.auditFilteredActivities(), pageInfo = root.activityAuditPagination(filtered, auditPage, auditPageSize), pageCount = pageInfo.pageCount;
  auditPage = pageInfo ? pageInfo.page : Math.min(Math.max(1, auditPage), pageCount);
  const offset = pageInfo ? pageInfo.offset : (auditPage - 1) * auditPageSize, pageRows = pageInfo ? pageInfo.rows : filtered.slice(offset, offset + auditPageSize);
  const rows = pageRows.map((a: any) => root.activityAuditRowHtml({ sequenceHtml: a.seq ? '#' + a.seq : '', timeHtml: formatDateTimeVN(a.ts), userHtml: escapeHtml(a.user || ''), roleHtml: root.roleLabel(a.role || 'viewer'), usernameHtml: a.username ? ' · @' + escapeHtml(a.username) : '', typeHtml: escapeHtml(a.type || ''), targetHtml: escapeHtml(a.target || ''), detailHtml: escapeHtml(a.detail || '') })).join('');
  const hasFilter = !!(auditQ || auditFrom || auditTo);
  const pageSizeOptions = (root.AUDIT_PAGE_SIZES as unknown as number[]).map(size => `<option value="${size}" ${size === auditPageSize ? 'selected' : ''}>${size} dòng</option>`).join('');
  const resultFrom = pageInfo ? pageInfo.resultFrom : (filtered.length ? offset + 1 : 0), resultTo = pageInfo ? pageInfo.resultTo : Math.min(offset + auditPageSize, filtered.length);
  const pagination = filtered.length ? `<div class="audit-pagination"><span class="hint">Hiển thị ${resultFrom}–${resultTo} / ${filtered.length} dòng</span><div>${root.btn('‹ Trước', `auditSetPage(${auditPage - 1})`, 'ghost sm', '', { disabled: auditPage <= 1 })}<b>Trang ${auditPage}/${pageCount}</b>${root.btn('Sau ›', `auditSetPage(${auditPage + 1})`, 'ghost sm', '', { disabled: auditPage >= pageCount })}</div></div>` : '';
  const rowsOrEmptyState = rows ? `<div class="audit-table-wrap"><table class="audit-table"><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead><tbody>${rows}</tbody></table></div>` : root.emptyState(total ? 'Không tìm thấy nhật ký' : 'Chưa có hoạt động', total ? 'Thử từ khóa hoặc khoảng ngày khác.' : 'Nhật ký sẽ bắt đầu ghi từ các thao tác tiếp theo.');
  return root.activityAuditPageHtml({ head: root.headOnly('Nhật ký hoạt động', 'Lưu vết các thao tác quan trọng; chỉ quản trị viên được xem'), exportButton: root.btn('Xuất CSV nhật ký', 'exportActivityCSV()', 'teal sm'), archiveButton: total ? root.btn('Lưu trữ nhật ký cũ', 'archiveActivityLog()', 'ghost sm') : '', total, chainHtml, oversizeWarn, searchValue: escapeHtmlAttr(auditQ), fromDate: root.dateBox('auditFromDate', auditFrom, 'audit-date', `aria-label="Lọc nhật ký từ ngày" onchange="auditSetDate('from',this.value)"`), toDate: root.dateBox('auditToDate', auditTo, 'audit-date', `aria-label="Lọc nhật ký đến ngày" onchange="auditSetDate('to',this.value)"`), pageSizeOptions, clearFiltersButton: hasFilter ? root.btn('Xóa bộ lọc', 'auditClearFilters()', 'ghost sm audit-clear-filter') : '', filteredCount: filtered.length, rowsOrEmptyState, pagination });
};
root.activityCSVRows = items => root.activityAuditCsv(items);
root.exportActivityCSV = () => { root.csvDownload!('Nhat_ky_hoat_dong_QCLab.csv', root.activityCSVRows(state.activity || [])); };
/* Lưu trữ CÓ CHỦ ĐÍCH nhật ký cũ: xuất CSV phần bị cắt TRƯỚC, chỉ khi file đã
   tạo xong mới gỡ khỏi state — khác với xoay vòng tự động (auditRotateOverflow),
   đường này không mất dữ liệu. CSV giữ nguyên cột PrevHash/Hash để phần đã lưu
   trữ kiểm chứng độc lập được: hash dòng cuối file phải khớp tipHash trong dòng
   checkpoint ghi lại sau khi cắt. */
root.archiveActivityLog = () => {
  if (!root.requireAdmin()) return;
  const total = (state.activity || []).length; if (!total) return;
  root.openModal(root.activityAuditArchiveModalHtml({ total, cancelButtonHtml: root.btn('Hủy', 'closeModal()', 'ghost'), archiveButtonHtml: root.btn('Xuất CSV và lưu trữ', 'confirmArchiveActivityLog()', 'teal') }));
};
root.confirmArchiveActivityLog = async () => {
  if (!root.requireAdmin()) return;
  const result = await root.ActivityArchiveCommand.execute((document.getElementById('auditArchiveMonths') as HTMLInputElement | null)?.value);
  if (result.status === 'done') auditPage = 1;
};
root.addUser = async () => {
  if (!root.requireAdmin()) return;
  const username = (document.getElementById('uUser') as HTMLInputElement).value.trim().toLowerCase(); const name = (document.getElementById('uName') as HTMLInputElement).value.trim(); const initials = root.QCCore!.cleanText((document.getElementById('uInitials') as HTMLInputElement).value, 12).trim().toUpperCase(); const rolev = (document.getElementById('uRole') as HTMLInputElement).value; const pass = (document.getElementById('uPass') as HTMLInputElement).value;
  const userErr = root.newUserValidationError!({ username, password: pass, existingUsernames: (state.users || []).map((u: Record<string, any>) => u.username) }); if (userErr) { await root.infoDialog(userErr); return; }
  const pagePerms = await root.collectUserPerms('newUserPerms', rolev); if (!pagePerms) return;
  await root.UserLifecycleCommand.add({ id: uid(), username, name, initials, role: rolev, pagePerms, password: pass, auditDetail: root.roleLabel(rolev) + ' · ' + pagePerms.length + ' thẻ · yêu cầu đổi mật khẩu' }); rerender();
};
root.userPermChecks = (selectedIds, groupId, roleValue) => {
  const base = new Set(root.rolePageIds(roleValue)), initial = selectedIds && selectedIds.length ? selectedIds : root.rolePageIds(roleValue), selected = new Set(root.selectUserPermissions!(initial, [...base]));
  return root.userPermissionChecksHtml(escapeHtmlAttr(groupId), root.PAGES.map(([id, title]) => ({ idHtml: escapeHtmlAttr(id), titleHtml: escapeHtml(title), allowed: base.has(id), selected: selected.has(id) })));
};
root.syncUserPermChecks = (groupId, roleValue) => {
  const box = document.getElementById(groupId), base = new Set(root.rolePageIds(roleValue)); if (!box) return;
  box.querySelectorAll('input[type=checkbox]').forEach(i => { const input = i as HTMLInputElement; const allowed = base.has(input.value); input.disabled = !allowed; input.closest('label')!.classList.toggle('disabled', !allowed); if (!allowed) input.checked = false; });
};
root.collectUserPerms = async (groupId, roleValue) => {
  const box = document.getElementById(groupId), base = new Set(root.rolePageIds(roleValue)); if (!box) return root.rolePageIds(roleValue);
  const selected = [...box.querySelectorAll('input[type=checkbox]:checked')].map(i => (i as HTMLInputElement).value), picked = root.selectUserPermissions!(selected, [...base]);
  if (!picked.length) { await root.infoDialog('Cần chọn ít nhất một thẻ được phép dùng.'); return null; }
  return [...new Set(picked)];
};
root.openUserPerms = async id => {
  if (!root.requireAdmin()) return;
  const u = (state.users || []).find((x: Record<string, any>) => x.id === id); if (!u) return;
  if (currentUser && currentUser.id === id) { await root.infoDialog('Không thể tự sửa quyền của tài khoản đang đăng nhập. Hãy dùng tài khoản quản trị khác nếu cần thay đổi.'); return; }
  const roleSelect = root.userRoleSelectHtml(root.roleSelectOptions(u.role));
  root.openModal(root.userPermissionsModalHtml({ userName: escapeHtml(u.name || u.username), username: escapeHtml(u.username), roleSelectHtml: roleSelect, permissionChecksHtml: root.userPermChecks(u.pagePerms, 'editUserPerms', u.role), cancelButtonHtml: root.btn('Hủy', 'closeModal()', 'ghost'), saveButtonHtml: root.btn('Lưu quyền', `applyUserPerms('${id}')`, 'teal') }));
};
root.applyUserPerms = async id => {
  if (!root.requireAdmin()) return;
  const u = (state.users || []).find((x: Record<string, any>) => x.id === id); if (!u) return;
  if (currentUser && currentUser.id === id) { await root.infoDialog('Không thể tự sửa quyền của tài khoản đang đăng nhập.'); return; }
  const rolev = (document.getElementById('editUserRole') as HTMLInputElement).value, pagePerms = await root.collectUserPerms('editUserPerms', rolev); if (!pagePerms) return;
  root.UserLifecycleCommand.updatePermissions(u, { role: rolev, pagePerms, auditDetail: `${root.roleLabel(rolev)} · ${pagePerms.length} thẻ` });
  root.closeModal(); if (!root.canAccessPage(root.page)) page = root.firstAccessPage(); renderBrand(); root.nav(); rerender();
};
root.resetPass = id => {
  if (!root.requireAdmin()) return;
  const u = (state.users || []).find((x: Record<string, any>) => x.id === id); if (!u) return;
  const self = currentUser && currentUser.id === id;
  root.openModal(root.resetPasswordModalHtml({ title: self ? 'Đổi mật khẩu' : 'Đặt lại mật khẩu', message: self ? 'Nhập mật khẩu mới cho tài khoản đang đăng nhập.' : 'Nhập mật khẩu tạm; người dùng sẽ phải đổi lại khi đăng nhập.', enterAction: `if(event.key==='Enter')applyResetPass('${id}')`, cancelButtonHtml: root.btn('Hủy', 'closeModal()', 'ghost'), saveButtonHtml: root.btn('Lưu mật khẩu', `applyResetPass('${id}')`, 'teal') }));
  setTimeout(() => { const e = document.getElementById('resetPass1'); if (e) e.focus(); }, 50);
};
root.applyResetPass = async id => {
  if (!root.requireAdmin()) return;
  const u = (state.users || []).find((x: Record<string, any>) => x.id === id); if (!u) return;
  const p1 = (document.getElementById('resetPass1') as HTMLInputElement).value, p2 = (document.getElementById('resetPass2') as HTMLInputElement).value, msg = document.getElementById('resetPassMsg'), err = root.passwordChangeError!(p1, p2);
  if (err) { if (msg) msg.innerHTML = `<div class="auth-err">${escapeHtml(err)}</div>`; return; }
  const updated = await root.UserLifecycleCommand.resetPassword(u, p1, !(currentUser && currentUser.id === id));
  root.closeModal(); rerender(); await root.infoDialog(updated.mustChangePassword ? 'Đã đặt mật khẩu tạm. Người dùng sẽ phải đổi mật khẩu khi đăng nhập.' : 'Đã cập nhật mật khẩu.', { type: 'success' });
};
root.toggleUser = id => { if (!root.requireAdmin()) return; const u = (state.users || []).find((x: Record<string, any>) => x.id === id); root.UserLifecycleCommand.toggle(u); rerender(); };
root.delUser = async id => { if (!root.requireAdmin()) return; if (id === currentUser.id) { await root.infoDialog('Không thể xóa chính mình.'); return; } const u = (state.users || []).find((x: Record<string, any>) => x.id === id); if (!await root.confirmDialog({ kicker: 'Thao tác không thể hoàn tác', title: 'Xóa người dùng', message: `Xóa người dùng ${u ? (u.name || u.username) : ''}?`, confirmLabel: 'Xóa người dùng', cancelLabel: 'Hủy' })) return; root.UserLifecycleCommand.remove(id); rerender(); };

/* ===== AUTH =====
   Hash PBKDF2-SHA256 (OWASP: >=600k vòng — hằng số PASSWORD_HASH_ITERATIONS
   sống ở src/domain/auth/pbkdf2-password-service.ts, NGUỒN DUY NHẤT) và hash
   SHA-256 legacy (hash cũ vẫn xác thực được, tự nâng cấp lên PBKDF2 khi đăng
   nhập) đều đã là TypeScript qua pbkdf2PasswordService/legacyPasswordHashService
   — xem tests/auth-security.test.js. */
root.passwordError = p => root.passwordPolicyError!(p);
root.legacyHashPass = async p => root.legacyPasswordHashService!.hash(p);
root.hashPass = async p => root.pbkdf2PasswordService!.hash(p);
root.verifyPass = async (p, stored) => {
  if (root.isPbkdf2PasswordHash!(stored)) return root.pbkdf2PasswordService!.verify(p, stored);
  return await root.legacyHashPass(p) === stored;
};
root.confirmReauthentication = async () => {
  const input = document.getElementById('reauthPassword') as HTMLInputElement | null, err = document.getElementById('reauthError') as HTMLElement | null;
  if (!currentUser || !input) { root.closeDialogOverlay(false); return; }
  let ok = false; try { ok = await root.verifyPass(input.value, currentUser.passHash); } catch (e) { /* mật khẩu không xác thực được coi như sai */ }
  input.value = '';
  if (!ok) { if (err) err.hidden = false; input.focus(); return; }
  root.closeDialogOverlay(true);
};
root.reauthenticateCurrentUser = ({ title = 'Xác thực lại', message = 'Nhập lại mật khẩu để tiếp tục.' } = {}) => {
  if (!currentUser) return Promise.resolve(false);
  return new Promise<boolean>(resolve => root.openDialogOverlay(`<div class="modal confirm-modal">
    <div class="confirm-modal-h"><div class="confirm-modal-kicker">Thao tác được kiểm soát</div>${root.modalCloseButton('closeDialogOverlay(false)')}</div>
    <h3 class="confirm-modal-title">${escapeHtml(title)}</h3>
    <div class="confirm-modal-body"><div class="confirm-modal-icon info" aria-hidden="true">✓</div><div class="confirm-modal-text"><b>${escapeHtml(message)}</b><p>Tài khoản: ${escapeHtml(currentUser.name || currentUser.username || '')}</p></div></div>
    <div class="reauth-modal-field">
      <label for="reauthPassword">Mật khẩu hiện tại</label>
      <input id="reauthPassword" type="password" autocomplete="current-password" autofocus onkeydown="if(event.key==='Enter'){event.preventDefault();confirmReauthentication()}">
      <div id="reauthError" class="auth-err" hidden>Mật khẩu không đúng.</div>
    </div>
    <div class="confirm-modal-actions">${root.btn('Hủy', 'closeDialogOverlay(false)', 'ghost')}${root.btn('Xác thực', 'confirmReauthentication()', 'teal')}</div>
  </div>`, resolve as (result?: unknown) => void));
};
root.ensureAdmin = async () => { await root.AdminBootstrapCommand.ensure(); };
root.blankAppState = users => root.blankAppStateFactory!(users);
root.resetAllData = async () => {
  if (!root.requireAdmin()) return;
  if (!await root.confirmDialog({ kicker: 'Thao tác không thể hoàn tác', title: 'Xóa sạch dữ liệu test', message: 'Xóa sạch toàn bộ dữ liệu test?', detail: 'Nhật ký hoạt động sẽ được giữ lại và ghi nhận thao tác này.', confirmLabel: 'Tiếp tục', cancelLabel: 'Hủy' })) return;
  if (!await root.confirmDialog({ kicker: 'Xác nhận lần cuối', title: 'Xóa sạch dữ liệu test', message: 'Dữ liệu QC, cấu hình, lô, panel và khắc phục sẽ bị xóa.', detail: 'Nhật ký audit vẫn được giữ. Nếu đang bật đám mây, trạng thái trắng cũng sẽ được đồng bộ lên Firebase.', confirmLabel: 'Xóa sạch dữ liệu', cancelLabel: 'Hủy' })) return;
  if (!await root.reauthenticateCurrentUser({ title: 'Xác thực xóa sạch dữ liệu', message: 'Nhập lại mật khẩu trước khi xóa toàn bộ dữ liệu QC và cấu hình.' })) return;
  if (!await root.backupCurrentData('truoc-xoa')) { await root.infoDialog('Không tạo được bản backup an toàn. Dữ liệu chưa bị xóa.'); return; }
  await root.ResetOperationalDataCommand.execute(); await root.infoDialog('Đã xóa sạch dữ liệu test. App đã về trạng thái trắng.', { type: 'success' });
};
root.downloadStartupData = () => {
  if (!startupProblem) return;
  const blob = new Blob([startupProblem.raw], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'qclab-du-lieu-can-phuc-hoi-' + Date.now() + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
root.resetStartupData = async () => {
  if (!await root.confirmDialog({ kicker: 'Thao tác không thể hoàn tác', title: 'Tạo dữ liệu mới', message: 'Tạo dữ liệu mới?', detail: 'Dữ liệu cũ sẽ không bị dùng nữa. Hãy tải bản cần phục hồi trước khi tiếp tục.', confirmLabel: 'Tạo dữ liệu mới', cancelLabel: 'Hủy' })) return;
  startupProblem = null; await root.ResetOperationalDataCommand.execute({ keepUsers: false, keepAudit: false, log: false, save: false, render: false }); root.showLogin();
};
root.authBrandMark = () => { const logo = root.brandLogo(); return `<div class="brand-mark">${logo ? `<img src="${escapeHtmlAttr(logo)}" alt="">` : escapeHtml(root.brandMarkText())}</div>`; };
root.showStartupRecovery = () => {
  let ov = document.getElementById('authOverlay'); if (!ov) { ov = document.createElement('div'); ov.id = 'authOverlay'; document.body.appendChild(ov); }
  (ov as HTMLElement).style.display = 'flex';
  ov.innerHTML = `<div class="auth-card"><div class="auth-head">${root.authBrandMark()}<div class="auth-brand">Cần phục hồi dữ liệu</div></div>
    <div class="auth-sub">QC Lab phát hiện dữ liệu cục bộ không hợp lệ và đã dừng để tránh ghi đè.</div>
    <div class="auth-err">${escapeHtml(startupProblem && startupProblem.message || 'Không đọc được dữ liệu.')}</div>
    <div class="auth-actions">${root.btn('Tải dữ liệu gốc xuống', 'downloadStartupData()', 'teal')}${root.btn('Tạo dữ liệu mới', 'resetStartupData()', 'ghost')}</div>
    <div class="auth-hint">Ưu tiên tải dữ liệu gốc xuống trước để có thể kiểm tra và phục hồi.</div></div>`;
};
root.showLogin = msg => {
  document.getElementById('nav')!.innerHTML = ''; document.getElementById('main')!.innerHTML = ''; document.getElementById('userBox')!.innerHTML = '';
  const sf = document.getElementById('sideFoot'); if (sf) sf.innerHTML = '';
  let ov = document.getElementById('authOverlay'); if (!ov) { ov = document.createElement('div'); ov.id = 'authOverlay'; document.body.appendChild(ov); }
  (ov as HTMLElement).style.display = 'flex';
  const app = root.QCLAB_APP || { version: 'dev' };
  const admin = (state.users || []).find((u: Record<string, any>) => u.username === 'admin');
  const defaultHint = admin && admin.mustChangePassword ? 'Tài khoản mặc định: <b>admin</b> / <b>admin</b><br>Hệ thống sẽ yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.<br>' : '';
  const trial = (window as any).qcLicense && (window as any).qcLicense.trial;
  const trialLine = trial && trial.active ? `<div class="auth-hint ${trial.daysLeft <= 7 ? 'auth-trial-warning' : 'auth-trial-ok'}">Bản dùng thử: còn ${trial.daysLeft}/${trial.totalDays} ngày</div>` : '';
  ov.innerHTML = `<div class="auth-card"><div class="auth-head">${root.authBrandMark()}<div class="auth-head-text"><div class="auth-brand">${escapeHtml(root.brandTitle())}</div><div class="auth-sub">${escapeHtml(root.brandSub())}</div></div></div>
    <label>Tên đăng nhập</label><input id="liUser" autocomplete="username" autofocus>
    <label>Mật khẩu</label><input id="liPass" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()">
    ${msg ? `<div class="auth-err">${escapeHtml(msg)}</div>` : ''}
    <div class="auth-actions">${root.btn('Đăng nhập', 'doLogin()', 'teal')}</div>
    ${trialLine}<div class="auth-hint">${defaultHint}Phiên bản ${escapeHtml(app.version || 'dev')}</div></div>`;
  requestAnimationFrame(root.focusLoginField); setTimeout(root.focusLoginField, 50);
};
/* Đưa focus về ô đăng nhập theo kiểu "nhường": chỉ focus khi lớp đăng nhập đang
   hiển thị và CHƯA có ô/nút nào trong lớp đó được focus. Nhờ vậy đợt xử lý snapshot
   Firebase đầu tiên (chạy ensureShape đồng bộ, có thể làm khựng luồng chính) không
   cướp mất ô người dùng đã Tab sang, nhưng vẫn khôi phục được focus nếu nó bị mất
   (vd cửa sổ chưa được OS focus lúc mở nguội) để Tab dùng được ngay. */
root.focusLoginField = () => {
  const ov = document.getElementById('authOverlay');
  if (!ov || (ov as HTMLElement).style.display === 'none') return;
  const active = document.activeElement;
  if (active && active !== document.body && ov.contains(active)) return;
  const user = document.getElementById('liUser'); if (user) (user as HTMLElement).focus();
};
/* Lưu số lần sai/thời điểm hết khóa vào localStorage — chỉ giữ trong biến JS thì tải
   lại trang (F5) là reset về 0, vô hiệu hoá cơ chế chống dò mật khẩu ngay lập tức. */
root.persistLoginLockout = () => { try { localStorage.setItem('qclab_login_lockout', JSON.stringify({ fails: loginFails, until: loginLockUntil })); } catch (e) { /* localStorage có thể bị chặn (chế độ riêng tư) — bỏ qua */ } };
root.doLogin = async () => {
  const u = (document.getElementById('liUser') as HTMLInputElement).value.trim().toLowerCase(); const p = (document.getElementById('liPass') as HTMLInputElement).value;
  // Thông báo lỗi KHÔNG được phân biệt "tài khoản không tồn tại" với "sai mật khẩu" —
  // nếu không kẻ dò có thể dùng đó để liệt kê username hợp lệ trước khi dò mật khẩu.
  // Chi tiết thật (để phân biệt khi tra soát) chỉ ghi vào nhật ký hoạt động nội bộ.
  const genericFailMsg = 'Tên đăng nhập hoặc mật khẩu không đúng.';
  if (!await storageHydrationPromise) { root.showStartupRecovery(); return; }
  const result = await root.LoginWorkflowCommand.authenticate({ users: state.users, username: u, password: p, lock: { fails: loginFails, until: loginLockUntil }, now: Date.now() });
  if (result.status === 'locked') { root.showLogin(result.message); return; }
  if (result.status === 'failed') { if (result.reason === 'verification-error') { root.showLogin('Không thể kiểm tra mật khẩu trên trình duyệt này.'); return; } loginFails = result.lock.fails; loginLockUntil = result.lock.until; root.persistLoginLockout(); root.showLogin(genericFailMsg); return; }
  loginFails = result.lock.fails; loginLockUntil = result.lock.until; root.persistLoginLockout();
  currentUser = result.user;
  if (currentUser.mustChangePassword) root.showPasswordChange(); else root.showApp();
};
root.showPasswordChange = msg => {
  let ov = document.getElementById('authOverlay'); if (!ov) { ov = document.createElement('div'); ov.id = 'authOverlay'; document.body.appendChild(ov); } (ov as HTMLElement).style.display = 'flex';
  ov.innerHTML = `<div class="auth-card"><div class="auth-head">${root.authBrandMark()}<div class="auth-brand">Đổi mật khẩu</div></div><div class="auth-sub">Cần cập nhật mật khẩu trước khi vào hệ thống</div>
    <label>Mật khẩu mới</label><input id="newPass1" type="password" autocomplete="new-password">
    <label>Nhập lại mật khẩu mới</label><input id="newPass2" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter')changeRequiredPassword()">
    ${msg ? `<div class="auth-err">${escapeHtml(msg)}</div>` : ''}
    <div class="auth-actions">${root.btn('Lưu mật khẩu mới', 'changeRequiredPassword()', 'teal')}</div>
    <div class="auth-hint">Mật khẩu cần ít nhất 8 ký tự và không nên dùng lại mật khẩu mặc định.</div></div>`;
  setTimeout(() => { const e = document.getElementById('newPass1'); if (e) (e as HTMLElement).focus(); }, 50);
};
root.changeRequiredPassword = async () => {
  const p1 = (document.getElementById('newPass1') as HTMLInputElement).value, p2 = (document.getElementById('newPass2') as HTMLInputElement).value;
  const result = await root.RequiredPasswordWorkflowCommand.complete({ user: currentUser, password: p1, confirmation: p2, cloud: !!(fb && fb.initialized) });
  if (result.status === 'invalid') { root.showPasswordChange(result.error); return; }
  currentUser = result.user; root.showApp();
};
root.logout = () => { if (currentUser) root.LoginWorkflowCommand.logout(); currentUser = null; page = 'dash'; root.showLogin(); };
root.showApp = () => {
  const ov = document.getElementById('authOverlay'); if (ov) (ov as HTMLElement).style.display = 'none';
  if (!root.canAccessPage(root.page)) page = root.firstAccessPage();
  document.getElementById('userBox')!.innerHTML = '';
  renderBrand(); root.nav(); root.sideFoot(); rerender(); if (typeof root.lisGatewayStart === 'function') setTimeout(root.lisGatewayStart, 0);
};
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
  notify: (message, options) => root.infoDialog(message, options),
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
root.lisGatewayConfig = lisClient.gatewayConfig;
root.lisNormalizeGatewayUrl = lisClient.normalizeGatewayUrl;
root.lisGatewayStatusText = lisClient.statusText;
root.lisGatewayPull = lisClient.pull;
root.lisImportResult = lisClient.importResult;
root.lisRejectResult = lisClient.rejectResult;
root.lisGatewayStart = lisClient.start;
root.ManageConfigService = createManageConfigService({
  cleanText: root.QCCore.cleanText,
  cleanId: root.QCCore.cleanId,
  targetFromLimits: root.QCCore.targetFromLimits,
  limitsFromTarget: root.QCCore.limitsFromTarget,
});
const manageAssayCommand = createManageAssayCommand({saveAssay:(targetState,input)=>root.ManageConfigService.saveAssay(targetState as any,input)});
const manageAssayRemovalCommand = createManageAssayRemovalCommand({removeAssay:(targetState,input)=>root.ManageConfigService.removeAssay(targetState as any,input)});
const manageInstrumentCommand = createManageInstrumentCommand({saveInstrument:(targetState,input)=>root.ManageConfigService.saveInstrument(targetState as any,input),removeInstrument:(targetState,input)=>root.ManageConfigService.removeInstrument(targetState as any,input)});
root.ManageInstrumentWorkflowCommand=createManageInstrumentWorkflowCommand({current:()=>state,instrument:manageInstrumentCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>root.closeModal(),render:()=>rerender()});
const managePanelCommand = createManagePanelCommand({savePanel:(targetState,input)=>root.ManageConfigService.savePanel(targetState as any,input),removePanel:(targetState,input)=>root.ManageConfigService.removePanel(targetState as any,input)});
root.ManagePanelWorkflowCommand=createManagePanelWorkflowCommand({current:()=>state,panel:managePanelCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>root.closeModal(),render:()=>rerender()});
const manageLotGroupCommand = createManageLotGroupCommand({save:(s,i)=>root.ManageConfigService.saveLotGroup(s as any,i),remove:(s,i)=>root.ManageConfigService.removeLotGroup(s as any,i),stop:(s,i)=>root.ManageConfigService.stopLotGroup(s as any,i)});
const manageLotGroupActivationCommand = createManageLotGroupActivationCommand({
  findGroup:(s,id)=>((s.lotGroups||[])as any[]).find(g=>g.id===id)||null,
  lotsOfGroup:(s,g)=>((g.lotIds||[])as string[]).map(lotId=>((s.qcLots||[])as any[]).find(lot=>lot.id===lotId)).filter(Boolean),
  candidatesFor:(s,_g,lots)=>root.ManageConfigService.lotGroupActivationCandidates((s.tests||[])as any[],lots,(test:any,level:number,lotId:string,lotNo:string)=>(globalThis as any).lotTargetSnapshot(test,level,lotId,lotNo)),
  backfillPoints:(s,candidate)=>root.ManageConfigService.targetPickBackfillPoints((((s.data||{})as any)[candidate.t.id])||[],candidate.t,candidate.lot,candidate.pick),
  lockedPoints:(s,points)=>root.PeriodService.lockedPoints(s as any,points),
  applyActivation:input=>root.ManageConfigService.applyLotGroupActivation({...input,applyTarget:(test:any,lot:any,pick:any,effectiveFrom:string,note:string)=>(globalThis as any).applyTargetPick(test,lot,pick,effectiveFrom,note),groupsForLot:(lotId:string)=>(globalThis as any).groupsOfLot(lotId),groupInUse:(group:any)=>(globalThis as any).lotGroupInUse(group)} as any),
});
root.ManageLotTransitionCommand = createManageLotTransitionCommand({
  validate:(s,i)=>root.ManageConfigService.validateLotTransition(s as any,{...i,switchesLot:root.ManageConfigService.transitionSwitchesLot}),
  prepareData:i=>root.ManageConfigService.prepareLotTransitionData(i),
  inspect:(s,tr)=>root.ManageConfigService.inspectAcceptedLotTransition(s as any,tr),
  save:(s,i)=>root.ManageConfigService.saveLotTransition(s as any,i),
  applyAccepted:tr=>(globalThis as any).applyAcceptedLotTransitionToConfig(tr),
  syncDepletion:s=>root.ManageConfigService.syncLotDepletion(s as any),
  removal:(s,i)=>root.ManageConfigService.lotTransitionRemoval(s as any,{...i,switchesLot:root.ManageConfigService.transitionSwitchesLot}),
  removeRecord:(s,i)=>root.ManageConfigService.removeLotTransition(s as any,{...i,switchesLot:root.ManageConfigService.transitionSwitchesLot}),
  findLot:(s,id)=>((s.qcLots||[])as any[]).find(lot=>lot.id===id),
  lotLabel:id=>(globalThis as any).lotLabel(id),
  panelName:id=>(globalThis as any).panelName(id),
  statusText:status=>(globalThis as any).manageTransitionStatusPresentation(status).text,
  testName:test=>(globalThis as any).testDisplayName(test),
});
const manageLotCommand = createManageLotCommand({
  validate:(s,i)=>root.ManageConfigService.validateLot(s as any,i),
  pointsToRename:(s,level,lotNo)=>root.ManageConfigService.lotPointsToRename(s as any,level,lotNo),
  lockedPoints:(s,points)=>root.PeriodService.lockedPoints(s as any,points),
  save:(s,i)=>root.ManageConfigService.saveLot(s as any,{...i,renamePoints:(level:number,oldLotNo:string,newLotNo:string)=>root.ManageConfigService.renameLotPoints(s as any,level,oldLotNo,newLotNo)}),
  removal:(s,i)=>root.ManageConfigService.lotRemoval(s as any,{...i,switchesLot:root.ManageConfigService.transitionSwitchesLot}),
  removeRecord:(s,i)=>root.ManageConfigService.removeLot(s as any,{...i,switchesLot:root.ManageConfigService.transitionSwitchesLot}),
});
root.ManageLotWorkflowCommand=createManageLotWorkflowCommand({current:()=>state,lot:manageLotCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>root.closeModal(),render:()=>rerender()});
root.ManageAssayWorkflowCommand=createManageAssayWorkflowCommand({current:()=>state,assay:manageAssayCommand,removal:manageAssayRemovalCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>root.closeModal(),render:()=>rerender()});
root.ManageLotTransitionWorkflowCommand=createManageLotTransitionWorkflowCommand({current:()=>state,transition:root.ManageLotTransitionCommand,clearDerived:()=>(globalThis as any).clearDerived(),log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>root.closeModal(),render:()=>rerender()});
root.ManageLotGroupWorkflowCommand=createManageLotGroupWorkflowCommand({current:()=>state,group:manageLotGroupCommand,activation:manageLotGroupActivationCommand,reconcileSigma:()=>(globalThis as any).reconcileSigmaLevelsWithLotGroups(),log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>root.closeModal(),render:()=>rerender()});
const targetMatrixCommand=createTargetMatrixCommand({
  apply:input=>root.ManageConfigService.applyTargetMatrix({...input,note:'Cập nhật Mean/SD',tests:state.tests,lots:state.qcLots||[],groups:state.lotGroups||[],
    pointsForTest:(t:any)=>(((state.data||{})as any)[t.id])||[],
    groupsForLot:(lotId:string)=>(globalThis as any).groupsOfLot(lotId),
    upsertHistory:(target:any,lot:any,values:any)=>(globalThis as any).upsertLotTargetHistory(target,lot,values),
  } as any),
  panelLabel:(panels,panelId)=>(globalThis as any).targetPanelLabelPresentation(panels,panelId),
});
root.ManageTargetMatrixWorkflowCommand=createManageTargetMatrixWorkflowCommand({current:()=>state,matrix:targetMatrixCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),render:()=>rerender()});
root.TeaReferenceService = createTeaReferenceService({
  key: value => (globalThis as any).teaRefName(value), analyteMeta: (name, record) => (globalThis as any).teaAnalyteMeta(name, record),
  effectiveReferences: () => (globalThis as any).effectiveTeaRefs(), defaultReferences: () => REFTESTS,
  sourceRegistry: () => TEA_SOURCE_REGISTRY, createId: () => (globalThis as any).uid(),
  todayIso: () => (globalThis as any).isoToday(), userName: () => (globalThis as any).userName(),
});
root.TeaReferenceWorkflowCommand=createTeaReferenceWorkflowCommand({current:()=>state,service:root.TeaReferenceService,reconcileSigmaTea:()=>{if(typeof (globalThis as any).sgReconcileAllTeaSnapshots==='function')(globalThis as any).sgReconcileAllTeaSnapshots();},formatDate:iso=>(globalThis as any).vnDate(iso),log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>root.closeModal(),render:()=>rerender()});
root.LotTransitionPickerService = createLotTransitionPickerService({
  searchText: value => (globalThis as any).searchText(value), formatDate: value => (globalThis as any).vnDate(value),
  transitionToNo: lotId => (globalThis as any).lotTransitionToNo(lotId),
});
const managePageController = createManagePageController({
  document: typeof document !== 'undefined' ? document : ({ getElementById: () => null, querySelector: () => null } as unknown as Document),
  getState: () => state, ui: () => (root as any).ManageUIState, currentPage: () => (root as any).RouterUIState.page,
  rerender: () => rerender(), role: () => role(), userName: () => userName(), requireAdmin: message => root.requireAdmin(message),
  esc: value => (root as any).esc(value), escapeAttr: value => (root as any).escAttr(value),
  btn: (label, action, cls, title, options) => (root as any).btn(label, action, cls, title, options),
  emptyState: (title, body, actions) => (root as any).emptyState(title, body, actions),
  dateBox: (id, value, cls, attrs) => (root as any).dateBox(id, value, cls, attrs),
  headOnly: (title, subtitle, actions) => (root as any).headOnly(title, subtitle, actions),
  openModal: html => root.openModal(html), closeModal: () => root.closeModal(),
  confirmDialog: opts => root.confirmDialog(opts), infoDialog: (message, opts) => root.infoDialog(message, opts),
  searchText: value => (globalThis as any).searchText(value), vnDate: value => vnDate(value),
  fmt: (value, decimals) => fmt(value, decimals), fmtTestValue: (test, value) => (root as any).fmtTestValue(test, value),
  formatDateTimeVN: value => (root as any).formatDateTimeVN(value), isoToday: () => (root as any).isoToday(),
  parseVN: value => (root as any).parseVN(value), QCCore: { cleanText: (value, maximumLength) => root.QCCore!.cleanText(value, maximumLength) },
  scheduleSearchRender: (owner, apply, focusId) => root.scheduleSearchRender(owner, apply, focusId),
  teaSourceRegistry: () => TEA_SOURCE_REGISTRY, effectiveTeaRefs: () => root.effectiveTeaRefs!(), teaRefIsDefault: value => root.teaRefIsDefault!(value),
  teaRefName: value => root.teaRefName!(value), teaAnalyteMeta: (name, record) => (globalThis as any).teaAnalyteMeta(name, record),
  teaAnalyteDisplay: (name, record) => (globalThis as any).teaAnalyteDisplay(name, record), testDisplayName: test => root.testDisplayName!(test),
  transitionSwitchesLot: transition => (globalThis as any).transitionSwitchesLot(transition), lotGroupInUse: group => (globalThis as any).lotGroupInUse(group),
  targetConfigAssigned: (test, level, lotId) => (globalThis as any).targetConfigAssigned(test, level, lotId),
  plannedTargetFor: (test, level, lotId) => (globalThis as any).plannedTargetFor(test, level, lotId),
  lotTargetSnapshot: (test, level, lotId) => (globalThis as any).lotTargetSnapshot(test, level, lotId),
  targetRangeDraft: cfg => (globalThis as any).targetRangeDraft(cfg), targetNumberText: (value, test, kind) => (globalThis as any).targetNumberText(value, test, kind),
  TeaReferenceService: root.TeaReferenceService, TeaReferenceWorkflowCommand: root.TeaReferenceWorkflowCommand,
  pres: root as any,
});
root.manageSearchSet = managePageController.manageSearchSet;
root.manageMatch = managePageController.manageMatch;
root.manageSearchPlaceholder = managePageController.manageSearchPlaceholder;
root.groupsOfLot = managePageController.groupsOfLot;
root.lotGroupLabels = managePageController.lotGroupLabels;
root.instrumentName = managePageController.instrumentName;
root.panelName = managePageController.panelName;
root.lotLabel = managePageController.lotLabel;
root.lotTransitionToNo = managePageController.lotTransitionToNo;
root.lotStatus = managePageController.lotStatus;
root.manageShell = managePageController.manageShell;
root.manageToolbar = managePageController.manageToolbar;
root.manageLots = managePageController.manageLots;
root.manageInstruments = managePageController.manageInstruments;
root.managePanels = managePageController.managePanels;
root.manageTransitionsV2 = managePageController.manageTransitionsV2;
root.targetGroupLots = managePageController.targetGroupLots;
root.targetGroupOptions = managePageController.targetGroupOptions;
root.ensureTargetSelection = managePageController.ensureTargetSelection;
root.manageTargets = managePageController.manageTargets;
root.manageAssays = managePageController.manageAssays;
root.manageHistorySearchValues = managePageController.manageHistorySearchValues;
root.manageHistory = managePageController.manageHistory;
root.teaRefFind = managePageController.teaRefFind;
root.teaRefNumOrNull = managePageController.teaRefNumOrNull;
root.teaRefExternalChanged = managePageController.teaRefExternalChanged;
root.teaRefEnsure = managePageController.teaRefEnsure;
root.teaRefEdit = managePageController.teaRefEdit;
root.teaRefRemove = managePageController.teaRefRemove;
root.teaSourceRegistryHtml = managePageController.teaSourceRegistryHtml;
root.teaRefOpenAdd = managePageController.teaRefOpenAdd;
root.teaRefAddSubmit = managePageController.teaRefAddSubmit;
root.teaLabProfileOpen = managePageController.teaLabProfileOpen;
root.teaLabProfileSave = managePageController.teaLabProfileSave;
root.teaLabProfileRemove = managePageController.teaLabProfileRemove;
root.manageTeaRefs = managePageController.manageTeaRefs;
root.manageView = managePageController.manageView;
root.renderManageBody = managePageController.renderManageBody;
root.pageManage = managePageController.pageManage;
/* document là getter LAZY (không capture một lần) — nhiều test đổi document
   giữa các lần gọi để mô phỏng form khác nhau; đọc lại mỗi lần qua deps.document()
   để phản ánh đúng bản mới nhất, khớp cách các dep khác (requireAdmin, rerender,
   ...) đã lazy từ đầu trong toàn bộ file này. */
const manageTestsActionsController = createManageTestsActionsController({
  document: () => typeof document !== 'undefined' ? document : ({ getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] } as unknown as Document),
  getState: () => state, ui: () => (root as any).ManageUIState, analysisUi: () => (root as any).AnalysisUIState, entryUi: () => (root as any).EntryUIState,
  rerender: () => rerender(), resetMainScroll: () => (root as any).resetMainScroll(),
  role: () => role(), userName: () => userName(), requireAdmin: message => root.requireAdmin(message),
  reauthenticateCurrentUser: opts => (root as any).reauthenticateCurrentUser(opts),
  esc: value => (root as any).esc(value), escapeAttr: value => (root as any).escAttr(value),
  btn: (label, action, cls, title, options) => (root as any).btn(label, action, cls, title, options),
  emptyState: (title, body, actions) => (root as any).emptyState(title, body, actions),
  dateBox: (id, value, cls, attrs) => (root as any).dateBox(id, value, cls, attrs),
  openModal: html => root.openModal(html), closeModal: () => root.closeModal(),
  confirmDialog: opts => root.confirmDialog(opts), infoDialog: (message, opts) => root.infoDialog(message, opts),
  searchText: value => (globalThis as any).searchText(value), vnDate: value => vnDate(value),
  fmt: (value, decimals) => fmt(value, decimals), fmtTestValue: (test, value) => (root as any).fmtTestValue(test, value),
  fmtPointValue: (point, test) => (globalThis as any).fmtPointValue(point, test),
  isoToday: () => (root as any).isoToday(), parseVN: value => (root as any).parseVN(value),
  QCCore: { cleanText: (value, maximumLength) => root.QCCore!.cleanText(value, maximumLength) },
  uid: () => (root as any).uid(),
  effectiveTeaRefs: () => root.effectiveTeaRefs!(), teaAnalyteMeta: (name, record) => (globalThis as any).teaAnalyteMeta(name, record),
  teaAnalyteKey: value => teaAnalyteKey(value), testDisplayName: test => root.testDisplayName!(test),
  instrumentName: (id, fallback) => root.instrumentName!(id, fallback), lotTransitionToNo: lotId => root.lotTransitionToNo!(lotId),
  targetGroupLots: group => root.targetGroupLots!(group),
  inspectAcceptedLotTransition: input => (globalThis as any).inspectAcceptedLotTransition(input),
  monthVN: value => (globalThis as any).monthVN(value), upsertLotTargetHistory: (target, lot, values) => (globalThis as any).upsertLotTargetHistory(target, lot, values),
  stats: values => root.QCCore!.stats(values), pointsForLot: (testId, level, lotNo) => (globalThis as any).pointsForLot(testId, level, lotNo),
  pointStaff: point => (globalThis as any).pointStaff(point), testCusumConfig: test => (globalThis as any).testCusumConfig(test),
  wgRules: () => WG_RULES, qcDecimalsDefault: () => QC_DECIMALS_DEFAULT, refTests: () => REFTESTS as any,
  ManageConfigService: root.ManageConfigService, PeriodService: root.PeriodService, LotTransitionPickerService: root.LotTransitionPickerService,
  pres: root as any,
});
root.parseVN = manageTestsActionsController.parseVN;
root.setManageTab = manageTestsActionsController.setManageTab;
root.setTargetPanel = manageTestsActionsController.setTargetPanel;
root.setTargetGroup = manageTestsActionsController.setTargetGroup;
root.setTargetLevel = manageTestsActionsController.setTargetLevel;
root.setHistoryTest = manageTestsActionsController.setHistoryTest;
root.openTargetMatrix = manageTestsActionsController.openTargetMatrix;
root.targetNumberText = manageTestsActionsController.targetNumberText;
root.targetConfigAssigned = manageTestsActionsController.targetConfigAssigned;
root.targetRangeDraft = manageTestsActionsController.targetRangeDraft;
root.syncTargetRange = manageTestsActionsController.syncTargetRange;
root.toggleTargetRow = manageTestsActionsController.toggleTargetRow;
root.targetCheckAll = manageTestsActionsController.targetCheckAll;
root.targetPickBackfillPoints = manageTestsActionsController.targetPickBackfillPoints;
root.applyTargetPick = manageTestsActionsController.applyTargetPick;
root.applyPlannedTarget = manageTestsActionsController.applyPlannedTarget;
root.readTargetMatrixPicks = manageTestsActionsController.readTargetMatrixPicks;
root.saveTargetMatrix = manageTestsActionsController.saveTargetMatrix;
root.openTargetSwitchModal = manageTestsActionsController.openTargetSwitchModal;
root.resolveTargetSwitch = manageTestsActionsController.resolveTargetSwitch;
root.commitTargetMatrix = manageTestsActionsController.commitTargetMatrix;
root.openQcHistoryDetail = manageTestsActionsController.openQcHistoryDetail;
root.openConfigPanel = manageTestsActionsController.openConfigPanel;
root.renderConfigPanelTests = manageTestsActionsController.renderConfigPanelTests;
root.saveConfigPanel = manageTestsActionsController.saveConfigPanel;
root.deleteConfigPanel = manageTestsActionsController.deleteConfigPanel;
root.deleteLotTransition = manageTestsActionsController.deleteLotTransition;
root.lotTransitionChoiceLabel = manageTestsActionsController.lotTransitionChoiceLabel;
root.lotTransitionChoiceLots = manageTestsActionsController.lotTransitionChoiceLots;
root.lotTransitionChoiceMatch = manageTestsActionsController.lotTransitionChoiceMatch;
root.lotTransitionSelectedId = manageTestsActionsController.lotTransitionSelectedId;
root.lotTransitionChoiceInput = manageTestsActionsController.lotTransitionChoiceInput;
root.lotTransitionChoiceHtml = manageTestsActionsController.lotTransitionChoiceHtml;
root.openLotTransitionV2 = manageTestsActionsController.openLotTransitionV2;
root.lotTransitionTargetsHtml = manageTestsActionsController.lotTransitionTargetsHtml;
root.filterLotTransitionTargets = manageTestsActionsController.filterLotTransitionTargets;
root.refreshLotTransitionTargets = manageTestsActionsController.refreshLotTransitionTargets;
root.readLotTransitionTargetPicks = manageTestsActionsController.readLotTransitionTargetPicks;
root.saveLotTransitionV2 = manageTestsActionsController.saveLotTransitionV2;
root.openConfigGroup = manageTestsActionsController.openConfigGroup;
root.suggestConfigGroupName = manageTestsActionsController.suggestConfigGroupName;
root.saveConfigGroup = manageTestsActionsController.saveConfigGroup;
root.deleteConfigGroup = manageTestsActionsController.deleteConfigGroup;
root.toggleLotGroupStatus = manageTestsActionsController.toggleLotGroupStatus;
root.activateLotGroup = manageTestsActionsController.activateLotGroup;
root.openConfigLot = manageTestsActionsController.openConfigLot;
root.saveConfigLot = manageTestsActionsController.saveConfigLot;
root.renameLotAcrossPoints = manageTestsActionsController.renameLotAcrossPoints;
root.deleteConfigLot = manageTestsActionsController.deleteConfigLot;
root.openConfigInstrument = manageTestsActionsController.openConfigInstrument;
root.saveConfigInstrument = manageTestsActionsController.saveConfigInstrument;
root.deleteConfigInstrument = manageTestsActionsController.deleteConfigInstrument;
root.defaultAssayLevels = manageTestsActionsController.defaultAssayLevels;
root.configAssayTeaRefs = manageTestsActionsController.configAssayTeaRefs;
root.configAssayRefRecord = manageTestsActionsController.configAssayRefRecord;
root.configAssayNaming = manageTestsActionsController.configAssayNaming;
root.configAssayFindRef = manageTestsActionsController.configAssayFindRef;
root.configAssaySuggestionInput = manageTestsActionsController.configAssaySuggestionInput;
root.openConfigAssay = manageTestsActionsController.openConfigAssay;
root.saveConfigAssay = manageTestsActionsController.saveConfigAssay;
root.delTest = manageTestsActionsController.delTest;
root.jsq = jsq;
const entryPageController = createEntryPageController({
  document: () => typeof document !== 'undefined' ? document : ({ getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] } as unknown as Document),
  window: () => typeof window !== 'undefined' ? window : ({ scrollX: 0, scrollY: 0, scrollTo: () => {} } as unknown as Window),
  localStorage: () => typeof localStorage !== 'undefined' ? localStorage : ({ getItem: () => null, setItem: () => {} } as unknown as Storage),
  getState: () => state, ui: () => (root as any).EntryUIState, analysisUi: () => (root as any).AnalysisUIState,
  currentPage: () => (root as any).RouterUIState.page,
  rerender: () => rerender(), afterRender: page => (root as any).afterRender(page),
  role: () => role(), canWrite: () => root.canWrite(), requireWrite: () => requireWrite(),
  requireUnlockedPeriod: (date, action) => (root as any).requireUnlockedPeriod(date, action),
  esc: value => (root as any).esc(value), escapeAttr: value => (root as any).escAttr(value), jsq: value => jsq(value),
  btn: (label, action, cls, title, options) => (root as any).btn(label, action, cls, title, options),
  headOnly: (title, subtitle, actions) => (root as any).headOnly(title, subtitle, actions),
  dateBox: (id, value, cls, attrs) => (root as any).dateBox(id, value, cls, attrs),
  openModal: html => root.openModal(html), closeModal: () => root.closeModal(), confirmDialog: opts => root.confirmDialog(opts),
  searchText: value => (root as any).searchText(value), vnDate: value => vnDate(value),
  fmt: (value, decimals) => fmt(value, decimals), fmtTestValue: (test, value) => (root as any).fmtTestValue(test, value),
  fmtTestStat: (test, value) => (root as any).fmtTestStat(test, value), fmtPointValue: (point, test) => (root as any).fmtPointValue(point, test),
  isoToday: () => (root as any).isoToday(), isoMonth: () => (root as any).isoMonth(), dateObj: value => (root as any).dateObj(value),
  testDisplayName: test => root.testDisplayName!(test), stateName: value => root.stateName!(value as string),
  operationalTests: () => (root as any).operationalTests(), operationalLevels: test => (root as any).operationalLevels(test),
  operationalLotGroupForTest: test => (root as any).operationalLotGroupForTest(test), operationalTestOrder: test => (root as any).operationalTestOrder(test),
  activeWestgard: test => (root as any).activeWestgard(test), parallelWestgard: (test, column) => (root as any).parallelWestgard(test, column),
  entryColumns: test => (root as any).entryColumns(test), entryColumnPoints: (test, column, includeVoided) => (root as any).entryColumnPoints(test, column, includeVoided),
  pointsForLot: (testId, level, lotNo) => (root as any).pointsForLot(testId, level, lotNo), pointsOf: (testId, level) => (root as any).pointsOf(testId, level),
  acceptedLotPoints: (test, level) => (root as any).acceptedLotPoints(test, level), previousLotSeries: (test, level) => (root as any).previousLotSeries(test, level),
  testRuleOnWithin: (test, rule) => (root as any).testRuleOnWithin(test, rule), ruleResultLevel: (test, rules) => (root as any).ruleResultLevel(test, rules),
  qcVerdictLabel: level => root.qcVerdictLabel!(level), canEnterQcForLevel: (test, level) => (root as any).canEnterQcForLevel(test, level),
  rangeCandidate: (testId, level) => (root as any).rangeCandidate(testId, level), rangeActions: (testId, level, eligible, applied) => root.rangeActions!(testId, level as number, eligible as boolean, applied as string),
  errorType: rules => (root as any).errorType(rules), qcPointWarnings: (test, cfg, date, runId, value) => root.qcPointWarnings!(test, cfg, date, runId, value as number),
  qcValueDecimals: value => (root as any).qcValueDecimals(value), currentStaff: () => (root as any).currentStaff(), uid: () => (root as any).uid(),
  nextNceId: today => (root as any).nextNceId(today), nceDueDate: days => (root as any).nceDueDate(days),
  pointVoidVerdict: (test, point) => (root as any).pointVoidVerdict(test, point), pointRunNo: point => (root as any).pointRunNo(point),
  pointStaff: point => (root as any).pointStaff(point), stats: values => root.QCCore!.stats(values), lvlCfg: (test, level) => lvlCfg(test, level),
  QCCore: { westgardByPoint: (points, mean, sd, ruleOn) => (root.QCCore as any).westgardByPoint(points, mean, sd, ruleOn), cleanText: (value, maxLength) => root.QCCore!.cleanText(value, maxLength) },
  EntryService: root.EntryService, EntryRecordWorkflowCommand: root.EntryRecordWorkflowCommand,
  EntryVoidWorkflowCommand: root.EntryVoidWorkflowCommand, EntryDateNoteWorkflowCommand: root.EntryDateNoteWorkflowCommand,
  pres: root as any,
});
root.pageEntry = entryPageController.pageEntry;
root.entryWindow = entryPageController.entryWindow;
root.entryWindowFor = entryPageController.entryWindowFor;
root.entryRowsWindow = entryPageController.entryRowsWindow;
root.entryToggleRows = entryPageController.entryToggleRows;
root.entryDetailToggled = entryPageController.entryDetailToggled;
root.entryTreeIsCollapsed = entryPageController.entryTreeIsCollapsed;
root.treeToggle = entryPageController.treeToggle;
root.toggleEntryTree = entryPageController.toggleEntryTree;
root.entryTreeKey = entryPageController.entryTreeKey;
root.entryFilter = entryPageController.entryFilter;
root.entryPick = entryPageController.entryPick;
root.entryFocusLevel = entryPageController.entryFocusLevel;
root.entryShowPrevLot = entryPageController.entryShowPrevLot;
root.entryShowCurrentLot = entryPageController.entryShowCurrentLot;
root.entryFocusPendingSheet = entryPageController.entryFocusPendingSheet;
root.entrySheetInputs = entryPageController.entrySheetInputs;
root.entrySheetTarget = entryPageController.entrySheetTarget;
root.entrySheetKey = entryPageController.entrySheetKey;
root.entryLatestTreeState = entryPageController.entryLatestTreeState;
root.entrySyncTreeState = entryPageController.entrySyncTreeState;
root.entryRenderKeepScroll = entryPageController.entryRenderKeepScroll;
root.entrySetLastMsg = entryPageController.entrySetLastMsg;
root.entryUnlockExtraRun = entryPageController.entryUnlockExtraRun;
root.entryDateNoteSave = entryPageController.entryDateNoteSave;
root.entryColumnCfg = entryPageController.entryColumnCfg;
root.entryInlineSave = entryPageController.entryInlineSave;
root.entryInlineSaveCommit = entryPageController.entryInlineSaveCommit;
root.syncVoidNceChoice = entryPageController.syncVoidNceChoice;
root.voidQcPoint = entryPageController.voidQcPoint;
root.confirmVoidQcPoint = entryPageController.confirmVoidQcPoint;
root.entrySetSheetMonth = entryPageController.entrySetSheetMonth;
root.entryGoToday = entryPageController.entryGoToday;
root.entrySetSheetPart = entryPageController.entrySetSheetPart;
root.entrySetDays = entryPageController.entrySetDays;
root.entrySetStart = entryPageController.entrySetStart;
root.entrySetEnd = entryPageController.entrySetEnd;
/* actions-page-controller.ts <-> action-form-controller.ts phụ thuộc HAI CHIỀU thật sự
   (xem ghi chú đầu mỗi file): dựng action-form trước với 3 dep trỏ qua biến tham chiếu
   `actionsPageControllerRef` (gán sau khi actions-page-controller.ts dựng xong), rồi
   dựng actions-page với `formHtml`/`captureFormDraft` trỏ thẳng vào action-form vì lúc
   đó nó đã tồn tại. */
let actionsPageControllerRef: any = null;
const actionFormController = createActionFormController({
  getState: () => state, document: () => typeof document !== 'undefined' ? document : ({ getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] } as unknown as Document),
  actionUi: () => (root as any).actionFormUiState, currentUser: () => currentUser,
  rerender: () => rerender(), requireWrite: () => requireWrite(), canWrite: () => root.canWrite(),
  infoDialog: (message, opts) => root.infoDialog(message, opts),
  esc: value => (root as any).esc(value), escapeAttr: value => (root as any).escAttr(value), jsq: value => jsq(value),
  btn: (label, action, cls, title, options) => (root as any).btn(label, action, cls, title, options),
  dateBox: (id, value, cls, attrs) => (root as any).dateBox(id, value, cls, attrs),
  vnDate: value => vnDate(value), fmt: (value, decimals) => fmt(value, decimals),
  fmtPointValue: (point, test) => (root as any).fmtPointValue(point, test),
  fmtTestValue: (test, value) => (root as any).fmtTestValue(test, value), fmtTestStat: (test, value) => (root as any).fmtTestStat(test, value),
  testDisplayName: test => root.testDisplayName!(test), userName: () => userName(),
  parseVN: value => (root as any).parseVN(value), isoToday: () => (root as any).isoToday(),
  operationalLevels: test => (root as any).operationalLevels(test), operationalTests: () => (root as any).operationalTests(),
  lvlCfg: (test, level) => lvlCfg(test, level), nextNceId: today => (root as any).nextNceId(today),
  QCCore: { cleanText: (value, maximumLength) => root.QCCore!.cleanText(value, maximumLength), WG_RULES: (root.QCCore as any).WG_RULES },
  ACTION_LABELS: () => typeof (root as any).ACTION_LABELS !== 'undefined' ? (root as any).ACTION_LABELS : { check: {}, containment: {}, patient: {}, cause: {}, source: {}, phase: {}, risk: {}, release: {} },
  actionApprovalStatus: a => (root as any).actionApprovalStatus(a), actionCancelled: a => (root as any).actionCancelled(a),
  actionWorkflowStatus: a => (root as any).actionWorkflowStatus(a), actionRerunStatus: a => (root as any).actionRerunStatus(a),
  actionRiskScore: a => (root as any).actionRiskScore(a), actionResidualRiskScore: a => (root as any).actionResidualRiskScore(a),
  actionProtocolStatus: form => (root as any).actionProtocolStatus(form),
  ActionProtocolService: root.ActionProtocolService, ActionBiasService: root.ActionBiasService, ActionBiasPresentation: root.ActionBiasPresentation,
  ActionChecklistPresentation: root.ActionChecklistPresentation, ActionInvestigationPresentation: root.ActionInvestigationPresentation,
  ActionFormModel: root.ActionFormModel, NceFormWorkflowCommand: root.NceFormWorkflowCommand,
  levelShort: (t, level, lotSnap) => actionsPageControllerRef.actionLevelShort(t, level, lotSnap),
  evidenceTimelineHtml: (a, rr) => actionsPageControllerRef.actionEvidenceTimelineHtml(a, rr),
  rerunEvidenceHtml: (a, rr, t) => actionsPageControllerRef.actionRerunEvidenceHtml(a, rr, t),
  pres: root as any,
});
root.actionUi = actionFormController.actionUi;
root.actionSectionToggled = actionFormController.actionSectionToggled;
root.actionDefaultOpenSections = actionFormController.actionDefaultOpenSections;
root.actionRuleOptions = actionFormController.actionRuleOptions;
root.actionStaffOptions = actionFormController.actionStaffOptions;
root.captureActionDraft = actionFormController.captureActionDraft;
root.actionFormChanged = actionFormController.actionFormChanged;
root.actionDraftValues = actionFormController.actionDraftValues;
root.clearActionDraft = actionFormController.clearActionDraft;
root.actionSourceOptions = actionFormController.actionSourceOptions;
root.actionCausePhrases = actionFormController.actionCausePhrases;
root.actionActionPhrases = actionFormController.actionActionPhrases;
root.actionSuggestRow = actionFormController.actionSuggestRow;
root.actionSuggestBox = actionFormController.actionSuggestBox;
root.actionInsertSuggestion = actionFormController.actionInsertSuggestion;
root.syncActionSuggestions = actionFormController.syncActionSuggestions;
root.actSel = actionFormController.actSel;
root.actionLevelLabel = actionFormController.actionLevelLabel;
root.syncActLevels = actionFormController.syncActLevels;
root.actionLevelContext = actionFormController.actionLevelContext;
root.beginActionManual = actionFormController.beginActionManual;
root.closeActionForm = actionFormController.closeActionForm;
root.actionFormClosedHtml = actionFormController.actionFormClosedHtml;
root.actionIncidentBanner = actionFormController.actionIncidentBanner;
root.beginActionFromIssue = actionFormController.beginActionFromIssue;
root.actionFieldValue = actionFormController.actionFieldValue;
root.readActionProtocolForm = actionFormController.readActionProtocolForm;
root.actionEffectivenessMissingKey = actionFormController.actionEffectivenessMissingKey;
root.addAction = actionFormController.addAction;
root.syncActionRiskScore = actionFormController.syncActionRiskScore;
root.syncActionResidualRiskScore = actionFormController.syncActionResidualRiskScore;
root.editAction = actionFormController.editAction;
root.actionInvestigationField = actionFormController.actionInvestigationField;
root.actionInvestigationChoiceLabel = actionFormController.actionInvestigationChoiceLabel;
root.actionInvestigationStateClass = actionFormController.actionInvestigationStateClass;
root.actionInvestigationChoose = actionFormController.actionInvestigationChoose;
root.actionInvestigationSync = actionFormController.actionInvestigationSync;
root.actionChecklistRefresh = actionFormController.actionChecklistRefresh;
root.actionSectionChip = actionFormController.actionSectionChip;
root.actionChecklistChip = actionFormController.actionChecklistChip;
root.actionEffSectionChip = actionFormController.actionEffSectionChip;
root.actionUpdateSectionChip = actionFormController.actionUpdateSectionChip;
root.actionRefreshSectionChips = actionFormController.actionRefreshSectionChips;
root.actionSection = actionFormController.actionSection;
root.actionFormModel = actionFormController.actionFormModel;
root.actionFormDefaults = actionFormController.actionFormDefaults;
root.focusActionField = actionFormController.focusActionField;
root.actionBiasInfo = actionFormController.actionBiasInfo;
root.actionBiasContext = actionFormController.actionBiasContext;
root.actionLatestSigmaBias = actionFormController.actionLatestSigmaBias;
root.actionFillBias = actionFormController.actionFillBias;
root.actionBiasThresholdHtml = actionFormController.actionBiasThresholdHtml;
root.actionBiasReferenceHtml = actionFormController.actionBiasReferenceHtml;
root.actionUpdateBiasHint = actionFormController.actionUpdateBiasHint;
root.actionFormHtml = actionFormController.actionFormHtml;
const actionsPageController = createActionsPageController({
  getState: () => state, document: () => typeof document !== 'undefined' ? document : ({ getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] } as unknown as Document),
  entryUi: () => (root as any).EntryUIState, currentPage: () => (root as any).RouterUIState.page, currentUser: () => currentUser,
  rerender: () => rerender(), role: () => role(), userName: () => userName(), canWrite: () => root.canWrite(), requireWrite: () => requireWrite(),
  requireAdmin: message => root.requireAdmin(message), reauthenticateCurrentUser: opts => (root as any).reauthenticateCurrentUser(opts),
  openModal: html => root.openModal(html), closeModal: () => root.closeModal(), confirmDialog: opts => root.confirmDialog(opts), infoDialog: (message, opts) => root.infoDialog(message, opts),
  esc: value => (root as any).esc(value), jsq: value => jsq(value),
  btn: (label, action, cls, title, options) => (root as any).btn(label, action, cls, title, options),
  headOnly: (title, subtitle, actions) => (root as any).headOnly(title, subtitle, actions),
  vnDate: value => vnDate(value), formatDateTimeVN: value => formatDateTimeVN(value as string),
  fmtPointValue: (point, test) => (root as any).fmtPointValue(point, test), testDisplayName: test => root.testDisplayName!(test), stateName: value => root.stateName!(value as string),
  errorType: rules => (root as any).errorType(rules), fixHint: rules => (root as any).fixHint(rules), lvlCfg: (test, level) => lvlCfg(test, level),
  pointWorkflowSummary: pointId => (root as any).pointWorkflowSummary(pointId), pointRealActions: pointId => typeof (root as any).pointRealActions === 'function' ? (root as any).pointRealActions(pointId) : [],
  go: page => (root as any).go(page),
  ACTION_LABELS: () => typeof (root as any).ACTION_LABELS !== 'undefined' ? (root as any).ACTION_LABELS : { check: {}, containment: {}, patient: {}, cause: {}, source: {}, phase: {}, risk: {}, release: {} },
  actionApprovalStatus: a => (root as any).actionApprovalStatus(a), actionApprovalLabel: a => (root as any).actionApprovalLabel(a),
  actionCancelled: a => (root as any).actionCancelled(a), actionRecorded: a => (root as any).actionRecorded(a),
  actionWorkflowStatus: a => (root as any).actionWorkflowStatus(a), actionOverdue: a => (root as any).actionOverdue(a),
  actionEffectivenessStatus: a => (root as any).actionEffectivenessStatus(a), actionResidualRiskScore: a => (root as any).actionResidualRiskScore(a),
  actionRiskScore: a => (root as any).actionRiskScore(a), actionRerunStatus: a => (root as any).actionRerunStatus(a), actionEventDate: a => (root as any).actionEventDate(a),
  ActionReviewService: root.ActionReviewService, ActionReviewMessages: root.ActionReviewMessages, ActionEscalationService: root.ActionEscalationService,
  ActionListPresentation: root.ActionListPresentation, ActionStatusPresentation: root.ActionStatusPresentation, ActionReviewPresentation: root.ActionReviewPresentation,
  ActionDetailPresentation: root.ActionDetailPresentation, ActionEvidencePresentation: root.ActionEvidencePresentation, ActionRerunEvidencePresentation: root.ActionRerunEvidencePresentation,
  ActionViolationService: root.ActionViolationService, ActionGuidePresentation: root.ActionGuidePresentation, ActionCurrentIssues: () => root.ActionCurrentIssues!(),
  NceLifecycleWorkflowCommand: root.NceLifecycleWorkflowCommand, actionFormUiState: (root as any).actionFormUiState, modalTemplate: opts => root.modalTemplate(opts),
  QCCore: { cleanText: (value, maximumLength) => root.QCCore!.cleanText(value, maximumLength) },
  formHtml: issueCount => actionFormController.actionFormHtml(issueCount),
  captureFormDraft: () => actionFormController.captureActionDraft(),
  pres: root as any,
});
actionsPageControllerRef = actionsPageController;
root.actionLevelShort = actionsPageController.actionLevelShort;
root.currentIssues = actionsPageController.currentIssues;
root.cancelAction = actionsPageController.cancelAction;
root.confirmCancelAction = actionsPageController.confirmCancelAction;
root.actionApprovalTag = actionsPageController.actionApprovalTag;
root.actionApprovalToken = actionsPageController.actionApprovalToken;
root.approveAction = actionsPageController.approveAction;
root.confirmApproveAction = actionsPageController.confirmApproveAction;
root.returnAction = actionsPageController.returnAction;
root.confirmReturnAction = actionsPageController.confirmReturnAction;
root.actionCanEscalate = actionsPageController.actionCanEscalate;
root.escalateAction = actionsPageController.escalateAction;
root.actionCanReopen = actionsPageController.actionCanReopen;
root.reopenAction = actionsPageController.reopenAction;
root.confirmReopenAction = actionsPageController.confirmReopenAction;
root.actionReviewButtons = actionsPageController.actionReviewButtons;
root.actionSideChips = actionsPageController.actionSideChips;
root.actionDetailCheck = actionsPageController.actionDetailCheck;
root.actionEvidenceTimelineHtml = actionsPageController.actionEvidenceTimelineHtml;
root.actionRerunEvidenceHtml = actionsPageController.actionRerunEvidenceHtml;
root.openActionQcEvidence = actionsPageController.openActionQcEvidence;
root.viewActionDetail = actionsPageController.viewActionDetail;
root.openActionGuide = actionsPageController.openActionGuide;
root.groupIssuesByTestDate = actionsPageController.groupIssuesByTestDate;
root.issueRowHtml = actionsPageController.issueRowHtml;
root.actionViolationInfo = actionsPageController.actionViolationInfo;
root.actionQcVerdictLabel = actionsPageController.actionQcVerdictLabel;
root.openActionIssueHtml = actionsPageController.openActionIssueHtml;
root.actionIssueGroupHtml = actionsPageController.actionIssueGroupHtml;
root.pageActionsV4 = actionsPageController.pageActionsV4;
root.ReagentComparisonService = createReagentComparisonService({
  cleanText: root.QCCore.cleanText,
  cleanId: root.QCCore.cleanId,
});
root.ReagentComparisonWorkflowCommand=createReagentComparisonWorkflowCommand({current:()=>state,comparison:root.ReagentComparisonService,label:comparison=>(globalThis as any).rcLabel(comparison),log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options)});
root.reagentReportPresentation = reagentReportPresentation;
root.reagentChartPresentation = reagentChartPresentation;
root.reagentReportItemPresentation = reagentReportItemPresentation;
root.reagentComparisonLabelPresentation = reagentComparisonLabelPresentation;
root.reagentQuickLabelPresentation = reagentQuickLabelPresentation;
root.reagentToolIconPresentation = reagentToolIconPresentation;
root.reagentQuickPickerModalPresentation = reagentQuickPickerModalHtml;
root.reagentPickerModalPresentation = reagentPickerModalHtml;
root.reagentCreateModalPresentation = reagentCreateModalHtml;
root.reagentEmptyPageHtml = reagentEmptyPageHtml;
root.reagentToolbarHtml = reagentToolbarHtml;
root.reagentPairPanelHtml = reagentPairPanelHtml;
root.reagentInfoPanelHtml = reagentInfoPanelHtml;
root.reagentChartsPanelHtml = reagentChartsPanelHtml;
root.reagentResultsPanelsHtml = reagentResultsPanelsHtml;
root.reagentChartAxis = reagentChartAxis;
root.reagentScatterSvg = reagentScatterSvg;
root.reagentBlandSvg = reagentBlandSvg;
root.reagentQuickPickerRowsHtml = reagentQuickPickerRowsHtml;
root.reagentPickerRowsHtml = reagentPickerRowsHtml;
root.reagentCreateReferenceRowsHtml = reagentCreateReferenceRowsHtml;
root.reagentCreateTypedRowHtml = reagentCreateTypedRowHtml;
root.reagentReportDetailCardHtml = reagentReportDetailCardHtml;
root.reagentReportChartGridHtml = reagentReportChartGridHtml;
root.reagentPairMath = reagentPairMath;
root.reagentComparisonCalculator = createReagentComparisonCalculator({
  validPairs: reagentPairMath.validPairs, mean: reagentStatistics.mean, variance: reagentStatistics.variance,
  max: reagentStatistics.max, min: reagentStatistics.min, pearson: reagentStatistics.pearson,
  ols: reagentStatistics.ols, passingBablok: reagentStatistics.passingBablok,
  twoSidedPValue: reagentTDistribution.twoSidedPValue, tCritical: reagentTDistribution.tCritical,
});
const reagentPageController=createReagentPageController({
  document:typeof document!=='undefined'?document:({getElementById:()=>null,querySelector:()=>null} as unknown as Document),
  getState:()=>state,
  ui:()=>(root as any).ReagentUIState,
  save:opts=>save(opts),
  rerender:()=>rerender(),
  requestFrame:(work,delay)=>setTimeout(work,delay),
  logAct:(action,detail,target)=>logAct(action,detail,target),
  esc:value=>(root as any).esc(value),
  escapeAttr:value=>(root as any).escAttr(value),
  fmt:(value,decimals)=>fmt(value,decimals),
  jsq:value=>(root as any).jsq(value),
  vnDate:value=>vnDate(value),
  formatDateTimeVN:value=>formatDateTimeVN(value as any),
  parseVN:value=>(root as any).parseVN(value),
  cleanText:(value,max)=>(root.QCCore as any).cleanText(value,max),
  uid:()=>uid(),
  canWrite:()=>root.canWrite(),
  requireWrite:()=>root.requireWrite(),
  requireAdmin:()=>root.requireAdmin(),
  dateBox:(id,value,cls,attrs)=>(root as any).dateBox(id,value,cls,attrs),
  button:(label,action,cls,title,options)=>(root as any).btn(label,action,cls,title,options),
  headOnly:(title,subtitle,actions)=>(root as any).headOnly(title,subtitle,actions),
  emptyState:(title,body,actions)=>(root as any).emptyState(title,body,actions),
  searchText:value=>root.normalizeSearchText!(value),
  openModal:html=>root.openModal(html),
  closeModal:()=>root.closeModal(),
  confirmDialog:opts=>root.confirmDialog(opts),
  infoDialog:(message,opts)=>root.infoDialog(message,opts),
  scheduleSearchRender:(owner,apply,focusId)=>root.scheduleSearchRender(owner,apply,focusId),
  reportHeader:title=>(root as any).reportHeader(title),
  signBlock:()=>(root as any).signBlock(),
  openPrint:(title,body)=>(root as any).openPrint(title,body),
  teaAnalyteDisplay:name=>(root as any).teaAnalyteDisplay(name),
  refTests:()=>REFTESTS as any,
  service:root.ReagentComparisonService,
  workflow:root.ReagentComparisonWorkflowCommand,
  pres:{
    comparisonLabel:(root as any).reagentComparisonLabelPresentation,
    pairMath:(root as any).reagentPairMath,
    calculator:(root as any).reagentComparisonCalculator,
    chartAxis:(root as any).reagentChartAxis,
    chart:(root as any).reagentChartPresentation,
    toolIcon:(root as any).reagentToolIconPresentation,
    scatterSvg:(root as any).reagentScatterSvg,
    blandSvg:(root as any).reagentBlandSvg,
    selectOptions:(root as any).reagentSelectOptionsHtml,
    emptyPage:(root as any).reagentEmptyPageHtml,
    pairRow:(root as any).reagentPairRowHtml,
    toolbar:(root as any).reagentToolbarHtml,
    pairPanel:(root as any).reagentPairPanelHtml,
    infoPanel:(root as any).reagentInfoPanelHtml,
    chartsPanel:(root as any).reagentChartsPanelHtml,
    resultsPanels:(root as any).reagentResultsPanelsHtml,
    resultHtml:(root as any).reagentResultHtml,
    quickLabel:(root as any).reagentQuickLabelPresentation,
    quickPickerRows:(root as any).reagentQuickPickerRowsHtml,
    quickPickerModal:(root as any).reagentQuickPickerModalPresentation,
    pickerRows:(root as any).reagentPickerRowsHtml,
    pickerModal:(root as any).reagentPickerModalPresentation,
    createReferenceRows:(root as any).reagentCreateReferenceRowsHtml,
    createTypedRow:(root as any).reagentCreateTypedRowHtml,
    createModal:(root as any).reagentCreateModalPresentation,
    report:(root as any).reagentReportPresentation,
    reportDetailCard:(root as any).reagentReportDetailCardHtml,
    reportChartGrid:(root as any).reagentReportChartGridHtml,
    reportItem:(root as any).reagentReportItemPresentation,
  },
});
{const rc:any=reagentPageController;for(const k of Object.keys(rc))(root as any)[k]=rc[k];}
root.SigmaCohortService = createSigmaCohortService({ stats: root.QCCore.stats });
const sigmaPageController = createSigmaPageController({
  getState: () => state, document: () => typeof document !== 'undefined' ? document : ({ getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] } as unknown as Document),
  window: () => typeof window !== 'undefined' ? window : ({ innerWidth: 1024, innerHeight: 768 } as unknown as Window),
  ui: () => (root as any).SigmaUIState, currentPage: () => (root as any).RouterUIState.page,
  rerender: () => rerender(), role: () => role(), userName: () => userName(), canWrite: () => root.canWrite(),
  requireWrite: () => requireWrite(), requireAdmin: message => root.requireAdmin(message),
  openModal: html => root.openModal(html), closeModal: () => root.closeModal(), infoDialog: (message, opts) => root.infoDialog(message, opts),
  esc: value => (root as any).esc(value), escapeAttr: value => (root as any).escAttr(value), jsq: value => jsq(value),
  btn: (label, action, cls, title, options) => (root as any).btn(label, action, cls, title, options),
  headOnly: (title, subtitle, actions) => (root as any).headOnly(title, subtitle, actions),
  emptyState: (title, body, actions) => (root as any).emptyState(title, body, actions),
  dateBox: (id, value, cls, attrs) => (root as any).dateBox(id, value, cls, attrs),
  vnDate: value => vnDate(value), vnPeriod: value => (root as any).vnPeriod(value),
  fmt: (value, decimals) => fmt(value, decimals), isoMonth: () => (root as any).isoMonth(), isoDate: value => (root as any).isoDate(value),
  uid: () => (root as any).uid(), icoDownload: () => (root as any).icoDownload(),
  testDisplayName: test => root.testDisplayName!(test), instrumentName: (id, fallback) => root.instrumentName!(id, fallback),
  operationalLevels: test => (root as any).operationalLevels(test), operationalTestOrder: test => (root as any).operationalTestOrder(test),
  searchText: value => (root as any).searchText(value), scheduleSearchRender: (owner, apply, focusId) => root.scheduleSearchRender(owner, apply, focusId),
  qcTooltip: () => (root as any).qcTooltip(), save: options => save(options),
  QCCore: { westgardSigmaRules: sigma => (root.QCCore as any).westgardSigmaRules(sigma), stats: values => root.QCCore!.stats(values), uncertaintyBudget: input => (root.QCCore as any).uncertaintyBudget(input) },
  effectiveTeaRefs: () => root.effectiveTeaRefs!(), sgTea: t => (root as any).sgTea(t), sgTeaSource: t => (root as any).sgTeaSource(t),
  sgTeaBySource: (t, source, target) => (root as any).sgTeaBySource(t, source, target), sgTeaCriterionText: (t, source) => (root as any).sgTeaCriterionText(t, source),
  sgTeaLabel: source => (root as any).sgTeaLabel(source), sgTeaSnapshot: t => (root as any).sgTeaSnapshot(t),
  sgSetLevelTeaSnapshot: (t, e, level, force) => (root as any).sgSetLevelTeaSnapshot(t, e, level, force), sgLevelTarget: (t, L, level) => (root as any).sgLevelTarget(t, L, level),
  sgEntryTea: (t, e, level, refs) => (root as any).sgEntryTea(t, e, level, refs), sgEnsureTeaSnapshot: (t, e) => (root as any).sgEnsureTeaSnapshot(t, e),
  SigmaPresentation: root.SigmaPresentation, SigmaLevelEditService: root.SigmaLevelEditService, SigmaBiasService: root.SigmaBiasService,
  SigmaBiasWorkflowService: root.SigmaBiasWorkflowService, SigmaPeriodViewModel: root.SigmaPeriodViewModel, SigmaTeaSnapshotService: root.SigmaTeaSnapshotService,
  SigmaTeaEditService: root.SigmaTeaEditService, SigmaLevelSelectionService: root.SigmaLevelSelectionService, SigmaPeriodSelectionService: root.SigmaPeriodSelectionService,
  SigmaTrackedTestService: root.SigmaTrackedTestService, SigmaCohortService: root.SigmaCohortService, SigmaCohortSelectionService: root.SigmaCohortSelectionService,
  SigmaCohortImportService: root.SigmaCohortImportService, SigmaPeriodRecordService: root.SigmaPeriodRecordService, SigmaMuWorkflowCommand: root.SigmaMuWorkflowCommand,
  pres: root as any,
});
root.sgZone = sigmaPageController.sgZone;
root.sgFmtDPMO = sigmaPageController.sgFmtDPMO;
root.sgData = sigmaPageController.sgData;
root.sgInputValue = sigmaPageController.sgInputValue;
root.sgInputDisplayValue = sigmaPageController.sgInputDisplayValue;
root.sgCleanCell = sigmaPageController.sgCleanCell;
root.sgBiasVal = sigmaPageController.sgBiasVal;
root.sgIsAutoCV = sigmaPageController.sgIsAutoCV;
root.sgReadiness = sigmaPageController.sgReadiness;
root.sgBiasRefU = sigmaPageController.sgBiasRefU;
root.sgMuBiasMode = sigmaPageController.sgMuBiasMode;
root.sgMU = sigmaPageController.sgMU;
root.sgComp = sigmaPageController.sgComp;
root.sgRows = sigmaPageController.sgRows;
root.sgSyncCurrentPeriodTea = sigmaPageController.sgSyncCurrentPeriodTea;
root.sgReconcileAllTeaSnapshots = sigmaPageController.sgReconcileAllTeaSnapshots;
root.sgSetTea = sigmaPageController.sgSetTea;
root.sgSetTeaSource = sigmaPageController.sgSetTeaSource;
root.sgSetTeaMeta = sigmaPageController.sgSetTeaMeta;
root.sgRefreshSoon = sigmaPageController.sgRefreshSoon;
root.sgTrackedTests = sigmaPageController.sgTrackedTests;
root.sgTrackedOptions = sigmaPageController.sgTrackedOptions;
root.sgHistoricalLevels = sigmaPageController.sgHistoricalLevels;
root.sgVisibleLevels = sigmaPageController.sgVisibleLevels;
root.sgPeriodLevels = sigmaPageController.sgPeriodLevels;
root.sgPickTest = sigmaPageController.sgPickTest;
root.sgStatusPeriodId = sigmaPageController.sgStatusPeriodId;
root.sgSelectPeriod = sigmaPageController.sgSelectPeriod;
root.sgRemoveTracked = sigmaPageController.sgRemoveTracked;
root.sgOpenAddTest = sigmaPageController.sgOpenAddTest;
root.sgAddTestSearchSet = sigmaPageController.sgAddTestSearchSet;
root.sgViewTrackedTest = sigmaPageController.sgViewTrackedTest;
root.sgRenderAddTestModal = sigmaPageController.sgRenderAddTestModal;
root.sgTrackTest = sigmaPageController.sgTrackTest;
root.pageSigma = sigmaPageController.pageSigma;
root.sgOpSpecCell = sigmaPageController.sgOpSpecCell;
root.sgFrequencyHTML = sigmaPageController.sgFrequencyHTML;
root.sgMuDominant = sigmaPageController.sgMuDominant;
root.sgMuStateChip = sigmaPageController.sgMuStateChip;
root.sgMuHTML = sigmaPageController.sgMuHTML;
root.sgRefresh = sigmaPageController.sgRefresh;
root.sgTips = sigmaPageController.sgTips;
root.sgPointTipShow = sigmaPageController.sgPointTipShow;
root.sgPointTipHide = sigmaPageController.sgPointTipHide;
root.sgTrendSVG = sigmaPageController.sgTrendSVG;
root.sgMDCSVG = sigmaPageController.sgMDCSVG;
root.sgBiasRowsFromDom = sigmaPageController.sgBiasRowsFromDom;
root.sgBiasPeriodsFromDom = sigmaPageController.sgBiasPeriodsFromDom;
root.sgBiasStats = sigmaPageController.sgBiasStats;
root.sgBiasRoundsKey = sigmaPageController.sgBiasRoundsKey;
root.sgBiasLinkedPeriodIds = sigmaPageController.sgBiasLinkedPeriodIds;
root.sgOpenBias = sigmaPageController.sgOpenBias;
root.sgRenderBiasModal = sigmaPageController.sgRenderBiasModal;
root.sgBiasUpdateSummary = sigmaPageController.sgBiasUpdateSummary;
root.sgBiasSelectPeriods = sigmaPageController.sgBiasSelectPeriods;
root.sgBiasAdd = sigmaPageController.sgBiasAdd;
root.sgBiasDel = sigmaPageController.sgBiasDel;
root.sgApplyBiasToPeriods = sigmaPageController.sgApplyBiasToPeriods;
root.sgBiasApply = sigmaPageController.sgBiasApply;
root.sgMuRowsFromDom = sigmaPageController.sgMuRowsFromDom;
root.sgMuPeriodsFromDom = sigmaPageController.sgMuPeriodsFromDom;
root.sgMuCaptureDom = sigmaPageController.sgMuCaptureDom;
root.sgMuPreview = sigmaPageController.sgMuPreview;
root.sgMuUpdatePreview = sigmaPageController.sgMuUpdatePreview;
root.sgOpenMU = sigmaPageController.sgOpenMU;
root.sgRenderMuModal = sigmaPageController.sgRenderMuModal;
root.sgMuSelectPeriods = sigmaPageController.sgMuSelectPeriods;
root.sgMuApply = sigmaPageController.sgMuApply;
root.sgCell = sigmaPageController.sgCell;
root.sgPeriodSel = sigmaPageController.sgPeriodSel;
root.sgPart = sigmaPageController.sgPart;
root.sgAddPeriod = sigmaPageController.sgAddPeriod;
root.sgDelPeriod = sigmaPageController.sgDelPeriod;
root.sgClearImportedCV = sigmaPageController.sgClearImportedCV;
root.sgCohortCutoff = sigmaPageController.sgCohortCutoff;
root.sgCohortGroups = sigmaPageController.sgCohortGroups;
root.sgCohortStatusText = sigmaPageController.sgCohortStatusText;
root.sgImportCohort = sigmaPageController.sgImportCohort;
root.sgApplyCohortChoices = sigmaPageController.sgApplyCohortChoices;
root.sgCohortImportMessage = sigmaPageController.sgCohortImportMessage;
root.sgRenderCohortModal = sigmaPageController.sgRenderCohortModal;
root.sgCohortClose = sigmaPageController.sgCohortClose;
root.sgCohortApply = sigmaPageController.sgCohortApply;
root.sgPullCV = sigmaPageController.sgPullCV;
root.esc=escapeHtml;
root.escAttr=escapeHtmlAttr;
const reportPrintController=createReportPrintController({
  reportQcFormat:{value:(t:any,v:any)=>(root.reportQcFormat as any).value(t,v),stat:(t:any,v:any)=>(root.reportQcFormat as any).stat(t,v),point:(p:any,t:any)=>(root.reportQcFormat as any).point(p,t)},
  reportHeaderPresentation:input=>root.reportHeaderPresentation!(input),
  lab:()=>state.lab,
  app:()=>typeof window==='undefined'?{version:'dev'}:(window as any).QCLAB_APP||{version:'dev'},
  westgardRules:()=>state.westgardRules,
  formatDateTimeVN:value=>(globalThis as any).formatDateTimeVN(value),
  userName:()=>(globalThis as any).userName(),
  reportSignBlock:()=>root.reportSignBlock!(),
  openPrintWindow:()=>window.open('','_blank'),
  infoDialog:message=>root.infoDialog!(message),
  openPrint:(title,body,options)=>(root as any).openPrint(title,body,options),
  currentHref:()=>location.href,
  hasPdfPrinter:()=>!!(window as any).qcPrintPdf,
  sigmaPrintRowsService:{periodRows:(row:any,levels:any)=>(root.sigmaPrintRowsService as any).periodRows(row,levels),periodsRows:(rows:any,levels:any)=>(root.sigmaPrintRowsService as any).periodsRows(rows,levels)},
  sigmaMuPrintRowsService:{periodRows:(t:any,row:any,levels:any)=>(root.sigmaMuPrintRowsService as any).periodRows(t,row,levels),periodsRows:(t:any,rows:any,levels:any)=>(root.sigmaMuPrintRowsService as any).periodsRows(t,rows,levels)},
  sigmaMuTraceService:(row,levels)=>root.sigmaMuTraceService!(row,levels),
  findTest:id=>(state.tests||[]).find((test:any)=>test.id===id),
  sgTest:()=>(globalThis as any).sgTest,
  selTest:()=>(globalThis as any).selTest,
  sgData:tid=>root.sgData!(tid),
  sgVisibleLevels:t=>root.sgVisibleLevels!(t),
  sgRows:(t,data,levels)=>root.sgRows!(t,data,levels),
  sigmaReportRows:(tid,mode,period,entryId)=>(globalThis as any).sigmaReportRows(tid,mode,period,entryId),
  vnPeriod:value=>(globalThis as any).vnPeriod(value),
  sigmaTeaTrace:exportRows=>(globalThis as any).sigmaTeaTrace(exportRows),
  instrumentName:(instrumentId,machine)=>(globalThis as any).instrumentName(instrumentId,machine),
  testDisplayName:t=>(globalThis as any).testDisplayName(t),
  sgFrequencyHTML:(t,row,levels)=>root.sgFrequencyHTML!(t,row,levels),
  sgTrendSVG:(t,valid,levels)=>root.sgTrendSVG!(t,valid,levels),
  sgMDCSVG:(t,valid,levels)=>root.sgMDCSVG!(t,valid,levels),
  sigmaExportPeriods:exportRows=>(globalThis as any).sigmaExportPeriods(exportRows),
  activeWestgard:t=>(globalThis as any).activeWestgard(t),
  westgardByPoint:(points,mean,sd,scope)=>(root.QCCore as any).westgardByPoint(points,mean,sd,scope),
  wgRules:()=>WG_RULES,
  testRuleOnWithin:(t,rule)=>(globalThis as any).testRuleOnWithin(t,rule),
  testRuleOnAcross:(t,rule)=>(globalThis as any).testRuleOnAcross(t,rule),
  previousLotSeries:(t,level)=>(globalThis as any).previousLotSeries(t,level),
  wgPrevOpenHas:key=>(globalThis as any).wgPrevOpen.has(key),
  ruleResultLevel:(t,rules)=>(globalThis as any).ruleResultLevel(t,rules),
  reportPointsTableService:(items,t)=>root.reportPointsTableService!(items,t),
  actionReportHtml:{summary:(parts:any)=>(root.actionReportHtml as any).summary(parts),detailField:(label:any,value:any,wide:any)=>(root.actionReportHtml as any).detailField(label,value,wide)},
  reportNceDetailHtmlPresentation:(a,t)=>root.reportNceDetailHtmlPresentation!(a,t),
  reportNceAppendixPresentation:(actions,t)=>root.reportNceAppendixPresentation!(actions,t),
  reportNceModel:(a,t)=>(globalThis as any).reportNceModel(a,t),
  reportNceSummaryParts:a=>(globalThis as any).reportNceSummaryParts(a),
  reportExportSelection:()=>(globalThis as any).reportExportSelection(),
  reportInRange:(start,end)=>(globalThis as any).reportInRange(start,end),
  reportRangeText:(start,end)=>(globalThis as any).reportRangeText(start,end),
  reportTeaInfo:t=>(globalThis as any).reportTeaInfo(t),
  reportMultiViews:(t,inMonth)=>(globalThis as any).reportMultiViews(t,inMonth),
  operationalLevels:t=>(globalThis as any).operationalLevels(t),
  reportPrevLotRows:(t,s,inMonth)=>(globalThis as any).reportPrevLotRows(t,s,inMonth),
  reportLevelStats:(pts,mean,teaVal)=>(globalThis as any).reportLevelStats(pts,mean,teaVal),
  pointStaff:p=>(globalThis as any).pointStaff(p),
  errorType:rules=>(globalThis as any).errorType(rules),
  reportLevelRows:(t,l,wg,inMonth)=>(globalThis as any).reportLevelRows(t,l,wg,inMonth),
  reportActionsInRange:(tid,inMonth)=>(globalThis as any).reportActionsInRange(tid,inMonth),
  actionRerunStatus:a=>(globalThis as any).actionRerunStatus(a),
  actionLevelShort:(t,level,lot)=>(globalThis as any).actionLevelShort(t,level,lot),
  actionApprovalLabel:a=>(globalThis as any).actionApprovalLabel(a),
  sgTeaRefText:t=>(globalThis as any).sgTeaRefText(t),
  lvlCfg:(t,level)=>lvlCfg(t,level),
  operationalLotPoints:(t,level)=>operationalLotPoints(t,level),
  stats:values=>(globalThis as any).stats(values),
  ljDataURL:(points,mean,sd)=>root.ljDataURL!(points,mean,sd),
  ljMultiDataURL:(levelViews,test,opts)=>root.ljMultiDataURL!(levelViews,test,opts),
  format:(value,decimals)=>fmt(value,decimals),
  vnDate:value=>vnDate(value),
  escape:value=>root.esc!(value),
});
root.reportQcValue=reportPrintController.reportQcValue;
root.reportQcStat=reportPrintController.reportQcStat;
root.reportQcPoint=reportPrintController.reportQcPoint;
root.reportHeader=reportPrintController.reportHeader;
root.signBlock=reportPrintController.signBlock;
root.openPrint=reportPrintController.openPrint;
root.sigmaPeriodPrintRows=reportPrintController.sigmaPeriodPrintRows;
root.sigmaPeriodsPrintRows=reportPrintController.sigmaPeriodsPrintRows;
root.sigmaMuPrintRows=reportPrintController.sigmaMuPrintRows;
root.sigmaMuPeriodsPrintRows=reportPrintController.sigmaMuPeriodsPrintRows;
root.sigmaMuTrace=reportPrintController.sigmaMuTrace;
root.sigmaMuPrintCard=reportPrintController.sigmaMuPrintCard;
root.printSigmaPeriod=reportPrintController.printSigmaPeriod;
root.printSigmaPeriods=reportPrintController.printSigmaPeriods;
root.printWestgard=reportPrintController.printWestgard;
root.reportPointsTableHtml=reportPrintController.reportPointsTableHtml;
root.reportNceSummaryHtml=reportPrintController.reportNceSummaryHtml;
root.reportNceDetailField=reportPrintController.reportNceDetailField;
root.reportNceDetailHtml=reportPrintController.reportNceDetailHtml;
root.reportNceAppendixHtml=reportPrintController.reportNceAppendixHtml;
root.printReport=reportPrintController.printReport;
root.printRangeForm=reportPrintController.printRangeForm;
root.WestgardViewModel = westgardViewModel;
root.westgardRowsWindow = westgardRowsWindow;
root.westgardXlsxRows = createWestgardXlsxRows({date:value=>(root as any).vnDate(value),staffCode:point=>((root as any).pointStaff(point).code||''),verdict:level=>(root as any).qcVerdictLabel(level),error:rules=>(root as any).errorType(rules),number:value=>(root as any).fmt(value)});
root.westgardXlsxHeader = createWestgardXlsxHeader;
root.westgardArchivedGroups = westgardArchivedGroups;
root.westgardArchivedMultiViews = westgardArchivedMultiViews;
root.westgardArchivedGroupMatches = westgardArchivedGroupMatches;
root.westgardArchivedTestSelection = westgardArchivedTestSelection;
const dataIoController=createDataIoController({
  cssTokenPixel:(token,fallback)=>(root.cssTokenPixel as any)(token,fallback),
  sigmaCanvasFont:(weight,token,fallback)=>(root.sigmaCanvasFont as any)(weight,token,fallback),
  exportMetaRowsService:kind=>root.exportMetaRowsService!(kind),
  exportMetaRows:kind=>(globalThis as any).exportMetaRows(kind),
  reportExportHelpers:{inRange:(start:any,end:any)=>(root.reportExportHelpers as any).inRange(start,end),nceExcerpt:(value:any,max?:number)=>(root.reportExportHelpers as any).nceExcerpt(value,max),sigmaLevels:(row:any)=>(root.reportExportHelpers as any).sigmaLevels(row),periodLabel:(value:any)=>(root.reportExportHelpers as any).periodLabel(value),mdcPeriodLabel:(value:any)=>(root.reportExportHelpers as any).mdcPeriodLabel(value),exportPeriods:(rows:any)=>(root.reportExportHelpers as any).exportPeriods(rows)},
  qcReportContext:{teaInfo:(t:any)=>(root.qcReportContext as any).teaInfo(t),multiViews:(t:any,inRange:any)=>(root.qcReportContext as any).multiViews(t,inRange)},
  qcReportRowsService:{previousLot:(t:any,s:any,inRange:any)=>(root.qcReportRowsService as any).previousLot(t,s,inRange),currentLot:(t:any,l:any,wg:any,inRange:any)=>(root.qcReportRowsService as any).currentLot(t,l,wg,inRange),actions:(tid:any,inRange:any)=>(root.qcReportRowsService as any).actions(tid,inRange)},
  actionReportSummary:a=>root.actionReportSummary!(a),
  actionReportModel:(a,t)=>root.actionReportModel!(a,t),
  qcReportCsvRows:(tid,start,end)=>root.qcReportCsvRows!(tid,start,end),
  csvDownload:(name,rows)=>root.csvDownload!(name,rows),
  nceCsvRow:a=>root.nceCsvRow!(a),
  blobDownload:(name,blob)=>root.blobDownload!(name,blob),
  sigmaReportMetricService:r=>root.sigmaReportMetricService!(r),
  sigmaReportRowsService:(onlyTestId,mode,period,periodId)=>root.sigmaReportRowsService!(onlyTestId,mode,period,periodId),
  sigmaDataUrlBytes:durl=>(root.sigmaDataUrlBytes as any)(durl),
  sigmaExportPixelRatioService:(W,H,scale,maxDimension)=>root.sigmaExportPixelRatioService!(W,H,scale,maxDimension),
  sigmaCanvasFactory:(W,H,scale)=>root.sigmaCanvasFactory!(W,H,scale),
  sigmaChartRenderer:rows=>root.sigmaChartRenderer!(rows),
  sigmaMdcItemsService:rows=>(root.sigmaMdcItemsService as any)(rows),
  sigmaMdcLabelPlacementService:(items,X,Y,ctx,bounds)=>(root.sigmaMdcLabelPlacementService as any)(items,X,Y,ctx,bounds),
  sigmaMdcRenderer:rows=>root.sigmaMdcRenderer!(rows),
  xlsxUtf8:text=>root.xlsxUtf8!(text),
  xlsxEscape:text=>root.xlsxEscape!(text),
  xlsxZip:files=>root.xlsxZip!(files),
  xlsxEmu:px=>root.xlsxEmu!(px),
  xlsxColumns:root.xlsxColumns as any,
  xlsxCells:root.xlsxCells as any,
  xlsxRound:(value,digits)=>(root.xlsxRound as any)(value,digits),
  xlsxPeriodNumber:value=>(root.xlsxPeriodNumber as any)(value),
  xlsxDrawing:(images,chartStartRow0)=>root.xlsxDrawing!(images,chartStartRow0),
  sigmaXlsxStyles:()=>root.sigmaXlsxStyles!(),
  renameSigmaXlsxSheet:(bytes,sheetName)=>(root.renameSigmaXlsxSheet as any)(bytes,sheetName),
  reportXlsxStyleIds:root.reportXlsxStyleIds as any,
  reportXlsxBuild:doc=>root.reportXlsxBuild!(doc),
  reportXlsxHeader:opts=>root.reportXlsxHeader!(opts),
  westgardXlsxHeader:opts=>root.westgardXlsxHeader!(opts),
  westgardXlsxRows:{detail:(o:any,index:number)=>(root.westgardXlsxRows as any).detail(o,index)},
  sigmaExportMetaService:{meta:()=>(root.sigmaExportMetaService as any).meta(),teaTrace:(rows:any)=>(root.sigmaExportMetaService as any).teaTrace(rows)},
  qcExportValueFormat:{value:(t:any,value:any)=>(root.qcExportValueFormat as any).value(t,value),stat:(t:any,value:any)=>(root.qcExportValueFormat as any).stat(t,value)},
  errorType:rules=>(globalThis as any).errorType(rules),
  activeWestgard:t=>(globalThis as any).activeWestgard(t),
  operationalLevels:t=>(globalThis as any).operationalLevels(t),
  previousLotSeries:(t,level)=>(globalThis as any).previousLotSeries(t,level),
  reportLevelStats:(pts,mean,teaVal)=>(globalThis as any).reportLevelStats(pts,mean,teaVal),
  pointStaff:p=>(globalThis as any).pointStaff(p),
  ruleResultLevel:(t,rules)=>(globalThis as any).ruleResultLevel(t,rules),
  testRuleOnWithin:(t,rule)=>(globalThis as any).testRuleOnWithin(t,rule),
  testRuleOnAcross:(t,rule)=>(globalThis as any).testRuleOnAcross(t,rule),
  instrumentName:(instrumentId,machine)=>(globalThis as any).instrumentName(instrumentId,machine),
  testDisplayName:t=>(globalThis as any).testDisplayName(t),
  formatDateTimeVN:value=>(globalThis as any).formatDateTimeVN(value),
  userName:()=>(globalThis as any).userName(),
  vnDate:value=>vnDate(value),
  vnPeriod:value=>(globalThis as any).vnPeriod(value),
  stateName:value=>(globalThis as any).stateName(value),
  safeName:value=>(globalThis as any).safeName(value),
  format:(value,decimals)=>fmt(value,decimals),
  infoDialog:message=>root.infoDialog!(message),
  actionLevelShort:(t,level,lot)=>(globalThis as any).actionLevelShort(t,level,lot),
  actionRerunStatus:a=>(globalThis as any).actionRerunStatus(a),
  actionApprovalLabel:a=>(globalThis as any).actionApprovalLabel(a),
  ljDataURL:(points,mean,sd)=>root.ljDataURL!(points,mean,sd),
  ljMultiDataURL:(levelViews,test,opts)=>root.ljMultiDataURL!(levelViews,test,opts),
  wgMultiViews:t=>(globalThis as any).wgMultiViews(t),
  wgPrevOpenHas:key=>(globalThis as any).wgPrevOpen.has(key),
  sgTeaRefText:t=>(globalThis as any).sgTeaRefText(t),
  sgData:tid=>root.sgData!(tid),
  reportExportSelection:()=>(globalThis as any).reportExportSelection(),
  reportRangeText:(start,end)=>(globalThis as any).reportRangeText(start,end),
  westgardByPoint:(points,mean,sd,scope)=>(root.QCCore as any).westgardByPoint(points,mean,sd,scope),
  wgRules:()=>WG_RULES,
  findTest:id=>(state.tests||[]).find((test:any)=>test.id===id),
  lab:()=>state.lab,
  westgardRules:()=>state.westgardRules,
  actions:()=>(state as any).actions||[],
  appMeta:()=>typeof window==='undefined'?{version:'dev'}:(window as any).QCLAB_APP||{version:'dev'},
  selTest:()=>(globalThis as any).selTest,
  sgTest:()=>(globalThis as any).sgTest,
});
root.dataIoTypePx=dataIoController.dataIoTypePx;
root.dataIoCanvasFont=dataIoController.dataIoCanvasFont;
root.exportMetaRows=dataIoController.exportMetaRows;
root.reportInRange=dataIoController.reportInRange;
root.reportTeaInfo=dataIoController.reportTeaInfo;
root.reportMultiViews=dataIoController.reportMultiViews;
root.reportPrevLotRows=dataIoController.reportPrevLotRows;
root.reportLevelRows=dataIoController.reportLevelRows;
root.reportActionsInRange=dataIoController.reportActionsInRange;
root.reportNceExcerpt=dataIoController.reportNceExcerpt;
root.reportNceSummaryParts=dataIoController.reportNceSummaryParts;
root.reportNceModel=dataIoController.reportNceModel;
root.exportReportCSV=dataIoController.exportReportCSV;
root.exportActionsCSV=dataIoController.exportActionsCSV;
root.downloadBlob=dataIoController.downloadBlob;
root.sigmaReportMetric=dataIoController.sigmaReportMetric;
root.sigmaReportRows=dataIoController.sigmaReportRows;
root.sigmaLevelsOf=dataIoController.sigmaLevelsOf;
root.sigmaDataURLBytes=dataIoController.sigmaDataURLBytes;
root.sigmaExportPixelRatio=dataIoController.sigmaExportPixelRatio;
root.sigmaCanvas=dataIoController.sigmaCanvas;
root.drawSigmaReportChart=dataIoController.drawSigmaReportChart;
root.sigmaMdcItems=dataIoController.sigmaMdcItems;
root.sigmaPeriodLabel=dataIoController.sigmaPeriodLabel;
root.sigmaMdcPeriodLabel=dataIoController.sigmaMdcPeriodLabel;
root.sigmaExportPeriods=dataIoController.sigmaExportPeriods;
root.sigmaMdcLabelPlacements=dataIoController.sigmaMdcLabelPlacements;
root.SIGMA_EXPORT_PIXEL_RATIO=dataIoController.SIGMA_EXPORT_PIXEL_RATIO;
root.XlsxCore=dataIoController.XlsxCore;
root.SigmaXlsx=dataIoController.SigmaXlsx;
root.drawSigmaReportMDC=dataIoController.drawSigmaReportMDC;
root.renameSigmaSheet=dataIoController.renameSigmaSheet;
root.RXST=dataIoController.RXST;
root.ReportXlsx=dataIoController.ReportXlsx;
root.reportXlsxDoc=dataIoController.reportXlsxDoc;
root.exportReportXLSX=dataIoController.exportReportXLSX;
root.westgardXlsxDoc=dataIoController.westgardXlsxDoc;
root.exportWestgardXLSX=dataIoController.exportWestgardXLSX;
root.sigmaExportMeta=dataIoController.sigmaExportMeta;
root.sigmaTeaTrace=dataIoController.sigmaTeaTrace;
root.buildSigmaXlsx=dataIoController.buildSigmaXlsx;
root.exportSigmaPeriodXLSX=dataIoController.exportSigmaPeriodXLSX;
root.exportSigmaPeriodsXLSX=dataIoController.exportSigmaPeriodsXLSX;
