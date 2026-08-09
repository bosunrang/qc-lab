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
const westgardSource = read('src/domain/westgard/westgard-view-model.ts');
const adapter = read('src/compat/modular-pilot.global.ts');
const generated = read('assets/generated/modular-pilot.js');

assert.match(index, /assets\/generated\/modular-pilot\.js\?v=ts-nce-point-workflow-/,
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
assert.match(generated, /root\.NceActionLabels\s*=\s*nceActionLabels/,
  'artifact phai cong bo danh muc NCE bat bien cho workflow cu');
assert.match(generated, /root\.ChartViewModel\s*=\s*chartViewModel/,
  'artifact phải công bố đúng API mà UI cũ đang dùng');
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
