'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('index.html');
const drawSource = read('src/presentation/chart/qc-chart-renderer.ts');
const dashboardRoutesSource = read('src/presentation/dashboard/dashboard-page-controller.ts');
const manageRoutesSource = read('src/presentation/manage/manage-page-controller.ts');
const reagentClassicSource = read('src/presentation/reagent/reagent-page-controller.ts');
const actionsRoutesSource = read('src/presentation/actions/actions-page-controller.ts');
const backupUiSource = read('src/compat/modular-pilot.global.ts');
const backupLocalMarkerSource = read('src/application/backup/backup-local-marker.ts');
const backupInspectionSummarySource = read('src/presentation/backup/backup-inspection-summary.ts');
const backupInspectionMessageSource = read('src/presentation/backup/backup-inspection-message.ts');
const backupImportMessageSource = read('src/presentation/backup/backup-import-message.ts');
const backupOversizeConfirmationSource = read('src/presentation/backup/backup-oversize-confirmation.ts');
const backupFileNameSource = read('src/presentation/backup/backup-file-name.ts');
const backupSnapshotFileNameSource = read('src/presentation/backup/backup-snapshot-file-name.ts');
const backupSizeConfirmationSource = read('src/presentation/backup/backup-size-confirmation.ts');
const backupSizeWarningConfirmationSource = read('src/presentation/backup/backup-size-warning-confirmation.ts');
const backupExportMessageSource = read('src/presentation/backup/backup-export-message.ts');
const backupImportConfirmationSource = read('src/presentation/backup/backup-import-confirmation.ts');
const pkg = JSON.parse(read('package.json'));
const chartSource = read('src/domain/charts/chart-view-model.ts');
const entrySource = read('src/application/entry/entry-service.ts');
const backupSource = read('src/application/backup/backup-service.ts');
const auditSource = read('src/application/audit/audit-service.ts');
const lisSource = read('src/application/lis/lis-client-service.ts');
const manageSource = read('src/application/manage/manage-config-service.ts');
const periodSource = read('src/application/period/period-service.ts');
const warningSource = read('src/domain/qc/qc-point-warnings.ts');
const uiStateSource = read('src/presentation/state/ui-state.ts');
const reagentSource = read('src/application/reagent/reagent-comparison-service.ts');
const reagentReportPresentationSource = read('src/presentation/reagent/reagent-report-presentation.ts');
const cohortSource = read('src/domain/sigma/sigma-cohort-service.ts');
const sigmaPresentationSource = read('src/domain/sigma/sigma-presentation.ts');
const sigmaPeriodSource = read('src/domain/sigma/sigma-period-view-model.ts');
const sigmaBiasSource = read('src/domain/sigma/sigma-bias-service.ts');
const sigmaCohortImportSource = read('src/application/sigma/sigma-cohort-import-service.ts');
const sigmaPeriodRecordSource = read('src/application/sigma/sigma-period-record-service.ts');
const sigmaLevelEditSource = read('src/application/sigma/sigma-level-edit-service.ts');
const sigmaTrackedTestSource = read('src/application/sigma/sigma-tracked-test-service.ts');
const sigmaBiasWorkflowSource = read('src/application/sigma/sigma-bias-workflow-service.ts');
const sigmaMuWorkflowSource = read('src/application/sigma/sigma-mu-workflow-service.ts');
const sigmaCohortSelectionSource = read('src/application/sigma/sigma-cohort-selection-service.ts');
const sigmaTeaEditSource = read('src/application/sigma/sigma-tea-edit-service.ts');
const sigmaTeaSnapshotSource = read('src/application/sigma/sigma-tea-snapshot-service.ts');
const sigmaLevelSelectionSource = read('src/domain/sigma/sigma-level-selection-service.ts');
const sigmaPeriodSelectionSource = read('src/presentation/sigma/sigma-period-selection-service.ts');
const westgardSource = read('src/domain/westgard/westgard-view-model.ts');
const westgardRowWindowSource = read('src/presentation/westgard/westgard-row-window.ts');
const westgardArchivedGroupsSource = read('src/presentation/westgard/westgard-archived-groups.ts');
const westgardArchivedMultiViewsSource = read('src/presentation/westgard/westgard-archived-multi-views.ts');
const westgardArchivedGroupMatchSource = read('src/presentation/westgard/westgard-archived-group-match.ts');
const reportSearchValuesSource = read('src/presentation/report/report-search-values.ts');
const westgardArchivedTestSelectionSource = read('src/presentation/westgard/westgard-archived-test-selection.ts');
const reagentPairsSource = read('src/domain/reagent/reagent-pairs.ts');
const reagentStatisticsSource = read('src/domain/reagent/reagent-statistics.ts');
const reagentTDistributionSource = read('src/domain/reagent/reagent-t-distribution.ts');
const reagentCalculationSource = read('src/domain/reagent/reagent-comparison-calculation.ts');
const reagentChartRangeSource = read('src/presentation/reagent/reagent-chart-range.ts');
const reagentReportItemsSource = read('src/presentation/reagent/reagent-report-items.ts');
const reagentComparisonLabelSource = read('src/presentation/reagent/reagent-comparison-label.ts');
const reportActionIconSource = read('src/presentation/report/report-action-icon.ts');
const reagentQuickLabelSource = read('src/presentation/reagent/reagent-quick-label.ts');
const reagentToolIconSource = read('src/presentation/reagent/reagent-tool-icon.ts');
const protocolSource = read('src/domain/nce/action-protocol-service.ts');
const reviewSource = read('src/application/nce/action-review-service.ts');
const escalationSource = read('src/application/nce/action-escalation-service.ts');
const recordSource = read('src/application/nce/action-record-service.ts');
const rerunSource = read('src/application/nce/action-rerun-service.ts');
const pointIndexSource = read('src/application/nce/action-point-index-service.ts');
const syncStateMergeSource = read('src/domain/sync/state-merge.ts');
const syncSnapshotSource = read('src/domain/sync/snapshot-keys.ts');
const syncRetrySource = read('src/domain/sync/retry-scheduler.ts');
const firstConnectSource = read('src/domain/sync/first-connect.ts');
const runIdNormalizerSource = read('src/domain/qc/run-id-normalizer.ts');
const pointLotNormalizerSource = read('src/domain/qc/point-lot-normalizer.ts');
const lotLineageSource = read('src/domain/qc/lot-lineage.ts');
const operationalAccessSource = read('src/domain/qc/operational-access.ts');
const parallelLotLookupSource = read('src/domain/qc/parallel-lot-lookup.ts');
const workerJobSource = read('src/domain/westgard/worker-job.ts');
const workerRevisionSource = read('src/domain/westgard/worker-revision.ts');
const workerHydrateSource = read('src/domain/westgard/worker-hydrate.ts');
const workerPrewarmSource = read('src/domain/westgard/worker-prewarm.ts');
const partitionWritePolicySource = read('src/application/storage/partition-write-policy.ts');
const saveCommandPolicySource = read('src/application/storage/save-command-policy.ts');
const storageBootServiceSource = read('src/application/storage/storage-boot-service.ts');
const indexedDbRecoveryServiceSource = read('src/application/storage/indexeddb-recovery-service.ts');
const partitionHydrationServiceSource = read('src/application/storage/partition-hydration-service.ts');
const indexedDbMirrorServiceSource = read('src/application/storage/indexeddb-mirror-service.ts');
const localStorageLoadServiceSource = read('src/application/storage/local-storage-load-service.ts');
const localStorageSnapshotWriterSource = read('src/application/storage/local-storage-snapshot-writer.ts');
const partitionedSnapshotWriterSource = read('src/application/storage/partitioned-snapshot-writer.ts');
const saveServiceSource = read('src/application/storage/save-service.ts');
const firebaseLocalStoreServiceSource = read('src/application/sync/firebase-local-store-service.ts');
const firebaseDisconnectServiceSource = read('src/application/sync/firebase-disconnect-service.ts');
const firebasePushServiceSource = read('src/application/sync/firebase-push-service.ts');
const firebaseFullSyncServiceSource = read('src/application/sync/firebase-full-sync-service.ts');
const firebasePushSchedulerSource = read('src/application/sync/firebase-push-scheduler.ts');
const firebaseEmptySnapshotServiceSource = read('src/application/sync/firebase-empty-snapshot-service.ts');
const firebaseOwnSnapshotServiceSource = read('src/application/sync/firebase-own-snapshot-service.ts');
const firebaseInvalidSnapshotServiceSource = read('src/application/sync/firebase-invalid-snapshot-service.ts');
const firebaseAuditRejectionServiceSource = read('src/application/sync/firebase-audit-rejection-service.ts');
const firebaseRemoteRenderServiceSource = read('src/application/sync/firebase-remote-render-service.ts');
const firebaseSessionStartServiceSource = read('src/application/sync/firebase-session-start-service.ts');
const firebaseMergeCommitServiceSource = read('src/application/sync/firebase-merge-commit-service.ts');
const firebaseConflictDialogServiceSource = read('src/presentation/sync/firebase-conflict-dialog-service.ts');
const firebaseCloudStatusPresentationSource = read('src/presentation/sync/firebase-cloud-status-presentation.ts');
const firebaseSaveStatusServiceSource = read('src/presentation/sync/firebase-save-status-service.ts');
const firebaseRemoteRenderSafetyServiceSource = read('src/presentation/sync/firebase-remote-render-safety-service.ts');
const firebaseAppServiceSource = read('src/application/sync/firebase-app-service.ts');
const firebaseConfigSourceServiceSource = read('src/application/sync/firebase-config-source-service.ts');
const firebaseReadyStateSource = read('src/domain/sync/firebase-ready-state.ts');
const indexedDbOpenServiceSource = read('src/application/storage/indexeddb-open-service.ts');
const indexedDbRecordServiceSource = read('src/application/storage/indexeddb-record-service.ts');
const partitionedIndexedDbWriteServiceSource = read('src/application/storage/partitioned-indexeddb-write-service.ts');
const partitionedIndexedDbReadServiceSource = read('src/application/storage/partitioned-indexeddb-read-service.ts');
const indexedDbClearServiceSource = read('src/application/storage/indexeddb-clear-service.ts');
const passwordPolicySource = read('src/domain/auth/password-policy.ts');
const pbkdf2PasswordServiceSource = read('src/domain/auth/pbkdf2-password-service.ts');
const legacyPasswordHashServiceSource = read('src/domain/auth/legacy-password-hash-service.ts');
const loginLockoutPolicySource = read('src/domain/auth/login-lockout-policy.ts');
const blankAppStateSource = read('src/application/state/blank-app-state.ts');
const defaultAdminUserSource = read('src/domain/auth/default-admin-user.ts');
const newUserValidationSource = read('src/domain/auth/new-user-validation.ts');
const userPermissionSelectionSource = read('src/domain/auth/user-permission-selection.ts');
const activityAuditFilterSource = read('src/presentation/audit/activity-audit-filter.ts');
const activityAuditPaginationSource = read('src/presentation/audit/activity-audit-pagination.ts');
const activityAuditCsvSource = read('src/presentation/audit/activity-audit-csv.ts');
const activityAuditDateRangeSource = read('src/presentation/audit/activity-audit-date-range.ts');
const activityAuditFilterStateSource = read('src/presentation/audit/activity-audit-filter-state.ts');
const activityAuditArchiveWindowSource = read('src/presentation/audit/activity-audit-archive-window.ts');
const actionBiasSource = read('src/domain/nce/action-bias-service.ts');
const actionViolationSource = read('src/domain/nce/action-violation-service.ts');
const actionListPresentationSource = read('src/presentation/nce/action-list-presentation.ts');
const actionEvidencePresentationSource = read('src/presentation/nce/action-evidence-presentation.ts');
const actionRerunEvidencePresentationSource = read('src/presentation/nce/action-rerun-evidence-presentation.ts');
const actionStatusPresentationSource = read('src/presentation/nce/action-status-presentation.ts');
const actionReviewPresentationSource = read('src/presentation/nce/action-review-presentation.ts');
const actionDetailPresentationSource = read('src/presentation/nce/action-detail-presentation.ts');
const actionGuidePresentationSource = read('src/presentation/nce/action-guide-presentation.ts');
const actionInvestigationPresentationSource = read('src/presentation/nce/action-investigation-presentation.ts');
const actionChecklistPresentationSource = read('src/presentation/nce/action-checklist-presentation.ts');
const reportPeriodPresentationSource = read('src/presentation/report/report-period-presentation.ts');
const rangeCandidateSource = read('src/domain/qc/range-candidate.ts');
const rangeSafetyGateSource = read('src/domain/qc/range-safety-gate.ts');
const csvCellSource = read('src/domain/export/csv-cell.ts');
const reportExportHelpersSource = read('src/presentation/report/export-helpers.ts');
const actionReportSummarySource = read('src/presentation/nce/action-report-summary.ts');
const actionReportModelSource = read('src/presentation/nce/action-report-model.ts');
const sigmaReportMetricSource = read('src/presentation/sigma/sigma-report-metric.ts');
const sigmaMdcItemsSource = read('src/presentation/sigma/sigma-mdc-items.ts');
const sigmaMdcLabelPlacementSource = read('src/presentation/sigma/sigma-mdc-label-placement.ts');
const sigmaExportPixelRatioSource = read('src/presentation/sigma/sigma-export-pixel-ratio.ts');
const sigmaReportRowsSource = read('src/presentation/sigma/sigma-report-rows.ts');
const qcReportRowsSource = read('src/presentation/report/qc-report-rows.ts');
const qcReportContextSource = read('src/presentation/report/qc-report-context.ts');
const dataUrlBytesSource = read('src/presentation/sigma/data-url-bytes.ts');
const sigmaExportMetaSource = read('src/presentation/sigma/sigma-export-meta.ts');
const exportMetaRowsSource = read('src/presentation/report/export-meta-rows.ts');
const qcExportValueFormatSource = read('src/presentation/report/qc-export-value-format.ts');
const canvasFontSource = read('src/presentation/sigma/canvas-font.ts');
const reportLabelsSource = read('src/presentation/report/report-labels.ts');
const reportSelectionSource = read('src/presentation/report/report-selection.ts');
const reportSearchSource = read('src/presentation/report/report-search.ts');
const sigmaMuTraceSource = read('src/presentation/sigma/sigma-mu-trace.ts');
const sigmaPrintRowsSource = read('src/presentation/sigma/sigma-print-rows.ts');
const sigmaMuPrintRowsSource = read('src/presentation/sigma/sigma-mu-print-rows.ts');
const reportPointsTableSource = read('src/presentation/report/report-points-table.ts');
const actionReportHtmlSource = read('src/presentation/nce/action-report-html.ts');
const sigmaDraftServiceSource = read('src/application/storage/sigma-draft-service.ts');
const stateAdoptionServiceSource = read('src/application/storage/state-adoption-service.ts');
const corruptLocalQuarantineSource = read('src/application/storage/corrupt-local-quarantine.ts');
const syncValueCodecSource = read('src/domain/sync/value-codec.ts');
const firebaseConfigSelectionSource = read('src/domain/sync/firebase-config-selection.ts');
const firebaseConnectionGateSource = read('src/domain/sync/firebase-connection-gate.ts');
const snapshotSignatureSource = read('src/domain/sync/snapshot-signature.ts');
const derivedCacheInvalidationSource = read('src/application/state/derived-cache-invalidation.ts');
const configurationRelationsSource = read('src/application/state/configuration-relations.ts');
const testConfigurationSource = read('src/application/state/test-configuration-normalization.ts');
const foundationNormalizationSource = read('src/application/state/foundation-normalization.ts');
const stateLifecycleNormalizationSource = read('src/application/state/state-lifecycle-normalization.ts');
const csvDownloadSource = read('src/presentation/export/csv-download.ts');
const cssTokenPixelSource = read('src/presentation/style/css-token-pixel.ts');
const chartCanvasFontSource = read('src/presentation/chart/canvas-font.ts');
const chartDataUrlSource = read('src/presentation/chart/chart-data-url.ts');
const dashboardHeadHtmlSource = read('src/presentation/dashboard/dashboard-head-html.ts');
const dashboardTestPanelHtmlSource = read('src/presentation/dashboard/dashboard-test-panel-html.ts');
const dashboardTestRowHtmlSource = read('src/presentation/dashboard/dashboard-test-row-html.ts');
const dashboardKpiItemsSource = read('src/presentation/dashboard/dashboard-kpi-items.ts');
const dashboardEmptyTestsHtmlSource = read('src/presentation/dashboard/dashboard-empty-tests-html.ts');
const cusumColorsSource = read('src/presentation/chart/cusum-colors.ts');
const leveyJenningsMultiColorsSource = read('src/presentation/chart/levey-jennings-multi-colors.ts');
const cusumChartTitleSource = read('src/presentation/chart/cusum-chart-title.ts');
const leveyJenningsChartTitleSource = read('src/presentation/chart/levey-jennings-chart-title.ts');
const chartEmptyLabelsSource = read('src/presentation/chart/chart-empty-labels.ts');
const leveyJenningsMultiYAxisSource = read('src/presentation/chart/levey-jennings-multi-y-axis.ts');
const leveyJenningsMultiGeometrySource = read('src/presentation/chart/levey-jennings-multi-geometry.ts');
const configNavScrollServiceSource = read('src/presentation/render/config-nav-scroll-service.ts');
const entryJumpScrollServiceSource = read('src/presentation/render/entry-jump-scroll-service.ts');
const defaultDateFieldsServiceSource = read('src/presentation/render/default-date-fields-service.ts');
const postRenderPageActionsSource = read('src/presentation/render/post-render-page-actions.ts');
const afterRenderControllerSource = read('src/presentation/render/after-render-controller.ts');
const dashboardOverdueActionsSource = read('src/presentation/dashboard/dashboard-overdue-actions.ts');
const dashboardOverdueActionListHtmlSource = read('src/presentation/dashboard/dashboard-overdue-action-list-html.ts');
const dashboardQcFollowupListHtmlSource = read('src/presentation/dashboard/dashboard-qc-followup-list-html.ts');
const dashboardMissingTargetListHtmlSource = read('src/presentation/dashboard/dashboard-missing-target-list-html.ts');
const dashboardExpiringLotItemsSource = read('src/presentation/dashboard/dashboard-expiring-lot-items.ts');
const dashboardWestgardAlertsSource = read('src/presentation/dashboard/dashboard-westgard-alerts.ts');
const dashboardMissingTargetItemsSource = read('src/presentation/dashboard/dashboard-missing-target-items.ts');
const dashboardLevelDataSource = read('src/presentation/dashboard/dashboard-level-data.ts');
const dashboardTestActionSource = read('src/presentation/dashboard/dashboard-test-action.ts');
const dashboardLevelPillsHtmlSource = read('src/presentation/dashboard/dashboard-level-pills-html.ts');
const dashboardTestRowsHtmlSource = read('src/presentation/dashboard/dashboard-test-rows-html.ts');
const dashboardTestItemsSource = read('src/presentation/dashboard/dashboard-test-items.ts');
const visibleCanvasServiceSource = read('src/presentation/render/visible-canvas-service.ts');
const chartTooltipServiceSource = read('src/presentation/chart/chart-tooltip-service.ts');
const leveyJenningsTooltipControllerSource = read('src/presentation/chart/levey-jennings-tooltip-controller.ts');
const hiDpiCanvasSource = read('src/presentation/chart/hi-dpi-canvas.ts');
const leveyJenningsGeometrySource = read('src/presentation/chart/levey-jennings-geometry.ts');
const westgardRuleScopeSource = read('src/presentation/chart/westgard-rule-scope.ts');
const leveyJenningsColorsSource = read('src/presentation/chart/levey-jennings-colors.ts');
const leveyJenningsTicksSource = read('src/presentation/chart/levey-jennings-ticks.ts');
const leveyJenningsYAxisSource = read('src/presentation/chart/levey-jennings-y-axis.ts');
const leveyJenningsHoverModelSource = read('src/presentation/chart/levey-jennings-hover-model.ts');
const leveyJenningsPointStyleSource = read('src/presentation/chart/levey-jennings-point-style.ts');
const leveyJenningsDisplayPlanSource = read('src/presentation/chart/levey-jennings-display-plan.ts');
const leveyJenningsPointRenderModelSource = read('src/presentation/chart/levey-jennings-point-render-model.ts');
const leveyJenningsBandsSource = read('src/presentation/chart/levey-jennings-bands.ts');
const leveyJenningsGridSource = read('src/presentation/chart/levey-jennings-grid.ts');
const leveyJenningsMultiSeriesSource = read('src/presentation/chart/levey-jennings-multi-series.ts');
const leveyJenningsMultiRunTicksSource = read('src/presentation/chart/levey-jennings-multi-run-ticks.ts');
const leveyJenningsLegendLayoutSource = read('src/presentation/chart/levey-jennings-legend-layout.ts');
const leveyJenningsMultiDisplayPlanSource = read('src/presentation/chart/levey-jennings-multi-display-plan.ts');
const leveyJenningsMultiHoverModelSource = read('src/presentation/chart/levey-jennings-multi-hover-model.ts');
const leveyJenningsMultiPointRenderModelSource = read('src/presentation/chart/levey-jennings-multi-point-render-model.ts');
const leveyJenningsMultiDividersSource = read('src/presentation/chart/levey-jennings-multi-dividers.ts');
const cusumChartGeometrySource = read('src/presentation/chart/cusum-chart-geometry.ts');
const cusumDisplayPlanSource = read('src/presentation/chart/cusum-display-plan.ts');
const cusumHoverModelSource = read('src/presentation/chart/cusum-hover-model.ts');
const cusumPointRenderModelSource = read('src/presentation/chart/cusum-point-render-model.ts');
const cusumReferenceLinesSource = read('src/presentation/chart/cusum-reference-lines.ts');
const cusumLinePointsSource = read('src/presentation/chart/cusum-line-points.ts');
const blobDownloadSource = read('src/presentation/export/blob-download.ts');
const xlsxCellSource = read('src/presentation/export/xlsx-cell.ts');
const xlsxZipSource = read('src/presentation/export/xlsx-zip.ts');
const xlsxPeriodSource = read('src/presentation/export/xlsx-period.ts');
const xlsxDrawingSource = read('src/presentation/export/xlsx-drawing.ts');
const sigmaXlsxStylesSource = read('src/presentation/sigma/sigma-xlsx-styles.ts');
const reportXlsxStylesSource = read('src/presentation/report/report-xlsx-styles.ts');
const reportXlsxDrawingSource = read('src/presentation/report/report-xlsx-drawing.ts');
const reportXlsxSheetSource = read('src/presentation/report/report-xlsx-sheet.ts');
const reportXlsxBuilderSource = read('src/presentation/report/report-xlsx-builder.ts');
const xlsxEscapeSource = read('src/presentation/export/xlsx-escape.ts');
const reportXlsxStyleIdsSource = read('src/presentation/report/report-xlsx-style-ids.ts');
const xlsxColumnsSource = read('src/presentation/export/xlsx-columns.ts');
const xlsxEmuSource = read('src/presentation/export/xlsx-emu.ts');
const sigmaChartRendererSource = read('src/presentation/sigma/sigma-chart-renderer.ts');
const sigmaMdcRendererSource = read('src/presentation/sigma/sigma-mdc-renderer.ts');
const xlsxRoundingSource = read('src/presentation/export/xlsx-rounding.ts');
const adapter = read('src/compat/modular-pilot.global.ts');
const generated = read('assets/generated/modular-pilot.js');
assert.match(backupLocalMarkerSource, /export function createBackupLocalMarker\(/,
  'backup local marker must be a TypeScript factory');
assert.match(dashboardHeadHtmlSource, /export function createDashboardHeadHtml\(/,
  'dashboard head HTML must be a TypeScript factory');
assert.match(read('src/presentation/dashboard/dashboard-loading.ts'), /deps\.kpisHtml\(/,
  'dashboard loading presentation must receive the TypeScript KPI renderer');
assert.match(read('src/presentation/dashboard/dashboard-loading.ts'), /deps\.headHtml\(lab\)/,
  'dashboard loading presentation must receive the TypeScript head renderer');
assert.match(dashboardTestPanelHtmlSource, /export function createDashboardTestPanelHtml\(/,
  'dashboard test panel HTML must be a TypeScript factory');
assert.match(dashboardTestRowHtmlSource, /export function createDashboardTestRowHtml\(/,
  'dashboard test row HTML must be a TypeScript factory');
assert.match(dashboardKpiItemsSource, /export function dashboardKpiItems\(/,
  'dashboard KPI items must be a TypeScript helper');
assert.match(dashboardEmptyTestsHtmlSource, /export function createDashboardEmptyTestsHtml\(/,
  'dashboard empty tests HTML must be a TypeScript factory');
assert.match(cusumColorsSource, /export const CUSUM_COLORS=/,
  'CUSUM colors must be a TypeScript presentation constant');
assert.match(leveyJenningsMultiColorsSource, /export const LEVEY_JENNINGS_MULTI_COLORS=/,
  'multi-level Levey-Jennings colors must be a TypeScript presentation constant');
assert.match(cusumChartTitleSource, /export function createCusumChartTitle\(/,
  'CUSUM chart title must be a TypeScript factory');
assert.match(leveyJenningsChartTitleSource, /export const LEVEY_JENNINGS_CHART_TITLE=/,
  'Levey-Jennings chart titles must be a TypeScript presentation constant');
assert.match(chartEmptyLabelsSource, /export const CHART_EMPTY_LABELS=/,
  'chart empty labels must be a TypeScript presentation constant');
assert.match(leveyJenningsMultiYAxisSource, /export function leveyJenningsMultiYAxis\(/,
  'multi-level Levey-Jennings Y axis must be a TypeScript helper');
assert.match(leveyJenningsMultiGeometrySource, /export function leveyJenningsMultiGeometry\(/,
  'multi-level Levey-Jennings geometry must be a TypeScript helper');
assert.match(configNavScrollServiceSource, /export function createConfigNavScrollService\(/,
  'config nav scroll must be a TypeScript service');
assert.match(entryJumpScrollServiceSource, /export function createEntryJumpScrollService\(/,
  'entry jump scroll must be a TypeScript service');
assert.match(defaultDateFieldsServiceSource, /export function createDefaultDateFieldsService\(/,
  'default date fields must be a TypeScript service');
assert.match(postRenderPageActionsSource, /export function createPostRenderPageActions\(/,
  'post-render page actions must be a TypeScript service');
assert.match(dashboardOverdueActionsSource, /export function createDashboardOverdueActions\(/,
  'dashboard overdue actions must be a TypeScript factory');
assert.match(dashboardOverdueActionListHtmlSource, /export function createDashboardOverdueActionListHtml\(/,
  'dashboard overdue action list must be a TypeScript factory');
assert.match(dashboardQcFollowupListHtmlSource, /export function createDashboardQcFollowupListHtml\(/,
  'dashboard QC followup list must be a TypeScript factory');
assert.match(dashboardMissingTargetListHtmlSource, /export function createDashboardMissingTargetListHtml\(/,
  'dashboard missing target list must be a TypeScript factory');
assert.match(dashboardExpiringLotItemsSource, /export function dashboardExpiringLotItems\(/,
  'dashboard expiring lot items must be a TypeScript helper');
assert.match(dashboardWestgardAlertsSource, /export function dashboardWestgardAlerts\(/,
  'dashboard Westgard alerts must be a TypeScript helper');
assert.match(dashboardMissingTargetItemsSource, /export function dashboardMissingTargetItems\(/,
  'dashboard missing target items must be a TypeScript helper');
assert.match(dashboardLevelDataSource, /export function createDashboardLevelData\(/,
  'dashboard level data must be a TypeScript factory');
assert.match(dashboardTestActionSource, /export function createDashboardTestAction\(/,
  'dashboard test action must be a TypeScript factory');
assert.match(dashboardLevelPillsHtmlSource, /export function createDashboardLevelPillsHtml\(/,
  'dashboard level pills must be a TypeScript factory');
assert.match(dashboardTestRowsHtmlSource, /export function createDashboardTestRowsHtml\(/,
  'dashboard test rows must be a TypeScript factory');
assert.match(dashboardTestItemsSource, /export function createDashboardTestItems\(/,
  'dashboard test items must be a TypeScript factory');
assert.match(backupInspectionSummarySource, /export function createBackupInspectionSummary\(/,
  'backup inspection summary must be a TypeScript factory');
assert.match(backupInspectionMessageSource, /export function createBackupInspectionMessage\(/,
  'backup inspection message must be a TypeScript factory');
assert.match(backupImportMessageSource, /export function createBackupImportMessage\(/,
  'backup import message must be a TypeScript factory');
assert.match(backupOversizeConfirmationSource, /export function createBackupOversizeConfirmation\(/,
  'backup oversize confirmation must be a TypeScript factory');
assert.match(backupFileNameSource, /export function createBackupFileName\(/,
  'backup file name must be a TypeScript factory');
assert.match(backupSnapshotFileNameSource, /export function createBackupSnapshotFileName\(/,
  'backup snapshot file name must be a TypeScript factory');
assert.match(backupSizeConfirmationSource, /export function createBackupSizeConfirmation\(/,
  'backup size confirmation must be a TypeScript factory');
assert.match(backupSizeWarningConfirmationSource, /export function createBackupSizeWarningConfirmation\(/,
  'backup size warning confirmation must be a TypeScript factory');
assert.match(backupExportMessageSource, /export function createBackupExportMessage\(/,
  'backup export message must be a TypeScript factory');
assert.match(backupImportConfirmationSource, /export function createBackupImportConfirmation\(/,
  'backup import confirmation must be a TypeScript factory');
assert.doesNotMatch(backupLocalMarkerSource, /\bglobalThis\b|\bdocument\b|\blocalStorage\b/,
  'backup local marker must receive browser storage as a dependency');
assert.doesNotMatch(dashboardHeadHtmlSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard head HTML must receive browser helpers as dependencies');
assert.doesNotMatch(dashboardTestPanelHtmlSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard test panel HTML must receive browser helpers as dependencies');
assert.doesNotMatch(dashboardTestRowHtmlSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard test row HTML must receive browser helpers as dependencies');
assert.doesNotMatch(dashboardKpiItemsSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard KPI items must not read browser globals');
assert.doesNotMatch(dashboardEmptyTestsHtmlSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard empty tests HTML must receive UI helpers as dependencies');
assert.doesNotMatch(cusumColorsSource, /\bglobalThis\b|\bdocument\b/,
  'CUSUM colors must not read browser globals');
assert.doesNotMatch(leveyJenningsMultiColorsSource, /\bglobalThis\b|\bdocument\b/,
  'multi-level Levey-Jennings colors must not read browser globals');
assert.doesNotMatch(cusumChartTitleSource, /\bglobalThis\b|\bdocument\b/,
  'CUSUM chart title must receive formatting as a dependency');
assert.doesNotMatch(leveyJenningsChartTitleSource, /\bglobalThis\b|\bdocument\b/,
  'Levey-Jennings chart titles must not read browser globals');
assert.doesNotMatch(chartEmptyLabelsSource, /\bglobalThis\b|\bdocument\b/,
  'chart empty labels must not read browser globals');
assert.doesNotMatch(leveyJenningsMultiYAxisSource, /\bglobalThis\b|\bdocument\b/,
  'multi-level Levey-Jennings Y axis must not read browser globals');
assert.doesNotMatch(leveyJenningsMultiGeometrySource, /\bglobalThis\b|\bdocument\b/,
  'multi-level Levey-Jennings geometry must not read browser globals');
assert.doesNotMatch(configNavScrollServiceSource, /\bglobalThis\b|\bdocument\b/,
  'config nav scroll service must receive browser access as dependencies');
assert.doesNotMatch(entryJumpScrollServiceSource, /\bglobalThis\b|\bdocument\b/,
  'entry jump scroll service must receive browser access as dependencies');
assert.doesNotMatch(defaultDateFieldsServiceSource, /\bglobalThis\b|\bdocument\b/,
  'default date fields service must receive browser access as dependencies');
assert.doesNotMatch(postRenderPageActionsSource, /\bglobalThis\b|\bdocument\b/,
  'post-render page actions service must receive browser access as dependencies');
assert.doesNotMatch(dashboardOverdueActionsSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard overdue actions must receive status evaluation as a dependency');
assert.doesNotMatch(dashboardOverdueActionListHtmlSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard overdue action list must receive rendering as a dependency');
assert.doesNotMatch(dashboardQcFollowupListHtmlSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard QC followup list must receive rendering as a dependency');
assert.doesNotMatch(dashboardMissingTargetListHtmlSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard missing target list must receive rendering as a dependency');
assert.doesNotMatch(dashboardExpiringLotItemsSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard expiring lot items must receive date calculation as a dependency');
assert.doesNotMatch(dashboardWestgardAlertsSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard Westgard alerts must not read browser globals');
assert.doesNotMatch(dashboardMissingTargetItemsSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard missing target items must receive target lookup as a dependency');
assert.doesNotMatch(dashboardLevelDataSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard level data must receive statistics as a dependency');
assert.doesNotMatch(dashboardTestActionSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard test action must receive button rendering as a dependency');
assert.doesNotMatch(dashboardLevelPillsHtmlSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard level pills must receive rendering as dependencies');
assert.doesNotMatch(dashboardTestRowsHtmlSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard test rows must receive rendering as dependencies');
assert.doesNotMatch(dashboardTestItemsSource, /\bglobalThis\b|\bdocument\b/,
  'dashboard test items must receive data access as dependencies');
assert.doesNotMatch(backupInspectionSummarySource, /\bglobalThis\b|\bdocument\b/,
  'backup inspection summary must receive formatting as a dependency');
assert.doesNotMatch(backupInspectionMessageSource, /\bglobalThis\b|\bdocument\b/,
  'backup inspection message must not read browser globals');
assert.doesNotMatch(backupImportMessageSource, /\bglobalThis\b|\bdocument\b/,
  'backup import message must not read browser globals');
assert.doesNotMatch(backupOversizeConfirmationSource, /\bglobalThis\b|\bdocument\b/,
  'backup oversize confirmation must not read browser globals');
assert.doesNotMatch(backupFileNameSource, /\bglobalThis\b|\bdocument\b/,
  'backup file name must receive date formatting as a dependency');
assert.doesNotMatch(backupSnapshotFileNameSource, /\bglobalThis\b|\bdocument\b/,
  'backup snapshot file name must receive clock as a dependency');
assert.doesNotMatch(backupSizeConfirmationSource, /\bglobalThis\b|\bdocument\b/,
  'backup size confirmation must receive sizing as dependencies');
assert.doesNotMatch(backupSizeWarningConfirmationSource, /\bglobalThis\b|\bdocument\b/,
  'backup size warning confirmation must receive warning as a dependency');
assert.doesNotMatch(backupExportMessageSource, /\bglobalThis\b|\bdocument\b/,
  'backup export message must not read browser globals');
assert.doesNotMatch(backupImportConfirmationSource, /\bglobalThis\b|\bdocument\b/,
  'backup import confirmation must not read browser globals');
assert.match(backupUiSource, /root\.backupStatusText=\(\)=>root\.BackupStatusCommand\.status\(/,
  'backup status must use the TypeScript status command');
assert.match(dashboardRoutesSource, /deps\.dashboardHeadHtml\(deps\.stateLab\(\)\)/,
  'dashboard route must render header through TypeScript bridge');
assert.match(dashboardRoutesSource, /const pageDashLoading = \(tests: AnyRec\[\], pending: number\) => deps\.dashboardLoadingPresentation\(tests, pending, deps\.stateData\(\), deps\.stateLab\(\)\);/,
  'dashboard loading route must use the TypeScript renderer directly');
assert.doesNotMatch(dashboardRoutesSource, /dashStatusTabsFallback/,
  'dashboard route must not retain a classic status-tab renderer');
assert.doesNotMatch(dashboardRoutesSource, /let mood=rej\?/,
  'dashboard route must not retain a duplicate classic shift-status renderer');
assert.match(dashboardRoutesSource, /const statusItems = dashItems\.filter\(item => deps\.dashboardStatusFilter\.matches\(item, dashTestStatus\)\);/,
  'dashboard route must filter statuses through the TypeScript service directly');
assert.match(dashboardRoutesSource, /const overdue = deps\.dashboardOverdueActions\(deps\.stateActions\(\), today\);/,
  'dashboard route must collect overdue actions through TypeScript service');
assert.match(dashboardRoutesSource, /const overdueHtml = deps\.dashboardOverdueActionListHtml\(overdue, deps\.stateTests\(\)\);/,
  'dashboard route must render overdue actions through TypeScript service');
assert.match(dashboardRoutesSource, /const urgentHtml = deps\.dashboardQcFollowupListHtml\(urgent, 5, 'rej'\);/,
  'dashboard route must render urgent followup through TypeScript service');
assert.match(dashboardRoutesSource, /const noTargetHtml = deps\.dashboardMissingTargetListHtml\(noTarget\);/,
  'dashboard route must render missing targets through TypeScript service');
assert.match(dashboardRoutesSource, /const exp = deps\.dashboardExpiringLotItems\(dashItems, deps\.daysToExp\);/,
  'dashboard route must collect expiring lots through TypeScript helper');
assert.match(dashboardRoutesSource, /const \{ urgent, watch \} = deps\.dashboardWestgardAlerts\(dashItems\.map\(item => \(\{ test: item\.t, alerts: item\.alerts \}\)\)\);/,
  'dashboard route must collect Westgard alerts through TypeScript helper');
assert.match(dashboardRoutesSource, /const noTarget = deps\.dashboardMissingTargetItems\(dashItems, deps\.levelsMissingTarget\);/,
  'dashboard route must collect missing targets through TypeScript helper');
assert.match(dashboardRoutesSource, /const dashItems = deps\.dashboardTestItems\(tests, today\);/,
  'dashboard route must build test items through TypeScript presentation');
assert.match(actionsRoutesSource, /const currentIssues = \(\) => deps\.ActionCurrentIssues\(\);/,
  'actions route must use the TypeScript current-issues service directly');
assert.doesNotMatch(actionsRoutesSource, /const out=\[\],rank=\{rej:2,warn:1,ok:0\}/,
  'actions route must not retain a classic current-issues fallback');
assert.match(actionsRoutesSource, /const actionIssueGroupHtml = \(model: AnyRec\) => deps\.pres\.actionIssueGroupPresentation\(model\);/,
  'actions route must render issue groups through TypeScript presentation');
assert.doesNotMatch(actionsRoutesSource, /if\(globalThis\.actionIssueRowPresentation\)|if\(globalThis\.actionIssueGroupPresentation\)/,
  'actions route must not retain classic issue-render fallbacks');
assert.match(dashboardRoutesSource, /const testRows = deps\.dashboardTestRowsHtml\(statusItems\);/,
  'dashboard route must render test rows through TypeScript presentation');
assert.match(dashboardRoutesSource, /const dashboardKpi = deps\.dashboardKpis\(dashItems, tests\.length\), \{ totalPoints: totalPts, todayPoints: todayPts, rejected: rej, warnings: warn, missingToday: missingTodayCount, completeTests: doneTests, completionPercent: pct \} = dashboardKpi;/,
  'dashboard route must derive all KPIs through the TypeScript helper');
assert.match(dashboardRoutesSource, /deps\.dashboardTestPanelHtml\(\{ testsCount: tests\.length/,
  'dashboard route must render test panel through TypeScript bridge');
assert.match(dashboardRoutesSource, /deps\.dashboardKpiItems\(\{ tests: tests\.length, totalPoints: totalPts, rejected: rej, todayPoints: done \}\)/,
  'dashboard route must create KPI data through TypeScript bridge');
assert.match(dashboardRoutesSource, /progressHtml = deps\.dashboardProgressHtml\(doneTests, tests\.length, pct\)/,
  'dashboard route must render progress through TypeScript bridge directly');
assert.doesNotMatch(dashboardRoutesSource, /if\(globalThis\.dashboardPageHtml\)|return globalThis\.dashboardHeadHtml\(state\.lab\)\+`/,
  'dashboard route must not retain a classic page-render fallback');
assert.match(dashboardRoutesSource, /emptyHtml: deps\.dashboardEmptyTestsHtml\(deps\.role\(\) === 'admin'\)/,
  'dashboard route must render empty test state through TypeScript bridge');
assert.match(drawSource, /const cc = deps\.cusumColors;/,
  'CUSUM renderer must use injected palette dependency');
assert.match(drawSource, /const colors = deps\.leveyJenningsMultiColors;/,
  'multi-level Levey-Jennings renderer must use injected palette dependency');
assert.match(drawSource, /deps\.cusumChartTitle\(k, h\)/,
  'CUSUM renderer must use injected title dependency');
assert.match(drawSource, /deps\.leveyJenningsChartTitle\.(single|multi)/,
  'Levey-Jennings renderers must use injected title dependency');
assert.match(drawSource, /deps\.chartEmptyLabels\.(leveyJennings|leveyJenningsMulti|cusum)/,
  'chart renderers must use injected empty-label dependency');
assert.match(drawSource, /deps\.leveyJenningsMultiYAxis\(\)\.forEach\(\(label: any\) => /,
  'multi-level Levey-Jennings renderer must use injected Y-axis dependency');
assert.match(drawSource, /deps\.leveyJenningsMultiGeometry\(\{ width: W, height: H \}\)/,
  'multi-level Levey-Jennings renderer must use injected geometry dependency');
assert.match(drawSource, /export function createQcChartRenderer\(deps: QcChartRendererDeps\)/,
  'draw.js must be retired to a TypeScript chart-renderer factory');
assert.match(afterRenderControllerSource, /export function createAfterRenderController\(/,
  'after-render controller must be TypeScript source');
assert.match(afterRenderControllerSource, /deps\.restoreConfigNavScroll\(\);/,
  'after-render must restore config nav scroll through injected dependency');
assert.match(afterRenderControllerSource, /deps\.requestFrame\(\(\)=>deps\.scrollEntryJump\(\)\)/,
  'after-render must jump to today row through injected dependency');
assert.match(afterRenderControllerSource, /deps\.fillDefaultDates\(\);/,
  'after-render must fill default dates through injected dependency');
assert.match(afterRenderControllerSource, /deps\.runPageActions\(\);/,
  'after-render must schedule page actions through injected dependency');
assert.match(backupUiSource, /root\.backupCapacityText=\(\)=>root\.BackupStatusCommand\.capacity\(\)/,
  'backup capacity must use the TypeScript status command');
assert.doesNotMatch(backupUiSource, /backupOverdue/,
  'the dead backupOverdue wrapper must not be reintroduced (confirmed zero callers when backup-ui.js retired)');
assert.match(backupUiSource, /root\.backupLocalMarker\.mark\(bytes\)/,
  'backup UI must persist marker through TypeScript bridge');
assert.doesNotMatch(backupUiSource, /backupReminderService\.lastBackupInfo/,
  'backup UI must keep marker interpretation inside the TypeScript status command');
assert.match(backupUiSource, /const model=root\.BackupStatusCommand\.banner\(/,
  'backup banner must render from the TypeScript status command');
assert.match(backupUiSource, /root\.blobDownload!\(name,new Blob\(\[json\],\{type:'application\/json'\}\)\)/,
  'backup export must use TypeScript blob download bridge');
assert.doesNotMatch(backupUiSource, /downloadBackupText=\(name,json\)=>\{[^}]*URL\.createObjectURL/,
  'backup export must not retain a classic object-URL fallback');
assert.match(generated, /root\.backupLocalMarker\s*=\s*createBackupLocalMarker/,
  'artifact must publish TypeScript backup local marker');
assert.match(generated, /root\.dashboardHeadHtml\s*=\s*createDashboardHeadHtml/,
  'artifact must publish TypeScript dashboard head HTML');
assert.match(generated, /root\.dashboardTestPanelHtml\s*=\s*createDashboardTestPanelHtml/,
  'artifact must publish TypeScript dashboard test panel HTML');
assert.doesNotMatch(generated, /root\.dashboardTestRowHtml\s*=/,
  'artifact must keep dashboard test-row HTML internal to the TypeScript bundle');
assert.match(generated, /root\.dashboardKpiItems\s*=\s*dashboardKpiItems/,
  'artifact must publish TypeScript dashboard KPI items');
assert.match(generated, /root\.dashboardEmptyTestsHtml\s*=\s*createDashboardEmptyTestsHtml/,
  'artifact must publish TypeScript dashboard empty tests HTML');
assert.match(generated, /root\.cusumColors\s*=\s*CUSUM_COLORS/,
  'artifact must publish TypeScript CUSUM palette');
assert.match(generated, /root\.leveyJenningsMultiColors\s*=\s*LEVEY_JENNINGS_MULTI_COLORS/,
  'artifact must publish TypeScript multi-level Levey-Jennings palette');
assert.match(generated, /root\.cusumChartTitle\s*=\s*createCusumChartTitle/,
  'artifact must publish TypeScript CUSUM title');
assert.match(generated, /root\.leveyJenningsChartTitle\s*=\s*LEVEY_JENNINGS_CHART_TITLE/,
  'artifact must publish TypeScript Levey-Jennings titles');
assert.match(generated, /root\.chartEmptyLabels\s*=\s*CHART_EMPTY_LABELS/,
  'artifact must publish TypeScript chart empty labels');
assert.match(generated, /root\.leveyJenningsMultiYAxis\s*=\s*leveyJenningsMultiYAxis/,
  'artifact must publish TypeScript multi-level Levey-Jennings Y axis');
assert.match(generated, /root\.leveyJenningsMultiGeometry\s*=\s*leveyJenningsMultiGeometry/,
  'artifact must publish TypeScript multi-level Levey-Jennings geometry');
assert.match(generated, /root\.configNavScrollService\s*=\s*createConfigNavScrollService/,
  'artifact must publish TypeScript config nav scroll service');
assert.match(generated, /root\.entryJumpScrollService\s*=\s*createEntryJumpScrollService/,
  'artifact must publish TypeScript entry jump scroll service');
assert.match(generated, /root\.defaultDateFieldsService\s*=\s*createDefaultDateFieldsService/,
  'artifact must publish TypeScript default date fields service');
assert.match(generated, /root\.postRenderPageActions\s*=\s*createPostRenderPageActions/,
  'artifact must publish TypeScript post-render page actions service');
assert.match(generated, /root\.dashboardOverdueActions\s*=\s*createDashboardOverdueActions/,
  'artifact must publish TypeScript dashboard overdue actions');
assert.match(generated, /root\.dashboardOverdueActionListHtml\s*=\s*createDashboardOverdueActionListHtml/,
  'artifact must publish TypeScript dashboard overdue action list');
assert.match(generated, /root\.dashboardQcFollowupListHtml\s*=\s*createDashboardQcFollowupListHtml/,
  'artifact must publish TypeScript dashboard QC followup list');
assert.match(generated, /root\.dashboardMissingTargetListHtml\s*=\s*createDashboardMissingTargetListHtml/,
  'artifact must publish TypeScript dashboard missing target list');
assert.match(generated, /root\.dashboardExpiringLotItems\s*=\s*dashboardExpiringLotItems/,
  'artifact must publish TypeScript dashboard expiring lot items');
assert.match(generated, /root\.dashboardWestgardAlerts\s*=\s*dashboardWestgardAlerts/,
  'artifact must publish TypeScript dashboard Westgard alerts');
assert.match(generated, /root\.dashboardMissingTargetItems\s*=\s*dashboardMissingTargetItems/,
  'artifact must publish TypeScript dashboard missing target items');
assert.doesNotMatch(generated, /root\.dashboardLevelData\s*=|root\.dashboardTestAction\s*=|root\.dashboardLevelPillsHtml\s*=|root\.dashboardLatestPoint\s*=/,
  'artifact must keep dashboard-only dependencies internal to the TypeScript bundle');
assert.match(generated, /root\.dashboardTestRowsHtml\s*=\s*createDashboardTestRowsHtml/,
  'artifact must publish TypeScript dashboard test rows');
assert.match(generated, /root\.dashboardTestItems\s*=\s*createDashboardTestItems/,
  'artifact must publish TypeScript dashboard test items');
assert.match(generated, /root\.backupInspectionSummary\s*=\s*createBackupInspectionSummary/,
  'artifact must publish TypeScript backup inspection summary');
assert.match(generated, /root\.backupInspectionMessage\s*=\s*createBackupInspectionMessage/,
  'artifact must publish TypeScript backup inspection message');
assert.match(generated, /root\.backupImportMessage\s*=\s*createBackupImportMessage/,
  'artifact must publish TypeScript backup import message');
assert.match(generated, /root\.backupOversizeConfirmation\s*=\s*createBackupOversizeConfirmation/,
  'artifact must publish TypeScript backup oversize confirmation');
assert.match(generated, /root\.backupFileName\s*=\s*createBackupFileName/,
  'artifact must publish TypeScript backup file name');
assert.match(generated, /root\.backupSnapshotFileName\s*=\s*createBackupSnapshotFileName/,
  'artifact must publish TypeScript backup snapshot file name');
assert.match(generated, /root\.backupSizeConfirmation\s*=\s*createBackupSizeConfirmation/,
  'artifact must publish TypeScript backup size confirmation');
assert.match(generated, /root\.backupSizeWarningConfirmation\s*=\s*createBackupSizeWarningConfirmation/,
  'artifact must publish TypeScript backup size warning confirmation');
assert.match(generated, /root\.backupExportMessage\s*=\s*createBackupExportMessage/,
  'artifact must publish TypeScript backup export message');
assert.match(generated, /root\.backupImportConfirmation\s*=\s*createBackupImportConfirmation/,
  'artifact must publish TypeScript backup import confirmation');
assert.match(backupUiSource, /root\.backupInspectionSummary\(result\.report\)/,
  'backup verification UI must use TypeScript inspection summary bridge');
assert.match(backupUiSource, /root\.backupInspectionMessage\.invalid\(err\)/,
  'backup verification UI must use TypeScript inspection message bridge');
assert.match(backupUiSource, /root\.backupImportMessage\.success/,
  'backup import UI must use TypeScript success message bridge');
assert.match(backupUiSource, /root\.backupImportMessage\.invalid\(err\)/,
  'backup import UI must use TypeScript error message bridge');
assert.match(backupUiSource, /snapshotFailureMessage:root\.backupImportMessage\.preImportSnapshotFailure/,
  'backup import UI must pass the TypeScript pre-import snapshot error bridge into its command');
assert.match(backupUiSource, /root\.backupOversizeConfirmation\.exportFull\(\)/,
  'backup export UI must use TypeScript oversize confirmation bridge');
assert.match(backupUiSource, /root\.backupOversizeConfirmation\.importFile\(f\.name\)/,
  'backup import UI must use TypeScript oversize confirmation bridge');
assert.match(backupUiSource, /root\.backupOversizeConfirmation\.inspectFile\(f\.name\)/,
  'backup inspect UI must use TypeScript oversize confirmation bridge');
assert.match(generated, /root\.BackupExportCommand\s*=\s*createBackupExportCommand/,
  'artifact must publish TypeScript backup export command');
assert.match(generated, /root\.BackupImportCommand\s*=\s*createBackupImportCommand/,
  'artifact must publish TypeScript backup import command');
assert.match(generated, /root\.BackupInspectionCommand\s*=\s*createBackupInspectionCommand/,
  'artifact must publish TypeScript backup inspection command');
assert.match(generated, /root\.BackupStatusCommand\s*=\s*createBackupStatusCommand/,
  'artifact must publish TypeScript backup status command');
assert.match(backupUiSource, /root\.BackupExportCommand\.exportFull\(root\.backupFileName\(isoToday\(\)\),root\.backupOversizeConfirmation\.exportFull\(\)\)/,
  'backup export UI must delegate the named file to the TypeScript command');
assert.match(backupUiSource, /root\.BackupExportCommand\.snapshot\(root\.backupSnapshotFileName\(prefix\)\)/,
  'backup snapshot UI must delegate the named file to the TypeScript command');
assert.match(backupUiSource, /root\.confirmOversizedBackup=async\(size,\{title,detail\}\)=>\{const dialog=root\.backupSizeConfirmation\(\{bytes:size,title,detail\}\);return dialog\?await root\.confirmDialog\(dialog\):true;\};/,
  'backup UI must create size confirmation through TypeScript bridge, and must leave size-warning selection entirely to the TypeScript export command (this pins the whole statement, so no extra call can hide inside)');
assert.match(backupUiSource, /root\.backupExportMessage\.createError\(result\.error\)/,
  'backup UI must render create error through TypeScript bridge');
assert.match(backupUiSource, /root\.confirmDialog\(root\.backupImportConfirmation\(input\)\)/,
  'backup UI must render import confirmation through TypeScript bridge');

assert.match(index, /assets\/generated\/modular-pilot\.js\?v=[a-z0-9-]+/,
  'runtime phải nạp artifact được build từ TypeScript');
assert.doesNotMatch(index, /assets\/modules\/chart-view-model\.js/,
  'runtime không được quay lại bản global-scope cũ');
assert.doesNotMatch(index, /assets\/modules\/sigma-cohort-service\.js/,
  'runtime không được quay lại Sigma cohort global-scope cũ');
assert.doesNotMatch(index, /assets\/modules\/westgard-view-model\.js/,
  'runtime không được quay lại Westgard view-model global-scope cũ');
assert.doesNotMatch(index, /assets\/modules\/reagent-comparison-service\.js/,
  'runtime không được quay lại Reagent service global-scope cũ');
assert.doesNotMatch(index, /assets\/modules\/entry-service\.js/,
  'runtime không được quay lại Entry service global-scope cũ');
assert.doesNotMatch(index, /assets\/modules\/manage-config-service\.js/,
  'runtime không được quay lại Manage config service global-scope cũ');
assert.doesNotMatch(index, /assets\/modules\/period-service\.js/,
  'runtime không được quay lại Period service global-scope cũ');
assert.doesNotMatch(index, /assets\/modules\/qc-rules\.js/,
  'runtime không được quay lại QC warning global-scope cũ');
assert.doesNotMatch(index, /assets\/modules\/lis-client-service\.js/,
  'runtime không được quay lại LIS client global-scope cũ');
assert.doesNotMatch(index, /assets\/modules\/backup-service\.js/,
  'Backup service legacy khong duoc runtime nap');
assert.doesNotMatch(index, /assets\/modules\/backup-ui\.js/,
  'runtime không được quay lại Backup UI global-scope cũ');
assert.doesNotMatch(index, /assets\/modules\/lis-queue-ui\.js/,
  'runtime không được quay lại LIS queue UI global-scope cũ');
for (const name of ['analysis', 'auth', 'entry', 'manage', 'reagent', 'sigma']) {
  assert.doesNotMatch(index, new RegExp(`assets/modules/${name}-ui-state\\.js`),
    `runtime không được quay lại ${name} UI state global-scope cũ`);
}
assert.match(chartSource, /export function sampleIndices\(/,
  'nguồn biểu đồ phải là ES Module có export rõ ràng');
assert.match(sigmaPresentationSource, /export const sigmaPresentation = Object\.freeze/,
  'Sigma presentation must export an immutable ES module API');
assert.doesNotMatch(sigmaPresentationSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma presentation must not read global state or DOM');
assert.match(sigmaPeriodSource, /export function createSigmaPeriodViewModel\(/,
  'Sigma period view-model must expose a dependency-injected factory');
assert.doesNotMatch(sigmaPeriodSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma period view-model must not read global state or DOM');
assert.match(sigmaBiasSource, /export function createSigmaBiasService\(/,
  'Sigma Bias service must expose a dependency-injected factory');
assert.match(sigmaCohortImportSource, /export function createSigmaCohortImportService\(/,
  'Sigma cohort import service must expose a dependency-injected factory');
assert.doesNotMatch(sigmaCohortImportSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma cohort import service must not read global state or DOM');
assert.match(sigmaPeriodRecordSource, /export function createSigmaPeriodRecordService\(/,
  'Sigma period record service must expose a dependency-injected factory');
assert.doesNotMatch(sigmaPeriodRecordSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma period record service must not read global state or DOM');
assert.match(sigmaLevelEditSource, /export function createSigmaLevelEditService\(/,
  'Sigma level edit service must expose a dependency-injected factory');
assert.doesNotMatch(sigmaLevelEditSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma level edit service must not read global state or DOM');
assert.match(sigmaTrackedTestSource, /export function createSigmaTrackedTestService\(/,
  'Sigma tracked-test service must expose a dependency-injected factory');
assert.doesNotMatch(sigmaTrackedTestSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma tracked-test service must not read global state or DOM');
assert.match(sigmaBiasWorkflowSource, /export function createSigmaBiasWorkflowService\(/,
  'Sigma Bias workflow service must expose a dependency-injected factory');
assert.doesNotMatch(sigmaBiasWorkflowSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma Bias workflow service must not read global state or DOM');
assert.match(sigmaMuWorkflowSource, /export function createSigmaMuWorkflowService\(/,
  'Sigma MU workflow service must expose a dependency-injected factory');
assert.doesNotMatch(sigmaMuWorkflowSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma MU workflow service must not read global state or DOM');
assert.match(sigmaCohortSelectionSource, /export function createSigmaCohortSelectionService\(/,
  'Sigma cohort selection service must expose a dependency-injected factory');
assert.doesNotMatch(sigmaCohortSelectionSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma cohort selection service must not read global state or DOM');
assert.match(sigmaTeaEditSource, /export function createSigmaTeaEditService\(/,
  'Sigma TEa edit service must expose a dependency-injected factory');
assert.doesNotMatch(sigmaTeaEditSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma TEa edit service must not read global state or DOM');
assert.match(sigmaTeaSnapshotSource, /export function createSigmaTeaSnapshotService\(/,
  'Sigma TEa snapshot service must expose a dependency-injected factory');
assert.doesNotMatch(sigmaTeaSnapshotSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma TEa snapshot service must not read global state or DOM');
assert.match(sigmaLevelSelectionSource, /export function createSigmaLevelSelectionService\(/,
  'Sigma level selection service must expose a dependency-injected factory');
assert.doesNotMatch(sigmaLevelSelectionSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma level selection service must not read global state or DOM');
assert.match(sigmaPeriodSelectionSource, /export function createSigmaPeriodSelectionService\(/,
  'Sigma period selection service must expose a dependency-injected factory');
assert.doesNotMatch(sigmaPeriodSelectionSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma period selection service must not read global state or DOM');
assert.match(cohortSource, /export function createSigmaCohortService\(/,
  'Sigma cohort phải công bố factory nhận dependency');
assert.doesNotMatch(cohortSource, /\bQCCore\b|\bglobalThis\b|\bdocument\b/,
  'domain Sigma cohort không được đọc dependency hoặc môi trường toàn cục');
assert.match(westgardSource, /export const westgardViewModel = Object\.freeze/,
  'Westgard view-model phải xuất API ES Module bất biến');
assert.match(westgardRowWindowSource, /export function westgardRowsWindow(?:<[^>]+>)?\(/,
  'Westgard row window must be a pure TypeScript presentation helper');
assert.match(westgardArchivedGroupsSource, /export function westgardArchivedGroups(?:<[^>]+>)?\(/,
  'Westgard archived-group selection must be a pure TypeScript presentation helper');
assert.match(westgardArchivedMultiViewsSource, /export function westgardArchivedMultiViews(?:<[^>]+>)?\(/,
  'Westgard archived multi-chart data must be a pure TypeScript presentation helper');
assert.match(westgardArchivedGroupMatchSource, /export function westgardArchivedGroupMatches(?:<[^>]+>)?\(/,
  'Westgard archived-group search must be a pure TypeScript presentation helper');
assert.match(reportSearchValuesSource, /export function reportSearchValues(?:<[^>]+>)?\(/,
  'Report search values must be a pure TypeScript presentation helper');
assert.match(westgardArchivedTestSelectionSource, /export function westgardArchivedTestSelection/,
  'Westgard archived test selection must be a pure TypeScript presentation helper');
assert.match(reagentPairsSource, /export function reagentValidPairs\(/,
  'Reagent pair validation must be a pure TypeScript domain helper');
assert.match(reagentStatisticsSource, /export const reagentStatistics = Object\.freeze/,
  'Reagent descriptive statistics must be a pure TypeScript domain helper');
assert.match(reagentTDistributionSource, /export const reagentTDistribution = Object\.freeze/,
  'Reagent t-distribution must be a pure TypeScript domain helper');
assert.match(reagentCalculationSource, /export function createReagentComparisonCalculator\(/,
  'Reagent comparison calculation must be a pure TypeScript domain helper');
assert.match(reagentChartRangeSource, /export const reagentChartPresentation = Object\.freeze/,
  'Reagent chart range must be a pure TypeScript presentation helper');
assert.match(reagentReportItemsSource, /export const reagentReportItemPresentation = Object\.freeze/,
  'Reagent report items must be a pure TypeScript presentation helper');
assert.match(reagentComparisonLabelSource, /export const reagentComparisonLabelPresentation = Object\.freeze/,
  'Reagent comparison labels must be a pure TypeScript presentation helper');
assert.match(reportActionIconSource, /export const reportActionIconPresentation = Object\.freeze/,
  'Report action icons must be a pure TypeScript presentation helper');
assert.match(reagentQuickLabelSource, /export const reagentQuickLabelPresentation = Object\.freeze/,
  'Reagent quick labels must be a pure TypeScript presentation helper');
assert.match(reagentToolIconSource, /export const reagentToolIconPresentation=Object\.freeze/,
  'Reagent tool icons must be a pure TypeScript presentation helper');
assert.doesNotMatch(westgardSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Westgard view-model không được đọc state hoặc môi trường toàn cục');
assert.match(reagentSource, /export function createReagentComparisonService\(/,
  'Reagent application service phải xuất factory nhận dependency');
assert.match(reagentReportPresentationSource, /export const reagentReportPresentation\s*=\s*Object\.freeze/,
  'Reagent report labels and number formatting must be a pure TypeScript presentation module');
assert.doesNotMatch(reagentSource, /\bQCCore\b|\bglobalThis\b|\bdocument\b/,
  'Reagent application service không được đọc dependency hoặc DOM toàn cục');
assert.match(entrySource, /export function createEntryService\(/,
  'Entry application service phải xuất factory nhận dependency');
assert.match(backupSource, /export function createBackupService\(/,
  'Backup application service phai xuat factory nhan dependency');
assert.match(auditSource, /export function createAuditService\(/,
  'Audit application service phai xuat factory nhan dependency');
assert.doesNotMatch(auditSource, /\bQCCore\b|\bglobalThis\b|\bdocument\b|\blocalStorage\b/,
  'Audit application service khong duoc doc global, DOM hoac storage truc tiep');
assert.doesNotMatch(backupSource, /\bQCCore\b|\bglobalThis\b|\bdocument\b|\blocalStorage\b/,
  'Backup application service khong duoc doc global, DOM hoac storage truc tiep');
assert.doesNotMatch(entrySource, /\bQCCore\b|\bPeriodService\b|\bglobalThis\b|\bdocument\b/,
  'Entry application service không được đọc service, dependency hoặc DOM toàn cục');
assert.match(lisSource, /export function createLisClient\(/,
  'LIS application service phải xuất factory nhận dependency');
assert.doesNotMatch(lisSource, /\bglobalThis\b|\bdocument\b|\blocalStorage\b|\bEntryService\b/,
  'LIS application service không được đọc DOM, storage hoặc service global trực tiếp');
assert.match(manageSource, /export function createManageConfigService\(/,
  'Manage config application service phải xuất factory nhận dependency');
assert.doesNotMatch(manageSource, /\bQCCore\b|\bglobalThis\b|\bdocument\b/,
  'Manage config application service không được đọc dependency hoặc DOM toàn cục');
assert.match(periodSource, /export function createPeriodService\(/,
  'Period application service phải xuất factory nhận dependency');
assert.doesNotMatch(periodSource, /\bQCCore\b|\bglobalThis\b|\bdocument\b/,
  'Period application service không được đọc dependency hoặc DOM toàn cục');
assert.match(protocolSource, /export function createActionProtocolService\(/,
  'NCE protocol service must expose a dependency-injected factory');
assert.match(protocolSource, /effectivenessMissingKey\s*=\s*\(action: Action\)/,
  'NCE protocol service must own the missing effectiveness field selection');
assert.doesNotMatch(protocolSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE protocol service must not read global state or DOM');
assert.match(reviewSource, /export function createActionReviewService\(/,
  'NCE review service must expose a dependency-injected factory');
assert.match(reviewSource, /const reviewToken = \(action:/,
  'NCE review service phải sở hữu token chống thay đổi hồ sơ trong lúc xác thực');
assert.doesNotMatch(reviewSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE review service must not read global state or DOM');
assert.match(escalationSource, /export function createActionEscalationService\(/,
  'NCE escalation service must expose a dependency-injected factory');
assert.doesNotMatch(escalationSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE escalation service must not read global state or DOM');
assert.match(recordSource, /export function createActionRecordService\(/,
  'NCE record service must expose a dependency-injected factory');
assert.match(rerunSource, /export function createActionRerunService\(/,
  'NCE rerun service must expose a dependency-injected factory');
assert.doesNotMatch(rerunSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE rerun service must not read global state or DOM');
assert.match(pointIndexSource, /export function createActionPointIndexService\(/,
  'NCE point-action index must expose a dependency-injected factory');
assert.doesNotMatch(pointIndexSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE point-action index must not read global state or DOM');
assert.match(syncStateMergeSource, /export function createSyncStateMerge\(/,
  'Firebase state merge must expose a dependency-injected factory');
assert.doesNotMatch(syncStateMergeSource, /\bstate\b|\bglobalThis\b|\bdocument\b|\bfirebase\b/,
  'Firebase state merge must not read shared state, DOM, or SDK globals');
assert.match(syncSnapshotSource, /export function createSyncSnapshot\(/,
  'Firebase snapshot keys must expose a dependency-injected factory');
assert.doesNotMatch(syncSnapshotSource, /\bstate\b|\bglobalThis\b|\bdocument\b|\bfirebase\b/,
  'Firebase snapshot keys must not read shared state, DOM, or SDK globals');
assert.match(syncRetrySource, /export function createSyncRetryScheduler\(/,
  'Firebase retry scheduler must expose a dependency-injected factory');
assert.doesNotMatch(syncRetrySource, /\bstate\b|\bglobalThis\b|\bdocument\b|\bfirebase\b/,
  'Firebase retry scheduler must not read shared state, DOM, or SDK globals');
assert.match(firstConnectSource, /export function createFirstConnectMerge\(/,
  'Firebase first-connect merge must expose a dependency-injected factory');
assert.doesNotMatch(firstConnectSource, /\bstate\b|\bglobalThis\b|\bdocument\b|\bfirebase\b/,
  'Firebase first-connect helpers must not read shared state, DOM, or SDK globals');
assert.match(runIdNormalizerSource, /export function createRunIdNormalizer\(/,
  'QC runId normalizer must expose a dependency-injected factory');
assert.doesNotMatch(runIdNormalizerSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'QC runId normalizer must not read shared state or DOM');
assert.match(pointLotNormalizerSource, /export function createPointLotNormalizer\(/,
  'QC point-lot normalizer must expose a dependency-injected factory');
assert.doesNotMatch(pointLotNormalizerSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'QC point-lot normalizer must not read shared state or DOM');
assert.match(lotLineageSource, /export function qcLotLineage\(/,
  'QC lot lineage must export a pure function');
assert.doesNotMatch(lotLineageSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'QC lot lineage must not read shared state or DOM');
assert.match(operationalAccessSource, /export function createQcOperationalAccess\(/,
  'QC operational access must expose a dependency-injected factory');
assert.doesNotMatch(operationalAccessSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'QC operational access must not read shared state or DOM');
assert.match(parallelLotLookupSource, /export function createParallelLotLookup\(/,
  'QC parallel-lot lookup must expose a dependency-injected factory');
assert.doesNotMatch(parallelLotLookupSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'QC parallel-lot lookup must not read shared state or DOM');
assert.match(workerJobSource, /export function createWestgardWorkerJob\(/,
  'Westgard Worker job builder must expose a dependency-injected factory');
assert.doesNotMatch(workerJobSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Westgard Worker job builder must not read shared state or DOM');
assert.match(workerRevisionSource, /export function createWestgardWorkerRevisionService\(/,
  'Westgard Worker revisions must expose a dependency-injected service');
assert.doesNotMatch(workerRevisionSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Westgard Worker revisions must not read shared state or DOM');
assert.match(workerHydrateSource, /export function hydrateWestgardWorkerResult\(/,
  'Westgard Worker hydration must export a dependency-injected function');
assert.doesNotMatch(workerHydrateSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Westgard Worker hydration must not read shared state or DOM');
assert.match(workerPrewarmSource, /export function createWestgardWorkerPrewarmPlanner\(/,
  'Westgard Worker prewarm planner must expose a dependency-injected factory');
assert.doesNotMatch(workerPrewarmSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Westgard Worker prewarm planner must not read shared state or DOM');
assert.match(partitionWritePolicySource, /export function planPartitionWrite\(/,
  'partitioned storage policy must export a pure write planner');
assert.doesNotMatch(partitionWritePolicySource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'partitioned storage policy must not read shared state or DOM');
assert.match(saveCommandPolicySource, /export function saveCommandPlan\(/,
  'save command policy must export the persistence and cache plan');
assert.doesNotMatch(saveCommandPolicySource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'save command policy must not read shared state or DOM');
assert.match(storageBootServiceSource, /export function createStorageBootService\(/,
  'storage boot service must export the two-phase boot orchestration');
assert.doesNotMatch(storageBootServiceSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'storage boot service must receive browser and state effects through dependencies');
assert.match(indexedDbRecoveryServiceSource, /export function createIndexedDbRecoveryService\(/,
  'IndexedDB recovery must export a dependency-injected service');
assert.doesNotMatch(indexedDbRecoveryServiceSource, /\bglobalThis\b|\bdocument\b/,
  'IndexedDB recovery must not read shared state or browser globals');
assert.match(partitionHydrationServiceSource, /export function createPartitionHydrationService\(/,
  'partition hydration must export a dependency-injected service');
assert.doesNotMatch(partitionHydrationServiceSource, /\bglobalThis\b|\bdocument\b/,
  'partition hydration must not read shared state or browser globals');
assert.match(indexedDbMirrorServiceSource, /export function createIndexedDbMirrorService\(/,
  'IndexedDB mirror must export a dependency-injected service');
assert.doesNotMatch(indexedDbMirrorServiceSource, /\bglobalThis\b|\bdocument\b/,
  'IndexedDB mirror must not read shared state or browser globals');
assert.match(localStorageLoadServiceSource, /export function createLocalStorageLoadService\(/,
  'localStorage load must export a dependency-injected service');
assert.doesNotMatch(localStorageLoadServiceSource, /\bglobalThis\b|\bdocument\b/,
  'localStorage load must not read shared state or browser globals');
assert.match(localStorageSnapshotWriterSource, /export function createLocalStorageSnapshotWriter\(/,
  'localStorage snapshot writer must export a dependency-injected service');
assert.doesNotMatch(localStorageSnapshotWriterSource, /\bglobalThis\b|\bdocument\b/,
  'localStorage snapshot writer must not read shared state or browser globals');
assert.match(partitionedSnapshotWriterSource, /export function createPartitionedSnapshotWriter\(/,
  'partitioned snapshot writer must export a dependency-injected service');
assert.doesNotMatch(partitionedSnapshotWriterSource, /\bglobalThis\b|\bdocument\b/,
  'partitioned snapshot writer must not read shared state or browser globals');
assert.match(saveServiceSource, /export function createSaveService\(/,
  'save gateway must export a dependency-injected application service');
assert.doesNotMatch(saveServiceSource, /\bglobalThis\b|\bdocument\b/,
  'save gateway must not read shared state or browser globals');
assert.match(firebaseLocalStoreServiceSource, /export function createFirebaseLocalStoreService\(/,
  'Firebase local persistence must export a dependency-injected service');
assert.doesNotMatch(firebaseLocalStoreServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase local persistence must not read shared state or browser globals');
assert.match(firebaseDisconnectServiceSource, /export function createFirebaseDisconnectService\(/,
  'Firebase disconnect lifecycle must export a dependency-injected service');
assert.doesNotMatch(firebaseDisconnectServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase disconnect lifecycle must not read shared state or browser globals');
assert.match(firebasePushServiceSource, /export function createFirebasePushService\(/,
  'Firebase push lifecycle must export a dependency-injected service');
assert.doesNotMatch(firebasePushServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase push lifecycle must not read shared state or browser globals');
assert.match(firebaseFullSyncServiceSource, /export function createFirebaseFullSyncService\(/,
  'Firebase full-sync lifecycle must export a dependency-injected service');
assert.doesNotMatch(firebaseFullSyncServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase full-sync lifecycle must not read shared state or browser globals');
assert.match(firebasePushSchedulerSource, /export function createFirebasePushScheduler\(/,
  'Firebase push scheduler must export a dependency-injected service');
assert.doesNotMatch(firebasePushSchedulerSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase push scheduler must not read shared state or browser globals');
assert.match(firebaseEmptySnapshotServiceSource, /export function createFirebaseEmptySnapshotService\(/,
  'Firebase empty-snapshot lifecycle must export a dependency-injected service');
assert.doesNotMatch(firebaseEmptySnapshotServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase empty-snapshot lifecycle must not read shared state or browser globals');
assert.match(firebaseOwnSnapshotServiceSource, /export function createFirebaseOwnSnapshotService\(/,
  'Firebase own-snapshot lifecycle must export a dependency-injected service');
assert.doesNotMatch(firebaseOwnSnapshotServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase own-snapshot lifecycle must not read shared state or browser globals');
assert.match(firebaseInvalidSnapshotServiceSource, /export function createFirebaseInvalidSnapshotService\(/,
  'Firebase invalid-snapshot lifecycle must export a dependency-injected service');
assert.doesNotMatch(firebaseInvalidSnapshotServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase invalid-snapshot lifecycle must not read shared state or browser globals');
assert.match(firebaseAuditRejectionServiceSource, /export function createFirebaseAuditRejectionService\(/,
  'Firebase audit-rejection lifecycle must export a dependency-injected service');
assert.doesNotMatch(firebaseAuditRejectionServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase audit-rejection lifecycle must not read shared state or browser globals');
assert.match(firebaseRemoteRenderServiceSource, /export function createFirebaseRemoteRenderService\(/,
  'Firebase remote-render lifecycle must export a dependency-injected service');
assert.doesNotMatch(firebaseRemoteRenderServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase remote-render lifecycle must not read shared state or browser globals');
assert.match(firebaseSessionStartServiceSource, /export function createFirebaseSessionStartService\(/,
  'Firebase session-start lifecycle must export a dependency-injected service');
assert.doesNotMatch(firebaseSessionStartServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase session-start lifecycle must not read shared state or browser globals');
assert.match(firebaseMergeCommitServiceSource, /export function createFirebaseMergeCommitService\(/,
  'Firebase merge-commit lifecycle must export a dependency-injected service');
assert.doesNotMatch(firebaseMergeCommitServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase merge-commit lifecycle must not read shared state or browser globals');
assert.match(firebaseConflictDialogServiceSource, /export function createFirebaseConflictDialogService\(/,
  'Firebase conflict dialog must export a TypeScript presentation service');
assert.doesNotMatch(firebaseConflictDialogServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase conflict dialog must not read shared state or browser globals');
assert.match(firebaseCloudStatusPresentationSource, /export function createFirebaseCloudStatusPresentation\(/,
  'Firebase cloud-status presentation must export a TypeScript service');
assert.doesNotMatch(firebaseCloudStatusPresentationSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase cloud-status presentation must not read shared browser globals');
assert.match(firebaseSaveStatusServiceSource, /export function createFirebaseSaveStatusService\(/,
  'Firebase save-status presentation must export a TypeScript service');
assert.doesNotMatch(firebaseSaveStatusServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase save-status presentation must not read shared browser globals');
assert.match(firebaseRemoteRenderSafetyServiceSource, /export function createFirebaseRemoteRenderSafetyService\(/,
  'Firebase remote-render safety must export a TypeScript presentation service');
assert.doesNotMatch(firebaseRemoteRenderSafetyServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase remote-render safety must not read shared browser globals');
assert.match(firebaseAppServiceSource, /export function createFirebaseAppService\(/,
  'Firebase SDK lifecycle must export a dependency-injected service');
assert.doesNotMatch(firebaseAppServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase SDK lifecycle must not read shared browser globals');
assert.match(firebaseConfigSourceServiceSource, /export function createFirebaseConfigSourceService\(/,
  'Firebase config source must export a dependency-injected service');
assert.doesNotMatch(firebaseConfigSourceServiceSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase config source must not read shared browser globals');
assert.match(firebaseReadyStateSource, /export function firebaseReadyState\(/,
  'Firebase ready lifecycle must export a pure state transition');
assert.doesNotMatch(firebaseReadyStateSource, /\bglobalThis\b|\bdocument\b/,
  'Firebase ready lifecycle must not read shared browser globals');
assert.match(indexedDbOpenServiceSource, /export function createIndexedDbOpenService\(/,
  'IndexedDB open lifecycle must export a dependency-injected service');
assert.doesNotMatch(indexedDbOpenServiceSource, /\bglobalThis\b|\bdocument\b/,
  'IndexedDB open lifecycle must not read shared browser globals');
assert.match(indexedDbRecordServiceSource, /export function createIndexedDbRecordService\(/,
  'IndexedDB record operations must export a dependency-injected service');
assert.doesNotMatch(indexedDbRecordServiceSource, /\bglobalThis\b|\bdocument\b/,
  'IndexedDB record operations must not read shared browser globals');
assert.match(partitionedIndexedDbWriteServiceSource, /export function createPartitionedIndexedDbWriteService\(/,
  'partitioned IndexedDB writes must export a dependency-injected service');
assert.doesNotMatch(partitionedIndexedDbWriteServiceSource, /\bglobalThis\b|\bdocument\b/,
  'partitioned IndexedDB writes must not read shared browser globals');
assert.match(partitionedIndexedDbReadServiceSource, /export function createPartitionedIndexedDbReadService\(/,
  'partitioned IndexedDB recovery must export a dependency-injected service');
assert.doesNotMatch(partitionedIndexedDbReadServiceSource, /\bglobalThis\b|\bdocument\b/,
  'partitioned IndexedDB recovery must not read shared browser globals');
assert.match(indexedDbClearServiceSource, /export function createIndexedDbClearService\(/,
  'IndexedDB clearing must export a dependency-injected service');
assert.doesNotMatch(indexedDbClearServiceSource, /\bglobalThis\b|\bdocument\b/,
  'IndexedDB clearing must not read shared browser globals');
assert.match(passwordPolicySource, /export function passwordPolicyError\(/,
  'password policy must export a pure TypeScript validator');
assert.match(passwordPolicySource, /export function passwordChangeError\(/,
  'password policy must centralize password-confirmation validation');
assert.doesNotMatch(passwordPolicySource, /\bglobalThis\b|\bdocument\b/,
  'password policy must not read shared browser globals');
assert.match(pbkdf2PasswordServiceSource, /export function createPbkdf2PasswordService\(/,
  'PBKDF2 password service must export a dependency-injected factory');
assert.match(pbkdf2PasswordServiceSource, /export function passwordHashNeedsUpgrade\(/,
  'PBKDF2 password service must centralize hash-upgrade policy');
assert.doesNotMatch(pbkdf2PasswordServiceSource, /\bglobalThis\b|\bdocument\b/,
  'PBKDF2 password service must not read shared browser globals');
assert.match(legacyPasswordHashServiceSource, /export function createLegacyPasswordHashService\(/,
  'legacy password hash service must export a dependency-injected factory');
assert.doesNotMatch(legacyPasswordHashServiceSource, /\bglobalThis\b|\bdocument\b/,
  'legacy password hash service must not read shared browser globals');
assert.match(loginLockoutPolicySource, /export function createLoginLockoutPolicy\(/,
  'login lockout policy must export a pure TypeScript factory');
assert.match(loginLockoutPolicySource, /export function normalizeLoginLockoutState\(/,
  'login lockout policy must centralize persisted-state normalization');
assert.match(loginLockoutPolicySource, /message\(until, now\)/,
  'login lockout policy must own the lockout message');
assert.doesNotMatch(loginLockoutPolicySource, /\bglobalThis\b|\bdocument\b/,
  'login lockout policy must not read shared browser globals');
assert.match(blankAppStateSource, /export function createBlankAppState\(/,
  'blank app state must export a pure TypeScript builder');
assert.doesNotMatch(blankAppStateSource, /\bglobalThis\b|\bdocument\b/,
  'blank app state must not read shared browser globals');
assert.match(defaultAdminUserSource, /export function createDefaultAdminUser\(/,
  'default admin user must export a pure TypeScript builder');
assert.match(defaultAdminUserSource, /DEFAULT_ADMIN_MUST_CHANGE_PASSWORD = true/,
  'default admin policy must require a password change');
assert.doesNotMatch(defaultAdminUserSource, /\bglobalThis\b|\bdocument\b/,
  'default admin user must not read shared browser globals');
assert.match(newUserValidationSource, /export function newUserValidationError\(/,
  'new-user validation must export a pure TypeScript validator');
assert.doesNotMatch(newUserValidationSource, /\bglobalThis\b|\bdocument\b/,
  'new-user validation must not read shared browser globals');
assert.match(userPermissionSelectionSource, /export function selectUserPermissions\(/,
  'user permission selection must export a pure TypeScript selector');
assert.doesNotMatch(userPermissionSelectionSource, /\bglobalThis\b|\bdocument\b/,
  'user permission selection must not read shared browser globals');
assert.match(activityAuditFilterSource, /export function createActivityAuditFilter\(/,
  'activity audit filter must export a dependency-injected TypeScript factory');
assert.doesNotMatch(activityAuditFilterSource, /\bglobalThis\b|\bdocument\b/,
  'activity audit filter must not read shared browser globals');
assert.match(activityAuditPaginationSource, /export function activityAuditPagination(?:<[^>]+>)?\(/,
  'activity audit pagination must export a pure TypeScript model');
assert.doesNotMatch(activityAuditPaginationSource, /\bglobalThis\b|\bdocument\b/,
  'activity audit pagination must not read shared browser globals');
assert.match(activityAuditCsvSource, /export function createActivityAuditCsv\(/,
  'activity audit CSV must export a dependency-injected TypeScript factory');
assert.doesNotMatch(activityAuditCsvSource, /\bglobalThis\b|\bdocument\b/,
  'activity audit CSV must not read shared browser globals');
assert.match(activityAuditDateRangeSource, /export function updateActivityAuditDateRange\(/,
  'activity audit date range must export a pure TypeScript updater');
assert.doesNotMatch(activityAuditDateRangeSource, /\bglobalThis\b|\bdocument\b/,
  'activity audit date range must not read shared browser globals');
assert.match(activityAuditFilterStateSource, /export const activityAuditFilterState = Object\.freeze/,
  'activity audit controls must export immutable TypeScript state transitions');
assert.match(activityAuditFilterStateSource, /export const ACTIVITY_AUDIT_PAGE_SIZES = Object\.freeze/,
  'activity audit controls must centralize allowed page sizes');
assert.doesNotMatch(activityAuditFilterStateSource, /\bglobalThis\b|\bdocument\b/,
  'activity audit controls must not read shared browser globals');
assert.match(activityAuditArchiveWindowSource, /export function activityAuditArchiveWindow\(/,
  'activity audit archive window must export a pure TypeScript helper');
assert.doesNotMatch(activityAuditArchiveWindowSource, /\bglobalThis\b|\bdocument\b/,
  'activity audit archive window must not read shared browser globals');
assert.doesNotMatch(recordSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE record service must not read global state or DOM');
assert.match(actionBiasSource, /export function createActionBiasService\(/,
  'NCE Bias service must expose a dependency-injected factory');
assert.doesNotMatch(actionBiasSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE Bias service must not read global state or DOM');
assert.match(actionViolationSource, /export function createActionViolationService\(/,
  'NCE violation service phải xuất factory nhận dependency');
assert.doesNotMatch(actionViolationSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE violation service không được đọc global state hoặc DOM');
assert.match(actionListPresentationSource, /export function createActionListPresentation\(/,
  'NCE list presentation phải xuất factory nhận dependency');
assert.doesNotMatch(actionListPresentationSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE list presentation không được đọc global state hoặc DOM');
assert.match(actionEvidencePresentationSource, /export function createActionEvidencePresentation\(/,
  'NCE evidence presentation phải xuất factory nhận dependency');
assert.doesNotMatch(actionEvidencePresentationSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE evidence presentation không được đọc global state hoặc DOM');
assert.match(actionRerunEvidencePresentationSource, /export function createActionRerunEvidencePresentation\(/,
  'NCE rerun evidence presentation phải xuất factory nhận dependency');
assert.doesNotMatch(actionRerunEvidencePresentationSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE rerun evidence presentation không được đọc global state hoặc DOM');
assert.match(actionStatusPresentationSource, /export function createActionStatusPresentation\(/,
  'NCE status presentation phải xuất factory nhận dependency');
assert.doesNotMatch(actionStatusPresentationSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE status presentation không được đọc global state hoặc DOM');
assert.match(actionReviewPresentationSource, /export function createActionReviewPresentation\(/,
  'NCE review presentation phải xuất factory');
assert.doesNotMatch(actionReviewPresentationSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE review presentation không được đọc global state hoặc DOM');
assert.match(actionDetailPresentationSource, /export function createActionDetailPresentation\(/,
  'NCE detail presentation phải xuất factory nhận dependency');
assert.doesNotMatch(actionDetailPresentationSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE detail presentation không được đọc global state hoặc DOM');
assert.match(actionGuidePresentationSource, /export function createActionGuidePresentation\(/,
  'NCE guide presentation phải xuất factory');
assert.match(actionInvestigationPresentationSource, /export const actionInvestigationPresentation\s*=\s*Object\.freeze/,
  'trạng thái thẻ điều tra NCE phải tách thành presentation TypeScript thuần');
assert.match(actionChecklistPresentationSource, /export function createActionChecklistPresentation\(/,
  'chip checklist NCE phải tách thành presentation TypeScript nhận dependency');
assert.doesNotMatch(actionGuidePresentationSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE guide presentation không được đọc global state hoặc DOM');
assert.match(reportPeriodPresentationSource, /export function createReportPeriodPresentation\(/,
  'Report period presentation phải xuất factory');
assert.doesNotMatch(reportPeriodPresentationSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Report period presentation không được đọc global state hoặc DOM');
assert.match(rangeCandidateSource, /export function createRangeCandidateService\(/,
  'QC range candidate must expose a dependency-injected factory');
assert.doesNotMatch(rangeCandidateSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'QC range candidate must not read global state or DOM');
assert.match(rangeSafetyGateSource, /export function rangeSafetyGate\(/,
  'QC range safety gate must export its pure clinical predicate');
assert.match(rangeSafetyGateSource, /export function rangeBiasEvaluation\(/,
  'QC range Bias evaluation must export its pure clinical calculation');
assert.doesNotMatch(rangeSafetyGateSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'QC range safety gate must not read global state or DOM');
assert.match(csvCellSource, /export function csvCell\(/,
  'CSV cell encoder must export its pure value encoder');
assert.doesNotMatch(csvCellSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'CSV cell encoder must not read global state or DOM');
assert.match(reportExportHelpersSource, /export const reportExportHelpers=Object\.freeze/,
  'Report export helpers must expose an immutable pure API');
assert.doesNotMatch(reportExportHelpersSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Report export helpers must not read global state or DOM');
assert.match(actionReportSummarySource, /export function createActionReportSummary\(/,
  'NCE report summary must expose a dependency-injected factory');
assert.doesNotMatch(actionReportSummarySource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE report summary must not read global state or DOM');
assert.match(actionReportModelSource, /export function createActionReportModel\(/,
  'NCE report model must expose a dependency-injected factory');
assert.doesNotMatch(actionReportModelSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE report model must not read global state or DOM');
assert.match(sigmaReportMetricSource, /export function sigmaReportMetric\(/,
  'Sigma report metric must export a pure presentation projection');
assert.doesNotMatch(sigmaReportMetricSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma report metric must not read global state or DOM');
assert.match(sigmaMdcItemsSource, /export function sigmaMdcItems\(/,
  'Sigma MDC data builder must export a pure presentation projection');
assert.doesNotMatch(sigmaMdcItemsSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma MDC data builder must not read global state or DOM');
assert.match(sigmaMdcLabelPlacementSource, /export function sigmaMdcLabelPlacements\(/,
  'Sigma MDC label placement must export a pure presentation projection');
assert.doesNotMatch(sigmaMdcLabelPlacementSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma MDC label placement must not read global state or DOM');
assert.match(sigmaExportPixelRatioSource, /export function sigmaExportPixelRatio\(/,
  'Sigma export pixel ratio must export its pure canvas safety limit');
assert.doesNotMatch(sigmaExportPixelRatioSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma export pixel ratio must not read global state or DOM');
assert.match(sigmaReportRowsSource, /export function createSigmaReportRows\(/,
  'Sigma report rows must expose a dependency-injected factory');
assert.doesNotMatch(sigmaReportRowsSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma report rows must not read global state or DOM');
assert.match(qcReportRowsSource, /export function createQcReportRows\(/,
  'QC report rows must expose a dependency-injected factory');
assert.doesNotMatch(qcReportRowsSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'QC report rows must not read global state or DOM');
assert.match(qcReportContextSource, /export function createQcReportContext\(/,
  'QC report context must expose a dependency-injected factory');
assert.doesNotMatch(qcReportContextSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'QC report context must not read global state or DOM');
assert.match(dataUrlBytesSource, /export function dataUrlBytes\(/,
  'Sigma image byte conversion must export a pure helper');
assert.doesNotMatch(dataUrlBytesSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma image byte conversion must not read global state or DOM');
assert.match(sigmaExportMetaSource, /export function createSigmaExportMeta\(/,
  'Sigma export metadata must expose a dependency-injected factory');
assert.doesNotMatch(sigmaExportMetaSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma export metadata must not read global state or DOM');
assert.match(exportMetaRowsSource, /export function createExportMetaRows\(/,
  'Report export metadata must expose a dependency-injected factory');
assert.doesNotMatch(exportMetaRowsSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Report export metadata must not read global state or DOM');
assert.match(qcExportValueFormatSource, /export function createQcExportValueFormat\(/,
  'QC export value format must expose a dependency-injected factory');
assert.doesNotMatch(qcExportValueFormatSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'QC export value format must not read global state or DOM');
assert.match(chartCanvasFontSource, /export function createCanvasFont\(/,
  'Sigma canvas font must expose a dependency-injected factory');
assert.doesNotMatch(canvasFontSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma canvas font must not read global state or DOM');
assert.match(reportLabelsSource, /export function createReportLabels\(/,
  'Report labels must expose a dependency-injected factory');
assert.doesNotMatch(reportLabelsSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Report labels must not read global state or DOM');
assert.match(reportSelectionSource, /export function createReportSelection\(/,
  'Report selection must expose a dependency-injected factory');
assert.doesNotMatch(reportSelectionSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Report selection must not read global state or DOM');
assert.match(reportSearchSource, /export function createReportSearch\(/,
  'Report search must expose a dependency-injected factory');
assert.doesNotMatch(reportSearchSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Report search must not read global state or DOM');
assert.match(sigmaMuTraceSource, /export function createSigmaMuTrace\(/,
  'Sigma MU trace must expose a dependency-injected factory');
assert.doesNotMatch(sigmaMuTraceSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma MU trace must not read global state or DOM');
assert.match(sigmaPrintRowsSource, /export function createSigmaPrintRows\(/,
  'Sigma print rows must expose a dependency-injected factory');
assert.doesNotMatch(sigmaPrintRowsSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma print rows must not read global state or DOM');
assert.match(sigmaMuPrintRowsSource, /export function createSigmaMuPrintRows\(/,
  'Sigma MU print rows must expose a dependency-injected factory');
assert.doesNotMatch(sigmaMuPrintRowsSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma MU print rows must not read global state or DOM');
assert.match(reportPointsTableSource, /export function createReportPointsTable\(/,
  'Report points table must expose a dependency-injected factory');
assert.doesNotMatch(reportPointsTableSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Report points table must not read global state or DOM');
assert.match(actionReportHtmlSource, /export function createActionReportHtml\(/,
  'NCE report HTML must expose a dependency-injected factory');
assert.doesNotMatch(actionReportHtmlSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'NCE report HTML must not read global state or DOM');
assert.match(sigmaDraftServiceSource, /export function createSigmaDraftService\(/,
  'Sigma draft persistence must expose a dependency-injected factory');
assert.doesNotMatch(sigmaDraftServiceSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sigma draft persistence must not read global state or DOM');
assert.match(stateAdoptionServiceSource, /export function createStateAdoptionService\(/,
  'State adoption must expose a dependency-injected factory');
assert.doesNotMatch(stateAdoptionServiceSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'State adoption must not read global state or DOM');
assert.match(corruptLocalQuarantineSource, /export function createCorruptLocalQuarantine\(/,
  'Corrupt local quarantine must expose a dependency-injected factory');
assert.doesNotMatch(corruptLocalQuarantineSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Corrupt local quarantine must not read global state or DOM');
assert.match(syncValueCodecSource, /export function createSyncValueCodec\(/,
  'Sync value codec must expose a dependency-injected factory');
assert.doesNotMatch(syncValueCodecSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sync value codec must not read global state or DOM');
assert.match(firebaseConfigSelectionSource, /export function createFirebaseConfigSelection\(/,
  'Firebase config selection must expose a dependency-injected factory');
assert.doesNotMatch(firebaseConfigSelectionSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Firebase config selection must not read global state or DOM');
assert.match(firebaseConnectionGateSource, /export function createFirebaseConnectionGate\(/,
  'Firebase connection gate must expose a dependency-injected factory');
assert.doesNotMatch(firebaseConnectionGateSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Firebase connection gate must not read global state or DOM');
assert.match(snapshotSignatureSource, /export function syncSnapshotSignature\(/,
  'Sync snapshot signature must expose a pure TypeScript helper');
assert.doesNotMatch(snapshotSignatureSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Sync snapshot signature must not read global state or DOM');
assert.match(warningSource, /export function createQcPointWarnings\(/,
  'QC point warnings phải xuất factory nhận dependency');
assert.doesNotMatch(warningSource, /\bQCCore\b|\bglobalThis\b|\bdocument\b|\bWG_RULE_REGISTRY\b/,
  'QC point warnings không được đọc global hoặc sao chép registry Westgard');
assert.match(uiStateSource, /export function installUiState</,
  'presentation state phải dùng một factory accessor có kiểu dữ liệu');
assert.doesNotMatch(uiStateSource, /\bglobalThis\b|\blocalStorage\b|\bdocument\b/,
  'presentation state không được tự đọc môi trường toàn cục');
assert.match(adapter, /const root = globalThis as QCLabGlobal/,
  'adapter tương thích phải khai báo kiểu cho global cũ');
assert.match(generated, /root\.ActionProtocolService\s*=\s*createActionProtocolService/,
  'artifact must publish the NCE protocol service for legacy workflow callers');
assert.match(generated, /root\.AuditService\s*=\s*createAuditService/,
  'artifact must publish AuditService for classic audit wrappers');
assert.match(generated, /root\.ActionRerunService\s*=\s*createActionRerunService/,
  'artifact must publish NCE rerun service for classic workflow callers');
assert.match(generated, /root\.ActionPointIndexService\s*=\s*createActionPointIndexService/,
  'artifact must publish NCE point-action index for classic workflow callers');
assert.match(generated, /var modularSyncCodec\s*=\s*createSyncValueCodec\(\);[\s\S]*?var modularSyncSnapshot\s*=\s*createSyncSnapshot\(FIREBASE_SYNC_TOP,\s*syncJsonMap\);[\s\S]*?createSyncStateMerge\(/,
  'artifact phải dựng merger và snapshot Firebase từ metadata TypeScript, không qua global installer');
const qcDomainSource = read('assets/modules/qc-domain.js');
assert.match(qcDomainSource, /function reportLevelStats\(pts,mean,teaVal\)\{return globalThis\.reportLevelStatsService\(pts,mean,teaVal\);\}/,
  'QC domain report statistics must call the TypeScript service directly');
assert.match(qcDomainSource, /function errorTypeDetailParts\(rules\)\{return globalThis\.qcErrorDetail\(rules\);\}/,
  'QC domain error-detail helper must call the TypeScript service directly');
assert.match(qcDomainSource, /function normalizePointLots\(\)\{return globalThis\.qcNormalizePointLots\(state\);\}/,
  'QC domain point-lot normalization must call the TypeScript service directly');
assert.match(qcDomainSource, /function normalizeDuplicateRunIds\(\)\{return globalThis\.qcNormalizeDuplicateRunIds\(state\);\}/,
  'QC domain runId normalization must call the TypeScript service directly');
assert.match(qcDomainSource, /function (?:lvlCfg|isOperationalLotGroup|levelTargetOk|pointRunNo|testCusumConfig)\([^)]*\)\{return globalThis\./,
  'QC domain pure configuration helpers must call TypeScript directly');
assert.match(qcDomainSource, /function lotLineage\(currentLotId\)\{\s*return globalThis\.qcLotLineage\(derived\(\),currentLotId\);\s*\}/,
  'QC lot lineage must call the TypeScript service directly');
assert.match(qcDomainSource, /function parallelLotForLevel\(t,level\)\{\s*return globalThis\.qcParallelLotLookup\(t,level\);\s*\}/,
  'QC parallel-lot lookup must call the TypeScript service directly');
assert.match(qcDomainSource, /function entryColumns\(t\)\{\s*return globalThis\.qcEntryColumns\(t\);\s*\}/,
  'QC entry columns must call the TypeScript service directly');
assert.match(qcDomainSource, /function pointVoidVerdict\(t,p\)\{\s*return globalThis\.qcPointVoidVerdict\(t,p\);\s*\}/,
  'QC point void verdict must call the TypeScript service directly');
assert.match(qcDomainSource, /function plannedTargetFor\(t,lot\)\{\s*return globalThis\.qcPlannedTarget\(lvlCfg\(t,lot\.level\),lot\);\s*\}/,
  'QC planned target lookup must call the TypeScript service directly');
assert.match(qcDomainSource, /function levelsForLotGroup\(group\)\{\s*return globalThis\.qcLotGroupLevels\(group,state\.tests\|\|\[\],derived\(\)\.lotById\);\s*\}/,
  'QC lot-group historical levels must call the TypeScript service directly');
assert.match(qcDomainSource, /function derived\(\)\{return globalThis\.qcDerivedIndex\(state\);\}/,
  'QC derived index must call the self-invalidating TypeScript service directly');
assert.doesNotMatch(qcDomainSource, /function derivedStampWalk\(/,
  'QC domain must not retain the legacy derived-index implementation');
assert.match(qcDomainSource, /function pointsOf\(testId,level\)\{return globalThis\.qcPointCache\.points\(testId,level\);\}/,
  'QC point lookup must call the TypeScript cache directly');
assert.match(qcDomainSource, /function pointsForLot\(testId,level,lot,withIndex=false\)\{return globalThis\.qcPointCache\.lot\(testId,level,lot,withIndex\);\}/,
  'QC lot-point lookup must call the TypeScript cache directly');
assert.match(qcDomainSource, /function operationalLotPoints\(t,level,withIndex=false\)\{return globalThis\.qcOperationalAccess\.lotPoints\(t,level,withIndex\);\}/,
  'QC operational lot points must call the TypeScript service directly');
assert.match(qcDomainSource, /function testSelectLabel\(t,list=state\.tests\)\{return globalThis\.qcOperationalAccess\.selectLabel\(t,list\);\}/,
  'QC test selection labels must call the TypeScript service directly');
assert.doesNotMatch(qcDomainSource, /if\(globalThis\.(?:qcActiveWestgard|qcCusumSeries|qcAcceptedLotPoints)\)/,
  'QC evaluation services must not retain JavaScript fallbacks');
assert.doesNotMatch(qcDomainSource, /if\(globalThis\.westgardWorker(?:RevisionService|PrewarmPlanner|JobBuilder|Hydrate)\)/,
  'Westgard worker adapter must not retain JavaScript fallbacks');
const dataIoSource = read('src/presentation/export/data-io-controller.ts');
assert.doesNotMatch(dataIoSource, /function dataIoQcPoint\(/,
  'data I/O must not retain the retired point-format facade');
assert.doesNotMatch(dataIoSource, /function dataIoQcValue\(|function dataIoQcStat\(/,
  'data I/O must not retain classic Mean/SD wrappers around the TypeScript formatter');
assert.doesNotMatch(dataIoSource, /function csvCell\(|function downloadCSV\(/,
  'data I/O must not retain retired CSV encoding/download facades');
assert.match(dataIoSource, /function reportInRange\(start: string, end: string\) \{ return deps\.reportExportHelpers\.inRange\(start, end\); \}/,
  'report date-range filtering must call the injected dependency directly');
assert.match(dataIoSource, /function reportTeaInfo\(t: any\) \{ return deps\.qcReportContext\.teaInfo\(t\); \}/,
  'report TEa context must call the injected dependency directly');
assert.match(dataIoSource, /function reportMultiViews\(t: any, inRange: \(value: unknown\) => boolean\) \{ return deps\.qcReportContext\.multiViews\(t, inRange\); \}/,
  'report multi-level context must call the injected dependency directly');
assert.match(dataIoSource, /function reportPrevLotRows\(t: any, s: any, inRange: \(value: unknown\) => boolean\) \{ return deps\.qcReportRowsService\.previousLot\(t, s, inRange\); \}/,
  'previous-lot report rows must call the injected dependency directly');
assert.match(dataIoSource, /function reportLevelRows\(t: any, l: any, wg: any, inRange: \(value: unknown\) => boolean\) \{ return deps\.qcReportRowsService\.currentLot\(t, l, wg, inRange\); \}/,
  'current-lot report rows must call the injected dependency directly');
assert.match(dataIoSource, /function reportActionsInRange\(tid: string, inRange: \(value: unknown\) => boolean\) \{ return deps\.qcReportRowsService\.actions\(tid, inRange\); \}/,
  'report action rows must call the injected dependency directly');
assert.match(dataIoSource, /function reportNceSummaryParts\(a: any\) \{ return deps\.actionReportSummary\(a\); \}/,
  'report NCE summary must call the injected presentation dependency directly');
assert.match(dataIoSource, /function reportNceModel\(a: any, t: any\) \{ return deps\.actionReportModel\(a, t\); \}/,
  'detailed NCE report models must call the injected presentation dependency directly');
assert.match(dataIoSource, /function sigmaLevelsOf\(row: any\) \{ return deps\.reportExportHelpers\.sigmaLevels\(row\); \}/,
  'Sigma export levels must call the injected dependency directly');
assert.match(dataIoSource, /function sigmaPeriodLabel\(value: unknown\) \{ return deps\.reportExportHelpers\.periodLabel\(value\); \}/,
  'Sigma period labels must call the injected dependency directly');
assert.match(dataIoSource, /function sigmaMdcPeriodLabel\(value: unknown\) \{ return deps\.reportExportHelpers\.mdcPeriodLabel\(value\); \}/,
  'Sigma MDC period labels must call the injected dependency directly');
assert.match(dataIoSource, /function sigmaExportPeriods\(rows: any\[\]\) \{ return deps\.reportExportHelpers\.exportPeriods\(rows\); \}/,
  'Sigma export period lists must call the injected dependency directly');
assert.match(dataIoSource, /function sigmaDataURLBytes\(durl: string\) \{ return deps\.sigmaDataUrlBytes\(durl\); \}/,
  'Sigma chart image decoding must call the injected dependency directly');
assert.match(dataIoSource, /function sigmaReportMetric\(r: any\) \{ return deps\.sigmaReportMetricService\(r\); \}/,
  'Sigma report metrics must call the injected dependency directly');
assert.match(dataIoSource, /function sigmaReportRows\(onlyTestId = '', mode = 'latest', period = '', periodId = ''\) \{ return deps\.sigmaReportRowsService\(onlyTestId, mode, period, periodId\); \}/,
  'Sigma report rows must call the injected dependency directly');
assert.match(dataIoSource, /function sigmaExportPixelRatio\(W: number, H: number, scale = SIGMA_EXPORT_PIXEL_RATIO\) \{ return deps\.sigmaExportPixelRatioService\(W, H, scale, SIGMA_EXPORT_MAX_DIMENSION\); \}/,
  'Sigma export pixel ratio must call the injected dependency directly');
assert.match(dataIoSource, /function sigmaCanvas\(W: number, H: number, scale: number\) \{ return deps\.sigmaCanvasFactory\(W, H, scale\); \}/,
  'Sigma canvas creation must call the injected dependency directly');
assert.match(dataIoSource, /function sigmaMdcLabelPlacements\(items: any, X: any, Y: any, ctx: any, bounds: any\) \{ return deps\.sigmaMdcLabelPlacementService\(items, X, Y, ctx, bounds\); \}/,
  'Sigma MDC label placement must call the injected dependency directly');
assert.match(dataIoSource, /function sigmaMdcItems\(rows: any\[\]\) \{ return deps\.sigmaMdcItemsService\(rows\); \}/,
  'Sigma MDC data points must call the injected dependency directly');
assert.match(dataIoSource, /function drawSigmaReportChart\(rows: any\[\]\) \{ return deps\.sigmaChartRenderer\(rows\); \}/,
  'Sigma chart rendering must call the injected dependency directly');
assert.match(dataIoSource, /function reportNceExcerpt\(value: unknown, max = 150\) \{ return deps\.reportExportHelpers\.nceExcerpt\(value, max\); \}/,
  'report NCE excerpts must call the injected dependency directly');
assert.doesNotMatch(dataIoSource, /function reportInRange[^{]*\{ if\(|function reportTeaInfo[^{]*\{ if\(|function reportMultiViews[^{]*\{ if\(|function reportPrevLotRows[\s\S]*?if\(deps\.qcReportRowsService\)|function reportLevelRows[^{]*\{ if\(|function reportActionsInRange[^{]*\{ if\(|function reportNceSummaryParts[^{]*\{ if\(|function reportNceExcerpt[^{]*\{ if\(|function sigmaLevelsOf[^{]*\{ if\(|function sigmaDataURLBytes[^{]*\{ if\(|function sigmaReportMetric[^{]*\{ if\(|function sigmaReportRows[^{]*\{ if\(|function sigmaExportPixelRatio[^{]*\{ if\(|function sigmaCanvas[^{]*\{ if\(|function sigmaPeriodLabel[^{]*\{ if\(|function sigmaMdcPeriodLabel[^{]*\{ if\(|function sigmaExportPeriods[^{]*\{ if\(/,
  'retired report export helpers must not retain JavaScript fallbacks');
assert.match(dataIoSource, /function exportReportCSV\(\)[\s\S]*?deps\.csvDownload\(/,
  'report CSV export must call the injected download dependency directly');
assert.match(dataIoSource, /function exportActionsCSV\(\)[\s\S]*?deps\.csvDownload\('Nhat_ky_khac_phuc_QC\.csv', rows\);/,
  'NCE CSV export must call the injected download dependency directly');
assert.match(adapter, /root\.exportActivityCSV\s*=\s*\(\)\s*=>\s*\{\s*root\.csvDownload!\('Nhat_ky_hoat_dong_QCLab\.csv'/,
  'activity CSV export must call the TypeScript download service directly');
assert.match(generated, /root\.syncRetryScheduler\s*=\s*createSyncRetryScheduler/,
  'artifact must publish the TypeScript Firebase retry scheduler for the legacy bridge');
assert.match(generated, /root\.syncFirstConnectMerge\s*=\s*createFirstConnectMerge/,
  'artifact must publish the TypeScript Firebase first-connect merger for the legacy bridge');
assert.match(generated, /root\.qcNormalizeDuplicateRunIds\s*=\s*createRunIdNormalizer/,
  'artifact must publish the TypeScript QC runId normalizer for the legacy bridge');
assert.match(generated, /root\.qcNormalizePointLots\s*=\s*createPointLotNormalizer/,
  'artifact must publish the TypeScript QC point-lot normalizer for the legacy bridge');
assert.match(generated, /root\.qcLotLineage\s*=\s*qcLotLineage/,
  'artifact must publish TypeScript QC lot lineage for the legacy bridge');
assert.match(generated, /root\.qcOperationalAccess\s*=\s*createQcOperationalAccess/,
  'artifact must publish TypeScript QC operational access for the legacy bridge');
assert.match(generated, /root\.qcParallelLotLookup\s*=\s*createParallelLotLookup/,
  'artifact must publish TypeScript QC parallel-lot lookup for the legacy bridge');
assert.match(generated, /root\.westgardWorkerJobBuilder\s*=\s*createWestgardWorkerJob/,
  'artifact must publish the TypeScript Westgard Worker job builder for the legacy bridge');
assert.match(generated, /root\.westgardWorkerRevisionService\s*=\s*createWestgardWorkerRevisionService/,
  'artifact must publish TypeScript Westgard Worker revision control for the legacy bridge');
assert.match(generated, /root\.westgardWorkerHydrate\s*=\s*hydrateWestgardWorkerResult/,
  'artifact must publish TypeScript Westgard Worker hydration for the legacy bridge');
assert.match(generated, /root\.westgardWorkerPrewarmPlanner\s*=\s*createWestgardWorkerPrewarmPlanner/,
  'artifact must publish TypeScript Westgard Worker prewarm planning for the legacy bridge');
assert.doesNotMatch(generated, /root\.planPartitionWrite\s*=/,
  'artifact must keep the partition-write policy internal to the TypeScript storage flow');
assert.match(generated, /root\.saveCommandPolicy\s*=\s*saveCommandPlan/,
  'artifact must publish the TypeScript save command policy for the legacy bridge');
assert.doesNotMatch(generated, /root\.(?:storageBootService|indexedDbRecoveryService|partitionHydrationService)\s*=/,
  'artifact must keep the storage boot, recovery and hydration services internal to the TypeScript lifecycle');
assert.match(generated, /root\.indexedDbMirrorService\s*=\s*createIndexedDbMirrorService/,
  'artifact must publish the TypeScript IndexedDB mirror service for the legacy bridge');
assert.doesNotMatch(generated, /root\.(?:localStorageLoadService|localStorageSnapshotWriter|partitionedSnapshotWriter)\s*=/,
  'artifact must keep local and partitioned snapshot primitives internal to the TypeScript storage flow');
assert.match(generated, /root\.saveService\s*=\s*createSaveService/,
  'artifact must publish the TypeScript save gateway for the legacy bridge');
assert.match(generated, /root\.firebaseLocalStoreService\s*=\s*createFirebaseLocalStoreService/,
  'artifact must publish the TypeScript Firebase local persistence bridge');
assert.match(generated, /root\.firebaseDisconnectService\s*=\s*createFirebaseDisconnectService/,
  'artifact must publish the TypeScript Firebase disconnect lifecycle bridge');
assert.match(generated, /root\.firebasePushService\s*=\s*createFirebasePushService/,
  'artifact must publish the TypeScript Firebase push lifecycle bridge');
assert.match(generated, /root\.firebaseFullSyncService\s*=\s*createFirebaseFullSyncService/,
  'artifact must publish the TypeScript Firebase full-sync lifecycle bridge');
assert.match(generated, /root\.firebasePushScheduler\s*=\s*createFirebasePushScheduler/,
  'artifact must publish the TypeScript Firebase push scheduler bridge');
assert.match(generated, /root\.firebaseEmptySnapshotService\s*=\s*createFirebaseEmptySnapshotService/,
  'artifact must publish the TypeScript Firebase empty-snapshot lifecycle bridge');
assert.match(generated, /root\.firebaseOwnSnapshotService\s*=\s*createFirebaseOwnSnapshotService/,
  'artifact must publish the TypeScript Firebase own-snapshot lifecycle bridge');
assert.match(generated, /root\.firebaseInvalidSnapshotService\s*=\s*createFirebaseInvalidSnapshotService/,
  'artifact must publish the TypeScript Firebase invalid-snapshot lifecycle bridge');
assert.match(generated, /root\.firebaseAuditRejectionService\s*=\s*createFirebaseAuditRejectionService/,
  'artifact must publish the TypeScript Firebase audit-rejection lifecycle bridge');
assert.match(generated, /root\.firebaseRemoteRenderService\s*=\s*createFirebaseRemoteRenderService/,
  'artifact must publish the TypeScript Firebase remote-render lifecycle bridge');
assert.match(generated, /root\.firebaseSessionStartService\s*=\s*createFirebaseSessionStartService/,
  'artifact must publish the TypeScript Firebase session-start lifecycle bridge');
assert.match(generated, /root\.firebaseMergeCommitService\s*=\s*createFirebaseMergeCommitService/,
  'artifact must publish the TypeScript Firebase merge-commit lifecycle bridge');
assert.match(generated, /root\.firebaseConflictDialogService\s*=\s*createFirebaseConflictDialogService/,
  'artifact must publish the TypeScript Firebase conflict dialog bridge');
assert.match(generated, /root\.firebaseCloudStatusPresentation\s*=\s*createFirebaseCloudStatusPresentation/,
  'artifact must publish the TypeScript Firebase cloud-status presentation bridge');
assert.match(generated, /root\.firebaseSaveStatusService\s*=\s*createFirebaseSaveStatusService/,
  'artifact must publish the TypeScript Firebase save-status presentation bridge');
assert.match(generated, /root\.firebaseRemoteRenderSafetyService\s*=\s*createFirebaseRemoteRenderSafetyService/,
  'artifact must publish the TypeScript Firebase remote-render safety bridge');
assert.match(generated, /root\.firebaseAppService\s*=\s*createFirebaseAppService/,
  'artifact must publish the TypeScript Firebase SDK lifecycle bridge');
assert.match(generated, /root\.firebaseConfigSourceService\s*=\s*createFirebaseConfigSourceService/,
  'artifact must publish the TypeScript Firebase config source bridge');
assert.match(generated, /root\.firebaseReadyState\s*=\s*firebaseReadyState/,
  'artifact must publish the TypeScript Firebase ready-state bridge');
assert.doesNotMatch(generated, /root\.indexedDb(?:OpenService|RecordService|ClearService)\s*=/,
  'artifact must keep internal IndexedDB lifecycle helpers out of the legacy global bridge');
assert.match(generated, /root\.partitionedIndexedDbWriteService\s*=\s*createPartitionedIndexedDbWriteService/,
  'artifact must publish the TypeScript partitioned IndexedDB write bridge');
assert.match(generated, /root\.partitionedIndexedDbReadService\s*=\s*createPartitionedIndexedDbReadService/,
  'artifact must publish the TypeScript partitioned IndexedDB recovery bridge');
assert.match(generated, /root\.passwordPolicyError\s*=\s*passwordPolicyError/,
  'artifact must publish the TypeScript password policy bridge');
assert.match(generated, /root\.passwordChangeError\s*=\s*passwordChangeError/,
  'artifact must publish the TypeScript password-change validation bridge');
assert.match(generated, /root\.pbkdf2PasswordService\s*=\s*createPbkdf2PasswordService/,
  'artifact must publish the TypeScript PBKDF2 password bridge');
assert.match(generated, /root\.passwordHashNeedsUpgrade\s*=\s*passwordHashNeedsUpgrade/,
  'artifact must publish the TypeScript password hash-upgrade bridge');
assert.match(generated, /root\.legacyPasswordHashService\s*=\s*createLegacyPasswordHashService/,
  'artifact must publish the TypeScript legacy password hash bridge');
assert.match(generated, /root\.loginLockoutPolicy\s*=\s*createLoginLockoutPolicy/,
  'artifact must publish the TypeScript login lockout bridge');
assert.match(generated, /root\.blankAppStateFactory\s*=\s*\(?users\)?\s*=>\s*createBlankAppState/,
  'artifact must publish the TypeScript blank-state bridge');
assert.match(generated, /root\.defaultAdminUserFactory\s*=\s*\(id, passHash\)\s*=>\s*createDefaultAdminUser/,
  'artifact must publish the TypeScript default-admin bridge');
assert.match(generated, /root\.newUserValidationError\s*=\s*newUserValidationError/,
  'artifact must publish the TypeScript new-user validation bridge');
assert.match(generated, /root\.selectUserPermissions\s*=\s*selectUserPermissions/,
  'artifact must publish the TypeScript user-permission selection bridge');
assert.match(generated, /root\.activityAuditFilter\s*=\s*createActivityAuditFilter/,
  'artifact must publish the TypeScript activity-audit filter bridge');
assert.match(generated, /root\.activityAuditPagination\s*=\s*activityAuditPagination/,
  'artifact must publish the TypeScript activity-audit pagination bridge');
assert.match(generated, /root\.activityAuditCsv\s*=\s*createActivityAuditCsv/,
  'artifact must publish the TypeScript activity-audit CSV bridge');
assert.match(generated, /root\.updateActivityAuditDateRange\s*=\s*updateActivityAuditDateRange/,
  'artifact must publish the TypeScript activity-audit date-range bridge');
assert.match(generated, /root\.activityAuditFilterState\s*=\s*activityAuditFilterState/,
  'artifact must publish the TypeScript activity-audit control-state bridge');
assert.match(generated, /root\.activityAuditPageSizes\s*=\s*ACTIVITY_AUDIT_PAGE_SIZES/,
  'artifact must publish the TypeScript activity-audit page-size bridge');
assert.match(generated, /root\.activityAuditArchiveWindow\s*=\s*activityAuditArchiveWindow/,
  'artifact must publish the TypeScript activity-audit archive-window bridge');
assert.match(generated, /root\.qcValueFormat\s*=\s*createQcValueFormat/,
  'artifact must publish TypeScript QC value formatting for the legacy bridge');
assert.match(generated, /root\.qcStaffIdentity\s*=\s*createQcStaffIdentity/,
  'artifact must publish TypeScript staff identity formatting for the legacy bridge');
assert.match(generated, /root\.qcDateFormat\s*=\s*createQcDateFormat/,
  'artifact must publish TypeScript date formatting for the legacy bridge');
assert.match(generated, /root\.qcLotTargetHistory\s*=\s*createLotTargetHistory/,
  'artifact must publish TypeScript lot target history for the legacy bridge');
assert.match(generated, /root\.teaAnalyteMetaService\s*=\s*createTeaAnalyteMeta/,
  'artifact must publish TypeScript TEa analyte metadata for the legacy bridge');
assert.match(generated, /root\.qcLevelReconciliation\s*=\s*createQcLevelReconciliation/,
  'artifact must publish TypeScript QC level reconciliation for the legacy bridge');
assert.match(generated, /root\.qcRangeLimitRepair\s*=\s*createRangeLimitRepair/,
  'artifact must publish TypeScript applied range-limit repair for the legacy bridge');
assert.match(generated, /root\.qcBasicFormat\s*=\s*createBasicFormat/,
  'artifact must publish TypeScript base number and export-name formatting for the legacy bridge');
assert.match(generated, /root\.qcAcceptedMemoCache\s*=\s*createAcceptedMemoCache/,
  'artifact must publish TypeScript accepted-points cache for the legacy bridge');
assert.match(generated, /root\.westgardRuleSettings\s*=\s*createWestgardRuleSettings/,
  'artifact must publish TypeScript Westgard rule settings for the legacy bridge');
assert.match(generated, /root\.qcRangeCandidateService\s*=\s*createRangeCandidateService/,
  'artifact must publish TypeScript QC range candidate service for the legacy bridge');
assert.match(generated, /root\.qcRangeSafetyGate\s*=\s*rangeSafetyGate/,
  'artifact must publish TypeScript QC range safety gate for the legacy bridge');
assert.match(generated, /root\.qcRangeBiasEvaluation\s*=\s*rangeBiasEvaluation/,
  'artifact must publish TypeScript QC range Bias evaluation for the legacy bridge');
assert.doesNotMatch(generated, /root\.firebaseConfigParser\s*=|root\.firebaseConfigValidator\s*=/,
  'artifact must not publish Firebase parser/validator facades with no classic caller');
assert.match(generated, /createFirebaseSettingsService\(\(value\)\s*=>\s*parseFirebaseConfig\(value\)\)/,
  'Firebase settings service must call the TypeScript parser directly');
assert.match(generated, /root\.settingsStorageUsageText\s*=/,
  'artifact must publish TypeScript storage usage formatting for settings callers');
assert.match(generated, /root\.settingsBrandProfile\s*=/,
  'artifact must publish TypeScript brand normalization for settings callers');
assert.match(generated, /root\.settingsFirebaseAclHelp\s*=/,
  'artifact must publish TypeScript Firebase ACL guidance for settings callers');
assert.match(generated, /root\.settingsFirebaseRulesText\s*=/,
  'artifact must publish TypeScript Firebase Rules text for settings callers');
assert.match(generated, /root\.settingsFirebaseGuideHtml\s*=/,
  'artifact must publish TypeScript Firebase guide HTML for settings callers');
assert.match(generated, /root\.backupReminderService\s*=\s*createBackupReminder/,
  'artifact must publish TypeScript backup reminder state for legacy callers');
assert.match(generated, /root\.lisQueuePresentation\s*=\s*createLisQueuePresentation/,
  'artifact must publish TypeScript LIS queue presentation for legacy callers');
assert.match(generated, /root\.lisSettingsService\s*=\s*createLisSettingsService/,
  'artifact must publish TypeScript LIS settings validation for legacy callers');
assert.doesNotMatch(generated, /root\.labProfileService\s*=/,
  'artifact must not publish the lab-profile facade used only by the settings command');
assert.match(generated, /root\.firebaseSettingsService\s*=\s*createFirebaseSettingsService/,
  'artifact must publish TypeScript Firebase settings validation for settings callers');
assert.match(generated, /root\.settingsBrandPreviewHtml\s*=\s*createBrandPreviewHtml/,
  'artifact must publish TypeScript brand preview HTML for settings callers');
assert.match(generated, /root\.settingsUnitProfileHtml\s*=\s*createUnitProfileHtml/,
  'artifact must publish TypeScript unit profile HTML for settings callers');
assert.match(generated, /root\.settingsBrandPanelHtml\s*=\s*createBrandPanelHtml/,
  'artifact must publish TypeScript brand panel HTML for settings callers');
assert.match(generated, /root\.settingsAdminToolsHtml\s*=\s*createAdminToolsHtml/,
  'artifact must publish TypeScript admin tools HTML for settings callers');
assert.match(generated, /root\.settingsFirebaseRulesPanelHtml\s*=\s*createFirebaseRulesPanelHtml/,
  'artifact must publish TypeScript Firebase Rules panel HTML for settings callers');
assert.match(generated, /root\.settingsLisGatewayPanelHtml\s*=\s*createLisGatewayPanelHtml/,
  'artifact must publish TypeScript LIS Gateway panel HTML for settings callers');
assert.match(generated, /root\.settingsFirebaseConnectionPanelHtml\s*=\s*createFirebaseConnectionPanelHtml/,
  'artifact must publish TypeScript Firebase connection panel HTML for settings callers');
assert.match(generated, /root\.settingsPageLayoutHtml\s*=\s*createSettingsPageLayoutHtml/,
  'artifact must publish TypeScript settings page layout HTML for settings callers');
assert.match(generated, /root\.userRowHtml\s*=\s*createUserRowHtml/, 'artifact must publish TypeScript user row HTML for the legacy bridge');
assert.match(generated, /root\.usersPageHtml\s*=\s*createUsersPageHtml/, 'artifact must publish TypeScript users page HTML for the legacy bridge');
assert.match(generated, /root\.activityAuditPageHtml\s*=\s*createActivityAuditPageHtml/, 'artifact must publish TypeScript activity audit page HTML for the legacy bridge');
assert.match(generated, /root\.reagentSelectOptionsHtml\s*=\s*createReagentSelectOptionsHtml/, 'artifact must publish TypeScript reagent selector options for the legacy bridge');
assert.match(generated, /root\.reagentResultHtml\s*=\s*createReagentResultHtml/, 'artifact must publish TypeScript reagent result HTML for the legacy bridge');
assert.match(generated, /root\.reagentPairRowHtml\s*=\s*createReagentPairRowHtml/, 'artifact must publish TypeScript reagent pair-row HTML for the legacy bridge');
assert.match(generated, /root\.reportNceDetailHtmlPresentation\s*=\s*createReportNceDetailHtml/, 'artifact must publish TypeScript NCE detail report HTML for the legacy bridge');
assert.match(generated, /root\.dashboardPageHtml\s*=\s*createDashboardPageHtml/, 'artifact must publish TypeScript dashboard page HTML for the legacy bridge');
assert.match(generated, /root\.managePageHtml\s*=\s*createManagePageHtml/, 'artifact must publish TypeScript manage page HTML for the legacy bridge');
assert.match(generated, /root\.actionPageHtml\s*=\s*createActionPageHtml/, 'artifact must publish TypeScript NCE page HTML for the legacy bridge');
assert.doesNotMatch(generated, /root\.csvCellService\s*=/,
  'artifact must not publish the retired CSV cell facade');
assert.match(generated, /root\.reportExportHelpers\s*=\s*reportExportHelpers/,
  'artifact must publish TypeScript report export helpers for the legacy bridge');
assert.match(generated, /root\.actionReportSummary\s*=\s*createActionReportSummary/,
  'artifact must publish TypeScript NCE report summary for the legacy bridge');
assert.match(generated, /root\.actionReportModel\s*=\s*createActionReportModel/,
  'artifact must publish TypeScript NCE report model for the legacy bridge');
assert.match(generated, /root\.sigmaReportMetricService\s*=\s*sigmaReportMetric/,
  'artifact must publish TypeScript Sigma report metric for the legacy bridge');
assert.match(generated, /root\.sigmaMdcItemsService\s*=/,
  'artifact must publish TypeScript Sigma MDC data builder for the legacy bridge');
assert.match(generated, /root\.sigmaMdcLabelPlacementService\s*=/,
  'artifact must publish TypeScript Sigma MDC label placement for the legacy bridge');
assert.match(generated, /root\.sigmaExportPixelRatioService\s*=\s*sigmaExportPixelRatio/,
  'artifact must publish TypeScript Sigma export pixel ratio for the legacy bridge');
assert.match(generated, /root\.sigmaReportRowsService\s*=\s*createSigmaReportRows/,
  'artifact must publish TypeScript Sigma report row builder for the legacy bridge');
assert.match(generated, /root\.qcReportRowsService\s*=\s*createQcReportRows/,
  'artifact must publish TypeScript QC report row builder for the legacy bridge');
assert.match(generated, /root\.qcReportContext\s*=\s*createQcReportContext/,
  'artifact must publish TypeScript QC report context for the legacy bridge');
assert.match(generated, /root\.sigmaDataUrlBytes\s*=/,
  'artifact must publish TypeScript Sigma image byte conversion for the legacy bridge');
assert.match(generated, /root\.sigmaExportMetaService\s*=\s*createSigmaExportMeta/,
  'artifact must publish TypeScript Sigma export metadata for the legacy bridge');
assert.match(generated, /root\.exportMetaRowsService\s*=\s*createExportMetaRows/,
  'artifact must publish TypeScript report export metadata for the legacy bridge');
assert.match(generated, /root\.qcExportValueFormat\s*=\s*createQcExportValueFormat/,
  'artifact must publish TypeScript QC export value formatting for the legacy bridge');
assert.match(generated, /root\.sigmaCanvasFont\s*=\s*createCanvasFont/,
  'artifact must publish TypeScript Sigma canvas font formatting for the legacy bridge');
assert.match(generated, /root\.reportLabels\s*=\s*createReportLabels/,
  'artifact must publish TypeScript report labels for the legacy bridge');
assert.match(generated, /root\.reportSelection\s*=\s*createReportSelection/,
  'artifact must publish TypeScript report selection for the legacy bridge');
assert.match(generated, /root\.reportSearch\s*=\s*createReportSearch/,
  'artifact must publish TypeScript report search for the legacy bridge');
assert.match(generated, /root\.sigmaMuTraceService\s*=\s*createSigmaMuTrace/,
  'artifact must publish TypeScript Sigma MU trace for the legacy bridge');
assert.match(generated, /root\.sigmaPrintRowsService\s*=\s*createSigmaPrintRows/,
  'artifact must publish TypeScript Sigma print rows for the legacy bridge');
assert.match(generated, /root\.sigmaMuPrintRowsService\s*=\s*createSigmaMuPrintRows/,
  'artifact must publish TypeScript Sigma MU print rows for the legacy bridge');
assert.match(generated, /root\.reportPointsTableService\s*=\s*createReportPointsTable/,
  'artifact must publish TypeScript report points table for the legacy bridge');
assert.match(generated, /root\.actionReportHtml\s*=\s*createActionReportHtml/,
  'artifact must publish TypeScript NCE report HTML for the legacy bridge');
assert.match(generated, /root\.sigmaDraftService\s*=\s*createSigmaDraftService/,
  'artifact must publish TypeScript Sigma draft persistence for the legacy bridge');
assert.doesNotMatch(generated, /root\.stateAdoptionService\s*=/,
  'artifact must not publish state adoption used only by the storage lifecycle');
assert.match(generated, /root\.corruptLocalQuarantine\s*=\s*createCorruptLocalQuarantine/,
  'artifact must publish TypeScript corrupt-local quarantine for the legacy bridge');
assert.match(generated, /root\.syncValueCodec\s*=\s*modularSyncCodec/,
  'artifact must publish TypeScript sync value codec for the legacy bridge');
assert.match(generated, /root\.firebaseConfigSelection\s*=\s*createFirebaseConfigSelection/,
  'artifact must publish TypeScript Firebase config selection for the legacy bridge');
assert.match(generated, /root\.firebaseConnectionGate\s*=\s*createFirebaseConnectionGate/,
  'artifact must publish TypeScript Firebase connection gate for the legacy bridge');
assert.match(generated, /root\.syncSnapshotSignature\s*=\s*syncSnapshotSignature/,
  'artifact must publish TypeScript sync snapshot signature for the legacy bridge');
assert.doesNotMatch(manageRoutesSource, /function teaRef(?:SourceMeta|StampSource)\(/,
  'Manage adapter must not retain retired TEa metadata facades');
assert.doesNotMatch(reagentClassicSource, /function rc(?:PTwo|TCrit|Max|Min|Mean|Var|Pearson|Ols|Median|PB|Valid)\(/,
  'Reagent adapter must not retain unused statistics facades');
assert.doesNotMatch(generated, /root\.syncCanon\s*=/,
  'artifact must not publish the retired canonical-snapshot facade');
assert.match(generated, /root\.ActionReviewService\s*=\s*createActionReviewService/,
  'artifact must publish the NCE review service for legacy workflow callers');
assert.match(generated, /root\.ActionEscalationService\s*=\s*createActionEscalationService/,
  'artifact must publish the NCE escalation service for legacy workflow callers');
assert.doesNotMatch(generated, /root\.ActionRecordService\s*=/,
  'artifact must not publish the NCE record facade used only inside the bundle');
assert.match(generated, /root\.ActionBiasService\s*=\s*createActionBiasService/,
  'artifact must publish the NCE Bias service for legacy form callers');
assert.match(generated, /root\.ActionViolationService\s*=\s*createActionViolationService/,
  'artifact must publish the NCE violation service for legacy route callers');
assert.match(generated, /root\.ActionListPresentation\s*=\s*createActionListPresentation/,
  'artifact must publish the NCE list presentation service for legacy route callers');
assert.match(generated, /root\.ActionEvidencePresentation\s*=\s*createActionEvidencePresentation/,
  'artifact must publish the NCE evidence presentation service for legacy route callers');
assert.match(generated, /root\.ActionRerunEvidencePresentation\s*=\s*createActionRerunEvidencePresentation/,
  'artifact must publish the NCE rerun evidence presentation service for legacy route callers');
assert.match(generated, /root\.ActionStatusPresentation\s*=\s*createActionStatusPresentation/,
  'artifact must publish the NCE status presentation service for legacy route callers');
assert.match(generated, /root\.ActionReviewPresentation\s*=\s*createActionReviewPresentation/,
  'artifact must publish the NCE review presentation service for legacy route callers');
assert.match(generated, /root\.ActionDetailPresentation\s*=\s*createActionDetailPresentation/,
  'artifact must publish the NCE detail presentation service for legacy route callers');
assert.match(generated, /root\.ActionGuidePresentation\s*=\s*createActionGuidePresentation/,
  'artifact must publish the NCE guide presentation service for legacy route callers');
assert.match(generated, /root\.ActionInvestigationPresentation\s*=\s*actionInvestigationPresentation/,
  'artifact must publish NCE investigation presentation for legacy form callers');
assert.match(generated, /root\.ActionChecklistPresentation\s*=\s*createActionChecklistPresentation/,
  'artifact must publish NCE checklist presentation for legacy form callers');
assert.match(generated, /root\.ReportPeriodPresentation\s*=\s*createReportPeriodPresentation/,
  'artifact must publish the report period presentation service for legacy route callers');
assert.match(generated, /root\.NceActionLabels\s*=\s*nceActionLabels/,
  'artifact phai cong bo danh muc NCE bat bien cho workflow cu');
assert.match(generated, /root\.ChartViewModel\s*=\s*chartViewModel/,
  'artifact phải công bố đúng API mà UI cũ đang dùng');
assert.match(generated, /root\.SigmaPresentation\s*=\s*sigmaPresentation/,
  'artifact must publish Sigma presentation API for legacy callers');
assert.match(generated, /root\.SigmaPeriodViewModel\s*=\s*createSigmaPeriodViewModel/,
  'artifact must publish Sigma period view-model for legacy callers');
assert.match(generated, /root\.SigmaBiasService\s*=\s*createSigmaBiasService/,
  'artifact must publish Sigma Bias service for legacy callers');
assert.match(generated, /root\.SigmaCohortImportService\s*=\s*createSigmaCohortImportService/,
  'artifact must publish Sigma cohort import service for legacy callers');
assert.match(generated, /root\.SigmaPeriodRecordService\s*=\s*createSigmaPeriodRecordService/,
  'artifact must publish Sigma period record service for legacy callers');
assert.match(generated, /root\.SigmaLevelEditService\s*=\s*createSigmaLevelEditService/,
  'artifact must publish Sigma level edit service for legacy callers');
assert.match(generated, /root\.SigmaTrackedTestService\s*=\s*createSigmaTrackedTestService/,
  'artifact must publish Sigma tracked-test service for legacy callers');
assert.match(generated, /root\.SigmaBiasWorkflowService\s*=\s*createSigmaBiasWorkflowService/,
  'artifact must publish Sigma Bias workflow service for legacy callers');
assert.match(generated, /root\.SigmaMuWorkflowService\s*=\s*createSigmaMuWorkflowService/,
  'artifact must publish Sigma MU workflow service for legacy callers');
assert.match(generated, /root\.SigmaCohortSelectionService\s*=\s*createSigmaCohortSelectionService/,
  'artifact must publish Sigma cohort selection service for legacy callers');
assert.match(generated, /root\.SigmaTeaEditService\s*=\s*createSigmaTeaEditService/,
  'artifact must publish Sigma TEa edit service for legacy callers');
assert.match(generated, /root\.SigmaTeaSnapshotService\s*=\s*createSigmaTeaSnapshotService/,
  'artifact must publish Sigma TEa snapshot service for legacy callers');
assert.match(generated, /root\.SigmaLevelSelectionService\s*=\s*createSigmaLevelSelectionService/,
  'artifact must publish Sigma level selection service for legacy callers');
assert.match(generated, /root\.SigmaPeriodSelectionService\s*=\s*createSigmaPeriodSelectionService/,
  'artifact must publish Sigma period selection service for legacy callers');
assert.match(generated, /root\.SigmaCohortService\s*=\s*createSigmaCohortService/,
  'artifact phải công bố Sigma cohort API cho caller cũ');
assert.match(generated, /root\.WestgardViewModel\s*=\s*westgardViewModel/,
  'artifact phải công bố Westgard view-model API cho caller cũ');
assert.match(generated, /root\.westgardRowsWindow\s*=\s*westgardRowsWindow/,
  'artifact must publish TypeScript Westgard row window for legacy route callers');
assert.match(generated, /root\.westgardArchivedGroups\s*=\s*westgardArchivedGroups/,
  'artifact must publish TypeScript Westgard archived-group selection for legacy route callers');
assert.match(generated, /root\.westgardArchivedMultiViews\s*=\s*westgardArchivedMultiViews/,
  'artifact must publish TypeScript Westgard archived multi-chart data for legacy route callers');
assert.match(generated, /root\.westgardArchivedGroupMatches\s*=\s*westgardArchivedGroupMatches/,
  'artifact must publish TypeScript Westgard archived-group search for legacy route callers');
assert.match(generated, /root\.reportSearchValuePresentation\s*=\s*reportSearchValuePresentation/,
  'artifact must publish TypeScript report search values for legacy route callers');
assert.match(generated, /root\.westgardArchivedTestSelection\s*=\s*westgardArchivedTestSelection/,
  'artifact must publish TypeScript Westgard archived test selection for legacy route callers');
assert.match(generated, /root\.reagentPairMath\s*=\s*reagentPairMath/,
  'artifact must publish TypeScript reagent pair math for legacy route callers');
assert.doesNotMatch(generated, /root\.reagentStatistics\s*=/,
  'artifact must not publish the retired reagent-statistics facade');
assert.doesNotMatch(generated, /root\.reagentTDistribution\s*=/,
  'artifact must not publish the retired t-distribution facade');
assert.match(generated, /root\.reagentComparisonCalculator\s*=\s*createReagentComparisonCalculator\(/,
  'artifact must publish TypeScript reagent comparison calculation for legacy route callers');
assert.match(generated, /root\.reagentChartPresentation\s*=\s*reagentChartPresentation/,
  'artifact must publish TypeScript reagent chart range for legacy route callers');
assert.match(generated, /root\.reagentReportItemPresentation\s*=\s*reagentReportItemPresentation/,
  'artifact must publish TypeScript reagent report items for legacy route callers');
assert.match(generated, /root\.reagentComparisonLabelPresentation\s*=\s*reagentComparisonLabelPresentation/,
  'artifact must publish TypeScript reagent comparison labels for legacy route callers');
assert.match(generated, /root\.reportActionIconPresentation\s*=\s*reportActionIconPresentation/,
  'artifact must publish TypeScript report action icons for legacy route callers');
assert.match(generated, /root\.reagentQuickLabelPresentation\s*=\s*reagentQuickLabelPresentation/,
  'artifact must publish TypeScript reagent quick labels for legacy route callers');
assert.match(generated, /root\.reagentToolIconPresentation\s*=\s*reagentToolIconPresentation/,
  'artifact must publish TypeScript reagent tool icons for legacy route callers');
assert.match(generated, /root\.ReagentComparisonService\s*=\s*createReagentComparisonService/,
  'artifact phải công bố Reagent application service cho caller cũ');
assert.match(generated, /root\.reagentReportPresentation\s*=\s*reagentReportPresentation/,
  'artifact must publish TypeScript reagent report presentation for legacy print callers');
assert.match(generated, /root\.EntryService\s*=\s*createEntryService/,
  'artifact phải công bố Entry application service cho caller cũ');
assert.match(generated, /root\.LISClientService\s*=\s*lisClient/,
  'artifact phải công bố LIS application service cho UI cũ');
assert.match(generated, /root\.ManageConfigService\s*=\s*createManageConfigService/,
  'artifact phải công bố Manage config application service cho caller cũ');
assert.match(generated, /root\.PeriodService\s*=\s*createPeriodService/,
  'artifact phải công bố Period application service cho caller cũ');
assert.match(generated, /root\.qcPointWarnings\s*=/,
  'artifact phải công bố hàm cảnh báo điểm QC cho caller cũ');
for (const namespace of ['AnalysisUIState', 'AuthUIState', 'EntryUIState', 'ManageUIState', 'ReagentUIState', 'SigmaUIState']) {
  assert.match(generated, new RegExp(`installUiState\\(root,\\s*['"]${namespace}['"]`),
    `artifact phải cài ${namespace} cùng accessor tương thích`);
}
assert.match(pkg.scripts.typecheck, /tsconfig\.modules\.json/,
  'typecheck phải kiểm tra cả vùng TypeScript strict');
assert.match(derivedCacheInvalidationSource, /export function createDerivedCacheInvalidation\(/,
  'derived-cache invalidation phải tách thành TypeScript factory nhận dependency');
assert.match(configurationRelationsSource, /export function reconcileConfigurationRelations\(/,
  'configuration relations phải tách thành TypeScript service nhận dependency');
assert.match(testConfigurationSource, /export function normalizeTestConfiguration\(/,
  'test configuration phải tách thành TypeScript service nhận dependency');
assert.match(foundationNormalizationSource, /export function normalizeStateFoundation\(/,
  'state foundation phải tách thành TypeScript service nhận dependency');
assert.match(stateLifecycleNormalizationSource, /export function normalizeStateLifecycle\(/,
  'state lifecycle phải tách thành TypeScript service nhận dependency');
assert.match(read('assets/modules/state.js'), /function ensureShape\(opts=\{\}\)\{const normalized=globalThis\.qcStateFoundation/,
  'ensureShape phải gọi trực tiếp state foundation TypeScript, không quay về fallback classic');
assert.doesNotMatch(read('assets/modules/state.js'), /if\(globalThis\.qcTestConfiguration\)|if\(globalThis\.qcConfigurationRelations\)|if\(false\)/,
  'state adapter không được giữ implementation configuration legacy đã retire');
assert.doesNotMatch(read('assets/modules/state.js'), /if\(globalThis\.qcLevelReconciliation\)|qcRangeLimitRepair\?/, 
  'state adapter không được giữ fallback legacy cho reconciliation và range repair');
assert.doesNotMatch(read('assets/modules/state.js'), /typeof ManageConfigService|if\(globalThis\.qcLotTargetHistory\)/,
  'state adapter không được giữ fallback legacy cho helper cấu hình lô');
assert.match(read('assets/modules/state.js'), /function clearDerived\(\)\{return globalThis\.derivedCacheInvalidation\.clearAll\(\);\}/,
  'state adapter phải ủy quyền xóa derived cache cho TypeScript');
assert.match(csvDownloadSource, /export function createCsvDownload\(/,
  'CSV download phải tách thành TypeScript factory nhận dependency');
assert.match(cssTokenPixelSource, /export function cssTokenPixel\(/,
  'CSS token pixel phải tách thành TypeScript helper nhận dependency');
assert.match(visibleCanvasServiceSource, /export function createVisibleCanvasService\(/,
  'điều phối canvas sau render phải tách thành TypeScript service nhận dependency');
assert.match(chartTooltipServiceSource, /export function createChartTooltipService\(/,
  'tooltip biểu đồ phải tách thành TypeScript service nhận dependency');
assert.match(leveyJenningsTooltipControllerSource, /export function createLeveyJenningsTooltipController\(/,
  'controller tooltip Levey-Jennings phải tách thành TypeScript service nhận dependency');
assert.match(hiDpiCanvasSource, /export function createHiDpiCanvasSetup\(/,
  'chuẩn hóa canvas HiDPI phải tách thành TypeScript factory nhận dependency');
assert.match(chartDataUrlSource, /export function createChartDataUrl\(/,
  'chart data URL phải tách thành TypeScript factory');
assert.match(leveyJenningsGeometrySource, /export function leveyJenningsGeometry\(/,
  'tọa độ biểu đồ Levey-Jennings phải tách thành TypeScript helper thuần');
assert.match(westgardRuleScopeSource, /export function createWestgardRuleScope\(/,
  'phạm vi luật Westgard của biểu đồ phải tách thành TypeScript factory');
assert.match(leveyJenningsColorsSource, /export const LEVEY_JENNINGS_COLORS=Object\.freeze/,
  'palette Levey-Jennings phải là danh mục TypeScript bất biến');
assert.match(leveyJenningsTicksSource, /export function createLeveyJenningsTicks\(/,
  'tick trục thời gian Levey-Jennings phải tách thành TypeScript factory');
assert.match(leveyJenningsYAxisSource, /export function createLeveyJenningsYAxisLabels\(/,
  'nhãn trục Y Levey-Jennings phải tách thành TypeScript factory');
assert.match(leveyJenningsHoverModelSource, /export function createLeveyJenningsHoverModel\(/,
  'model hover Levey-Jennings phải tách thành TypeScript factory');
assert.match(leveyJenningsPointStyleSource, /export function leveyJenningsPointStyle\(/,
  'style điểm Levey-Jennings phải tách thành TypeScript helper thuần');
assert.match(leveyJenningsDisplayPlanSource, /export function createLeveyJenningsDisplayPlan\(/,
  'kế hoạch downsampling Levey-Jennings phải tách thành TypeScript factory');
assert.match(leveyJenningsPointRenderModelSource, /export function createLeveyJenningsPointRenderModel\(/,
  'model render điểm Levey-Jennings phải tách thành TypeScript factory');
assert.match(leveyJenningsBandsSource, /export function leveyJenningsBandRects\(/,
  'dải chuẩn Levey-Jennings phải tách thành TypeScript helper thuần');
assert.match(leveyJenningsGridSource, /export function leveyJenningsGridLines\(/,
  'lưới Levey-Jennings phải tách thành TypeScript helper thuần');
assert.match(leveyJenningsMultiSeriesSource, /export function leveyJenningsMultiSeries\(/,
  'dữ liệu biểu đồ Levey-Jennings đa mức phải tách thành TypeScript helper thuần');
assert.match(leveyJenningsMultiRunTicksSource, /export function createLeveyJenningsMultiRunTicks\(/,
  'tick run biểu đồ Levey-Jennings đa mức phải tách thành TypeScript factory');
assert.match(leveyJenningsLegendLayoutSource, /export function createLeveyJenningsLegendLayout\(/,
  'layout chú giải Levey-Jennings phải tách thành TypeScript factory');
assert.match(leveyJenningsMultiDisplayPlanSource, /export function createLeveyJenningsMultiDisplayPlan\(/,
  'kế hoạch downsampling Levey-Jennings đa mức phải tách thành TypeScript factory');
assert.match(leveyJenningsMultiHoverModelSource, /export function createLeveyJenningsMultiHoverModel\(/,
  'model hover Levey-Jennings đa mức phải tách thành TypeScript factory');
assert.match(leveyJenningsMultiPointRenderModelSource, /export function createLeveyJenningsMultiPointRenderModel\(/,
  'model render điểm Levey-Jennings đa mức phải tách thành TypeScript factory');
assert.match(leveyJenningsMultiDividersSource, /export function leveyJenningsMultiDividers\(/,
  'đường phân cách Levey-Jennings đa mức phải tách thành TypeScript helper thuần');
assert.match(cusumChartGeometrySource, /export function cusumChartGeometry\(/,
  'hình học CUSUM phải tách thành TypeScript helper thuần');
assert.match(cusumDisplayPlanSource, /export function createCusumDisplayPlan\(/,
  'CUSUM display plan phải tách thành TypeScript factory');
assert.match(cusumHoverModelSource, /export function createCusumHoverModel\(/,
  'CUSUM hover model phải tách thành TypeScript factory');
assert.match(cusumPointRenderModelSource, /export function cusumPointRenderModel\(/,
  'CUSUM point render model phải tách thành TypeScript helper');
assert.match(cusumReferenceLinesSource, /export function cusumReferenceLines\(/,
  'CUSUM reference lines phải tách thành TypeScript helper');
assert.match(cusumLinePointsSource, /export function cusumLinePoints\(/,
  'CUSUM line points phải tách thành TypeScript helper');
assert.match(blobDownloadSource, /export function createBlobDownload\(/,
  'blob download phải tách thành TypeScript factory nhận dependency');
assert.match(xlsxCellSource, /export function createXlsxCells\(/,
  'XLSX cell writer phải tách thành TypeScript factory nhận dependency');
assert.match(xlsxZipSource, /export function createXlsxZip\(/,
  'XLSX ZIP writer phải tách thành TypeScript factory nhận dependency');
assert.match(xlsxPeriodSource, /export function xlsxPeriodNumber\(/,
  'XLSX period parser phải tách thành TypeScript helper độc lập');
assert.match(xlsxDrawingSource, /export function createXlsxDrawing\(/,
  'XLSX DrawingML writer phải tách thành TypeScript factory nhận dependency');
assert.match(sigmaXlsxStylesSource, /export function sigmaXlsxStyles\(/,
  'Sigma XLSX styles phải tách thành TypeScript helper độc lập');
assert.match(reportXlsxStylesSource, /export function reportXlsxStyles\(/,
  'Report XLSX styles phải tách thành TypeScript helper độc lập');
assert.match(reportXlsxDrawingSource, /export function createReportXlsxDrawing\(/,
  'Report XLSX DrawingML phải tách thành TypeScript factory nhận dependency');
assert.match(reportXlsxSheetSource, /export function createReportXlsxSheet\(/,
  'Report XLSX worksheet phải tách thành TypeScript factory nhận dependency');
assert.match(reportXlsxBuilderSource, /export function createReportXlsxBuilder\(/,
  'Report XLSX workbook phải tách thành TypeScript factory nhận dependency');
assert.match(xlsxEscapeSource, /export function xlsxEscape\(/,
  'XLSX XML escape phải tách thành TypeScript helper độc lập');
assert.match(reportXlsxStyleIdsSource, /export const REPORT_XLSX_STYLE_IDS=Object\.freeze/,
  'Report XLSX style IDs phải là danh mục TypeScript bất biến');
assert.match(xlsxColumnsSource, /export const XLSX_COLUMNS=Object\.freeze/,
  'XLSX column labels phải là danh mục TypeScript bất biến');
assert.match(xlsxEmuSource, /export function xlsxEmu\(/,
  'XLSX pixel-to-EMU conversion phải tách thành TypeScript helper độc lập');
assert.match(sigmaChartRendererSource, /deps\.canvas\(/,
  'Sigma chart renderer phải tự vẽ bằng dependency thay vì gọi lại legacy renderer');
assert.match(sigmaMdcRendererSource, /deps\.placements\(/,
  'Sigma MDC renderer phải tự đặt nhãn bằng dependency thay vì gọi lại legacy renderer');
assert.match(xlsxRoundingSource, /export function xlsxRound\(/,
  'XLSX rounding phải tách thành TypeScript helper độc lập');
assert.doesNotMatch(blobDownloadSource, /\bglobalThis\b|\bdocument\b/,
  'blob download không được tự đọc global hoặc DOM');
assert.doesNotMatch(cssTokenPixelSource, /\bglobalThis\b|\bdocument\b/,
  'CSS token pixel không được tự đọc global hoặc DOM');
assert.doesNotMatch(visibleCanvasServiceSource, /\bglobalThis\b|\bdocument\b/,
  'điều phối canvas sau render không được tự đọc global hoặc DOM');
assert.doesNotMatch(chartTooltipServiceSource, /\bglobalThis\b|\bdocument\b/,
  'tooltip biểu đồ không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsTooltipControllerSource, /\bglobalThis\b|\bdocument\b/,
  'controller tooltip Levey-Jennings không được tự đọc global hoặc DOM');
assert.doesNotMatch(chartDataUrlSource, /\bglobalThis\b|\bdocument\b/,
  'chart data URL không được tự đọc global hoặc DOM');
assert.doesNotMatch(hiDpiCanvasSource, /\bglobalThis\b|\bdocument\b/,
  'chuẩn hóa canvas HiDPI không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsGeometrySource, /\bglobalThis\b|\bdocument\b/,
  'tọa độ biểu đồ Levey-Jennings không được tự đọc global hoặc DOM');
assert.doesNotMatch(westgardRuleScopeSource, /\bglobalThis\b|\bdocument\b/,
  'phạm vi luật Westgard của biểu đồ không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsColorsSource, /\bglobalThis\b|\bdocument\b/,
  'palette Levey-Jennings không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsTicksSource, /\bglobalThis\b|\bdocument\b/,
  'tick trục thời gian Levey-Jennings không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsYAxisSource, /\bglobalThis\b|\bdocument\b/,
  'nhãn trục Y Levey-Jennings không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsHoverModelSource, /\bglobalThis\b|\bdocument\b/,
  'model hover Levey-Jennings không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsPointStyleSource, /\bglobalThis\b|\bdocument\b/,
  'style điểm Levey-Jennings không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsDisplayPlanSource, /\bglobalThis\b|\bdocument\b/,
  'kế hoạch downsampling Levey-Jennings không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsPointRenderModelSource, /\bglobalThis\b|\bdocument\b/,
  'model render điểm Levey-Jennings không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsBandsSource, /\bglobalThis\b|\bdocument\b/,
  'dải chuẩn Levey-Jennings không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsGridSource, /\bglobalThis\b|\bdocument\b/,
  'lưới Levey-Jennings không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsMultiSeriesSource, /\bglobalThis\b|\bdocument\b/,
  'dữ liệu biểu đồ Levey-Jennings đa mức không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsMultiRunTicksSource, /\bglobalThis\b|\bdocument\b/,
  'tick run biểu đồ Levey-Jennings đa mức không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsLegendLayoutSource, /\bglobalThis\b|\bdocument\b/,
  'layout chú giải Levey-Jennings không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsMultiDisplayPlanSource, /\bglobalThis\b|\bdocument\b/,
  'kế hoạch downsampling Levey-Jennings đa mức không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsMultiHoverModelSource, /\bglobalThis\b|\bdocument\b/,
  'model hover Levey-Jennings đa mức không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsMultiPointRenderModelSource, /\bglobalThis\b|\bdocument\b/,
  'model render điểm Levey-Jennings đa mức không được tự đọc global hoặc DOM');
assert.doesNotMatch(leveyJenningsMultiDividersSource, /\bglobalThis\b|\bdocument\b/,
  'đường phân cách Levey-Jennings đa mức không được tự đọc global hoặc DOM');
assert.doesNotMatch(cusumChartGeometrySource, /\bglobalThis\b|\bdocument\b/,
  'hình học CUSUM không được tự đọc global hoặc DOM');
assert.doesNotMatch(cusumDisplayPlanSource, /\bglobalThis\b|\bdocument\b/,
  'CUSUM display plan không được tự đọc global hoặc DOM');
assert.doesNotMatch(cusumHoverModelSource, /\bglobalThis\b|\bdocument\b/,
  'CUSUM hover model không được tự đọc global hoặc DOM');
assert.doesNotMatch(cusumPointRenderModelSource, /\bglobalThis\b|\bdocument\b/,
  'CUSUM point render model không được tự đọc global hoặc DOM');
assert.doesNotMatch(cusumReferenceLinesSource, /\bglobalThis\b|\bdocument\b/,
  'CUSUM reference lines không được tự đọc global hoặc DOM');
assert.doesNotMatch(cusumLinePointsSource, /\bglobalThis\b|\bdocument\b/,
  'CUSUM line points không được tự đọc global hoặc DOM');
assert.doesNotMatch(csvDownloadSource, /\bglobalThis\b|\bdocument\b/,
  'CSV download không được tự đọc global hoặc DOM');
assert.doesNotMatch(stateLifecycleNormalizationSource, /\bglobalThis\b|\bdocument\b/,
  'state lifecycle không được tự đọc global hoặc DOM');
assert.doesNotMatch(foundationNormalizationSource, /\bglobalThis\b|\bdocument\b/,
  'state foundation không được tự đọc global hoặc DOM');
assert.doesNotMatch(testConfigurationSource, /\bglobalThis\b|\bdocument\b/,
  'test configuration không được tự đọc global hoặc DOM');
assert.doesNotMatch(configurationRelationsSource, /\bglobalThis\b|\bdocument\b/,
  'configuration relations không được tự đọc global hoặc DOM');
assert.doesNotMatch(derivedCacheInvalidationSource, /\bglobalThis\b|\bdocument\b/,
  'derived-cache invalidation không được tự đọc global hoặc DOM');
assert.match(generated, /root\.derivedCacheInvalidation\s*=\s*createDerivedCacheInvalidation/,
  'artifact phải công bố TypeScript derived-cache invalidation cho wrapper cũ');
assert.match(generated, /root\.qcConfigurationRelations\s*=\s*reconcileConfigurationRelations/,
  'artifact phải công bố TypeScript configuration relations cho wrapper cũ');
assert.match(generated, /root\.qcTestConfiguration\s*=\s*normalizeTestConfiguration/,
  'artifact phải công bố TypeScript test configuration cho wrapper cũ');
assert.match(generated, /root\.qcStateFoundation\s*=\s*normalizeStateFoundation/,
  'artifact phải công bố TypeScript state foundation cho wrapper cũ');
assert.match(generated, /root\.qcStateLifecycle\s*=\s*normalizeStateLifecycle/,
  'artifact phải công bố TypeScript state lifecycle cho wrapper cũ');
assert.match(generated, /root\.csvDownload\s*=\s*createCsvDownload/,
  'artifact phải công bố TypeScript CSV download cho wrapper cũ');
assert.match(generated, /root\.cssTokenPixel\s*=/,
  'artifact phải công bố TypeScript CSS token pixel cho wrapper cũ');
assert.match(generated, /root\.afterRenderCanvasService\s*=\s*createVisibleCanvasService/,
  'artifact phải công bố TypeScript điều phối canvas cho wrapper cũ');
assert.match(generated, /root\.afterRender\s*=\s*createAfterRenderController/,
  'artifact phải công bố after-render controller TypeScript cho caller route legacy');
assert.doesNotMatch(generated, /root\.chartTooltipService\s*=/,
  'artifact không được công bố facade tooltip chỉ dùng nội bộ bundle');
assert.doesNotMatch(generated, /root\.dashboard(?:TestStatusTags|TestRank|Completion)\s*=/,
  'artifact không được công bố helper dashboard chỉ dùng nội bộ bundle');
assert.doesNotMatch(generated, /root\.BackupService\s*=/,
  'artifact không được công bố namespace backup chỉ dùng nội bộ bundle');
assert.match(generated, /root\.qcTooltip\s*=\s*chartTooltip/,
  'qcTooltip bridge tại ranh giới canvas/SVG classic');
assert.match(generated, /root\.leveyJenningsTooltipController\s*=\s*createLeveyJenningsTooltipController/,
  'artifact phải công bố TypeScript controller tooltip Levey-Jennings cho wrapper cũ');
assert.match(generated, /root\.chartDataUrl\s*=\s*createChartDataUrl/,
  'artifact phải công bố TypeScript chart data URL cho wrapper cũ');
assert.match(drawSource, /deps\.chartDataUrl\(\{ width: 1400, height: 430, render: canvas => drawLJ\(canvas, points, mean, sd\) \}\)/,
  'xuất Levey-Jennings đơn phải dùng chart data URL từ dependency injected');
assert.match(drawSource, /deps\.chartDataUrl\(\{ width: 1400, height: 430, render: canvas => drawLJMultiZ\(canvas, levelViews, test, opts\) \}\)/,
  'xuất Levey-Jennings đa mức phải dùng chart data URL từ dependency injected');
assert.match(generated, /root\.hiDpiCanvasSetup\s*=\s*createHiDpiCanvasSetup/,
  'artifact phải công bố TypeScript chuẩn hóa canvas HiDPI cho wrapper cũ');
assert.match(generated, /root\.leveyJenningsGeometry\s*=\s*leveyJenningsGeometry/,
  'artifact phải công bố TypeScript tọa độ biểu đồ Levey-Jennings cho wrapper cũ');
assert.match(generated, /root\.westgardRuleScope\s*=\s*createWestgardRuleScope/,
  'artifact phải công bố TypeScript phạm vi luật Westgard cho wrapper cũ');
assert.doesNotMatch(drawSource, /function setupHiDPICanvas\(/,
  'renderer không được giữ wrapper HiDPI classic chỉ chuyển tiếp sang TypeScript');
assert.match(drawSource, /deps\.hiDpiCanvasSetup\(canvas\)/,
  'renderer phải gọi trực tiếp setup HiDPI từ dependency injected');
assert.doesNotMatch(drawSource, /function (drawRuleWithin|drawRuleAcross|drawCanvasFont|bindLJTooltip)\(/,
  'renderer không được giữ các wrapper classic chỉ chuyển tiếp sang bridge TypeScript');
assert.doesNotMatch(drawSource, /function qcTooltip\(/,
  'qcTooltip phải thuộc compatibility bridge');
assert.doesNotMatch(drawSource, /\bglobalThis\b/,
  'chart renderer không được tự đọc globalThis — mọi dependency phải qua deps');
assert.match(drawSource, /deps\.westgardRuleScope\.within\(test, rule\)/,
  'renderer phải gọi trực tiếp phạm vi luật Westgard từ dependency injected');
assert.match(drawSource, /deps\.canvasFont\(800, 'type-caption', 11\.5\)/,
  'renderer phải gọi trực tiếp canvas font từ dependency injected');
assert.match(drawSource, /deps\.leveyJenningsTooltipController\(canvas\)/,
  'renderer phải gọi trực tiếp tooltip controller từ dependency injected');
assert.match(dashboardRoutesSource, /return pageDashLoading\(tests, missingWestgard\.length\);/,
  'dashboard phải gọi trực tiếp loading presentation từ TypeScript bridge');
assert.match(dashboardRoutesSource, /dashItems\.filter\(item => deps\.dashboardStatusFilter\.matches\(item, dashTestStatus\)\)/,
  'dashboard phải gọi trực tiếp status filter TypeScript bridge');
assert.match(dashboardRoutesSource, /deps\.setDashTestStatus\(deps\.dashboardStatusFilter\.normalize\(value\)\);/,
  'dashboard phải chuẩn hóa status qua TypeScript bridge');
assert.match(dashboardRoutesSource, /const expByLot = deps\.dashboardExpiringLots\(exp\);/,
  'dashboard phải gom lô sắp hết hạn qua TypeScript bridge');
assert.match(dashboardRoutesSource, /const expHtml = deps\.dashboardExpiringLotsHtml\(expByLot\.values\(\)\);/,
  'dashboard phải render lô sắp hết hạn qua TypeScript bridge');
assert.match(dashboardRoutesSource, /const dashItems = deps\.dashboardTestItems\(tests, today\);/,
  'dashboard phải chọn điểm mới nhất qua TypeScript bridge');
assert.match(dashboardRoutesSource, /const dashItems = deps\.dashboardTestItems\(tests, today\);/,
  'dashboard phải tạo chuỗi tìm kiếm qua TypeScript bridge');
assert.match(dashboardRoutesSource, /const dashboardKpi = deps\.dashboardKpis\(dashItems, tests\.length\), \{ totalPoints: totalPts, todayPoints: todayPts, rejected: rej, warnings: warn, missingToday: missingTodayCount, completeTests: doneTests, completionPercent: pct \} = dashboardKpi;/,
  'dashboard phải tính KPI qua TypeScript bridge');
assert.match(dashboardRoutesSource, /const testRows = deps\.dashboardTestRowsHtml\(statusItems\);/,
  'dashboard phải tạo tag Westgard qua TypeScript bridge');
assert.doesNotMatch(dashboardRoutesSource, /dashboardCompletion\(/,
  'dashboard phải tính hoàn thành QC qua TypeScript bridge');
assert.match(dashboardRoutesSource, /const shift = deps\.dashboardShiftStatus\(/,
  'dashboard phải xác định trạng thái ca trực qua TypeScript bridge');
assert.match(dashboardRoutesSource, /const followHtml = deps\.dashboardFollowupPanelHtml\(urgentHtml, overdueHtml, noTargetHtml, watchHtml\);/,
  'dashboard phải dựng bảng theo dõi qua TypeScript bridge');
assert.match(dashboardRoutesSource, /const dashStatusTabs = deps\.dashboardStatusTabsHtml\(dashItems, dashTestStatus\);/,
  'dashboard phải dựng tab trạng thái qua TypeScript bridge');
assert.match(dashboardRoutesSource, /const testListHtml = deps\.dashboardTestListHtml\(statusItems\.length, testRows\);/,
  'dashboard phải dựng danh sách xét nghiệm qua TypeScript bridge');
assert.match(generated, /root\.leveyJenningsColors\s*=\s*LEVEY_JENNINGS_COLORS/,
  'artifact phải công bố TypeScript palette Levey-Jennings cho wrapper cũ');
assert.match(generated, /root\.leveyJenningsTicks\s*=\s*createLeveyJenningsTicks/,
  'artifact phải công bố TypeScript tick trục thời gian Levey-Jennings cho wrapper cũ');
assert.match(generated, /root\.leveyJenningsYAxisLabels\s*=\s*createLeveyJenningsYAxisLabels/,
  'artifact phải công bố TypeScript nhãn trục Y Levey-Jennings cho wrapper cũ');
assert.doesNotMatch(generated, /root\.leveyJennings(?:HoverModel|PointStyle|DisplayPlan)\s*=/,
  'artifact không được công bố helper Levey-Jennings chỉ dùng nội bộ renderer');
assert.match(generated, /root\.leveyJenningsPointRenderModel\s*=\s*createLeveyJenningsPointRenderModel/,
  'artifact phải công bố TypeScript model render điểm Levey-Jennings cho wrapper cũ');
assert.match(generated, /root\.leveyJenningsBandRects\s*=\s*leveyJenningsBandRects/,
  'artifact phải công bố TypeScript dải chuẩn Levey-Jennings cho wrapper cũ');
assert.match(generated, /root\.leveyJenningsGridLines\s*=\s*leveyJenningsGridLines/,
  'artifact phải công bố TypeScript lưới Levey-Jennings cho wrapper cũ');
assert.match(generated, /root\.leveyJenningsMultiSeries\s*=\s*leveyJenningsMultiSeries/,
  'artifact phải công bố TypeScript dữ liệu biểu đồ Levey-Jennings đa mức cho wrapper cũ');
assert.match(generated, /root\.leveyJenningsMultiRunTicks\s*=\s*createLeveyJenningsMultiRunTicks/,
  'artifact phải công bố TypeScript tick run biểu đồ Levey-Jennings đa mức cho wrapper cũ');
assert.match(generated, /root\.leveyJenningsLegendLayout\s*=\s*\(levels,\s*colors,\s*startX,\s*measure\)/,
  'artifact phải công bố TypeScript layout chú giải Levey-Jennings cho wrapper cũ');
assert.doesNotMatch(generated, /root\.leveyJenningsMulti(?:DisplayPlan|HoverModel)\s*=/,
  'artifact không được công bố helper đa mức chỉ dùng nội bộ renderer');
assert.match(generated, /root\.leveyJenningsMultiPointRenderModel\s*=\s*createLeveyJenningsMultiPointRenderModel/,
  'artifact phải công bố TypeScript model render điểm Levey-Jennings đa mức cho wrapper cũ');
assert.match(generated, /root\.leveyJenningsMultiDividers\s*=\s*leveyJenningsMultiDividers/,
  'artifact phải công bố TypeScript đường phân cách Levey-Jennings đa mức cho wrapper cũ');
assert.match(generated, /root\.cusumChartGeometry\s*=\s*cusumChartGeometry/,
  'artifact phải công bố TypeScript hình học CUSUM cho wrapper cũ');
assert.match(generated, /root\.cusumDisplayPlan\s*=\s*createCusumDisplayPlan/,
  'artifact phải công bố TypeScript downsampling CUSUM cho renderer đã retire');
assert.match(generated, /root\.cusumHoverModel\s*=\s*createCusumHoverModel/,
  'artifact phải công bố TypeScript hover model CUSUM cho renderer đã retire');
assert.doesNotMatch(generated, /root\.(?:entryPointContext|settingsStorageBytesText)\s*=/,
  'artifact không được công bố helper chỉ dùng nội bộ command/presentation');
assert.doesNotMatch(generated, /root\.(?:sameIdSetPresentation|sameNormalizedTextPresentation|teaPositiveNumberPresentation|teaReferenceExternalChangedPresentation)\s*=/,
  'artifact không được công bố formatter Manage/TEa không có caller classic');
assert.doesNotMatch(generated, /root\.(?:syncJsonMap|mergeSyncArray|mergeSyncBranch|uniqueSyncUsers|syncSnapshot|installSyncServices)\s*=/,
  'artifact không được công bố primitive Firebase chỉ dùng nội bộ bundle');
assert.doesNotMatch(generated, /root\.local(?:PartitionHelpers|SnapshotRecord|PartitionValid|RecoverySlots|PartitionTransaction|PartitionRecovery|ClearKeys)\s*=/,
  'artifact không được công bố primitive IndexedDB chỉ dùng nội bộ bundle');
assert.doesNotMatch(generated, /root\.LIS_(?:GATEWAY_STORAGE_KEY|POLL_MS)\s*=/,
  'artifact không được công bố hằng LIS chỉ dùng nội bộ command/service');
assert.doesNotMatch(generated, /root\.lis(?:GatewayFetch|GatewayHealth|ResultToPointInput)\s*=/,
  'artifact không được công bố alias LIS khi LISClientService đã là API duy nhất');
assert.doesNotMatch(generated, /root\.lisGatewaySetStatus\s*=/,
  'artifact không được công bố alias LIS chỉ dùng nội bộ command');
assert.match(generated, /root\.cusumPointRenderModel\s*=\s*cusumPointRenderModel/,
  'artifact phải công bố TypeScript model điểm CUSUM cho wrapper cũ');
assert.match(generated, /root\.cusumReferenceLines\s*=\s*cusumReferenceLines/,
  'artifact phải công bố TypeScript đường tham chiếu CUSUM cho wrapper cũ');
assert.match(generated, /root\.cusumLinePoints\s*=\s*cusumLinePoints/,
  'artifact phải công bố TypeScript tọa độ line CUSUM cho wrapper cũ');
assert.match(generated, /root\.drawLJ\s*=\s*qcChartRenderer\.drawLJ/,
  'artifact phải công bố renderer Levey-Jennings đơn cho wrapper cũ');
assert.match(generated, /root\.ljDataURL\s*=\s*qcChartRenderer\.ljDataURL/,
  'artifact phải công bố xuất ảnh Levey-Jennings đơn cho wrapper cũ');
assert.match(generated, /root\.drawLJMultiZ\s*=\s*qcChartRenderer\.drawLJMultiZ/,
  'artifact phải công bố renderer Levey-Jennings đa mức cho wrapper cũ');
assert.match(generated, /root\.ljMultiDataURL\s*=\s*qcChartRenderer\.ljMultiDataURL/,
  'artifact phải công bố xuất ảnh Levey-Jennings đa mức cho wrapper cũ');
assert.match(generated, /root\.drawCUSUM\s*=\s*qcChartRenderer\.drawCUSUM/,
  'artifact phải công bố renderer CUSUM cho wrapper cũ');
assert.match(drawSource, /deps\.cusumDisplayPlan\(\{ count: n, width: cw, cPos, cNeg, ma, flags \}\)/,
  'renderer CUSUM phải dùng downsampling từ dependency injected');
assert.match(drawSource, /deps\.cusumHoverModel\(\{ point: model\.point, cPos: model\.positive, cNeg: model\.negative, rejected: model\.rejected \}\)/,
  'renderer CUSUM phải dùng hover model từ dependency injected');
assert.match(drawSource, /deps\.cusumPointRenderModel\(\{ indices: drawIndices, points, cPos, cNeg, flags, h, x, clampY, colors: cc \}\)/,
  'renderer CUSUM phải dùng model điểm từ dependency injected');
assert.match(drawSource, /deps\.cusumReferenceLines\(\{ h, y \}\)/,
  'renderer CUSUM phải dùng đường tham chiếu từ dependency injected');
assert.match(drawSource, /deps\.cusumLinePoints\(\{ indices: drawIndices, values: arr, x, clampY \}\)/,
  'renderer CUSUM phải dùng tọa độ line từ dependency injected');
assert.match(drawSource, /deps\.leveyJenningsBandRects\(\{ mean: 0, sd: 1, width: cw, y \}\)/,
  'renderer đa mức phải dùng dải Levey-Jennings từ dependency injected');
assert.match(drawSource, /deps\.leveyJenningsGridLines\(\[3, 2, 1, 0, -1, -2, -3\]/,
  'renderer đa mức phải dùng lưới Levey-Jennings từ dependency injected');
assert.match(generated, /root\.blobDownload\s*=\s*createBlobDownload/,
  'artifact phải công bố TypeScript blob download cho wrapper cũ');
assert.match(generated, /root\.xlsxCells\s*=\s*createXlsxCells/,
  'artifact phải công bố TypeScript XLSX cell writer cho wrapper cũ');
assert.match(generated, /root\.xlsxZip\s*=\s*createXlsxZip/,
  'artifact phải công bố TypeScript XLSX ZIP writer cho wrapper cũ');
assert.match(generated, /root\.xlsxPeriodNumber\s*=\s*xlsxPeriodNumber/,
  'artifact phải công bố TypeScript XLSX period parser cho wrapper cũ');
assert.match(generated, /root\.xlsxDrawing\s*=\s*createXlsxDrawing/,
  'artifact phải công bố TypeScript XLSX DrawingML writer cho wrapper cũ');
assert.match(generated, /root\.sigmaXlsxStyles\s*=\s*sigmaXlsxStyles/,
  'artifact phải công bố TypeScript Sigma XLSX styles cho wrapper cũ');
assert.match(generated, /root\.reportXlsxStyles\s*=\s*reportXlsxStyles/,
  'artifact phải công bố TypeScript Report XLSX styles cho wrapper cũ');
assert.match(generated, /root\.reportXlsxDrawing\s*=\s*createReportXlsxDrawing/,
  'artifact phải công bố TypeScript Report XLSX DrawingML cho wrapper cũ');
assert.match(generated, /root\.reportXlsxSheet\s*=\s*\(doc\)\s*=>\s*\{[\s\S]*createReportXlsxSheet/,
  'artifact phải khởi tạo trễ Report XLSX worksheet sau data-io');
assert.match(generated, /root\.reportXlsxBuild\s*=\s*\(doc\)\s*=>\s*\{[\s\S]*createReportXlsxBuilder/,
  'artifact phải khởi tạo trễ Report XLSX workbook sau data-io');
assert.match(generated, /root\.xlsxEscape\s*=\s*xlsxEscape/,
  'artifact phải công bố TypeScript XLSX XML escape cho wrapper cũ');
assert.match(generated, /root\.reportXlsxStyleIds\s*=\s*REPORT_XLSX_STYLE_IDS/,
  'artifact phải công bố TypeScript Report XLSX style IDs cho wrapper cũ');
assert.match(generated, /root\.xlsxColumns\s*=\s*XLSX_COLUMNS/,
  'artifact phải công bố TypeScript XLSX column labels cho wrapper cũ');
assert.match(generated, /root\.xlsxEmu\s*=\s*xlsxEmu/,
  'artifact phải công bố TypeScript XLSX pixel-to-EMU cho wrapper cũ');
assert.match(generated, /root\.sigmaChartRenderer\s*=\s*createSigmaChartRenderer/,
  'artifact phải công bố TypeScript Sigma chart renderer cho wrapper cũ');
assert.match(generated, /root\.sigmaMdcRenderer\s*=\s*createSigmaMdcRenderer/,
  'artifact phải công bố TypeScript Sigma MDC renderer cho wrapper cũ');
assert.match(generated, /root\.xlsxRound\s*=\s*xlsxRound/,
  'artifact phải công bố TypeScript XLSX rounding cho wrapper cũ');
assert.match(pkg.scripts.dist, /build:pilot/,
  'đóng gói Electron phải build lại artifact TypeScript trước');

console.log('TypeScript module pilot structure tests passed');
assert.match(canvasFontSource, /export function createCanvasFont\(/,
  'canvas font phải tách thành TypeScript factory');
assert.doesNotMatch(chartCanvasFontSource, /\bglobalThis\b|\bdocument\b/,
  'canvas font không được tự đọc global hoặc DOM');
assert.match(generated, /root\.canvasFont\s*=\s*createCanvasFont/,
  'artifact phải công bố TypeScript canvas font cho wrapper cũ');
