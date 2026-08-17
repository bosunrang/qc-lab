# Bàn giao chuyển đổi TypeScript

## Checkpoint hiện tại — 2026-08-17

- Tiến độ ước tính: **80% tổng thể**; Wave E đã hoàn thành phạm vi retire facade,
  sau đó tiếp tục dọn các dependency nội bộ phát hiện ở strict scan.
- Xác minh gần nhất: `npm.cmd run build:pilot`, `npm.cmd run typecheck` và
  `npm.cmd test` đều đạt; test suite **588/588 pass**.
- Wave F validation đã đạt: `ui-check` 28/28, `nce-check` 91/91,
  `visual-check`, `a11y-audit` (0 vi phạm), `print-check` và
  `verify-release` (dependency audit + performance regression) đều pass.
- `assets/generated/modular-pilot.js`: bundle sinh từ Vite, không sửa trực tiếp.
- Bundle runtime hiện dùng tag
  `ts-backup-export-command-20260817-1`; phải tăng tag tương ứng nếu sửa
  artifact runtime.

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
7. **Wave E — facade:** inventory caller runtime đã hoàn thành. Đã retire CSV,
   Firebase snapshot/config/merge, metadata TEa, namespace BackupService,
   tooltip/reagent/dashboard helper nội bộ; các global còn lại đều là browser,
   SDK hoặc route bridge có caller JavaScript thực tế.
8. **Wave F — backup orchestration:** import, kiểm tra file, trạng thái nhắc và
   export backup đã chuyển vào `BackupImportCommand`,
   `BackupInspectionCommand`, `BackupStatusCommand` và `BackupExportCommand`.
   `backup-ui.js` chỉ còn adapter File/DOM/dialog.

## Việc tiếp theo (ưu tiên)

1. **Wave F — strictness:** tiếp tục giảm ambient global chỉ còn dùng nội bộ;
   ưu tiên service/command có adapter JS mỏng và caller runtime rõ ràng.
2. **Wave F — adapter migration:** đưa orchestration còn nằm trong route classic
   (Manage, Settings, Users, Report) vào command TypeScript; giữ DOM, canvas,
   File, Firebase SDK và Electron ở JavaScript.
3. **Wave F — release hardening:** sau mỗi lát runtime, chạy cổng phù hợp; trước
   phát hành chạy lại `verify-release` cùng UI/visual/a11y/print/Electron.

## Quy tắc làm việc

- Dùng `apply_patch` cho mọi sửa file.
- Không đụng các thay đổi worktree không liên quan.
- Mỗi lần sửa runtime: tăng cache-busting trong `index.html`.
- Mỗi lần sửa `src/`: chạy build để cập nhật artifact bundle.
- Luôn chốt bằng build, typecheck, test; với UI/print phải bổ sung browser
  checkpoint phù hợp.
