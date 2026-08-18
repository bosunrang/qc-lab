# Kiến trúc và lộ trình TypeScript

> **Tài liệu chuẩn duy nhất cho migration TypeScript.** Mọi quyết định, trạng
> thái và kế hoạch tiếp theo của migration phải được cập nhật tại đây. Không tạo
> thêm file `NEXT`, `TOMORROW`, handoff hoặc inventory riêng.

## 1. Mục tiêu kiến trúc

QC Lab sẽ chuyển toàn bộ **mã nguồn ứng dụng** từ JavaScript shared-global sang
TypeScript ES modules. Đây không phải là dự án viết lại UI, đổi schema dữ liệu
hay bỏ khả năng chạy offline/Electron.

Đích cuối cùng:

```text
src/**/*.ts                         nguồn duy nhất của logic và UI
  domain/                            quy tắc IQC, tính toán, model thuần
  application/                       command/use case, audit, save policy
  presentation/                      view-model, HTML, route/controller, DOM/canvas adapter
  infrastructure/ (khi cần)          Firebase, storage, Electron/browser adapter
          │
          ▼
Vite build
          │
          ▼
assets/generated/qc-lab.js           artifact JavaScript phát hành
          │
          ▼
index.html                           một entry script defer
          │
          ├─ static HTTP
          ├─ Electron
          └─ file:// (double-click)
```

Trình duyệt và Electron luôn chạy JavaScript build ra, không chạy TypeScript.
Vì vậy mục tiêu đúng là **không còn source JavaScript legacy và shared global
scope**, không phải không còn file `.js` trong gói phát hành.

## 2. Các hợp đồng không được phá

1. Không đổi nghiệp vụ IQC, schema `state`, backup hoặc merge Firebase chỉ vì
   migration.
2. Bản static HTTP, Electron và `file://` đều tiếp tục chạy được. Không dùng
   native browser ESM/import động vì `file://` bị CORS chặn; source ESM phải được
   Vite bundle thành classic script tương thích.
3. Domain/application không đọc `window`, DOM, `state`, Firebase,
   localStorage/IndexedDB hoặc Electron trực tiếp. Những dependency này được
   truyền vào factory/command ở ranh giới.
4. Mọi mutation QC phải giữ period lock, audit log, cache invalidation và đúng
   `save(opts)`/sync policy.
5. Không đưa React/Vue/Svelte, state library hay microservice vào migration này.
6. Không sửa tay `assets/generated/*.js`; source thay đổi trong `src/`, sau đó
   chạy build và commit artifact sinh ra.

## 3. Trạng thái thực tế — 2026-08-18

| Hạng mục | Trạng thái |
| --- | --- |
| Nguồn TypeScript | 713 tệp: 99 domain, 137 application, 476 presentation, 1 compatibility bridge |
| Nguồn classic còn lại | 30 tệp `assets/modules/*.js`, thêm `assets/core.js` và `assets/app.js` |
| Bundle hiện tại | `assets/generated/modular-pilot.js`, Vite sinh ra và nạp bằng `<script defer>` |
| Kiểm tra kiểu | `npm.cmd run typecheck` đạt: checkJs legacy + strict TypeScript modules |
| Test Node | `npm.cmd test` đạt ngày 2026-08-18 |
| Ước tính tiến độ | khoảng 85% theo lát nghiệp vụ đã có TypeScript sở hữu runtime; không đo bằng số dòng/tệp |

Các phần nghiệp vụ chính đã có TypeScript: Westgard/QC, storage và Firebase,
backup, auth/audit, NCE, Entry, Manage, Sigma, report/XLSX, Reagent, Settings,
LIS và phần lớn presentation HTML/view-model.

Migration vẫn ở pha song song: `src/compat/modular-pilot.global.ts` còn công
bố bridge global để các classic script tiêu thụ bundle. Bridge là cơ chế chuyển
tiếp, không phải kiến trúc đích.

## 4. Phân lớp đích và trách nhiệm

| Lớp | Được phép | Không được phép |
| --- | --- | --- |
| `domain/` | Quy tắc Westgard, thống kê, validation, kiểu dữ liệu, model thuần | DOM, global state, storage, Firebase, Electron |
| `application/` | Command/use case, phối hợp domain, quyết định audit/cache/save qua dependency | Đọc form, `alert`, canvas, truy cập SDK trực tiếp |
| `presentation/` | HTML/view-model, route/controller, DOM/canvas/File adapter có kiểu dữ liệu | Nghiệp vụ bị lặp, mutation state thẳng, tự quyết định persistence |
| `infrastructure/` | Adapter Firebase, IndexedDB/localStorage, Electron/browser API | Luật nghiệp vụ hoặc HTML trang |
| entry/compat tạm thời | Nối dependency, khởi động ứng dụng, export contract cho caller chưa migrate | Logic mới hoặc facade chỉ đổi tên hàm |

`core.js` và worker Westgard là ngoại lệ chuyển tiếp có lý do tương thích Node/
browser/worker. Khi chuyển chúng, phải làm thành một lát độc lập, giữ UMD/worker
contract và test parity; không ghép vào một đợt UI.

