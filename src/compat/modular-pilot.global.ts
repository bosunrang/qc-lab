import { createAppStore } from '../application/state/app-store';
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
import { createUserAvatarCommand, type UserAvatarCommand } from '../application/auth/user-avatar-command';
import { avatarModalHtml } from '../presentation/auth/avatar-modal-html';
import { createAvatarModalController } from '../presentation/auth/avatar-modal-controller';
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
import { createReagentResultHtml } from '../presentation/reagent/reagent-result-html';
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
import { createVnDatePickerController } from '../presentation/router/vn-date-picker-controller';
import { createActionDispatcher } from '../presentation/app/action-dispatcher';
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
import { createReportUnlockReason } from '../presentation/report/report-unlock-reason';
import { reportUnlockModalHtml } from '../presentation/report/report-unlock-modal-html';
import { createReportPageController } from '../presentation/report/report-page-controller';
import { reportLockPicker } from '../presentation/report/report-lock-picker';
import { createDashboardStatusFilter } from '../presentation/dashboard/dashboard-status-filter';
import { dashboardExpiringLots } from '../domain/qc/dashboard-expiring-lots';
import { dashboardShiftStatus } from '../presentation/dashboard/dashboard-shift-status';
import { dashboardKpis } from '../domain/qc/dashboard-kpis';
import { createDashboardTestSearchText } from '../presentation/dashboard/dashboard-test-search-text';
import { createDashboardLatestPoint } from '../presentation/dashboard/dashboard-latest-point';
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
import { dashboardExpiringLotItems } from '../presentation/dashboard/dashboard-expiring-lot-items';
import { dashboardWestgardAlerts } from '../presentation/dashboard/dashboard-westgard-alerts';
import { dashboardMissingTargetItems } from '../presentation/dashboard/dashboard-missing-target-items';
import { createDashboardLevelData } from '../presentation/dashboard/dashboard-level-data';
import { createDashboardTestItems } from '../presentation/dashboard/dashboard-test-items';
import { createDashboardPageController } from '../presentation/dashboard/dashboard-page-controller';
import { icon, icoDownload, icoPrint } from '../presentation/router/router-icons';
import { createRouterPermission } from '../presentation/router/router-permission';
import { createLiveRowFilter } from '../presentation/router/live-row-filter';
import { createRangeActionsHtml } from '../presentation/range/range-actions-html';
import { createUiPrimitives } from '../presentation/shared/ui-primitives';
import { createRouterDispatchController } from '../presentation/router/router-dispatch-controller';
import { pageIdFromHash, hashForPage } from '../presentation/router/router-hash';
import { createReportQcFormat } from '../presentation/report/report-qc-format';
import { createRangeTea } from '../domain/qc/range-tea';
import { entryRowsWindow as entryRowsWindowTs, entryLotLabels as entryLotLabelsTs } from '../presentation/entry/entry-rows-window';
import { entryVoidModalHtml } from '../presentation/entry/entry-void-modal-html';
import { entryPreSaveWarningModalHtml } from '../presentation/entry/entry-pre-save-warning-modal-html';
import { targetSwitchModalHtml } from '../presentation/manage/target-switch-modal-html';
import { qcHistoryDetailModalHtml } from '../presentation/manage/qc-history-detail-modal-html';
import { qcHistoryMeanSdRowsHtml, qcHistoryPointRowsHtml } from '../presentation/manage/qc-history-detail-rows-html';
import { createTargetNumberText } from '../presentation/manage/target-number-text';
import { parseVnDate } from '../presentation/shared/parse-vn-date';
import { createTargetRangeSync } from '../presentation/manage/target-range-sync';
import { targetOverwritePicks } from '../presentation/manage/target-overwrite-picks';
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
import { resetPasswordModalHtml } from '../presentation/auth/reset-password-modal-html';
import { sigmaCohortModalHtml } from '../presentation/sigma/sigma-cohort-modal-html';
import { sigmaFrequencyPanelHtml } from '../presentation/sigma/sigma-frequency-panel-html';
import { sigmaMuSummaryHtml } from '../presentation/sigma/sigma-mu-summary-html';
import { sigmaStatusCardHtml } from '../presentation/sigma/sigma-status-card-html';
import { sigmaStatusPanelHtml } from '../presentation/sigma/sigma-status-panel-html';
import { sigmaOpSpecCellHtml } from '../presentation/sigma/sigma-opspec-cell-html';
import { sigmaMuStateChipHtml } from '../presentation/sigma/sigma-mu-state-chip-html';
import { sigmaMuDominantText } from '../presentation/sigma/sigma-mu-dominant-text';
import { sigmaCohortRowsHtml } from '../presentation/sigma/sigma-cohort-rows-html';
import { sigmaInputDisplayValue } from '../presentation/sigma/sigma-input-display-value';
import { sigmaGoverningRuleBlockHtml } from '../presentation/sigma/sigma-governing-rule-block-html';
import { sigmaFrequencyRowsHtml } from '../presentation/sigma/sigma-frequency-rows-html';
import { actionIncidentBannerHtml as actionIncidentBannerPresentation } from '../presentation/nce/action-incident-banner-html';
import { actionBiasContext as actionBiasContextPresentation } from '../presentation/nce/action-bias-context';
import { actionLevelContext as actionLevelContextPresentation } from '../presentation/nce/action-level-context';
import { actionLevelLabel as actionLevelLabelPresentation } from '../presentation/nce/action-level-label';
import { actionRuleOptions as actionRuleOptionsPresentation } from '../presentation/nce/action-rule-options';
import { actionCausePhrases as actionCausePhrasesPresentation, actionPhrases as actionPhrasesPresentation } from '../presentation/nce/action-suggest-phrases';
import { userPermissionChecksHtml } from '../presentation/auth/user-permission-checks-html';
import { ActionFormUiState } from '../application/nce/action-form-ui-state';
import { actionFormRenderState } from '../application/nce/action-form-render-state';
import { targetConfigAssigned as targetConfigAssignedPresentation, createTargetRangeDraft } from '../presentation/manage/target-config-state';
import { entrySheetMonthPart, entrySheetMonthValue } from '../presentation/entry/entry-sheet-month';
import { createEntrySheetNavigation } from '../presentation/entry/entry-sheet-navigation';
import { createEntrySheetInputOrder } from '../presentation/entry/entry-sheet-input-order';
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
import { createWestgardTestSearch } from '../presentation/westgard/westgard-test-search';
import { createWestgardMultiViews } from '../presentation/westgard/westgard-multi-views';
import { createWestgardCusumLevels } from '../presentation/westgard/westgard-cusum-levels';
import { createWestgardPageController } from '../presentation/westgard/westgard-page-controller';
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
import { createSigmaMuTrace } from '../presentation/sigma/sigma-mu-trace';
import { createSigmaPrintRows } from '../presentation/sigma/sigma-print-rows';
import { createSigmaMuPrintRows } from '../presentation/sigma/sigma-mu-print-rows';
import { createReportPointsTable } from '../presentation/report/report-points-table';
import { createActionReportHtml } from '../presentation/nce/action-report-html';
import { createActionDetailCheckHtml } from '../presentation/nce/action-detail-check-html';
import { createActionEvidenceTimelineHtml } from '../presentation/nce/action-evidence-timeline-html';
import { createActionRerunEvidenceHtml } from '../presentation/nce/action-rerun-evidence-html';
import { createActionDetailMetaHtml } from '../presentation/nce/action-detail-meta-html';
import { createActionCancelledAlertHtml } from '../presentation/nce/action-cancelled-alert-html';
import { actionCancelModalHtml } from '../presentation/nce/action-cancel-modal-html';
import { actionReviewNoteModalHtml } from '../presentation/nce/action-review-note-modal-html';
import { actionReopenModalHtml } from '../presentation/nce/action-reopen-modal-html';
import { createActionLegacyDetailHtml } from '../presentation/nce/action-legacy-detail-html';
import { createActionContainmentDetailHtml } from '../presentation/nce/action-containment-detail-html';
import { createActionInspectionDetailsHtml } from '../presentation/nce/action-inspection-details-html';
import { createActionPatientImpactHtml } from '../presentation/nce/action-patient-impact-html';
import { createActionCauseDetailHtml } from '../presentation/nce/action-cause-detail-html';
import { createActionEffectivenessDetailHtml } from '../presentation/nce/action-effectiveness-detail-html';
import { teaReferenceAddModalHtml } from '../presentation/manage/tea-reference-add-modal-html';
import { manageSearchPlaceholder } from '../presentation/manage/manage-search-placeholder';
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
import { targetSelection } from '../presentation/manage/target-selection';
import { targetLevelSelection } from '../presentation/manage/target-level-selection';
import { historySearchValues } from '../presentation/manage/history-search-values';
import { teaLabBasisLabel } from '../presentation/manage/tea-lab-basis-label';
import { targetLevelLots } from '../presentation/manage/target-level-lots';
import { targetSearchValues } from '../presentation/manage/target-search-values';
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
import { historyRows } from '../presentation/manage/history-rows';
import { targetEmptyState } from '../presentation/manage/target-empty-state';
import { targetPrerequisite } from '../presentation/manage/target-prerequisite';
import { teaReferenceKind } from '../presentation/manage/tea-reference-kind';
import { teaReferenceRowActions } from '../presentation/manage/tea-reference-row-actions';
import { sortTeaReferences } from '../presentation/manage/tea-reference-sort';
import { teaReferenceNamingTitle } from '../presentation/manage/tea-reference-naming-title';
import { teaReferenceEmptyState } from '../presentation/manage/tea-reference-empty-state';
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
import { reagentQuickPickerModalHtml } from '../presentation/reagent/reagent-quick-picker-modal-html';
import { reagentCreateModalHtml } from '../presentation/reagent/reagent-create-modal-html';
import { reagentChartAxis } from '../presentation/reagent/reagent-chart-axis';
import { reagentScatterSvg } from '../presentation/reagent/reagent-scatter-svg';
import { reagentBlandSvg } from '../presentation/reagent/reagent-bland-svg';
import { reagentQuickPickerRowsHtml } from '../presentation/reagent/reagent-quick-picker-rows-html';
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
import { createAppBootstrap } from '../presentation/app/app-bootstrap';

