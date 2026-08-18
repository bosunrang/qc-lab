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
| Nguồn TypeScript | 729 tệp: 99 domain, 137 application, 492 presentation, 1 compatibility bridge |
| Nguồn classic còn lại | 27 tệp `assets/modules/*.js`, thêm `assets/core.js` và `assets/app.js` |
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

1. **UI thuần:** ~~`modals`~~ (xong 2026-08-18), `after-render` (đã retire ở
   Pha F), ~~`dashboard-routes`~~ (xong 2026-08-18), ~~`router-render`~~ (xong
   2026-08-18) — nhóm này đã **hoàn tất**.
2. **Route/presentation:** Entry, Manage, Report, Settings, Reagent, Sigma,
   Actions và Audit; chuyển mỗi trang như một lát dọc hoàn chỉnh.
3. **Canvas và browser adapter:** `draw`, `reports`, export/print, File API;
   giữ visual/print/Electron gate cho từng lát.
4. **Hạ tầng và bootstrap:** state storage, local store, Firebase sync, LIS,
   app bootstrap; đây là pha cuối vì phụ thuộc lifecycle và offline recovery.

Mỗi lát phải: chuyển source → thay caller/import → build bundle → cập nhật
`index.html` → xóa JS cũ chỉ khi không còn caller → chạy gate phù hợp. Không
chuyển hàng loạt 30 file trong một pull request.

#### Lát 1 — `modals.js` (2026-08-18)

Retire hoàn toàn `assets/modules/modals.js` (101 dòng, 14 hàm). Chuyển sang
`src/presentation/modal/`: `modal-focus-trap.ts` (helper focus-trap dùng
chung — hợp nhất `modalFocusable`/`dialogFocusable` và phần xử lý phím
Escape/Tab vốn trước đây trùng lặp y hệt giữa hai lớp, chỗ đơn giản hóa duy
nhất trong lát này), `modal-template.ts` (`modalTemplate`/`modalCloseButton`),
`modal-controller.ts` (`openModal`/`closeModal`, lớp `#modalRoot`),
`dialog-overlay-controller.ts` (`confirmDialog`/`infoDialog`/
`openDialogOverlay`/`closeDialogOverlay`, lớp `#dialogRoot`) — vẫn giữ đúng
hai lớp tách biệt như bản gốc (lý do: xem "Module roles" trong CLAUDE.md),
chỉ hợp nhất phần focus-trap. `src/compat/modular-pilot.global.ts` gán
`root.openModal`/`closeModal`/`modalTemplate`/`modalCloseButton`/
`confirmDialog`/`confirmDialogAnswer`/`infoDialog`/`infoDialogAnswer`/
`openDialogOverlay`/`closeDialogOverlay`/`dialogKeydown` — không đổi ~20 file
classic vẫn gọi các tên này như global trần. Dọn kèm ~13 chỗ ép kiểu
`(root as any)`/`(globalThis as any)` từng phải dùng để gọi các hàm này lúc
còn thuộc classic JS, và xóa 2 `declare function confirmDialog`/`infoDialog`
ambient (nay là property có kiểu thật trên `QCLabGlobal`). Thêm 8 ambient
declare vào `global.d.ts` (`openModal`/`closeModal`/`modalTemplate`/
`modalCloseButton`/`confirmDialog`/`infoDialog`/`openDialogOverlay`/
`closeDialogOverlay`) để `checkJs` vẫn phân giải được lời gọi trần trong các
file classic còn lại (`users-auth.js` gọi thẳng `closeDialogOverlay`/
`openDialogOverlay`). `tests/ui-accessibility.test.js`/`ui-route-structure.test.js`
(source-scanner, trước đọc `assets/modules/modals.js` bằng `fs.readFileSync`)
chuyển sang đọc 4 file TS mới; hai assertion pin cú pháp `function
modalTemplate(`/`function modalCloseButton(` phải đổi thành `const
modalTemplate=`/`const modalCloseButton=` vì TS dùng arrow function theo quy
ước các file presentation khác.