## 5. Kế hoạch hoàn thành

### Pha F — kết thúc song song (đang làm)

Mục tiêu: không tạo logic mới trong classic JS, thu hẹp bridge và hoàn tất các
command/route còn tự mutation, audit, save hoặc rerender.

1. Rà từng classic file, bắt đầu từ route có caller và mutation rõ ràng.
2. Tách logic vào `domain`/`application`/`presentation` theo bảng trách nhiệm.
3. JS còn lại chỉ đọc DOM, mở dialog, nhận event hoặc gọi browser/Electron SDK.
4. Gỡ bridge/facade chỉ sau khi `rg` xác nhận không còn caller runtime/test và
   có test contract thay thế.
5. Không đặt KPI theo số global hay số file; ưu tiên mutation có rủi ro audit,
   period lock, storage và Firebase.

Kết thúc pha F khi không còn classic route tự chứa business logic hay tự ghi
state/audit/save, và mọi global còn lại đều được liệt kê là ranh giới runtime.

#### Kiểm kê bridge JS→TS còn lại — audit 2026-08-18

Rà toàn bộ pattern `if(globalThis.X)`, `globalThis.X||…`, `globalThis.X?…:…`
trong 9 file classic có gọi bridge (`qc-domain.js`, `state.js`,
`local-store.js`, `backup-ui.js`, `state-storage.js`, `firebase-sync.js`,
`users-auth.js`, `data-io.js`, `action-form.js`, `actions-routes.js`), đối
chiếu từng điểm với (a) nơi `globalThis.X` được gán trong
`src/compat/modular-pilot.global.ts` — vô điều kiện ở top-level hay có điều
kiện — và (b) test nào còn nạp file đó qua `tests/helpers/sandbox.js` mà
KHÔNG có bridge/stub tương ứng (`loadSandbox()` tự động chèn
`generated/modular-pilot.js` khi danh sách nạp có `modules/state.js`,
hoặc ngay sau `modules/audit.js`/`modules/action-workflow-service.js`, hoặc
sau `modules/state-storage.js` — xem `tests/helpers/sandbox.js`). Tìm được
~82 điểm bridge thật (không tính `if`/`typeof` không liên quan migration),
chia bốn nhóm:

**A. Đã chết hẳn (57 điểm, 6 file) — xóa được ngay, không cần sửa test:**

| File | Symbol/hàm | Số điểm |
| --- | --- | --- |
| `qc-domain.js` | `westgardRuleSettings`, `westgardRulePolicy`, `westgardMemoCache`, `qcCusumMemoCache`, `qcAcceptedMemoCache`, `normalizeSearchText` | ~15 |
| `state.js` | `teaAnalyteMetaService` (trừ `teaAnalyteKey` — xem nhóm C), `qcStaffIdentity`, `qcDateFormat`, `qcBasicFormat` | 18 |
| `local-store.js` | `localStoreService` | 6 |
| `state-storage.js` | `sigmaDraftService`, `corruptLocalQuarantine`, `storageSerializePolicy`, `localSaveScheduler`, `storageRetryDelay`, `saveCommandPolicy`/`saveDerivedTestIds` | 10 |
| `data-io.js` | `cssTokenPixel`, `sigmaCanvasFont`, `blobDownload`, `reportXlsxStyles`, `reportXlsxSheet`, `reportXlsxDrawing`, `reportXlsxBuild` | 7 |
| `action-form.js` | `ActionProtocolService` (dòng 239) | 1 |

Mọi test đang gọi các file này đều đã nạp `generated/modular-pilot.js` (trực
tiếp hoặc qua auto-inject của sandbox), nên nhánh JS cũ không còn được thực
thi ở bất kỳ đâu — kể cả production. `firebase-sync.js` không còn điểm bridge
dự phòng nào (đã bridge-only hoàn toàn); `actions-routes.js` chỉ có 2 chỗ
trông giống guard nhưng không phải (một là so sánh dữ liệu, một là kiểm tra
hàm classic khác đã nạp chưa) — không thuộc phạm vi dọn dẹp này.

**B. Còn được test dựa vào — PHẢI sửa test trước khi xóa (19 điểm, 3 file):**