declare let state: Record<string, any> & { data?: Record<string, Record<string, any>[]>; tests?: Record<string, any>[] };
declare let entryLjRenderCache:any,entryJumpToday:any;
declare let entrySel:any,entryStart:any,entryEnd:any;
declare const ChartViewModel:any;
declare function acceptedLotPoints(test:any,level:number):any[];
declare function wgMultiViews(test:any):any[];
declare function levelsForLotGroup(group:any):any[];
declare function wgArchivedMultiViews(levels:any[]):any[];
declare function operationalLotPoints(test:any,level:number,withIndex?:boolean):any[];
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
declare let lsSaveT: any, lsSerializeCount: number, lsIdleHandle: any;
declare let lsSerializedRevision: number, lsSerialized: string, lsLastBytes: number, lsLastSerializeMs: number;
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
declare function sigmaDraftRecord(): any;
declare function load(): boolean;
declare function loadBootState(): Promise<boolean>;
declare function lsSaveDelay(): number;
declare function lsFlush(): boolean;
declare function invalidateDerivedForSave(options?: Record<string, any>): void;
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
declare let selTest: any;
declare let loginFails: number, loginLockUntil: number;
declare let auditQ: string, auditFrom: string, auditTo: string, auditPage: number, auditPageSize: number;
declare let manageTargetGroup: any;
declare const firebase: any;
declare function initFirebase(): Promise<unknown>;
declare function ensureFirebaseApp(config: any): Promise<unknown>;
declare function fbHandleValue(value: any, options?: Record<string, any>): Promise<unknown>;
declare function fbStartPull(): void;
declare function auditRelinkChain(entries: any[], anchor?: string): any[];
declare function fbHasLocalChanges(): boolean;
declare function ensureAdmin(): Promise<void>;
declare function showLogin(msg?: string): void;
declare function showStartupRecovery(): void;
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
// `REFTESTS`/`TEA_SOURCE_REGISTRY` từng chỉ là `const` global lexical của classic
// state.js (không phải property trên `window`/`globalThis`) — service TEa chạy
// sau state.js nên đọc hai binding này TRẦN; (globalThis as any).TEA_SOURCE_REGISTRY
// từng bị dùng nhầm ở TeaReferenceService's wiring (luôn undefined, làm sửa
// CLIA/Ricos trong tab "Bảng TEa tham chiếu" ném lỗi), đã sửa về tham chiếu trần
// đúng quy tắc này. Từ lát 6 (2026-08-20, retire state.js) cả hai ĐỀU là
// `root.X=` property thật — đọc trần vẫn đúng và vẫn là quy ước ở đây, nhưng lý
// do "không phải property" không còn áp dụng; ambient declare vẫn cần vì file
// này là module (có import), nên `declare const` ở đây chỉ có hiệu lực NỘI BỘ
// file, không tự động thành global thật — property thật do `root.REFTESTS=`/
// `root.TEA_SOURCE_REGISTRY=` (xem khối port state.js) đảm nhiệm.
declare const REFTESTS: readonly any[][];
declare const TEA_SOURCE_REGISTRY: Record<string, any>;
// Cùng lớp với hai binding trên — `WG_RULES`/`QC_DECIMALS_DEFAULT` cũng port
// thành `root.X=` property thật từ lát 6, ambient declare ở đây vẫn chỉ phục vụ
// tham chiếu trần nội bộ file.
declare const WG_RULES: readonly string[];
declare const QC_DECIMALS_DEFAULT: number;
// `teaAnalyteKey` từng là `const` arrow function của classic state.js (const,
// không phải `function`, nên không tự thành property trên globalThis) — từ lát 6
// đã là `root.teaAnalyteKey=` property thật, nhưng vẫn tham chiếu trần ở đây
// theo đúng quy ước chung của file.
declare function teaAnalyteKey(value: unknown): string;
declare function role(): string;
// Retire classic qc-domain.js (2026-08-20, Pha G nhóm C lát 5) — bare ambient cho
// các hàm domain gọi chéo nhau, cùng cách acceptedLotPoints/operationalLotPoints/
// cusumSeries/levelsForLotGroup/lvlCfg ở trên đã được khai báo.
declare function stats(vals: number[]): any;
declare function reportLevelStats(pts: any[], mean: number, teaVal?: any): any;
declare function wgOn(rule: string): boolean;
declare function wgSet(rule: string, on: boolean): void;
declare function wgReset(): void;
declare function testLevelCount(t: any): number;
declare function defaultRuleAction(rule: string): string;
declare function testRuleAction(t: any, rule: string): string;
declare function testRuleOn(t: any, rule: string): boolean;
declare function defaultRuleScope(t: any, rule: string): string;
declare function testRuleScope(t: any, rule: string): string;
declare function testRuleOnIn(t: any, rule: string, channel: string): boolean;
declare function testRuleOnWithin(t: any, rule: string): boolean;
declare function testRuleOnAcross(t: any, rule: string): boolean;
declare function testRuleSet(t: any, channel: string): Set<any>;
declare function ruleResultLevel(t: any, rules: string[]): string;
declare function westgard(points: any[], mean: number, sd: number): any;
declare function westgardMulti(levelSets: any[]): any;
declare function westgardByPoint(points: any[], mean: number, sd: number): any;
declare function westgardMultiByPoint(levelSets: any[]): any;
declare function primaryErrorRule(rules: string[]): string;
declare function errorType(rules: string[]): string;
declare function fixHint(rules: string[]): string;
declare function errorTypeDetailParts(rules: string[]): any;
declare let wgWorker: any, wgWorkerGeneration: number, wgWorkerFailed: boolean, wgWorkerRenderT: any;
declare const wgWorkerRevisions: Map<string, number>, wgWorkerPending: Map<string, any>;
declare function westgardWorkerRevision(testId: any): number;
declare function invalidateWestgardWorker(testId?: any): void;
declare function westgardWorkerWorthwhile(tests: any[]): boolean;
declare function westgardWorkerJob(t: any, generation: number, revision?: number): any;
declare function hydrateWestgardWorkerResult(message: any): boolean;
declare function westgardWorkerReadyToRender(): boolean;
declare function westgardWorkerMessage(event: any): void;
declare function ensureWestgardWorker(): any;
declare function scheduleWestgardPrewarm(tests: any[]): boolean;
declare function normalizePointLots(): void;
declare function normalizeDuplicateRunIds(): void;
declare function derived(): any;
declare function pointsOf(testId: any, level: any): any[];
declare function pointsWithIndex(testId: any, level: any): any[];
declare function pointsForLot(testId: any, level: any, lot: any, withIndex?: boolean): any[];
declare function activeLotPoints(t: any, level: any, withIndex?: boolean): any[];
declare function operationalPanelForTest(t: any): any;
declare function operationalTestOrder(t: any): number;
declare function isOperationalLotGroup(g: any): boolean;
declare function operationalLotGroupForLevel(l: any): any;
declare function lotGroupInUse(g: any): boolean;
declare function operationalLotGroupForTest(t: any): any;
declare function operationalLevels(t: any): any[];
declare function levelTargetOk(l: any): boolean;
declare function levelsMissingTarget(t: any): any[];
declare function isOperationalTest(t: any): boolean;
declare function canEnterQcForLevel(t: any, level: any): boolean;
declare function operationalTests(): any[];
declare function lotLineage(currentLotId: any): any[];
declare function lotPointsByNo(testId: any, level: any, lotNo: any): any[];
declare function lotMeanSdFor(t: any, level: any, lotNo: any): any;
declare function lotTargetSnapshot(t: any, level: any, lotId: any, lotNo: any): any;
declare function parallelLotForLevel(t: any, level: any): any;
declare function entryColumns(t: any): any[];
declare function entryColumnPoints(t: any, col: any, withIndex?: boolean): any[];
declare function parallelWestgard(t: any, col: any): any;
declare function pointVoidVerdict(t: any, p: any): any;
declare function plannedTargetFor(t: any, lot: any): any;
declare function previousLotSeries(t: any, level: any): any[];
declare function pointRunNo(p: any): number;
declare function activeWestgard(t: any): any;
declare function testCusumConfig(t: any): any;
declare function testSelectLabel(t: any, list?: any[]): string;
declare function searchText(s: any): string;
declare let cusumMemo: Map<string, any>, acceptedMemo: Map<string, any>;
// Retire classic state.js + analyte-catalog.js (2026-08-20, Pha G nhóm C lát 6 —
// lát cuối, đóng nhóm C) — bare ambient cho các tên chưa từng cần khai báo vì
// state.js luôn còn là classic script tách biệt cho tới lát này.
declare function teaAnalyteBuiltInMeta(value: any): any;
declare function teaAnalyteMetaById(id: any): any;
declare function teaAnalyteMeta(name: any, record?: any): any;
declare function teaAnalyteDisplay(name: any, record?: any): any;
declare const TEA_ANALYTE_META: Record<string, any>;
declare const TEA_ANALYTE_META_BY_ID: Record<string, any>;
declare const TEA_REFERENCE_SCHEMA_VERSION: number;
declare let teaReferenceSchemaVersion: number;
declare const WG_RULE_REGISTRY: Record<string, any>;
declare const WG_DEFAULT: Record<string, boolean>;
declare const STATE_SCHEMA_VERSION: number;
declare const QC_DECIMALS_MAX: number;
declare const QC_STAT_EXTRA_DECIMALS: number;
declare let pointsCache: Map<string, any>, pointsIndexCache: Map<string, any>, pointsLotCache: Map<string, any>;
declare let derivedIndex: any;
declare function pruneUnusedTestLevels(): void;
declare function repairAppliedRangeLimits(): void;
declare function reconcileSigmaLevelsWithLotGroups(): void;
declare function ensureConfigurationShape(): void;
declare function transitionSwitchesLot(tr: any): boolean;
declare function syncLotDepletionFromTransitions(): void;
declare function dedupeLotTargetHistory(target: any): any;
declare function upsertLotTargetHistory(target: any, lot: any, values: any): any;
declare function inspectAcceptedLotTransition(tr: any): any;
declare function applyAcceptedLotTransitionToConfig(tr: any): any;
declare function normalizeLotGroups(): void;
declare function staffInitials(name: any): string;
declare function currentStaff(): any;
declare function pointStaff(p: any): any;
declare function dateObj(s: any): any;
declare function daysToExp(exp: any): any;
declare function qcValueDecimals(value: any): number;
declare function testDecimalPlaces(test: any, point?: any): number;
declare function testStatDecimals(test: any): number;
declare function fmtTestValue(test: any, value: any, point?: any): string;
declare function fmtTestStat(test: any, value: any): string;
declare function fmtPointValue(point: any, test?: any): string;
declare function isoMonth(): string;
declare function requireUnlockedPeriod(date: any, action?: string): Promise<boolean>;
declare function vnPeriod(s: any): string;
declare function monthVN(s: any): string;
declare function safeName(s: any): string;

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
  rangeApplyFromWorkflow: (tid: string, level: unknown) => void;
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
  targetGroupLots?: (group: Record<string, any>) => Record<string, any>[];
  ensureTargetSelection?: () => void;
  manageHistorySearchValues?: (t: Record<string, any>) => unknown[];
  teaRefFind?: (refKey: unknown) => Record<string, any>;
  teaRefNumOrNull?: (v: unknown) => number | null;
  teaRefExternalChanged?: (row: Record<string, any>, refKey: unknown) => boolean;
  teaRefEnsure?: (refKey: unknown) => Record<string, any>;
  teaRefEdit?: (name: unknown, field: string, val: unknown) => void;
  teaRefRemove?: (refKey: unknown) => void;
  teaRefOpenAdd?: () => void;
  teaRefAddSubmit?: () => Promise<void>;
  teaLabProfileOpenModel?: (refKey: unknown) => Record<string, any> | null;
  teaLabProfileSave?: (refKey: unknown) => Promise<void>;
  teaLabProfileRemove?: (refKey: unknown) => Promise<void>;
  manageModel?: () => any;
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
  deleteConfigPanel?: (id: unknown) => Promise<void>;
  deleteLotTransition?: (id: unknown) => Promise<void>;
  lotTransitionChoiceLabel?: (lot: Record<string, any>) => string;
  lotTransitionChoiceLots?: (selectedId?: string) => Record<string, any>[];
  lotTransitionChoiceMatch?: (value: unknown, selectedId?: string) => Record<string, any>;
  lotTransitionSelectedId?: (inputId: string) => string;
  openLotTransitionModel?: (id?: string) => Promise<Record<string, any> | null>;
  lotTransitionTargetsModel?: (panelId: unknown, fromLotId: unknown, toLotId: unknown) => Record<string, any>;
  readLotTransitionTargetPicks?: (rows: Record<string, any>[]) => Promise<Record<string, any>[] | null>;
  saveLotTransitionV2?: (id: unknown) => Promise<void>;
  suggestConfigGroupName?: () => void;
  saveConfigGroup?: (id: unknown) => Promise<void>;
  deleteConfigGroup?: (id: unknown) => Promise<void>;
  toggleLotGroupStatus?: (id: unknown) => void;
  activateLotGroup?: (id: unknown) => Promise<void>;
  saveConfigLot?: (id: unknown) => Promise<void>;
  renameLotAcrossPoints?: (oldLevel: unknown, oldLotNo: unknown, newLotNo: unknown) => unknown;
  deleteConfigLot?: (id: unknown) => Promise<void>;
  saveConfigInstrument?: (id: unknown) => Promise<void>;
  deleteConfigInstrument?: (id: unknown) => Promise<void>;
  defaultAssayLevels?: () => Record<string, any>[];
  configAssayTeaRefs?: () => Record<string, any>[];
  configAssayRefRecord?: (name: unknown, analyteId?: string) => Record<string, any>;
  configAssayNaming?: (ref: Record<string, any>) => Record<string, any>;
  configAssayFindRef?: (value: unknown) => Record<string, any>;
  configAssaySuggestionInput?: (value: unknown) => void;
  configAssayInstrumentChanged?: (this: any) => void;
  openConfigAssayModel?: (id?: string) => Record<string, any> | null;
  saveConfigAssay?: (id: unknown) => Promise<void>;
  delTest?: (id: unknown) => Promise<void>;
  jsq?: (value: unknown) => string;
  pageEntry?: (rightOnly?: boolean) => string;
  entryModel?: () => Record<string, any>;
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
  entrySheetRunChanged?: (tid: unknown, level: unknown, date: string, runIdHint: string, lotNo: string, value: unknown) => Promise<void>;
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
  captureActionDraft?: () => void;
  actionFormChanged?: () => void;
  actionDraftValues?: () => Record<string, any>;
  clearActionDraft?: () => void;
  actionSourceOptions?: (qcBound: boolean, current: unknown) => [string, string][];
  actionCausePhrases?: (category: unknown) => string[];
  actionActionPhrases?: (errorType: unknown) => string[];
  actionInsertSuggestion?: (targetId: string, phrase: string) => void;
  actionLevelLabel?: (l: Record<string, any>, t?: Record<string, any> | null) => string;
  syncActLevels?: () => void;
  actionLevelContext?: (testId: unknown, level: unknown, lot: unknown) => string;
  beginActionManual?: () => void;
  closeActionForm?: () => void;
  actionIncidentBanner?: (form: Record<string, any>, editing: unknown) => string;
  beginActionFromIssue?: (tid: unknown, level: unknown, rule: unknown, err: unknown, act: unknown, pointId?: string, pointDate?: string) => void;
  actionFieldValue?: (id: string, max?: number) => string;
  readActionProtocolForm?: (version?: number) => Record<string, any>;
  actionEffectivenessMissingKey?: (a: Record<string, any>) => string;
  addAction?: () => Promise<void>;
  syncActionRiskScore?: () => void;
  syncActionResidualRiskScore?: () => void;
  editAction?: (i: number) => Promise<void>;
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
  actionFormViewModel?: (issueCount: number) => Record<string, any>;
  actionLevelShort?: (t: unknown, level: unknown, lotSnap: unknown) => string;
  currentIssues?: () => Record<string, any>[];
  cancelAction?: (i: number) => Promise<void>;
  confirmCancelAction?: (id: unknown, token: unknown) => void;
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
  actionDetailCheck?: (label: string, status: unknown, note: unknown) => string;
  actionEvidenceTimelineHtml?: (a: Record<string, any>, rr: unknown) => string;
  actionRerunEvidenceHtml?: (a: Record<string, any>, rr: unknown, t: unknown) => string;
  openActionQcEvidence?: (tid: unknown, level: unknown, pointId: unknown, date: unknown, lot: unknown) => void;
  viewActionDetailModel?: (i: number) => Record<string, any> | null;
  groupIssuesByTestDate?: (issues: Record<string, any>[]) => Record<string, any>[];
  actionViolationInfo?: (a: Record<string, any>) => Record<string, any>;
  actionQcVerdictLabel?: (a: Record<string, any>) => string;
  actionsModel?: () => Record<string, any>;
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
  sgHistoricalLevels?: (t: Record<string, any>) => unknown[];
  sgVisibleLevels?: (t: Record<string, any>) => unknown[];
  sgPeriodLevels?: (t: Record<string, any>, e: Record<string, any>) => unknown[];
  sgPickTest?: (v: unknown) => void;
  sgStatusPeriodId?: (tid: string, data: Record<string, any>[]) => string | undefined;
  sgSelectPeriod?: (eid: string) => void;
  sgRemoveTracked?: (id: unknown) => void;
  sgOpenAddTest?: () => void;
  sgViewTrackedTest?: (id: unknown) => void;
  sgTrackTest?: (id: unknown) => void;
  sigmaModel?: () => any;
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
  sgBiasStats?: (rounds: Record<string, any>[]) => Record<string, any>;
  sgBiasRoundsKey?: (rounds: Record<string, any>[]) => string;
  sgBiasLinkedPeriodIds?: (data: Record<string, any>[], eid: string, level: unknown) => string[];
  sgOpenBiasModel?: (eid: string, level: unknown) => Record<string, any> | null;
  sgApplyBiasToPeriods?: (data: Record<string, any>[], periodIds: string[], level: unknown, bias: number, rounds: Record<string, any>[], batchId?: string) => number;
  sgBiasApply?: (level: unknown, periodIds: string[], rounds: Record<string, any>[]) => Promise<void>;
  sgMuPreview?: (eid: string, level: unknown, rows: Record<string, any>[]) => Record<string, any> | null;
  sgOpenMUModel?: (eid: string) => Record<string, any> | null;
  sgOpenMU?: (eid: string) => void;
  sgMuApply?: (eid: string, periodIds: string[], rows: Record<string, any>[], reviewedBy: string, reviewedDate: string) => Promise<void>;
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
  reagentQuickPickerModalPresentation: typeof reagentQuickPickerModalHtml;
  reagentCreateModalPresentation: typeof reagentCreateModalHtml;
  reagentChartAxis: typeof reagentChartAxis;
  reagentScatterSvg: typeof reagentScatterSvg;
  reagentBlandSvg: typeof reagentBlandSvg;
  reagentQuickPickerRowsHtml: typeof reagentQuickPickerRowsHtml;
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
  syncHasContent?: (source: unknown) => boolean;
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
   UserAvatarCommand: UserAvatarCommand;
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
  settingsModel: ReturnType<typeof createSettingsPageController>['settingsModel'];
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
  activityAuditPagination: typeof activityAuditPagination;
  activityAuditCsv: ReturnType<typeof createActivityAuditCsv>;
  updateActivityAuditDateRange: typeof updateActivityAuditDateRange;
  activityAuditFilterState: typeof activityAuditFilterState;
  activityAuditPageSizes: typeof ACTIVITY_AUDIT_PAGE_SIZES;
  activityAuditArchiveWindow?: typeof activityAuditArchiveWindow;
  userListModel: typeof userListModel;
  // Retire classic users-auth.js (2026-08-20, Pha G nhóm C lát 2) — Users/Audit/Auth pages.
  AUDIT_PAGE_SIZES: typeof ACTIVITY_AUDIT_PAGE_SIZES;
  usersModel: () => Record<string, any>[];
  auditDateKey: (activity: Record<string, any>) => string;
  auditFilteredActivities: (items?: Record<string, any>[]) => Record<string, any>[];
  auditSetQuery: (value: string) => void;
  auditSetDate: (field: string, value: string) => void;
  auditSetPageSize: (value: unknown) => void;
  auditSetPage: (value: unknown) => void;
  auditClearFilters: () => void;
  auditModel: () => Record<string, any>;
  activityCSVRows: (items: Record<string, any>[]) => unknown[][];
  exportActivityCSV: () => void;
  confirmArchiveActivityLog: () => Promise<void>;
  addUser: () => Promise<void>;
  userPermChecks: (selectedIds: string[] | null | undefined, groupId: string, roleValue: string) => string;
  syncUserPermChecks: (groupId: string, roleValue: string) => void;
  collectUserPerms: (groupId: string, roleValue: string) => Promise<string[] | null>;
  openUserPerms: (id: string) => Promise<{ userId: string; userName: string; username: string; role: string; pagePerms: string[] } | null>;
  applyUserPerms: (id: string) => Promise<void>;
  resetPass: (id: string) => void;
  applyResetPass: (id: string) => Promise<void>;
  openAvatarModal: () => void;
  pickAvatar: (e: unknown) => void;
  clearAvatarPhoto: () => void;
  toggleUser: (id: string) => void;
  delUser: (id: string) => Promise<void>;
  passwordError: (password: string) => string;
  legacyHashPass: (password: string) => Promise<string>;
  hashPass: (password: string) => Promise<string>;
  verifyPass: (password: string, stored: string) => Promise<boolean>;
  reauthVerify: (password: string) => Promise<boolean>;
  reauthAccountLabel: () => string | null;
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
  reagentResultHtml: ReturnType<typeof createReagentResultHtml>;
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
  icoDownload: typeof icoDownload;
  icoPrint: typeof icoPrint;
  setSearchCount: ReturnType<typeof createLiveRowFilter>['setSearchCount'];
  showSearchEmpty: ReturnType<typeof createLiveRowFilter>['showSearchEmpty'];
  replaceSelectItems: ReturnType<typeof createLiveRowFilter>['replaceSelectItems'];
  liveRowFilter: ReturnType<typeof createLiveRowFilter>['liveRowFilter'];
  scheduleSearchRender: ReturnType<typeof createLiveRowFilter>['scheduleSearchRender'];
  rangeActions: ReturnType<typeof createRangeActionsHtml>;
  btn: ReturnType<typeof createUiPrimitives>['btn'];
  emptyState: ReturnType<typeof createUiPrimitives>['emptyState'];
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
  dashViewTestInEntry: (testId: string, level: number) => void;
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
  goFromHistory: ReturnType<typeof createRouterDispatchController>['goFromHistory'];
  pageFromUrlHash: () => string;
  resetMainScroll: ReturnType<typeof createRouterDispatchController>['resetMainScroll'];
  render: ReturnType<typeof createRouterDispatchController>['render'];
  restoreRouteFilters: ReturnType<typeof createRouterDispatchController>['restoreRouteFilters'];
  rerender: ReturnType<typeof createRouterDispatchController>['rerender'];
  modalTemplate: ReturnType<typeof createModalTemplate>['modalTemplate'];
  modalCloseButton: ReturnType<typeof createModalTemplate>['modalCloseButton'];
  openModal: (html: string) => void;
  closeModal: () => void;
  closeDialogOverlay: (result?: unknown) => void;
  confirmDialog: (opts?: { kicker?: string; title?: string; message?: string; detail?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }) => Promise<boolean>;
  infoDialog: (message: string, opts?: { title?: string; type?: 'warn' | 'success' }) => Promise<void>;
  vnDatePickerController: ReturnType<typeof createVnDatePickerController>;
  actionDispatcher: ReturnType<typeof createActionDispatcher>;
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
  reportUnlockReason?: ReturnType<typeof createReportUnlockReason>;
  reportUnlockModalHtml: typeof reportUnlockModalHtml;
  reportLockPicker: typeof reportLockPicker;
  reportLockYmValue: ReturnType<typeof createReportPageController>['reportLockYmValue'];
  reportSetLockPart: ReturnType<typeof createReportPageController>['reportSetLockPart'];
  reportLockPeriod: ReturnType<typeof createReportPageController>['reportLockPeriod'];
  reportUnlockPeriod: ReturnType<typeof createReportPageController>['reportUnlockPeriod'];
  reportConfirmUnlockPeriod: ReturnType<typeof createReportPageController>['reportConfirmUnlockPeriod'];
  reportSearchValues: ReturnType<typeof createReportPageController>['reportSearchValues'];
  reportSearchSet: ReturnType<typeof createReportPageController>['reportSearchSet'];
  reportRangeDefaults: ReturnType<typeof createReportPageController>['reportRangeDefaults'];
  reportDateRange: ReturnType<typeof createReportPageController>['reportDateRange'];
  reportExportSelection: ReturnType<typeof createReportPageController>['reportExportSelection'];
  reportRangeChanged: ReturnType<typeof createReportPageController>['reportRangeChanged'];
  reportRangeText: ReturnType<typeof createReportPageController>['reportRangeText'];
  reportActionIcon: ReturnType<typeof createReportPageController>['reportActionIcon'];
  reportModel: ReturnType<typeof createReportPageController>['reportModel'];
  ReportPeriodWorkflowCommand: ReportPeriodWorkflowCommand;
  dashboardStatusFilter: ReturnType<typeof createDashboardStatusFilter>;
  dashboardExpiringLots: typeof dashboardExpiringLots;
  dashboardShiftStatus: typeof dashboardShiftStatus;
  dashboardKpis: typeof dashboardKpis;
  reportQcFormat: ReturnType<typeof createReportQcFormat>;
  qcRangeTea: ReturnType<typeof createRangeTea>;
  entryRowsWindowTs: typeof entryRowsWindowTs;
  entryLotLabelsTs: typeof entryLotLabelsTs;
  entryVoidModalHtml: typeof entryVoidModalHtml;
  entryPreSaveWarningModalHtml: typeof entryPreSaveWarningModalHtml;
  targetSwitchModalHtml: typeof targetSwitchModalHtml;
  qcHistoryDetailModalHtml: typeof qcHistoryDetailModalHtml;
  qcHistoryMeanSdRowsHtml: typeof qcHistoryMeanSdRowsHtml;
  qcHistoryPointRowsHtml: typeof qcHistoryPointRowsHtml;
  targetNumberTextPresentation: ReturnType<typeof createTargetNumberText>;
  targetConfigAssignedPresentation: typeof targetConfigAssignedPresentation;
  targetRangeDraftPresentation: ReturnType<typeof createTargetRangeDraft>;
  parseVnDatePresentation: typeof parseVnDate;
  targetRangeSyncPresentation: ReturnType<typeof createTargetRangeSync>;
  targetOverwritePicksPresentation: typeof targetOverwritePicks;
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
  resetPasswordModalHtml: typeof resetPasswordModalHtml;
  sigmaCohortModalHtml: typeof sigmaCohortModalHtml;
  sigmaFrequencyPanelHtml: typeof sigmaFrequencyPanelHtml;
  sigmaMuSummaryHtml: typeof sigmaMuSummaryHtml;
  sigmaStatusCardHtml: typeof sigmaStatusCardHtml;
  sigmaStatusPanelHtml: typeof sigmaStatusPanelHtml;
  sigmaOpSpecCellHtml: typeof sigmaOpSpecCellHtml;
  sigmaMuStateChipHtml: typeof sigmaMuStateChipHtml;
  sigmaMuDominantText: typeof sigmaMuDominantText;
  sigmaCohortRowsHtml: typeof sigmaCohortRowsHtml;
  sigmaInputDisplayValue: typeof sigmaInputDisplayValue;
  sigmaGoverningRuleBlockHtml: typeof sigmaGoverningRuleBlockHtml;
  sigmaFrequencyRowsHtml: typeof sigmaFrequencyRowsHtml;
  actionIncidentBannerPresentation: typeof actionIncidentBannerPresentation;
  actionBiasContextPresentation: typeof actionBiasContextPresentation;
  actionLevelContextPresentation: typeof actionLevelContextPresentation;
  actionLevelLabelPresentation: typeof actionLevelLabelPresentation;
  actionRuleOptionsPresentation: typeof actionRuleOptionsPresentation;
  actionCausePhrasesPresentation: typeof actionCausePhrasesPresentation;
  actionPhrasesPresentation: typeof actionPhrasesPresentation;
  userPermissionChecksHtml: typeof userPermissionChecksHtml;
  actionFormUiState: ActionFormUiState;
  actionFormRenderState: typeof actionFormRenderState;
  entrySheetMonthPart: typeof entrySheetMonthPart;
  entrySheetMonthValue: typeof entrySheetMonthValue;
  entrySheetNavigation: ReturnType<typeof createEntrySheetNavigation<any>>;
  entrySheetInputOrder: ReturnType<typeof createEntrySheetInputOrder<any>>;
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
  westgardTestSearch: ReturnType<typeof createWestgardTestSearch<any>>;
  westgardMultiViews: ReturnType<typeof createWestgardMultiViews<any, any>>;
  westgardCusumLevels: ReturnType<typeof createWestgardCusumLevels<any, any, any>>;
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
  dashboardExpiringLotItems: typeof dashboardExpiringLotItems;
  dashboardWestgardAlerts: typeof dashboardWestgardAlerts;
  dashboardMissingTargetItems: typeof dashboardMissingTargetItems;
  dashboardTestItems: ReturnType<typeof createDashboardTestItems>;
  dashTestSetStatus: ReturnType<typeof createDashboardPageController>['dashTestSetStatus'];
  dashboardModel: ReturnType<typeof createDashboardPageController>['dashboardModel'];
  actionDetailCheckHtml: ReturnType<typeof createActionDetailCheckHtml>;
  actionEvidenceTimelinePresentation: ReturnType<typeof createActionEvidenceTimelineHtml>;
  actionRerunEvidencePresentation: ReturnType<typeof createActionRerunEvidenceHtml<any>>;
  actionDetailMetaHtml: ReturnType<typeof createActionDetailMetaHtml>;
  actionCancelledAlertHtml: ReturnType<typeof createActionCancelledAlertHtml>;
  actionCancelModalHtml: typeof actionCancelModalHtml;
  actionReviewNoteModalHtml: typeof actionReviewNoteModalHtml;
  actionReopenModalHtml: typeof actionReopenModalHtml;
  actionLegacyDetailHtml: ReturnType<typeof createActionLegacyDetailHtml>;
  actionContainmentDetailHtml: ReturnType<typeof createActionContainmentDetailHtml>;
  actionInspectionDetailsHtml: ReturnType<typeof createActionInspectionDetailsHtml>;
  actionPatientImpactHtml: ReturnType<typeof createActionPatientImpactHtml>;
  actionCauseDetailHtml: ReturnType<typeof createActionCauseDetailHtml>;
  actionEffectivenessDetailHtml: ReturnType<typeof createActionEffectivenessDetailHtml>;
  teaReferenceAddModalPresentation: typeof teaReferenceAddModalHtml;
  manageSearchPlaceholderPresentation: typeof manageSearchPlaceholder;
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
  targetSelectionPresentation: typeof targetSelection;
  targetLevelSelectionPresentation: typeof targetLevelSelection;
  historySearchValuesPresentation: typeof historySearchValues;
  teaLabBasisLabelPresentation: typeof teaLabBasisLabel;
  targetLevelLotsPresentation: typeof targetLevelLots;
  targetSearchValuesPresentation: typeof targetSearchValues;
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
  historyRowsPresentation: typeof historyRows;
  targetEmptyStatePresentation: typeof targetEmptyState;
  targetPrerequisitePresentation: typeof targetPrerequisite;
  teaReferenceKindPresentation: typeof teaReferenceKind;
  teaReferenceRowActionsPresentation: typeof teaReferenceRowActions;
  teaReferenceSortPresentation: typeof sortTeaReferences;
  teaReferenceNamingTitlePresentation: typeof teaReferenceNamingTitle;
  teaReferenceEmptyStatePresentation: typeof teaReferenceEmptyState;
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
  // Retire classic firebase-sync.js (2026-08-20, Pha G nhóm C lát 3) — thuần glue
  // quanh các service sync/firebase phía trên, không có logic mới.
  fb: { ready: boolean; initialized: boolean; ref: any; dirty: boolean; clientId: string;
    authUser: any; pendingRenderT: any; pullT: any; seenSig: any; synced: any; retryT: any; retryMs: number };
  fbSaveT: any;
  fbClone: (value: unknown) => any;
  fbCanWrite: () => boolean;
  fbNetworkOnline: () => boolean;
  fbResetRetry: () => void;
  fbScheduleRetry: () => void;
  fbSetReady: () => void;
  fbStoreLocal: () => void;
  hasLocalQcContent: (value: unknown) => boolean;
  fbSyncedShape: (value: unknown) => any;
  statesLikelyEqual: (a: unknown, b: unknown) => boolean;
  fbSyncedSnapKeys: (value: unknown) => any;
  fbBuildUpdate: (current: unknown) => { payload: Record<string, any> };
  fbHasLocalChanges: () => boolean;
  fbMerge: (local: any, remote: any, base: any) => any;
  fbFirstConnectMerge: (local: any, remote: any) => any;
  saveLabel: string;
  saveDetail: string;
  getDeployFbCfg: () => any;
  getStoredFbCfg: () => any;
  getFbCfg: () => Record<string, any> | null;
  fbConfigSig: (config: any) => string;
  ensureFirebaseApp: (config: any) => Promise<unknown>;
  setCloudStatus: (text: string, connected: boolean) => void;
  saveTime: () => string;
  updateSaveStatus: () => void;
  markSaved: (label: string, detail?: string) => void;
  fbDataPath: () => string;
  fbStatusLabel: () => string;
  fbRejectBrokenAudit: (source: string, result: { brokenIndex?: number; reason?: string } | null | undefined) => boolean;
  fbAuditMaySync: (snapshot: unknown, source: string) => boolean;
  fbStopPull: () => void;
  fbStartPull: () => void;
  fbDisconnect: (clearAuthUser?: boolean) => void;
  fbPullOnce: () => Promise<unknown>;
  fbHandleValue: (value: any, opts?: Record<string, any>) => Promise<unknown>;
  initFirebase: () => Promise<unknown>;
  remoteRenderUnsafe: () => boolean;
  applyRemoteRender: () => void;
  syncNow: () => Promise<unknown>;
  scheduleFbPush: () => void;
  fbFlushPush: () => Promise<unknown>;
  // Retire classic state-storage.js (2026-08-20, Pha G nhóm C lát 4) — thuần glue
  // quanh các service storage/save đã có sẵn, không có logic mới.
  localLoadStatus: string;
  storageHydrationPromise: Promise<boolean>;
  partitionSlot: string;
  lsSaveT: any;
  lsIdleHandle: any;
  lsDirty: boolean;
  lsFullDirty: boolean;
  lsDirtyTestIds: Set<string>;
  lsRevision: number;
  lsSerializedRevision: number;
  lsSerialized: string;
  lsLastBytes: number;
  lsLastSerializeMs: number;
  lsSerializeCount: number;
  lsSaveFailures: number;
  partitionWrite: Promise<any>;
  lsIncrementalStreak: number;
  lsLastFullSaveAt: number;
  LS_FULL_ROTATE_MAX_INCREMENTALS: number;
  LS_FULL_ROTATE_MAX_MS: number;
  sigmaDraftRecord: () => any;
  sigmaDraftStamp: () => number;
  persistSigmaDraft: (testId: unknown) => boolean;
  clearSigmaDraftThrough: (stamp: number) => void;
  sigmaDraftNeedsCloud: () => boolean;
  recoverPendingSigmaDraft: () => boolean;
  quarantineCorruptLocal: (raw: string, error: unknown) => void;
  adoptValidatedState: (parsed: unknown) => any;
  load: () => boolean;
  hydratePartitionedState: () => Promise<boolean>;
  restoreFromIndexedDb: () => Promise<boolean>;
  loadBootState: () => Promise<boolean>;
  mirrorIndexedDb: (raw: string) => void;
  lsSaveDelay: () => number;
  cancelLocalSaveSchedule: () => void;
  scheduleLocalSave: () => void;
  scheduleLocalRetry: () => void;
  serializeStateForStorage: () => string;
  persistLocalSnapshot: (opts?: Record<string, any>) => boolean;
  lsFlush: () => boolean;
  invalidateDerivedForSave: (opts?: Record<string, any>) => void;
  save: (opts?: Record<string, any>) => void;
  // Retire classic qc-domain.js (2026-08-20, Pha G nhóm C lát 5) — glue thuần
  // quanh các service Westgard/QC domain đã có sẵn, không có logic mới.
  stats: (vals: number[]) => any;
  reportLevelStats: (pts: any[], mean: number, teaVal?: any) => any;
  wgOn: (rule: string) => boolean;
  wgSet: (rule: string, on: boolean) => void;
  wgReset: () => void;
  testLevelCount: (t: any) => number;
  defaultRuleAction: (rule: string) => string;
  testRuleAction: (t: any, rule: string) => string;
  testRuleOn: (t: any, rule: string) => boolean;
  defaultRuleScope: (t: any, rule: string) => string;
  testRuleScope: (t: any, rule: string) => string;
  testRuleOnIn: (t: any, rule: string, channel: string) => boolean;
  testRuleOnWithin: (t: any, rule: string) => boolean;
  testRuleOnAcross: (t: any, rule: string) => boolean;
  testRuleSet: (t: any, channel: string) => Set<any>;
  ruleResultLevel: (t: any, rules: string[]) => string;
  westgard: (points: any[], mean: number, sd: number) => any;
  westgardMulti: (levelSets: any[]) => any;
  westgardByPoint: (points: any[], mean: number, sd: number) => any;
  westgardMultiByPoint: (levelSets: any[]) => any;
  WG_RULE_DESCRIPTIONS: Record<string, string>;
  primaryErrorRule: (rules: string[]) => string;
  errorType: (rules: string[]) => string;
  fixHint: (rules: string[]) => string;
  errorTypeDetailParts: (rules: string[]) => any;
  wgWorker: any;
  wgWorkerGeneration: number;
  wgWorkerRevisions: Map<string, number>;
  wgWorkerPending: Map<string, any>;
  wgWorkerFailed: boolean;
  wgWorkerRenderT: any;
  westgardWorkerRevision: (testId: any) => number;
  invalidateWestgardWorker: (testId?: any) => void;
  westgardWorkerWorthwhile: (tests: any[]) => boolean;
  westgardWorkerJob: (t: any, generation: number, revision?: number) => any;
  hydrateWestgardWorkerResult: (message: any) => boolean;
  westgardWorkerReadyToRender: () => boolean;
  westgardWorkerMessage: (event: any) => void;
  ensureWestgardWorker: () => any;
  scheduleWestgardPrewarm: (tests: any[]) => boolean;
  normalizePointLots: () => void;
  normalizeDuplicateRunIds: () => void;
  derived: () => any;
  pointsOf: (testId: any, level: any) => any[];
  pointsWithIndex: (testId: any, level: any) => any[];
  lvlCfg: (t: any, level: any) => any;
  pointsForLot: (testId: any, level: any, lot: any, withIndex?: boolean) => any[];
  activeLotPoints: (t: any, level: any, withIndex?: boolean) => any[];
  operationalPanelForTest: (t: any) => any;
  operationalTestOrder: (t: any) => number;
  isOperationalLotGroup: (g: any) => boolean;
  operationalLotGroupForLevel: (l: any) => any;
  lotGroupInUse: (g: any) => boolean;
  operationalLotGroupForTest: (t: any) => any;
  operationalLevels: (t: any) => any[];
  levelTargetOk: (l: any) => boolean;
  levelsMissingTarget: (t: any) => any[];
  isOperationalTest: (t: any) => boolean;
  canEnterQcForLevel: (t: any, level: any) => boolean;
  operationalTests: () => any[];
  operationalLotPoints: (t: any, level: any, withIndex?: boolean) => any[];
  lotLineage: (currentLotId: any) => any[];
  lotPointsByNo: (testId: any, level: any, lotNo: any) => any[];
  lotMeanSdFor: (t: any, level: any, lotNo: any) => any;
  lotTargetSnapshot: (t: any, level: any, lotId: any, lotNo: any) => any;
  parallelLotForLevel: (t: any, level: any) => any;
  entryColumns: (t: any) => any[];
  entryColumnPoints: (t: any, col: any, withIndex?: boolean) => any[];
  parallelWestgard: (t: any, col: any) => any;
  pointVoidVerdict: (t: any, p: any) => any;
  plannedTargetFor: (t: any, lot: any) => any;
  previousLotSeries: (t: any, level: any) => any[];
  levelsForLotGroup: (group: any) => any[];
  pointRunNo: (p: any) => number;
  activeWestgard: (t: any) => any;
  testCusumConfig: (t: any) => any;
  cusumSeries: (t: any, l: any) => any;
  acceptedLotPoints: (t: any, level: any, withIndex?: boolean) => any[];
  testSelectLabel: (t: any, list?: any[]) => string;
  searchText: (s: any) => string;
  // Retire classic state.js + analyte-catalog.js (2026-08-20, Pha G nhóm C lát 6
  // — lát cuối, đóng nhóm C) — glue thuần quanh các service TypeScript đã có
  // sẵn, không có logic mới.
  TEA_ANALYTE_CATALOG: any[];
  teaAnalyteKey: (value: any) => string;
  REFTESTS: readonly any[][];
  TEA_ANALYTE_META: Record<string, any>;
  TEA_ANALYTE_META_BY_ID: Record<string, any>;
  teaAnalyteBuiltInMeta: (value: any) => any;
  teaAnalyteMetaById: (id: any) => any;
  teaAnalyteMeta: (name: any, record?: any) => any;
  teaAnalyteDisplay: (name: any, record?: any) => any;
  TEA_REFERENCE_SCHEMA_VERSION: number;
  teaReferenceSchemaVersion: number;
  TEA_SOURCE_REGISTRY: Record<string, any>;
  WG_RULE_REGISTRY: Record<string, any>;
  WG_RULES: readonly string[];
  WG_DEFAULT: Record<string, boolean>;
  STATE_SCHEMA_VERSION: number;
  state: Record<string, any> & { data?: Record<string, Record<string, any>[]>; tests?: Record<string, any>[] };
  mem: any;
  pointsCache: Map<string, any>;
  pointsIndexCache: Map<string, any>;
  pointsLotCache: Map<string, any>;
  wgMemo: Map<string, any>;
  acceptedMemo: Map<string, any>;
  cusumMemo: Map<string, any>;
  derivedIndex: any;
  startupProblem: any;
  legacyDerivedCacheState: Record<string, any>;
  ensureShape: (opts?: Record<string, any>) => any;
  pruneUnusedTestLevels: () => void;
  repairAppliedRangeLimits: () => void;
  uid: () => string;
  reconcileSigmaLevelsWithLotGroups: () => void;
  ensureConfigurationShape: () => void;
  transitionSwitchesLot: (tr: any) => boolean;
  syncLotDepletionFromTransitions: () => void;
  dedupeLotTargetHistory: (target: any) => any;
  upsertLotTargetHistory: (target: any, lot: any, values: any) => any;
  inspectAcceptedLotTransition: (tr: any) => any;
  applyAcceptedLotTransitionToConfig: (tr: any) => any;
  normalizeLotGroups: () => void;
  clearDerived: () => void;
  clearDerivedForTest: (testId: any) => void;
  userName: () => string;
  staffInitials: (name: any) => string;
  currentStaff: () => any;
  pointStaff: (p: any) => any;
  dateObj: (s: any) => any;
  daysToExp: (exp: any) => any;
  fmt: (x: any, d?: number) => string;
  QC_DECIMALS_DEFAULT: number;
  QC_DECIMALS_MAX: number;
  QC_STAT_EXTRA_DECIMALS: number;
  testDecimalPlaces: (test: any, point?: any) => number;
  testStatDecimals: (test: any) => number;
  fmtTestValue: (test: any, value: any, point?: any) => string;
  fmtTestStat: (test: any, value: any) => string;
  fmtPointValue: (point: any, test?: any) => string;
  isoDate: (d?: Date) => string;
  isoToday: () => string;
  isoMonth: () => string;
  requireUnlockedPeriod: (date: any, action?: string) => Promise<boolean>;
  vnDate: (s: any) => string;
  vnPeriod: (s: any) => string;
  monthVN: (s: any) => string;
  formatDateTimeVN: (s: any) => string;
  safeName: (s: any) => string;
  // Retire assets/app.js (2026-08-20, Pha H lát 1) — boot entry point, giờ gọi
  // qua DOMContentLoaded thay vì tự chạy lúc classic script nạp (xem cuối file).
  boot: () => Promise<void>;
  goManageTargets: () => void;
  entryCloseKeepScroll: () => void;
  entryConfirmInlineSave: (tid: unknown, level: unknown, date: string, val: unknown, runId: unknown, lotNo: unknown, valueDecimals: number) => void;
  dashboardGoEntryFollowup: (testId: unknown, level: unknown) => void;
  dashboardContinueAction: (index: number) => void;
  brandPickLogo: () => void;
  hideFieldError: (id: string) => void;
  clickElementById: (id: string) => void;
  wgSelectTest: (value: unknown) => void;
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