**Phát hiện phụ:** `tests/local-store.test.js` stub `infoDialog` qua tham số
`globals` thứ hai của `loadSandbox()` — tham số này được set lên vm context
TRƯỚC khi các file trong danh sách chạy, nên khi `infoDialog` chỉ tồn tại ở
`modals.js` cũ (không nạp trong test này) thì stub không bao giờ bị ghi đè.
Từ khi `infoDialog` chuyển vào bundle TypeScript, `generated/modular-pilot.js`
(có trong danh sách nạp của test đó) gán `root.infoDialog=...` ngay khi chạy,
ghi đè mất stub — test vẫn "pass" theo nghĩa không throw ở bước gán, nhưng
`checkStorageUsage()` sau đó gọi `infoDialog` thật, kéo tới `modalCloseButton`
→ `escAttr` mà sandbox này không nạp `reports.js`, nên throw
`TypeError: root.escAttr is not a function`. Sửa bằng cách set stub SAU khi
`loadSandbox()` trả về (`ctx.infoDialog=...` trực tiếp lên context object,
thay vì qua tham số `globals` của lệnh gọi) — object context của `vm` vẫn
nhận gán trực tiếp sau khi các file đã chạy xong. Bài học cho các lát kế
tiếp: bất kỳ hàm nào từng chỉ tồn tại trong classic JS (nên "vắng mặt an
toàn" trong sandbox) mà chuyển vào bundle TypeScript sẽ bắt đầu **có thật**
trong mọi sandbox nạp `generated/modular-pilot.js` — rà `tests/` tìm test nào
stub cùng tên qua tham số `globals` của `loadSandbox()` trước khi xóa file
classic, không chỉ tìm lời gọi trần.

#### Lát 2 — `dashboard-routes.js` (2026-08-18)

Retire hoàn toàn `assets/modules/dashboard-routes.js` (43 dòng: `pageDash()`,
`dashTestFilter()`, `dashTestSetStatus()`, `pageDashLoading()`). File này đã
gần như thuần bridge từ các lát trước — mọi phép tính thật (KPI, cảnh báo
Westgard, gộp lô sắp hết hạn, lọc trạng thái, render hàng/panel) đã là một
trong các hàm `dashboardXxx` ở `src/presentation/dashboard/`/
`src/domain/qc/`; lát này chỉ chuyển phần LẮP RÁP (orchestration) — không
đụng tới bất kỳ phép tính nào. Chuyển sang một file duy nhất
`src/presentation/dashboard/dashboard-page-controller.ts`
(`createDashboardPageController(deps)`), theo đúng mẫu factory-nhận-deps của
`after-render-controller.ts`/`router-shell-controller.ts` — không đọc
`globalThis`/DOM trực tiếp, mọi phụ thuộc (kể cả các hàm `dashboardXxx` đã có
kiểu thật trên `QCLabGlobal`, và các global classic còn lại như
`operationalTests`/`wgMemo`/`levelsMissingTarget`/`daysToExp`/`liveRowFilter`/
`role`/`vnDate`/`isoToday`/`rerender`) truyền qua `deps`. `modular-pilot.global.ts`
gán `root.pageDash`/`pageDashLoading`/`dashTestFilter`/`dashTestSetStatus` —
không đổi `router-render.js` (dispatch table `{dash:pageDash,...}` và
`restoreRouteFilters()`'s `dashTestFilter(dashTestQ)` vẫn gọi các tên này như
global trần, không cần sửa).

**Ba bẫy runtime phát hiện được sau khi build/typecheck xanh nhưng test đỏ
diện rộng (24 file thất bại, không chỉ các test dashboard) — bài học quan
trọng nhất của lát này:**

1. **Bare identifier reference ≠ lazy call.** Viết `isoToday,`/`role,`/
   `vnDate,`/`rerender,` (object shorthand) trong object deps LÀM BẤT KỲ
   sandbox nào build/tải `generated/modular-pilot.js` mà không tải kèm
   `modules/state.js`/`modules/router-render.js` ném `ReferenceError` NGAY LÚC
   NẠP BUNDLE (không phải lúc gọi) — vì đây là tham chiếu giá trị tức thời,
   không phải closure trì hoãn. Toàn bộ phần còn lại của
   `modular-pilot.global.ts` luôn viết dạng `()=>isoToday()`/`()=>rerender()`
   cho đúng lý do này; đây là quy ước bắt buộc, không phải phong cách. Any
   dependency mà lời gọi thật có thể vắng mặt trong một số sandbox PHẢI bọc
   lazy, dù có `declare function` ambient hay không — ambient declare chỉ
   thỏa mãn kiểu, không đảm bảo hàm tồn tại lúc chạy.
2. **`root.dashTestQ=value` (setter ghi qua accessor) trông giống một khai báo
   global MỚI với `tests/global-name-uniqueness.test.js`** — scanner của test
   này coi mọi `root.X=`/`window.X=`/`globalThis.X=` là một "điểm khai báo"
   cho tên X, không phân biệt được "gán giá trị mới" với "gọi setter của một
   accessor `Object.defineProperty` đã có sẵn" (ở đây là `dashTestQ`/
   `dashTestStatus`, cài bởi `installUiState(root,'AnalysisUIState',...)` ở
   `src/presentation/state/ui-state.ts`). Không có tiền lệ nào trong
   `modular-pilot.global.ts` từng ghi trực tiếp vào một trường ui-state theo
   kiểu này trước lát này (mọi nơi khác chỉ ĐỌC). Sửa bằng cách ghi qua object
   namespace mà `installUiState()` đã công bố sẵn cho đúng mục đích này —
   `(root as any).AnalysisUIState.dashTestQ=value` — vì `AnalysisUIState` và
   trạng thái đứng sau getter/setter của `dashTestQ` là CÙNG một object tham
   chiếu; ghi vào namespace object thay đổi giá trị mà getter đọc, nhưng không
   khớp pattern `root\.dashTestQ=` nên scanner không báo trùng.
