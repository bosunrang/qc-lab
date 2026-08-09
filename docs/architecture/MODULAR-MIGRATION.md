# Chuyển đổi sang Modular Monolith

QC Lab đang chuyển dần từ shared global scope sang TypeScript + ES Modules.
Không viết lại toàn bộ và không thay đổi định dạng dữ liệu trong giai đoạn này.

## Trạng thái hiện tại

- `src/domain/` là nguồn TypeScript cho nghiệp vụ thuần.
- `src/compat/` là cầu nối tạm thời để UI global hiện tại tiếp tục hoạt động.
- `assets/generated/` là artifact được đóng gói vào Electron; không sửa tay.
- Các module đã chuyển: `ChartViewModel`, `SigmaCohortService`, `WestgardViewModel`,
  `ReagentComparisonService`, `EntryService`, `ManageConfigService`, `PeriodService`,
  `qcPointWarnings`, `LISClientService` và sáu UI state bags.

Luồng hiện tại:

```text
src/domain/charts/chart-view-model.ts ────┐
src/domain/sigma/sigma-cohort-service.ts ─┼→ src/compat/modular-pilot.global.ts
src/domain/westgard/westgard-view-model.ts─┤               ↓ Vite build
src/application/reagent/reagent-comparison-service.ts ─────┤
src/application/entry/entry-service.ts ────────────────────┤
src/application/manage/manage-config-service.ts ───────────┤
src/application/period/period-service.ts ──────────────────┤
src/domain/qc/qc-point-warnings.ts ────────────────────────┤
src/application/lis/lis-client-service.ts ────────────────┤
src/presentation/state/ui-state.ts ────────────────────────┘
                                           assets/generated/modular-pilot.js
                                                         ↓ adapter tạm thời
 Chart + Sigma + WestgardVM + Reagent + Entry + Manage + Period + QC warnings + UI state + LIS → UI cũ
```

`BackupService` nhận kiểm tra cấu trúc, checksum, chuẩn hóa và kiểm tra audit qua dependency injection.
`assets/modules/backup-ui.js` chỉ giữ phần chọn/tải file, xác nhận, xác thực lại và hiển thị trạng thái;
do đó luồng an toàn khi khôi phục dữ liệu vẫn nằm ở presentation layer nhưng không còn lẫn với nghiệp vụ
đọc gói backup.

## Lệnh làm việc

```powershell
npm.cmd run build:pilot
npm.cmd run typecheck
npm.cmd test
npm.cmd run dev
```

`npm run dist` và `npm run dist:publish` tự build lại module thí điểm trước khi
đóng gói. Mỗi lần sửa file trong `src/`, phải chạy `build:pilot` và commit artifact
tương ứng trong `assets/generated/` để bản static và Electron cùng chạy được.

## Quy tắc cho các bước tiếp theo

1. Chỉ chuyển module thuần hoặc service có ranh giới rõ ở mỗi đợt.
2. Không để code trong `src/domain/` đọc DOM, Firebase hoặc biến `state` toàn cục.
3. Truyền phụ thuộc qua tham số; lớp compatibility mới được phép nối vào global cũ.
4. Giữ nguyên hành vi và chạy test trước/sau mỗi module.
5. Xóa adapter global của một API chỉ sau khi toàn bộ caller đã chuyển sang import.

`SigmaCohortService` là mẫu cho dependency injection: domain nhận `stats` qua
factory `createSigmaCohortService()`. Chỉ adapter compatibility được phép nối
factory đó với `QCCore.stats` của runtime cũ.

`ReagentComparisonService` nằm trong `src/application/` vì nó thay đổi state do
caller truyền vào. Service nhận `cleanText`/`cleanId` qua factory, không truy cập
DOM, persistence hay `QCCore` trực tiếp.

`EntryService` cũng nằm trong `src/application/`. Quy tắc khóa kỳ báo cáo và
chọn số chữ số thập phân được tiêm qua adapter; service không truy cập
`PeriodService`, `qc-domain`, DOM hay biến global trực tiếp.

`ManageConfigService` nhận `cleanText`/`cleanId` qua factory và chỉ thay đổi state
được caller truyền vào. Xác nhận, audit, persistence và khóa kỳ vẫn thuộc lớp UI
hoặc service chuyên trách, không bị kéo vào module cấu hình.

`PeriodService` nhận `cleanText` qua factory. Adapter khởi tạo service này trước
`EntryService`, nhờ đó quan hệ kiểm tra kỳ khóa được khai báo rõ mà cả hai module
không cần đọc shared global scope.

`qcPointWarnings` nhận danh sách điểm QC hiện có cùng các hàm thống kê/định dạng
qua tham số. Adapter giữ chữ ký caller cũ và là nơi duy nhất đọc `state.data`.
Module này không chứa hoặc sao chép danh mục/ngữ nghĩa luật Westgard từ `core.js`.

Sáu state bag của Analysis/Auth/Entry/Manage/Reagent/Sigma dùng chung
`installUiState()`. Factory chỉ tạo state và accessor; việc đọc khóa đăng nhập từ
`localStorage` nằm trong adapter. Các alias global cũ được giữ trong giai đoạn chuyển tiếp.

`LISClientService` nhận HTTP, timeout, storage, polling, nhập điểm, audit và lưu dữ liệu
qua dependency injection. `assets/modules/lis-queue-ui.js` chỉ còn giao diện cấu hình và
hàng chờ; nó gọi API tương thích do adapter công bố.