// Retire classic analyte-catalog.js + state.js (2026-08-20, Pha G nhóm C lát 6 —
// LÁT CUỐI, đóng nhóm C) — glue thuần quanh các service TypeScript đã có sẵn
// (qcStateFoundation/qcStateLifecycle/qcLevelReconciliation/qcRangeLimitRepair/
// ManageConfigService/qcLotTargetHistory/derivedCacheInvalidation/
// qcStaffIdentity/qcDateFormat/qcBasicFormat/qcValueFormat/qcTestConfiguration/
// qcConfigurationRelations/PeriodService/ReagentComparisonService/…), không có
// logic mới. Đặt NGAY SAU guard kiểm tra QCCore ở trên, TRƯỚC MỌI thứ khác
// trong bundle — đúng thứ tự nạp classic cũ (analyte-catalog.js → state.js →
// mọi module khác), vì phía dưới có chỗ đọc TEA_SOURCE_REGISTRY/
// TEA_ANALYTE_CATALOG/REFTESTS trực tiếp không qua lazy closure (xem
// SigmaTeaResolution).
root.TEA_ANALYTE_CATALOG=Object.freeze([
  {analyteId:'qclab-albumin',name:'Albumin',abbreviation:'ALB',unit:'g/L',section:'Hóa sinh',tea:{clia:8,ricos:4.07}},
  {analyteId:'qclab-alp',name:'Alkaline phosphatase',abbreviation:'ALP',unit:'U/L',section:'Hóa sinh',tea:{clia:20,ricos:12.04}},
  {analyteId:'qclab-alt',name:'Alanine aminotransferase',abbreviation:'ALT',unit:'U/L',section:'Hóa sinh',tea:{clia:15,ricos:27.48,cliaAbsolute:6,cliaAbsoluteUnit:'U/L'}},
  {analyteId:'qclab-ast',name:'Aspartate aminotransferase',abbreviation:'AST',unit:'U/L',section:'Hóa sinh',tea:{clia:15,ricos:16.69,cliaAbsolute:6,cliaAbsoluteUnit:'U/L'}},
  {analyteId:'qclab-amylase',name:'Amylase',abbreviation:'AMY',unit:'U/L',section:'Hóa sinh',tea:{clia:20,ricos:14.6}},
  {analyteId:'qclab-bilirubin-total',name:'Total bilirubin',abbreviation:'TBIL',unit:'µmol/L',section:'Hóa sinh',tea:{clia:20,ricos:26.94,cliaAbsolute:6.84,cliaAbsoluteUnit:'µmol/L'}},
  {analyteId:'qclab-bilirubin-direct',name:'Direct bilirubin',abbreviation:'DBIL',unit:'µmol/L',section:'Hóa sinh',tea:{clia:null,ricos:44.5}},
  {analyteId:'qclab-calcium',name:'Calcium',abbreviation:'Ca',unit:'mmol/L',section:'Hóa sinh',tea:{clia:null,ricos:2.55,cliaAbsolute:.2495,cliaAbsoluteUnit:'mmol/L'}},
  {analyteId:'qclab-chloride',name:'Chloride',abbreviation:'Cl',unit:'mmol/L',section:'Hóa sinh',tea:{clia:5,ricos:1.5}},
  {analyteId:'qclab-cholesterol-total',name:'Total cholesterol',abbreviation:'TC',unit:'mmol/L',section:'Hóa sinh',tea:{clia:10,ricos:9.01}},
  {analyteId:'qclab-ck',name:'Creatine kinase',abbreviation:'CK',unit:'U/L',section:'Hóa sinh',tea:{clia:20,ricos:30.3}},
  {analyteId:'qclab-ck-mb',name:'Creatine kinase-MB',abbreviation:'CK-MB',unit:'U/L',section:'Hóa sinh',tea:{clia:25,ricos:30.06}},
  {analyteId:'qclab-creatinine',name:'Creatinine',abbreviation:'CREA',unit:'µmol/L',section:'Hóa sinh',tea:{clia:10,ricos:8.87,cliaAbsolute:17.68,cliaAbsoluteUnit:'µmol/L'}},
  {analyteId:'qclab-ggt',name:'Gamma-glutamyl transferase',abbreviation:'GGT',unit:'U/L',section:'Hóa sinh',tea:{clia:15,ricos:22.11,cliaAbsolute:5,cliaAbsoluteUnit:'U/L'}},
  {analyteId:'qclab-glucose',name:'Glucose',abbreviation:'GLU',unit:'mmol/L',section:'Hóa sinh',tea:{clia:8,ricos:6.96,cliaAbsolute:.3331,cliaAbsoluteUnit:'mmol/L'}},
  {analyteId:'qclab-hdl-c',name:'HDL cholesterol',abbreviation:'HDL-C',unit:'mmol/L',section:'Hóa sinh',tea:{clia:20,ricos:11.63,cliaAbsolute:.1552,cliaAbsoluteUnit:'mmol/L'}},
  {analyteId:'qclab-ldh',name:'Lactate dehydrogenase',abbreviation:'LDH',unit:'U/L',section:'Hóa sinh',tea:{clia:15,ricos:11.4}},
  {analyteId:'qclab-ldl-c',name:'LDL cholesterol',abbreviation:'LDL-C',unit:'mmol/L',section:'Hóa sinh',tea:{clia:20,ricos:11.9}},
  {analyteId:'qclab-lipase',name:'Lipase',abbreviation:'LIP',unit:'U/L',section:'Hóa sinh',tea:{clia:null,ricos:37.88}},
  {analyteId:'qclab-magnesium',name:'Magnesium',abbreviation:'Mg',unit:'mmol/L',section:'Hóa sinh',tea:{clia:15,ricos:4.8}},
  {analyteId:'qclab-phosphate',name:'Phosphate',abbreviation:'PHOS',unit:'mmol/L',section:'Hóa sinh',tea:{clia:10,ricos:10.11,cliaAbsolute:.0969,cliaAbsoluteUnit:'mmol/L'}},
  {analyteId:'qclab-potassium',name:'Potassium',abbreviation:'K',unit:'mmol/L',section:'Hóa sinh',tea:{clia:null,ricos:5.61,cliaAbsolute:.3,cliaAbsoluteUnit:'mmol/L'}},
  {analyteId:'qclab-protein-total',name:'Total protein',abbreviation:'TP',unit:'g/L',section:'Hóa sinh',tea:{clia:8,ricos:3.63}},
  {analyteId:'qclab-sodium',name:'Sodium',abbreviation:'Na',unit:'mmol/L',section:'Hóa sinh',tea:{clia:null,ricos:.73,cliaAbsolute:4,cliaAbsoluteUnit:'mmol/L'}},
  {analyteId:'qclab-iron',name:'Iron',abbreviation:'Fe',unit:'µmol/L',section:'Hóa sinh',tea:{clia:15,ricos:30.7}},
  {analyteId:'qclab-triglycerides',name:'Triglycerides',abbreviation:'TG',unit:'mmol/L',section:'Hóa sinh',tea:{clia:15,ricos:25.99}},
  {analyteId:'qclab-troponin-i',name:'Cardiac troponin I',abbreviation:'cTnI',unit:'ng/mL',section:'Hóa sinh',tea:{clia:30,ricos:27.91,cliaAbsolute:.9,cliaAbsoluteUnit:'ng/mL'}},
  {analyteId:'qclab-troponin-t',name:'Cardiac troponin T',abbreviation:'cTnT',unit:'ng/mL',section:'Hóa sinh',tea:{clia:30,ricos:48.9,cliaAbsolute:.2,cliaAbsoluteUnit:'ng/mL'}},
  {analyteId:'qclab-urea',name:'Urea',abbreviation:'UREA',unit:'mmol/L',section:'Hóa sinh',tea:{clia:9,ricos:15.55}},
  {analyteId:'qclab-uric-acid',name:'Uric acid',abbreviation:'UA',unit:'µmol/L',section:'Hóa sinh',tea:{clia:10,ricos:11.97}},
  {analyteId:'qclab-afp',name:'Alpha-fetoprotein',abbreviation:'AFP',unit:'ng/mL',section:'Miễn dịch',tea:{clia:20,ricos:21.9}},
  {analyteId:'qclab-anti-hbs',name:'Hepatitis B surface antibody',abbreviation:'Anti-HBs',unit:'IU/L',section:'Miễn dịch',tea:{clia:null,ricos:null}},
  {analyteId:'qclab-ca-125',name:'Cancer antigen 125',abbreviation:'CA 125',unit:'U/mL',section:'Miễn dịch',tea:{clia:20,ricos:35.4}},
  {analyteId:'qclab-ca-19-9',name:'Carbohydrate antigen 19-9',abbreviation:'CA 19-9',unit:'U/mL',section:'Miễn dịch',tea:{clia:null,ricos:46.03}},
  {analyteId:'qclab-cea',name:'Carcinoembryonic antigen',abbreviation:'CEA',unit:'ng/mL',section:'Miễn dịch',tea:{clia:15,ricos:24.7,cliaAbsolute:1,cliaAbsoluteUnit:'ng/mL'}},
  {analyteId:'qclab-cortisol',name:'Cortisol',abbreviation:'COR',unit:'nmol/L',section:'Miễn dịch',tea:{clia:20,ricos:22.8}},
  {analyteId:'qclab-ferritin',name:'Ferritin',abbreviation:'FER',unit:'ng/mL',section:'Miễn dịch',tea:{clia:20,ricos:16.9}},
  {analyteId:'qclab-folate',name:'Folate',abbreviation:'FOL',unit:'ng/mL',section:'Miễn dịch',tea:{clia:30,ricos:39,cliaAbsolute:1,cliaAbsoluteUnit:'ng/mL'}},
  {analyteId:'qclab-fsh',name:'Follicle-stimulating hormone',abbreviation:'FSH',unit:'IU/L',section:'Miễn dịch',tea:{clia:18,ricos:21.19,cliaAbsolute:2,cliaAbsoluteUnit:'IU/L'}},
  {analyteId:'qclab-hba1c',name:'Hemoglobin A1c',abbreviation:'HbA1c',matrix:'Whole blood',unit:'%',section:'Miễn dịch',tea:{clia:8,ricos:3}},
  {analyteId:'qclab-hcg',name:'Human chorionic gonadotropin',abbreviation:'hCG',unit:'mIU/mL',section:'Miễn dịch',tea:{clia:18,ricos:null,cliaAbsolute:3,cliaAbsoluteUnit:'mIU/mL'}},
  {analyteId:'qclab-insulin',name:'Insulin',abbreviation:'INS',unit:'µIU/mL',section:'Miễn dịch',tea:{clia:null,ricos:32.9}},
  {analyteId:'qclab-lh',name:'Luteinizing hormone',abbreviation:'LH',unit:'IU/L',section:'Miễn dịch',tea:{clia:20,ricos:27.92}},
  {analyteId:'qclab-myoglobin',name:'Myoglobin',abbreviation:'MYO',unit:'ng/mL',section:'Miễn dịch',tea:{clia:null,ricos:19.6}},
  {analyteId:'qclab-nt-probnp',name:'N-terminal pro-B-type natriuretic peptide',abbreviation:'NT-proBNP',unit:'pg/mL',section:'Miễn dịch',tea:{clia:30,ricos:13}},
  {analyteId:'qclab-prolactin',name:'Prolactin',abbreviation:'PRL',unit:'ng/mL',section:'Miễn dịch',tea:{clia:20,ricos:29.4}},
  {analyteId:'qclab-psa',name:'Prostate-specific antigen',abbreviation:'PSA',unit:'ng/mL',section:'Miễn dịch',tea:{clia:20,ricos:33.6,cliaAbsolute:.2,cliaAbsoluteUnit:'ng/mL'}},
  {analyteId:'qclab-t3-total',name:'Total triiodothyronine',abbreviation:'TT3',unit:'nmol/L',section:'Miễn dịch',tea:{clia:30,ricos:9.22}},
  {analyteId:'qclab-ft3',name:'Free triiodothyronine',abbreviation:'FT3',unit:'pmol/L',section:'Miễn dịch',tea:{clia:null,ricos:11.3}},
  {analyteId:'qclab-ft4',name:'Free thyroxine',abbreviation:'FT4',unit:'pmol/L',section:'Miễn dịch',tea:{clia:15,ricos:8,cliaAbsolute:3.861,cliaAbsoluteUnit:'pmol/L'}},
  {analyteId:'qclab-t4-total',name:'Total thyroxine',abbreviation:'TT4',unit:'nmol/L',section:'Miễn dịch',tea:{clia:20,ricos:7,cliaAbsolute:12.87,cliaAbsoluteUnit:'nmol/L'}},
  {analyteId:'qclab-testosterone',name:'Testosterone',abbreviation:'TESTO',unit:'nmol/L',section:'Miễn dịch',tea:{clia:30,ricos:13.61,cliaAbsolute:.694,cliaAbsoluteUnit:'nmol/L'}},
  {analyteId:'qclab-tsh',name:'Thyroid-stimulating hormone',abbreviation:'TSH',unit:'mIU/L',section:'Miễn dịch',tea:{clia:20,ricos:23.7,cliaAbsolute:.2,cliaAbsoluteUnit:'mIU/L'}},
  {analyteId:'qclab-vitamin-b12',name:'Vitamin B12',abbreviation:'B12',unit:'pg/mL',section:'Miễn dịch',tea:{clia:25,ricos:null,cliaAbsolute:30,cliaAbsoluteUnit:'pg/mL'}},
  {analyteId:'qclab-vitamin-d-25-oh',name:'25-hydroxyvitamin D',abbreviation:'25-OH-D',unit:'ng/mL',section:'Miễn dịch',tea:{clia:null,ricos:null}},
  {analyteId:'qclab-blood-gas-ph',name:'pH',abbreviation:'pH',unit:'',section:'Khí máu',tea:{clia:null,ricos:null,cliaAbsolute:.04,cliaAbsoluteUnit:''}},
  {analyteId:'qclab-blood-gas-pco2',name:'Carbon dioxide partial pressure',abbreviation:'pCO2',unit:'mmHg',section:'Khí máu',tea:{clia:8,ricos:5.7,cliaAbsolute:5,cliaAbsoluteUnit:'mmHg'}},
  {analyteId:'qclab-blood-gas-po2',name:'Oxygen partial pressure',abbreviation:'pO2',unit:'mmHg',section:'Khí máu',tea:{clia:15,ricos:null,cliaAbsolute:15,cliaAbsoluteUnit:'mmHg'}},
  {analyteId:'qclab-blood-gas-hco3',name:'Bicarbonate',abbreviation:'HCO3-',unit:'mmol/L',section:'Khí máu',tea:{clia:null,ricos:5.6}},
  {analyteId:'qclab-blood-gas-base-excess',name:'Base excess',abbreviation:'BE',unit:'mmol/L',section:'Khí máu',tea:{clia:null,ricos:null}},
  {analyteId:'qclab-blood-gas-sao2',name:'Arterial oxygen saturation',abbreviation:'SaO2',unit:'%',section:'Khí máu',tea:{clia:null,ricos:null}},
  {analyteId:'qclab-blood-gas-fio2',name:'Fraction of inspired oxygen',abbreviation:'FiO2',unit:'%',section:'Khí máu',tea:{clia:null,ricos:null}},
  {analyteId:'qclab-blood-gas-lactate',name:'Lactate',abbreviation:'Lac',unit:'mmol/L',section:'Khí máu',tea:{clia:null,ricos:30.4}},
  {analyteId:'qclab-blood-gas-hemoglobin',name:'Hemoglobin',abbreviation:'HGB',matrix:'Whole blood',unit:'g/dL',section:'Huyết học',tea:{clia:4,ricos:4.19}},
  {analyteId:'qclab-blood-gas-hematocrit',name:'Hematocrit',abbreviation:'HCT',matrix:'Whole blood',unit:'%',section:'Huyết học',tea:{clia:4,ricos:3.97}},
  {analyteId:'qclab-leukocyte-count',name:'Leukocyte count',abbreviation:'WBC',matrix:'Whole blood',unit:'10^3/µL',section:'Huyết học',tea:{clia:10,ricos:null}},
  {analyteId:'qclab-erythrocyte-count',name:'Erythrocyte count',abbreviation:'RBC',matrix:'Whole blood',unit:'10^6/µL',section:'Huyết học',tea:{clia:4,ricos:null}},
  {analyteId:'qclab-platelet-count',name:'Platelet count',abbreviation:'PLT',matrix:'Whole blood',unit:'10^3/µL',section:'Huyết học',tea:{clia:25,ricos:null}},
  {analyteId:'qclab-mcv',name:'Mean corpuscular volume',abbreviation:'MCV',matrix:'Whole blood',unit:'fL',section:'Huyết học',tea:{clia:null,ricos:null}},
  {analyteId:'qclab-mch',name:'Mean corpuscular hemoglobin',abbreviation:'MCH',matrix:'Whole blood',unit:'pg',section:'Huyết học',tea:{clia:null,ricos:null}},
  {analyteId:'qclab-mchc',name:'Mean corpuscular hemoglobin concentration',abbreviation:'MCHC',matrix:'Whole blood',unit:'g/dL',section:'Huyết học',tea:{clia:null,ricos:null}},
  {analyteId:'qclab-rdw',name:'Red cell distribution width',abbreviation:'RDW',matrix:'Whole blood',unit:'%',section:'Huyết học',tea:{clia:null,ricos:null}},
  {analyteId:'qclab-prothrombin-time',name:'Prothrombin time',abbreviation:'PT',matrix:'Platelet-poor plasma',unit:'s',section:'Đông máu',tea:{clia:15,ricos:null}},
  {analyteId:'qclab-inr',name:'International normalized ratio',abbreviation:'INR',matrix:'Platelet-poor plasma',unit:'ratio',section:'Đông máu',tea:{clia:15,ricos:null}},
  {analyteId:'qclab-aptt',name:'Activated partial thromboplastin time',abbreviation:'aPTT',matrix:'Platelet-poor plasma',unit:'s',section:'Đông máu',tea:{clia:15,ricos:null}},
  {analyteId:'qclab-fibrinogen',name:'Fibrinogen',abbreviation:'FIB',matrix:'Platelet-poor plasma',unit:'mg/dL',section:'Đông máu',tea:{clia:20,ricos:null}},
  {analyteId:'qclab-d-dimer',name:'D-dimer',abbreviation:'D-Dimer',matrix:'Platelet-poor plasma',unit:'mg/L FEU',section:'Đông máu',tea:{clia:null,ricos:null}},
] as any[]).map((row:any)=>Object.freeze({...row,matrix:row.matrix||(row.section==='Khí máu'?'Whole blood':'Serum/Plasma'),aliases:Object.freeze(row.abbreviation?[row.abbreviation]:[]),tea:Object.freeze({...row.tea})})) as any;

root.teaAnalyteKey=v=>root.teaAnalyteMetaService?root.teaAnalyteMetaService.key(v):String(v==null?'':v).trim().toLowerCase();
root.REFTESTS=Object.freeze(TEA_ANALYTE_CATALOG.map((row:any)=>Object.freeze([row.name,row.unit,row.tea.clia,row.tea.ricos,row.section]))) as readonly any[][];
root.TEA_ANALYTE_META=Object.freeze(Object.fromEntries(TEA_ANALYTE_CATALOG.map((row:any)=>{const aliases=[row.name,row.abbreviation].filter(Boolean),displayName=row.abbreviation&&teaAnalyteKey(row.abbreviation)!==teaAnalyteKey(row.name)?`${row.name} (${row.abbreviation})`:row.name;return[teaAnalyteKey(row.name),Object.freeze({analyteId:row.analyteId,displayName,standardName:row.name,abbreviation:row.abbreviation||'',aliases:Object.freeze(aliases),matrix:row.matrix})];})));
root.TEA_ANALYTE_META_BY_ID=Object.freeze(Object.fromEntries(Object.values(TEA_ANALYTE_META).map((m:any)=>[m.analyteId,m])));
root.teaAnalyteBuiltInMeta=value=>root.teaAnalyteMetaService!.builtIn(value);
root.teaAnalyteMetaById=id=>root.teaAnalyteMetaService!.byId(id);
root.teaAnalyteMeta=(name,record)=>root.teaAnalyteMetaService!.meta(name,record);
root.teaAnalyteDisplay=(name,record)=>root.teaAnalyteMetaService!.display(name,record);
root.TEA_REFERENCE_SCHEMA_VERSION=3;
root.teaReferenceSchemaVersion=TEA_REFERENCE_SCHEMA_VERSION;
root.TEA_SOURCE_REGISTRY=Object.freeze({
  lab:Object.freeze({id:'qclab-standardized-tea',label:'TEa chuẩn hóa của phòng xét nghiệm',version:'Danh mục nội bộ',document:'Bảng TEa chuẩn hóa của phòng xét nghiệm',url:'',effectiveDate:'',reviewedDate:'',reviewedBy:'',status:'reviewed',note:'Giá trị TEa do phòng xét nghiệm lựa chọn, phê duyệt và duy trì nhất quán cho từng xét nghiệm.'}),
  clia:Object.freeze({id:'clia-cms-3355-f-2024',label:'CLIA PT (CMS-3355-F)',version:'CMS-3355-F / 42 CFR §§493.931, 493.941',document:'CLIA Proficiency Testing — Analytes and Acceptable Performance Criteria',url:'https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-493/subpart-I',effectiveDate:'2024-07-11',reviewedDate:'2026-07-16',reviewedBy:'QC Lab built-in registry',status:'reference',note:'Tiêu chí chấp nhận PT được dùng làm mục tiêu TEa tham khảo; không phải tuyên bố tuân thủ CLIA của đơn vị.'}),
  ricos:Object.freeze({id:'ricos-bv-2014',label:'Ricos / Westgard BV',version:'2014',document:'Desirable Specifications for Total Error derived from Biological Variation — Ricos et al.',url:'https://westgard.com/clia-and-quality-regulation-requirements/quality-requirements/biodatabase1.html',effectiveDate:'',reviewedDate:'2026-07-16',reviewedBy:'QC Lab built-in registry',status:'retired',note:'Bộ dữ liệu legacy, cập nhật lần cuối năm 2014; EFLM hiện quản lý cơ sở dữ liệu biological variation mới.'}),
  eflm:Object.freeze({id:'eflm-bv-live',label:'EFLM Biological Variation Database',version:'Live database',document:'EFLM Biological Variation Database',url:'https://biologicalvariation.eu/',effectiveDate:'',reviewedDate:'2026-07-16',reviewedBy:'QC Lab built-in registry',status:'dynamic',note:'Giá trị thay đổi theo database; phải lưu analyte, mức APS, ngày tra cứu và tài liệu/link tại thời điểm áp dụng.'})
});
root.WG_RULE_REGISTRY=(root.QCCore as any).WG_RULE_REGISTRY;
root.WG_RULES=(root.QCCore as any).WG_RULES;
root.WG_DEFAULT=Object.fromEntries(WG_RULES.map((r:string)=>[r,(root.QCCore as any).WG_DEFAULT_ON.has(r)]));
root.STATE_SCHEMA_VERSION=(root.QCCore as any).STATE_SCHEMA_VERSION;
root.state={lab:{name:'',dept:'',address:''} as any,tests:[],machines:["Máy A"],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],data:{},actions:[],activity:[],activityAnchor:'',users:[],reagentTests:[],reagentOperators:[],reagentSampleTypes:['Mẫu bệnh nhân','Mẫu nội kiểm (IQC)','Mẫu ngoại kiểm (EQA)'],sigmaData:{},periodLocks:[],teaRefs:[],teaRegistryVersion:TEA_REFERENCE_SCHEMA_VERSION,westgardRules:{...WG_DEFAULT},configMigrationVersion:1,schemaVersion:STATE_SCHEMA_VERSION};
root.mem=null;root.pointsCache=new Map();root.pointsIndexCache=new Map();root.pointsLotCache=new Map();root.wgMemo=new Map();root.acceptedMemo=new Map();root.cusumMemo=new Map();root.derivedIndex=null;root.startupProblem=null;
/* Zustand vanilla store — notify-bus thay renderBus.ts tự viết (xem
   src/application/state/app-store.ts). Construct MỘT LẦN DUY NHẤT ở đây, chia
   sẻ qua window.__QC_KERNEL__ cho bundle react-pilot.js đọc (2 bundle Vite
   riêng biệt không dùng chung module registry, nên phải là MỘT instance đi
   qua window, không phải mỗi bên tự `import` rồi có bản riêng). */