| File | Symbol | Test đang dựa vào nhánh cũ | Ghi chú |
| --- | --- | --- | --- |
| `users-auth.js` | `passwordPolicyError`, `legacyPasswordHashService`, `pbkdf2PasswordService` (2 chỗ), `isPbkdf2PasswordHash` | `tests/auth-security.test.js` | **Nhạy cảm bảo mật** — test đang kiểm PBKDF2/SHA-256 tự viết tay trong JS, không phải qua TS |
| `users-auth.js` | `activityAuditPageHtml` | `tests/audit-filter.test.js` | Test đang assert HTML tự dựng tay, không phải bridge |
| `data-io.js` | `nceCsvRow` | `tests/nce-export.test.js` | |
| `data-io.js` | `xlsxUtf8`, `xlsxEscape`, `xlsxZip`, `xlsxEmu`, `xlsxColumns`, `xlsxCells`, `xlsxRound`, `sigmaXlsxStyles`, `xlsxPeriodNumber`, `xlsxDrawing` | `tests/sigma-xlsx.test.js` | Lõi ghi ZIP/XLSX byte-chính-xác — test parse lại bytes do CHÍNH JS cũ sinh ra |
| `data-io.js` | `reportXlsxStyleIds` (`RXST`) | `tests/report-layout.test.js`, `tests/westgard-xlsx.test.js` | |
| `backup-ui.js` | `blobDownload` | `tests/backup-download-bridge.test.js` | Test chỉ "pin" nguyên văn regex vào code — sửa test là việc nhỏ, không phải rủi ro thực thi |

**C. Giữ nguyên có chủ đích (ngoại lệ thứ tự nạp):** `state.js` —
`teaAnalyteKey` (dòng 2) được gọi NGAY LÚC NẠP MODULE để dựng
`TEA_ANALYTE_META` (dòng 4), tức là trước khi `generated/modular-pilot.js`
chạy — tại thời điểm đó `globalThis.teaAnalyteMetaService` luôn undefined dù ở
production lẫn test. Đây không phải code chết: xóa nhánh dự phòng riêng của
`teaAnalyteKey` sẽ làm vỡ boot. Bốn hàm dùng chung symbol khác
(`teaAnalyteBuiltInMeta`, `teaAnalyteMetaById`, `teaAnalyteMeta`,
`teaAnalyteDisplay`) được gọi sau boot nên vẫn thuộc nhóm A.

**D. Không liên quan migration (bỏ qua):** `state-storage.js` (`typeof
fbDataPath`×2, `typeof getFbCfg`, `typeof cancelIdleCallback`/
`requestIdleCallback` — kiểm tra hàm/API khác, không phải bridge);
`firebase-sync.js` dòng 111 (không phải guard, gọi bridge vô điều kiện);
`actions-routes.js` (2 chỗ, xem nhóm A); `users-auth.js` dòng 53
(`auditChainStatus` — kiểm tra `audit.js` đã nạp chưa, không phải lựa chọn
JS/TS).

**Phát hiện phụ:** `invalidateDerivedForSave()` trong `state-storage.js` có vẻ
không còn được `save()` gọi (đã thay bằng `saveService.save(opts)`'s inline
invalidate) — chỉ còn `tests/cache-invalidation.test.js` và benchmark gọi
trực tiếp. Cần xem lại riêng, có thể là hàm chết.

**Ngoài phạm vi audit này:** `manage-tests-actions.js`, `report-routes.js`,
`reports.js`, `settings.js`, `sigma-tea.js`, `sigma.js` có pattern `typeof
X==='function'?...` nhưng chưa được xác nhận đây là bridge thật hay chỉ là
tham chiếu hàm classic khác — cần một đợt audit riêng trước khi coi bước gỡ
bridge của Pha F là xong.

#### Việc phải làm tiếp (theo audit trên)

1. ✅ **Đã dọn nhóm A — 2026-08-18.** Xóa nhánh JS cũ trong `qc-domain.js`,
   `state.js` (giữ lại guard của `teaAnalyteKey`), `local-store.js`,
   `state-storage.js`, `data-io.js` (7 điểm), `action-form.js`. `npm run
   build:pilot && npm run typecheck && npm test` đều xanh (609/613 — 4 lỗi
   còn lại thuộc về `after-render.js`/`router-render.js` đang dở dang ở một
   phiên làm việc khác, đã xác nhận không liên quan bằng cách tạm `git stash`
   riêng 6 file này và chạy lại — cùng 4 test đó vẫn đỏ y hệt). Hai điểm phát
   sinh ngoài danh sách audit ban đầu:
   - `state.js` dòng gán `globalThis.legacyDerivedCacheState` từng có thêm
     một lệnh gọi bridge dự phòng bị audit bỏ sót; ban đầu bị xóa nhầm vì
     tưởng luôn chết, nhưng hóa ra cần thiết khi thứ tự nạp bị đảo (bridge
     nạp trước `state.js`, đúng trường hợp của `tests/action-form.test.js`)
     — đã khôi phục lại nguyên vẹn.
   - `state-storage.js`: `scheduleLocalSave()` và `serializeStateForStorage()`
     có thân hàm legacy còn sót lại phía sau nhánh bridge sau khi bỏ `if`
     bọc ngoài — nếu không cắt bỏ sẽ hoặc chạy đúp lịch lưu (thiếu `return`)
     hoặc khai báo `const raw` trùng tên; đã dọn sạch cả hai.
   `?v=` của 6 file này trong `index.html` đã bump kèm theo.