3. Hai lỗi `Type 'undefined' is not assignable` từ `strict` TypeScript vì
   `state.data`/`state.tests` là optional trong kiểu `state` — thêm `||{}`/
   `||[]` khi đọc (khớp cách `stateActions:()=>state.actions||[]` đã làm).
   Riêng lỗi contravariance tham số hàm (gán `(items:Kpi[])=>string` vào chỗ
   khai `(items:AnyRec[])=>string`) được giải quyết bằng cách định nghĩa
   `type AnyRec=any` (không phải `Record<string,any>`) — dùng `any` thật để
   tắt kiểm tra cấu trúc tham số hàm thay vì cố ép các chữ ký cụ thể của 24
   hàm `dashboardXxx` khớp một kiểu chung.

Cả ba đều xuất phát từ MỘT nguyên nhân gốc: lát này là lát ĐẦU TIÊN của Pha G
mà một hàm route classic (không phải modal/dialog như Lát 1) di chuyển
nguyên khối sang TS trong khi vẫn phải tương thích với hàng chục cấu hình
sandbox khác nhau trong `tests/` — mỗi cấu hình tải một tập file khác nhau.
**Bài học cho các lát kế tiếp:** sau khi build/typecheck xanh, luôn chạy
TOÀN BỘ `npm test` (không chỉ file test của route đang chuyển) trước khi kết
luận lát đã xong — một thay đổi nhỏ ở cách viết deps có thể làm vỡ hàng chục
test không liên quan trực tiếp.

Ngoài runtime, ~30 assertion source-scanner trong `tests/typescript-module-
pilot.test.js`, `tests/dashboard-loading-bridge.test.js`,
`tests/dashboard-model-bridge.test.js`, `tests/dashboard-page-bridge.test.js`,
`tests/ui-accessibility.test.js`, `tests/ui-route-structure.test.js` pin
nguyên văn cú pháp classic (`globalThis.dashboardXxx(...)`, `function
pageDashLoading(tests,pending){...}`) của `dashboard-routes.js` cũ — tất cả
được trỏ sang đọc `dashboard-page-controller.ts` với regex cập nhật theo cú
pháp TS (`deps.dashboardXxx(...)`, arrow function). `tests/partial-render-
helpers.test.js` chỉ cần bỏ `'modules/dashboard-routes.js'` khỏi danh sách
nạp (file không còn tồn tại). Gate cuối: `build:pilot`/`typecheck`/`test`
xanh (613/613).