const appStore = createAppStore();
root.legacyDerivedCacheState={pointCaches:()=>[pointsCache,pointsIndexCache,pointsLotCache,cusumMemo],westgardMemo:()=>wgMemo,acceptedMemo:()=>acceptedMemo,cusumMemo:()=>cusumMemo,resetDerivedIndex:()=>{derivedIndex=null;},resetStatus:()=>{},clearStatus:(_testId:any)=>{}};
root.ensureShape=(opts:Record<string,any>={})=>{
  const normalized=root.qcStateFoundation!(state,opts,{defaults:()=>({lab:{name:'',dept:'',address:''} as any,tests:[],machines:["Máy A"],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],data:{},actions:[],activity:[],activityAnchor:'',users:[],reagentTests:[],reagentOperators:[],reagentSampleTypes:['Mẫu bệnh nhân','Mẫu nội kiểm (IQC)','Mẫu ngoại kiểm (EQA)'],sigmaData:{},periodLocks:[],teaRefs:[],teaRegistryVersion:TEA_REFERENCE_SCHEMA_VERSION,westgardRules:{...WG_DEFAULT}}),sanitize:(value:any)=>(root.QCCore as any).sanitizeBackup(value),schemaVersion:STATE_SCHEMA_VERSION,teaRegistryVersion:TEA_REFERENCE_SCHEMA_VERSION,westgardDefaults:WG_DEFAULT});
  state=normalized.state;
  return root.qcStateLifecycle!(state,{ensureLab:root.ensureLabBrandShape,ensureConfiguration:ensureConfigurationShape,repairRanges:repairAppliedRangeLimits,ensureReagent:(source:any)=>{root.ReagentComparisonService.ensureOne(source,{id:uid()});},reconcileSigma:reconcileSigmaLevelsWithLotGroups,reconcileTea:()=>{if(typeof (root as any).sgReconcileAllTeaSnapshots==='function')(root as any).sgReconcileAllTeaSnapshots();},normalizePointLots,pruneUnusedLevels:pruneUnusedTestLevels});
};
root.pruneUnusedTestLevels=()=>root.qcLevelReconciliation!.pruneUnused(state);
root.repairAppliedRangeLimits=()=>root.qcRangeLimitRepair!(state);
root.uid=()=>Math.random().toString(36).slice(2,9);
root.reconcileSigmaLevelsWithLotGroups=()=>root.qcLevelReconciliation!.reconcileSigma(state);
root.ensureConfigurationShape=()=>{
  const migrateLegacyLots=!state.configMigrationVersion;
  state.instruments=state.instruments||[];state.assayGroups=state.assayGroups||[];state.qcPanels=state.qcPanels||[];state.lotTransitions=state.lotTransitions||[];state.lotGroups=state.lotGroups||[];state.qcLots=state.qcLots||[];
  root.qcTestConfiguration!(state,migrateLegacyLots,{uid,searchText,teaKey:teaAnalyteKey,builtInMeta:teaAnalyteBuiltInMeta,metaById:teaAnalyteMetaById,meta:teaAnalyteMeta,dedupeHistory:dedupeLotTargetHistory});
  root.qcConfigurationRelations!(state,{uid,switchesLot:transitionSwitchesLot,applyAcceptedTransition:applyAcceptedLotTransitionToConfig,normalizeLotGroups,syncLotDepletion:syncLotDepletionFromTransitions});
  state.configMigrationVersion=1;
};
root.transitionSwitchesLot=tr=>root.ManageConfigService.transitionSwitchesLot(tr);
root.syncLotDepletionFromTransitions=()=>root.ManageConfigService.syncLotDepletion(state as any);
root.dedupeLotTargetHistory=target=>root.qcLotTargetHistory!.dedupe(target);
root.upsertLotTargetHistory=(target,lot,values)=>root.qcLotTargetHistory!.upsert(target,lot,values);
root.inspectAcceptedLotTransition=tr=>{
  const check=root.ManageConfigService.inspectAcceptedLotTransition(state as any,tr);
  return{from:check.from,to:check.to,panel:check.panel,rows:check.rows.map((x:any)=>({t:x.test,cfg:x.config,nextHist:x.nextHistory})),missing:check.missing.map((x:any)=>({t:x.test,cfg:x.config,nextHist:x.nextHistory})),valid:check.valid};
};
root.applyAcceptedLotTransitionToConfig=tr=>{
  return root.ManageConfigService.applyAcceptedLotTransition({state:state as any,transition:tr,uid,today:isoToday,normalizeLotGroups,upsertHistory:upsertLotTargetHistory,onMergeGroup:(oldGroup:any,nextGroup:any)=>{try{if(typeof manageTargetGroup!=='undefined'&&manageTargetGroup===oldGroup.id)manageTargetGroup=nextGroup.id;}catch(e){/* biến UI tùy chọn — trang Cấu hình chung có thể chưa render */}}});
};
root.normalizeLotGroups=()=>root.ManageConfigService.normalizeLotGroups(state as any,(removed:any,kept:any)=>{try{if(typeof manageTargetGroup!=='undefined'&&manageTargetGroup===removed.id)manageTargetGroup=kept;}catch(e){/* biến UI tùy chọn — trang Cấu hình chung có thể chưa render */}});
root.clearDerived=()=>root.derivedCacheInvalidation!.clearAll();
root.clearDerivedForTest=testId=>root.derivedCacheInvalidation!.clearForTest(testId);
root.userName=()=>currentUser?(currentUser.name||currentUser.username||'Người dùng'):'Hệ thống';
root.staffInitials=name=>root.qcStaffIdentity!.initials(name);
root.currentStaff=()=>{const name=userName();return{operatorId:currentUser&&currentUser.id||'',operatorUsername:currentUser&&currentUser.username||'',operatorName:name,operatorCode:currentUser&&currentUser.initials||staffInitials(name)};};
root.pointStaff=p=>root.qcStaffIdentity!.point(p);
root.dateObj=s=>root.qcDateFormat!.dateObject(s);
root.daysToExp=exp=>root.qcDateFormat!.daysToExpiry(exp);
root.fmt=(x,d=2)=>root.qcBasicFormat!.number(x,d);
root.QC_DECIMALS_DEFAULT=2;
root.QC_DECIMALS_MAX=6;
root.QC_STAT_EXTRA_DECIMALS=2;
root.qcValueDecimals=value=>root.qcValueFormat!.qcValueDecimals(value);
root.testDecimalPlaces=(test,point=null)=>root.qcValueFormat!.testDecimalPlaces(test,point);
root.testStatDecimals=test=>root.qcValueFormat!.testStatDecimals(test);
root.fmtTestValue=(test,value,point=null)=>root.qcValueFormat!.formatValue(test,value,point);
root.fmtTestStat=(test,value)=>root.qcValueFormat!.formatStat(test,value);
root.fmtPointValue=(point,test=null)=>root.qcValueFormat!.formatPoint(point,test);
root.isoDate=(d=new Date())=>root.qcDateFormat!.isoDate(d);
root.isoToday=()=>root.qcDateFormat!.isoToday();
root.isoMonth=()=>root.qcDateFormat!.isoMonth();
root.requireUnlockedPeriod=async(date,action='sửa dữ liệu QC')=>{
  const ym=root.PeriodService.periodForDate(date),lock=ym?root.PeriodService.findLock(state as any,ym):null;if(!lock)return true;
  const text=`Kỳ ${monthVN(ym)} đã chốt bởi ${lock.lockedBy||'hệ thống'}${lock.lockedAt?' lúc '+formatDateTimeVN(lock.lockedAt):''}.`;
  await root.infoDialog(`Không thể ${action}: ${text} Muốn thay đổi cần admin mở khóa kỳ và ghi lý do.`);return false;
};
root.vnDate=s=>root.qcDateFormat!.vnDate(s);
root.vnPeriod=s=>root.qcDateFormat!.vnPeriod(s);
root.monthVN=s=>root.qcDateFormat!.monthVN(s);
root.formatDateTimeVN=s=>root.qcDateFormat!.formatDateTimeVN(s);
root.safeName=s=>root.qcBasicFormat!.safeName(s);

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
/* ===== LOCAL STORAGE — pipeline bền vững dữ liệu cục bộ ===== Retire classic
   state-storage.js (2026-08-20, Pha G nhóm C lát 4) — mọi hàm bên dưới vốn đã
   chỉ gọi thẳng service TypeScript đã có sẵn (storageLifecycleService/
   indexedDbMirrorService/storageSerializePolicy/localSaveScheduler/
   storageSnapshotService/saveService/sigmaDraftService/corruptLocalQuarantine —
   construct ngay bên dưới/gần đây), không có logic mới. `SIGMA_DRAFT_KEY` và
   `lsClock()` của bản classic KHÔNG mang sang — xác nhận bằng rg không còn
   caller nào (kể cả trong chính file cũ): `SIGMA_DRAFT_KEY` là hằng số không ai
   dùng (khóa localStorage thật nằm trong `sigmaDraftService`), `lsClock()`
   không được gọi ở đâu.
   HỢP ĐỒNG BỀ MẶT (ai được gọi gì):
   - app.js (boot): await loadBootState() trước khi ensureAdmin/showLogin, SAU ĐÓ
     phải await storageHydrationPromise rồi mới initFirebase/showStartupRecovery.
   - doLogin(): await storageHydrationPromise trước khi cho người dùng vào app.
   - Mọi module nghiệp vụ: save(opts) sau mỗi thay đổi state — opts:
     {testId|testIds} ghi tăng dần đúng các test đó; {sigmaTestId} kèm nháp Sigma
     đồng bộ bắc cầu reload; {clearDerived:false} giữ cache dẫn xuất; {cloud:false}
     chỉ lưu cục bộ, không đẩy Firebase.
   - firebaseLocalStoreService: persistLocalSnapshot({changed:true,quiet:true})
     sau khi merge từ cloud; clearSigmaDraftThrough(stamp) khi cloud đã ack;
     mirrorIndexedDb(raw) ở đường legacy.
   - Trang tự gọi: lsFlush() qua beforeunload/pagehide/visibilitychange.
   BOOT HAI PHA (hợp đồng quan trọng): loadBootState() có thể trả true khi mới
   đọc được boot shell — state.data đang RỖNG, localLoadStatus='partition-shell',
   dữ liệu thật nạp nền qua storageHydrationPromise. Trong cửa sổ đó mọi lần ghi
   bị HOÃN (persistLocalSnapshot tự giữ lsDirty và hẹn lại) để không cắt manifest
   của slot đang hoạt động; hydrate xong tự xả các lần ghi dồn. Người gọi chỉ cần
   await storageHydrationPromise, không cần xử lý gì thêm.
   BẢO ĐẢM: mọi state nạp từ ngoài đều qua adoptValidatedState() (validate →
   sanitize → ensureShape → invariant); ghi thất bại luôn tự retry backoff mũ
   (chặn 30s) tới khi thành công; ghi tăng dần bị gián đoạn bị readPartitionSlot()
   loại bỏ nhờ lệch savedAt manifest, quay về slot an toàn.
   `localLoadStatus`/`partitionSlot`/`lsSaveT`/`lsDirty`/`lsFullDirty`/
   `lsDirtyTestIds`/`lsRevision`/`lsSerializeCount`/`lsSaveFailures`/
   `partitionWrite`/`lsIncrementalStreak`/`lsLastFullSaveAt`/
   `LS_FULL_ROTATE_MAX_INCREMENTALS`/`LS_FULL_ROTATE_MAX_MS` là `root.X` (data
   property), KHÔNG phải `let` — không chỉ vì test vm sandbox gán bare các tên
   này từ NGOÀI (giống lý do currentUser/auditQ/fb đã tách nền), mà vì
   storageSnapshotService/saveService/storageLifecycleService/
   indexedDbMirrorService NGAY BÊN DƯỚI/TRƯỚC đã đọc/ghi các tên này TRẦN từ
   TRƯỚC LÁT NÀY, dựa vào `let` cũ của classic state-storage.js chia sẻ qua
   global lexical scope giữa các classic script — những dòng đó GIỮ NGUYÊN
   không đổi, vì bare read/write vẫn phân giải đúng qua thuộc tính global, y hệt
   cơ chế đã dùng cho `state`/`mem`/`fb`. `lsIdleHandle`/`lsSerializedRevision`/
   `lsSerialized`/`lsLastBytes`/`lsLastSerializeMs` giữ `let` cục bộ — chỉ dùng
   nội bộ trong các hàm port ở đây, không nơi nào khác đọc trần. */
root.localLoadStatus = 'missing';
root.storageHydrationPromise = Promise.resolve(true);
root.partitionSlot = '';
root.sigmaDraftRecord = () => root.sigmaDraftService!.read();
root.sigmaDraftStamp = () => root.sigmaDraftService!.stamp();
root.persistSigmaDraft = testId => root.sigmaDraftService!.persist(testId, state.sigmaData, typeof fbDataPath === 'function' ? fbDataPath() : '');
root.clearSigmaDraftThrough = stamp => root.sigmaDraftService!.clearThrough(stamp);
root.sigmaDraftNeedsCloud = () => { try { const cfg = typeof getFbCfg === 'function' ? getFbCfg() : null; return !!(cfg && cfg.config); } catch (e) { return false; } };
root.recoverPendingSigmaDraft = () => {
  const draft = sigmaDraftRecord(); if (!draft) return false;
  const savedAt = Number(draft.savedAt || 0);
  if (!savedAt) return false;
  try {
    const merged = { ...(state.sigmaData || {}), ...draft.branches }, clean = (root.QCCore as any).sanitizeBackup({ tests: state.tests || [], data: {}, sigmaData: merged }, { owned: true });
    state.sigmaData = clean.sigmaData || {}; (globalThis as any).reconcileSigmaLevelsWithLotGroups();
    lsRevision++; lsDirty = true; lsFullDirty = true;
    if (typeof fb !== 'undefined' && (!draft.path || typeof fbDataPath !== 'function' || draft.path === fbDataPath())) fb.dirty = true;
    return true;
  } catch (e) { return false; }
};
root.quarantineCorruptLocal = (raw, error) => { try { localStorage.setItem('qclab_corrupt', JSON.stringify(root.corruptLocalQuarantine!(raw, error))); } catch (e) { /* mất khả năng ghi localStorage thì bỏ qua, không chặn boot */ } };
/* Phễu chuẩn hóa MỌI state nạp từ ngoài (localStorage/IndexedDB/boot shell):
   validate → sanitize → ensureShape → kiểm invariant, ném Error khi không qua.
   Gán thẳng vào `state` toàn cục — caller tự chịu mem/partitionSlot/
   localLoadStatus/startupProblem theo ngữ cảnh của mình. */
root.adoptValidatedState = parsed => root.storageLifecycleService!.adopt(parsed);
root.load = () => root.storageLifecycleService!.load();
root.hydratePartitionedState = async () => root.storageLifecycleService!.hydratePartitioned();
root.restoreFromIndexedDb = async () => root.storageLifecycleService!.restoreFromIndexedDb();
root.loadBootState = async () => root.storageLifecycleService!.loadBootState();
root.mirrorIndexedDb = raw => root.indexedDbMirrorService!.mirror(raw, state);
root.lsSaveT = null; root.lsIdleHandle = null; root.lsDirty = false; root.lsFullDirty = false; root.lsDirtyTestIds = new Set();
root.lsRevision = 0; root.lsSerializedRevision = -1; root.lsSerialized = ''; root.lsLastBytes = 0; root.lsLastSerializeMs = 0; root.lsSerializeCount = 0; root.lsSaveFailures = 0;
root.partitionWrite = Promise.resolve();
/* Ghi tăng dần (incremental) chỉ đè shell + các test đổi NGAY TRÊN slot đang hoạt
   động — khác với ghi đầy đủ (xoay sang slot còn lại, slot cũ giữ nguyên làm lưới
   an toàn). Nếu một lần ghi tăng dần bị gián đoạn giữa lúc ghi xong dữ liệu và lúc
   cập nhật manifest, readPartitionSlot() phát hiện lệch savedAt và bỏ NGUYÊN CẢ
   SLOT — quay về slot kia từ lần xoay vòng đầy đủ gần nhất, tức mất luôn MỌI lần
   ghi tăng dần đã thành công kể từ đó (không chỉ lần đang dở), vì bản thân việc
   ghi tăng dần đã ghi đè mất nội dung shell/partition cũ. Một ngày làm việc bình
   thường (lưu theo từng xét nghiệm) có thể toàn ghi tăng dần nhiều ngày liền không
   có lần xoay vòng đầy đủ nào — nếu đúng lúc đó app tắt đột ngột, cửa sổ mất dữ
   liệu không còn là "1 lần lưu" mà là "từ lần xoay vòng đầy đủ gần nhất tới giờ".
   Giảm nhẹ: ép một lần ghi ĐẦY ĐỦ định kỳ (xoay slot) sau một số lần ghi tăng dần
   liên tiếp hoặc sau một khoảng thời gian, để giới hạn cửa sổ rủi ro thay vì để
   không giới hạn. Không xóa được rủi ro (ghi tăng dần vẫn có thể bị gián đoạn),
   chỉ giới hạn thiệt hại tối đa. */
root.lsIncrementalStreak = 0; root.lsLastFullSaveAt = typeof Date !== 'undefined' ? Date.now() : 0;
root.LS_FULL_ROTATE_MAX_INCREMENTALS = 25; root.LS_FULL_ROTATE_MAX_MS = 10 * 60 * 1000;
root.serializeStateForStorage = () => {
  const raw = root.storageSerializePolicy!.serialize(state, lsRevision), s = root.storageSerializePolicy!.stats();
  lsLastSerializeMs = s.ms; lsLastBytes = s.bytes; lsSerializeCount = s.count; lsSerialized = raw; lsSerializedRevision = lsRevision; return raw;
};
root.lsSaveDelay = () => root.storageSerializePolicy!.delay();
root.cancelLocalSaveSchedule = () => {
  root.localSaveScheduler!.cancel();
  clearTimeout(lsSaveT); lsSaveT = null;
  if (lsIdleHandle !== null && typeof cancelIdleCallback === 'function') cancelIdleCallback(lsIdleHandle);
  lsIdleHandle = null;
};
root.scheduleLocalSave = () => {
  cancelLocalSaveSchedule();
  root.localSaveScheduler!.schedule(lsSaveDelay(), () => { if (typeof requestIdleCallback === 'function') lsIdleHandle = requestIdleCallback(() => { lsIdleHandle = null; lsFlush(); }, { timeout: 1000 }); else lsFlush(); });
};
/* Ghi thất bại (IDB tạm lỗi, hết quota...) được hẹn thử lại với backoff mũ chặn
   ở 30s, thay vì treo lsDirty tới tận thao tác kế tiếp của người dùng. Ghi
   thành công reset lsSaveFailures về 0. */
root.scheduleLocalRetry = () => {
  cancelLocalSaveSchedule();
  const delay = root.storageRetryDelay!(lsSaveFailures);
  lsSaveT = setTimeout(() => { lsSaveT = null; lsFlush(); }, delay);
};
/* Một lần serialize dùng chung cho localStorage và IndexedDB. Snapshot lớn được
   debounce lâu hơn và ưu tiên idle time; pagehide/beforeunload vẫn xả ngay. */
root.persistLocalSnapshot = (opts = {}) => root.storageSnapshotService!.persist(opts);
root.lsFlush = () => persistLocalSnapshot();
root.invalidateDerivedForSave = (opts = {}) => {
  const ids = root.saveCommandPolicy!(opts).derivedTestIds;
  if (ids === null) return;
  if (ids.length) [...new Set(ids.filter(Boolean))].forEach(clearDerivedForTest); else clearDerived();
};
root.save = (opts = {}) => { root.saveService!.save(opts); };
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
  rejectedRead: () => { startupProblem = {raw:'',message:'Trình duyệt không cho phép đọc vùng lưu trữ cục bộ.'}; },
  rejectedInvalid: (raw, error) => { localLoadStatus = 'invalid'; quarantineCorruptLocal(raw, error); startupProblem = {raw,message:error && (error as Error).message ? (error as Error).message : 'Dữ liệu cục bộ không hợp lệ.'}; },
});
const modularLocalStorageSnapshotWriter = createLocalStorageSnapshotWriter({
  set: (key, value) => localStorage.setItem(key, value),
  remove: key => localStorage.removeItem(key),
  saved: quiet => { if (!quiet) markSaved('đã lưu cục bộ','Lúc '+saveTime()); },
  failed: quiet => { if (!quiet) markSaved('lỗi lưu cục bộ','Kiểm tra dung lượng trình duyệt'); },
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
    if (!input.quiet) markSaved('đã lưu cục bộ','IndexedDB phân vùng · Lúc '+saveTime());
  },
  failed: input => { lsDirty = true; lsFullDirty = true; lsSaveFailures++; scheduleLocalRetry(); if (!input.quiet) markSaved('lỗi lưu cục bộ','Không thể ghi IndexedDB phân vùng'); },
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
  beginLocalSave: () => { lsRevision++; lsDirty = true; markSaved('đang lưu','...'); scheduleLocalSave(); },
  scheduleCloud: () => { fb.dirty = true; scheduleFbPush(); },
});
root.firebaseLocalStoreService = createFirebaseLocalStoreService({
  persistSnapshot: () => { if (typeof persistLocalSnapshot !== 'function') return false; persistLocalSnapshot({changed:true,quiet:true}); return true; },
  serialize: value => JSON.stringify(value),
  writeLocal: raw => localStorage.setItem('qclab',raw),
  mirror: raw => { if (typeof mirrorIndexedDb === 'function') mirrorIndexedDb(raw); },
});
/* ===== FIREBASE ===== Retire classic firebase-sync.js (2026-08-20, Pha G nhom C lat 3) —
   moi ham duoi day von chi goi thang service TypeScript da co san (cac ham
   createSyncXxx/createFirebaseXxx construct rai rac trong file nay), khong co
   logic moi. CAC GUARD `if (typeof (root as any).fbDisconnect === 'function') root.X =
   create...` (va tuong tu cho fbFlushPush/syncNow/scheduleFbPush/fbHandleValue x5/
   fbRejectBrokenAudit/applyRemoteRender/initFirebase/setCloudStatus/markSaved/
   remoteRenderUnsafe/ensureFirebaseApp/getDeployFbCfg — 17 diem tren 13 ten) DA BI
   GO PHIA DUOI — day la bay "eager guard" giong het bay cua local-store.js (Ha
   tang lat 1, xem migration plan): guard do CHI dung nho firebase-sync.js truoc
   day nap TRUOC bundle trong index.html nen ham classic da ton tai luc guard
   chay; nhung MOI dependency closure ben trong deu la lazy (goi ten tran LUC
   GOI, khong phai luc dinh nghia service). Gop het vao CUNG mot script thi guard
   se vinh vien sai (ham port o day luon dung SAU nhung dong do trong thu tu file)
   → toan bo cac service Firebase se cau bat thanh no-op im lang. Xoa guard, xay
   dung vo dieu kien, dung y het kieu da lam voi LocalStore. */
/* `uid()` là hàm classic của state.js — một số sandbox test chỉ nạp bundle mà
   không nạp state.js (chỉ cần view-model/presentation thuần), nên phải tự
   phòng vệ ở đây thay vì gọi bare uid() ngay lúc module nạp. */
