/// <reference types="vite/client" />
// Cần cho các import kiểu `?url` (vd file .wasm của sql.js trong
// browser-mock/sqlite-loader.ts) — không có dòng này `tsc` của renderer báo

/** Số phiên bản app, Vite thay tại thời điểm chạy preview/build từ
 * `package.json` (`define` trong `vite.app-renderer.config.mjs`). Một nguồn
 * duy nhất với tên tệp cài do electron-builder sinh ra. */
interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
}


