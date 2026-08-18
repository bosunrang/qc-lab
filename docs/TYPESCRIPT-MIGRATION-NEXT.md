# Bàn giao chuyển đổi TypeScript

## Checkpoint hiện tại — 2026-08-19

- Tiến độ ước tính: **83% tổng thể** (kiểm chứng độc lập trước đó: 80–88%).
- Xác minh gần nhất: `npm.cmd run build:pilot`, `npm.cmd run typecheck` và
  `npm.cmd test` đều đạt; test suite **611/611 pass**.
- Wave F validation đã đạt: `ui-check` 28/28, `nce-check` 91/91,
  `visual-check`, `a11y-audit` (0 vi phạm), `print-check` và
  `verify-release` (dependency audit + performance regression) đều pass.
- `assets/generated/modular-pilot.js`: bundle sinh từ Vite, không sửa trực tiếp.
- Bundle runtime hiện dùng tag
  `ts-phase1-quickwins-20260819-1`; phải tăng tag tương ứng nếu sửa
  artifact runtime.
- **Ghi chú tài liệu (2026-08-18):** `reagent.js` (Passing-Bablok/Deming/
  Bland-Altman) đã có đủ `src/domain/reagent/`, `reagent-comparison-service.ts`
  và `src/presentation/reagent/` (26 file) từ trước, chỉ là lịch sử "Đã hoàn
  thành" bên dưới chưa từng ghi lại — không phải phần code còn thiếu.

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
9. **Wave F — xác thực:** `LoginCommand` sở hữu quyết định khóa tạm, xác thực
   và nâng cấp hash; `RequiredPasswordCommand` kiểm tra/xác nhận mật khẩu bắt
   buộc đổi trước khi cập nhật tài khoản. `users-auth.js` chỉ giữ form, audit,
   lưu trạng thái và điều hướng giao diện.
10. **Wave F — audit:** `ActivityArchiveCommand` điều phối cắt prefix, đặt neo
    hash, xác thực lại, xuất CSV và lưu trạng thái; adapter classic chỉ mở modal
    và chuyển giá trị tháng từ form.
11. **Wave F — bootstrap:** `AdminBootstrapCommand` đảm bảo tạo duy nhất tài
    khoản admin mặc định khi state chưa có người dùng; wrapper classic không còn
    trực tiếp gán `state.users`.
12. **Wave F — vòng đời người dùng:** `UserLifecycleCommand` sở hữu thêm, phân
    quyền, đặt lại mật khẩu, khóa/mở khóa và xóa tài khoản, bao gồm audit và save.
    `UserManagementCommand` trở thành dependency nội bộ bundle, không còn ambient
    global; `users-auth.js` chỉ giữ form, dialog và điều hướng.
13. **Wave F — khóa kỳ:** `ReportPeriodWorkflowCommand` điều phối lock/unlock,
    audit, save và render. `ReportPeriodCommand` được thu về dependency nội bộ;
    `report-routes.js` chỉ xử lý confirm, re-auth, modal và phản hồi hiển thị.
14. **Wave F — lifecycle NCE:** `NceLifecycleWorkflowCommand` sở hữu mutation,
    audit, save và render cho hủy/duyệt/trả lại/mở lại/escalate. Command lifecycle
    thấp hơn trở thành dependency nội bộ; `actions-routes.js` giữ cổng UI và modal.
15. **Wave F — form NCE:** `NceFormWorkflowCommand` sở hữu tạo/cập nhật, audit,
    reset form, save và render. `NceFormCommand` được thu về dependency nội bộ;
    `action-form.js` chỉ đọc snapshot form và hiển thị lỗi/cổng focus.
16. **Wave F — hủy điểm QC:** `EntryVoidWorkflowCommand` sở hữu mutation, audit
    và save; `EntryVoidCommand` được thu về dependency nội bộ. Route giữ modal,
    xác nhận và thông báo kết quả tại bảng nhập QC.
17. **Wave F — ghi điểm QC:** `EntryRecordWorkflowCommand` sở hữu mutation, audit
    và save, còn route giữ verdict/feedback và vị trí cuộn. `EntryRecordCommand`
    được thu về dependency nội bộ bundle.