root.fb = { ready: false, initialized: false, ref: null, dirty: false, clientId: 'c_' + (typeof uid === 'function' ? uid() : Math.random().toString(36).slice(2, 9)), authUser: null, pendingRenderT: null, pullT: null, seenSig: null, synced: null, retryT: null, retryMs: 1000 };
root.fbSaveT = null;
root.fbClone = v => root.syncValueCodec!.clone(v);
root.fbCanWrite = () => root.firebaseConnectionGate!.canWrite(fb);
root.fbNetworkOnline = () => root.firebaseConnectionGate!.networkOnline(typeof navigator === 'undefined' ? undefined : navigator.onLine);
root.fbResetRetry = () => { const next = root.syncRetryScheduler!.reset({ timer: fb.retryT, delay: fb.retryMs }); fb.retryT = next.timer; fb.retryMs = next.delay; };
root.fbScheduleRetry = () => { const next = root.syncRetryScheduler!.schedule({ dirty: fb.dirty, writable: root.fbCanWrite(), online: root.fbNetworkOnline(), retry: { timer: fb.retryT, delay: fb.retryMs }, retryFn: () => { fb.retryT = null; root.fbFlushPush(); } }); fb.retryT = next.timer; fb.retryMs = next.delay; };
root.fbSetReady = () => { Object.assign(fb, root.firebaseReadyState!(fb)); };
root.fbStoreLocal = () => { root.firebaseLocalStoreService!.store(state); };
/* Có dữ liệu đáng để bảo vệ trước khi để cloud ghi đè hoàn toàn (lần nhận đầu tiên sau
   khi kết nối/đổi phòng — xem initFirebase()). Cố ý tính cả các danh mục cấu hình
   (instruments/qcPanels/lotGroups/qcLots/assayGroups), không chỉ tests/data/actions —
   máy mới cấu hình xong danh mục nhưng chưa kịp nhập QC vẫn có dữ liệu cần hỏi trước khi
   mất, dù merger TypeScript đã hạ thấp rủi ro so với trước rất nhiều. */
root.hasLocalQcContent = s => root.syncHasContent!(s);
root.fbSyncedShape = s => root.syncedShape!(s, root.syncCompareKeys!);
root.statesLikelyEqual = (a, b) => root.syncedStatesEqual!(a, b, root.syncCompareKeys!);
root.fbSyncedSnapKeys = s => root.syncUpdateBuilder!.baseSnapshot(s);
/* So sánh state hiện tại với baseline thô (fb.synced) để chỉ đẩy đúng các nhánh đã
   thay đổi. Việc đẩy lên cloud vẫn theo cấp xét nghiệm (data/{testId} nguyên khối) —
   chỉ phần TRỘN khi nhận dữ liệu về (fbMerge) mới đi sâu tới từng điểm. */
root.fbBuildUpdate = cur => root.syncUpdateBuilder!.build(cur, fb.synced);
root.fbHasLocalChanges = () => root.syncUpdateBuilder!.hasChanges(state, fb.synced);
root.fbMerge = (local, remote, base) => root.syncStateMerge!(local, remote, base);
root.fbFirstConnectMerge = (local, remote) => root.syncFirstConnectMerge!(local, remote);
root.saveLabel = 'Cục bộ'; root.saveDetail = '';
root.getDeployFbCfg = () => root.firebaseConfigSourceService!.deploy();
root.getStoredFbCfg = () => root.firebaseConfigSourceService!.stored();
root.getFbCfg = () => root.firebaseConfigSelection!.select(root.getDeployFbCfg(), root.getStoredFbCfg());
root.fbConfigSig = cfg => root.firebaseConfigSelection!.signature(cfg);
root.ensureFirebaseApp = async cfg => root.firebaseAppService!.ensure(cfg);
root.setCloudStatus = (t, on) => { root.firebaseCloudStatusPresentation!.set(t, on); };
root.saveTime = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
root.updateSaveStatus = () => { const el = document.getElementById('saveStatus'); if (el) el.innerHTML = `Lưu trữ: <b>${saveLabel}</b>${saveDetail ? `<br>${saveDetail}` : ''}`; };
root.markSaved = (label, detail) => { root.firebaseSaveStatusService!.mark(label, detail || ''); };
root.fbDataPath = () => root.firebaseIdentity!.dataPath(root.getFbCfg() || {});
root.fbStatusLabel = () => root.firebaseIdentity!.statusLabel(root.getFbCfg() || {}, fb.authUser || {});
root.fbRejectBrokenAudit = (source, result) => root.firebaseAuditRejectionService!.reject(source, result);
root.fbAuditMaySync = (snapshot, source) => { const result = root.firebaseAuditGate!(snapshot); return result.ok || root.fbRejectBrokenAudit(source, result); };
root.fbStopPull = () => { fb.pullT = root.firebasePollingService!.stop(fb.pullT); };
root.fbStartPull = () => { fb.pullT = root.firebasePollingService!.start(fb.pullT, root.fbPullOnce, 8000); };
/* Điểm dừng chung mỗi khi ngắt/đổi kết nối Firebase (hủy đồng bộ, đổi phòng, mất xác
   thực, lỗi đọc...): dừng poll, gỡ listener cũ, và reset toàn bộ cờ vòng đời để lần
   kết nối sau (nếu có) bắt đầu từ trạng thái sạch, không kế thừa fb.ref/fb.initialized
   còn sót lại từ phiên trước. */
root.fbDisconnect = clearAuthUser => root.firebaseDisconnectService!.disconnect(!!clearAuthUser);
root.fbPullOnce = async () => root.firebasePullService!.pull(fb);
/* Pha H lát 2 (2026-08-20): gom cả 6 đăng ký window/document listener top-level
   (flush lưu cục bộ khi thoát trang ở trên, Firebase khi mạng/tiêu điểm đổi ở
   đây) vào createAppBootstrap() — src/presentation/app/app-bootstrap.ts — một
   lần duy nhất, thay vì hai khối `if(typeof window...)` rải cách nhau ~150
   dòng. Dependency bọc lazy vì `scheduleFbPush` chỉ construct muộn hơn (dưới
   ~60 dòng nữa) — closure đọc root.X lúc SỰ KIỆN THẬT nổ ra, không phải lúc
   dòng này chạy, nên thứ tự construct không quan trọng (giống mọi service
   khác trong file này). */
let bootstrapWindow: Window | undefined;
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') bootstrapWindow = window;
let bootstrapDocument: Document | undefined;
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') bootstrapDocument = document;
const appBootstrap = createAppBootstrap({
  window: bootstrapWindow,
  document: bootstrapDocument,
  lsFlush: () => root.lsFlush!(),
  fbPullOnce: () => root.fbPullOnce!(),
  scheduleFbPush: () => root.scheduleFbPush!(),
  markSaved: (label, detail) => root.markSaved!(label, detail),
  isDirty: () => fb.dirty,
  onPopState: () => root.goFromHistory!(root.pageFromUrlHash!()),
});
appBootstrap.run();
/* Pha H2 lát cuối (2026-08-20): chuyển khối <script> nội tuyến trong
   index.html (Electron only — window.qcDialog do electron/preload.js cấp)
   vào đây, để bỏ được script-src 'unsafe-inline'. Không đổi hành vi: no-op
   trong trình duyệt thường (python -m http.server), nơi window.qcDialog
   không tồn tại. confirm() không có ai gọi trực tiếp nữa (xem modals.js cũ,
   nay là dialog-overlay-controller.ts's confirmDialog()) nên không override
   ở đây. */
if (typeof window !== 'undefined' && (window as any).qcDialog) {
  window.alert = (message?: any) => (window as any).qcDialog.alert(message);
}
let fbConflictDialogOpen = false;
root.fbHandleValue = async (v, opts: Record<string, any> = {}) => {
  const sig = root.syncSnapshotSignature!(v);
  const gate = root.firebaseSnapshotGate!(fb.seenSig, sig); if (!gate.handle) return; fb.seenSig = gate.seenSignature;
  if (!v) {
    return root.firebaseEmptySnapshotService!.handle({ initialized: fb.initialized, dirty: fb.dirty, hasLocalContent: root.hasLocalQcContent(state), silent: !!opts.silent });
  }
  const remoteSnapshot = root.firebaseRemoteSnapshot!(v), cloudErrors = remoteSnapshot.errors;
  if (cloudErrors.length) {
    return root.firebaseInvalidSnapshotService!.handle(cloudErrors[0]);
  }
  const remote = remoteSnapshot.remote, base = fb.synced;
  /* Xac minh TUNG chuoi goc truoc khi merge/relink. Neu relink truoc, mot payload
     da bi sua co the duoc bam lai thanh chuoi "hop le" va mat dau vet hong ban dau. */
  if (!root.fbAuditMaySync(remote, 'Nhật ký trên đám mây')) return;
  if (!root.fbAuditMaySync(state, 'Nhật ký cục bộ')) return;
  // Bỏ qua chính bản ghi do máy này vừa đẩy lên (chống tự dội: mất focus/nháy màn hình),
  // nhưng vẫn đánh dấu snapshot đầu tiên đã tải để các lần lưu sau mới được push.
  if (root.firebaseOwnSnapshotPlan!(v, fb.clientId).own) {
    return root.firebaseOwnSnapshotService!.handle(remote, !!opts.silent);
  }
  const hadLocalChanges = fb.dirty;
  const firstConnectPlan = root.firebaseFirstConnectPlan!(base, hadLocalChanges, root.hasLocalQcContent(state), root.statesLikelyEqual(state, remote));
  let mergeFirstConnect = firstConnectPlan.mergeFirstConnect;
  if (firstConnectPlan.confirmConflict) {
    // Một hộp thoại xung đột tại một thời điểm: nếu snapshot mới tới trong lúc
    // hộp thoại trước đang chờ người dùng trả lời thì bỏ qua, không mở chồng.
    if (fbConflictDialogOpen) return;
    fbConflictDialogOpen = true;
    const proceed = await root.firebaseConflictDialogService!.ask((root.getFbCfg() || {}).labCode || 'default');
    fbConflictDialogOpen = false;
    if (!proceed) {
      root.fbDisconnect(false);
      root.setCloudStatus('Đã hủy kết nối để bảo vệ dữ liệu cục bộ', false);
      root.markSaved('cục bộ', 'Đã hủy đồng bộ — dữ liệu cục bộ được giữ nguyên');
      return;
    }
    if (typeof clearSigmaDraftThrough === 'function') clearSigmaDraftThrough(Number.MAX_SAFE_INTEGER);
    mergeFirstConnect = false; // trung tâm thắng hoàn toàn — không gộp mục riêng của máy này
  }
  fb.dirty = false;
  return root.firebaseMergeCommitService!.commit({ base, mergeFirstConnect, remote, hadLocalChanges });
};
root.initFirebase = async () => {
  const cfg = root.getFbCfg();
  if (!cfg || !cfg.config) { root.setCloudStatus('Đang chạy cục bộ', false); return; }
  if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function') { root.setCloudStatus('Thiếu Firebase Authentication', false); return; }
  return root.firebaseSessionStartService!.start(cfg);
};
/* Không vẽ lại toàn trang khi người dùng đang thao tác dở (đang mở modal hoặc đang gõ trong ô nhập),
   để dữ liệu đồng bộ từ máy khác không xóa mất nội dung đang nhập. Hoãn lại rồi tự áp dụng sau. */
root.remoteRenderUnsafe = () => root.firebaseRemoteRenderSafetyService!.unsafe();
root.applyRemoteRender = () => { root.firebaseRemoteRenderService!.apply(); };
/* Đẩy TOÀN BỘ khi thiết lập lần đầu: nếu cloud chưa có dữ liệu,
   tạo bản cloud từ dữ liệu hiện tại của máy này. */
root.syncNow = async () => root.firebaseFullSyncService!.sync(fb);
/* Đẩy NỀN theo từng nhánh (dùng cho mọi lần lưu tự động): chỉ gửi nhánh đã đổi
   -> nhẹ hơn (không kéo lại logo/toàn bộ nhật ký) và không đè nhánh máy khác đang sửa. */
