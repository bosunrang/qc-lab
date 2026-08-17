# Inventory compatibility facade — Wave E

Checkpoint: 2026-08-17.

Mục tiêu của inventory này là phân biệt global còn là ranh giới trình duyệt với
facade classic chỉ còn chuyển tiếp sang bundle TypeScript. Chỉ xóa facade sau khi
có quét caller runtime và test hợp đồng cho lát thay đổi.

| Nhóm | Chủ sở hữu TypeScript | Caller runtime hiện tại | Quyết định |
| --- | --- | --- | --- |
| Tải CSV | `presentation/export/csv-download.ts` | `data-io.js`, `users-auth.js` gọi `globalThis.csvDownload` | Giữ một bridge browser; đã bỏ `csvCell()` và `downloadCSV()` classic ngày 2026-08-17. Encoder nay là dependency nội bộ của service. |
| Định dạng giá trị điểm QC cho NCE | `presentation/report/qc-export-value-format.ts` | `actionReportModel` và XLSX legacy gọi formatter trực tiếp | Đã bỏ `dataIoQcPoint()`, `dataIoQcValue()` và `dataIoQcStat()` ngày 2026-08-17; không giữ wrapper classic chỉ để đổi tên lời gọi. |
| Chuẩn hóa/xác thực snapshot Firebase | `domain/sync/snapshot-compare.ts`, `domain/sync/snapshot-signature.ts`, `application/sync/firebase-audit-gate.ts` | Adapter Firebase gọi trực tiếp bridge cần thiết | Đã bỏ `fbCanon()`, `fbSnapshotSig()`, `fbAuditIntegrity()`, `root.syncCanon` và primitive khởi tạo snapshot/merge (`syncJsonMap`, array/branch merge, user set, snapshot installer) ngày 2026-08-17; adapter chỉ giữ `syncedShape`/`syncedStatesEqual` và các service runtime cần thiết. |
| Đọc cấu hình Firebase | `application/sync/firebase-config-parser.ts` | `firebaseSettingsService` trong bundle TypeScript | Đã bỏ `root.firebaseConfigParser` và `root.firebaseConfigValidator` ngày 2026-08-17; parser là dependency nội bộ, không có caller classic. |
| Điều phối merge Firebase | `application/sync/firebase-merge-application.ts` | `firebaseMergeCommitService` trong bundle TypeScript | Đã bỏ `root.firebaseMergeApplication`, `root.firebaseDisconnectedState`, `root.firebaseCanPull`, `root.firebaseEmptySnapshotPlan` và declaration thừa `installSyncServices` ngày 2026-08-17; lựa chọn merge/pull/lifecycle là dependency nội bộ của các service. |
| Metadata TEa | `application/manage/tea-reference-service.ts` | Không còn caller classic cho hai helper metadata | Đã bỏ `teaRefSourceMeta()` và `teaRefStampSource()` ngày 2026-08-17; lifecycle tạo/sửa TEa vẫn do service TypeScript sở hữu. |
| Formatter Manage/TEa | `presentation/manage/*` | Không còn caller classic | Đã bỏ `sameIdSetPresentation`, `sameNormalizedTextPresentation`, `teaPositiveNumberPresentation` và `teaReferenceExternalChangedPresentation` ngày 2026-08-17. |
| Thống kê so sánh lô hóa chất | `domain/reagent/*`, `application/reagent/reagent-comparison-service.ts` | Reagent renderer gọi `rcPairCalc`/`rcCalc` còn sống | Đã bỏ 11 wrapper thống kê classic và `root.reagentStatistics`/`root.reagentTDistribution` ngày 2026-08-17; không xóa calculator/row adapter đang phục vụ UI và báo cáo. |
| Định dạng/row CSV báo cáo | `domain/export/csv-cell.ts`, `presentation/report/*` | `data-io.js` | Giữ các API report global khi phần XLSX classic còn caller; không thêm fallback. |
| Namespace backup | `application/backup/backup-service.ts` | UI classic gọi các thao tác backup riêng lẻ, không gọi namespace service | Đã bỏ `root.BackupService` ngày 2026-08-17; import, kiểm tra file và tính trạng thái nhắc backup đã chuyển vào command TypeScript, JS chỉ giữ File/DOM/dialog adapter. |
| Hồ sơ NCE | `application/nce/action-record-service.ts` | `NceFormCommand` trong bundle TypeScript | Đã bỏ `root.ActionRecordService` ngày 2026-08-17; command nhận service bằng dependency nội bộ và có test service riêng. |
| Nhập QC và Settings | `presentation/entry/entry-point-context.ts`, `presentation/settings/storage-usage.ts` | `EntryRecordCommand`/Settings presentation trong bundle TypeScript | Đã bỏ `root.entryPointContext` và `root.settingsStorageBytesText` ngày 2026-08-17; dùng trực tiếp dependency TypeScript. |
| Hồ sơ đơn vị | `application/settings/lab-profile-service.ts` | `SettingsProfileCommand` trong bundle TypeScript | Đã bỏ `root.labProfileService` ngày 2026-08-17; command nhận service nội bộ. |
| Cấu hình LIS | `application/lis/lis-client-service.ts` | `LisGatewayCommand` và LIS service trong bundle TypeScript | Đã bỏ `root.LIS_GATEWAY_STORAGE_KEY`, `root.LIS_POLL_MS` cùng alias fetch/health/result-to-input/set-status ngày 2026-08-17; không có caller classic, giữ `LISClientService` làm API service. |
| Blob/download UI | `presentation/export/blob-download.ts` | Các handler browser | Browser boundary, giữ bridge để thao tác DOM/URL ở bundle. |
| Tooltip biểu đồ | `presentation/chart/chart-tooltip-service.ts` | `draw.js`/Sigma dùng `qcTooltip()` tại ranh giới DOM | Đã bỏ `root.chartTooltipService` ngày 2026-08-17; chỉ giữ `qcTooltip()` để classic canvas/SVG lấy phần tử DOM dùng chung. |
| Mô hình con Dashboard | `presentation/dashboard/*` | `dashboardTestItems`/`dashboardTestRowsHtml` là bridge cho route classic | Đã bỏ các helper dashboard dùng nội bộ (mô hình level/latest, action/pill, status/rank/completion và renderer row/list) ngày 2026-08-17; chỉ giữ hai bridge route-level còn sống. |
| Canvas/XLSX | `presentation/sigma/*`, `presentation/export/*` | `data-io.js` và renderer classic | Đã đưa hover/display/style Levey-Jennings và display/hover CUSUM nội bộ bundle ngày 2026-08-17; giữ API canvas/renderer mà `draw.js` còn gọi. |
| Firebase, storage, QC domain | service TypeScript tương ứng | Adapter SDK/event classic | Browser/SDK boundary; kiểm kê riêng trước khi giảm API. |
| Primitive IndexedDB phân vùng | `application/storage/local-partition-*` | Service storage trong bundle TypeScript | Đã bỏ facade key/slot/record/transaction/recovery, open/record/clear và policy chọn ghi full/từng test nội bộ ngày 2026-08-17; chỉ giữ `LocalStore` và service snapshot có caller adapter. |
| Nhận state từ storage | `application/storage/state-adoption-service.ts` | Storage lifecycle trong bundle TypeScript | Đã bỏ `root.stateAdoptionService` ngày 2026-08-17; lifecycle nhận dependency nội bộ. |
| Lifecycle storage | `application/storage/*` | Không còn caller classic cho boot/recovery/hydrate hay writer | Đã bỏ bridge boot IndexedDB, recovery, hydrate và writer local/phân vùng ngày 2026-08-17; `storageLifecycleService`/`storageSnapshotService` nhận dependency trực tiếp. |

Quét 2026-08-17 xác nhận `csvCellService`, `csvCell()` và `downloadCSV()` không
còn caller runtime hay test cần giữ. `tests/typescript-module-pilot.test.js` khóa
hợp đồng direct-call và cấm tái lập ba facade này.
