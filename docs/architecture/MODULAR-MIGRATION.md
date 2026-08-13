# Chuyển đổi sang Modular Monolith

QC Lab đang chuyển dần từ shared global scope sang TypeScript + ES Modules.
Không viết lại toàn bộ và không thay đổi định dạng dữ liệu trong giai đoạn này.

## Trạng thái hiện tại

- **Mốc chốt 2026-08-13.** Vùng `src/` có 517 tệp TypeScript: 98 tệp domain,
  83 tệp application, 335 tệp presentation và một compatibility bridge. Vite
  đóng gói 518 module thành `assets/generated/modular-pilot.js`. Artifact này
  được nạp như classic script nên static HTTP,
  Electron và cách mở `index.html` qua `file://` vẫn tương thích.
- Đã xác minh tại mốc này: `npm.cmd run build:pilot`, `npm.cmd run typecheck`
  và `npm.cmd test` đều đạt; bộ test chạy 364/364. Artifact được tạo lại trong
  cùng đợt nên đang khớp với nguồn TypeScript (639.16 kB; gzip 157.37 kB).
- **Checkpoint UI 2026-08-13 (buổi hiện tại).** Westgard hiện gọi trực tiếp các
  renderer/view-model TypeScript cho multi-view, CUSUM, bộ lọc/chọn xét nghiệm,
  bảng luật và lô lưu trữ; phần HTML classic tương ứng đã được gỡ. Settings gọi
  trực tiếp service TypeScript cho dung lượng, hồ sơ đơn vị/thương hiệu/logo và
  các helper Firebase. Entry đã chuyển các state tương tác chính (cây, chọn mức,
  bảng nhập, khoảng ngày, cấu hình cột, hủy điểm QC và feedback sau lưu) sang
  bridge TypeScript trực tiếp. Các source-scan accessibility/sandbox test đã
  được cập nhật để kiểm tra implementation mới, không nới lỏng hợp đồng.

### Việc tiếp theo (buổi sau)

1. Hoàn tất các fallback presentation nhỏ còn lại trong `assets/modules/entry-routes.js`,
   rồi giữ nguyên một lần chạy `build:pilot` + typecheck + toàn bộ test.
2. Chọn **một** ranh giới UI độc lập tiếp theo (ưu tiên Settings hoặc Manage),
   chuyển renderer/state helper đã có sang bridge trực tiếp và xóa mã classic chỉ
   khi không còn caller dùng nó.
3. Với mỗi renderer chuyển chỗ, cập nhật source-scan/a11y test để nó đọc module
   TypeScript sở hữu hành vi; không giảm assertion chỉ để test xanh.
4. Chỉ bắt đầu giảm số API trong `src/compat/modular-pilot.global.ts` sau khi
   kiểm kê toàn bộ caller; hiện bridge vẫn là hợp đồng tương thích bắt buộc.