2. ✅ **Đã dọn `backup-ui.js` — 2026-08-18.** `tests/backup-download-bridge.test.js`
   viết lại thành assert hành vi (stub `blobDownload`, kiểm `downloadBackupText`
   gọi đúng tên file + một `Blob` thật kiểu `application/json`) thay vì pin
   regex nguyên văn nguồn; `downloadBackupText()` giờ gọi `globalThis.blobDownload`
   trực tiếp, không còn nhánh `return false`.
3. ✅ **Đã dọn `users-auth.js` — 2026-08-18 (nhạy cảm bảo mật, đã kiểm cẩn thận).**
   `tests/auth-security.test.js` và `tests/audit-filter.test.js` nạp thêm
   `core.js`+`generated/modular-pilot.js`; cả hai vẫn xanh với implementation
   TS thật (không stub tay), gồm cả bài kiểm "hash cũ SHA-256 vẫn xác thực và
   nâng cấp được" — xác nhận `PASSWORD_HASH_ITERATIONS=600000` trong
   `src/domain/auth/pbkdf2-password-service.ts` khớp đúng giá trị OWASP cũ.
   Sau đó xóa nhánh JS cũ của `passwordError`/`legacyHashPass`/`hashPass`/
   `verifyPass`/`pageAudit()`'s `activityAuditPageHtml`, cùng `PASS_ITERATIONS`/
   `bytesHex`/`hexBytes` (chết theo). CLAUDE.md/AGENTS.md cập nhật khớp theo
   (hằng số lặp vòng giờ sống ở TS, không còn ở `users-auth.js`).
   **Phát hiện phụ ngoài audit ban đầu:** `auditDateKey()`/`auditFilteredActivities()`
   dùng symbol `activityAuditFilter` gọi thẳng không điều kiện — audit trước
   đó chỉ tìm pattern `if(globalThis.X)`/`globalThis.X||`/`globalThis.X?` nên
   bỏ sót dạng "gọi thẳng bridge, phần JS cũ nằm chết sau `return` không có
   `if` bao ngoài". Toàn bộ 7 hàm trang audit (`auditDateKey`,
   `auditFilteredActivities`, `auditSetQuery`, `auditSetDate`,
   `auditSetPageSize`, `auditSetPage`, `auditClearFilters`) đã có sẵn kiểu code
   chết này trong `users-auth.js` — tức là đã bị bỏ sót từ trước, không phải
   do audit lần này gây ra — nay dọn sạch luôn.
4. ✅ **Đã dọn `data-io.js` phần XLSX/ZIP — 2026-08-18.** Thêm
   `core.js`+`generated/modular-pilot.js` vào `tests/sigma-xlsx.test.js`,
   `tests/nce-export.test.js`, `tests/report-layout.test.js`,
   `tests/westgard-xlsx.test.js`; cả 4 xanh ngay (chứng minh output TS khớp
   byte-for-byte JS cũ) sau khi bổ sung 1 stub thiếu (`actionEventDate` cho
   `nce-export.test.js`). Xóa 12 điểm fallback (`nceCsvRow`, lõi
   `XlsxCore`/`SigmaXlsx`/`ReportXlsx`: `xlsxUtf8`, `xlsxEscape`, `xlsxZip`,
   `xlsxEmu`, `xlsxColumns`, `xlsxCells`, `xlsxRound`, `sigmaXlsxStyles`,
   `xlsxPeriodNumber`, `xlsxDrawing`, `reportXlsxStyleIds`), cùng `crc32`/
   `crcT`/`localZip` giờ chết theo (không còn caller nào, kể cả test — xác
   nhận bằng `rg`). `tests/nce-export.test.js`'s field-existence scan
   (`a\.field\b` trên `data-io.js`) chuyển sang scan
   `src/presentation/nce/action-csv-row.ts` (nguồn thật của phép ánh xạ từ
   khi logic chuyển sang TS) với pattern `\.field\b` không khóa cứng theo tên
   biến — test contract thay thế đúng tinh thần mục 6.
