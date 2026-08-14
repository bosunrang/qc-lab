# Bàn giao chuyển đổi TypeScript

Mốc đã commit: `e8afe1e refactor: migrate UI slices to TypeScript`.

## Trạng thái hiện tại

- Build, typecheck và toàn bộ 561 kiểm thử đã pass tại mốc commit.
- Các renderer/UI của Manage, Sigma, Reports, Users/Audit và nhiều phần NCE đã được tách sang `src/` rồi bridge qua `src/compat/modular-pilot.global.ts`.
- Khối NCE đã có nền state TypeScript:
  - `src/application/nce/action-form-ui-state.ts`: hồ sơ đang sửa, seed, bản nháp và các bước mở/đóng.
  - `src/application/nce/action-form-render-state.ts`: dựng render-state của form.
- `assets/modules/action-form.js` và `assets/modules/actions-routes.js` đã dùng `globalThis.actionFormUiState`, không còn dùng trực tiếp các biến UI NCE cũ.

## Việc cần làm tiếp

Mục tiêu kế tiếp là chuyển **nguyên template 8 bước** trong `actionFormHtml()` của `assets/modules/action-form.js` sang TypeScript, không tiếp tục tách các helper rất nhỏ.

Nên làm theo hai mảng:

1. Nhận diện sự cố, kiểm soát tức thời, nguy cơ và điều tra.
2. Khắc phục, chạy lại QC, trả kết quả, ảnh hưởng bệnh nhân và đánh giá hiệu lực.

Giữ các handler DOM/lưu dữ liệu ở bridge tạm thời; renderer TypeScript nhận `renderState` từ `actionFormRenderState`.

## Quy trình sau mỗi thay đổi

```powershell
npm.cmd run build:pilot
npm.cmd run typecheck
npm.cmd test
```

Khi sửa runtime asset hoặc bundle, tăng cache-busting `?v=` tương ứng trong `index.html`.