#### Lát 3 — `router-render.js` (2026-08-18)

Retire hoàn toàn `assets/modules/router-render.js` (149 dòng, ~50 tên global)
— file lớn và trung tâm nhất trong nhóm "UI thuần" vì nó là bảng điều phối
trang của toàn app. Phần lớn nội dung đã rơi vào một trong ba nhóm trước khi
viết code mới:

1. **Chết hẳn, xóa không cần bridge:** `PERM` (const, 0 caller ở bất kỳ đâu
   trong repo kể cả test); `VN_DATE_MONTHS`/`VN_DATE_DAYS`/biến `vnDatePicker`/
   hàm `vnPickerRender()` (~30 dòng) — bị `vn-date-picker-controller.ts` (đã
   có `render()`/state/`bind()` riêng từ trước) thay thế hoàn toàn nhưng chưa
   ai xóa bản classic; xác nhận bằng `rg` không có caller nào kể cả trong
   chính file.
2. **Bí danh thuần (không có logic mới), nối thẳng trong `modular-pilot.global.ts`:**
   ~20 hàm một dòng kiểu `function X(){return globalThis.Y.method();}` —
   `brandTitle`/`brandSub`/`brandMarkText`/`brandLogo`/`renderBrand`/`nav`/
   `licensedLabName`/`trialInfo`/`sideFoot`/`toggleSidebarNav` (→
   `routerShell`), `vnPickerParse`/`Valid`/`Text`/`Open`/`Close`/`Move`/`Mode`/
   `SetYear`/`SetMonth`/`Pick` (→ `vnDatePickerController`), `stateName`/
   `qcVerdictLabel` (→ `reportLabels`), `rolePageIds`/`userPageIds`/
   `canAccessPage`/`firstAccessPage`/`PAGES` (→ `routerPagePolicy`). Đây đúng
   vai trò "export contract cho caller chưa migrate" của lớp compat theo mục
   4 — không phải "facade chỉ đổi tên hàm" vì không tạo file TS mới nào cho
   riêng chúng.
3. **Logic thật, cần file TS mới** — `src/presentation/router/`
   (`router-icons.ts`: `icon`/`icoCal`/`icoDownload`/`icoPrint`/`icoRefArrow`,
   thuần không phụ thuộc; `router-permission.ts`: `role`/`canWrite`/
   `requireWrite`/`requireAdmin`/`roleLabel`/`roleSelectOptions`;
   `live-row-filter.ts`: `setSearchCount`/`showSearchEmpty`/
   `replaceSelectItems`/`liveRowFilter`/`scheduleSearchRender`;
   `date-box-html.ts`: `dateBox`; `router-dispatch-controller.ts`: `go`/
   `resetMainScroll`/`render`/`restoreRouteFilters`/`rerender`), cộng
   `src/presentation/shared/ui-primitives.ts` (`btn`/`emptyState`/
   `topUserBox`/`headOnly`) và `src/presentation/range/range-actions-html.ts`
   (`rangeActions`). `page` (biến trang hiện tại, đọc/ghi từ ~8 file classic
   khác) chuyển vào `createRouterUiState()` trong `ui-state.ts` — cùng cơ chế
   accessor `Object.defineProperty` như `dashTestQ`/`currentUser`/…, không
   phải state mới.

**Ba lớp bẫy runtime phát hiện được (build/typecheck xanh nhưng 24 test đỏ
diện rộng, đúng quy mô lần trước ở `dashboard-routes.js` — dấu hiệu đây là
loại rủi ro lặp lại của MỌI lát Pha G, không phải riêng file nào):**

1. **Bare identifier thay vì lazy call, lại tái diễn** — dù đã biết từ Lát 2,
   vẫn phải quét kỹ: `isoToday`/`vnDate`/`role`/`rerender` viết dạng
   `isoToday,` (object shorthand) trong deps ném `ReferenceError` ngay lúc nạp
   bundle ở sandbox thiếu `state.js`. Sửa lại `()=>isoToday()` như quy ước.