5. ✅ **Đã xem lại `invalidateDerivedForSave()` — 2026-08-18. Kết luận: KHÔNG
   phải code chết, không xóa.** `save()` → `globalThis.saveService.save(opts)`
   đúng là không còn gọi hàm này (`saveService` có bản sao logic invalidation
   riêng, viết inline trong `createSaveService({invalidate:ids=>{...}})` ở
   `src/compat/modular-pilot.global.ts:1677`) — nhưng bản thân
   `invalidateDerivedForSave()` vẫn gọi thẳng bridge sống
   (`globalThis.saveCommandPolicy`) và các hàm classic còn sống
   (`clearDerivedForTest`/`clearDerived`), không phải logic JS lỗi thời như
   mọi thứ khác đã dọn trong đợt audit này. Nó được `tests/cache-invalidation.test.js`
   (test "khóa ngữ nghĩa `save(opts)`" mà CLAUDE.md nhắc tới) và hai file
   benchmark (`performance-baseline.js`, `performance-regression.js`) gọi
   trực tiếp để kiểm/đo ĐÚNG hợp đồng invalidation mà `saveService` dùng nội
   bộ — xóa nó sẽ làm vỡ cả ba mà không có gì thay thế tương đương.
   **Có thật một chỗ trùng lặp (DRY) đáng sửa**: `saveService.invalidate`
   đáng lẽ nên gọi thẳng `(root as any).invalidateDerivedForSave(options)`
   thay vì chép lại logic — thứ tự nạp cho phép việc này (`state-storage.js`
   nạp ở dòng 72, trước `generated/modular-pilot.js` ở dòng 76 trong
   `index.html`, nên `globalThis.invalidateDerivedForSave` đã tồn tại khi
   `createSaveService(...)` chạy). Nhưng chữ ký hai bên lệch nhau
   (`invalidate` nhận `derivedTestIds` đã tính sẵn, còn
   `invalidateDerivedForSave` tự tính lại từ `opts` thô) nên hợp nhất đúng
   cách sẽ hoặc tính `plan` hai lần mỗi lần `save()` (lãng phí nhỏ trên một
   đường nóng được tài liệu hóa kỹ) hoặc phải đổi chữ ký công khai mà test/
   benchmark đang gọi. Đây là việc sửa kiến trúc `src/application/storage/`+
   `src/compat/`, ngoài phạm vi "dọn nhánh JS chết" của đợt audit bridge này —
   để lại làm việc riêng nếu muốn, không phải một phần của Pha F cleanup.
6. ✅ **Đã audit và dọn 6 file còn lại — 2026-08-18.** Dùng cả bốn pattern
   (kể cả "gọi thẳng `globalThis.X`, JS cũ chết sau `return`") trên
   `manage-tests-actions.js`, `report-routes.js`, `reports.js`, `settings.js`,
   `sigma-tea.js`, `sigma.js`. Kết quả nhỏ hơn nhiều so với 9 file đợt đầu —
   chỉ 3 điểm cần dọn trên tổng 1281 dòng:
   - `settings.js:63` — `lisGatewayConfig` (dạng 3, typeof-guard) — DEAD,
     không test nào gọi `pageSettings()` runtime. Đã xóa fallback.
   - `reports.js` — `reportHeader()` — dạng 4 (code cũ chết sau `return`,
     dòng dựng HTML thủ công cũ không bao giờ chạy tới). Đã xóa.
   - `report-routes.js` — `pageReportV2()` — biến thể dạng 4: một **block
     trần `{...return globalThis.X(...);}`** (không phải `if`) đặt ngay đầu
     hàm, khiến toàn bộ phần sau (~20 dòng HTML/nút xuất cũ) chết. Đã xóa.
     `manage-tests-actions.js` và `sigma.js`/`sigma-tea.js` sạch hoàn toàn —
     không có điểm nào cần dọn (đã đọc hết từng hàm để xác nhận không có
     dạng 4 nào ẩn).
   Ba chỗ `typeof X==='function'` còn lại (`effectiveTeaRefs`,
   `searchText` trong `manage-tests-actions.js`; `reportDateRange` trong
   `report-routes.js`; `searchText` trong `sigma-tea.js`; `sgTeaRefText`/
   `previousLotSeries`/`actionRerunStatus`/`actionApprovalLabel` trong
   `reports.js`; `operationalLevels` trong `sigma.js`) đều là tham chiếu tới
   hàm classic khác (không phải bridge) — xác nhận không có trong
   `src/compat/modular-pilot.global.ts`, để nguyên.
   **Cảnh báo cho lần sau:** xóa nhánh "dead-code-after-return" ở
   `pageReportV2()`/`reportHeader()` làm vỡ 2 test source-scanner
   (`report-nce-print.test.js`, `tests/ui-route-structure.test.js`) vì chúng
   quét chuỗi HTML (`id="reportNceAppendix"...checked`, layout
   `report-export-options`/`report-actions`) trực tiếp trên file classic —
   dù code đó "chết" theo nghĩa runtime, nó vẫn là **hợp đồng test** cho tới
   khi test được trỏ sang đúng file TS. Đã sửa hai test đó để đọc
   `src/presentation/report/report-page-html.ts` thay vì `report-routes.js`
   (đúng markup, xác nhận khớp 1:1 với bản classic cũ trước khi sửa test).
   Tức là: **dead code theo runtime không đồng nghĩa an toàn xóa** — luôn
   `rg` tên/chuỗi đặc trưng của đoạn sắp xóa trong toàn bộ `tests/` trước khi
   xóa, không chỉ kiểm tra nó có được `loadSandbox()` thực thi hay không.

Sau đợt này: `assets/modules/` còn 30 file classic (giảm từ 31/32 vì
`after-render.js` đã bị retire hẳn ở một phiên khác trong lúc audit này diễn
ra). 16 file đã audit bridge sạch nhánh JS cũ: `action-form.js`,
`actions-routes.js`, `qc-domain.js`, `state.js`, `local-store.js`,
`backup-ui.js`, `state-storage.js`, `firebase-sync.js`, `users-auth.js`,
`data-io.js` (đợt sáng 2026-08-18) + `manage-tests-actions.js`,
`report-routes.js`, `reports.js`, `settings.js`, `sigma-tea.js`, `sigma.js`
(đợt chiều 2026-08-18). `npm run build:pilot && npm run typecheck && npm
test` xanh (609/613 — 4 lỗi còn lại thuộc `after-render.js`/`router-render.js`
đang dở dang ở phiên khác, không liên quan tới bridge cleanup).