18. **Wave F — máy xét nghiệm:** `ManageInstrumentWorkflowCommand` sở hữu thêm,
    sửa, xóa máy cùng audit/save/render. Command thấp hơn được thu về dependency
    nội bộ; route Manage chỉ xử lý form và xác nhận xóa.
19. **Wave F — Panel QC:** `ManagePanelWorkflowCommand` sở hữu thêm/sửa/xóa Panel
    cùng audit/save/render. Command thấp hơn được thu về dependency nội bộ; route
    Manage chỉ xử lý form và xác nhận xóa.
20. **Wave F — Lô/Xét nghiệm/Nhóm lô:** `ManageLotWorkflowCommand` (thêm/sửa/xóa
    lô, gồm cả xác nhận đổi số lô hàng loạt), `ManageAssayWorkflowCommand` (thêm/
    sửa xét nghiệm), `ManageLotTransitionWorkflowCommand` (xóa dòng chuyển tiếp)
    và `ManageLotGroupWorkflowCommand` (dừng nhóm lô; kích hoạt nhóm lô với 3
    nhánh trạng thái applied/already-active/unready) sở hữu audit/save/render.
    `ManageLotCommand`, `ManageAssayCommand`, `ManageLotGroupActivationCommand`
    mất hết caller JS trực tiếp nên được thu về dependency nội bộ bundle (theo
    đúng mẫu Instrument/Panel), gỡ khỏi ambient global trong `global.d.ts`.
    `manage-tests-actions.js` (`saveConfigLot`, `deleteConfigLot`,
    `saveConfigAssay`, `deleteLotTransition`, `toggleLotGroupStatus`,
    `activateLotGroup`) chỉ còn đọc DOM và chọn nội dung hộp thoại xác nhận.
21. **Wave F — Nhóm lô + Mean/SD:** `ManageLotGroupWorkflowCommand` gộp thêm
    `save`/`remove` (thêm/xóa nhóm lô, gồm cả đồng bộ `reconcileSigmaLevelsWithLotGroups()`
    vào audit detail). `ManageTargetMatrixWorkflowCommand` (file mới) sở hữu
    audit/save/render cho `commitTargetMatrix()` — dùng lại `target-matrix-command.ts`
    vốn đã có sẵn từ trước nhưng chưa từng được wire vào bundle (import chết,
    không ai gọi `createTargetMatrixCommand`). `ManageLotGroupCommand` mất hết
    caller JS trực tiếp nên cũng được thu về dependency nội bộ như `ManageLotCommand`/
    `ManageAssayCommand`/`ManageLotGroupActivationCommand`. `saveConfigGroup`,
    `deleteConfigGroup`, `commitTargetMatrix` trong `manage-tests-actions.js` chỉ
    còn đọc DOM; tham số `panel` không dùng tới trong `commitTargetMatrix()`
    (bug có từ trước, đọc `manageTargetPanel` toàn cục thay vì tham số) được dọn
    khỏi chữ ký hàm và `targetSwitchCtx` luôn.
22. **Wave F — Auth (đăng nhập/đăng xuất/đổi mật khẩu bắt buộc):** rà soát
    Settings/Users/Report cho thấy Settings và Report đã thin sẵn từ trước
    (toàn bộ qua `SettingsProfileCommand`/`SettingsFirebaseCommand`/
    `ReportPeriodWorkflowCommand`); Users page cũng đã xong qua
    `UserLifecycleCommand`. Chỗ còn sót duy nhất là 3 hàm trong phần AUTH của
    `users-auth.js`: `doLogin()`, `changeRequiredPassword()`, `logout()` — vẫn
    tự gọi `logAct`/`save` sau khi `LoginCommand`/`RequiredPasswordCommand`
    quyết định xong. `LoginWorkflowCommand` (mới, gộp cả `logout()`) và
    `RequiredPasswordWorkflowCommand` (mới) sở hữu audit/save; JS chỉ còn giữ
    trạng thái khóa đăng nhập (`loginFails`/`loginLockUntil`/
    `persistLoginLockout()` — bookkeeping localStorage cục bộ, không phải audit)
    và điều hướng màn hình (`showLogin`/`showPasswordChange`/`showApp`).
    `LoginCommand`/`RequiredPasswordCommand` mất hết caller JS trực tiếp nên
    cũng được thu về dependency nội bộ.