root.scheduleFbPush = () => { fbSaveT = root.firebasePushScheduler!.schedule(fb, fbSaveT); };
root.fbFlushPush = async () => { fbSaveT = null; return root.firebasePushService!.flush(fb); };
root.firebaseDisconnectService = createFirebaseDisconnectService({
  stopPolling: () => fbStopPull(),
  cancelPendingPush: () => { if (fbSaveT) { clearTimeout(fbSaveT); fbSaveT = null; } },
  resetRetry: () => fbResetRetry(),
  detachListener: () => { if (fb.ref) fb.ref.off(); },
  resetSession: clearAuthUser => {
    Object.assign(fb,firebaseDisconnectedState(fb,clearAuthUser));
  },
});
root.firebasePushService = createFirebasePushService({
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
root.firebaseFullSyncService = createFirebaseFullSyncService({
  canSync: () => fbCanWrite(),
  auditMaySync: () => fbAuditMaySync(state,'Nhật ký cục bộ'),
  prepare: () => { mem=state;state._ts=Date.now();state._client=fb.clientId;return {payload:fbClone(state),draftStamp:typeof sigmaDraftStamp==='function'?sigmaDraftStamp():0}; },
  beforeWrite: () => markSaved('đang đồng bộ','Firebase'),
  write: (ref,payload) => ref.set(payload),
  succeeded: (payload,draftStamp) => { fb.synced=payload;fb.dirty=false;markSaved('đã đồng bộ','Lúc '+saveTime());if(typeof clearSigmaDraftThrough==='function')clearSigmaDraftThrough(draftStamp);fbStoreLocal(); },
  failed: () => markSaved('lỗi đồng bộ','Dữ liệu cục bộ vẫn còn'),
});
root.firebasePushScheduler = createFirebasePushScheduler({
  canWrite: () => fbCanWrite(),
  networkOnline: () => fbNetworkOnline(),
  resetRetry: () => fbResetRetry(),
  clearTimer: timer => clearTimeout(timer),
  setTimer: (fn,delay) => setTimeout(fn,delay),
  flush: () => fbFlushPush(),
  offline: () => markSaved('cục bộ','Mạng ngoại tuyến · sẽ tự đồng bộ khi có mạng'),
  queued: () => markSaved('chờ đồng bộ','Firebase'),
});
root.firebaseEmptySnapshotService = createFirebaseEmptySnapshotService({
  setReady: () => fbSetReady(),
  clearSynced: () => { fb.synced=null; },
  connected: () => setCloudStatus(fbStatusLabel(),true),
  schedulePush: () => scheduleFbPush(),
  readyWithoutPush: () => markSaved('đám mây','Sẵn sàng đồng bộ · '+fbDataPath()),
});
root.firebaseOwnSnapshotService = createFirebaseOwnSnapshotService({
  setReady: () => fbSetReady(),
  setBaseline: remote => { fb.synced=remote; },
  clearDirty: () => { fb.dirty=false; },
  resetRetry: () => fbResetRetry(),
  connected: () => setCloudStatus(fbStatusLabel(),true),
  synchronized: () => markSaved('đã đồng bộ','Lúc '+saveTime()),
});
root.firebaseInvalidSnapshotService = createFirebaseInvalidSnapshotService({
  setReady: () => fbSetReady(),
  report: firstError => markSaved('dữ liệu đám mây không hợp lệ',firstError+' · '+fbDataPath()),
});
root.firebaseAuditRejectionService = createFirebaseAuditRejectionService({
  disconnect: () => fbDisconnect(),
  disconnected: () => setCloudStatus('Đã ngắt đồng bộ để bảo vệ nhật ký',false),
  report: detail => markSaved('audit không hợp lệ',detail),
});
root.firebaseRemoteRenderService = createFirebaseRemoteRenderService({
  loggedIn: () => typeof currentUser !== 'undefined' && !!currentUser,
  focusLogin: () => { if(typeof focusLoginField==='function'){try{focusLoginField();}catch{}} },
  unsafe: () => remoteRenderUnsafe(),
  clearPending: () => clearTimeout(fb.pendingRenderT),
  defer: (fn,delay) => { fb.pendingRenderT=setTimeout(fn,delay); },
  received: () => markSaved('đã nhận đồng bộ','Lúc '+saveTime()),
  deferred: () => markSaved('có dữ liệu mới','Sẽ hiển thị khi bạn xong thao tác'),
  rerender: () => rerender(),
});
root.firebaseSessionStartService = createFirebaseSessionStartService({
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
root.firebaseMergeCommitService = createFirebaseMergeCommitService({
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
root.firebaseConflictDialogService = createFirebaseConflictDialogService(options => root.confirmDialog(options));
root.firebaseCloudStatusPresentation = createFirebaseCloudStatusPresentation(id => document.getElementById(id));
root.firebaseSaveStatusService = createFirebaseSaveStatusService(id => document.getElementById(id));
root.firebaseRemoteRenderSafetyService = createFirebaseRemoteRenderSafetyService({
  modalOpen: () => { const modal=document.getElementById('modalRoot');return !!(modal&&modal.children&&modal.children.length); },
  editingFieldFocused: () => { const active=document.activeElement,main=document.getElementById('main');return !!(active&&main&&main.contains(active)&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)); },
});
root.firebaseAppService = createFirebaseAppService({sdk: () => firebase,signature: config => fbConfigSig(config)});
root.firebaseConfigSourceService = createFirebaseConfigSourceService({cloud: () => typeof window === 'undefined' ? undefined : (window as any).QCLAB_CLOUD,readStored: () => typeof localStorage === 'undefined' ? null : localStorage.getItem('qclab_fb')});
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
root.lisQueuePresentation = createLisQueuePresentation({test:id=>(state.tests||[]).find((test:any)=>test.id===id),formatTestValue:(test,value)=>(root as any).fmtTestValue(test,value),format:(value,decimals)=>(root as any).fmt(value,decimals),escape:value=>(root as any).esc(value),formatDateTime:value=>(root as any).formatDateTimeVN(value),testDisplayName:test=>typeof (root as any).testDisplayName==='function'?(root as any).testDisplayName(test):'',button:(label,action,variant)=>(root as any).btn(label,action,variant),emptyState:(title,message,action)=>(root as any).emptyState(title,message,action),modalCloseButton:action=>root.modalCloseButton(action)});
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
  rerender:()=>rerender(),
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
    firebaseRulesText:()=>root.settingsFirebaseRulesText!(),
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
/* Pha H2 (2026-08-20): gộp document.getElementById('logoFile').click() —
   trước là onclick nội tuyến gọi thẳng DOM, giờ chuyển qua action-dispatcher. */
root.brandPickLogo = () => { if (typeof document !== 'undefined' && typeof document.getElementById === 'function') (document.getElementById('logoFile') as HTMLElement | null)?.click(); };
/* Pha H2 nhóm (d) lát 4: thay mẫu lặp lại nhiều nơi
   onclick="document.getElementById('xxxErr').style.display='none'" — một
   wrapper chung cho mọi ô lý do/ghi chú tự ẩn thông báo lỗi field khi gõ lại. */
root.hideFieldError = (id: string) => { if (typeof document !== 'undefined' && typeof document.getElementById === 'function') { const e = document.getElementById(id) as HTMLElement | null; if (e) e.style.display = 'none'; } };
/* Cùng mẫu brandPickLogo ở trên nhưng tổng quát cho MỌI id — thay
   onclick="document.getElementById('xxx').click()" (nút "Chọn file..." kích
   hoạt input file ẩn) rải ở nhiều nơi khác nhau. */
root.clickElementById = (id: string) => { if (typeof document !== 'undefined' && typeof document.getElementById === 'function') (document.getElementById(id) as HTMLElement | null)?.click(); };
root.saveFb=settingsPageController.saveFb;
root.clearFb=settingsPageController.clearFb;
root.copyFirebaseRules=settingsPageController.copyFirebaseRules;
root.settingsModel=settingsPageController.settingsModel;
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
root.activityAuditPagination = activityAuditPagination;
root.activityAuditCsv = createActivityAuditCsv({
  formatDateTime: value => (globalThis as any).formatDateTimeVN(value), roleLabel: value => (globalThis as any).roleLabel(value),
});
root.updateActivityAuditDateRange = updateActivityAuditDateRange;
root.activityAuditFilterState = activityAuditFilterState;
root.activityAuditPageSizes = ACTIVITY_AUDIT_PAGE_SIZES;
root.activityAuditArchiveWindow = activityAuditArchiveWindow;
root.userListModel = userListModel;
root.reagentResultHtml = createReagentResultHtml();
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
    const message = kind === 'partitioned' ? 'Dữ liệu phân vùng IndexedDB không hợp lệ.' : 'Dữ liệu IndexedDB không hợp lệ.';
    startupProblem = {raw,message:error && (error as Error).message ? (error as Error).message : message};
    if (raw) startupProblem.raw = raw;
  },
});
const modularPartitionHydrationService = createPartitionHydrationService({
  read: () => root.localStoreService!.readPartitioned(),
  adopt: value => (globalThis as any).adoptValidatedState(value),
  recoverPendingSigmaDraft: () => (globalThis as any).recoverPendingSigmaDraft(),
  accept: record => { mem = state; partitionSlot = String(record.slot || ''); localLoadStatus = 'partitioned'; clearDerived(); startupProblem = null; if (lsDirty) scheduleLocalSave(); },
  reportFailure: error => { startupProblem = {raw:'',message:error && (error as Error).message ? (error as Error).message : 'Không thể tải các phân vùng dữ liệu QC.'}; },
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
const modalTemplateApi=createModalTemplate({escapeAttr:value=>(root as any).escAttr(value)});
root.modalTemplate=modalTemplateApi.modalTemplate;root.modalCloseButton=modalTemplateApi.modalCloseButton;
/* openModal/closeModal retired sang React thật (Giai đoạn 3,
   ModalOverlay.tsx trong react-pilot.js) — #modalRoot giờ do MỘT React root
   sở hữu vĩnh viễn, giống #dialogRoot. openModal(html) giữ NGUYÊN chữ ký cũ
   (nhận chuỗi HTML) nên ~17 modal form chưa chuyển vẫn gọi được không cần
   sửa — ModalOverlay.tsx tự bơm chuỗi đó qua dangerouslySetInnerHTML cho
   tới lượt từng modal chuyển hẳn sang component thật (xem modal-store.ts).
   modal-controller.ts bị xóa cùng lát này (mọi consumer đã chuyển). */
root.openModal=html=>(window as any).QCLabReact.openModal(html);
root.closeModal=()=>(window as any).QCLabReact.closeModal();
/* confirmDialog/infoDialog/closeDialogOverlay retired sang React thật (Giai
   đoạn 3, DialogOverlay.tsx trong react-pilot.js) — #dialogRoot giờ do MỘT
   React root sở hữu vĩnh viễn (mount một lần lúc react-pilot.js chạy), nên
   không còn ai được phép tự tay r.innerHTML=... vào đó nữa (kể cả
   reauthenticateCurrentUser bên dưới — nó cũng đã chuyển hẳn sang React).
   dialog-overlay-controller.ts bị xóa cùng lát này (mọi consumer đã chuyển
   qua window.QCLabReact). */
root.closeDialogOverlay=result=>(window as any).QCLabReact.closeDialogOverlay(result);
root.confirmDialog=opts=>(window as any).QCLabReact.confirmDialog(opts);
root.infoDialog=(message,opts)=>(window as any).QCLabReact.infoDialog(message,opts);
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
root.qcReportCsvRows=createQcReportCsvRows({test:(id:any)=>(state.tests||[]).find((test:any)=>test.id===id),lab:()=>(state as any).lab||{},meta:(kind:any)=>(root as any).exportMetaRows(kind),range:(start:any,end:any)=>(root as any).reportRangeText(start,end),testName:(test:any)=>(root as any).testDisplayName(test),tea:(test:any)=>(root as any).sgTea(test),teaSource:(test:any)=>(root as any).sgTeaSource(test),teaLabel:(source:any)=>(root as any).sgTeaLabel(source),teaReference:(test:any)=>(root as any).sgTeaRefText(test),levels:(test:any)=>(root as any).operationalLevels(test),previous:(test:any,level:any)=>(root as any).previousLotSeries(test,level),rows:{previousLot:(t:any,s:any,inRange:any)=>(root.qcReportRowsService as any).previousLot(t,s,inRange),currentLot:(t:any,l:any,wg:any,inRange:any)=>(root.qcReportRowsService as any).currentLot(t,l,wg,inRange),actions:(tid:any,inRange:any)=>(root.qcReportRowsService as any).actions(tid,inRange)},westgard:(test:any)=>(root as any).activeWestgard(test),staff:(point:any)=>(root as any).pointStaff(point),date:(value:any)=>(root as any).vnDate(value),number:(value:any,decimals?:any)=>(root as any).fmt(value,decimals),state:(value:any)=>(root as any).stateName(value),error:(rules:any)=>(root as any).errorType(rules),stats:(points:any,mean:any,tea:any)=>(root as any).reportLevelStats(points,mean,tea),levelLabel:(test:any,level:any,lot:any)=>(root as any).actionLevelShort(test,level,lot),workflow:(action:any)=>(root as any).actionWorkflowStatus(action),rerun:(action:any)=>(root as any).actionRerunStatus(action),protocol:(action:any)=>(root as any).actionProtocolSummary(action),approval:(action:any)=>(root as any).actionApprovalLabel(action)});
root.installDerivedCacheInvalidation=legacy=>root.derivedCacheInvalidation=createDerivedCacheInvalidation({...legacy,resetQcDerivedIndex:()=>root.qcDerivedIndex?.clear(),pointCache:()=>root.qcPointCache,westgardCache:()=>root.westgardMemoCache,acceptedCache:()=>root.qcAcceptedMemoCache,cusumCache:()=>root.qcCusumMemoCache,invalidateWestgardWorker:(testId:unknown)=>(root as any).invalidateWestgardWorker(testId),invalidateActionCaches:(testId:unknown)=>(root as any).invalidateActionCaches(testId)} as any);
const legacyDerivedCacheState=(root as any).legacyDerivedCacheState;
if(legacyDerivedCacheState)root.installDerivedCacheInvalidation(legacyDerivedCacheState);
root.qcBasicFormat = createBasicFormat();
root.westgardRulePolicy=createWestgardRulePolicy({rules:(root.QCCore as any).WG_RULES,enabled:(rule:string)=>(root.QCCore as any).ruleEnabled((state as any).westgardRules,rule),levels:(test:any)=>(root as any).operationalLevels(test),resolveAction:(root.QCCore as any).resolveRuleAction,resolveScope:(root.QCCore as any).resolveRuleScope,onInScope:(root.QCCore as any).ruleOnInScope,verdict:(root.QCCore as any).ruleVerdictLevel});
root.westgardMemoCache=createWestgardMemoCache();
root.qcCusumMemoCache=createCusumMemoCache();
root.qcAcceptedMemoCache=createAcceptedMemoCache();
root.westgardRuleSettings=createWestgardRuleSettings({defaults:(root.QCCore as any).WG_DEFAULT_ON?Object.fromEntries((root.QCCore as any).WG_RULES.map((rule:string)=>[rule,(root.QCCore as any).WG_DEFAULT_ON.has(rule)])): {},getState:()=>state,ruleEnabled:(rules:any,rule:string)=>(root.QCCore as any).ruleEnabled(rules,rule),requireWrite:()=>requireWrite(),save:()=>save({}),rerender:()=>rerender()});

// Retire classic qc-domain.js (2026-08-20, Pha G nhóm C lát 5) — glue thuần quanh
// các service Westgard/QC domain đã construct ở trên (westgardRulePolicy/
// westgardRuleSettings/qcDerivedIndex/qcPointCache/qcActiveWestgard/…), không có
// logic mới. WG_WORKER_POINT_THRESHOLD của bản classic đã CHẾT (giá trị 3000 do
// createWestgardWorkerPrewarmPlanner(3000) ở trên nắm giữ) nên không port.
root.stats=vals=>root.QCCore!.stats(vals);
root.reportLevelStats=(pts,mean,teaVal)=>root.reportLevelStatsService!(pts,mean,teaVal);
root.wgOn=rule=>root.westgardRuleSettings!.enabled(rule);
root.wgSet=(rule,on)=>root.westgardRuleSettings!.set(rule,on);
root.wgReset=()=>root.westgardRuleSettings!.reset();
root.testLevelCount=t=>root.westgardRulePolicy!.levelCount(t);
root.defaultRuleAction=rule=>(root.QCCore as any).defaultRuleAction(rule,wgOn(rule));
root.testRuleAction=(t,rule)=>root.westgardRulePolicy!.action(t,rule);
root.testRuleOn=(t,rule)=>testRuleOnWithin(t,rule);
root.defaultRuleScope=(t,rule)=>(root.QCCore as any).defaultRuleScope(rule,testLevelCount(t));
root.testRuleScope=(t,rule)=>root.westgardRulePolicy!.scope(t,rule);
root.testRuleOnIn=(t,rule,channel)=>root.westgardRulePolicy!.onIn(t,rule,channel);
root.testRuleOnWithin=(t,rule)=>testRuleOnIn(t,rule,'within');
root.testRuleOnAcross=(t,rule)=>testRuleOnIn(t,rule,'across');
root.testRuleSet=(t,channel)=>root.westgardRulePolicy!.set(t,channel);
root.ruleResultLevel=(t,rules)=>root.westgardRulePolicy!.verdict(t,rules);
root.westgard=(points,mean,sd)=>(root.QCCore as any).westgard(points,mean,sd,wgOn);
root.westgardMulti=levelSets=>(root.QCCore as any).westgardMulti(levelSets,wgOn);
root.westgardByPoint=(points,mean,sd)=>(root.QCCore as any).westgardByPoint(points,mean,sd,wgOn);
root.westgardMultiByPoint=levelSets=>(root.QCCore as any).westgardMultiByPoint(levelSets,wgOn);
root.WG_RULE_DESCRIPTIONS=(root.QCCore as any).WG_RULE_DESCRIPTIONS;
root.primaryErrorRule=rules=>(root.QCCore as any).primaryErrorRule(rules);
root.errorType=rules=>(root.QCCore as any).errorType(rules);
root.fixHint=rules=>(root.QCCore as any).fixHint(rules);
root.errorTypeDetailParts=rules=>root.qcErrorDetail!(rules);

root.wgWorker=null;root.wgWorkerGeneration=0;root.wgWorkerRevisions=new Map();root.wgWorkerPending=new Map();root.wgWorkerFailed=false;root.wgWorkerRenderT=null;
root.westgardWorkerRevision=testId=>root.westgardWorkerRevisionService!.revision(wgWorkerRevisions,testId);
root.invalidateWestgardWorker=testId=>{
  if(testId){root.westgardWorkerRevisionService!.invalidateTest(wgWorkerRevisions,wgWorkerPending,testId);return;}
  wgWorkerGeneration=root.westgardWorkerRevisionService!.invalidateAll(wgWorkerRevisions,wgWorkerPending,wgWorkerGeneration);clearTimeout(wgWorkerRenderT);wgWorkerRenderT=null;
  if(wgWorker){try{wgWorker.terminate();}catch(e){/* worker đã chết hoặc chưa từng khởi tạo — bỏ qua */}wgWorker=null;}
};
root.westgardWorkerWorthwhile=tests=>root.westgardWorkerPrewarmPlanner!.worthwhile(typeof Worker==='function',wgWorkerFailed,tests,(t:any)=>(state.data?.[t.id]||[]).length);
root.westgardWorkerJob=(t,generation,revision=westgardWorkerRevision(t&&t.id))=>root.westgardWorkerJobBuilder!(t,generation,revision);
root.hydrateWestgardWorkerResult=message=>{
  if(!message||message.generation!==wgWorkerGeneration||(message.revision||0)!==westgardWorkerRevision(message.testId))return false;
  return root.westgardWorkerHydrate!(message,{test:(id:any)=>(state.tests||[]).find((test:any)=>test.id===id),levels:(test:any)=>operationalLevels(test),points:(test:any,level:any)=>operationalLotPoints(test,level),verdict:(test:any,rules:any)=>ruleResultLevel(test,rules),setMemo:(id:any,value:any)=>wgMemo.set(id,value)});
};
root.westgardWorkerReadyToRender=()=>operationalTests().every(t=>wgMemo.has(t.id));
root.westgardWorkerMessage=event=>{
  const message=event&&event.data;if(!message||message.generation!==wgWorkerGeneration)return;
  const revision=message.revision||0;if(revision!==westgardWorkerRevision(message.testId))return;
  root.westgardWorkerRevisionService!.settle(wgWorkerPending,message.testId,revision);
  if(message.type==='result')hydrateWestgardWorkerResult(message);
  else if(message.type==='error')wgWorkerFailed=true;
  if(typeof page!=='undefined'&&page==='dash'&&(wgWorkerFailed||westgardWorkerReadyToRender())){
    clearTimeout(wgWorkerRenderT);wgWorkerRenderT=setTimeout(()=>{wgWorkerRenderT=null;rerender();},0);
  }
};
root.ensureWestgardWorker=()=>{
  if(wgWorker)return wgWorker;if(typeof Worker!=='function'||wgWorkerFailed)return null;
  try{
    wgWorker=new Worker('assets/workers/westgard-worker.js?v=ts-nhom-d-worker-20260820-1');
    wgWorker.onmessage=westgardWorkerMessage;
    wgWorker.onerror=()=>{wgWorkerFailed=true;wgWorkerPending.clear();if(wgWorker){try{wgWorker.terminate();}catch(e){/* worker đã chết */}wgWorker=null;}if(typeof page!=='undefined'&&page==='dash')setTimeout(()=>rerender(),0);};
    return wgWorker;
  }catch(e){wgWorkerFailed=true;wgWorker=null;return null;}
};
root.scheduleWestgardPrewarm=tests=>{
  const missing=root.westgardWorkerPrewarmPlanner!.missing(tests,wgMemo);
  if(!missing.length||!westgardWorkerWorthwhile(missing))return false;
  const worker=ensureWestgardWorker();if(!worker)return false;
  const generation=wgWorkerGeneration;
  missing.forEach((t:any)=>{const revision=westgardWorkerRevision(t.id);if(!root.westgardWorkerRevisionService!.markPending(wgWorkerPending,t.id,revision))return;worker.postMessage(westgardWorkerJob(t,generation,revision));});
  return true;
};

root.normalizePointLots=()=>root.qcNormalizePointLots!(state);
root.normalizeDuplicateRunIds=()=>root.qcNormalizeDuplicateRunIds!(state);
root.derived=()=>root.qcDerivedIndex!(state);
root.pointsOf=(testId,level)=>root.qcPointCache!.points(testId,level);
root.pointsWithIndex=(testId,level)=>root.qcPointCache!.points(testId,level,true);
root.lvlCfg=(t,level)=>root.qcLevelConfig!(t,level);
root.pointsForLot=(testId,level,lot,withIndex=false)=>root.qcPointCache!.lot(testId,level,lot,withIndex);
root.activeLotPoints=(t,level,withIndex=false)=>{const l=lvlCfg(t,level);return l?pointsForLot(t.id,level,l.lot||'',withIndex):[];};
root.operationalPanelForTest=t=>t?derived().testPanel.get(t.id):null;
root.operationalTestOrder=t=>t&&derived().testOrder.has(t.id)?derived().testOrder.get(t.id):999999;
root.isOperationalLotGroup=g=>root.qcLotGroupOperational!(g);
root.operationalLotGroupForLevel=l=>l&&l.qcLotId?derived().lotGroupByLotId.get(l.qcLotId)||null:null;
root.lotGroupInUse=g=>root.qcOperationalAccess!.lotGroupInUse(g,state.tests||[]);
root.operationalLotGroupForTest=t=>{
  if(!t)return null;
  const idx=derived(),cached=idx.groups.get(t.id);
  if(cached!==undefined)return cached;
  const levels=(t.levels||[]).filter((l:any)=>l.qcLotId),groups=levels.map(operationalLotGroupForLevel).filter(Boolean);
  if(groups.length){const g=groups[0],out={key:'grp:'+g.id,name:g.name,lotIds:[...(g.lotIds||[])]};idx.groups.set(t.id,out);return out;}
  idx.groups.set(t.id,null);
  return null;
};
root.operationalLevels=t=>{
  if(!t)return[];
  const idx=derived(),cached=idx.levels.get(t.id);
  if(cached)return cached;
  const levels=(t.levels||[]).filter((l:any)=>l.qcLotId&&operationalLotGroupForLevel(l));
  idx.levels.set(t.id,levels);
  return levels;
};
root.levelTargetOk=l=>root.qcLevelTargetValid!(l);
root.levelsMissingTarget=t=>operationalLevels(t).filter((l:any)=>!levelTargetOk(l));
root.isOperationalTest=t=>!!(t&&t.active!==false&&operationalPanelForTest(t)&&operationalLotGroupForTest(t)&&operationalLevels(t).length);
root.canEnterQcForLevel=(t,level)=>root.qcOperationalAccess!.canEnter(t,level);
root.operationalTests=()=>{
  const idx=derived();
  if(idx.operationalTests)return idx.operationalTests;
  idx.operationalTests=(state.tests||[]).filter(isOperationalTest).sort((a:any,b:any)=>operationalTestOrder(a)-operationalTestOrder(b));
  return idx.operationalTests;
};
root.operationalLotPoints=(t,level,withIndex=false)=>root.qcOperationalAccess!.lotPoints(t,level,withIndex);
root.lotLineage=currentLotId=>root.qcLotLineage!(derived(),currentLotId);
root.lotPointsByNo=(testId,level,lotNo)=>pointsForLot(testId,level,lotNo||'');
root.lotMeanSdFor=(t,level,lotNo)=>{
  const l=lvlCfg(t,level),pts=(state.data?.[t.id]||[]).filter((p:any)=>+p.level===+level);return root.qcLotMeanSd!(l,lotNo,pts);
};
root.lotTargetSnapshot=(t,level,lotId,lotNo)=>root.qcLotTargetSnapshot!(lvlCfg(t,level),lotId,lotNo);
root.parallelLotForLevel=(t,level)=>root.qcParallelLotLookup!(t,level);
root.entryColumns=t=>root.qcEntryColumns!(t);
root.entryColumnPoints=(t,col,withIndex=false)=>{
  if(!t||!col)return[];
  return root.qcEntryColumnPoints!(col,()=>operationalLotPoints(t,col.level,withIndex),()=>pointsForLot(t.id,col.level,col.lot||'',withIndex));
};
root.parallelWestgard=(t,col)=>{
  const pts=entryColumnPoints(t,col,true);return root.qcParallelWestgard!(pts,col,(rule:any)=>testRuleOnWithin(t,rule),(rules:any)=>ruleResultLevel(t,rules));
};
root.pointVoidVerdict=(t,p)=>root.qcPointVoidVerdict!(t,p);
root.plannedTargetFor=(t,lot)=>root.qcPlannedTarget!(lvlCfg(t,lot.level),lot);
root.previousLotSeries=(t,level)=>{
  const l=lvlCfg(t,level);if(!l)return[];
  return root.qcPreviousLotHistory!(l,lotLineage(l.qcLotId),(no:any)=>lotMeanSdFor(t,level,no),(no:any)=>lotPointsByNo(t.id,level,no));
};
root.levelsForLotGroup=group=>root.qcLotGroupLevels!(group,state.tests||[],derived().lotById);
root.pointRunNo=p=>root.qcPointRunNumber!(p);
root.activeWestgard=t=>{
  const memoKey=t&&t.id;
  if(memoKey){const cached=root.westgardMemoCache!.get(memoKey);if(cached)return cached;}if(memoKey&&wgMemo.has(memoKey))return wgMemo.get(memoKey);
  const withinRules=testRuleSet(t,'within'),acrossRules=testRuleSet(t,'across'),result=root.qcActiveWestgard!(operationalLevels(t).map((l:any)=>({l,pts:operationalLotPoints(t,l.level)})),withinRules,acrossRules,(rules:any)=>ruleResultLevel(t,rules));
  if(memoKey){wgMemo.set(memoKey,result);root.westgardMemoCache!.set(memoKey,result);}
  return result;
};
root.testCusumConfig=t=>root.qcCusumConfig!(t);
root.cusumSeries=(t,l)=>{
  if(!t||!l)return{cPos:[],cNeg:[],flags:[],ma:[],k:0.5,h:4};
  const memoKey=t.id+'|'+l.level;
  {const cached=root.qcCusumMemoCache!.get(memoKey);if(cached)return cached;}if(cusumMemo.has(memoKey))return cusumMemo.get(memoKey);
  const cfg=testCusumConfig(t),pts=operationalLotPoints(t,l.level),result=root.qcCusumSeries!(pts,l,cfg);
  cusumMemo.set(memoKey,result);root.qcCusumMemoCache!.set(memoKey,result);
  return result;
};
root.acceptedLotPoints=(t,level,withIndex=false)=>{
  const memoKey=t&&t.id?t.id+'|'+level+'|'+(withIndex?1:0):'';
  try{if(memoKey){const cached=root.qcAcceptedMemoCache!.get(memoKey);if(cached!==undefined)return cached;}}catch(e){/* cache lỗi — tính lại trực tiếp */}
  if(memoKey&&acceptedMemo.has(memoKey))return acceptedMemo.get(memoKey);
  const l=lvlCfg(t,level),pts=operationalLotPoints(t,level,withIndex),withinRules=testRuleSet(t,'within'),rejectRules=new Set(WG_RULES.filter((rule:any)=>testRuleAction(t,rule)==='reject')),out=root.qcAcceptedLotPoints!(pts,l,withinRules,rejectRules);
  if(memoKey){acceptedMemo.set(memoKey,out);try{root.qcAcceptedMemoCache!.set(memoKey,out);}catch(e){/* cache lỗi — bỏ qua, giá trị vẫn trả đúng */}}
  return out;
};
root.testSelectLabel=(t,list=state.tests||[])=>root.qcOperationalAccess!.selectLabel(t,list);
root.searchText=s=>root.normalizeSearchText!(s);

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
root.reportUnlockReason=createReportUnlockReason({clean:(value:any,maxLength:number)=>(root as any).QCCore.cleanText(value,maxLength)});
root.reportUnlockModalHtml=reportUnlockModalHtml;
root.reportLockPicker=reportLockPicker;
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
  scheduleSearchRender:(owner,apply,focusId)=>root.scheduleSearchRender(owner,apply,focusId),
  periodPresentation:{currentYearMonth:(value,fallback)=>root.ReportPeriodPresentation.currentYearMonth(value,fallback),setPart:(ym,part,value)=>root.ReportPeriodPresentation.setPart(ym,part as any,value)},
  periodWorkflow:{lock:input=>root.ReportPeriodWorkflowCommand.lock(input),unlock:input=>root.ReportPeriodWorkflowCommand.unlock(input)},
  findLock:(s,ym)=>root.PeriodService.findLock(s,ym),
  unlockModalHtml:input=>root.reportUnlockModalHtml(input),
  unlockReason:value=>root.reportUnlockReason!(value),
  lockPicker:(ym,year)=>root.reportLockPicker(ym,year),
  searchValuePresentation:{values:(test,d)=>root.reportSearchValuePresentation.values(test,d) as string[]},
  reportSelection:{defaults:(start,end,im,it)=>(root as any).reportSelection.defaults(start,end,im,it),dateRange:(start,end)=>(root as any).reportSelection.dateRange(start,end),exportSelection:(tests,tid,start,end,includeNce)=>(root as any).reportSelection.exportSelection(tests,tid,start,end,includeNce)},
  rangeText:(start,end)=>root.reportLabels.rangeText(start,end),
  actionIconPresentation:{icon:type=>root.reportActionIconPresentation.icon(type)},
  role:()=>root.role(),
  sortedLocks:locks=>root.ReportPeriodPresentation.sortedLocks(locks),
  formatDateTimeVN:value=>(root as any).formatDateTimeVN(value),
});
root.reportLockYmValue=reportPageController.reportLockYmValue;
root.reportSetLockPart=reportPageController.reportSetLockPart;
root.reportLockPeriod=reportPageController.reportLockPeriod;
root.reportUnlockPeriod=reportPageController.reportUnlockPeriod;
root.reportConfirmUnlockPeriod=reportPageController.reportConfirmUnlockPeriod;
root.reportSearchValues=reportPageController.reportSearchValues;
root.reportSearchSet=reportPageController.reportSearchSet;
root.reportRangeDefaults=reportPageController.reportRangeDefaults;
root.reportDateRange=reportPageController.reportDateRange;
root.reportExportSelection=reportPageController.reportExportSelection;
root.reportRangeChanged=reportPageController.reportRangeChanged;
root.reportRangeText=reportPageController.reportRangeText;
root.reportActionIcon=reportPageController.reportActionIcon;
root.reportModel=reportPageController.reportModel;
const reportPeriodCommand=createReportPeriodCommand({lock:(s,input)=>root.PeriodService.lock(s as any,input),unlock:(s,input)=>root.PeriodService.unlock(s as any,input)});
root.ReportPeriodWorkflowCommand=createReportPeriodWorkflowCommand({current:()=>state,period:reportPeriodCommand,log:(type,detail,target)=>logAct(type,detail,target),save:options=>save(options),render:()=>rerender()});
root.ActionCurrentIssues=createActionCurrentIssues({operationalTests:()=>typeof (globalThis as any).operationalTests==='function'?(globalThis as any).operationalTests():[],activeWestgard:test=>(globalThis as any).activeWestgard(test),pointWorkflowComplete:pointId=>typeof (globalThis as any).pointWorkflowComplete==='function'?(globalThis as any).pointWorkflowComplete(pointId):false});
root.ActionReviewMessages=actionReviewMessages;
const dashboardStatusFilter=createDashboardStatusFilter();
root.dashboardStatusFilter=dashboardStatusFilter;
root.dashboardExpiringLots=dashboardExpiringLots;
root.dashboardShiftStatus=dashboardShiftStatus;
root.dashboardKpis=dashboardKpis;
root.reportQcFormat=createReportQcFormat({testValue:(test,value)=>typeof (globalThis as any).fmtTestValue==='function'?(globalThis as any).fmtTestValue(test,value):(globalThis as any).fmt(value,3),testStat:(test,value)=>typeof (globalThis as any).fmtTestStat==='function'?(globalThis as any).fmtTestStat(test,value):(globalThis as any).fmt(value,3),pointValue:(point,test)=>typeof (globalThis as any).fmtPointValue==='function'?(globalThis as any).fmtPointValue(point,test):(globalThis as any).fmt(point&&point.val,Math.max(2,Number(point&&point.valueDecimals)||0)),format:(value,decimals)=>(globalThis as any).fmt(value,decimals)});
root.qcRangeTea=createRangeTea({teaBySource:(test,source,target)=>(globalThis as any).sgTeaBySource(test,source,target),teaSource:test=>(globalThis as any).sgTeaSource(test)});
root.entryRowsWindowTs=entryRowsWindowTs;
root.entryLotLabelsTs=entryLotLabelsTs;
root.entryVoidModalHtml=entryVoidModalHtml;
root.entryPreSaveWarningModalHtml=entryPreSaveWarningModalHtml;
root.targetSwitchModalHtml=targetSwitchModalHtml;
root.qcHistoryDetailModalHtml=qcHistoryDetailModalHtml;
root.qcHistoryMeanSdRowsHtml=qcHistoryMeanSdRowsHtml;
root.qcHistoryPointRowsHtml=qcHistoryPointRowsHtml;
/* QC_DECIMALS_DEFAULT từng chỉ là `const` global lexical của classic state.js
   (như REFTESTS/TEA_SOURCE_REGISTRY trước lát 6), không phải property trên
   globalThis — (globalThis as any).QC_DECIMALS_DEFAULT từng luôn undefined, làm
   targetNumberText(value,null) gọi Number(value).toFixed(undefined) (làm tròn về
   số nguyên, vd "3.7"→"4") bất cứ khi nào gọi không kèm xét nghiệm. Tham chiếu
   trần đúng quy tắc; từ lát 6 nó là `root.QC_DECIMALS_DEFAULT=` property thật,
   luôn có sẵn (khối port state.js đặt ngay đầu bundle) — fallback `:2` chỉ còn
   cần cho sandbox test tải bundle không qua toàn bộ dây chuyền construct. */
root.targetNumberTextPresentation=createTargetNumberText({valueDecimals:test=>(globalThis as any).testDecimalPlaces(test),statDecimals:test=>(globalThis as any).testStatDecimals(test),defaultDecimals:typeof QC_DECIMALS_DEFAULT!=='undefined'?QC_DECIMALS_DEFAULT:2});
root.targetConfigAssignedPresentation=targetConfigAssignedPresentation;
root.targetRangeDraftPresentation=createTargetRangeDraft({targetFromLimits:(low,high)=>(globalThis as any).QCCore.targetFromLimits(low,high),limitsFromTarget:(mean,sd)=>(globalThis as any).QCCore.limitsFromTarget(mean,sd)});
root.parseVnDatePresentation=parseVnDate;
root.targetRangeSyncPresentation=createTargetRangeSync({targetFromLimits:(low,high)=>(globalThis as any).QCCore.targetFromLimits(low,high),limitsFromTarget:(mean,sd)=>(globalThis as any).QCCore.limitsFromTarget(mean,sd)});
root.targetOverwritePicksPresentation=targetOverwritePicks;
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
root.resetPasswordModalHtml=resetPasswordModalHtml;
root.sigmaCohortModalHtml=sigmaCohortModalHtml;
root.sigmaFrequencyPanelHtml=sigmaFrequencyPanelHtml;
root.sigmaMuSummaryHtml=sigmaMuSummaryHtml;
root.sigmaStatusCardHtml=sigmaStatusCardHtml;
root.sigmaStatusPanelHtml=sigmaStatusPanelHtml;
root.sigmaOpSpecCellHtml=sigmaOpSpecCellHtml;
root.sigmaMuStateChipHtml=sigmaMuStateChipHtml;
root.sigmaMuDominantText=sigmaMuDominantText;
root.sigmaCohortRowsHtml=sigmaCohortRowsHtml;
root.sigmaInputDisplayValue=sigmaInputDisplayValue;
root.sigmaGoverningRuleBlockHtml=sigmaGoverningRuleBlockHtml;
root.sigmaFrequencyRowsHtml=sigmaFrequencyRowsHtml;
root.actionIncidentBannerPresentation=actionIncidentBannerPresentation;
root.actionBiasContextPresentation=actionBiasContextPresentation;
root.actionLevelContextPresentation=actionLevelContextPresentation;
root.actionLevelLabelPresentation=actionLevelLabelPresentation;
root.actionRuleOptionsPresentation=actionRuleOptionsPresentation;
root.actionCausePhrasesPresentation=actionCausePhrasesPresentation;
root.actionPhrasesPresentation=actionPhrasesPresentation;
root.userPermissionChecksHtml=userPermissionChecksHtml;
root.actionFormUiState=new ActionFormUiState();
root.actionFormRenderState=actionFormRenderState;
root.entrySheetMonthPart=entrySheetMonthPart;
root.entrySheetMonthValue=entrySheetMonthValue;
root.entrySheetNavigation=createEntrySheetNavigation<any>({date:element=>String(element.dataset.focusDate||''),run:element=>String(element.dataset.focusRun||''),level:element=>String(element.dataset.focusLevel||'')});
root.entrySheetInputOrder=createEntrySheetInputOrder<any>({date:element=>String(element.dataset.focusDate||''),run:element=>Number(element.dataset.focusRun||0),level:element=>Number(element.dataset.focusLevel||0)});
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
root.westgardTestSearch=createWestgardTestSearch<any>({text:(value:any)=>(root as any).searchText(value),label:(test:any)=>(root as any).testSelectLabel(test),id:(test:any)=>test.id});
root.westgardMultiViews=createWestgardMultiViews<any,any>({levels:(test:any)=>(root as any).operationalLevels(test),points:(test:any,level:any)=>(root as any).operationalLotPoints(test,level),previous:(test:any,level:any)=>(root as any).previousLotSeries(test,level),build:(input:any)=>(root as any).WestgardViewModel.buildMultiViews(input)});
root.westgardCusumLevels=createWestgardCusumLevels<any,any,any>({levels:(test:any)=>(root as any).operationalLevels(test),points:(test:any,level:any)=>(root as any).operationalLotPoints(test,level)});
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
  westgardCusumLevels:test=>(root as any).westgardCusumLevels(test),
  westgardRowsWindow:(rows,expanded,initial)=>(root as any).westgardRowsWindow(rows,expanded,initial),
  westgardArchivedMultiViews:(rows,points)=>root.westgardArchivedMultiViews!(rows,points),
  westgardArchivedGroupMatches:(group,q,st,lotById)=>root.westgardArchivedGroupMatches!(group,q,st,lotById),
  westgardArchivedTestSelection:(entries,q,selected,d)=>root.westgardArchivedTestSelection!(entries,q,selected,d),
  westgardTestSearch:{select:(tests,q,selected)=>(root as any).westgardTestSearch.select(tests,q,selected)},
  qcVerdictLabel:level=>(root as any).qcVerdictLabel(level),
  errorTypeDetailParts:rules=>(root as any).errorTypeDetailParts(rules),
  fmt:(value,decimals)=>fmt(value,decimals),
  qcWestgardByPoint:(points,mean,sd,ruleOnWithin)=>(root.QCCore as any).westgardByPoint(points,mean,sd,ruleOnWithin),
  testRuleOnWithin:(test,rule)=>(root as any).testRuleOnWithin(test,rule),
  ruleResultLevel:(test,rules)=>(root as any).ruleResultLevel(test,rules),
});
(root as any).wgMultiViews=westgardPageController.wgMultiViews;
(root as any).wgTogglePrevLot=westgardPageController.wgTogglePrevLot;
(root as any).wgArchivedGroups=westgardPageController.wgArchivedGroups;
(root as any).wgSetViewMode=westgardPageController.wgSetViewMode;
(root as any).wgSetChartMode=westgardPageController.wgSetChartMode;
(root as any).wgSetArchivedGroup=westgardPageController.wgSetArchivedGroup;
(root as any).wgSetArchivedTest=westgardPageController.wgSetArchivedTest;
(root as any).wgRowsWindow=westgardPageController.wgRowsWindow;
(root as any).wgLoadMoreRows=westgardPageController.wgLoadMoreRows;
(root as any).wgArchivedMultiViews=westgardPageController.wgArchivedMultiViews;
(root as any).wgArchivedGroupMatches=westgardPageController.wgArchivedGroupMatches;
/* Pha H2 nhóm (d): thay onchange="if(this.value){selTest=this.value;rerender()}"
   — `selTest=...` là gán trần vào global accessor (AnalysisUIState, xem
   CLAUDE.md "Module roles"), không phải gọi hàm, nên cần một wrapper tên
   riêng để data-action tra được. */