7. ✅ **Đã audit và dọn 14 file classic còn lại — 2026-08-18.** Audit song
   song cả 14 file (kể cả 3 file `entry-routes.js`/`router-render.js`/
   `westgard-routes.js` đang có uncommitted changes từ phiên khác — chỉ đọc,
   không sửa cho tới khi xác nhận). Kết quả: 10 file **sạch hoàn toàn**
   (`analyte-catalog.js`, `app-meta.js`, `audit.js`, `dashboard-routes.js`,
   `draw.js`, `lis-queue-ui.js`, `manage-routes.js`, `modals.js`,
   `entry-routes.js`, `router-render.js`, `westgard-routes.js` — thực ra 11,
   không có điểm nào cần dọn, kể cả 3 file đang bị đụng nên không phát sinh
   xung đột khi audit). 3 file cần dọn thật:
   - `range.js` — 3 điểm dạng 4 (`rangeSystematicNce`, `rangeCandidate`,
     `rangeGatePasses`). Đã xóa, `tests/range-candidate.test.js` xanh.
   - `reagent.js` — 1 khối lớn dạng 4 biến thể block trần (`rcCompute()`,
     ~48 dòng HTML thủ công cũ). Đã xóa; `reagent-label-bridge.test.js`'s
     assertion `doesNotMatch(.../if\(globalThis\.reagentResultHtml\)/)` vẫn
     pass nhưng nay vô nghĩa (không còn dạng `if` lẫn dạng block để phân
     biệt) — không chặn, chỉ ghi chú.
   - `action-workflow-service.js` — nhiều nhất: 9 điểm dạng 1 + 5 điểm dạng 4.
     Trước khi xóa, trỏ lại `tests/nce-export.test.js`'s scan 3 chuỗi
     "Hiệu lực:"/"Nguy cơ còn lại:"/"Hồ sơ đã hủy:" sang
     `src/domain/nce/action-protocol-service.ts` (đúng tinh thần mục 6).
     Sau khi xóa các nhánh chết, dọn dây chuyền tiếp: `computeActionRerunStatus`
     và `actionRerunSignature` mất hết caller (chỉ được gọi từ nhánh chết vừa
     xóa) nên xóa luôn cả hai; `rerunMemo`/`pointIndexMemo`/`lotIndexMemo`/
     `pointActionsMemo`/`pointActionsIndex()` mồ côi theo, xóa nốt.
     **Ngoại lệ giữ nguyên vì thứ tự nạp** (như `teaAnalyteKey` ở `state.js`):
     dòng `root.ActionWorkflowService={ACTION_LABELS:root.NceActionLabels&&
     root.NceActionLabels.actionLabels||ACTION_LABELS,RISK_SCALE:...}` ban đầu
     tưởng là dead code (`root.NceActionLabels` luôn có), nhưng
     `action-workflow-service.js` nạp ở dòng 74 trong `index.html`, TRƯỚC
     `generated/modular-pilot.js` ở dòng 76 — dòng gán này chạy ngay khi
     script nạp (không nằm trong hàm, không đợi gọi), nên `root.NceActionLabels`
     CHƯA tồn tại lúc đó thật. Xóa nhánh `||ACTION_LABELS` sẽ làm global
     `ACTION_LABELS`/`RISK_SCALE` (dùng ở `action-form.js`) vĩnh viễn
     `undefined`. Đã giữ nguyên `PROTOCOL_CHECKS`/`CHECK_LABELS`/.../`ACTION_LABELS`
     ở đầu file — đây là bản sao thật sự cần thiết, không phải code thừa.
     Một chỗ text-pin nhỏ khác: `tests/action-point-index-bridge.test.js` pin
     nguyên văn `invalidateActionCaches` KÈM dấu `;return;` cuối dòng — giữ
     nguyên dấu `return;` thay vì bỏ đi cho "gọn", vì bỏ sẽ làm vỡ test
     không cần thiết.
   Gate cuối: `build:pilot`/`typecheck`/`test` xanh (609/613, 4 lỗi cũ).

Sau đợt sáng + chiều 2026-08-18: **tất cả 30 file classic đã được audit
bridge**, 3 file (`entry-routes.js`, `router-render.js`, `westgard-routes.js`)
audit xong nhưng CHƯA sửa gì (đang chờ phiên khác commit, dù thực ra không có
gì cần sửa). Còn lại mục 5 (`invalidateDerivedForSave()` trong
`state-storage.js`, nghi ngờ là hàm chết, chưa xác nhận) trước khi coi bước
"gỡ bridge" của Pha F là hoàn tất toàn bộ.

### Pha G — chuyển 30 classic module sang TypeScript