23. **Wave F — Phase 1 "quick wins" (rà soát toàn bộ assets/modules/*.js):**
    khảo sát hệ thống tìm nốt các hàm còn tự `logAct`/`save`/`rerender` quanh
    command/service TypeScript đã có. 4 mục nhỏ, độc lập, đã gộp xong:
    - `range.js`: `confirmApplyNewRange`/`confirmRevertRange` tự ghi
      `meanSdHistory` và đẩy một hồ sơ "action" chờ duyệt vào `state.actions`
      (cùng shape hồ sơ NCE — approvalStatus/rule/errorType) — chưa từng có
      command nào bọc, phải viết mới `range-target-command.ts` (mutation thuần)
      + `range-workflow-command.ts` (audit/save/render). Hàm `assignRangeTarget()`
      (wrapper 1 dòng quanh `qcRangeCandidateService.assignTarget`) hết người
      gọi nên bị xóa; `tests/range-candidate.test.js` gọi thẳng
      `qcRangeCandidateService.assignTarget` thay vì qua wrapper đã xóa.
    - `entry-routes.js`: `entryDateNoteSave()` — mảnh cuối chưa qua workflow
      command của trang Nhập QC (record/void đã xong từ trước) — gộp vào
      `EntryDateNoteWorkflowCommand` (mới).
    - `manage-tests-actions.js`: `delTest()` — mở rộng
      `ManageAssayWorkflowCommand` (đã có `save`) thêm `remove`, bọc
      `ManageAssayRemovalCommand` (mất hết caller, thu về dependency nội bộ).
    - `reagent.js`: `rcDelete()`/`rcCreateFrom()` — CRUD so sánh lô hóa chất
      chưa migrate dù phần thống kê hồi quy (Passing-Bablok/Deming/Bland-Altman)
      đã xong từ trước; gộp vào `ReagentComparisonWorkflowCommand` (mới, bọc
      `ReagentComparisonService.create`/`.remove` — service này còn nhiều
      caller trực tiếp khác nên KHÔNG bị hạ xuống dependency nội bộ).
    2 scanner test bridge cũ (`entry-service.test.js`,
    `reagent-service-bridge.test.js`) pin call-site cũ, đã cập nhật để pin
    đúng workflow command mới thay vì revert code.

## Việc tiếp theo (ưu tiên)

1. **Phase 2 (trung bình, cần đọc kỹ trước khi gộp):**
   - `manage-routes.js`: `teaRefEdit`, `teaRefRemove`, `teaRefAddSubmit`,
     `teaLabProfileSave`, `teaLabProfileRemove` (bảng TEa tham chiếu) — 5 hàm,
     chưa có `TeaReferenceWorkflowCommand` nào, cần thiết kế mới.
   - `manage-tests-actions.js`: `saveLotTransitionV2()` — có bước
     `applyPlannedTarget` xen giữa gate và commit, khó gộp gọn như
     `deleteLotTransition` đã làm.
2. **Phase 3 (lớn, rủi ro, nên hoãn):** `sigma.js` — trang lớn nhất app, ~10
   hàm `sgXxx` (TEa, track/untrack test, bias, MU, cohort import…) đều tự
   orchestrate, không có tầng command nào bọc sẵn; state (cohort, TEa
   snapshot, kỳ bias/MU) đan xen phức tạp — cần chia nhỏ thành nhiều workflow
   command riêng qua vài phiên, không làm gọn trong 1 lần.
3. **Wave F — strictness:** tiếp tục giảm ambient global chỉ còn dùng nội bộ;
   ưu tiên service/command có adapter JS mỏng và caller runtime rõ ràng.
4. **Wave F — release hardening:** sau mỗi lát runtime, chạy cổng phù hợp; trước
   phát hành chạy lại `verify-release` cùng UI/visual/a11y/print/Electron.

## Quy tắc làm việc

- Dùng `apply_patch` cho mọi sửa file.
- Không đụng các thay đổi worktree không liên quan.
- Mỗi lần sửa runtime: tăng cache-busting trong `index.html`.
- Mỗi lần sửa `src/`: chạy build để cập nhật artifact bundle.
- Luôn chốt bằng build, typecheck, test; với UI/print phải bổ sung browser
  checkpoint phù hợp.