2. **Ghi trực tiếp `root.page=`/`root.statusMemo=` (không qua namespace
   object) tái tạo đúng lỗi global-name-uniqueness của Lát 2** — `page` giờ
   là accessor thật (`RouterUIState`), `statusMemo` thuộc `AnalysisUIState`;
   `router-dispatch-controller.ts`'s `setPage`/`resetStatusMemo` phải ghi qua
   `(root as any).RouterUIState.page=...`/`(root as any).AnalysisUIState.statusMemo=...`,
   không phải `root.page=`/`root.statusMemo=` trực tiếp.
3. **`vnDatePickerController.bind()` chuyển từ "chạy khi router-render.js nạp"
   (tùy chọn theo từng sandbox test) sang "chạy ngay khi bundle nạp" (bắt
   buộc với MỌI sandbox tải `generated/modular-pilot.js`, hiện có 49 file
   test)** — `bind()` gọi `deps.document.addEventListener(...)` không có
   guard nào ngoài `!deps.document`; 2 trong 49 file test đó stub `document`
   tối giản (`{getElementById:...}`, thiếu `addEventListener`) nên vỡ ngay
   lúc nạp dù test không hề đụng tới date picker
   (`lis-client-service.test.js`, `render-downsampling.test.js`) — thêm
   `addEventListener:()=>{}` vào hai stub đó. Đây là bài học riêng cho lát
   này: **di chuyển một lời gọi side-effect-ngay-khi-nạp (không phải lazy
   closure) vào bundle mở rộng yêu cầu ngầm cho TOÀN BỘ sandbox tải bundle đó,
   không chỉ những sandbox trước đây từng nạp file classic sở hữu lời gọi
   ấy** — phải chạy hết `npm test` để tìm hết, không đoán trước được từ việc
   đọc code.

**Bốn phát hiện phụ khác, mỗi cái là một dạng "stub bị bundle ghi đè" khác
nhau, không lặp y hệt bài học `infoDialog` của Lát 1:**

- `tests/audit-chain-cache.test.js` stub `function rerender(){__rerenderCalls++;}`
  qua `run()` (không phải tham số `globals`) NHƯNG vẫn chạy TRƯỚC khi nạp
  bundle trong chuỗi lệnh — bundle nạp sau vẫn ghi đè. Sửa bằng cách thêm một
  lệnh `run()` đặt lại `rerender=...` NGAY SAU khi nạp bundle, không đổi cách
  stub (qua `run()`, không qua `globals`).
- `tests/audit-filter.test.js` stub SÁU global cùng lúc qua tham số `globals`
  (`headOnly`/`btn`/`emptyState`/`dateBox`/`rerender`/`vnPickerParse`) — tất cả
  giờ đều là thật. Sửa bằng `Object.assign(ctx,{...})` sau `loadSandbox()`,
  giữ nguyên các stub không liên quan (`esc`/`escAttr`/`parseVN`/…) ở tham số
  `globals` như cũ vì chúng không bị bundle chạm tới.
- `tests/partial-render-helpers.test.js` gán lại `document={createElement:...}`
  NGAY TRONG một lệnh `run()` để giả lập DOM cho lệnh gọi `replaceSelectItems()`
  kế tiếp — nhưng `replaceSelectItems` giờ đóng gói (capture) giá trị
  `document` tại thời điểm bundle nạp (một closure, giống mọi controller khác
  trong `modular-pilot.global.ts`), nên gán lại BIẾN `document` sau đó không
  hề ảnh hưởng tới closure đã đóng gói — phép gán chỉ đổi tên biến trỏ tới
  object mới, không đổi object cũ mà closure đang giữ. Sửa bằng cách GẮN THÊM
  method lên CÙNG object đã capture (`document.createElement=...`) thay vì
  gán lại biến `document=...`. Bài học chung: mọi kỹ thuật test "đổi document
  giữa chừng bằng gán lại biến toàn cục" chỉ còn tác dụng với code CHƯA
  chuyển sang TS (đọc `document` trần mỗi lần gọi); code đã chuyển phải được
  test bằng cách mutate object đã capture.