Mục tiêu: retire toàn bộ `assets/modules/*.js`; adapter DOM/canvas cũng viết
bằng TypeScript, sau build trở thành JavaScript trong bundle.

Thứ tự ưu tiên, theo rủi ro tăng dần:

1. **UI thuần:** `modals`, `after-render`, `dashboard-routes`, `router-render`.
2. **Route/presentation:** Entry, Manage, Report, Settings, Reagent, Sigma,
   Actions và Audit; chuyển mỗi trang như một lát dọc hoàn chỉnh.
3. **Canvas và browser adapter:** `draw`, `reports`, export/print, File API;
   giữ visual/print/Electron gate cho từng lát.
4. **Hạ tầng và bootstrap:** state storage, local store, Firebase sync, LIS,
   app bootstrap; đây là pha cuối vì phụ thuộc lifecycle và offline recovery.

Mỗi lát phải: chuyển source → thay caller/import → build bundle → cập nhật
`index.html` → xóa JS cũ chỉ khi không còn caller → chạy gate phù hợp. Không
chuyển hàng loạt 32 file trong một pull request.

### Pha H — bỏ global bridge và nhiều script tags

Chỉ bắt đầu khi Pha G hoàn thành.

1. Thay `modular-pilot.global.ts` bằng entry composition có kiểu dữ liệu.
2. Chuyển event binding/router/bootstrap vào TypeScript entry.
3. Giảm dần các `<script defer>` đến một entry bundle do Vite sinh ra.
4. Giữ Firebase CDN riêng chỉ nếu vẫn cần compat SDK; nếu đổi cách nạp SDK thì
   đó là quyết định hạ tầng có test offline/Electron riêng.
5. Retire `assets/app.js`, sau cùng xử lý `core.js`/worker bằng dự án nhỏ độc
   lập có parity test.

Pha H hoàn thành khi `index.html` không còn phụ thuộc thứ tự load của các source
classic script, không còn shared global application API và toàn bộ source ứng
dụng nằm trong `src/`.

## 6. Quy trình bắt buộc cho mỗi lát

1. Xác định contract hiện tại: caller, state branch, audit, cache, save, DOM và
   test đang bảo vệ.
2. Viết/chuyển implementation TypeScript và test thuần trước.
3. Nối dependency tại entry/adapter; không đọc global từ domain/application.
4. Chuyển runtime call-site; giữ compatibility bridge chỉ trong thời gian còn
   caller legacy.
5. Xóa implementation/facade JS chết trong cùng lát; cập nhật query `?v=` ở
   `index.html` nếu asset runtime đổi. Trước khi xóa: `rg` tên hàm/chuỗi đặc
   trưng của đoạn sắp xóa trong toàn bộ `tests/` — "không còn đường thực thi
   nào chạy tới nó qua `loadSandbox()`" KHÔNG đồng nghĩa "an toàn xóa", vì
   nhiều test là source-scanner (`fs.readFileSync`+`assert.match`) pin
   nguyên văn chuỗi/markup của file classic mà không thực thi gì cả — xóa
   code chết theo runtime vẫn có thể làm vỡ test đó (xem bài học ngày
   2026-08-18: `pageReportV2()`/`reportHeader()`). Nếu logic đã chuyển hẳn
   sang TS, sửa test trỏ sang đúng file `src/...ts` thay vì xóa assertion.
6. Chạy tối thiểu:

```powershell
npm.cmd run build:pilot
npm.cmd run typecheck
npm.cmd test
```

7. Theo phạm vi, chạy thêm `ui-check`, `nce-check`, `visual-check`,
   `a11y-audit`, `print-check` và trước release là `verify-release`.

## 7. Tiêu chí hoàn thành cuối cùng

- `src/**/*.ts` là nguồn duy nhất của application code.
- Không còn `assets/modules/*.js`, `assets/app.js` hoặc compatibility global
  application bridge.
- `index.html` nạp entry bundle được build; vẫn chạy static HTTP, Electron và
  `file://`.
- Không còn mutation nghiệp vụ trực tiếp tại handler DOM.
- `typecheck`, test, UI/NCE/visual/a11y/print/Electron và release gate xanh.
- Bundle sinh ra từ source và được commit cùng thay đổi runtime.

## 8. Nhật ký quyết định ngắn

