/// <reference types="vite/client" />
// Cần cho các import kiểu `?url` (vd file .wasm của sql.js trong
// browser-mock/sqlite-loader.ts) — không có dòng này `tsc` của renderer báo
// "Cannot find module ... or its corresponding type declarations".