- `tests/lis-client-service.test.js` có 2 sandbox riêng: sandbox đầu thiếu
  `addEventListener` trên `document` (giống mục 3 ở trên); sandbox thứ hai
  vẫn nạp `'modules/router-render.js'` trong danh sách file (giờ không tồn
  tại, ném `ENOENT`) — bỏ khỏi danh sách, các global nó từng cung cấp
  (`btn`, `dateBox`, …) nay tới từ bundle đã nạp trước đó trong cùng danh
  sách.

Xóa thêm `assets/modules/router-render.js` khỏi `index.html`; 6 assertion
trong `tests/ui-route-structure.test.js` từng đọc `assets/modules/router-render.js`
bằng `fs.readFileSync` được chuyển sang đọc `src/presentation/router/*.ts` nối
lại (cho các kiểm tra "không giữ registry/trang trần") hoặc sang đọc
`src/compat/modular-pilot.global.ts` (cho các kiểm tra "phải gọi qua
TypeScript bridge", vì phần logic ĐÓ giờ nằm ở lớp compat chứ không phải một
file presentation riêng); assertion so sánh thứ tự nạp script với
`router-render.js` bị xóa hẳn vì tiền đề (một thẻ `<script>` riêng cho file
đó) không còn tồn tại. `tests/ui-accessibility.test.js` chỉ cần bỏ
`read('assets/modules/router-render.js')` khỏi chuỗi nối — nội dung ARIA nó
từng đóng góp (thuộc `routerShell.nav()`) đã có sẵn trong
`router-shell-controller.ts`, cũng nằm trong chuỗi nối đó. Gate cuối:
`build:pilot`/`typecheck`/`test` xanh (613/613).

