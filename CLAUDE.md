# CLAUDE.md

Tệp này hướng dẫn Claude Code khi làm việc trong repository này.

# QC Lab app

Chỉ `app/` là mã nguồn sản phẩm. Đây là ứng dụng Electron desktop với React ở
renderer và SQLite ở main process. Renderer dùng `HashRouter`; kiểu IPC chỉ
nằm tại `app/shared/qc-api.d.ts`.

## Commands

```powershell
npm run dev
npm start
npm test
npm run test:e2e
npm run validate
npm run typecheck
npm run lint
npm run build
npm run dist
```

`npm run dev` phục vụ bản xem trước trên cổng 5174. `npm run test:e2e` build rồi
chạy app Electron thật bằng Playwright (`app/e2e/`), trên thư mục dữ liệu tạm
và cổng LAN trống, không đụng CSDL của người dùng. `npm start` build và mở
Electron. Bản xem trước dùng sql.js/WASM trong trình duyệt; Electron đóng gói
dùng `node:sqlite` và không kèm tài nguyên WASM. `npm run validate` chạy bộ ca
thẩm định (`app/validation/`, xem `docs/VALIDATION.md`) trên CSDL tạm và ghi
biên bản Excel vào `validation-output/`; bộ ca cũng chạy trong `npm test`.

## Development rules

- Đọc phần liên quan trong `docs/APP-PLAN.md` trước khi sửa ứng dụng.
- Viết chú thích giải thích mã bằng tiếng Việt có đầy đủ dấu. Giữ nguyên tên
  định danh, trường giao thức, SQL và chuỗi máy đọc; chỉ dùng tiếng Anh khi đó
  là thuật ngữ kỹ thuật bắt buộc.
- Dòng IPC đọc từ SQLite giữ `snake_case`; dữ liệu nháp biểu mẫu dùng `camelCase`.
- Mỗi handler ghi dữ liệu phải lần lượt kiểm tra quyền, kiểm tra dữ liệu thuần,
  transaction, `writeAudit()` và `notifyChanged()`.
- Không xoá cứng điểm QC; dùng quy trình huỷ điểm hiện có.
- Chạy `npm test`, `npm run typecheck`, `npm run lint` và `npm run build` khi
  sửa mã nguồn. Gói `typescript` là bí danh của `@typescript/typescript6` chỉ
  để typescript-eslint dùng; trình biên dịch `tsc` là TypeScript 7 từ
  `@typescript/native` (xem `eslint.config.mjs`).
- `docs/WESTGARD-REVIEW-*.md` và `docs/SIGMA-REVIEW-*.md` lưu các đợt rà soát
  nghiệp vụ cùng quyết định đã chốt. Đọc tài liệu phù hợp trước khi sửa logic
  Westgard hoặc Six Sigma. Các tệp `*-probes-*.cjs` ghi lại trạng thái trước khi
  sửa nên được phép thất bại; hồi quy chính thức nằm trong `app/tests/` và chạy
  qua `npm test`.