root.wgSelectTest = (value: unknown) => { if (!value) return; selTest = value; root.rerender(); };
(root as any).wgFilterTests=westgardPageController.wgFilterTests;
(root as any).wgFilterArchivedTests=westgardPageController.wgFilterArchivedTests;
(root as any).westgardModel=westgardPageController.westgardModel;
const dashboardTestSearchText=createDashboardTestSearchText({normalize:(value:any)=>(root as any).searchText(value),label:(test:any)=>(root as any).testDisplayName(test)});
const dashboardLatestPoint=createDashboardLatestPoint<any>({runNumber:(point:any)=>(root as any).pointRunNo(point)});
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
const dashboardOverdueActions=createDashboardOverdueActions({overdue:action=>(root as any).actionOverdue(action)});
root.dashboardOverdueActions=dashboardOverdueActions;
root.dashboardExpiringLotItems=dashboardExpiringLotItems;
root.dashboardWestgardAlerts=dashboardWestgardAlerts;
root.dashboardMissingTargetItems=dashboardMissingTargetItems;
const dashboardLevelData=createDashboardLevelData({stats:(values:number[])=>(root as any).stats(values)});
/* Pha H2 lát cuối: thay onclick="entrySel={...};entryStart=null;entryEnd=null;go('entry')"
   (3 lệnh liền) — gọn thành một hàm đặt tên, cùng mẫu openActionQcEvidence() trong
   actions-page-controller.ts. */
root.dashViewTestInEntry=(testId:string,level:number)=>{const entryUi=(root as any).EntryUIState;entryUi.entrySel={testId,level:Number(level)};entryUi.entryStart=null;entryUi.entryEnd=null;(root as any).go('entry');};
const dashboardTestItems=createDashboardTestItems({activeWestgard:test=>(root as any).activeWestgard(test),summarize:input=>(root as any).WestgardViewModel.summarizeTestStatus(input),levelData:(views,today)=>dashboardLevelData(views,today),latestPoint:points=>dashboardLatestPoint(points),searchText:(test,levels)=>dashboardTestSearchText(test,levels),markStatus:(testId,status)=>(root as any).statusMemo.set(testId,status)});
root.dashboardTestItems=dashboardTestItems;
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
  dashboardTestItems,
  dashboardKpis,
  dashboardMissingTargetItems,
  dashboardWestgardAlerts,
  dashboardExpiringLotItems,
  dashboardExpiringLots,
  dashboardOverdueActions,
  dashboardStatusFilter,
  dashboardShiftStatus,
  dashTestQ:()=>(root as any).dashTestQ,
  dashTestStatus:()=>(root as any).dashTestStatus,
  setDashTestStatus:value=>{(root as any).AnalysisUIState.dashTestStatus=value;},
  rerender:()=>rerender(),
});
root.dashTestSetStatus=dashboardPageController.dashTestSetStatus;
root.dashboardModel=dashboardPageController.dashboardModel;
root.icon=icon;root.icoDownload=icoDownload;root.icoPrint=icoPrint;
const routerPermission=createRouterPermission({currentUser:()=>currentUser,infoDialog:message=>root.infoDialog(message),roles:()=>root.routerPagePolicy.roles});
root.role=routerPermission.role;root.canWrite=routerPermission.canWrite;root.requireWrite=routerPermission.requireWrite;root.requireAdmin=routerPermission.requireAdmin;root.roleLabel=routerPermission.roleLabel;root.roleSelectOptions=routerPermission.roleSelectOptions;
root.PAGES=root.routerPagePolicy.pages;
root.rolePageIds=(r=routerPermission.role())=>root.routerPagePolicy.rolePageIds(r);
root.userPageIds=(u=currentUser)=>root.routerPagePolicy.userPageIds(u);
root.canAccessPage=(id,u=currentUser)=>root.routerPagePolicy.canAccessPage(id,u);
root.firstAccessPage=(u=currentUser)=>root.routerPagePolicy.firstAccessPage(u);
const liveRowFilterService=createLiveRowFilter({document:typeof document!=='undefined'?document:({querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>({})} as unknown as Document),searchText:value=>root.normalizeSearchText!(value)});
root.setSearchCount=liveRowFilterService.setSearchCount;root.showSearchEmpty=liveRowFilterService.showSearchEmpty;root.replaceSelectItems=liveRowFilterService.replaceSelectItems;root.liveRowFilter=liveRowFilterService.liveRowFilter;root.scheduleSearchRender=liveRowFilterService.scheduleSearchRender;
const uiPrimitives=createUiPrimitives({escapeAttr:value=>(root as any).escAttr(value)});
root.btn=uiPrimitives.btn;root.emptyState=uiPrimitives.emptyState;
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
root.actionDispatcher = createActionDispatcher({
  document: typeof document !== 'undefined' && typeof document.addEventListener === 'function' ? document : undefined,
  resolve: name => (root as any)[name],
});
root.actionDispatcher.bind();
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
  afterRender:p=>root.afterRender(p),
  entryQ:()=>(root as any).entryQ,
  entryFilter:v=>(root as any).entryFilter(v),
  isReactPage:id=>(window as any).QCLabReact?.isReactPage(id)||false,
  mountReactPage:(id,container)=>(window as any).QCLabReact?.mountReactPage(id,container),
  notifyReactStore:()=>{appStore.getState().touch();},
  pushUrl:id=>{if(typeof history!=='undefined')history.pushState(null,'',hashForPage(id));},
});
root.go=routerDispatch.go;root.goFromHistory=routerDispatch.goFromHistory;root.resetMainScroll=routerDispatch.resetMainScroll;root.render=routerDispatch.render;root.restoreRouteFilters=routerDispatch.restoreRouteFilters;root.rerender=routerDispatch.rerender;
root.pageFromUrlHash=()=>pageIdFromHash(typeof location!=='undefined'?location.hash:'');
root.actionDetailCheckHtml=createActionDetailCheckHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionEvidenceTimelinePresentation=createActionEvidenceTimelineHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionRerunEvidencePresentation=createActionRerunEvidenceHtml<any>({escape:(value:any)=>(root as any).esc(value),pointValue:(point:any,test:any)=>(root as any).fmtPointValue(point,test),date:(value:any)=>(root as any).vnDate(value),button:(label,action,variant,title)=>(root as any).btn(label,action,variant,title)});
root.actionDetailMetaHtml=createActionDetailMetaHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionCancelledAlertHtml=createActionCancelledAlertHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionCancelModalHtml=actionCancelModalHtml;
root.actionReviewNoteModalHtml=actionReviewNoteModalHtml;
root.actionReopenModalHtml=actionReopenModalHtml;
root.actionLegacyDetailHtml=createActionLegacyDetailHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionContainmentDetailHtml=createActionContainmentDetailHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionInspectionDetailsHtml=createActionInspectionDetailsHtml();
root.actionPatientImpactHtml=createActionPatientImpactHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionCauseDetailHtml=createActionCauseDetailHtml({escape:(value:any)=>(root as any).esc(value)});
root.actionEffectivenessDetailHtml=createActionEffectivenessDetailHtml({escape:(value:any)=>(root as any).esc(value)});
root.teaReferenceAddModalPresentation=teaReferenceAddModalHtml;
root.manageSearchPlaceholderPresentation=manageSearchPlaceholder;
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
root.targetSelectionPresentation=targetSelection;
root.targetLevelSelectionPresentation=targetLevelSelection;
root.historySearchValuesPresentation=historySearchValues;
root.teaLabBasisLabelPresentation=teaLabBasisLabel;
root.targetLevelLotsPresentation=targetLevelLots;
root.targetSearchValuesPresentation=targetSearchValues;
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
root.historyRowsPresentation=historyRows;
root.targetEmptyStatePresentation=targetEmptyState;
root.targetPrerequisitePresentation=targetPrerequisite;
root.teaReferenceKindPresentation=teaReferenceKind;
root.teaReferenceRowActionsPresentation=teaReferenceRowActions;
root.teaReferenceSortPresentation=sortTeaReferences;
root.teaReferenceNamingTitlePresentation=teaReferenceNamingTitle;
root.teaReferenceEmptyStatePresentation=teaReferenceEmptyState;
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
   cách sigma-tea.js cũ tự thực hiện lúc file nạp. Từ lát 6 (2026-08-20, retire
   state.js + analyte-catalog.js), khối port state.js ở đầu bundle luôn gán đủ ba
   tên này TRƯỚC khi tới đây — guard vẫn giữ nguyên làm lưới an toàn rẻ tiền cho
   sandbox tối giản chỉ nạp core.js + bundle mà bỏ qua toàn bộ dây chuyền construct
   phía trên (không nên xảy ra trong test hiện có, nhưng ném ReferenceError giữa
   chừng lúc nạp bundle tệ hơn nhiều so với một điều kiện luôn đúng). */
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
  root.openModal(root.rangeWorkflowModalHtml({contextHtml,nceNoticeHtml:nceNotice,checklistRowsHtml:checklist,currentRangeRowHtml:comparisonRowsHtml,proposedRangeRowHtml:'',printButtonHtml:(root as any).btn('In biểu mẫu',{action:'printRangeForm',args:[tid,level]},'ghost'),applyButtonHtml:root.canWrite()?(root as any).btn('Áp dụng dải PXN',{action:'rangeApplyFromWorkflow',args:[tid,level]},'teal','',{disabled:!r.eligible}):'',closeButtonHtml:(root as any).btn('Đóng',{action:'closeModal'},'ghost')}));
};
/* Pha H2 nhóm (d) lát 4: thay onclick="closeModal();applyNewRange(...)" gọi
   2 lệnh liền — cùng mẫu goManageTargets/entryCloseKeepScroll ở trên. */
