# AGENTS.md

This file provides guidance to Codex when working in this repository.

# QC Lab app

Only `app/` is product source. It is an Electron desktop app with a React
renderer and SQLite in the main process. The renderer uses `HashRouter`; IPC
types live exclusively in `app/shared/qc-api.d.ts`.

## Commands

```powershell
npm run dev
npm start
npm test
npm run typecheck
npm run build
npm run dist
```

`npm run dev` serves the browser preview on port 5174. `npm start` builds and
opens Electron. The preview uses sql.js/WASM only in the browser; packaged
Electron uses `node:sqlite` and excludes the WASM asset.

## Development rules

- Viết chú thích giải thích mã bằng tiếng Việt có đầy đủ dấu. Giữ nguyên tên định danh,
  trường giao thức, SQL và các chuỗi máy đọc; chỉ dùng tiếng Anh khi đó là thuật ngữ kỹ thuật bắt buộc.
- Đọc phần liên quan trong `docs/APP-PLAN.md` trước khi sửa ứng dụng.
- Dòng IPC đọc từ SQLite giữ `snake_case`; dữ liệu nháp biểu mẫu dùng `camelCase`.
- Mỗi handler ghi dữ liệu phải lần lượt kiểm tra quyền, kiểm tra dữ liệu thuần,
  transaction, `writeAudit()` và `notifyChanged()`.
- Không xoá cứng điểm QC; dùng quy trình huỷ điểm hiện có.
- Chạy `npm test`, `npm run typecheck` và `npm run build` khi sửa mã nguồn.
- `docs/WESTGARD-REVIEW-*.md` và `docs/SIGMA-REVIEW-*.md` lưu các đợt rà soát
  nghiệp vụ cùng quyết định đã chốt. Đọc tài liệu phù hợp trước khi sửa logic
  Westgard hoặc Six Sigma. Các tệp `*-probes-*.cjs` ghi lại trạng thái trước khi
  sửa nên được phép thất bại; hồi quy chính thức nằm trong `app/tests/` và chạy
  qua `npm test`.
