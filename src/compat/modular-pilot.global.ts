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
import { createLabProfileService } from '../application/settings/lab-profile-service';
import { createSettingsProfileCommand, type SettingsProfileCommand } from '../application/settings/settings-profile-command';
import { createSettingsFirebaseCommand, type SettingsFirebaseCommand } from '../application/settings/settings-firebase-command';
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
import { createSigmaPeriodSelectionService, type SigmaPeriodSelectionService } from '../presentation/sigma/sigma-period-selection-service';
import { createLotTransitionPickerService, type LotTransitionPickerServiceApi } from '../presentation/manage/lot-transition-picker-service';
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
  installUiState,
} from '../presentation/state/ui-state';

declare let state: Record<string, any> & { data?: Record<string, Record<string, any>[]>; tests?: Record<string, any>[] };
declare let entryLjRenderCache:any,entryJumpToday:any;
declare const ChartViewModel:any;
declare function acceptedLotPoints(test:any,level:number):any[];
declare function drawLJ(canvas:any,points:any[],mean:number,sd:number):void;
declare function wgMultiViews(test:any):any[];
declare function drawLJMultiZ(canvas:any,chart:any,test:any):void;
declare function levelsForLotGroup(group:any):any[];
declare function wgArchivedMultiViews(levels:any[]):any[];
declare function operationalLotPoints(test:any,level:number):any[];
declare function cusumSeries(test:any,level:any):any;
declare function drawCUSUM(canvas:any,points:any[],series:any):void;
declare function rcCompute():void;
declare function sgRefresh():void;
declare function updateBackupBanner():void;
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
declare function adoptValidatedState(value: unknown): void;
declare function recoverPendingSigmaDraft(): boolean;
declare function ensureShape(options?: Record<string, any>): void;
declare function quarantineCorruptLocal(raw: string, error: unknown): void;
declare const LocalStore: { supported: () => boolean };
declare let partitionSlot: string, localLoadStatus: string, storageHydrationPromise: Promise<boolean>;
declare let mem: any, startupProblem: any;
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
// `REFTESTS` là `const` global lexical của state.js, không phải property trên
// `window`/`globalThis`. Service TEa chạy sau state.js nên đọc binding này trực tiếp.
declare const REFTESTS: readonly any[][];
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
  ResetOperationalDataCommand: ResetOperationalDataCommand;
   LoginWorkflowCommand: LoginWorkflowCommand;
   RequiredPasswordWorkflowCommand: RequiredPasswordWorkflowCommand;
   AdminBootstrapCommand: AdminBootstrapCommand;
   UserLifecycleCommand: UserLifecycleCommand;
   ActivityArchiveCommand: ActivityArchiveCommand;
  lisQueuePresentation: ReturnType<typeof createLisQueuePresentation>;
  lisSettingsService: ReturnType<typeof createLisSettingsService>;
  LisGatewayCommand: LisGatewayCommand;
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
root.storageSnapshotService = createStorageSnapshotService({
  markChanged: () => { lsRevision++; lsDirty = true; lsFullDirty = true; },
  dirty: () => lsDirty,
  cancelScheduled: () => cancelLocalSaveSchedule(),
  clearDirty: () => { lsDirty = false; },
  draftStamp: () => sigmaDraftStamp(),
  usePartitioned: () => typeof LocalStore !== 'undefined' && LocalStore.supported() && typeof (LocalStore as any).writePartitioned === 'function',
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
if (typeof (root as any).fbHandleValue === 'function') root.firebaseConflictDialogService = createFirebaseConflictDialogService(options => (globalThis as any).confirmDialog(options));
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
root.lisQueuePresentation = createLisQueuePresentation({test:id=>(state.tests||[]).find((test:any)=>test.id===id),formatTestValue:(test,value)=>(root as any).fmtTestValue(test,value),format:(value,decimals)=>(root as any).fmt(value,decimals),escape:value=>(root as any).esc(value),escapeAttribute:value=>(root as any).escAttr(value),quoteJs:value=>(root as any).jsq(value),formatDateTime:value=>(root as any).formatDateTimeVN(value),testDisplayName:test=>typeof (root as any).testDisplayName==='function'?(root as any).testDisplayName(test):'',button:(label,action,variant)=>(root as any).btn(label,action,variant),emptyState:(title,message,action)=>(root as any).emptyState(title,message,action),modalCloseButton:action=>(root as any).modalCloseButton(action)});
root.lisSettingsService = createLisSettingsService(value => root.lisNormalizeGatewayUrl!(value));
root.LisGatewayCommand=createLisGatewayCommand({store:settings=>localStorage.setItem(LIS_GATEWAY_STORAGE_KEY,JSON.stringify(settings)),clearToken:()=>{const input=document.getElementById('lisGatewayToken') as any;if(input)input.value='';},disable:()=>{const runtime=(root as any).lisGatewayRuntime;clearInterval(runtime.pollT);runtime.pollT=null;runtime.pending=[];runtime.unresolved=[];lisClient.setStatus('off','Đã tắt');},start:()=>(root as any).lisGatewayStart(),pull:()=>(root as any).lisGatewayPull({manual:true})});
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
const modularIndexedDbOpenService=typeof LocalStore !== 'undefined'?createIndexedDbOpenService({indexedDb:()=>typeof indexedDB === 'undefined'?null:indexedDB}):null;
const modularIndexedDbRecordService=modularIndexedDbOpenService?createIndexedDbRecordService({open:()=>modularIndexedDbOpenService.open()}):null;
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
  get: key => modularIndexedDbRecordService ? modularIndexedDbRecordService.get(key) : Promise.resolve(null),
  put: record => modularIndexedDbRecordService ? modularIndexedDbRecordService.put(record) : Promise.resolve(false),
  remove: key => modularIndexedDbRecordService ? modularIndexedDbRecordService.delete(key) : Promise.resolve(false),
  stateRecord: value => modularLocalSnapshotRecord.state(value),
  serializedRecord: value => modularLocalSnapshotRecord.serialized(value),
  writePartitioned: input => root.partitionedIndexedDbWriteService!.write(input),
  readPartitioned: (slot, get) => root.partitionedIndexedDbReadService!.read(slot,get),
  clear: (get, remove) => modularIndexedDbClearService.clear(get,remove),
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
  partitionedSupported: () => typeof LocalStore !== 'undefined' && LocalStore.supported(),
  readBootRecord: () => localStorage.getItem('qclab_boot'),
  discardBootRecord: () => localStorage.removeItem('qclab_boot'),
  activatePartitionShell: (shell, slot) => { (globalThis as any).adoptValidatedState(shell); partitionSlot = slot; localLoadStatus = 'partition-shell'; storageHydrationPromise = (globalThis as any).hydratePartitionedState(); },
  loadLegacy: () => modularLocalStorageLoadService.load(),
  localLoadStatus: () => localLoadStatus,
  recoverPendingSigmaDraft: () => (globalThis as any).recoverPendingSigmaDraft(),
  restoreFromIndexedDb: () => (globalThis as any).restoreFromIndexedDb(),
});
const modularIndexedDbRecoveryService = createIndexedDbRecoveryService({
  supported: () => typeof LocalStore !== 'undefined' && LocalStore.supported(),
  readPartitioned: () => typeof (LocalStore as any).readPartitioned === 'function' ? (LocalStore as any).readPartitioned() : Promise.resolve(null),
  readLegacy: () => (LocalStore as any).read(),
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
  read: () => (LocalStore as any).readPartitioned(),
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
  supported: () => typeof LocalStore !== 'undefined' && LocalStore.supported(),
  writeSerialized: raw => typeof (LocalStore as any).writeSerialized === 'function' ? (LocalStore as any).writeSerialized(raw) : null,
  writeState: value => (LocalStore as any).write(value),
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
root.targetNumberTextPresentation=createTargetNumberText({valueDecimals:test=>(globalThis as any).testDecimalPlaces(test),statDecimals:test=>(globalThis as any).testStatDecimals(test),defaultDecimals:(globalThis as any).QC_DECIMALS_DEFAULT});
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
root.configNavScrollService=createConfigNavScrollService({find:()=>typeof document==='undefined'?null:document.querySelector('.config-shell-nav') as any,getPosition:()=>Number((root as any).__configNavScrollPosition)||0,setPosition:value=>{(root as any).__configNavScrollPosition=value;}});
root.entryJumpScrollService=createEntryJumpScrollService({findWrap:()=>typeof document==='undefined'?null:document.querySelector('.qc-sheet-wrap') as any,findTodayRow:()=>typeof document==='undefined'?null:document.querySelector('.qc-sheet tbody tr.today') as any});
root.defaultDateFieldsService=createDefaultDateFieldsService({find:id=>typeof document==='undefined'?null:document.getElementById(id) as any});
root.postRenderPageActions=createPostRenderPageActions({requestFrame:work=>requestAnimationFrame(work)});
root.afterRender=createAfterRenderController({document:typeof document!=='undefined'?document:({querySelectorAll:()=>[]} as unknown as Document),canvas:root.afterRenderCanvasService,tests:()=>state.tests||[],levelConfig:(test,level)=>lvlCfg(test,level),buildLeveyJennings:input=>ChartViewModel.buildLeveyJennings(input),acceptedLotPoints:(test,level)=>acceptedLotPoints(test,level),drawLeveyJennings:(canvas,points,mean,sd)=>drawLJ(canvas,points,mean,sd),entryCache:()=>entryLjRenderCache,multiViews:test=>wgMultiViews(test),buildMultiLevel:input=>ChartViewModel.buildMultiLevel(input),drawMultiLevel:(canvas,chart,test)=>drawLJMultiZ(canvas,chart,test),lotGroups:()=>((state as any).lotGroups||[]),levelsForLotGroup:group=>levelsForLotGroup(group),archivedMultiViews:levels=>wgArchivedMultiViews(levels),operationalLotPoints:(test,level)=>operationalLotPoints(test,level),cusumSeries:(test,level)=>cusumSeries(test,level),buildCusum:input=>ChartViewModel.buildCusum(input),drawCusum:(canvas,points,series)=>drawCUSUM(canvas,points,series),fillDefaultDates:()=>root.defaultDateFieldsService.fill(['eDate','aDate'],vnDate(isoToday())),runPageActions:()=>root.postRenderPageActions.run(page,{reagent:rcCompute,sigma:sgRefresh}),consumeEntryJump:()=>{if(!entryJumpToday)return false;entryJumpToday=false;return true;},requestFrame:work=>requestAnimationFrame(work),scrollEntryJump:()=>root.entryJumpScrollService.scroll(),updateSaveStatus:()=>updateSaveStatus(),updateBackupBanner:()=>updateBackupBanner(),restoreConfigNavScroll:()=>root.configNavScrollService.restore()}).afterRender;
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
root.SigmaMuWorkflowCommand=createSigmaMuWorkflowCommand({service:root.SigmaMuWorkflowService,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>(root as any).closeModal(),render:()=>rerender()});
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
root.NceFormWorkflowCommand=createNceFormWorkflowCommand({current:()=>state as {actions?:Record<string,any>[]},form:nceFormCommand,log:(action,detail,target)=>logAct(action,detail,target),reset:()=>{const ui=(root as any).actionFormUiState;if(ui)ui.reset();},save:()=>save({clearDerived:false}),render:()=>rerender()});
root.ActivityArchiveCommand=createActivityArchiveCommand({current:()=>state as {activity?:Record<string,any>[];activityAnchor?:string},window:value=>root.activityAuditArchiveWindow!(value),cut:(activity,cutoff)=>root.AuditService!.archiveCut(activity,cutoff),confirm:dialog=>(root as any).confirmDialog(dialog),reauthenticate:input=>(root as any).reauthenticateCurrentUser(input),download:(name,rows)=>(root as any).csvDownload(name,(root as any).activityAuditCsv(rows)),log:(type,detail,target)=>logAct(type,detail,target),save:()=>save({clearDerived:false}),close:()=>(root as any).closeModal(),render:()=>rerender(),info:(message,options)=>(root as any).infoDialog(message,options),dateLabel:iso=>vnDate(iso)});
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
root.BackupExportCommand=createBackupExportCommand({current:()=>state,log:()=>logAct('Xuất backup','Xuất toàn bộ dữ liệu JSON có checksum','Dữ liệu'),save:()=>save({clearDerived:false}),create:value=>backupService.createBackupPackage(value),confirmOversized:(bytes,detail)=>(root as any).confirmOversizedBackup(bytes,detail),warning:bytes=>backupService.backupImportSizeError(bytes)?null:root.backupSizeWarningConfirmation({bytes}),confirm:dialog=>(root as any).confirmDialog(dialog),download:(name,text)=>(root as any).downloadBackupText(name,text),mark:bytes=>(root as any).markBackupDone(bytes),update:()=>(root as any).updateBackupBanner()});
root.BackupImportCommand=createBackupImportCommand({prepare:text=>backupService.prepareBackupImport(text),sizeWarning:bytes=>backupService.backupSizeWarning(bytes),snapshot:prefix=>root.BackupExportCommand.snapshot(prefix),restore:input=>root.BackupRestoreCommand.restore(input)});
root.BackupInspectionCommand=createBackupInspectionCommand({inspect:(text,bytes)=>backupService.inspectBackupText(text,bytes)});
root.BackupStatusCommand=createBackupStatusCommand({reminder:root.backupReminderService,marker:root.backupLocalMarker,maxBytes:BACKUP_IMPORT_MAX_BYTES,size:bytes=>backupService.backupSizeMB(bytes),warning:bytes=>backupService.backupSizeWarning(bytes)});
root.ResetOperationalDataCommand=createResetOperationalDataCommand({current:()=>state,clearPersistence:()=>{localStorage.removeItem('qclab');localStorage.removeItem('qclab_boot');if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(Number.MAX_SAFE_INTEGER);if(typeof LocalStore!=='undefined')(LocalStore as any).clear().catch(()=>{});},blank:users=>(root as any).blankAppStateFactory(users),replace:value=>{state=value;},normalize:()=>ensureShape(),ensureAdmin:()=>ensureAdmin(),log:()=>logAct('Xóa sạch dữ liệu test','Đưa app về trạng thái trắng, giữ người dùng và nhật ký audit','Dữ liệu'),save:()=>save({}),render:()=>rerender()});
const userManagementCommand=createUserManagementCommand();
const loginCommand=createLoginCommand({isLocked:(until,now)=>root.loginLockoutPolicy!.isLocked(until,now),lockedMessage:(until,now)=>root.loginLockoutPolicy!.message(until,now),recordFailure:(lock,now)=>root.loginLockoutPolicy!.recordFailure(lock,now),resetLock:()=>root.loginLockoutPolicy!.reset(),verify:(password,stored)=>(root as any).verifyPass(password,stored),hash:password=>(root as any).hashPass(password),isPbkdf2:stored=>root.isPbkdf2PasswordHash!(stored),hashNeedsUpgrade:stored=>root.passwordHashNeedsUpgrade!(stored)});
root.LoginWorkflowCommand=createLoginWorkflowCommand({login:loginCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options)});
const requiredPasswordCommand=createRequiredPasswordCommand({validate:(password,confirmation)=>root.passwordChangeError!(password,confirmation),hash:password=>(root as any).hashPass(password)});
root.RequiredPasswordWorkflowCommand=createRequiredPasswordWorkflowCommand({command:requiredPasswordCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options)});
root.AdminBootstrapCommand=createAdminBootstrapCommand({current:()=>state as {users?:Record<string,any>[]},id:()=>(root as any).uid(),hashDefault:()=>(root as any).legacyHashPass('admin'),createDefault:(id,passHash)=>root.defaultAdminUserFactory!(id,passHash),save:()=>save({cloud:false,clearDerived:false})});
root.UserLifecycleCommand=createUserLifecycleCommand({current:()=>state as {users?:Record<string,any>[]},manage:userManagementCommand,hash:password=>(root as any).hashPass(password),log:(type,detail,target)=>logAct(type,detail,target),save:()=>save({clearDerived:false})});
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
root.ManageInstrumentWorkflowCommand=createManageInstrumentWorkflowCommand({current:()=>state,instrument:manageInstrumentCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>(root as any).closeModal(),render:()=>rerender()});
const managePanelCommand = createManagePanelCommand({savePanel:(targetState,input)=>root.ManageConfigService.savePanel(targetState as any,input),removePanel:(targetState,input)=>root.ManageConfigService.removePanel(targetState as any,input)});
root.ManagePanelWorkflowCommand=createManagePanelWorkflowCommand({current:()=>state,panel:managePanelCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>(root as any).closeModal(),render:()=>rerender()});
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
root.ManageLotWorkflowCommand=createManageLotWorkflowCommand({current:()=>state,lot:manageLotCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>(root as any).closeModal(),render:()=>rerender()});
root.ManageAssayWorkflowCommand=createManageAssayWorkflowCommand({current:()=>state,assay:manageAssayCommand,removal:manageAssayRemovalCommand,log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>(root as any).closeModal(),render:()=>rerender()});
root.ManageLotTransitionWorkflowCommand=createManageLotTransitionWorkflowCommand({current:()=>state,transition:root.ManageLotTransitionCommand,clearDerived:()=>(globalThis as any).clearDerived(),log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>(root as any).closeModal(),render:()=>rerender()});
root.ManageLotGroupWorkflowCommand=createManageLotGroupWorkflowCommand({current:()=>state,group:manageLotGroupCommand,activation:manageLotGroupActivationCommand,reconcileSigma:()=>(globalThis as any).reconcileSigmaLevelsWithLotGroups(),log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>(root as any).closeModal(),render:()=>rerender()});
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
  sourceRegistry: () => (globalThis as any).TEA_SOURCE_REGISTRY, createId: () => (globalThis as any).uid(),
  todayIso: () => (globalThis as any).isoToday(), userName: () => (globalThis as any).userName(),
});
root.TeaReferenceWorkflowCommand=createTeaReferenceWorkflowCommand({current:()=>state,service:root.TeaReferenceService,reconcileSigmaTea:()=>{if(typeof (globalThis as any).sgReconcileAllTeaSnapshots==='function')(globalThis as any).sgReconcileAllTeaSnapshots();},formatDate:iso=>(globalThis as any).vnDate(iso),log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options),close:()=>(root as any).closeModal(),render:()=>rerender()});
root.LotTransitionPickerService = createLotTransitionPickerService({
  searchText: value => (globalThis as any).searchText(value), formatDate: value => (globalThis as any).vnDate(value),
  transitionToNo: lotId => (globalThis as any).lotTransitionToNo(lotId),
});
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
root.SigmaCohortService = createSigmaCohortService({ stats: root.QCCore.stats });
root.WestgardViewModel = westgardViewModel;
root.westgardRowsWindow = westgardRowsWindow;
root.westgardXlsxRows = createWestgardXlsxRows({date:value=>(root as any).vnDate(value),staffCode:point=>((root as any).pointStaff(point).code||''),verdict:level=>(root as any).qcVerdictLabel(level),error:rules=>(root as any).errorType(rules),number:value=>(root as any).fmt(value)});
root.westgardXlsxHeader = createWestgardXlsxHeader;
root.westgardArchivedGroups = westgardArchivedGroups;
root.westgardArchivedMultiViews = westgardArchivedMultiViews;
root.westgardArchivedGroupMatches = westgardArchivedGroupMatches;
root.westgardArchivedTestSelection = westgardArchivedTestSelection;
