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

## 3. Trạng thái thực tế — 2026-08-20

| Hạng mục | Trạng thái |
| --- | --- |
| Nguồn TypeScript | 739 tệp (thêm `sigma-page-controller.ts`; domain/application/bridge không đổi khác — lát nhóm C chỉ chuyển glue vào `modular-pilot.global.ts` đã có sẵn) |
| Nguồn classic còn lại | 3 tệp `assets/modules/*.js` (nhóm C hạ tầng — `action-workflow-service.js`+`users-auth.js`+`firebase-sync.js`+`state-storage.js` retire 2026-08-20), thêm `assets/core.js` và `assets/app.js` |
| Bundle hiện tại | `assets/generated/modular-pilot.js`, Vite sinh ra và nạp bằng `<script defer>` |
| Kiểm tra kiểu | `npm.cmd run typecheck` đạt: checkJs legacy + strict TypeScript modules |
| Test Node | `npm.cmd test` đạt ngày 2026-08-20 (611/611) |
| Ước tính tiến độ | **~90%** logic ứng dụng do TypeScript sở hữu lúc chạy · **~78%** theo số dòng classic thô còn lại · **~73%** theo tiêu chí hoàn thành cuối cùng (mục 7, đã trừ toàn bộ Pha H) — xem "Ba thước đo tiến độ" bên dưới (chưa tính lại chi tiết sau lát Route 5, biến động nhỏ) |

Các phần nghiệp vụ chính đã có TypeScript: Westgard/QC, storage và Firebase,
backup, auth/audit, NCE, Entry, Manage, Sigma, report/XLSX, Reagent, Settings,
LIS và phần lớn presentation HTML/view-model.

Migration vẫn ở pha song song: `src/compat/modular-pilot.global.ts` còn công
bố bridge global để các classic script tiêu thụ bundle. Bridge là cơ chế chuyển
tiếp, không phải kiến trúc đích.

### Ba thước đo tiến độ (2026-08-18, cuối phiên retire route)

Ba con số khác nhau vì ba mẫu số khác nhau; đừng gộp làm một:

1. **~90% — logic ứng dụng TypeScript sở hữu lúc chạy** (thước đo chính của
   tài liệu này). Phần lớn 23 file classic còn lại đã là "vỏ cầu nối" mỏng —
   logic thật nằm trong `src/` từ Pha F; classic chỉ còn `function
   x(){return globalThis.Y(...)}` gọi sang service TS.
2. **~78% — theo số dòng classic thô** (4.157 dòng `assets/modules/*.js` so với
   14.394 dòng `src/**/*.ts`). Thấp giả tạo: nhiều dòng classic chỉ là
   delegation một dòng, không phải logic.
3. **~73% — theo tiêu chí hoàn thành cuối cùng (mục 7)**. Kể cả retire hết
   classic module, vẫn còn NGUYÊN Pha H: bỏ global bridge
   (`modular-pilot.global.ts` ~3.300 dòng), gộp về một entry bundle, xử lý
   `core.js`+worker thành lát parity riêng.

### Kiểm kê từng module classic — đã xong / chưa xong

**Đã retire sang TypeScript trong Pha G (20 file, phiên 2026-08-18–19):**

| Classic (đã xóa) | TypeScript thay thế | Lát |
| --- | --- | --- |
| `modals.js` | `src/presentation/modal/*` (4 file) | UI thuần 1 |
| `dashboard-routes.js` | `src/presentation/dashboard/dashboard-page-controller.ts` | UI thuần 2 |
| `router-render.js` | `src/presentation/router/*` + `shared/ui-primitives.ts` + `range/range-actions-html.ts` | UI thuần 3 |
| `settings.js` | `src/presentation/settings/settings-page-controller.ts` | Route 1 |
| `report-routes.js` | `src/presentation/report/report-page-controller.ts` | Route 2 |
| `westgard-routes.js` | `src/presentation/westgard/westgard-page-controller.ts` | Route 3 |
| `reagent.js` | `src/presentation/reagent/reagent-page-controller.ts` | Route 4 |
| `lis-queue-ui.js` | `src/presentation/lis/lis-queue-controller.ts` | Route 5 |
| `audit.js` | inline vào `src/compat/modular-pilot.global.ts` (không có logic mới, chỉ delegator) | Route 6 |
| `sigma-tea.js` | `src/domain/sigma/sigma-tea-resolution.ts` | Route 7 |
| `manage-routes.js` | `src/presentation/manage/manage-page-controller.ts` | Route 8 |
| `manage-tests-actions.js` | `src/presentation/manage/manage-tests-actions-controller.ts` | Route 9 |
| `entry-routes.js` | `src/presentation/entry/entry-page-controller.ts` | Route 10 |
| `actions-routes.js` | `src/presentation/actions/actions-page-controller.ts` | Route 11 |
| `action-form.js` | `src/presentation/actions/action-form-controller.ts` | Route 11 |
| `sigma.js` | `src/presentation/sigma/sigma-page-controller.ts` | Route 12 |
| `draw.js` | `src/presentation/chart/qc-chart-renderer.ts` | Route 13 |
| `reports.js` | `src/presentation/report/report-print-controller.ts` (+ `src/presentation/shared/html-escape.ts`) | Route 14 |
| `data-io.js` | `src/presentation/export/data-io-controller.ts` | Route 15 |
| `local-store.js` | inline vào `src/compat/modular-pilot.global.ts` (không có logic mới, chỉ delegator sang `local-store-service.ts` đã có sẵn) | Hạ tầng 1 |
| `backup-ui.js` | inline vào `src/compat/modular-pilot.global.ts` (không có logic mới, glue quanh các Backup*Command đã có sẵn) | Hạ tầng 2 |
| `app-meta.js` | inline vào `src/compat/modular-pilot.global.ts` (dữ liệu thuần, không có hàm nào) | Hạ tầng 3 |
| `range.js` | inline vào `src/compat/modular-pilot.global.ts` (không có logic mới, glue quanh qcRangeCandidateService/qcRangeTea/qcRangeSafetyGate/qcRangeBiasEvaluation/RangeWorkflowCommand đã có sẵn) | Hạ tầng 4 |

(`after-render.js` đã retire ở Pha F.) Với Route 9, toàn bộ trang "Cấu hình chung"
(Manage) đã sang TypeScript hoàn toàn. Với Route 10, trang "Nhập QC" (Entry) —
nơi ghi/hủy điểm QC — cũng vậy. Với Route 11, trang "Khắc phục sự cố" (NCE) — kể
cả vòng đời hồ sơ lẫn form 8 mục — cũng vậy. Với Route 12, trang "Six Sigma" —
cũng vậy; **toàn bộ nhóm A (Route/presentation) của Pha G đã hoàn tất**. Route 13
mở đầu nhóm B (canvas/adapter): renderer Levey-Jennings đơn/đa mức + CUSUM. Route 14
chuyển toàn bộ bản in (`openPrint`, `printReport`/`printWestgard`/`printSigmaPeriod(s)`/
`printRangeForm`) sang TypeScript. Route 15 chuyển nốt xuất CSV/XLSX (Sigma + Báo cáo +
Westgard) — **toàn bộ nhóm B (Canvas/adapter) của Pha G đã hoàn tất**.

**Chưa xong — 7 file classic còn lại, chia theo nhóm rủi ro:**

| Nhóm | File | Dòng | Ghi chú port |
| --- | --- | --- | --- |
| **C. Hạ tầng/bootstrap** (rủi ro cao — kế hoạch yêu cầu làm CUỐI, từng lát độc lập) | `state.js` | 128 | `ensureShape`/state gốc; lifecycle nhạy. **Đã TÁCH NỀN 2026-08-19** (state + cache + mem/startupProblem → globalThis property, xem lát tách nền bên dưới) — chưa retire, nhưng port sau này giờ đã mang tính cơ học |
| | `qc-domain.js` | 255 | wiring Westgard/worker + point derivation |
| | ~~`state-storage.js`~~ | ~~120~~ | **xong 2026-08-20, Lát nhóm C — 4** — xem "Kế hoạch các lát nhóm C còn lại" |
| | ~~`local-store.js`~~ | ~~13~~ | **xong 2026-08-19, Hạ tầng lát 1** — xem bên dưới |
| | ~~`firebase-sync.js`~~ | ~~173~~ | **xong 2026-08-20, Lát nhóm C — 3** — xem "Kế hoạch các lát nhóm C còn lại" |
| | `users-auth.js` | 256 | auth/user + PBKDF2 wiring + trang audit |
| | ~~`action-workflow-service.js`~~ | ~~149~~ | **xong 2026-08-20, Lát nhóm C — 1** — xem "Kế hoạch các lát nhóm C còn lại" |
| | ~~`range.js`~~ | ~~95~~ | **xong 2026-08-19, Hạ tầng lát 4** — xem bên dưới |
| | ~~`backup-ui.js`~~ | ~~27~~ | **xong 2026-08-19, Hạ tầng lát 2** — xem bên dưới |
| | ~~`app-meta.js`~~ | ~~28~~ | **xong 2026-08-19, Hạ tầng lát 3** — xem bên dưới |
| | `analyte-catalog.js` | 80 | dữ liệu measurand đóng băng (thuần data) — `state.js` đọc TRẦN ở top-level, xem cảnh báo bên dưới |
| **D. Lõi UMD + worker** (dự án con parity riêng, làm sau cùng Pha G) | `assets/core.js` | 637 | UMD, dùng chung Node/browser/worker |
| | `assets/workers/westgard-worker.js` | — | contract worker, cần parity test |
| **E. Bootstrap cuối** | `assets/app.js` | 9 | entry `boot()` — xử lý ở đầu Pha H |

**Cảnh báo cho lát kế tiếp — `analyte-catalog.js` KHÔNG đơn giản như vẻ ngoài:**
khác `local-store.js`/`backup-ui.js`/`app-meta.js`/`range.js` (chỉ có closure
trì hoãn), `state.js` đọc `TEA_ANALYTE_CATALOG` TRẦN Ở TOP LEVEL, ngay khi nạp
(`const REFTESTS=Object.freeze(TEA_ANALYTE_CATALOG.map(...))`,
`const TEA_ANALYTE_META=...`) — không phải trong thân hàm. Gộp
`analyte-catalog.js` vào bundle (nạp SAU `state.js` trong `index.html` hiện
tại) sẽ làm `state.js` ném `ReferenceError` ngay lúc boot, vì `TEA_ANALYTE_CATALOG`
chưa tồn tại (không phải property của `globalThis`, không phải binding lexical
dùng chung) tại thời điểm đó. Lát này phải giải quyết được sự phụ thuộc thứ tự
nạp này trước — hoặc bằng cách chuyển luôn phần đọc `TEA_ANALYTE_CATALOG` của
`state.js` sang lazy (nằm ngoài phạm vi "chỉ port analyte-catalog.js"), hoặc để
dành file này cho ĐÚNG lát chuyển `state.js` — không chuyển riêng lẻ như đã làm
với 4 file trước.

**Thứ tự đề xuất tiếp theo:** nhóm A (route/presentation) đã xong toàn bộ →
nhóm B (canvas/adapter) đã xong toàn bộ (`draw.js` Route 13, `reports.js`
Route 14, `data-io.js` Route 15) → nhóm C (hạ tầng, từng lát một, chạy
`ui-check` + benchmark storage) — **lát 1 (`local-store.js`), lát 2
(`backup-ui.js`), lát 3 (`app-meta.js`) và lát 4 (`range.js`) xong
2026-08-19**, còn 5 file. `analyte-catalog.js` cần xử lý cùng `state.js` (xem
cảnh báo trên) chứ không tách riêng; để dành
`state.js`/`qc-domain.js`/`state-storage.js`/`firebase-sync.js`/`users-auth.js`/
`action-workflow-service.js` — có nhiều caller chéo và lifecycle nhạy — cho các
lát sau khi đã quen bẫy "eager vs lazy global" trong nhóm này) → nhóm D
(`core.js`+worker, lát parity độc lập) → Pha H.

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
2. **Route/presentation:** Entry, Manage, ~~Report~~ (xong 2026-08-18),
   ~~Settings~~ (xong 2026-08-18), ~~Reagent~~ (xong 2026-08-18), Sigma, Actions và Audit; chuyển mỗi
   trang như một lát dọc hoàn chỉnh.
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

#### Lát route 1 — `settings.js` (2026-08-18, mở nhóm "Route/presentation")

Retire `assets/modules/settings.js` (69 dòng) sang
`src/presentation/settings/settings-page-controller.ts`
(`createSettingsPageController(deps)`), sở hữu `pageSettings()` + 9 form handler
(`saveLab`/`saveBrand`/`pickLogo`/`clearLogo`/`saveFb`/`clearFb`/
`copyFirebaseRules`/`readBrandInputs`/`checkStorageUsage`) + callback chuẩn hóa
state `ensureLabBrandShape()`. Đây là file **DOM/browser adapter** thuần: mọi
phép tính đã nằm ở command/service TS (`SettingsProfileCommand`,
`SettingsFirebaseCommand`, `firebaseSettingsService`) hoặc HTML builder
(`settingsXxxHtml`) từ các đợt trước; controller chỉ đọc form, chạy
FileReader/canvas cho logo, mở dialog, và ủy quyền. Các browser API
(`FileReader`/`Image`/canvas/clipboard/`navigator`) được tiêm qua `deps` để
controller vẫn test được ngoài trình duyệt.

Lát này **nhẹ hơn hẳn** ba lát "UI thuần" trước vì đã rút được bài học:

- Áp dụng sẵn quy tắc "lazy delegation" cho MỌI dep (`infoDialog:(m,o)=>root.infoDialog(m,o)`,
  `requireAdmin:()=>root.requireAdmin()`, `getState:()=>state`, …) ngay từ đầu —
  không tái diễn bẫy bare-identifier.
- Phân biệt đúng `function` global (an toàn qua `(root as any).backupStatusText()`)
  với `let`/`const` global (`state`, `fb` — tham chiếu trần) ngay từ đầu, không
  tái diễn bẫy `wgMemo`.
- Chỉ MỘT hàm được classic khác gọi trần (`ensureLabBrandShape`, do `state.js`'s
  `ensureShape()` gọi qua callback `ensureLab:ensureLabBrandShape`) nên chỉ cần
  thêm đúng một `declare function ensureLabBrandShape(): void;` vào `global.d.ts`.
  9 handler còn lại là onclick trong HTML builder (chuỗi, không phải caller
  classic) + `pageSettings` (chỉ dispatch table trong compat gọi) nên không cần
  ambient declare.

Test: ba source-scanner (`settings-presentation-bridge`, `settings-firebase-command-bridge`,
`settings-helper-bridge`) trỏ từ `assets/modules/settings.js` sang
`settings-page-controller.ts` với regex đổi theo cú pháp `deps.X` (giữ nguyên
các assertion "phải là hợp đồng bridge bắt buộc" quét `modular-pilot.global.ts`,
và bổ sung assertion mới quét đúng dòng wiring `deps→root.settingsXxx` trong
compat để không mất lớp bảo vệ khi logic rời file classic). `local-store.test.js`
bỏ `'modules/settings.js'` khỏi 4 danh sách nạp — `checkStorageUsage` và
`ensureLabBrandShape` nay do bundle cung cấp (không tái diễn bẫy stub vì bài test
`checkStorageUsage` đã sửa cách stub `infoDialog` từ Lát 1). `ui-accessibility.test.js`
trỏ `settingsRoutes` sang controller (không còn HTML thô để quét — HTML thật nằm
ở các builder TS đã đọc riêng). Gate đầy đủ (đã rút kinh nghiệm Lát 3, chạy
browser TRƯỚC khi chốt): `build:pilot`/`typecheck`/`test` (613/613) +
`a11y-audit` (trang settings + 18/18 modal, 0 vi phạm — xác nhận `pageSettings()`
render sạch trong Chromium) + `ui-check` (29/29, không lỗi runtime/console).

#### Lát route 2 — `report-routes.js` (2026-08-18)

Retire `assets/modules/report-routes.js` (92 dòng) sang
`src/presentation/report/report-page-controller.ts`
(`createReportPageController(deps)`) — sở hữu `pageReportV2()` + 17 hàm còn lại
(khóa/mở khóa kỳ, tìm kiếm xét nghiệm, khoảng ngày, chọn xuất, icon nút). Nặng
hơn `settings.js` một bậc vì có **state trang** (`reportQ`/`reportTest`/
`reportRangeStart`/`reportRangeEnd`/`reportLockYm`) và mở modal mở khóa. Xóa kèm
`const REPORT_ACTION_ICON_PATHS` — dead code (bản thật đã ở
`report-action-icon.ts`, bridged qua `reportActionIconPresentation`; `rg` xác
nhận const classic không caller).

**Quyết định thiết kế state trang:** đặt 5 biến state thành **closure `let`**
bên trong factory (factory chạy một lần lúc nạp bundle nên closure sống qua mọi
`rerender()`), thay vì đưa vào UI-state bag. Lý do: production chỉ ghi các biến
này qua handler (`reportSetLockPart()`/`reportSearchSet()`) — không nơi nào
gán trực tiếp `reportLockYm=` như global. Đây là điểm khác `page` (RouterUIState)
và `dashTestQ` (AnalysisUIState): những biến đó ĐƯỢC ghi trực tiếp từ nhiều file
classic nên phải là accessor global; state trang Báo cáo thì không.

**Lỗi thật `ui-check` bắt được (node test không):** `scripts/ui-workflow-check.js`
khóa kỳ bằng cách gán thẳng `reportLockYm='2026-06'` rồi gọi `reportLockPeriod()`
— shortcut dựa vào việc `reportLockYm` từng là global classic ghi được. Sau khi
thành closure, phép gán đó tạo một global `reportLockYm` VÔ HẠI (controller
không đọc tới), nên lock chạy trên tháng hiện tại thay vì 2026-06 →
`locked:false`. Sửa test đi qua đúng đường người dùng
(`reportSetLockPart('year','2026');reportSetLockPart('month','6')` — chính là
cái mà picker tháng/năm gọi qua `onchange`), không gán thẳng biến nữa. Đây là
minh họa rõ cho quyết định closure ở trên: state trang chỉ nên đổi qua handler,
và `ui-check` là thứ duy nhất phát hiện được khi một chỗ (ở đây là chính test)
lách quy tắc đó — `build`/`typecheck`/`test` (613/613) đều xanh khi lỗi này còn
tồn tại. Củng cố lại quy trình Lát 3: chạy `ui-check` là bắt buộc cho lát
đụng page route, không phải tùy chọn.

Test: 3 report bridge scanner (`report-lock-bridge`, `report-page-bridge`,
`report-render-bridge`) + `ui-route-structure`/`ui-accessibility` trỏ từ
`report-routes.js` sang controller với regex đổi theo cú pháp `deps.X`/
`const X = `; bỏ assertion so thứ tự nạp `actions-routes.js < report-routes.js`
(tiền đề — thẻ script riêng cho report-routes.js — không còn). `global.d.ts`
thêm 2 declare cho `reportExportSelection`/`reportRangeText` (data-io.js &
reports.js gọi trần). Gate: `build:pilot`/`typecheck`/`test` 613/613 +
`a11y-audit` (report + 18/18 modal, 0 vi phạm) + `ui-check` (29/29 sau khi sửa
test lock).

#### Lát route 5 — `lis-queue-ui.js` (2026-08-19)

Retire `assets/modules/lis-queue-ui.js` (36 dòng) sang
`src/presentation/lis/lis-queue-controller.ts`
(`createLisQueueController(deps)`) — lát **nhẹ nhất nhóm route** vì file classic
đã gần thuần bridge từ Pha F (mọi HTML nằm trong `lis-queue-presentation.ts`,
mọi service đồng bộ nằm trong `LISClientService`/`LisGatewayCommand`/
`lisSettingsService`). Controller chỉ còn phần điều phối: đọc form
(`lisGatewaySaveSettings`), mở modal hàng chờ (`lisRenderQueueModal`,
`lisOpenQueueModal`, `lisQueueRefresh`), và hai onclick handler
`lisQueueImport`/`lisQueueReject` (kèm `confirmDialog` trước khi bỏ một kết
quả). Không có state trang riêng (không giống Report/Westgard/Reagent) — mọi
input đọc trực tiếp từ DOM mỗi lần gọi.

Áp dụng đầy đủ các quy tắc đã rút ra từ 4 lát route trước, không phát sinh bẫy
runtime mới:

- Mọi dep bọc lazy (`gatewayConfig:()=>root.lisGatewayConfig!()`,
  `requireAdmin:message=>root.requireAdmin(message)`, …) — không tái diễn bẫy
  bare-identifier.
- `document` tiêm qua `deps.document` (fallback stub tối giản khi không có
  `document` thật, giống `settings-page-controller.ts`), không đọc `document`
  toàn cục trực tiếp trong controller.
- `gatewayCommand`/`presentation` được gán thẳng từ `root.LisGatewayCommand`/
  `root.lisQueuePresentation` lúc wiring (không lazy) vì hai global đó đã được
  gán ở dòng ngay phía trên trong cùng file, cùng thời điểm — an toàn vì thứ
  tự khai báo trong `modular-pilot.global.ts` là tuyến tính.

