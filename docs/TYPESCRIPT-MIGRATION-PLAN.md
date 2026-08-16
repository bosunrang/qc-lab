# Kế hoạch chuyển đổi TypeScript

## Mục tiêu

Chuyển dần QC Lab từ JavaScript shared-global sang TypeScript ES module mà không
đổi hành vi IQC, định dạng state/backup/Firebase hoặc khả năng chạy static
HTTP/Electron. `assets/generated/modular-pilot.js` là artifact phát hành; luôn
tạo lại bằng `npm.cmd run build:pilot`, không sửa trực tiếp.

## Thống kê hiện tại — 2026-08-16

- **Tiến độ tổng thể ước tính: 78%.** Đây là tỷ lệ theo lát nghiệp vụ đã có
  implementation TypeScript và runtime adapter gọi trực tiếp, không đếm số dòng.
- **583/583 test** đang đạt; `build:pilot` và `typecheck` đều xanh tại checkpoint
  gần nhất.
- **Wave A, B, C:** đã hoàn thành các phần migration có rủi ro cao; chỉ còn dọn
  facade/adapter theo Wave E.
- **Wave D: hoàn thành phạm vi chức năng.** `qc-domain`, cache/worker Westgard,
  `data-io`, chart projection/renderer và Westgard routes đều đã chạy qua
  service TypeScript; JavaScript chỉ giữ DOM/canvas, routing và compatibility
  boundary. Facade không còn caller runtime được để lại cho Wave E gỡ có kiểm
  soát, không phải logic IQC chưa chuyển.
- Runtime `data-io.js` đã chuyển trực tiếp: format giá trị, CSV/meta, dữ liệu
  báo cáo theo kỳ/TEa/lô/NCE, tóm tắt NCE, dữ liệu và renderer Sigma/MDC,
  canvas, ảnh và tỉ lệ pixel biểu đồ.

## Nguyên tắc thực hiện

1. Chuyển theo lát nghiệp vụ hoàn chỉnh: domain → application/presentation →
   compatibility bridge → adapter JS → test.
2. Không tạo thêm fallback nghiệp vụ trong JavaScript. Adapter chỉ được giữ DOM,
   browser/Electron SDK, event hoặc global contract chưa thể retire.
3. Module TypeScript thuần không đọc `state`, DOM, Firebase hay storage global;
   dependency được truyền qua factory.
4. Mỗi thay đổi runtime phải tăng `?v=` tương ứng trong `index.html`.
5. Không sửa trực tiếp bundle; thay đổi `src/` phải build lại bundle và commit
   artifact sinh ra.

## Roadmap mới

| Wave | Phạm vi còn lại | Điều kiện hoàn thành |
| --- | --- | --- |
| D. Nền tảng IQC | `qc-domain`, worker, `data-io`, chart projection/renderer, Westgard routes | **Hoàn thành 2026-08-16:** test + UI/visual/a11y/print checkpoint đạt |
| E. Retire facade | Inventory global, gỡ wrapper classic không còn caller, siết kiểu dần | Global chỉ còn bootstrap/browser boundary có chủ đích |
| F. Release hardening | strictness phù hợp, validation docs, Electron/print/a11y | Toàn bộ cổng chất lượng và tài liệu release đạt |

## Thứ tự triển khai ngay

1. Bắt đầu **Wave E** bằng inventory global/facade theo caller runtime.
2. Gỡ từng implementation JavaScript đã không còn caller, có source-scan và
   test runtime cho mỗi nhóm feature.
3. Sau khi inventory ổn định, siết type declaration và giảm dần global ambient.

## Cổng xác minh

Sau mỗi lát:

```powershell
npm.cmd run build:pilot
npm.cmd run typecheck
npm.cmd test
```

Theo phạm vi: `npm.cmd run ui-check`, `npm.cmd run nce-check`,
`npm.cmd run visual-check`, `npm.cmd run a11y-audit`, `npm.cmd run print-check`.
