// SHA-256 cho MAIN PROCESS — dùng `node:crypto` chuẩn.
//
// File này được TÁCH RIÊNG khỏi `audit-chain.ts` (2026-09-09) vì đó là chỗ
// DUY NHẤT trong toàn bộ `main/domain/` phụ thuộc `node:crypto` mà bản xem
// trước qua trình duyệt cũng cần: `writeAudit()` gọi `auditEntryHash()` một
// cách ĐỒNG BỘ, còn WebCrypto của trình duyệt (`crypto.subtle.digest`) là
// async nên không thay thế được tại chỗ.
//
// Bản dùng trong trình duyệt nằm ở `sha256-browser.ts` và được thay vào đúng
// import này bởi plugin `swapNodeOnlyModulesForBrowser` trong
// `vite.app-v2-renderer.config.mjs`. Hai bản BẮT BUỘC cho ra hash giống hệt
// nhau — `app-v2/tests/sha256-parity.test.mjs` chốt điều đó, vì lệch một bit
// là chuỗi audit tạo ở bản xem trước sẽ không verify được ở bản Electron.
import { createHash } from 'node:crypto';

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