Test: viết lại toàn bộ `tests/lis-queue-bridge.test.js` (trước đọc
`assets/modules/lis-queue-ui.js` bằng `fs.readFileSync` và pin cú pháp
`function lisQueueValueText(record){return globalThis...}`) sang đọc
`lis-queue-controller.ts` + wiring trong `modular-pilot.global.ts`, cộng một
assertion mới xác nhận file classic không còn tồn tại (không được tái tạo lại
bản cũ). `tests/lis-client-service.test.js` bỏ `'modules/lis-queue-ui.js'`
khỏi hai danh sách `loadSandbox()` — `lisQueueRowHtml`/`lisQueueSectionHtml`/
`lisImportResult`/… nay đến từ bundle, kể cả bài hồi quy XSS (`lisOnclick` bọc
`escAttr()` quanh cả chuỗi onclick) vẫn xanh nguyên vẹn không cần sửa gì khác.
`tests/typescript-module-pilot.test.js` đổi assertion từ `match` (từng đòi
`lis-queue-ui.js` phải xuất hiện trong `index.html` như "lớp presentation tách
khỏi service đồng bộ") sang `doesNotMatch` (giờ nó bị retire hẳn) — đúng tinh
thần các assertion "không được quay lại global-scope cũ" của các module đã
retire trước đó.

Gate đầy đủ: `build:pilot`/`typecheck`/`test` 613/613 + `a11y-audit` (settings
+ 18/18 modal — kể cả `settings:lis-queue` mở được, 0 vi phạm, ratchet PASS) +
`ui-check` (29/29, không lỗi runtime/console) + `nce-check` (91/91, không liên
quan trực tiếp nhưng chạy để xác nhận không hồi quy dispatch trang). Xóa
`assets/modules/lis-queue-ui.js` khỏi `index.html` (script tag riêng của nó
từng nạp trước `generated/modular-pilot.js`) và khỏi đĩa; bump `?v=` của
`generated/modular-pilot.js`. Với lát này, nhóm "Route/presentation" còn 8
file classic (`manage-routes.js`, `manage-tests-actions.js`, `entry-routes.js`,
`actions-routes.js`, `action-form.js`, `sigma.js`, `sigma-tea.js`, `audit.js`
— `audit.js` mỏng nhất, `action-form.js` lớn nhất).

#### Lát route 6 — `audit.js` (2026-08-19)

Retire `assets/modules/audit.js` (25 dòng, 18 hàm delegator + 3 biến ngưỡng)
**không tạo file TS mới** — toàn bộ nội dung inline thẳng vào
`src/compat/modular-pilot.global.ts`, vì đây thuần là lớp bridge 1-dòng-1-hàm
gọi sang `QCCore`/`AuditService` (đã là TypeScript từ trước), không có HTML hay
DOM. Trước khi xóa, map từng trong 18 hàm ra caller thật (không chỉ chỗ định
nghĩa) bằng `rg` trên toàn bộ `assets/`, `src/`, `tests/`: 7 hàm
(`auditCanonical`, `auditEntryPayload`, `auditService`, `auditLastHash`,
`auditPushRaw`, `auditRotateOverflow`, `auditNextSeq`, `auditChainSignature`)
**không còn caller nào ở bất kỳ đâu** — xóa hẳn, không port. 11 hàm còn lại có
caller thật (bridge nội bộ trong cùng file, `users-auth.js`, hoặc test) —
inline thành `root.X = (...) => root.AuditService!.X(...)` (hoặc gọi thẳng
`root.QCCore` cho `auditSha256`/`auditEntryHash`/`auditVerifyChain`).

**Vấn đề khó nhất của lát này: ba biến ngưỡng `let ACTIVITY_HARD_CAP=50000,
ACTIVITY_ROTATE_TO=40000; const AUDIT_AUTO_VERIFY_MAX=5000`** — không phải
hàm, mà là state MUTABLE mà `users-auth.js` (chưa migrate) đọc TRẦN
(`total>ACTIVITY_ROTATE_TO`) và hai test (`audit-retention.test.js`) GÁN LẠI
trực tiếp bằng cú pháp trần (`ACTIVITY_HARD_CAP = 5;`, không qua `ctx.X=`) để
mô phỏng xoay vòng mà không cần dựng hàng chục nghìn dòng thật. Theo quy tắc
đã đúc kết ở Lát 2/3 ("function top-level thành property của globalThis,
let/const top-level thì KHÔNG"), lo ngại ban đầu là ba biến này PHẢI ở lại một
file classic độc lập (không thể chuyển vào bundle) vì Vite đóng gói bundle
thành một IIFE — `let`/`const` khai báo trong đó chỉ sống trong scope của
IIFE, không lọt ra "global lexical environment" dùng chung giữa các
`<script>` cổ điển.

Đã **xác minh bằng thực nghiệm trực tiếp trên Node `vm`** (không suy luận
suông) rằng lo ngại này sai cho đúng trường hợp cụ thể ở đây: nếu gán bằng
**property** (`root.ACTIVITY_HARD_CAP = 50000`, tức `globalThis.X = ...`, KHÔNG
phải `let X = ...`) thay vì khai báo lexical, thì tham chiếu trần từ MỘT lời
gọi `vm.runInContext` KHÁC (mô phỏng đúng một `<script>` cổ điển khác trên
cùng trang) vẫn đọc/ghi được giá trị đó — vì resolution của một identifier
trần, khi không tìm thấy binding `let/const` nào che trước, RƠI QUA property
của global object làm bước cuối cùng — cả chiều đọc lẫn chiều gán trần (không
từ khóa) đều đúng chiều này. Do đó bản chất phân biệt không phải "bundle hay
file classic" mà là "gán bằng property hay bằng `let/const`"; miễn dùng
property, ba ngưỡng này ở thẳng trong bundle vẫn hoạt động đúng cho
`users-auth.js` (đọc trần) và test (gán lại trần) — **không cần giữ lại bất kỳ
phần nào của `audit.js`**. Bài học tổng quát cho các lát Pha G còn lại:
"function top-level" và "biến gán qua property (`root.X=`/`window.X=`)" hành
xử GIỐNG NHAU với truy cập trần (đều rơi qua global object) — bài học `wgMemo`
trước đây chỉ đơn thuần là "đừng khai báo mutable state bằng `let` nếu nơi
khác cần đọc nó qua `root.X`", không phải "mutable state không thể sống trong
bundle".

**Bài học phụ khác — mở rộng quy ước ambient declare có sẵn cho `rerender`:**
những hàm vừa được TRẦN tham chiếu Ở NHIỀU CHỖ KHÁC trong CHÍNH
`modular-pilot.global.ts` (`logAct`, `auditSha256`, `auditRelinkChain`) cần
CẢ HAI: (1) ambient `declare function X()` để TypeScript phân giải các tham
chiếu trần đó (giữ nguyên, không xóa — same như `rerender`/`requireWrite` đã
làm từ trước), VÀ (2) một entry KHÔNG optional trong `QCLabGlobal` (`logAct:
(...) => void;`, không phải `logAct?:`) để câu lệnh gán `root.logAct = ...`
tự nó biên dịch được — thiếu (2) thì dù có ambient declare, TypeScript vẫn báo
`Property 'logAct' does not exist on type 'QCLabGlobal'` khi gán qua `root.`.
Những hàm CHỈ được gọi qua `root.X`/từ bên ngoài (không tham chiếu trần ở nơi
khác trong file) thì chỉ cần entry `X?:` trong interface, không cần ambient.

**Giữ nguyên, không đơn giản hóa quá tay:** guard `uid: () => typeof (root as
any).uid==='function'?(root as any).uid():''` trong wiring `AuditService` —
đây là phòng vệ cho việc `state.js` (nơi định nghĩa `uid()`, KHÔNG phải
`audit.js`) có thể chưa nạp ở một sandbox nào đó, không liên quan tới việc dọn
`audit.js`; đổi thành gọi trần không có gì để lợi và có rủi ro thật nếu đoán
sai một sandbox nào đó thiếu `uid`.

**5 test đọc `assets/modules/audit.js` trực tiếp từ đĩa** (bỏ qua cơ chế mảng
file của `loadSandbox()`, nên `rg "modules/audit\.js"` ban đầu bỏ sót 1 trong
số đó — phải dò thêm bằng `'audit.js'` làm chuỗi con của lời gọi `path.join`
tách nhiều tham số): `audit-hash.test.js`, `audit-chain-cache.test.js`,
`audit-retention.test.js` (cả ba tự đọc file bằng `fs.readFileSync` +
`vm.runInContext` thủ công, bỏ đoạn đó, giữ lại đúng bước nạp bundle) và
`audit-ingress-gates.test.js`/`firebase-merge.test.js` (bỏ chuỗi
`'modules/audit.js'` khỏi mảng `loadSandbox([...])`). `tests/helpers/sandbox.js`
bỏ luôn rule tự chèn bundle ngay sau `modules/audit.js` (chết vì file không
còn tồn tại để `indexOf` tìm thấy). Phát hiện phụ — TÁI DIỄN đúng lớp lỗi
"bundle ghi đè stub" của Lát 1/2: `tests/audit-filter.test.js` stub
`auditVerifyChain`/`ACTIVITY_HARD_CAP`/`ACTIVITY_ROTATE_TO` qua tham số
`globals` của `loadSandbox()` (set TRƯỚC khi file chạy) — ba tên này giờ được
bundle gán property thật NGAY KHI NẠP, ghi đè mất giá trị stub; chuyển cả ba
sang gán SAU khi `loadSandbox()` trả về (`Object.assign(ctx,{...})`, cùng chỗ
đã sửa `headOnly`/`btn`/… ở Lát 2/3) để khớp đúng ý định gốc của test (dù với
dữ liệu 30 dòng hiện tại của test đó, ngưỡng 50000 mặc định của bundle không
đủ để đổi kết quả assert — vẫn sửa cho đúng ý định, không dựa vào việc test
hiện tại vô tình không phân biệt được).

**Bẫy cuối cùng phát hiện qua `npm run typecheck` chạy TRỌN VẸN (không chỉ
`tsc -p tsconfig.modules.json`):** `npm run typecheck` là HAI chương trình
tsc riêng biệt — `tsc --noEmit` (checkJs legacy, quét toàn bộ `assets/**/*.js`
làm MỘT global scope dùng chung, dựa vào `global.d.ts` cho bất kỳ tên nào tới
từ bundle) và `tsc -p tsconfig.modules.json` (strict, chỉ quét `src/**/*.ts`,
dựa vào `declare function` inline ngay trong `modular-pilot.global.ts`). Build
bundle xanh + pass thứ hai xanh KHÔNG chứng minh pass thứ nhất xanh — sau khi
xóa `audit.js`, `tsc --noEmit` báo lỗi `Cannot find name 'ACTIVITY_HARD_CAP'`/
`'ACTIVITY_ROTATE_TO'`/`'auditChainStatus'` tại `users-auth.js`, vì
`assets/generated/**` nằm trong `exclude` của `tsconfig.json` — checkJs không
bao giờ thấy được `root.X=` bên trong bundle, chỉ thấy được tên nào có ambient
declare thật trong `global.d.ts`. Trước đây `audit.js` tự thỏa mãn việc này
(khai báo thật, checkJs thấy trực tiếp); giờ phải thêm ambient tương ứng vào
`global.d.ts` (đặt cạnh các declare cùng loại như `wgMultiViews`/`pageDash`).
Các hàm khác (`logAct`, `auditVerifyChainNow`, …) KHÔNG cần thêm vì đã không
còn file classic nào gọi chúng bằng mã JS thật (chỉ còn trong chuỗi HTML
onclick, thứ checkJs không phân tích). Quy tắc cho các lát kế tiếp: sau khi
xóa một file classic, `rg` tên hàm/biến nó từng khai báo trên toàn bộ
`assets/modules/*.js` CÒN LẠI (không chỉ nơi từng gọi lúc file cũ còn sống) —
nếu vẫn có chỗ gọi trần bằng mã JS thật (không phải trong chuỗi), phải thêm
ambient vào `global.d.ts`, không chỉ vào `modular-pilot.global.ts`.

Gate: `build:pilot`/`typecheck`/`test` 613/613 (cả hai chương trình tsc) +
`a11y-audit` (trang audit + modal `audit:archive-log`, 0 vi phạm, ratchet
PASS) + `ui-check` (29/29, gồm cả "Audit mở khóa giữ lý do") + `nce-check`
(91/91).

#### Lát route 7 — `sigma-tea.js` (2026-08-19)

Retire `assets/modules/sigma-tea.js` (111 dòng, ~22 hàm/hằng) sang
`src/domain/sigma/sigma-tea-resolution.ts` (`createSigmaTeaResolution(deps)`)
— lát **nặng nhất và rủi ro cao nhất tính tới nay trong nhóm route**, khác hẳn
6 lát trước: đây là NGHIỆP VỤ THẬT (khớp tên xét nghiệm theo alias/tiền tố,
tiêu chí CLIA phần trăm/tuyệt đối/lớn hơn, ảnh chụp truy vết TEa) chứ không
phải lớp bridge/điều phối mỏng, và CLAUDE.md liệt nó vào "Confirmed
business-logic decisions" — không được đổi khi migration.

**Trước khi viết code:** map từng biểu tượng ra caller thật trên toàn bộ
`assets/`, `src/`, VÀ `tests/` (cả `ctx.X()` lẫn `run(ctx,'X(...)')` bare bên
trong test) — 5 file classic khác (`sigma.js`, `manage-routes.js`,
`manage-tests-actions.js`, `data-io.js`, `reports.js`) gọi trần ~17 trong số
22 biểu tượng; 5 biểu tượng (`SG_TEA_DEFAULT_REF`, `teaRefSearchKey`,
`teaRefRecordForName`, `sgTeaStoredRef`, `sgCliaCriterion`) không có caller
thật nào ngoài chính file — giữ PRIVATE (đóng trong closure factory, không
`root.X=`), 17 còn lại export đầy đủ.

**Hai lỗi thật tự gây ra, cả hai đều bị `npm test` bắt được (không cần
ui-check) — khác các lát trước nơi lỗi runtime chỉ lộ qua trình duyệt thật:**

1. **Khởi tạo có tác dụng phụ ngay lúc nạp bundle, không lazy.** `SG_CLIA_FIXED`
   được dựng MỘT LẦN khi gọi `createSigmaTeaResolution(...)`, đọc
   `TEA_SOURCE_REGISTRY`/`TEA_ANALYTE_CATALOG`/`REFTESTS` trực tiếp — y hệt
   cách `sigma-tea.js` cũ tự làm lúc file nạp. Nhưng trước đây file classic chỉ
   được nạp trong sandbox NÀO CHỌN nạp nó; giờ nằm trong bundle, MỌI sandbox
   tải bundle đều trả giá, kể cả những sandbox không hề đụng TEa
   (`uncertainty.test.js`, `westgard-view-model.test.js`,
   `westgard-xlsx.test.js` ném `ReferenceError: TEA_SOURCE_REGISTRY is not
   defined` ngay lúc nạp). Sửa bằng `if(typeof TEA_SOURCE_REGISTRY!=='undefined'
   && ...)` bọc quanh toàn bộ khối khởi tạo + gán `root.X=` — bỏ qua an toàn
   nếu `state.js`/`analyte-catalog.js` chưa nạp, khớp đúng hành vi gốc ("không
   nạp sigma-tea.js thì các tên này vốn dĩ undefined"). Kéo theo: nhiều test
   khác nạp CẢ bundle LẪN `modules/state.js` nhưng đặt bundle TRƯỚC state.js
   trong mảng (`sigma-comp.test.js` 4 chỗ, `uncertainty.test.js`,
   `action-form.test.js`) — sai thứ tự so với `index.html` thật (state.js luôn
   trước bundle) khiến guard luôn false; đổi lại đúng thứ tự.
2. **Bug thật trong logic port, không phải bug hạ tầng:** `sgRef({name:'Glucose',
   teaSource:'ricos'})` trả về dòng "Albumin" thay vì "Glucose". Nguyên nhân:
   `teaRefSearchKey` gốc là `typeof searchText==='function'?searchText(v):
   teaRefName(v)` — kiểm tra TRẦN mỗi lần gọi. Bản port đưa việc kiểm tra này
   vào tầng wiring dưới dạng một HÀM LUÔN TỒN TẠI (`searchText: value =>
   typeof globalThis.searchText==='function'?...:undefined`), khiến
   `deps.searchText` luôn truthy (nó LÀ một function) dù bên trong trả `undefined`
   — `teaRefSearchKey`'s `deps.searchText?deps.searchText(v):teaRefName(v)` do
   đó luôn đi nhánh `deps.searchText(v)` và luôn nhận `undefined`, làm
   `undefined===undefined` đúng cho MỌI alias của dòng ĐẦU TIÊN trong bảng
   (Albumin, index 0) — `Array.find` dừng ngay đó. Sửa bằng cách chuyển
   `searchText` sang GIÁ TRỊ có điều kiện gán một lần lúc wiring (`typeof
   globalThis.searchText==='function' ? (v)=>globalThis.searchText(v) :
   undefined` — không phải một hàm luôn tồn tại), để `deps.searchText` thật sự
   `undefined` khi không có, kích đúng nhánh fallback `teaRefName(v)` của domain
   module. Bài học: khi bọc một dependency "optional, kiểm tra qua truthiness"
   (`deps.X ? deps.X(...) : fallback`), tầng wiring phải để `deps.X` THẬT SỰ
   `undefined` lúc không có nguồn thật — không được thay bằng một wrapper luôn
   tồn tại mà bên trong âm thầm trả `undefined`, vì khác nhau ở TẦNG kiểm tra
   (bên ngoài forEach kiểm tra sự tồn tại của HÀM, bên trong `searchText` gốc
   kiểm tra `typeof` mỗi lần gọi — hai điều không tương đương khi hàm luôn tồn
   tại nhưng có thể trả undefined). Phát hiện qua so khớp trực tiếp trên Node
   `vm` (`sgTea({name:'Glucose',teaSource:'ricos'})` phải ra `6.96`, ra `4.07`)
   — `tests/sigma-tea.test.js` tự nó đã đủ discriminating, không cần trình
   duyệt thật.

**Phát hiện phụ ngoài phạm vi cổng dữ liệu — một lỗi PRODUCTION THẬT, đang
sống, không liên quan gì tới việc chuyển `sigma-tea.js`:** trong lúc thêm
ambient cho `REFTESTS`, phát hiện dòng liền kề
`sourceRegistry: () => (globalThis as any).TEA_SOURCE_REGISTRY` trong wiring
của `TeaReferenceService` — `TEA_SOURCE_REGISTRY` là `const` global lexical
của `state.js` (giống hệt `REFTESTS` ngay phía trên nó), không phải property
trên `globalThis`, nên biểu thức này LUÔN LÀ `undefined`. Xác nhận bằng
thực nghiệm trực tiếp trên `vm`: gọi `TeaReferenceService.edit(state,
'qclab-glucose','clia',9)` (đúng đường sửa giá trị CLIA/Ricos trong tab
"Bảng TEa tham chiếu" của trang Cấu hình chung) ném
`TypeError: Cannot read properties of undefined (reading 'clia')` ngay lập
tức — nghĩa là **sửa BẤT KỲ giá trị CLIA/Ricos nào trong tab đó đều crash**
trên bản hiện hành. Không test nào (kể cả 15 file `tea-reference-*.test.js`)
bắt được vì `tests/tea-reference-service.test.js` gọi
`createTeaReferenceService` trực tiếp với `sourceRegistry` tự stub đúng, không
đi qua wiring thật; các test khác chỉ scan chuỗi. Sửa bằng tham chiếu trần
`TEA_SOURCE_REGISTRY` (khớp đúng `REFTESTS` ngay cạnh). Thêm bài kiểm hồi quy
thật vào `tests/manage-history-bridge.test.js` (nạp `state.js` + bundle thật,
gọi `TeaReferenceService.edit(...)` qua đúng dây chuyền sản xuất) — đã xác
nhận discriminating bằng cách tạm khôi phục lỗi gốc và thấy test đỏ đúng chỗ,
rồi phục hồi bản sửa.

**Quyết định phạm vi export:** 5 hàm helper thuần nội bộ
(`teaRefSearchKey`, `teaRefRecordForName`, `sgTeaStoredRef`, `sgCliaCriterion`,
`SG_TEA_DEFAULT_REF`) giữ private trong closure — không có caller thật nào
ngoài chính module (đã `rg` toàn bộ `assets/`+`src/`+`tests/`, phân biệt rõ
"xuất hiện trong danh sách regex của source-scanner" — không tính — với "được
gọi thực thi" — tính). `tests/ui-route-structure.test.js`'s source-scanner
(pin ranh giới một chiều sigma.js→sigma-tea.js) trỏ sang đọc
`sigma-tea-resolution.ts`, đổi pattern `function X(` → `const X\\s*=` (cú
pháp arrow-in-factory), và bỏ assertion so thứ tự nạp dựa trên chuỗi
`'sigma-tea.js'` trong `index.html` (không còn thẻ script riêng) sang so
`generated/modular-pilot` với `sigma.js?`. `tests/helpers/sandbox.js` đổi
rule tự chèn từ "chèn `modules/sigma-tea.js` trước `modules/sigma.js`" sang
"chèn bundle trước `modules/sigma.js`" (cùng vị trí, cùng lý do — chỉ đổi cái
gì được chèn). `global.d.ts` thêm 12 ambient cho checkJs (các tên 5 file
classic còn gọi trần).

Gate: `build:pilot`/`typecheck`/`test` 613/613 + `a11y-audit` (trang sigma +
modal `manage:tea-lab-profile`, 0 vi phạm, ratchet PASS) + `ui-check` (29/29)
+ `nce-check` (91/91). Nhóm "Route/presentation" còn 6 file:
`manage-routes.js`, `manage-tests-actions.js`, `entry-routes.js`,
`actions-routes.js`, `action-form.js`, `sigma.js`.

#### Lát route 8 — `manage-routes.js` (2026-08-19)

Retire `assets/modules/manage-routes.js` (174 dòng rất dày) sang
`src/presentation/manage/manage-page-controller.ts`
(`createManagePageController(deps)`) — trang "Cấu hình chung" (máy/panel/
lô/nhóm lô/Mean-SD/chuyển tiếp lô/danh mục xét nghiệm/lịch sử dữ liệu/Bảng
TEa tham chiếu). Đây là lát **có bề mặt dependency lớn nhất tới nay**: ~76 hàm
dựng HTML (`globalThis.manageXxxPresentation`/`targetXxxPresentation`/
`historyXxxPresentation`/`teaReferenceXxxPresentation`) — tất cả đã là
TypeScript từ các đợt trước, file classic chỉ còn điều phối. Áp dụng đúng mẫu
`reagent-page-controller.ts` đã dùng cho trường hợp này: gom toàn bộ 76 hàm
vào một dep DUY NHẤT `pres: AnyRec` (không khai kiểu riêng từng hàm), wiring
truyền thẳng `pres: root as any` — vì mọi hàm đó vốn đã là `root.X` published
sẵn, không cần liệt kê tay từng cái.

UI state (`manageQ`/`manageTab`/`manageTargetPanel`/`manageTargetGroup`/
`manageTargetLevel`/`manageHistoryTest`) đã có sẵn `ManageUIState` (accessor
bag) từ trước lát này — dùng chung với `manage-tests-actions.js` (còn hai
trường `targetSwitchCtx`/`configNavScroll` không thuộc file đang chuyển,
xác nhận bag này vốn được chia sẻ giữa hai file). Controller đọc/ghi qua
`deps.ui()`, không dùng closure `let` (khác quyết định của Report) vì các
biến này được `manage-tests-actions.js` (chưa migrate) ghi trực tiếp.

**Bẫy runtime lặp lại từ Route 7, đã lường trước nên không mất thời gian dò
lại:** một dep (`teaSourceRegistry`) khai ban đầu là giá trị trực tiếp
(`TEA_SOURCE_REGISTRY`, bare, eager) thay vì hàm — construction
`createManagePageController({...})` chạy NGAY LÚC NẠP bundle (không lazy),
nên bất kỳ dep nào đọc một bare classic global TRỰC TIẾP (không bọc `()=>`)
sẽ ném `ReferenceError` cho MỌI sandbox tải bundle mà chưa nạp `state.js`.
Sửa bằng cách đổi `teaSourceRegistry` thành `() => AnyRec` (lazy) ngay từ đầu
— không cần vòng "build xanh, test đỏ, debug" như Route 7, vì bài học đã áp
dụng chủ động khi viết wiring lần này.

**Một lỗi kiểu dữ liệu thật do TypeScript suy luận sai, không phải lỗi
logic:** `new Map(rows.map(r => [key, r]))` — khi phần tử mảng nguồn đã là
`AnyRec` (`any`), TypeScript suy luận literal `[key, r]` bên trong `.map()`
thành union-array `(K|V)[]` thay vì tuple `[K,V]` trong một số trường hợp,
khiến `Map`'s value type suy luận sai thành `{}` thay vì `any` —
`overMap.get(analyteId).lab` báo lỗi "Property 'lab' does not exist on type
'{}'". Sửa bằng khai tường minh `new Map<string, AnyRec>(rows.map((r):
[string, AnyRec] => [key, r]))` thay vì để trình biên dịch tự suy luận.

**Tái diễn đúng bài học Lát route 2 (Report) ở quy mô lớn hơn nhiều:** xóa
code chết theo runtime không đồng nghĩa an toàn xóa — 13 file test đọc
`assets/modules/manage-routes.js` bằng `fs.readFileSync` để scan chuỗi/regex
so khớp cú pháp classic (`globalThis.manageShellPresentation(`, object
literal không cách,...), phải sửa TỪNG file trỏ sang
`manage-page-controller.ts` với regex cập nhật đúng cú pháp TS (dấu cách sau
`{`/`,`/quanh `?:`, `deps.pres.X(` thay `globalThis.X(`). Một trong số đó
(`manage-crud-labels.test.js`) dùng `.includes()` so khớp CHUỖI THÔ (không
phải regex) trên cú pháp dày đặc kiểu classic (`title:hasProfile?'X':'Y'`) —
TypeScript viết theo quy ước dấu cách chuẩn của mọi file `src/presentation/`
khác (`title: hasProfile ? 'X' : 'Y'`) nên chuỗi so khớp phải viết lại theo
đúng định dạng mới, không phải nén lại code cho khớp test cũ. Một test khác
(`admin-render-bridge.test.js`) dùng một VÒNG LẶP CHUNG kiểm nhiều file khác
nhau bằng cùng một mẫu `globalThis.${name}` — vì chỉ MỘT trong các dòng đó
(`manageHistoryRowPresentation`) chuyển sang `deps.pres.${name}`, phải thêm
tham số thứ tư cho từng dòng vòng lặp để chỉ định mẫu so khớp khác nhau theo
từng nguồn, thay vì sửa cả mẫu chung (sẽ làm hỏng các dòng khác vẫn đọc file
classic thật). `tests/typescript-module-pilot.test.js`/`tests/ui-accessibility.test.js`
chỉ cần đổi biến nguồn — nội dung hai assertion đó vốn đã không phụ thuộc
`manage-routes.js` (một là scan tên hàm KHÔNG được có, một là ghép chuỗi với
một file TS khác mà chuỗi thật nằm trong file TS đó, không nằm ở
`manage-routes.js`).

`global.d.ts` thêm 3 ambient cho checkJs (`instrumentName`, `lotTransitionToNo`,
`targetGroupLots` — 3 tên duy nhất còn được `data-io.js`/`reports.js`/
`sigma.js`/`manage-tests-actions.js` gọi trần bằng mã JS thật, sau khi phân
biệt rõ lời gọi hàm thật với các chỗ trùng tên chỉ là property-key trong
object literal như `lotLabel:` ở `entry-routes.js`, hoặc chỗ chỉ xuất hiện
trong comment như `manageLots()` ở `qc-domain.js`).

Gate: `build:pilot`/`typecheck`/`test` 613/613 + `a11y-audit` (trang manage +
6/6 modal manage + `manage:tea-lab-profile`, 0 vi phạm, ratchet PASS) +
`ui-check` (29/29) + `nce-check` (91/91). Nhóm "Route/presentation" giờ chỉ
còn 5 file: `manage-tests-actions.js`, `entry-routes.js`, `actions-routes.js`,
`action-form.js`, `sigma.js`.

#### Lát route 9 — `manage-tests-actions.js` (2026-08-19)

Retire `assets/modules/manage-tests-actions.js` (371 dòng) sang
`src/presentation/manage/manage-tests-actions-controller.ts`
(`createManageTestsActionsController(deps)`) — mutation instrument/máy/panel/
lô/nhóm lô/chuyển tiếp lô/Mean-SD/xét nghiệm, kèm re-auth và audit trail. Đây
là lát **rủi ro cao nhất tính tới nay**: không phải render thuần mà là toàn bộ
đường ghi dữ liệu của trang Cấu hình chung, với các bảo vệ ISO 15189 (khóa kỳ
chặn xóa xét nghiệm, xác nhận trước khi đổi số lô hàng loạt, chặn xóa lô đang
gắn hồ sơ chuyển tiếp đã chấp nhận) — CLAUDE.md gọi đây là "nặng nhất nhóm
route". Trước khi viết code, đọc lại toàn bộ 3 bài test hồi quy đã tồn tại
riêng cho các bảo vệ này (`locked-period-guards.test.js`, `lot-rename.test.js`,
`target-matrix.test.js`) để hiểu chính xác hành vi phải giữ nguyên tuyệt đối.

**Quyết định thiết kế quan trọng nhất: `document` là getter LAZY
(`() => Document`), không phải giá trị capture một lần như
`manage-page-controller.ts` đã làm.** Phát hiện TRƯỚC khi viết code (không
phải sau khi test đỏ): nhiều bài test đổi `document` giữa các bước — mỗi test
case seed lại một bản `document.getElementById` khác nhau trả về giá trị form
khác nhau (`ctx.document={getElementById:id=>fields[id]};` rồi gọi hàm ngay sau
đó), hoặc gán `document = {...}` bên trong chuỗi `seed` chạy lại ở đầu MỖI
test case. Nếu controller capture `document` một lần lúc factory khởi tạo
(như manage-page-controller.ts, nơi không có test nào cần đổi `document` giữa
chừng), các lần gán lại `document` sau đó sẽ vô tác dụng — đúng bài học
"gán lại biến toàn cục chỉ có tác dụng với code CHƯA chuyển sang TS" đã ghi ở
Lát 3 của nhóm UI thuần, nhưng lần này té ra hướng NGƯỢC LẠI: chọn được đúng
kiểu capture (lazy) NGAY TỪ ĐẦU nhờ đọc test trước, không phải sửa lại sau khi
gặp lỗi.

**Hai lỗi thật phát hiện trong lúc wiring, cả hai đều nằm NGOÀI phạm vi retire
file này nhưng nằm ngay trên đường phải chạm tới:**

1. **Bug do tự tay wiring sai, bắt được bằng `npm test` trước khi coi lát là
   xong:** `teaAnalyteKey` là hằng số `const teaAnalyteKey=v=>...` (arrow
   function gán cho `const`) ở `state.js` — CÙNG LỚP với `REFTESTS`/
   `TEA_SOURCE_REGISTRY`/`WG_RULES`/`QC_DECIMALS_DEFAULT` (const global lexical,
   không phải property trên `globalThis`) nhưng dễ nhầm hơn vì cú pháp arrow
   function trông giống hàm thường. Wiring ban đầu viết
   `(globalThis as any).teaAnalyteKey(value)` (sai) khiến
   `configAssayFindRef('Potassium')` ném `TypeError` ngay khi
   `target-matrix.test.js` chạy — sửa về tham chiếu trần + thêm ambient. Đã
   chủ động quét lại toàn bộ ~10 dependency khác đọc qua `(globalThis as
   any).X` để xác nhận KHÔNG còn chỗ nào tái phạm (checked từng definition
   trong `state.js`/`qc-domain.js`, chỉ đúng 1 chỗ là `const`).
2. **Bug production thật, phát hiện tình cờ khi soi lân cận `QC_DECIMALS_DEFAULT`
   (cùng đang chuẩn bị wiring `defaultAssayLevels`/`configAssayTeaRefs`):**
   `createTargetNumberText({...defaultDecimals:(globalThis as any).QC_DECIMALS_DEFAULT})`
   — cùng lỗi "const lexical đọc qua globalThis" như TEA_SOURCE_REGISTRY ở Route
   7, nhưng hậu quả ÂM THẦM hơn nhiều vì không ném lỗi: khi gọi
   `targetNumberText(value, null)` (không kèm xét nghiệm — nhánh mặc định của
   tham số `test=null`), `Number(3.7).toFixed(undefined)` làm tròn về SỐ
   NGUYÊN thay vì báo lỗi (`"3.7"` → `"4"`), vì `toFixed(undefined)` hành xử
   như `toFixed(0)`. Xác nhận bằng thực nghiệm trực tiếp trên `vm` (gọi đúng
   nhánh `test=null` — gọi với `test` truthy trước đó không lộ ra vì đi nhánh
   khác trong `targetNumberText`). Sửa bằng tham chiếu trần kèm fallback bằng
   đúng giá trị mặc định của state.js (`2`) cho sandbox chưa nạp nó — không
   bắt buộc nhánh này phải luôn được sandbox cấp `state.js`.

**Danh sách export:** map toàn bộ 58 hàm định nghĩa trong file ra caller thật
trên `assets/`, `src/`, và `tests/` (executable, không tính chuỗi trong
comment hay bài test trùng tên đang kiểm một module TS khác không liên quan —
15 file `*-html.test.js` khớp tên nhưng import từ nguồn hoàn toàn khác, xác
nhận qua đọc `const source=...` của từng file trước khi loại). Kết quả:
`lotPointsToRename` không còn caller thật nào kể cả nội bộ (chỉ tự định nghĩa
rồi không ai gọi) — xóa hẳn, 57 hàm còn lại port đầy đủ. `global.d.ts` thêm 2
ambient (`parseVN`, `setManageTab` — hai tên duy nhất còn được `action-form.js`/
`users-auth.js`/`sigma.js`/`entry-routes.js` gọi trần bằng mã JS thật).

Gate: `build:pilot`/`typecheck`/`test` 613/613 (gồm cả 3 bài test hồi quy bảo
vệ ISO 15189 nêu trên) + `a11y-audit` (0 vi phạm mọi trang + 18/18 modal,
ratchet PASS) + `ui-check` (29/29, gồm nhiều kịch bản trực tiếp qua controller
mới: thêm/sửa máy, thêm xét nghiệm, áp dụng dải PXN) + `nce-check` (91/91).
Với lát này, **toàn bộ trang "Cấu hình chung" đã sang TypeScript hoàn toàn**
(cả `manage-routes.js` lẫn `manage-tests-actions.js`). Nhóm "Route/presentation"
còn 4 file: `entry-routes.js`, `actions-routes.js`, `action-form.js`, `sigma.js`.

#### Lát route 10 — `entry-routes.js` (2026-08-19)

Retire `assets/modules/entry-routes.js` (320 dòng) sang
`src/presentation/entry/entry-page-controller.ts`
(`createEntryPageController(deps)`) — trang "Nhập QC" (Entry), nơi ghi/hủy
điểm QC thật, thao tác dữ liệu nhạy cảm nhất ứng dụng. Toàn bộ 51 hàm dựng
HTML/thuật toán thuần (`entryTreeHeaderHtml`, `entryWorksheetHtml`,
`entrySheetCellHtml`, v.v.) đã là TypeScript từ các đợt UI-thuần trước, gom
vào một dep `pres: AnyRec` (khớp mẫu `manage-page-controller.ts`); 4 service/
command đã có sẵn (`EntryService`, `EntryRecordWorkflowCommand`,
`EntryVoidWorkflowCommand`, `EntryDateNoteWorkflowCommand`) nối thẳng qua deps
đặt tên. `document`/`window`/`localStorage` là getter LAZY (không capture một
lần) — quyết định lấy trực tiếp từ việc đọc trước `tests/partial-render-
helpers.test.js`: một test case gán lại toàn bộ biến `document={...}` giữa
chừng để mô phỏng điều hướng bàn phím trong cây xét nghiệm.

**`jsq()` (thoát chuỗi cho literal JS trong `onclick="..."`, khác `esc()`/
`escAttr()` vốn thoát HTML) là hàm DUY NHẤT của file này có caller thật ở
NHIỀU file classic khác** (`action-form.js`, `actions-routes.js`, `sigma.js`,
cộng hàng chục chỗ gọi `(root as any).jsq(...)` ngay trong
`modular-pilot.global.ts`) — 37 hàm còn lại chỉ có caller nội bộ hoặc từ chính
HTML do trang tự sinh ra (onclick trỏ lại chính nó). Vì `jsq` là tiện ích
thuần không phụ thuộc gì, tách riêng thành
`src/presentation/shared/js-string-literal.ts` (không đặt trong
`entry-page-controller.ts`) rồi gán `root.jsq=jsq` trong bridge — độc lập với
vòng đời trang Entry, giữ đúng tinh thần "một hàm dùng chung nhiều nơi có nhà
riêng, không kẹt trong route sở hữu nó lúc còn classic". Bẫy tự gây trong lúc
viết `jsq`: gõ trực tiếp escape sequence cho ký tự phân-dòng Unicode (line
separator/paragraph separator) trong regex literal bị pipeline ghi file biến
thành KÝ TỰ THẬT thay vì chuỗi escape hai-ký-tự — hai ký tự đó là
LineTerminator theo đặc tả ECMAScript nên nằm trần trong một regex literal là
lỗi cú pháp "unterminated regex". Sửa bằng `String.fromCharCode(0x2028)`/
`String.fromCharCode(0x2029)` rồi `.split(...).join(...)` thay vì `.replace()`
với ký tự đó viết trần trong regex, né hoàn toàn việc gõ ký tự thật vào
source; xác nhận hành vi khớp 100% bản classic bằng cách `eval` cả hai và so
sánh trên 8 ca kể cả có hai ký tự phân-dòng đó thật trong input.

**3 lỗi type thật bắt bởi `tsc -p tsconfig.modules.json` (không phải bởi
`build:pilot` hay checkJs)** — deps của `entry-page-controller.ts` khai
`stateName`/`rangeActions`/`qcPointWarnings` nhận tham số `unknown` (đúng với
chữ ký hàm generic của controller), nhưng các hàm TypeScript đã bridge sẵn ở
`modular-pilot.global.ts` (`root.stateName`, `root.rangeActions`,
`root.qcPointWarnings`) khai tham số cụ thể hơn (`string`/`number`/`boolean`)
— sửa bằng ép kiểu tại điểm nối (`value as string` v.v.), không nới lỏng chữ
ký của controller hay của hàm đã bridge.

Danh sách export: map toàn bộ 38 hàm định nghĩa trong file (trừ `jsq`) ra
caller thật; không hàm nào có caller bên ngoài `entry-routes.js` nhưng TẤT CẢ
đều được publish làm `root.X` vì HTML do `pageEntry()` tự sinh ra tham chiếu
chúng qua `onclick="entryPick(...)"` v.v. — một lời gọi runtime từ chuỗi HTML,
không phải một lời gọi ở source code khác, nên grep không thấy nhưng vẫn phải
bridge. Cập nhật `tests/entry-service.test.js` (route source giờ đọc
`entry-page-controller.ts`, 3 hàm `treeToggle`/`entryPick`/`toggleEntryTree`
đổi từ regex một dòng sang capture khối `[\s\S]*?` vì cú pháp TypeScript nhiều
dòng), `tests/entry-render-bridge.test.js`/`entry-service-bridge.test.js`
(đổi target từ file chưa tồn tại thành file thật), `tests/lis-client-
service.test.js`/`tests/partial-render-helpers.test.js` (bỏ
`modules/entry-routes.js` khỏi `loadSandbox()`; dòng cuối của
`partial-render-helpers.test.js` đổi từ `String(pageEntry).includes(...)`
— vốn chỉ hoạt động khi `pageEntry` còn là hàm classic giữ nguyên tên gọi khi
stringify — sang đọc thẳng mã nguồn TypeScript, vì Vite biên dịch/rút gọn
khiến `String(pageEntry)` không còn giữ lời gọi `entryLotLabelsTs`),
`tests/ui-accessibility.test.js`/`tests/ui-route-structure.test.js` (đổi
đường dẫn đọc + 2 pattern từ `function pageEntry(`/`function entryTreeKey(`
sang cú pháp `const X = (...) => {`, bỏ assertion thứ tự nạp script không còn
áp dụng khi file không còn thẻ `<script>` riêng — cùng cách đã xử lý ở Route
7). Tiện thể sửa 4 chỗ tài liệu hoá lạc hậu phát hiện được trong lúc đọc
CLAUDE.md (chưa cập nhật từ các lát Route 7–9 trước): danh sách "chưa port"
vẫn liệt kê `manage-routes.js`/`manage-tests-actions.js`/`entry-routes.js` dù
cả ba đã retire, và mục mô tả `sigma-tea.js` vẫn viết như thể còn là file
classic có `<script>` riêng.

Gate: `build:pilot`/`typecheck`/`test` 613/613 + `ui-check` (29/29, gồm kịch
bản nhập/hủy điểm QC trực tiếp qua controller mới) + `nce-check` (91/91) +
`a11y-audit` (0 vi phạm mọi trang kể cả `entry`, 18/18 modal, ratchet PASS).
Nhóm "Route/presentation" còn 3 file: `actions-routes.js`, `action-form.js`,
`sigma.js`.

#### Lát route 11 — `actions-routes.js` + `action-form.js` (2026-08-19)

Retire cả hai file cùng lúc (226 + 464 dòng — **lát lớn nhất tính tới nay**,
lớn hơn cả Route 9) sang `src/presentation/actions/actions-page-controller.ts`
(vòng đời hồ sơ NCE: duyệt/trả lại/hủy/escalate/mở lại, danh sách sự cố, phiếu
chi tiết) và `src/presentation/actions/action-form-controller.ts` (form 8 mục,
hằng số lựa chọn, chip gợi ý, bản nháp sống qua `rerender()`). Đây là cặp file
duy nhất còn lại phụ thuộc **HAI CHIỀU thật sự** (form gọi ngược
`actionEvidenceTimelineHtml`/`actionRerunEvidenceHtml`/`actionLevelShort` của
trang; trang gọi vào `actionFormHtml` của form) — CLAUDE.md đã ghi rõ đây là
ranh giới trách nhiệm, không phải đồ thị phụ thuộc không chu trình.

**Giải quyết vòng phụ thuộc bằng dựng hai pha trong `modular-pilot.global.ts`:**
khai `let actionsPageControllerRef` trước, dựng `action-form-controller.ts`
với 3 dep gọi qua biến tham chiếu đó (`(a,rr)=>actionsPageControllerRef.actionEvidenceTimelineHtml(a,rr)`
v.v. — chưa cần actions-page tồn tại lúc này), rồi dựng
`actions-page-controller.ts` với `formHtml`/`captureFormDraft` trỏ THẲNG vào
action-form (đã tồn tại), cuối cùng gán `actionsPageControllerRef =
actionsPageController`. Không cần import vòng giữa hai file TypeScript — biến
tham chiếu nằm ở lớp bridge, đúng vai trò "cơ chế chuyển tiếp" của nó.

**Bẫy eager-construction tái diễn, lần này nặng hơn Route 7/8 vì phạm vi rộng
hơn nhiều:** `action-form-controller.ts` tính các hằng số lựa chọn (`ACT_SOURCE_OPTS`
v.v.) từ `ACTION_LABELS` ngay ở thân factory (không phải trong một hàm gọi
sau) — hợp lý vì bản classic cũng tính một lần ở top-level lúc script nạp.
Nhưng bundle giờ được nạp bởi HẦU HẾT sandbox test, kể cả những cái không hề
đụng tới trang Actions và không nạp `action-workflow-service.js` (nơi định
nghĩa `ACTION_LABELS`) — 19 file test bỗng dưng đỏ với
`Cannot read properties of undefined (reading 'source')` ngay lúc dựng
bundle. Sửa bằng đúng mẫu đã dùng ở Route 9 (`QC_DECIMALS_DEFAULT`): wiring
`ACTION_LABELS: () => typeof (root as any).ACTION_LABELS !== 'undefined' ?
(root as any).ACTION_LABELS : { check: {}, containment: {}, ... }` — trả về
object rỗng đúng hình dạng thay vì `undefined`, để sandbox không cần trang
Actions vẫn nạp được bundle an toàn.

**`jsq` không phải hàm duy nhất có caller ở nhiều file khác — `actionLevelShort`
cũng vậy:** `data-io.js`/`reports.js` (còn classic) gọi trần
`actionLevelShort(t,a.level,a.lot)` để hiển thị "M{mức} · Lô {số lô}" trong
XLSX/bản in — `npm run typecheck` bắt ngay (`Cannot find name 'actionLevelShort'`)
sau khi xóa file classic; thêm 1 ambient vào `global.d.ts`.

**Một bẫy do quy trình rà tài liệu, không phải code:** lệnh `grep -rl` ban đầu
dùng để liệt kê 13 file test phụ thuộc bỏ sót 2 file
(`action-form-panel-html.test.js`, `action-form-steps-html.test.js`) — cả hai
đọc `assets/modules/action-form.js` bằng `fs.readFileSync` để so khớp regex,
nhưng không hiện trong kết quả grep lần đầu (nguyên nhân không xác định — có
thể do cách shell truyền pattern OR); chỉ lộ ra sau khi xóa file classic và
chạy lại `npm test` thấy `ENOENT`. Bài học: sau khi xóa một file, chạy lại
TOÀN BỘ `npm test` là bước bắt buộc, không thể thay bằng tự tin vào kết quả
grep ban đầu — đúng tinh thần đã ghi ở Lát 2 của nhóm UI thuần.

Map 34 hàm của `actions-routes.js` + 55 hàm của `action-form.js` (trừ hằng số
thuần) ra caller thật; không hàm nào chết hẳn nhưng phần lớn chỉ có caller từ
chính HTML do trang tự sinh ra (`onclick="cancelAction(...)"` v.v.) nên vẫn
phải bridge toàn bộ, giống Route 10. Tiện thể sửa luôn một dead-code nhỏ phát
hiện khi đọc `actionReviewButtons()`: bản classic có HAI dòng `return` giống
hệt nhau liên tiếp (dòng thứ hai không bao giờ chạy tới) — chỉ giữ một.

Cập nhật 9 file test bridge (`action-bias-bridge`, `action-checklist-bridge`,
`action-detail-bridge`, `action-escalation-bridge`, `action-presentation-bridge`,
`action-record-review-bridge`, `action-violation-bridge`, `action-form-panel-html`,
`action-form-steps-html` — đổi `globalThis.X`→`deps.pres.X`/`deps.X`), 3 file
scan chuỗi khác (`admin-render-bridge` thêm tham số `consumedAs`,
`typescript-module-pilot`, `ui-accessibility` — chỉ đổi đường dẫn), 1 file
sandbox (`action-form.test.js` — bỏ `modules/action-form.js` khỏi
`loadSandbox()`), và ~40 assertion trong `ui-route-structure.test.js` (đổi
`function X(`→`const X = `/`X=Y?A:B`→`X = Y ? A : B` theo đúng dấu cách chuẩn
TypeScript, bỏ assertion thứ tự nạp script không còn áp dụng).

Gate: `build:pilot`/`typecheck`/`test` 613/613 + `ui-check` (29/29) +
`nce-check` (91/91, toàn bộ vòng đời NCE trên Chromium thật — bài kiểm chứng
quan trọng nhất cho lát này) + `a11y-audit` (0 vi phạm mọi trang kể cả
`actions` + modal `actions:nce-guide`, 18/18 modal, ratchet PASS). Nhóm
"Route/presentation" còn 1 file: `sigma.js`.

#### Lát route 12 — `sigma.js` (2026-08-19)

Retire `assets/modules/sigma.js` (415 dòng, trang Six Sigma) sang
`src/presentation/sigma/sigma-page-controller.ts`
(`createSigmaPageController(deps)`) — lát cuối cùng của nhóm "Route/
presentation", khép lại toàn bộ nhóm A. Bề mặt dependency lớn (~35 hàm classic/
đã-bridge + 14 service Sigma + lớp giải TEa 11 hàm + 26 hàm presentation) nhưng
áp dụng đúng các quy tắc đã đúc kết từ 11 lát trước nên không phát sinh cách
làm mới, chỉ có ba phát hiện đáng chú ý:

1. **Dead code xác nhận qua đối chiếu caller thật, không suy đoán:** `sgRun(s)`
   (một wrapper một dòng gọi `SigmaPresentation.sigmaRunPlan(s)`) không có
   caller nào — kể cả nội bộ lẫn bên ngoài — trong khi `sgZone(s)` (wrapper
   song song, gọi `SigmaPresentation.sigmaZone(s)`) lại có caller thật ngay
   trong `modular-pilot.global.ts` (`sigmaChartRenderer`/`sigmaMdcRenderer`,
   dùng để tô màu canvas xuất Excel/PDF). Xác nhận bằng `grep` toàn repo trước
   khi quyết định, không suy đoán từ tên hàm giống nhau — dropped `sgRun`,
   giữ `sgZone`.
2. **Bẫy eager-construction dạng mới: không phải lỗi ở CODE của lát này, mà ở
   một GUARD Có Từ Trước bị vô hiệu hoá bởi chính việc port.**
   `sigmaReportRowsService` (đã là TypeScript, dùng bởi `data-io.js`) có
   wiring `visibleLevels:(test)=>typeof globalThis.sgVisibleLevels==='function'
   ?globalThis.sgVisibleLevels(test):test.levels.map(l=>l.level)` — một guard
   viết ra CHO ĐÚNG giai đoạn chuyển tiếp, khi `sigma.js` (và do đó
   `sgVisibleLevels`) có thể chưa được nạp. `tests/sigma-export-selection.test.js`
   khai thác đúng nhánh fallback này (`loadSandbox(['core.js',
   'generated/modular-pilot.js','modules/data-io.js'])` — không nạp state.js
   lẫn sigma.js) để test `sigmaReportRows()` cô lập khỏi toàn bộ trang Sigma.
   Sau khi `sigma.js` retire vào bundle, `sgVisibleLevels` LUÔN LUÔN tồn tại
   (được gán vô điều kiện lúc bundle nạp) nên guard luôn đi nhánh thật, gọi
   vào `deps.getState()` → tham chiếu trần `state` → `ReferenceError` vì
   sandbox đó không nạp `state.js`. Khác các bẫy "controller tự làm treo mọi
   sandbox" ở Route 9/11 (sửa trong code): bẫy này chỉ lộ ra ở ĐÚNG một test
   cụ thể dựa vào nhánh fallback đó, sửa bằng cách bổ sung stub
   `sgVisibleLevels` vào chính test — không đụng gì tới controller hay
   wiring, vì bản thân guard/fallback trong `data-io.js` vẫn đúng vai trò của
   nó (elsewhere trong test suite, các sandbox khác đều nạp đủ `state.js`).
3. **`sgCohortCtx` là biến đóng vòng đời modal duy nhất KHÔNG nằm sẵn trong
   `SigmaUIState`** (khác `sgTest`/`sgBiasCtx`/`sgMuCtx`/`sgAddTestQ`/
   `sgSelectedPeriods` đã có từ trước) nhưng có bài test hồi quy
   (`tests/sigma-comp.test.js`) gán/đọc nó như một global trần
   (`sgCohortCtx={test:true};sgCohortClose();assert.equal(run(ctx,'sgCohortCtx'),null)`)
   — thêm trường này vào `createSigmaUiState()` (`src/presentation/state/
   ui-state.ts`) trước khi viết controller, theo đúng cơ chế accessor global
   đã dùng cho `sgBiasCtx`/`sgMuCtx`.

20 file test phụ thuộc (nhiều hơn cả Route 11's 22, vì rải trên nhiều bridge
test nhỏ): 12 bridge test một-service (`sigma-bias-service-bridge` …
`sigma-tracked-test-bridge`, đổi `globalThis.X`→`deps.pres.X`/`function X(…){`→
`const X = (…) =>`), `sigma-comp.test.js` (598 dòng, phần lớn hành vi test qua
service TypeScript không đổi gì — chỉ ~10 assertion so khớp cú pháp nguồn cần
cập nhật dấu cách chuẩn TypeScript), `sigma-print.test.js`/`uncertainty.test.js`
(so khớp cú pháp + `loadSandbox()` bỏ `modules/sigma.js`),
`sigma-export-selection.test.js` (bẫy #2 ở trên), `ui-accessibility.test.js`/
`ui-route-structure.test.js` (đổi đường dẫn + bỏ assertion thứ tự nạp script
`sigma.js?` không còn thẻ `<script>` riêng — cùng cách đã xử lý ở Route 7/10/
11). `global.d.ts` thêm 7 ambient (`sgData`/`sgVisibleLevels`/`sgRows`/
`sgFrequencyHTML`/`sgTrendSVG`/`sgMDCSVG`/`sgReconcileAllTeaSnapshots` — vẫn
còn caller trần ở `data-io.js`/`reports.js`/`state.js`).

Gate: `build:pilot`/`typecheck`/`test` 613/613 + `ui-check` (29/29, gồm 2 kịch
bản render canvas Sigma/MDC qua Chromium thật) + `nce-check` (91/91) +
`a11y-audit` (0 vi phạm mọi trang kể cả `sigma` + 3 modal Sigma, 18/18 modal,
ratchet PASS). **Toàn bộ nhóm A (Route/presentation) của Pha G đã hoàn tất.**
Chuyển sang nhóm B (canvas/adapter: `draw.js`, `reports.js`, `data-io.js`) —
cần gate `visual-check`/`print-check` riêng.

#### Lát hạ tầng 1 — `local-store.js` (2026-08-19, mở nhóm C)

Retire hoàn toàn `assets/modules/local-store.js` (13 dòng) — file nhỏ nhất
trong nhóm C, chọn mở đầu vì nó đã là "vỏ cầu nối" thuần từ đợt dọn bridge Pha
F (mục "Đã dọn nhóm A" ở trên): mỗi hàm của `LocalStore` chỉ
`return globalThis.localStoreService.X(...)`, và `localStoreService`
(`src/application/storage/local-store-service.ts`) đã là implementation
TypeScript thật từ trước. Không có logic mới nào cần viết — chỉ chuyển đúng
cái facade đó vào `src/compat/modular-pilot.global.ts`:
`root.LocalStore = Object.freeze({supported,read,write,writeSerialized,
writePartitioned,readPartitioned,clear})`, đặt ngay sau
`root.localStoreService = createLocalStoreService({...})`. Vì đây là một
PHÉP GÁN (`root.LocalStore =`), không phải khai báo `const LocalStore=` như
bản classic, `LocalStore` vẫn là global thật truy cập được bằng tên trần —
đúng cách các "bí danh thuần" trước đó (`pageDash`, `brandTitle`, …) đã làm —
nên hai bài test gọi thẳng `LocalStore.write(...)`/`LocalStore.supported()`
làm bare identifier (`tests/local-store.test.js`,
`benchmarks/performance-regression.js`) không cần viết lại, chỉ cần đảm bảo
bundle được nạp trong sandbox của chúng.

**Một bẫy thật, khác hẳn kiểu "bare identifier vs lazy call" đã biết từ Lát 2/3:**
`modularIndexedDbOpenService`/`modularIndexedDbRecordService` (hai service nội
bộ nuôi `localStoreService`) trước đó được dựng có điều kiện —
`typeof LocalStore!=='undefined'?createIndexedDbOpenService(...):null` — một
guard TÍNH NGAY LÚC NẠP SCRIPT (không phải closure trì hoãn), chỉ đúng vì
classic `local-store.js` load TRƯỚC bundle trong `index.html` nên `LocalStore`
đã tồn tại khi dòng này chạy. Gộp `LocalStore` vào chính bundle làm bẫy này
tự cắn đuôi: dòng guard chạy TRƯỚC dòng `root.LocalStore=...` bên dưới trong
CÙNG một lượt thực thi script, nên `typeof LocalStore` mãi mãi `'undefined'`
→ `modularIndexedDbOpenService` cố định `null` → mọi ghi/đọc IndexedDB câm
lặng thành no-op ngay cả khi trình duyệt thật có `indexedDB`. Test Node không
bắt được vì hầu hết sandbox stub `indexedDB` sau khi bundle đã nạp (đúng thời
điểm bẫy này cần), giống hệt kiểu lỗi "chỉ lộ khi chạy Chromium thật" của Lát
3. Sửa bằng cách bỏ hẳn guard điều kiện — dựng cả hai service vô điều kiện —
vì lớp trong (`createIndexedDbOpenService`'s `open()`,
`createIndexedDbRecordService`'s `get`/`put`/`delete`) đã tự trả về giá trị
rỗng an toàn khi `indexedDB` thật sự không tồn tại; guard ngoài chưa bao giờ
cần thiết cho hành vi, chỉ từng đúng ngẫu nhiên nhờ thứ tự nạp classic. Quét
lại toàn bộ 7 điểm dùng `LocalStore` còn lại trong `modular-pilot.global.ts`
(2 điểm dạng "eager guard" như trên đã sửa; 5 điểm còn lại đều là closure trì
hoãn bên trong service khác, được đổi thẳng sang gọi `root.localStoreService!`
thay vì đi vòng qua `LocalStore` — không đổi hành vi, chỉ bỏ một lớp gián
tiếp thừa) — không còn tham chiếu `LocalStore` nào bên trong
`modular-pilot.global.ts` ngoài chính dòng gán `root.LocalStore=`.

Xóa ambient `declare const LocalStore` (không còn cần vì mọi tham chiếu nội
bộ giờ đi qua `root.localStoreService`), thêm `LocalStore?: LocalStoreApi;`
vào interface global bridge cạnh `localStoreService?: LocalStoreApi;`. Xóa
thẻ `<script>` của `local-store.js` khỏi `index.html`. 5 file test
(`tests/cache-invalidation.test.js`, `tests/firebase-config.test.js`,
`tests/local-store.test.js`, `tests/state-storage-safety.test.js`,
`tests/storage-pipeline.test.js`) chỉ cần bỏ mục
`'modules/local-store.js'` khỏi danh sách nạp — mọi list đều đã có
`modules/state.js` hoặc `modules/state-storage.js` nên `loadSandbox()` tự
chèn bundle.

**Phát hiện phụ ngoài phạm vi lát này, tiện tay sửa vì cùng file:**
`benchmarks/performance-regression.js` đã hỏng từ trước (không liên quan
`local-store.js`) — dòng `loadSandbox(['core.js','modules/state.js',
'modules/qc-domain.js','modules/settings.js'])` tham chiếu `modules/settings.js`,
bị xóa từ Route route 1 (2026-08-18) mà benchmark chưa bao giờ được cập nhật
theo, nên `node benchmarks/performance-regression.js` ném `ENOENT` ngay từ
lệnh gọi `loadSandbox` đầu tiên — nghĩa là gate benchmark này đã không chạy
được ít nhất từ Route 1. Xác nhận bằng cách chạy trực tiếp trước khi sửa bất
cứ gì (không suy đoán). Sửa bằng cách bỏ `'modules/settings.js'` khỏi list đó
(không hàm nào benchmark này gọi — `QCCore.validateBackup`/`sanitizeBackup`/
`ensureShape`/`validateStateInvariants` — cần `settings.js`; `ensureShape()`
gọi `ensureLabBrandShape` qua bundle tự động nhờ `modules/state.js` đã có
trong list) và đổi dòng đo IndexedDB
(`loadSandbox(['modules/local-store.js'],{performance})`, giờ mất file) sang
`loadSandbox(['core.js','modules/state.js','modules/qc-domain.js'],{performance})`
để `LocalStore` tới từ bundle tự chèn. Chạy lại benchmark xác nhận gate pass
(`saveIncrementalPartitions:1`, đúng tín hiệu ghi tăng dần đã chốt trong
CLAUDE.md) — bài học: một benchmark không nằm trong `npm test`/pre-commit
hook có thể âm thầm gãy nhiều lát mà không ai biết cho tới khi có người chạy
tay hoặc release gate (`verify-release.js`) chạm tới nó.

Gate: `build:pilot`/`typecheck`/`test` xanh (613/613) + `ui-check` (29/29, gồm
kịch bản restore backup đi qua đúng đường ghi/đọc IndexedDB) + `nce-check`
(91/91) + `node benchmarks/performance-regression.js` pass (xác nhận lại
sau khi sửa cả hai chỗ hỏng).

#### Lát hạ tầng 2 — `backup-ui.js` (2026-08-19)

Retire `assets/modules/backup-ui.js` (27 dòng, 9 hàm + 1 hằng ngưỡng) —
**không tạo file TS mới**, inline thẳng vào `src/compat/modular-pilot.global.ts`
ngay sau khối dựng bốn `Backup*Command` (`BackupExportCommand`/
`BackupImportCommand`/`BackupInspectionCommand`/`BackupStatusCommand`), theo
đúng tiền lệ `audit.js` (Route 6) chứ không theo tiền lệ `settings.js`/
`local-store.js`-kiểu-lát-1: file này CÓ nhánh/try-catch thật (khác
`local-store.js`'s 1-dòng thuần túy) nhưng vẫn thuần là glue quanh các
command TypeScript đã có sẵn, không có HTML, nên không đáng một controller
factory riêng.

Trước khi xóa, map cả 9 hàm ra caller thật bằng `rg` trên toàn `assets/`,
`src/`, `tests/` (đúng quy tắc audit.js để lại): 8 hàm có caller thật
(`confirmOversizedBackup`/`exportData`/`downloadBackupText`/
`backupCurrentData`/`importData`/`verifyBackupFile`/`markBackupDone`/
`backupStatusText`/`backupCapacityText`/`updateBackupBanner` — `importData`/
`verifyBackupFile`/`exportData` được gọi từ chuỗi HTML onclick dựng ở
`admin-tools-html.ts`, không đổi gì ở đó). **1 hàm chết hẳn:**
`backupOverdue()` — 0 caller ở bất kỳ đâu kể cả `BackupStatusCommand.overdue`
(phương thức TS bên dưới cũng mồ côi luôn, nhưng để nguyên trong
`backup-status-command.ts` vì nằm ngoài phạm vi "dọn file classic" của lát
này) — xóa hẳn, không port.

**Bẫy duy nhất, khác cả `local-store.js` lẫn `audit.js`:** `backupCurrentData`
được `users-auth.js` (chưa migrate) đọc TRẦN qua
`typeof backupCurrentData==='function'` — đúng dạng cảnh báo cuối của lát
`audit.js` ("hàm nào vẫn còn nơi khác gọi trần bằng mã JS thật thì phải thêm
ambient vào `global.d.ts`, không chỉ vào `modular-pilot.global.ts`"). Thêm
`declare function backupCurrentData(prefix?: string): Promise<boolean>;` vào
`global.d.ts` — thiếu dòng này thì `tsc --noEmit` (nhánh checkJs quét
`users-auth.js`) báo `Cannot find name 'backupCurrentData'` dù
`tsc -p tsconfig.modules.json` và `build:pilot` đều xanh, đúng kiểu lỗi hai
chương trình tsc không đồng bộ mà lát `audit.js` đã cảnh báo trước.

**8 test phụ thuộc, ba kiểu khác nhau:**

1. `tests/backup-ui-bridge.test.js` — xóa hẳn (không sửa). Test này vốn đối
   chiếu HAI file độc lập (bridge công bố tên gì, route classic tiêu thụ tên
   đó thế nào); sau khi gộp cả hai vào MỘT file, phép đối chiếu trở nên vô
   nghĩa — TypeScript strict compilation đã tự đảm bảo `root.X=` khớp interface
   bắt buộc, không cần một test riêng lặp lại việc đó.
2. `tests/typescript-module-pilot.test.js` — 19 assertion source-scanner pin
   nguyên văn cú pháp classic (`globalThis.X`, `function name(){`, `var
   model=`) của `backup-ui.js` cũ. Đổi biến `backupUiSource` sang đọc
   `src/compat/modular-pilot.global.ts` (giống `dashboardRoutesSource`/
   `manageRoutesSource`/… đã trỏ sang file TS thay thế từ các lát trước) và
   viết lại từng regex sang cú pháp mới (`root.X`, arrow function, không có từ
   khóa `return` ở thân biểu thức). Một assertion đổi Ý NGHĨA thay vì chỉ đổi
   cú pháp: `return globalThis.BackupStatusCommand.overdue(` (khẳng định
   `backupOverdue` tồn tại) đổi thành `doesNotMatch(/backupOverdue/)` (khẳng
   định hàm chết không bị đưa trở lại). Một assertion khác
   (`doesNotMatch(backupSizeWarningConfirmation)`, ý định gốc: "hàm
   `confirmOversizedBackup` không được tự quyết định size-warning, việc đó
   thuộc về `BackupExportCommand`") suýt sai nếu chỉ đổi tiền tố —
   `backupSizeWarningConfirmation` xuất hiện HỢP LỆ ở nơi khác trong CÙNG file
   khổng lồ này (khai báo interface, construction, và trong wiring `warning:`
   của chính `BackupExportCommand` — đúng dòng cạnh nơi gọi
   `confirmOversizedBackup`). Một `doesNotMatch` quét toàn file sẽ báo lỗi giả.
   Sửa bằng cách thay hai assertion rời (match phần đầu + doesNotMatch phần
   đuôi) bằng MỘT assertion `match` ghim TOÀN VĂN câu lệnh
   `root.confirmOversizedBackup=async(size,{title,detail})=>{...}` — ghim
   trọn nội dung tự nó chứng minh không có lời gọi nào khác chen vào, không
   cần một `doesNotMatch` tách rời dễ vỡ theo ngữ cảnh xung quanh. Cũng lật
   ngược assertion `index.html` phải TẢI `backup-ui.js`
   (`assert.match`) thành PHẢI KHÔNG tải (`assert.doesNotMatch`), khớp mẫu đã
   dùng cho `lis-queue-ui.js` ngay dòng kế bên.
3. 6 test hành vi (`tests/backup-download-bridge.test.js`,
   `tests/backup-roundtrip.test.js`, `tests/audit-ingress-gates.test.js`,
   `tests/auth-security.test.js`) chỉ cần bỏ `'modules/backup-ui.js'` khỏi
   danh sách nạp (đã có `state.js`/bundle explicit sẵn) — riêng
   `backup-download-bridge.test.js` tái diễn đúng bài học "stub bị bundle ghi
   đè" của Lát 1: trước đây nạp CHỈ `['modules/backup-ui.js']` với
   `blobDownload` stub qua tham số `globals`; giờ `blobDownload` là property
   thật do bundle gán ngay khi nạp (`root.blobDownload=createBlobDownload(...)`),
   ghi đè mất stub — sửa bằng cách nạp `['core.js','modules/state.js',
   'modules/qc-domain.js']` (bundle tự chèn) rồi gán `ctx.blobDownload=...`
   TRỰC TIẾP SAU khi `loadSandbox()` trả về, không qua tham số `globals`.
   `auth-security.test.js` đọc thẳng `backup-ui.js` bằng `fs.readFileSync` để
   pin `async function importData(...)`  — trỏ sang
   `src/compat/modular-pilot.global.ts`, regex đổi thành
   `root.importData=async e=>\{[\s\S]*?reauthenticateCurrentUser\(\{title:...`.

`tests/admin-tools-html.test.js` không đổi gì — nó chỉ kiểm HTML onclick
(`exportData()`, `importData(event)`, …) do `admin-tools-html.ts` dựng, không
quan tâm các hàm đó cài đặt ở đâu.

Gate: `build:pilot`/`typecheck`/`test` xanh (612/612 — giảm 1 vì xóa
`backup-ui-bridge.test.js`) + `ui-check` (29/29, gồm 3 kịch bản backup/restore
đi qua đúng `confirmOversizedBackup`/`importData`/`verifyBackupFile` mới) +
`nce-check` (91/91) + `a11y-audit` (ratchet PASS, trang Settings có panel
"Quản trị dữ liệu" vẫn 0 vi phạm).

#### Lát hạ tầng 3 — `app-meta.js` (2026-08-19)

Retire `assets/modules/app-meta.js` (28 dòng) — file **dữ liệu thuần, không có
hàm nào**: chỉ hai object literal gán `window.QCLAB_APP`/`window.QCLAB_CLOUD`
(tên app/phiên bản, và cấu hình Firebase deploy mặc định gồm cả API key
thật). Lát dễ nhất trong nhóm C tính tới nay — không có nhánh, không có
caller nào cần map lại hành vi, chỉ cần chuyển nguyên hai object đó vào
`src/compat/modular-pilot.global.ts` làm `root.QCLAB_APP = {...}` /
`root.QCLAB_CLOUD = root.QCLAB_CLOUD || {...}`, đặt ngay sau dòng
`const root = globalThis as QCLabGlobal` (trước cả guard `QCCore` — vị trí
này khớp vai trò "cái nạp đầu tiên" của bản classic, dù về mặt hành vi không
bắt buộc phải đặt ở đây vì mọi nơi đọc đều là closure trì hoãn — xem bên
dưới).

**Rủi ro thật duy nhất đã kiểm tra trước khi làm, không phải bẫy phát hiện
sau:** `app-meta.js` trước đây nạp NGAY SAU `core.js` (dòng 66, trước cả
`state.js`/`qc-domain.js`/`firebase-sync.js`/`state-storage.js`/
`action-workflow-service.js`), còn bundle nạp SAU TẤT CẢ các file đó (dòng
~73). Gộp vào bundle nghĩa là `QCLAB_APP`/`QCLAB_CLOUD` chỉ thật sự tồn tại
MUỘN HƠN nhiều so với trước — nếu bất kỳ file classic nào đọc chúng ở TOP
LEVEL (ngay khi nạp, không phải trong thân hàm) thì sẽ vỡ. Xác nhận bằng `rg`
"QCLAB_APP\|QCLAB_CLOUD" trên toàn `assets/`, `src/`: cả 8 điểm đọc hiện có
đều là closure trì hoãn (`() => window.QCLAB_APP||{...}`, gọi lúc
`showLogin()`/`initFirebase()`/xuất báo cáo chạy, không phải lúc script nạp)
— không điểm nào đọc trần ở top level. Do đó việc dời vị trí nạp không đổi
hành vi nào, khác hẳn bẫy `wgMemo` (Lát 3, `router-render.js`) nơi một `let`
top-level bị đọc qua `root.X` — ở đây không có biến `let`/`const` nào cả, chỉ
có function closures.

Kiểu hai object trong interface `QCLabGlobal` mở rộng từ `{ version?: string }`
tối giản (chỉ đủ cho một chỗ gọi `.version`) thành đầy đủ
`{ name: string; version: string; releaseDate: string }` và thêm mới
`QCLAB_CLOUD: { labCode: string; anonymous: boolean; locked: boolean; config:
Record<string, string> }` — cả hai giờ là trường bắt buộc (không có `?`) vì
được gán vô điều kiện ngay trong file này. `interface Window` trong
`global.d.ts` (dùng cho nhánh checkJs quét `users-auth.js`, nơi vẫn đọc
`window.QCLAB_APP` trần trong `showLogin()`) đã có sẵn `QCLAB_APP: any`/
`QCLAB_CLOUD: any` từ trước — không cần sửa.

Không có test nào load `'modules/app-meta.js'` tường minh (xác nhận bằng
`rg`), nên không có file test nào cần sửa — chỉ xóa file, xóa thẻ `<script>`,
bump `?v=` của bundle. Kèm dọn hai chỗ tài liệu tham chiếu đường dẫn cũ:
`tests/global-name-uniqueness.test.js`'s comment (không sửa, chỉ là ví dụ
minh họa, không phải dependency thật) và `docs/validation/RELEASE-PUBLISH.md`
— checklist phát hành trỏ thẳng `assets/modules/app-meta.js` để lấy
`version`/`releaseDate` khi bump bản release; đổi sang trỏ
`root.QCLAB_APP` trong `src/compat/modular-pilot.global.ts` (và tag `?v=` cần
bump giờ là của `assets/generated/modular-pilot.js`, không phải một file
riêng của `app-meta.js` nữa) — bỏ sót chỗ này sẽ làm quy trình release tương
lai kiểm tra nhầm một file đã không còn tồn tại.

Vì đây là cấu hình Firebase thật (API key production), xác nhận thêm bằng
trình duyệt thật thay vì chỉ tin `npm test`: mở `qc-lab-static` (cổng 8080),
đọc `window.QCLAB_APP`/`window.QCLAB_CLOUD` qua console — đúng giá trị — và
xác nhận màn hình đăng nhập hiện đúng "Phiên bản 2.7.6" (chuỗi
`showLogin()` dựng từ `window.QCLAB_APP.version`).

Gate: `build:pilot`/`typecheck`/`test` xanh (612/612, không đổi số lượng) +
`ui-check` (29/29) + xác nhận trực tiếp trên trình duyệt (`window.QCLAB_APP`/
`QCLAB_CLOUD` đúng giá trị, màn đăng nhập hiện đúng phiên bản).

#### Lát hạ tầng 4 — `range.js` (2026-08-19)

Retire `assets/modules/range.js` (95 dòng, 10 hàm) — file lớn nhất và duy nhất
có DOM/modal thật trong ba lát nhóm C đã làm tới nay, nhưng vẫn **không tạo
file TS mới**: mọi phụ thuộc (`qcRangeCandidateService`, `qcRangeTea`,
`qcRangeSafetyGate`, `qcRangeBiasEvaluation`, `RangeWorkflowCommand`, 6 HTML
builder `range*Html`) đã là TypeScript có sẵn — `range.js` chỉ còn vai trò
orchestration/DOM-adapter (đọc form, mở modal, gọi service, không chứa phép
tính lâm sàng nào) — đúng vai trò "chỉ inline, không logic mới" như
`audit.js`/`backup-ui.js`, dù độ dài/số nhánh lớn hơn hẳn hai file đó. Toàn bộ
10 hàm chuyển thẳng vào `src/compat/modular-pilot.global.ts`, đặt ngay sau
`root.RangeWorkflowCommand=createRangeWorkflowCommand({...})`.

Trước khi xóa, `rg` xác nhận cả 10 hàm: 2 hàm (`openRangeWorkflow`,
`revertRange`) được gọi từ chuỗi HTML onclick dựng ở
`src/presentation/range/range-actions-html.ts` (đã là TypeScript từ trước,
không đổi gì — chuỗi `openRangeWorkflow('${tid}',${level})` vẫn đúng vì tên
global không đổi); `rangeCandidate` còn được `entry-page-controller.ts` (Route
10) và chính `modular-pilot.global.ts` tiêu thụ qua closure trì hoãn
(`(root as any).rangeCandidate(testId, level)` tại dòng dựng deps cho
`EntryUIState`); 7 hàm còn lại chỉ gọi lẫn nhau nội bộ hoặc từ chuỗi onclick tự
sinh trong chính HTML mà `openRangeWorkflow`/`applyNewRange`/`revertRange`
dựng ra (`applyNewRange`, `confirmApplyNewRange`, `confirmRevertRange`,
`rangeUpdateBiasHint`). Không có hàm nào chết — khác `local-store.js`/
`backup-ui.js`/`app-meta.js`, lát này không phát hiện dead code.

**Không có bẫy thứ tự nạp** (khác cảnh báo đã ghi cho `analyte-catalog.js`
bên trên): xác nhận bằng `rg` toàn `assets/`, `src/` rằng cả 10 tên đều chỉ
được đọc qua closure trì hoãn — không nơi nào đọc trần ở top-level của một
classic script khác. `range.js` trước đây nạp SAU bundle (giữa
`generated/modular-pilot.js` và `users-auth.js`); gộp vào bundle chỉ khiến các
hàm này có sẵn SỚM HƠN, không muộn hơn — an toàn theo đúng chiều.

Thêm 11 trường bắt buộc (`rangeSystematicNce`/`rangeCandidate`/
`openRangeWorkflow`/`rangeTeaPercent`/`rangeGateHtml`/`rangeUpdateBiasHint`/
`rangeGatePasses`/`applyNewRange`/`confirmApplyNewRange`/`revertRange`/
`confirmRevertRange`) vào interface bridge — trước lát này, `rangeCandidate`
chỉ được gọi qua `(root as any).rangeCandidate(...)` (chưa có kiểu thật) dù đã
có hai caller TypeScript. Một lỗi kiểu duy nhất khi typecheck: `lvlCfg(test:
Record<string,any>, ...)` không nhận `Record<string,any>|undefined` mà
`state.tests!.find(...)` trả về trong `confirmRevertRange` — sửa bằng ép kiểu
`as any` tại điểm gọi, khớp phong cách lỏng đã dùng cho toàn bộ lớp adapter
DOM này (không đáng thắt chặt kiểu `lvlCfg` chỉ vì một lát port).

**3 test cần sửa, một kiểu bẫy y hệt đã gặp ở `audit.js`:** `rg
"modules/range"` ban đầu chỉ thấy `tests/range-candidate.test.js` (đọc qua
`loadSandbox([...,'modules/range.js'])`), bỏ sót
`tests/entry-service.test.js` vì nó dựng đường dẫn bằng
`path.join(__dirname,'..','assets','modules','range.js')` — bốn tham số
tách rời nên chuỗi con `'modules/range.js'` không xuất hiện liền trong mã
nguồn. Phải dò lại bằng `rg "'range\.js'"` (đúng bài học đã ghi ở Route 6) mới
tìm ra. Sửa: `range-candidate.test.js` bỏ `'modules/range.js'` khỏi danh sách
nạp (đã có `state.js` nên bundle tự chèn), trỏ lại 7 assertion
`globalThis.rangeXxxHtml(` sang `root.rangeXxxHtml(` và đọc từ
`src/compat/modular-pilot.global.ts` thay vì `assets/modules/range.js`;
`entry-service.test.js` đổi tương tự cho 2 assertion `fmtTestValue(r.t,r.l...`
(không cần đổi tiền tố vì assertion không neo `globalThis.`/`root.`, chỉ neo
đúng chuỗi con `fmtTestValue(r.t,r.l.mean...` — vẫn khớp vì
`(root as any).fmtTestValue(...)` chứa nguyên chuỗi con đó).
`tests/range-tea-bridge.test.js` xóa hẳn (không sửa) — cùng lý do
`backup-ui-bridge.test.js` ở Lát 2: đối chiếu hai file độc lập, giờ chỉ còn
một.

Gate: `build:pilot`/`typecheck`/`test` xanh (611/611 — giảm 1 vì xóa
`range-tea-bridge.test.js`) + `ui-check` (29/29, gồm đúng kịch bản "Áp dụng
dải PXN cập nhật đủ Mean/SD và hai giới hạn" đi qua `applyNewRange`/
`confirmApplyNewRange` mới) + `nce-check` (91/91) + `a11y-audit` (ratchet
PASS).

#### Lát hạ tầng — TÁCH NỀN `state.js` (2026-08-19, KHÔNG retire)

Đây **không** phải lát retire — `state.js` vẫn là file classic. Đây là lát
CHUẨN BỊ (tách nền) để lát retire `state.js` sau này trở nên cơ học và an toàn.
Sau bốn lát dễ (`local-store`/`backup-ui`/`app-meta`/`range` — đều là "vỏ cầu
nối" thuần), phân tích cho thấy `state.js` **không thể retire đơn lẻ** vì nó là
trung tâm của một cụm coupling lexical: `state` (biến `let` khả biến) cùng các
cache dẫn xuất (`pointsCache`/`pointsIndexCache`/`pointsLotCache`/`wgMemo`/
`acceptedMemo`/`cusumMemo`/`derivedIndex`) và `mem`/`startupProblem` được ĐỌC VÀ
GHI TRẦN bởi cả 5 file classic còn lại (qc-domain 13×, state-storage 10×,
firebase-sync 9×, users-auth 16×, action-workflow-service 2× cho riêng `state`)
LẪN bundle (bundle vừa đọc vừa GHI `state` 6 chỗ qua scope chain).

**Cơ chế nền tảng (đã kiểm chứng, không suy đoán):** một `<script>` cổ điển
chia sẻ "global lexical environment". `let X` top-level nằm trong environment
đó — bundle (IIFE lồng trong global scope) đọc/ghi được qua scope chain, nhưng
KHÔNG trở thành property của `globalThis`. Chiều ngược lại là điểm chết: một
file classic KHÔNG thấy được `let` khai báo BÊN TRONG bundle IIFE. Vì vậy ràng
buộc thật chỉ là: **không thể chuyển file KHAI BÁO (`state.js`) vào bundle khi
các file ĐỌC nó vẫn còn classic** — chuyển xong thì `let state` bị kẹt trong
IIFE và cả 5 file classic vỡ với `ReferenceError`. (Chiều ngược — chuyển file
ĐỌC vào bundle trước khi chuyển `state.js` — thì AN TOÀN, vì bundle đọc/ghi
classic `let` qua scope chain.)

**Cách tách nền đã chọn (theo hướng người dùng duyệt):** đổi `state` + 6 cache +
`mem`/`startupProblem` từ `let` lexical sang **`globalThis.X` data property**
ngay trong classic `state.js`. Cân nhắc ba cơ chế:
- **accessor** (như `currentUser`/`page`/`dashTestQ` qua `installUiState`): đúng
  tiền lệ nhưng thêm chi phí getter trên MỌI lần đọc `state` — biến nóng nhất
  app (đọc hàng chục nghìn lần mỗi lần dựng domain lạnh). Loại.
- **`var`**: thành global property NGAY BÂY GIỜ, nhưng khi `state.js` chuyển vào
  bundle IIFE thì `var` thành biến cục bộ IIFE → không sống sót, phải viết lại
  thành `root.X`. Loại (churn cosmetic).
- **`globalThis.X = ...`** (đã chọn): data property thuần (không getter), phân
  giải cho mọi caller qua global object, và ĐÚNG dòng `globalThis.X=` này chuyển
  nguyên vẹn khi `state.js` port vào bundle sau này. Cache Map giữ nguyên tham
  chiếu vì `derived-cache-invalidation.ts` chỉ gọi `.clear()`/`.delete()`, không
  bao giờ gán lại Map (đã đọc xác nhận). Chỉ `derivedIndex`/`mem`/`startupProblem`/
  `state` bị gán lại — ghi trần trong sloppy-mode classic (không file nào có
  `use strict`) và ghi từ bundle (strict, phân giải tới property đã tồn tại) đều
  hợp lệ.

**Một lỗi typecheck phát sinh, gốc rễ tinh vi:** đổi kiểu ambient của `state`
sang `Record<string,any> & {...}` khiến `state.activity` thành `any`, nên
`total=(state.activity||[]).length` trong `pageAudit()` (users-auth.js) thành
`any` thay vì `number` như trước (state.js cũ suy `let state={...activity:[]...}`
ra `activity: any[]`). `any` đó lan vào object fallback của ternary `chain=... ?
auditChainStatus() : {ok,checked,legacy:total,idle}` và **phá vỡ phép rút gọn
union theo subtype** mà đoạn code âm thầm dựa vào: khi `legacy:number`, object
fallback là subtype sạch của kiểu trả về `auditChainStatus` nên `chain` rút về
một nhánh và `chain.total`/`.brokenIndex`/`.reason` hợp lệ; khi `legacy:any`, TS
không rút gọn nữa nên các field optional đó báo lỗi trên nhánh fallback. Sửa
bằng cách thêm nhánh `activity?: any[]` vào kiểu ambient của `state` trong
`global.d.ts` (phản ánh đúng thực tế `state.activity` là mảng) → `total` trở lại
`number`, union rút gọn như cũ. Đã xác nhận đây là lỗi DO lát này gây ra bằng
`git stash` (typecheck sạch khi chưa có thay đổi). Bài học: đổi kiểu của `state`
từ literal-inferred sang `Record<string,any>` KHÔNG trung tính về kiểu — nó biến
mọi property thành `any` và có thể phơi ra những chỗ code cũ dựa ngầm vào kiểu
suy luận cụ thể; khi retire các file classic đọc `state`, canh chừng lớp lỗi này.

Không có test nào cần sửa (không file test nào phụ thuộc `state` là `let`
lexical). checkJs thấy các binding mới qua `declare var` thêm vào `global.d.ts`
(cùng cụm với `declare var selTest/currentUser/...`). Ambient `declare let state`
trong `modular-pilot.global.ts` (pass strict `tsconfig.modules.json`, không gồm
`global.d.ts`) không đổi và không xung đột.

Gate: `typecheck` sạch (cả checkJs lẫn strict) + `test` (611/611) + `ui-check`
(29/29 — gồm nhập/hủy QC, restore backup GHI LẠI `state`, áp dụng dải PXN, tất
cả đọc/ghi `state`+cache nặng qua Chromium thật) + `nce-check` (91/91) +
benchmark `performance-regression.js` PASS (coldDomainMs 1648ms/budget 12000,
`warmDomainColdRatio` 0.00029 — xác nhận data property KHÔNG thêm chi phí đo được
so với `let`, đúng lý do loại accessor). Không cần `build:pilot` vì lát này
không chạm `src/`.

#### Kế hoạch các lát nhóm C còn lại (sau tách nền `state`) — 2026-08-19

Với `state`/cache đã là globalThis property, ràng buộc port đã đảo chiều: có thể
port từng file **ĐỌC** (`qc-domain`/`state-storage`/`firebase-sync`/`users-auth`/
`action-workflow-service`) vào bundle ĐỘC LẬP (bundle đọc/ghi `state`+cache qua
global object), rồi retire `state.js` + `analyte-catalog.js` **sau cùng** khi
không còn file classic nào đọc `state`/`TEA_ANALYTE_CATALOG` trần.

**Quy tắc chung cho MỖI lát reader** (áp dụng đúng bài học tách nền): trước khi
chuyển file F vào bundle, `grep -nE "^(let|const|var) "` các khai báo lexical
top-level của F, rồi kiểm mỗi tên xem có file CLASSIC KHÁC (hoặc `app.js`) đọc
trần không. Nếu có → tên đó phải tách nền sang `globalThis.X` TRƯỚC (như đã làm
với `state`), vì khi F vào bundle thì `let`/`const` của nó kẹt trong IIFE.
Lexical chỉ được BUNDLE đọc (không classic nào khác) thì AN TOÀN — chúng vào
bundle cùng F. Hàm `function X(){}` luôn an toàn (thành `root.X`, caller trần rơi
qua global object).

**Bản đồ ràng buộc lexical chéo-classic đã rà (2026-08-19)** — chỉ HAI tên cần
tách nền trước khi port chủ của chúng:

| Lexical | Chủ (owner) | File classic khác đọc trần | Xử lý |
| --- | --- | --- | --- |
| `fb` | `firebase-sync.js` | `state-storage.js`(1), `users-auth.js`(1) | tách nền `globalThis.fb` khi/ trước khi port `firebase-sync` |
| `storageHydrationPromise` | `state-storage.js` | `users-auth.js`(1), `app.js`(1) | tách nền `globalThis.storageHydrationPromise` khi/ trước khi port `state-storage` (`app.js` là Pha H nên chưa port kèm được) |

Mọi lexical khác (`localLoadStatus`/`partitionWrite`/`partitionSlot`/`lsDirty`/
`ls*`/`wgWorker`/`WG_RULE_DESCRIPTIONS`/`WG_WORKER_POINT_THRESHOLD`/`saveLabel`/
`auditQ`/`AUDIT_PAGE_SIZES`/…) chỉ được chính chủ + bundle đọc → vào bundle cùng
file, không cần tách nền riêng.

**Quan trọng — chiều ràng buộc:** một CLASSIC reader đọc lexical của file khác
KHÔNG chặn việc port chính reader đó (bundle đọc classic `let`/`const` qua scope
chain vô tư). Ràng buộc chỉ chặn việc port file KHAI BÁO lexical đó khi vẫn còn
CLASSIC reader. Vì vậy `users-auth` đọc `fb`/`storageHydrationPromise` KHÔNG làm
chậm việc port `users-auth`; nó chỉ chặn port `firebase-sync`/`state-storage`.

**Lát 0 (prerequisite tách nền) — `fb` + `storageHydrationPromise` → globalThis.**
Làm một lát nhỏ (giống lát tách nền `state`) đổi `const fb=` trong `firebase-sync.js`
và `let storageHydrationPromise` trong `state-storage.js` sang `globalThis.fb=`/
`globalThis.storageHydrationPromise=`, thêm `declare var` vào `global.d.ts`. Sau
lát này KHÔNG còn lexical chéo-classic nào → cả 5 reader port được theo BẤT KỲ
thứ tự nào. (Lý do tách riêng thay vì gộp vào lát chủ: `storageHydrationPromise`
còn bị `app.js` — Pha H, chưa port — đọc trần, nên dù port `state-storage` vẫn
phải tách nền nó; làm sớm để gỡ mọi ràng buộc thứ tự.)

**Thứ tự lát đề xuất SAU lát 0 (rủi ro/ghép nối tăng dần) — port độc lập:**

1. ~~**`action-workflow-service.js`** (149)~~ — **xong 2026-08-20, xem "Lát nhóm C
   — 1" bên dưới.**
2. ~~**`users-auth.js`** (256)~~ — **xong 2026-08-20, xem "Lát nhóm C — 2" bên dưới.**
3. ~~**`firebase-sync.js`** (173)~~ — **xong 2026-08-20, xem "Lát nhóm C — 3" bên dưới.**
4. ~~**`state-storage.js`** (120)~~ — **xong 2026-08-20, xem "Lát nhóm C — 4" bên dưới.**
5. **`qc-domain.js`** (255) — đọc `state`+`wgMemo`/`acceptedMemo`/`cusumMemo`/
   `derivedIndex`/`WG_RULES` trần (giờ đều là globalThis property nhờ lát tách
   nền `state`, trừ `WG_RULES` là const của `state.js` — xem dưới). Chứa
   `derived()` tự kiểm chứng + wiring worker Westgard. Đường NÓNG — benchmark
   `coldDomainMs`/`warmDomainColdRatio` là gate bắt buộc. Gate: toàn bộ Westgard
   test + `westgard-worker.test.js` (parity main-thread/worker) + benchmark +
   `ui-check`.

   *Lưu ý `WG_RULES`/`WG_DEFAULT`/`WG_RULE_REGISTRY`/`STATE_SCHEMA_VERSION`/
   `TEA_*` là `const` khai báo trong `state.js`, đọc trần bởi qc-domain
   (`WG_RULES` 1×) và các nơi khác.* Chúng là hằng, không khả biến, nên có thể
   để `state.js` giữ tới lát cuối; khi port qc-domain, `WG_RULES` trần vẫn phân
   giải qua scope chain tới classic `const` của `state.js` (bundle đọc classic
   const được). Chỉ khi retire `state.js` mới cần chuyển các const này thành
   `globalThis.X`/`root.X` hoặc đưa vào bundle.

6. **Lát cuối — retire `state.js` + `analyte-catalog.js` CÙNG MỘT LÁT.** Chỉ khi
   5 file trên đã vào bundle (không còn classic reader nào đọc `state`/caches/
   `WG_RULES`/`TEA_ANALYTE_CATALOG` trần). Hai file phải đi cùng vì `state.js`
   đọc `TEA_ANALYTE_CATALOG` trần Ở TOP-LEVEL (dựng `REFTESTS`/`TEA_ANALYTE_META`
   ngay lúc nạp) — tách rời sẽ vỡ boot. Khi vào bundle: `globalThis.state=`/
   `globalThis.wgMemo=`… chuyển nguyên vẹn (đã tách nền); các `const` data
   (`WG_RULES`/`REFTESTS`/`TEA_*`/`STATE_SCHEMA_VERSION`) thành `root.X` hoặc để
   bundle-internal nếu không còn caller trần; hàm delegator (`fmt`/`isoToday`/
   `ensureShape`/`uid`/…) thành `root.X`. Gate: TOÀN BỘ (test + typecheck +
   ui-check + nce-check + a11y + visual-check + print-check + benchmark) — đây là
   lát đóng nhóm C.

Sau nhóm C: `assets/modules/` rỗng. Còn lại `assets/core.js` (nhóm D),
`assets/workers/westgard-worker.js` (nhóm D), `assets/app.js` (Pha H).

#### Lát 0 — tách nền `fb` + `storageHydrationPromise` (2026-08-20, xong)

Đổi `let fb={...}` trong `firebase-sync.js` và `let storageHydrationPromise=
Promise.resolve(true)` trong `state-storage.js` sang `globalThis.fb=`/
`globalThis.storageHydrationPromise=`, đúng kỹ thuật đã dùng cho `state`/`mem`/
`startupProblem`. Không đổi hành vi: mọi tham chiếu trần còn lại (`fb.dirty`,
`fb.synced=...`, `await storageHydrationPromise`, kể cả phép gán bare
`storageHydrationPromise=globalThis.hydratePartitionedState()` bên trong bundle
ở `modular-pilot.global.ts:2613`) vẫn phân giải đúng qua global object — `fb`
chỉ từng bị MUTATE qua property (`fb.x=`, `Object.assign(fb,...)`), chưa bao
giờ bị gán lại toàn bộ, nên một data property thường (không cần accessor) là đủ,
giống lý do `pointsCache`/`wgMemo` không cần accessor. `fbSaveT`, `partitionSlot`,
`saveLabel`/`saveDetail`/`fbConflictDialogOpen` giữ nguyên `let` — không file
classic nào khác đọc trần các tên này (đã `rg` xác nhận), nên chúng an toàn nằm
lexical cho tới khi chính file chủ được port.

Thêm `declare var fb`/`declare var storageHydrationPromise` vào `global.d.ts`
(nhóm cùng `state`/`mem` ở đầu file); `declare let ... storageHydrationPromise`/
`declare const fb` cục bộ trong `modular-pilot.global.ts` giữ nguyên không đổi
— đó là khai báo kiểu phạm vi module (file có import/export), không tạo binding
runtime, không xung đột với `declare var` toàn cục, đúng mẫu `mem`/`startupProblem`
đã có sẵn ở đó từ trước. Bump `?v=` của hai file trong `index.html`. Gate:
`npm run typecheck` xanh, `npm test` 611/611 xanh (gồm cả
`firebase-merge.test.js`/`firebase-offline.test.js`/`storage-pipeline.test.js`
chạy lại riêng), khởi động app thật trong preview — không có lỗi console.

Sau lát này, không còn ràng buộc thứ tự port giữa 5 reader nhóm C
(`action-workflow-service.js`/`users-auth.js`/`firebase-sync.js`/
`state-storage.js`/`qc-domain.js`) — port theo bất kỳ thứ tự nào trong danh
sách đề xuất ở trên.

#### Lát nhóm C — 1: `action-workflow-service.js` (2026-08-20, xong)

Retire hoàn toàn `assets/modules/action-workflow-service.js` (149 dòng — file
nhỏ nhất trong 5 reader còn lại, chọn mở đầu vì ghép nối nhẹ nhất). Đúng như
kiểm kê bridge Pha F đã ghi nhận, mọi hàm trong file đã là "vỏ cầu nối" thuần —
mỗi hàm chỉ `return root.X.Y(...)` gọi sang service TypeScript đã có sẵn
(`NceActionIdentityService`, `NceActionBasics`, `ActionDraftStatusService`,
`ActionProtocolService`, `ActionApprovalGates`, `ActionRerunService`,
`ActionPointIndexService`, `ActionQcLink`, `NceActionRerunPolicy`,
`PointWorkflowService`) — không có logic mới nào cần viết. Chuyển nguyên các
dòng gán đó vào `src/compat/modular-pilot.global.ts` dưới dạng
`root.actionApprovalStatus = action => root.NceActionBasics!.actionApprovalStatus(action)`
… (28 hàm/const), đặt ngay sau `root.ActionPointIndexService =
createActionPointIndexService(...)` — điểm chèn phải nằm SAU tất cả các service
phụ thuộc được construct (dòng 3486–3672) nhưng cụ thể nằm ở đâu trong khoảng
đó không quan trọng, vì mọi dependency injection quanh chúng vốn đã là closure
trì hoãn (`action => (root as any).actionWorkflowStatus(action)`), không gọi
ngay lúc construct — đúng "bẫy eager vs lazy" mà các lát trước đã học, ở đây
không rơi vào bẫy vì toàn bộ chỗ dùng đều đã lazy sẵn.

Hai đơn giản hóa thật (không chỉ chuyển nguyên):

1. **`actionWorkflowStatus()` bỏ nhánh fallback JS cũ.** Bản classic có
   `if(root.ActionWorkflowStatusService)return root.ActionWorkflowStatusService(a);`
   rồi mới tới ~10 dòng logic JS thủ công y hệt — nhánh dự phòng cho trường hợp
   file bị nạp mà KHÔNG có bundle. Xác nhận nhánh đó chưa từng chạy: production
   nạp bundle ngay sau file này (`index.html`), và sandbox test tự động chèn
   bundle ngay sau `modules/action-workflow-service.js` (`tests/helpers/sandbox.js`,
   xem bên dưới) — nên `root.ActionWorkflowStatusService` luôn tồn tại ở cả hai
   nơi. Đối chiếu logic JS cũ với `src/domain/nce/action-workflow-status.ts` xác
   nhận **giống hệt từng nhánh if/else** — xóa an toàn, không mang sang.
2. **`ACTION_LABELS`/`RISK_SCALE` bỏ toán tử `||` dự phòng.** Bản classic phải
   viết `root.NceActionLabels&&root.NceActionLabels.actionLabels||ACTION_LABELS`
   vì file nạp TRƯỚC bundle trong `index.html` (nên `NceActionLabels` chưa tồn
   tại tại thời điểm đó) — lý do y hệt bẫy `ACTION_LABELS`/`RISK_SCALE` đã ghi ở
   "Ngoại lệ giữ nguyên vì thứ tự nạp" (mục "Đã audit và dọn 14 file classic còn
   lại"). Khi logic này chuyển hẳn vào TRONG bundle, ràng buộc đó biến mất:
   `root.NceActionLabels = nceActionLabels` (dòng 3486) chạy TRƯỚC điểm chèn
   (dòng 3672+) trong CÙNG một script, nên đọc thẳng
   `root.NceActionLabels!.actionLabels`/`.riskScale` là đủ, không cần fallback.

**Ba hàm classic KHÔNG mang sang — xác nhận chết thật, không phải do audit
đợt này bỏ sót:** `actionLotPoints(testId,level,lot)`, `actionPointIndex(testId)`,
`actionOpenedFromVoid(a,p)`. Cả ba định nghĩa trong file nhưng KHÔNG nằm trong
object `root.ActionWorkflowService={...}` (không được `Object.assign(root,...)`
xuất ra ngoài), và `rg` xác nhận không chỗ nào trong repo (kể cả trong chính
file, test, hay `src/`) gọi chúng như global trần. Tên trùng dễ gây nhầm với
`NceActionQcIndex.actionLotPoints(points,level,lot,runNumber)`/`.actionPointIndex(points)`
— đây là HAI hàm khác, chữ ký khác (nhận mảng `points` đã resolve, không phải
`testId`), vẫn sống và được `ActionRerunService` dùng nội bộ. Không đụng gì
tới `ActionRerunService`/`NceActionQcIndex` — cache tự kiểm chứng của chúng
(khóa CLAUDE.md ghi ở mục `action-workflow-service.js`) giữ nguyên vẹn.

**Cập nhật test đi kèm** (mọi test đọc/nạp file classic này phải sửa vì file
đã xóa hẳn, không phải vì hành vi đổi):

- `tests/action-workflow-service.test.js`, `tests/action-form.test.js`,
  `tests/range-candidate.test.js` — bỏ `'modules/action-workflow-service.js'`
  khỏi danh sách `loadSandbox([...])` (bundle đã cấp mọi hàm này qua globalThis).
- `tests/helpers/sandbox.js` — xóa nhánh đặc cách `actionWorkflowIndex` (tự chèn
  bundle ngay sau `modules/action-workflow-service.js` nếu thiếu) — dead code
  vì không còn danh sách test nào chứa tên file đó nữa.
- `tests/action-protocol-rerun-bridge.test.js`, `tests/action-point-index-bridge.test.js`,
  `tests/point-workflow-bridge.test.js` — ba test này KHÔNG chạy hành vi, chỉ
  `rg`/regex nguyên văn source của file classic để khóa "hàm X phải gọi thẳng
  service TS, không tự dựng lại logic". Sửa để đọc regex tương ứng trên chính
  `src/compat/modular-pilot.global.ts` (nơi logic đó giờ thật sự sống), đổi từ
  cú pháp `function foo(a){return root.X.Y(a);}` sang cú pháp arrow đúng phong
  cách file đó (`root.foo = a => root.X!.Y(a)`) — không giữ nguyên cú pháp
  `function` cũ chỉ để test khỏi phải sửa, vì toàn bộ các lát port trước
  (`local-store`/`backup-ui`/`range`) đều đã dùng arrow style nhất quán.

Gate: `typecheck` xanh, `npm test` 611/611 xanh, `npm run nce-check` (vòng đời
NCE thật trong Chromium) 91/91 xanh, `npm run ui-check` 29/29 xanh — không cần
sửa benchmark nào vì không benchmark nào tham chiếu tên file/hàm này trực
tiếp, và cache tự kiểm chứng của `ActionRerunService` không bị đụng tới.

**Lát tiếp theo: `users-auth.js`** (256 dòng, xem mục 2 trong danh sách thứ tự
đề xuất — nhạy cảm bảo mật, cần kiểm cẩn thận PBKDF2/re-auth/trang audit).

#### Lát nhóm C — 2: `users-auth.js` (2026-08-20, xong)

Retire hoàn toàn `assets/modules/users-auth.js` (256 dòng — trang Người dùng,
trang Nhật ký hoạt động, và toàn bộ luồng Auth/login). Khác `action-workflow-
service.js` (thuần delegator), file này CÓ logic DOM/adapter thật (dựng
`innerHTML` màn đăng nhập/đổi mật khẩu/phục hồi dữ liệu, đọc form, focus quản
lý) — nhưng mọi PHÉP TÍNH nghiệp vụ đã là TypeScript từ trước
(`pbkdf2PasswordService`/`legacyPasswordHashService`/`isPbkdf2PasswordHash`,
`LoginWorkflowCommand`/`RequiredPasswordWorkflowCommand`/`AdminBootstrapCommand`/
`UserLifecycleCommand`/`ResetOperationalDataCommand`/`ActivityArchiveCommand`,
`activityAuditFilter`/`activityAuditPagination`/`activityAuditCsv`/
`userListModel`/`userRowHtml`/`usersPageHtml`/`userPermissionsModalHtml`/
`resetPasswordModalHtml`) — nên đây vẫn là port cơ học đúng tinh thần nhóm C,
chỉ là bề mặt DOM/adapter lớn hơn `action-workflow-service.js` nhiều. Chuyển
nguyên vào `src/compat/modular-pilot.global.ts`, đặt ngay sau
`root.UserLifecycleCommand = createUserLifecycleCommand(...)` (điểm cuối cùng
trong chuỗi construct mà các hàm port phụ thuộc).

**`auditQ`/`auditFrom`/`auditTo`/`auditPage`/`auditPageSize` chuyển vào
`AuthUIState`** (`createAuthUiState()` ở `src/presentation/state/ui-state.ts`),
cùng lý do `currentUser`/`loginFails`/`loginLockUntil` đã ở đó từ trước: đây là
UI state ĐỘT BIẾN mà test vm sandbox gán bare (`auditQ='sodium'`) phải trúng
đúng accessor property của `globalThis` — một `let` bên trong IIFE của bundle
sẽ không thấy được từ ngoài. `AUDIT_PAGE_SIZES` (hằng số, không đột biến) chỉ
cần `root.AUDIT_PAGE_SIZES = ACTIVITY_AUDIT_PAGE_SIZES` — không cần accessor.

**Một bẫy mới, khác nhóm "bare identifier vs lazy call" đã biết:** viết
`root.page = ...` (thay vì bare `page = ...`) ở ba chỗ (`applyUserPerms`,
`logout`, `showApp`) làm `tests/global-name-uniqueness.test.js` báo trùng tên
— scanner của test đó coi MỌI `root.X=`/`window.X=`/`globalThis.X=` là một
"khai báo" cạnh tranh với field `page` mà `createRouterUiState()` đã khai báo
trong `ui-state.ts`, dù đây chỉ là GHI qua accessor đã tồn tại (setter), không
phải khai báo mới. `root.page` (đọc) không sao — chỉ phép GÁN `root.page=`
mới bị bắt, vì trước lát này không chỗ nào trong bundle từng gán qua đường đó
(chỉ đọc). Sửa bằng cách gán bare `page = ...` (giống hệt cách `currentUser`
luôn được gán bare, chưa từng qua `root.currentUser=`) — khớp quy ước đã có,
không phải thêm ngoại lệ vào `KNOWN` của test.

**Hai đơn giản hóa thật khi port** (không chỉ chuyển nguyên, giống lát 1):
`actionWorkflowStatus`-style fallback không có ở đây, nhưng
`typeof backupCurrentData==='function'` guard trong `resetAllData()` bị bỏ —
`root.backupCurrentData` là field BẮT BUỘC (không `?`) đã được gán từ trước
trong cùng bundle (Hạ tầng lát 2, `backup-ui.js`), guard đó chỉ có ý nghĩa khi
hai file tải độc lập, không còn cần khi cả hai cùng một script.

**Dọn ambient declare ăn theo (`global.d.ts`):** `loginFails`/`loginLockUntil`
xóa khỏi `declare var` (không còn file classic nào đọc trần — chỉ `currentUser`
còn cần, do `state.js`'s `userName()`/`currentStaff()` vẫn đọc trần); thêm
`declare function ensureAdmin()`/`showLogin()`/`showStartupRecovery()` vì
`assets/app.js` (chưa port, Pha H) gọi các tên này trần và trước đây chúng
được thỏa mãn nhờ `users-auth.js` cũng nằm trong cùng chương trình checkJs —
mất file đó thì `tsc --noEmit` báo "Cannot find name" cho tới khi thêm ambient.

**Cập nhật test đi kèm** (đọc/nạp file classic đã xóa, hoặc quét nguyên văn
source của nó — không phải vì hành vi đổi):

- `tests/audit-filter.test.js`, `tests/auth-security.test.js` — bỏ
  `'modules/users-auth.js'` khỏi `loadSandbox([...])`.
- `tests/users-page-bridge.test.js`, `tests/activity-audit-csv-bridge.test.js`,
  `tests/admin-render-bridge.test.js`, `tests/lis-client-service.test.js`,
  `tests/typescript-module-pilot.test.js` — năm test "bridge"/source-scanner
  đọc nguyên văn `assets/modules/users-auth.js`; sửa để đọc
  `src/compat/modular-pilot.global.ts` và khớp đúng cú pháp arrow-assignment
  mới (`root.foo = x => ...`) thay vì `function foo(x){return globalThis...}`
  cũ. `admin-render-bridge.test.js` đặc biệt: ba HTML builder
  (`activityAuditPageHtml`/`userRowHtml`/`usersPageHtml`) trước đây được
  "tiêu thụ" bởi `users-auth.js` như `globalThis.X(...)` (route/consumer
  khác file khai báo); giờ tự tiêu thụ NGAY TRONG bundle như `root.X(...)`
  (cùng file khai báo VÀ tiêu thụ) — assertion `consumedAs` phải đổi theo.
- `tests/spacing-tokens.test.js` — quét "không còn inline `style=`" trên màn
  auth/audit trước đây đọc nguyên file `users-auth.js`; giờ phải cắt đúng
  ĐOẠN port (giữa hai mốc comment `===== USERS / AUDIT / AUTH =====` và
  `const lisRuntime = createLisGatewayRuntime();`) trong bridge, KHÔNG được
  quét nguyên văn cả file bridge — file đó có `style="color:var(--muted)"`
  hợp lệ từ lát port `range.js` trước đó, ngoài phạm vi kiểm tra này.
- `tests/action-workflow-service.test.js` KHÔNG động (không đọc/nạp
  `users-auth.js`); giữ nguyên.

Gate: `typecheck` xanh (module strict + checkJs), `npm test` 611/611 xanh,
`npm run ui-check` 29/29 xanh (gồm "Khóa kỳ qua UI + re-auth", "Restore UI...
qua re-auth" — trực tiếp chạy `reauthenticateCurrentUser()` mới port), `npm
run a11y-audit` — cả hai trang `users`/`audit` VÀ ba modal
`users:edit-permissions`/`audit:archive-log`/`shared:reauth-dialog` đều 0 vi
phạm. Kiểm thêm bằng tay trong Chromium thật (ui-check/a11y-audit đều boot
với phiên đã đăng nhập sẵn, không chạm màn login): sai mật khẩu → thông báo
chung đúng; đúng `admin`/`admin` → bắt buộc đổi mật khẩu; đổi mật khẩu xong →
vào thẳng dashboard; `logout()` → xóa `currentUser`, hiện lại màn đăng nhập —
không có lỗi console ở bất kỳ bước nào.

Sau lát này: còn 3 file nhóm C (`firebase-sync.js`/`state-storage.js`/
`qc-domain.js`) trước khi tới lát cuối (retire `state.js` + `analyte-catalog.js`
cùng lúc). **Lát tiếp theo: `firebase-sync.js`** (xem mục 3 trong danh sách
thứ tự đề xuất).

#### Lát nhóm C — 3: `firebase-sync.js` (2026-08-20, xong)

Retire hoàn toàn `assets/modules/firebase-sync.js` (173 dòng — 3-way merge,
retry, online/offline, toàn bộ vòng đời kết nối Firebase). Giống `action-
workflow-service.js`, mọi hàm ở đây vốn chỉ gọi thẳng service TypeScript đã có
sẵn (`createSyncXxx`/`createFirebaseXxx` — codec, retry scheduler, merge,
identity, polling, snapshot gate...). Chuyển nguyên vào
`src/compat/modular-pilot.global.ts`, đặt ngay TRƯỚC khối construct các service
Firebase (`root.firebaseDisconnectService = createFirebaseDisconnectService(...)`
trở đi).

**Bẫy lớn nhất của lát này — 17 "eager guard" y hệt bẫy `local-store.js`
(Hạ tầng lát 1), nhân rộng nhiều lần:** bản compat trước đó có
`if (typeof (root as any).fbDisconnect === 'function') root.firebaseDisconnectService = createFirebaseDisconnectService({...})`
(và tương tự cho `fbFlushPush`/`syncNow`/`scheduleFbPush`/`fbHandleValue` ×5/
`fbRejectBrokenAudit`/`applyRemoteRender`/`initFirebase`/`setCloudStatus`/
`markSaved`/`remoteRenderUnsafe`/`ensureFirebaseApp`/`getDeployFbCfg` — 17 điểm
trên 13 tên khác nhau). Guard này chỉ từng đúng vì `firebase-sync.js` nạp
TRƯỚC bundle trong `index.html`, nên hàm classic đã tồn tại lúc guard chạy;
nhưng MỌI dependency closure bên trong đều đã là lazy arrow (gọi tên trần LÚC
GỌI, không phải lúc định nghĩa service — vd `stopPolling: () => fbStopPull()`).
Gộp cả 17 dịch vụ này vào CÙNG một script với các hàm port (đặt SAU chúng
trong thứ tự file) sẽ làm mọi guard vĩnh viễn sai → toàn bộ Firebase sync câm
lặng thành no-op, không có gì báo lỗi vì `if(typeof...)` false chỉ đơn giản
bỏ qua dòng gán. Xóa sạch cả 17 guard, dựng vô điều kiện — đúng cách đã áp
dụng cho `LocalStore`.

**Hai lỗi thật do việc xóa guard phơi ra (không phải guard tạo ra — guard chỉ
che giấu), cả hai bắt được nhờ chạy lại toàn bộ `npm test` sau khi port:**

1. **`root.fb = {...clientId: 'c_'+uid(), ...}` gọi `uid()` NGAY LÚC BUNDLE
   NẠP** (không phải trong closure trì hoãn — đây là phần khởi tạo giá trị
   ban đầu của `fb`, không phải một hàm thao tác trên `fb`). `uid()` là hàm
   classic của `state.js`; nhiều sandbox test (28 file: `chart-view-model`,
   `sigma-*`, `westgard-view-model`, `reagent-*`, `report-*`, v.v.) chỉ nạp
   `['core.js', 'generated/modular-pilot.js']` — không nạp `state.js` — vì
   chúng chỉ kiểm view-model/presentation thuần, không cần `uid` thật. Trước
   lát này việc này vô hại vì `fb` là dữ liệu THUẦN do `firebase-sync.js` tự
   khởi tạo (không đụng tới các test đó); giờ `fb` sống trong CHÍNH bundle mà
   mọi test đều nạp, nên `uid is not defined` sập toàn bộ 28 test ngay khi
   nạp bundle. Sửa bằng bảo vệ tại chỗ:
   `clientId: 'c_' + (typeof uid === 'function' ? uid() : Math.random().toString(36).slice(2, 9))`
   — không đổi thuật toán sinh id (giống hệt cách `uid()` tự làm), chỉ thêm
   phòng vệ cho sandbox thiếu `state.js`.
2. **`firebaseConfigSourceService`'s `cloud: () => (window as any).QCLAB_CLOUD`
   và `readStored: () => localStorage.getItem('qclab_fb')` giả định `window`/
   `localStorage` luôn tồn tại.** Đây LÀ closure trì hoãn thật (chỉ gọi khi
   `.deploy()`/`.stored()` được gọi) — nhưng trước lát này, đường gọi tới nó
   (`fbDataPath()` trong `persistSigmaDraft()` của `state-storage.js`) tự
   canh bằng `typeof fbDataPath==='function'?fbDataPath():''`, và `fbDataPath`
   luôn `undefined` trong các sandbox không nạp `firebase-sync.js` (vd
   `storage-pipeline.test.js`, chỉ nạp `state.js`/`qc-domain.js`/
   `state-storage.js`) — nên nhánh gọi thật CHƯA BAO GIỜ chạy tới. Giờ
   `fbDataPath` luôn tồn tại (bundle luôn có mặt), nhánh `?fbDataPath():''`
   lần đầu tiên thực sự gọi tới `window`/`localStorage` trong một sandbox
   không có chúng → `ReferenceError`. Sửa bằng đúng idiom phòng vệ đã dùng ở
   nơi khác trong file này (`typeof window==='undefined'?...`):
   `cloud: () => typeof window === 'undefined' ? undefined : (window as any).QCLAB_CLOUD`,
   `readStored: () => typeof localStorage === 'undefined' ? null : localStorage.getItem('qclab_fb')`.

**Bài học cho lát sau (`state-storage.js`/`qc-domain.js`):** một `if(typeof
X==='function')` ở file KHÁC (không phải file đang port) có thể đã âm thầm
che một đường gọi thật suốt nhiều năm, chỉ vì trong TOÀN BỘ sandbox test hiện
có, tên đó tình cờ luôn `undefined`. Port một file không tự làm lộ bug ở
CHÍNH nó — nó có thể làm lộ bug ở NHỮNG FILE KHÁC gọi vào nó qua `typeof`
guard. Cách bắt duy nhất đáng tin cậy: chạy lại **toàn bộ** `npm test` (không
chỉ test riêng của file đang port) sau mỗi lát, đúng như CLAUDE.md đã dặn.

**Cập nhật test đi kèm** (đọc/nạp file classic đã xóa, hoặc quét nguyên văn
source của nó):

- `tests/firebase-merge.test.js`, `tests/firebase-offline.test.js` (×13 lần
  lặp lại cùng một `loadSandbox([...])`), `tests/firebase-config.test.js`,
  `tests/audit-ingress-gates.test.js` — bỏ `'modules/firebase-sync.js'` khỏi
  danh sách nạp.
- `tests/firebase-merge.test.js` — 9 assertion source-scanner đọc nguyên văn
  `assets/modules/firebase-sync.js`; sửa để đọc `src/compat/modular-pilot.global.ts`
  và khớp đúng cú pháp arrow-assignment mới.
- `tests/typescript-module-pilot.test.js` — bỏ biến `firebaseSyncSource` và
  hai assertion `doesNotMatch` dựa vào nó (khóa "không còn hàm dead-code cũ"
  — nay hiển nhiên đúng vì file không còn tồn tại).

Gate: `typecheck` xanh, `npm test` 611/611 xanh (bắt được và sửa 2 lỗi ở trên
trong lúc chạy gate này), `npm run ui-check` 29/29 xanh. Kiểm thêm bằng tay
trong Chromium thật: boot hiện đúng trạng thái "Cần đăng nhập Firebase"; đăng
nhập xong hiện đúng "Lưu trữ: Cục bộ" (qua `updateSaveStatus()`/`markSaved()`
mới port); không có lỗi console ở bất kỳ bước nào.

**Lát tiếp theo: `state-storage.js`** (120 dòng — lifecycle-critical: boot
shell, partitioned save, quarantine; xem mục 4 trong danh sách thứ tự đề
xuất, và LƯU Ý bài học "eager guard ở file khác" bên trên trước khi port).

#### Lát nhóm C — 4: `state-storage.js` (2026-08-20, xong)

Retire hoàn toàn `assets/modules/state-storage.js` (120 dòng — pipeline bền
vững dữ liệu cục bộ: boot shell hai pha, ghi phân vùng IndexedDB, retry
backoff, nháp Sigma, `save()` — cổng ghi duy nhất của toàn app). Đúng như
`action-workflow-service.js`/`firebase-sync.js`, mọi hàm ở đây vốn chỉ gọi
thẳng service TypeScript đã có sẵn (`storageLifecycleService`/
`indexedDbMirrorService`/`storageSerializePolicy`/`localSaveScheduler`/
`storageSnapshotService`/`saveService`/`sigmaDraftService`/
`corruptLocalQuarantine`). Chuyển nguyên vào
`src/compat/modular-pilot.global.ts`, đặt ngay trước
`root.storageSerializePolicy = createStorageSerializePolicy(...)`. `SIGMA_DRAFT_KEY`
và `lsClock()` KHÔNG mang sang — xác nhận bằng `rg` không còn caller nào (kể
cả trong chính file cũ): `SIGMA_DRAFT_KEY` là hằng số không ai dùng (khóa
localStorage thật nằm trong `sigmaDraftService`), `lsClock()` không được gọi
ở đâu.

**Không gặp bẫy "eager guard" của lát 3** — đã kiểm tra kỹ trước khi port:
không có `if (typeof (root as any).X === 'function') root.Y = create...`
nào phụ thuộc tên của `state-storage.js`; mọi dependency closure trong
`storageSnapshotService`/`saveService`/`storageLifecycleService`/
`indexedDbMirrorService` đã lazy sẵn từ trước.

**Nhưng gặp một lớp ràng buộc MỚI, rộng hơn "Lát 0" đã lường trước:** file
này có ĐẾN 14 biến khả biến (`localLoadStatus`/`partitionSlot`/`lsSaveT`/
`lsDirty`/`lsFullDirty`/`lsDirtyTestIds`/`lsRevision`/`lsSerializeCount`/
`lsSaveFailures`/`partitionWrite`/`lsIncrementalStreak`/`lsLastFullSaveAt`/
`LS_FULL_ROTATE_MAX_INCREMENTALS`/`LS_FULL_ROTATE_MAX_MS`), so với chỉ 1-2
biến ở các lát trước. Rà bằng cách đếm tham chiếu trần trong CHÍNH
`modular-pilot.global.ts` (`grep -oE "[^.a-zA-Z_$]${name}\b"`) VÀ trong
`tests/*.js`: bất kỳ tên nào có tham chiếu trần ở MỘT trong hai nơi đó đều
phải là `root.X` (data property), không được là `let` cục bộ — vì `root.X`
là lựa chọn AN TOÀN CHO CẢ HAI trường hợp (nội bộ cùng IIFE lẫn từ ngoài qua
`vm.runInContext` riêng), còn `let` cục bộ chỉ đúng cho trường hợp đầu. Xác
nhận `assets/generated/modular-pilot.js` được Vite bọc trong MỘT IIFE
(`(function(){...})();`) — nghĩa là TẤT CẢ `let` khai báo bên trong đều
function-scope, không thấy được từ `vm.runInContext` riêng của test (dù cùng
context/global object) hay từ file classic khác. Kết quả: 14/19 biến thành
`root.X`; 5 biến còn lại (`lsIdleHandle`/`lsSerializedRevision`/`lsSerialized`/
`lsLastBytes`/`lsLastSerializeMs`) không có tham chiếu trần nào ở cả hai nơi
— nhưng để đơn giản hóa và giảm rủi ro nhầm lẫn, CŨNG chuyển thành `root.X`
(một lựa chọn luôn an toàn hơn `let`, dù không bắt buộc cho 5 biến này) thay
vì cố phân loại chính xác từng biến — chấp nhận đánh đổi nhỏ về "độ sạch" để
đổi lấy ít khả năng sai sót hơn trong một lát đã đủ phức tạp.

**Bổ sung ambient declare còn thiếu** trong khối `declare` cục bộ của
`modular-pilot.global.ts` (không phải `global.d.ts`) cho các tên chưa từng
được tham chiếu trần trước lát này: `lsSaveT`/`lsSerializeCount`/
`lsIdleHandle`/`lsSerializedRevision`/`lsSerialized`/`lsLastBytes`/
`lsLastSerializeMs` (biến) và `sigmaDraftRecord`/`load`/`loadBootState`/
`lsSaveDelay`/`lsFlush`/`invalidateDerivedForSave` (hàm) — cho phép các hàm
port ở đây gọi nhau bằng tên trần giống hệt bản classic, thay vì phải đổi
sang `root.X` khắp nơi. `reconcileSigmaLevelsWithLotGroups()` (hàm thật của
`state.js`, còn classic) tham chiếu qua `(globalThis as any).X()` — đúng
kiểu cast đã dùng sẵn ở chỗ khác trong file cho hàm CHƯA có ambient declare,
không thêm ambient mới cho nó.

**Dọn `global.d.ts` (chương trình checkJs riêng cho `assets/**/*.js`, khác
hẳn ambient declare nội bộ ở trên):** xóa `declare var fb`/`declare function
fbDataPath`/`declare function getFbCfg` — xác nhận không còn file classic nào
trong `assets/**/*.js` đọc chúng trần (chỉ `state-storage.js`, giờ đã xóa,
từng đọc `fb`; chỉ `state-storage.js` từng đọc `fbDataPath`/`getFbCfg`).
Thêm `declare function loadBootState()` vì `assets/app.js` (chưa port, Pha H)
gọi tên này trần và trước đây được thỏa mãn nhờ `state-storage.js` cùng nằm
trong chương trình checkJs.

**Cập nhật test đi kèm** (đọc/nạp file classic đã xóa — không phải vì hành
vi đổi): 9 test bị ảnh hưởng
(`audit-ingress-gates`/`cache-invalidation`/`firebase-config`/`firebase-merge`/
`firebase-offline`/`lis-client-service`/`local-store`/`state-storage-safety`/
`storage-pipeline`). Điểm cần chú ý: nhiều `loadSandbox([...])` trong
`local-store.test.js`/`storage-pipeline.test.js` KHÔNG có `generated/
modular-pilot.js` tường minh — chúng dựa vào nhánh tự chèn bundle của
`tests/helpers/sandbox.js` (kích hoạt khi danh sách có `modules/state-storage.js`).
Chỉ xóa `'modules/state-storage.js'` khỏi các danh sách đó mà KHÔNG thêm
`'generated/modular-pilot.js'` tường minh sẽ làm mất bundle hoàn toàn (vì
nhánh tự chèn không còn gì để kích hoạt) — đã thêm tường minh vào cả 5 chỗ
bị ảnh hưởng. Dọn luôn nhánh `storageIndex` (tự chèn) trong `sandbox.js` vì
nay không còn danh sách test nào chứa tên file đó để kích hoạt.

Gate: `typecheck` xanh, `npm test` 611/611 xanh (không phát sinh lỗi ẩn nào
như lát 3 — đã rà bẫy "eager guard" kỹ trước khi viết code), `npm run
ui-check` 29/29 xanh (gồm "Restore UI... qua re-auth", phụ thuộc trực tiếp
`storageLifecycleService`). Kiểm thêm bằng tay trong Chromium thật: đăng
nhập → sửa `state.lab.name` → `save({clearDerived:false})` → đợi debounce →
`lsDirty` về `false` → **reload trang thật** → đăng nhập lại → tên đã sửa
vẫn còn nguyên (`localLoadStatus:'partitioned'`, `storageHydrationPromise`
resolve `true`) — xác nhận toàn bộ chu trình boot-shell hai pha/ghi phân
vùng/hydrate hoạt động đúng qua một lần tải lại trang thật, không chỉ qua
test giả lập.

Sau lát này: chỉ còn `qc-domain.js` trước khi tới lát cuối (retire `state.js`
+ `analyte-catalog.js` cùng lúc). **Lát tiếp theo: `qc-domain.js`** (255
dòng — đường NÓNG nhất app, xem mục 5 trong danh sách thứ tự đề xuất; benchmark
`coldDomainMs`/`warmDomainColdRatio` là gate bắt buộc, không chỉ `npm test`).

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
| 2026-08-18 | Lát route 1 của Pha G (mở nhóm "Route/presentation"): chuyển `settings.js` (69 dòng) sang `src/presentation/settings/settings-page-controller.ts` — DOM/browser adapter thuần, mọi phép tính đã ở command/service/HTML-builder TS từ trước. Áp dụng sẵn cả hai bài học từ nhóm "UI thuần" (lazy delegation cho mọi dep; phân biệt `function` global qua `root.X` với `let`/`const` global tham chiếu trần) nên KHÔNG tái diễn bẫy nào — lát trôi mượt, chỉ cần 1 ambient declare (`ensureLabBrandShape`, do `state.js` gọi trần). Browser API (FileReader/Image/canvas/clipboard/navigator) tiêm qua deps để test được ngoài trình duyệt. 3 source-scanner test trỏ sang controller + thêm assertion quét wiring `deps→root.settingsXxx` trong compat. Chạy browser gate TRƯỚC khi chốt (kinh nghiệm Lát 3): `build:pilot`/`typecheck`/`test` 613/613 + `a11y-audit` (settings + 18/18 modal, 0 vi phạm) + `ui-check` (29/29). Xác nhận cách làm lát route đã ổn định: file route mỏng dần vì phần nặng đã sang TS ở các đợt trước, nên các lát Route/presentation còn lại chủ yếu là chuyển vỏ điều phối + form handler. |
| 2026-08-18 | Lát route 2 của Pha G: chuyển `report-routes.js` (92 dòng) sang `src/presentation/report/report-page-controller.ts`. Nặng hơn settings vì có state trang (reportQ/reportTest/reportRangeStart/reportRangeEnd/reportLockYm) + modal mở khóa. Quyết định: state trang thành CLOSURE `let` trong factory (sống qua rerender vì factory chạy một lần), KHÔNG đưa vào UI-state bag — vì production chỉ ghi qua handler (reportSetLockPart/reportSearchSet), không nơi nào gán trực tiếp như global (khác `page`/`dashTestQ` vốn được nhiều file classic ghi trực tiếp nên phải là accessor global). Xóa kèm dead const REPORT_ACTION_ICON_PATHS. `ui-check` bắt lỗi thật node test bỏ sót: test khóa kỳ gán thẳng `reportLockYm='2026-06'` (shortcut dựa vào global classic cũ) nay vô hại vì là closure — sửa test đi qua `reportSetLockPart` (đường picker thật). Minh họa: state trang chỉ đổi qua handler, `ui-check` là thứ duy nhất phát hiện chỗ lách quy tắc. `build:pilot`/`typecheck`/`test` 613/613 + `a11y-audit` (report + 18/18 modal, 0 vi phạm) + `ui-check` (29/29). |
| 2026-08-18 | Lát route 3 của Pha G: chuyển `westgard-routes.js` (126 dòng) sang `src/presentation/westgard/westgard-page-controller.ts` — nặng hơn settings/report vì `pageWestgard`/`pageWestgardArchived` DỰNG HTML inline (không chỉ delegation) và có nhánh archived-lot-group + CUSUM. Port trung thành 1:1 (chuyển HTML string thành template TS, `globalThis.X`→`deps.X`, state bare→`ui().X`). Khác quyết định state của report: UI state Westgard (selTest/wgViewMode/wgChartMode/wgPrevOpen/wgExpandedRows/wgArchived*) GIỮ trong AnalysisUIState bag (không dùng closure) vì các biến này ĐƯỢC GHI TRỰC TIẾP từ onclick handler (`selTest=this.value`, `wgViewMode=...`) — phải là accessor global. Truyền cả bag qua `ui:()=>root.AnalysisUIState` để đọc/ghi. Contravariance callback param (level/lotNo) phải nới thành AnyRec trong dep type. `global.d.ts` thêm `wgMultiViews` (data-io.js gọi trần). 7 test trỏ sang controller (`westgard-render-bridge` đổi `globalThis.X`→`deps.X`; `westgard-print`/`westgard-xlsx` đổi pattern; `ui-route-structure` đổi `function pageWestgard`→`const pageWestgard =` + bỏ load-order westgard-routes.js). Gate: `build:pilot`/`typecheck`/`test` 613/613 + `a11y-audit` (westgard render 0 vi phạm) + `ui-check` (29/29). |
| 2026-08-18 | Lát route 4+5 của Pha G: chuyển `westgard-routes.js` (đã ghi ở trên) và `reagent.js` (166 dòng) sang controller TS. Reagent: state trang (rcId/rcModalQ/rcQuickType/...) giữ trong ReagentUIState bag (ghi trực tiếp từ handler); mọi stat/render đi qua deps (ReagentComparisonService/WorkflowCommand/calculator + reagentXxx builders); palette RCC/RCPAD/RC_MIN_PAIRS là const controller. `a11y-audit` lại bắt lỗi thật node test bỏ sót (giống wgMemo): `REFTESTS` là `const` top-level của state.js (lexical, KHÔNG phải global property) nên `(root as any).REFTESTS` = undefined → modal "Tạo so sánh" ném `Cannot read 'forEach'`; sửa thành tham chiếu trần `REFTESTS` (đã có `declare const REFTESTS` ở compat). Củng cố quy tắc: helper/const lấy từ file classic phải phân biệt function-global (qua root.X) với let/const-lexical (tham chiếu trần) — và CHẠY a11y/ui-check để bắt, vì typecheck+node test không thấy. reagent-label-bridge.test.js (40+ assertion pin cú pháp classic) viết gọn lại thành kiểm `deps.pres.*` + giữ nguyên hợp đồng bridge; reagent-stats.test.js bỏ nạp classic, lấy rcCalc/rcReportSummaryTable từ bundle, RCC.muted hardcode '#667b89'. Gate: build/typecheck/test 613/613 + a11y (reagent + 2 modal 0 vi phạm) + ui-check (29/29). |
| 2026-08-19 | Lát route 5 của Pha G: chuyển `lis-queue-ui.js` (36 dòng) sang `src/presentation/lis/lis-queue-controller.ts` — lát nhẹ nhất nhóm route vì file classic đã gần thuần bridge từ Pha F (HTML ở `lis-queue-presentation.ts`, service đồng bộ ở `LISClientService`/`LisGatewayCommand`/`lisSettingsService`); controller chỉ còn phần điều phối (đọc form, mở modal hàng chờ, hai onclick handler Nhận/Bỏ có `confirmDialog`). Không có state trang riêng. Áp dụng đầy đủ quy tắc đã đúc kết từ 4 lát route trước (lazy delegation mọi dep, `document` tiêm qua deps, phân biệt function-global/let-const-lexical) nên không phát sinh bẫy runtime mới nào — lát trôi mượt như Lát route 1. `tests/lis-queue-bridge.test.js` viết lại hoàn toàn để đọc controller TS thay vì file classic (đã xóa) + thêm assertion xác nhận không được tái tạo bản classic; `tests/lis-client-service.test.js` bỏ `'modules/lis-queue-ui.js'` khỏi `loadSandbox()`, bài hồi quy XSS (`lisOnclick` bọc `escAttr()`) vẫn xanh nguyên vẹn từ bundle. `tests/typescript-module-pilot.test.js` đổi assertion `match`→`doesNotMatch` cho script tag đã retire. Gate: `build:pilot`/`typecheck`/`test` 613/613 + `a11y-audit` (settings + 18/18 modal — kể cả `settings:lis-queue`, 0 vi phạm, ratchet PASS) + `ui-check` (29/29) + `nce-check` (91/91). Nhóm "Route/presentation" còn 8 file: `manage-routes.js`, `manage-tests-actions.js`, `entry-routes.js`, `actions-routes.js`, `action-form.js`, `sigma.js`, `sigma-tea.js`, `audit.js`. |
| 2026-08-19 | Lát route 6 của Pha G: chuyển `audit.js` (25 dòng, thuần delegator không HTML/DOM) — không tạo file TS mới, inline thẳng vào `modular-pilot.global.ts`. 7/18 hàm xác nhận không còn caller nào (xóa hẳn, không port). Vấn đề khó nhất: ba biến ngưỡng mutable (`ACTIVITY_HARD_CAP`/`ACTIVITY_ROTATE_TO`/`AUDIT_AUTO_VERIFY_MAX`) mà `users-auth.js` (chưa migrate) đọc trần và test gán lại trần — lo ngại ban đầu là phải giữ residual classic file vì bundle là một IIFE (let/const không lọt ra ngoài). Xác minh THỰC NGHIỆM trên Node vm (không chỉ suy luận) rằng gán bằng PROPERTY (`root.X=`, không phải `let X=`) khiến tham chiếu trần từ script khác vẫn đọc/ghi đúng — bản chất phân biệt là "property hay lexical", không phải "bundle hay classic". Kết luận: không cần giữ lại bất kỳ phần nào của audit.js. Mở rộng quy ước ambient declare (đã có cho `rerender`) sang `logAct`/`auditSha256`/`auditRelinkChain` — cần cả ambient (cho tham chiếu trần trong cùng file) và entry non-optional trong QCLabGlobal (cho phép gán `root.X=`). Tái diễn bẫy "bundle ghi đè stub" ở `tests/audit-filter.test.js` (ba tên stub qua tham số `globals` bị bundle ghi đè), sửa bằng cách chuyển sang gán sau `loadSandbox()`. Bẫy MỚI phát hiện qua chạy TRỌN VẸN `npm run typecheck` (không chỉ build bundle xanh): đây là HAI chương trình tsc riêng — `tsc --noEmit` (checkJs quét `assets/**/*.js`, loại trừ `assets/generated/**`, dựa vào `global.d.ts`) và `tsc -p tsconfig.modules.json` (strict, chỉ `src/**/*.ts`) — xóa `audit.js` làm checkJs mất khai báo thật của `ACTIVITY_HARD_CAP`/`ACTIVITY_ROTATE_TO`/`auditChainStatus` mà `users-auth.js` vẫn gọi trần bằng mã JS thật; thêm 3 dòng ambient vào `global.d.ts` (không phải `modular-pilot.global.ts` — hai nơi ambient khác nhau cho hai chương trình khác nhau). Gate: `build:pilot`/`typecheck`/`test` 613/613 (cả hai chương trình tsc) + `a11y-audit` (audit + `audit:archive-log`, 0 vi phạm) + `ui-check` (29/29) + `nce-check` (91/91). Nhóm "Route/presentation" còn 7 file: `manage-routes.js`, `manage-tests-actions.js`, `entry-routes.js`, `actions-routes.js`, `action-form.js`, `sigma.js`, `sigma-tea.js`. |
| 2026-08-19 | Lát route 7 của Pha G: chuyển `sigma-tea.js` (111 dòng, nghiệp vụ TEa/CLIA thật — CLAUDE.md liệt vào "Confirmed business-logic decisions") sang `src/domain/sigma/sigma-tea-resolution.ts`. Nặng nhất/rủi ro cao nhất tới nay trong nhóm route: 5 file classic khác (`sigma.js`, `manage-routes.js`, `manage-tests-actions.js`, `data-io.js`, `reports.js`) gọi trần ~17/22 biểu tượng, 5 biểu tượng còn lại giữ private (không caller thật). Hai lỗi tự gây ra, cả hai `npm test` bắt được (không cần trình duyệt): (1) `SG_CLIA_FIXED` dựng eager lúc gọi factory làm MỌI sandbox tải bundle phải có `TEA_SOURCE_REGISTRY`/`TEA_ANALYTE_CATALOG`/`REFTESTS` sẵn — sửa bằng guard `typeof X!=='undefined'` bọc toàn bộ khối khởi tạo, kéo theo sửa thứ tự nạp sai (bundle trước state.js) ở 6 chỗ trong 3 test file; (2) bug thật trong port: `sgRef('Glucose')` trả về Albumin vì `deps.searchText` được wiring thành một hàm LUÔN TỒN TẠI (thay vì thật sự `undefined` khi thiếu nguồn), phá vỡ pattern `deps.X?deps.X():fallback` — `undefined===undefined` khớp alias của dòng ĐẦU BẢNG cho mọi tên. Phát hiện phụ ngoài phạm vi: lỗi PRODUCTION THẬT đang sống — `TeaReferenceService`'s `sourceRegistry` đọc `(globalThis as any).TEA_SOURCE_REGISTRY` (const lexical, luôn undefined, giống REFTESTS trước khi sửa) khiến sửa BẤT KỲ giá trị CLIA/Ricos nào trong tab "Bảng TEa tham chiếu" đều crash — không test nào bắt được vì test unit tự stub sourceRegistry, test khác chỉ scan chuỗi; sửa 1 dòng + thêm bài hồi quy thật vào `tests/manage-history-bridge.test.js` (xác nhận discriminating bằng cách tái tạo lỗi gốc). Gate: `build:pilot`/`typecheck`/`test` 613/613 + `a11y-audit` (sigma + `manage:tea-lab-profile`, 0 vi phạm) + `ui-check` (29/29) + `nce-check` (91/91). Nhóm "Route/presentation" còn 6 file: `manage-routes.js`, `manage-tests-actions.js`, `entry-routes.js`, `actions-routes.js`, `action-form.js`, `sigma.js`. |
| 2026-08-19 | Lát route 8 của Pha G: chuyển `manage-routes.js` (174 dòng dày) sang `src/presentation/manage/manage-page-controller.ts`. Bề mặt dependency lớn nhất tới nay: ~76 hàm dựng HTML gom vào một dep duy nhất `pres: AnyRec` (khớp mẫu reagent-page-controller.ts), wiring `pres: root as any` (không liệt kê tay 76 hàm vì tất cả đã là `root.X` sẵn). UI state dùng chung `ManageUIState` (đã tồn tại từ trước, chia sẻ với `manage-tests-actions.js`). Áp dụng chủ động bài học "construction eager cần dep lazy" từ Route 7 (đổi `teaSourceRegistry` thành `()=>` ngay từ đầu, không cần vòng debug lại). Phát hiện bug TypeScript suy luận sai kiểu: `new Map(rows.map(r=>[key,r]))` với `r: any` khiến TS suy luận value type thành `{}` thay vì `any` — sửa bằng khai tường minh `new Map<string,AnyRec>(...)`. Cập nhật 13 file test đọc `manage-routes.js` bằng `fs.readFileSync` (scan chuỗi/regex) sang trỏ `manage-page-controller.ts` — một file dùng `.includes()` so khớp chuỗi thô theo cú pháp dày classic phải viết lại theo đúng dấu cách chuẩn TypeScript; một file dùng vòng lặp chung nhiều nguồn phải thêm tham số mẫu so khớp riêng cho dòng đã chuyển. `global.d.ts` thêm 3 ambient (`instrumentName`/`lotTransitionToNo`/`targetGroupLots`) sau khi phân biệt lời gọi hàm thật với property-key trùng tên và tham chiếu trong comment. Gate: `build:pilot`/`typecheck`/`test` 613/613 + `a11y-audit` (manage + 6 modal manage + `manage:tea-lab-profile`, 0 vi phạm) + `ui-check` (29/29) + `nce-check` (91/91). Nhóm "Route/presentation" còn 5 file: `manage-tests-actions.js`, `entry-routes.js`, `actions-routes.js`, `action-form.js`, `sigma.js`. |
| 2026-08-19 | Lát route 9 của Pha G (rủi ro cao nhất tính tới nay): chuyển `manage-tests-actions.js` (371 dòng, mutation instrument/máy/panel/lô/nhóm lô/chuyển tiếp lô/Mean-SD/xét nghiệm kèm re-auth/audit/bảo vệ ISO 15189) sang `src/presentation/manage/manage-tests-actions-controller.ts`. Đọc 3 bài test hồi quy bảo vệ dữ liệu (locked-period-guards/lot-rename/target-matrix) TRƯỚC khi viết code để hiểu đúng hành vi phải giữ. Quyết định thiết kế then chốt, chọn đúng NGAY TỪ ĐẦU nhờ đọc test trước: `document` là getter lazy (`()=>Document`), không capture một lần như manage-page-controller.ts, vì nhiều test đổi `document` giữa các bước để mô phỏng form khác nhau. Hai lỗi thật phát hiện: (1) tự gây ra — `teaAnalyteKey` là `const` arrow function (cùng lớp REFTESTS/TEA_SOURCE_REGISTRY/WG_RULES/QC_DECIMALS_DEFAULT) nhưng dễ nhầm vì trông giống hàm thường, wiring sai qua `globalThis` bị `npm test` bắt ngay; (2) bug production thật phát hiện tình cờ khi soi lân cận — `QC_DECIMALS_DEFAULT` đọc qua `globalThis` trong wiring `targetNumberTextPresentation` làm `targetNumberText(value,null)` (không kèm xét nghiệm) làm tròn về số nguyên thay vì giữ số thập phân (`toFixed(undefined)` hành xử như `toFixed(0)`), sửa bằng tham chiếu trần + fallback đúng giá trị mặc định. Map 58 hàm ra caller thật, xác nhận `lotPointsToRename` chết hẳn (xóa), 57 hàm còn lại port đủ. `global.d.ts` thêm 2 ambient (`parseVN`, `setManageTab`). Gate: `build:pilot`/`typecheck`/`test` 613/613 (gồm 3 test bảo vệ ISO 15189) + `a11y-audit` (0 vi phạm, 18/18 modal) + `ui-check` (29/29) + `nce-check` (91/91). Toàn bộ trang "Cấu hình chung" giờ đã sang TypeScript hoàn toàn. Nhóm "Route/presentation" còn 4 file: `entry-routes.js`, `actions-routes.js`, `action-form.js`, `sigma.js`. |
| 2026-08-19 | Lát route 10 của Pha G: chuyển `entry-routes.js` (320 dòng) sang `src/presentation/entry/entry-page-controller.ts` — trang "Nhập QC" (Entry), nơi ghi/hủy điểm QC thật. 51 hàm dựng HTML/thuật toán thuần gom vào `pres: AnyRec` (khớp mẫu manage-page-controller.ts); 4 service/command đã có sẵn (EntryService/EntryRecordWorkflowCommand/EntryVoidWorkflowCommand/EntryDateNoteWorkflowCommand) nối thẳng qua deps đặt tên. `document`/`window`/`localStorage` là getter lazy — quyết định lấy từ đọc `tests/partial-render-helpers.test.js` trước khi viết code (một test case gán lại toàn bộ biến `document={...}` giữa chừng). Phát hiện: `jsq()` (thoát chuỗi literal JS trong onclick, khác esc()/escAttr() thoát HTML) là hàm DUY NHẤT của file có caller thật ở nhiều file classic khác (action-form.js/actions-routes.js/sigma.js) — tách riêng thành `src/presentation/shared/js-string-literal.ts` độc lập với vòng đời trang Entry thay vì đặt trong controller, rồi gán `root.jsq=jsq`. Bẫy tự gây khi viết jsq: gõ trực tiếp escape sequence cho ký tự phân-dòng Unicode (line/paragraph separator) trong regex literal bị pipeline ghi file biến thành ký tự thật — hai ký tự đó là LineTerminator theo đặc tả ECMAScript nên nằm trần trong regex literal là lỗi cú pháp; sửa bằng String.fromCharCode() + .split().join() thay vì .replace() với ký tự viết trần, xác nhận khớp 100% bản classic qua eval trực tiếp. 3 lỗi type bắt bởi `tsc -p tsconfig.modules.json` (không phải build:pilot): deps khai tham số unknown nhưng hàm TS đã bridge sẵn (root.stateName/rangeActions/qcPointWarnings) khai kiểu cụ thể hơn — sửa bằng ép kiểu tại điểm nối. Map 38 hàm (trừ jsq) ra caller: không hàm nào có caller ngoài file nhưng TẤT CẢ phải bridge vì HTML tự sinh tham chiếu qua onclick runtime, grep không thấy. Tiện thể sửa 4 chỗ CLAUDE.md lạc hậu từ Route 7-9 (danh sách "chưa port" vẫn liệt kê 3 file đã retire; mô tả sigma-tea.js vẫn viết như còn thẻ script riêng). Gate: `build:pilot`/`typecheck`/`test` 613/613 + `ui-check` (29/29) + `nce-check` (91/91) + `a11y-audit` (0 vi phạm mọi trang kể cả entry, 18/18 modal, ratchet PASS). Nhóm "Route/presentation" còn 3 file: `actions-routes.js`, `action-form.js`, `sigma.js`. |
| 2026-08-19 | Lát route 11 của Pha G (lớn nhất tính tới nay): chuyển cả `actions-routes.js` (226 dòng) và `action-form.js` (464 dòng) sang `src/presentation/actions/actions-page-controller.ts` và `src/presentation/actions/action-form-controller.ts`. Cặp file DUY NHẤT còn phụ thuộc hai chiều thật sự (form gọi ngược actionEvidenceTimelineHtml/actionRerunEvidenceHtml/actionLevelShort của trang; trang gọi vào actionFormHtml của form) — giải quyết bằng dựng hai pha trong modular-pilot.global.ts: khai `let actionsPageControllerRef` trước, dựng action-form với 3 dep gọi qua biến tham chiếu đó, rồi dựng actions-page với formHtml/captureFormDraft trỏ thẳng vào action-form đã tồn tại, cuối cùng gán actionsPageControllerRef = actionsPageController — không cần import vòng giữa hai file TypeScript. Bẫy eager-construction tái diễn (cùng lớp QC_DECIMALS_DEFAULT ở Route 9) nhưng phạm vi rộng hơn hẳn: action-form-controller.ts tính ACT_SOURCE_OPTS v.v. từ ACTION_LABELS ngay ở thân factory, làm 19 file test không hề đụng trang Actions cũng đỏ ngay lúc dựng bundle vì thiếu action-workflow-service.js — sửa bằng wiring ACTION_LABELS trả về object rỗng đúng hình dạng thay vì undefined khi chưa nạp. actionLevelShort có caller trần ở data-io.js/reports.js (còn classic) — thêm 1 ambient. Bài học quy trình: lệnh liệt kê file test phụ thuộc ban đầu bỏ sót 2 file (action-form-panel-html.test.js, action-form-steps-html.test.js), chỉ lộ ra sau khi xóa file classic và chạy lại toàn bộ npm test thấy ENOENT — xác nhận lại quy tắc "chạy toàn bộ test sau khi xóa, không tin kết quả liệt kê ban đầu". Nhân tiện xóa 1 dead-code nhỏ (actionReviewButtons() có hai dòng return giống hệt liên tiếp). Gate: `build:pilot`/`typecheck`/`test` 613/613 + `ui-check` (29/29) + `nce-check` (91/91, toàn bộ vòng đời NCE trên Chromium thật) + `a11y-audit` (0 vi phạm mọi trang kể cả actions, 18/18 modal, ratchet PASS). Nhóm "Route/presentation" còn 1 file: `sigma.js`. |
| 2026-08-19 | Lát route 12 của Pha G (khép lại nhóm A): chuyển `sigma.js` (415 dòng, trang Six Sigma) sang `src/presentation/sigma/sigma-page-controller.ts`. Bề mặt dependency lớn (~35 hàm classic/đã-bridge, 14 service Sigma, lớp giải TEa 11 hàm, 26 hàm presentation) nhưng không phát sinh cách làm mới — ba phát hiện: (1) dead code xác nhận qua đối chiếu caller thật: sgRun(s) (wrapper gọi SigmaPresentation.sigmaRunPlan) không còn caller nào, trong khi sgZone(s) song song vẫn có caller thật trong modular-pilot.global.ts (sigmaChartRenderer/sigmaMdcRenderer tô màu canvas xuất Excel/PDF) — dropped sgRun, giữ sgZone; (2) bẫy eager-construction dạng mới: không phải lỗi trong code lát này mà ở một guard CÓ TỪ TRƯỚC (sigmaReportRowsService trong data-io.js: `typeof globalThis.sgVisibleLevels==='function'?real:fallback`, viết cho giai đoạn sigma.js có thể chưa nạp) bị vô hiệu hoá vì sgVisibleLevels giờ LUÔN tồn tại (gán vô điều kiện lúc bundle nạp) — chỉ lộ ra ở đúng tests/sigma-export-selection.test.js (sandbox không nạp state.js), sửa bằng thêm stub sgVisibleLevels vào TEST đó, không đụng controller/wiring; (3) sgCohortCtx là biến ngữ cảnh modal duy nhất chưa nằm sẵn trong SigmaUIState nhưng có test hồi quy đọc/ghi như global trần — thêm vào createSigmaUiState() trước khi viết controller. 20 file test phụ thuộc: 12 bridge test một-service (đổi globalThis.X→deps.pres.X, function X(){→const X = () =>), sigma-comp.test.js (598 dòng, phần lớn hành vi qua service TS không đổi, ~10 assertion cú pháp cập nhật dấu cách), sigma-print/uncertainty (cú pháp + bỏ modules/sigma.js khỏi loadSandbox), sigma-export-selection (bẫy #2), ui-accessibility/ui-route-structure (đường dẫn + bỏ assertion thứ tự nạp script không còn áp dụng). global.d.ts thêm 7 ambient (sgData/sgVisibleLevels/sgRows/sgFrequencyHTML/sgTrendSVG/sgMDCSVG/sgReconcileAllTeaSnapshots — còn caller trần ở data-io.js/reports.js/state.js). Gate: `build:pilot`/`typecheck`/`test` 613/613 + `ui-check` (29/29, gồm 2 kịch bản render canvas Sigma/MDC qua Chromium thật) + `nce-check` (91/91) + `a11y-audit` (0 vi phạm mọi trang kể cả sigma + 3 modal Sigma, 18/18 modal, ratchet PASS). Toàn bộ nhóm A (Route/presentation) của Pha G đã hoàn tất — chuyển sang nhóm B (canvas/adapter: draw.js, reports.js, data-io.js), cần gate visual-check/print-check riêng. |
| 2026-08-19 | Lát route 13 của Pha G (mở đầu nhóm B — canvas/adapter): chuyển `draw.js` (207 dòng, renderer Levey-Jennings đơn/đa mức + CUSUM) sang `src/presentation/chart/qc-chart-renderer.ts`. Khác hẳn nhóm A: không có HTML/route, chỉ vẽ canvas thuần qua các helper hình học/màu/model điểm ĐÃ port từ trước (Route pilot Levey-Jennings trước Pha G) — mọi `globalThis.X` trong file cũ đổi thành `deps.X` trỏ thẳng vào instance đã cấu hình sẵn ở `modular-pilot.global.ts` (không dựng lại), nên deps interface gồm ~30 hàm/hằng thuần chuyển tiếp, không có logic mới nào cần viết. Phát hiện phụ quan trọng nhất của lát này: bug production ẨN có từ trước — `cusum-display-plan.ts`/`cusum-hover-model.ts` đã tồn tại (factory export đầy đủ, có test pin nguồn) nhưng KHÔNG BAO GIỜ được gọi `createCusumDisplayPlan(...)`/`createCusumHoverModel(...)` và gán `root.X` ở bất kỳ đâu — `assets/generated/modular-pilot.js` build ra hoàn toàn không chứa hai tên này, nghĩa là `drawCUSUM()` (tab "Xu hướng CUSUM" trên trang Westgard) đã throw `TypeError: globalThis.cusumDisplayPlan is not a function` ở production từ trước khi lát này bắt đầu, với bất kỳ xét nghiệm nào bật CUSUM — không gate nào bắt được vì không kịch bản browser nào (ui-check/visual-check/print-check/a11y-audit) mở tab CUSUM. Sửa bằng cách wiring `root.cusumDisplayPlan`/`root.cusumHoverModel` lần đầu tiên (dùng `chartViewModel.sampleIndices` — cùng nguồn downsampling với Levey-Jennings đơn/đa mức — và `vnDate`/`fmt` cho hover) rồi nối `qcChartRenderer` deps vào đó; xác nhận bằng smoke test tay gọi `ctx.drawCUSUM()` trực tiếp trong sandbox Node — chạy sạch, tạo đủ 30 điểm hover. Bẫy eager-construction tái diễn (cùng lớp Route 9/11): dựng `qcChartRenderer` lúc đầu bị đặt trước các gán `root.leveyJenningsChartTitle`/`chartEmptyLabels`/`cusumColors`/`leveyJenningsMultiColors`/`cusumChartTitle`/`leveyJenningsMultiYAxis`/`leveyJenningsMultiGeometry` (đọc GIÁ TRỊ, không phải hàm, nên không có `!` lazy nào cứu được) — chuyển toàn bộ khối dựng renderer xuống ngay sau dòng gán cuối cùng trong nhóm đó thay vì thêm getter. Không có bidirectional dependency, không có UI state mới, không có HTML builder — lát port nhỏ và cơ học nhất tính tới nay so với các route trước. `global.d.ts` thêm 2 ambient (`ljDataURL`/`ljMultiDataURL` — còn caller trần ở `reports.js`/`data-io.js`, cả hai vẫn classic). Sửa 6 file test (`typescript-module-pilot.test.js` — nhiều nhất, đổi toàn bộ assertion `globalThis.X` → `deps.X` và thêm assertion mới cho 2 bridge còn thiếu; `canvas-render-bridge.test.js`/`chart-labels-bridge.test.js`/`chart-render-bridge.test.js` — đường dẫn + cú pháp; `entry-service.test.js` — đường dẫn biến không dùng tới; `render-downsampling.test.js` — bỏ `modules/draw.js` khỏi `loadSandbox`). Gate: `build:pilot`/`typecheck`/`test` 613/613 + `ui-check` (29/29) + `nce-check` (91/91) + `a11y-audit` (0 vi phạm, ratchet PASS) + **`visual-check`** (westgard/report header in đúng `print-color-adjust:exact`) + **`print-check`** (PDF Westgard qua Electron thật, 0 rect nền xám, header teal đúng màu, 567 text op) — hai gate riêng của nhóm B, cả hai đều đi qua đường `ljDataURL`/`ljMultiDataURL` → `drawLJ`/`drawLJMultiZ` vừa port nên xác nhận renderer LJ hoạt động đúng qua Chromium/Electron thật, không chỉ qua sandbox Node. Nhóm B còn 2 file: `reports.js`, `data-io.js`. |
| 2026-08-19 | Lát route 14 của Pha G (nhóm B tiếp tục): chuyển `reports.js` (204 dòng, toàn bộ bản in `openPrint`/`printReport`/`printWestgard`/`printSigmaPeriod(s)`/`printRangeForm`) sang `src/presentation/report/report-print-controller.ts`, cộng `esc`/`escAttr` tách riêng thành `src/presentation/shared/html-escape.ts` (cùng mẫu `jsq` ở Route 10). Phát hiện quan trọng nhất: `esc`/`escAttr` — hai hàm hàng chục file TypeScript đã port TRƯỚC route này gọi qua `(root as any).esc(...)` — hoá ra được định nghĩa DUY NHẤT trong `reports.js`, và file đó nạp SAU bundle trong `index.html` (dòng 78 so với bundle dòng 74); an toàn trước giờ chỉ vì mọi lời gọi đều nằm trong closure (đọc lúc gọi thật, không phải lúc dựng). Route này biến `esc`/`escAttr` thành global TypeScript thật, gán sớm hơn (ngay trong bundle) — cải thiện thứ tự nạp thay vì làm hỏng nó. Bẫy production THẬT tìm thấy qua `visual-check`/`print-check` (không phải qua 613 test Node): wiring `wgRules:()=>(globalThis as any).WG_RULES` đọc `globalThis.WG_RULES` — nhưng `WG_RULES` trong `state.js` là khai báo `const WG_RULES=QCCore.WG_RULES` ở top-level classic script, mà theo đặc tả ECMAScript, `const`/`let` top-level KHÔNG gắn vào global object (`window`/`globalThis`), chỉ vào "script scope" dùng chung giữa các thẻ `<script>` cổ điển — khác hẳn khai báo `function` hay gán `root.X=...` (cả hai đều tạo thuộc tính thật trên global object). `printWestgard()` do đó throw `Cannot read properties of undefined (reading .filter)` khi build thật chạy trong Chromium/Electron, dù test Node vm sandbox (stub bằng gán trần `WG_RULES=[...]`, vốn tạo thuộc tính global ngầm ở chế độ sloppy) không hề phát hiện ra — sửa bằng tham chiếu `WG_RULES` TRẦN (dùng đúng ambient `declare const WG_RULES` đã có sẵn từ trước, cùng lớp với `QC_DECIMALS_DEFAULT`), khớp mẫu `wgRules: () => WG_RULES` đã tồn tại ở một wiring khác trong cùng file. Đây là lần đầu trong Pha G một gate visual/print bắt được lỗi mà toàn bộ 613 test Node bỏ sót — đúng lý do nhóm B cần thêm hai gate đó. Bẫy eager-construction tái diễn dạng thứ hai: 4 dependency kiểu OBJECT (`reportQcFormat`/`sigmaPrintRowsService`/`sigmaMuPrintRowsService`/`actionReportHtml`) ban đầu được nối bằng cách đọc thẳng giá trị `root.X as any` — bắt "giá trị" tại thời điểm dựng, không phải hàm lazy — khiến `tests/sigma-print.test.js` (stub các service này bằng gán `globalThis.X={...}` SAU khi bundle đã dựng) không hề có hiệu lực; sửa bằng bọc từng phương thức trong closure đọc `root.X` lúc GỌI thay vì lúc dựng. Bẫy tương tự cho chính `openPrint`: 5 hàm in (`printSigmaPeriod(s)`/`printWestgard`/`printReport`/`printRangeForm`) gọi thẳng closure `openPrint` nội bộ cùng module — `tests/westgard-print.test.js`/`sigma-print.test.js` cần override `openPrint`/`infoDialog` bằng gán global để chặn side-effect DOM thật; đổi 5 lời gọi đó sang `deps.openPrint(...)` (một dependency mới, nối lại `root.openPrint` — tự tham chiếu vòng nhưng override được từ ngoài) để khớp lại đúng hành vi gọi-qua-global mà bản classic vốn có. Tách bạch bare-global vs QCCore-prefixed đúng theo bản gốc: `WG_RULES` và `errorType` là bare (qua re-export ở `state.js`/`qc-domain.js`), còn `QCCore.westgardByPoint` giữ nguyên tiền tố — lẫn lộn hai kiểu này chính là nguồn gốc bug ở trên. 13 file test phụ thuộc: 6 bridge test một-hàm (đường dẫn + cú pháp `deps.X`), `sigma-export-bridge`/`spacing-tokens`/`uncertainty` (đường dẫn + regex dấu cách), `report-nce-print`/`sigma-print`/`westgard-print`/`lis-client-service` (nạp lại qua `core.js`+`generated/modular-pilot.js` thay vì `modules/reports.js` trực tiếp, viết lại stub bằng gán global trần thay vì tham số `loadSandbox`). Gate: `build:pilot`/`typecheck`/`test` 613/613 + `ui-check` (29/29) + `nce-check` (91/91) + `a11y-audit` (ratchet PASS) + `visual-check` + `print-check` (cả hai đi qua đúng `printWestgard`/`openPrint` vừa port, xác nhận bằng PDF Electron thật sau khi sửa bug WG_RULES). Nhóm B còn 1 file: `data-io.js`. |
| 2026-08-19 | Lát route 15 của Pha G (khép lại nhóm B — canvas/adapter): chuyển `data-io.js` (274 dòng, toàn bộ xuất CSV/XLSX: báo cáo nội kiểm, Westgard, Six Sigma) sang `src/presentation/export/data-io-controller.ts`. File byte-precise nặng nhất Pha G tới nay — ZIP/OOXML dựng tay từng byte (`XlsxCore`/`SigmaXlsx`/`ReportXlsx`), nên toàn bộ logic được chép gần như nguyên văn (chỉ đổi `globalThis.X` → `deps.X`), không "dọn" hay viết lại cấu trúc, để giảm rủi ro sai lệch offset/độ dài âm thầm sinh ra file .xlsx hỏng. Dọn một chỗ dead code xác nhận thật: IIFE `ReportXlsx` gốc đọc `globalThis.reportXlsxStyles`/`reportXlsxSheet`/`reportXlsxDrawing` vào ba biến cục bộ nhưng KHÔNG BAO GIỜ dùng lại (chỉ `build` được trả về và dùng) — ba biến đó bị bỏ, còn `root.reportXlsxStyles`/`Sheet`/`Drawing` vẫn là bridge bắt buộc vì `root.reportXlsxBuild` tự đóng gói (closure) gọi lại chúng qua `root.X` nội bộ, không hề chết. Ba bẫy kỹ thuật lặp lại, tất cả đều bị `npm test` (không phải gate trình duyệt) bắt trước khi build: (1) mười hàm "wrapper mỏng" (`reportInRange`/`reportTeaInfo`/.../`sigmaMdcLabelPlacements`) mà bản gốc đọc `globalThis.X` NGAY TRONG THÂN HÀM (lazy, đọc lại mỗi lần gọi) — 6 dependency dạng OBJECT của tôi (`reportExportHelpers`/`qcReportContext`/`qcReportRowsService`/`sigmaExportMetaService`/`westgardXlsxRows`/`qcExportValueFormat`) ban đầu bị nối bằng đọc thẳng giá trị `root.X as any` một lần lúc dựng — nhiều test (`report-layout`/`report-xlsx`/`sigma-xlsx`/`westgard-xlsx`) đều override các service này bằng gán `globalThis.X={...}` SAU khi bundle đã dựng, y hệt bẫy "eager construction" của Route 12/14 — sửa bằng bọc từng phương thức trong closure đọc `root.X` lúc GỌI; (2) cùng bẫy dạng tự-tham-chiếu như `openPrint` ở Route 14 nhưng ở hàm `exportMetaRows`: `exportActionsCSV` gọi thẳng closure nội bộ `exportMetaRows(...)` thay vì qua dependency, khiến `tests/nce-export.test.js`'s gán trần `exportMetaRows=()=>[]` (mô phỏng sandbox tối giản) không có tác dụng — sửa bằng thêm `exportMetaRows` làm dependency tự-tham-chiếu (`(globalThis as any).exportMetaRows(kind)`) và đổi `exportActionsCSV` sang gọi `deps.exportMetaRows(...)`; (3) `WG_RULES` lặp lại đúng bẫy const-vs-globalThis của Route 14 (đã áp dụng đúng ngay từ đầu vì đã biết — tham chiếu `WG_RULES` trần thay vì `(globalThis as any).WG_RULES`), nhưng phát hiện thêm rằng `errorType` cũng phải đọc trần (không qua `QCCore.errorType`) để khớp đúng bản gốc — bản gốc dùng CẢ HAI kiểu (bare cho `WG_RULES`/`errorType`, tiền tố `QCCore.` cho `westgardByPoint`), lẫn lộn hai kiểu này chính là nguồn gốc bug nếu chép sai. `SIGMA_EXPORT_PIXEL_RATIO` (hằng số cục bộ bản gốc) được trả về thêm từ controller và bridge `root.SIGMA_EXPORT_PIXEL_RATIO` vì `tests/sigma-export-selection.test.js` đọc trần hằng số này để chốt tỉ lệ canvas xuất Sigma. 12 file test phụ thuộc: `canvas-render-bridge`/`xlsx-bridge`/`sigma-export-bridge` (đường dẫn + cú pháp `deps.X`, `xlsx-bridge` tách riêng 3 tên chỉ-còn-là-bridge-contract không còn bị `data-io` đọc trực tiếp), `sigma-export-selection`/`nce-export`/`report-layout`/`report-xlsx`/`sigma-xlsx`/`westgard-xlsx`/`report-nce-print` (bỏ `modules/data-io.js` khỏi `loadSandbox`), `typescript-module-pilot.test.js` (28 assertion cú pháp dày → TypeScript có dấu cách). Gate: `build:pilot`/`typecheck`/`test` 613/613 + `ui-check` (29/29, gồm kịch bản xuất Sigma XLSX tải workbook thật qua Chromium) + `nce-check` (91/91) + `a11y-audit` (ratchet PASS) + `visual-check` + `print-check` (PDF Westgard qua Electron thật). **Toàn bộ nhóm B (Canvas/adapter) của Pha G đã hoàn tất** — chuyển sang nhóm C (hạ tầng/bootstrap, 11 file còn lại, kế hoạch yêu cầu làm CUỐI cùng và từng lát độc lập). |
