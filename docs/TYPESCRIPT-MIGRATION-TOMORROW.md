# Kế hoạch TypeScript — ngày mai

## Mục tiêu

Bắt đầu Wave E: giảm compatibility facade mà không thay đổi hành vi browser,
Electron hoặc global load order.

## Thứ tự thực hiện

1. **Lập inventory facade**
   - Quét `assets/modules/` để phân loại: browser boundary, global contract còn
     caller và dead facade.
   - Ghi rõ caller runtime/test của từng nhóm trước khi xóa mã.

2. **Retire một lát nhỏ trước**
   - Ưu tiên các fallback `data-io` không còn caller runtime (ví dụ các đường
     report/CSV legacy đã có service TypeScript tương ứng).
   - Mỗi lát phải có source-scan và sandbox/runtime test chứng minh caller đã
     đi qua service TypeScript.

3. **Giảm ambient globals**
   - Dọn declaration chỉ phục vụ facade đã retire trong `global.d.ts`.
   - Không siết kiểu DOM toàn cục trong cùng lát; giữ riêng một checkpoint.

4. **Checkpoint cuối ngày**
   - `npm.cmd run build:pilot`
   - `npm.cmd run typecheck`
   - `npm.cmd test`
   - Nếu đụng canvas/report/export: `npm.cmd run ui-check`, `npm.cmd run visual-check`,
     `npm.cmd run a11y-audit`, `npm.cmd run print-check`.

## Tiêu chí hoàn thành ngày mai

- Có inventory facade có thể review.
- Retire ít nhất một nhóm facade không còn caller, không tạo fallback mới.
- Mọi cổng kiểm tra theo phạm vi đều đạt.