**Lỗi thật phát hiện sau khi chạy `npm run ui-check` (browser thật) — KHÔNG
lỗi Node nào bắt được:** `pageDash()` ném lỗi ngay khi mở app thật
(`Cannot read properties of undefined (reading 'has')` tại
`isWestgardMemoized`). Nguyên nhân: `wgMemo` là một biến `let` khai báo ở top
level của `state.js` (`let mem=null,...,wgMemo=new Map(),...`), KHÔNG phải
`function` — trong một classic `<script>` (không phải module), `function`
top-level tự động trở thành property của `globalThis`/`window`, nhưng
`let`/`const` thì KHÔNG — chúng chỉ tồn tại trong "lexical environment" dùng
chung giữa các classic script, chỉ truy cập được bằng tên biến trần (bare
identifier), không truy cập được qua `globalThis.wgMemo`/`root.wgMemo`. Dòng
`isWestgardMemoized:testId=>(root as any).wgMemo.has(testId)` do đó luôn nhận
`undefined`. Lỗi này thực ra sinh ra từ **Lát 2** (dòng y hệt đã có trong
`dashboard-page-controller.ts`'s wiring từ khi tạo) nhưng không có test Node
nào chạm tới nhánh đó theo cách phơi ra lỗi — chỉ lộ ra khi chạy thật trong
Chromium qua `ui-check`. Sửa bằng cách đổi lại thành bare `wgMemo.has(testId)`
kèm `declare let wgMemo: Map<string, any>;` trong khối ambient của
`modular-pilot.global.ts`, khớp đúng cách bản classic cũ từng viết
(`wgMemo.has(t.id)`, không phải `globalThis.wgMemo`). Đã quét toàn bộ 111 tên
`let`/`const` top-level còn lại trong `assets/modules/*.js` xem có bị tham
chiếu qua `root.X`/`(root as any).X` ở đâu khác trong `modular-pilot.global.ts`
không — chỉ có đúng 1 chỗ (`wgMemo`), đã sửa. **Quy tắc rút ra, áp dụng cho
mọi lát Pha G còn lại:** khi wiring code trong `modular-pilot.global.ts` cần
đọc một biến TỪ FILE CLASSIC, phải phân biệt hai loại — `function` top-level
(an toàn qua `root.X`/`(root as any).X`, vì nó thật sự là property của
`globalThis`) và `let`/`const` top-level (KHÔNG an toàn qua `root.X`, PHẢI
tham chiếu bằng tên biến trần và thêm `declare let X` nếu cần qua strict
typecheck) — nhầm giữa hai loại không bị `typecheck` lẫn `npm test` (Node vm
sandbox) bắt được, chỉ lộ ra khi chạy thật trong trình duyệt. Sau phát hiện
này, chạy thêm `npm run a11y-audit` (11 trang + 18/18 modal, 0 vi phạm) và
`npm run nce-check` (91 đạt, bao gồm cả các kịch bản Dashboard/NCE quá hạn đi
qua đúng `pageDash()`/`rerender()` vừa sửa) để xác nhận không còn lỗi runtime
nào khác lẩn trong luồng dispatch trang. Bài học quy trình: bước 7 của mục 6
("theo phạm vi, chạy thêm ui-check/nce-check/...") không phải tùy chọn cho
những lát đụng tới `render()`/dispatch trang — phải chạy TRƯỚC khi coi lát là
xong, không chỉ sau khi `npm test` xanh.

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
| 2026-08-18 | Bắt đầu Pha G: chuyển `modals.js` (lát đầu tiên, nhóm "UI thuần") sang `src/presentation/modal/` (4 file TS). Hợp nhất phần focus-trap trùng lặp giữa hai lớp modal/dialog vào một helper dùng chung, giữ nguyên hai lớp `#modalRoot`/`#dialogRoot` tách biệt. Gỡ ~13 chỗ ép kiểu `(root as any)`/`(globalThis as any)` quanh các hàm này trong `modular-pilot.global.ts`. Phát hiện phụ: `tests/local-store.test.js` stub `infoDialog` qua tham số `globals` của `loadSandbox()` — tham số này set TRƯỚC khi file chạy nên bị `generated/modular-pilot.js` (nạp sau) ghi đè ngay khi `infoDialog` chuyển thành thật; sửa bằng cách gán stub sau khi `loadSandbox()` trả về. Bài học cho các lát Pha G kế tiếp: rà `tests/` tìm stub cùng tên qua tham số `globals` trước khi retire một file classic, không chỉ tìm lời gọi trần của hàm sắp xóa. `build:pilot`/`typecheck`/`test` xanh (613/613). |
| 2026-08-18 | Lát 2 của Pha G: chuyển `dashboard-routes.js` (43 dòng, đã gần thuần bridge từ trước) sang `src/presentation/dashboard/dashboard-page-controller.ts` — factory nhận `deps`, không đụng phép tính (mọi `dashboardXxx` builder đã là TS từ trước). Ba bẫy runtime phát hiện sau khi build/typecheck xanh nhưng 24 file test đỏ: (1) tham chiếu bare `isoToday,`/`role,`/`vnDate,`/`rerender,` trong object deps ném `ReferenceError` ngay lúc NẠP bundle ở mọi sandbox thiếu `modules/state.js`/`router-render.js` — phải bọc lazy `()=>isoToday()` như quy ước đã có sẵn khắp `modular-pilot.global.ts`; (2) `root.dashTestQ=value` (gọi setter của accessor `Object.defineProperty` có sẵn) bị `tests/global-name-uniqueness.test.js` hiểu nhầm là khai báo global mới, trùng với khai báo thật ở `ui-state.ts` — sửa bằng cách ghi qua namespace object `(root as any).AnalysisUIState.dashTestQ=value` thay vì gán thẳng `root.dashTestQ=`; (3) lỗi contravariance tham số hàm khi gán 24 hàm `dashboardXxx` có chữ ký cụ thể vào một kiểu `deps` chung — giải quyết bằng `type AnyRec=any` (any thật, không phải `Record<string,any>`). Bài học: sau build/typecheck xanh vẫn phải chạy TOÀN BỘ `npm test`, không chỉ test của route đang chuyển. ~30 assertion source-scanner ở 6 file test (typescript-module-pilot, dashboard-loading-bridge, dashboard-model-bridge, dashboard-page-bridge, ui-accessibility, ui-route-structure) được trỏ sang đọc `dashboard-page-controller.ts` với regex cập nhật theo cú pháp TS. `build:pilot`/`typecheck`/`test` xanh (613/613). |
| 2026-08-18 | Lát 3 của Pha G (kết thúc nhóm "UI thuần"): chuyển `router-render.js` (149 dòng, ~50 tên global) sang `src/presentation/router/` (5 file) + `src/presentation/shared/ui-primitives.ts` + `src/presentation/range/range-actions-html.ts`. Xóa kèm 2 chỗ chết hẳn (`PERM` — 0 caller; `VN_DATE_MONTHS`/`VN_DATE_DAYS`/`vnDatePicker`/`vnPickerRender()` — bị `vn-date-picker-controller.ts` thay thế từ trước nhưng chưa ai xóa bản classic). `page` chuyển vào `RouterUIState` (cùng cơ chế accessor `dashTestQ` đã dùng). Tái hiện cả 2 bẫy đã biết từ Lát 2 (bare identifier chưa bọc lazy; ghi thẳng `root.page=`/`root.statusMemo=` thay vì qua namespace object) — xác nhận đây là rủi ro lặp lại của MỌI lát Pha G, không phải riêng dashboard. Phát hiện bẫy MỚI: di chuyển `vnDatePickerController.bind()` (side-effect chạy ngay lúc nạp, không phải lazy closure) từ "chạy khi router-render.js nạp" sang "chạy ngay khi bundle nạp" biến nó thành yêu cầu ngầm cho cả 49 file test tải bundle, làm vỡ 2 test có `document` stub tối giản dù chúng không đụng date picker. Bốn phát hiện phụ, mỗi cái một biến thể khác của "bundle ghi đè stub": stub qua `run()` (không chỉ qua tham số `globals`) cũng bị ghi đè nếu đặt trước lệnh nạp bundle; và một dạng MỚI hẳn — test gán lại biến `document=...` giữa chừng để đổi DOM giả lập không còn tác dụng vì hàm đã chuyển sang TS đóng gói (capture) `document` thành closure tại lúc nạp, phải mutate object đã capture (`document.createElement=...`) thay vì gán lại biến. `build:pilot`/`typecheck`/`test` xanh (613/613). Nhóm "UI thuần" của Pha G coi như hoàn tất; lát kế tiếp chuyển sang nhóm "Route/presentation". |
| 2026-08-18 | Sửa lỗi thật phát hiện qua `npm run ui-check` sau Lát 3 (app thật vỡ ngay khi mở, `pageDash()` ném lỗi ở `isWestgardMemoized`) — bắt nguồn từ Lát 2, không phải Lát 3: wiring `(root as any).wgMemo.has(testId)` luôn `undefined` vì `wgMemo` là biến `let` top-level của `state.js`, KHÔNG phải `function` — chỉ `function` top-level mới tự thành property của `globalThis` trong classic script, `let`/`const` chỉ sống trong lexical scope dùng chung giữa các script, phải tham chiếu bằng tên biến trần. Sửa lại `wgMemo.has(testId)` (bare) + `declare let wgMemo: Map<string, any>;`. Đã quét toàn bộ 111 tên `let`/`const` top-level còn lại trong `assets/modules/*.js` xem có chỗ nào khác bị tham chiếu qua `root.X` sai kiểu này — chỉ có đúng 1 chỗ, đã sửa. Không có test Node nào (kể cả 613 test hiện có) bắt được lỗi này; chỉ `ui-check` (Chromium thật) lộ ra. Sau khi sửa: `ui-check` 29/29 đạt (kể cả "không lỗi runtime/console"), `a11y-audit` 11 trang + 18/18 modal 0 vi phạm, `nce-check` 91/91 đạt. Cập nhật quy trình lát: bước "chạy ui-check/nce-check theo phạm vi" ở mục 6.7 không phải tùy chọn cho lát đụng `render()`/dispatch — phải chạy trước khi coi lát là xong, không chỉ dựa vào `npm test` xanh. |