- Đợt đang thực hiện đã chuyển điều phối canvas sau render sang
  `src/presentation/render/visible-canvas-service.ts`: việc coalescing khung vẽ,
  quan sát visibility/resize và hủy observer nhận qua dependency injection;
  `after-render.js` chỉ giữ các API global tương thích. Tooltip Levey–Jennings
  cũng nằm tại `src/presentation/chart/chart-tooltip-service.ts`; `draw.js`
  gọi bridge cho tooltip và đọc CSS token, không tự truy cập DOM cho hai helper này.
  Controller hover/điểm gần nhất/giới hạn viewport được tách tiếp sang
  `src/presentation/chart/levey-jennings-tooltip-controller.ts`; chuẩn hóa
  kích thước/backing-pixel HiDPI nằm tại `src/presentation/chart/hi-dpi-canvas.ts`,
  còn pad, trục và tọa độ điểm nằm tại
  `src/presentation/chart/levey-jennings-geometry.ts`. Lựa chọn phạm vi luật
  Westgard within/across của renderer nằm tại
  `src/presentation/chart/westgard-rule-scope.ts`; adapter đọc API legacy lúc gọi
  để vẫn tương thích với các caller gắn global muộn. Palette chung của biểu đồ
  đơn/đa mức là `src/presentation/chart/levey-jennings-colors.ts`; chọn và định
  dạng tick trục thời gian là `src/presentation/chart/levey-jennings-ticks.ts`;
  các nhãn ±SD trên trục Y nằm tại `src/presentation/chart/levey-jennings-y-axis.ts`.
  Nội dung tooltip mỗi điểm được chuẩn bị bởi
  `src/presentation/chart/levey-jennings-hover-model.ts`; style màu/bán kính
  điểm nằm tại `src/presentation/chart/levey-jennings-point-style.ts`, còn
  downsampling giữ điểm Westgard nằm tại
  `src/presentation/chart/levey-jennings-display-plan.ts`. Các phần đó được
  ghép thành dữ liệu điểm vẽ bởi
  `src/presentation/chart/levey-jennings-point-render-model.ts`; các dải ±SD
  được dựng bởi `src/presentation/chart/levey-jennings-bands.ts` và lưới SD
  bởi `src/presentation/chart/levey-jennings-grid.ts`; hai helper này đã được
  dùng chung cho renderer biểu đồ đơn lẫn đa mức. Dữ liệu levels hợp lệ, Z-score
  và trục run của biểu đồ đa mức nằm tại
  `src/presentation/chart/levey-jennings-multi-series.ts`; tick theo run nằm tại
  `src/presentation/chart/levey-jennings-multi-run-ticks.ts`, còn layout chú giải
  theo bề rộng chữ tại `src/presentation/chart/levey-jennings-legend-layout.ts`.
  Downsampling cho từng level giữ cả luật nội/liên mức nằm tại
  `src/presentation/chart/levey-jennings-multi-display-plan.ts`, và tooltip
  điểm đa mức tại `src/presentation/chart/levey-jennings-multi-hover-model.ts`.
  Các phần được ghép thành dữ liệu điểm vẽ đa mức bởi
  `src/presentation/chart/levey-jennings-multi-point-render-model.ts`; đường
  phân cách level nằm tại
  `src/presentation/chart/levey-jennings-multi-dividers.ts`. Hình học biểu đồ
  CUSUM nằm tại `src/presentation/chart/cusum-chart-geometry.ts`; kế hoạch
  downsampling ba series, giữ điểm vượt ngưỡng, nằm tại
  `src/presentation/chart/cusum-display-plan.ts`; nội dung hover CUSUM được
  chuẩn bị bởi `src/presentation/chart/cusum-hover-model.ts`; model hai điểm
  CUSUM+/−, bao gồm màu/radius cảnh báo, nằm tại
  `src/presentation/chart/cusum-point-render-model.ts`; các đường ±h/0 và
  nhãn trục Y được chuẩn bị bởi `src/presentation/chart/cusum-reference-lines.ts`;
  chuỗi tọa độ hữu hạn của mỗi đường dữ liệu nằm tại
  `src/presentation/chart/cusum-line-points.ts`. Chuỗi font canvas dùng chung
  cho các renderer được tạo bằng dependency-injected factory tại
  `src/presentation/chart/canvas-font.ts`. Xuất PNG từ canvas cho biểu đồ đơn
  và đa mức dùng chung factory tại `src/presentation/chart/chart-data-url.ts`.
  Các renderer giờ gọi trực tiếp `hiDpiCanvasSetup` của bridge, không còn wrapper
  classic trung gian chỉ chuyển tiếp; các alias classic cho font, tooltip và phạm
  vi Westgard cũng đã được gỡ. `qcTooltip` được công bố từ compatibility bridge
  để Sigma không còn phụ thuộc vào việc `draw.js` được nạp trước.
  Nhánh dashboard đang prewarm Westgard cũng gọi thẳng loading presentation từ
  TypeScript bridge thay vì đi qua wrapper classic; lọc trạng thái dashboard
  cũng gọi trực tiếp service TypeScript để normalize và so khớp. Nhóm và render
  lô sắp hết hạn cũng đã dùng trực tiếp bridge TypeScript. Điểm gần nhất, chuỗi
  tìm kiếm và KPI dashboard cũng đi thẳng qua các helper TypeScript; tag trạng
  thái, hoàn thành QC và mood ca trực cũng vậy. Các mảnh HTML theo dõi, tab/liste
  xét nghiệm và pill mức QC cũng đã chạy trực tiếp qua presentation bridge.
- Migration vẫn đang ở pha song song: bridge công bố các API tương thích cho UI
  global cũ (493 gán API), không phải bằng chứng rằng các caller đã được chuyển
  hết sang import. Không xóa adapter hoặc chuyển thêm một cụm lớn chỉ để tăng số
  tệp TypeScript; đợt tiếp theo cần chọn một ranh giới nghiệp vụ độc lập và giữ
  nguyên các hợp đồng compatibility hiện có.
- `src/domain/` là nguồn TypeScript cho nghiệp vụ thuần; `src/application/` và `src/presentation/` tách lần lượt điều phối use-case và chuẩn bị dữ liệu hiển thị.
- `src/compat/` là cầu nối tạm thời để UI global hiện tại tiếp tục hoạt động.
- `assets/generated/` là artifact được đóng gói vào Electron; không sửa tay.
- Các luồng đã có TypeScript gồm QC/Westgard, lưu trữ–Firebase, xác thực/audit,
  Sigma, NCE, báo cáo/XLSX, backup, LIS và sáu UI state bags. UI global cũ vẫn gọi
  các API tương thích từ bridge; NCE investigation presentation và đánh giá Bias
  của workflow dải QC là các lát mới nhất.

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
src/application/audit/audit-service.ts ────────────────────┤
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

Lõi tính toán so sánh hóa chất hiện cũng đã ở `src/domain/reagent/`: chuẩn hóa cặp
số liệu, thống kê mô tả/hồi quy, phân phối t và calculator nhận dependency qua
factory. `assets/modules/reagent.js` giữ phần cập nhật state, modal và SVG, rồi gọi
bridge tương thích cho các phép tính thuần.

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

`AuditService` nhận state, định danh người dùng/client, clock, hàm băm/kiểm chuỗi và ngưỡng
retention qua dependency injection. `assets/modules/audit.js` chỉ giữ API global tương thích;
ngưỡng cũ vẫn ở bridge để UI và test legacy có thể đọc hoặc điều chỉnh mà không sao chép
logic hash-chain, cache, relink hay xoay vòng.
