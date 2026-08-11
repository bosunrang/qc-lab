'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('index.html');
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
assert.match(index, /assets\/modules\/backup-ui\.js/,
  'Backup UI presentation phai duoc runtime nap');
assert.match(index, /assets\/modules\/lis-queue-ui\.js/,
  'LIS queue UI phải là lớp presentation tách khỏi service đồng bộ');
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
assert.doesNotMatch(westgardSource, /\bstate\b|\bglobalThis\b|\bdocument\b/,
  'Westgard view-model không được đọc state hoặc môi trường toàn cục');
assert.match(reagentSource, /export function createReagentComparisonService\(/,
  'Reagent application service phải xuất factory nhận dependency');
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
assert.match(canvasFontSource, /export function createCanvasFont\(/,
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
assert.match(generated, /root\.syncStateMerge\s*=\s*createSyncStateMerge/,
  'artifact must publish the TypeScript Firebase state merger for the legacy bridge');
assert.match(generated, /root\.syncSnapshot\s*=\s*createSyncSnapshot/,
  'artifact must publish TypeScript snapshot keys for the Firebase bridge');
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
assert.match(generated, /root\.planPartitionWrite\s*=\s*planPartitionWrite/,
  'artifact must publish the TypeScript partition-write policy for the legacy bridge');
assert.match(generated, /root\.saveCommandPolicy\s*=\s*saveCommandPlan/,
  'artifact must publish the TypeScript save command policy for the legacy bridge');
assert.match(generated, /root\.storageBootService\s*=\s*createStorageBootService/,
  'artifact must publish the TypeScript two-phase storage boot service for the legacy bridge');
assert.match(generated, /root\.indexedDbRecoveryService\s*=\s*createIndexedDbRecoveryService/,
  'artifact must publish the TypeScript IndexedDB recovery service for the legacy bridge');
assert.match(generated, /root\.partitionHydrationService\s*=\s*createPartitionHydrationService/,
  'artifact must publish the TypeScript partition hydration service for the legacy bridge');
assert.match(generated, /root\.indexedDbMirrorService\s*=\s*createIndexedDbMirrorService/,
  'artifact must publish the TypeScript IndexedDB mirror service for the legacy bridge');
assert.match(generated, /root\.localStorageLoadService\s*=\s*createLocalStorageLoadService/,
  'artifact must publish the TypeScript localStorage load service for the legacy bridge');
assert.match(generated, /root\.localStorageSnapshotWriter\s*=\s*createLocalStorageSnapshotWriter/,
  'artifact must publish the TypeScript localStorage snapshot writer for the legacy bridge');
assert.match(generated, /root\.partitionedSnapshotWriter\s*=\s*createPartitionedSnapshotWriter/,
  'artifact must publish the TypeScript partitioned snapshot writer for the legacy bridge');
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
assert.match(generated, /root\.indexedDbOpenService\s*=\s*createIndexedDbOpenService/,
  'artifact must publish the TypeScript IndexedDB open lifecycle bridge');
assert.match(generated, /root\.indexedDbRecordService\s*=\s*createIndexedDbRecordService/,
  'artifact must publish the TypeScript IndexedDB record operations bridge');
assert.match(generated, /root\.partitionedIndexedDbWriteService\s*=\s*createPartitionedIndexedDbWriteService/,
  'artifact must publish the TypeScript partitioned IndexedDB write bridge');
assert.match(generated, /root\.partitionedIndexedDbReadService\s*=\s*createPartitionedIndexedDbReadService/,
  'artifact must publish the TypeScript partitioned IndexedDB recovery bridge');
assert.match(generated, /root\.indexedDbClearService\s*=\s*createIndexedDbClearService/,
  'artifact must publish the TypeScript IndexedDB clear bridge');
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
assert.match(generated, /root\.csvCellService\s*=\s*csvCell/,
  'artifact must publish TypeScript CSV cell encoder for the legacy bridge');
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
assert.match(generated, /root\.stateAdoptionService\s*=\s*createStateAdoptionService/,
  'artifact must publish TypeScript state adoption for the legacy bridge');
assert.match(generated, /root\.corruptLocalQuarantine\s*=\s*createCorruptLocalQuarantine/,
  'artifact must publish TypeScript corrupt-local quarantine for the legacy bridge');
assert.match(generated, /root\.syncValueCodec\s*=\s*createSyncValueCodec/,
  'artifact must publish TypeScript sync value codec for the legacy bridge');
assert.match(generated, /root\.firebaseConfigSelection\s*=\s*createFirebaseConfigSelection/,
  'artifact must publish TypeScript Firebase config selection for the legacy bridge');
assert.match(generated, /root\.firebaseConnectionGate\s*=\s*createFirebaseConnectionGate/,
  'artifact must publish TypeScript Firebase connection gate for the legacy bridge');
assert.match(generated, /root\.syncSnapshotSignature\s*=\s*syncSnapshotSignature/,
  'artifact must publish TypeScript sync snapshot signature for the legacy bridge');
assert.match(generated, /root\.ActionReviewService\s*=\s*createActionReviewService/,
  'artifact must publish the NCE review service for legacy workflow callers');
assert.match(generated, /root\.ActionEscalationService\s*=\s*createActionEscalationService/,
  'artifact must publish the NCE escalation service for legacy workflow callers');
assert.match(generated, /root\.ActionRecordService\s*=\s*createActionRecordService/,
  'artifact must publish the NCE record service for legacy form callers');
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
assert.match(generated, /root\.ReagentComparisonService\s*=\s*createReagentComparisonService/,
  'artifact phải công bố Reagent application service cho caller cũ');
assert.match(generated, /root\.EntryService\s*=\s*createEntryService/,
  'artifact phải công bố Entry application service cho caller cũ');
assert.match(generated, /root\.LISClientService\s*=\s*lisClient/,
  'artifact phải công bố LIS application service cho UI cũ');
assert.match(generated, /root\.BackupService\s*=\s*backupService/,
  'artifact phai cong bo Backup application service cho UI cu');
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
assert.match(csvDownloadSource, /export function createCsvDownload\(/,
  'CSV download phải tách thành TypeScript factory nhận dependency');
assert.match(cssTokenPixelSource, /export function cssTokenPixel\(/,
  'CSS token pixel phải tách thành TypeScript helper nhận dependency');
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
