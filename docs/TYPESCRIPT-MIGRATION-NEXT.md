# Bàn giao chuyển đổi TypeScript

Mốc đã commit: `e8afe1e refactor: migrate UI slices to TypeScript`.

## Trạng thái hiện tại

## Baseline 2026-08-15

- Worktree được xác minh với `npm.cmd run build:pilot`, `npm.cmd run typecheck`
  và `npm.cmd test`: tất cả đều đạt. Vite đóng gói 660 module thành
  `assets/generated/modular-pilot.js` (757.57 kB; gzip 184.86 kB).
- Baseline này bao gồm renderer khung biểu mẫu NCE tại
  `src/presentation/nce/action-form-panel-html.ts`; compatibility bridge vẫn
  giữ handler DOM và persistence để không đổi hành vi biểu mẫu đang nhập.
- Đợt NCE tiếp theo đã chuyển layout của bước 1 (kiểm soát tức thời) và bước 2
  (đánh giá nguy cơ/RPN) vào `src/presentation/nce/action-form-steps-html.ts`.
  Các select, date box, suggestion chip và sự kiện DOM tiếp tục được cấp qua
  bridge; source-scan kiểm tra cả renderer TypeScript lẫn đường bridge. Điểm
  tiếp theo là checklist điều tra, rồi cụm nguyên nhân/khắc phục–cho phép lại.
- Layout lưới của bước 3 (checklist điều tra) cũng đã chuyển vào cùng renderer;
  năm thẻ điều tra tái sử dụng `actionInvestigationFieldHtml()` TypeScript có
  sẵn. Mốc tiếp theo là cụm bước 4–6, sau đó bước 7–8.
- Các renderer bước 4–6 và 7–8 hiện cũng nằm trong `action-form-steps-html.ts`.
  Checkpoint tiếp theo cần bỏ markup template legacy đã bị renderer TypeScript
  thay thế, nhưng chỉ sau khi browser workflow xác minh trọn vẹn form NCE.
- Browser checkpoint đã đạt bằng `npm.cmd run nce-check`: 91/91 kiểm tra đạt,
  không có lỗi console/page. Có thể bắt đầu dọn template legacy theo từng
  section, giữ nguyên các contract test và chạy lại workflow này sau mỗi đợt.
- Checkpoint dọn bridge 2026-08-15: Settings đã bỏ các forwarding wrapper cho
  storage/Firebase; Manage đã bỏ các forwarding wrapper thuần cho equality,
  trạng thái chuyển lô và các presentation của Target/TEa. Các wrapper Manage
  còn lại nhận state hoặc hàm phụ thuộc và nên được thay bằng một use-case
  TypeScript hoàn chỉnh, không xóa cơ học từng hàm.
- Node có cảnh báo `MODULE_TYPELESS_PACKAGE_JSON` khi một số test nạp trực tiếp
  tệp TypeScript ESM. Đây là cảnh báo hiệu năng của runner, không phải lỗi
  typecheck hay test; không đặt `"type": "module"` cho toàn bộ package vì runtime
  Electron và các script CommonJS hiện còn phụ thuộc cấu hình hiện tại.

- Build, typecheck và toàn bộ 561 kiểm thử đã pass tại mốc commit.
- Các renderer/UI của Manage, Sigma, Reports, Users/Audit và nhiều phần NCE đã được tách sang `src/` rồi bridge qua `src/compat/modular-pilot.global.ts`.
- Khối NCE đã có nền state TypeScript:
  - `src/application/nce/action-form-ui-state.ts`: hồ sơ đang sửa, seed, bản nháp và các bước mở/đóng.
  - `src/application/nce/action-form-render-state.ts`: dựng render-state của form.
- `assets/modules/action-form.js` và `assets/modules/actions-routes.js` đã dùng `globalThis.actionFormUiState`, không còn dùng trực tiếp các biến UI NCE cũ.

## Việc cần làm tiếp

### Đã hoàn thành trong worktree này

- **Wave 1 — NCE:** toàn bộ renderer form 8 bước đã vào `src/presentation/nce/`.
  `NceFormCommand` điều phối tạo/cập nhật, còn `NceLifecycleCommand` điều phối
  hủy/duyệt/trả lại/mở lại/escalate. Route JavaScript chỉ giữ DOM, re-auth,
  modal, audit và render. `nce-check` đạt 91/91.
- **Wave 2 — Nhập QC:** `EntryRecordCommand` nắm transaction ghi điểm QC
  (readiness, point, lot song song, verdict, save-effect); `EntryVoidCommand`
  nắm hủy điểm, liên kết NCE và cache. `ui-check` vẫn đạt 28/28.
- **Wave 3 — Cấu hình cốt lõi:** đã có command cho assay (lưu/xóa), instrument,
  Panel QC và nhóm lô (lưu/xóa/dừng). `ManageConfigService` tiếp tục là nơi
  giữ validation và mutation cấp thấp; các command trả effect audit/save để
  adapter JS không tự quyết nghiệp vụ.

### Còn lại theo thứ tự ưu tiên

1. Hoàn tất **Wave 3** bằng transaction kích hoạt nhóm lô và luồng lô/chuyển
   lô; đây là các thao tác áp Mean/SD hàng loạt và phải giữ guard kỳ khóa.
2. Chuyển Báo cáo/khóa kỳ/re-auth sang command facade theo feature.
3. Chuyển Backup, Firebase/LIS sync và bootstrap/storage cuối cùng vì chúng
   ảnh hưởng toàn app.
4. Khi mỗi wave ổn định, thay adapter global bằng facade theo feature; không
   đổi hàng loạt `.js` sang `.ts` khi route còn phụ thuộc global runtime.

### Cổng xác minh

- Mọi wave: `npm.cmd run build:pilot`, `npm.cmd run typecheck`, `npm.cmd test`.
- NCE: thêm `npm.cmd run nce-check`.
- Luồng ghi dữ liệu/cấu hình: thêm `npm.cmd run ui-check`.

## Quy trình sau mỗi thay đổi

```powershell
npm.cmd run build:pilot
npm.cmd run typecheck
npm.cmd test
```

Khi sửa runtime asset hoặc bundle, tăng cache-busting `?v=` tương ứng trong `index.html`.