root.rangeApplyFromWorkflow=(tid,level)=>{root.closeModal();root.applyNewRange(tid,level);};
root.rangeTeaPercent=(t,l)=>root.qcRangeTea!.percent(t,l);
root.rangeGateHtml=(r,tid,level)=>{
  if(!r.nce)return'';
  const tea=root.rangeTeaPercent(r.t,r.l),threshold=root.qcRangeTea!.quarter(tea);
  return root.rangeSafetyGateHtml({nceId:(root as any).esc(r.nce.nceId||'NCE'),rule:(root as any).esc(r.nce.rule||''),biasInputActionAttrs:`data-action="rangeUpdateBiasHint" data-args="${(root as any).escAttr(JSON.stringify([tid,level]))}" data-action-on="input"`,thresholdText:threshold!=null?fmt(threshold)+'%':'—',noTeaHint:tea?'':'Chưa có TEa% cho xét nghiệm này — vào Cấu hình Sigma để bổ sung, hoặc vẫn có thể xác nhận thủ công nếu ngưỡng đã biết theo cách khác.'});
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
  root.openModal(root.rangeApplyConfirmationModalHtml({changeSummaryHtml:`X̄: ${(root as any).fmtTestValue(t,l.mean)} → ${(root as any).fmtTestValue(t,c.m)}<br>SD: ${(root as any).fmtTestStat(t,l.sd)} → ${(root as any).fmtTestStat(t,c.sd)}<br>Dải nhà sản xuất vẫn được lưu để hoàn về.`,gateHtml:root.rangeGateHtml(r,tid,level),cancelButtonHtml:(root as any).btn('Hủy',{action:'closeModal'},'ghost'),applyButtonHtml:(root as any).btn('Áp dụng',{action:'confirmApplyNewRange',args:[tid,level]},'teal')}));
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
  root.openModal(root.rangeRevertConfirmationModalHtml({cancelButtonHtml:(root as any).btn('Hủy',{action:'closeModal'},'ghost'),revertButtonHtml:(root as any).btn('Hoàn về dải NSX',{action:'confirmRevertRange',args:[tid,level]},'danger')}));
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
root.UserAvatarCommand=createUserAvatarCommand({manage:userManagementCommand,log:(type,detail,target)=>logAct(type,detail,target),save:()=>save({clearDerived:false})});
const avatarModalController=createAvatarModalController({document:typeof document!=='undefined'?document:({createElement:()=>({})} as unknown as Document),createImage:()=>new Image(),createFileReader:()=>new FileReader(),currentUser:()=>currentUser,avatarCommand:root.UserAvatarCommand,infoDialog:(message,opts)=>root.infoDialog(message,opts),openModal:html=>root.openModal(html),closeModal:()=>root.closeModal(),rerender:()=>rerender(),escapeAttr:value=>(root as any).escAttr(value),html:{avatarModalHtml},btn:(label,onclick,cls,title,opts)=>root.btn(label,onclick,cls,title,opts)});
root.openAvatarModal=avatarModalController.openAvatarModal;root.pickAvatar=avatarModalController.pickAvatar;root.clearAvatarPhoto=avatarModalController.clearAvatarPhoto;
/* ===== USERS / AUDIT / AUTH ===== Retire classic users-auth.js (2026-08-20, Pha G nhóm C
   lát 2) — mọi hàm bên dưới vốn đã chỉ gọi thẳng service/command TypeScript đã có sẵn ở
   trên (password/PBKDF2, login/reset/admin/user-lifecycle command, activity audit filter/
   pagination/csv, user list/row/permission HTML); không có logic mới. `auditQ`/`auditFrom`/
   `auditTo`/`auditPage`/`auditPageSize` chuyển vào `AuthUIState` (xem createAuthUiState() ở
   ui-state.ts) thay vì `let` cục bộ, cùng lý do `currentUser`/`loginFails`/`loginLockUntil`
   đã ở đó từ trước — test vm sandbox gán bare `auditQ='...'` phải trúng đúng accessor
   property của globalThis, một `let` bên trong IIFE của bundle sẽ không thấy được. */
root.AUDIT_PAGE_SIZES = ACTIVITY_AUDIT_PAGE_SIZES;
root.usersModel = () => root.userListModel(state.users, currentUser && currentUser.id);
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
/* Mô hình dữ liệu thuần (không HTML) cho trang Nhật ký hoạt động — dùng bởi
   src/react/pages/AuditPage.tsx (xem docs/REACT-ADOPTION-PLAN.md). Chạy lại
   ĐÚNG pipeline của pageAudit() ở dưới (cùng thứ tự gọi) nhưng dừng lại trước
   bước dựng *Html, trả về dữ liệu để JSX tự vẽ. Thêm hàm riêng thay vì sửa
   pageAudit() để giữ rủi ro bằng 0 trong lúc còn giữ song song hai bản (xem
   cách làm tương tự ở dashboardModel() trong dashboard-page-controller.ts). */
root.auditModel = () => {
  const total = (state.activity || []).length;
  const oversize = total > root.ACTIVITY_ROTATE_TO!;
  const chain = typeof root.auditChainStatus === 'function' ? root.auditChainStatus() : { ok: true, checked: 0, legacy: total, idle: false } as Record<string, any>;
  const filtered = root.auditFilteredActivities(), pageInfo = root.activityAuditPagination(filtered, auditPage, auditPageSize), pageCount = pageInfo.pageCount;
  auditPage = pageInfo ? pageInfo.page : Math.min(Math.max(1, auditPage), pageCount);
  const offset = pageInfo ? pageInfo.offset : (auditPage - 1) * auditPageSize, pageRows = pageInfo ? pageInfo.rows : filtered.slice(offset, offset + auditPageSize);
  const resultFrom = pageInfo ? pageInfo.resultFrom : (filtered.length ? offset + 1 : 0), resultTo = pageInfo ? pageInfo.resultTo : Math.min(offset + auditPageSize, filtered.length);
  return {
    total, oversize, hardCap: root.ACTIVITY_HARD_CAP!, chain,
    rows: pageRows as any[], filteredCount: filtered.length,
    page: auditPage, pageCount, resultFrom, resultTo,
    pageSizes: root.AUDIT_PAGE_SIZES as unknown as number[], pageSize: auditPageSize,
    query: auditQ, from: auditFrom, to: auditTo, hasFilter: !!(auditQ || auditFrom || auditTo),
    brokenSeq: chain.idle || chain.ok ? null : (((state.activity as any)[chain.brokenIndex] || {}).seq || chain.brokenIndex + 1),
  };
};
root.activityCSVRows = items => root.activityAuditCsv(items);
root.exportActivityCSV = () => { root.csvDownload!('Nhat_ky_hoat_dong_QCLab.csv', root.activityCSVRows(state.activity || [])); };
/* Lưu trữ CÓ CHỦ ĐÍCH nhật ký cũ: xuất CSV phần bị cắt TRƯỚC, chỉ khi file đã
   tạo xong mới gỡ khỏi state — khác với xoay vòng tự động (auditRotateOverflow),
   đường này không mất dữ liệu. CSV giữ nguyên cột PrevHash/Hash để phần đã lưu
   trữ kiểm chứng độc lập được: hash dòng cuối file phải khớp tipHash trong dòng
   checkpoint ghi lại sau khi cắt. */
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
/* openUserPerms() trả model hoặc null thay vì tự mở modal — phần "mở modal
   React thật" giờ ở usersBridge.ts (chỉ react-pilot.js mới dựng được JSX),
   cùng cách tách đã dùng cho lisOpenQueueModal()/reauthenticateCurrentUser().
   applyUserPerms() bên dưới GIỮ NGUYÊN — vẫn đọc DOM #editUserRole/#editUserPerms
   trực tiếp, không phụ thuộc React hay classic dựng ra chúng. */
root.openUserPerms = async (id: string) => {
  if (!root.requireAdmin()) return null;
  const u = (state.users || []).find((x: Record<string, any>) => x.id === id); if (!u) return null;
  if (currentUser && currentUser.id === id) { await root.infoDialog('Không thể tự sửa quyền của tài khoản đang đăng nhập. Hãy dùng tài khoản quản trị khác nếu cần thay đổi.'); return null; }
  return { userId: id, userName: u.name || u.username, username: u.username, role: u.role, pagePerms: u.pagePerms };
};
root.applyUserPerms = async id => {
  if (!root.requireAdmin()) return;
  const u = (state.users || []).find((x: Record<string, any>) => x.id === id); if (!u) return;
  if (currentUser && currentUser.id === id) { await root.infoDialog('Không thể tự sửa quyền của tài khoản đang đăng nhập.'); return; }
  const rolev = (document.getElementById('editUserRole') as HTMLInputElement).value, pagePerms = await root.collectUserPerms('editUserPerms', rolev); if (!pagePerms) return;
  root.UserLifecycleCommand.updatePermissions(u, { role: rolev, pagePerms, auditDetail: `${root.roleLabel(rolev)} · ${pagePerms.length} thẻ` });
  root.closeModal(); if (!root.canAccessPage(root.page)) { page = root.firstAccessPage(); if (typeof history !== 'undefined') history.replaceState(null, '', hashForPage(root.page)); } renderBrand(); root.nav(); rerender();
};
root.resetPass = id => {
  if (!root.requireAdmin()) return;
  const u = (state.users || []).find((x: Record<string, any>) => x.id === id); if (!u) return;
  const self = currentUser && currentUser.id === id;
  root.openModal(root.resetPasswordModalHtml({ title: self ? 'Đổi mật khẩu' : 'Đặt lại mật khẩu', message: self ? 'Nhập mật khẩu mới cho tài khoản đang đăng nhập.' : 'Nhập mật khẩu tạm; người dùng sẽ phải đổi lại khi đăng nhập.', actionAttrs: `data-keydown-action="applyResetPass" data-keydown-args="${(root as any).escAttr(JSON.stringify([id]))}" data-keydown-keys='["Enter"]'`, cancelButtonHtml: root.btn('Hủy', { action: 'closeModal' }, 'ghost'), saveButtonHtml: root.btn('Lưu mật khẩu', { action: 'applyResetPass', args: [id] }, 'teal') }));
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
/* reauthenticateCurrentUser() retired sang React thật (Giai đoạn 3,
   DialogOverlay.tsx's ReauthForm trong react-pilot.js). Logic xác minh mật
   khẩu (PBKDF2, so passHash) VẪN nằm ở đây — React chỉ gọi reauthVerify()
   qua kernel.pres và không bao giờ thấy currentUser.passHash. */
root.reauthVerify = async password => {
  if (!currentUser) return false;
  try { return await root.verifyPass(password, currentUser.passHash); } catch (e) { return false; }
};
root.reauthAccountLabel = () => currentUser ? (currentUser.name || currentUser.username || '') : null;
root.reauthenticateCurrentUser = opts => (window as any).QCLabReact.reauthenticateCurrentUser(opts);
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
    <div class="auth-actions">${root.btn('Tải dữ liệu gốc xuống', { action: 'downloadStartupData' }, 'teal')}${root.btn('Tạo dữ liệu mới', { action: 'resetStartupData' }, 'ghost')}</div>
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
    <label>Mật khẩu</label><input id="liPass" type="password" autocomplete="current-password" data-keydown-action="doLogin" data-keydown-keys='["Enter"]'>
    ${msg ? `<div class="auth-err">${escapeHtml(msg)}</div>` : ''}
    <div class="auth-actions">${root.btn('Đăng nhập', { action: 'doLogin' }, 'teal')}</div>
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
    <label>Nhập lại mật khẩu mới</label><input id="newPass2" type="password" autocomplete="new-password" data-keydown-action="changeRequiredPassword" data-keydown-keys='["Enter"]'>
    ${msg ? `<div class="auth-err">${escapeHtml(msg)}</div>` : ''}
    <div class="auth-actions">${root.btn('Lưu mật khẩu mới', { action: 'changeRequiredPassword' }, 'teal')}</div>
    <div class="auth-hint">Mật khẩu cần ít nhất 8 ký tự và không nên dùng lại mật khẩu mặc định.</div></div>`;
  setTimeout(() => { const e = document.getElementById('newPass1'); if (e) (e as HTMLElement).focus(); }, 50);
};
root.changeRequiredPassword = async () => {
  const p1 = (document.getElementById('newPass1') as HTMLInputElement).value, p2 = (document.getElementById('newPass2') as HTMLInputElement).value;
  const result = await root.RequiredPasswordWorkflowCommand.complete({ user: currentUser, password: p1, confirmation: p2, cloud: !!(fb && fb.initialized) });
  if (result.status === 'invalid') { root.showPasswordChange(result.error); return; }
  currentUser = result.user; root.showApp();
};
root.logout = () => { if (currentUser) root.LoginWorkflowCommand.logout(); currentUser = null; page = 'dash'; if (typeof history !== 'undefined') history.pushState(null, '', hashForPage('dash')); root.showLogin(); };
root.showApp = () => {
  const ov = document.getElementById('authOverlay'); if (ov) (ov as HTMLElement).style.display = 'none';
  /* Giai đoạn 6 (Router chuẩn): mở đúng trang trong URL nếu có (bookmark/tải
     lại trang/link chia sẻ) — chỉ khi người dùng thực sự được vào trang đó,
     nếu không rơi về đúng logic firstAccessPage() cũ. */
  const fromHash = root.pageFromUrlHash!();
  if (fromHash && root.canAccessPage(fromHash)) page = fromHash;
  else if (!root.canAccessPage(root.page)) page = root.firstAccessPage();
  if (typeof history !== 'undefined') history.replaceState(null, '', hashForPage(root.page));
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
  getState: () => state, ui: () => (root as any).ManageUIState,
  rerender: () => rerender(), role: () => role(), userName: () => userName(), requireAdmin: message => root.requireAdmin(message),
  esc: value => (root as any).esc(value), escapeAttr: value => (root as any).escAttr(value),
  btn: (label, action, cls, title, options) => (root as any).btn(label, action, cls, title, options),
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
root.targetGroupLots = managePageController.targetGroupLots;
root.ensureTargetSelection = managePageController.ensureTargetSelection;
root.manageHistorySearchValues = managePageController.manageHistorySearchValues;
root.teaRefFind = managePageController.teaRefFind;
root.teaRefNumOrNull = managePageController.teaRefNumOrNull;
root.teaRefExternalChanged = managePageController.teaRefExternalChanged;
root.teaRefEnsure = managePageController.teaRefEnsure;
root.teaRefEdit = managePageController.teaRefEdit;
root.teaRefRemove = managePageController.teaRefRemove;
root.teaRefOpenAdd = managePageController.teaRefOpenAdd;
root.teaRefAddSubmit = managePageController.teaRefAddSubmit;
root.teaLabProfileOpenModel = managePageController.teaLabProfileOpenModel;
root.teaLabProfileSave = managePageController.teaLabProfileSave;
root.teaLabProfileRemove = managePageController.teaLabProfileRemove;
root.manageModel = managePageController.manageModel;
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
  openModal: html => root.openModal(html), closeModal: () => root.closeModal(),
  openReactInstrumentModal: () => (window as any).QCLabReact.openConfigInstrument(),
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
/* Pha H2 (2026-08-20): gộp cặp lệnh go('manage');setManageTab('targets') —
   lặp lại ~7 nơi trong src/presentation — thành một action tên riêng, vì
   data-action="..." chỉ định tuyến MỘT hàm; các cặp lệnh khác gặp sau này
   nhận cùng cách xử lý (thêm một wrapper nhỏ tại đây) hoặc dispatcher tự nhận
   nhiều action nếu số lượng lớn hơn nhiều — chưa cần tới mức đó. */
root.goManageTargets = () => { root.go('manage'); root.setManageTab!('targets'); };
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
root.deleteConfigPanel = manageTestsActionsController.deleteConfigPanel;
root.deleteLotTransition = manageTestsActionsController.deleteLotTransition;
root.lotTransitionChoiceLabel = manageTestsActionsController.lotTransitionChoiceLabel;
root.lotTransitionChoiceLots = manageTestsActionsController.lotTransitionChoiceLots;
root.lotTransitionChoiceMatch = manageTestsActionsController.lotTransitionChoiceMatch;
root.lotTransitionSelectedId = manageTestsActionsController.lotTransitionSelectedId;
root.openLotTransitionModel = manageTestsActionsController.openLotTransitionModel;
root.lotTransitionTargetsModel = manageTestsActionsController.lotTransitionTargetsModel;
root.readLotTransitionTargetPicks = manageTestsActionsController.readLotTransitionTargetPicks;
root.saveLotTransitionV2 = manageTestsActionsController.saveLotTransitionV2;
root.suggestConfigGroupName = manageTestsActionsController.suggestConfigGroupName;
root.saveConfigGroup = manageTestsActionsController.saveConfigGroup;
root.deleteConfigGroup = manageTestsActionsController.deleteConfigGroup;
root.toggleLotGroupStatus = manageTestsActionsController.toggleLotGroupStatus;
root.activateLotGroup = manageTestsActionsController.activateLotGroup;
root.saveConfigLot = manageTestsActionsController.saveConfigLot;
root.renameLotAcrossPoints = manageTestsActionsController.renameLotAcrossPoints;
root.deleteConfigLot = manageTestsActionsController.deleteConfigLot;
root.saveConfigInstrument = manageTestsActionsController.saveConfigInstrument;
root.deleteConfigInstrument = manageTestsActionsController.deleteConfigInstrument;
root.defaultAssayLevels = manageTestsActionsController.defaultAssayLevels;
root.configAssayTeaRefs = manageTestsActionsController.configAssayTeaRefs;
root.configAssayRefRecord = manageTestsActionsController.configAssayRefRecord;
root.configAssayNaming = manageTestsActionsController.configAssayNaming;
root.configAssayFindRef = manageTestsActionsController.configAssayFindRef;
root.configAssaySuggestionInput = manageTestsActionsController.configAssaySuggestionInput;
root.configAssayInstrumentChanged = manageTestsActionsController.configAssayInstrumentChanged;
root.openConfigAssayModel = manageTestsActionsController.openConfigAssayModel;
root.saveConfigAssay = manageTestsActionsController.saveConfigAssay;
root.delTest = manageTestsActionsController.delTest;
root.jsq = jsq;
const entryPageController = createEntryPageController({
  document: () => typeof document !== 'undefined' ? document : ({ getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] } as unknown as Document),
  window: () => typeof window !== 'undefined' ? window : ({ scrollX: 0, scrollY: 0, scrollTo: () => {} } as unknown as Window),
  localStorage: () => typeof localStorage !== 'undefined' ? localStorage : ({ getItem: () => null, setItem: () => {} } as unknown as Storage),
  getState: () => state, ui: () => (root as any).EntryUIState, analysisUi: () => (root as any).AnalysisUIState,
  currentPage: () => (root as any).RouterUIState.page,
  rerender: () => rerender(), isReactEntry: () => (window as any).QCLabReact?.isReactPage('entry') || false,
  afterRender: page => (root as any).afterRender(page),
  role: () => role(), canWrite: () => root.canWrite(), requireWrite: () => requireWrite(),
  requireUnlockedPeriod: (date, action) => (root as any).requireUnlockedPeriod(date, action),
  esc: value => (root as any).esc(value), escapeAttr: value => (root as any).escAttr(value), jsq: value => jsq(value),
  btn: (label, action, cls, title, options) => (root as any).btn(label, action, cls, title, options),
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
root.entryModel = entryPageController.entryModel;
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
root.entryRenderKeepScroll = entryPageController.entryRenderKeepScroll;
root.entryCloseKeepScroll = entryPageController.entryCloseKeepScroll;
root.entryConfirmInlineSave = entryPageController.entryConfirmInlineSave;
root.entrySetLastMsg = entryPageController.entrySetLastMsg;
root.entryUnlockExtraRun = entryPageController.entryUnlockExtraRun;
root.entryDateNoteSave = entryPageController.entryDateNoteSave;
root.entryColumnCfg = entryPageController.entryColumnCfg;
root.entryInlineSave = entryPageController.entryInlineSave;
root.entrySheetRunChanged = entryPageController.entrySheetRunChanged;
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
  esc: value => (root as any).esc(value), escapeAttr: value => (root as any).escAttr(value),
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
root.captureActionDraft = actionFormController.captureActionDraft;
root.actionFormChanged = actionFormController.actionFormChanged;
root.actionDraftValues = actionFormController.actionDraftValues;
root.clearActionDraft = actionFormController.clearActionDraft;
root.actionSourceOptions = actionFormController.actionSourceOptions;
root.actionCausePhrases = actionFormController.actionCausePhrases;
root.actionActionPhrases = actionFormController.actionActionPhrases;
root.actionInsertSuggestion = actionFormController.actionInsertSuggestion;
root.actionLevelLabel = actionFormController.actionLevelLabel;
root.syncActLevels = actionFormController.syncActLevels;
root.actionLevelContext = actionFormController.actionLevelContext;
root.beginActionManual = actionFormController.beginActionManual;
root.closeActionForm = actionFormController.closeActionForm;
root.actionIncidentBanner = actionFormController.actionIncidentBanner;
root.beginActionFromIssue = actionFormController.beginActionFromIssue;
root.actionFieldValue = actionFormController.actionFieldValue;
root.readActionProtocolForm = actionFormController.readActionProtocolForm;
root.actionEffectivenessMissingKey = actionFormController.actionEffectivenessMissingKey;
root.addAction = actionFormController.addAction;
root.syncActionRiskScore = actionFormController.syncActionRiskScore;
root.syncActionResidualRiskScore = actionFormController.syncActionResidualRiskScore;
root.editAction = actionFormController.editAction;
/* Pha H2 (2026-08-20): gộp cặp lệnh nhiều bước từ các item dashboard, cùng lý
   do với goManageTargets ở trên — data-action chỉ định tuyến một hàm. */
root.dashboardGoEntryFollowup = (testId, level) => { entrySel = { testId, level }; entryStart = null; entryEnd = null; root.go('entry'); };
root.dashboardContinueAction = index => { root.go('actions'); root.editAction!(index); };
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
root.actionFormViewModel = actionFormController.actionFormViewModel;
const actionsPageController = createActionsPageController({
  getState: () => state, document: () => typeof document !== 'undefined' ? document : ({ getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] } as unknown as Document),
  entryUi: () => (root as any).EntryUIState, currentPage: () => (root as any).RouterUIState.page, currentUser: () => currentUser,
  rerender: () => rerender(), role: () => role(), userName: () => userName(), canWrite: () => root.canWrite(), requireWrite: () => requireWrite(),
  requireAdmin: message => root.requireAdmin(message), reauthenticateCurrentUser: opts => (root as any).reauthenticateCurrentUser(opts),
  openModal: html => root.openModal(html), closeModal: () => root.closeModal(), confirmDialog: opts => root.confirmDialog(opts), infoDialog: (message, opts) => root.infoDialog(message, opts),
  esc: value => (root as any).esc(value),
  btn: (label, action, cls, title, options) => (root as any).btn(label, action, cls, title, options),
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
  ActionViolationService: root.ActionViolationService, ActionCurrentIssues: () => root.ActionCurrentIssues!(),
  NceLifecycleWorkflowCommand: root.NceLifecycleWorkflowCommand, actionFormUiState: (root as any).actionFormUiState, modalTemplate: opts => root.modalTemplate(opts),
  QCCore: { cleanText: (value, maximumLength) => root.QCCore!.cleanText(value, maximumLength) },
  captureFormDraft: () => actionFormController.captureActionDraft(),
  pres: root as any,
});
actionsPageControllerRef = actionsPageController;
root.actionLevelShort = actionsPageController.actionLevelShort;
root.currentIssues = actionsPageController.currentIssues;
root.cancelAction = actionsPageController.cancelAction;
root.confirmCancelAction = actionsPageController.confirmCancelAction;
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
root.actionDetailCheck = actionsPageController.actionDetailCheck;
root.actionEvidenceTimelineHtml = actionsPageController.actionEvidenceTimelineHtml;
root.actionRerunEvidenceHtml = actionsPageController.actionRerunEvidenceHtml;
root.openActionQcEvidence = actionsPageController.openActionQcEvidence;
root.viewActionDetailModel = actionsPageController.viewActionDetailModel;
root.groupIssuesByTestDate = actionsPageController.groupIssuesByTestDate;
root.actionViolationInfo = actionsPageController.actionViolationInfo;
root.actionQcVerdictLabel = actionsPageController.actionQcVerdictLabel;
root.actionsModel = actionsPageController.actionsModel;
const reagentComparisonService = createReagentComparisonService({
  cleanText: root.QCCore.cleanText,
  cleanId: root.QCCore.cleanId,
});
root.ReagentComparisonService = reagentComparisonService;
const reagentComparisonWorkflowCommand=createReagentComparisonWorkflowCommand({current:()=>state,comparison:reagentComparisonService,label:comparison=>(globalThis as any).rcLabel(comparison),log:(action,detail,target)=>logAct(action,detail,target),saveState:options=>save(options)});
root.ReagentComparisonWorkflowCommand=reagentComparisonWorkflowCommand;
root.reagentReportPresentation = reagentReportPresentation;
root.reagentChartPresentation = reagentChartPresentation;
root.reagentReportItemPresentation = reagentReportItemPresentation;
root.reagentComparisonLabelPresentation = reagentComparisonLabelPresentation;
root.reagentQuickLabelPresentation = reagentQuickLabelPresentation;
root.reagentQuickPickerModalPresentation = reagentQuickPickerModalHtml;
root.reagentCreateModalPresentation = reagentCreateModalHtml;
root.reagentChartAxis = reagentChartAxis;
root.reagentScatterSvg = reagentScatterSvg;
root.reagentBlandSvg = reagentBlandSvg;
root.reagentQuickPickerRowsHtml = reagentQuickPickerRowsHtml;
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
  button:(label,action,cls,title,options)=>(root as any).btn(label,action,cls,title,options),
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
  service:reagentComparisonService,
  workflow:reagentComparisonWorkflowCommand,
  pres:{
    comparisonLabel:(root as any).reagentComparisonLabelPresentation,
    pairMath:(root as any).reagentPairMath,
    calculator:(root as any).reagentComparisonCalculator,
    chartAxis:(root as any).reagentChartAxis,
    chart:(root as any).reagentChartPresentation,
    scatterSvg:(root as any).reagentScatterSvg,
    blandSvg:(root as any).reagentBlandSvg,
    resultHtml:(root as any).reagentResultHtml,
    quickLabel:(root as any).reagentQuickLabelPresentation,
    quickPickerRows:(root as any).reagentQuickPickerRowsHtml,
    quickPickerModal:(root as any).reagentQuickPickerModalPresentation,
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
  vnDate: value => vnDate(value), vnPeriod: value => (root as any).vnPeriod(value),
  fmt: (value, decimals) => fmt(value, decimals), isoMonth: () => (root as any).isoMonth(), isoDate: value => (root as any).isoDate(value),
  uid: () => (root as any).uid(),
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
root.sgHistoricalLevels = sigmaPageController.sgHistoricalLevels;
root.sgVisibleLevels = sigmaPageController.sgVisibleLevels;
root.sgPeriodLevels = sigmaPageController.sgPeriodLevels;
root.sgPickTest = sigmaPageController.sgPickTest;
root.sgStatusPeriodId = sigmaPageController.sgStatusPeriodId;
root.sgSelectPeriod = sigmaPageController.sgSelectPeriod;
root.sgRemoveTracked = sigmaPageController.sgRemoveTracked;
/* sgOpenAddTest() (Giai đoạn 3) giờ mở modal React thật — root.sgOpenAddTest
   phải trỏ sang window.QCLabReact.sgOpenAddTest() (không phải
   sigmaPageController.sgOpenAddTestModel(), chỉ kiểm quyền chứ không mở gì)
   vì nút "+ Thêm xét nghiệm" nhúng trong emptyStateHtml() vẫn dùng
   data-action="sgOpenAddTest" cổ điển — action-dispatcher.ts tra thẳng
   global này, giống cách openConfigAssay() trỏ qua
   deps.openReactInstrumentModal(). */
root.sgOpenAddTest = () => (window as any).QCLabReact.sgOpenAddTest();
root.sgViewTrackedTest = sigmaPageController.sgViewTrackedTest;
root.sgTrackTest = sigmaPageController.sgTrackTest;
root.sigmaModel = sigmaPageController.sigmaModel;
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
root.sgBiasStats = sigmaPageController.sgBiasStats;
root.sgBiasRoundsKey = sigmaPageController.sgBiasRoundsKey;
root.sgBiasLinkedPeriodIds = sigmaPageController.sgBiasLinkedPeriodIds;
root.sgOpenBiasModel = sigmaPageController.sgOpenBiasModel;
root.sgApplyBiasToPeriods = sigmaPageController.sgApplyBiasToPeriods;
root.sgBiasApply = sigmaPageController.sgBiasApply;
root.sgMuPreview = sigmaPageController.sgMuPreview;
root.sgOpenMUModel = sigmaPageController.sgOpenMUModel;
/* sgOpenMU(eid) (Giai đoạn 3) giờ mở modal React thật — root.sgOpenMU phải trỏ
   sang window.QCLabReact.sgOpenMU(eid) (không phải
   sigmaPageController.sgOpenMUModel(eid), chỉ kiểm quyền+dựng dữ liệu chứ
   không mở gì) vì nút "Nhập u(Cal)" trong #sgMUAction (sgRefresh() vá
   innerHTML sau khi vẽ, không phải JSX) vẫn dùng data-action="sgOpenMU" cổ
   điển — action-dispatcher.ts tra thẳng global này, giống sgOpenAddTest. */
root.sgOpenMU = (eid: string) => (window as any).QCLabReact.sgOpenMU(eid);
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

/* Kernel — Giai đoạn 0 của việc gỡ global bridge (xem kế hoạch kiến trúc,
   "gỡ bỏ global bridge, đưa QC Lab sang kiến trúc React chuẩn"). Thay vì
   1.305+ tên `root.X=` rời rạc, gom MỘT đối tượng duy nhất, đặt tên theo
   miền đã có sẵn (mỗi trang đã tự trả về đúng nhóm hàm nó cần qua
   createXPageController() — không cần phát minh lại phân loại). Đây là bước
   ĐẦU TIÊN, THUẦN CỘNG THÊM: mọi root.X= cũ vẫn giữ nguyên song song, chưa
   trang React nào đọc qua đây — sẽ chuyển từng trang một ở giai đoạn sau.
   Đặt ở cuối file (sau khi mọi controller/service đã construct xong) để
   không có rủi ro thứ tự (mọi tham chiếu trong kernel trỏ tới biến ĐÃ TỒN
   TẠI, không phải constructor sẽ chạy sau). */
const kernel = {
  store: appStore,
  entry: {
    ...entryPageController,
    openRangeWorkflow: (root as any).openRangeWorkflow, revertRange: (root as any).revertRange,
  },
  actions: { ...actionsPageController, actionGuideSteps: (root as any).ActionGuidePresentation.steps },
  actionForm: actionFormController,
  sigma: sigmaPageController,
  westgard: {
    ...westgardPageController,
    wgSet: (root as any).wgSet, wgReset: (root as any).wgReset, wgSelectTest: (root as any).wgSelectTest,
  },
  reagent: reagentPageController,
  report: reportPageController,
  reportPrint: reportPrintController,
  dataIo: dataIoController,
  settings: {
    ...settingsPageController,
    exportData: (root as any).exportData, importData: (root as any).importData,
    verifyBackupFile: (root as any).verifyBackupFile, resetAllData: (root as any).resetAllData,
    lisGatewaySaveSettings: lisQueueController.lisGatewaySaveSettings, lisOpenQueueModal: lisQueueController.lisOpenQueueModal,
    lisQueueModel: lisQueueController.lisQueueModel, lisQueueRefresh: lisQueueController.lisQueueRefresh,
    lisQueueImport: lisQueueController.lisQueueImport, lisQueueReject: lisQueueController.lisQueueReject,
  },
  manage: {
    ...managePageController,
    setTargetPanel: manageTestsActionsController.setTargetPanel,
    setTargetGroup: manageTestsActionsController.setTargetGroup,
    setHistoryTest: manageTestsActionsController.setHistoryTest,
    setManageTab: manageTestsActionsController.setManageTab,
    openConfigInstrumentModel: manageTestsActionsController.openConfigInstrumentModel,
    deleteConfigInstrument: manageTestsActionsController.deleteConfigInstrument,
    saveConfigInstrument: manageTestsActionsController.saveConfigInstrument,
    openConfigAssayModel: manageTestsActionsController.openConfigAssayModel,
    saveConfigAssay: manageTestsActionsController.saveConfigAssay,
    configAssaySuggestionInput: manageTestsActionsController.configAssaySuggestionInput,
    configAssayInstrumentChanged: manageTestsActionsController.configAssayInstrumentChanged,
    delTest: manageTestsActionsController.delTest,
    openConfigPanelModel: manageTestsActionsController.openConfigPanelModel,
    saveConfigPanel: manageTestsActionsController.saveConfigPanel,
    deleteConfigPanel: manageTestsActionsController.deleteConfigPanel,
    openConfigLotModel: manageTestsActionsController.openConfigLotModel,
    saveConfigLot: manageTestsActionsController.saveConfigLot,
    deleteConfigLot: manageTestsActionsController.deleteConfigLot,
    openConfigGroupModel: manageTestsActionsController.openConfigGroupModel,
    suggestConfigGroupName: manageTestsActionsController.suggestConfigGroupName,
    saveConfigGroup: manageTestsActionsController.saveConfigGroup,
    openTargetMatrix: manageTestsActionsController.openTargetMatrix,
    activateLotGroup: manageTestsActionsController.activateLotGroup,
    toggleLotGroupStatus: manageTestsActionsController.toggleLotGroupStatus,
    deleteConfigGroup: manageTestsActionsController.deleteConfigGroup,
    openLotTransitionModel: manageTestsActionsController.openLotTransitionModel,
    lotTransitionTargetsModel: manageTestsActionsController.lotTransitionTargetsModel,
    lotTransitionChoiceMatch: manageTestsActionsController.lotTransitionChoiceMatch,
    lotTransitionChoiceLabel: manageTestsActionsController.lotTransitionChoiceLabel,
    saveLotTransitionV2: manageTestsActionsController.saveLotTransitionV2,
    deleteLotTransition: manageTestsActionsController.deleteLotTransition,
    openQcHistoryDetail: manageTestsActionsController.openQcHistoryDetail,
    toggleTargetRow: manageTestsActionsController.toggleTargetRow,
    syncTargetRange: manageTestsActionsController.syncTargetRange,
    setTargetLevel: manageTestsActionsController.setTargetLevel,
    targetCheckAll: manageTestsActionsController.targetCheckAll,
    saveTargetMatrix: manageTestsActionsController.saveTargetMatrix,
  },
  dash: { dashboardModel: dashboardPageController.dashboardModel, dashTestSetStatus: dashboardPageController.dashTestSetStatus },
  audit: {
    auditModel: (root as any).auditModel, auditSetQuery: (root as any).auditSetQuery,
    exportActivityCSV: (root as any).exportActivityCSV,
    activityTotal: () => (state.activity || []).length, confirmArchiveActivityLog: (root as any).confirmArchiveActivityLog,
    auditVerifyChainNow: (root as any).auditVerifyChainNow, auditSetPageSize: (root as any).auditSetPageSize,
    auditClearFilters: (root as any).auditClearFilters, auditSetPage: (root as any).auditSetPage,
    auditSetDate: (root as any).auditSetDate,
  },
  users: {
    usersModel: (root as any).usersModel, userPermChecks: (root as any).userPermChecks,
    addUser: (root as any).addUser, syncUserPermChecks: (root as any).syncUserPermChecks,
    resetPass: (root as any).resetPass, openUserPerms: (root as any).openUserPerms,
    applyUserPerms: (root as any).applyUserPerms,
    toggleUser: (root as any).toggleUser, delUser: (root as any).delUser,
  },
  /* Hàm/service dùng chung nhiều trang — KHÔNG thuộc riêng một page controller
     nào (định dạng, icon, quyền, render-cycle...). Namespace `pres` giữ đúng
     tên đã dùng trong các `deps.pres.*` của từng page controller (xem
     entry-page-controller.ts,...) cho nhất quán, dù ở đây gom rộng hơn một
     chút (không chỉ HTML-builder thuần mà cả các service nhỏ dùng chung). */
  pres: {
    esc: (root as any).esc, escAttr: (root as any).escAttr, btn: (root as any).btn,
    emptyState: (root as any).emptyState,
    fmt: (root as any).fmt, vnDate: (root as any).vnDate, fmtPointValue: (root as any).fmtPointValue,
    formatDateTimeVN: (root as any).formatDateTimeVN, testDisplayName: (root as any).testDisplayName,
    afterRender: (root as any).afterRender, normalizeSearchText: (root as any).normalizeSearchText,
    levelTargetOk: (root as any).levelTargetOk,
    icon: (root as any).icon, icoDownload: (root as any).icoDownload, icoPrint: (root as any).icoPrint,
    role: routerPermission.role, canWrite: routerPermission.canWrite, requireWrite: routerPermission.requireWrite,
    requireAdmin: routerPermission.requireAdmin, roleLabel: routerPermission.roleLabel, roleSelectOptions: routerPermission.roleSelectOptions,
    rolePageIds: (root as any).rolePageIds,
    settingsFirebaseGuideHtml: (root as any).settingsFirebaseGuideHtml,
    QCCore: root.QCCore, AnalysisUIState: (root as any).AnalysisUIState,
    go: (root as any).go,
    goManageTargets: (root as any).goManageTargets, dashboardGoEntryFollowup: (root as any).dashboardGoEntryFollowup,
    dashboardContinueAction: (root as any).dashboardContinueAction, dashViewTestInEntry: (root as any).dashViewTestInEntry,
    openConfigAssayModel: (root as any).openConfigAssayModel,
    reauthVerify: (root as any).reauthVerify, reauthAccountLabel: (root as any).reauthAccountLabel,
    currentUser: () => currentUser, openAvatarModal: () => (root as any).openAvatarModal(), logout: () => (root as any).logout(),
  },
};
/* root === globalThis luôn tồn tại (kể cả trong vm.createContext của
   tests/helpers/sandbox.js, không có window) — không cần guard
   typeof window!=='undefined' như trước (kernel chỉ cần gán qua root, và
   trong trình duyệt thật root===window nên hành vi không đổi). Đây là nền
   tảng để Giai đoạn 4 viết lại các sandbox test đọc qua __QC_KERNEL__ thay
   vì tên toàn cục rời rạc. */
(root as any).__QC_KERNEL__ = kernel;

// Retire classic assets/app.js (2026-08-20, Pha H lát 1) — boot entry point (9
// dòng, không có logic mới). Đặt CUỐI file (mọi service ở trên đã construct
// xong) và không tự gọi ngay như classic script — classic app.js là <script
// defer> RIÊNG, luôn nạp SAU toàn bộ script khác nên boot() chạy đúng lúc mọi
// thứ đã sẵn sàng; gộp vào cùng bundle này thì lời gọi module-load-time sẽ
// chạy TRƯỚC UI của nó có nghĩa gì (DOM #main chưa parse xong khi bundle này
// là <script defer> — vẫn chạy trước DOMContentLoaded) và sẽ crash mọi sandbox
// test tải bundle này mà không cấp document/window (phần lớn test hiện không
// cấp, vì trước đây app.js không nằm trong loadSandbox([...]) của bất kỳ test
// nào). Thay vào đó, đợi 'DOMContentLoaded' — theo đặc tả HTML, sự kiện này
// LUÔN nổ ra sau khi mọi <script defer> đã chạy xong (không có race), nên
// root.boot() vẫn chạy đúng lúc cũ mà không cần app.js làm <script> cuối cùng
// riêng. Guard kép `typeof document!=='undefined' && document.addEventListener`
// khớp đúng mẫu đã dùng cho 6 listener top-level khác trong file này — sandbox
// không cấp document thì bỏ qua hoàn toàn (không đăng ký, không lỗi); sandbox
// có cấp document stub tối giản (không addEventListener thật) thì đăng ký
// nhưng never fire, vẫn không lỗi và không chạy boot().
root.boot=async()=>{
  if(await loadBootState())await ensureAdmin().then(()=>{
    showLogin();
    setTimeout(()=>storageHydrationPromise.then(ok=>{if(ok)initFirebase();else showStartupRecovery();}),0);
  });
  else showStartupRecovery();
};
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('DOMContentLoaded',()=>{root.boot();});
