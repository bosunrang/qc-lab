# Kế hoạch chuyển đổi TypeScript

## Mục tiêu

Chuyển dần QC Lab từ JavaScript shared-global sang TypeScript ES module mà không
đổi hành vi IQC, định dạng state/backup/Firebase hoặc khả năng chạy static
HTTP/Electron. `assets/generated/modular-pilot.js` là artifact phát hành; luôn
tạo lại bằng `npm.cmd run build:pilot`, không sửa trực tiếp.

## Thống kê hiện tại — 2026-08-17

- **Tiến độ tổng thể ước tính: 80%.** Đây là tỷ lệ theo lát nghiệp vụ đã có
  implementation TypeScript và runtime adapter gọi trực tiếp, không đếm số dòng.
- **588/588 test** đang đạt; `build:pilot` và `typecheck` đều xanh tại checkpoint
  gần nhất.
- **Wave A, B, C:** đã hoàn thành các phần migration có rủi ro cao.
- **Wave D: hoàn thành phạm vi chức năng.** `qc-domain`, cache/worker Westgard,
  `data-io`, chart projection/renderer và Westgard routes đều đã chạy qua
  service TypeScript; JavaScript chỉ giữ DOM/canvas, routing và compatibility
  boundary. Facade không còn caller runtime đã được Wave E gỡ có kiểm soát;
  global còn lại là browser/SDK/route boundary có caller thực tế, không phải
  logic IQC chưa chuyển.
- Runtime `data-io.js` đã chuyển trực tiếp: format giá trị, CSV/meta, dữ liệu
  báo cáo theo kỳ/TEa/lô/NCE, tóm tắt NCE, dữ liệu và renderer Sigma/MDC,
  canvas, ảnh và tỉ lệ pixel biểu đồ.
- Runtime backup đã chuyển thêm phần điều phối: command TypeScript sở hữu export
  (gồm cảnh báo dung lượng), import, kiểm tra file và trạng thái nhắc backup;
  `backup-ui.js` chỉ còn File/DOM/dialog adapter.

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
| E. Retire facade | Inventory global, gỡ wrapper classic không còn caller, siết kiểu dần | **Hoàn thành 2026-08-17:** global chỉ còn bootstrap/browser/SDK/route boundary có caller runtime |
| F. Strictness & hardening | Thu hẹp ambient global, chuyển orchestration ở adapter classic, validation docs/Electron/print/a11y | Đang thực hiện: gates đã đạt, còn adapter route/classic và ambient bridge cần giảm dần |

## Thứ tự triển khai ngay

1. Duy trì **Wave F**: siết declaration của bridge còn sống, không xóa global
   khi còn caller JavaScript/runtime.
2. Ưu tiên các command TypeScript cho orchestration trong Manage, Settings,
   Users và Report; không đưa DOM/canvas/File/Firebase SDK/Electron vào domain.
3. Trước phát hành, chạy lại cổng release nếu có thay đổi runtime mới.

## Cổng xác minh

Sau mỗi lát:

```powershell
npm.cmd run build:pilot
npm.cmd run typecheck
npm.cmd test
```

Theo phạm vi: `npm.cmd run ui-check`, `npm.cmd run nce-check`,
`npm.cmd run visual-check`, `npm.cmd run a11y-audit`, `npm.cmd run print-check`.
