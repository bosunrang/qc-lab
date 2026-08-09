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
const adapter = read('src/compat/modular-pilot.global.ts');
const generated = read('assets/generated/modular-pilot.js');

assert.match(index, /assets\/generated\/modular-pilot\.js\?v=ts-report-period-presentation-/,
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
assert.match(pkg.scripts.dist, /build:pilot/,
  'đóng gói Electron phải build lại artifact TypeScript trước');

console.log('TypeScript module pilot structure tests passed');
