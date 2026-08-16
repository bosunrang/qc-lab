# Bàn giao chuyển đổi TypeScript

## Checkpoint hiện tại — 2026-08-16

- Tiến độ ước tính: **78% tổng thể**; **Wave D đã hoàn thành phạm vi chức năng**.
- Xác minh gần nhất: `npm.cmd run build:pilot`, `npm.cmd run typecheck` và
  `npm.cmd test` đều đạt; test suite **583/583 pass**.
- `assets/generated/modular-pilot.js`: bundle sinh từ Vite, không sửa trực tiếp.
- Cache runtime `data-io.js` hiện dùng tag
  `ts-csv-format-runtime-20260816-17`; phải tăng tag này nếu sửa file.

## Đã hoàn thành

1. **Wave A — state/storage:** lifecycle schema, storage, IndexedDB, hydration,
   cache invalidation và state configuration đã có service/command TypeScript.
2. **Wave B — Firebase:** snapshot/codec, merge, first connect, payload, retry
   và cấu hình sync đã ở TypeScript; JS còn event/SDK adapter.
3. **Wave C — vận hành:** command cho backup restore/export, users/auth,
   settings, LIS và phần lớn Manage đã hoạt động qua TypeScript.
4. **Wave D — IQC:** `qc-domain` đã direct-call các service cho derived cache,
   Westgard/CUSUM, worker adapter, lot/target/entry helpers và report stats.
5. **Wave D — data I/O:** direct-call TypeScript cho format/CSV/meta, report
   range/TEa/multi-view/lot rows/NCE summary, Sigma report rows/metric/period,
   renderer/canvas, MDC point/label, data-URL image bytes và pixel ratio.
6. **Wave D checkpoint:** `ui-check` đạt 28/28; `visual-check`, `a11y-audit`
   (0 vi phạm) và `print-check` đều đạt.

## Việc tiếp theo (ưu tiên)

1. **Wave E — inventory facade:** xác định global/implementation classic nào còn
   caller runtime, tách rõ browser boundary với dead facade.
2. **Wave E — retire từng feature:** xóa implementation JavaScript không còn
   caller sau source-scan, runtime sandbox và test feature tương ứng.
3. **Wave F:** siết type declaration, release hardening và cập nhật validation
   trước phát hành.

## Quy tắc làm việc

- Dùng `apply_patch` cho mọi sửa file.
- Không đụng các thay đổi worktree không liên quan.
- Mỗi lần sửa runtime: tăng cache-busting trong `index.html`.
- Mỗi lần sửa `src/`: chạy build để cập nhật artifact bundle.
- Luôn chốt bằng build, typecheck, test; với UI/print phải bổ sung browser
  checkpoint phù hợp.