| Ngày | Quyết định |
| --- | --- |
| 2026-08-01 | Không dùng native browser ESM: `file://` không tương thích import module. |
| 2026-08-09 | Dùng Vite bundle classic script để giữ static HTTP/Electron/`file://`. |
| 2026-08-16–18 | Hoàn tất các lát nghiệp vụ lớn và Wave E; chuyển trọng tâm sang adapter/route legacy. |
| 2026-08-18 | Chốt mục tiêu: chuyển toàn bộ classic module sang TS theo lát, sau đó bỏ global bridge và nhiều script tags. |
| 2026-08-18 | Hoàn tất lát đầu: `after-render.js` được retire; controller TypeScript sở hữu vòng đời canvas và post-render. |
| 2026-08-18 | Router policy (registry trang, role/page permission, fallback trang đầu) chuyển sang TypeScript; `router-render.js` chỉ gọi bridge tương thích. |
| 2026-08-18 | Router shell (brand, navigation, license/trial footer, sidebar preference) chuyển sang TypeScript; classic router giữ wrapper global. |
| 2026-08-18 | VN date picker controller được tạo trong TypeScript; parse/validate/format ngày của router đã chuyển sang bridge, UI event sẽ retire ở lát kế tiếp. |
| 2026-08-18 | Audit toàn bộ điểm bridge `globalThis` còn lại trong 9 file classic (qc-domain/state/local-store/backup-ui/state-storage/firebase-sync/users-auth/data-io/action-form): 57 điểm đã chết an toàn xóa ngay, 19 điểm còn cần sửa test trước (bảo mật hash mật khẩu trong `users-auth.js` + xuất XLSX byte-chính-xác trong `data-io.js`), 1 ngoại lệ giữ nguyên vì thứ tự nạp (`state.js` teaAnalyteKey). Xem mục "Kiểm kê bridge JS→TS còn lại" ở Pha F. |
| 2026-08-18 | Dọn xong cả nhóm A (57 điểm) và nhóm B (19 điểm: `backup-ui.js`, `users-auth.js`, `data-io.js`) của audit bridge — 9/9 file đã audit đều sạch nhánh JS cũ. Thêm bridge thật (không stub tay) vào `tests/auth-security.test.js`, `tests/audit-filter.test.js`, `tests/sigma-xlsx.test.js`, `tests/nce-export.test.js`, `tests/report-layout.test.js`, `tests/westgard-xlsx.test.js` để test tiếp tục chứng minh đường TS thay vì đường JS cũ. Phát hiện phụ: audit ban đầu chỉ quét 3 pattern (`if(globalThis.X)`/`globalThis.X||`/`globalThis.X?`) nên bỏ sót một dạng thứ tư (gọi thẳng `globalThis.X` không điều kiện, JS cũ nằm chết sau `return`) — đã tự phát hiện và dọn thêm 7 hàm trong `users-auth.js` không nằm trong audit gốc. |
| 2026-08-18 | Audit + dọn tiếp 6 file classic (`manage-tests-actions.js`, `report-routes.js`, `reports.js`, `settings.js`, `sigma-tea.js`, `sigma.js`) bằng cả bốn pattern — chỉ 3 điểm cần dọn (`settings.js` lisGatewayConfig; `reports.js`/`report-routes.js` hai biến thể dead-code-after-return, một trong đó là block trần không phải `if`). Rút ra bài học: xóa nhánh chết theo runtime làm vỡ 2 test source-scanner (`report-nce-print.test.js`, `ui-route-structure.test.js`) vì chúng pin chuỗi HTML trực tiếp trên file classic — đã sửa hai test trỏ sang `src/presentation/report/report-page-html.ts`. Từ nay: trước khi xóa bất kỳ đoạn "chết" nào, phải `rg` chuỗi/tên đặc trưng của nó trong toàn bộ `tests/`, không chỉ kiểm tra đường thực thi qua `loadSandbox()`. |
| 2026-08-18 | Audit + dọn nốt 14 file classic còn lại — 30/30 file classic đã được audit bridge. Chỉ `range.js` (3 điểm), `reagent.js` (1 khối lớn) và `action-workflow-service.js` (14 điểm, dây chuyền mồ côi kéo theo `computeActionRerunStatus`/`actionRerunSignature`/3 memo Map) thật sự cần dọn; 11 file còn lại đã sạch từ trước, kể cả 3 file đang bị phiên khác đụng vào (audit không sửa, không xung đột). Phát hiện thêm một ngoại lệ giữ nguyên vì thứ tự nạp (như `teaAnalyteKey`): `action-workflow-service.js` nạp trước bundle TS trong `index.html`, nên dòng `root.ActionWorkflowService={ACTION_LABELS:root.NceActionLabels&&...||ACTION_LABELS,...}` chạy khi `root.NceActionLabels` chưa tồn tại — suýt xóa nhầm lần hai sau bài học `state.js`. |
| 2026-08-18 | Xem lại `invalidateDerivedForSave()` (mục còn lại cuối cùng của đợt audit bridge) — kết luận đây KHÔNG phải code chết, quyết định giữ nguyên. Nó không tái hiện logic JS lỗi thời (đã gọi thẳng bridge sống); vấn đề thật là `saveService` (TS) có bản sao logic invalidation riêng thay vì gọi lại hàm này, dù thứ tự nạp cho phép. Hợp nhất đúng cách đụng tới `src/application/storage/save-service.ts`/`src/compat/modular-pilot.global.ts` (đường nóng `save()`, có tài liệu benchmark riêng) — ngoài phạm vi dọn bridge, để lại làm việc riêng khi cần. Với quyết định này, toàn bộ audit bridge JS→TS của Pha F (30/30 file classic) coi như hoàn tất. |
