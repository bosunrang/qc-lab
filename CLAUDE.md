# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` at the repo root is a byte-identical mirror of this file except for
its first three lines (title + "guidance to Codex" sentence). Any edit here must
be copied there in the same commit, or the two agent briefs drift apart.

## What this is

QC Lab — a Vietnamese-language internal-quality-control (IQC) management app for
clinical lab testing: Westgard multi-rules, Six Sigma metrics, Levey-Jennings
charts, reagent lot comparison, CUSUM, ISO 15189-style QC workflow. All UI
strings and code comments are in Vietnamese.

## Running it

No build step, no bundler, no runtime npm dependencies — the browser app is
plain static files. Serve `index.html` with any static file server and open it,
e.g.:

```
python -m http.server
```

(`.claude/launch.json` defines a `qc-lab-static` config doing exactly that on
port 8080, for Claude Code's browser preview.)

`package.json` also carries Electron desktop packaging (`npm start` →
`electron .`, `npm run dist` → NSIS installer via electron-builder, with
`scripts/patch-7za-symlink.js` as a pre-step). The `electron/` folder is part of
the repo (`main.js`, `preload.js`, `license.js`, `activation.html`,
`auto-update.js` — main process, license activation with a 14-day unactivated
trial: first-run timestamp kept in its own `qclab-trial.dat`, separate from
the license file; F12 toggles DevTools since the app menu is disabled), so
those scripts work here once `npm install` has run; for development use the
static server. `index.html`'s Electron-only branch (`window.qcDialog`,
routing `alert()`/`confirm()` through a native dialog) no-ops in a plain
browser.

`electron/auto-update.js` (`initAutoUpdate()`, wired in `main.js` after
`app.whenReady()`) checks GitHub Releases on the public `bosunrang/qc-lab`
repo (`build.publish` in `package.json`) on every launch, silently
downloads in the background, and only interrupts the user once the update is
ready — asking to restart now or later; picking "later" still installs it on
the next natural quit (`autoInstallOnAppQuit`). It no-ops when
`!app.isPackaged` (dev runs). `npm run dist` only builds locally (no token
needed); `npm run dist:publish` additionally uploads the installer to GitHub
Releases, which requires a `GH_TOKEN` env var (a GitHub personal access token
with `repo` scope) — don't run it without one configured, and never commit
that token.

## app-v2 — bản viết lại kiến trúc mới (song song, chưa đóng gói)

`app-v2/` là một bản viết lại QC Lab từ đầu bằng kiến trúc khác hẳn phần còn
lại của repo này — KHÔNG phải một bước tiếp theo của "Giai đoạn 9" (viết lại
composition root + gộp bundle, xem "Kernel / gỡ global bridge" bên dưới).
Giai đoạn 9 vẫn tiến hoá app cũ (`index.html`/`assets/`/`src/`) tại chỗ, không
backend, `localStorage`/IndexedDB; `app-v2/` là một sản phẩm khác đang được
xây song song, sẽ thay thế app cũ khi đủ tính năng — không đọc/ghi chung dữ
liệu, không chia sẻ code với `src/`/`assets/`. Bắt đầu 2026-08-31, chưa có tên
trong `package.json`'s `build.files` (chưa đóng gói cùng bản Electron chính
thức) — chạy/test bằng các script `app-v2:*` riêng. **`docs/APP-V2-PLAN.md`
giữ bức tranh tổng thể + lộ trình đề xuất** (kiến trúc đã chốt, còn thiếu gì,
tiêu chí "sẵn sàng thay app cũ") — phần dưới đây trong CLAUDE.md là log chi
tiết theo từng module, đọc file kia trước nếu chỉ cần biết "đang ở đâu".

**Kiến trúc**: Electron 2 tiến trình thật (không còn một global scope dùng
chung như app cũ) — `app-v2/main/` (main process: `node:sqlite` làm nguồn dữ
liệu thật thay cho `localStorage`, `ipcMain.handle` theo named channel
`<module>:<action>`, `preload.ts` lộ đúng các hàm đó qua `contextBridge` dưới
`window.qcApi`) và `app-v2/renderer/` (React 19 thật + `react-router-dom`
`HashRouter` — bắt buộc hash vì app đóng gói `file://`, không có server phục
vụ route dạng path — + Zustand store THẬT theo state chuẩn `set()`/`get()`
cho từng trang, không phải notify-bus bọc quanh 1 object `state` lớn như
`app-store.ts` của app cũ). `app-v2/shared/qc-api.d.ts` là hợp đồng IPC dùng
chung giữa 2 tiến trình — sửa handler ở main phải sửa cả interface `QcApi`
này, không renderer nào gọi SQL trực tiếp.

**Schema SQLite** (`app-v2/main/db/schema.ts`, `applySchema()` idempotent
qua `CREATE TABLE IF NOT EXISTS`) được thiết kế đủ cho TOÀN BỘ ứng dụng ngay
từ đầu (lab/instruments/tests/test_levels/qc_points/qc_panels/qc_lots/
lot_groups/lot_transitions/sigma_data/actions/activity/users/reagent_tests/
period_locks/tea_refs) — không phải chỉ đủ cho phần đã code. Nguyên tắc tách
bảng quan hệ thật (đặc biệt `qc_points`, có index theo `(test_id,level,date)`)
vs giữ cột `*_json` (khi cấu trúc luôn đọc/ghi nguyên khối theo cha, không có
truy vấn `WHERE`/`JOIN` xuyên hàng) ghi ngay trong comment đầu file. Không có
"xoá thật" QC — chỉ `voided` (soft-delete), giữ đúng chính sách sản phẩm của
app cũ.

**Mỗi IPC handler theo cùng khuôn**: nhận input thô → validate qua 1 hàm
thuần trong `main/domain/*-validation.ts` (không đụng DB, dễ test không cần
SQLite) → nếu hợp lệ thì UPDATE/INSERT trong 1 transaction → `writeAudit()`
ghi 1 dòng vào bảng `activity` (chuỗi hash tamper-evident, thuật toán y hệt
bản cũ nhưng dùng `node:crypto` thật — xem `main/domain/audit-chain.ts`) →
trả `IpcResult<T>` (`{ok:true,data}` hoặc `{ok:false,error:{code,message}}`).
`main/ipc/shared.ts` (thêm 2026-08-31 khi có handler thứ 7) gom `Actor`/
`IpcResult`/`writeAudit`/`rowToAuditEntry`/`nowIso` dùng chung — TRƯỚC đó 6
file handler đầu tiên (config/entry/westgard/sigma/nce/reagent) mỗi file tự
khai báo lại y hệt; đừng quay lại kiểu nhân bản đó khi thêm handler mới.

**Test**: `npm run app-v2:test` (`app-v2/scripts/run-tests.cjs`) tự build
main process (CommonJS) rồi chạy `node --test app-v2/tests/*.test.mjs` —
BẮT BUỘC build trước vì phần lớn module `main/` import chéo lẫn nhau
(`manage-validation.ts` → `text-utils.ts`...), Node's ESM type-stripping
không resolve được import không đuôi file kiểu CommonJS. CHỈ module KHÔNG
import chéo module khác trong `main/` (vd `westgard-rules.ts`,
`audit-chain.ts`, `password-hash.ts`) mới test thẳng trên `.ts` qua ESM được
— xem comment đầu mỗi file test để biết đang dùng cách nào. Test theo 2 tầng:
"oracle" (so hành vi domain thuần với công thức/hằng số đã biết, không cần
DB) và "end-to-end" (SQLite `:memory:` thật + handler thật + validate + audit
hash-chain — chứng minh cả 4 lớp chạy đúng cùng nhau, không phải unit test cô
lập). `npm run app-v2:typecheck` chạy 2 lượt `tsc` riêng (main CommonJS,
renderer JSX) vì 2 tiến trình có target/module khác nhau.

**Trạng thái module** (thứ tự triển khai — mỗi module thêm cả domain +
validate + IPC handler + preload + Zustand store + trang React, verify bằng
`npm run app-v2:test`/`app-v2:typecheck` VÀ chạy thật trong cửa sổ Electron
qua Playwright's `_electron` trước khi coi là xong, không chỉ tin typecheck):
Cấu hình chung (máy/xét nghiệm/mức QC), Nhập QC, Phân tích Westgard, Six
Sigma, Khắc phục sự cố (NCE — chưa có protocol-v3 FMEA đầy đủ như bản cũ),
So sánh hóa chất — 6 module "thí điểm" đầu tiên, xây trước để chứng minh
kiến trúc (main↔IPC↔SQLite↔renderer) chạy đúng, dùng chung 1
`TEMP_ACTOR` cứng (admin) vì chưa có đăng nhập thật. **Users/Auth (thêm
2026-08-31)** là module thứ 7, đúng thứ tự đã ghi sẵn trong comment cũ của
`main/index.ts` ("Audit/Users nằm sau module thí điểm"): PBKDF2-SHA256 600k
vòng lặp (`main/domain/password-hash.ts`, cùng định dạng chuỗi lưu
`pbkdf2$<iter>$<salt>$<hash>` với bản cũ để giữ khả năng import backup sau
này, nhưng dùng `node:crypto` thật thay vì tự viết SHA-256 bằng JS như
`assets/core.js` phải làm vì chạy trong trình duyệt), 3 vai trò cố định
admin/technician/viewer (chưa có `pagePerms` tuỳ biến theo trang như bản cũ).
`bootstrapAdmin()` chỉ chạy được đúng 1 lần khi bảng `users` còn rỗng (không
cần actor có sẵn — chưa ai đăng nhập được); mọi thao tác ghi ở 6 module kia
giờ đi qua `requireActor()` trong `main/index.ts` (actor đăng nhập thật, giữ
trong biến bộ nhớ của main process — app 1 cửa sổ duy nhất nên không cần
session token/cookie) thay vì `TEMP_ACTOR`, sẽ ném lỗi rõ ràng nếu gọi trước
khi đăng nhập — điều này không nên xảy ra vì `AppRouter`
(`renderer/router.tsx`) đã chặn hiển thị mọi route khác cho tới khi
`useAuthStore` báo `status==='logged-in'`. Guard "không tự khoá/hạ quyền
admin ACTIVE cuối cùng" (`wouldRemoveLastActiveAdmin()` trong
`auth-handlers.ts`) tồn tại vì app này không có đường "quên mật khẩu" nào
khác — khoá cứng tài khoản admin duy nhất là không thể tự cứu. Verify:
`npm run app-v2:test` 15/15, `app-v2:typecheck` sạch, `app-v2:build` (main +
renderer) sạch, cộng kịch bản Playwright `_electron` tạm thời (không commit)
xác nhận trong cửa sổ Electron THẬT: chưa có user → hiện form khởi tạo admin
→ tạo xong chuyển sang form đăng nhập → đăng nhập đúng vào được app, nav
hiện đúng tên/vai trò + link "Người dùng" (chỉ admin) → mở được trang Người
dùng → đăng xuất quay lại form đăng nhập → sai mật khẩu báo đúng lỗi.

**Nhật ký hoạt động/Audit log (thêm 2026-08-31, module thứ 8)**: trang đầu
tiên KHÔNG cần domain mới — `main/domain/audit-filter.ts`
(`filterActivity`/`paginateActivity`/`updateAuditDateRange`) đã được port sẵn
từ bản cũ cùng đợt với 6 module thí điểm đầu tiên, có test oracle riêng
(`audit-filter.test.mjs`) từ trước, nhưng chưa từng được nối vào IPC/renderer
nào cho tới module này. `main/ipc/audit-handlers.ts`'s `query()` đọc bảng
`activity` theo `ORDER BY seq ASC` RỒI MỚI đưa qua `filterActivity()` — hàm
đó tự đảo về mới-nhất-trước ở bước cuối; đọc theo `DESC` sẵn (như
`config.listActivity()` cũ) rồi đưa qua sẽ bị đảo 2 lần thành cũ-nhất-trước,
sai quy ước hiển thị của bản cũ — bẫy này được ghi lại bằng comment ngay tại
chỗ gọi, không chỉ trong changelog này. `renderer/pages/AuditPage.tsx` +
`audit-store.ts`: ô tìm kiếm + 2 ô ngày + phân trang, mọi thay đổi filter đều
reset về trang 1. Verify: `npm run app-v2:test` 16/16 (thêm
`audit-handlers.test.mjs` — lọc văn bản, lọc rỗng không lỗi, phân trang chia
đúng không trùng/thiếu dòng), cộng kịch bản Playwright `_electron` xác nhận
trong Electron thật: mở trang hiện đúng 2 dòng audit (tạo admin + đăng nhập),
gõ tìm kiếm lọc đúng, ảnh chụp màn hình xác nhận tiếng Việt hiển thị đúng.

**Tổng quan/Dashboard (thêm 2026-08-31, module thứ 9)**: trang landing mặc
định sau đăng nhập (`path="*"` giờ điều hướng về `/dashboard` thay vì
`/manage`). Cũng KHÔNG có domain/IPC riêng — cố ý chỉ tổng hợp lại 3 endpoint
đã có sẵn (`westgard:listTestSummaries`, `nce:listRecords`, `audit:query`)
thay vì phát minh thêm domain mới cho một trang chỉ đọc và gộp: cảnh báo
Westgard (mọi mức có `worstVerdict!=='ok'`, đã tính sẵn trong
`listTestSummaries()`), sự cố NCE quá hạn (`record_status==='active' &&
approval_status==='pending' && due_date<today`, join tên xét nghiệm ở
`renderer/store/dashboard-store.ts` vì `NceRecord` chỉ có `test_id`), và 5
dòng hoạt động gần đây nhất. **Giới hạn đã biết, cố ý chưa xử lý ở mức thí
điểm này**: `DashboardPage.tsx`'s `useEffect(() => { load(); }, [load])`
chỉ fetch một lần khi component MOUNT — không có polling/live-update như
`app-store.ts`'s `touch()`/`revision` của app cũ, nên dữ liệu thay đổi ở
trang khác sau khi Dashboard đã mở sẽ không tự cập nhật cho tới khi rời trang
rồi quay lại (route unmount/remount). Việc này bị phát hiện ngay khi viết
kịch bản Playwright kiểm chứng — kịch bản đầu tiên seed dữ liệu SAU khi
Dashboard (trang mặc định) đã fetch xong, thấy 0 kết quả; sửa bằng cách rời
trang rồi quay lại trong kịch bản, KHÔNG sửa app — ghi lại y nguyên đặc điểm
này cho lần đọc code sau. Verify: `npm run app-v2:typecheck`/`build` sạch,
cộng kịch bản Playwright `_electron` seed dữ liệu thật qua chính
`window.qcApi` (1 xét nghiệm có Mean/SD, 1 điểm QC vi phạm 1-3s, 1 hồ sơ NCE
quá hạn) rồi xác nhận Dashboard hiển thị đúng "Cảnh báo Westgard (1)"/"Sự cố
quá hạn xử lý (1)" kèm đúng tên xét nghiệm — không có test Node riêng vì
trang này không có logic mới nào ngoài gọi 3 API đã được test qua ở module
gốc của chúng.

**Cài đặt (thêm 2026-08-31, module thứ 10)**: phạm vi rút gọn đúng tinh thần
"thí điểm" — chỉ hồ sơ phòng xét nghiệm (bảng `lab`, 1 dòng id=1 đã được
chèn sẵn bởi `openDatabase()` lần đầu): tên/khoa/địa chỉ + tiêu đề/phụ đề
thương hiệu. `main/domain/settings-validation.ts`'s `prepareLabProfile()`
không có trường bắt buộc thật sự (đây là thông tin mô tả, không phải dữ liệu
QC) — chỉ làm sạch/giới hạn độ dài và giữ mặc định `brandTitle`/`brandSub`
nếu bỏ trống, khớp `DEFAULT` trong schema. Logo/canvas upload, kết nối
Firebase, LIS Gateway settings, backup/restore của bản cũ CHƯA làm (xem
"còn thiếu" bên dưới). `renderer/pages/SettingsPage.tsx` nạp giá trị đã lưu
vào state cục bộ đúng 1 lần khi profile về (cờ `seeded`), sau đó form là của
người dùng gõ — tránh bị ghi đè lại mỗi khi store re-render. Verify:
`npm run app-v2:test` (thêm `settings-handlers.test.mjs` — giá trị mặc định
đúng schema, lưu/đọc lại khớp, bỏ trống brandTitle/brandSub fallback đúng
mặc định thay vì lưu chuỗi rỗng), cộng kịch bản Playwright `_electron` xác
nhận trong Electron thật: lưu xong rời trang rồi quay lại vẫn thấy đúng giá
trị (chứng minh ghi DB thật, không phải chỉ state cục bộ).

**Báo cáo (thêm 2026-08-31, module thứ 11 — HOÀN TẤT 11/11 TRANG)**: hai
phần — khoá/mở khoá kỳ báo cáo (bảng `period_locks`, có sẵn trong schema từ
đầu nhưng CHƯA từng có IPC/enforcement nào cho tới module này) và bảng xem
lại điểm QC theo khoảng ngày (`report:queryReport`, đọc thẳng `qc_points`
theo `test_id`+khoảng `date`, KHÔNG tính verdict Westgard — đúng nguyên tắc
"2 con số Sigma/Report tách biệt" đã ghi trong "Confirmed business-logic
decisions"). Điểm quan trọng nhất của module này không phải là UI mà là
**enforcement thật**: `main/ipc/entry-handlers.ts`'s `addPoint`/`voidPoint`
giờ gọi `isPeriodLocked(date)` (đọc thẳng bảng `period_locks` theo
`ymOfDate(date)`, một hàm thuần trong `domain/period-lock-validation.ts`) —
trước module này, khoá 1 kỳ sẽ không có tác dụng thật nào vì chưa có IPC
`report:*` lẫn chỗ gọi trong Entry, đúng loại lỗi "thiếu wiring" đã gặp nhiều
lần trong Giai đoạn 3 của app cũ, nhưng lần này bắt được TRƯỚC khi commit
nhờ viết `tests/period-lock-enforcement.test.mjs` (test end-to-end giao giữa
`entry-handlers.ts`/`report-handlers.ts`, không phải unit test cô lập cho
1 trong 2 file) ngay khi thêm handler thay vì để dành đến khi có ai report
bug. `entry-handlers.ts` KHÔNG import `report-handlers.ts` — mỗi handler tự
đọc `period_locks` bằng SQL riêng (khớp quy ước "mỗi handler tự SQL, không
phụ thuộc lẫn nhau" của toàn bộ `main/ipc/*`), chỉ dùng chung hàm thuần
`ymOfDate()`. Khoá đòi ghi chú tuỳ chọn; MỞ khoá bắt buộc ghi chú ≥5 ký tự —
một quyết định thiết kế có chủ đích (mở lại một kỳ đã chốt là hành động
đáng cân nhắc hơn đóng nó), khác với bản cũ (không có gate ghi chú bắt buộc
ở bước này) nhưng khớp tinh thần thận trọng ISO 15189 xuyên suốt codebase.
Verify: `npm run app-v2:test` 19/19 (thêm `report-handlers.test.mjs` — khoá/
mở khoá đúng gate, lọc `queryReport` đúng theo xét nghiệm+khoảng ngày; và
`period-lock-enforcement.test.mjs` — khoá thật sự chặn add/void, kỳ khác
không bị ảnh hưởng, mở khoá thì cho phép lại), `app-v2:typecheck`/`build`
sạch, cộng kịch bản Playwright `_electron` xác nhận trong Electron thật:
khoá 1 kỳ → sang trang Nhập QC nhập điểm vào đúng kỳ đó bị chặn với thông
báo đúng → quay lại Báo cáo mở khoá → bảng xem lại hiện đúng dòng đã seed
qua chính `window.qcApi`.

Còn thiếu so với bản cũ (chưa làm, không phải bug): `pagePerms` theo từng
trang; đồng bộ Firebase (gói `firebase` đã có trong `dependencies` của
`package.json` gốc nhưng CHƯA có chỗ nào trong `app-v2/` import nó — chuẩn
bị trước cho module này, chưa dùng); backup/restore; in ấn/xuất Excel; toàn
bộ CSS/styling (mọi trang hiện là "thí điểm" — `<table>`/`<input>` trần,
style inline tối thiểu, cố ý chưa đầu tư giao diện trước khi kiến trúc ổn
định); Dashboard chưa có polling/live-update (xem giới hạn ở trên); logo/
brand image upload; Firebase/LIS Gateway settings.

**app-v2 giờ có đủ 11/11 trang** (Tổng quan, Cấu hình chung, Nhập QC, Phân
tích Westgard, Six Sigma, Khắc phục sự cố, So sánh hóa chất, Báo cáo, Nhật
ký hoạt động, Cài đặt, Người dùng) — mọi trang đều đọc/ghi qua IPC/SQLite
thật, có audit log, có test end-to-end. Những gì còn thiếu (liệt kê ở trên)
là các TÍNH NĂNG bổ sung bên trong các trang đã có, không phải trang nào
chưa tồn tại.

**Kế hoạch "làm đầy đủ" (bắt đầu 2026-08-31, xem `docs/APP-V2-PLAN.md`).**
Sau khi 11/11 trang đạt mức thí điểm, người dùng chốt mục tiêu cuối: app-v2
phải đạt giao diện + nghiệp vụ giống hệt app cũ (không chỉ chứng minh kiến
trúc) — `docs/APP-V2-PLAN.md` giữ kế hoạch/quy trình/tiến độ chi tiết, mục
này chỉ log từng bước đã làm.

**Giai đoạn A1 — hạ tầng dùng chung (xong, 2026-08-31).** 4 mảnh lõi bắt
buộc trước khi viết lại bất kỳ trang nào ở Giai đoạn B:
- `renderer/styles/tokens.css`/`app.css` — port giá trị token (màu/spacing/
  Manrope tự host, copy nguyên `assets/fonts/*.woff2` sang
  `renderer/styles/fonts/`) từ `assets/tokens.css` cũ, KHÔNG copy cấu trúc
  cascade 10 file `professional-*.css` — dựng lại gọn thành 2 file (layout
  khung + component dùng chung: `.btn`/`.badge`/`.panel`/`.field`/modal).
- `components/AppShell.tsx` — sidebar 11 mục (ẩn "Người dùng" nếu không phải
  admin) + topbar (tên/vai trò/avatar chữ cái đầu/đăng xuất) + `<Outlet/>`,
  thay `<nav>` phẳng viết tay trong `router.tsx`. `router.tsx` chuyển sang
  route lồng nhau (`<Route element={<AppShell/>}>` bọc 11 route con).
- `components/Modal.tsx` (portal `#modalRoot`, form CRUD) + `state/
  dialog-store.ts` + `components/DialogHost.tsx` (portal `#dialogRoot`, mount
  1 lần trong `AppShell`) — 2 lớp tách biệt giữ đúng lý do bản cũ (dialog luôn
  nổi trên modal). `confirmDialog()`/`infoDialog()`/`reauthDialog()` là hàm
  Promise gọi trực tiếp từ bất kỳ đâu, không cần prop-drilling. `reauthDialog()`
  cần 1 IPC mới hoàn toàn chưa có trong bản thí điểm: `auth:verifyPassword`
  (`verifyOwnPassword()` trong `auth-handlers.ts`) — chỉ xác thực lại mật khẩu
  người dùng đang đăng nhập, không đổi gì, không ghi audit cho lần thử sai
  (tránh rác audit log mỗi lần gõ nhầm 1 ký tự). `components/useFocusTrap.ts`
  dùng chung cho cả 2 (Escape đóng, Tab/Shift+Tab quẩn, trả focus khi đóng).
- `components/DateField.tsx` — ĐƠN GIẢN HOÁ có chủ đích so với lịch tự vẽ
  `vn-date-picker-controller.ts` của bản cũ: dùng `<input type="date">`
  chuẩn của Chromium/Electron thay vì port nguyên DOM popup — vẫn giữ đúng
  luồng "gõ tay hoặc chọn lịch đều commit", chỉ khác cách vẽ lịch (đúng
  nguyên tắc "giống luồng thao tác, không cần giống UI implementation").
- `store:changed` — **hạng mục quan trọng nhất của A1**, tài liệu kế hoạch
  gốc mô tả nhưng CHƯA TỪNG được cài đặt cho tới bước này (`grep
  webContents.send` toàn bộ `main/` từng ra rỗng). Thiết kế: `notifyChanged()`
  (`main/ipc/shared.ts`) gọi `broadcastWindow.webContents.send('store:changed',
  {tables, testIds})`; `setBroadcastWindow(win)` gán đúng 1 lần trong
  `main/index.ts` ngay sau khi tạo `BrowserWindow`. Quyết định thiết kế quan
  trọng: gọi `notifyChanged(['activity'])` NGAY TRONG `writeAudit()` thay vì
  bắt mỗi handler tự nhớ báo — vì MỌI thao tác ghi đều gọi `writeAudit()`,
  nên trang Nhật ký hoạt động sống tự động miễn phí; mỗi handler chỉ cần
  thêm đúng 1 dòng `notifyChanged([bảng riêng], [testId nếu có])` cho dữ
  liệu CỦA NÓ (đã thêm cho cả 9 handler còn lại: `instruments`/`tests`/
  `test_levels`/`qc_points`/`sigma_data`/`actions`/`reagent_tests`/`users`/
  `lab`/`period_locks`). `preload.ts` lộ `onStoreChanged(callback)` (trả về
  hàm huỷ đăng ký); `renderer/lib/useStoreInvalidation.ts` là hook dùng
  chung ở Giai đoạn B, lọc theo `tables`/`testIds` đang mount thay vì
  "fetch 1 lần khi mount" như 11 trang thí điểm hiện tại.
- `components/QcChart.tsx` — vẽ Levey-Jennings + CUSUM bằng canvas ref chuẩn
  React (viết lại từ đầu theo input `westgard:analyzeLevel` đã trả về: điểm
  kèm z-score/verdict, chuỗi CUSUM), KHÔNG port nguyên hình học pixel của
  `qc-chart-renderer.ts` cũ — giống về NỘI DUNG (dải ±SD, màu theo verdict,
  ngưỡng CUSUM h), khác về cách vẽ, cùng lý do như `DateField`.

Verify: `app-v2:typecheck` sạch, `app-v2:test` 19/19 (không cần sửa test nào
— chỉ thêm dòng `notifyChanged()`, không đổi hợp đồng IPC hiện có),
`app-v2:build` sạch (4 file font Manrope + CSS bundle đúng qua Vite), cộng
kịch bản Playwright `_electron` tạm (không commit) xác nhận trong Electron
thật: khởi tạo admin → đăng nhập → sidebar hiện đúng 11 mục (đúng thứ tự,
"Người dùng" hiện vì là admin) → topbar hiện đúng tên/vai trò/avatar →
chuyển qua 4 trang xác nhận `AppShell`/route lồng nhau hoạt động, class
`.active` cập nhật đúng → gọi thẳng `window.qcApi.saveInstrument(...)` và
xác nhận renderer nhận đúng 2 sự kiện `store:changed` liên tiếp
(`{tables:['activity']}` rồi `{tables:['instruments']}`) — chứng minh cơ chế
invalidation có phạm vi hoạt động đúng từ main tới renderer; ảnh chụp màn
hình xác nhận token/font/layout hiển thị đúng, tiếng Việt không lỗi font,
zero console error. `pagePerms` (A2) dời sau theo đúng quyết định trong kế
hoạch — 3 vai trò cố định vẫn đủ để bắt đầu Giai đoạn B.

**Giai đoạn B1 — Cấu hình chung, "làm đầy đủ" (xong, 2026-08-31).** Trang
thí điểm cũ (56 dòng: 1 dropdown + 2 form phẳng) thay bằng 8 tab như app cũ:
máy xét nghiệm, danh mục xét nghiệm, Panel QC, lô & nhóm lô QC, Mean/SD,
chuyển tiếp lô, lịch sử dữ liệu, TEa tham chiếu. Domain mới hoàn toàn (chưa
tồn tại ở lượt thí điểm — schema đã có sẵn 20 bảng nhưng KHÔNG có IPC/
validate nào cho `qc_lots`/`lot_groups`/`qc_panels`/`qc_panel_tests`/
`lot_transitions`/`tea_refs` cho tới bước này):
- `main/domain/manage-validation.ts` mở rộng: `PreparedTest` thêm `teaSource`/
  `teaRefKey`/`method`/`reagent`/`cusumOn`/`cusumK`/`cusumH` (CUSUM chỉ là
  tham số biểu đồ trend, không đổi verdict Westgard — giữ nguyên tắc cũ);
  `appendMeanSdHistory()` (hàm thuần) chốt Mean/SD CŨ vào
  `test_levels.mean_sd_history_json` chỉ khi giá trị thật sự đổi, không ghi
  đè im lặng — trang "Lịch sử dữ liệu" đọc lại đúng cột này;
  `validateLot`/`validateLotGroup`/`validatePanel`/`validateLotTransition`
  (port nguyên tắc "nhóm lô QC cần ≥2 lô" từ bản cũ).
- `main/domain/tea-ref-validation.ts` (mới) — 6 điều kiện bắt buộc y hệt thứ
  tự `teaLabProfileSave()` bản cũ (giá trị dương, nguồn, tham chiếu ≥3 ký tự,
  lý do ≥10 ký tự, ngày duyệt không sau ngày hiệu lực, ngày xem lại không
  trước ngày hiệu lực, đủ người chuẩn bị+người duyệt). Phạm vi CỐ Ý rút gọn
  so với bản cũ: đây chỉ là hồ sơ TEa tự khai của phòng xét nghiệm (`lab`/
  `lab_source`/...), KHÔNG port `TEA_ANALYTE_CATALOG` (hàng trăm analyte
  built-in CLIA/Ricos của bản cũ, `docs/tea-sources.md`) — dữ liệu tham khảo
  tĩnh, để dành cho một đợt riêng.
- `main/domain/rule-config.ts` mở rộng thêm `RuleScopesMap`/`makeScopeOf()`/
  `effectiveScopeList()` (phạm vi within/across/both theo luật, theo xét
  nghiệm). Từ 2026-09-06, cấu hình này đã được thực thi thật trong Entry và
  Westgard: `combinedWestgardByPoint()` ghép đánh giá từng mức với đánh giá
  liên mức theo cùng `run_id` (R4s/2-2s/2of3-2s/3-1s và chuỗi run), đồng thời
  chỉ đọc điểm thuộc đúng lô hiện đang gán cho từng mức.
- `main/ipc/config-handlers.ts` (đã là handler lớn nhất, giờ thêm ~15 hàm):
  `listLots`/`saveLot`, `listLotGroups`/`saveLotGroup` (gán/gỡ `group_id`
  trực tiếp trên `qc_lots`, KHÔNG qua bảng junction — 1 lô chỉ thuộc 1 nhóm),
  `listPanels`/`savePanel` (kèm thay toàn bộ `qc_panel_tests` mỗi lần lưu —
  xoá hết rồi insert lại theo danh sách mới, đơn giản hơn diff), `listLotTransitions`/
  `createLotTransition`/`setLotTransitionStatus` (`planned→active→concluded`,
  CHỈ ĐI 1 CHIỀU — không cho lùi trạng thái, `concluded` bắt buộc có kết
  luận + tự ghi `approved_at`/`approved_by`), `listTeaRefs`/`saveTeaRef`/
  `removeTeaRef`, `listRuleScopes`/`saveRuleScope`. `saveTestLevel()` viết
  lại để SELECT đủ cột cũ trước UPDATE, so sánh đổi thật hay không rồi mới
  gọi `appendMeanSdHistory()`.
- `auth-handlers.ts` thêm `verifyOwnPassword` sớm hơn dự kiến (đã làm ở A1)
  hoá ra là điều kiện cần cho B1: nút "Kết luận" chuyển lô dùng
  `reauthDialog()` thật (thao tác không thể quay lại, đúng danh sách ~9 thao
  tác nhạy cảm của bản cũ).
- Renderer: `manage-store.ts` viết lại — **GIỮ NGUYÊN** tên field/hàm
  `tests`/`instruments`/`loadTests`/`loadInstruments`/`levelsByTestId`/
  `loadLevels` vì Entry/Sigma/Actions/Report cũng đọc qua store này (chỉ đọc
  `tests`, xác nhận bằng grep trước khi sửa); mọi hàm `save*` mới trả thẳng
  `IpcResult` thay vì 1 field `error` dùng chung — tránh lỗi validate của
  tab này đè lên tab khác đang mở. `ManagePage.tsx` (8 sub-component trong 1
  file, ~700 dòng) dùng `<Modal>`/`<DateField>` từ Giai đoạn A1 cho mọi form,
  `useStoreInvalidation()` cho cả 6 nhóm bảng (`instruments`/`tests`/
  `qc_lots+lot_groups`/`qc_panels`/`lot_transitions`/`tea_refs`).

**2 bug thật bắt được qua Playwright `_electron` (không phải chỉ qua test
Node), đúng lý do "Verify = ... chạy thật trong Electron" tồn tại**:
1. `window.prompt()` cho nhập "kết luận chuyển lô" — Electron renderer
   KHÔNG hỗ trợ `prompt()` (`Error: prompt() is not supported`, không phải
   lỗi console thường mà crash luôn thao tác). Sửa bằng 1 modal nhỏ riêng
   (`<textarea name="conclusion">`) thay vì dialog gốc trình duyệt — bài học
   chung cho MỌI thao tác sau này cần nhập text ngoài 2 dialog có sẵn
   (`confirmDialog`/`infoDialog` không có ô nhập liệu, `reauthDialog` chỉ có
   ô mật khẩu).
2. **Race điều kiện thật** ở bảng Mean/SD: sửa Mean rồi Tab/click ngay sang
   ô SD (2 lần mất focus rất gần nhau) — mỗi ô gọi `saveTestLevel` RIÊNG,
   tính "giá trị ô kia" từ React state đã render TRƯỚC KHI lần lưu đầu tiên
   hoàn tất → lần lưu thứ 2 ghi đè giá trị vừa lưu của ô thứ nhất bằng giá
   trị CŨ, mất dữ liệu. Phát hiện gián tiếp qua "Lịch sử dữ liệu" không ghi
   nhận giá trị cũ đúng như kỳ vọng — không phải lỗi hiển thị, lỗi THẬT ở
   tầng lưu dữ liệu. Sửa theo đúng nguyên tắc `syncTargetRange()` của bản cũ:
   đọc thẳng DOM của CẢ HÀNG (`closest('tr')` rồi `querySelector` cho cả 3 ô
   Lô QC/Mean/SD) tại thời điểm lưu, không tính từ React state — một ô mất
   focus sẽ lưu đúng giá trị LIVE của cả 2 ô kia, bất kể ô nào lưu trước.
   Post-mortem: đây là lớp bug mà test Node không bao giờ bắt được (không có
   khái niệm "2 sự kiện blur gần nhau" trong unit test gọi hàm trực tiếp).

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 21/21 (thêm
`config-lots-handlers.test.mjs` — lô/nhóm lô/panel/chuyển lô/TEa/phạm vi
luật end-to-end, tách file riêng với `config-handlers.test.mjs` vì file đó
khoá số đếm audit tuyệt đối; `tea-ref-validation.test.mjs` — oracle 6 điều
kiện; mở rộng `manage-validation.test.mjs`), `app-v2:build` sạch (font/CSS
bundle đúng), cộng kịch bản Playwright `_electron` tạm (không commit) đi hết
cả 8 tab trong 1 phiên: thêm máy → thêm xét nghiệm (bật CUSUM) → đổi phạm vi
luật → thêm 2 lô → thêm nhóm lô (xác nhận chặn khi chỉ chọn 1 lô, qua khi đủ
2) → thêm Panel QC → sửa Mean/SD (xác nhận không còn race) → xem lịch sử →
tạo hồ sơ chuyển lô → kích hoạt (confirmDialog thật) → kết luận (modal nhập
liệu + reauthDialog thật) → thêm hồ sơ TEa → xác nhận Nhật ký hoạt động ghi
đủ cả 15 thao tác đúng nội dung tiếng Việt, đúng thứ tự — zero console error
sau khi sửa 2 bug trên.

**Sửa lịch sử lô/Mean-SD sau chuyển tiếp (2026-09-06).** `HistoryTab` từng
dùng `entry:queryPoints`, endpoint này cố ý chỉ trả điểm của lô đang vận
hành; vì vậy sau khi chấp nhận lô mới, điểm lô cũ vẫn còn trong SQLite nhưng
tab Lịch sử hiện 0 điểm, tạo cảm giác dữ liệu đã bị xoá. Thêm endpoint chỉ
đọc `entry:listHistoryPoints` trả mọi điểm chưa huỷ của xét nghiệm; bảng
Nhập QC vẫn dùng `queryPoints` nên chuỗi Westgard hiện hành không bị trộn lô.
`mean_sd_history_json` được mở rộng tương thích ngược để chốt cả `lot`,
`low/high`, `effectiveFrom/effectiveTo`, `source`; mọi lần đổi lô đều tạo mốc
kể cả Mean/SD không đổi. Ngày bắt đầu của lô mới lấy từ `qc_lots.opened`
(`Ngày mở` trong form Lô QC), fallback về ngày thao tác khi lô chưa khai ngày
mở; lô cũ kết thúc tại ngày chuyển tiếp. Verify: typecheck sạch, 41/41 test,
build sạch, Electron thật xác nhận OLD-1101 còn 1 điểm với hiệu lực
10/02/2026→05/04/2026 và NEW-1111 bắt đầu 02/04/2026.

**Giai đoạn B2 — Nhập QC, "làm đầy đủ" (xong, 2026-09-06).** Trang thí điểm cũ (56 dòng: 1
dropdown + 1 bảng phẳng) thay bằng: lọc theo máy + tìm kiếm xét nghiệm (danh
sách bên trái), tab theo mức, `<QcChart>` (Levey-Jennings/CUSUM, dùng lại từ
Giai đoạn A1) đọc `westgard:analyzeLevel` có sẵn, cửa sổ ngày (`<DateField>`
Từ/Đến lọc client-side), huỷ điểm qua `<Modal>` (thay input+button inline cũ).
- `entry-handlers.ts`'s `addPoint()` giờ chốt thêm `qc_mean`/`qc_sd`/`lot`
  vào mỗi điểm QC lúc ghi (đọc từ `test_levels` của mức tại THỜI ĐIỂM nhập) —
  trước đây các cột này tồn tại trong schema nhưng không handler nào ghi vào.
  `westgard-engine.ts`'s `pointTarget()` đã sẵn đọc `point.qcMean`/`qcSd` làm
  ưu tiên trước fallback, nên đây là bổ sung AN TOÀN (không đổi hành vi tính
  verdict hiện tại — `queryPoints()`/`analyzeLevel()` vẫn đánh giá theo Mean/
  SD HIỆN HÀNH của mức, không dùng lại giá trị đã chốt), chỉ chuẩn bị dữ liệu
  cho bước sau (Levey-Jennings lịch sử dài không bị đổi verdict ngược khi ai
  sửa lại Mean/SD). Cũng chốt thêm `operator_id`/`operator_username` từ actor
  thật (trước đây chỉ có `operator_name`).
- `entry-store.ts` viết lại (chỉ EntryPage.tsx dùng, tự do đổi): thêm
  `analysis`/`loadAnalysis()` gọi `westgard:analyzeLevel` cho biểu đồ, mọi
  hàm `save*` trả `IpcResult` thay vì field `error` dùng chung.
  `useStoreInvalidation(['qc_points','test_levels'], testId, ...)` — xác
  nhận THẬT qua Electron: sửa Mean/SD ở tab Cấu hình chung rồi quay lại Nhập
  QC, trang tự refetch đúng, không cần rời/vào lại trang.

**Cột "song song 2 lô" hoàn tất 2026-09-06.** Không cần đổi schema:
`qc_points.lot` tách chuỗi điểm theo số lô; `qc_mean`/`qc_sd` chốt dải tại
thời điểm nhập; Mean/SD ứng viên đã nằm trong `lot_transitions.criteria_json`.
`entry:listParallelColumns` chỉ trả cột khi hồ sơ chuyển lô `active`, đúng
Panel QC, đúng lô đang vận hành và đúng mức. Điểm ứng viên được đánh giá bằng
Westgard `within` riêng, không tham gia kết luận ngày, Dashboard hay Westgard
của lô chính. Khi chấp nhận chuyển lô, `test_levels.qc_lot_id` đổi sang lô
mới nên chuỗi điểm ứng viên trở thành chuỗi đang vận hành mà không sao chép
dữ liệu. Renderer xếp cột song song ngay sau mức tương ứng trong worksheet,
biểu đồ và bảng chi tiết; tô nền hổ phách và gắn nhãn `Song song`. Điều hướng
bàn phím dùng `data-focus-column` nên hai cột cùng mức không còn bị nhập nhầm.

**Xem lô cũ hoàn tất 2026-09-06.** `entry:listPreviousLotSeries` lần ngược
chuỗi `lot_transitions` đã `accepted` từ lô đang vận hành, chỉ nhận lô thật
sự từng dẫn tới lô hiện tại. Mỗi chuỗi đọc Mean/SD đúng lô từ
`mean_sd_history_json` (fallback bằng snapshot `qc_mean`/`qc_sd` trên điểm),
tính Westgard `within` riêng và không trộn vào verdict hiện hành. Worksheet
luôn hiện điểm lô cũ đúng ngày ở trạng thái chỉ đọc; biểu đồ và bảng chi tiết
có nút "Xem lô cũ"/"Xem lô mới" để đổi cả dải mục tiêu lẫn chuỗi điểm.

**Tra cứu điểm đã hủy hoàn tất 2026-09-06.** Trước đó renderer có sẵn khối
"Điểm đã hủy" nhưng `entry:queryPoints` chỉ trả `voided=0`, nên khối này
không bao giờ có dữ liệu. Giữ `queryPoints` sạch cho Westgard và thêm endpoint
đọc riêng `entry:listVoidedPoints`; bảng tra cứu chung dưới các thẻ mức hiển
thị ngày, mức/lô, giá trị, lần chạy, đúng `voided_by` và `void_reason`.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 21/21 (không cần
thêm test Node mới — `addPoint()` chỉ thêm cột lưu, không đổi hợp đồng input/
output mà test cũ đã khoá), `app-v2:build` sạch, cộng kịch bản Playwright
`_electron` tạm (không commit): tạo máy+xét nghiệm+Mean/SD qua Cấu hình
chung → sang Nhập QC, lọc xét nghiệm bằng ô tìm kiếm → thêm 1 điểm bình
thường (verdict "Đạt") → thêm 1 điểm lệch >3SD (verdict "Vi phạm", luật
"1-3s" hiện đúng) → lọc theo khoảng ngày còn đúng 1 dòng → huỷ điểm: bấm
"Huỷ điểm này" khi chưa nhập lý do bị chặn đúng thông báo, nhập lý do xong
thì điểm biến mất khỏi danh sách đang hoạt động → **xác nhận `store:changed`
sống thật giữa 2 trang khác nhau**: đổi Mean/SD ở Cấu hình chung, quay lại
Nhập QC không cần tải lại gì, dữ liệu vẫn đúng — zero console error.

**Giai đoạn B3 — Phân tích Westgard, "làm đầy đủ" (xong, 2026-08-31).** Trang
thí điểm cũ (đen trắng, không badge, không tab) thay bằng: 2 tab (Tổng
quan/Nhóm lô đã dừng), `<QcChart>` LJ+CUSUM dùng lại y hệt Entry, bảng luật
kèm gợi ý khắc phục.
- `westgard-handlers.ts`'s `analyzeLevel()` trả thêm `fix` (gợi ý khắc phục
  từ `WG_RULE_REGISTRY`) cho mỗi luật — trước đây chỉ có `id`/`desc`/`on`,
  trang phải tự đoán nội dung; giờ copy nguyên văn từ registry, khớp nguyên
  tắc "nội dung lâm sàng copy y nguyên, không diễn giải lại".
- Tab "Nhóm lô đã dừng" KHÔNG có domain/IPC riêng — chỉ lọc lại
  `manage-store.ts`'s `lotGroups` (đã có từ B1) theo `status==='stopped'`,
  đúng nguyên tắc "không domain mới nếu đã có API phù hợp" (giống Dashboard/
  Audit của bản cũ).
- `useStoreInvalidation(['tests','qc_points'], testId, ...)` — đổi Mean/SD
  hoặc thêm điểm QC ở Entry, quay lại Westgard tự cập nhật không cần tải lại.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 21/21 (không cần test
Node mới — `analyzeLevel()` chỉ thêm 1 field vào object trả về, không đổi gì
test cũ đang khoá), `app-v2:build` sạch, cộng kịch bản Playwright `_electron`
tạm: tạo dữ liệu qua Cấu hình chung + Nhập QC (1 điểm đạt, 1 điểm vi phạm
1-3s) → mở Phân tích Westgard, tổng quan hiện đúng badge "Vi phạm" → bấm vào
dòng mở chi tiết, bảng luật hiện đúng gợi ý khắc phục → tắt luật 1-3s qua
checkbox, xác nhận lưu đúng (nối `saveRuleAction` module Westgard, cùng cột
`rule_actions_json` mà tab "Danh mục xét nghiệm" ở Cấu hình chung ghi) → đổi
biểu đồ sang CUSUM không lỗi → tab "Nhóm lô đã dừng" hiện đúng nhóm + 2 lô
đã tạo ở B1 — zero console error.

**Giai đoạn B4 — Six Sigma, "làm đầy đủ" (xong, 2026-08-31).** Trang thí
điểm cũ (1 input Bias%/1 input u(cal) đơn lẻ) thay bằng: modal Bias% nhiều
vòng EQA/EQC (RMS, cảnh báo lệch dấu), modal MU budget (bảng 3 thành phần +
cờ "chưa đánh giá"), TEa tự khớp `tea_refs`.
- `main/domain/sigma-metrics.ts` thêm `eqaRoundsStats()` (RMS + mean tham
  khảo + `biasRefU`=u(Cref)=SD giữa các vòng/căn(n), cờ `mixedSigns`) — hàm
  MỚI hoàn toàn, không có sẵn ở `assets/core.js` bản cũ để đối chiếu trực
  tiếp (bản cũ tính ở `sgBiasStats()`, một hàm trình bày không tách rời được
  để require() độc lập), nên `tests/eqa-rounds-stats.test.mjs` đối chiếu
  bằng số tính tay (RMS của [-2,2] phải là 2, không phải trung bình cộng=0)
  thay vì so với QCCore — ghi rõ lý do trong comment đầu file, không lặng lẽ
  hạ chuẩn "đối chiếu test cũ".
- `sigma-handlers.ts`'s `computeLevel()`: nếu mức có `eqaRounds` lưu kèm,
  RMS của các vòng LUÔN thắng giá trị `biasEqa` đơn lẻ cũ (không dùng song
  song 2 nguồn), và `biasRefU` tính được feed thẳng vào `uncertaintyBudget()`
  — trước đây `biasRefU` luôn `null` vì không có nguồn nào tính ra nó.
  `SigmaLevelResult` thêm `eqaRounds`/`mixedSigns` — mở rộng thuần tuý,
  không đổi field cũ nên test cũ (`sigma-handlers.test.mjs`) không cần sửa,
  chỉ thêm case mới.
- Renderer: `resolveTeaRef(testName, refs)` (trong `SigmaPage.tsx`, không
  qua IPC riêng — so khớp chuỗi đơn giản trên danh sách `teaRefs` đã tải sẵn
  từ `manage-store`) khớp EXACT tên trước, rồi longest-prefix, đúng nguyên
  tắc `sgRef()` bản cũ (vd "CK-MB" không thừa hưởng "CK") — chỉ gợi ý mặc
  định khi tạo kỳ mới, người dùng vẫn sửa tay được. `BiasModal` xem trước
  RMS SỐNG (tính lại tại client mỗi lần gõ, không cần round-trip IPC) trước
  khi áp dụng — khớp UX "xem trước rồi mới lưu" của bản cũ. `MuModal` liệt
  kê rõ 3 thành phần + đánh dấu "Chưa đánh giá" cho u(cal) còn thiếu (KHÔNG
  hiện là 0 — giữ đúng nguyên tắc ISO/TS 20914 đã chốt từ trước).

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 22/22 (thêm
`eqa-rounds-stats.test.mjs`, mở rộng `sigma-handlers.test.mjs` với case
nhiều vòng lệch dấu), `app-v2:build` sạch, cộng kịch bản Playwright
`_electron` tạm: tạo hồ sơ TEa tên "Glucose" → tạo xét nghiệm cùng tên → mở
Six Sigma, "+ Thêm kỳ" tự gợi ý đúng TEa=10 từ hồ sơ vừa tạo → sửa CV=3 →
mở modal Bias, nhập 2 vòng [-2, 2], xem trước đúng RMS=2.000 + cảnh báo lệch
dấu → áp dụng, bảng hiện đúng Bias=2.00 kèm badge cảnh báo, Sigma=(10-2)/3=2.67
→ mở modal MU, xác nhận hiện "Chưa đánh giá" cho u(cal) → nhập u(cal)=0.4,
lưu → U tính đúng 8.28 (=2×√(3²+2.828²+0.4²)) và badge chuyển thành "Đủ" —
zero console error.

**Giai đoạn B5 — Khắc phục sự cố (NCE), "làm đầy đủ" (xong, 2026-08-31).**
Trang thí điểm cũ (1 form phẳng: test/ngày/luật/lỗi/xử lý/hạn) thay bằng
form/chi tiết 8 phần thật (nhận diện → điều tra → nguyên nhân → khắc phục →
rerun → release-to-service → hiệu lực → residual-risk), chip gợi ý theo
SE/RE, mở vòng tiếp theo, quy trình 8 bước dạng modal tĩnh. Phạm vi CỐ Ý rút
gọn so với bản cũ: chip gợi ý là tập rút gọn 4 câu/loại (không port hết
`ACT_SUGGEST` — bảng chip lâm sàng rất lớn của bản cũ), chưa có checklist chi
tiết/investigation theo mẫu SOP cụ thể (chỉ 1 ô văn bản tự do).
- `main/domain/nce-validation.ts` thêm 3 hàm validate mới:
  `validateReleaseDecision` (giữ/phát hành kết quả bệnh nhân, bắt buộc lý do
  ≥5 ký tự), `validateRerunEvidence` (bắt buộc chọn 1 điểm QC THẬT, không
  phải mô tả tay), `validateResidualRisk` (residualRisk bắt buộc ≥5 ký tự
  CHỈ khi kết luận "effective" — "ineffective" thì không cần, vì hồ sơ chưa
  đóng). `NceCreateInput`/`PreparedNceCreate` mở rộng thêm
  `investigation`/`causeCategory`/`causeDescription`.
- `nce-handlers.ts` thêm 3 handler: `setReleaseDecision`, `setRerunEvidence`
  (xác nhận điểm QC tồn tại VÀ cùng xét nghiệm với hồ sơ — chặn gán nhầm
  bằng chứng từ xét nghiệm khác, có test riêng cho cả 2 điều kiện), `reopenNce`
  (mở vòng tiếp theo — tạo BẢN GHI MỚI dùng `parent_nce_id`/`follow_up_nce_id`
  đã có sẵn trong schema nhưng chưa từng được dùng tới bước này, tham khảo
  `action-escalation-service.ts`'s `createFollowUp()` bản cũ; chặn mở vòng 2
  từ 1 hồ sơ đã có follow-up — mỗi hồ sơ chỉ mở đúng 1 vòng tiếp theo).
  `markEffectiveness()` viết lại: cổng `residualRisk` cố ý đặt SAU cổng
  "chưa có ngày hoàn thành" (không phải trước) — báo lỗi theo đúng thứ tự
  thao tác thật, tránh hỏi đánh giá rủi ro cho hồ sơ còn chưa đủ điều kiện.
  Phát hiện khi sửa `tests/nce-handlers.test.mjs` (bài test cũ giả định thứ
  tự cổng, đổi thứ tự làm lộ ra ngay).
- Renderer: `ActionsPage.tsx` viết lại hoàn toàn — danh sách hồ sơ (badge
  màu theo trạng thái duyệt/hiệu lực, đánh dấu "vòng tiếp" nếu có
  `parent_nce_id`) + `CreateModal` (form 4 phần đầu, chip nguyên nhân bấm là
  nối thẳng vào ô mô tả) + `DetailModal` (8 phần, mỗi phần tự quyết định
  hiện form nhập hay chỉ đọc dựa trên dữ liệu đã có — vd phần Rerun chỉ hiện
  ô chọn điểm QC nếu CHƯA gắn bằng chứng, đọc danh sách điểm qua
  `window.qcApi.queryPoints()` đã có sẵn từ Entry) + modal "Quy trình 8
  bước" tĩnh. `nce-store.ts` viết lại, mọi hàm trả `IpcResult` để
  `DetailModal` hiện đúng lỗi của đúng thao tác đang làm (không còn 1
  field `error` dùng chung).

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 22/22 (mở rộng
`tests/nce-handlers.test.mjs` với 3 cổng mới + kịch bản mở vòng tiếp theo
đầy đủ — không mất bài test nào cũ, chỉ sửa 1 chỗ thứ tự lỗi như trên),
`app-v2:build` sạch, cộng kịch bản Playwright `_electron` tạm đi hết vòng
đời 1 hồ sơ: tạo qua form 4 phần (bấm chip nguyên nhân RE, xác nhận nối
đúng vào ô mô tả) → mở chi tiết xác nhận cả 8 phần hiện đúng → gắn bằng
chứng rerun từ điểm QC thật vừa tạo ở Entry → lưu quyết định
release-to-service → lưu ngày hoàn thành → kết luận "không hiệu quả" (không
cần residual-risk) → "Mở vòng tiếp theo" tạo đúng hồ sơ con, badge "vòng
tiếp" hiện trên danh sách → duyệt hồ sơ, nút Huỷ biến mất đúng quy tắc — zero
console error.

**Giai đoạn B6 — So sánh hóa chất, "làm đầy đủ" (xong, 2026-08-31).** Trang
thí điểm cũ (5 trường metadata, danh sách phẳng) thay bằng: modal chọn/tạo
phép so sánh có tìm kiếm, form đủ 9 trường metadata, bảng cặp mẫu thêm/xoá/
xoá hết, 2 biểu đồ scatter + Bland-Altman.
- **Phát hiện quan trọng, tự sửa lại giữa chừng**: kế hoạch (docs/APP-V2-PLAN.md)
  ghi "kiểm tra `reagent-stats.ts` đã đủ Deming/Passing-Bablok/Bland-Altman
  chưa" — dựa theo câu mô tả trong CLAUDE.md về app cũ. Khi tra thẳng mã
  nguồn app cũ (`src/domain/reagent/*.ts`, `grep -ri deming`) thì KHÔNG CÓ
  hồi quy Deming nào cả — app cũ chỉ có OLS (`reagentOls`) + Passing-Bablok
  (`reagentPassingBablok`); "Deming/OLS" trong mô tả kiến trúc chỉ là cách
  gọi lỏng lẻo, không phải 2 thuật toán khác nhau. Đã VIẾT rồi XOÁ LẠI một
  hàm `reagentDeming()` mới thêm vào `reagent-stats.ts` khi phát hiện ra
  điều này — đúng nguyên tắc "giống app cũ" nghĩa là KHÔNG được tự thêm
  thuật toán lâm sàng mà bản cũ không có, dù nghe có vẻ "đầy đủ hơn". Bài
  học: khi kế hoạch mô tả một tính năng nghe mơ hồ, phải tra thẳng mã nguồn
  thật trước khi code, không tin nguyên văn tài liệu kiến trúc.
- Phần "Bland-Altman" THẬT SỰ đang thiếu (không phải hiểu lầm): app cũ có
  `reagent-bland-svg.ts` vẽ biểu đồ nhưng KHÔNG lộ `loaLower`/`loaUpper` ra
  ngoài object kết quả — 2 số này chỉ tính inline ngay trong hàm vẽ SVG
  (`up`/`low` cục bộ). `reagent-stats.ts`'s `calculateReagentComparison()`
  giờ tính và trả `loaLower`/`loaUpper` ở tầng domain (CÙNG công thức
  `md ± 1.96·sdd`, đối chiếu tay với `reagent-bland-svg.ts` để xác nhận khớp
  100%, không phải phát minh công thức mới) — hợp lý hơn vì domain nên là
  nguồn số liệu duy nhất, không phải trình vẽ SVG giữ số liệu.
- Renderer: `components/ReagentChart.tsx` (mới, canvas ref chuẩn React) vẽ
  scatter (kèm đường y=x tham chiếu + hồi quy OLS) và Bland-Altman (bias +
  2 đường LoA) — thay 2 hàm build chuỗi SVG (`reagent-scatter-svg.ts`/
  `reagent-bland-svg.ts`) của bản cũ, cùng dữ liệu đầu vào
  (`ReagentComparisonResult`), khác cách vẽ — đúng nguyên tắc đã chốt.
  `ReagentPage.tsx` viết lại: `PickerModal` (tìm kiếm + tạo mới, dùng
  `<Modal>` Giai đoạn A1), form metadata bổ sung 4 trường trước đây chưa có
  UI (ngày, người thực hiện, loại mẫu, alpha — domain đã có sẵn từ trước,
  chỉ thiếu form), bảng cặp mẫu thêm nút "Xoá hết" (qua `confirmDialog`,
  trước đây phải xoá tay từng dòng).

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 22/22 (không cần
test mới — chỉ thêm 2 field tính toán vào object trả về, các test cũ dùng
so sánh field-by-field chứ không deepEqual toàn bộ object nên không vỡ),
`app-v2:build` sạch, cộng kịch bản Playwright `_electron` tạm: điền đủ
metadata → nhập 24 cặp giá trị lệch 1% → xác nhận coverage → bảng kết quả
hiện đúng N=24, %Bias=1.00% (Đạt), Bland-Altman LoA đúng khoảng, cả 2 biểu
đồ vẽ đúng hình (đường y=x + hồi quy trên scatter, dải LoA trên Bland-Altman)
→ mở modal chọn/tạo, tìm kiếm lọc đúng, tạo phép so sánh mới rồi xoá lại
(quay về đúng phép so sánh cũ) — zero console error.

**Giai đoạn B7 — Người dùng, "làm đầy đủ" một phần (2026-08-31).** Chỉ cần
polish CSS thật (bảng/badge/Modal token chung thay style trần) vì phần
nghiệp vụ (CRUD/khoá/đặt lại mật khẩu) đã đúng từ module thí điểm — không
đổi `users-handlers`/domain nào. `AddUserModal`/`ResetPasswordModal` dùng
`<Modal>` Giai đoạn A1. **"Modal sửa quyền theo trang" CỐ Ý CHƯA LÀM** — phụ
thuộc `pagePerms` (Giai đoạn A2, đã dời sau từ đầu kế hoạch, xem
docs/APP-V2-PLAN.md) — 3 vai trò cố định vẫn đủ dùng, chưa có gì để "sửa
quyền theo trang" nếu trang nào cũng cho phép như nhau theo vai trò.
Verify: `app-v2:typecheck`/`test` 22/22/`build` sạch, cộng kịch bản
Playwright `_electron` tạm: tài khoản đang đăng nhập hiện đúng badge "bạn" →
thêm người dùng mới qua modal → khoá tài khoản đó (checkbox), badge chuyển
"Đã khoá" → đặt lại mật khẩu qua modal, xác nhận thông báo đúng — zero
console error.

**Giai đoạn B8 — Nhật ký hoạt động, "làm đầy đủ" (xong, 2026-08-31).** Trang
thí điểm cũ (tìm kiếm + phân trang) thay bằng thêm: xuất CSV, lưu trữ log cũ
(12/24/36 tháng), nút xác minh chuỗi hash thủ công.
- `main/ipc/audit-handlers.ts` thêm 3 hàm: `exportCsv` (CSV cùng bộ lọc đang
  áp dụng trên trang), `verifyChainNow` (đọc lại đúng anchor đã lưu, không
  xác minh từ seq=1 như log chưa từng bị cắt — nếu không sẽ báo sai "chuỗi bị
  phá" ngay sau một lần lưu trữ hợp lệ), `archive(months)` — **dùng
  `app_meta` (bảng key/value đã có sẵn từ đầu, dùng cho `schemaVersion`,
  chưa dùng cho gì khác) để lưu `activityAnchor`** — bản cũ có riêng 1 cột
  `activityAnchor` ở tầng lưu trữ (Firebase top-level), app-v2 không có
  khái niệm tương đương nên tái dùng `app_meta` thay vì thêm cột riêng vào
  bảng `activity`. Chỉ nhận đúng 3 mốc 12/24/36 tháng (khớp bản cũ), xoá
  thẳng khỏi bảng sống (không soft-delete — bảng `activity` vốn append-only,
  không có cột `voided` như `qc_points`).
- Renderer: nút "Xuất CSV" build `Blob` + `<a download>` tự tạo/click/thu hồi
  `ObjectURL` — không cần IPC lưu file riêng (renderer đã có quyền tạo blob:
  URL, đây là cơ chế tải file chuẩn của trình duyệt, không phải đặc thù
  Electron). `ArchiveModal` bắt buộc `reauthDialog()` trước khi xoá (thao
  tác không thể hoàn tác), TỰ ĐỘNG tải CSV toàn bộ log hiện có trước khi gọi
  `archive()` — người dùng luôn có bản sao trước khi phần cũ biến mất khỏi
  bảng sống, không cần thao tác xuất riêng.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 22/22 (mở rộng
`tests/audit-handlers.test.mjs`: chèn 1 dòng audit giả 3 năm trước trực
tiếp vào DB — nối lại đúng hash-chain bằng `relinkAuditChain()` với `seq`
gán TRƯỚC khi tính hash, vì `auditEntryHash()` tính cả `seq` vào payload,
gán `seq` SAU khi hash sẽ làm hash/seq lệch nhau và tự phá chuỗi của chính
kịch bản test — rồi xác nhận `archive(12)` xoá đúng 1 dòng, chuỗi vẫn xác
minh được sau khi cắt), `app-v2:build` sạch, cộng kịch bản Playwright
`_electron` tạm: xác minh chuỗi báo "Hợp lệ" → tìm kiếm lọc đúng → xuất CSV
và lưu trữ log cũ chạy không lỗi console (Electron/Playwright trong môi
trường này không luôn bắt được sự kiện `download` cho click tải blob: URL —
xác nhận bằng cách khác: không có lỗi console nào khi bấm, và toàn bộ luồng
reauth→tải CSV→archive→thông báo kết quả chạy trọn vẹn) → lưu trữ với DB
mới tạo (0 dòng đủ cũ) báo đúng "Không có dòng nào cũ hơn mốc đã chọn" —
zero console error.

**Giai đoạn B9 — Tổng quan/Dashboard, "làm đầy đủ" (xong, 2026-08-31).**
Vẫn KHÔNG có domain/IPC riêng — chỉ tổng hợp lại 3 API có sẵn (đúng nguyên
tắc "không domain mới nếu đã có API phù hợp", giữ nguyên từ module thí
điểm). Thay đổi thật duy nhất, đúng mục còn thiếu ghi từ đầu:
`useStoreInvalidation(['qc_points','tests','actions','activity'], undefined,
load)` — trước đây trang chỉ fetch 1 lần lúc mount, dữ liệu đổi ở trang khác
sau khi Dashboard đã mở không tự cập nhật cho tới khi rời/vào lại (giới hạn
đã ghi từ 2026-08-31 lúc tạo module thí điểm này). Còn lại là polish CSS
(KPI card 4 ô, badge màu theo verdict, `<table class="data-table">` thay
`<table>` trần).

Verify: `npm run app-v2:typecheck`/`test` 22/22/`build` sạch — không có test
Node mới vì trang không có logic riêng ngoài gọi API đã test ở module gốc,
cộng kịch bản Playwright `_electron` tạm **thiết kế đúng để chứng minh live-
update thật, không phải chỉ tải lại**: mở Dashboard NGAY SAU đăng nhập (chưa
có dữ liệu, đúng trạng thái rỗng) → **KHÔNG rời trang, không reload** — điều
hướng qua sidebar sang Cấu hình chung/Nhập QC/Khắc phục sự cố để tạo máy +
xét nghiệm + Mean/SD + 1 điểm QC vi phạm 1-3s + 1 hồ sơ NCE quá hạn → quay
lại Dashboard chỉ bằng click sidebar (route vẫn mounted từ đầu, component
Dashboard không unmount/remount) → xác nhận cả 4 khối (KPI/Cảnh báo Westgard/
Sự cố quá hạn/Hoạt động gần đây) tự hiện đúng dữ liệu mới — đây chính là kịch
bản chứng minh giới hạn cũ ĐÃ ĐƯỢC SỬA, không phải chỉ xác nhận trang tải
được dữ liệu — zero console error.

**Giai đoạn B10 — Cài đặt, "làm đầy đủ" một phần (2026-08-31).** Thêm logo/
brand ảnh (canvas resize) + kiểm tra dung lượng lưu trữ. Firebase/LIS
Gateway/backup-restore CỐ Ý CHƯA LÀM — thuộc Giai đoạn C, cần hạ tầng thật
trước (đồng bộ/backup), không phải chỉ thêm form rỗng.
- `main/domain/settings-validation.ts`'s `prepareLabProfile()` nhận thêm
  tham số `existing` (logo hiện có) — vì FORM KHÔNG GỬI LẠI ảnh mỗi lần lưu
  (chỉ gửi khi người dùng thật sự chọn ảnh mới), thiếu `logoData` trong input
  phải hiểu là "giữ nguyên", không phải "xoá logo". Thêm cờ `clearLogo`
  riêng cho hành động xoá tường minh — tránh nhầm giữa "không gửi ảnh mới"
  và "xoá ảnh".
- `settings-handlers.ts` thêm `getStorageInfo()` — kích thước file SQLite
  THẬT trên đĩa (`fs.statSync(dbPath).size`), thay khái niệm "dung lượng
  localStorage" của bản cũ không còn ý nghĩa gì ở app-v2 (mọi dữ liệu giờ
  nằm trong 1 file SQLite thật, không phải trình duyệt). `createSettingsHandlers()`
  đổi chữ ký nhận thêm `dbPath` (trước đó chỉ nhận `db`) — `main/index.ts`
  truyền vào biến `dbPath` đã có sẵn từ lúc mở DB.
- **Bug thật bắt được qua Playwright `_electron`**: chọn ảnh logo xong,
  ảnh xem trước KHÔNG hiện — nguyên nhân là CSP của `app-v2/renderer/index.html`
  thiếu hẳn chỉ thị `img-src` (mặc định rơi về `default-src 'self'`, mà
  `data:` URL KHÔNG khớp `'self'` — khác scheme). Bước resize ảnh
  (`new Image(); img.src = dataURL`) bị chặn ngay từ khi ĐỌC LẠI file vừa
  chọn, không phải chỉ lúc hiển thị — `onload` không bao giờ chạy, logo
  "biến mất" một cách im lặng, không có exception nào lộ ra ngoài. Đối
  chiếu với CSP thật của bản cũ (`index.html` gốc) xác nhận bản cũ đã có sẵn
  `img-src 'self' data: blob:` — bổ sung đúng chỉ thị này vào
  `app-v2/renderer/index.html`. Đây là lỗi CÓ THỂ ĐÃ ẨN Ở BẤT KỲ TÍNH NĂNG
  NÀO cần hiển thị ảnh trong app-v2 (không riêng Settings) — may là logo là
  tính năng đầu tiên chạm tới ảnh nên bắt được ngay.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 22/22 (mở rộng
`settings-handlers.test.mjs`: logo giữ nguyên khi sửa trường khác,
`clearLogo` xoá đúng, `getStorageInfo()` với `:memory:` trả 0 không lỗi),
`app-v2:build` sạch, cộng kịch bản Playwright `_electron` tạm: mở Cài đặt,
xác nhận dung lượng hiện đúng kích thước file THẬT (không phải 0 giả) →
chọn ảnh logo thật (upload file), xem trước hiện đúng sau khi sửa CSP → lưu
→ điều hướng sang Tổng quan rồi quay lại Cài đặt (không reload toàn trang) —
tên phòng xét nghiệm VÀ logo đều còn nguyên (chứng minh ghi DB thật, không
chỉ state cục bộ) → xoá logo, xác nhận biến mất — zero console error sau
khi sửa CSP.

**Giai đoạn B11 — Báo cáo, "làm đầy đủ" một phần (2026-08-31 — 11/11 trang
Giai đoạn B đã qua ít nhất 1 lượt "làm đầy đủ").** Thêm: khoá/mở kỳ báo cáo
giờ bắt buộc `reauthDialog()` trước khi thực thi (đúng danh sách ~9 thao tác
nhạy cảm bản cũ — trước đây bấm là chạy ngay, không xác thực lại), xuất CSV
bảng "Xem lại điểm QC". **In PDF + xuất Excel CỐ Ý CHƯA LÀM** — đây chính là
2 việc thuộc Giai đoạn C ("In ấn & xuất Excel/CSV") mà kế hoạch đã ghi rõ
cần CHỐT quyết định kiến trúc trước (port `XlsxCore` viết tay của bản cũ hay
dùng thư viện npm thật như `exceljs`) — không phải chỉ thêm nút, nên không
tự quyết giữa chừng trang này.
- Xuất CSV không cần domain/IPC mới: `points` đã có sẵn ở renderer (từ
  `report:queryReport` đã tồn tại), build CSV thẳng ở client — khác Audit
  (cần lọc phía server vì Audit lọc toàn bộ dữ liệu, Report chỉ xuất đúng
  tập đã tải).
- `report-store.ts` viết lại: `lock`/`unlock` trả `IpcResult` thay vì field
  `error` dùng chung.

Verify: `npm run app-v2:typecheck`/`test` 22/22/`build` sạch (không cần
test Node mới — không đổi hợp đồng IPC nào, chỉ thêm gate UI phía renderer),
cộng kịch bản Playwright `_electron` tạm: khoá kỳ 2026-03 qua `reauthDialog`
thật → xác nhận enforcement THẬT vẫn đúng bằng cách quay sang Nhập QC thử
thêm điểm vào đúng kỳ đó, bị chặn với thông báo đúng (test giao 2 module,
xác nhận lại đúng nguyên tắc `period-lock-enforcement.test.mjs` đã có ở tầng
Node) → quay lại Báo cáo, xem lại điểm QC đúng 1 dòng, xuất CSV không lỗi →
mở khoá qua `reauthDialog` thật, bảng khoá trở về rỗng — zero console error.

**11/11 trang Giai đoạn B đã qua ít nhất 1 lượt "làm đầy đủ" (2026-08-31).**
Các mục còn treo, đã ghi rõ lý do kỹ thuật ở từng trang thay vì chỉ liệt kê
"chưa làm": modal sửa quyền theo trang (B7, chờ A2), Firebase/LIS Gateway/
backup-restore/in PDF/xuất Excel (B10/B11, chờ Giai đoạn C). Cột song song
2 lô và phạm vi luật within/across đã hoàn tất ngày 2026-09-06. Toàn bộ mục
còn lại đều là hạng mục Giai đoạn C hoặc
đã ghi rõ trong docs/APP-V2-PLAN.md's bảng Tiến độ — không có gì bị bỏ sót
không ghi chú.

**Giai đoạn C1 — In ấn & xuất Excel/CSV (xong phần lõi cơ chế, 2026-09-01).**
Người dùng uỷ quyền chốt quyết định kiến trúc: **dùng thư viện npm thật
`exceljs`** cho Excel (thêm vào `dependencies` — `npm install exceljs`),
KHÔNG port `XlsxCore`/ZIP-OOXML viết tay của bản cũ — main process app-v2 là
Node thật, không còn ràng buộc "0 dependency runtime" mà bản cũ phải tuân
theo vì chạy trong trình duyệt. PDF dùng thẳng `webContents.printToPDF` của
Electron, không cần thư viện gì thêm.
- `main/ipc/export-handlers.ts` (mới): `buildXlsxBase64({sheetName, headers,
  rows})` — hàm thuần dựng workbook qua `exceljs`, trả base64 (renderer tự
  giải mã thành Blob rồi tải về, cùng cơ chế `downloadCsv` đã dùng ở Audit/
  Report — không cần hộp thoại lưu file cho Excel, nhẹ hơn cho tải nhanh 1
  bảng). Tên sheet tự cắt về ≤31 ký tự (giới hạn thật của định dạng .xlsx,
  vượt quá sẽ khiến `exceljs` ném lỗi khi ghi).
- `printHtmlToPdf(parentWin, html, defaultFileName)` — mở 1 `BrowserWindow`
  ẩn (`sandbox:true, contextIsolation:true, nodeIntegration:false` — cửa sổ
  chỉ hiển thị HTML tĩnh để in, không cần chạy JS gì), nạp HTML qua
  `data:` URL (không phải file thật, không cần dọn dẹp), gọi
  `printToPDF({printBackground:true, preferCSSPageSize:true})`, rồi hỏi nơi
  lưu qua `dialog.showSaveDialog` NATIVE thật (khác Excel có chủ đích — PDF
  là "kết xuất trình bày" nên giữ đúng luồng "Lưu PDF" của bản cũ, không tải
  ngầm qua Blob).
- Renderer: `renderer/lib/export.ts` (mới, dùng chung mọi trang):
  `exportTableXlsx()`/`printHtmlToPdf()`. **Trang đầu tiên áp dụng: Báo cáo**
  (`ReportPage.tsx`) — thêm nút "In PDF"/"Xuất Excel" cạnh "Xuất CSV" đã có
  từ B11, cộng `buildReportPrintHtml()` (hàm thuần dựng HTML in — trang tĩnh
  tự đứng một mình, không phụ thuộc CSS/JS của app chính, cùng tinh thần
  cửa sổ in độc lập của bản cũ).

**Phạm vi CỐ Ý rút gọn** — chỉ chứng minh CƠ CHẾ đúng (Excel thật qua
exceljs, PDF thật qua printToPDF, cả hai đã verify sinh ra file đúng định
dạng), CHƯA áp dụng cho mọi báo cáo như bản cũ (Sigma/Westgard cũng có in/
xuất riêng ở bản cũ, HTML in đẹp có logo/chữ ký/phụ lục NCE) — đó là công
việc lặp lại cơ chế đã có cho từng trang, để dành cho khi cần, không phải
thiếu sót kiến trúc.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 23/23 (thêm
`export-handlers.test.mjs` — build 1 file .xlsx rồi ĐỌC LẠI bằng chính
`exceljs` để xác nhận header/hàng đúng, không chỉ kiểm tra chuỗi base64
không rỗng; xác nhận tên sheet quá 31 ký tự tự cắt, không ném lỗi;
`printHtmlToPdf()` cần `BrowserWindow` thật nên không test được ở Node
thuần, xác nhận qua Playwright `_electron`), `app-v2:build` sạch, cộng kịch
bản Playwright `_electron` tạm: **stub `dialog.showSaveDialog` qua
`app.evaluate()`** (Playwright không điều khiển được hộp thoại lưu file
native của hệ điều hành) → tạo dữ liệu qua Cấu hình chung/Nhập QC → sang Báo
cáo, xem lại điểm QC → bấm "Xuất Excel" không lỗi console → bấm "In PDF",
xác nhận file THẬT được ghi ra đĩa (42KB, mở đầu đúng magic bytes `%PDF-` —
không chỉ tin nút bấm không crash) — zero console error.

**Giai đoạn C3 — Backup/phục hồi (xong, 2026-09-01).** Người dùng quyết định
tạm dừng C2 (Firebase sync — cần thông tin dự án Firebase thật chưa có) và
chuyển sang C3/C4/C5. Định dạng backup app-v2 **cố ý KHÔNG tương thích byte
với bản cũ** (`'qclab-v2-backup'` riêng, khác `'qclab-backup'` của bản cũ) —
hai bên có hình dạng dữ liệu hoàn toàn khác nhau (SQLite quan hệ vs 1 object
JS lồng nhau); phục hồi được TỪ định dạng bản cũ là việc của C4 (di trú dữ
liệu), không phải C3.
- `main/domain/backup.ts` (mới): `BACKUP_FORMAT='qclab-v2-backup'`,
  `BACKUP_FORMAT_VERSION=1`, `computeChecksum()` (SHA-256 qua `node:crypto`
  thật, không tự viết như bản cũ phải làm để chạy trong trình duyệt),
  `buildBackupEnvelope()`, và `validateBackupEnvelope()` — hàm THUẦN, không
  đụng DB, dễ test không cần SQLite: kiểm đủ `format` đúng chuỗi, `schemaVersion`
  không vượt quá bản hiện tại (backup từ tương lai bị chặn, cùng nguyên tắc
  `validateStateInvariants()` của bản cũ), `data` là object, và checksum khớp
  `computeChecksum(JSON.stringify(data))` — sai bất kỳ ký tự nào trong `data`
  đều bị phát hiện.
- `main/ipc/backup-handlers.ts` (mới): đọc/ghi TOÀN BỘ bảng một cách TỔNG
  QUÁT qua `sqlite_master`/`PRAGMA table_info` — không hard-code danh sách
  bảng/cột, để không lệch mỗi khi `schema.ts` thêm bảng/cột mới (tự động
  theo kịp, không phải nhớ sửa 2 nơi, đúng tinh thần "đơn giản hơn bản cũ"
  của kiến trúc mới). `exportBackup(actor)` dump mọi bảng, ghi 1 dòng audit.
  `importBackup({json}, actor)`: **chỉ admin** → parse JSON (bắt lỗi hỏng
  hoàn toàn, báo `invalid-json` không crash) → `validateBackupEnvelope()` →
  **tự động chốt 1 bản "an toàn trước khi phục hồi"** ra đĩa thật
  (`userDataDir/pre-restore-backup-<ts>.json`) TRƯỚC KHI xoá bất cứ gì — nếu
  bước này lỗi thì HUỶ LUÔN việc phục hồi (`snapshot-failed`), không ghi đè
  khi chưa chắc có đường lùi, đúng nguyên tắc `BackupImportCommand` bản cũ →
  `restoreFromEnvelope()` chạy trong 1 transaction thật
  (`PRAGMA foreign_keys=OFF` + `BEGIN`, xoá mọi bảng theo thứ tự NGƯỢC liệt
  kê, insert lại theo thứ tự thuận, `PRAGMA foreign_key_check` xác nhận
  không vi phạm ràng buộc trước khi `COMMIT`, `ROLLBACK` nếu có lỗi bất kỳ ở
  giữa) → ghi audit → `notifyChanged(listTableNames(db))` (phục hồi thay đổi
  GẦN NHƯ MỌI bảng cùng lúc, nên báo rộng hơn thường lệ thay vì chỉ
  `writeAudit()`'s mặc định `['activity']`, để mọi trang đang mở refetch
  đúng ngay, không cần khởi động lại app mới thấy dữ liệu đã phục hồi).
- `main/index.ts`/`preload.ts`/`shared/qc-api.d.ts`: thêm `userDataDir`
  (đường dẫn thật của Electron, không phải thư mục code), wiring
  `createBackupHandlers(db, userDataDir)`, kênh IPC `backup:export`/
  `backup:import`.
- `renderer/pages/SettingsPage.tsx`: panel "Sao lưu & phục hồi" mới —
  `exportBackupFile()` gọi IPC lấy JSON, đóng gói `Blob` rồi tải xuống qua
  `<a download>` (cùng cơ chế `downloadCsv` đã dùng ở Audit/Report).
  `pickBackupFile()`: đọc file người dùng chọn → **`confirmDialog` cảnh báo
  rõ ràng** ("sẽ THAY THẾ TOÀN BỘ dữ liệu hiện có... một bản sao lưu an toàn
  sẽ được tự động tạo trước khi ghi đè") → **`reauthDialog`** (phục hồi là
  thao tác không thể huỷ ngang, cùng hạng "thao tác nặng" với duyệt/hoàn NCE,
  khoá/mở khoá kỳ báo cáo của bản cũ) → gọi `importBackup` → `infoDialog`
  báo thành công kèm ĐƯỜNG DẪN THẬT của bản an toàn vừa tạo (không chỉ nói
  "đã lưu", để người dùng biết tìm ở đâu nếu cần khôi phục lại bản cũ).
- Một bug CSP đã sửa ở B10 (thiếu `img-src 'self' data: blob:`) được xác
  nhận lại không ảnh hưởng panel này — backup không qua `<img>`, chỉ qua
  `Blob`/`<a download>`, một cơ chế khác.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 24/24 (thêm
`backup-handlers.test.mjs` — kịch bản END-TO-END thật: tạo dữ liệu qua
`config-handlers` thật → export → **phục hồi vào 1 DB `:memory:` KHÁC** (mô
phỏng cài lại máy khác) → đối chiếu instrument/test/level khớp lại đúng;
cộng 5 điều kiện chặn: viewer không được phục hồi (`forbidden`), checksum bị
sửa 1 ký tự bị chặn (`checksum-mismatch`), sai định dạng
`'qclab-backup'` (bản cũ) bị chặn với thông báo riêng (`wrong-format`) —
xác nhận rõ C3 không nhận nhầm backup bản cũ, `schemaVersion` từ tương lai
bị chặn (`unsupported-schema`), JSON hỏng hoàn toàn không crash
(`invalid-json`)), `app-v2:build` sạch, cộng kịch bản Playwright `_electron`
tạm xác nhận trong Electron THẬT: tạo 1 máy (May A) → xuất backup qua gọi
IPC trực tiếp lấy đúng nội dung JSON (tránh sự cố Blob-download không đáng
tin cậy với `_electron` đã gặp nhiều lần ở B8/B11/C1) → thêm máy thứ 2 (May
B) → sang Cài đặt, chọn file backup cũ (chỉ có May A) qua input file thật →
đi qua đúng `confirmDialog` cảnh báo → `reauthDialog` nhập mật khẩu →
`infoDialog` báo thành công → **quay lại Cấu hình chung xác nhận dữ liệu
THẬT SỰ bị thay thế**: May A có mặt, May B đã biến mất (không chỉ tin thông
báo thành công, mà đọc lại state thật) → xác nhận file backup-an-toàn-trước-
khi-phục-hồi thật sự tồn tại trên đĩa trong `userDataDir` — zero console
error toàn bộ luồng.

**Giai đoạn C4 — Di trú dữ liệu từ app cũ (xong, 2026-09-01).** Khác hẳn C3
(round-trip trong CÙNG 1 định dạng): đây là ÁNH XẠ giữa 2 hình dạng dữ liệu
khác nhau — backup app cũ (`'qclab-backup'`, object lồng nhau: `tests[]`
mỗi test tự mang `levels[]`, `data{testId:[điểm QC]}`, `qcLots[]`,
`lotGroups[]`, `qcPanels[]` với `testIds[]`, `activity[]` hash-chain, …) sang
schema SQLite quan hệ của app-v2 (bảng riêng cho từng loại, khoá ngoại thật).
- `main/db/table-io.ts` (mới, tách ra từ `backup-handlers.ts` của C3): gom
  `listTableNames`/`columnsOf`/`dumpAllTables`/`restoreAllTables` (transaction
  xoá-hết-rồi-nạp-lại) và thêm `writeSafetySnapshot()` — dùng CHUNG cho cả
  phục hồi backup app-v2 (C3) lẫn di trú dữ liệu từ app cũ (C4), vì cả hai
  đều là thao tác THAY THẾ TOÀN BỘ dữ liệu, cùng cần đúng 1 đường lùi. `backup-
  handlers.ts` được sửa lại để gọi các hàm này thay vì tự khai báo (refactor
  thuần, không đổi hành vi — xác nhận lại 24/24 test C3 vẫn qua trước khi
  code C4 dựa lên trên).
- `main/domain/migrate-legacy.ts` (mới): `parseLegacyBackupEnvelope()` — kiểm
  `format==='qclab-backup'` (báo `wrong-format` rõ ràng nếu lỡ đưa nhầm backup
  app-v2 `'qclab-v2-backup'` vào đây) + checksum SHA-256 hex của
  `JSON.stringify(data)` qua `node:crypto` — ĐÚNG thuật toán app cũ dùng
  (`crypto.subtle.digest('SHA-256',...)` trong trình duyệt cho cùng input ra
  cùng hex). `mapLegacyStateToTables()` — hàm THUẦN, không đụng DB, ánh xạ
  từng bảng: máy, xét nghiệm + mức QC (kèm lịch sử Mean/SD), lô + nhóm lô,
  Panel QC (+ bảng nối `qc_panel_tests` từ `testIds[]`), chuyển tiếp lô, toàn
  bộ điểm QC, Sigma theo kỳ, người dùng, nhật ký hoạt động, hồ sơ NCE, so
  sánh hoá chất, khoá kỳ báo cáo, bảng TEa tham chiếu. KHÔNG cố "làm sạch
  lại" như `sanitizeBackup()` bản cũ — dữ liệu backup xuất từ 1 app đang chạy
  đã qua `ensureShape()` liên tục nên coi là hợp lệ, chỉ phòng thủ chống
  thiếu trường.
- **2 phát hiện quan trọng khi ánh xạ, không phải giả định trước**: (1) mật
  khẩu người dùng GIỮ NGUYÊN được — cả 2 app dùng ĐÚNG thuật toán PBKDF2-
  SHA256 + ĐÚNG định dạng chuỗi lưu `pbkdf2$<iter>$<salt>$<hash>` (xem
  CLAUDE.md "Module roles" → users-auth.js), nên chỉ cần copy `passHash`
  nguyên văn — không cần đặt lại mật khẩu sau di trú, xác nhận bằng test
  đăng nhập thật với mật khẩu gốc. (2) chuỗi hash tamper-evident của nhật ký
  hoạt động GIỮ NGUYÊN được — `audit-chain.ts` dùng ĐÚNG thuật toán
  (`auditCanonical`/`sha256(prevHash+'|'+canonical(payload))`) và ĐÚNG tên
  trường payload với bản cũ, nên chỉ cần đổi tên cột sang snake_case,
  `verifyAuditChain()` vẫn xác nhận đúng — KHÔNG cần `relinkAuditChain()` lại
  toàn bộ. Nếu log app cũ đã từng bị lưu trữ/xoay vòng (`activityAnchor`
  khác rỗng), anchor đó được mang sang `app_meta` (app-v2 đã có sẵn CÙNG cơ
  chế cho tính năng lưu trữ B8) — thiếu bước này thì `verifyAuditChain()` sẽ
  báo sai chuỗi ngay hàng đầu tiên sau di trú.
- **Hồ sơ NCE là phần lệch hình dạng nhiều nhất**: app-v2's NCE (xem
  `nce-validation.ts`) là bản RÚT GỌN cho giai đoạn đầu (chưa có protocol-v3
  FMEA đầy đủ: containment/qcMaterial/instrument/reagent/calibration/
  lotToLot status, risk S/O/D...). Không cố tổng hợp lại các trường đó thành
  văn xuôi (rủi ro bịa nội dung) — chỉ ánh xạ những trường CÓ tương ứng trực
  tiếp vào cột thật + đúng 4 trường `detail_json` mà `ActionsPage.tsx` hiện
  đọc được (`correction`/`investigation`/`causeCategory`/`causeDescription`,
  suy từ `action`/`cause`/`causeCategory` của bản ghi cũ), ĐỒNG THỜI giữ
  NGUYÊN VẸN bản ghi gốc dưới `detail_json.legacy` — không mất dữ liệu dù UI
  hiện tại chưa hiển thị hết, để lần app-v2's NCE UI được làm đầy đủ hơn
  (protocol-v3) đọc lại từ đó mà không cần di trú lại lần nữa.
- **Giới hạn đã biết, ghi lại chứ không sửa ở lượt này**: app-v2's `tests`
  bảng có cột `section` (dùng để tự điền Khoa/Khu vực) mà bản cũ không có
  theo TỪNG xét nghiệm — suy 1 lần từ `section` của máy đang gắn lúc di trú,
  khớp đúng hành vi auto-fill hiện có của app-v2 khi đổi máy, nhưng có thể
  không đúng nếu Khoa/Khu vực thật của xét nghiệm khác máy. `tea_ref_key`
  (khoá khớp bảng `tea_refs`) chưa suy được từ dữ liệu bản cũ (bản cũ không
  có trường tương đương) — để trống, cần rà soát thủ công sau di trú nếu
  dùng tính năng TEa tự động khớp. `assayGroups` (bản cũ, đã bị chính bản cũ
  coi là legacy/thay thế bởi `qcPanels`) KHÔNG được di trú — khớp quyết định
  đã ghi trong "Module roles" của bản cũ, không phải thiếu sót.
- `main/ipc/migration-handlers.ts` (mới): `preview()` chỉ parse + ánh xạ +
  đếm (KHÔNG ghi DB) — để renderer hiện rõ "sẽ nhập bao nhiêu máy/xét
  nghiệm/điểm QC..." TRƯỚC khi hỏi xác nhận, vì đây là thao tác THAY THẾ
  TOÀN BỘ dữ liệu app-v2 hiện có, người dùng cần biết quy mô trước khi quyết
  định. `importLegacy()`: chỉ admin → parse+validate → **tự động chốt 1 bản
  an toàn** qua `writeSafetySnapshot()` TRƯỚC khi xoá bất cứ gì (huỷ luôn nếu
  bước này lỗi, cùng nguyên tắc C3) → `restoreAllTables()` (CÙNG transaction
  xoá-hết-rồi-nạp-lại của C3, không viết lại) → `writeAudit()` (dòng log
  MỚI này tự nối đúng vào cuối chuỗi hash vừa di trú, vì `writeAudit()` luôn
  đọc `MAX(seq)`/hash cuối cùng THẬT trong bảng, không quan tâm dòng đó từ
  đâu ra) → `notifyChanged()` toàn bộ bảng liên quan.
- `renderer/pages/SettingsPage.tsx`: panel "Di trú dữ liệu từ app cũ" mới —
  chọn file → `previewLegacyBackup` hiện ngay số lượng từng loại sẽ nhập →
  bấm "Di trú dữ liệu…" → `confirmDialog` liệt kê lại đúng các số đó kèm
  cảnh báo thay thế toàn bộ → `reauthDialog` → `importLegacyBackup` →
  `infoDialog` báo thành công kèm đường dẫn bản an toàn vừa tạo.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 26/26 (thêm
`migrate-legacy.test.mjs` — test oracle cho `parseLegacyBackupEnvelope`/
`mapLegacyStateToTables` với 1 state tổng hợp đủ mọi nhánh, xác nhận: format
sai/checksum sai bị chặn đúng mã lỗi, mỗi bảng ánh xạ đúng cột, chuỗi hash
activity sau khi đổi tên cột sang snake_case vẫn `verifyAuditChain()` đúng,
`detail_json.legacy` giữ nguyên bản ghi NCE gốc; và `migration-handlers.test.mjs`
— end-to-end thật: preview không ghi DB, chỉ admin được import, dữ liệu ghi
đúng vào SQLite thật, **mật khẩu cũ đăng nhập được NGAY qua chính
`auth-handlers.ts`'s `login()`** (chứng minh bằng test thật, không chỉ đọc
code), chuỗi audit nối tiếp đúng sau di trú, JSON hỏng/sai định dạng không
crash), `app-v2:build` sạch, cộng kịch bản Playwright `_electron` tạm xác
nhận trong Electron THẬT: tạo 1 máy app-v2 thật trước → dựng 1 file backup
app CŨ hợp lệ (định dạng/checksum thật, không chạy app cũ) → chọn file ở
Cài đặt → preview hiện đúng số lượng (1 máy/1 xét nghiệm/1 lô/2 điểm QC/1
người dùng) → xác nhận → `reauthDialog` → di trú thành công → **quay lại
Cấu hình chung xác nhận dữ liệu THẬT SỰ bị thay thế**: máy từ app cũ có mặt,
máy app-v2 trước đó đã biến mất (đọc lại qua `window.qcApi.listInstruments()`
thật, không chỉ tin thông báo) → xác nhận file backup-an-toàn-trước-di-trú
thật sự tồn tại trên đĩa — zero console error toàn bộ luồng.

**Giai đoạn C5 — Client LIS Gateway (xong, 2026-09-01).** Gateway server
(`lis-gateway/`, prototype Node độc lập, ngoài phạm vi hồ sơ hiệu lực ISO
15189 — xem CLAUDE.md phần "LIS Gateway (prototype)") **KHÔNG đổi gì** —
Giai đoạn C5 chỉ thêm phía app-v2 GỌI VÀO gateway đã có sẵn, tham khảo
`src/application/lis/lis-client-service.ts` bản cũ nhưng viết lại thuần cho
kiến trúc main/renderer tách biệt của app-v2 (main process gọi HTTP tới
gateway, không phải renderer — renderer chỉ gọi IPC như mọi module khác,
tránh phải nới CSP `connect-src` của renderer cho riêng tính năng này).
- `main/domain/lis-client.ts` (mới): `normalizeGatewayUrl()` — allowlist
  CỨNG đúng 2 origin (`http://127.0.0.1:8787`/`http://localhost:8787`, khớp
  `QCLAB_LIS_PORT` mặc định của gateway) — từ chối mọi origin khác kể cả
  cùng host sai port. `resultToPointInput()` — **2 nguyên tắc BẮT BUỘC port
  nguyên vẹn từ bản cũ, không được "đơn giản hoá"**: (1) chỉ chuyển đổi bản
  ghi ĐÃ khớp cấu hình (`resolved.ok===true`) — bản ghi `UNMAPPED_TEST`/
  `UNMAPPED_LEVEL`/`UNIT_MISMATCH` trả `null`, không được tạo điểm QC với
  `testId`/`level` rỗng; (2) ngày điểm QC suy từ **giờ địa phương** của
  `measuredAt` (`getFullYear()/getMonth()/getDate()` của `Date`), TUYỆT ĐỐI
  không cắt chuỗi ISO UTC — 1 lần QC lúc 06:05 giờ VN có `measuredAt` là
  23:05Z NGÀY HÔM TRƯỚC, cắt UTC sẽ lệch ngày âm thầm trên Levey-Jennings.
- `main/ipc/lis-handlers.ts` (mới): cấu hình (`enabled`/`url`/`token`) lưu ở
  `app_meta` (thay `localStorage` bản cũ), chỉ admin sửa (`saveSettings`).
  `pullQueue()`: gọi `/health` rồi `/api/v1/qc-results?status=pending&limit=500`
  qua Node's `fetch` thật (Electron main process, không phải renderer) với
  `Authorization: Bearer <token>`, tách `pending` (đã khớp)/`unresolved`
  (chưa khớp) theo `resolved.ok`. **`importResult()` — bất biến quan trọng
  nhất của cả tính năng: ghi điểm QC cục bộ (qua chính `entry-handlers.ts`'s
  `addPoint()` — CÙNG đường kỳ khoá/audit log với nhập tay thủ công, không
  có đường ghi riêng cho LIS) TRƯỚC, chỉ gọi gateway báo `'imported'` SAU KHI
  ghi thành công.** Nếu ghi thất bại (vd kỳ đã khoá) → **TUYỆT ĐỐI không gọi
  gateway** — trả lỗi ngay, bản ghi vẫn còn `'pending'` phía gateway, không
  mất không báo sai. Nếu ghi thành công nhưng gọi `/decide` thất bại (mạng
  lỗi) → **vẫn trả `ok:true`** kèm `gatewayWarning` — điểm QC đã ghi thật thì
  KHÔNG được báo toàn bộ thao tác thất bại (không hoàn tác/rollback), chỉ
  cảnh báo người dùng kiểm tra kỹ trước khi nhận lại lần sau (tránh trùng
  điểm, vì `addPoint()` không có kiểm tra trùng ở tầng QC point). `rejectResult()`
  đơn giản hơn — không ghi gì cục bộ, chỉ báo gateway + ghi audit.
- `renderer/pages/SettingsPage.tsx`: panel "LIS Gateway (thí điểm)" mới —
  bật/tắt + địa chỉ + token, nút "Xem hàng chờ QC" mở modal 2 phần (giống bố
  cục bản cũ): "Sẵn sàng nhận" (nút Nhận + Bỏ) và "Chưa khớp cấu hình" (chỉ
  nút Bỏ — không có nút Nhận, vì `qclabTestId`/`level` rỗng sẽ tạo điểm QC
  rác). Sau Nhận/Bỏ tự `refreshLisQueue()` (gọi lại `pullQueue()`, không tự
  suy đoán trạng thái mới) — cùng nguyên tắc "làm mới từ nguồn thật" mà bản
  cũ dùng.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 28/28 (thêm
`lis-client.test.mjs` — oracle cho `normalizeGatewayUrl`/`resultToPointInput`,
pin đúng 2 nguyên tắc ngày giờ địa phương + chỉ nhận bản ghi đã khớp; và
`lis-handlers.test.mjs` — end-to-end với `fetch` toàn cục được mock (không
cần chạy gateway thật ở test Node, gateway thật có bộ test riêng của nó ở
`lis-gateway/tests`): xác nhận Bearer header đúng khi pull, **ghi thất bại
(kỳ đã khoá) thì đếm được 0 lần gọi `fetch` tới gateway** (bất biến quan
trọng nhất, kiểm tra bằng đếm lời gọi thật chứ không chỉ đọc code), ghi
thành công nhưng `/decide` thất bại vẫn trả `ok:true` kèm điểm QC thật trong
DB, chỉ admin sửa được cấu hình), `app-v2:build` sạch, cộng kịch bản
Playwright `_electron` tạm — **verify với chính server `lis-gateway/server.js`
THẬT chạy song song** (không mock gì): tạo 1 máy + 1 xét nghiệm thật trong
app-v2, lấy đúng `qclabTestId` thật qua IPC rồi mới dựng file cấu hình
gateway map đúng id đó → spawn `lis-gateway/server.js` với token/config/data
dir riêng → 1 script Node độc lập POST 2 kết quả QC thật vào gateway (1 đã
mapping, 1 chưa) → bật LIS Gateway trên UI Cài đặt, lưu cấu hình, mở "Xem
hàng chờ QC" → modal hiện đúng "Sẵn sàng nhận (1)"/"Chưa khớp cấu hình (1)"
kèm đúng giá trị 102.5 → bấm "Nhận" → hàng sẵn sàng về 0 → bấm "Bỏ" → hàng
chưa khớp về 0 → **xác nhận điểm QC THẬT trong SQLite** (đúng giá trị/testId/
operator_name lấy từ message LIS "ktv_lis", không phải tên người đăng nhập)
→ **xác nhận trạng thái THẬT phía gateway** qua `GET /api/v1/status`
(`imported:1, rejected:1`) — không chỉ tin UI app-v2 báo thành công mà đối
chiếu cả 2 phía độc lập — zero console error toàn bộ luồng.

**Với C1/C3/C4/C5 xong, chỉ còn C2 (Firebase, tạm dừng theo quyết định
người dùng) và C6 (bộ gate kiểm thử kiểu app cũ, không chặn — xem
`docs/APP-V2-PLAN.md`) trong thứ tự Giai đoạn C.**

**Xem giao diện app-v2 qua trình duyệt/localhost (2026-09-01).** app-v2's
renderer bình thường CHỈ chạy được trong Electron thật — `window.qcApi`
(cầu nối IPC) chỉ tồn tại sau khi `preload.ts` chạy. `npm run app-v2:dev`
(`vite --config vite.app-v2-renderer.config.mjs`, cấu hình `app-v2-dev` cổng
5174 trong `.claude/launch.json`) mở renderer qua `localhost` bằng cách cài
1 bản `window.qcApi` GIẢ LẬP khi phát hiện không có Electron
(`app-v2/renderer/browser-mock/install.ts`, kiểm tra `typeof window.qcApi
==='undefined'`) — cùng kỹ thuật "swap backend theo môi trường" mà 1 app
Electron khác của người dùng (`Marketing App`, `getDatabaseBridge()`/
`window.mktDatabase`) đã dùng, khảo sát trước khi làm để tránh đoán mò kiến
trúc.

Người dùng chọn mức độ **"chỉ xem giao diện"** (không phải "đầy đủ nghiệp
vụ thật") sau khi được hỏi rõ đánh đổi — xem
`app-v2/renderer/browser-mock/store.ts`'s comment đầu file. Cụ thể:
- **TÁI DÙNG THẬT** mọi hàm nghiệp vụ THUẦN từ `main/domain/*` (không đụng
  `node:crypto`/`node:fs`) — `westgard()`/`cusum()` (Westgard/CUSUM thật),
  `sigmaMetric()`/`uncertaintyBudget()`/`eqaRoundsStats()` (Six Sigma/MU
  thật), `calculateReagentComparison()` (hồi quy so sánh hoá chất thật),
  cùng mọi hàm `validate*`/`prepare*` (Cấu hình chung/Entry/NCE/TEa/Report/
  Settings/Auth) — Vite bundle thẳng các file `.ts` này vào renderer, KHÔNG
  viết lại phiên bản đơn giản hoá; xác nhận bằng cách thêm 1 điểm QC >3SD
  qua trình duyệt thật và thấy đúng "Vi phạm"/"1-3s" xuất hiện nhất quán ở
  cả Nhập QC, Phân tích Westgard và Tổng quan.
- **GIẢ LẬP** (không băm/mã hoá thật, vì trình duyệt không có `node:crypto`
  của main process): mật khẩu lưu dạng chuỗi thường trong
  `passwordsByUserId` (không phải dữ liệu QC/tài khoản thật, chỉ demo cục
  bộ trong trình duyệt người xem); chuỗi hash tamper-evident của nhật ký
  hoạt động luôn để trống (`hash`/`prevHash` rỗng — `verifyActivityChainNow()`
  trả về canned "mọi dòng đều legacy", đúng cách `verifyAuditChain()` thật
  xử lý dòng không hash, không phải giả mạo kết quả).
- **KHÔNG KHẢ DỤNG** (trả lỗi rõ ràng `not-available-in-browser-preview`,
  không giả vờ thành công): xuất Excel/in PDF/backup/di trú/LIS Gateway —
  các tính năng này cần Electron thật (file system, `BrowserWindow`,
  HTTP tới gateway).
- **Dữ liệu**: lưu 1 blob JSON trong `localStorage` của trình duyệt
  (`qclab-v2-browser-preview`), KHÔNG dùng chung với SQLite thật, KHÔNG có
  seed data sẵn — luồng khởi tạo admin/đăng nhập giống hệt lần chạy đầu của
  bản Electron thật.
- CSP thật của `index.html` (`script-src 'self'`, không `unsafe-eval`) chặn
  WebSocket HMR/eval của `vite dev` — `vite.app-v2-renderer.config.mjs`'s
  plugin `relaxCspForDevServer` chỉ nới lỏng CSP khi `ctx.server` tồn tại
  (đang chạy dev server), KHÔNG áp dụng khi build cho Electron thật
  (`npm run app-v2:build`) — xác nhận bằng cách build lại và diff
  `app-v2-dist/renderer/index.html`'s CSP không đổi.
- 1 banner cố định màu cam ở đầu trang (`PreviewBanner.tsx`) luôn hiện khi
  đang ở chế độ này, để không ai nhầm đây là dữ liệu SQLite thật.

Verify: `npm run app-v2:typecheck`/`build`/`test` sạch (mọi handler thật
không đổi hành vi — chỉ thêm 1 lớp mock hoàn toàn tách biệt, không chạm vào
`main/ipc/*`), cộng kiểm chứng thật qua Browser pane (`npm run app-v2:dev`
cổng 5174): khởi tạo admin → đăng nhập → thêm máy+xét nghiệm+Mean/SD qua
Cấu hình chung (dữ liệu SỐNG SÓT qua F5 reload thật, xác nhận `localStorage`
hoạt động) → Nhập QC thêm 1 điểm >3SD → xác nhận verdict "Vi phạm"/luật
"1-3s" hiện ĐÚNG (Westgard thật) nhất quán ở cả Entry/Westgard/Dashboard →
Nhật ký hoạt động hiện đúng dòng "Thêm máy xét nghiệm" sau khi thêm máy thứ
2 → Six Sigma/So sánh hoá chất/Cài đặt render không lỗi console — zero
console error toàn bộ luồng.

**Bug thật bắt được ngay sau khi làm xong ở trên**: `LoginPage.tsx` (màn
hình đăng nhập/khởi tạo admin) hoá ra CHƯA TỪNG được style từ đầu dự án —
vẫn `font-family:sans-serif` + input trần + `<button>` không class, vì
trang này render TRƯỚC khi `AppShell`/router bình thường vào cuộc (không đi
qua luồng "mỗi trang Giai đoạn B tự thêm CSS lên nền token đã có" như
10 trang còn lại), nên không ai để ý qua suốt cả Giai đoạn A1–C5. Người
dùng phát hiện ngay khi so với bản cũ. Sửa bằng cách port đúng bố cục
`.auth-card`/`.auth-head`/`.brand-mark` của bản cũ
(`assets/components.css`/`professional-base.css`/`app.css`) sang
`app-v2/renderer/styles/app.css` — dùng NGUYÊN token màu/khoảng cách app-v2
đã có sẵn từ A1 (`--teal`, `--panel`, `--radius-lg`, `--space-*`...), chỉ
thêm 2 token mới cho nền gradient sau card (`--auth-overlay-from`/
`--auth-overlay-to`, giá trị y hệt bản cũ). Kết quả: nền gradient xanh đậm
toàn màn hình, card trắng nổi giữa, ô vuông teal "QC" + tiêu đề "QC Lab" +
phụ đề "Nội kiểm xét nghiệm", nút "Đăng nhập" teal full-width — đúng bố cục
bản cũ, khác chỉ ở việc dựng bằng component React thật thay vì chuỗi HTML.
Xác nhận qua Browser pane thật (`npm run app-v2:dev`): đăng xuất → màn hình
đăng nhập hiện đúng bố cục mới → đăng nhập lại thành công, zero console
error.

**Sao chép giao diện app cũ vào app-v2 — quyết định "100%" (2026-09-01, đang
làm).** Người dùng chốt: sao chép CHÍNH XÁC giao diện đã duyệt của app cũ
sang app-v2 cho toàn bộ khung sườn + 11 trang ("cả trong lẫn ngoài"), chỉ
kiến trúc code là mới — ghi đè quyết định "dựng lại gọn, không copy cascade"
của Giai đoạn A1 (xem mục A1 phía trên: quyết định đó vẫn đúng cho cấu
trúc FILE CSS, chỉ sai ở việc chưa pixel-match được KẾT QUẢ hiển thị).

**Khung sườn (xong phần 1 — sidebar/topbar, chưa làm nội dung riêng từng
trang).** Khảo sát kỹ bản cũ trước khi code (tránh đoán mò): sidebar bản cũ
KHÔNG có tiêu đề trang (topbar) cố định trong shell — `.head` (tiêu đề +
phụ đề + khối người dùng) được LẶP LẠI ở đầu MỖI trang (qua
`PageHeader.tsx` cũ), không phải 1 topbar chung, để `.head` sticky theo
scroll RIÊNG của từng trang. Port đúng cấu trúc đó thay vì giữ topbar cố
định app-v2 đang có trước đây:
- `app-v2/renderer/components/AppShell.tsx` viết lại: sidebar `<aside>` tối
  màu (`--sidebar-bg`=`#14242e`), brand row (logo/tên phòng XN đọc từ
  `useSettingsStore`, nút thu gọn), pill "Đang chạy cục bộ" (tĩnh — app-v2
  chưa có Firebase nên luôn đúng, không giả vờ có tính năng cloud), 3 nhóm
  điều hướng có tiêu đề ("Theo dõi"/"Vận hành"/"Quản trị") + icon SVG +
  active state viền trái teal `#2fb3a6` — ĐÚNG thứ tự/nhãn/icon/vai trò
  được phép xem của `ROUTER_PAGE_DEFS`/`router-shell-controller.ts` bản cũ.
  Thu gọn/mở rộng sidebar (nút trong brand row + nút nổi khi đã thu gọn)
  lưu vào `localStorage['qclab-v2-nav-collapsed']` (khoá riêng, KHÔNG trùng
  khoá `qclab_nav_collapsed` của bản cũ để tránh 2 app cùng đọc/ghi 1 khoá
  nếu mở trong cùng trình duyệt).
- `app-v2/renderer/components/NavIcon.tsx` (mới) — copy nguyên path SVG
  từng icon từ `router-icons.ts` bản cũ (không tự vẽ lại, đặc biệt icon
  Westgard có nhiều path+circle chồng nhau, dễ sai nếu vẽ tay).
- `app-v2/renderer/components/PageHeader.tsx` (mới) — port đúng bố cục
  `.head`/`.top-user` bản cũ (tiêu đề+phụ đề trái, avatar+tên+vai trò+nút
  đăng xuất phải). KHÔNG port tính năng đổi ảnh đại diện (app-v2 chưa có
  modal đó) — avatar chỉ hiện chữ cái đầu, không bấm được, khác duy nhất so
  với bản cũ. Cả 11 trang app-v2 sửa lại để gọi `<PageHeader title=...
  subtitle=... />` thay vì tự vẽ `<h1>` riêng — tiêu đề sidebar và tiêu đề
  trang (`<h1>`) CỐ Ý khác nhau ở 4 trang (entry/reagent/users/settings),
  khớp đúng bản cũ (vd sidebar "Nhập QC & Biểu đồ" nhưng `<h1>` chỉ "Nhập
  QC"). Riêng phụ đề trang Cài đặt đổi nội dung so với bản cũ (bản cũ nhắc
  "kết nối Firebase" — tính năng app-v2 chưa có, C2 tạm dừng) để không gây
  hiểu lầm, thay bằng "Thông tin đơn vị, sao lưu, di trú dữ liệu và LIS
  Gateway" khớp tính năng THẬT hiện có.
- Ẩn/hiện mục điều hướng theo vai trò (vd "Cấu hình chung"/"Người dùng"/
  "Nhật ký hoạt động"/"Cài đặt" chỉ admin, "Khắc phục sự cố" ẩn với viewer)
  CHỈ LÀ HIỂN THỊ phía renderer, khớp đúng danh sách vai trò của
  `ROUTER_PAGE_DEFS` bản cũ — CHƯA phải chặn truy cập thật ở tầng route/IPC
  (app-v2 cố ý chưa làm `pagePerms` theo trang, Giai đoạn A2 vẫn dời sau
  như kế hoạch gốc, không đổi quyết định đó).
- Token mới thêm vào `tokens.css`: `--auth-overlay-from`/`--auth-overlay-to`
  (nền gradient sau card đăng nhập) và `--surface-radius:7px` (bán kính nút
  nhỏ trong `.top-user`) — giá trị lấy nguyên từ bản cũ. Mọi màu xám/teal
  khác của sidebar (`#cdd8e0`, `#294656`, `#1c2e38`, `#2fb3a6`, `#6fd1c4`,
  `#7f95a5`, `#8fa2ad`...) viết THẲNG trong CSS, không tách token riêng —
  bản cũ cũng không tách token cho các màu này, giữ đúng cách đó thay vì
  bịa thêm biến mới không cần thiết.

Verify: `npm run app-v2:typecheck`/`test` 28/28/`build` sạch, cộng kiểm
chứng thật qua Browser pane (`npm run app-v2:dev`): Tổng quan hiện đúng
sidebar tối màu + 3 nhóm + icon + brand "QC Lab"/"Nội kiểm xét nghiệm",
`.head` sticky đúng ở Nhập QC (tiêu đề khác sidebar), thu gọn/mở rộng
sidebar qua nút hoạt động đúng cả 2 chiều, avatar+tên+vai trò+đăng xuất
đúng vị trí — zero console error (một lần lỗi 500 thoáng qua từ chính Vite
dev server khi đang ghi file dở dang, tự phục hồi ở request kế tiếp, không
phải lỗi code).

**Còn lại của yêu cầu "100%"**: mới xong khung sườn (sidebar/topbar/đăng
nhập) — nội dung RIÊNG của từng trang (bảng/form/card cụ thể trong 8 tab
Cấu hình chung, bảng luật Westgard, form 8 phần NCE, biểu đồ Reagent...)
vẫn là bản CSS đã viết trong các đợt "làm đầy đủ" trước (Giai đoạn B),
CHƯA được đối chiếu pixel-by-pixel với từng file `professional-*.css`
tương ứng của bản cũ. Đây là phần việc LỚN HƠN nhiều so với khung sườn,
đang tiếp tục.

**Nội dung riêng từng trang — đợt 2, "làm đúng, không vẽ thêm" (2026-09-01,
xong phần lõi 11/11 trang).** Người dùng nhắc lại yêu cầu rõ ràng hơn: phải
đối chiếu đúng cấu trúc/CSS bản cũ, không tự đơn giản hoá hay bịa thêm chi
tiết. Khảo sát lại bằng nhiều agent song song đọc trực tiếp
`assets/professional-*.css` + `src/react/pages/*.tsx` bản cũ (mỗi trang 1
agent, đọc nguyên văn CSS + cấu trúc JSX) trước khi sửa, thay vì đoán từ mô
tả kiến trúc.

- **Nền tảng dùng chung** (`app-v2/renderer/styles/tokens.css`) viết lại
  THÀNH BẢN SAO NGUYÊN VẸN `assets/tokens.css` bản cũ (đúng tên biến, không
  chỉ giá trị, khác quyết định "dựng lại gọn" của Giai đoạn A1 — quyết định
  đó bị ghi đè theo yêu cầu "100%" mới). `app.css`'s `.panel`/`.btn`/
  `.badge`/`table.data-table`/`.modal-box*`/`.empty` viết lại khớp đúng giá
  trị `assets/components.css` (padding/radius/màu/font-size từng biến thể).
  **Mẹo kỹ thuật quan trọng nhất**: bản cũ's `.panel` có `padding:0` và
  header (`h2.panel-title`) là 1 dải nền xám bám sát mép panel — app-v2 vẫn
  giữ `.panel{padding:16px}` (để không phải sửa lại inline spacing của mọi
  trang đã viết) nhưng cho `.panel>.panel-head:first-child`/
  `.panel>h2.panel-title:first-child` bù margin âm đúng bằng padding đó, tự
  "tràn" ra sát mép — cùng kết quả thị giác, không cần sửa JSX từng trang.
- **Tổng quan**: đổi thứ tự thẻ KPI (nhãn nhỏ trên, số to dưới — đúng bản
  cũ, trước đó app-v2 để ngược).
- **Cấu hình chung**: đổi từ hàng nút tab ngang sang `.config-shell`
  (sidebar dọc tối nhạt bên trái + nội dung bên phải, đúng bố cục 2 cột bản
  cũ) — sidebar có nhãn "CẤU HÌNH CHUNG", mỗi mục có badge đếm số dòng, mục
  đang chọn có vệt teal bên trái (`box-shadow:inset 4px 0`, không phải
  border thật, đúng cách bản cũ tránh giật layout). Tab "Lô & nhóm lô QC"
  đổi sang lưới 2 cột (Lô QC/Nhóm lô QC cạnh nhau) đúng bản cũ thay vì xếp
  chồng.
- **Nhập QC** — viết lại TOÀN BỘ, không chỉ đổi CSS: từ bảng điểm phẳng
  đơn-mức sang đúng mô hình bản cũ — cây xét nghiệm bên trái (máy > xét
  nghiệm > mức, mỗi lá màu theo verdict, lấy dữ liệu từ
  `useWestgardStore().summaries` đã có sẵn, không domain mới) + bảng
  "worksheet" theo lịch tháng bên phải (mỗi hàng 1 ngày trong tháng, mỗi cột
  1 mức của xét nghiệm đang chọn, ô nhập trực tiếp — gõ giá trị rồi Tab/blur
  là lưu ngay, đúng luồng bản cũ) + biểu đồ Levey-Jennings dạng xếp chồng
  (1 thẻ mini/mức, dùng lại `<QcChart>` có sẵn từ Giai đoạn A1) + panel gấp
  lại "Điểm trong khoảng xem" (thẻ theo từng mức, thống kê tích lũy N/Mean/
  SD/CV tính ngay ở renderer từ điểm đã tải, bảng điểm + điểm đã huỷ).
  `entry-store.ts` viết lại để nạp điểm+phân tích cho TẤT CẢ mức của 1 xét
  nghiệm cùng lúc (`loadTestData`), không chỉ 1 mức như bản thí điểm cũ.
  **CỐ Ý KHÔNG port** "song song 2 lô" (đã ghi lý do kỹ thuật ở Giai đoạn B2,
  không đổi) và panel "Thống kê toàn bộ & Dải kiểm soát" (bản cũ có nút mở
  workflow đổi dải PXN — app-v2 chưa có domain/IPC cho tính năng đó, không
  bịa thêm nút gọi vào chỗ trống).
- **Six Sigma**: viết lại bảng kỳ từ "1 dòng/mức" phẳng sang đúng bảng bản
  cũ — header 2 hàng thật (`rowSpan`/`colSpan`: "Kỳ/Năm" xuyên 2 hàng, mỗi
  mức 1 nhóm `colSpan=3` ở hàng 1 rồi CV IQC%/Bias EQA%/Sigma ở hàng 2),
  panel "Tình trạng" (thẻ Sigma to màu theo 5 bậc — `sigmaZone()` copy đúng
  ngưỡng/màu bản cũ: ≥6 xanh đậm/≥5 xanh/≥4 xanh nhạt/≥3 vàng/<3 đỏ, không tự
  bịa thang màu). Modal Bias/MU giữ nguyên logic (RMS, cảnh báo lệch dấu,
  bảng 3 thành phần), chỉ thêm class `.sg-eqa-modal`/`.sg-mu-modal` khớp
  CSS bản cũ.
- **So sánh hóa chất**: tách "Kết quả thống kê" thành 3 thẻ KPI (Pearson r,
  %Bias, P hai phía) + panel "Tiêu chí chấp nhận & kết luận" riêng — 6 tiêu
  chí dạng huy hiệu ĐẠT/KHÔNG ĐẠT (quyết định)/TỐT/LƯU Ý (mô tả), banner kết
  luận to (✓/!/✕ theo `R.level`) — đúng 2-panel-tách-biệt của bản cũ thay vì
  1 bảng gộp chung trước đó. Biểu đồ thêm chú giải màu (đường hồi quy/đường
  y=x/bias/±1.96SD).
- **Khắc phục sự cố**: thêm hẳn panel "Sự cố cần xử lý" (bản cũ gọi
  IssuesPanel) — lọc `useWestgardStore().summaries` lấy mọi mức đang cảnh
  báo/vi phạm mà CHƯA có hồ sơ NCE active gắn đúng test+mức, hiện hàng màu
  đỏ/vàng theo mức độ + nút "Lập hồ sơ" mở form đã điền sẵn test/mức — không
  domain/IPC mới, chỉ lọc lại 2 nguồn dữ liệu đã có (đúng nguyên tắc dùng
  lại API sẵn có). Tiêu đề từng phần trong form (`SectionTitle`) đổi sang
  huy hiệu tròn teal đánh số 1-8 (`.action-form-section-title`) đúng bản cũ
  thay vì `<h3>` chữ số thường. Bảng nhật ký đổi badge duyệt/hiệu lực/hồ sơ
  sang `.action-chip` (pill nhỏ, đúng class/màu bản cũ) thay vì `.badge`
  dùng chung.
- **Modal component** (`app-v2/renderer/components/Modal.tsx`) thêm prop
  `className` (trước đây chỉ có `width`) để mỗi modal có thể áp class riêng
  bản cũ (`sg-eqa-modal`, `sg-mu-modal`...) khớp đúng chiều rộng/CSS gốc
  thay vì tất cả modal cùng 1 kích thước mặc định.
- File CSS mới `app-v2/renderer/styles/pages.css` (nối vào `index.html` sau
  `app.css`) gom toàn bộ CSS riêng theo trang — 1 file thay vì 10 file
  `professional-*.css` như bản cũ vì app-v2 chưa có đủ khối lượng để tách;
  sẽ tách lại khi file quá lớn để đọc. **Bẫy CSS đã gặp**: comment kiểu
  `/* .action-*/.issue-* */` bị trình minify hiểu `*/` giữa comment là kết
  thúc sớm, vỡ build production (`vite build` báo `SyntaxError` ở
  `lightningcss minify`) dù `vite dev`/typecheck không phát hiện — tránh viết
  `*/` bên trong nội dung comment CSS.

Verify: `npm run app-v2:typecheck`/`test` 28/28/`build` sạch (bắt được và
sửa lỗi cú pháp CSS `*/` kể trên nhờ build production, không phải chỉ dev
server), cộng kiểm chứng thật qua Browser pane cho từng trang vừa sửa: Tổng
quan (thứ tự thẻ KPI), Cấu hình chung (sidebar dọc + lưới 2 cột Lô/Nhóm lô),
Nhập QC (chọn xét nghiệm qua cây → bảng lịch tháng hiện đúng điểm đã có,
gõ giá trị mới vào ô trống rồi Tab lưu đúng, biểu đồ LJ hiện đúng điểm vi
phạm màu đỏ), Six Sigma (bảng 2 hàng header, thêm kỳ + nhập CV, thẻ trạng
thái), So sánh hóa chất (nhập 5 cặp lệch ~1%, panel tiêu chí hiện đúng 6 huy
hiệu + banner "Chưa đủ điều kiện sàng lọc" vì N=5<20 và chưa xác nhận
coverage), Khắc phục sự cố (panel "Sự cố cần xử lý" hiện đúng dòng đỏ, bấm
"Lập hồ sơ" mở form điền sẵn test/mức, huy hiệu số 1-4 hiện đúng) — zero
console error thật (loạt lỗi 500 trong log console là do Vite dev server ghi
file dở dang giữa các lần sửa liên tiếp, tự phục hồi ở request kế tiếp,
không phải lỗi code — xác nhận bằng cách đọc lại network log thấy request
kế tiếp cùng file trả 200).

**Còn lại**: Báo cáo/Nhật ký hoạt động/Cài đặt/Người dùng mới dừng ở mức nền
tảng dùng chung + vài chi tiết nhỏ (chưa đối chiếu từng cột/breakpoint còn
lại trong nghiên cứu). Các trang đã viết lại (Nhập QC/Six Sigma/Reagent/
Actions/Westgard) đã lên tới mức cấu trúc+CSS chính đúng bản cũ nhưng CHƯA
rà lại toàn bộ breakpoint responsive (≤1150px/≤980px/≤760px) từng liệt kê
trong nghiên cứu — mới verify ở độ rộng desktop.

**Phân tích Westgard — viết lại đúng cấu trúc bản cũ (2026-09-01, tiếp đợt
2).** Người dùng phản hồi bảng/cỡ chữ/quy tắc chưa giống — bỏ hẳn bảng
"Tổng quan tất cả xét nghiệm" phẳng (khái niệm KHÔNG tồn tại ở bản cũ, tự
bịa ra ở bản thí điểm trước) để thay bằng đúng mô hình bản cũ: panel "Thiết
lập phân tích" (chọn xét nghiệm → chip bật/tắt từng luật kèm mã luật dạng
pill → `<details class="wg-guide">` bảng hướng dẫn 4 cột Luật/Điều kiện/
Kết luận/Gợi ý xử lý, lấy đúng mô tả+gợi ý từ `ruleActions` domain đã có →
tab LJ/CUSUM dạng `.dayseg`), rồi 1 panel riêng cho MỖI mức của xét nghiệm
đang chọn (không phải 1 mức chọn từ dropdown như trước) — tiêu đề "Mức N ·
Lô X" bên trái, Mean/SD/n điểm bên phải (cách nhau bằng "|"), biểu đồ, rồi
bảng điểm `.wg-table` đúng 7 cột (#/Ngày/Giá trị/Z/Kết luận/Luật hoặc bằng
chứng/Loại sai số) với % độ rộng cột y hệt bản cũ. Cột "Kết luận" của bảng
hướng dẫn phân biệt đúng CHỈ 3 luật cảnh báo-không-loại-bỏ (`1-2s`/`6x`/
`7T`, đúng `WG_ALERT_RULES` bản cũ) — lần đầu viết nhầm thành "Cảnh báo/Loại
bỏ" chung chung cho mọi luật, đã sửa lại sau khi kiểm bằng mắt qua Browser
pane (không phải chỉ tin code, đọc lại đúng trang xác nhận mới sửa đúng).
Bật/tắt 1 luật áp dụng cho MỌI mức của xét nghiệm cùng lúc (đúng
"Cấu hình chung của luật" ở panel setup, không phải theo từng mức riêng lẻ).
Tab "Nhóm lô đã dừng" đọc lại `lotGroups` đã có (không domain mới).

**Bảng — áp dụng lại cho MỌI `<table>` (2026-09-01).** Phát hiện khi viết
`.wg-table`/bảng hướng dẫn: app-v2 trước đó chỉ style `table.data-table`,
nên mọi `<table>` KHÔNG mang class đó (như `.wg-table`, bảng trong
`.wg-guide`) hiện ra trần trụi, không viền/zebra — khác bản cũ, nơi
`components.css` style thẳng selector `table` chung rồi mỗi trang chỉ thêm
class phụ để CHỈNH LẠI độ rộng cột, không phải để "bật" style từ đầu.
`app-v2/renderer/styles/app.css` đổi `table.data-table{...}` thành `table{...}`
(bỏ điều kiện class) — sửa 1 lần, khớp lại toàn bộ bảng chưa từng dùng
`.data-table` trong các trang đã viết trước đó mà không cần sửa JSX nào.

Verify: `npm run app-v2:typecheck`/`test` 28/28/`build` sạch, cộng kiểm
chứng qua Browser pane: chọn xét nghiệm → chip luật hiện đủ 13 mã, bảng
hướng dẫn hiện đúng 13 dòng với "Kết luận" phân biệt đúng cảnh báo/loại bỏ
theo từng luật, tab LJ/CUSUM chuyển đúng, panel mức hiện đúng Mean/SD/số
điểm + bảng 7 cột đúng dữ liệu điểm QC thật (điểm >3SD hiện "Vi phạm"/
"1-3s"/"Loại bỏ") — zero console error.

**Giai đoạn D0b — quyền ghi thật ở main + siết gate UI parity (xong,
2026-09-02).** Hai việc "dọn đường" làm TRƯỚC khi port 10 trang còn lại của
Giai đoạn D, vì cả hai đều thuộc loại "làm sau thì phải sờ lại từng trang
lần hai": quyền quyết định nút nào được render, và gate là thứ nói "trang
này đã parity chưa".

**(1) Quyền ghi — lỗ hổng thật, không phải thiếu tính năng.** Rà soát phát
hiện `actor.role` KHÔNG xuất hiện ở BẤT KỲ handler dữ liệu nào
(entry/config/nce/reagent/sigma/westgard/report/settings/audit — đếm được 0
lần), chỉ auth/backup-import/lis/migration tự kiểm admin. Renderer cũng
không có `canWrite` ở đâu, mà `AppShell` cho vai trò `viewer` thấy Nhập QC/
Six Sigma/So sánh hoá chất/Báo cáo. Hệ quả: **vai trò chỉ-xem thêm/huỷ được
điểm QC và khoá/mở được kỳ báo cáo**, và `backup:export` (toàn bộ DB, gồm
chuỗi PBKDF2 của mọi người dùng) tải về được. App cũ chặn các thao tác này
bằng `requireWrite()`/`requireAdmin()` — nhưng CHỈ phía trình duyệt, đánh
đổi đã chấp nhận của app client-only (xem "Storage and sync model"); app-v2
có main process thật nên không kế thừa đánh đổi đó.
- `main/ipc/shared.ts` thêm `canWrite`/`requireWrite`/`requireAdmin` trả
  `PermissionDenied | null`, dùng dạng `const denied = requireWrite(actor);
  if (denied) return denied;` — KHÔNG ném exception, vì renderer đọc
  `{ok:false,error}` ở khắp nơi và một Promise bị reject sẽ không hiện được
  thông báo tiếng Việt nào. Đặt guard làm câu lệnh ĐẦU TIÊN của hàm, tức
  TRƯỚC cả cổng validate lẫn `writeAudit()`: sai thứ tự thì mỗi lần một
  người không có quyền bấm nút sẽ đẻ ra 1 dòng audit rác (có test chốt cả
  hai tính chất này).
- Ánh xạ vai trò → mức quyền **tra từng call site của app cũ, không suy
  diễn**: admin+KTV ghi dữ liệu QC (nhập/huỷ điểm, kỳ Sigma, hồ sơ NCE, so
  sánh hoá chất); CHỈ admin cho cấu hình (máy/xét nghiệm/lô/nhóm lô/panel/
  chuyển lô/Mean-SD/TEa), khoá-mở kỳ báo cáo (`report-page-controller.ts`
  dùng `requireAdmin`, không phải `requireWrite` — dễ đoán sai), xoá phép so
  sánh hoá chất (`rcDelete` → admin), xoá kỳ Sigma, hồ sơ PXN, lưu trữ nhật
  ký, xuất backup. Tổng 34 guard.
- **1 chỗ LỆCH CÓ CHỦ ĐÍCH**: `westgard:saveRuleAction`. App cũ's
  `root.wgSet` KHÔNG có guard nào (tra cả `westgard-page-controller.ts` lẫn
  chỗ định nghĩa trong `modular-pilot.global.ts`) — nghĩa là chỉ-xem bật/tắt
  được luật Westgard, mà đó là cùng cột `rule_actions_json` mà tab "Danh mục
  xét nghiệm" (admin-only) ghi. Coi đây là lỗi app cũ, không phải quy ước
  cần copy: app-v2 chặn ở mức `requireWrite` (KTV vẫn dùng được trang), ghi
  lý do ngay tại chỗ trong code chứ không chỉ ở changelog này.
- `renderer/lib/permissions.ts` (mới, KHÔNG import gì để test được thẳng
  trên `.ts` qua ESM) là nguồn DUY NHẤT phía renderer: `PAGE_DEFS` (11 trang,
  khớp `ROUTER_PAGE_DEFS` app cũ) + `canWrite`/`isAdmin`/`canAccessPage`/
  `firstAccessPath`/`roleLabel`. `roleOf()` đưa mọi vai trò lạ/rỗng về
  `viewer` (hẹp nhất), không mặc định mở. `AppShell.tsx` bỏ bảng vai trò
  inline, đọc từ đây; **`router.tsx` giờ chặn MỌI route** qua
  `canAccessPage()` — trước đó chỉ `/users` tự kiểm riêng, nên gõ thẳng
  `#/manage`/`#/audit`/`#/settings` vào URL là vào được trang admin với vai
  trò KTV/chỉ-xem (sidebar ẩn mục đó nhưng route vẫn mở).
- 5 trang chỉ-xem vào được (Entry/Sigma/Reagent/Report/Westgard) ẩn hoặc
  `disabled` control ghi. Nguyên tắc chọn ẩn vs disabled: **disabled khi
  chính giá trị đó là thông tin cần đọc** (ô CV, nút "MU 8.28", checkbox
  trạng thái luật — ẩn đi là mất dữ liệu hiển thị và vỡ bố cục bảng hướng
  dẫn), **ẩn khi nút chỉ để hành động** (Huỷ điểm, + Thêm kỳ, Lưu số liệu,
  Khoá kỳ). `DateField` thêm prop `disabled` (chưa từng có).
- `renderer/browser-mock/permission-policy.ts` (mới) bọc `window.qcApi` giả
  lập của chế độ xem trước trình duyệt bằng CÙNG bảng chính sách — không có
  nó, bản xem trước sẽ cho chỉ-xem ghi được trong khi Electron thật chặn,
  tức là nói dối về hành vi thật. `POLICY` gõ theo `keyof QcApi` nên sai TÊN
  hàm bị TypeScript bắt (sai MỨC write↔admin thì không, phải đọc đối chiếu).
- **CHƯA chặn, đã ghi rõ trong code**: 3 hàm ĐỌC nhật ký hoạt động
  (`audit:query`/`exportCsv`/`verifyChainNow`) vẫn mở cho mọi vai trò đã
  đăng nhập. Route đã chặn nên UI không vào được, nhưng gọi thẳng
  `window.qcApi.queryActivity()` vẫn đọc được. Chặn cho đúng đòi đổi 3 hàm
  sang trả `IpcResult` (giờ trả thẳng dữ liệu), kéo theo `qc-api.d.ts`/
  `preload.ts`/`audit-store.ts`/`AuditPage.tsx`/bản giả lập — là lỗ BẢO MẬT
  ĐỌC, không phải toàn vẹn dữ liệu, để lại làm một lượt riêng.

**(2) Gate UI parity — trước bản này nó gần như không chặn được gì.**
`app-v2/scripts/ui-parity-check.cjs` bản đầu chỉ CHỤP ẢNH cặp old/v2:
`oldTitle`/`v2Title` được ghi vào `report.json` nhưng KHÔNG hề assert bằng
nhau, `requiredSelectors` chỉ kiểm ở v2 (selector bịa/đổi tên ở app cũ sẽ
không ai biết, và gate thành "kiểm app-v2 với chính nó"), lỗi console phía
app cũ không ai nghe, và không có bất kỳ phép so sánh old↔v2 nào. Siết
thành 4 lớp: (a) hard-fail lỗi console/page ở CẢ HAI bản; (b) hard-fail
`requiredSelectors` phải tồn tại ở CẢ HAI bản; (c) hard-fail tiêu đề
`.head h1` phải giống từng ký tự; (d) **ratchet** (khớp quy ước
`tests/a11y-ratchet.json`/`css-hex-ratchet` của repo gốc) đo 2 chỉ số theo
chiều "app cũ CÓ mà app-v2 THIẾU" — `missingClasses` và `missingTextLines`
trong vùng nội dung chính (`#main` ở app cũ, `<main>` ở app-v2) — so với
`app-v2/tests/ui-parity-baseline.json`; vượt baseline hoặc thêm surface mới
còn lệch mà chưa có baseline thì FAIL, siết bằng
`npm run app-v2:ui-parity -- --update-baseline`, không nâng số bằng tay.
Pixel-diff vẫn CỐ Ý chưa có (kế hoạch D0 mục 5 đặt sau khi DOM ổn định) —
2 chỉ số này đo được ngay và không phụ thuộc font/DPI.

**Gate mới bắt được ngay 9 lỗi parity thật của Dashboard** mà gate cũ không
thể thấy (D2 vẫn đang 🟨 nên đúng như dự kiến, đã chốt vào baseline làm danh
sách việc cho D2, KHÔNG phải để che): hero mood text lệch ("Cần xử lý ngay"
+ câu mô tả), dòng "0/1 xét nghiệm đã đủ QC hôm nay · 0% hoàn tất", nhãn
`shift-item` dạng "Sodium (Na) · M2", dòng điểm gần nhất thiếu đơn vị + mã
luật ("02/09/2026 · 109.50 mmol/L · 1-3s"), số ngày hạn lô ("Hết hạn 3
ngày"/"Còn 17 ngày"), và pill mức thiếu CV ("M1 · 1101 · CV 0.63%"). Đáng
chú ý: `missingClasses` = 0 ở cả 4 viewport — phần CSS/cấu trúc của
Dashboard đã khớp, lệch nằm ở NỘI DUNG read-model.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 31/31 (thêm
`tests/permissions.test.mjs` — oracle bảng trang/vai trò, chốt vai trò lạ
rơi về `viewer`; và `tests/role-gating.test.mjs` — end-to-end thật với
SQLite `:memory:`: chỉ-xem bị chặn ở 13 đường ghi, vai trò lạ bị chặn như
chỉ-xem, KTV ghi được dữ liệu QC nhưng bị chặn ở cấu hình/khoá kỳ/xoá/cài
đặt/lưu trữ/xuất backup, admin làm được cả hai nhóm, **thao tác bị chặn
không thêm điểm QC lẫn dòng audit nào**, cổng quyền chạy TRƯỚC cổng validate,
và đọc KHÔNG bị chặn), `app-v2:build` sạch, `app-v2:ui-parity` đạt 4/4
surface. Gate mới được chứng minh CÓ khả năng bắt lỗi (không chỉ chạy xanh)
bằng cách siết tạm baseline `dashboard/desktop` về 0 rồi xác nhận gate
FAIL đúng 9 dòng chữ kèm exit code 1, sau đó phục hồi baseline.

**Quyết định sản phẩm 2026-09-02 — cắt thẳng, không di trú, không chạy
song song.** Người dùng chốt: app chưa lên production, dữ liệu CẢ HAI bên
đều là dữ liệu test. Ba hệ quả, đã ghi vào docs/APP-V2-PLAN.md:
(1) **C4 (di trú dữ liệu từ app cũ) ĐÓNG BĂNG** — giữ code làm đường lùi vì
nó đã có test chứng minh mật khẩu cũ đăng nhập được ngay và chuỗi hash audit
vẫn verify được sau khi chuyển, nhưng KHÔNG đầu tư thêm; 2 giới hạn đã biết
(`tea_ref_key` để trống, `section` suy từ máy) cố ý KHÔNG sửa vì sẽ không bao
giờ chạy. **Đừng xoá C4**: `main/db/table-io.ts` dùng chung với backup/phục
hồi (C3) — xoá C4 mà xoá cả file đó là vỡ backup.
(2) **Bỏ hẳn mô hình chạy song song 2 bản** (strangler-fig như đã dùng cho
React trong app cũ). Mô hình đó tồn tại để bảo vệ dữ liệu thật đang chạy;
không có dữ liệu thật thì nó chỉ là gấp đôi công bảo trì. Khi Giai đoạn D
xong thì cắt thẳng: đổi `build.files`, xoá DB test, khởi tạo admin mới.
(3) Tiêu chí cắt còn đúng 2 mục, cả hai kiểm PHẦN MỀM chứ không kiểm dữ
liệu: Giai đoạn D xong (gate `app-v2:ui-parity` xanh với baseline = 0 cho
mọi surface trong manifest) và đối chiếu Westgard/Sigma giữa 2 bản khớp 100%
(mục này GIỮ — nó kiểm công thức lâm sàng, không liên quan dữ liệu thật).
App cũ KHÔNG còn cần giữ lại để tra cứu lịch sử.

**Giai đoạn D2 — Tổng quan/Dashboard đạt golden master (xong, 2026-09-02).**
Gate D0b chỉ ra đúng 9 dòng nội dung lệch so với app cũ; sửa hết, baseline
`app-v2/tests/ui-parity-baseline.json` siết về **0 class / 0 dòng chữ trên cả
4 viewport**.

**Phát hiện quan trọng nhất: `missingClasses` = 0 NGAY TỪ TRƯỚC KHI SỬA.**
CSS/cấu trúc DOM của Dashboard đã khớp app cũ từ đợt "sao chép giao diện"
trước; toàn bộ phần lệch nằm ở READ-MODEL. Và trong 9 mục đó có **3 lệch
NGHIỆP VỤ thật, không phải lệch chữ** — bản trước tự nghĩ ra cách tính thay
vì tra mã nguồn app cũ:

1. **Báo động theo ĐIỂM CUỐI, không phải điểm xấu nhất.**
   `westgard-view-model.ts`'s `summarizeTestStatus()` của app cũ chỉ đọc
   `points[points.length-1]` của mỗi mức. app-v2 dùng `worstVerdict` (xấu
   nhất trong MỌI điểm), nên một xét nghiệm đã khắc phục xong vẫn nằm mãi
   trong "Cần xử lý" và vẫn đếm vào KPI "Vi phạm" — sai lệch tích lũy theo
   thời gian, càng dùng lâu càng đỏ oan.
2. **Một dòng báo động cho mỗi MỨC, không phải mỗi XÉT NGHIỆM.** App cũ
   (`dashboardWestgardAlerts()`) đẩy 1 item cho từng mức đang báo động, kèm
   ĐÚNG điểm cuối và ĐÚNG danh sách luật của mức đó — nhờ vậy mới hiện được
   nhãn "Sodium (Na) · M2" và meta "02/09/2026 · 109.50 mmol/L · 1-3s".
   app-v2 gộp theo xét nghiệm nên mất cả mức, cả giá trị, cả mã luật.
3. **% hoàn tất tính theo XÉT NGHIỆM, không theo MỨC.** `dashboardKpis()`:
   `completeTests = testCount - missingToday`,
   `completionPercent = completeTests/testCount`. app-v2 chia theo tổng số
   MỨC → 1 xét nghiệm 2 mức mới nhập 1 mức ra 50% thay vì 0%, tức báo "đã
   làm được nửa" cho một xét nghiệm CHƯA đủ QC.

6 mục còn lại là lệch trình bày/công thức phụ: `daysToExpiry()` của app cũ
đọc `YYYY-MM-DD` là **nửa đêm giờ địa phương** rồi trừ thời điểm hiện tại
KÈM giờ-phút và `Math.round` (nên lô hết hạn sau 18 ngày hiện "Còn 17 ngày"
nếu đang là buổi chiều — app-v2 trước đó chuẩn hoá cả 2 mốc về `T12:00:00Z`
nên luôn ra số nguyên đúng-toán-học nhưng khác app cũ); pill mức QC thiếu
`· CV x.xx%` (CV **quan sát được** của chính các điểm QC, không phải CV suy
từ Mean/SD đích); danh sách lô hết hạn phải **gom theo lô** (`qcLotId`, hoặc
`lot|level` nếu chưa gán) giữ bản có số ngày nhỏ nhất + đếm số mức dùng
chung (`${count} xét nghiệm · `); mood/moodText phải là 5 nhánh nguyên văn
của `dashboardShiftStatus()`; nhãn/meta nhóm "chưa có Mean/SD" và nhóm NCE
quá hạn theo đúng câu chữ app cũ; thanh tiến độ kẹp 0..100 (`safePercent`).

`westgard:listTestSummaries` thêm 3 field cho mỗi mức: `latestVerdict`,
`latestRules`, `cv`. **Thêm mới, KHÔNG sửa `worstVerdict`** — cây điều hướng
trang Nhập QC và trang Phân tích Westgard vẫn đọc `worstVerdict` đúng như
trước (ở 2 trang đó "mức này từng vi phạm" mới là thông tin cần, khác
Dashboard). Sửa ở CẢ `main/ipc/westgard-handlers.ts` VÀ
`renderer/browser-mock/api.ts`: lệch một chút giữa 2 chỗ là bản xem trước
trình duyệt sẽ hiện Tổng quan khác bản Electron thật — mà chính bản xem
trước là thứ gate parity đo.

`renderer/view-models/dashboard-view-model.ts` viết lại, `buildDashboardViewModel`
thành generic theo hồ sơ NCE (`<TOverdue extends NceRecord>`) để giữ được
`testName` mà store đã join sẵn — `ReturnType<typeof f>` trần sẽ suy generic
về đúng ràng buộc `NceRecord` và làm mất field đó. Dọn dead code phát hiện
trong lúc làm: `worstVerdictAlerts()`/`AlertLevel`/`VERDICT_RANK` trong
`dashboard-store.ts` không còn ai import (xác nhận bằng grep toàn `app-v2/`).

**3 giới hạn còn lại, ghi rõ chứ không lặng lẽ để đó:**
- Dòng NCE quá hạn hiện "phụ trách —" vì `NceRecord` của app-v2 KHÔNG có
  trường người phụ trách (app cũ: `action.by`). Thêm trường này thuộc D3.8,
  không bịa ở D2. Cũng vì vậy điều kiện lọc "quá hạn" của app-v2
  (`record_status==='active' && approval_status==='pending'`) chỉ xấp xỉ
  `actionOverdue()` của app cũ (đòi thêm `isRecorded`/`!workflowComplete`).
- 3 nút "Xem"/"Xem QC"/"Gán Mean/SD" điều hướng đúng trang nhưng CHƯA chọn
  sẵn xét nghiệm/mức như `dashboardGoEntryFollowup(testId, level)` của app
  cũ — cần state chọn xét nghiệm xuyên trang, thuộc D3.5 (Nhập QC).
- Gate chỉ đo chiều "app cũ CÓ mà app-v2 THIẾU", nên nội dung app-v2 hiện
  THÊM sẽ không bị bắt (đúng trường hợp dòng NCE quá hạn ở trên: app cũ ẩn
  nó vì hồ sơ chưa đủ điều kiện `isRecorded`, app-v2 vẫn hiện). Siết 2 chiều
  là việc của lượt sau, cùng lúc với pixel-diff (D0 mục 5).

Verify: `npm run app-v2:test` 31/31 (viết lại `tests/dashboard-view-model.test.mjs`
thành oracle 8 nhóm — chốt riêng từng quy tắc ở trên, đặc biệt: mức đã khắc
phục KHÔNG còn báo đỏ, mỗi mức 1 dòng kèm đúng luật, 0/1 xét nghiệm ra 0%
chứ không phải 50%, `daysToExpiry` ra 17 lúc 15:45 nhưng 18 lúc 08:00 cùng
ngày — chính giờ-phút làm lệch, và đó là hành vi app cũ), `app-v2:typecheck`/
`build` sạch, `app-v2:ui-parity` **0/0 trên cả 4 viewport** rồi
`--update-baseline` siết baseline về 0.

**Giai đoạn D3.1 — Người dùng đạt golden master + `pagePerms` (xong,
2026-09-02).** Gate đo trước khi sửa: **16 class / 36 dòng chữ lệch + thiếu
3 selector** (`.user-create-layout`/`.user-table`/`.user-row-actions`). Sau
khi port: **0/0 trên cả 4 viewport ngay lượt đầu**, baseline chốt 0. Đây
cũng là mục đóng **Giai đoạn A2** — quyền theo từng trang, đã dời sau từ đầu
kế hoạch.

**3 lệch CẤU TRÚC, không chỉ CSS** (bản B7 trước đó tự thiết kế lại trang):
1. Form "Thêm người dùng" của app cũ nằm **ngay trong trang**, 2 thẻ cạnh
   nhau (`.user-create-card`): "Thông tin tài khoản" (5 field, có **Mã viết
   tắt** mà app-v2 chưa từng có UI) + "Thẻ được phép dùng" (lưới checkbox),
   cộng 1 dòng `.hint.user-create-hint` giải thích vai trò. app-v2 trước đó
   là 1 modal 4 field.
2. Bảng danh sách 4 cột (Người dùng / Vai trò / Trạng thái / Hành động) với
   **cụm nút trên từng dòng** (`.user-row-actions`: Sửa quyền · Đặt lại MK ·
   Khóa/Mở khóa · Xóa; dòng của chính mình chỉ có "(bạn)" + Đổi mật khẩu).
   app-v2 trước đó nhét `<select>` vai trò + checkbox trạng thái inline vào
   bảng — nghĩa là **đổi vai trò người khác chỉ bằng 1 lần chọn, không qua
   modal nào**, khác hẳn luồng app cũ.
3. Nhãn vai trò: app cũ là "Quản trị"/"KTV"/"Chỉ xem" (`roleLabel`), app-v2
   đang dùng "Quản trị viên"/"Kỹ thuật viên"/"Người xem".

**`pagePerms` — KHÔNG cần đổi schema.** Cột `users.page_perms_json` và
`users.initials` đã có trong `main/db/schema.ts` từ đầu (schema được thiết kế
đủ cho toàn bộ app ngay từ lượt đầu, xem mục app-v2 phía trên) — chỉ là chưa
handler nào đọc/ghi. Thiết kế:
- **Bảng trang × vai trò dời sang `main/domain/page-roles.ts`** làm nguồn
  DUY NHẤT cho cả 2 tiến trình; `renderer/lib/permissions.ts` (tạo ở D0b)
  giờ chỉ là re-export. Lý do phải nằm ở main: main mới là nơi **thu hẹp**
  `pagePerms` theo vai trò trước khi ghi DB — không tin danh sách renderer
  gửi lên. File giữ nguyên tắc KHÔNG import gì để test thẳng trên `.ts`
  (`tests/page-roles.test.mjs`, thay `tests/permissions.test.mjs`).
- `null` vs `[]` là HAI trạng thái khác nhau, cố ý: `null` (cột NULL) = chưa
  thu hẹp, tài khoản xem đủ thẻ của vai trò; `[]` **không bao giờ được lưu**
  vì sẽ khoá tài khoản khỏi mọi trang — validate chặn với đúng câu chữ app
  cũ ("Cần chọn ít nhất một thẻ được phép dùng."). `userPageIds()` còn giữ
  nhánh phòng thân của app cũ: thu hẹp xong ra rỗng thì trả **trang đầu tiên
  của vai trò**, không trả rỗng.
- Cổng bảo mật thật: `selectUserPermissions(gửi_lên, rolePageIds(role))`
  chạy **ở main**. Test chứng minh bằng số: tạo tài khoản KTV kèm
  `pagePerms: ['dash','manage','users']` thì DB chỉ lưu `['dash']`.
- `AppShell`/`router.tsx` đổi từ `canAccessPage(id, role)` sang
  `canUserAccessPage(id, user)`/`firstAccessPath(user)` — `pagePerms` giờ
  thực thi thật cả ở sidebar lẫn route, không chỉ lưu cho vui.

**2 hành vi app cũ được giữ nguyên dù nhìn hơi lạ** — đổi là lệch golden
master:
- Đổi vai trò trong lưới thẻ: thẻ **không còn được phép** thì bị bỏ chọn,
  nhưng thẻ **mới được phép** thì KHÔNG tự tick (vẫn bật lên cho người dùng
  tự chọn). Đây đúng là `syncUserPermChecks()` app cũ.
- Nhãn trang Cài đặt quay lại **"Cài đặt & Đám mây"** như app cũ. D0b từng
  đổi thành "Cài đặt" vì app-v2 chưa có Firebase, nhưng nhãn này hiện NGAY
  TRONG lưới "Thẻ được phép dùng" — tức nằm trong vùng gate so sánh, để
  "Cài đặt" là lệch 1 dòng chữ. Chấp nhận đánh đổi: C2 (Firebase) đang TẠM
  DỪNG chứ không bị bỏ, và ưu tiên đã chốt là giống app cũ.

**2 tính năng app cũ có mà app-v2 chưa từng có, thêm ở đợt này:**
- `auth:deleteUser` — app cũ có nút "Xóa" trên từng dòng; app-v2 trước đây
  KHÔNG có đường nào xoá tài khoản. 3 cổng theo đúng thứ tự: chỉ admin →
  không tự xoá chính mình → không xoá admin ACTIVE cuối cùng. **Xoá THẬT**
  khỏi bảng `users`, không soft-delete: khác `qc_points` (dữ liệu QC phải
  giữ vĩnh viễn theo ISO 15189), một tài khoản không phải bản ghi xét
  nghiệm — và bảng `activity` lưu `username`/`user_id` dạng chuỗi phẳng,
  KHÔNG khoá ngoài tới `users`, nên xoá tài khoản không làm mất nhật ký họ
  đã làm gì (có test: cho tài khoản tự đổi mật khẩu để sinh 1 dòng audit
  **do họ** đứng tên, xoá tài khoản, rồi xác nhận dòng đó vẫn còn).
- **Chặn tự sửa quyền của chính mình** (`self-perms`): app cũ không có
  đường nào đổi vai trò của chính mình — dòng của bạn chỉ có "(bạn)" + "Đổi
  mật khẩu", và `applyUserPerms()` từ chối thẳng. Đổi TÊN chính mình thì vẫn
  được (không phải sửa quyền). Cổng này đặt SAU cổng `last-admin` để thông
  báo đúng nguyên nhân gần nhất.

**Bài test cũ phải sửa vì lý do đúng, không phải để cho xanh:**
`auth-handlers.test.mjs` mục 11 dùng chính admin tự hạ quyền mình để kiểm
tra "còn admin thứ 2 thì guard `last-admin` không nổ" — cổng `self-perms`
mới chặn kịch bản đó. Sửa bằng cách để **admin THỨ HAI** hạ quyền admin đầu
tiên: giữ nguyên ý định của bài test (kiểm guard last-admin) và khớp luật
mới, thay vì nới cổng vừa thêm.

`renderer/styles/pages/users.css` (mới) port từ `assets/professional-users.css`
— giữ đúng % bề rộng 4 cột, `.user-create-card`, lưới `.user-perm-grid`
(`repeat(auto-fit,minmax(180px,1fr))`) và 2 breakpoint 980/760px; đã xác
nhận 11 token nó dùng đều có trong `tokens.css` của app-v2.

Verify: `npm run app-v2:test` **31/31** (thay `permissions.test.mjs` bằng
`page-roles.test.mjs` — 9 nhóm, chốt cả nhánh thu hẹp/vượt quyền/rỗng-phòng-
thân; mở rộng `auth-handlers.test.mjs` — mã viết tắt chuẩn hoá thành CHỮ IN,
vượt quyền bị loại, chọn rỗng bị chặn, không gửi `pagePerms` = mặc định đủ
thẻ vai trò, update thiếu field KHÔNG xoá quyền/mã viết tắt, 3 cổng xoá, và
nhật ký sống sót sau khi xoá tài khoản), `app-v2:typecheck`/`build` sạch,
`app-v2:ui-parity` **8/8 surface 0/0** (Tổng quan + Người dùng × 4 viewport),
baseline chốt 0.

**Giai đoạn D3.2 — Báo cáo đạt golden master + sửa `DateField` ở D1 (xong,
2026-09-02).** Gate đo trước: **13 class / 32 dòng chữ lệch + thiếu 3
selector** (`.grid4`/`.report-export-options`/`.report-actions`/
`.report-lock-controls`). Sau khi port: **0/0 trên cả 4 viewport**, baseline
chốt 0 cho cả 12 surface (Tổng quan + Người dùng + Báo cáo × 4 viewport).

**4 lệch CẤU TRÚC** (bản B11/C1 trước đó tự thiết kế lại trang):
1. Panel "Báo cáo nội kiểm theo ngày" của app cũ là 1 lưới `.grid4`: ô tìm
   kiếm · ô chọn xét nghiệm **kèm bộ đếm khớp/tổng** (`(1/1)`) · từ ngày ·
   đến ngày. app-v2 đang là `.field-row` 4 ô khác nhau, không có tìm kiếm
   lẫn bộ đếm.
2. Panel "Khóa kỳ báo cáo" dùng `.report-lock-controls` (2 ô chọn Tháng/Năm
   + 1 nút, nút đổi thành "Kỳ này đã khóa" disabled khi kỳ đang chọn đã
   khoá), danh sách kỳ đã khoá là `.period-lock-list`/`.period-lock-row` —
   app-v2 đang dùng `<table>` với ô nhập lý do nằm ngay trong hàng.
3. **Mở khoá đi qua MODAL nhập lý do** (`unlockModalHtml` app cũ), không
   phải input trong bảng. Cổng lý do ≥5 ký tự giờ có ở CẢ 2 tầng (modal
   phía renderer + `validateUnlockPeriod` ở main).
4. **BỎ panel "Xem lại điểm QC"** — app cũ KHÔNG có panel này; nó là thứ
   bản thí điểm app-v2 tự thêm (chọn xét nghiệm → bấm "Xem" → bảng điểm).
   Xuất/in giờ tự truy vấn theo lựa chọn hiện tại đúng cách app cũ làm
   (chọn → xuất, không có bước "Xem" trung gian).

**Thêm phụ lục NCE thật** — ô "Kèm phụ lục NCE · (Áp dụng cho PDF và Excel)"
của app cũ trước đây app-v2 không có. Nay tick vào thì cả PDF, Excel và CSV
đều có thêm bảng hồ sơ NCE của đúng xét nghiệm + khoảng ngày đang chọn (mã
NCE, ngày, mức, luật, loại sai số, hạn xử lý, trạng thái duyệt/hiệu lực).
Excel vẫn 1 sheet duy nhất: chèn 1 dòng trống + tiêu đề "PHỤ LỤC NCE" rồi
tới các dòng — `buildXlsxBase64` (Giai đoạn C1) chỉ nhận 1 sheet, đủ dùng,
không cần đổi hợp đồng IPC cho việc này.

**Kéo theo một mục Giai đoạn D1 — `DateField` viết lại.** Gate chỉ ra 4
class thiếu là `.datebox`/`.date-text`/`.datepick`/`.native-date`: app cũ
dựng ô ngày bằng 1 ô văn bản gõ `dd/mm/yyyy` + nút lịch bên phải + 1
`<input type="date">` ẩn giữ giá trị ISO, còn app-v2 (quyết định "đơn giản
hoá" từ Giai đoạn A1) dùng thẳng `<input type="date">` trần. Đây là KHÁC
BIỆT NHÌN THẤY ĐƯỢC (ô trần hiển thị theo locale trình duyệt, icon riêng,
không gõ được dd/mm/yyyy), không phải chi tiết nội bộ — nên sửa 1 lần ở
component dùng chung theo đúng quy trình D3 ("component nền tảng phát hiện
thiếu thì đưa về D1 ngay, không vá riêng cho 1 trang"). Mọi trang có ô ngày
(Nhập QC, Sigma, Hoá chất, NCE, Nhật ký, Cấu hình chung) được lợi luôn.
- Phần KHÔNG port: lịch tự vẽ (`vn-date-picker`/`DatePickerPopup.tsx`). Nút
  `.datepick` gọi `showPicker()` của chính ô `<input type="date">` ẩn — vẫn
  "bấm icon thì lịch bật lên", chỉ khác ai vẽ lịch, giữ nguyên tắc A1
  "giống luồng thao tác, không cần giống cách vẽ".
- **Bẫy đã tránh**: app cũ để `.native-date{display:none}` (nó không cần ô
  đó tương tác, chỉ dùng làm chỗ chứa giá trị). app-v2 thì PHẢI gọi
  `showPicker()` trên chính ô đó, mà Chromium từ chối `showPicker()` với
  phần tử không được render — nên ẩn theo kiểu 1×1 trong suốt thay vì
  `display:none`. Cùng class, khác cách ẩn.
- **Bẫy thứ hai, nguy hiểm hơn**: chế độ KHÔNG điều khiển (`name` +
  `defaultValue`, đọc qua FormData lúc submit — 3 chỗ ở trang Cấu hình
  chung dùng kiểu này) đòi `name` phải nằm trên ô `.native-date` giữ ISO,
  KHÔNG phải ô văn bản dd/mm/yyyy. Đặt sai chỗ thì FormData nhận
  "01/09/2026" và mọi form CRUD lưu sai ngày mà typecheck/test không hề báo.
  Đã tra toàn bộ 12 chỗ gọi `<DateField>` trước khi sửa: tất cả đều dùng
  `value`+`onChange` (ISO) hoặc `name`+`defaultValue`, KHÔNG chỗ nào đọc
  `document.getElementById(id).value` — nên đổi cấu trúc trong là an toàn.

`app.css` thêm 3 nhóm dùng chung cho các trang D3 sau: `.datebox`+3 class
con, `.grid2`/`.grid4` (+ breakpoint 760px) và `.btn-ico` — port giá trị từ
`professional-base.css`/`app.css`/`components.css` app cũ.
`renderer/styles/pages/report.css` (mới) chỉ lấy phần CSS thuộc TRANG BÁO
CÁO trong `assets/professional-reports.css`; file gốc bên app cũ còn chứa
CSS của trang Khắc phục sự cố (`.action-*`/`.issue-*`) — phần đó app-v2 đã
có ở `pages/actions.css`, không trộn vào.

Nguồn dữ liệu trang: đổi từ `manage-store.tests` sang
`westgard-store.summaries` vì nhãn ô chọn của app cũ
(`qcOperationalAccess.selectLabel()`) cần cả lô đang gắn từng mức và tên máy
— `listTestSummaries()` đã trả sẵn cả hai. **Giới hạn đã biết**:
`listTestSummaries()` trả MỌI xét nghiệm, còn `operationalTests()` app cũ
chỉ trả xét nghiệm đã vào Panel QC + có nhóm lô đang chạy; app-v2 chưa có
hàm tương đương nên danh sách có thể rộng hơn app cũ khi cấu hình còn dở.

Verify: `npm run app-v2:test` **31/31** (không cần test Node mới — trang này
không thêm hàm thuần nào; `DateField`/`ReportPage` là renderer, được gate
parity thật kiểm), `app-v2:typecheck`/`build` sạch, `app-v2:ui-parity`
**12/12 surface 0/0**, baseline chốt 0.

**Giai đoạn D3.3 — Cài đặt (xong, 2026-09-02). Surface ĐẦU TIÊN không về 0
được, và lý do là sản phẩm chứ không phải nợ giao diện.** Gate đo trước:
**29 class / 67 dòng chữ lệch + thiếu 6 selector**. Sau khi port: **11 class
/ 30 dòng** — trong đó **11/11 class và 28/30 dòng đều thuộc 2 panel Firebase
của app cũ** (Đồng bộ đám mây + Firebase Rules). app-v2 chưa có Firebase (C2
TẠM DỪNG vì thiếu thông tin dự án thật), và dựng panel rỗng cho đủ mặt sẽ tạo
**control chết** — thứ Giai đoạn D cấm tường minh. 2 dòng còn lại cố ý nói
đúng thực tế: phụ đề trang (app cũ ghi "kết nối Firebase") và thẻ "Dung lượng
cục bộ" (app cũ ghi "dung lượng trình duyệt", app-v2 dùng file SQLite).

Lý do này được ghi vào **`surfaceNotes` trong `ui-parity-baseline.json`** —
trường mới, và `ui-parity-check.cjs` được sửa để GIỮ LẠI nó khi sinh lại
baseline: nếu bị ghi đè mất, người đọc sau chỉ thấy con số khác 0 mà không
biết vì sao rồi tưởng là việc chưa làm.

**4 lệch cấu trúc đã sửa:**
1. 2 panel đầu (Thông tin đơn vị · Logo & tên phần mềm) của app cũ nằm CẠNH
   NHAU trong `.settings-profile-grid` (lưới 0.8fr/1.2fr), mỗi panel có nút
   lưu riêng ở `.settings-panel-actions`. app-v2 đang xếp dọc 3 panel rời.
2. Panel "Logo" của app cũ có ô **"Chữ trong logo khi chưa dùng ảnh"**
   (`logo_text`, cột đã có trong schema nhưng app-v2 chưa có UI), khối
   **`.brand-preview`** xem trước logo + tên + dòng phụ, và `.file-pick`
   hiện tên tệp đã chọn.
3. Panel "Quản trị dữ liệu" là lưới **5 thẻ `.admin-tool`** (nút dính đáy
   thẻ nhờ `grid-template-rows:auto minmax(66px,1fr) auto`), không phải 2
   panel văn xuôi.
4. app cũ đặt 2 panel [Đồng bộ đám mây] [LIS Gateway] cạnh nhau trong
   `.settings-cloud-grid`. app-v2 không có Firebase nên ô bên trái là panel
   **Di trú dữ liệu** (thứ app cũ không có) — giữ lưới 2 cột để không để
   trống nửa trang. Panel di trú được GIỮ dù C4 đã đóng băng: người dùng
   quyết định không di trú, nhưng không yêu cầu bỏ tính năng.

**3 tính năng app cũ có mà app-v2 CHƯA TỪNG CÓ, thêm ở đợt này** (5 thẻ admin
đòi chúng, không thể để nút chết):
- **`backup:verify`** — "Kiểm tra backup": CHỈ ĐỌC file người dùng chọn
  (parse + `validateBackupEnvelope` + đếm bảng/dòng/điểm QC), KHÔNG chạm DB
  đang dùng. Có test chốt đúng tính chất đó: đếm số máy trước/sau khi kiểm
  tra phải bằng nhau.
- **`backup:resetAll`** — "Xóa sạch dữ liệu test". Ánh xạ
  `ResetOperationalDataCommand` app cũ: mặc định GIỮ `users` và GIỮ `activity`
  (+ `app_meta`), và vì `blankAppState()` app cũ đưa `lab` về mặc định nên ở
  đây cũng reset bảng `lab` về default schema. **Giữ `activity` + `app_meta`
  cùng nhau là điều kiện để chuỗi hash tamper-evident không bị phá** — xoá
  nhật ký mà giữ `activityAnchor` (hoặc ngược lại) sẽ làm
  `verifyAuditChain()` báo sai ngay dòng đầu; test chốt cả việc chuỗi vẫn
  verify được sau khi xoá sạch.
- **Ngưỡng 128 MB khi NHẬP backup** (`BACKUP_IMPORT_MAX_BYTES` app cũ) —
  kiểm TRƯỚC `JSON.parse` để file khổng lồ không treo tiến trình. app-v2
  trước đó không có ngưỡng nào.

**1 lời hứa suông đã được làm cho đúng.** Nhãn app cũ là "Tự động kiểm tra
hàng chờ mỗi 5 phút", còn LIS của app-v2 chỉ lấy hàng chờ khi bấm nút — copy
nhãn mà không có bộ đếm là nói dối. Nay `SettingsPage` có `useEffect` chạy
`pullLisQueue()` mỗi `LIS_POLL_MS` (5 phút, copy hằng số app cũ) khi bật, kèm
dòng trạng thái `.alert` LUÔN hiển thị theo đúng nhãn app cũ
(`Đang tắt`/`Chưa kiểm tra`/`Đã kết nối`/`Lỗi kết nối` + chi tiết) — trước
đó app-v2 chỉ hiện `.alert` khi có lỗi, nên class đó cũng bị gate báo thiếu.

Lời nhắc sao lưu cũng port nguyên văn `backupReminder.statusText()/
capacityText()` app cũ ("Chưa sao lưu trên máy này." / "Sao lưu gần nhất: N
ngày trước." + "Khuyến nghị dưới 128 MB.") — cần mốc sao lưu gần nhất, lưu
vào `app_meta` (`lastBackupAt`/`lastBackupBytes`) khi xuất backup, cùng cơ
chế key/value đã dùng cho `activityAnchor` ở Giai đoạn B8, không thêm bảng.

`renderer/styles/pages/settings.css` (mới) port từ
`assets/professional-settings.css` + phần `.admin-tools`/`.brand-preview`/
`.file-pick` nằm rải ở `assets/app.css` và `.admin-tool` ở
`assets/components.css`. CỐ Ý KHÔNG port CSS của 2 panel Firebase
(`.firebase-*`, `.rules-*`) — thêm CSS cho panel không tồn tại là rác.

**Bài học quy trình tự rút ra trong lúc làm:** 3 script sửa file liên tiếp
đều báo "replaced N" nhưng KHÔNG có `fs.writeFileSync` ở cuối, nên toàn bộ
thay đổi bị mất im lặng — chỉ phát hiện khi grep lại từng chuỗi vừa sửa.
Từ nay: sau mỗi lượt sửa hàng loạt bằng script, GREP LẠI vài chuỗi đại diện
để xác nhận đã ghi ra đĩa, đừng tin số đếm do chính script in ra.

Verify: `npm run app-v2:test` **31/31** (mở rộng `backup-handlers.test.mjs`
— verifyBackup chỉ đọc/không đổi dữ liệu, checksum sai bị chặn, chỉ admin;
resetAll xoá đúng bảng vận hành, GIỮ users/activity, hồ sơ đơn vị về mặc
định, và chuỗi hash audit vẫn verify được sau khi xoá), `app-v2:typecheck`/
`build` sạch, `app-v2:ui-parity` **16/16 surface đạt** (12 ở 0/0, 4 surface
Cài đặt ở baseline 11/30 kèm `surfaceNotes` giải thích).

**Giai đoạn D3.4 — Cấu hình chung: rà soát bản người dùng tự làm + sửa gate
+ vá thiếu sót (2026-09-02).** Trang này do NGƯỜI DÙNG tự port trước khi
nhờ rà soát, nên mục này ghi cả 3 việc: (1) sửa một lỗi của chính bộ seed
gate, (2) vá lỗ hổng lớn nhất của gate, (3) vá danh sách thiếu sót.

**Bản người dùng làm đạt sẵn phần khó nhất:** 0 class CSS lệch, đủ 8 tab,
đúng `.config-shell`/`.config-shell-nav` + 8 class bảng riêng từng tab,
typecheck/test sạch. Phần lệch còn lại là nội dung/nhãn/cột, không phải bố
cục.

**(1) LỖI CỦA GATE, không phải của trang: seed cho 2 bản khác dữ liệu.**
`ui-parity-seed.cjs` gán cho bản v2 những giá trị "cho đẹp" mà app cũ không
có — `manufacturer:'Demo'`, `serial:'DEMO-01'`, `section:'Hóa sinh'`,
`tea:5`, `tea_source:'Demo'`, `supplier:'Demo'`, `description`, `opened`,
`cusum_on:1`. Hậu quả: gate báo lệch những dòng mà nguyên nhân là DỮ LIỆU
(vd "— — 1 Đang hoạt động", "Chưa phân khoa" chỉ có ở app cũ vì app-v2 được
cho thêm hãng/số sê-ri/khoa). Đã viết lại: mọi field của bản v2 phải SUY RA
TỪ `old`, không có field nào tự bịa; ghi nguyên tắc này thành comment đầu
file để đợt sau không tái diễn. Đây đúng là loại lỗi làm mất niềm tin vào
gate — số đo sai theo hướng "báo lỗi oan cho code".

**(2) LỖ HỔNG LỚN NHẤT CỦA GATE: chỉ đo được 1/8 tab.** Gate chụp trang ở
TRẠNG THÁI MẶC ĐỊNH, nên với trang có tab thì 7/8 tab không có gì canh giữ —
"6 dòng lệch" đo được ban đầu chỉ là con số của tab đầu tiên. Sửa:
`ui-parity.manifest.json` cho phép khai `tabNav` + `tabs[]`, và
`ui-parity-check.cjs` BẤM đúng nút tab thứ `index` ở CẢ HAI bản rồi mới đo,
mỗi tab thành một surface riêng (`manage:lots/desktop`...). **Bấm theo
INDEX, không theo nhãn** — nhãn chính là thứ đang được so, dùng nó để điều
hướng thì khi nhãn lệch gate sẽ chết vì không tìm thấy nút thay vì báo lệch
nhãn. Số surface của gate: 16 → 48.
Ngay khi bật, gate lộ ra 7 tab chưa từng được đo: tests 1 class/10 dòng,
panels 1/7, lots 6/13, targets 6/5, transitions 0/4, history 5/12,
**tearefs 5/83**.

**(3) Vá thiếu sót.** Kết quả từng tab (class/dòng):
instruments 1/7 → **0/0** · lots 6/13 → **0/0** · transitions 0/4 → **0/0** ·
tests 1/10 → 1/1 · panels 1/7 → 1/1 · targets 6/5 → 6/1 · history 5/12 →
5/7 · tearefs 5/83 → 5/78.

Nhóm sửa đáng ghi lại:
- **Nhãn/chữ nguyên văn app cũ**: 2 nhãn tab ("Lô & Nhóm QC", "Bảng TEa
  tham chiếu"), 4 phụ đề toolbar, 5 placeholder tìm kiếm, 6 nhãn cột. Nút
  toolbar app cũ dùng **dấu ＋ fullwidth + khoảng trắng** (`'＋ ' + label`),
  còn nút trong panel con của tab Lô thì KHÔNG có dấu cộng — 2 quy ước khác
  nhau trong cùng trang, phải copy đúng từng chỗ.
- **Badge sidebar**: tab Lô của app cũ hiện `"số lô / số nhóm"` (chuỗi, vd
  "2 / 1") chứ không phải 1 con số; tab Mean/SD hiện số MỨC đã gán lô. Số
  này lấy từ `westgard:listTestSummaries` (1 lời gọi có sẵn cả `qcLotId` lẫn
  `pointCount`) — KHÔNG dùng `levelsByTestId` của manage-store vì store đó
  chỉ nạp mức của panel đang chọn, đếm ở tab Lô sẽ ra 0.
- **Trạng thái lô QC không phải cờ `active`**: app cũ tính từ HẠN DÙNG
  (`createManageLotStatus`) — "Hết hạn" / "Còn N ngày" (≤30) / "Đang hoạt
  động" / "Chưa có HSD" / "Đã chuyển tiếp" khi `depleted`. Port nguyên hàm,
  dùng lại `daysToExpiry()` đã port ở Dashboard (D2) làm 1 nguồn duy nhất.
  Ngày hạn dùng cũng phải hiện dd/mm/yyyy, không phải ISO.
- **Fallback chữ luôn hiện**: máy không có khoa → "Chưa phân khoa"; xét
  nghiệm không có phương pháp → "Chưa nhập phương pháp"; không có khoa →
  "Chưa gán khoa/khu vực". app-v2 đang ẩn hẳn dòng khi rỗng, mà việc ẩn/hiện
  làm đổi cả CẤU TRÚC DÒNG (thẻ `<div>` con là block → tách dòng trong
  `innerText`), nên 1 chỗ ẩn làm lệch tới 3 dòng đo được.
- **Trạng thái xét nghiệm**: app cũ ghi "Đang dùng"/"Ngừng dùng" cho xét
  nghiệm nhưng "Đang hoạt động"/"Ngừng hoạt động" cho MÁY — 2 cặp chữ khác
  nhau, app-v2 dùng chung một cặp.
- **4 thao tác app cũ có mà app-v2 CHƯA TỪNG CÓ** (`config-handlers.ts`):
  `removeLot`, `removeLotGroup`, `stopLotGroup`, `removeLotTransition`. Cổng
  chặn port NGUYÊN VĂN cả thông báo từ `lotRemoval()`/`lotGroupRemoval()`
  app cũ — lô đang gán Mean/SD cho mức QC thì không xoá được ("Hãy đổi lô
  trong xét nghiệm trước."), lô đã đi qua hồ sơ chuyển tiếp ĐÃ KẾT LUẬN cũng
  không, nhóm lô đang gán Mean/SD cũng không. Xoá nhóm thì GIỮ NGUYÊN các lô
  bên trong (chỉ gỡ `group_id`), đúng chi tiết app cũ ghi trong hộp xác nhận.
  Xoá lô dọn luôn hồ sơ chuyển lô còn dở dang trỏ tới nó, trong 1 transaction.
  `stopLotGroup` CHỈ dừng: chiều bật lại của app cũ ("Kích hoạt") kèm việc ÁP
  Mean/SD của nhóm vào các xét nghiệm liên quan (`applyLotGroupActivation`)
  chưa port, nên không dựng nút bật lại để tránh nút làm việc nửa vời.
- Thẻ nhóm lô thêm 3 nút app cũ có: Mean/SD (nhảy sang tab Mean/SD), Dừng
  (class `btn-stop-tint`), Xóa. Tab Lô thêm ô tìm kiếm (app cũ có ô tìm
  kiếm ở CẢ 8 tab; tab này trước đó không có), lọc theo đúng bộ field
  `manageMatch()` app cũ dùng.

**Còn lại, đã ghi lý do vào `surfaceNotes` của baseline** (5 surface):
xoá xét nghiệm + xoá Panel QC (cần port cổng chặn theo khoá kỳ báo cáo của
`delTest` app cũ), **ma trận nhập Mean/SD** (app cũ cho nhập trực tiếp 4 ô
số + checkbox mỗi hàng, app-v2 chỉ hiện giá trị), **tab Lịch sử** (app cũ
dùng lại đúng panel ma trận đó + số điểm QC từng mức + nút "Chi tiết"), và
**danh mục TEa tích hợp** (app cũ liệt kê hàng trăm analyte CLIA/Ricos theo
nhóm kèm ô nhập từng dòng; app-v2 mới có danh mục rút gọn — port đầy đủ là
một đợt riêng đã ghi từ Giai đoạn B1, cần cả `docs/tea-sources.md`).

Verify: `npm run app-v2:typecheck`/`build` sạch, `app-v2:test` 31/31,
`app-v2:ui-parity` **48 surface** (24 ở 0/0 gồm cả 3 tab Cấu hình chung vừa
về 0; 24 surface còn lệch đều có `surfaceNotes` giải thích). Bộ seed sửa
xong được xác nhận bằng chính việc tab "Máy xét nghiệm" về 0/0 — trước đó
2 trong 7 dòng lệch của nó là do seed.

**Rà soát chất lượng mã app-v2 (2026-09-02) — đo bằng grep/typecheck, không
bằng cảm nhận.** Người dùng hỏi "chuyển sang app mới thì code có sạch, có
đúng kiến trúc không". Kết quả đo và 3 việc đã sửa ngay trong lượt này:

**Ranh giới kiến trúc GIỮ ĐƯỢC (đo được, không phải tin lời)**: renderer
không có 1 câu SQL nào; `preload.ts` 86 `invoke` khớp CHÍNH XÁC 86
`ipcMain.handle` (không kênh nào gọi mà thiếu handler, không handler nào
chết); không handler nào import handler khác — TRỪ ĐÚNG 1 ngoại lệ có chủ
đích: `lis-handlers.ts` import `createEntryHandlers` để điểm QC từ LIS đi
CÙNG đường `addPoint()` với nhập tay (kỳ khoá + audit), xem Giai đoạn C5.
Quy ước "handler không import lẫn nhau" ghi ở đầu file này cần đọc kèm ngoại
lệ đó.

**`main/domain/` KHÔNG thuần 100% như câu mô tả kiến trúc gợi ý**: 4 file
dùng `node:` thật (`audit-chain.ts`/`password-hash.ts` cần `node:crypto`,
`backup.ts`/`migrate-legacy.ts` cần `node:crypto`+`node:fs`). Đây là lý do
KỸ THUẬT khiến bản xem trước trình duyệt phải giả lập mật khẩu/chuỗi hash
(đã ghi ở mục "Xem giao diện app-v2 qua trình duyệt") — không phải chọn cho
nhanh. 15 file domain còn lại thuần thật và được `browser-mock/api.ts` dùng
LẠI nguyên bản.

**Rủi ro lớn nhất còn lại, chưa sửa: `renderer/browser-mock/api.ts` (729
dòng, 63 chỗ `any`) KHÔNG có test nào.** Nó được gõ `: QcApi` nên TypeScript
chặn được lệch TÊN/CHỮ KÝ, nhưng KHÔNG chặn được lệch HÀNH VI so với handler
thật — mà chính bản xem trước này là thứ `app-v2:ui-parity` đo. Nghĩa là gate
parity có thể xác nhận một giao diện mà Electron thật hiển thị khác. Cần một
bộ test end-to-end chạy CÙNG kịch bản qua handler thật và qua mock rồi so
kết quả; chưa làm, ghi lại để không quên.

**Đã sửa (1) — hợp đồng IPC giờ do trình biên dịch canh, không do kỷ luật.**
`preload.ts` trước đây là object literal trần truyền vào
`contextBridge.exposeInMainWorld` với tham số `unknown`, nên gõ sai tên hàm
so với `shared/qc-api.d.ts` KHÔNG có gì bắt được (86/86 khớp là nhờ cẩn thận,
không nhờ kiểu). Nay tách `const api = {...} satisfies QcApi` rồi mới expose.
Chứng minh gate mới CÓ khả năng bắt lỗi (không chỉ chạy xanh): đổi tạm
`removeLot` thành `removeLotTypo` → `tsc` báo đúng `TS2561 ... Did you mean
to write 'removeLot'?`, rồi phục hồi.

**Đã sửa (2) — 3 chỗ trùng lặp + 1 field store chết ở trang Westgard.**
`westgard-store.ts` có `analysis: LevelAnalysis | null` và
`loadAnalysis(testId, level)` cho MỘT mức mà KHÔNG trang nào đọc (`grep` mọi
chỗ destructure store xác nhận) — chỉ `toggleRule` ghi vào field không ai
đọc. Vì vậy `WestgardPage.tsx` tự gọi `window.qcApi.analyzeLevel` ở 3 chỗ,
trong đó 2 chỗ là 7 dòng copy-paste y nguyên. Đổi store sang
`analysisByLevel` + `loadAnalysis(testId, levels[])` — ĐÚNG quy ước
`entry-store.ts` đã dùng từ Giai đoạn B2, không phát minh kiểu mới — trang
gọi 1 dòng ở cả `useEffect` lẫn `useStoreInvalidation`.

**Đã sửa (3) — BUG THẬT: 1 cú bấm checkbox luật ghi N dòng audit.** Chỗ
`onChange` của checkbox luật Westgard gọi `levels.forEach((l) =>
onToggleRule(l.level, ...))`, tức gọi `saveRuleAction` một lần CHO MỖI MỨC.
Nhưng `saveRuleAction` ghi `rule_actions_json` của XÉT NGHIỆM (không theo
mức) và tự `writeAudit()` mỗi lần — nên xét nghiệm 3 mức thì mỗi lần bật/tắt
1 luật đẻ ra 3 dòng nhật ký trùng nhau. Sửa: gọi đúng 1 lần,
`toggleRule(testId, ruleId, on)` bỏ tham số `level`. Việc nạp lại phân tích
của MỌI mức không cần làm tay: `saveRuleAction` đã `notifyChanged(['tests'],
[testId])` nên `useStoreInvalidation` của trang tự lo — lần refetch 1 mức
viết tay trong `onToggleRule` cũ vừa thừa vừa che mất điều đó.

**Nợ kiến trúc còn lại, đã đo, CHƯA sửa** (không phải bỏ sót không ghi):
`ManagePage.tsx` 780 dòng (mới tách được `manage/HistoryTab.tsx`, 8 tab còn
lại vẫn trong 1 file); 23 chỗ trang gọi `window.qcApi` trực tiếp thay vì qua
store (Settings 16, Westgard 3, Report 2, Actions 1, DialogHost 1 — đều là
truy vấn đọc 1 lần, nhưng nghĩa là `useStoreInvalidation` không chạm tới
được); `vnDate()` bị viết lại ở 2 file trang (Dashboard/Manage) trong khi
`renderer/view-models/` mới có đúng 1 file — cần một chỗ dùng chung cho định
dạng ngày/số; 77 chỗ `style={{...}}` còn sót ở lớp trình bày (app cũ đã có
quy ước token khoảng cách, xem "CSS structure"); `ReportPage.tsx` giữ 12 hàm
helper trong chính file trang.

Verify: `app-v2:typecheck`/`build` sạch, `app-v2:test` 31/31,
`app-v2:ui-parity` 48/48 surface đạt (refactor không đổi DOM).

**Giai đoạn C7 — test đối chiếu bản giả lập trình duyệt ↔ handler thật (xong,
2026-09-02). Phủ ĐỦ 87/87 hàm `QcApi`, bắt được 18 lệch thật — trong đó 79
chuỗi tiếng Việt của bản Electron THẬT bị mất dấu, và nhật ký hoạt động của
bản xem trước chỉ ghi được một nửa số dòng.**

Lý do có hạng mục này (ghi ở lượt rà soát chất lượng mã phía trên):
`renderer/browser-mock/api.ts` được gõ `: QcApi` nên TypeScript chặn được
lệch TÊN/CHỮ KÝ, nhưng KHÔNG chặn được lệch HÀNH VI — mà chính bản giả lập là
thứ `app-v2:ui-parity` đo (gate chạy `app-v2:dev` qua localhost), nên một
lệch hành vi khiến gate xác nhận một giao diện mà Electron thật hiển thị
khác.

**Thiết kế `tests/mock-parity.test.mjs` — 3 nửa, mỗi nửa chốt một kiểu quan
hệ khác nhau, vì không phải hàm nào cũng "phải giống nhau":**

**(A) So BẰNG NHAU — 126 bước, 73 hàm, đủ 11 module.** Chạy CÙNG 1 kịch bản
qua 2 đường rồi so kết quả đã chuẩn hoá.
- Phía giả lập dùng `withPermissionPolicy(createBrowserMockApi())` — ĐÚNG thứ
  `install.ts` gắn vào `window.qcApi`, không phải api trần (api trần không có
  cổng quyền, so như vậy sẽ bỏ sót đúng lớp dễ lệch nhất).
- Phía thật dùng façade `makeRealApi()` viết trong chính file test, sao lại
  cách `main/index.ts` nối kênh (actor lấy từ phiên đăng nhập giữ trong bộ
  nhớ). KHÔNG import được `main/index.ts` vì file đó import `electron`.
- Chuẩn hoá 4 lớp: bỏ trường biến động (`created_at`/`hash`/`seq`/`ts`); id →
  token theo thứ tự xuất hiện (`#1`, `#2`…) nên giữ được QUAN HỆ giữa các bản
  ghi mà không phụ thuộc id ngẫu nhiên; mốc thời gian ISO → `<TS>` kể cả khi
  LỒNG trong chuỗi JSON (`detail_json.releaseDecidedAt` là một CHUỖI nên
  không bỏ được theo tên khoá); và id thật nhúng trong CHỮ (`target`, chi
  tiết kiểu "Xoá hồ sơ chuyển lô <id>") → token, nhưng CHỈ khi chuỗi 7 ký tự
  đó đã từng xuất hiện như một id ở bước trước, nên không có nguy cơ biến một
  từ tiếng Việt thành token.
- `browser-mock/store.ts` gọi `localStorage.getItem` NGAY khi nạp module, nên
  stub `MemStorage` phải cài TRƯỚC `require` — dùng `createRequire`
  (CommonJS) chính vì thứ tự này điều khiển được, khác `import` ESM tĩnh.
- Kịch bản đi theo dòng nghiệp vụ thật (tạo → sửa → cổng chặn → xoá) chứ
  không vét cạn tổ hợp input; có 1 assert chốt `>= 60` bước vì một kịch bản
  rỗng cũng "khớp".

**(B) CỐ Ý KHÁC — 10 hàm.** `exportBackup`/`verifyBackup`/
`resetOperationalData`/`importBackup`/`previewLegacyBackup`/
`importLegacyBackup`/`exportTableXlsx`/`pullLisQueue`/`importLisResult`/
`rejectLisResult` cần môi trường Electron thật (file system,
`BrowserWindow`, HTTP tới gateway) nên bản xem trước trả thẳng
`not-available-in-browser-preview`. Chốt đúng sự khác biệt: mock phải trả
CHÍNH mã đó (không được giả vờ `ok:true`), bản thật phải KHÔNG trả mã đó.
Giá trị nằm ở tương lai: ai cài đặt thật một hàm trong nhóm này ở bản giả
lập thì test đỏ và nhắc chuyển sang nửa (A) — thay vì nó âm thầm nằm ngoài
mọi vùng kiểm soát.

**(C) HỢP ĐỒNG RIÊNG — 4 hàm không so bằng nhau được nhưng không bỏ trắng:**
- `getStorageInfo`: bản thật đo kích thước FILE SQLite, bản giả lập đo blob
  JSON trong localStorage — hai đại lượng khác bản chất. Chốt: cùng hình
  dạng, dung lượng không âm, và `path` của bản xem trước phải NÓI RÕ đây
  không phải file thật.
- `verifyActivityChainNow`: bản giả lập không băm hash (trình duyệt không có
  `node:crypto`). Chốt: bản thật `ok:true` + `checked>0` (băm thật), bản giả
  lập `ok:true` + `checked===0` — KHÔNG được báo "chuỗi bị phá", vì đó đúng
  là cách `verifyAuditChain()` thật xử lý dòng không hash.
- `printHtmlToPdf`: bản thật cần `BrowserWindow` thật nên không gọi được
  trong Node (đã kiểm chứng bằng Playwright `_electron` ở Giai đoạn C1) —
  chỉ chốt phía giả lập phải từ chối rõ ràng.
- `onStoreChanged`: không có handler nào ở main để so (kênh
  `webContents.send` một chiều). Chốt thứ MỌI trang phụ thuộc: phải trả về
  hàm huỷ đăng ký GỌI ĐƯỢC, vì `useStoreInvalidation()` gọi nó trong nhánh
  dọn dẹp của `useEffect` — trả `undefined` sẽ làm mọi trang ném lỗi khi rời
  trang.

**Hạ tầng build**: `tsconfig.app-v2-mock.json` (mới) build
`renderer/browser-mock/*` sang CommonJS vào `app-v2-dist/mock/` — cần lượt
riêng vì `tsconfig.app-v2-renderer.json` phát ESM+JSX cho Vite còn
`tsconfig.app-v2-main.json` chỉ include `app-v2/main`. Dùng `tsc` chứ không
thêm dependency bundler: Vite 8 của repo dùng `rolldown`, KHÔNG còn `esbuild`
để gọi trực tiếp. `scripts/run-tests.cjs` chạy thêm lượt build này trước khi
gọi `node --test`.

**18 lệch thật bắt được, nhóm theo lớp lỗi:**

1. **79 chuỗi tiếng Việt của bản Electron THẬT bị mất dấu** — phát hiện lớn
   nhất, truy ra từ một lệch message duy nhất. Đếm được **52/119 `message:`**
   (nce-handlers 23, nce-validation 14, entry-validation 6, sigma-handlers 4,
   entry-handlers 3, westgard-handlers 2), **14 NHÃN AUDIT** ("Nhap QC", "Huy
   diem QC", "Them ky Six Sigma"…) và **13 chuỗi CHI TIẾT** ("Diem QC muc …,
   ngay …, gia tri …", "Ly do: …", "Ho so …", "Luat … chuyen thanh bat/tat"…).
   Nghĩa là người dùng bản Electron đang thấy "Gia tri QC khong hop le." và
   trang Nhật ký hoạt động hiện "Nhap QC". Đây là di sản đợt module thí điểm
   đầu tiên (viết ASCII để né lỗi mã hoá), và **gate parity không thể thấy vì
   nó đo bản giả lập — bản giả lập lại có dấu đầy đủ.** Đã sửa hết bằng bảng
   ánh xạ TƯỜNG MINH (không tự động thêm dấu bằng thuật toán — đây là chữ
   người dùng đọc). An toàn với chuỗi hash tamper-evident: dòng audit CŨ giữ
   text cũ và hash của nó phủ đúng text đó, dòng MỚI dùng text mới;
   `verifyAuditChain()` không so text với bảng hằng nào. 2 test cũ khoá nhãn
   `'Nhap QC'`/`'Huy diem QC'` sửa theo (chúng lọc theo `type`, không kiểm
   chính tả) — mọi test khác assert theo `error.code` nên không vỡ.
   **Bài học quy trình, đáng nhớ hơn con số**: sweep phải qua 3 lượt mới hết.
   Lượt 1 chỉ khớp `writeAudit(..., '<nhãn>'` TRÊN CÙNG MỘT DÒNG → bỏ lọt
   `writeAudit` viết nhiều dòng (Six Sigma). Lượt 2 quét kèm 2 dòng ngữ cảnh
   → vẫn bỏ lọt phần CHI TIẾT của `entry-handlers`, vì bước `queryActivity`
   (trang 1, 5 dòng) KHỚP và che mất — 2 dòng đó không nằm trong 5 dòng mới
   nhất. Chỉ khi so CSV TOÀN BỘ nhật ký mới lộ ra. Lượt 3 quét theo danh sách
   từ tiếng Việt không dấu thường gặp trên toàn `main/` → ra 0.
   **Mở rộng phạm vi đọc của một bước có giá trị đúng bằng thêm một bước mới.**

2. **Nhật ký hoạt động của bản xem trước chỉ ghi 19/40 dòng.** 17 loại thao
   tác ghi audit ở bản thật mà KHÔNG ghi gì ở bản giả lập: thêm/sửa lô QC,
   nhóm lô, Panel QC, tạo + cập nhật hồ sơ chuyển lô, kỳ Six Sigma, 3 thao
   tác so sánh hoá chất, bật/tắt + phạm vi luật Westgard, 6 thao tác NCE
   (duyệt/trả lại/ngày hoàn thành/hiệu lực/release-to-service/mở vòng tiếp
   theo), và thêm/sửa/xoá hồ sơ TEa. Đã vá đủ, nhãn + chi tiết copy NGUYÊN
   VĂN từ `writeAudit()` tương ứng.

3. **`saveLisSettings` mất CẢ cổng admin LẪN allowlist origin.** Bản thật chỉ
   nhận `http://127.0.0.1:8787`/`http://localhost:8787` — kiểm soát an toàn
   có chủ đích của Giai đoạn C5; bản giả lập nhận `http://vi-du.com:8787` và
   trả `ok:true`, tức dạy người dùng một hành vi KHÔNG tồn tại. Sửa bằng cách
   dùng LẠI chính `normalizeGatewayUrl` của `main/domain/lis-client.ts` (file
   thuần, không `node:`) thay vì viết lại lần thứ hai — cùng nguyên tắc bản
   giả lập đã dùng cho 15 module domain khác.

4. **CSV xuất từ nhật ký của bản xem trước KHÔNG escape giá trị.** Bản thật
   có `toCsvValue()` (bọc ngoặc kép khi giá trị chứa dấu phẩy/ngoặc kép/xuống
   dòng); bản giả lập nối chuỗi thô, nên mọi chi tiết như `Nhóm "Nhom 1" (2
   lô)` hoặc `Điểm QC mức 1, ngày …, giá trị …` làm **vỡ cấu trúc cột của file
   tải về**. Sửa bằng cách port đúng hàm escape.

5. **Thiếu cổng `TEa > 0`** (`saveSigmaPeriod`): bản giả lập nhận cả `tea:-5`
   rồi lưu, nên trang Six Sigma của bản xem trước tính Sigma từ một số vô
   nghĩa mà không báo gì.

6. **Thông báo `already-reopened` bị cắt ngắn**: "Hồ sơ này đã có vòng tiếp
   theo." thiếu nửa sau "…, mở tiếp từ vòng đó." — nửa bị mất chính là nửa
   NÓI CHO NGƯỜI DÙNG BIẾT PHẢI LÀM GÌ.

7. **18 cột thiếu trên 3 bảng** so với schema thật: hàng `tests` thiếu 6
   (`abbreviation`/`display_name`/`standard_name`/`analyte_id`/`matrix`/
   `aliases_json`), hàng `tea_refs` thiếu 11, hàng NCE thiếu `risk_level`,
   hàng `test_levels` thiếu `range_k` (=2, hệ số dải ±2SD — đúng thứ ma trận
   Mean/SD dùng). `range_k` thiếu ở CẢ HAI chỗ tạo hàng (nhánh trong
   `saveTestLevel` VÀ chỗ `saveTest` tự sinh sẵn mức 1) — sửa 1 chỗ vẫn còn
   lệch, vì chỗ tự sinh mới là chỗ chạy trước trong thực tế.

**Đã chứng minh CẢ BA nửa có khả năng bắt lỗi, không chỉ chạy xanh**: (A) sửa
tạm 1 message ở mock → FAIL đúng bước kèm cả 2 chuỗi; (B) sửa tạm
`resetOperationalData` thành `ok:true` → FAIL đúng thông báo; (C) sửa tạm
`onStoreChanged` trả `undefined` → FAIL đúng thông báo. Cả ba đều phục hồi
sau khi xác nhận.

Verify: `npm run app-v2:test` 32/32 (mock-parity: **126 bước khớp + 10 hàm cố
ý khác + 4 hàm hợp đồng riêng = 87/87 hàm `QcApi`**), `app-v2:typecheck`/
`build` sạch, `app-v2:ui-parity` 48/48 surface đạt.

**Giới hạn còn lại, ghi rõ chứ không để ngầm**: phủ 87/87 hàm nghĩa là mỗi
hàm đã có ÍT NHẤT một hợp đồng, KHÔNG phải mọi nhánh của mỗi hàm đều được
chốt. Mỗi lần mở rộng phạm vi đọc của một bước lại lộ thêm lệch (xem bài học
ở mục 1), nên đây là bộ gate sống, không phải cột mốc đóng. Façade
`makeRealApi()` do test tự giữ nên vẫn có thể lệch với `main/index.ts` nếu ai
đổi cách nối kênh — nhưng lệch đó sẽ lộ thành test đỏ hoặc ném lỗi, không âm
thầm.

**Giai đoạn D3.5 — Nhập QC đạt golden master (2026-09-02). Surface LỚN NHẤT
từ đầu Giai đoạn D: 77 class / 104 dòng chữ lệch → 0/0 trên cả 4 viewport.**

Trang này XL vì nó không chỉ là CSS: 1 lỗi của chính manifest, 1 khác biệt
hành vi làm mất 2/3 giao diện, 1 hàm domain phải port, và 1 IPC mới.

**Lỗi CỦA MANIFEST bắt được ngay lượt đo đầu**: `requiredSelectors` khai
`.entry-layout` — class KHÔNG tồn tại ở bản nào. Gate tự báo đúng thông điệp
lớp (b) của nó ("selector trong manifest sai/đã đổi tên, gate sẽ vô nghĩa").
Sửa về selector THẬT của app cũ: `.head`/`.entry-main`/`.qc-sheet-panel`/
`.qc-sheet`/`.lj-toolbar`. Đây là lần thứ hai một lỗi của bộ đo bị chính nó
phát hiện (lần đầu: seed bịa dữ liệu ở D3.4).

**Khác biệt hành vi làm mất 40 class trong 1 nốt: app-v2 không tự chọn xét
nghiệm.** App cũ (`entry-page-controller.ts`, chỗ dựng `selT`) TỰ RƠI VỀ xét
nghiệm ĐẦU TIÊN khi lựa chọn hiện tại không hợp lệ; app-v2 để `testId` rỗng
nên toàn bộ `.entry-main` (bảng nhập, biểu đồ, toolbar) không render. Chỉ
thêm `useEffect` tự chọn đã kéo 77/104 xuống 23/49 — nghĩa là 2/3 phần "lệch"
không phải thiếu code mà là thiếu 1 dòng khởi tạo. **Bài học đo lường: với
trang có state chọn, phải kiểm trạng thái MẶC ĐỊNH có render gì không trước
khi kết luận thiếu tính năng.**

Đồng thời đóng luôn mục còn treo từ Giai đoạn D2: `location.state.testId`
cho điều hướng chéo trang (Tổng quan bấm "Xem"/"Xem QC" mở đúng xét nghiệm
đó, "Gán Mean/SD" mở sẵn tab Mean/SD của Cấu hình chung) — đúng
`dashboardGoEntryFollowup()`/`goManageTargets()` app cũ.

**Cây điều hướng dựng lại đúng mô hình app cũ: máy → NHÓM LÔ → xét nghiệm.**
app-v2 đang là máy → xét nghiệm → MỨC, tức các lá "Mức 1"/"Mức 2" đều chọn
cùng 1 xét nghiệm (mức là CỘT của bảng nhập, không phải nút điều hướng).
Port `operationalLotGroupForTest()`: tên nhóm là tên người dùng đặt, không có
thì ghép số lô ("Nhóm lô 1101/1102"). Nhãn trạng thái dùng bảng NGẮN riêng
của cây (`reportLabels.stateName` → 'Loại', không phải 'Loại bỏ') và tính
theo ĐIỂM CUỐI (`latestVerdict`) — cùng lý do đã ghi ở D2, không phải điểm
xấu nhất từng có.

**1 hàm domain phải port thật: `acceptedPoints()`** (`main/domain/
westgard-engine.ts`, từ `src/domain/qc/accepted-lot-points.ts`). 3 dòng chữ
cuối cùng không chịu về 0 hoá ra là NGHIỆP VỤ: app cũ vẽ biểu đồ và tính
Mean/SD/CV thực trên CHUỖI ĐƯỢC CHẤP NHẬN — điểm nào nổ luật loại bỏ thì
không vào chuỗi VÀ không tính vào cửa sổ đánh giá các điểm sau, nên 1 lần
chạy bị loại không "làm bẩn" chuỗi của các lần sau. app-v2 đang lấy hết
điểm nên số điểm 10 vs 9 và SD 3.0889 vs 0.7621. `westgard:analyzeLevel` giờ
trả thêm cờ `accepted` cho từng điểm (tính ở main, renderer không chạy lại
luật); bản giả lập trình duyệt cập nhật y hệt — lệch chỗ này là bản xem
trước vẽ biểu đồ khác Electron. Khác app cũ đúng 1 chi tiết đã ghi tại chỗ:
app cũ hỏi bảng hành động từng luật (`reject.has(rule)`), app-v2 dùng
`level==='rej'` của chính engine (mô hình rút gọn). Cửa sổ 11 điểm giữ
nguyên. Test oracle `tests/accepted-points.test.mjs` (6 nhóm) chốt đúng tính
chất cốt lõi: với `[100, 112, 104.5]` bản đánh giá đầy đủ loại CẢ điểm
104.5 (2of3-2s cùng với 112), còn chuỗi chấp nhận bỏ 112 và GIỮ 104.5.
**Bài test này viết sai kỳ vọng ở lần đầu** (tưởng bỏ điểm giữa là hết vi
phạm, thực ra 2-2s vẫn nổ vì 2 điểm 104.5 đều >2SD) — sửa kỳ vọng theo số
đo thật chứ không sửa hàm.

**1 IPC mới: `entry:setDayNote`** — cột "Ghi chú" của bảng nhập. Port đúng
`EntryService.saveDateNote()`: ghi chú KHÔNG có bảng riêng, nó nằm ở trường
`note` của MỌI điểm QC còn hiệu lực trong ngày (`qc_points.note` schema đã có
sẵn từ đầu). Kéo theo 2 hệ quả của app cũ cũng giữ nguyên: ngày chưa có điểm
QC nào thì không lưu được (`no-points`), và kỳ báo cáo đã khoá thì chặn.
TypeScript bắt ngay bản giả lập thiếu hàm này (`satisfies QcApi`/`: QcApi` —
đúng seam vừa siết ở lượt rà soát chất lượng mã).

**Hợp đồng `TestLevel` thiếu 6 trường mà handler VẪN trả về** (`low`/`high`/
`range_k`/`mfg_mean`/`mfg_sd`/`applied`) — bổ sung để trang đọc `applied`
(hiện "Dải NSX"/"Dải PXN") an toàn kiểu, không phải ép `any`.

**Lại là bộ seed (lần 2)**: ô "NV thực hiện" của app cũ luôn hiện '—' vì bộ
seed dùng chung của repo (`scripts/lib/seed-browser-session.js`) đặt
`staff:'NV1'`, còn app cũ đọc `operatorName`/`operatorCode`
(`domain/qc/staff-identity.ts`). Sửa seed đặt đúng field app cũ THẬT SỰ đọc,
và seed v2 ưu tiên `operatorName`/`operatorCode` rồi mới fallback `staff` —
2 bản cùng dữ liệu thì mới so được.

Còn lại là 12 nhóm chi tiết trình bày, port theo giá trị nguyên văn của
`assets/professional-entry.css`: nút "Tới hôm nay" (teal, nhảy tháng RỒI
cuộn tới hàng hôm nay), nút "＋ Thêm" mở lần chạy bổ sung (app cũ KHÔNG hiện
sẵn ô trống ở ngày đã có điểm — phải bấm mới mở, `qc-add-run-*`/`has-add-btn`/
`has-data`), ô ghi chú theo ngày, cửa sổ Từ/Đến + preset 7/14/30/60/90 ngày
(mặc định 30) + dòng "Khoảng xem: dd/mm/yyyy – dd/mm/yyyy · N mức QC", dải
`lj-qc-strip` 5 chỉ số (Mean/SD/CV thực + Mean/SD mục tiêu) kèm gợi ý dải
đang dùng, class canvas `entryLJStack`, panel `qc-points-panel` +
`qc-cumulative-note`, cột Z trong bảng điểm, huy hiệu `.qc-staff`, dải năm
11 năm từ (năm nay − 5), nhãn `VERDICT_LABEL` rej là 'Loại bỏ', và giá trị QC
in theo số thập phân của xét nghiệm (109.5 → "109.50", `fmtPointValue`).
Nút "Hiện danh mục" (`entry-tree-expand`) render LUÔN như app cũ (CSS ẩn khi
chưa thu gọn) thay vì chỉ render khi đã thu gọn.

**Bẫy quy trình mất 1 lượt đo**: gate phục vụ `app-v2-dist/renderer` (bản ĐÃ
BUILD), KHÔNG phải dev server — sửa nguồn rồi đo ngay thì số không đổi. Phải
`npm run app-v2:build` trước mỗi lượt `app-v2:ui-parity`.

**3 hạng mục CHƯA port, đều cần thiết kế/backend chứ không phải CSS** (ghi cả
vào `surfaceNotes` của baseline): (1) cột song song 2 lô — cần cột phân biệt
điểm song song trong `qc_points` + chỗ lưu Mean/SD ứng viên, lý do kỹ thuật
đã ghi từ Giai đoạn B2; (2) 2 nút "Workflow dải QC"/"Về dải nhà sản xuất" —
cần `rangeCandidate()` (cổng ≥20 kết quả, ≥20 ngày độc lập, 0 điểm bị loại/
cảnh báo, SD>0) + IPC áp/hoàn dải; phần HIỂN THỊ dải đang dùng đã port;
(3) điều hướng bàn phím trong bảng nhập (`entrySheetKey`/`entryTreeKey`).
Không dựng nút gọi vào chỗ trống — Giai đoạn D cấm control chết.

Verify: `npm run app-v2:typecheck`/`build` sạch, `app-v2:test` **33/33**
(thêm `accepted-points.test.mjs`; `mock-parity` vẫn khớp sau khi thêm
`setDayNote` + cờ `accepted` ở cả 2 bên), `app-v2:ui-parity` **52 surface**
(entry 0/0 cả 4 viewport, baseline chốt 0).

**Giai đoạn D3.6 — Six Sigma (2026-09-02): 73 class / 90 dòng chữ lệch → 7
class / 32 dòng, phần còn lại thuộc đúng 4 lý do đã ghi rõ, không phải nợ
CSS.**

**Lại là bộ seed, lần thứ 3 — và lần này nghiêm trọng nhất về mặt ĐO LƯỜNG:
seed KHÔNG có dữ liệu Six Sigma ở cả 2 bản** (`sigmaPeriods: []`, app cũ
không có `sigmaData` nào). Đo trước khi sửa sẽ ra "0 lệch" cho một trang gần
như trống — đúng lỗ hổng đã gặp với 7 tab Cấu hình chung ở D3.4, nhưng ở đây
là cả một TRANG. Bổ sung `SIGMA_SEED` khai MỘT LẦN (1 kỳ, 2 mức, CV/Bias khác
nhau giữa 2 mức để Sigma khác nhau) rồi ánh xạ sang 2 hình dạng: app cũ cần
`test.sgTracked = true` + `state.sigmaData[testId] = [{ id, period, tea,
teaSource, lv: { <mức>: {cv, biasEqa} } }]`; app-v2 cần
`sigmaPeriods: [{ id, testId, period, tea, teaSource, levels: [...] }]`.
**Bài học lặp lại lần 3: với trang chưa từng được đo, việc ĐẦU TIÊN là kiểm
seed có dữ liệu cho trang đó hay không — số 0 lệch của một trang trống là số
vô nghĩa.**

**Cùng lỗi "không tự chọn" như D3.5**: app cũ (`sigma-page-controller.ts`:
`if (!ui().sgTest || !tests.find(...)) ui().sgTest = tests[0].id`) tự chọn
xét nghiệm đầu tiên; app-v2 để rỗng nên chỉ render vỏ (11 dòng chữ). Thêm
`useEffect` tự chọn: 73/90 → 49 class/85 dòng. Đây là lần thứ 2 liên tiếp
cùng một lớp lỗi — đáng coi là hạng mục kiểm bắt buộc cho mọi trang có state
chọn còn lại (D3.7–D3.10).

**Port theo golden master** (`src/react/pages/SigmaPage.tsx` +
`sigma-status-*-html.ts` + `professional-sigma.css`):
- Panel "Thiết lập phân tích": `.sg-control-row` (picker + 2 nút admin) +
  `.sg-setup-fields` (Tên/Đơn vị/Thiết bị chỉ đọc, `.sg-tea-source` 4 nguồn
  TEa đúng thứ tự và câu chữ `TEA_SOURCE_REGISTRY`, `.sg-tea-input` nhãn đổi
  theo nguồn) + `.sg-sigma-input-note` nguyên văn.
- Panel "Tình trạng": dòng "Kỳ đang xem: <kỳ> · <xét nghiệm> · TEa n%", thẻ
  `.sgbig` với tiêu đề **"Mức n — Sigma"** (dấu gạch dài, chữ hoa do CSS) và
  2 dòng chi tiết "CV IQC x% · Bias EQA/EQC y%" + "DPMO … · Yield …%" —
  `formatSigmaDpmo()` port nguyên (dưới 10 giữ 2 chữ số, dưới 1000 làm tròn,
  còn lại phân nhóm nghìn en-US).
- Thẻ **"Khuyến nghị cải thiện"** (`.sg-improvement-*`): port `sgTips()` —
  chia nguyên nhân theo tỉ lệ `|bias| / (|bias| + 1.65·cv)` (>0.6 do bias,
  <0.4 do CV, giữa là cả hai) và liệt kê đúng danh sách hành động của bản cũ.
- Bảng kỳ: ô kỳ thành 2 select tháng/năm (`.sg-period-select-wrap`/
  `.sg-period-controls`/`.sg-period-month`/`.sg-period-year`), hàng đang xem
  có `.sg-period-selected`, ô Bias có khối giữ chỗ `.sg-cell-meta-empty`, ô
  Sigma thêm class `ok`/`rej` theo ngưỡng 3σ, cột "Thao tác" có Excel/In PDF/
  Xóa, chân bảng `.sg-data-foot` có "Xuất Excel"/"Xuất PDF" tổng hợp, và các
  nút "Bias EQA% Mức n" trên đầu bảng như app cũ.
- Panel MU thu gọn (`.sg-collapse-panel.sg-mu-panel`) với bảng 7 cột
  u(Rw)/u(bias)/u(cal)/u_c/U/thành phần thiếu — đọc thẳng `lv.mu` mà
  `uncertaintyBudget()` đã trả từ Giai đoạn B4.
- Panel "Biểu đồ Sigma & MDC": `components/SigmaCharts.tsx` (mới) vẽ 2 biểu
  đồ bằng canvas + ref chuẩn React — xu hướng Sigma theo kỳ (kèm 2 mốc 3σ/4σ)
  và MDC (X = CV/TEa, Y = |Bias|/TEa, 4 biên Sigma 3/4/5/6, điểm to nhất là
  kỳ gần nhất). KHÔNG port hình học SVG `sgTrendSVG`/`sgMDCSVG` — giống nội
  dung, khác cách vẽ, đúng nguyên tắc đã chốt từ A1.

**1 IPC mới: `sigma:removePeriod`** — app cũ có nút "Xóa" từng kỳ (chỉ admin,
`sgDelPeriod`), app-v2 chưa có đường xoá nào nên nút sẽ là control chết. Xoá
THẬT khỏi `sigma_data` (kỳ Sigma là bản ghi đánh giá do người dùng nhập,
không phải dữ liệu QC gốc phải giữ vĩnh viễn như `qc_points`), vẫn ghi audit.
Đổi tháng/năm của 1 kỳ ở app-v2 phải lưu sang kỳ MỚI rồi xoá kỳ cũ, vì
app-v2 khoá `id = testId:period` (app cũ sửa tại chỗ được vì id là uid rời) —
ghi rõ lý do ngay tại chỗ trong code.

**`tests/mock-parity.test.mjs` mở rộng lên 131 bước, phủ 89/89 hàm** — thêm
`removeSigmaPeriod` và cả `setDayNote` (thêm ở D3.5 mà lượt đó chưa đưa vào
kịch bản). TypeScript lại bắt được bản giả lập thiếu hàm mới ngay khi thêm
vào hợp đồng, đúng seam đã siết.

**4 lý do cho 7 class / 32 dòng còn lại** (ghi cả vào `surfaceNotes`):
1. **Danh mục TEa tích hợp** (9 dòng): app cũ tự tra `TEA_ANALYTE_CATALOG`
   được Ricos 0.73% / CLIA ±4.0000 mmol/L cho "Sodium (Na)", nên Sigma ra
   -0.42/-0.17 và các dòng "TEa đang dùng"/"Kỳ đang xem"/DPMO khác hẳn.
   app-v2 chỉ tra được nguồn "phòng xét nghiệm" từ bảng `tea_refs` — hoãn từ
   Giai đoạn B1, cần cả `docs/tea-sources.md`. **Cố ý KHÔNG hardcode 0.73 vào
   seed để số khớp**: như vậy là làm cho gate xanh chứ không phải làm cho
   app đúng.
2. **Panel "Thiết kế QC theo Sigma (OPSpecs)"**: cần domain thiết kế QC theo
   Westgard Sigma Rules (gợi ý luật + số QC mỗi lần chạy), app-v2 chưa có →
   `sg-selected-period-hint`/`alert-block`/`info`/`flow-item`/`muted`/`warn`.
3. **Nút "Nạp CV lô"** (`sg-row-cv`): cần bộ chọn cohort IQC (`sgCohortCtx`)
   để lấy CV theo lô lịch sử; dựng nút mà chưa có cohort là control chết.
4. **Nhãn TRỤC biểu đồ** (0/2/4/6/8, 3σ, 6σ, 09/2026, Sigma, 20..100): app cũ
   vẽ SVG có text node thật nên `innerText` đọc được; app-v2 vẽ canvas nên
   nhãn nằm trong bitmap. Đã bù bằng **chú giải DOM thật** (tên từng mức +
   mốc 3σ/6σ) để người dùng và trình đọc màn hình vẫn đọc được — không nhồi
   số trục vào DOM chỉ để gate xanh.

Verify: `npm run app-v2:typecheck`/`build` sạch, `app-v2:test` **33/33**
(mock-parity 131 bước, 89/89 hàm), `app-v2:ui-parity` **56 surface** (sigma
4 viewport ở baseline 7/32 kèm `surfaceNotes`).

**Giai đoạn D3.7–D3.10 — 4 trang cuối, ĐÓNG Giai đoạn D3 (2026-09-03).
11/11 trang đã qua golden master; gate lên 72 surface, 36 ở 0/0, mọi surface
còn lệch đều có `surfaceNotes` giải thích lý do sản phẩm/kỹ thuật.**

**D3.7 — So sánh hoá chất (26 class / 58 dòng → 1 / 18).** Bộ seed CHƯA HỀ có
phép so sánh nào ở CẢ HAI bản — **lỗi đo lường lần thứ 4** (sau Manage bịa
field, Sigma thiếu cả 2 bên, activity chỉ có ở v2): một trang không có dữ liệu
thì con số "0 lệch" là con số vô nghĩa. Thêm `REAGENT_SEED` (24 cặp lệch +1%,
suy từ cùng một nguồn cho 2 bản như quy ước đã ghi ở D3.4). Trang được VIẾT LẠI
TOÀN BỘ theo bố cục app cũ: `rc-toolbar-panel` → `rc-entry-grid`
(`rc-info-panel` 10 trường + `rc-pair-panel` có cột TB/Hiệu tính sẵn từng cặp)
→ `rc-stats-panel` → `rc-crit-panel` (6 tiêu chí + banner kết luận) →
`rc-chart-panel` kèm chú giải. Chi tiết dễ bỏ sót nhất là **2 hàm định dạng
KHÁC NHAU** trong cùng trang của app cũ: bảng thống kê cắt số 0 cuối
(`String(Number(x.toFixed(2)))` → "1" chứ không phải "1.00"), còn bảng cặp mẫu
GIỮ số 0 (`x.toFixed(3)`) — dùng một hàm cho cả hai làm lệch hàng chục dòng mà
nhìn code không thấy sai.
- **Bài học quy trình (không phải lỗi code)**: `git checkout` một file đang có
  thay đổi CHƯA COMMIT của Giai đoạn D đã xoá sạch bản đang làm — đúng cái bẫy
  đã ghi trong bộ nhớ dự án. Không đi khảo cổ trong bundle đã build để dựng
  lại; viết lại nguyên trang theo golden master (việc mà D3.7 vốn đã yêu cầu),
  nhanh và đúng hơn là ghép mảnh.
- Còn lại: 1 class `rc-icon-btn` (3 danh sách chọn nhanh lô/xét nghiệm/mẫu) và
  18 dòng là **nhãn TRỤC biểu đồ** — app cũ vẽ SVG có text node thật nên
  `innerText` đọc được, app-v2 vẽ canvas nên nhãn nằm trong bitmap (cùng lý do
  đã ghi ở D3.6, đã bù bằng chú giải DOM thật thay vì nhồi số trục vào DOM cho
  gate xanh).

**D3.8 — Khắc phục sự cố (42 class / 66 dòng → 0/0 cả 4 viewport).** Hai lệch
NGHIỆP VỤ, không phải lệch CSS:
1. **Panel "Sự cố cần xử lý" phải gom theo NHÓM** (xét nghiệm + ngày:
   `issue-group`/`issue-group-h`/`issue-group-date`/`issue-group-count`), không
   phải danh sách phẳng theo mức như app-v2 đang làm — một ngày có 3 mức vi
   phạm ở app cũ là 1 nhóm 3 hàng, ở app-v2 là 3 dòng rời không biết cùng ngày.
2. **KHÔNG ẩn hàng khi đã có hồ sơ NCE.** app-v2 lọc bỏ mức nào đã có hồ sơ
   active; app cũ vẫn hiện và đổi nút thành "Tiếp tục hồ sơ" — nghĩa là sự cố
   đang xử lý dở vẫn nằm trước mắt người dùng. Và khớp hồ sơ bằng
   `r.point_id === lv.latest.id` (đúng ĐIỂM QC gây ra sự cố), không phải bằng
   test+mức: khớp theo test+mức sẽ coi một hồ sơ cũ của lần vi phạm TRƯỚC là
   "đã xử lý" cho lần vi phạm MỚI hôm nay.

Bảng nhật ký đổi từ 7 cột phẳng sang 5 cột xếp tầng đúng app cũ (Thời điểm /
Sự cố / Hành động / Trạng thái / Thao tác, mỗi ô nhiều dòng con:
`action-date`/`action-time`/`action-test`/`action-sub`/`action-rule`/
`action-text`/`action-status-stack`/`action-row-actions`), thêm nút "Xuất CSV
nhật ký" và nút "Hủy hồ sơ" (hủy CÓ LƯU VẾT, không xoá dữ liệu — dùng
`nce:cancelRecord` đã có). Form dùng `action-form-panel` có đầu panel + 2 trạng
thái rỗng ("Chọn một sự cố để lập hồ sơ" / "Lập hồ sơ từ nguồn khác").

**D3.9 — Phân tích Westgard (18 class / 31 dòng → 0 / 1).** Cùng lỗi "app-v2
không tự chọn xét nghiệm" **lần thứ 4** (Entry, Sigma, và ở đây) — đến mức
đây là hạng mục kiểm bắt buộc đầu tiên cho mọi trang có state chọn. Thêm ô
"Tìm nhanh" + bộ đếm khớp/tổng + nhãn xét nghiệm kèm LOT (`testPickerLabel`,
`… · LOT 1101/1102`), 2 nút Xuất Excel/In PDF (`wg-export-actions`), nút
"Khôi phục mặc định" (dùng `WG_OFF_BY_DEFAULT` chứ không phải "bật hết"), cột
"Loại sai số" hiện SE/RE kèm mô tả luật đầu tiên (`errorTypeOf` + `RULE_DESC`,
port `WG_RULE_REGISTRY[].err` của app cũ), Z in kèm dấu và hậu tố `s`
(`+2.31s`), giá trị theo số thập phân của xét nghiệm, nhãn `rej` trong bảng
điểm là **"Loại bỏ"** (khác badge tổng quan "Vi phạm"), class canvas
`wgLJMulti`. Còn đúng 1 dòng: câu giới thiệu panel biểu đồ của app cũ kết thúc
bằng lời nhắc công tắc **"Xem lô cũ"** — app-v2 CHƯA có tính năng thêm đường
của lô đã chuyển tiếp vào Levey-Jennings (cùng nhóm với cột song song 2 lô đã
hoãn từ Giai đoạn B2, cần cột phân biệt điểm thuộc lô nào trong `qc_points`).
Câu của app-v2 chỉ nói phần nó THẬT SỰ làm — copy nguyên văn câu cũ là hứa một
công tắc không tồn tại, đúng điều Giai đoạn D cấm.

**D3.10 — Nhật ký hoạt động (9 class / 16 dòng → 0/0 cả 4 viewport, trang cuối
của D3).** Ô "Số dòng mỗi trang" ghi "25 dòng" (không phải "25"), cột thời gian
dùng `formatDateTimeVN` thay chuỗi ISO, ô người dùng đảo lại đúng thứ tự app cũ
(TÊN in đậm, dòng dưới là "vai trò · @tài khoản" — app-v2 đang in username ở cả
hai dòng), huy hiệu chuỗi hash 3 trạng thái (`tag none`/`tag ok` "Chuỗi hash
hợp lệ" + số dòng đã khóa hash/`tag rej`) và TỰ kiểm chuỗi khi nhật ký còn nhỏ
(`AUTO_VERIFY_MAX`, khớp `AUDIT_AUTO_VERIFY_MAX` của app cũ — trên ngưỡng thì
chỉ hiện nút để không băm lại hàng chục nghìn dòng mỗi lần đổi trang), 2 ô ngày
mang class `audit-date`.
- Kéo theo một thay đổi xuyên 5 tầng: app cũ hiện **"N/M dòng"** (số dòng SAU
  KHI LỌC / tổng số dòng), app-v2 chỉ có `resultTo` của trang hiện tại. Thêm
  `filteredCount` vào `paginateActivity()` và `total` vào `audit:query()`, đi
  qua `qc-api.d.ts` → `preload.ts` → bản giả lập → `audit-store.ts`.
- `tests/audit-filter.test.mjs` vỡ vì nó so **JSON của cả object** với hàm
  `activityAuditPagination` của app cũ, nên một trường MỚI cũng làm nó đỏ dù
  phân trang không lệch. Sửa bằng cách so đúng 4 khoá app cũ có
  (`page`/`pageCount`/`offset`/`rows`) và chốt RIÊNG trường mới (bằng
  `items.length`, cộng một case lọc rỗng phải ra 0) — giữ nguyên ý định bài
  test (phân trang phải khớp app cũ) thay vì nới lỏng nó.

**Tổng kết Giai đoạn D3 — 3 lớp lỗi lặp lại, đáng thành checklist cho mọi
trang mới:** (1) **seed không có dữ liệu cho trang đang đo** — 4 lần, mỗi lần
làm con số đo được thành vô nghĩa; việc ĐẦU TIÊN với một trang chưa từng đo là
kiểm seed, không phải đọc CSS. (2) **app-v2 không tự chọn mục đầu tiên** — 4
lần; app cũ luôn rơi về phần tử đầu khi lựa chọn hiện tại không hợp lệ, app-v2
để rỗng và chỉ render vỏ, gate báo hàng chục class thiếu mà nguyên nhân là
1 dòng `useEffect`. (3) **gate phục vụ `app-v2-dist/renderer` (bản ĐÃ BUILD)** —
sửa nguồn rồi đo ngay thì số không đổi; phải `npm run app-v2:build` trước mỗi
lượt đo.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` **33/33**,
`app-v2:build` sạch, `app-v2:ui-parity` **72/72 surface đạt** (36 ở 0/0; 9
nhóm surface còn lệch — settings, sigma, reagent, westgard và 5 tab Cấu hình
chung — đều có `surfaceNotes` nêu rõ lý do, không có mục nào bị bỏ sót không
ghi chú).

**Điểm mù của gate UI parity — 2 lệch CSS HỆ THỐNG + gate mới
`app-v2:css-parity` (2026-09-03).** Người dùng mở trang Nhập QC và nói "chưa
giống app cũ" trong khi gate báo entry **0/0**. Cả hai đều đúng: gate chỉ đo
**tập class** và **dòng chữ** trong vùng nội dung theo chiều "app cũ CÓ mà
app-v2 THIẾU", nên nó KHÔNG thấy 3 lớp lệch sau — và cả ba đều đang xảy ra:
1. **Bố cục/kích thước**: không có pixel-diff (cố ý, D0 mục 5 đặt sau), cũng
   không đo `getBoundingClientRect()` — sidebar rộng hơn 13px, header thấp
   hơn 17px, mọi panel thụt thêm 16px đều qua gate.
2. **Class có trong DOM nhưng app-v2 KHÔNG có rule CSS nào**: gate so tập
   class 2 bên, class vẫn có ở cả hai nên "0 thiếu", dù bên app-v2 không có
   gì phía sau nó.
3. **Class có rule nhưng SAI ngữ cảnh/giá trị**: copy rule mobile của app cũ
   ra ngoài `@media` thì desktop cũng bị áp.

**2 lệch HỆ THỐNG, ảnh hưởng cả 11 trang** (tìm ra bằng cách chạy 2 bản với
CÙNG bộ seed rồi so `getBoundingClientRect()` từng khối, không phải nhìn ảnh):
- **`.panel{padding:16px}` trong khi app cũ là `padding:0`.** Đây là quyết
  định có chủ đích từ Giai đoạn A1 ("để không phải sửa spacing của các trang
  đã viết", kèm cặp margin âm cho header) — nhưng hệ quả là mọi nội dung
  trong panel bị thụt THÊM 16px, cộng dồn với margin đã port nguyên từ app cũ
  (đo được `.qc-sheet-wrap` x=601 thay vì 585, `.lj-stack` thụt 27px thay vì
  11px). Đổi về `padding:0` + header tự mang padding như bản cũ; toàn bộ
  margin trong các trang đã port từ `professional-*.css` lập tức khớp lại,
  không phải sửa trang nào.
- **Thiếu hẳn rule `body`.** App cũ đặt `font-size:var(--type-subhead)` (14px)
  và `line-height:1.5` trên `body` (`professional-base.css`); app-v2 không có,
  nên chữ toàn app thừa hưởng `line-height:normal` (~1.2) và 13.5px của
  reset — mọi khối nhiều dòng thấp hơn vài px (dải chỉ số Mean/SD 58px thay
  vì 63px), lệch tích lũy khắp nơi chứ không riêng một trang.

**3 lệch khung sườn cùng loại "một dòng CSS sai nguồn":**
- Sidebar: `--sidebar-expanded-width:258px` cứng, app cũ là
  `clamp(208px,17vw,268px)` (=245px ở khung 1440px). Một số cố định làm MỌI
  trang lệch 13px.
- `.head{height:82px}` — comment ngay tại chỗ ghi **"App Cước phí dùng topbar
  cao đúng 82px"**, tức dòng này copy từ một app KHÁC của người dùng, không
  phải từ golden master (app cũ để chiều cao do `padding` quyết định, ra 99px).
- Khoảng hở dưới header dùng `main > .head + *{margin-top:...}` — selector
  này KHÔNG BAO GIỜ khớp, vì mọi trang app-v2 bọc nội dung trong một `<div>`
  vô danh nên `.head` không phải con trực tiếp của `<main>`; mọi trang mất
  đúng 22px. Đổi về `margin-bottom` trên chính `.head` như app cũ.

**2 rule dùng chung app cũ có mà app-v2 không có** (khiến thẻ con mất viền/
thấp hơn): "mặt thẻ dùng chung" (`.qc-table-card,.tree,.lj-mini,.sg-chart-box`
— viền/bo/nền/shadow, app-v2 chỉ áp riêng cho `.qc-table-card` nên thẻ biểu
đồ `.lj-mini` không có viền, mất luôn viền teal của mức đang chọn) và "header
phụ dùng chung" (`.qc-table-card h4,.lj-mini-h,.tree h4,.sg-chart-box>h3` —
app-v2 đã có token `--subpanel-header-min-height` từ A1 nhưng CHƯA có rule
nào dùng nó).

**Biểu đồ Levey-Jennings — chỗ lệch NHÌN THẤY rõ nhất, và gate không thể
thấy vì cả biểu đồ nằm trong bitmap canvas.** Bản A1 cố ý "vẽ lại từ đầu,
giống nội dung không giống cách vẽ": kết quả là 7 đường kẻ ±SD + đường nối
điểm, trong khi app cũ có dải màu ±1/±2/±3SD, nhãn trục Y HAI BÊN (bậc SD bên
trái, GIÁ TRỊ THẬT bên phải), nhãn ngày dd/mm ở trục X và tiêu đề
"Levey-Jennings" trong khung vẽ. `components/QcChart.tsx` được port đúng hình
học/màu/nhãn của app cũ (`leveyJenningsGeometry` padL=56/padR=78/padT=34/
padB=48, trục phủ ±3.25SD, `leveyJenningsBandRects` 6 dải theo đúng thứ tự vẽ,
`LEVEY_JENNINGS_COLORS`, `createLeveyJenningsYAxisLabels` với '> +3'/'< -3',
`createLeveyJenningsTicks` tối đa 5 mốc) — vẫn là canvas + ref chuẩn React,
nhưng các con số không còn là "tự nghĩ". Nhận thêm prop `mean`/`sd`/`decimals`
để in giá trị thật ở trục phải; không có Mean/SD thì rơi về thang z như
`drawLJMultiZ` của app cũ.

**5 lệch nội dung/hành vi của riêng trang Nhập QC:**
- "Dải NSX/Dải PXN" bị đặt làm ô thứ 6 của lưới 5 cột `.lj-qc-strip` (nên
  xuống hàng), app cũ để BÊN PHẢI header thẻ (`.lj-mini-h`, `LjAction` kind
  'hint').
- app-v2 tự thêm cặp tab **Levey-Jennings/CUSUM** mà app cũ KHÔNG có ở trang
  này (CUSUM chỉ ở trang Phân tích Westgard) — đã bỏ. Đây là chiều gate không
  đo được: nội dung app-v2 hiện THÊM không bị bắt.
- Thứ tự 2 panel cuối bị đảo (app cũ: "Điểm trong khoảng xem" TRƯỚC, rồi
  "Thống kê toàn bộ & Dải kiểm soát").
- **Vệt cam đánh dấu ngày bị NGƯỢC.** app cũ (`entry-page-controller.ts`):
  `missing` = ngày ĐÃ QUA (hoặc hôm nay) mà CHƯA nhập đủ MỌI mức đang vận
  hành, cộng `has-data` khi ngày có ít nhất 1 điểm. app-v2 gán `missing` cho
  ngày KHÔNG có điểm nào — nên ngày TƯƠNG LAI bị kẻ vệt cam, còn ngày quá khứ
  mới nhập 1/2 mức thì không, tức đúng ngược ý nghĩa "thiếu QC".
- Thiếu trạng thái mức đang chọn (`.lj-mini.on`, viền teal) — app cũ giữ
  trong `entrySel.level` và mặc định là mức đầu tiên.

**2 lệch tương tự ở trang khác, tìm ra khi rà lại toàn bộ:**
- **Tổng quan**: danh sách "Lô & hạn dùng" của app cũ bọc trong `.dash-list`,
  app-v2 không — mà rule tô nền đỏ/vàng của app-v2 lại scope theo
  `.dash-list .shift-item.rej`, nên hàng lô mất hẳn nền màu dù ĐÚNG class
  `shift-item rej`/`warn`. Gate không thấy: nó so TẬP class của cả vùng nội
  dung, không so theo từng phần tử.
- **Six Sigma**: (a) thẻ Sigma xếp dọc vì rule 2 cột của app cũ là
  `@media(min-width:500px){#sgStatus .sgcards{...}}` mà app-v2 không có
  `id="sgStatus"`; (b) **class `btn-ico` bị gắn lên chính `<button>`** ở nút
  "Bias EQA% Mức n" (Sigma) và "Xuất Excel"/"In PDF" (Westgard) — `btn-ico`
  là class của thẻ `<svg>` (15×15, `flex:0 0 auto`), nên nút co còn **26px**
  và chữ vắt thành 3 dòng chồng lên tiêu đề panel. Sửa bằng
  `components/BtnIcons.tsx` (copy nguyên path SVG `icoDownload`/`icoPrint`/
  `CalcIcon` của app cũ) và bỏ class khỏi nút.

**Gate mới `npm run app-v2:css-parity`** (`app-v2/scripts/css-parity-check.cjs`)
đóng lớp lệch (2): lấy mọi class trong `className` của
`app-v2/renderer/**/*.tsx`, FAIL nếu class đó có selector trong `assets/*.css`
(app cũ style thật) mà KHÔNG có selector nào trong
`app-v2/renderer/styles/**`. Lần chạy đầu ra **30 class** — trong đó có thứ
làm vỡ hẳn bố cục: `.sg-setup-fields` (lưới 3 cột panel "Thiết lập phân tích"
Six Sigma — app-v2 chỉ có nó trong một dòng COMMENT), `.action-form-panel-head`,
`.issue-group`, `.lot-config-left/right`, `.wg-rule-item`, `.wg-rule-reset`,
`.qc-note-input`, `.qc-level-head`, `.range-band-note`, `.rc-add-btn`/
`.rc-report-main`, `.audit-date`, `.transition-list`, `.btn-stop-tint`,
`.config-name`, `.space-after-item`. Đã port hết từ `assets/*.css` (giữ đúng
`@media` gốc) → gate về **0**. Đã chứng minh gate CÓ bắt lỗi: xoá thử rule
`.space-after-item` khỏi `app.css` thì gate FAIL đúng tên class đó.
**Giới hạn ghi thẳng trong file**: gate chỉ kiểm "có rule hay không", KHÔNG so
giá trị và KHÔNG kiểm ngữ cảnh `@media` — đúng lớp lệch (3), thứ đã gặp thật
ở 2 rule `.sg-data-head` (bản mobile của app cũ bị copy ra ngoài media nên
desktop cũng xếp dọc, làm hàng nút chồng tiêu đề).

**Cách làm đã dùng, nên lặp lại cho mọi trang còn lại**: mở CÙNG bộ seed trên
2 bản (dùng lại `openSeededSession` + `buildParitySeeds` của gate), đặt khung
cao 1440×2400 để không bị cắt, rồi so `getBoundingClientRect()` + computed
style của từng khối (`aside`/`.head`/panel/thẻ con) — số đo chỉ ra ngay nguyên
nhân (padding/margin/min-height/flex nào lệch), nhanh và chắc hơn nhìn 2 ảnh
cạnh nhau. Kết quả trang Nhập QC sau khi sửa: `aside` 245×2400, `.head` 99px,
`.qc-sheet-wrap` x=585 w=812 h=574, `.lj-mini` h=363, `.lj-qc-strip` h=63 —
**khớp từng pixel với app cũ**; còn đúng 2px lệch dọc tích lũy trong panel
bảng nhập, chưa truy tiếp.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` **33/33** (sửa
`tests/audit-filter.test.mjs` như mục D3.10; không test nào khác phải đổi vì
đây là thay đổi CSS/JSX), `app-v2:build` sạch, `app-v2:ui-parity` **72/72
surface đạt** (không surface nào vượt baseline sau 2 thay đổi CSS TOÀN CỤC),
`app-v2:css-parity` **0 class bỏ trống**.

**Giai đoạn D3.4b — Cấu hình chung, rà soát cả NGHIỆP VỤ lẫn giao diện theo
từng tab (2026-09-03).** Người dùng nói trang này "vẫn chưa giống 100%" dù
baseline chỉ ghi 5 surface còn lệch nhỏ. Rà lại bằng một công cụ đo riêng cho
trang có tab (mở CÙNG bộ seed trên 2 bản, bấm tab theo INDEX, rồi xuất DANH
SÁCH ĐẦY ĐỦ class/dòng chữ thiếu + **dòng chữ app-v2 CÓ THÊM** + **đo
`getBoundingClientRect()` từng khối** + ảnh chụp cặp) — 3 chiều sau cùng là
những gì `app-v2:ui-parity` không đo. Kết quả: **8/8 tab về 0 class / 0 dòng
chữ lệch**, và tìm ra 4 lệch NGHIỆP VỤ thật.

**4 control CHẾT ở tab Mean/SD** — nặng nhất, vì Giai đoạn D cấm tường minh:
checkbox "Dùng" chỉ có `defaultChecked` không handler; 3 nút "Bỏ chọn tất
cả"/"Chọn tất cả"/**"Lưu Mean/SD mức này"** KHÔNG có `onClick` nào; 2 ô Giới
hạn dưới/trên không tính gì. Nghĩa là bảng Mean/SD trông đủ nhưng **không thể
lưu**. Port đúng nghiệp vụ app cũ:
- `renderer/lib/target-range.ts` (mới): `targetFromLimits`/`limitsFromTarget`/
  `normalizeTargetPick` — copy nguyên công thức `QCCore.targetFromLimits`
  (mean=(low+high)/2, sd=(high−low)/2k) và ĐÚNG 5 câu thông báo lỗi của
  `ManageConfigService.normalizeTargetPick()`, kèm thứ tự kiểm.
- `syncTargetRange(el, 'limits'|'target')`: đồng bộ 2 chiều Mean/SD ↔ giới
  hạn, đọc/ghi THẲNG DOM của chính hàng đang gõ (không qua React state) —
  cùng lý do đã ghi ở Giai đoạn B1: 4 ô có thể lần lượt mất focus rất nhanh
  khi Tab qua, tính từ state đã render sẽ ghi đè bằng giá trị cũ.
- `toggleTargetRow`/`targetCheckAll`: bỏ tick thì khoá luôn 4 ô số của hàng.
- `saveTargetMatrix`: đọc từng hàng đang tick → `normalizeTargetPick` → nếu
  có hàng đang gắn LÔ KHÁC thì `confirmDialog` nêu tên các xét nghiệm đó →
  `reauthDialog` (đúng câu app cũ: "Nhập lại mật khẩu trước khi lưu Mean/SD
  cho lô QC.") → lưu từng mức qua `config:saveTestLevel` (handler đó tự chốt
  Mean/SD cũ vào `mean_sd_history_json`). **KHÁC app cũ có chủ đích**: app cũ
  còn "điền lô/Mean-SD cho điểm QC cũ chưa ghi lô" (`targetPickBackfillPoints`)
  và phải hỏi thêm nếu việc đó đụng kỳ đã khoá — app-v2 KHÔNG cần vì từ Giai
  đoạn B2 `entry:addPoint` đã chốt `qc_mean`/`qc_sd`/`lot` vào từng điểm ngay
  lúc nhập, không còn điểm nào thiếu lô để điền bù.

**2 thao tác app cũ CÓ mà app-v2 chưa từng có**: nút "Xóa" của tab Danh mục
xét nghiệm và tab Panel QC (gate báo thiếu đúng 1 class `danger` + 1 dòng
"Xóa" ở mỗi tab — dấu vết của một nút bị thiếu hẳn).
- `config:removeTest`: port cổng chặn của `delTest()` — **TỪ CHỐI** khi còn
  điểm QC thuộc kỳ báo cáo đã khoá (nêu rõ số điểm + kỳ nào), vì đường đúng
  là mở khoá kỳ trước (bước đó đòi lý do và tự ghi nhật ký — chính là vết ISO
  15189 cần). Xoá thật kèm dọn `test_levels`/`qc_points`/`sigma_data`/
  `actions`/`qc_panel_tests` trong 1 transaction. Renderer: `confirmDialog` →
  `reauthDialog` → báo số điểm QC đã xoá.
- `config:removePanel`: port `panelRemoval()` — chặn khi panel còn hồ sơ
  chuyển tiếp lô, giữ nguyên các xét nghiệm bên trong (đúng câu app cũ "Các
  xét nghiệm vẫn được giữ nguyên").

**Bảng TEa tham chiếu: 78 dòng lệch KHÔNG phải vì thiếu dữ liệu.** app-v2 đã
có đủ 77 analyte trong `renderer/data/tea-catalog.ts` — lệch vì app cũ cho
**SỬA TRỰC TIẾP** TEa CLIA%/Ricos% của từng analyte ngay trên bảng
(`.tea-ref-value`, lưu khi blur) nên 2 ô đó không góp chữ vào `innerText`,
còn app-v2 in số đọc-được. Thêm `config:setTeaRefValue` +
`config:restoreTeaRefDefaults` (ghi đè lưu vào chính bảng `tea_refs` đã có
sẵn cột `analyte_id`/`clia`/`ricos` từ đầu; để trống ô = bỏ ghi đè, và nếu
hàng đó cũng không có hồ sơ TEa PXN thì xoá luôn hàng để bảng quay về đúng
mặc định thay vì giữ một hàng rỗng), cột "TEa chuẩn hóa" thành `.tea-lab-cell`
có giá trị PXN + nút "Thêm hồ sơ"/"Xem hồ sơ", và cột trạng thái 3 mức
**Mặc định / Đã sửa / TEa PXN** kèm nút "Khôi phục" — copy nguyên nhãn
`TEA_STATUS` app cũ. Tên hiển thị cũng theo đúng quy tắc app cũ: chỉ ghép
viết tắt khi nó KHÁC tên (bỏ khác biệt hoa/thường) — "Sodium (Na)" nhưng chỉ
"Urea", "pH", "D-dimer".

**Tab Lịch sử dữ liệu bị thiết kế lại thay vì port.** app cũ dùng LẠI khung
của bảng Mean/SD (`panel target-matrix-panel` + `.target-selector
.history-selector` + 2 bộ đếm `.target-lot-info`) và bảng 10 cột, trong đó bộ
đếm thứ hai là **số ĐIỂM QC đã nhập** và cột "Điểm QC" là **SỐ ĐẾM** (nút
"Chi tiết" ở cột riêng). app-v2 có khung riêng, bộ đếm thứ hai là "mức QC
đang theo dõi", cột "Nguồn" hiện Hiện tại/Lịch sử thay vì PXN/NSX, và cột
"Điểm QC" chứa NÚT — nên không còn chỗ nào cho số điểm. Viết lại theo app cũ,
thêm modal "Chi tiết" (Mean/SD/dải/nguồn/hiệu lực + bảng điểm QC của đúng
mức/lô, Z tính theo `qc_mean`/`qc_sd` đã chốt tại thời điểm nhập). Giới hạn
dưới/trên in ĐÚNG cột `low`/`high` đã lưu, để trống thì "—" — KHÔNG suy từ
Mean ± k·SD như app-v2 đang làm, vì đó là dải hiển thị chứ không phải giới
hạn đã phê duyệt.

**Lệch CẤU TRÚC chung cho 6/8 tab, gate không thể thấy.** Đo
`getBoundingClientRect()` cho thấy mọi bảng của app-v2 lệch 16px so với
golden master. Dump cây DOM 2 bên mới rõ: app cũ đặt `.rcfg-toolbar` là **con
TRỰC TIẾP của `.config-shell-main`** (dải header full-width), rồi
`.panel.rcfg-list` (margin 14/16/18) bọc ĐÚNG cái bảng; app-v2 gói cả toolbar
vào trong panel và đặt margin lên chính cái BẢNG. Sửa cấu trúc cho cả 6 tab
(máy/xét nghiệm/Panel/Mean-SD/chuyển tiếp/lịch sử/TEa) + bỏ wrapper
`.lot-config-page` mà app cũ không có. Kèm theo:
- `.config-shell-main>.panel{border:0;background:transparent}` — rule này gỡ
  hết viền/nền panel (đúng khi toolbar còn nằm trong panel, sai sau khi tách);
  app cũ panel CÓ viền 1px + bo 7px + nền trắng (đo được: panel 874px, bảng
  bên trong 872px).
- `.rcfg-toolbar` được style theo `:first-child` (di sản thời toolbar ở trong
  panel) → đổi sang chọn theo cha như app cũ.
- **Một `.config-shell-main>.panel>` treo lơ lửng** (dòng selector còn sót từ
  một lần sửa trước, comment ngay dưới nói phần khai báo "đã chuyển sang
  app.css") đang dính vào rule `.rcfg-toolbar{display:flex…}` ngay sau nó,
  biến rule DÙNG CHUNG thành rule chỉ áp trong panel. Đã xoá.
- `.target-table` bị style như `<table>` kèm `!important` (di sản bản thí
  điểm dùng `<table>` thật) — app cũ nó là **lưới 7 cột**
  (`.target-head`/`.target-row` grid `54px minmax(280px,1.7fr) repeat(4,…)
  minmax(130px,.8fr)`). Port nguyên khối.
- Thiếu 5 rule bố cục mà app-v2 mới port MỘT PHẦN nên gate `css-parity` coi
  là đủ: `.lot-assay-name{display:grid}`, `.modal-f` (app-v2 đổi tên thành
  `.modal-box-footer` cho modal, nhưng bảng Mean/SD vẫn dùng tên cũ),
  `.target-actions`, `.target-matrix-panel .target-lot-info`,
  `.tea-ref-table input.tea-ref-value{height:34px}` (thiếu rule này thì mỗi
  hàng TEa cao thêm ~13px → bảng 77 hàng dài hơn golden master hơn 1.000px).
- `table{line-height:1.45}` của app cũ bị bỏ, nên mọi ô bảng toàn app cao hơn
  ~1px/dòng theo `body{line-height:1.5}`.
- `.manage-actions{flex-wrap:wrap}` làm 2 nút Sửa/Xóa xuống 2 dòng (hàng cao
  90px thay vì 60px) — app cũ là `nowrap`.
- Badge sidebar: app cũ để TRỐNG khi số đếm = 0 (`count: counts[id] || ''`),
  app-v2 in "0"; và app-v2 thiếu hẳn số đếm cho tab Lịch sử dữ liệu, còn số
  đếm tab TEa thì cộng trùng hồ sơ ghi đè lên analyte đã có trong danh mục.

**Bài học quy trình mới, đáng ghi**: một lần `str.replace()` trong script sửa
CSS đã khớp một chuỗi là **PHẦN của selector dài hơn**
(`.config-shell-main>.panel>.rcfg-toolbar:first-child`), nên comment tôi chèn
rơi vào giữa selector và làm hỏng rule. `assert t.count(a)==1` KHÔNG bắt được
vì chuỗi đó thật sự chỉ xuất hiện 1 lần — điều kiện cần là kiểm cả **ranh
giới** (ký tự trước/sau), hoặc sửa CSS thì luôn build lại + đo lại ngay, đừng
tin số lần khớp.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` **33/33**,
`app-v2:build` sạch, `app-v2:ui-parity` **72/72 surface đạt**,
`app-v2:css-parity` **0** (gate này bắt đúng 2 class mới của modal "Chi tiết"
lịch sử — `history-detail-table`/`rcfg-history-detail-modal` — chứng minh nó
hoạt động cho code vừa viết, không chỉ cho code cũ), cộng công cụ đo riêng
theo tab: **8/8 tab đạt 0 class / 0 dòng chữ lệch**; phần còn lại chỉ là lệch
CHIỀU CAO vài px (ô bảng/thẻ nhóm lô) và 1-2 class phụ của app-v2
(`tea-toolbar`, `target-config-selector`) không có ở app cũ.

**Gợi ý TEa khi thêm xét nghiệm + 2 khối chưa nối trong cùng modal
(2026-09-03).** Người dùng phát hiện: app cũ gõ tên xét nghiệm là TỰ ĐIỀN đơn
vị và TEa từ bảng TEa tham chiếu, app-v2 không có. Rà lại modal "Thêm/Sửa xét
nghiệm" thì có tới **3 khối không nối vào nghiệp vụ**, trong đó 2 khối chính
code app-v2 đã tự ghi chú là "để duyệt giao diện":
- **Gợi ý TEa (đã làm)**: `renderer/lib/tea-suggest.ts` port
  `configAssayFindRef`/`configAssaySuggestionInput` + `effectiveTeaRefs()` app
  cũ — `<datalist>` 77 analyte (sắp theo nhóm rồi tên, nhãn phụ là "viết tắt ·
  nhóm"), gõ khớp tên/viết tắt/tên-kèm-viết-tắt (so khớp TUYỆT ĐỐI sau khi bỏ
  dấu + hạ chữ thường, không so khớp một phần — tránh gõ "Na" nhảy sang analyte
  khác) thì tự điền tên chuẩn hoá, đơn vị, TEa% và 2 trường nguồn
  `teaSource`/`teaRefKey`. Thứ tự TEa copy nguyên app cũ: **CLIA% trước, Ricos%
  sau**, KHÔNG lấy giá trị TEa PXN (`lab`). Ghi đè của phòng xét nghiệm trong
  bảng `tea_refs` được phủ lên danh mục trước khi gợi ý, đúng
  `effectiveTeaRefs()`. Cố ý KHÔNG tự điền Khoa/Khu vực — app cũ cũng loại
  trường đó ra vì khoa lấy theo máy xét nghiệm đang chọn.
  `submit()` trước đây LUÔN gửi `teaSource`/`teaRefKey` lấy lại từ bản ghi cũ
  (rỗng khi thêm mới) — giờ đọc từ 2 input hidden trong form.
- **Khối CUSUM (đã làm)**: 3 ô `cusumOn`/`cusumK`/`cusumH` có `name` nhưng
  `submit()` lấy lại giá trị của bản ghi cũ, nên bật/tắt CUSUM hay đổi k/h
  KHÔNG có tác dụng gì. Đọc thẳng từ form.
- **Bảng luật Westgard nâng cao (CỐ Ý CHƯA NỐI, ghi rõ ngay tại chỗ)**: 26
  `<select>` hành động/phạm vi. Phần "Phạm vi" nối được (`config:saveRuleScope`,
  lưu thật và từ 2026-09-06 engine đã thực thi khác nhau giữa within/across/
  both). Phần "Hành động" thì KHÔNG: `config:saveTest` không ghi
  `rule_actions_json`, còn IPC duy nhất ghi cột đó (`westgard:saveRuleAction`)
  chỉ nhận BẬT/TẮT dạng boolean — không phân biệt "Cảnh báo" với "Loại bỏ" như
  app cũ (engine app-v2 lấy mức độ từ chính `WG_RULE_REGISTRY`). Ánh xạ 3 giá
  trị về 2 sẽ khiến người dùng chọn "Cảnh báo" mà nhận "Loại bỏ" — sai lệch
  NGHIỆP VỤ LÂM SÀNG, nên để nguyên và ghi chú, chờ engine hỗ trợ mức độ theo
  từng luật.

Verify: `app-v2:typecheck`/`build` sạch, `app-v2:test` 33/33,
`app-v2:ui-parity` 72/72, `app-v2:css-parity` 0, cộng kịch bản Playwright tạm
chạy CẢ HAI bản trên cùng bộ seed và đối chiếu từng giá trị: gõ "Sodium" →
app-v2 ra `Sodium (Na)` / `mmol/L` / TEa `0.73` / nguồn `ricos` / khoá
`qclab-sodium`, **khớp từng ký tự với app cũ**; gõ viết tắt "GLU" ra
`Glucose (GLU)` / `mmol/L` / `8` / `clia`; gõ tên tự đặt thì 2 trường nguồn
được xoá về rỗng (đúng nhánh `if (!ref)` của bản cũ); `<datalist>` đủ 77 mục
ở cả 2 bản — zero console error.

**3 chỗ tự-động-điền còn thiếu ở trang Cấu hình chung + lỗi tab mức Mean/SD
(2026-09-03).** Người dùng dùng thật và báo 3 chỗ liên tiếp, cả 3 đều là
"app cũ CÓ, app-v2 không" — cùng một lớp lỗi với gợi ý TEa ở mục trên:
- **Chọn máy xét nghiệm → không điền Khoa/Khu vực.** Ô chọn máy của app-v2
  không có `onChange` lẫn `data-section` trên `<option>`. Port
  `configAssayInstrumentChanged()` app cũ: đọc `data-section` của option đang
  chọn rồi GHI ĐÈ ô Khoa, kể cả khi máy không có khoa thì xoá trống (không
  giữ lại khoa của máy chọn trước). Nhãn option cũng thêm `· model` như app
  cũ (`i.name + (i.model ? ' · ' + i.model : '')`). CỐ Ý KHÁC app cũ đúng 1
  điểm: app-v2 có option rỗng "Chọn máy" nên KHÔNG pre-fill Khoa theo máy đầu
  tiên lúc mở modal (app cũ không có option rỗng nên máy đầu tiên chính là
  máy đang chọn, pre-fill mới hợp lý) — pre-fill trong app-v2 sẽ hiện khoa
  của một máy chưa được chọn.
- **Tick lô trong modal "Thêm nhóm lô QC" → không điền Tên nhóm lô.** app-v2
  chỉ có placeholder "Tự động: …" nhưng không có hàm nào ghi. Port
  `suggestConfigGroupName()`: mỗi lần tick/bỏ tick, tên nhóm = các số lô đang
  chọn nối bằng "/" (`1101` → `1101/1102` → bỏ tick lô đầu còn `1102`), ghi
  THẲNG DOM vì ô tên để uncontrolled, và GHI ĐÈ cả khi người dùng đã tự gõ —
  đúng hành vi bản cũ.
- **Nhóm lô 2 mức nhưng bảng Mean/SD chỉ hiện "Mức 1".** Đây là lỗi NGHIỆP VỤ
  nặng nhất trong 3 mục: app-v2 lấy danh sách mức từ những mức ĐÃ TỒN TẠI
  trong `test_levels`, mà `config:saveTest` chỉ tạo sẵn Mức 1 cho xét nghiệm
  mới — nên không có đường nào nhập Mean/SD cho Mức 2 (bẫy con-gà-quả-trứng:
  muốn có tab Mức 2 thì phải có sẵn dữ liệu Mức 2). App cũ lấy từ CHÍNH các
  lô của nhóm lô đang chọn (`targetLevelSelection(groupLots, …)`), vì nhóm lô
  mới là thứ định nghĩa mức nào tồn tại. Sửa theo app cũ, cộng `useEffect`
  tự rơi về mức đầu tiên khi mức đang chọn không còn hợp lệ (vd đổi sang
  nhóm lô chỉ có Mức 2) — cũng đúng hành vi `targetLevelSelection()`.

Verify: `app-v2:typecheck`/`build` sạch, `app-v2:test` 33/33,
`app-v2:ui-parity` 72/72, `app-v2:css-parity` 0, cộng 2 kịch bản Playwright
tạm: (a) đối chiếu với app cũ trên cùng bộ seed — chọn máy có khoa "Sinh hoa
mien dich" thì cả 2 bản đều điền đúng khoa đó, bỏ chọn máy thì cả 2 đều xoá
trống; (b) chạy liền 3 kịch bản trên app-v2 — Khoa `""` → `"Sinh hoa mien
dich"` → `""`; tên nhóm lô `1101` → `1101/1102` → `1102`; tab mức hiện đủ
`["Mức 1","Mức 2"]`, bấm Mức 2 thì nhãn lô đổi `1101` → `1102` và bảng vẫn
render đúng 1 hàng xét nghiệm — zero console error.

**Dev server xem trước bind thiếu IPv4 (2026-09-03).** `npm run app-v2:dev`
mặc định chỉ lắng nghe `[::1]`, nên trình duyệt nào phân giải `localhost`
thành `127.0.0.1` sẽ báo không kết nối được (đo được: `curl localhost:5174`
trả 200 nhưng `curl 127.0.0.1:5174` lỗi kết nối). Thêm `server.host = true`
vào `vite.app-v2-renderer.config.mjs` để lắng nghe cả IPv4 lẫn IPv6 — đây là
server xem trước chỉ chạy khi gọi tay, dữ liệu là bản giả lập trong
localStorage, không phải server sản phẩm.

**Gate thứ ba: `app-v2:style-parity` — so COMPUTED STYLE, không chỉ class
(2026-09-03).** Người dùng mở tab Mean/SD và nói "bảng biểu, ô chữ, màu sắc
vẫn chưa giống" trong khi CẢ HAI gate đang có đều xanh. Cả hai đều đúng:
`ui-parity` đo TẬP class + DÒNG CHỮ, `css-parity` đo "class app cũ style thật
thì app-v2 có rule hay không" — **không cái nào so GIÁ TRỊ của rule**. Lượt đo
đầu tiên trên tab Mean/SD ra **25 selector lệch**, trong đó có 4 lệch HỆ THỐNG
ảnh hưởng mọi trang:
- **`button,input,select,textarea{font:inherit}` trong `tokens.css` của app-v2
  — app cũ KHÔNG có reset này.** App cũ đặt cỡ chữ TƯỜNG MINH cho
  `input/select/textarea/button.btn/td/.alert…` (`--type-body` 13.5px) và để
  `font-weight` theo mặc định trình duyệt. Vì `font:inherit`, mọi ô nhập nằm
  trong một khối chữ đậm (toolbar `font-weight:800`) bị **in đậm theo** và lệch
  cỡ. `color:inherit` cũng bị bỏ: nó làm checkbox thừa hưởng màu chữ của hàng
  thay vì màu mặc định.
- **Thiếu `th,td{line-height:1.4}`** (app cũ đặt riêng, thấp hơn
  `table{line-height:1.45}`): mọi ô bảng cao lệch ~1px/dòng, và vì `.tag`/
  `.pill` không tự khai line-height nên **mọi huy hiệu trong bảng** cũng lệch.
- **Thiếu `td .hint{margin-top:2px}`**: mọi hàng bảng có dòng phụ (tên + khoa,
  tên + phương pháp…) thấp hơn golden master đúng 2px.
- **`.field label{margin:0}`** (app-v2 tự thêm) xoá khoảng hở 4px giữa nhãn và
  ô nhập trên mọi form; app cũ giữ `label{margin:8px 0 4px}` rồi từng dải bộ
  lọc mới bỏ riêng margin-top.

Các lệch riêng của trang Cấu hình chung, đều là "bản port tự thêm/tự bớt":
hàng tiêu đề bảng Mean/SD bị tô nền + chữ của dải header panel (app cũ:
nền `#f7fafb`, chữ `--muted`, cỡ `--table-head-size`); `.dayseg` được dựng
lại thành nút teal có viền + bo góc + cao 34px thay vì kiểu segmented nền
`#1c3442` không viền của app cũ (và `height:34px` bị đặt ở rule DÙNG CHUNG,
trong khi app cũ chỉ đặt cho `.lj-toolbar .dayseg button`); `.target-selector`
mất nền + viền dưới + `label{margin-top:0}` + ô cao 36px; `.target-summary`
lệch padding/margin và cỡ chữ số đếm; huy hiệu trạng thái không được canh
giữa ô (`.target-row .tag{margin:… auto}`); `.audit-filterbar` mới port 2/9
rule (thiếu chính phần flex + margin dải bộ lọc); hàng tiêu đề 8 bảng của
trang thiếu `height:42px`/`letter-spacing:.03em`; và **app cũ canh GIỮA mọi ô**
của các bảng đó (chỉ chừa vài cột canh trái) trong khi app-v2 canh trái.
Cột "STT" của bảng Danh mục xét nghiệm cũng phải là ô `.num` như app cũ.

Sau khi sửa: tab Mean/SD **0 selector lệch**, các trang khác từ 7–9 xuống 1–6
(phần còn lại là khác biệt DOM/nội dung — app cũ có khối mà app-v2 chưa có
hoặc ngược lại, ví dụ `.hint` đầu tiên của app cũ là dòng "Ver: 2.7.6" ở chân
sidebar mà app-v2 không có).

**`app-v2/scripts/style-parity-check.cjs`** (npm `app-v2:style-parity`) đóng
lớp này lại: mở cùng bộ seed trên 2 bản, với 19 selector dùng chung (bảng/ô
nhập/nhãn/huy hiệu/nút/panel/alert/dayseg) so 16 thuộc tính computed
(màu chữ/nền, viền, bo góc, cỡ + độ đậm chữ, line-height, padding,
text-transform, letter-spacing, canh lề) trên **18 surface** (11 trang + 8 tab
Cấu hình chung), rồi ratchet theo `app-v2/tests/style-parity-baseline.json`
như `ui-parity`. Đã chứng minh nó BẮT được lỗi: đổi tạm
`th,td{line-height:1.4}` thành `1.9` → FAIL đúng 6 surface vượt baseline kèm
exit 1; phục hồi thì 18/18 đạt. GIỚI HẠN ghi trong file: chỉ đo phần tử ĐẦU
TIÊN khớp mỗi selector, chỉ các selector trong danh sách, và không thay
pixel-diff (D0 mục 5 vẫn để sau).

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 33/33, `app-v2:build`
sạch, `app-v2:ui-parity` 72/72 (2 thay đổi CSS TOÀN CỤC không làm surface nào
vượt baseline), `app-v2:css-parity` 0, `app-v2:style-parity` 18/18.

**Ô chọn ngày mở lịch NATIVE thay vì ô gõ dd/mm/yyyy — 2 lỗi CSS chồng nhau
(2026-09-03).** Người dùng mở modal "Thêm lô QC" và nói ô ngày "vẫn dùng mặc
định của Windows". Component `DateField` (viết lại ở D3.2) đúng DOM app cũ
rồi, lỗi nằm ở CSS và đo được ngay:
- **`<input type="date">` ẩn biến thành LỚP PHỦ TRONG SUỐT che kín ô.** CSS
  khai `.native-date{position:absolute;width:1px;height:1px;opacity:0;
  pointer-events:none}` nhưng đo ra **324×38**: rule nền
  `input:not([type="checkbox"]):not([type="radio"])` có specificity (0,2,1) —
  hai `:not([type=…])` tính như 2 attribute selector — **thắng `.native-date`
  trần (0,1,0)** và áp lại `width:100%;min-height:38px`. Hệ quả: bấm vào bất
  kỳ đâu trên ô ngày đều rơi vào input native → Chromium mở lịch của nó.
  App cũ không gặp vì nó dùng `display:none` (thuộc tính mà rule nền không
  đặt) — app-v2 KHÔNG dùng được `display:none` vì còn phải gọi `showPicker()`
  trên chính ô đó. Sửa bằng cách nâng selector thành
  `.datebox input.native-date` (0,2,1, khai SAU) — đo lại ra 1×1.
- **`.field` của app-v2 blockify mọi thứ bên trong.** App cũ KHÔNG có class
  `.field` (chỉ `.field-error`): mỗi ô là một `<div>` thường, nhãn block với
  margin `8px 0 4px`, ô nhập `width:100%`. app-v2 tự tạo
  `.field{display:flex;flex-direction:column;gap:4px}` — và theo CSS, con
  `inline-flex` của một flex container bị **blockify thành `flex`** rồi giãn
  hết chiều ngang: `.datebox` đo ra `flex`/326px thay vì `inline-flex`/164px
  như app cũ. Sửa: `.field{display:block}` + bỏ `.field label{margin-top:0}`
  để nhãn giữ margin tự nhiên (chính margin-top 8px này tạo nhịp dọc giữa các
  ô, thay cho `gap`/`margin-bottom` mà app cũ không có). Đây là thay đổi TOÀN
  CỤC (~90 chỗ dùng `.field`), verify bằng cả 5 gate.
- Cộng 2 chi tiết nhỏ: bỏ `min-height:0` để ô văn bản dùng lại `min-height:38px`
  của rule nền (app cũ đo được 38px → `.datebox` cao 40px), và nhãn 3 ô ngày
  ghi kèm định dạng như app cũ ("Ngày mở (dd/mm/yyyy)", "Hạn sử dụng
  (dd/mm/yyyy)", "Ngày bắt đầu (dd/mm/yyyy)").

Kết quả đo: `.datebox` **164×40, inline-flex — khớp từng số với app cũ**, ảnh
chụp 2 modal cạnh nhau gần như trùng khớp.

**Điểm mù mới phát hiện: `app-v2:ui-parity` KHÔNG đo modal.** Gate chỉ chụp
trang ở TRẠNG THÁI MẶC ĐỊNH, nên mọi lệch bên trong ~20 modal của app-v2 (kể
cả nhãn thiếu "(dd/mm/yyyy)" ở trên) đều không có gì canh giữ. Cùng loại với
bài học "gate chỉ đo 1/8 tab" ở D3.4 — **đã sửa cùng ngày, xem mục ngay
dưới**.

Verify: `app-v2:typecheck` sạch, `app-v2:test` 33/33, `app-v2:build` sạch,
`app-v2:ui-parity` 72/72, `app-v2:css-parity` 0, `app-v2:style-parity` 18/18.

**Lịch chọn ngày tự vẽ + parity MODAL (2026-09-03).** Người dùng mở modal
"Thêm lô QC" và hỏi "Datepicker app cũ của tôi đâu" — ảnh chụp cho thấy lịch
NATIVE của Chromium (tháng tiếng Anh "September 2026", cột Su/Mo/Tu, nút
Clear/Today). Đúng: Giai đoạn A1/D3.2 cố ý KHÔNG port lịch tự vẽ, nút
`.datepick` gọi `showPicker()` của `<input type="date">` ẩn, với lý do "giống
LUỒNG thao tác, không cần giống cách vẽ". Lý do đó SAI với mục tiêu đã chốt
(giống app cũ 100%) vì đây là khác biệt nhìn thấy ngay, không phải chi tiết
nội bộ — port hẳn.

- `renderer/state/date-picker-store.ts` + `components/DatePickerPopup.tsx`
  (port từ `src/react/state/date-picker-store.ts`/`DatePickerPopup.tsx`),
  mount 1 lần trong `AppShell`, portal vào `#datePickerRoot` mới thêm vào
  `index.html`. CSS `.vn-date-*` port nguyên từ `assets/professional-base.css`
  (11 token nó dùng đều đã có sẵn). `z-index:1400` nên nổi trên cả modal
  (900) và dialog (1100). `.native-date` quay lại `display:none` đúng app cũ
  (chỉ còn là chỗ chứa ISO cho FormData) vì không cần `showPicker()` nữa.
- **2 bẫy port nguyên vẹn từ app cũ, không được "đơn giản hoá"**: click ra
  ngoài dùng `event.composedPath()` chứ KHÔNG phải `target.closest()` — một
  click bên trong popup có thể tự đổi mode (chọn tháng) khiến React render
  lại và GỠ nút vừa bấm khỏi DOM trong lúc sự kiện còn nổi bọt, lúc đó
  `.closest()` luôn trả null và popup tự đóng giữa thao tác; `.vn-year-row
  input` phải thêm `min-height:0` (KHÁC app cũ) vì app-v2 có rule nền
  `input…{min-height:38px}` sẽ đè `height:32px`.
- Verify: đối chiếu song song 2 bản trên cùng bộ seed — tiêu đề "Tháng 9
  2026", 7 cột T2..CN, 31 ô, ô "today"=3, footer "Hôm nay"/"Đóng", 258×288px,
  z-index 1400, bo 9px — KHỚP TỪNG GIÁ TRỊ; chọn ngày 15 ghi đúng
  "15/09/2026" vào ô văn bản và "2026-09-15" vào ô ẩn; chế độ tháng/năm hiện
  đủ 12 tháng + đúng năm; Escape đóng; zero console error. Còn 1 chỗ dùng
  `<input type="date">` trần (3 ô ngày của modal hồ sơ TEa) — đã đổi sang
  `<DateField>`.

**Phát hiện LỚN HƠN cả lịch, từ chính việc đo tay bên trong modal đó: KHÔNG
một class modal nào của app cũ tồn tại ở app-v2, mà cả 3 gate đều xanh.**
app-v2 tự đặt `.overlay-backdrop`/`.modal-box`/`.modal-box-header`/`-body`/
`-footer`/`.modal-close-btn`; app cũ là `.modal-bg`/`.modal`/`.modal-h`/
`.modal-b`/`.modal-f`/`.modal-close`. Giá trị CSS đã copy đúng từ A1, nhưng
TÊN khác làm app-v2 mất sạch mọi rule app cũ scope theo tên đó:
`.modal-b>label:first-child{margin-top:0}`, `.modal-h h3`,
`.rcfg-modal input[type=checkbox]{accent-color}` + focus-visible,
`.rcfg-group-modal.levels-2/3plus` (bề rộng + số cột lưới chọn lô theo SỐ
MỨC), và breakpoint 760px biến modal thành sheet dán đáy
(`.modal{width:100%;border-radius:12px 12px 0 0}`). Đổi hết về tên app cũ,
đồng thời `.modal` lấy lại `width:560px` mặc định và mỗi modal Cấu hình chung
dùng đúng class app cũ (`.rcfg-modal` 700px, `.rcfg-assay-modal`,
`.lot-trans-modal`, `.rcfg-group-modal.levels-N`, `.tea-lab-profile-modal`)
thay vì `width={...}` truyền tay.

**`app-v2:ui-parity` giờ ĐO ĐƯỢC BÊN TRONG MODAL** — điểm mù đã ghi ở mục
trước, nay đóng: manifest cho khai `modals: [{id, tabIndex, trigger,
requiredSelectors}]`, gate bấm tab rồi bấm nút mở ở CẢ HAI bản, đo với scope
`.modal` (không phải `#main`), so tiêu đề `.modal-h h3` từng ký tự, chụp ảnh
riêng, ratchet như mọi surface khác. Đo ở ĐÚNG MỘT viewport (desktop) —
nhân 4 viewport chỉ làm gate chậm mà lệch cần tìm nằm ở DOM/nội dung. Trước
khi mở modal, gate bấm Escape tới khi `.modal-bg` biến mất: `go(id)` của app
cũ KHÔNG đóng modal đang mở nên `.modal-bg` chặn mọi click của lượt sau.
Trigger phải TỒN TẠI Ở CẢ HAI BẢN — dò trước bằng script tạm cho cả 7 modal
Cấu hình chung (đúng bài học D3.5: selector bịa trong manifest làm gate vô
nghĩa), và chính bước dò đó đã lộ ngay 3 lệch: tên class modal, tiêu đề "Thêm
nhóm lô QC" vs "Thêm nhóm lô", và một nút mở SAI MODAL (dưới).

**Kết quả: 6/7 modal về 0 class / 0 dòng chữ**, gate lên 79 surface. Các lệch
tìm được và đã sửa:
- **"Hủy" vs "Huỷ"** — app cũ dùng "Hủy" ở MỌI nút; app-v2 dùng "Huỷ" ở 28
  chỗ (8 trang + DialogHost). Sửa toàn cục, kèm 2 nhãn AUDIT ở main
  (`'Huỷ điểm QC'`→`'Hủy điểm QC'`, `'Huỷ hồ sơ NCE'`→`'Hủy hồ sơ NCE'` —
  đối chiếu app cũ dùng "Hủy điểm QC"/"Hủy hồ sơ"); `mock-parity` bắt được
  ngay khi mock lệch main, đúng như thiết kế của nó.
- **`text-transform:uppercase` không chỉ làm lệch HÌNH**: `innerText` của
  Chromium trả về CHỮ ĐÃ BIẾN ĐỔI, nên `.lot-level-title` (app-v2 tự thêm
  uppercase) làm gate báo thiếu dòng "Mức 1"/"Mức 2" trong modal nhóm lô.
  Port nguyên rule app cũ (`text-transform:none`, `#48646e`, overline, 850).
- **Lỗi "app-v2 không tự chọn mục đầu tiên" — LẦN THỨ 5** (sau Entry, Sigma,
  Westgard, Reagent): modal Panel QC để `instrumentId=''` + một option rỗng
  "Chọn máy", nên danh sách xét nghiệm trống hẳn; app cũ tự chọn máy đầu
  tiên. Bỏ option rỗng, mặc định chọn `instruments[0]`. Modal xét nghiệm
  cũng bỏ option rỗng tương tự.
- **Cấu trúc lưới form**: app cũ dùng `.grid2` dùng chung (gap 10px, 1 cột ở
  ≤760px) cho mọi hàng 2 ô trong modal — app-v2 tự đặt `.field-row`/
  `.lot-form-grid`/`.panel-qc-main-grid`/`.transition-form-row2|3`, và MỘT
  lưới 6 ô thay vì BA khối `.grid2` liền nhau. Đổi hết về `.grid2` +
  `.lot-trans-row2/3`; modal xét nghiệm tách lại 2 lưới `.assay-main-grid` +
  `.assay-detail-grid` như app cũ, tiêu đề khối là `.assay-form-heading > h4`
  (không phải `.assay-form-section > b`), select luật mang class
  `.cfg-assay-rule`/`.cfg-assay-scope`.
- **`<form>` bọc thân modal làm lệch TOÀN BỘ nội dung 8px**: 3 nhánh
  `.modal-b>label:first-child` / `>:first-child>label:first-child` /
  `>:first-child>div>label:first-child` của app cũ (bỏ margin nhãn đầu tiên)
  không khớp vì app-v2 chèn thêm một cấp `<form>` (để submit bằng Enter và
  nút `type="submit" form="..."`). Lặp lại đúng 3 nhánh đó qua một cấp
  `form`. Và ô "Ghi chú" cuối modal lô QC phải là `<label>`+`<textarea>`
  TRỰC TIẾP như app cũ, không bọc `.field` — bọc lại làm margin nhãn collapse
  khác đi và modal thấp hơn 8px.
- Kết quả đo cuối cho modal "Thêm lô QC": **khớp từng pixel** — modal
  700×432, 3 khối `.grid2` cao 59.3/67.3/69.3, nhãn+textarea ghi chú
  17.3(m 8/0/4)+54, nhãn "Số lô" y=357 — TRÙNG KHỚP app cũ ở mọi con số.

**1 nghiệp vụ THẬT còn thiếu, phát hiện nhờ bước dò trigger: nút "＋ Thêm xét
nghiệm" ở tab Bảng TEa mở SAI MODAL.** App cũ mở "Thêm xét nghiệm tham
chiếu" — thêm một DÒNG analyte mới vào danh mục (tên quốc tế/viết tắt/matrix/
đơn vị/nhóm/CLIA%/Ricos%); app-v2 mở "Thêm hồ sơ TEa" (hồ sơ TEa CHUẨN HOÁ
của PXN, 6 trường bắt buộc gồm giá trị > 0 và lý do ≥10 ký tự) — hai nghiệp
vụ khác nhau, và app-v2 KHÔNG có đường nào thêm analyte mới. Thêm
`config:addTeaAnalyte` (chỉ admin; CLIA/Ricos để trống vẫn hợp lệ — khác
`saveTeaRef`; khoá analyte suy từ tên theo cùng quy ước `teaAnalyteKey()` app
cũ để hồ sơ PXN và ghi đè CLIA/Ricos khớp nhau; thêm trùng tên bị chặn) —
KHÔNG cần đổi schema, `tea_refs` đã có đủ cột từ đầu. Nối đủ IPC → preload →
`qc-api.d.ts` → bản giả lập trình duyệt → `permission-policy` → store →
modal mới; `mock-parity` mở rộng lên 134 bước (3 case: thiếu tên, thêm đúng,
thêm trùng). Modal hồ sơ TEa cũng đổi về đúng class/tiêu đề app cũ
(`.tea-lab-profile-modal`, "Thêm/Sửa hồ sơ TEa chuẩn hóa").

**Còn lệch, đã ghi vào `surfaceNotes` của baseline chứ không để ngầm**:
`manage:modal-transition` còn 4 dòng chữ, cả 4 là khác biệt MÔ HÌNH có chủ
đích — app cũ cho chọn "Chấp nhận lô mới"/"Không chấp nhận" ngay khi tạo hồ
sơ, app-v2 chốt vòng planned→active→concluded MỘT CHIỀU (quyết định Giai
đoạn B1) và `createLotTransition` luôn ghi `'planned'` nên ô trạng thái để
disabled thay vì liệt kê lựa chọn không thực thi được; dòng nhắc của app cũ
hứa "để NHẬP Mean/SD cho lô mới" mà app-v2 chưa nối bảng Mean/SD trong modal
này vào `createLotTransition` (các ô số hiện chỉ để đối chiếu — cần nối hoặc
bỏ, đúng nguyên tắc "không control chết"); nhãn Panel QC của app-v2 chưa ghép
tên máy. **15 modal còn lại của app-v2 (Sigma/NCE/Người dùng/Nhật ký/Cài
đặt/Hoá chất/Entry) CHƯA khai vào manifest** — cơ chế đã có, chỉ là chưa dò
trigger cho từng cái; đó là việc lặp lại, không phải thiếu kiến trúc.

Verify: `app-v2:typecheck` sạch, `app-v2:test` 33/33 (`mock-parity` 134 bước,
sửa 1 nhãn audit trong `entry-handlers.test.mjs` theo chính tả app cũ),
`app-v2:build` sạch, `app-v2:ui-parity` **79/79 surface đạt** (thêm 7 surface
modal, 6 ở 0/0), `app-v2:css-parity` 0 (gate này bắt được đúng class `.req`
mới thêm của modal "Thêm xét nghiệm tham chiếu" — chứng minh nó canh cả code
vừa viết), `app-v2:style-parity` 18/18, cộng 2 công cụ đo tạm (không commit):
đối chiếu popup lịch 2 bản, và đo `getBoundingClientRect()` + computed style
từng khối bên trong modal.

**Rà soát nghiệp vụ + chất lượng mã trang Cấu hình chung (2026-09-03).** Người
dùng hỏi "nghiệp vụ đã thêm vào hết chưa, code có sạch không". Rà bằng cách
liệt kê toàn bộ hàm export của `manage-page-controller.ts` +
`manage-tests-actions-controller.ts` app cũ rồi đối chiếu từng thao tác GHI với
IPC/store/UI của app-v2 — không đọc theo cảm nhận. Kết quả: **4 nghiệp vụ
thiếu + 5 control chết**, đã làm hết.

**(1) Đổi số lô KHÔNG ghi lại nhãn lô trên điểm QC cũ — lỗi làm SAI DỮ LIỆU
âm thầm, chưa từng được ghi chú.** `qc_points.lot` là CHUỖI TĨNH chụp lúc nhập
(Giai đoạn B2), không tham chiếu `qc_lots.id`; `saveLot` của app-v2 chỉ UPDATE
bảng `qc_lots`, nên sau khi đổi số lô thì mọi điểm QC cũ "biến mất" khỏi bộ lọc
theo lô ở Nhập QC/Westgard/Sigma: không khớp lô hiện tại (chuỗi đã đổi) mà cũng
không hiện ở "lô cũ" (không có hồ sơ chuyển tiếp nào giữa 2 TÊN GỌI của cùng
một lô). App cũ cascade qua `renameLotPoints()`. Đã thêm:
`config:previewLotRename` (hàm CHỈ ĐẾM — số điểm sẽ bị viết lại + kỳ đã khoá,
không ghi gì) và cascade trong `saveLot` **cùng một transaction** với việc sửa
cấu hình (nửa vời — đổi cấu hình mà không đổi điểm — là trạng thái không thể tự
phục hồi). Renderer hỏi TRƯỚC khi gọi `saveLot` bằng chính con số đó, đúng cách
`saveConfigLot()` app cũ hỏi: bấm Hủy là không còn dấu vết gì. Kỳ đã khoá KHÔNG
chặn (khác xoá xét nghiệm) vì số lô là nhãn nhận dạng, nhưng được đếm riêng và
nói rõ trong hộp xác nhận.

**(2) Kích hoạt nhóm lô — app-v2 chỉ có `stopLotGroup` (một chiều).** Nhóm đã
dừng không có đường bật lại, và nhóm mới không có đường áp Mean/SD sang các mức
QC. Thêm `config:activateLotGroup`, port `activateLotGroup` +
`applyLotGroupActivation` app cũ: ứng viên là mọi (mức QC, lô của nhóm) trùng
`level` mà mức đang dùng lô KHÁC và có **Mean/SD ĐÃ LƯU** cho đúng lô đó
(`lotTargetSnapshot()` — port `qcLotTargetSnapshot()`: ưu tiên giá trị đang
gắn, nếu không thì tìm NGƯỢC trong `mean_sd_history_json` theo `qcLotId`; KHÔNG
suy từ điểm QC, vì kích hoạt phải dùng số đã được phê duyệt). Giữ nguyên 3
trạng thái trả về của app cũ vì mỗi cái cần một thông báo khác: `applied` (áp
N mức + dừng các nhóm bị thay thế), `already-active` (không có gì mới để áp
nhưng nhóm đang được dùng — vẫn gỡ nhãn "đã dừng"), `unready` (chưa mức nào có
Mean/SD hợp lệ, KHÔNG đụng gì). UI đi qua `confirmDialog` + `reauthDialog` như
mọi thao tác Mean/SD khác.

**(3) 5 control CHẾT trong modal "Thêm hồ sơ chuyển lô"** (ô tìm kiếm + 4 ô số
Mean/SD): hiện ra, gõ được, không lưu đi đâu — thứ Giai đoạn D cấm tường minh.
App cũ's `saveLotTransitionV2()` gọi `applyPlannedTarget()` cho từng hàng đang
tick TRƯỚC khi ghi hồ sơ. Nay `submit()` đọc bảng, validate qua
`normalizeTargetPick` (sai định dạng thì DỪNG LẠI, không để tạo hồ sơ xong mới
báo lỗi — hồ sơ đã ghi không tự rút lại được), rồi lưu Mean/SD cho lô mới qua
`saveTestLevel`. Bảng dùng đúng class app cũ (`.lot-trans-target-head-row` +
`.target-table.lot-trans-target-table` dùng LẠI `.target-head`/`.target-row`
của bảng Mean/SD) nên `syncTargetRange` chạy y hệt. `syncTargetRange` được
chuyển từ hàm cục bộ trong TargetsTab sang `renderer/lib/target-range.ts` —
app cũ cũng dùng đúng một hàm cho cả hai chỗ. 3 rule CSS `.transition-target-*`
app-v2 tự đặt trở thành dead code, đã xoá.

**(4) Sửa hồ sơ chuyển lô** — app-v2 chỉ tạo mới được (comment trong code ghi
"chưa có modal sửa, không dựng nút chết"). `createLotTransition` nhận thêm
`input.id` → sửa; hồ sơ ĐÃ KẾT LUẬN không sửa được, cùng lý do không xoá được
(bản ghi đã áp vào cấu hình/Mean-SD, sửa đi thì mất dấu vết vì sao Mean/SD
đổi). `status` KHÔNG đổi qua đường này — vòng planned→active→concluded vẫn đi
riêng qua `setLotTransitionStatus` để mỗi bước giữ cổng xác thực/ghi chú của
nó.

**Dọn code (đo bằng số, không bằng cảm nhận).** Trạng thái tốt sẵn: **0 `any`**,
**0 `style={{...}}`**, chỉ 1 chỗ gọi `window.qcApi` trực tiếp bỏ qua store,
typecheck `strict` sạch. 2 nợ thật đã trả:
- `ManagePage.tsx` **1121 dòng gồm 6 tab** → tách mỗi tab một file trong
  `pages/manage/` (`InstrumentsTab` 87 · `TestsTab` 233 · `PanelsTab` 113 ·
  `LotsTab` 254 · `TargetsTab` 173 · `TransitionsTab` 184), phần dùng chung
  (`TABS`/`TabId`/`WESTGARD_RULES`/`parseRuleConfig`/`lotStatus`/`FieldRow`)
  vào `pages/manage/shared.tsx`; `ManagePage.tsx` còn **100 dòng** đúng vai
  trò khung trang (sidebar 8 tab + toolbar + badge đếm).
- `vnDate()` bị viết lại ở **4 file** với **3 hành vi fallback KHÁC NHAU**
  (`'—'`, chuỗi vào, `''`). Gom về `renderer/lib/format.ts` nhưng GIỮ tham số
  `fallback` để từng chỗ gọi hiện đúng như trước — đổi fallback là đổi hiển
  thị, không phải refactor thuần.

Verify: `app-v2:typecheck` sạch, `app-v2:test` **34/34** (thêm
`tests/config-lot-lifecycle.test.mjs` — end-to-end 3 nghiệp vụ trên: preview
chỉ đếm/không ghi, cascade đổi tên đúng và KHÔNG mất điểm nào, sửa trường khác
không chạm điểm QC, kỳ đã khoá được đếm riêng, `activateLotGroup` đủ 3 trạng
thái + chỉ admin + nhóm rỗng, sửa hồ sơ giữ nguyên id/không đổi trạng thái/hồ
sơ đã kết luận bị chặn và KHÔNG ghi gì; `mock-parity` lên **141 bước** phủ 3
hàm mới), `app-v2:build` sạch, `app-v2:ui-parity` 79/79, `app-v2:css-parity` 0,
`app-v2:style-parity` 18/18, cộng kịch bản Playwright tạm chạy THẬT trong
trình duyệt: đổi số lô qua modal → hộp hỏi hiện đúng "sẽ cập nhật 10 điểm QC
đã ghi" → đồng ý → cả 10 điểm mang nhãn lô mới; dừng nhóm lô → nút "Kích hoạt"
xuất hiện → confirm + reauth thật → thông báo đúng nhánh `already-active` →
trạng thái về `active`; tạo hồ sơ chuyển lô qua UI: bảng Mean/SD render đúng
hàng, gõ Mean=120/SD=4 thì 2 ô giới hạn TỰ đồng bộ 112.00/128.00
(`syncTargetRange` chạy), lưu xong đọc lại `listTestLevels` thấy **mean=120,
sd=4 ghi thật vào mức** (chứng minh 4 ô không còn là control chết), nút "Sửa"
hiện và mở đúng modal "Sửa hồ sơ chuyển lô"/"Lưu thay đổi" — zero console
error.

**3 mục CÒN LẠI của trang này, có lý do kỹ thuật rõ ràng:** (a) nhánh "Dự kiến"
khi lưu Mean/SD sang nhóm lô khác — app cũ mở modal 3 lựa chọn (Hủy / Dự kiến /
Chuyển qua nhóm lô này) qua `openTargetSwitchModal`/`resolveTargetSwitch`;
app-v2 chỉ có Hủy/Chuyển, vì "Dự kiến" cần chỗ lưu Mean/SD ỨNG VIÊN chưa áp mà
schema hiện chưa có (cùng nhóm vấn đề với cột song song 2 lô ở Giai đoạn B2);
(b) ô "Hành động" của bảng luật Westgard nâng cao vẫn chỉ hiển thị — cần engine
hỗ trợ mức độ theo từng luật, đã ghi tại chỗ trong code; (c) danh mục TEa tích
hợp (`TEA_ANALYTE_CATALOG` hàng trăm analyte CLIA/Ricos + `docs/tea-sources.md`)
vẫn là bản rút gọn 77 analyte.

**4 lỗi thật ở trang Cấu hình chung + hộp thoại dùng chung, bắt được qua phản
hồi trực tiếp trên ảnh chụp (2026-09-03).**

**(1) "Ô chồng ô"**: 4 chỗ (`target-empty-card`/`transition-empty-card`/
`history-empty-card`/`tea-empty-card`) tự bọc thêm một lớp panel THỪA quanh
`.empty`, trong khi app cũ (và tab Lô QC/Nhóm lô của chính app-v2) chỉ đặt
`.empty` trực tiếp trong panel — ra 2 khung lồng nhau. Bỏ 4 lớp bọc + 7 rule
CSS chết đi kèm; TeaRefsTab cũng sửa lại để panel LUÔN render (đúng cấu trúc
app cũ: `.empty` thay chỗ `<table>` bên trong CÙNG MỘT panel, không phải hai
nhánh tách biệt có/không có panel).

**(2) `.empty` chạm sát 4 cạnh panel sau khi bỏ lớp bọc.** Nguyên nhân: app-v2
chỉ copy được NỬA SAU của 2 rule app cũ (`margin:0` — vốn dùng để HỦY margin
16px của rule chính khi `.empty` nằm trong `.transition-list`), mà THIẾU HẲN
rule chính cho margin/padding/viền/nền
(`.config-shell-main>.rcfg-list>.empty:first-child, ...`). Vì `.panel`/
`.rcfg-list` đều `padding:0` (Giai đoạn A1), `.empty` không còn gì đệm nên
chạm sát 4 cạnh. Port đủ 3 rule gốc từ `assets/professional-config.css`
(margin 16px, padding 24px 20px, viền `#cbdce4`, nền `--surface-card-soft`,
cỡ tiêu đề riêng trong ngữ cảnh này).

**(3) Tiêu đề cột và nội dung ô không thẳng hàng ở bảng Mean/SD.**
`.target-head>span{text-align:center;}` **vô hiệu**: các span đó đã là flex
container (`display:flex`), mà `text-align` không căn được flex item — chỉ
`justify-content` mới có tác dụng. Tiêu đề vì vậy lệch trái theo mặc định
flex, trong khi ô nhập số lại có padding riêng của input dùng chung
(`var(--space-sm) var(--space-md)`), tạo cảm giác lệch nhau dù cả hai đều
"trái" theo cách khác nhau. Sửa: đổi rule sang `justify-content:center` cho
MỌI cột trừ 2 cột đầu (giữ nguyên 2 override có sẵn: cột 1 "Dùng" canh giữa,
cột 2 "Xét nghiệm" canh trái) — port đúng app cũ; và 4 ô số
(`.target-row input[type=number]`) thêm `width:116px;justify-self:center;
text-align:center` để nội dung ô thật sự nằm giữa cột, không chỉ stretch hết
chiều rộng.

**(4) BUG THẬT, không phải giao diện: đổi Mức 1 → Mức 2 vẫn giữ nguyên số của
Mức 1** (người dùng tự phát hiện khi thao tác thật, không phải từ ảnh chụp).
Nguyên nhân: hàng dữ liệu trong `TargetsTab`/`TransitionsTab` chỉ có
`key={test.id}` — không đổi theo `level`/lô đang xem. Các ô Mean/SD/giới hạn
là **uncontrolled** (`defaultValue`, đọc DOM lúc lưu — cố ý, để 4 ô mất focus
nhanh khi Tab qua không bị ghi đè bởi state cũ, xem `syncTargetRange`). Với
`key` không đổi, React **tái dùng nguyên DOM node** khi đổi mức — với CÙNG
một xét nghiệm xuất hiện ở cả 2 mức, `test.id` không đổi nên React không tạo
lại input, và giá trị cũ vẫn còn nguyên trong DOM dù dữ liệu nền đã đổi. Sửa:
`key={`${test.id}:${level}:${lotId}`}` (TargetsTab) và
`key={`${test.id}:${levelNo}`}` (TransitionsTab, cùng lớp lỗi khi đổi "Lô
mới" trong modal chuyển lô) — buộc remount mỗi khi mức/lô đang xem đổi.

**(5) Hộp thoại confirm/info/reauth dùng khung modal trơn, không phải khung
"Thao tác được kiểm soát" của app cũ.** Người dùng chỉ vào ảnh app cũ và hỏi
sao chưa mang qua. app-v2's `DialogHost.tsx` (viết ở Giai đoạn 3) dùng lại
`.modal-h`/`.modal-b`/`.modal-f` — khung CHUNG với mọi modal CRUD khác —
trong khi app cũ có hẳn một họ class RIÊNG cho 3 loại hộp thoại thay
`confirm()`/`alert()` gốc của trình duyệt: `.confirm-modal` (bo góc 16px,
animation `dialog-enter`), `.confirm-modal-h` + `.confirm-modal-kicker`
(nhãn đỏ IN HOA "THAO TÁC ĐƯỢC KIỂM SOÁT" — CHỈ hộp reauth luôn có, hộp
confirm có kicker tuỳ chọn), `.confirm-modal-icon` (hình tròn, đổi màu theo
mức độ: đỏ cho nguy hiểm, xanh dương cho reauth, vàng/xanh lá cho info
warn/success), `.confirm-modal-text` (câu chính in đậm + chi tiết phụ), và
RIÊNG cho reauth: dòng `<p>Tài khoản: {tên người dùng}</p>` — thứ app-v2
**hoàn toàn không hiển thị**. Viết lại `DialogHost.tsx` theo đúng 3 nhánh cấu
trúc app cũ (`src/react/dialogs/DialogOverlay.tsx`), đọc tên tài khoản qua
`useAuthStore()` (khớp `reauthAccountLabel()` app cũ: `name || username`).
Port nguyên toàn bộ CSS họ `.confirm-modal*` (kể cả breakpoint ≤640px xếp nút
theo cột và info-modal đặt nút đóng góc trên-phải) — tất cả token màu/cỡ chữ
đã có sẵn từ trước, đây thuần là thiếu component, không thiếu design token.

Verify: `app-v2:typecheck` sạch, `app-v2:test` 34/34, `app-v2:build` sạch,
`app-v2:ui-parity` 79/79, `app-v2:css-parity` 0, `app-v2:style-parity` 18/18,
cộng kiểm chứng thật trong trình duyệt cho cả 5 mục: ảnh "Chưa có hồ sơ
chuyển lô" còn đúng 1 khung với khoảng cách đều 4 phía; cột "Độ lệch chuẩn"/
"Trạng thái" tiêu đề và nội dung thẳng hàng; đổi Mức 1→Mức 2 ô Mean/SD về
đúng trạng thái trống ("0 đã gán mức này") thay vì giữ số cũ; và luồng
Dừng→Kích hoạt nhóm lô đi qua đúng 2 hộp thoại — confirm "Kích hoạt nhóm lô"
rồi reauth "Xác thực Mean/SD" hiện đúng kicker đỏ, icon ✓ tròn, dòng
"Tài khoản: Quan tri" — khớp pixel với ảnh app cũ người dùng gửi.

**Ô chọn ngày canh giữa chữ (2026-09-03, theo yêu cầu người dùng).** Người
dùng thấy icon lịch "đơn điệu" và đưa 2 ảnh tham khảo, rồi chỉ sang app khác
của họ ("Quản lý cước phí", `Cost App/src/shared/ui/DateInput/`) để đối
chiếu. Kiểm tra trực tiếp mã nguồn app đó (không đoán): `.datepick` của họ
dùng ĐÚNG token `--surface-subtle` (giá trị `#f9fbfc`, cùng hex với app-v2)
— nghĩa là nền icon hai bên đã GIỐNG NHAU sẵn, không có gì lệch để "tham
khảo" ở phần đó. Khác biệt THẬT tìm được khi so từng dòng CSS:
`.datebox input.date-text` của app Cước phí có `text-align:center` — QC Lab
(cả bản cũ lẫn app-v2) để mặc định lệch trái. Ý "tô 3 màu xanh/cam/đen cho
ngày/tháng/năm" ở ảnh thứ 2 KHÔNG tồn tại ở app Cước phí lẫn app cũ QC Lab
(grep toàn bộ 2 codebase ra rỗng) — hỏi lại, người dùng xác nhận chỉ cần
giống app Cước phí, không cần tô màu. Thêm `text-align:center` +
`min-height:0` cho `.date-text`, `outline:0` khi focus — áp dụng cho MỌI ô
ngày trong app-v2 (component dùng chung `DateField.tsx`).

Verify: `app-v2:typecheck`/`test` 34/34/`build` sạch, `app-v2:ui-parity`
79/79, `app-v2:css-parity` 0, `app-v2:style-parity` 18/18, cộng xác nhận
trong Electron thật: gõ "01/09/2026" vào ô "Ngày mở" của modal "Thêm lô QC",
blur ra thì chữ canh giữa ô đúng như app Cước phí.

**Icon lịch "bo cong bên trong" + 2 lần bấm mới đóng được lịch khi lồng
trong modal (2026-09-03).** Sau khi canh giữa chữ ngày ở trên, người dùng
gửi ảnh chụp: KHÔNG phải đòi tăng chiều cao ô (đã hiểu nhầm ở lượt đầu), mà
góc icon bị "bo cong" trông như dính liền vào khung ngoài. Nguyên nhân:
`.datebox{overflow:hidden;border-radius:...}` cắt góc `.datepick` theo đúng
bo góc của khung NGOÀI dù `.datepick` tự nó là hình vuông — không có đường
phân cách nào giữa vùng chữ và icon nên mắt đọc thành "icon bo tròn". App cũ
QC Lab tự đặt `border-left:0` (không có gạch phân cách); app Cước phí (đối
chiếu trực tiếp `DateInput.tsx`/`date-input.css`) dùng
`.manage-date .datepick{border-left:1px solid var(--line)}`. Đổi
`.datepick` sang có `border-left` thật — lệch có chủ đích so với QC Lab bản
cũ, đúng theo yêu cầu rõ ràng của người dùng ("làm kiểu dáng ô chọn ngày
giống bên cost app"), áp dụng app-wide qua `app.css` dùng chung.

Cùng lúc, người dùng báo lỗi thật: bấm mở lịch bên trong modal xong bấm ra
ngoài thì mất modal NHƯNG lịch vẫn còn, phải bấm ra ngoài LẦN NỮA mới ẩn.
Nguyên nhân là thứ tự sự kiện: `Modal.tsx` đóng modal ở `mousedown` (đúng
quy ước dùng chung), còn `DatePickerPopup.tsx` lại nghe `click` để tự đóng —
`mousedown` xảy ra TRƯỚC `click` trong cùng một cú bấm, nên khi modal đóng ở
bước `mousedown` (gỡ luôn subtree DOM chứa cả ô ngày), sự kiện `click` kế
tiếp của CHÍNH cú bấm đó không còn đường nổi bọt lên `document` nữa (node
phát sinh nó đã bị gỡ) — listener `click` của popup lịch không bao giờ nhận
được, phải đợi cú bấm THỨ HAI mới đóng. Sửa `DatePickerPopup.tsx` sang nghe
`mousedown` (khớp đúng cơ chế `Modal.tsx` đang dùng, và khớp
`DateInput.tsx` của app Cước phí — cũng dùng `mousedown` với đúng lý do
này). Giữ nguyên kỹ thuật `event.composedPath()` (không dùng
`target.closest()`) cho nhánh chuyển sang chọn tháng/năm — vẫn an toàn với
`mousedown` vì đổi mode được gắn ở `onClick`, chạy SAU `mousedown`.

Verify: `app-v2:typecheck`/`test` 34/34/`build` sạch, `app-v2:ui-parity`
79/79, `app-v2:css-parity` 0, `app-v2:style-parity` 18/18, cộng xác nhận
trong Electron thật: icon lịch có vạch phân cách rõ ràng, không còn cảm giác
bo tròn dính liền; mở modal "Thêm lô QC" → bấm mở lịch → bấm ra ngoài ĐÚNG
MỘT LẦN → cả lịch lẫn modal cùng đóng ngay.

**Nghiệp vụ "Trạng thái" hồ sơ chuyển lô SAI — Mean/SD bị áp ngay lúc tạo,
không chờ "Chấp nhận" (2026-09-03, sửa ngay trong phiên phát hiện lỗi kiến
trúc).** Người dùng hỏi về ô "Trạng thái" bị khoá không chọn được trong
modal "Thêm hồ sơ chuyển lô" — lượt trả lời đầu coi đây là vấn đề HIỂN THỊ
(thay `<select>` disabled bằng nhãn tĩnh). Người dùng sửa lại: đây là
NGHIỆP VỤ THẬT có 3 trạng thái người dùng tự chuyển tay — "bấm dự kiến là
thêm sẵn và set Mean/SD sẵn, khi cần chạy song song thì chuyển sang trạng
thái song song, khi chấp nhận thì chọn chấp nhận" — và trong lúc dựng lại
đúng luồng đó mới lộ ra lỗi kiến trúc thật đã có TỪ TRƯỚC trong chính phiên
này: `createLotTransition` đang gọi thẳng `saveTestLevel` NGAY lúc tạo hồ
sơ (status vẫn `'planned'`), tức Mean/SD của lô MỚI đã ghi đè vào cấu hình
sống trước khi ai "chấp nhận" gì cả — vi phạm đúng nguyên tắc "song song 2
lô" đã ghi trong CLAUDE.md's mục Giai đoạn B2: lô CŨ phải vẫn là lô vận
hành chính thức cho tới khi được chấp nhận rõ ràng.

Sửa bằng cách dùng lại cột `lot_transitions.criteria_json` (đã có sẵn trong
schema từ đầu, chưa từng dùng tới bước này — xem mục Giai đoạn B2 "CỐ Ý
CHƯA LÀM") làm chỗ lưu Mean/SD ỨNG VIÊN, tách hẳn khỏi `test_levels`:
- **`Dự kiến`** (`planned`, trạng thái khi tạo): `createLotTransition` lưu
  `criteria` (mảng `{testId,level,mean,sd}` gõ trong modal) vào
  `criteria_json` — KHÔNG đụng gì tới `test_levels`. Sửa hồ sơ (còn
  `planned`/`active`) ghi đè lại đúng `criteria_json`, vẫn không đụng cấu
  hình sống.
- **`Song song`** (`active`, qua nút "Kích hoạt"): chỉ đổi `status`, không
  cascade gì — đúng nghĩa "đang chạy song song 2 lô để theo dõi", lô cũ vẫn
  là lô quyết định.
- **`Chấp nhận`** (`accepted`, qua nút "Chấp nhận"): ĐÂY MỚI LÀ LÚC áp —
  đọc lại `criteria_json`, với mỗi `{testId,level,mean,sd}` gọi
  `appendMeanSdHistory()` chốt Mean/SD CŨ vào lịch sử rồi
  `UPDATE test_levels SET qc_lot_id=<lô mới>,mean=...,sd=...,applied='lab'`,
  đánh dấu lô cũ `depleted=1`, và nếu lô cũ thuộc một nhóm lô thì chuyển lô
  mới vào ĐÚNG nhóm đó (`qc_lots.group_id`) — tất cả trong 1 transaction
  (`BEGIN`/`COMMIT`/`ROLLBACK`).
- **`Không chấp nhận`** (`rejected`, qua nút "Không chấp nhận"): chỉ đổi
  `status` + ghi người/ngày duyệt, không cascade gì, không cần reauth (khác
  "Chấp nhận" — không có gì để xác thực khi không thay đổi cấu hình).
- Cổng chặn nhảy lùi (`rank[status]`) + cổng "đã có kết luận thì khoá vĩnh
  viễn" (`accepted`/`rejected` không đổi được nữa) giữ nguyên tinh thần cũ,
  đổi tên lỗi `already-concluded`→`already-decided` cho khớp từ vựng mới.
  Thêm cổng `invalid-status` (từ chối MỌI chuỗi trạng thái lạ ngay từ đầu,
  không đụng gì tới hồ sơ) — trước đó một chuỗi lạ như `'concluded'` sẽ rơi
  tọt vào nhánh `else` (đúng là nhánh `accepted`) và ÂM THẦM chạy toàn bộ
  cascade chấp nhận, một lỗi thật lộ ra khi viết lại test cho vocabulary
  mới.

**Renderer đổi theo**: `TransitionsTab.tsx` bỏ hẳn modal "Kết luận" nhập tay
tự do (nguồn gốc của ô Trạng thái bị khoá bị hỏi ban đầu) — 3 nút hành động
Kích hoạt/Chấp nhận/Không chấp nhận thay thế, `accept()` gọi `confirmDialog`
nêu ĐÚNG tên lô cũ/mới rồi `reauthDialog` (đây là 1 trong ~9 thao tác nhạy
cảm cần xác thực lại — thay đổi Mean/SD sống của cấu hình), `reject()` chỉ
`confirmDialog`. Bảng Mean/SD ứng viên trong modal đọc/ghi từ `criteria_json`
của hồ sơ (`draftCriteria`, parse khi sửa) thay vì đọc trực tiếp
`test_levels` sống — khớp đúng ý nghĩa MỚI "đây là Mean/SD DỰ KIẾN cho lô
mới", không phải "Mean/SD hiện hành".

Verify: `app-v2:typecheck`/`test` 34/34 (viết lại `config-lots-handlers.test.mjs`
và `config-lot-lifecycle.test.mjs` theo vocabulary `planned/active/accepted/
rejected`, thêm oracle mới chốt đúng 2 tính chất cốt lõi: Mean/SD KHÔNG đổi
lúc `planned`/`active`, CHỈ đổi đúng lúc `accepted` — dùng bản Mean/SD đã
SỬA lần cuối chứ không phải bản gốc lúc tạo; `mock-parity.test.mjs` mở rộng
cùng lúc), `app-v2:build` sạch, `app-v2:ui-parity` 79/79 (cập nhật lại
`surfaceNotes` của `manage:modal-transition` — 4 dòng còn lệch giờ là khác
biệt VỊ TRÍ thao tác (radio ngay trong modal tạo ở app cũ, nút trên từng
dòng bảng ở app-v2), không còn là nợ Mean/SD chưa nối), `app-v2:css-parity`
0, `app-v2:style-parity` 18/18, cộng xác nhận bằng chính `window.qcApi`
trong Electron thật: tạo hồ sơ kèm Mean/SD ứng viên (212/4.2) khi lô đang
chạy là 200/5 → đọc lại `test_levels` ngay sau đó vẫn `200/5/lô cũ` (đúng
"Dự kiến" không áp gì) → bấm "Kích hoạt" → vẫn `200/5/lô cũ` → bấm "Chấp
nhận" qua đúng confirm (nêu tên lô) + reauth (kicker "Thao tác được kiểm
soát") → đọc lại `test_levels` ra ĐÚNG `212/4.2/lô mới`, `mean_sd_history_json`
chốt đúng bản ghi cũ `200/5`, lô cũ `depleted=1` — khớp từng trường một,
không chỉ tin thông báo thành công.

**Hồ sơ chuyển lô — bỏ 3 nút hành động tách rời, quay lại ĐÚNG 1 ô "Trạng
thái" + 1 nút Lưu như app cũ (2026-09-03, sửa ngay sau mục trên).** Người
dùng chỉ vào ảnh chụp bảng "Trạng thái | Thao tác" của bản vừa sửa (huy
hiệu "Dự kiến" cạnh 3 nút Kích hoạt/Chấp nhận/Không chấp nhận) và hỏi thẳng
"Sao bạn ko sửa giống app cũ". Tra lại đúng mã nguồn app cũ
(`src/react/modals/LotTransitionModal.tsx`/`saveLotTransitionV2()`/
`ManageLotTransitionCommand`, KHÔNG suy diễn từ mô tả CLAUDE.md cũ — mô tả
đó viết trước khi tra thẳng file này) mới lộ ra: mục trước ĐÃ TỰ NGHĨ RA một
mô hình khác hẳn app cũ. App cũ chỉ có:
- Modal có ĐÚNG 1 `<select id="cfgTransStatus">` với cả 4 lựa chọn (Dự
  kiến/Đang chạy song song/Chấp nhận lô mới/Không chấp nhận) LUÔN chọn
  được — không disable, không tách thành nút riêng.
- ĐÚNG 1 nút Lưu ("Thêm hồ sơ chuyển lô"/"Lưu thay đổi") gọi
  `saveLotTransitionV2()` — vừa đổi status, vừa ghi Mean/SD ứng viên, vừa
  chạy cascade khi chấp nhận, tất cả trong CÙNG một lần bấm.
- Bảng danh sách (`TransitionRow`) chỉ có "Sửa"/"Xóa" — KHÔNG có nút Kích
  hoạt/Chấp nhận/Không chấp nhận nào cả.
- `finalChanged` (chuyển SANG accepted/rejected LẦN ĐẦU) là điều kiện DUY
  NHẤT cần xác thực lại — và áp dụng cho CẢ 'rejected', không chỉ
  'accepted' (mục trước cố ý bỏ reauth cho "Không chấp nhận" với lý do
  "không ghi gì" — SAI theo app cũ: cả hai đều là quyết định không thể xem
  nhẹ). Không có `confirmDialog` trước reauth — bấm Lưu là đi thẳng vào ô
  mật khẩu nếu cần.
- Chỉ 'accepted' khoá vĩnh viễn (`switchesLot(old) && status!=='accepted'`
  → `accepted-immutable`); 'rejected' KHÔNG khoá — sửa/đổi status lại được
  sau đó (mục trước khoá cả 'rejected', cũng SAI).
- Mean/SD ứng viên chỉ hiện cho xét nghiệm ĐANG THẬT SỰ dùng lô cũ
  (`qc_lot_id===fromLotId`), không phải MỌI xét nghiệm của Panel; checkbox
  chỉ trang trí (`checked disabled readOnly`), không có nút bỏ chọn từng
  dòng.
- "Chấp nhận" có cổng thật (`acceptanceGate`): Panel không có xét nghiệm
  nào dùng lô cũ → `no-target-tests`; có nhưng thiếu Mean/SD hợp lệ cho dù
  chỉ 1 xét nghiệm → `missing-target` (nêu đúng tên xét nghiệm còn thiếu) —
  mục trước hoàn toàn không có cổng này, "Chấp nhận" luôn thành công dù
  Mean/SD trống.

Viết lại `main/ipc/config-handlers.ts`'s `createLotTransition` thành MỘT
hàm lưu duy nhất (gộp `setLotTransitionStatus` vào, xoá hẳn hàm đó khỏi
main/preload/index/qc-api.d.ts/manage-store/browser-mock/permission-policy)
— nhận thêm `data.status`, tự tính `finalChanged`, chạy `acceptanceGate`
trước khi ghi, và chỉ cascade khi `status==='accepted' && finalChanged`.
Thêm 2 validate mới thật (trước đây thiếu hẳn): `different-levels` (lô cũ/
mới khác mức QC) và `duplicate-transition` (trùng Panel+cặp lô). Sửa luôn
1 bug thật tìm thấy khi rà: `removeLotTransition` vẫn chặn theo
`status==='concluded'` — trạng thái không còn tồn tại từ lần đổi vocabulary
trước — nghĩa là hồ sơ 'accepted' XOÁ ĐƯỢC không bị chặn gì; đổi lại đúng
`status==='accepted'` (khớp `lotTransitionRemoval()` app cũ). `status`
thiếu khi SỬA (caller lập trình quên truyền) thì GIỮ NGUYÊN trạng thái cũ
thay vì âm thầm lùi về 'planned' — modal thật luôn gửi kèm giá trị
`<select>` hiện tại nên tình huống này chỉ xảy ra với test/caller lập
trình, an toàn hơn là coi thiếu = ý định lùi trạng thái.

`TransitionsTab.tsx` viết lại: `<select name="status">` 4 lựa chọn thay
badge + nút hành động; `submit()` tính `finalChanged` PHÍA CLIENT (so
status mới với `creating.status`) rồi gọi `reauthDialog()` (tiêu đề/câu chữ
NGUYÊN VĂN app cũ) TRƯỚC KHI gọi API nếu cần, không có confirm riêng; bảng
Mean/SD ứng viên lọc theo `levelsByTestId[test.id].some(l=>l.qc_lot_id===
draftFromLotId)` thay vì mọi xét nghiệm của Panel; checkbox đổi sang
`checked disabled readOnly`; nhãn Panel trong `<select>` ghép thêm tên máy
(`${panel.name} · ${instrumentName}`, khớp `openLotTransitionModel()` app
cũ — bảng danh sách vẫn chỉ hiện tên Panel trần, đúng `TransitionRow`).
Bảng danh sách thêm 2 dòng hint app cũ có mà bản trước thiếu:
"Đã chuyển tiếp qua lô X" (khi accepted) và "Duyệt: {người}·{giờ ngày}".
Nhãn trạng thái đổi khớp `manageTransitionStatus()` app cũ nguyên văn
("Chấp nhận lô mới" không phải "Đã chấp nhận", cls theo đúng bảng
active/accepted/rejected/mặc định).

Verify: `app-v2:typecheck` sạch, `app-v2:test` 34/34 (viết lại phần chuyển
lô của `config-lots-handlers.test.mjs`/`config-lot-lifecycle.test.mjs`/
`mock-parity.test.mjs` theo MỘT-hàm-lưu-duy-nhất — thêm oracle cho
`no-target-tests`/`missing-target`/`duplicate-transition`/`different-levels`/
`accepted-immutable` mà bản trước chưa test vì chưa tồn tại; chốt cả tính
chất "'rejected' không khoá, sửa lại được"), `app-v2:build` sạch,
`app-v2:ui-parity` **79/79, `manage:modal-transition` về ĐÚNG 0/0** (xoá hẳn
`surfaceNotes` cho surface này — không còn khác biệt mô hình nào để giải
thích), `app-v2:css-parity` 0, `app-v2:style-parity` 18/18, cộng xác nhận
bằng chính `window.qcApi` + thao tác thật trong trình duyệt: modal "Sửa"
hiện đúng `<select>` "Dự kiến" (không còn badge/nút tách rời); đổi sang
"Đang chạy song song" lưu KHÔNG cần reauth; đổi tiếp sang "Chấp nhận lô
mới" lưu ĐI THẲNG vào reauth (kicker "Thao tác được kiểm soát", câu hỏi
"Nhập lại mật khẩu trước khi chấp nhận hoặc từ chối lô QC mới.") — xác thực
xong, `acceptanceGate` chạy đúng: Panel có xét nghiệm đang dùng lô cũ +
Mean/SD hợp lệ trong `criteria_json` từ lần lưu trước → chấp nhận thành
công, `test_levels` cập nhật đúng qc_lot_id/mean/sd mới, lịch sử chốt đúng
bản ghi cũ; bảng danh sách sau đó hiện đúng "Chấp nhận lô mới" + 2 dòng
hint + chỉ còn Sửa/Xóa (không còn 3 nút hành động) — khớp pixel với ảnh app
cũ người dùng gửi.

**3 sửa nhỏ liền sau (2026-09-03), cùng mạch "chuyển tiếp lô".**
1. **Ngày "Bắt đầu" hiện ISO thô** (`2026-09-03` thay vì `03/09/2026`) —
   `TransitionsTab.tsx`'s cột Bắt đầu quên gọi `vnDate()` (hàm dùng chung đã
   có sẵn trong `renderer/lib/format.ts`, các cột ngày khác trong cùng trang
   Cấu hình chung đều gọi đúng). Sửa 1 dòng.
2. **Tỷ lệ cột bảng "Chuyển tiếp lô QC" sai** — người dùng hỏi "sao cột này
   rộng mà vẫn xuống 2 dòng": đúng là app cũ CŨNG hiện 2 dòng khối cho ô
   "Chuyển lô" (`<div>{fromLot}</div><div class="hint">→{toLot}</div>`,
   `professional-config.css`'s `.transition-table .hint{line-height:1.35}`
   không đổi display) — không phải lỗi tràn dòng. Cái sai thật là TỶ LỆ 5
   cột: app-v2 tự đặt 19/29/18/18/16%, không cột nào canh trái; app cũ là
   14/22/12/30/22% với cột 1 (Panel QC) canh trái. Cột "Chuyển lô" quá rộng
   so với nội dung ngắn khiến 2 dòng nhìn lệch/thừa chỗ. Port đúng % + canh
   lề app cũ.
3. **Lô cũ KHÔNG rời nhóm lô sau khi "Chấp nhận" — bug dữ liệu thật**, người
   dùng phát hiện qua ảnh chụp tab "Lô & Nhóm QC": nhóm "1101/1102" sau khi
   chấp nhận chuyển 1101→1111 vẫn hiện CẢ BA lô (1101/1102/1111) thay vì
   đúng hai (1102/1111). Nguyên nhân: cascade "Chấp nhận" trong
   `createLotTransition()` (mục lớn ở trên) chỉ gán `qc_lots.group_id` của
   lô MỚI bằng group_id của lô cũ, QUÊN gỡ `group_id` của lô CŨ — dịch sai
   nửa phép "thay thế" của app cũ (`applyAcceptedLotTransition()`'s
   `lotIds.map(id => id===from.id ? to.id : id)` thay THẲNG phần tử trong
   mảng, không phải cộng thêm phần tử mới). Vì app-v2 dùng FK
   `qc_lots.group_id` thay vì mảng `lotIds`, "thay thế" phải dịch thành HAI
   bước: gỡ `group_id` của lô cũ VỀ NULL, rồi mới gán group_id đó cho lô
   mới — thiếu bước gỡ để lại đúng lỗi "lô đã hết dùng vẫn là thành viên
   nhóm". Sửa ở cả `main/ipc/config-handlers.ts` và
   `renderer/browser-mock/api.ts` (mock phải đọc `fromLot.group_id` vào
   biến TRƯỚC khi gán null, vì JS mutate cùng object reference).

Verify: `app-v2:typecheck`/`build` sạch, `app-v2:test` **34/34** (thêm mục
(4) trong `config-lot-lifecycle.test.mjs` — hồ sơ chuyển lô với lô cũ đang
thuộc 1 nhóm lô 2 thành viên, "Chấp nhận" xong xác nhận nhóm còn ĐÚNG lô
còn lại + lô mới, lô cũ `group_id=null`, lô mới `group_id` bằng đúng
group_id cũ), `app-v2:ui-parity` 79/79, `app-v2:css-parity` 0,
`app-v2:style-parity` 18/18, cộng xác nhận bằng chính `window.qcApi` +
đọc lại giao diện thật trong trình duyệt: tạo lại đúng kịch bản của người
dùng (nhóm 2 lô, chấp nhận chuyển 1 trong 2 lô sang lô thứ 3) — nhóm hiện
đúng 2 thành viên (lô còn lại + lô mới), lô cũ hiện "Đã chuyển tiếp"
KHÔNG còn nằm trong card nhóm nào — khớp đúng kỳ vọng ảnh chụp người dùng
gửi. Cũng dọn `surfaceNotes.manage:history` lỗi thời trong
`ui-parity-baseline.json` (ghi "chưa có nút Chi tiết" từ đợt trước Giai
đoạn "rà soát nghiệp vụ" viết lại tab này — surface đã về 0/0 từ lâu,
ghi chú quên xoá khiến đọc lại tưởng vẫn còn thiếu).

**SỬA LẠI mục "Chấp nhận" ở trên: nhóm lô phải LƯU TRỮ, không chỉ gỡ
group_id — cộng 2 lỗi khác cùng phát hiện (2026-09-03).** Người dùng gửi
ảnh chụp app cũ thật: sau khi chấp nhận chuyển 1101→1111, app cũ hiện
**HAI** thẻ nhóm — "1111/1102" (Đang hoạt động, đã tự đổi tên) VÀ
"1101/1102" (**Đã lưu trữ**, ghi chú "Đã dùng khi chuyển tiếp lô 1101 sang
1111", vẫn giữ lô 1101 làm thành viên) — khác hẳn cách sửa ở mục ngay
phía trên (chỉ gỡ `group_id` của lô cũ về NULL, không tạo nhóm lưu trữ nào).
Tra lại đúng `applyAcceptedLotTransition()` app cũ mới thấy: nó KHÔNG đơn
giản là "gỡ khỏi nhóm" — nó lưu trữ TOÀN BỘ trạng thái cũ của nhóm (tên/
hãng/vật liệu/mã hàng, vẫn giữ lô cũ) thành MỘT bản ghi nhóm RIÊNG, còn
nhóm ĐANG HOẠT ĐỘNG giữ NGUYÊN id gốc — chỉ thay lô cũ bằng lô mới trong
thành viên và tự đổi tên NẾU tên đang là tên tự sinh từ số lô (không đổi
nếu người dùng đã đặt tên riêng).

Viết lại cascade trong `createLotTransition` (cả `main/ipc/config-handlers.ts`
và `renderer/browser-mock/api.ts`): đọc TOÀN BỘ thành viên hiện tại của
nhóm lô cũ, tạo một `lot_groups` row MỚI sao chép tên/hãng/vật liệu/mã hàng
+ `active=0, status='stopped', note='Đã dùng khi chuyển tiếp lô X sang Y'`,
chuyển lô CŨ sang row mới này (KHÔNG null); nhóm GỐC (giữ nguyên id) nhận
lô MỚI thay chỗ, tự đổi tên nếu tên cũ khớp đúng tổ hợp số lô cũ (so `name
=== lotNos.join('/')`).

**2 lỗi khác phát hiện cùng lúc, từ chính câu hỏi của người dùng ("cột
Nguồn sao lại có PXN được, đây là của nhà sản xuất mà — PXN chỉ khi thiết
lập dải kiểm soát ở thẻ Nhập QC và biểu đồ"):**
1. **Cột "Nguồn" hiện sai PXN cho Mean/SD không hề qua luồng PXN.** Tra lại
   `applyPlannedTarget()`/`applyTargetPick()` app cũ (dùng chung bởi modal
   chuyển lô VÀ kích hoạt nhóm lô VÀ tab Mean/SD) xác nhận: cả hai LUÔN ghi
   `source:'mfg'` — **'lab' (PXN) CHỈ dành riêng cho luồng "Xây dựng dải
   PXN" ở trang Nhập QC & Biểu đồ** (`RangeWorkflowCommand`/`applyNewRange()`),
   không phải bất kỳ chỗ nào khác. app-v2's `createLotTransition`'s cascade
   VÀ `activateLotGroup`'s cascade đều đang hard-code `applied:'lab'` — sai
   ở CẢ HAI chỗ. Sửa cả hai thành `'mfg'` (main + mock), ảnh hưởng ngay cột
   "Nguồn" của tab Lịch sử dữ liệu.
2. **Modal "Chi tiết" chỉ có 1 dòng hint tĩnh, thiếu hẳn 2 bảng thật của
   app cũ.** Người dùng chỉ thẳng ảnh chụp modal app cũ
   (`qc-history-detail-modal-html.ts`/`openQcHistoryDetail()`): modal có
   **bảng "Mean/SD đã dùng"** (8 cột: Lô QC/Mean/SD/**Mean tích lũy/SD tích
   lũy/CV tích lũy**/Hiệu lực/Nguồn — thống kê tích lũy tính TỪ CÁC ĐIỂM QC
   THẬT của đúng lô đó, tới thời điểm mốc hết hiệu lực) VÀ **bảng "Điểm QC
   đã nhập (N)"** (8 cột: Ngày/Lần chạy/Giá trị/Z/**Mean lúc nhập/SD lúc
   nhập**/Kết luận nhanh/NV) — app-v2 trước đó chỉ có 1 dòng `<div
   className="hint">` tĩnh thay bảng đầu, và bảng điểm thiếu 2 cột Mean/SD
   lúc nhập + đặt sai tên 2 cột còn lại ("Kết luận"→"Kết luận nhanh", "NV
   thực hiện"→"NV"). Viết lại `HistoryTab.tsx`: thêm `statsOf()` (mean/SD
   mẫu n-1/CV — CÙNG công thức đã dùng ở panel "Điểm trong khoảng xem" của
   trang Nhập QC, không phát minh công thức mới) tính tích lũy từ
   `points.filter(p => ... && (!row.to || p.date <= row.to))`; bảng "Mean/SD
   đã dùng" liệt kê MỌI mốc lịch sử của ĐÚNG lô đang xem (`rows.filter(r =>
   r.level===detail.level && r.lotId===detail.lotId)`), không chỉ dòng vừa
   bấm. "NV" đọc `operator_username` (mã ngắn) trước, không phải tên đầy đủ.
   Port 4 class CSS còn thiếu (`hist-meansd-table`/`hist-points-table`/
   `history-detail-heading`/`space-after-section`) từ
   `assets/professional-config.css` — gate `app-v2:css-parity` tự bắt đúng
   4 class này trước khi build lại.
3. **Thẻ nhóm lô "Đã lưu trữ" lẫn với "Đã dừng" — 2 khái niệm khác nhau
   trong app cũ, app-v2 gộp làm một.** `lot-group-status.ts`/
   `lot-group-toggle-action.ts` app cũ: `archived` (tính từ `active===false`,
   KHÁC `status`) hiện "Đã lưu trữ" (cls đỏ) và **KHÔNG có nút Kích hoạt/Dừng
   nào cả** (kích hoạt lại một nhóm chỉ còn lô đã hết dùng là vô nghĩa);
   `status==='stopped'` (do tự tay bấm "Dừng", `active` vẫn 1) hiện "Đã
   dừng" và VẪN có nút "Kích hoạt". app-v2's `LotsTab.tsx` trước đó chỉ nhìn
   `status`, luôn hiện "Đã dừng" + luôn hiện nút "Kích hoạt" cho MỌI nhóm
   không active — kể cả nhóm vừa được lưu trữ tự động ở mục trên. Sửa để
   phân biệt đúng `g.active===0` trước khi xét `status`.

Verify: `app-v2:typecheck`/`build` sạch, `app-v2:test` 34/34 (viết lại mục
(4) trong `config-lot-lifecycle.test.mjs` theo đúng cơ chế lưu trữ mới —
chốt nhóm ĐANG HOẠT ĐỘNG giữ nguyên id + tên không đổi khi tên tự đặt, nhóm
LƯU TRỮ là bản ghi RIÊNG giữ đúng lô cũ + tên/ghi chú, cộng 1 kịch bản thứ
hai xác nhận tên TỰ SINH thì tự đổi theo tổ hợp lô mới), `app-v2:css-parity`
0 (bắt đúng 4 class thiếu trước khi sửa), `app-v2:ui-parity` 79/79 (`manage:
history` vẫn 0/0 — gate chưa đo bên trong modal "Chi tiết" của trang này),
`app-v2:style-parity` 18/18, cộng dựng lại NGUYÊN VẸN kịch bản ảnh chụp
người dùng gửi bằng `window.qcApi` (máy "Điện giải", xét nghiệm "Sodium
(Na)", lô 1101/1102, nhóm "1101/1102", 2 điểm QC trên lô 1101, chuyển tiếp
sang lô 1111) rồi đọc lại giao diện thật: nhóm "1111/1102" đang hoạt động +
nhóm "1101/1102" "Đã lưu trữ" chỉ còn 3 nút (không có Kích hoạt) — khớp
pixel với ảnh chụp; cột "Nguồn" hiện đúng NSX cho cả 2 lô; modal "Chi tiết"
của lô 1101 hiện đủ 2 bảng với Mean tích lũy 140.3/SD tích lũy 1.1/CV tích
lũy 0.76% tính đúng từ 2 điểm QC thật (141.0 và 139.5) — không phải số bịa.

**Cột "Hiệu lực" của tab Lịch sử luôn hiện "Không giới hạn" cho mốc BẮT ĐẦU
dù đã đặt ngày rõ ràng (2026-09-03).** Người dùng chuyển tiếp lô với "Ngày
bắt đầu" = 03/09/2026 nhưng dòng lịch sử của lô mới vẫn hiện "Không giới hạn
→ 31/10/2026" (hạn dùng lô) thay vì "03/09/2026 → …". Nguyên nhân:
`HistoryTab.tsx`'s `build()` hard-code `periodLabel('', to)` — vế "từ" LUÔN
rỗng cho MỌI dòng, kể cả khi có đủ dữ liệu để suy ra đúng. Trong khi
`mean_sd_history_json` không lưu `effectiveFrom` riêng (chỉ `{at,mean,sd,
qcLotId}` — giới hạn dữ liệu đã ghi từ trước), có thể SUY ĐÚNG: mốc TRƯỚC
`at` lúc nào thì mốc SAU bắt đầu hiệu lực đúng lúc đó (hai mốc liền kề không
có khoảng trống) — dòng ĐANG hiệu lực nhận "từ" = `at` của mốc lịch sử GẦN
NHẤT (nếu có), mỗi dòng lịch sử khác nhận "từ" = `at` của mốc NGAY TRƯỚC nó
trong mảng; chỉ mốc CŨ NHẤT (chưa từng thay, không có gì cũ hơn để suy ra)
mới thật sự "Không giới hạn" ở đầu. Sửa `rows`'s `useMemo`: `build()` nhận
thêm tham số `from`, tính từ `history[index-1]?.at` (dòng lịch sử) hoặc
`history[history.length-1]?.at` (dòng đang hiệu lực).

Verify: `app-v2:typecheck`/`test` 34/34/`build` sạch, `app-v2:css-parity` 0,
`app-v2:ui-parity` 79/79, `app-v2:style-parity` 18/18, cộng xác nhận trong
trình duyệt thật với đúng dữ liệu đã tạo ở mục trên: dòng lô 1111 (vừa
chuyển tiếp) hiện "03/09/2026 → Không giới hạn", dòng lô 1101 (bị thay,
CHƯA từng bị thay trước đó) hiện "Không giới hạn → 03/09/2026", dòng lô
1102 (chưa từng đổi) vẫn "Không giới hạn → Không giới hạn" — đúng cả 3
nhánh (mốc đầu tiên/mốc đã thay/mốc đang hiệu lực sau khi thay).

**Audit sâu toàn bộ nghiệp vụ 8 tab "Cấu hình chung" (2026-09-03) — bắt được
BUG DỮ LIỆU NGHIÊM TRỌNG NHẤT của cả đợt "làm đầy đủ": Giới hạn dưới/trên bị
mất khi lưu Mean/SD.** Theo yêu cầu người dùng "đào sâu thật sâu, đảm bảo
chính xác 100% so với app cũ", chạy song song 6 agent nghiên cứu (mỗi agent
1-2 tab, đọc thẳng mã nguồn app cũ + app-v2, không tin tài liệu cũ) — tìm
được ~30 điểm lệch, ưu tiên sửa theo mức độ nghiêm trọng, bắt đầu từ bug này.

- **Nguyên nhân**: `TargetsTab.tsx`'s `saveTargetMatrix()` gọi
  `normalizeTargetPick()` (đã tính đúng `result.low`/`result.high` từ Mean/SD
  hoặc ngược lại) nhưng khi `picked.push({...})` **chỉ lấy `mean`/`sd`, bỏ hẳn
  `low`/`high`**. Sâu hơn: DÙ CÓ gửi lên, main process cũng không lưu được —
  `TestLevelInput`/`PreparedTestLevel` (`manage-validation.ts`'s
  `prepareTestLevel()`/`validateTestLevel()`) **chưa từng có trường
  `low`/`high`**, và `saveTestLevel`'s SQL (`config-handlers.ts`) không ghi 2
  cột đó dù `test_levels.low`/`.high` đã có sẵn trong schema từ đầu. Hậu quả:
  người dùng nhập Mean=150/SD=5, ô Giới hạn dưới/trên TỰ ĐỘNG hiện đúng
  140.00/160.00 (tính ở renderer) — trông như đã lưu — nhưng bấm "Lưu Mean/SD
  mức này" xong thì 2 số đó BIẾN MẤT khỏi DB, tab "Lịch sử dữ liệu" luôn hiện
  "—" cho mọi dòng dù đã nhập đủ giới hạn lúc lưu.
- **Sửa domain**: `prepareTestLevel()`/`TestLevelInput`/`PreparedTestLevel`
  thêm `low`/`high` (parse giống `mean`/`sd`, không ép buộc — `null` nếu bỏ
  trống, không validate thêm gì vì `normalizeTargetPick()` ở renderer đã kiểm
  đủ điều kiện trước khi gửi lên).
- **Sửa SQL**: `saveTestLevel`'s UPDATE/INSERT ghi thêm `low`/`high`.
- **Sửa renderer**: `TargetsTab.tsx`'s `picked` giữ lại `result.low`/
  `result.high`, gửi kèm khi gọi `saveTestLevel(...)`.
- **Sửa luôn 1 gap cùng loại tìm thấy khi rà**: modal "Chuyển tiếp lô" (Mean/
  SD ứng viên cho lô mới, lưu tạm trong `lot_transitions.criteria_json`) cũng
  chỉ giữ `mean`/`sd` khi đọc bảng — cùng lỗ hổng, khác chỗ. Thêm `low`/`high`
  vào kiểu `criteria`, `TransitionsTab.tsx`'s `submit()` gửi kèm, và cascade
  "Chấp nhận" (`createLotTransition`'s `applyCascade()`, cả main lẫn
  `browser-mock/api.ts`) ghi `low`/`high` vào `test_levels` khi áp Mean/SD
  ứng viên vào lô mới. Cascade `activateLotGroup` đã đúng từ trước (không cần
  sửa) — nó đọc `low`/`high` qua `lotTargetSnapshot()` rồi ghi thẳng.
- Mirror đầy đủ trong `renderer/browser-mock/api.ts` (bản xem trước trình
  duyệt) cho cả 2 đường lưu trên.

Verify: `npm run app-v2:typecheck`/`test` 34/34 (mock-parity vẫn khớp 141
bước — không đổi hợp đồng IPC, chỉ thêm field)/`build` sạch, `app-v2:css-
parity` 0, `app-v2:ui-parity` 79/79, `app-v2:style-parity` 18/18, cộng xác
nhận trong trình duyệt thật qua cả 2 đường: (1) gọi thẳng `window.qcApi
.saveTestLevel(...)` với `low`/`high` — đọc lại `listTestLevels()` xác nhận
2 cột không còn `null`; (2) thao tác qua chính UI "Mean/SD" — gõ Mean=150/
SD=5 (Giới hạn tự đồng bộ 140.00/160.00), tick "Dùng", bấm "Lưu Mean/SD mức
này" → xác thực lại mật khẩu thật → đọc lại DB thấy `low:140,high:160` đã
lưu THẬT → chuyển sang tab "Lịch sử dữ liệu", dòng đang hiệu lực hiện đúng
"140.00"/"160.00" ở cột Giới hạn dưới/trên (trước đây luôn "—") — các dòng
lịch sử CŨ (lưu trước khi sửa) vẫn hiện "—" đúng như kỳ vọng, vì
`mean_sd_history_json` chỉ chốt `{at,mean,sd,qcLotId}` mỗi lần đổi (giới hạn
dữ liệu đã ghi từ Giai đoạn D3.4b, không phải bug mới) — chỉ dòng ĐANG hiệu
lực (đọc thẳng cột `test_levels.low/high` mới) mới có giới hạn.

**Còn lại từ đợt audit 6-agent này, đã liệt kê theo tab nhưng CHƯA sửa**
(mức độ thấp hơn, để lại việc kế tiếp; 2 mục nghiêm trọng nhất — mô hình
trạng thái nhóm lô và checkbox mặc định của Mean/SD — đã sửa ở mục ngay
dưới): Danh mục xét nghiệm (TEa âm bị clamp lặng lẽ thay vì báo lỗi; chưa
auto-fill Khoa/Khu vực cho máy mặc định khi mở modal thêm mới; CUSUM k/h ≤0
chỉ clamp về 0 thay vì trả về mặc định); Lô & Nhóm QC (thiếu chặn trùng số
lô cùng mức; thiếu chặn đổi mức của lô đang gán cho xét nghiệm; lô đã hết
dùng không bị vô hiệu hoá trong modal chọn thành viên nhóm; thiếu chặn trùng
nhóm lô); Mean/SD (bỏ tick một hàng nên gỡ gán lô của mức đó, hiện chưa làm
gì); Chuyển tiếp lô (danh sách Lô cũ/Lô mới nên loại lô đã `depleted` trừ
khi đang là giá trị đang chọn; audit log xoá hồ sơ dùng id thô thay vì nhãn
lô đọc được); Lịch sử dữ liệu (ô tìm kiếm nên lọc theo cả số lô/mức, không
chỉ tên xét nghiệm); Bảng TEa tham chiếu (ô "Nguồn chính" nên là danh sách
đóng 6 lựa chọn thay vì gõ tự do; thiếu đường xoá hồ sơ PXN của analyte có
sẵn trong danh mục; thứ tự ưu tiên trạng thái override/lab bị đảo; audit log
TEa thiếu các trường tuân thủ (nguồn/tham chiếu/lý do/ngày/người chuẩn
bị-duyệt) dù đã có sẵn lúc lưu). Toàn bộ đã ghi lại có chủ đích, không phải
bỏ sót không ghi chú — ưu tiên sửa tiếp theo mức độ nghiêm trọng khi có
yêu cầu.

**Sửa 2 mục nghiêm trọng tiếp theo của đợt audit — mô hình trạng thái nhóm
lô QC bị đảo ngược, và checkbox Mean/SD mặc định sai (2026-09-04).**

1. **Lô & Nhóm QC — "Đang hoạt động" bị lưu cứng thay vì SUY ra.** Tra lại
   đúng app cũ (`src/presentation/manage/lot-group-status.ts`/
   `lot-group-toggle-action.ts`, `src/domain/qc/lot-group-status.ts`'s
   `qcLotGroupOperational()`, và `operational-access.ts`'s `lotGroupInUse()`):
   app cũ **KHÔNG BAO GIỜ lưu literal `'active'`** cho `status` của nhóm lô —
   trường này chỉ có 2 giá trị tự đặt thật (`'stopped'`/`'planned'`), còn lại
   là "không có gì tự đặt" (`delete group.status` khi kích hoạt). "Đang hoạt
   động" vs "Chưa dùng" là nhãn **SUY** từ `lotGroupInUse()` — có lô nào của
   nhóm đang thật sự được gán (`qcLotId`) cho xét nghiệm nào không.
   `prepareLotGroup()` (app-v2, `manage-validation.ts`) lại mặc định
   `status:'active'` ngay lúc TẠO nhóm mới — hậu quả: một nhóm VỪA TẠO, CHƯA
   hề gán lô cho xét nghiệm nào, đã hiện "Đang hoạt động" + nút "Dừng" ngay
   lập tức, sai hẳn luồng tạo→kích hoạt của app cũ.
   - `GROUP_STATUSES` bỏ `'active'`, chỉ còn `['stopped','planned']`;
     `PreparedLotGroup.status` đổi kiểu `'' | 'stopped' | 'planned'`; mặc
     định khi tạo mới (hoặc giá trị lạ) là `''` (không phải `'active'`).
   - `config-handlers.ts` thêm `lotGroupInUse(lotIds)` (SQL `EXISTS` trên
     `test_levels.qc_lot_id`) — dùng chung ở 3 chỗ: `listLotGroups()` trả
     thêm trường `inUse` cho mỗi nhóm; `stopLotGroup()` đổi cổng chặn từ
     `status==='active'` (literal không bao giờ còn được lưu, nên nút "Dừng"
     sẽ luôn thất bại nếu không sửa) sang "không phải stopped/planned VÀ
     đang inUse" (đúng `lotGroupToggleAction()` app cũ); `activateLotGroup()`
     2 chỗ `UPDATE ... status='active'` đổi thành `status=''`.
   - `LotGroup` (shared `qc-api.d.ts`) thêm trường đọc `inUse: boolean`
     (tính ở main, không lưu DB) và đổi kiểu `status` khớp domain.
   - `LotsTab.tsx`: form tạo mới gửi `status:''` thay vì `'active'`; nhãn/
     class trạng thái và điều kiện hiện nút Dừng/Kích hoạt đổi từ so sánh
     `g.status==='active'` sang `operational && g.inUse` (`operational =
     status khác 'stopped'/'planned'`).
   - Mirror đầy đủ 4 hàm trên trong `renderer/browser-mock/api.ts`
     (`saveLotGroup` tự động đúng vì dùng chung `validateLotGroup()` từ
     domain, không cần sửa riêng).
   - Sửa 2 test cũ khoá sai kỳ vọng (`config-lot-lifecycle.test.mjs`): kỳ
     vọng `status==='active'` sau khi kích hoạt/chấp nhận chuyển lô đổi
     thành `status===''` + `inUse===true` — giữ đúng Ý ĐỊNH bài test (nhóm
     vẫn thật sự đang chạy), chỉ đổi cách biểu diễn.
2. **Mean/SD — checkbox "Dùng" luôn tick sẵn, kể cả hàng đang gắn LÔ KHÁC.**
   Tra `src/presentation/manage/target-row-state.ts`'s `targetRowState()` app
   cũ: `checked = !!linked || !assigned` — tick sẵn khi mức CHƯA gán lô nào
   (`!assigned`) hoặc đã gán ĐÚNG lô của nhóm đang xem (`linked`); BỎ tick khi
   mức đang gán một lô KHÁC ngoài nhóm (`assigned && !linked`, nhãn "Đang
   dùng lô khác"). `TargetsTab.tsx` trước đó `defaultChecked` cứng `true` cho
   mọi hàng — bấm "Lưu Mean/SD mức này" mà quên bỏ tick sẽ vô tình chuyển cả
   những xét nghiệm KHÔNG liên quan sang lô của nhóm đang xem, ghi đè Mean/SD
   đang dùng thật của chúng.
   - Thêm `const checked = !target?.qc_lot_id || !!linkedLot;` (dùng đúng
     `linkedLot` đã có sẵn để tính cột "Trạng thái"), gán vào
     `defaultChecked` của `.tm-use` VÀ `disabled={!checked}` cho cả 4 ô số
     (Mean/Giới hạn dưới/Giới hạn trên/SD) — khớp `disabled: locked ||
     !checked` app cũ (bỏ nhánh `locked`/lô đã hết dùng, việc đó vẫn nằm
     trong backlog TEa/Lô riêng). `toggleTargetRow()`/`targetCheckAll()`
     (đã có sẵn, không đổi) vẫn xử lý đúng khi người dùng tự tick/bỏ tick.

Verify: `npm run app-v2:typecheck`/`test` 34/34 (2 assertion sửa lại đúng
kỳ vọng, không nới lỏng)/`build` sạch, `app-v2:css-parity` 0, `app-v2:ui-
parity` 79/79, `app-v2:style-parity` 18/18, cộng xác nhận trong trình duyệt
thật qua `window.qcApi`: tạo nhóm lô mới với 2 lô CHƯA gán cho xét nghiệm
nào → `listLotGroups()` trả đúng `status:'', inUse:false` → giao diện hiện
đúng "Chưa dùng" + nút "Kích hoạt" (không còn "Đang hoạt động"/"Dừng" ngay
khi vừa tạo); mở tab Mean/SD, chọn Panel chứa 1 xét nghiệm đang gắn lô KHÁC
với nhóm đang xem → bảng tổng kết hiện đúng "1 đang dùng lô khác", checkbox
hàng đó mặc định BỎ TICK và cả 4 ô số bị khoá — khớp đúng hành vi app cũ.

**Sửa hết ~13 mục còn lại của đợt audit 6-agent (2026-09-04) — "sửa hết theo
thứ tự rõ ràng" theo yêu cầu người dùng.** Trước khi sửa, chạy 3 agent nghiên
cứu song song đọc thẳng mã nguồn app cũ (không tin lại mô tả cũ trong file
này) cho từng nhóm nghiệp vụ, lấy đúng tên hàm/số dòng/thông báo lỗi/công
thức trước khi port. Nhóm theo file bị đụng, không theo thứ tự liệt kê cũ.

**1. Lô & Nhóm QC — 4 validate còn thiếu.**
- **Chặn trùng số lô cùng mức** (`duplicate-lot`, "Số lô QC này đã tồn tại ở
  cùng mức QC.") — port `validateLot()` app cũ (`sameText()`, không phân
  biệt hoa/thường/dấu).
- **Chặn đổi mức của lô đang gắn Mean/SD cho xét nghiệm** (`level-in-use`,
  "Lô QC đang gắn với xét nghiệm nên không thể đổi mức QC. Hãy bỏ gán lô
  trong Mean/SD trước.") — kiểm TRƯỚC cả cổng trùng số lô, đúng thứ tự app
  cũ. Cả hai gate thêm vào `saveLot()` (`config-handlers.ts`), mirror trong
  `browser-mock/api.ts`.
- **Chặn trùng nhóm lô** (`duplicate-group`, "Nhóm lô này đã tồn tại hoặc
  trùng danh sách lô.") — trùng TÊN (`sameText`) HOẶC trùng NGUYÊN BỘ LÔ
  (không kể thứ tự) với nhóm khác — thêm vào `saveLotGroup()`.
- **Lô đã hết dùng (`depleted`) bị khoá trong modal chọn thành viên nhóm** —
  port `locked = depleted && !selected` app cũ: vẫn GIỮ LẠI nếu đã là thành
  viên hiện tại (sửa nhóm cũ), chỉ chặn THÊM MỚI một lô đã hết dùng vào
  nhóm khác. `LotsTab.tsx` thêm `disabled`+`title` cho checkbox.

**2. Chuyển tiếp lô — loại lô hết dùng khỏi dropdown + audit log đọc được.**
- Port `availableLots()` app cũ: dropdown "Lô cũ"/"Lô mới" ẩn mọi lô
  `depleted`, TRỪ khi đó chính là giá trị đang chọn/sửa (giữ lại lựa chọn
  cũ khi mở lại 1 hồ sơ cũ). Nhãn thêm hậu tố "đã chuyển tiếp qua lô X"/"đã
  hết QC" khi lô đó hết dùng, port `label()` app cũ.
- **Audit log xoá hồ sơ chuyển lô dùng ID THÔ** (`Xoá hồ sơ chuyển lô
  <id-nội-bộ>`) — sửa thành nhãn đọc được qua `lotLabel()` mới (`"1101 ·
  Mức 1 → 1111 · Mức 1"`, `target:'Chuyển tiếp lô'` tĩnh), port đúng
  `manageLotLabel()`/`manage-lot-transition-command.ts` app cũ.
- **Bug thật tìm thấy khi rà cùng lúc**: `browser-mock/api.ts`'s
  `removeLotTransition` còn kiểm `status==='concluded'` — vocabulary CŨ đã
  đổi sang `accepted`/`rejected` từ 2026-09-03 — nghĩa là bản xem trước
  KHÔNG BAO GIỜ chặn xoá một hồ sơ đã `accepted`, khác hẳn `main` (đã chặn
  đúng). Sửa lại đúng `status==='accepted'`.

**3. Mean/SD — bỏ tick hàng ĐANG THẬT SỰ gắn đúng lô đó thì GỠ liên kết
thật.** Port nhánh `!pick.use` của `applyTargetPick()` app cũ: `linked` (mức
gắn ĐÚNG lô của hàng đang xét) mới bị gỡ (`qcLotId=''`), giữ nguyên Mean/SD
đã có; hàng "chưa gán"/"đang gắn lô khác" thì bỏ tick không làm gì (khớp
app cũ). `TargetsTab.tsx`'s `saveTargetMatrix()` trước đây chỉ SKIP hàng bị
bỏ tick (không đụng gì tới DB) — giờ tách riêng mảng `unlink`, gọi
`saveTestLevel(...,{qcLotId:''})` giữ nguyên `mean/sd/low/high` hiện có cho
từng hàng thoả điều kiện.

**4. Lịch sử dữ liệu — ô tìm kiếm lọc thêm theo số lô/mức.** Port
`historySearchValues()` app cũ: tập giá trị so khớp gồm tên xét nghiệm CỘNG
số mức (dạng số/`M{n}`/`Mức {n}`) và số lô của MỌI mốc lịch sử Mean/SD.
Component nạp mức QC của MỌI xét nghiệm (không chỉ xét nghiệm đang chọn)
qua `useEffect` mới để có đủ dữ liệu tra cứu.
- **Bug thật tự bắt được khi kiểm chứng sống (không phải chỉ đọc code)**:
  port thẳng công thức fallback `history.length ? history : [{qcLotId:
  level.qcLotId}]` của app cũ SAI với mô hình dữ liệu app-v2 —
  `mean_sd_history_json` ở đây CHỈ chốt giá trị CŨ (đã bị thay), khác
  `meanSdHistory` app cũ (tự bao gồm cả mốc mới nhất) — nên khi một mức ĐÃ
  từng đổi Mean/SD ít nhất 1 lần, lô ĐANG DÙNG hiện tại không bao giờ lọt
  vào tập so khớp. Phát hiện bằng cách gõ đúng số lô đang dùng của "Kali"
  vào ô tìm kiếm và thấy 0 kết quả dù dữ liệu đúng — sửa bằng cách LUÔN
  cộng thêm mốc hiện tại vào danh sách so khớp thay vì chỉ dùng khi rỗng.

**5. Danh mục xét nghiệm — 3 mục.**
- **TEa âm** giờ bị chặn rõ ràng (`invalid-tea`, "TEa không được âm.") thay
  vì âm thầm `Math.max(0,...)` — port `validateAssay()` app cũ.
- **CUSUM k/h ≤0 hoặc không phải số** rơi về ĐÚNG mặc định (k=0.5, h=4,
  khớp giá trị tạo mới) thay vì clamp về 0 (vô nghĩa hoá CUSUM mà không báo
  gì) — thêm hàm `cusumParam()` trong `prepareTest()`.
- **Auto-fill Khoa/Khu vực khi mở modal "Thêm xét nghiệm"**: select Máy
  không có option rỗng nên trình duyệt tự chọn máy ĐẦU TIÊN khi tạo mới —
  ô Khoa/Khu vực giờ điền sẵn theo `instruments[0]?.section` ngay lúc mở,
  thay vì để trống chờ `onChange`, port `openConfigAssayModel()` app cũ.

**6. Bảng TEa tham chiếu — 4 mục.**
- **"Nguồn chính" đổi từ input tự do sang `<select>` đóng 6 giá trị** —
  port `TEA_LAB_BASIS_SOURCES` app cũ nguyên văn (regulation/pt/eflm/ricos/
  professional/other + nhãn tiếng Việt). Domain thêm `TEA_LAB_SOURCES`
  (danh sách hợp lệ, validate chặn `invalid-source`) và
  `TEA_LAB_SOURCE_LABELS` (nhãn dùng để ghi audit log đọc được) trong
  `tea-ref-validation.ts`; renderer giữ bản riêng cùng 6 nhãn để dựng
  `<select>` (theo đúng quy ước "mỗi lớp giữ hằng số riêng" đã dùng cho
  `STATUS_TEXT` ở TransitionsTab).
- **Thêm IPC `removeTeaLabProfile`** — xoá RIÊNG hồ sơ TEa PXN, khác
  `removeTeaRef` (xoá cả dòng analyte): trước đây analyte có sẵn trong danh
  mục built-in KHÔNG có đường nào xoá hồ sơ PXN, chỉ "Khôi phục" (chỉ xoá
  CLIA/Ricos% ghi đè, giữ nguyên hồ sơ PXN). Hàm mới chỉ xoá 5 cột `lab*`,
  và xoá LUÔN cả dòng nếu sau đó dòng không còn `clia`/`ricos` VÀ không có
  `abbreviation`/`matrix` (2 cột chỉ được ghi qua `addTeaAnalyte()` — tín
  hiệu phân biệt "analyte tự thêm" mà không cần main biết tới danh mục
  catalog phía renderer). Nút "Xóa TEa chuẩn hóa" thêm vào footer modal, ẩn
  khi chưa có hồ sơ (`current.lab==null`).
- **Thứ tự ưu tiên trạng thái bị đảo**: `kind = labRef?.lab!=null ? 'lab' :
  hasOverride ? 'override' : 'default'` — SAI thứ tự, khi một dòng VỪA có
  override CLIA/Ricos% VỪA có hồ sơ PXN thì hiện "TEa PXN" thay vì "Đã sửa".
  Port đúng `teaReferenceKind()` app cũ (kiểm `override` TRƯỚC `lab`).
- **Audit log `saveTeaRef` chỉ ghi "Cập nhật X"/"Tạo X"** — không có gì để
  đối chiếu tuân thủ dù mọi trường đã có sẵn lúc lưu. Port đúng
  `saveLabProfile()` app cũ: `detail` giờ có đủ tên/giá trị cũ→mới/nguồn
  (nhãn tiếng Việt)/tham chiếu/ngày hiệu lực (dd/mm/yyyy)/người xây dựng/
  người duyệt kèm ngày duyệt/ngày xem xét lại (nếu có)/lý do; `action` phân
  biệt "Thiết lập TEa chuẩn hóa" (lần đầu) vs "Cập nhật TEa chuẩn hóa".

**Sửa test cũ vì lý do đúng, không phải để cho xanh**: `manage-validation
.test.mjs` từng khoá `tea:-1` phải LUÔN `ok:true` và tự động kẹp về 0 —
đúng bug vừa sửa, nên đổi kỳ vọng thành `invalid-tea`, thêm case CUSUM mặc
định. `tea-ref-validation.test.mjs`'s `BASE.labSource:'CLIA 2024'` và
`config-lots-handlers.test.mjs`'s `labSource:'CLIA 2024'`/`mock-parity
.test.mjs`'s 4 chỗ `labSource:'CLIA'` đều là chuỗi KHÔNG nằm trong danh
sách đóng mới — đổi thành `'regulation'` (khớp đúng ý định "CLIA/quy định"
ban đầu của test), thêm 1 case mới pin riêng `invalid-source`.
`config-lot-lifecycle.test.mjs`'s 2 chỗ khoá `status:'active'` của NHÓM LÔ
(từ đợt sửa mô hình trạng thái trước) đổi thành `status:''` +
`inUse:true` — nhắc lại đúng, không phải lỗi mới.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 34/34 (`mock-parity`
lên 145 bước — thêm 4 bước exercising `removeTeaLabProfile` cả 2 nhánh
`removedRecord` true/false), `app-v2:build` sạch, `app-v2:css-parity` 0,
`app-v2:ui-parity` 79/79, `app-v2:style-parity` 18/18, cộng xác nhận từng
mục trong trình duyệt thật qua `window.qcApi` VÀ thao tác UI thật: trùng lô/
trùng nhóm lô/đổi mức lô đang dùng đều bị chặn đúng mã lỗi; nhóm mới không
đụng gì tới lô đã hết dùng trong modal (checkbox `disabled` + tooltip);
dropdown chuyển tiếp lô loại đúng 4 lô đã hết dùng (1101/2101/RUN-1/RUN-2);
xoá hồ sơ chuyển lô ghi đúng "AUDITX · Mức 1 → AUDITY · Mức 1"; TEa âm/
CUSUM ≤0 xử lý đúng; gõ "2111" vào ô tìm kiếm Lịch sử dữ liệu ra đúng
"Kali" (xét nghiệm đang dùng lô đó); modal TEa hiện đúng `<select>` 6
nguồn + nút "Xóa TEa chuẩn hóa" cho analyte built-in "Sodium", bấm xoá
đúng: hồ sơ PXN mất, override CLIA vẫn còn, badge đổi đúng "Đã sửa" (không
còn "TEa PXN") — khớp thứ tự ưu tiên vừa sửa.

**Toàn bộ danh sách audit 6-agent (~30 mục ban đầu) nay đã sửa hết**, trừ 2
giới hạn kiến trúc đã ghi từ trước (danh mục TEa tích hợp rút gọn 77
analyte; phạm vi luật Westgard within/across lưu được nhưng engine chưa
thực thi khác nhau) — cả hai cần một đợt riêng lớn hơn, không phải bug.

**3 tinh chỉnh UX tab Lô & Nhóm QC theo phản hồi trực tiếp (2026-09-04).**

1. **Sắp xếp thẻ nhóm lô — nhóm đang hoạt động lên đầu.** `LotsTab.tsx`
   trước đây hiện thẳng thứ tự trả về từ `listLotGroups()` (theo tên) — một
   nhóm "Đã lưu trữ" xen giữa các nhóm đang dùng thật, dễ bị bỏ sót. Thêm
   `groupSortPriority()` (0=đang hoạt động, 1=dự kiến/chưa dùng, 2=đã dừng,
   3=đã lưu trữ) và sort trước khi `.map()`, dùng `[...lotGroups].sort()`
   (không mutate mảng gốc từ store).
2. **"Đã chuyển tiếp" không nói lô cũ đi ĐÂU.** Cột "Trạng thái" của bảng Lô
   QC chỉ ghi chung chung "Đã chuyển tiếp" cho lô đã hết dùng — người dùng
   phải tự mở tab "Chuyển tiếp lô" để tra xem nó thành lô nào. Port
   `transitionToNo()` app cũ: `lotStatus()` (`shared.tsx`) nhận thêm tham số
   `toLotNo` tuỳ chọn, in "Đã chuyển tiếp qua lô X" khi tra được (hồ sơ
   chuyển tiếp đã `accepted`), giữ nguyên câu cũ khi không tra được.
   `LotsTab.tsx` thêm `transitionToNo(lotId)` (tra `lotTransitions` đã có
   sẵn từ `ManagePage.tsx`'s load trung tâm, không cần load thêm).
3. **Dropdown "Nhóm lô QC" ở tab Mean/SD hiện cả nhóm đã lưu trữ/đã dừng.**
   Đây là nơi GÁN Mean/SD, không phải nơi quản lý vòng đời nhóm lô (khác tab
   "Lô & Nhóm QC", nơi vẫn cần thấy MỌI nhóm để kích hoạt lại/xoá) — một
   nhóm đã lưu trữ/dừng không còn là đích gán hợp lý. `TargetsTab.tsx` lọc
   `lotGroups = allLotGroups.filter(g => g.active!==0 && g.status!=='stopped')`
   trước khi dùng cho dropdown/`selectedGroup`/mặc định chọn; "Dự kiến"/
   "Chưa dùng" vẫn hiện vì đây chính là nơi gán Mean/SD LẦN ĐẦU cho một
   nhóm mới. Effect chọn mặc định cũng đổi từ "chỉ set khi rỗng" sang "set
   lại nếu giá trị đang chọn không còn nằm trong danh sách lọc" — tự chuyển
   sang nhóm hợp lệ nếu nhóm đang xem vừa bị lưu trữ/dừng ở nơi khác.

Verify: `npm run app-v2:typecheck`/`test` 34/34/`build` sạch, `app-v2:css-
parity` 0, `app-v2:ui-parity` 79/79, `app-v2:style-parity` 18/18, cộng xác
nhận trong trình duyệt thật: thẻ "Đang hoạt động" (1111/1102, 2101/2102)
lên trước thẻ "Đã lưu trữ" (1101/1102); bảng Lô QC hiện đúng "Đã chuyển
tiếp qua lô 1111"/"qua lô 2111"/"qua lô CAND-1"/"qua lô CAND-2" cho từng lô
đã hết dùng; dropdown Mean/SD chỉ còn "1111/1102"/"2101/2102", không còn
"1101/1102".

**Thẻ "Đã lưu trữ" mất 1 lô — chỉ còn đúng lô đã chuyển tiếp, thiếu lô
KHÔNG chuyển tiếp trong cùng nhóm cũ (2026-09-04).** Người dùng chỉ vào ảnh
chụp thẻ "1101/1102" (Đã lưu trữ) chỉ hiện 1 chip "1101 · M1", thiếu hẳn
"1102 · M2" dù tên thẻ vẫn ngụ ý đủ 2 lô.

**Nguyên nhân — lệch mô hình dữ liệu, không phải thiếu code hiển thị.** Tra
lại đúng `applyAcceptedLotTransition()` app cũ
(`src/application/manage/manage-config-service.ts:260`): nhóm LƯU TRỮ được
tạo với `lotIds: oldIds` — **NGUYÊN VẸN mọi thành viên CŨ của nhóm** (cả
1101 VÀ 1102), không chỉ lô vừa chuyển tiếp. App cũ làm được vậy vì
`lotIds` chỉ là 1 mảng id không loại trừ lẫn nhau — lô 1102 nằm trong CẢ
HAI mảng (`lotIds` của nhóm lưu trữ VÀ nhóm đang hoạt động) cùng lúc, không
sao cả. app-v2 dùng khoá ngoại thật (`qc_lots.group_id`, "1 lô chỉ thuộc 1
nhóm tại 1 thời điểm") — cascade "Chấp nhận" (đã port ở mục "SỬA LẠI mục
'Chấp nhận'..." phía trên) chuyển `group_id` của 1102 SANG nhóm đang hoạt
động thật sự (đúng, vì 1102 vẫn cần thuộc về MỘT nhóm sống để dùng cho
Mean/SD), nên nó không còn được đếm khi `listLotGroups()` derive `lotIds`
SỐNG của nhóm lưu trữ qua `SELECT id FROM qc_lots WHERE group_id=?` — nhóm
lưu trữ chỉ còn đúng lô KHÔNG di chuyển đi đâu (1101).

**Sửa: thêm 1 cột lưu ẢNH CHỤP thành viên tại thời điểm lưu trữ, tách biệt
với khoá ngoại sống.**
- Schema: `lot_groups.archived_lot_ids_json TEXT NOT NULL DEFAULT ''` — `''`
  = không có ảnh chụp (mọi nhóm ĐANG hoạt động, `listLotGroups()` vẫn derive
  `lotIds` từ `qc_lots.group_id` SỐNG như cũ); chỉ nhóm do cascade "Chấp
  nhận" tạo ra mới có giá trị khác rỗng. Vì `CREATE TABLE IF NOT EXISTS`
  không tự thêm cột vào DB đã tồn tại trên đĩa, thêm kèm 1 bước `ALTER
  TABLE` idempotent trong `applySchema()` (cùng khuôn với `tests.active` đã
  có sẵn — kiểm `PRAGMA table_info` trước khi `ALTER`).
- Cascade "Chấp nhận" (`config-handlers.ts`): chốt
  `JSON.stringify(members.map(m=>m.id))` — TOÀN BỘ thành viên cũ đọc được
  NGAY TRƯỚC khi tách nhóm (biến `members` đã có sẵn từ bước tính tên tự
  sinh) — vào cột mới của dòng nhóm lưu trữ vừa `INSERT`.
- `listLotGroups()`: nếu `archived_lot_ids_json` khác rỗng thì `lotIds` trả
  về = ảnh chụp đã parse (không phải derive sống); `inUse` vẫn tính từ
  danh sách SỐNG (không ảnh hưởng, nhóm lưu trữ luôn hiện "Đã lưu trữ" bất
  kể `inUse`). Mirror đầy đủ trong `renderer/browser-mock/api.ts` (cả cascade
  lẫn `listLotGroups`), và `saveLotGroup`'s mock thêm field này vào row object
  (giữ nguyên giá trị cũ khi sửa, `''` khi tạo mới) để khớp hình dạng `SELECT
  *` thật — thiếu field này làm `tests/mock-parity.test.mjs` báo lệch ngay
  (đã chứng minh: chạy thử trước khi thêm field vào mock, gate báo đúng
  "2 !== 0" tại đúng bước `nhom-lo-list`).
- Sửa lại kỳ vọng SAI trong `config-lot-lifecycle.test.mjs`: dòng
  `assert.deepEqual(archivedGroup.lotIds, [groupLotA.id], ...)` từng khoá
  ĐÚNG bug này (chỉ mong đợi 1 lô) — đổi thành mong đợi CẢ 2 lô gốc
  (`[groupLotA.id, groupLotB.id]`), giữ đúng Ý ĐỊNH bài test (nhóm lưu trữ
  phải giữ nguyên trạng thái cũ) thay vì nới lỏng.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 34/34, `app-v2:build`
sạch, `app-v2:css-parity` 0, `app-v2:ui-parity` 79/79, `app-v2:style-parity`
18/18, cộng dựng lại kịch bản THẬT qua `window.qcApi` (nhóm 2 lô mới, gán
Mean/SD cho 1 lô, chuyển tiếp lô đó sang lô thứ 3, "Chấp nhận") rồi đọc lại
giao diện: thẻ "Đã lưu trữ" hiện đúng CẢ HAI chip lô gốc
("VERIFY-A · M5"/"VERIFY-B · M5"), không còn thiếu lô không chuyển tiếp.

**Bảng "Lịch sử dữ liệu" tràn ngang — cột "Chi tiết" bị đẩy ra ngoài khung
nhìn, phải cuộn ngang mới thấy (2026-09-04).** Người dùng chỉ ra bảng bị cắt
mất cột cuối; hỏi lại có phải do đang xem qua Electron không — không phải,
tái hiện được ngay trên trình duyệt (port 5174).

**Nguyên nhân — lỗi số học trong CSS, không phải do màn hình hẹp.**
`.history-table` (`manage.css`) đã có `table-layout:fixed` (kế thừa từ rule
dùng chung `.rcfg-list>table`), nhưng khối `width:%` RIÊNG cho 10 cột của
bảng này (thêm ở một đợt trước) chỉ khai đủ 9 cột, **cộng lại đã 104%**
(8+16+11+11+11+11+15+10+11), không còn % nào cho cột 10 ("Chi tiết") —
`table-layout:fixed` phân bổ cột không có width khai báo về gần 0, nút
"Chi tiết" (nội dung tối thiểu ~54px) buộc phải TRÀN ra ngoài bảng thay vì
được cấp chỗ, kéo `table.scrollWidth` (822px) vượt hẳn `offsetWidth` (768px)
dù bảng đã "fixed layout, width:100%". Đo trực tiếp qua DOM
(`getBoundingClientRect`/`scrollWidth` từng ô) xác nhận chính xác cột nào
đang bị bóp về 0 trước khi sửa, không đoán.

**Sửa: chốt lại đủ 10 cột = 100%, port nguyên % từ `assets/professional-
config.css`** (1:6% · 2:17% trái · 3:9% · 4:9% · 5:10% · 6:8% · 7:17% ·
8:8% · 9:7% · 10:9%) — đây chính là bộ % GỐC của app cũ cho bảng này, bản
port trước không lấy đủ (chỉ 9/10 cột, sai tổng). Không cần đổi
`table-layout`/cấu trúc HTML gì khác — chỉ là bảng cộng thức % bị thiếu 1
cột.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 34/34 (CSS thuần,
không hàm nào đổi), `app-v2:build` sạch, `app-v2:css-parity` 0,
`app-v2:ui-parity` 79/79, `app-v2:style-parity` 18/18 (không surface nào
vượt baseline), cộng đo trực tiếp qua DOM trong trình duyệt thật:
`table.scrollWidth` (768) giờ khớp `offsetWidth` (768, không còn tràn), cột
"Chi tiết" có `clientWidth` 69px — hiện đủ trong khung nhìn ở đúng độ rộng
panel trước đây bị cắt (768px), không cần cuộn ngang nữa.

**Modal "Chi tiết" (Lịch sử dữ liệu) rộng SAI so với app cũ, cùng đợt
(2026-09-04).** Người dùng mở modal này và so trực tiếp với app cũ, thấy độ
rộng không khớp.

**Nguyên nhân**: `HistoryTab.tsx` gọi `<Modal ... width={860}
className="rcfg-history-detail-modal" .../>` — CSS thật đã có sẵn đúng giá
trị app cũ (`.modal.rcfg-history-detail-modal{width:min(1160px,94vw);
max-width:94vw;}`, port từ trước), nhưng `Modal.tsx`'s prop `width` render
thành `style={{width}}` — **inline style luôn thắng CSS class bất kể thứ tự/
độ đặc hiệu** — nên modal bị ép cứng về 860px, đè lên đúng rule đã có sẵn
cho class riêng của nó. Đây là lỗi CODE (truyền dư 1 prop), không phải
thiếu CSS — rule CSS đúng đã tồn tại từ trước, chỉ là chưa bao giờ có hiệu
lực.

**Sửa**: bỏ hẳn `width={860}` khỏi lệnh gọi — đúng quy ước đã ghi ngay
trong comment đầu `Modal.tsx` ("mỗi modal thêm 1 class riêng... `className`
phục vụ đúng việc đó", `width` chỉ còn giữ cho các chỗ gọi CŨ chưa có class
riêng). Không đụng gì tới CSS.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 34/34, `app-v2:build`
sạch, `app-v2:css-parity` 0, `app-v2:ui-parity` 79/79, `app-v2:style-parity`
18/18, cộng đo trực tiếp qua DOM trong trình duyệt thật SAU khi mở modal:
`offsetWidth`/`getComputedStyle().width` đều ra đúng **1160px** ở viewport
1280px (`min(1160px,94vw)` — 94vw của 1280px là 1203px, 1160px nhỏ hơn nên
thắng), không còn `style="width:860px"` nào trên phần tử `.modal`.

**Rà soát trang Cấu hình chung — sửa 1 mô tả SAI đã lặp lại nhiều lần, tìm
ra 1 gap thật của TEa (2026-09-04, hoãn cùng đợt Six Sigma).** Người dùng
hỏi "Cấu hình chung đã ổn hết chưa" — xác nhận 8/8 tab đạt 0/0 ở cả 3 gate
(D3.4b), dọn 4 `surfaceNotes` lỗi thời trong `ui-parity-baseline.json`
(mô tả đúng ở D3.4 nhưng đã vá xong ở D3.4b: xoá xét nghiệm/panel, ma trận
Mean/SD, danh mục TEa — gate đã đo 0/0 từ lâu, ghi chú quên xoá).

Trong lúc đó phát hiện **mô tả "danh mục TEa app-v2 rút gọn 77 so với hàng
trăm của app cũ" là SAI**, lặp lại ở nhiều nơi (B1, D3.4, D3.6's
`surfaceNotes.sigma`) nhưng chưa từng được đối chiếu số liệu thật. Đếm trực
tiếp cả 2 phía: `root.TEA_ANALYTE_CATALOG` (`src/compat/modular-pilot.global.ts:2244-2320`)
có đúng **77** analyte; `app-v2/renderer/data/tea-catalog.ts` cũng **77**,
khớp từng tên/đơn vị/CLIA%/Ricos%. Không có gap về SỐ LƯỢNG.

Gap THẬT (mới tìm ra, chưa từng ghi): app cũ's catalog có thêm 2 trường
`cliaAbsolute`/`cliaAbsoluteUnit` cho ~9 analyte (Sodium, Calcium,
Creatinine, Glucose, ALT, AST, Bilirubin, GGT, HDL-C...) — giới hạn CLIA
dạng TUYỆT ĐỐI kèm đơn vị (Sodium = ±4 mmol/L), tách biệt với giới hạn %
thường (`clia`). Theo "Confirmed business-logic decisions" ở trên, khi đơn
vị xét nghiệm khớp đơn vị tiêu chí thì giá trị tuyệt đối này được quy đổi
sang % theo Mean thực và so với nhánh Ricos, lấy nhánh LỚN HƠN — app-v2's
`tea-catalog.ts` không có 2 trường này nên luôn chỉ dùng nhánh Ricos, ra TEa
(và do đó Sigma) khác app cũ cho đúng 9 analyte này (xác nhận bằng Sodium:
app cũ CLIA ±4.0000 mmol/L/Ricos 0.73% → Sigma -0.42/-0.17; app-v2 chỉ có
Ricos 0.73%). Đây là gap của Six Sigma (nơi TEa catalog được dùng để tự gợi
ý), không phải của chính trang Cấu hình chung — trang Cấu hình chung không
hiển thị `cliaAbsolute` ở đâu cả.

**Người dùng chốt 2026-09-04: hoãn, làm cùng đợt khi quay lại Six Sigma
(D3.6)** — không sửa riêng lẻ ở đây. Ghi lại trong
`ui-parity-baseline.json`'s `surfaceNotes.sigma` để không quên khi đợt đó
tới: cần thêm `cliaAbsolute`/`cliaAbsoluteUnit` vào `tea-catalog.ts` cho 9
analyte trên + hàm quy đổi tuyệt đối→% theo đơn vị khớp (đã có công thức
trong "Confirmed business-logic decisions").

**Six Sigma — chốt lại lớp giải TEa (2026-09-09).** Đã port các giới hạn
CLIA tuyệt đối còn thiếu từ `TEA_ANALYTE_CATALOG` (26 analyte, không phải 9
như ghi chú ban đầu) vào `renderer/data/tea-catalog.ts` và nối chúng vào
`renderer/lib/sigma-tea-core.ts`. Khi tạo kỳ, nguồn Lab/EFLM/CLIA/Ricos được
giải lại từ đúng nguồn hiện hành; đổi nguồn không tái sử dụng con số TEa còn
lại từ nguồn trước. Với CLIA, giới hạn tuyệt đối chỉ được đổi sang % nếu đơn
vị xét nghiệm khớp và có Mean QC khác 0; nếu đồng thời có giới hạn %, lấy
giới hạn lớn hơn. Thiếu Mean hoặc lệch đơn vị không bị "đoán" TEa — UI nêu
lý do. `tests/sigma-tea.test.mjs` khóa Sodium (±4 mmol/L ở Mean 100 = 4%),
nhánh thiếu Mean, lệch đơn vị, Ricos và Lab override.

2 mục còn treo có chủ đích khác của Cấu hình chung, không liên quan Six
Sigma: cột "Hành động" nâng cao của bảng luật Westgard (Cảnh báo/Loại bỏ
riêng từng luật — lưu được nhưng chưa nối vào engine, engine chưa hỗ trợ
mức độ theo từng luật) và modal chuyển tiếp lô thiếu lựa chọn "Dự kiến"
(staged, chỉ có Hủy/Chuyển — cần thiết kế schema riêng, đã ghi từ trước).

Verify: không đổi hành vi runtime (chỉ sửa tài liệu/ghi chú baseline), nên
không cần chạy lại test/build/gate.

**Rà soát sâu trang Nhập QC — 2 agent song song, 6 lệch nghiệp vụ + 6 lệch
CSS/DOM đều xác nhận bằng đọc thẳng mã nguồn thật (2026-09-04).** Không dùng
lại ghi chú cũ trong CLAUDE.md — đọc trực tiếp `entry-service.ts`/
`entry-page-controller.ts` (app cũ, TypeScript nhưng logic gần như y hệt bản
classic) và, quan trọng nhất, phát hiện `src/react/pages/EntryPage.tsx` —
bản REACT của CHÍNH app cũ (từ đợt "React island" độc lập với app-v2) —
**vẫn còn tồn tại**, cho JSX/DOM chuẩn xác thay vì phải suy luận ngược từ
CSS.

**6 lệch nghiệp vụ, xếp theo mức độ:**
1. **Hủy điểm QC mất hoàn toàn nhánh liên kết NCE.** App cũ's `voidPoint()`
   (`entry-service.ts:133-163`) phân loại lý do hủy thành 3 "kind":
   `analytical` (kết quả QC thực sự sai — LUÔN tự mở/dùng lại 1 hồ sơ NCE
   gắn đúng `pointId`, không bắt buộc gõ lý do), `data-entry` (nhập sai —
   LUÔN không mở NCE, không bắt buộc lý do), `other` (cần điều tra — người
   dùng tự bật/tắt mở NCE, bắt buộc lý do ≥5 ký tự). Cột `void_kind`/
   `void_requires_rerun` **đã có sẵn trong schema `qc_points` từ đầu**
   (`main/db/schema.ts`) nhưng chưa handler nào từng ghi — một lỗ hổng kiểu
   "thiếu wiring" y hệt lớp lỗi đã gặp nhiều lần trước đây. Port đủ:
   `entry-validation.ts` thêm `voidNceChoice(kind)` (hàm THUẦN, renderer
   import thẳng để dựng UI, cùng nguyên tắc "renderer dùng lại domain thuần
   của main" đã dùng cho `normalizeTargetPick`/`page-roles.ts`);
   `entry-handlers.ts`'s `voidPoint()` viết lại: đọc luật Westgard/loại sai
   số (`errorType()`, `westgard-rules.ts`) của CHÍNH điểm đang huỷ TRƯỚC khi
   đánh dấu voided (vì `queryPoints()` chỉ tính verdict cho điểm chưa huỷ),
   tìm NCE đang mở gắn `point_id` đó để DÙNG LẠI (không tạo trùng) hoặc tạo
   mới với `correction` tự sinh + `dueDate`=+7 ngày. Renderer: modal "Hủy
   điểm QC" thêm `<select>` 3 loại (đúng 3 `<option>`/nhãn của
   `entry-void-modal-html.ts` — file này VẪN còn cổ điển, chỉ dùng để đối
   chiếu câu chữ, không đụng vào) + checkbox "Lập hồ sơ NCE..." tự khoá theo
   kind + thông báo kết quả phân biệt "mở hồ sơ mới"/"dùng lại hồ sơ đang
   mở"/"không yêu cầu NCE".
2. **Cổng "nhóm lô còn vận hành" khi ghi điểm QC (hoàn tất siết đầy đủ
   2026-09-06).** App cũ chặn CẢ 2
   lớp (`entry-page-controller.ts:478,504`, `canEnterQcForLevel()` →
   `operational-access.ts`/`lot-group-status.ts`'s `qcLotGroupOperational()`
   = `active!==false && status!=='stopped' && status!=='planned'`) —
   `entry-handlers.ts`'s `addPoint()` trước đây KHÔNG tra `lot_groups` chút
   nào, nên nút "Dừng" nhóm lô ở Cấu hình chung chưa từng có tác dụng thật ở
   trang Nhập QC. Bản hoàn thiện hiện port ĐẦY ĐỦ `canEnterQcForLevel()` vào
   main: xét nghiệm phải còn hoạt động, thuộc Panel QC đang hoạt động, và
   CHÍNH mức đang nhập phải gắn lô thuộc nhóm còn vận hành. Vì cổng nằm trong
   `entry-handlers.ts`, renderer, LIS và mọi lời gọi IPC trực tiếp đều có
   cùng ranh giới; browser mock mirror đúng điều kiện này. Bộ test cũ dùng
   Mean/SD trần đã được chuyển sang fixture cấu hình Panel + nhóm có ≥2 lô,
   đồng thời `entry-handlers.test.mjs` chốt trường hợp thiếu cấu hình phải trả
   `level-not-operational`.
3. **Kết luận NGÀY trên bảng worksheet tính theo "tệ nhất trong mọi lần
   chạy" thay vì "lần chạy CUỐI CÙNG không bị loại" của mỗi mức** (port sai
   `summarizeRunStatus()`, `entry-service.ts:60-77`). Hậu quả: chạy lại QC
   sau khi bị loại và đạt, app-v2 vẫn hiện cả ngày là "Loại bỏ" — sai lệch
   hồ sơ tuân thủ. Sửa: với mỗi mức, lấy điểm cuối KHÔNG rej của ngày (rơi
   về điểm cuối cùng nếu mọi lần đều rej), rồi mới gộp `warnRules`/
   `rejRules`/`worst` từ các đại diện đó — khớp đúng thuật toán app cũ.
4. **Không tự mở ô nhập bổ sung khi lần chạy gần nhất trong ngày bị loại
   bỏ** (`shouldShowEmptyRun()`, `entry-page-controller.ts:286-295`) — app
   cũ chủ động nhắc "chạy lại ngay" mà không cần bấm "+ Thêm". Sửa: `runs[
   runs.length-1].verdict==='rej'` tự đưa `extraOpen=true`, ẩn nút "+ Thêm"
   tương ứng (cùng logic `!emptyShown` app cũ).
5. **Công thức CV% thiếu `Math.abs(mean)`** ở 2 chỗ `EntryPage.tsx` tự viết
   tay (domain `westgard-engine.ts`'s `stats()` đã đúng từ đầu, chỉ 2 bản
   sao chép tay trong trang là sai) — lộ ra khi Mean âm (vd base excess),
   CV% bị đảo dấu. Sửa cả 2 chỗ.
6. **Ghi chú theo ngày không kế thừa khi thêm điểm mới cùng ngày** — app cũ
   luôn tìm ghi chú của điểm khác cùng ngày/xét nghiệm gán cho điểm mới
   (`addPoint()`, dòng dựng `dayNote`); `entry-handlers.ts` để trống. Sửa
   bằng 1 `SELECT ... LIMIT 1` trước khi INSERT.

Mirror đầy đủ cả 6 mục (trừ mục 1 phần renderer, vốn không có ở mock) trong
`renderer/browser-mock/api.ts`; `tests/mock-parity.test.mjs` mở rộng lên
**149 bước** (thêm kịch bản kind=analytical tự mở NCE, kind=data-entry
không mở NCE) — nhân tiện phát hiện **2 bước cũ (`void-thieu-ly-do`/
`void-ok`) đặt sai `pointId` ở top-level `id` thay vì trong `data`**, khiến
cả 2 bước luôn ra `missing-point` bất kể lý do đúng/sai — chưa từng kiểm
đường THÀNH CÔNG thật của `voidPoint` qua đối chiếu mock/real; sửa lại vị
trí đúng.

**6 lệch CSS/DOM, đều thuộc điểm mù của 3 gate tự động (không phải class
thiếu — mọi class liên quan đều "có rule", chỉ sai NGỮ CẢNH/THỨ TỰ/nội dung
thêm mà gate không đo):**
1. **`.entry-tree-head h4` bị rule "header phụ dùng chung" đè** — cùng độ
   đặc hiệu (1 class+1 thẻ) với nhánh `.tree h4` của rule dùng chung
   (`entry.css`'s `.qc-table-card h4,.lj-mini-h,.tree h4,.sg-chart-box>h3`,
   khai SAU), thắng theo thứ tự nguồn: tiêu đề cây mất màu teal, có thêm nền/
   viền không mong muốn. Sửa bằng cách di chuyển `.entry-tree-head h4` xuống
   SAU rule dùng chung trong file (khớp đúng cách app cũ tách 2 file
   `components.css`/`professional-entry.css`, không phải tăng độ đặc hiệu).
2. **`.qc-table-card h4` khai 2 lần xung đột nhau** — bản khai riêng (dòng
   dưới, cho sticky column header) LẶP LẠI background/border-bottom/margin/
   padding/font-size đã có ở rule dùng chung, đến sau nên đè mất giá trị
   đúng (font-size 14px→13px). Sửa: bản khai riêng chỉ còn đúng phần app cũ
   THẬT SỰ khai riêng (`position/left/z-index/display/align-items/
   box-sizing/width`), không lặp lại phần đã có ở rule dùng chung.
3. **Thiếu `min-width:620px`** cho `.qc-table-card h4/table` + `.qc-cumulative`
   (`professional-entry.css:426-428`) — card "Điểm trong khoảng xem" có thể
   co dưới 620px trong `.qc-table-grid`'s `auto-fit(360px)` thay vì tự cuộn
   ngang như app cũ. Đã thêm.
4. **`.qc-table-grid{gap}` dùng nhầm token** `--gap-panel`(16px) thay vì giá
   trị đúng 14px (`professional-entry.css:119-121`, cùng `--space-section`
   đã dùng cho margin ngay cạnh nó). Đã sửa dùng chung 1 token.
5. **2 nút mở/thu cây danh mục dùng ký tự văn bản ("☰"/"⟨") thay icon SVG** —
   nội dung app-v2 TỰ THÊM, chưa từng tồn tại ở app cũ (`TreeIcon()` thật ở
   `src/react/pages/EntryPage.tsx:18-24` là 1 SVG rect+line) — đúng chiều mà
   gate `ui-parity` (chỉ đo "cũ có mà v2 thiếu") không bắt được. Port
   nguyên SVG + đủ `aria-label`/`aria-controls`/`aria-expanded`, sửa luôn
   title bị cắt ngắn ("Ẩn danh mục" → "Ẩn danh mục nội kiểm").
6. **Tooltip cột `.qc-level-head` vỡ hoàn toàn** — CSS có `cursor:help` +
   gạch chân chấm (hứa hẹn tooltip) nhưng JSX KHÔNG hề gán `data-qc-tooltip`,
   và CSS thiếu hẳn khối `::after`/`:hover`/`:focus-visible` vẽ bong bóng
   (`professional-entry.css:190-209`) — di chuột/focus vào không hiện gì,
   đúng dạng "control chết về hiển thị" mà không gate nào bắt vì
   `.qc-level-head` vẫn "có rule". Thêm tính `tooltip` (Mean/SD/±2SD) ngay
   trong JSX + port đủ khối CSS vẽ bong bóng.

Cũng bọc lại 1 lỗ hổng phát hiện khi sửa mục nghiệp vụ #2 (gate nhóm lô mới
làm lộ rõ hơn): `commitRun()`/`RunSlot` trước đây bỏ qua HOÀN TOÀN kết quả
`addPoint` — lưu thất bại (kỳ đã khoá, hoặc nhóm lô đã dừng) không hiện gì
VÀ ô nhập tự xoá trắng như đã lưu thành công, mất luôn giá trị vừa gõ. Sửa:
`commitRun` trả `Promise<boolean>`, `RunSlot` chỉ xoá ô khi lưu thành công,
lỗi thật hiện qua `pointErr` (banner `.alert warn` đầu trang, cùng vị trí
`noteErr`/`voidMsg`).

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 34/34 (mở rộng
`entry-handlers.test.mjs` — kind=analytical tự mở NCE đúng rule/errorType/
qcVerdict của điểm, kind=data-entry không mở gì, kind=other thiếu lý do bị
chặn rồi qua khi đủ + tự chọn openNce, điểm đã có sẵn NCE thủ công gắn đúng
`point_id` thì HUỶ VỚI kind=analytical phải DÙNG LẠI hồ sơ đó chứ không tạo
trùng, và nhóm lô "Dừng" chặn đúng `addPoint` sau khi trước đó vẫn nhận bình
thường; `mock-parity` 149 bước), `app-v2:build` sạch, `app-v2:css-parity`
đạt (0 class thiếu rule), `app-v2:ui-parity` 79/79 (entry vẫn đúng 0/0 cả 4
viewport, không đổi so với D3.5 dù thêm SVG/tooltip/modal — nội dung/DOM chỉ
sửa bên trong, không đổi tập class), `app-v2:style-parity` 18/18 (entry vẫn
đúng 3/3 lệch đã biết trong baseline, không phát sinh thêm).

**Bug thật: cuộn trang kéo theo cả thanh điều hướng — `<aside>` dùng
`position:relative` thay vì `position:sticky` (2026-09-04).** Người dùng tự
phát hiện khi dùng thật ("cuộn trang nó cuộn luôn cả trang điều hướng").
Đối chiếu `assets/professional-base.css:19-20` (`aside{position:sticky;
top:0;height:100vh}`) với `app-v2/renderer/styles/app.css`'s `aside{}` (đợt
đầu chỉ ở base rule mang `position:relative`, ĐÃ ĐÚNG `sticky` ở nhánh
`@media(max-width:900px)` cho layout mobile — chỉ base/desktop bị bỏ sót)
xác nhận đúng lỗi. Vì `.head` (`PageHeader.tsx`, mọi trang) đã `position:
sticky;top:0` từ trước và hoạt động đúng, suy ra mô hình cuộn của app-v2
LUÔN LÀ "toàn trang (document) cuộn, từng phần tử tự dán bằng sticky" —
không phải "main tự cuộn nội bộ" (`main{overflow-y:auto}` không thực sự có
tác dụng, chỉ là khai báo trơ vì `main` không bị giới hạn chiều cao) — sửa
đúng 1 thuộc tính, không đổi gì cấu trúc grid. Đồng thời phát hiện thêm
**bảng `<table>` dùng chung toàn app thiếu `position:sticky` cho `<th>`**
(`assets/components.css:76`: `th{position:sticky;top:0;z-index:1}`, app-v2
chưa port) — thêm vào rule `th` dùng chung trong `app.css`, có lợi cho mọi
bảng dài nằm trong khung có scroll riêng (vd `.qc-table-card`).

**Rà soát tương tác bàn phím toàn app — 1 agent đọc `action-dispatcher.ts`/
`modal-focus-trap.ts` + grep `ArrowDown|ArrowUp|ArrowLeft|ArrowRight` xuyên
suốt `src/` (2026-09-04).** Xác nhận app cũ CHỈ có điều hướng mũi tên ở
trang Nhập QC (cây + bảng — gap đã biết, cố ý hoãn, xem mục "Rà soát sâu
trang Nhập QC" ở trên) — không có ở bất kỳ combobox/bảng/danh sách nào
khác. `DatePickerPopup` khớp đúng app cũ (Escape đóng, Enter ở ô năm, cả
hai bên đều KHÔNG có điều hướng mũi tên trong lưới ngày) — không cần sửa.

**Bẫy focus modal/dialog (`useFocusTrap.ts`) — cốt lõi đúng, vá 3 chi tiết
lệch với `modal-focus-trap.ts` app cũ:**
1. Selector `FOCUSABLE` thiếu `:not([disabled])` ở lượt tìm phần tử focus
   ĐẦU TIÊN khi mở (chỉ lọc disabled ở vòng lặp Tab, không phải lúc mở) —
   có thể focus nhầm vào 1 nút đang khoá lúc modal vừa mở.
2. Thiếu lọc phần tử đang ẩn (`offsetParent!==null`) — 1 input nằm trong
   nhánh `display:none` của form vẫn bị tính là focusable.
3. Không ưu tiên phần tử mang `autoFocus` — luôn lấy phần tử focusable đầu
   tiên theo thứ tự DOM, trong khi app cũ (`ModalOverlay.tsx:25`) ưu tiên
   `[autofocus]` trước. Gộp cả 3 vào 1 hàm `queryFocusable()` dùng chung
   (khớp tên/hợp đồng với bản cũ), dùng cho cả lượt focus đầu lẫn vòng lặp
   Tab — ảnh hưởng MỌI modal/dialog trong app vì đây là hook dùng chung.

**3 lỗi/thiếu tính năng liên quan tới bàn phím tìm thấy khi khảo sát, đã sửa
2, còn 2 báo lại (ngoài phạm vi bàn phím thuần túy, cần quyết định riêng):**
- **ĐÃ SỬA — Six Sigma: chọn dòng "kỳ" trong bảng hoàn toàn không hoạt
  động** (không phải chỉ thiếu bàn phím — thiếu CẢ chuột): app-v2 gán class
  `sg-period-selected` cứng vào kỳ MỚI NHẤT (`p.id===latestPeriod?.id`),
  không có `onClick`/`onKeyDown` nào, và CSS `.sg-period-row` cũng thiếu
  hoàn toàn rule hover/focus-visible/selected (`cursor:default` trơ) — nên
  dù có thêm handler thì cũng không ai biết bấm được. App cũ cho bấm vào
  BẤT KỲ dòng kỳ nào để xem lại Sigma/MU của kỳ đó ở 2 panel phía trên
  (`sgSelectPeriod`, `sigma-page-controller.ts:181-187`), không cố định vào
  kỳ mới nhất. Thêm state `selectedPeriodId` (reset về `null` — rơi về
  `latestPeriod` — mỗi khi đổi xét nghiệm), đổi mọi chỗ đọc `latestPeriod`
  trong 2 panel "Tình trạng"/MU cùng nút "Bias EQA%" sang `displayPeriod`
  (`= periods.find(id) || latestPeriod`), thêm `onClick`/`onKeyDown` lên
  `<tr>` (mẫu "self-only + closest(button,input,select)" đã dùng ở Reagent/
  Manage), port đủ 5 rule CSS còn thiếu từ `professional-sigma.css:69-86`.
- **ĐÃ SỬA — 2 modal Enter-to-submit**: ô "Tên hóa chất mới"/"Đơn vị" trong
  modal "Chọn phép so sánh" (So sánh hóa chất) và ô mật khẩu mới trong modal
  "Đặt lại/Đổi mật khẩu" (Người dùng, dùng chung cho cả tự đổi lẫn admin
  reset) thiếu `onKeyDown` Enter gọi thẳng hàm submit đã có sẵn qua nút —
  app cũ có (`data-keydown-keys='["Enter"]'`), chỉ 1 dòng mỗi chỗ.
- **CHƯA SỬA, báo lại — Avatar (`PageHeader`, cả 11 trang) mất TOÀN BỘ tính
  năng "Đổi ảnh đại diện", không riêng bàn phím**: app cũ's avatar là
  `role="button" tabIndex={0}` với `onClick`+`onKeyDown` mở modal đổi ảnh
  (`src/react/components/PageHeader.tsx:18-27`); app-v2's avatar chỉ còn
  `aria-hidden="true"`, không click được, không có modal nào — và xác nhận
  bằng cách grep TOÀN BỘ `app-v2/`: KHÔNG có cột `avatar` trong schema
  `users`, KHÔNG có IPC nào liên quan. Đây không phải thiếu 1 handler mà
  thiếu CẢ TÍNH NĂNG từ backend (schema + IPC + validate) tới UI (modal
  upload/resize ảnh, tương tự logo ở Cài đặt) — quy mô lớn hơn hẳn phạm vi
  "bàn phím", cần quyết định riêng có làm hay không trước khi động vào.
- **CHƯA SỬA, báo lại — "Chọn nhanh" (Người thực hiện/Loại mẫu) ở So sánh
  hóa chất biến mất hoàn toàn**: app cũ có modal chọn nhanh từ danh sách giá
  trị đã lưu + Enter-để-thêm mới (`rcOpenQuick`/`rcAddQuick`,
  `reagent-quick-picker-modal-html.ts`); app-v2 chỉ còn 2 ô nhập text trơn
  (class `rc-quick-field` còn giữ nhưng không có picker/modal nào đứng sau).
  Cùng loại "thiếu cả tính năng" như avatar, không phải chỉ thiếu bàn phím.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 34/34 (không cần test
Node mới — toàn bộ thay đổi là CSS/React renderer, không đổi hợp đồng IPC/
domain nào), `app-v2:build` sạch, `app-v2:css-parity`/`app-v2:ui-parity`
79/79/`app-v2:style-parity` 18/18 đều đạt, không surface nào vượt baseline
(kể cả `sigma` vẫn đúng 7/32 đã biết, xác nhận thêm `tabIndex`/`aria-selected`/
`onClick`/`onKeyDown` không đổi tập class hay nội dung chữ mà gate đo).

**Làm nốt 2 tính năng đã báo lại ở trên: Avatar + "Chọn nhanh" (2026-09-04).**
Người dùng chốt làm luôn cả hai, không để lại nữa.

1. **Đổi/xoá ảnh đại diện** — port đủ `avatar-modal-controller.ts`/
   `user-avatar-command.ts` app cũ. Cột `users.avatar` MỚI THÊM (app-v2 chưa
   từng có, không như `page_perms_json`/`initials` đã có sẵn từ đầu) —
   `TEXT NOT NULL DEFAULT ''` + `ALTER TABLE` idempotent (cùng khuôn
   `archived_lot_ids_json`). IPC `auth:setAvatar`/`auth:clearAvatar` LUÔN tự
   phục vụ (chỉ `actor.userId`, không nhận id người khác) — khớp app cũ:
   đổi ảnh đại diện không phải thao tác quản trị, không qua `updateUser`.
   `AvatarModal.tsx` (mới) resize canvas 160×160 fit-cover (phóng ảnh phủ
   hết khung rồi canh giữa — khác logo ở Cài đặt, nơi CẮT theo cạnh ngắn
   nhất) trước khi gửi lên, đúng `avatar-modal-controller.ts`'s
   `pickAvatar()`. `PageHeader.tsx`'s avatar quay lại `role="button"
   tabIndex={0}` + onClick/onKeyDown (Enter/Space) mở modal — trả lại đúng
   hành vi bàn phím đã báo mất ở mục "Rà soát tương tác bàn phím toàn app"
   phía trên. `validateSetAvatar()` chỉ chặn chuỗi không phải
   `data:image/...` + ngưỡng an toàn 500KB (canvas 160×160 thật không bao
   giờ chạm ngưỡng này, chỉ chặn request tự dựng gửi thẳng IPC).
   **Bug thật bắt được ngay khi thêm cột**: `migrate-legacy.ts`'s ánh xạ
   `users` chưa gán `avatar` → `table-io.ts`'s `restoreAllTables()` bind
   `null` cho MỌI field vắng mặt trong bản ghi đã ánh xạ (không để SQLite tự
   dùng `DEFAULT`), vi phạm `NOT NULL` — `migration-handlers.test.mjs` đỏ
   ngay lập tức. Sửa bằng cách ánh xạ tường minh `avatar` trong
   `migrate-legacy.ts` (không qua `cleanText()` — có giới hạn độ dài, sẽ cắt
   cụt giữa 1 data URL base64 làm hỏng ảnh). Đây là lớp lỗi CHUNG cho mọi
   cột `NOT NULL` thêm sau này qua `ALTER TABLE`: phải cập nhật cả
   `migrate-legacy.ts`'s row-builder tương ứng, không chỉ thêm cột — gate
   test tự bắt được, không phải suy luận trước.
2. **"Chọn nhanh" người thực hiện/loại mẫu** (So sánh hóa chất) — port
   `ensureQuickList`/`addQuick`/`removeQuick` app cũ
   (`reagent-comparison-service.ts`): 1 danh sách CHUNG cho toàn app (không
   theo từng phép so sánh), loại mẫu có sẵn 3 giá trị mặc định, người thực
   hiện bắt đầu rỗng. Lưu ở `app_meta` (2 key `reagent_quick_operator`/
   `reagent_quick_sampleType`, JSON array) — cùng cơ chế đã dùng cho
   `activityAnchor`/cấu hình LIS, vì đây chỉ là gợi ý nhập liệu, không phải
   dữ liệu QC, không cần bảng riêng. 3 IPC mới: `listReagentQuickValues`
   (đọc), `addReagentQuickValue`/`removeReagentQuickValue` (`requireWrite`,
   admin+KTV — cùng mức với các thao tác dữ liệu QC hằng ngày khác). Thêm
   trùng (so khớp không phân biệt hoa/thường/dấu, `searchKey()` port nguyên
   app cũ) trả lại đúng giá trị đã có, không tạo dòng giống nhau.
   `QuickPickerModal.tsx` (mới) + `ReagentToolIcon.tsx` (port `.rc-icon-btn`
   SVG — giữ nguyên 6 type dù chỉ 2 dùng ngay, 4 còn lại để dành cho lần
   port `.rc-toolbar` sau, xem ghi chú đầu `reagent.css`) — 2 nút mới cạnh ô
   "Người thực hiện"/"Loại mẫu", mở modal danh sách (nút "Chọn" + xoá "✕"
   mỗi dòng) + ô thêm mới (Enter hoặc nút "Thêm"). Ô nhập chính vẫn
   `defaultValue` (không kiểm soát) — thêm `key={current.operator}`/
   `key={current.sample_type}` để React remount đúng sau khi chọn nhanh
   (cùng lớp lỗi "stale defaultValue" đã gặp nhiều lần: đổi giá trị qua
   `meta()` không tự cập nhật lại DOM của ô uncontrolled đã mount).
   Port thêm `button.x`/`td.acts` (nút xoá dòng dùng chung, chưa từng có ở
   app-v2) và `.mrow`/`.rc-quick-add` (khối modal) vào CSS.

Verify: `npm run app-v2:typecheck` sạch, `app-v2:test` 34/34 (mở rộng
`auth-handlers.test.mjs` — setAvatar chặn chuỗi không phải ảnh, đọc lại
đúng ảnh vừa lưu, xoá về rỗng; `reagent-handlers.test.mjs` — loại mẫu có
đúng 3 mặc định, người thực hiện rỗng, thêm trùng không tạo dòng mới, xoá
đúng vị trí; `migrate-legacy.test.mjs`/`migration-handlers.test.mjs` — avatar
di trú đúng, KHÔNG rơi về rỗng; `mock-parity` lên **162 bước**, phủ đủ 2
tính năng mới ở cả 2 phía), `app-v2:build` sạch, `app-v2:css-parity` đạt,
`app-v2:ui-parity` 79/79 (siết lại baseline `reagent` từ 1 class/18 dòng
xuống **0 class/18 dòng** — `rc-icon-btn` không còn thiếu, chỉ còn đúng 1 lý
do nhãn trục biểu đồ canvas-vs-SVG), `app-v2:style-parity` 18/18.

**Rà soát nghiệp vụ Cấu hình chung lần cuối (2026-09-06).** Đối chiếu lại
trực tiếp handler/UI app-v2 với vòng đời lô, Panel và chính sách Westgard của
app cũ, phát hiện và sửa 5 lỗi còn tác động tới dữ liệu/kết luận:

1. `removeLot()` còn kiểm trạng thái chuyển lô cũ `concluded`, trong khi
   vocabulary hiện hành là `accepted`: lô nguồn của hồ sơ đã chấp nhận giờ
   bị chặn xoá đúng; browser mock được sửa cùng logic.
2. Cổng chấp nhận chuyển lô đòi `mean > 0`, làm các xét nghiệm có Mean bằng
   0 hoặc âm (ví dụ Base excess) không thể chuyển lô. Đổi sang Mean hữu hạn +
   SD hữu hạn dương, thêm test riêng cho Mean âm.
3. `savePanel()` có thể nhận toàn id xét nghiệm không tồn tại rồi lưu Panel
   rỗng sau bước lọc. Handler thật và mock giờ kiểm lại danh sách id hợp lệ và
   trả `missing-tests`.
4. Cột **Hành động** của 13 luật Westgard trong modal xét nghiệm trước đây chỉ
   hiển thị. `RuleActionsMap` giờ hỗ trợ đủ `inactive/alert/reject`, vẫn đọc
   boolean cũ; `makeRuleActionLayered()` phân giải ghi đè theo xét nghiệm →
   cấu hình chung → mặc định registry. Chính sách này được truyền xuyên suốt
   `westgard()`/`westgardByPoint()`/`combinedWestgardByPoint()`/
   `acceptedPoints()`, rồi dùng thống nhất tại Nhập QC, Phân tích Westgard,
   lô song song, lô trước và nhóm lô lưu trữ. Chọn Cảnh báo không còn vô tình
   loại điểm; chọn Loại bỏ thật sự loại điểm khỏi chuỗi chấp nhận.
5. Hai lựa chọn **Theo cấu hình chung** và **Phạm vi SOP khuyến nghị** trước
   đây không thể xoá ghi đè đã lưu. Hai IPC giờ nhận chuỗi rỗng để xoá key
   tương ứng; đồng thời chặn action/scope không hợp lệ ở main, không chỉ dựa
   vào kiểu TypeScript/UI.

Verify: `npm run app-v2:test` **41/41**, `app-v2:typecheck` và
`app-v2:build` sạch. Kịch bản Playwright `_electron` trên user-data tạm đã
thao tác trực tiếp modal Danh mục xét nghiệm: lưu Cảnh báo + phạm vi chéo mức,
mở lại đọc đúng, đưa cả hai về mặc định và xác nhận hai key bị xoá khỏi SQLite.
Giới hạn TEa tuyệt đối của 9 analyte vẫn thuộc đợt Six Sigma đã chốt hoãn; không
phải nghiệp vụ ghi/lưu của trang Cấu hình chung.

**Rà tiếp các cổng dữ liệu nền trong cùng đợt:** `parseRuleScopes()` giờ chỉ
nhận luật tồn tại + `within/across/both`; giá trị legacy `protocol` và chuỗi
rác được hiểu là không ghi đè, nên tự rơi về phạm vi SOP thay vì lọt một scope
thứ tư vào engine. Port thêm đúng các cổng mở form của app cũ: thêm xét nghiệm
khi chưa có máy sẽ chuyển sang tab Máy và mở thẳng modal tạo máy; thêm Panel
khi chưa có xét nghiệm/máy, thêm nhóm khi chưa có lô, và thêm chuyển tiếp khi
chưa có Panel/đủ 2 lô đều báo điều kiện còn thiếu rồi đưa người dùng tới đúng
tab cần chuẩn bị. Hồ sơ chuyển lô mới cũng điền sẵn ngày bắt đầu là hôm nay,
khớp `openLotTransitionModel()` cũ. Playwright `_electron` đã chạy cả bốn đường trên dữ liệu tạm,
đúng thông báo/đúng tab và không mở form bất khả thi.

**Rà tiếp tính toàn vẹn Panel/nhóm lô trong cùng đợt:** `saveTest()` giờ port
đúng `saveAssay()` app cũ: khi chuyển một xét nghiệm sang máy khác, tự gỡ nó
khỏi mọi Panel QC thuộc máy cũ/khác máy mới; không tự khôi phục liên kết nếu
đổi máy trở lại. Sự thay đổi phát cả `qc_panels`/`qc_panel_tests` để tab Panel
đang mở nạp lại ngay. `savePanel()` từ chối toàn bộ lần lưu nếu danh sách chứa
lẫn id xét nghiệm không tồn tại, thay vì âm thầm lọc bỏ rồi lưu một Panel khác
với lựa chọn người dùng. Các thao tác nhiều bảng `savePanel()`,
`saveLotGroup()` và nhánh tạo mới `saveTest()` (xét nghiệm + Mức 1 mặc định)
được bọc transaction SQLite để hàng cha và toàn bộ liên kết/con mặc định luôn
cùng thành công hoặc cùng rollback. Handler thật và browser
mock giữ cùng hành vi; `mock-parity` đạt **171 bước**. Verify lại:
`app-v2:test` **41/41**, `app-v2:typecheck`, `app-v2:build` sạch; kịch bản
Playwright `_electron` trên user-data tạm xác nhận Panel A đổi từ 1 xét nghiệm
sang “— / 0 vị trí” ngay sau khi xét nghiệm chuyển từ Máy A sang Máy B.

**Rà tiếp nhận diện analyte + Mean/SD:** quy tắc trùng xét nghiệm của app cũ
là theo `(máy, analyteId hoặc tên)`. V2 giờ dùng `teaRefKey` làm khoá analyte:
cùng Glucose trên hai máy vẫn được phép và giữ hai luồng QC độc lập; Glucose/
GLU cùng khoá TEa trên một máy bị chặn dù nhãn khác nhau. Nhóm lô để trống tên
được tự ghép từ số lô theo thứ tự chọn (`L1/L2`), đúng `prepareLotGroup()` cũ.
`saveTestLevel()` nay chặn lô không tồn tại, lô sai mức, lô đã hết dùng, gán
lô khi chưa đủ Mean/SD, Mean/SD không đi cùng nhau, số không hợp lệ và cặp
giới hạn thiếu/ngược. Tab Mean/SD cũng khoá checkbox/ô nhập của lô đã hết dùng
và nút “Chọn tất cả” bỏ qua hàng bị khoá, đúng `targetRowState()` cũ. Kịch bản
Electron thật đã xác nhận đủ: chặn trùng analyte cùng máy, cho phép khác máy,
tự sinh tên nhóm, chặn lô sai mức và hiển thị “Lô đã hết dùng” trên hàng bị
khóa.

**Bản xem trước trình duyệt chạy CHÍNH handler thật — xoá bản giả lập viết
tay (2026-09-09).** `renderer/browser-mock/api.ts` (1.748 dòng) là bản cài
đặt THỨ HAI của toàn bộ tầng điều phối: cùng thứ tự cổng, cùng thông báo,
cùng công thức như `main/ipc/*`, chỉ khác `db.prepare(...).get()` ↔
`array.find()`. Nó là nguồn của 18 lệch hành vi mà hạng mục C7 phải đi bắt
từng cái, và chi phí đó vĩnh viễn: mỗi handler mới phải viết hai lần, lệch
chỉ lộ khi ai đó nghĩ ra đúng bước test. Nay bản xem trước gọi thẳng
`createConfigHandlers(db)`/`createEntryHandlers(db)`/… trên SQLite thật
(sql.js/WASM trong IndexedDB) — `api.ts`, `store.ts`, `permission-policy.ts`
và `tests/mock-parity.test.mjs` (675 dòng) đã xoá; **net −1.665 dòng**.

**Bề mặt phải bắc cầu chỉ có 2 hàm + 3 method**, đo bằng grep toàn
`main/ipc`+`main/db` trước khi code: `db.prepare()` (321 chỗ), `db.exec()`
(68), và trên statement chỉ `.get()` (118), `.run()` (56), `.all()` (43).
Nhờ vậy `browser-mock/sqlite-shim.ts` chỉ ~145 dòng. `main/db/sqlite-like.ts`
(mới) giữ hợp đồng CẤU TRÚC đó; 16 file handler đổi `import type { Db }`
sang file này để `tsc` của renderer không phải resolve `node:sqlite`.
`open-database.ts` giữ một dòng kiểm tra tĩnh `const conn: SqliteLike = db`
— nó trả công ngay: bắt được `changes` của `node:sqlite` là `number | bigint`
chứ không phải `number` (2 chỗ đọc `.changes` phải bọc `Number()`).

**Ba primitive có bản song song, KHÔNG phải bản giả lập** — thuật toán giống
hệt, chốt bằng test lấy `node:crypto` làm oracle:
- `sha256.ts` (`node:crypto`) ↔ `sha256-browser.ts` (JS thuần, đồng bộ). Vì
  sao không WebCrypto: `crypto.subtle.digest` async, còn `writeAudit()` đồng
  bộ và chạy trong transaction SQLite.
- `password-hash.ts` (600.000 vòng) ↔ `password-hash-browser.ts` (20.000
  vòng). PBKDF2-HMAC-SHA256 THẬT, chỉ khác số vòng vì 600k bằng JS thuần mất
  **5,3 giây** mỗi lần đăng nhập (đo được 112.889 hash/giây). Số vòng nằm
  trong chuỗi lưu `pbkdf2$<iter>$<salt>$<hash>` nên **tương thích hai chiều**:
  bản trình duyệt kiểm được hash 600k của Electron và ngược lại — có test.
- `ipc/db-file-size.ts` (`node:fs`) ↔ `db-file-size-browser.ts`. Tách vì đó
  là dòng `node:fs` DUY NHẤT trong 10 nhóm handler mà bản xem trước dùng lại.

Thay module do plugin `swap-node-only-modules-for-browser`
(`vite.app-v2-renderer.config.mjs`). **Hai bẫy đã trả giá**: (1) thiếu
`enforce:'pre'` thì resolver nội bộ của Vite giải trước và plugin không bao
giờ được hỏi tới — `app-v2:build` vẫn XANH, chỉ mở tab mới thấy `node:crypto
has been externalized`; (2) khớp cả chuỗi import thì bỏ lọt, vì cùng module
được import bằng đường khác nhau (`audit-chain.ts` viết `'./sha256'`,
`auth-handlers.ts` viết `'../domain/password-hash'`) — khớp theo TÊN MODULE.

**Bẫy thứ ba, nghiêm trọng nhất**: `writeAudit()` là chỗ DUY NHẤT trong repo
dùng tham số ĐẶT TÊN (`VALUES (@id,@seq)` + `.run({...})`). `node:sqlite`
nhận object KHÔNG prefix, sql.js đòi key CÓ prefix — không dịch thì sql.js
ném `tried to bind a value of an unknown type ([object Object])`, và vì mọi
thao tác ghi đều đi qua `writeAudit()`, app vỡ ngay ở bước đăng nhập. Đã
thêm test riêng trong `tests/sqlite-shim.test.mjs`.

**Hai lỗi của bản giả lập cũ nay đúng theo cấu trúc**: `onStoreChanged()` trả
`() => {}` và KHÔNG BAO GIỜ gọi callback (mọi `useStoreInvalidation()` vô
hiệu ở bản xem trước — `mock-parity` không thấy vì nó chỉ chốt "trả về hàm
huỷ đăng ký gọi được"), và chuỗi hash audit không bao giờ được băm
(`verifyActivityChainNow()` luôn `checked: 0`). Nay `real-api.ts` đăng ký một
`BroadcastTarget` thật qua `setBroadcastWindow()` — `shared.ts` đổi kiểu tham
số đó từ `BrowserWindow` của electron sang một interface cấu trúc
(`isDestroyed?()` tuỳ chọn) nên `main/index.ts` không phải đổi gì.

**`sessionActor` phải sống qua F5.** Trong Electron nó nằm ở main process nên
tải lại renderer không mất đăng nhập; ở bản xem trước "main process" chính là
tab. Ghi id phiên vào `sessionStorage` (không lưu mật khẩu) rồi khôi phục
bằng `auth.getUser()` — thiếu bước này thì mọi surface của gate parity lệch
vì app quay về màn hình đăng nhập.

**Seam thay cho `mock-parity`**: `real-api.ts` dùng `satisfies QcApiSurface`
(`{[K in keyof QcApi]: (...args:any[]) => unknown}`) — bắt thiếu/thừa/sai tên
122 hàm ngay ở `tsc`. KHÔNG dùng thẳng `QcApi` được vì **hợp đồng
`shared/qc-api.d.ts` và handler thật đã DRIFT từ trước**: `saveInstrument()`
khai trả `IpcResult<unknown>` trong khi hợp đồng hứa `IpcResult<Instrument>`;
`PublicUser` được khai HAI LẦN (`role: string` vs `role: 'admin'|'technician'
|'viewer'`) — 41 lỗi kiểu. Trước đây không gate nào thấy vì
`ipcRenderer.invoke()` trả `Promise<any>` và bản giả lập tự cài đặt THEO hợp
đồng nên luôn "khớp" hợp đồng mà không ai so nó với handler. **Dọn drift này
là một đợt riêng, chưa làm.** Thêm `tests/browser-preview-coverage.test.mjs`
(source scanner) canh thứ `tsc` không thấy: ngưỡng 14 hàm được phép trả
`not-available-in-browser-preview`, siết xuống khi nối thêm handler — nó đã
tự bắt lỗi ngay lần chạy đầu (`saveLisSettings` bị xếp nhầm vào nhóm
not-available trong khi nó chạy được thật).

**Gate parity phải seed QUA API thật.** `ui-parity`/`style-parity` trước đây
nhồi blob JSON vào `localStorage['qclab-v2-browser-preview']` — hình dạng nội
bộ của `store.ts` đã xoá. Nay `seedV2ViaApi()` (`ui-parity-seed.cjs`) gọi
`window.qcApi` tuần tự. Ba thứ phải sửa để nó chạy: (a) server tĩnh của gate
phải trả `application/wasm` và **nới CSP thêm `'wasm-unsafe-eval'`** khi phục
vụ `index.html` — CSP `script-src 'self'` của bản build chặn
`WebAssembly.instantiate`, và Electron thật không cần WASM nên KHÔNG hạ CSP
sản phẩm; (b) phải `await window.__qcPreviewFlush()` trước `page.reload()` vì
`persist()` gộp 250ms, reload sớm làm trang mới mở với database RỖNG; (c)
gọi đúng chữ ký thật — `saveSigmaTeaConfig` nhận input PHẲNG với trường
`source` (không phải `data.teaSource`), `createReagentComparison` nhận
`data.name` (không phải `reagent`), `saveReagentRows` đọc `payload.rows`
(không phải `data.rows`), và `owner` của NCE nằm trong `protocol`
(`saveNceProtocol`) chứ không thuộc `NceCreateInput`.

Seed qua API còn có tác dụng phụ tốt: dữ liệu buộc phải HỢP LỆ theo nghiệp vụ
thật (nhóm lô ≥2 lô; mức QC phải thuộc Panel + nhóm lô đang vận hành mới nhập
được điểm). `±5SD` chỉ cảnh báo nên các điểm lệch của seed vẫn lưu được.

Verify: `app-v2:typecheck` sạch, `app-v2:test` **69/69** (thêm
`sqlite-shim.test.mjs` 7 nhóm, `sha256-parity.test.mjs` 4 nhóm gồm quét mọi
độ dài 0..300, `password-hash-parity.test.mjs` 6 nhóm gồm tương thích 2
chiều, `browser-preview-coverage.test.mjs` 3 nhóm), `app-v2:build` sạch,
`app-v2:css-parity` đạt, `app-v2:style-parity` **18/18 đạt**, cộng kiểm chứng
trong tab thật: 122/122 hàm; khởi tạo admin 378ms + đăng nhập 369ms bằng
PBKDF2 thật; sai mật khẩu bị từ chối; chuỗi hash audit `ok:true, checked:7,
legacy:0`; `store:changed` phát đúng cặp `activity`→`instruments`; vai trò
chỉ-xem bị chặn `forbidden` ở cả `saveInstrument` lẫn `lockPeriod` và không
ghi được gì; F5 giữ nguyên dữ liệu + phiên đăng nhập; đăng nhập qua UI vào
đúng Dashboard.

**Còn lại, KHÔNG che bằng baseline**: `app-v2:ui-parity` 72 vấn đề, gồm 64
đã đỏ từ TRƯỚC đợt này (entry: "Khoảng xem…"/"Mức 2 · Lô 1102"/class
`icon`,`danger`; westgard: `wg-view-mode` — thuộc phần chưa commit của đợt
trước) và `manage:modal-panel/lot/lotgroup` thiếu dòng "Ghi chú" — MỚI, chưa
xác minh nguyên nhân (nghi do id lô/panel giờ do handler tự sinh nên nút
"Sửa" của gate mở đúng dòng khác), cố ý KHÔNG chốt baseline. Chỉ chốt
baseline cho `audit` (8 dòng: nhật ký của v2 nay là dòng THẬT do seed sinh
ra, app cũ vẫn 2 dòng nhồi tay) và `actions` (2 dòng: mã hồ sơ NCE do app-v2
tự sinh qua `nextNceId`, không còn là `NCE-DEMO-001` cố định) — cả hai đều có
`surfaceNotes` giải thích.

**Chưa làm, đã biết**: file `.wasm` 658 kB nằm trong `app-v2-dist/renderer`
vì gate parity phục vụ CHÍNH thư mục đó; khi app-v2 được đưa vào
`build.files` của Electron thì cần loại nó khỏi gói (Electron dùng
`node:sqlite`, không bao giờ tải WASM).

**Bổ sung ngay sau đó (cùng ngày), từ chính việc chạy lại gate**: seed qua
API thiếu 2 thứ mà blob localStorage cũ mang sẵn, và cả hai chỉ lộ ra ở gate
chứ không ở test Node — (1) hồ sơ phòng xét nghiệm (`saveLabProfile`), thiếu
thì phụ đề của MỌI trang (`PageHeader`) và trang Cài đặt đều lệch; (2)
`backupStatus` trong `real-api.ts` bị viết bọc `{ok,data}` và thiếu
`maxImportBytes`, trong khi handler thật trả object TRỰC TIẾP — sai hình dạng
làm trang Cài đặt không dựng được thẻ sao lưu. Sau khi sửa, `ui-parity` còn
**61 vấn đề, THẤP HƠN mức 64 trước đợt này**: seed đi qua nghiệp vụ thật còn
tự sửa được vài lệch cũ. Toàn bộ 61 còn lại là phần đỏ sẵn từ trước (entry,
westgard, manage, users) thuộc công việc chưa commit của đợt trước.

Ô "Ghi chú" của 3 modal (lô QC, Panel QC, nhóm lô) đã được BỎ có chủ đích ở
app-v2 — quyết định sản phẩm, KHÔNG phải thiếu sót; app cũ vẫn còn nên gate
đếm 1 dòng lệch mỗi modal, đã chốt baseline kèm `surfaceNotes`. Đừng "sửa"
bằng cách thêm lại ô đó.

**Dọn drift `shared/qc-api.d.ts` ↔ handler thật (2026-09-10).** Ngay sau khi
bản xem trước chuyển sang chạy handler thật, `satisfies QcApi` lộ ra **38 hàm
lệch** giữa hợp đồng IPC và thứ handler thật sự trả về. Trước đó không gate
nào thấy: `ipcRenderer.invoke()` trả `Promise<any>`, còn bản giả lập cũ tự
cài đặt THEO hợp đồng nên luôn "khớp" hợp đồng mà chẳng ai so nó với handler.

Nguyên tắc dọn: **`shared/qc-api.d.ts` là NGUỒN DUY NHẤT**, main `import type`
từ đó. Cách này an toàn hơn vẻ ngoài — `import type` từ một `.d.ts` KHÔNG emit
gì, nên `rootDir: app-v2/main` của `tsconfig.app-v2-main.json` không bị ảnh
hưởng (kiểm chứng: file build ra vẫn ở đúng `app-v2-dist/main/ipc/`). Đã hợp
nhất 5 kiểu từng được khai HAI LẦN: `PublicUser` (auth-handlers khai
`role: string`, hợp đồng khai union 3 vai trò — nay ép qua `roleOf()` để vai
trò lạ về `viewer` thay vì cast bừa), `NceRecord` (main dùng `string` cho 3
trạng thái, hợp đồng dùng union; ngược lại hợp đồng THIẾU
`created_by_user_id`/`risk_level` mà main có — lệch theo hai chiều ngược
nhau), `QcPointView`/`ParallelEntryColumn`/`PreviousLotSeries` (`voided:
number` vs `0 | 1`), `TestSummary`, `ActivityEntry`/`ActivityPage`.

**9 hàm `config-handlers` khai `IpcResult<unknown>`** — hợp đồng hứa
`IpcResult<Instrument>`/`<Test>`/`<QcLot>`/… Siết lại xong lộ ngay **4 chỗ
trả thiếu field thật**: `saveLotGroup`/`savePanel` spread `{...(row as
object)}` — spread một `object` cho ra `{}` nên TypeScript không thấy field
nào và hợp đồng thành vô nghĩa; `saveTestAssignments` trả `Record<string,
unknown>`; `rowToAuditEntry()` trả `{id: unknown, …}` nên renderer nhận
`unknown` cho MỌI trường của dòng nhật ký.

**Một drift có hậu quả nghiệp vụ**: `activateLotGroup()` có nhánh trả
`'unready'` (chưa mức nào có Mean/SD hợp lệ, KHÔNG đụng cấu hình) nhưng hợp
đồng chỉ khai `'applied' | 'already-active'` — renderer không biết nhánh đó
tồn tại. Đã thêm vào hợp đồng và vào `manage-store.ts`.

Sau khi dọn, `real-api.ts` dùng được `satisfies QcApi` THẬT (bỏ mapped type
`QcApiSurface` chỉ so tên hàm, và bỏ luôn `as unknown as QcApi` ở `return`):
từ nay thiếu hàm, thừa hàm, gõ sai tên HOẶC trả sai hình dạng đều đỏ ở `tsc`.
Đây là seam thay thế cho `mock-parity.test.mjs` đã xoá, nhưng chặt hơn —
mock-parity chỉ so hành vi trên các kịch bản có người nghĩ ra.

Verify: `app-v2:typecheck` **0 lỗi**, `app-v2:test` 69/69, `app-v2:build`
sạch, `app-v2:css-parity` đạt, `app-v2:style-parity` 18/18, `app-v2:ui-parity`
61 vấn đề (toàn bộ là phần đỏ sẵn từ trước đợt này).

**Món nợ "trang gọi thẳng `window.qcApi`" — 37 chỗ về 8 (2026-09-10).** Đây
là nợ kiến trúc còn lại lớn nhất sau khi bỏ bản giả lập: trang gọi thẳng IPC
thì `useStoreInvalidation()` không có đường nào chạm tới, nên dữ liệu đổi ở
nơi khác không làm trang tự cập nhật — và thao tác GHI không qua store để
lại chính store đó giữ dữ liệu cũ.

Nặng nhất là `SettingsPage.tsx` với **20 chỗ**: `settings-store.ts` chỉ giữ
hồ sơ đơn vị + dung lượng, còn backup/LIS/Firebase nằm trong `useState` cục
bộ. Store nay gom đủ 5 nhóm dữ liệu backend của trang (thêm `backup`, `lis`,
`lisQueue`, `firebase`) cùng `loadAll()`, và trang đăng ký
`useStoreInvalidation(['lab','app_meta'])`. **RANH GIỚI đã chốt**: store giữ
DỮ LIỆU TỪ BACKEND và các lời gọi IPC; state của FORM (tên đơn vị đang gõ,
mật khẩu Firebase, ô URL LIS) vẫn ở trang — đó là nháp của người dùng. Hộp
thoại xác nhận, tải Blob, đọc `<input type="file">` cũng ở trang: chúng là
UI. Ô LIS/Firebase seed MỘT LẦN từ giá trị đã lưu bằng cờ `lisSeeded`/
`fbSeeded`, cùng kiểu với cờ `seeded` mà hồ sơ đơn vị đang dùng.

Các thao tác GHI được đưa về store kèm việc tự nạp lại đúng thứ chúng làm
đổi: `entry-store.setDayNote` (nạp lại điểm của xét nghiệm, lấy danh sách
mức từ chính state thay vì bắt caller truyền lại), `sigma-store.setTracking`/
`saveTeaConfig` (đổi TEa làm mọi kỳ tính lại), `reagent-store` quick values,
`auth-store.setAvatar`/`clearAvatar` (nạp lại `user` để avatar đổi ở mọi
trang), `manage-store.loadHistoryPoints` (tab Lịch sử dữ liệu — điểm nhập ở
trang Nhập QC nay làm tab này tự cập nhật).

**8 chỗ CÒN LẠI là có chủ đích, mỗi chỗ có ghi chú lý do ngay tại dòng đó** —
đừng "dọn" tiếp cho đủ 0: `ActionsPage.queryPoints` (ô chọn bằng chứng rerun
trong modal), `LotsTab.previewLotRename` (chỉ ĐẾM để hỏi trước khi ghi),
`DialogHost.verifyOwnPassword` (một phép kiểm, không phải dữ liệu),
`ReportPage.queryReport`/`listNceRecords` (truy vấn TỨC THỜI cho đúng lần
xuất/in — app cũ cũng không có bước "Xem" riêng; phần bảng hiển thị vẫn dùng
`report-store.loadPoints`), `WestgardPage.listArchivedGroupTests`/
`listArchivedBlocks` (dữ liệu chỉ-đọc của nhóm lô đã lưu trữ, không đổi
trong lúc xem, vòng đời gắn với lựa chọn trong tab và có cờ huỷ),
`SettingsPage.listTestSummaries` (thuộc Westgard, đọc một lần cho một hộp
thoại).

Trong lúc làm, chữ ký thật lộ ra vài chỗ tôi đoán sai — ghi lại để lần sau
tra trước: `setAvatar` nhận `{data:{dataUrl}}` (không phải `avatar`),
`removeReagentQuickValue` xoá theo **index** chứ không theo giá trị,
`listReagentQuickValues` trả `IpcResult<string[]>` (phải mở `.ok` trước khi
dùng), `saveSigmaTeaConfig` nhận input PHẲNG với trường `source`.

Verify: `app-v2:typecheck` 0 lỗi, `app-v2:test` 69/69, `app-v2:build` sạch,
`app-v2:css-parity` đạt, `app-v2:style-parity` 18/18, `app-v2:ui-parity` 61
vấn đề — **Y NGUYÊN trước và sau refactor**, tức không đổi hành vi hiển thị;
cộng kiểm chứng trong tab thật: trang Cài đặt render đủ 5 panel, hồ sơ đơn vị
và form LIS (url + token + công tắc) seed đúng từ store, và lưu tên đơn vị
qua nút "Lưu thông tin" ghi đúng vào SQLite.

**Đối chiếu Westgard/Sigma giữa hai bản — tiêu chí cắt thứ hai, lần đầu chạy
thật (2026-09-10).** Đây là mục đã nằm trong "Quyết định sản phẩm 2026-09-02"
nhưng chưa từng được thực hiện: mọi test còn lại của app-v2 chốt hành vi
app-v2 với CHÍNH NÓ, nên một công thức lâm sàng bị port lệch ngay từ đầu vẫn
để cả bộ test xanh. `app-v2/tests/cross-app-westgard-sigma.test.mjs` (mới)
chạy CÙNG input qua engine app cũ (`assets/core.js` UMD + 3 file
`src/domain/**` nạp thẳng `.ts` qua type-stripping) và engine app-v2
(`app-v2-dist/main/domain/*`), so **1.194 phép**: registry 13 luật (kể cả
predicate của họ luật "N liên tiếp", so bằng cách chạy thử trên dải z chứ
không so mã), `defaultRuleAction`/`defaultRuleScope`, `stats`/`pointTarget`/
`pointZ`, `westgard`/`westgardByPoint`/`cusum` trên 29 chuỗi điểm,
`westgardMultiByPoint` trên 62 bộ liên mức, `acceptedPoints` ↔
`acceptedLotPoints`, `combinedWestgardByPoint` ↔ `activeWestgard`, `erf`/
`normalCdf`/`dpmoFromSigma`/`sigmaMetric`, `eqaRoundsStats` ↔
`SigmaBiasService.stats`, và `uncertaintyBudget`. PRNG cố định nên cùng bộ dữ
liệu ở mọi lần chạy — lệch mới xuất hiện là do CODE đổi, không phải do rút
trúng số khác.

**Bắt được đúng 1 lệch nghiệp vụ thật: `acceptedPoints()` bỏ qua snapshot
Mean/SD của từng điểm.** App cũ (`acceptedLotPoints`) gọi `pointTarget(p,
level.mean, level.sd)` nên tôn trọng `qcMean`/`qcSd` đã chốt lúc nhập;
app-v2 gọi `westgard(trial, mean, sd)` với Mean/SD HIỆN HÀNH dùng chung. Sai
theo hai hướng cùng lúc, và hướng thứ hai nặng hơn: **bất nhất ngay bên
trong `analyzeLevel()`** — verdict/z của CHÍNH những điểm đó đi qua
`combinedWestgardByPoint()` → `westgardByPoint()` → `pointTarget()`, tức đã
theo snapshot, trong khi cờ `accepted` (cùng handler, cách 15 dòng) lại theo
Mean/SD hiện hành. Hệ quả: sau khi ai đó sửa Mean/SD của mức, một điểm có
thể hiện "Loại bỏ" mà vẫn `accepted:true` — biểu đồ Levey-Jennings và thống
kê Mean/SD/CV thực của trang Nhập QC lệch khỏi chính bảng điểm bên cạnh.
Sửa bằng cách chuẩn hoá từng điểm qua `pointTarget` rồi chạy luật trên thang
z (`mean=0/sd=1`), đúng cách `westgardByPoint` đã làm; cửa sổ 11 điểm giữ
nguyên.

**2 lệch còn lại KHÔNG sửa, và lý do được chốt bằng test chứ không bằng ghi
chú:** `primaryErrorRule([])` và `primaryErrorRule(['luật-lạ'])` trả `''`/
chính chuỗi đó ở app cũ nhưng `null` ở app-v2. Đây là khác biệt HỢP ĐỒNG,
không phải khác biệt lâm sàng — app-v2 chỉ gọi hàm này bên trong
`errorTypeDetail()`, mà nhánh đó đã thoát sớm khi `errorType()` trả `'—'`.
Test chốt đúng tính chất tiếp cận được (luật lạ không bao giờ bị dán nhãn
SE/RE, không sinh mô tả) thay vì ép hai chữ ký giống nhau.

**Một bài học về chính phép đo, không phải về code**: lượt đầu báo 6 lệch,
4 trong số đó là do TEST truyền `across` không đối xứng — `activeWestgard()`
app cũ nhận SET luật liên mức đã lọc sẵn (caller lọc theo trạng thái bật),
còn app-v2 nhận một predicate, nên truyền `ACROSS` thô cho bên này và
`ACROSS ∩ ON` cho bên kia là đang so hai CẤU HÌNH khác nhau chứ không so hai
engine. `3-1s`/`2of3-2s` mặc định TẮT nên chênh lệch rơi đúng vào 2 luật đó.
Ghi lại ngay trong test để lần sửa sau không lặp lại.

Cả hai test đều được chứng minh CÓ khả năng bắt lỗi (không chỉ chạy xanh):
hoàn tác tạm bản sửa trong `app-v2-dist` → `cross-app-westgard-sigma` FAIL
đúng `acceptedPoints#30:snapshot` và nhóm 7 mới thêm của
`accepted-points.test.mjs` FAIL đúng câu "phải đánh giá theo snapshot của
từng điểm"; phục hồi thì cả hai xanh lại. Nhóm 7 tồn tại vì
`cross-app-westgard-sigma.test.mjs` **sẽ bị xoá cùng lúc với app cũ** (ghi rõ
ở đầu file: khi `src/`+`assets/` biến mất thì xoá file này, đừng cố "sửa cho
chạy") — nhóm 7 giữ cho lệch đó vẫn bị canh sau khi app cũ không còn.

Verify: `app-v2:typecheck` sạch, `app-v2:test` **70/70** (thêm
`cross-app-westgard-sigma.test.mjs`; `accepted-points.test.mjs` từ 6 lên 7
nhóm), `app-v2:build` sạch, `app-v2:css-parity` đạt, `app-v2:style-parity`
18/18, `app-v2:ui-parity` **61 vấn đề — Y NGUYÊN trước và sau**, tức thay đổi
engine không đổi gì ở lớp hiển thị đang được đo.

**Tiêu chí cắt còn lại đúng 1 mục**: Giai đoạn D xong (`app-v2:ui-parity`
xanh với baseline 0 cho mọi surface). Mục "đối chiếu Westgard/Sigma khớp
100%" nay ĐẠT, và từ đây nó là gate sống chạy trong `app-v2:test` chứ không
phải một lần đối chiếu rồi thôi.

## Tests

No test framework. Each file under `tests/*.test.js` is a plain Node script
that runs top-level `assert` calls and throws on failure — compatible with
Node's built-in test runner but not written using `test()`/`describe()`.

Run everything (`npm test`, or the glob directly — `node --test tests/` fails
on Node ≥23, which tries to `require` the folder):
```
npm test
node --test tests/*.test.js
```

`npm test` runs `scripts/run-tests.js`, which lists `tests/*.test.js` with `fs`
and passes the files explicitly, instead of relying on a glob. The reason is not
style: **`node --test` exits 0 when its pattern matches nothing** (verified —
`node --test "tests/khong-ton-tai-*.test.js"` prints `tests 0` and returns 0). A
shell that doesn't expand the glob would therefore make the pre-commit hook and
the CI job pass while running zero tests. On Linux the shell always expanded it,
but the Windows CI job added 2026-08-01 depends entirely on Node's own glob
support. The script treats "0 test files" as a failure; the hook and all CI jobs
go through it, and `benchmarks/verify-release.js` (which already enumerated the
files itself) now refuses an empty list too. The bare glob above is still fine
for a one-off local run.

Run one file (either works):
```
node --test tests/qccore.test.js
node tests/qccore.test.js
```

`tests/helpers/sandbox.js` loads real `assets/*.js` files into a `vm` context
(in `index.html` load order) to test them without a browser. The requirement
is that the file's *top level* is side-effect-free — no DOM/`window`/
`localStorage` at load time — which nearly every module satisfies: existing
tests sandbox everything from `core.js`/`qc-rules.js`/the services,
view-models and `*-ui-state.js` files, passing stub globals for whatever the
function under test touches. What can't run in the sandbox is *calling* the
DOM-rendering functions themselves — tests against render modules exercise
only their pure helpers. `assets/modules/` is empty as of 2026-08-20 (Pha G
nhóm C done, `state.js`/`analyte-catalog.js` retired last) — any sandbox
needing state/domain logic must list `'generated/modular-pilot.js'`
explicitly; `sandbox.js` used to auto-insert `analyte-catalog.js` before
`modules/state.js` and push the bundle when that filename was present, but
that trigger can never fire again now that the file is gone, so the
auto-append branch was deleted rather than left dead.

Several tests are **source scanners, not behaviour tests** — they read the repo
as text and enforce conventions no compiler here can. Expect them to fail on a
structural change and fix the structure, not the test:

- `global-name-uniqueness.test.js` — no two files in the single shared global
  scope may declare the same top-level name (see "Architecture"). Its scanner is
  line/indent-based to match this codebase's style: top-level declarations must
  sit at column 0 and stay one logical declaration per line, or it can't see
  them. Workers are excluded (own global scope).
- `ui-route-structure.test.js` — pins the router/page split and the
  `index.html` load order of the bundle → `*-routes.js`.
- `button-conventions.test.js` — the `btn()` ban on hand-written buttons (see
  "Button convention").
- `firebase-rules.test.js` — the rules text the Settings page shows
  (`firebaseRulesText()`) must equal `firebase/database.rules.json` verbatim.
- `tea-sources.test.js` — every measurand keeps a row in `docs/tea-sources.md`.
- `westgard-rule-registry.test.js` — the Westgard rule list lives only in
  `core.js`'s `WG_RULE_REGISTRY`; no other source file may spell out three or
  more rule ids (see "Module roles" → `core.js`).
- `css-hex-ratchet.test.js` (added 2026-08-23, same pattern as
  `tests/a11y-ratchet.json`) — a per-file cap on raw `#rrggbb` hex literals in
  `assets/*.css` outside `tokens.css`, checked against
  `tests/css-hex-ratchet-baseline.json`. A rà soát that day counted 242 such
  literals; most are one-off gradient/shading shades a mechanical
  find-replace can't safely collapse into existing tokens without a design
  call, so this isn't a flat ban like `button-conventions.test.js` — it only
  blocks the count from **growing**. Update the baseline with
  `node tests/css-hex-ratchet.test.js --update-baseline` after an intentional
  cleanup, never to allow a new one-off color.

A pre-commit hook (`.githooks/pre-commit`, installed into `.git/hooks/`) runs
`node scripts/run-tests.js` and blocks the commit on failure; needs no `npm
install` since tests only use Node core modules. `.github/workflows/test.yml`
has four jobs: `test` (the same install-free command), `release-gate`
(`npm ci` → `npm run typecheck` → `npm run verify-release`),
`visual-and-a11y` (Playwright/Electron checks below), and `windows`
(`runs-on: windows-latest` — the same install-free `node scripts/run-tests.js`
plus `npm run print-check` without `xvfb-run`). The Windows job exists because
the product ships as NSIS Windows x64 only, `index.html` carries a patch for a
Windows-only Chromium dialog bug, and `print-check` otherwise exercises the
desktop print path on Linux, an OS the product never runs on.

### Coverage blind-spot map

`npm run coverage-map` (`scripts/coverage-map.js`) runs the whole suite under
Node's built-in `NODE_V8_COVERAGE` — no extra dependency — and writes
`docs/coverage-map.md`. **Rewritten 2026-08-21**: the original (2026-08-01)
version only measured `assets/**/*.js`, which made sense when most business
logic still lived there as classic JS; after nhóm D closed the migration,
`assets/**/*.js` is down to 3 build artifacts + a 1-line boot utility, so
measuring only that told you almost nothing. The tool now reports two
sections: **(A) `src/**/*.ts`** — measured directly from the real script URL
each test process reports (the ~450 test files that `spawnSync(process.execPath,
['--input-type=module', ...])` a single `.ts` file inherit `NODE_V8_COVERAGE`
from the parent and V8 reports coverage keyed by that file's own path, no
sourcemap needed); **(B) `assets/**/*.js`** — the ~61 `vm`-sandbox tests
(`tests/helpers/sandbox.js`) still only exercise the *built* bundle/`core.js`/
worker, and since none of those builds emit a sourcemap, section B cannot map
back to individual `.ts` lines — it only tells you whether the bundle's own
wiring ran at all, not which business function is untested (that question
belongs to section A). It is still deliberately **not a gate**: no thresholds,
exits non-zero only if the test suite itself fails or no coverage data was
found at all. V8's offsets are source *character* offsets (not UTF-8 bytes —
this codebase is full of Vietnamese, so the two differ a lot). The 2026-08-21
baseline after the rewrite: section A 22.5% over 750 files with 279 never
loaded by any direct-import test — expect this, not a red flag: the files at
the top of that never-loaded list are exactly the large `*-page-controller.ts`/
`modular-pilot.global.ts` factory files that are only ever exercised *indirectly*
through the wired bundle (section B), never imported standalone by a test;
section B separately shows 49.7% across the 3 real build artifacts.

### Visual/print and accessibility checks

`npm run visual-check`, `npm run a11y-audit` and `npm run print-check` are
real-browser checks (need `npm install` + `npx playwright install chromium`
first — unlike everything above, so they're deliberately **not** in `npm test`
or the pre-commit hook, and run in their own `visual-and-a11y` CI job instead
of the fast one). `scripts/lib/seed-browser-session.js` boots the static app
in headless Chromium with a minimal valid QC dataset and an
already-authenticated admin session (no login/password-change UI to fight
through), shared by visual-check/a11y-audit (print-check reuses its
`buildSeedState()` but boots the app in Electron instead — on headless Linux
it runs under `xvfb-run`, see the CI job):

- `scripts/visual-check.js` captures the actual HTML `openPrint()`
  (`report-print-controller.ts`) writes for the Westgard and Báo cáo reports, renders it
  under `@media print`, and asserts every header box with a background color
  has `print-color-adjust:exact` — this is the property that keeps a header's
  fill printing regardless of the browser's own "print backgrounds" setting;
  checking `backgroundColor` instead would not have caught the 2026-07-23 bug
  this exists for, since that computed value doesn't change based on the
  property. Screenshots go to `tests/__visual__/*.png` (gitignored) for human
  review only — not pixel-diffed, since font rendering varies across
  machines.
- `scripts/a11y-audit.js` runs axe-core against every page in `PAGES`
  (`router-page-policy.ts`, bridged as `root.PAGES`), the primary "add new X" modal on each page that has
  one (`MODALS` in the script — manage's lot/instrument/assay modals, Sigma's
  add-test/EQA-bias/MU-budget modals, reagent's create-comparison modal, users'
  edit-permissions modal), and a keyboard-Tab smoke pass on `dash`/`entry`, writing
  `tests/__a11y__/report.json` (gitignored). The 2026-07-23 baseline run only
  ever saw each page in its default just-loaded state with no modal open and
  Sigma untracked/empty — 0 violations there said nothing about the modals or
  Sigma's real content, since most of this app's forms live in a modal, not
  the page body; `seed-browser-session.js`'s seed only covers operational QC
  data, so `a11y-audit.js` separately calls `sgTrackTest()`/`sgAddPeriod()`
  itself before auditing. `MODALS` is a representative sample (the biggest
  form per area), not exhaustive — extend it if you add a major new modal.
  Since 2026-07-24 the audit is a hard-fail ratchet (same pattern as
  `tests/button-conventions.test.js`): every run is compared against the
  committed `tests/a11y-ratchet.json`; any page/modal/keyboard count above
  the baseline, a new surface with any violation, or a previously-auditable
  modal that no longer opens fails the script with exit 1. After fixing
  violations, tighten the baseline with
  `node scripts/a11y-audit.js --update-baseline` — never raise a number by
  hand. `MODALS.open` entries are real functions (not eval'd strings) so the
  audit works under the CSP, which has no `unsafe-eval`.
- The NCE form on the "Khắc phục sự cố" page renders every field straight from state
  (`actionFormModel()`), keeps in-progress typing across `rerender()` via
  `captureActionDraft()`, and collapses sections 2–8 into `<details>` whose open/closed
  state lives in `actionOpenSections`. The narrative fields carry insert-and-edit
  suggestion chips (`ACT_SUGGEST`, `actionSuggestRow()`) rather than closed dropdowns —
  a fixed picker for "root cause" would make every NCE record read identically and
  prove nothing under an ISO 15189 review, which is the same reason the void reason
  keeps a free-text note. Chips for cause/corrective action are context-driven by
  `causeCategory` and the SE/RE split that `fixHint()` already owns. Protocol-v3
  records additionally require a traceable SOP basis for the initial risk,
  an explicit release-to-service decision after held results, and a residual-risk
  reassessment before an "effective" conclusion; these fields are retained by
  backup sanitization and the full NCE audit CSV.
- `ActionRerunService` (`src/application/nce/action-rerun-service.ts`, bridged as
  `root.actionRerunStatus`/`root.actionPoint`/… — retired from classic
  `action-workflow-service.js` on 2026-08-20, xem "Module roles") phải giữ chi phí
  `actionRerunStatus()` không tăng theo tổng số điểm QC: nó bị gọi 5 lần cho CÙNG một hồ sơ trong một lần vẽ
  (`actionWorkflowStatus()` → `actionProtocolStatus()` nhánh release →
  `actionEffectivenessStatus()`), và bản đầu mỗi lần quét lại toàn bộ
  `state.data[testId]` — đo được 5 894ms mỗi lần vẽ bảng nhật ký với 40 000 điểm × 600
  hồ sơ, còn 171ms sau khi thêm `actionLotPoints()` (index theo xét nghiệm/mức/lô, đã
  bỏ điểm hủy và sắp sẵn nên dừng ở ứng viên đầu tiên) cùng memo cho
  `actionRerunStatus()`/`actionPoint()`. KHÔNG dùng `pointsForLot()` của `qc-domain.js`
  cho việc này: cache đó chỉ được xả qua `clearDerived()`, trong khi lưu hồ sơ dùng
  `save({clearDerived:false})`. Mọi cache ở đây TỰ KIỂM CHỨNG — chữ ký gồm tham chiếu và
  độ dài mảng điểm QC, cộng các trường của hồ sơ mà phép tính đọc tới — nên thay nguyên
  `state` hay thêm/bớt điểm đều tự trượt. `clearDerived()`/`clearDerivedForTest()` gọi
  thêm `invalidateActionCaches()` cho trường hợp sửa giá trị tại chỗ. Đừng chốt phần này
  bằng mốc thời gian trong test: hai tối ưu che lẫn nhau nên phép đo không phân biệt
  được cái nào hỏng (bỏ index còn cho tỉ lệ NHỎ hơn giữ index) — hãy chốt bằng việc
  cache tự trượt, như `tests/action-workflow-service.test.js` đang làm.
- `scripts/nce-workflow-check.js` (`npm run nce-check`) drives the NCE record
  lifecycle on the "Khắc phục sự cố" page in real Chromium, because every bug it
  guards only appears once the form is rendered *and re-rendered*: the edit/new
  form must survive `rerender()` (a Firebase pull mid-typing used to blank it and
  the next save wrote empty strings over the checklist), the incident identity
  (`testId`/`level`/`lot`/`pointId`) must stay immutable once the record exists
  (changing the test dropdown made `actionPoint()` return null and silently
  dropped the QC-rerun gate), and the rerun/overdue/escalation chips must match
  between "Sự cố cần xử lý" and "Hồ sơ NCE đang mở". Each area was proven
  discriminating by reintroducing the original bug and watching the matching
  checks fail.
- `scripts/ui-workflow-check.js` (`npm run ui-check`) is the browser-level
  record-mutation smoke gate. It crosses the real DOM, route handlers, state,
  persistence scheduling and hash-chained audit for four workflows that vm
  service tests cannot prove end to end: enter then void a QC point, add/edit
  instruments and assays (including decimal/CUSUM fields), lock/unlock a report
  period through password re-authentication, and restore a checked backup after
  the automatic pre-change download. Keep it in the `visual-and-a11y` CI job;
  adding a new high-impact UI mutation path means extending this script or an
  equally real browser workflow, not merely source-scanning its button text.
- `scripts/print-check.js` covers the DESKTOP print-to-PDF pipeline that
  nothing else in the repo can see: it boots the real app in Electron, opens
  the real print window via `printWestgard()` → `openPrint()`, drives the same
  main-process path the "Lưu PDF" button uses (`printToPDF` with
  `printBackground` + `preferCSSPageSize`), then asserts on the generated
  PDF's decompressed content stream — no large rect filled with the
  screen-preview background `#EEF2F5` (the 2026-07-24 defect where the print
  window's `backgroundColor` showed through the whole PDF page, because Blink
  does not paint the body background onto the print canvas; small `#EEF2F5`
  table-border rects are legitimate and ignored), the teal header `#0E8F8F`
  still paints, and the report text is present. It also pins the desktop UX
  contract: exactly one "Lưu PDF" button wired to `opener.qcPrintPdf`. The
  review PDF lands in `tests/__print__/` (gitignored). The check was proven
  discriminating by temporarily reverting `backgroundColor` to `#eef2f5` and
  watching it fail.

## Type checking

`npm run typecheck` (`tsc --noEmit`, config in `tsconfig.json`) runs
TypeScript's `checkJs` over `assets/**/*.js` — no code is written in
TypeScript, this only catches typos/wrong-arity calls/etc. ahead of runtime.
This is a no-module, one-global-scope codebase (see "Architecture" below) that
also *constructs* several of its globals at runtime instead of declaring them
syntactically — `*-ui-state.js` accessor fields, a couple of
`Object.assign(root, {...})` service exports, `core.js`'s UMD `window.QCCore`.
`global.d.ts` declares all of these ambiently so real typos still get caught
instead of drowning in "Cannot find name" noise — **update it when you add a
new field to a `*-ui-state.js` state bag or a new bare-global export**, or
`npm run typecheck` will report a false positive for every reference to it.
`global.d.ts` also loosens `Document#getElementById`/`Element`/`EventTarget`
to `any`, since this codebase reads `.value`/`.dataset`/`.checked`/etc.
straight off DOM query results everywhere without casting — that's expected
here, not something to "fix" by re-tightening those types.

## Benchmarks and release gate

`benchmarks/` holds Node performance scripts; `benchmarks/README.md` documents
methodology, recorded baselines, and which optimizations they justified — read
it before touching startup, storage, Westgard, or chart-render hot paths.

- `node benchmarks/verify-release.js` — pre-release gate: runs all functional
  tests, then `check-build-freshness.js` (below), then two dependency audits,
  then `performance-regression.js` against budgets in `performance-budget.json`.
  Ratio/structural checks are the real
  regression signal; absolute ms budgets are intentionally generous — don't
  tighten them from a single fast local run. The audit step is deliberately
  split (2026-07-28): `npm audit --omit=dev --audit-level=high` **blocks** the
  release, because that tree is what actually ships (`build.files` packages
  only `index.html`/`assets`/`electron`/`package.json`, so the sole runtime
  dependency is `electron-updater`); the full-tree audit only **reports**, since
  a devDependency CVE threatens the build machine, not the lab. Handle those
  with a risk row in `docs/validation/RISK-ASSESSMENT.md`, not with an
  `overrides` entry — forcing `brace-expansion@^5.0.8` to clear the current 16
  findings was tried and reverted: 5.x switched to the named export
  `{ expand }`, so `minimatch@3.1.5`/`5.1.9` inside electron-builder throw
  `expand is not a function` and packaging breaks while `npm audit` reads
  green. Neither audit may skip the performance gate — that's how a red gate
  used to hide whether performance still passed.
- `node benchmarks/check-build-freshness.js` (`npm run check-build-freshness`,
  added 2026-08-23) — rebuilds `assets/generated/modular-pilot.js`,
  `assets/core.js` and `assets/workers/westgard-worker.js` into a temp
  directory and diffs them byte-for-byte against the committed files.
  `npm test`/the pre-commit hook are deliberately install-free (see "Tests"
  above) and never rebuild, so they only ever exercise whatever is already
  committed in `assets/` — editing a `src/**/*.ts` file and forgetting
  `npm run build:pilot` before committing passes the hook and the fast CI
  `test` job silently, exactly the class of bug `qc-core.ts`'s own
  `WG_RULE_REGISTRY` warning worries about, but for the whole bundle instead
  of one file. This gate is the only place that catches it, which is why it
  only runs after `npm ci` in `verify-release.js`/the `release-gate` CI job,
  never in the fast suite.
- `node benchmarks/performance-baseline.js [--quick]` — full/smoke benchmark.
- `startup-pipeline.js`, `partitioned-startup.js`, `render-pipeline.js` —
  focused profiles; `worker-smoke.html` (served over HTTP alongside the app)
  smoke-tests the real Web Worker.

## Architecture

**No modules, no bundler — one shared global scope.** `index.html` loads
`assets/core.js`, then the compiled TypeScript bundle
(`assets/generated/modular-pilot.js`, built by `npm run build:pilot` from
`src/compat/modular-pilot.global.ts`) — two `<script defer>` tags, in a
fixed, load-bearing order. `assets/modules/` is empty as of 2026-08-20 (Pha G
nhóm C complete): it used to hold every classic-JS page/route/service file,
each declaring top-level `function`/`const`/`let` directly into global scope
so later files could freely call functions and read state defined by earlier
ones; all of that logic has since retired into the bundle (assigned as
`root.X=` properties, see "Module roles" below for the retirement history of
each former file) or into `src/presentation`/`src/application`/`src/domain`
TypeScript modules the bundle imports. `assets/app.js` (the boot entry point)
retired the same way on 2026-08-20 (Pha H1, lát 1) — `root.boot` is now
registered via `document.addEventListener('DOMContentLoaded', ...)` at the
end of the bundle rather than a classic script that just calls `boot()` at
load time; see "Module roles" below. `assets/core.js` itself retired to
TypeScript the same day (nhóm D, closing the migration's last classic-app
file — see "Module roles" → `core.js` for the build-pipeline detail), so as
of this writing the ONLY hand-written classic JS left anywhere in the app is
`assets/nav-collapse-init.js` (1 line, a boot-order utility, not business
logic — see "CSP + SRI" below). There is still no namespacing at the
global-scope boundary — when adding a global (a bare `root.X=` in the
bundle, or an `export`ed name in `src/domain/core/qc-core.ts`, which is
`assets/core.js`'s TypeScript source) check the name isn't already taken; a
collision silently replaces the other binding and only surfaces weeks later,
so `tests/global-name-uniqueness.test.js` scans `core.js` AND the generated
bundle and fails on duplicates. If you reorder the 2 remaining `<script>`
tags in `index.html`, you can still break forward references.

**React island (2026-08-29, `docs/REACT-ADOPTION-PLAN.md`).** A third
`<script defer>`, `assets/generated/react-pilot.js` (built by
`npm run build:react` from `src/react/react-pilot.entry.tsx` via
`vite.react.config.mjs`, loaded in `index.html` *before* `core.js`/
`modular-pilot.js` so `window.QCLabReact` exists first), lets individual pages
be migrated to React one at a time while the rest keep running on the classic
bundle — a new, separate initiative from the TypeScript migration above (see
`docs/TYPESCRIPT-MIGRATION-PLAN.md` §2 item 5, updated to record this).
`router-dispatch-controller.ts`'s `render()` checks `isReactPage(id)` and
mounts/unmounts a React root into `#main` for migrated pages instead of the
classic `innerHTML` swap; `rerender()` additionally calls `notifyReactStore()`
so migrated pages re-render through the same `useSyncExternalStore`-based
bridge (`src/react/state/renderBus.ts`) whenever anything elsewhere triggers a
redraw. Migrated components keep using `data-action`/`data-args` markup (not
`onClick=`) so `action-dispatcher.ts` and the existing Playwright checks need
no changes. `react-pilot.js` is built with `minify:true` (unlike
`modular-pilot.js`/`core.js`, which use `minify:false` to keep hand-written
code diffable) — both to cut bundle size and because unminified React
internals produce false positives in `tests/global-name-uniqueness.test.js`'s
line/column-based scanner. `tsconfig.react.json` (separate from
`tsconfig.modules.json`, includes only `src/react/**`) adds `jsx:"react-jsx"`
without touching the existing strict TS config. Dashboard/"Tổng quan"
(`src/react/pages/DashboardPage.tsx`) and Activity log/"Nhật ký hoạt động"
(`src/react/pages/AuditPage.tsx`), Users/"Người dùng"
(`src/react/pages/UsersPage.tsx`), Settings/"Cài đặt"
(`src/react/pages/SettingsPage.tsx`), Manage/"Cấu hình chung"
(`src/react/pages/ManagePage.tsx`), Reagent/"So sánh hóa chất"
(`src/react/pages/ReagentPage.tsx`), Report/"Báo cáo"
(`src/react/pages/ReportPage.tsx`), Six Sigma/"Six Sigma & Sai số"
(`src/react/pages/SigmaPage.tsx`), Westgard analysis/"Phân tích Westgard"
(`src/react/pages/WestgardPage.tsx`), Corrective action/"Khắc phục sự cố"
(`src/react/pages/ActionsPage.tsx`) and Entry/"Nhập QC & Biểu đồ"
(`src/react/pages/EntryPage.tsx`) are all ten pages — the entire app — with
their classic HTML-builder code already deleted post-parity-check; the
React migration is complete, see `docs/REACT-ADOPTION-PLAN.md` for the
page-by-page history.

**Kernel / gỡ global bridge (2026-08-30–, in progress, see plan file
"gỡ bỏ global bridge, đưa QC Lab sang kiến trúc React chuẩn").** A second,
new-and-separate initiative from the React-island work above: even though
every page renders via React now, the underlying architecture is unchanged —
`src/compat/modular-pilot.global.ts` still imports ~600 modules and assigns
~1,305 individual names to `root.X=` (root = globalThis) so they're reachable
as bare identifiers, `src/react/bridge/*.ts` still read everything via
`(window as any).x`, events still go through `data-action="fnName"` +
`action-dispatcher.ts`'s global-name lookup, modals still build raw HTML
strings and `innerHTML`-inject them, and state-change notification is the
fully manual `save()`→`rerender()`→`notifyReactStore()`→hand-rolled
`renderBus.ts` chain. Merging the two separate Vite bundles
(`modular-pilot.js`/`react-pilot.js`) into one was considered and rejected:
`react-pilot.js` is deliberately minified to dodge
`tests/global-name-uniqueness.test.js`'s false-positive behavior on
unminified React internals, the 61 `tests/helpers/sandbox.js`-based tests
`vm`-sandbox only `modular-pilot.js` with no `document`/`window` (React's
own module-top-level code touches `document` and would throw immediately in
that bare sandbox), and Rollup's import-graph-determined evaluation order
inside one shared IIFE risks reintroducing the exact "eager-construction
trap"/"IIFE-scope trap" bug class documented throughout this file. Instead:
the two bundles stay separate (no build/Electron/CSP/
`check-build-freshness.js` changes), and the ~1,305 scattered globals
collapse into **one** typed object, `window.__QC_KERNEL__` — constructed
once in `modular-pilot.global.ts`, right before `root.boot=`, from the
SAME already-constructed page controllers (`entryPageController`,
`actionsPageController`, `sigmaPageController`, etc. — each already returns
exactly the right group of functions via `createXPageController()`, so no
new taxonomy was invented) plus a `store` field. **Giai đoạn 0 (done)**:
added `zustand` (devDependency) and `src/application/state/app-store.ts`
(`createAppStore()`, a `zustand/vanilla` store holding only `{revision,
touch()}` — a deliberate, documented **notify-bus wrapper**, not a real
immutable-state migration, since 16 files across `src/application`/
`src/presentation` mutate `state.x=` directly outside any DI-injected
setter; converting all of them to immutable updates is a separate, much
larger project not attempted here). `createAppStore()` is constructed once
in `modular-pilot.global.ts` (module-scope `const appStore`, right after
`root.state=`/the derived-cache `root.mem=...` line) since the store must be
a SINGLE shared instance — the two bundles have no shared module registry,
so constructing it in each bundle separately would give React and classic
code two different store instances that never see each other's `touch()`
calls. The existing `notifyReactStore` dependency (passed into
`createRouterDispatchController`, called at the end of every `rerender()`)
now also calls `appStore.getState().touch()` alongside the pre-existing
`window.QCLabReact?.notify()` call — the only behavior change in this phase,
and inert until something actually subscribes to the store. `kernel`'s
`window.__QC_KERNEL__` assignment was originally guarded by
`typeof window!=='undefined'` (caught immediately by the sandbox tests
otherwise — `vm.createContext` has no `window`) — **since Giai đoạn 4 Bước 1
(2026-08-30) this guard is gone**: the assignment goes through `root`
(`=globalThis`, already used everywhere else in this file) instead of
`window` directly, since `globalThis` always exists (that's exactly what
`vm.createContext(sandbox)` turns `sandbox` into) while `window` doesn't in a
bare vm context — `root===window` in a real browser, so this changed nothing
observable there, but it makes `__QC_KERNEL__` reachable from
`tests/helpers/sandbox.js`'s sandboxed tests for the first time, which is the
foundation the sandbox-test-rewrite portion of Giai đoạn 4 depends on.
`kernel`'s namespaces mirror each page's OWN controller return
object 1:1 (`kernel.entry = entryPageController`, `kernel.sigma =
sigmaPageController`, etc. — no new taxonomy invented) plus a `kernel.pres`
grab-bag for the cross-page shared helpers that aren't owned by any single
page controller (formatting: `esc`/`escAttr`/`fmt`/`vnDate`/`fmtPointValue`/
`formatDateTimeVN`/`testDisplayName`; permissions: `role`/`canWrite`/
`requireWrite`/`requireAdmin`/`roleLabel`/`roleSelectOptions`/`rolePageIds`
from `routerPermission`; icons: `icon`/`icoCal`/`icoDownload`/`icoPrint`;
render-cycle: `afterRender`; misc: `normalizeSearchText`/`levelTargetOk`/
`QCCore`/`AnalysisUIState`). `kernel.manage` merges TWO controllers
(`managePageController` plus `manageTestsActionsController`'s
`setTargetPanel`/`setTargetGroup`/`setHistoryTest`, which the Manage page's
Mean/SD tab needs but which live in a sibling controller, not
`managePageController` itself) — this was the one page where "just alias the
page's own controller" wasn't enough, found by tracing every bridge file's
actual dependencies rather than assuming the taxonomy.

**Giai đoạn 1 (done, 2026-08-30).** All 11 `src/react/bridge/*.ts` files
(actions, audit, dashboard, entry, manage, reagent, report, settings, sigma,
users, westgard) converted from `const w = () => window as any; ... w().x()`
to `import { getKernel } from '../state/kernel'; ... getKernel().page.x()` —
a purely mechanical swap (same call shape, different lookup path), verified
by TypeScript catching every wrong/missing kernel field name at compile time
(a few were: `kernel.manage` needed the `manageTestsActionsController` merge
above; everything else matched the page's own controller on the first try).
`src/react/state/kernel.ts` (new) exports `getKernel()` (throws a clear error
if called before `modular-pilot.js` has run boot() — should never happen in
practice, since actual page rendering only starts after `DOMContentLoaded`)
and `useAppStore(selector)` (wraps Zustand's `useStore` React binding over
`kernel.store`, default selector returns `revision` — an exact drop-in
replacement for the old `useRenderVersion()`, confirmed by the 2 pages
(Sigma, Westgard) that capture the return value as `key={version}` for their
documented stale-`defaultValue` remount fix still working unchanged). The 9
pages that called `useRenderVersion()` now call `useAppStore()` instead;
`src/react/state/renderBus.ts`/`useRenderVersion.ts` and the
`window.QCLabReact.notify`/`notifyReactStore`'s `QCLabReact?.notify()` call
were deleted outright (zero remaining consumers once every page switched to
the Zustand-backed hook) — `notifyReactStore` is now just
`appStore.getState().touch()`. Verified: `npm test` 467/467, `typecheck`
clean, `check-build-freshness` matches all 4 bundles, `a11y-audit` 0
violations (18/18 modals — every kernel-routed function across every page
exercised via real browser clicks), `ui-check` 29/29, `nce-check` 91/91,
`visual-check`/`print-check` pass.

**Giai đoạn 2 (in progress) — `data-action` → real `onClick`/`onChange`/
`onKeyDown`, one page at a time, full e2e suite after every single page (not
batched — this is the highest-behavior-risk phase).** Dashboard (done): all
7 `data-action` buttons converted (`dashboardGoEntryFollowup`,
`dashboardContinueAction`, `goManageTargets`, `dashViewTestInEntry`,
`dashTestSetStatus` — the last already had a real bridge export, just wasn't
wired to `onClick` yet). `goManageTargets`/`dashboardGoEntryFollowup`/
`dashboardContinueAction`/`dashViewTestInEntry` are page-agnostic navigation
helpers (confirmed used across 6 pages via grep) added to `kernel.pres`, not
`kernel.dash` — they don't belong to Dashboard's own controller. Running
`scripts/nce-workflow-check.js` surfaced one test that had drifted into
checking an implementation detail rather than behavior: `checkOverdue-
ReachesDashboard()`'s "Nút mở thẳng đúng hồ sơ" asserted
`/data-action="dashboardContinueAction" data-args="\[0\]"/.test(main.innerHTML)`
— true by construction before this conversion, meaningless after (the
button still opens the right record, it just does so via a real `onClick`
closure now, with no `data-action` attribute left to match). Fixed by
clicking the actual button and asserting the real outcome (navigates to
`'actions'`, form shows the right `nceId`) instead of scanning for the
attribute string — this is a strict improvement, not a workaround, and is
the same class of fix anticipated for the ~88 bridge-wiring text-scanner
tests in the final cleanup phase, just found early because pages are being
converted before that phase runs. `goManageTargets`/`dashViewTestInEntry`
etc. embedded as raw text inside strings returned by shared classic
HTML-builders (`emptyStateHtml`, used via `dangerouslySetInnerHTML` on
Westgard/Sigma/Entry/Report) are NOT yet convertible — that requires those
shared builders to become real components first (a separate sub-task, not
yet started); Dashboard's own usages were all plain JSX buttons, so this
page needed no such dependency.

Users (done): all 7 `data-action` buttons/select (`addUser`,
`syncUserPermChecks` on the role `<select>`'s `onChange`, `resetPass`,
`openUserPerms`, `toggleUser`, `delUser`) converted — these 6 functions are
genuinely Users-page-specific (confirmed via grep, unlike Dashboard's shared
nav helpers) so they went into `kernel.users`, not `kernel.pres`. No test
fallout this time (nothing scanned for `data-action="addUser"` etc. as
literal text). Verified with an ad-hoc Playwright script (not committed) that
exercised every converted handler end-to-end under a real seeded admin
session: create user (count 2→3, confirmed reliable across 4 runs), toggle
active state, open the edit-permissions modal, and the role `<select>`'s
`onChange` correctly recomputing which permission checkboxes are
enabled/checked for the newly chosen role — this last one is the same
"append the live value" semantic `data-action-on="change"` used to provide
automatically; converting it to a plain `onChange={e => fn(id, e.target.value)}`
preserves that without the dispatcher.

Audit (done): 6 of 8 `data-action` usages converted
(`exportActivityCSV`/`archiveActivityLog`/`auditVerifyChainNow`/
`auditSetPageSize`/`auditClearFilters`/`auditSetPage`×2, all Audit-only →
`kernel.audit`) — the remaining one (`auditSetDate`, on the two date-range
inputs) is embedded as raw `data-action=` text inside `dateBoxHtml()`'s
returned string, injected via `dangerouslySetInnerHTML`; left as-is
(coexists fine with the converted handlers on the same page) until
`dateBoxHtml` itself becomes a real component — a cross-cutting change
shared by ~6 pages, deliberately deferred rather than done ad hoc per page.
Verified with an ad-hoc Playwright script: page-size `<select>` (using a
VALID option value — `AUDIT_PAGE_SIZES = [25, 50, 100]`, no `20` — a mistake
in the first draft of the check itself, not a product bug, caught by the
row count not changing and fixed by using a real option), pagination "Sau"
button, CSV export (stubbed `csvDownload` and confirmed it's called), and
`auditVerifyChainNow()` invoked directly (its button only renders when the
chain hasn't been auto-verified yet, unrelated to this conversion) — all
correct.

Report (done): 8 of 10 `data-action` usages converted
(`goManageTargets`/`reportUnlockPeriod`/`reportSetLockPart`×2/
`reportLockPeriod`/`printReport`/`exportReportXLSX`/`exportReportCSV`) —
remaining 2 (`reportRangeChanged`, on the two date-range inputs) deferred
like Audit's `auditSetDate`, same reason (`dateBoxHtml` string). This page
needed TWO new kernel namespaces beyond its own `kernel.report`:
`kernel.reportPrint` (= `reportPrintController`, also used by Westgard/Sigma
print) and `kernel.dataIo` (= `dataIoController`, also used by Westgard/Sigma
Excel export) — `printReport`/`exportReportXLSX`/`exportReportCSV` live on
those sibling controllers, not on `reportPageController` itself, found the
same way as Manage's `manageTestsActionsController` merge in Giai đoạn 1
(tracing each bridge call to its actual source rather than assuming
"one page, one controller"). Verified with an ad-hoc Playwright script:
clicking "Khóa kỳ này" correctly opens the real confirm dialog ("Khóa kỳ báo
cáo"); month/year `<select>`'s `onChange` fires `reportSetLockPart` with the
right part+value; clicking the Excel/CSV export buttons ran the real export
functions with zero console errors (a first attempt tried to stub
`window.exportReportXLSX`/`exportReportCSV` to detect the call — this no
longer works after the conversion, since the button now reads
`kernel.dataIo.exportReportXLSX` directly and never touches the bare global
at all; that's the intended outcome of this whole rewrite, not a test bug to
route around — switched to confirming zero errors on the real call instead).
`ui-workflow-check`/`visual-check`/`print-check` also re-run since this page
owns the print/export pipeline other pages share.

Settings (done): all 17 `data-action` usages converted — the first page
needing ZERO deferrals, since none of its buttons/inputs live inside a
`dangerouslySetInnerHTML`-injected string. `kernel.settings` merged in 6
standalone backup/reset functions (`exportData`/`importData`/
`verifyBackupFile`/`resetAllData`) plus `lisQueueController`'s
`lisGatewaySaveSettings`/`lisOpenQueueModal` (a LIS-Gateway-specific
sibling controller, same merge pattern as Manage/Report). The generic
`data-action="clickElementById" data-args='["imp"]'` pattern (used to click
a hidden `<input type="file">` from a visible button) and the one-line
`brandPickLogo` helper (itself just `document.getElementById('logoFile')
?.click()`) were both replaced with a plain inline
`onClick={() => document.getElementById('imp')?.click()}` instead of being
routed through the kernel at all — pure DOM operations with zero state
dependency don't need kernel indirection, matching the "pure functions get
direct treatment" principle from Giai đoạn 1. `pickLogo`/`importData`/
`verifyBackupFile` (wired to file `<input>`'s `onChange`) all take the raw
event object as their only parameter — confirmed by reading their
signatures before converting, so `onChange={pickLogo}` works as a direct
pass-through, same as the classic `data-action-on="change"` dispatch for
file inputs (which forwards the real event, not `.value`, since a file
input's `.value` is just the filename). Verified with an ad-hoc Playwright
script: `saveLab()` persisted a typed name into `state.lab.name`, the
backup file-picker button correctly triggers the hidden input's `.click()`,
`checkStorageUsage()` opens a real info dialog, `copyFirebaseRules()` wrote
649 characters to a stubbed `navigator.clipboard`. `ui-workflow-check`'s own
"Chọn file backup chưa tự thay state"/"Restore UI thay dữ liệu sau xác nhận
+ re-auth" checks independently cover the real import/restore flow through
the converted picker button.

Westgard (done): 15 of 16 `data-action` usages converted
(`wgSetViewMode`×2/`wgSetChartMode`×2/`exportWestgardXLSX`/`printWestgard`/
`wgSet`(checkbox)/`wgReset`/`goManageTargets`(one of its two usages — the
other stays embedded in an `emptyStateHtml()` string)/`wgLoadMoreRows`/
`wgTogglePrevLot`/`dashboardGoEntryFollowup`/`wgSelectTest`/
`openConfigAssay`/`wgSetArchivedTest`/`wgSetArchivedGroup`) — most were
ALREADY on `westgardPageController` (just needed wiring into JSX);
`wgSet`/`wgReset`/`wgSelectTest` were standalone globals, merged into
`kernel.westgard`; `openConfigAssay` came from `manageTestsActionsController`
(a cross-page helper — Westgard's CUSUM empty-state opens the SAME assay
config modal Manage uses — added to `kernel.pres`, not `kernel.manage`, since
reading `kernel.manage.X` from the Westgard page would misleadingly imply a
Manage-page dependency); `exportWestgardXLSX`/`printWestgard` came from the
`kernel.dataIo`/`kernel.reportPrint` namespaces added during the Report
page's conversion. Two source-text scanner tests broke exactly as
anticipated — `tests/westgard-print.test.js` and `tests/westgard-xlsx.test.js`
each asserted `/data-action="(printWestgard|exportWestgardXLSX)"/` against
`WestgardPage.tsx`'s raw source; fixed by asserting
`/onClick=\{(printWestgard|exportWestgardXLSX)\}/` instead — confirms the
button is still wired to the right function, just via the new mechanism.
Verified with an ad-hoc Playwright script: chart-mode tab switch (LJ↔CUSUM)
updates the active tab class; a rule checkbox's `onChange` correctly flips
`state.westgardRules['1-2s']`; "Khôi phục mặc định" click succeeds with no
errors. `visual-check`/`print-check` re-run since this page shares the
print/export pipeline.

Six Sigma (done): 19 of 21 `data-action` usages converted
(`sgOpenAddTest`/`sgRemoveTracked`/`sgSetTea`/`sgSetTeaMeta`×3/
`sgSetTeaSource`/`sgSelectPeriod`/`sgCell`×2/`sgPullCV`/
`exportSigmaPeriodXLSX`/`printSigmaPeriod`/`sgDelPeriod`/`sgOpenBias`/
`sgAddPeriod`/`exportSigmaPeriodsXLSX`/`printSigmaPeriods`/
`goManageTargets`) — everything was already reachable via `kernel.sigma`
(`sigmaPageController`), `kernel.dataIo`, `kernel.reportPrint`, or
`kernel.pres`, so this page needed zero NEW kernel wiring, only bridge
exports. Remaining 2 (`sgOpenAddTest` in `EmptyPanel`, `sgSetTeaMeta` for
the EFLM lookup date) stay deferred inside `emptyStateHtml()`/`dateBoxHtml()`
strings. The period `<tr>` combining `data-action="sgSelectPeriod"` (click)
+ `data-keydown-action` (Enter/Space, self-only) surfaced a **real semantic
gap** converting to React: the classic dispatcher resolves via
`event.target.closest('[data-action]')`, which returns the NEAREST matching
element only — a click on a nested button (`data-action="sgPullCV"` etc.)
never reaches the row's own handler, because `closest()` stops at the first
match. React's `onClick` has no such short-circuit — both the button's and
the row's handlers fire via normal bubbling. Fixed by checking
`(e.target as HTMLElement).closest('button, input, select')` inside the
row's `onClick` and bailing out if the click originated on/inside any
interactive descendant — every other multi-level `data-action` nesting in
this app was audited and confirmed to not hit this (buttons/inputs
elsewhere are not nested inside another `data-action` element), but this is
the pattern to check for whenever a `data-action` container HOLDS other
`data-action` descendants. Verified with an ad-hoc Playwright script:
clicking a `<td>` background selects the row; clicking a nested button/input
does not also select it. Hit a **test-harness pitfall, not a product bug**
while verifying `sgCell`: setting `input.value` directly and dispatching a
plain `input` event does NOT reliably trigger a React `onChange` (React's
internal value-tracking misses changes made through the raw DOM setter) —
confirmed by comparing against the pre-conversion code (via a throwaway
`git stash`/`pop` round-trip) which worked with the naive dispatch, then
finding the fix: set the value through
`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set`
before dispatching, which both correctly triggered `onChange` and confirmed
`sgCell` behaves identically to before. `ui-workflow-check`'s own "Xuất
Sigma XLSX từ browser tải workbook" independently re-confirms the export
button through a real click on the fully-converted page.

Reagent (done): 22 of 23 `data-action` usages converted
(`rcSwitch`/`openRcCreateModal`/`rcDeleteCurrent`/`openRcModal`/`rcPrint`/
`rcPrintSummary`/`rcMeta`(9 fields)/`rcMetaFocus`+`rcMetaLog`(4 fields)/
`rcOpenQuick`×2/`rcCell`×2/`rcRmRow`/`rcAddRow`/`rcClearRows`) — all already
on `reagentPageController` (`kernel.reagent`), zero new kernel wiring.
Remaining 1 (`rcMeta` for the date field) deferred, embedded in
`dateBoxHtml()`. The `data-focus-action="rcMetaFocus"` +
`data-change-action="rcMetaLog"` pair (used on lô cũ/lô mới/Bias/alpha —
the 4 fields worth an audit trail) needed a real mapping decision: classic
`data-change-action` binds the native `change` event, which for a text/
number input fires on commit (blur after an edit) — React exposes no direct
`onChange`-for-native-`change` equivalent (`onChange` is really `input`), so
`onFocus`/`onBlur` is the correct React counterpart; `rcMetaLog` itself
already no-ops when the before/after values are equal, so firing it on
every blur (not just "value actually changed since focus") is harmless.
Verified with an ad-hoc Playwright script (fixing the same native-value-
setter technique learned on the Sigma page): typing into "Tên hóa chất"
persists to `rcAct().test.reagent`; focusing then editing then blurring
"Số lô cũ" adds exactly one audit-log entry (confirming the onFocus/onBlur
split fires correctly and only once); "+ Thêm mẫu" grows the pair-row count
5→6; the row's own "✕" button shrinks it back 5→4. `a11y-audit` independently
confirms both `reagent:create-comparison`/`reagent:find-existing` modals
still open via the converted `openRcCreateModal`/`openRcModal` handlers.

Entry (done): all real-JSX `data-action` usages converted (tree nodes'
`treeToggle`/`entryPick` + `entryTreeKey` keydown, `toggleEntryTree`,
`entryFilter`, `entrySheetRunChanged`, `entryUnlockExtraRun`,
`entryDateNoteSave`, `entrySetSheetPart`×2, `entrySetSheetMonth`,
`entryGoToday`, `entryShowPrevLot`/`entryShowCurrentLot`, `entryFocusLevel` +
its click/keydown combo, `entrySetDays`, `voidQcPoint`, `entryToggleRows`,
`entryDetailToggled`×2 (via `<details onToggle>`), `openRangeWorkflow`,
`revertRange`) — everything already on `kernel.entry`
(`entryPageController`) except `openRangeWorkflow`/`revertRange`
(standalone globals, merged in) and `go` (added to `kernel.pres`, the
generic page-navigation primitive every page could plausibly need).
Remaining `entrySetStart`/`entrySetEnd` stay deferred inside `dateBoxHtml()`
strings. Found and fixed a **genuine pre-existing bug** while auditing every
`data-action` on this page: `entrySetMachine` (the "Lọc theo máy xét
nghiệm" `<select>`) had NEVER had a matching function anywhere in the
codebase since Entry's original React migration — `action-dispatcher.ts`'s
`resolve()` silently returned `undefined` for it, so the filter select had
done nothing since it was written. Added a real `entrySetMachine(value)` to
`entry-page-controller.ts` (same shape as the neighboring `entrySetDays`)
rather than leaving the select non-functional. The keydown-bound tree/sheet
navigation (`entryTreeKey`/`entrySheetKey`) uses the SAME `this`-bound
classic function signature as before — bridged as
`(el, event) => kernel.entry.entryTreeKey.call(el, event)`, called from JSX
as `onKeyDown={e => entryTreeKey(e.currentTarget, e)}`, preserving the
exact `this`-reads-the-DOM-node contract the navigation logic depends on.
`LjMini` (Levey-Jennings mini-panel) hit the same nested-data-action
bubbling gap as Sigma's period row (it wraps a real `<button>` from
`LjAction`) — fixed with the same `closest('button, input, select')` guard
in both its `onClick` and `onKeyDown`. **Also fixed 3 real bugs introduced
in the PREVIOUS (Sigma) commit**, found while auditing this page's
`data-action-on="change"` fields against React's actual event mapping:
`data-action-on="change"` on a plain text/number input means "fire on
commit/blur" (native `change`), but React's `onChange` for text-like inputs
fires on native `input` (every keystroke) — only for `<select>` and
checkbox/radio does React's `onChange` correspond to native `change`. Sigma's
`sgSetTea` and two `sgSetTeaMeta` fields (`eflmAnalyte`/`eflmRef`) are number/
text inputs that had been wired to `onChange` (saving on every keystroke,
including a real `deps.save()` persistence call) instead of `onBlur` —
fixed by switching those 3 to `onBlur`. Confirmed (by grepping every prior
commit's diff for `data-action-on="change"` paired with `<input>`/`<textarea>`)
that no other already-converted page has this mistake — the remaining
`change`-on-text-like cases in this Entry commit
(`entrySheetRunChanged`/`entryDateNoteSave`) were done correctly as `onBlur`
from the start. Verified extensively: a11y-audit's dedicated Entry keyboard-
Tab smoke pass (25 real Tab presses) still reports every focus stop clearly;
`ui-workflow-check`'s full Entry-heavy suite (create/void a QC point, date
picker sync, lot search/combobox, period lock/unlock) all pass unchanged;
an ad-hoc Playwright script additionally confirmed the newly-fixed
`entrySetMachine` actually filters the tree now, `ArrowDown` moves tree
focus between nodes, and a `<details>` toggle's open state survives a
`rerender()`.

Corrective action/"Khắc phục sự cố" (done): 21 of 21 `data-action`/
`data-notify-changed` usages converted — every function needed was ALREADY
on `kernel.actions`/`kernel.actionForm`/`kernel.dataIo` (no new kernel wiring
at all, unlike every other page so far). The generic `<Select>` component
was simplified to a single `onChange?: (v: string) => void` prop (dropped
the old `dataAction`/`dataActionOn`/extra-attrs plumbing it briefly carried
mid-conversion). `IssueRow` hit the same TS discriminated-union narrowing gap
as Westgard's `block.prevToggle!` fix: `item.action!.index` doesn't narrow
`item.action`'s `kind`, so `continueIndex`/`createArgs` are extracted as
plain `const`s via a ternary BEFORE the JSX, not inline. `<details
data-action-section={sectionKey} onToggle={...}>` and
`data-notify-changed="actionFormChanged"` (the form-wide "any field changed
→ save draft + refresh section chips" catch-all) became a container-level
`<div className="action-form-body" onChange={actionFormChanged}
key={model.formKey}>` — this covers every plain-JSX field correctly (a
select/textarea/input rendered directly by React bubbles its native
'input'/'change' up to a real ancestor fiber, so the ancestor's `onChange`
fires), but **not** the 5 `DateField`-rendered fields (`aDate`, `aDueDate`,
`aActionCompletedDate`, `aReleaseDate`, `aEffectivenessDate`), which render
via `dangerouslySetInnerHTML` and so create DOM nodes outside React's fiber
tree entirely — confirmed live (a raw native capture listener on
`.action-form-body` sees the bubbled 'input' event from inside a
`dangerouslySetInnerHTML` span just fine, but React's synthetic `onChange`
on that same ancestor never fires, because React resolves an event's
dispatch path by walking up looking for a stashed fiber reference starting
at `event.target`, and a `dangerouslySetInnerHTML`-injected node never gets
one). This is exactly the `nce-workflow-check.js` failure that had this
page at 90/91 mid-conversion ("Sau ngày hoàn thành, cổng cho phép trở lại
vẫn còn thiếu" — filling `#aActionCompletedDate` never recomputed the
"nguyên nhân" chip). Fixed by giving `DateField` its own `useRef`+`useEffect`
that binds native `input`+`change` listeners directly on its wrapper span,
calling `actionFormChanged()` — deliberately listening to **both** events,
matching `action-dispatcher.ts`'s own `data-notify-changed` implementation
(bound to both `document`-level `input` and `change` for the exact same
reason: `vn-date-picker-controller.ts`'s `pick()` dispatches both events
synchronously on a single calendar-day click, and a value typed then blurred
also fires a native `change` after the `input`). This means `actionFormChanged`
sometimes runs twice for one edit (once per event) — confirmed intentional
and harmless (verified live with call-count instrumentation): it's a pure
recompute-from-DOM function with no side effect beyond overwriting the same
chip text/title twice, and the classic implementation had identical
double-firing for the same reason. `nce-workflow-check.js` back to 91/91
after the fix. Verified: `npm test` 467/467 (1 `ui-route-structure.test.js`
assertion updated — it scanned for the old conditional `data-action` spread
and the literal `data-action="openActionGuide"` string, both replaced with
the real `onChange`/`onClick` patterns), `typecheck` clean,
`check-build-freshness` matches, `a11y-audit` 0 violations (18/18 modals),
`ui-workflow-check` 29/29, `nce-workflow-check` 91/91.

Manage/"Cấu hình chung" (done, the last page — **Giai đoạn 2 is now 11/11
complete**): 34 of 34 `data-action` usages across all 8 tabs converted.
`kernel.manage` needed 22 new entries beyond the 3 (`setTargetPanel`/
`setTargetGroup`/`setHistoryTest`) added in Giai đoạn 1 — every one of them
was already a plain export on `manageTestsActionsController` (the
`teaRefEdit`/`teaRefRemove`/`teaLabProfileOpen`/`teaRefOpenAdd` quartet
needed nothing extra, since `kernel.manage`'s `...managePageController`
spread already carried them). Two functions are **`this`-bound**
(`syncTargetRange`, `toggleTargetRow` — same calling convention as Entry's
`entryTreeKey`/`entrySheetKey`: they read `this.closest('.target-row')`
internally), so their bridge wrappers take the DOM element as an explicit
first parameter and `.call(el, ...)` the kernel method
(`syncTargetRange(el, 'target')` → `getKernel().manage.syncTargetRange.call(el,
'target')`), called from JSX as `onChange={e =>
syncTargetRange(e.currentTarget, 'target')}` — the Mean/SD matrix stays
exactly as uncontrolled (`defaultValue`/`defaultChecked`, no `rerender()` on
change) as documented under "Module roles" → Manage, only the event wiring
changed. The toolbar's "+ Thêm..." button and the Mean/SD matrix's row
checkbox both needed the SAME dynamic-name-to-function resolution the
Actions page's `IssueRow` needed for its discriminated union, but at the
page level instead of per-row: `toolbar.action.action` is a runtime string
from `manage-page-controller.ts` (one of 6 values —
`openConfigInstrument`/`openConfigAssay`/`openConfigPanel`/
`openLotTransitionV2`/`teaRefOpenAdd`/`setManageTab`), so a small closed
`TOOLBAR_ACTIONS` lookup object (module-scope, listing exactly those 6) maps
the string to the real imported function — a deliberately narrow, closed
dispatch table, not a re-implementation of `action-dispatcher.ts`'s general
name-to-global lookup. `LotGroupCard`'s activate/toggle button picked its
function the same way but inline (`group.toggle.command === 'activate' ?
activateLotGroup : toggleLotGroupStatus`), since it's only ever those two.
This page surfaced the SAME `dangerouslySetInnerHTML`-vs-fiber-tree gap
Actions found — but did **not** need the same fix: none of Manage's own
fields render through that mechanism (its `EmptyState`/table rows are all
real JSX), so the container-catch-all issue documented under Actions simply
didn't arise here. Verified: `npm test` 467/467 (no scanner test needed
updating — nothing scanned Manage's `data-action` strings literally),
`typecheck` clean, `check-build-freshness` matches all 4 bundles, `a11y-audit`
0 violations (18/18 modals, including the 6 Manage ones), `ui-workflow-check`
29/29 (covers add/edit instrument, add test, apply Mean/SD range, lot
transition combobox — all Manage-page workflows), `nce-workflow-check` 91/91,
plus an ad-hoc Playwright script confirming tab switching, the TEa reference
onBlur commit, the toolbar's dynamic "+ Thêm..." dispatch, and the lot
group's "Sửa nhóm" button all still work correctly.

**Giai đoạn 2 (data-action → React events) is now fully done, 11/11 pages.**

**Giai đoạn 3 (modal → `createPortal`, one modal at a time) — started.**
`confirmDialog`/`infoDialog`/`reauthenticateCurrentUser` (the 3 shared,
cross-page dialogs — `#dialogRoot`, used from dozens of call sites app-wide,
not page-specific forms) are the first piece done, since they're the
simplest and most foundational of the ~18 modals. `src/react/dialogs/
dialog-store.ts` (a plain `zustand/vanilla` store — no need to route through
`window.__QC_KERNEL__`, since both producer and consumer of this state live
in the SAME bundle, react-pilot.js) replaces classic `dialog-overlay-
controller.ts` (deleted outright — confirmed zero remaining consumers of
`openDialogOverlay`/`dialogKeydown`/`confirmDialogAnswer`/`infoDialogAnswer`
once `confirmDialog`/`infoDialog` themselves were replaced).
`src/react/dialogs/DialogOverlay.tsx` is mounted ONCE, permanently, into
`#dialogRoot` from `react-pilot.entry.tsx` (a `createRoot().render()` call
at module top level, not per-page-switch like `#main` — `#dialogRoot` is a
static element in `index.html`, already parsed by the time this `<script
defer>` runs) — it renders `null` when no dialog is open, exactly matching
the a11y-audit/ui-check test convention of checking
`#dialogRoot.innerHTML.trim()` to detect "is a dialog open". The component
replicates the classic HTML structure/CSS classes byte-for-semantic
(`.modal-bg`/`.confirm-modal`/`.confirm-modal-h`/`.confirm-modal-body`/
`.confirm-modal-actions`, the `dialog-enter` CSS animation, `role="dialog"`/
`aria-modal`/`aria-labelledby`) so no CSS changes were needed and the a11y
ratchet's `shared:confirm-dialog`/`shared:reauth-dialog` entries keep passing
unmodified. The focus-trap contract (Escape closes, Tab/Shift+Tab wraps,
focus returns to the pre-open element) is ported from `modal-focus-trap.ts`
into a `useDialogFocusTrap` hook — `modal-focus-trap.ts` stays a pure,
DOM-free-at-module-scope helper, so importing it directly into `react-pilot.js`
is safe and duplicates zero risk (same "pure functions get direct import"
rule from Giai đoạn 1), rather than reimplementing the same logic twice.
`reauthenticateCurrentUser` (the password re-auth gate in front of ~9
critical operations — approve/return NCE, lock/unlock report periods,
Mean/SD range changes, lot transitions, reset-all-data, restore-from-backup)
turned out to depend on the SAME `openDialogOverlay` primitive with its own
custom HTML (a password field, not just message+buttons) — discovered while
tracing consumers before assuming `dialog-overlay-controller.ts` was safe to
delete outright. Converted in the same unit of work rather than left on the
classic HTML-string path (which would have meant TWO different code paths
writing to the same `#dialogRoot` DOM node — the classic one competing with
React's now-permanent ownership of that container, guaranteed to corrupt
React's reconciliation the moment both write to it). The actual PBKDF2
password check stays entirely in `modular-pilot.js`
(`root.reauthVerify`/`root.reauthAccountLabel`, exposed to React via
`kernel.pres`) — the React `ReauthForm` component only ever sees a
true/false verification result, never `currentUser.passHash`, preserving the
same security boundary as before. Verified: `npm test` 467/467 (2 source-scanner
tests — `ui-route-structure.test.js`/`ui-accessibility.test.js` — updated to
drop the deleted `dialog-overlay-controller.ts` from their `read()`
concatenation; their assertions all target patterns that also exist in the
still-live `modal-controller.ts`/`modal-focus-trap.ts`, so nothing else
needed to change), `typecheck` clean, `check-build-freshness` matches all 4
bundles, `a11y-audit` 0 violations (18/18 modals, `shared:confirm-dialog`/
`shared:reauth-dialog` included), `ui-workflow-check` 29/29 (3 of its checks
exercise the real reauth flow end to end: period lock/unlock, backup
restore), `nce-workflow-check` 91/91, `visual-check` passes, plus an ad-hoc
script confirming `confirmDialog` resolves `true`/`false` correctly on
confirm/Escape/backdrop-click, `infoDialog` resolves on "Đã hiểu", and
`reauthenticateCurrentUser` shows the inline error and stays open on a wrong
password.

`#modalRoot` infrastructure (done): the ~16 remaining page-specific form
modals (Manage's instrument/lot/assay/tea-lab-profile, Sigma's
add-test/bias/MU-budget, Reagent's create-comparison/find-existing, Actions'
NCE guide, Users' edit-permissions, Settings' LIS-queue, Audit's archive-log)
all still render as classic HTML strings via `openModal(html)` — but
`#modalRoot` itself is now permanently React-owned, the same strangler-fig
shape already proven across the whole page migration: `src/react/dialogs/
modal-store.ts`'s `ModalState` has an `'html'` variant (a raw string, shown
via `dangerouslySetInnerHTML` — what every unconverted modal still produces)
and a `'react'` variant (`render: () => ReactNode`, for a modal once it's
actually ported to JSX) side by side, so modals can be converted **one at a
time** without two writers ever fighting over the same DOM node — the exact
trap `reauthenticateCurrentUser` hit and had to be fixed alongside
confirmDialog/infoDialog. `openModal(html)` keeps its original signature
(now `(window as any).QCLabReact.openModal(html)` under the hood), so **none
of the ~17 existing call sites needed to change** — only the container
itself moved to React. `src/react/dialogs/ModalOverlay.tsx` mirrors
`DialogOverlay.tsx`'s pattern but can't hold a stable `ref` to the modal
element the way `DialogOverlay` does (an `'html'`-kind child isn't a React
tree, so there's nothing to attach a ref to) — it re-queries `#modalRoot
.modal` on demand instead, exactly like classic `modal-controller.ts`'s own
`activeModal()` used to. For the `'html'` kind only, a `useHtmlModalA11y`
effect reproduces the same post-render DOM annotation classic code did
(`role="dialog"`, `aria-modal`, `aria-labelledby` wired to the first `<h3>`,
a default `aria-label` on any `.modal-close` button missing one) — a
future `'react'`-kind modal sets all of this directly in its own JSX instead,
same division of labor as `DialogOverlay.tsx`'s `confirm`/`info`/`reauth`
kinds. Classic `modal-controller.ts` was deleted outright (confirmed zero
consumers left after `root.openModal`/`root.closeModal` were repointed) —
`tests/ui-accessibility.test.js`/`ui-route-structure.test.js`'s `modals`
text-scanner concatenation now reads `ModalOverlay.tsx` in its place (one
literal string tweak: `setAttribute('role','dialog')` needed the same
no-space style as the deleted classic file, since the scanner regex is an
exact string match, not whitespace-tolerant). Verified: `npm test` 467/467,
`typecheck` clean, `check-build-freshness` matches all 4 bundles,
`a11y-audit` 0 violations across **all 18** modals (proving the `'html'`
compatibility path is pixel-for-pixel behaviorally identical to the classic
container for every still-unconverted modal), `ui-workflow-check` 29/29,
`nce-workflow-check` 91/91.

Actions' NCE guide (done, first modal actually converted to `'react'`):
`openActionGuide()` — a purely informational popup (the 8-step NCE process,
no form state, no re-authentication) — was picked first for exactly that
reason, same "simplest first" logic as picking confirmDialog/infoDialog
before reauthenticateCurrentUser. `src/react/modals/ActionGuideModal.tsx`
reads the SAME step data as before (`root.ActionGuidePresentation.steps`,
exposed via `kernel.actions.actionGuideSteps` — a plain data array, no
duplication risk) and declares its own `role="dialog"`/`aria-modal`/
`aria-labelledby`/`tabIndex` directly in JSX, same division of labor as
`DialogOverlay.tsx`'s `'confirm'`/`'info'`/`'reauth'` kinds vs.
`ModalOverlay.tsx`'s `useHtmlModalA11y` (which only runs for the `'html'`
kind). The bridge function `openActionGuide` (`src/react/bridge/
actionsBridge.ts`) keeps its exact name and call signature — `ActionsPage.tsx`
needed ZERO changes, still `onClick={openActionGuide}` — but its
implementation switched from `getKernel().actions.openActionGuide()` to
`openReactModal(() => createElement(ActionGuideModal, {steps:
getKernel().actions.actionGuideSteps}))`; `createElement` (not JSX) because
`actionsBridge.ts` is a plain `.ts` file, and — the one build-config fix this
conversion needed — `tsconfig.modules.json` (the non-JSX classic/bridge
config, `include: ["src/**/*.ts"]`) was unintentionally also type-checking
every `src/react/**/*.ts` bridge file redundantly alongside
`tsconfig.react.json` (which already covers `src/react/**/*.ts` *and*
`*.tsx` with `jsx:"react-jsx"`); that redundancy was harmless until a bridge
file needed to import a `.tsx` component, at which point the non-JSX config
failed to resolve it. Fixed by adding `"exclude": ["src/react/**"]` to
`tsconfig.modules.json` — `src/react/**` was always meant to be
`tsconfig.react.json`'s domain alone. The classic implementation
(`openActionGuide()` in `actions-page-controller.ts`, `createActionGuideContent`/
`action-guide-content.ts`, and their `root.X=` wiring) was deleted outright
once confirmed to have zero remaining callers — `root.ActionGuidePresentation`
itself (the pure step *data*, from `action-guide-presentation.ts`) stays,
since the React side still reads it. Two now-obsolete test files were
deleted (`action-guide-content.test.js` — exercised the deleted HTML
builder directly; `admin-render-bridge.test.js` — its one-entry table
existed solely to pin `actionGuideContent`'s classic bridge-contract shape),
and two scanner assertions in `tests/ui-route-structure.test.js` were
repointed at the new source of truth (the `const openActionGuide = ` check
dropped from the classic-file list since the function no longer lives
there; the `cls: 'action-guide-modal'` check now reads
`ActionGuideModal.tsx`'s `className` instead, preserving the original
intent — a dedicated CSS class, not a generic modal — against wherever the
modal now actually lives). `scripts/a11y-audit.js`'s `actions:nce-guide`
entry called `openActionGuide()` as a bare global — no longer possible since
it's now React-only, not a `root.X=` global — fixed by clicking the real
"Quy trình 8 bước" button instead (arguably more faithful to the file's own
stated goal of exercising "the real trigger function, not a synthetic
click", since a button click *is* the real trigger now). Verified: `npm
test` 465/465 (467 minus the 2 deleted files), `typecheck` clean,
`check-build-freshness` matches, `a11y-audit` 0 violations across all 18
modals, `ui-workflow-check` 29/29, `nce-workflow-check` 91/91, plus an
ad-hoc script confirming all 8 steps render with correct text, and the
modal closes via Escape and via its "Đóng" button.

Audit's "Lưu trữ nhật ký cũ" (done, second real modal converted): picked
next for being the next-simplest — one `<select>` (12/24/36 months, no
validation) plus a submit button, with **zero local error/loading state
needed in the component itself**, since `ActivityArchiveCommand.execute()`
(unchanged, already using React confirmDialog/infoDialog from the very first
Giai đoạn 3 commit) owns the entire confirm → reauthenticate → download →
confirm-again → close flow internally — `ArchiveLogModal.tsx` only renders
the initial form and calls `confirmArchiveActivityLog()` on submit, letting
that command decide whether/when to call `closeModal()`. This is a
meaningfully different (simpler) shape than a modal that manages its own
draft/validation state, worth remembering as a category: **modals whose
"confirm" button hands off to an existing command that already owns the
close/cancel decision need no local React state at all** — only modals that
validate/collect input themselves (the next tier up in complexity) will.
`root.archiveActivityLog`/`activityAuditArchiveModalHtml` (the classic
opener + HTML builder) were deleted outright, confirmed dead — the gate
logic they held (`requireAdmin()` + "is there anything to archive at all"
via `state.activity.length`) moved into the bridge function
(`src/react/bridge/auditBridge.ts`), reading the count via a new
`kernel.audit.activityTotal()` (`root.confirmArchiveActivityLog` itself
stays classic-side, exposed the same way). Two now-dead files removed
(`activity-audit-archive-modal-html.ts` + its test). This conversion also
exposed a real gap in `scripts/a11y-audit.js`'s own seeding for this modal:
its `open()` used to call `logAct(...)` then the (now-retired) global
`archiveActivityLog()` directly, bypassing the Audit page's own render
entirely — `logAct()` alone does **not** call `rerender()`/`touch()` (most
callers trigger their own re-render right after logging), so nothing had
ever required the just-logged row to actually reach the screen before. Once
the trigger became "click the real button" (same fix pattern as the NCE
guide's `actions:nce-guide` entry), the button's own visibility gate
(`model.total > 0`) meant the test had to force a `rerender()` after
`logAct()` and poll for the button (mirroring the "React commit is
asynchronous relative to a synchronous `page.evaluate` body" lesson from
`nce-workflow-check.js`) — and doing so surfaced a **real, pre-existing**
accessibility bug the old test had never actually exercised: `.audit-seq`'s
`#7c8e9a` on white was only 3.39:1 contrast (needs 4.5:1, since 10.5px bold
doesn't qualify as WCAG "large text"). Fixed by switching to the existing
`--muted` token (`--gray-600`, `#506674`, ~6:1 contrast) instead of a new
one-off hex — a genuine accessibility fix that happened to fall out of
fixing the test's own fidelity, not a change requested by this modal
conversion itself. Verified: `npm test` 464/464, `typecheck` clean,
`check-build-freshness` matches, `a11y-audit` 0 violations across all 18
modals, `ui-workflow-check` 29/29, `nce-workflow-check` 91/91, plus an
ad-hoc script confirming the form renders with the right default
(24 months), and that submitting with only a same-day seeded row correctly
takes the "nothing old enough to archive" path (closes the form, shows the
matching info message) — proving the hand-off to the unchanged
`ActivityArchiveCommand` still works end to end through the new UI.

Reagent's "Chọn phép so sánh" (done, third real modal converted): the first
one with **live search filtering**. Classic `renderRcModal()` had to
debounce the search box (`scheduleSearchRender`) because every keystroke
rebuilt the whole modal's HTML string and re-opened it via `openModal()`;
the React version doesn't need that — `ReagentPickerModal.tsx` holds `query`
in local `useState` and re-filters a plain array on every keystroke, which
is cheap enough to skip debouncing entirely (worth remembering as a general
pattern: a debounce that existed to amortize *string-rebuild-and-reopen*
cost usually isn't needed once the same list becomes a React re-render).
`rcPickerItems(query)` is a new pure-data twin of the deleted
`renderRcModal()`'s filter logic, added to `reagent-page-controller.ts` (mirrors
Actions' `actionGuideSteps` and Audit's `activityTotal()` — expose a plain
data reader on the existing controller rather than inventing new
architecture). This conversion surfaced a **real latent bug in the classic
code**, not just a test-fidelity gap: `rcDelete(id, keepModal)` special-cased
`keepModal=true` (only ever passed by the picker's own delete button) to
call `renderRcModal()` again afterward, refreshing the list to remove the
deleted row — a manual "re-render this one modal" step that has no React
equivalent and would have thrown `ReferenceError` the moment
`renderRcModal` was deleted. Fixed by dropping the `keepModal` parameter
entirely and having `ReagentPickerModal` call `useAppStore()` — the same
`deps.rerender()` that already ran unconditionally at the end of
`rcDelete()` now reaches the picker automatically through the shared store,
same as any other page. This is the general fix for the whole "modal needs
to manually re-open itself after a mutation" class: once a modal subscribes
to the store, that class of special-casing becomes unnecessary and should
be deleted, not ported. Classic `reagent-picker-modal-html.ts`/
`reagent-picker-rows-html.ts` (plus their 2 dedicated tests) were deleted
outright; `tests/reagent-label-bridge.test.js` had its 2 now-retired
contract checks removed (`deps.pres.pickerModal`/`pickerRows`, and the
matching bridge-type-declaration checks) while its ~20 *other* contract
checks (for the parts of this page NOT yet converted) were left untouched;
`tests/reagent-comparison-service.test.js` had one assertion's pinned
`rcDelete` signature text updated to drop `keepModal` while preserving its
actual intent (rcDelete must require admin, not just write — unchanged).
`scripts/a11y-audit.js`'s `reagent:find-existing` entry switched from
calling the now-retired `openRcModal()` global to clicking the real
`.rc-find-btn` (a class selector, since the button's actual text is mixed
with an SVG icon via `dangerouslySetInnerHTML` — matching-by-class is more
robust here than matching visible text). Verified: `npm test` 462/462,
`typecheck` clean, `check-build-freshness` matches, `a11y-audit` 0
violations across all 18 modals, `ui-workflow-check` 29/29,
`nce-workflow-check` 91/91, plus an ad-hoc script confirming live search
narrows/restores the row list without any debounce delay, and picking a row
closes the modal.

Settings' "Xem hàng chờ QC" (done, fourth real modal converted, LIS Gateway
queue): the most involved conversion so far, because unlike the prior
three, **the trigger itself does real async work before deciding whether to
open anything** (`lisOpenQueueModal()` checks `gatewayConfig().enabled` and
does a network `gatewayPull()` before showing data) — a classic `.ts` file
can run that logic, but can't construct the JSX to show afterward. Split
cleanly: `lis-queue-controller.ts`'s `lisOpenQueueModal()` now does only the
check-and-pull and returns a `Promise<boolean>` (open or don't); the bridge
(`settingsBridge.ts`) awaits it and calls `openReactModal(...)` only on
`true` — the same "classic owns verification, React owns presentation"
split used for `reauthenticateCurrentUser`'s PBKDF2 check vs. its form.
`lisQueueModel()` (new, mirrors `rowHtml`/`sectionHtml`/`modalHtml`'s branch
logic but returns `{pending, unresolved}` data) reuses the SAME `rowModel()`
addition to `lis-queue-presentation.ts`, added alongside — not replacing —
`rowHtml`, since `rowHtml`/`sectionHtml`/`modalHtml` still exist and pass
their own dedicated tests unchanged; only the *controller's* call sites
moved off them. `lisQueueRefresh`/`lisQueueImport`/`lisQueueReject` — which
used to call the classic `lisRenderQueueModal()` to redraw the list after
every action — were simplified to call the already-existing `deps.rerender()`
instead (a new `rerender` dependency added to the controller's `deps`), and
`LisQueueModal.tsx` subscribes via `useAppStore()`; this is now the **third**
instance of the exact fix pattern first found in Reagent's picker
(`keepModal`/manual re-open → store subscription), confirming it as the
general rule for any modal that must reflect a mutation it just caused.
`scripts/a11y-audit.js`'s `settings:lis-queue` entry could no longer bypass
the network check by calling `lisRenderQueueModal()` directly (that
function still exists but nothing in the live UI calls it anymore) — fixed
by stubbing the two classic globals its real check reads
(`lisGatewayConfig`/`lisGatewayPull`, both bare, reassignable `root.X`
functions) and clicking the real "Xem hàng chờ QC" button, matching the
"click the real trigger" convention from the two prior a11y-script fixes.
Verified: `npm test` 462/462, `typecheck` clean, `check-build-freshness`
matches, `a11y-audit` 0 violations across all 18 modals, `ui-workflow-check`
29/29, `nce-workflow-check` 91/91, plus an ad-hoc script confirming both
queue sections render with correct counts, and that rejecting an
unresolved row removes it from the list — and the section disappears
entirely — without the modal ever closing or being reopened.

Users' "Sửa quyền" (done, fifth real modal converted): the first modal
where **the checkbox grid stays `dangerouslySetInnerHTML` on purpose** —
`syncUserPermChecks(groupId, roleValue)` (unchanged) directly toggles
`disabled`/`checked` on the raw DOM checkboxes when the role `<select>`
changes, exactly the same pattern the "Thêm người dùng" form already used
since Giai đoạn 2 (a classic function mutating inside a React-opaque
`dangerouslySetInnerHTML` block is safe, since React never diffs inside
it) — so this modal needed NO new interaction logic, just wiring the
existing pieces (`roleSelectOptionsHtml`, `userPermChecksHtml`,
`syncUserPermChecks`, all already bridged from Giai đoạn 2's Users page)
into a real `.modal`/`.modal-h`/`.modal-b`/`.modal-f` JSX shell. `openUserPerms(id)`
followed the same split as `lisOpenQueueModal()`: the classic function now
returns `Promise<Model | null>` (permission gate + "not editing yourself"
check, `null` on any failure) instead of opening anything; the bridge awaits
it and calls `openReactModal(...)` only on a non-null result.
`applyUserPerms(id)` needed **zero changes** — it already read
`#editUserRole`/`#editUserPerms` straight from the DOM at submit time,
oblivious to whether React or a template string produced those elements
(same reason Manage/Settings' uncontrolled-form fields never needed
conversion work either). Classic `user-permissions-modal-html.ts`/
`user-role-select-html.ts` deleted outright (2 dedicated tests removed);
`tests/users-page-bridge.test.js` had its now-retired
`userPermissionsModalHtml` contract check removed while its `resetPasswordModalHtml`
check (a different, still-unconverted modal) stayed untouched.
`scripts/a11y-audit.js`'s `users:edit-permissions` switched from calling
the retired `openUserPerms()` global to clicking the real "Sửa quyền"
button. Verified: `npm test` 460/460, `typecheck` clean,
`check-build-freshness` matches, `a11y-audit` 0 violations across all 18
modals, `ui-workflow-check` 29/29, `nce-workflow-check` 91/91, plus an
ad-hoc script confirming the modal opens with the right role/permission
state (4 disabled checkboxes under "technician"), and that switching the
role to "admin" correctly re-enables every checkbox live, matching the
exact classic behavior.

Manage's máy xét nghiệm (done, sixth real modal converted): the first
**pure CRUD form** in Giai đoạn 3 — no async gate on open, no live search, no
role-driven checkbox logic, just 4 text inputs + a checkbox, entirely
uncontrolled (`defaultValue`/`defaultChecked`), submit hands off to the
unchanged `saveConfigInstrument(id)`. `openConfigInstrumentModel(id)` (new,
replaces `openConfigInstrument`) is a plain synchronous data reader — no
`Promise`/gate split needed this time, unlike `lisOpenQueueModal`/
`openUserPerms`, since the classic function never checked permissions on
*open*, only on *save*. This conversion surfaced a **real, pre-existing
wiring gap** that had nothing to do with the HTML-vs-React question: `kernel.manage`
was missing `saveConfigInstrument` entirely — it was never needed before,
because the classic modal's save button was plain `data-action="saveConfigInstrument"`
HTML, dispatched by `action-dispatcher.ts`'s direct `root.X` lookup, which
never went through the kernel at all. The moment the button became a real
`onClick={() => getKernel().manage.saveConfigInstrument(id)}`, the missing
kernel entry surfaced immediately as `getKernel(...).manage.saveConfigInstrument
is not a function` — caught by an ad-hoc debug script before it could reach
committed code. General lesson for the remaining Manage/Sigma modals: **check
that every action a converted modal's buttons call is actually present on
`kernel.X`, not just assume it's not there because it "was working before"** —
a modal only reaching the kernel for its OPEN path (already routed through
`kernel.manage.openConfigInstrument` since Giai đoạn 2) says nothing about
whether its SAVE path was ever exercised through the kernel too. `openConfigAssay()`
(still classic, unconverted) has its own internal redirect — if no
instruments exist yet, it force-opens the instrument modal first, to guide
the user — which used to call the local `openConfigInstrument()` directly;
now it calls a new `deps.openReactInstrumentModal()` dependency, wired to
`window.QCLabReact.openConfigInstrument()` (the same bridge function real
buttons call), the same "classic caller reaching into the React modal
system" pattern already used for `reauthenticateCurrentUser`. Classic
`config-instrument-modal-html.ts` deleted outright (1 dedicated test
removed); `tests/manage-core-bridge.test.js` had its 2 now-retired contract
checks removed; `tests/manage-crud-labels.test.js` (a title-convention
check running across every Manage CRUD modal) had its instrument branch
repointed from the deleted classic file to `InstrumentModal.tsx`'s JSX text.
`scripts/a11y-audit.js`'s `manage:add-instrument`/`manage:edit-instrument`
and `scripts/ui-workflow-check.js`'s instrument add/edit checks all switched
from calling the retired `openConfigInstrument()` global to clicking the
real toolbar/row buttons. Verified: `npm test` 459/459, `typecheck` clean,
`check-build-freshness` matches, `a11y-audit` 0 violations across all 18
modals, `ui-workflow-check` 29/29 (including the real add/edit-instrument
flows that caught the `saveConfigInstrument` gap), `nce-workflow-check`
91/91.

Manage's lô QC (done, seventh real modal converted): same CRUD-form shape as
the instrument modal, plus **2 date fields** (Ngày mở/Hạn sử dụng) — kept as
`dateBoxHtml()` + `dangerouslySetInnerHTML`, the established "deferred
field" treatment, since nothing else in this modal needs to react to the
date value while typing (only read at submit via `saveConfigLot`, unchanged).
The level `<select>` also stays `dangerouslySetInnerHTML` for its `<option>`s
(`configLotLevelOptionsHtml(level)`, newly exposed on `kernel.manage`) since
it needs no live interaction either — matching Users' role-select precedent
of keeping simple, read-at-submit pickers as raw HTML rather than converting
them to controlled `<option>` JSX for no behavioral benefit. Caught the
**exact same missing-kernel-wiring bug class** as the instrument modal,
twice in a row now: `kernel.manage` was missing `saveConfigLot` too (same
root cause — its save button used to be classic `data-action`, dispatched
straight off `root.X`, never through the kernel) — found immediately via
typecheck-clean-but-runtime-broken behavior, fixed the same way. This
confirms the lesson from the instrument modal as a **standing checklist
item** for every remaining Manage/Sigma conversion: before wiring a modal's
save button to `getKernel().manage.X(...)`, grep `kernel.manage`'s
construction block for `X:` — don't assume presence from the open-path
already working. Classic `config-lot-modal-html.ts` deleted outright (1
dedicated test removed); `tests/manage-core-bridge.test.js` had 2 more
now-retired contract checks removed, one of which needed repointing rather
than deleting outright (`configLotLevelOptionsHtml`'s *consumption* check
moved to `LotModal.tsx`, since the function itself is still a valid bridge
contract — only *where* it's called from changed). `tests/manage-crud-labels.test.js`'s
lot branch repointed to `LotModal.tsx`'s JSX, mirroring the instrument
branch. `scripts/a11y-audit.js`'s `manage:add-lot`/`manage:edit-lot`
entries needed to switch to the "lots" tab first (`Manage` defaults to
"instruments") — and since that tab switch shares the exact "React commit
is async relative to a synchronous script body" race documented for
`audit:archive-log`, this surfaced a **latent ordering bug in the audit
script itself**: `manage:add-lot`/`manage:edit-lot` leaving the tab
switched to "lots" made the *already-passing* `manage:edit-instrument`
entry (which runs later in the same array and assumed the default
"instruments" tab was still active) start failing — fixed by having every
Manage tab-dependent entry explicitly call `setManageTab(...)` itself
(with the same async retry-poll for the resulting button) rather than
relying on residual state from whichever entry happened to run before it.
Verified: `npm test` 458/458, `typecheck` clean, `check-build-freshness`
matches, `a11y-audit` 0 violations across all 18 modals, `ui-workflow-check`
29/29, `nce-workflow-check` 91/91, plus an ad-hoc script confirming the
level options render correctly (1–6), the date field widgets are present,
and saving persists all fields (including a blank date correctly staying
blank) and closes the modal.

Manage's Panel QC (done, eighth real modal converted): the first modal with
a **dependent, live-filtered list** — which tests show as checkboxes
depends on the currently-selected instrument. Classic `renderConfigPanelTests()`
rebuilt the whole checkbox-list HTML string on every instrument change (a
`data-action-on="change"` handler); the React version needs no such
rebuild-and-inject step — `PanelModal.tsx` keeps `instrumentId` in real
`useState` (the ONE genuinely-controlled field in this modal) and derives
`visibleTests = allTests.filter(t => t.instrumentId === instrumentId)`
inline, letting React's own reconciliation mount/unmount the right
`<input>` checkboxes. The subtlety: classic behavior always resets to an
all-unchecked list on instrument change (never remembers a previous
selection for a re-selected instrument) — reproduced with
`defaultChecked={instrumentId === initialInstrumentId && testIds.includes(t.id)}`,
which is `true` only for the ORIGINALLY-loaded instrument's originally-saved
test IDs; switching to any other instrument (including switching back)
naturally unmounts/remounts those checkbox nodes with a fresh (unchecked)
`defaultChecked`, matching classic behavior with zero manual reset code.
`openConfigPanelModel(id)` also has **two sequential preconditions** (no
tests yet / no instruments yet), each showing an `infoDialog` and switching
the Manage tab before returning `null` — same `Promise<Model | null>` shape
as `lisOpenQueueModal`/`openUserPerms`. Hit the **exact missing-kernel-wiring
bug a third time**: `kernel.manage` was missing `saveConfigPanel` too — by
now a fully expected, quickly-caught category rather than a surprise.
`renderConfigPanelTests()` itself, and the 3 classic HTML builders it and
`openConfigPanel()` used (`config-panel-modal-html.ts`, `config-panel-test-rows.ts`,
`config-panel-instrument-options-html.ts`), were deleted outright once
confirmed to have zero remaining callers (6 dedicated tests removed across
the 3 files); `tests/manage-core-bridge.test.js` had 4 more now-retired
contract checks removed, `tests/manage-crud-labels.test.js`'s Panel QC
branch repointed to `PanelModal.tsx`'s JSX. No a11y-audit.js/ui-workflow-check.js
changes needed — Panel QC was never in either script's tracked list.
Verified: `npm test` 455/455, `typecheck` clean, `check-build-freshness`
matches, `a11y-audit` 0 violations across all 18 modals, `ui-workflow-check`
29/29, `nce-workflow-check` 91/91, plus an ad-hoc script confirming the
test list correctly filters per instrument, shows the empty state for an
instrument with none, and resets to unchecked when switching instruments
and back.

Manage's nhóm lô (done, ninth real modal converted): lots grouped into
columns by level, each a real checkbox — simpler than Panel QC since
nothing here needs to be re-filtered when a checkbox changes (unlike
Panel's instrument-dependent test list), so the whole column structure is
plain JSX with uncontrolled (`defaultChecked`) checkboxes, no local
`useState` at all. `suggestConfigGroupName()` (unchanged, still reads
`.cfg-group-lot:checked` and writes `#cfgGroupName` directly) is wired via
one `onChange` on the `.lot-level-picker` container — the same
"container-level catch-all instead of per-checkbox handlers" pattern
`FormOpenBody`'s `actionFormChanged` established back in the Actions page.
`openConfigGroupModel(id)` has one precondition (no lots yet exist at all)
returning `Promise<Model | null>`, same shape as the last several
conversions. Classic `lot-group-modal-html.ts`/`lot-group-columns-html.ts`
deleted outright (2 dedicated tests removed — NOT
`lot-group-status.test.js`/`lot-group-toggle-action.test.js`, which test
unrelated status/toggle logic and were left untouched);
`tests/manage-core-bridge.test.js` had its 4 now-retired contract checks
removed, `tests/manage-crud-labels.test.js`'s "nhóm lô" branch repointed to
`LotGroupModal.tsx`. Neither `a11y-audit.js` nor `ui-workflow-check.js`
tracks this modal, so no script changes needed. An ad-hoc verification
script's first attempt looked like a save failure (`groupCount` unchanged,
modal stayed open) — turned out to be the test picking lots already
belonging to the existing seeded group, then (after fixing that) picking
only one fresh lot, both correctly rejected by the **pre-existing** "a lot
group needs at least 2 lots" validation with an `infoDialog` message; not a
regression, a reminder to check for a blocking `infoDialog` before assuming
a save silently failed. Verified: `npm test` 453/453, `typecheck` clean,
`check-build-freshness` matches, `a11y-audit` 0 violations across all 18
modals, `ui-workflow-check` 29/29, `nce-workflow-check` 91/91, plus the
corrected ad-hoc script confirming the auto-name suggestion updates live as
lots are checked and the group saves/closes correctly with 2+ lots.

Six Sigma's "Chọn hoặc thêm xét nghiệm" (done, tenth real modal converted,
first Sigma modal): the first modal after the Manage series, and the first
case where `kernel.sigma` needed **zero new wiring** at all —
`kernel.sigma = sigmaPageController` is a direct spread of the whole
controller (unlike `kernel.manage`'s hand-curated object), so every new
function (`sgOpenAddTestModel`, `sgAddTestPickerItems`) was automatically
reachable the moment it existed on the controller — confirming Manage's
repeated "missing kernel wiring" bug class was specific to `kernel.manage`'s
itemized shape, not a general risk for every page. Otherwise the same
picker shape as Reagent's modal: `useState` query, no debounce, `sgTrackTest`/
`sgViewTrackedTest` per row depending on whether that test is already
tracked. Found a **real trigger-duplication trap** distinct from anything
seen so far: the "+ Thêm xét nghiệm" button appears in TWO places — a real
JSX button on the tracked-tests toolbar, AND a second copy embedded as raw
`data-action="sgOpenAddTest"` HTML inside `emptyStateHtml()`'s
`dangerouslySetInnerHTML` output (shown only when Sigma has zero tracked
tests). `action-dispatcher.ts` resolves that second button by looking up
the bare global `window.sgOpenAddTest` — so simply repointing the *bridge*
export (as done for every other modal) would leave this one embedded button
silently broken, since it never goes through the bridge at all. Fixed by
also repointing the classic `root.sgOpenAddTest` global itself to call
`window.QCLabReact.sgOpenAddTest()` (the same React-opening bridge
function) — the third instance of the "classic caller reaching into the
React modal system via `window.QCLabReact`" pattern (after
`openReactInstrumentModal`/`reauthenticateCurrentUser`), but the first time
it was needed to keep a *dead-simple* global name working rather than a
deliberate cross-controller redirect. The gate-check function itself was
renamed `sgOpenAddTest` → `sgOpenAddTestModel` to free up the bare name for
this redirect, matching Manage's `openConfigXModel` convention retroactively.
`scripts/a11y-audit.js`'s `sigma:add-test` entry needed **no change** —
unlike every other converted modal, calling `sgOpenAddTest()` as a bare
global still correctly opens the React modal now, precisely because of the
redirect above. Classic `sigma-add-test-modal-html.ts`/`sigma-add-test-rows-html.ts`
deleted outright (2 dedicated tests removed); `tests/sigma-comp.test.js`/
`tests/sigma-tracked-test-bridge.test.js` had their now-retired
classic-file/contract checks repointed or removed. Verified: `npm test`
451/451, `typecheck` clean, `check-build-freshness` matches, `a11y-audit` 0
violations across all 18 modals, `ui-workflow-check` 29/29,
`nce-workflow-check` 91/91, plus an ad-hoc script confirming BOTH trigger
paths (the real toolbar button and the embedded empty-state button) open
the identical modal correctly.

Six Sigma's "Tính Bias% từ EQA/EQC" (done, 11th real modal converted):
the first modal with a **dynamic list edited live per keystroke** —
add/remove EQA/EQC rounds, with per-round Bias% and a rolling summary
(valid-round count, signed mean, RMS, mixed-signs warning) all recomputed on
every edit. Classic `sgRenderBiasModal()`/`sgBiasUpdateSummary()` did this by
re-reading the whole `<table>` via `sgBiasRowsFromDom()` and patching
`innerHTML`/`textContent` by hand on every keystroke and every add/delete.
The conversion did **not** port that DOM-patching machinery at all: `rounds`/
`periodIds` became real `useState`, and the summary math — `sgBiasStats()`,
already a pure TypeScript service call (`deps.SigmaBiasService.stats(rounds)`,
no DOM involved) — is called directly inside the component's render
(`getKernel().sigma.sgBiasStats(rounds)`), so React just re-renders whenever
`rounds` changes; no "update the summary" function of any kind survives.
This is the first Giai đoạn 3 modal where an entire cluster of DOM-reader/
DOM-writer functions (`sgRenderBiasModal`, `sgBiasUpdateSummary`,
`sgBiasSelectPeriods`, `sgBiasAdd`, `sgBiasDel`, `sgBiasRowsFromDom`,
`sgBiasPeriodsFromDom`) was deleted with **no replacement function at all** —
every bit of that state now just lives in the component. `sgOpenBias()` split
into `sgOpenBiasModel(eid, level)` (synchronous, returns `Model | null` — no
permission gate on open, matching prior behavior exactly, since the triggering
button itself is already hidden unless `canWrite`). `sgBiasApply()` changed
signature from reading `ui().sgBiasCtx` (a DOM-fed side-channel) to taking
`(level, periodIds, rounds)` directly as parameters — with no more side-channel
needed, `sgBiasCtx` itself was deleted from `SigmaUIState`/`global.d.ts`
outright (confirmed zero remaining readers). `sgBiasStats`/`sgBiasRoundsKey`/
`sgBiasLinkedPeriodIds`/`sgApplyBiasToPeriods` (pure functions with their own
public contract via `tests/sigma-comp.test.js`) were left untouched. Classic
`sigma-bias-modal-html.ts`/`sigma-bias-rows-html.ts`/`sigma-bias-summary-html.ts`
deleted outright (3 dedicated tests removed). `scripts/a11y-audit.js`'s
`sigma:add-bias` switched from calling the retired `sgOpenBias()` global to
clicking the real "Bias EQA% Mức 1" button. This modal's first a11y run
surfaced a real, expected gap: the new component was missing
`role="dialog"`/`aria-modal`/`aria-labelledby`/`tabIndex` (present in every
prior real-JSX modal since `ActionGuideModal.tsx`, simply forgotten here) —
axe-core caught it as a genuine "region" (moderate) violation; adding the same
attributes brought it back to 0 violations across all 18 modals. Verified:
`npm test` 448/448, `typecheck` clean, `check-build-freshness` matches,
`a11y-audit` 0 violations (18/18 modals), `ui-workflow-check` 29/29,
`nce-workflow-check` 91/91, plus an ad-hoc script confirming two rounds with
opposite-sign bias produce the correct per-row values, RMS, and mixed-signs
warning live as they're typed; add/delete correctly changes the row count
(never below 1, even deleting every round); the period checkbox and Apply
button correctly persist `biasEqa`/`eqaRounds` onto the record and close the
modal.

Six Sigma's "Ngân sách độ không đảm bảo đo (MU)" (done, 12th real modal
converted): same family as Bias (multiple rows edited live, values
recomputed on every keystroke) but with **no dynamic add/remove** — the row
count is fixed to the test's operational level count
(`sgVisibleLevels(t)`), so `rows` is just a fixed-size `useState` array, no
add/delete logic needed. Same cluster-deletion pattern as Bias: classic
`sgMuRowsFromDom`/`sgMuPeriodsFromDom`/`sgMuCaptureDom`/`sgRenderMuModal`/
`sgMuUpdatePreview`/`sgMuSelectPeriods` deleted with **no replacement** —
`sgMuPreview(level)` became `sgMuPreview(eid, level, rows)`, a pure function
(no more `ui().sgMuCtx` side-channel) called directly during render for each
row, so the live u_c/U preview and the "Thiếu ..."/"Đủ thành phần" state
update automatically on every uCal/uCalBasis/muBiasMode change with no
"update the preview" function surviving at all. `sgOpenMU(eid)` split into
`sgOpenMUModel(eid)` — **keeping** the `requireWrite()` gate on open (unlike
Bias, which has none — matching each one's original classic behavior
exactly, not a new convention). `sgMuApply()` changed from reading
`ui().sgMuCtx` to taking `(eid, periodIds, rows, reviewedBy, reviewedDate)`
directly; the audit-log/save/close/rerender sequencing stays entirely inside
`SigmaMuWorkflowCommand` (unchanged) — the first Sigma modal in this
sub-group where the apply hand-off already owned the close decision, same
shape as Audit's archive-log modal. `sgMuCtx` deleted from `SigmaUIState`/
`global.d.ts` (zero remaining readers); `tests/lab-ui-state.test.js`'s
generic accessor-round-trip example switched to `sgCohortCtx` (the one
remaining ctx-shaped field, for the still-unconverted cohort-picker modal).
Hit the **dual-trigger-path bug a second time** (after `sgOpenAddTest`): the
"Nhập u(Cal)" trigger is not JSX at all — it lives in `#sgMUAction`, an
empty `<div>` in `SigmaPage.tsx` that `sgRefresh()` patches via `innerHTML`
after every render, embedding classic `data-action="sgOpenMU"` —
`action-dispatcher.ts` resolves it via the bare global `window.sgOpenMU`.
Fixed the same way: `root.sgOpenMU` stays a bare global but now redirects to
`window.QCLabReact.sgOpenMU(eid)` instead of
`sigmaPageController.sgOpenMUModel` (gate-check only, opens nothing) —
`scripts/a11y-audit.js`'s `sigma:mu-budget` entry needed **no change**
(calling the bare global still correctly opens the React modal). The
review-date field (`sgMuDate`) stays `dangerouslySetInnerHTML` via
`dateBoxHtml()` like every other deferred date field — its value is read
directly off the DOM at Apply time (the calendar widget writes to that
input outside React's knowledge), not tracked in React state. Classic
`sigma-mu-modal-html.ts`/`sigma-mu-rows-html.ts`/`sigma-mu-preview-html.ts`
deleted outright (3 dedicated tests removed); two scanner assertions
(`tests/uncertainty.test.js`, `tests/sigma-mu-workflow-bridge.test.js`)
updated to match the new function signatures, same intent preserved (MU
apply always gates on write permission, always goes through the TypeScript
workflow command, a missing u(cal) is never silently treated as 0).
Verified: `npm test` 445/445, `typecheck` clean, `check-build-freshness`
matches, `a11y-audit` 0 violations across all 18 modals (this component had
`role="dialog"`/`aria-modal`/`aria-labelledby`/`tabIndex` from the start,
learned from Bias's initial miss), `ui-workflow-check` 29/29,
`nce-workflow-check` 91/91, plus an ad-hoc script confirming: clicking the
real embedded `#sgMUAction` button opens the modal with the correct row
count; typing u(cal) live-recomputes u_c/U; switching the bias-handling
select from "include" to "exclude" correctly flips the state from "Thiếu
u(bias)" to "Đủ thành phần"; Apply persists `uCal`/`muBiasMode`/
`muReviewedBy` and closes the modal.

Manage's "Hồ sơ TEa chuẩn hóa" (done, 13th real modal converted, tab
"tearefs"): the most validation-heavy CRUD modal so far —
`teaLabProfileSave()` runs 6 sequential `infoDialog` checks (value > 0, a
source chosen, reference text ≥3 chars, reason ≥10 chars, valid
effective+approved dates, approved date not after effective date, next-review
date not before effective date, both preparer and approver filled) — but
needed **zero changes** to `teaLabProfileSave()`/`teaLabProfileRemove()`
themselves, since both already read the DOM directly by element id (same
uncontrolled-form pattern as Instrument/Lot). `teaLabProfileOpen()` split into
`teaLabProfileOpenModel()` — a plain synchronous data reader, no async gate.
`kernel.manage` needed **no new wiring** this time: `teaRefEdit`/
`teaRefRemove`/`teaLabProfileOpenModel`/`teaLabProfileSave`/
`teaLabProfileRemove` all belong to `managePageController` (not
`manageTestsActionsController`), and `kernel.manage`'s `...managePageController`
spread already carried all of them — reconfirming the standing rule that the
missing-wiring bug class is specific to functions owned by
`manageTestsActionsController`, not a blanket risk for every Manage modal.
The 6-option "primary source" select renders real JSX `<option>`s instead of
`dangerouslySetInnerHTML` — a small, static list with no reason to keep as a
string. Classic `tea-reference-lab-profile-body-html.ts`/
`tea-reference-lab-profile-modal-html.ts` deleted outright (2 dedicated
tests removed); 4 other scanner tests (`ui-accessibility.test.js`,
`manage-crud-labels.test.js`, `manage-core-bridge.test.js`,
`tea-reference-bridges.test.js`) updated to match the new function/file
locations. `scripts/a11y-audit.js`'s `manage:tea-lab-profile` switched from
calling the retired bare global to switching to the "tearefs" tab and
clicking the real row button for "Sodium". This is the first time switching
to a real-button trigger surfaced a **genuine pre-existing accessibility
bug unrelated to the modal itself**: since the test had never before made a
real browser actually render the "tearefs" tab, axe-core had never scanned
the underlying TEa reference table — its two per-row CLIA%/Ricos% inputs
(`.tea-ref-value`) had no accessible label at all, a real "critical"
violation dating back to Manage's 2026-08-29 React migration. Fixed by
adding a descriptive `aria-label` (naming the column and the test) to both
inputs in `ManagePage.tsx`'s `TeaRefRow`. Verified: `npm test` 443/443,
`typecheck` clean, `check-build-freshness` matches, `a11y-audit` 0
violations across all 18 modals (including the newly-fixed table gap),
`ui-workflow-check` 29/29, `nce-workflow-check` 91/91, plus an ad-hoc script
confirming: clicking "Thêm hồ sơ" opens the modal in create mode (no remove
button); saving with required fields empty shows the correct validation
message and keeps the modal open; filling all 6 required fields saves the
complete profile (source, reference, reason, dates, preparer/approver) into
`state.teaRefs` and closes the modal; reopening correctly shows edit mode
("Xem hồ sơ" button, a remove button present, the saved value pre-filled).

Manage's "Hồ sơ chuyển tiếp lô" (done, 14th real modal converted, tab
"transitions"): the most complex modal so far — a hand-written fuzzy-match
combobox (free typing, not a `<select>`) for Lô cũ/Lô mới, plus an embedded
Mean/SD table that recomputes dynamically from whichever Panel/Lô cũ/Lô mới
are currently selected. Key design decision: the combobox stays
**uncontrolled** — `LotComboInput` reads/writes `dataset.lotId` directly on
the input via a ref, matching the exact `this`-bound classic contract, so
`lotTransitionSelectedId()` (unchanged) still reads it correctly by DOM id —
meaning `saveLotTransitionV2()` needed **zero changes**. Only a resolved lot
ID is reported up to parent state (`fromLotId`/`toLotId`) to trigger
recomputing the Mean/SD table — the component never controls what the user
is mid-typing. The suggestion `<datalist>` is computed **once** at open time
(matching classic behavior — it was never live-refreshed per keystroke
either). The Mean/SD table itself moved to pure data:
`lotTransitionTargetsModel(panelId, fromLotId, toLotId)` is a 1:1 port of
classic `lotTransitionTargetsHtml()` (same calls to
`inspectAcceptedLotTransition`/`targetRangeDraft`/`targetNumberText`) but
returns an object instead of an HTML string, called directly during render —
eliminating `refreshLotTransitionTargets()`/`filterLotTransitionTargets()`
entirely (the search filter becomes a plain `useState` + `normalizeSearchText`
filter over the rows). The 4 mean/low/high/sd inputs per row stay
uncontrolled (`defaultValue`), wired to `syncTargetRange(el, kind)` via
`onChange` — the exact same pattern as Manage's own Mean/SD matrix tab.
`openLotTransitionV2()` split into `openLotTransitionModel()`
(`Promise<Model | null>`, with its two existing preconditions — no Panel QC
yet / fewer than 2 lots — unchanged). Hit the **missing-kernel-wiring bug a
fourth time**: `kernel.manage` was also missing `saveLotTransitionV2` (same
root cause as every prior instance — its save button was classic
`data-action`, never routed through the kernel). Classic
`lot-transition-choice-html.ts`/`lot-transition-modal-html.ts`/
`lot-transition-targets-html.ts` deleted outright (3 dedicated tests
removed); 2 other tests updated (`manage-crud-labels.test.js`;
`lot-transition-picker.test.js` — its pure `lotTransitionChoiceMatch` half
stays unchanged, only the HTML-shape half now scans the new `.tsx`'s JSX).
**`scripts/ui-workflow-check.js` needed a real fix, not just a test tweak**:
its `checkLotTransitionPicker()` called the now-gone bare global
`openLotTransitionV2()` directly — switched to clicking the real toolbar
button (`.rcfg-tools .btn.teal`) with the same async retry-poll used
elsewhere after `setManageTab()`. This modal was never in
`scripts/a11y-audit.js`'s 18-modal list, so that script needed no change.
Verified: `npm test` 440/440, `typecheck` clean, `check-build-freshness`
matches, `a11y-audit` still 0 violations across the existing 18 modals (no
regression), `ui-workflow-check` 29/29 (including its 3 real
lot-transition-combobox checks, now exercising the converted modal end to
end), `nce-workflow-check` 91/91, plus two ad-hoc scripts confirming:
create → reopen correctly shows "Sửa hồ sơ chuyển lô"/"Lưu thay đổi" with
the combobox showing the full saved label; and, once the test's `levels[]`/
`meanSdHistory` were seeded correctly, the Mean/SD table renders one "Đã
nhập" row, the live search box correctly hides/restores it, and editing the
mean field keeps the newly typed value.

Manage's xét nghiệm (done, 15th real modal converted — the largest form in
the whole migration): a 13-row Westgard rule action/scope table, CUSUM
settings, a TEa autocomplete matched against the analyte catalog, and an
instrument-driven Khoa/Khu vực auto-fill. `saveConfigAssay()` needed **zero
changes** (still reads every field via `document.getElementById(...)`, same
as every prior CRUD modal), and neither did the two auto-fill side effects —
`configAssaySuggestionInput(value)` (looks up a TEa ref for the typed name,
overwrites `#cfgAssayTeaRefKey`/`#cfgAssayTeaSource`/`#cfgAssayUnit`/
`#cfgAssayTea` directly, deliberately **not** `#cfgAssaySection`) is wired via
`onChange` on `#cfgAssayName`; `configAssayInstrumentChanged` (`this`-bound,
auto-fills `#cfgAssaySection` from the selected option's `data-section`) is
wired via `onChange` on `#cfgAssayInstrument` — the same `this`-bound
convention as `syncTargetRange`/`toggleTargetRow`. `openConfigAssay()` split
into `openConfigAssayModel(id)` (synchronous, `Model | null` — keeping the
existing "no instruments yet" gate that redirects to the instrument modal).
Hit the **missing-kernel-wiring bug a fifth time**: `saveConfigAssay`,
`configAssaySuggestionInput`, and `configAssayInstrumentChanged` were *all
three* missing from `kernel.manage` (only `openConfigAssay` itself was
present, needing renaming). This modal's own unique wrinkle: `openConfigAssay`
is also called from a **different page** — Westgard's CUSUM empty state
("Mở cấu hình xét nghiệm") — through a **separate** bridge
(`westgardBridge.ts`, routed via `kernel.pres.openConfigAssay`, not
`kernel.manage`) — so both bridge files needed updating together to open the
same `AssayModal.tsx`, and the rename had to be applied consistently on
**both** `kernel.manage` and `kernel.pres` (the latter reads `root.openConfigAssay`,
also renamed). Classic `config-assay-modal-html.ts`/
`config-assay-instrument-options-html.ts`/`config-assay-rule-rows-html.ts`/
`config-assay-tea-options-html.ts`/`config-assay-decimal-options-html.ts`
deleted outright (5 dedicated tests removed); 3 other tests updated
(`manage-crud-labels.test.js`, `manage-core-bridge.test.js`,
`entry-service.test.js` — two assertions needed their old template-literal
interpolation syntax `${value}` updated to JSX's `{v}`). Both
`scripts/a11y-audit.js`'s `manage:add-assay`/`manage:edit-assay` entries and
**`scripts/ui-workflow-check.js`'s `checkManageForms()`** (a real
verification script, not just a test — it called the bare global
`openConfigAssay()` directly) needed switching to select the "assays" tab
and click the real button. Verified: `npm test` 435/435 (typecheck clean on
the **first** attempt — despite being the largest, most complex form,
keeping every save/auto-fill function completely unchanged kept the actual
risk lower than expected), `check-build-freshness` matches, `a11y-audit` 0
violations across all 18 modals, `ui-workflow-check` 29/29 (including "Form
thêm xét nghiệm tạo data branch...", "Số thập phân và CUSUM được lưu từ
DOM", "Thêm xét nghiệm ghi audit" — all now exercised through the converted
modal), `nce-workflow-check` 91/91, plus two ad-hoc scripts confirming:
typing a known analyte name correctly auto-fills TEa ref/unit/value without
touching section; changing to an instrument that actually has a section
correctly auto-fills Khoa/Khu vực; opening an existing test correctly shows
"Sửa xét nghiệm"/"Lưu thay đổi" with all 13 Westgard rule rows present; and
the Westgard page's CUSUM "Mở cấu hình xét nghiệm" button correctly opens
the exact same assay modal through the `kernel.pres` path.

Actions' "Chi tiết phiếu xử lý sự cố" (done, 18th and **final** real modal
converted, `viewActionDetail` — not part of `scripts/a11y-audit.js`'s
tracked 18-modal list): a purely **read-only** display modal (no input
fields, just a "Đóng" button) — the exact opposite of every CRUD modal
before it. Design decision: kept the entire >10-function HTML-composition
logic (`actionDetailMetaHtml`, `actionEvidenceTimelineHtml`,
`actionContainmentDetailHtml`, `actionCauseDetailHtml`, …, branching on
legacy/modern/cancelled record shape) completely unchanged —
`viewActionDetail()` split into `viewActionDetailModel(i)`, changing only
"return `{bodyHtml}`" instead of "open the modal directly", **not** a
rewrite into 10+ JSX components. `ActionDetailModal.tsx` renders the outer
shell (role/title/close button) as real JSX, but the **entire body** goes
through **one** `dangerouslySetInnerHTML` — the first time a converted
modal used it for the whole body rather than a single isolated field
(date picker, option list) — justified because every field in this content
is display-only, with nothing needing `onChange`. The "Xem điểm QC" button
embedded in the rerun-evidence block keeps its classic
`data-action="openActionQcEvidence"` — it keeps working unmodified because
`action-dispatcher.ts` listens at the `document` level (not React-specific)
and `root.openActionQcEvidence` is untouched — confirming a `'react'`-kind
modal can still safely embed classic `data-action` content, not just
isolated fields. `scripts/nce-workflow-check.js`'s
`checkEvidenceTimelineAndLink()` (another real verification script, not
just a test — it called the bare global `viewActionDetail(0)` directly)
switched to clicking the real "Chi tiết" button; safe because the
immediately-preceding check in the same session already narrows
`state.actions` to exactly one record, so the click is unambiguous. Classic
`action-detail-modal-html.ts` deleted outright (1 dedicated test removed);
1 other test updated (`ui-route-structure.test.js`, two structural
assertions renamed). Verified: `npm test` 434/434 (typecheck clean on the
first attempt), `check-build-freshness` matches, `a11y-audit` still 0
violations across the existing 18 modals (no regression — this modal isn't
in that tracked list), `ui-workflow-check` 29/29, `nce-workflow-check` 91/91
(including 4 checks now exercised through the converted modal: "Chi tiết
NCE tách đủ bốn mốc thời gian", "Khung bằng chứng nêu đúng giá trị, ngày và
lần chạy", "Khung bằng chứng có nút mở điểm QC", "Nút bằng chứng mở đúng
trang và đúng ngày QC"), plus an ad-hoc script confirming two branches
`nce-workflow-check.js` never happens to exercise: a **legacy** record
(predating `protocolVersion`) correctly shows the "Bản ghi được tạo trước
khi có phiếu điều tra 8 bước..." warning plus the old-style "Hành động đã
ghi" block; a **cancelled** record correctly shows "Hồ sơ đã hủy — dữ liệu
được giữ để truy xuất" with its reason/actor/timestamp.

**Giai đoạn 3 (modal → `createPortal`) is now fully done — all 18 modals
tracked by `scripts/a11y-audit.js` plus the Actions NCE detail modal (19
total) render through real React components under `#modalRoot`/
`#dialogRoot`. No modal anywhere in the app still uses the `'html'` string
path in `modal-store.ts`.**

**Cross-cutting findings worth carrying into Giai đoạn 4** (see the plan
file's "Tổng kết phát hiện xuyên suốt Giai đoạn 3" section for the full
write-up): the missing-kernel-wiring bug hit **exactly 5 times**, always in
`kernel.manage` (`saveConfigInstrument`, `saveConfigLot`, `saveConfigPanel`,
`saveLotTransitionV2`, and the `saveConfigAssay`/`configAssaySuggestionInput`/
`configAssayInstrumentChanged` trio) — never in `kernel.sigma`/
`kernel.actions`/`kernel.reagent` (all direct `...xPageController` spreads,
confirmed immune every time this was checked); the dual-trigger-path bug
(a classic bare global still needed by embedded `data-action` content
elsewhere) hit twice (`sgOpenAddTest`, `sgOpenMU`) plus a cross-page variant
(`openConfigAssay`, called from Westgard via a *separate* `kernel.pres`
bridge, needing both namespaces renamed together); every real verification
script (not just tests) that called a converted modal's old bare global
needed the same fix — switch to tab-select-then-click-the-real-button, with
an async retry-poll after any `setManageTab()` call.

**Mục tiêu mở rộng (2026-08-30) — "chuẩn tuyệt đối".** Sau khi Giai đoạn 3
xong, người dùng quyết định nâng mục tiêu từ "gỡ global bridge, thực dụng"
lên "kiến trúc React/Vite/TS chuẩn hoàn toàn" — chấp nhận làm hết, kể cả 2
việc đã bị bác bỏ có chủ đích ở phiên trước (gộp 2 bundle Vite; state
immutable thật). Đã khảo sát kỹ bằng 3 agent trước khi lên kế hoạch chi
tiết (xem file kế hoạch kiến trúc, mục "MỞ RỘNG MỤC TIÊU") — 2 phát hiện
quan trọng nhất: (1) state immutable thật là rủi ro CAO NHẤT toàn kế hoạch,
vì middleware `immer` của Zustand không giảm rủi ro thật (rủi ro cốt lõi là
hàng trăm hàm đóng trực tiếp lên biến `state` toàn cục, đọc lại field ngay
sau mutate — chuyển sang `set()` chuẩn sẽ làm mọi biến trung gian giữ tham
chiếu tới field con của state CŨ stale ngay lập tức, bug âm thầm khó bắt
bằng test); (2) gộp bundle đã kiểm chứng THỰC NGHIỆM sẽ vỡ ngay 61 sandbox
test (`ReferenceError: window is not defined`, vì bootstrap của
`react-pilot.entry.tsx` gọi `document.getElementById(...)` không có guard ở
top-level module) — quyết định giữ 2 bundle tách biệt là có chủ đích, có lý
do kỹ thuật thật, không phải nợ kỹ thuật bị bỏ quên. Thứ tự ưu tiên: Giai
đoạn 5 (bỏ `dangerouslySetInnerHTML`, rủi ro thấp→trung bình) → Giai đoạn 6
(Router chuẩn, rủi ro thấp) → Giai đoạn 4 tiếp tục (dọn alias) → Giai đoạn 7
(state immutable, RỦI RO CAO NHẤT, làm theo từng nhóm dữ liệu nhỏ→lớn,
KHÔNG dùng middleware `immer`) → Giai đoạn 8 (gộp bundle, RỦI RO CAO, cần
thêm `jsdom` vào sandbox test TRƯỚC KHI thử gộp).

Giai đoạn 5, Bước 1 (done): Header dùng chung 10/11 trang (trừ Dashboard,
có `dashboardHeadHtml()` riêng, cấu trúc khác biệt nhỏ — chưa đụng).
`headOnlyHtml()`+`topUserBox()` cũ (dangerouslySetInnerHTML, giống hệt nhau
ở cả 10 trang) thay bằng `src/react/components/PageHeader.tsx` — component
JSX thật đầu tiên trong thư mục `src/react/components/` (mới tạo, chưa từng
có nơi chứa component dùng chung trước Giai đoạn 5). Avatar (click hoặc
phím Enter/Space → mở modal đổi ảnh đại diện) và nút Đăng xuất giờ là
`onClick`/`onKeyDown` React thật, không còn `data-action="openAvatarModal"`/
`"logout"`. Thêm `currentUser`/`openAvatarModal`/`logout` vào `kernel.pres`
(chưa từng cần lộ ra ngoài trước đây). **Phát hiện phụ quan trọng**:
`openAvatarModal()` mở một modal **'html' cổ điển** (`avatar-modal-controller.ts`)
— đây là **modal thứ 20, chưa từng được tính vào danh sách 18+1 modal của
Giai đoạn 3** (bị bỏ sót hoàn toàn, không nằm trong `scripts/a11y-audit.js`'s
MODALS list). Vẫn hoạt động đúng qua `ModalOverlay.tsx`'s nhánh 'html'
(không cần đổi gì để giữ app chạy đúng), nhưng để đạt "chuẩn tuyệt đối"
thật sự thì modal này cũng cần chuyển sang 'react' — chưa làm, ghi nhận lại
để không bỏ sót lần nữa. Cũng xóa hẳn `headOnlyHtml` khỏi cả 10 file bridge
và `headOnly` khỏi `kernel.pres` (không còn ai gọi từ React); phát hiện
`root.headOnly` còn 3 chỗ được truyền vào deps object
(`managePageController`/`entryPageController`/`reagentPageController`) mà
KHÔNG BAO GIỜ được gọi (`deps.headOnly(` không khớp ở đâu trong 3 file đó)
— xác nhận đây là dead code có TỪ TRƯỚC, không phải do đổi lần này, để
nguyên (dọn dead params ngoài phạm vi bước này). Verified: `npm test`
434/434, `typecheck` clean, `check-build-freshness` matches, `a11y-audit` 0
violations across all 18 tracked modals and all 11 pages, `ui-workflow-check`
29/29, `nce-workflow-check` 91/91, plus two ad-hoc scripts confirming: all
11 pages render the correct title + `.top-user` (name, role); clicking the
avatar (both mouse and keyboard Enter) opens the "Ảnh đại diện" modal
correctly; zero console errors.

Giai đoạn 5, Bước 2 (done): Dashboard's own `dashboardHeadHtml()` — the one
page held back from Bước 1 — now reuses the SAME `<PageHeader title="Tổng
quan" subtitle={...}/>` (verified safe first: `.head-actions`'s flex wrapper
is harmless even with Dashboard's single child, unlike the other 10 pages
which render both a subtitle AND `.top-user`). This closed the last gap in
Bước 1's "10/11 trang" header conversion (now 11/11) and triggered a
dead-code cascade: `dashboardHeadHtml` itself (bridge export, `kernel.dash`
wiring, `src/presentation/dashboard/dashboard-head-html.ts` source file, its
dedicated test) is deleted outright; since `headOnlyHtml`/`dashboardHeadHtml`
were the ONLY two callers of `topUserBox()`/`headOnly()` in
`src/presentation/shared/ui-primitives.ts`, both functions are deleted too
(`createUiPrimitives`'s `deps` type shrunk to just `{escapeAttr}`, return
shape now `{btn, emptyState}`). Deleting those two functions exposed 3
dead-code references that PREDATE Giai đoạn 5 (not introduced by this step):
`managePageController`/`entryPageController`/`reagentPageController`'s deps
objects each carried a `headOnly: (title, subtitle, actions) =>
(root as any).headOnly(...)` line that no function in any of those 3
controller source files ever calls (confirmed via grep for `deps.headOnly(`
before touching anything) — cleaned up properly rather than left as noted-
but-untouched dead code (per this session's "chuẩn tuyệt đối" thoroughness
standard): removed the wiring line from `modular-pilot.global.ts`, removed
the matching `headOnly: (...) => string;` type declaration from all 3
controller source files, and removed `declare function headOnly(...)` from
`global.d.ts` (nothing assigns or reads that bare global any more). Verified:
`npm test` 433/433, `typecheck` clean, `build:pilot` succeeds (all 4
artifacts), `check-build-freshness` matches, `a11y-audit` 0 violations
(18/18 modals, 11/11 pages), `ui-workflow-check` 29/29, `nce-workflow-check`
91/91, plus an ad-hoc Playwright script confirming: Dashboard renders "Tổng
quan" + the hospital/department subtitle, `.top-user` shows the correct
name/role, the avatar (`role="button" tabindex="0"`) opens the avatar modal
via both a mouse click and the Enter key, and 3 other pages (entry/users/
settings) still render their titles correctly through the shared
`PageHeader` — zero console errors.

Giai đoạn 5, Bước 3 (done) — nhóm "dễ": icon-button + option list nhỏ.
Reagent's 6 icon buttons (trash/search/print/report/user/sample, formerly
`rcToolIcon()`/`reagentToolIconPresentation`) became a real JSX component
`src/react/components/ReagentToolIcon.tsx` (same SVG path data, just a
different construction mechanism); Report's "Tạo báo cáo & In" button
(`reportActionIcon('print')`) became `src/react/components/PrintIcon.tsx` —
but `reportActionIconPresentation`/`report-action-icon.ts` itself stays
UNCHANGED, since the classic print-HTML path in `report-page-controller.ts`
still needs it; only the React-side read was removed. Because
`reagentToolIconPresentation` had zero consumers left outside React
(confirmed via grep), it was deleted end-to-end: source file, its
`root.reagentToolIconPresentation=`/type-declaration wiring in
`modular-pilot.global.ts`, the `rcToolIcon`/`reportActionIcon`(kernel.pres
field) bridge exports, its dedicated test, and 2 assertions in
`typescript-module-pilot.test.js` — the same "delete the now-superseded
builder outright" discipline used throughout Giai đoạn 3.
`tests/ui-accessibility.test.js`'s old assertion scanning for the literal
`reportActionIcon('print')` string in `ReportPage.tsx` was updated to scan
for `<PrintIcon` JSX instead, plus a new assertion confirming `PrintIcon.tsx`
itself carries `aria-hidden="true"`. Option list: Manage's Lot QC modal
(`LotModal.tsx`) — the `#cfgLotLevel` `<select>`'s 6 options (levels 1-6),
formerly built via `configLotLevelOptionsHtml()` + `dangerouslySetInnerHTML`,
are now plain static JSX `<option>`s (`LOT_LEVELS.map(...)`) —
`saveConfigLot()` needed no change (still reads `#cfgLotLevel`'s value via
DOM at submit time, same as every other CRUD modal). `configLotLevelOptionsHtml`/
`config-lot-level-options-html.ts` deleted outright (zero other consumers),
along with its dedicated test and 2 assertions in `manage-core-bridge.test.js`
(updated to scan for the JSX `[1, 2, 3, 4, 5, 6]` literal instead of the old
bridge contract). Westgard's `ArchivedView` empty-state (the variant with NO
embedded `data-action` button — unlike the sibling one in the same file
that still embeds `goManageTargets`, deferred to the "hard" 5b group)
converted straight to static JSX (title+message only, same `.empty`/
`.empty-title` classes). Verified: `npm test` 431/431, `typecheck` clean,
`build:pilot` succeeds (4/4 artifacts), `check-build-freshness` matches,
`a11y-audit` 0 violations (18/18 modals, 11/11 pages), `ui-workflow-check`
29/29, `nce-workflow-check` 91/91, `visual-check` passes, plus an ad-hoc
Playwright script confirming: the Reagent/Report buttons render real
`<svg>` elements (no HTML string) with correct text; the Lot QC level
`<select>` shows all 6 options with the right selected value; zero console
errors.

Giai đoạn 5, Bước 4 (done) — easier half of the "hard" 5b group: the 2
`emptyStateHtml` calls with an embedded `data-action` button (Westgard's
"Cấu hình Mean/SD" → `goManageTargets`; Sigma's "+ Thêm xét nghiệm" →
`sgOpenAddTest`) converted straight to static JSX (same `.empty`/
`.empty-title`/`.empty-actions` classes), with the button calling
`onClick={goManageTargets}`/`onClick={sgOpenAddTest}` directly — both
functions were already real imports in these two pages (used elsewhere), so
no new kernel wiring was needed. The `emptyStateHtml` import was removed
from both `WestgardPage.tsx`/`SigmaPage.tsx` (no longer used); since those
were the ONLY two call sites of `westgardBridge.ts`'s/`sigmaBridge.ts`'s own
`emptyStateHtml` bridge export (EntryPage.tsx has its own separate bridge
copy, untouched), those two dead export lines were deleted too — the
underlying `emptyState()`/`kernel.pres.emptyState` itself stays UNCHANGED
(still used by plenty of classic call sites). Side finding: once the only
embedded `data-action="sgOpenAddTest"` string anywhere in the repo was
removed, the `root.sgOpenAddTest = () => window.QCLabReact.sgOpenAddTest()`
redirect (built in Giai đoạn 3 for the dual-trigger-path bug) **still had to
stay** — for a different reason now: `scripts/a11y-audit.js`'s
`sigma:add-test` entry calls `sgOpenAddTest()` directly as a bare global
(not a real button click), so the redirect remains load-bearing, just
serving a verification script instead of embedded HTML. Verified: `npm test`
431/431, `typecheck` clean, `build:pilot` succeeds (4/4 artifacts),
`check-build-freshness` matches, `a11y-audit` 0 violations (18/18 modals,
11/11 pages — `sigma:add-test` still opens correctly through the redirect),
`ui-workflow-check` 29/29, `nce-workflow-check` 91/91, plus an ad-hoc
Playwright script that forced Sigma into its empty state (untracking every
test) and confirmed the correct title/message/button render, clicking the
button opens the real add-test modal, and zero console errors.

Giai đoạn 5, Bước 5 (done) — 5c begins, infrastructure + the FIRST date
field fully converted: built `<DateField>`/`<DatePickerPopup>` as real JSX
(`src/react/components/DateField.tsx`/`DatePickerPopup.tsx`) plus a plain
Zustand store `src/react/state/date-picker-store.ts` (holds DOM refs of the
currently-open field — box/input/native — NOT the date "value" in React
state, since every date field across the app deliberately stays
uncontrolled). Mounted once, permanently, via `#datePickerRoot` (new,
added to `index.html`, same pattern as `#dialogRoot`/`#modalRoot`).
Converted the FIRST field: Entry page's Từ ngày/Đến ngày
(`entryStartDate`/`entryEndDate`) — chosen first because
`ui-workflow-check.js` already has a dedicated check ("Date picker
TypeScript đồng bộ ngày text và native") targeting exactly this field,
giving fast feedback on the new component's design. `entrySetStart`/
`entrySetEnd` (existing, calls `rerender()`) wired through an `onChange`
prop (fires on blur after typing OR on calendar pick) — applied the
`key={lj.startDate}` remount pattern immediately (same "stale defaultValue"
bug class hit repeatedly before: Reagent's picker, Report's lock panel,
Sigma's period selects, Westgard's rule toggles).

**3 real bugs found AND fixed during this step** (not assumed in advance —
caught through actual browser verification):
1. **Two date-picker systems colliding**: classic `vn-date-picker-
   controller.ts` (still serving ~15 not-yet-converted date fields) binds
   ONE `document`-level click listener keyed on `.datepick`/`#vnDatePicker`
   — it doesn't distinguish a React trigger from a classic one. If the new
   React component shared the SAME id, the classic code would directly
   `remove()`/overwrite the innerHTML of a node React owns (classic
   `close()` in particular runs UNCONDITIONALLY on any outside click,
   without checking whether the classic module actually has anything open)
   — React would then try to detach a node something else already removed,
   throwing a real `removeChild: The node to be removed is not a child of
   this node` error. Fixed by using a DIFFERENT id for the React popup
   (`#reactDatePicker`, not `#vnDatePicker`) — not a stopgap patch, but a
   real boundary that holds until every date field is converted (at which
   point `vn-date-picker-controller.ts` is deleted outright and the
   collision risk disappears entirely). `ui-workflow-check.js`'s
   `checkVnDatePicker()` updated to the new id.
2. **`stopPropagation()` on `DateField.tsx`'s `.datepick`**: even with
   separate ids, the classic document-level listener still reacts to EVERY
   `.datepick` click (React's included) before the id split — kept
   `stopPropagation()` as an INDEPENDENT second layer of defense (stops the
   event at the source instead of relying only on the id boundary), in case
   one protection layer develops a gap later.
3. **`target.closest()` racing a mid-event DOM change**: `DatePickerPopup.tsx`'s
   "click outside closes" listener originally used
   `event.target.closest('#reactDatePicker')` to decide "was this click
   inside the popup" — but some clicks INSIDE the popup (e.g. picking a
   month in month/year mode) trigger a `mode` change that makes React
   re-render and REMOVE the just-clicked button from the DOM WHILE the
   original event was STILL BUBBLING to `document`. By the time the
   listener ran, `target` had already left the DOM tree, so `.closest()`
   always returned `null` — misread as "clicked outside", closing the
   popup mid-interaction (caught via real Playwright verification: picking
   a month made the popup vanish entirely, with no console error at all).
   Fixed with `event.composedPath()` instead of `.closest()` — the path is
   FROZEN at the moment the event is dispatched, unaffected by DOM changes
   later in the same dispatch.

Removed the now-unused `dateBoxHtml`/`icoCal` import from `EntryPage.tsx`
and the `dateBoxHtml` export from `entryBridge.ts` (its only 2 call sites in
that file are converted). Verified: `npm test` 431/431, `typecheck` clean,
`build:pilot` succeeds (4/4 artifacts), `check-build-freshness` matches,
`a11y-audit` 0 violations (18/18 modals, 11/11 pages), `ui-workflow-check`
29/29 (including "Date picker TypeScript đồng bộ ngày text và native"
itself), `nce-workflow-check` 91/91, plus SEVERAL ad-hoc Playwright scripts
confirming each of the 3 bugs above stays fixed: switching to month/year
mode then picking a month correctly returns to day view (no accidental
popup close); picking a date via the calendar updates the REAL underlying
state (not just DOM — `.lj-range`'s text changes accordingly, confirming
`entrySetStart` actually ran); manual typing + blur also commits correctly;
clicking outside closes correctly; AND a still-classic date field elsewhere
(Manage's Lot QC modal, `#vnDatePicker`) still opens/works normally
alongside the new system, with zero console errors on either side.

Giai đoạn 5, Bước 6 (done) — 5c COMPLETE: converted the remaining 15 date
fields and deleted the now-fully-dead classic date-box infrastructure.
LotModal (2) → TeaLabProfileModal (3) → LotTransitionModal (1) → SigmaMuModal
(1) — all four are pure uncontrolled fields (no `onChange` needed, read via
DOM at submit time, same as every other CRUD modal). AuditPage (2, from/to
filter) — the FIRST time `auditSetDate` (previously "deferred", embedded as
raw `data-action` text inside the classic HTML string, per this file's own
earlier note "until dateBoxHtml itself becomes a real component") got a
real `onChange` — added `auditSetDate` to `kernel.audit` + a bridge export,
verified with a REAL Playwright check (not just reading DOM values): seeded
fake activity rows, set a future filter date, confirmed the row count
actually dropped from 2/2 to 0/2 — proving the underlying STATE changed, not
just the DOM. ReagentPage (1, `rcMeta('date', v)`) → SigmaPage (1,
`sgSetTeaMeta('eflmLookupDate', v)`, using `onChange` per the established
"text field → onBlur" rule from Giai đoạn 2) → ReportPage (2,
`reportRangeChanged()` with no params — re-reads `#rStartDate`/`#rEndDate`
directly from the DOM, matching classic behavior exactly). ActionsPage (5
fields: aDate/aDueDate/aActionCompletedDate/aReleaseDate/aEffectivenessDate)
— **deleted the manual addEventListener workaround entirely** (the
`useRef`+`useEffect` binding native 'input'/'change' to call
`actionFormChanged()`, built in Giai đoạn 2 because the field used to be
`dangerouslySetInnerHTML`, outside React's fiber tree) — now that the field
is real JSX, the event naturally bubbles to the existing
`<div className="action-form-body" onChange={actionFormChanged}>`
container, no workaround needed. Also fixed a REAL PRE-EXISTING CSS BUG
found along the way: `attrs="action-date"` (the 4th, raw-attrs parameter)
should have been the 3rd (`cls`) parameter — the `action-date` class (which
has real CSS: `.datebox.action-date{height:38px}`) had never actually been
applied to `.datebox` since this page went React; fixed with
`className="action-date"` in the correct slot.

Once all 16 fields were converted, deleted the entire now-dead classic
system (confirmed zero consumers via grep at each step, never assumed):
`date-box-html.ts`/`createDateBoxHtml` deleted outright (`dateBoxHtml`/
`root.dateBox` was never actually CALLED anywhere — only ever assigned);
`icoCal()` deleted from `router-icons.ts` (its only caller was
`date-box-html.ts`); cleaned up 5 dead `deps.dateBox=(root as
any).dateBox(...)` wirings in `kernel.pres`/the deps objects of
`managePageController`/`manageTestsActionsController`/`entryPageController`/
`reagentPageController`/`sigmaPageController` — confirmed all 5 were never
actually called (`deps.dateBox(` matched nowhere in any of those controller
source files) before removing, along with the matching type declaration in
each source file. `vn-date-picker-controller.ts` (the DOM/popup half)
DELIBERATELY STAYS — its pure `parse()`/`valid()`/`text()` half is STILL
called by classic `auditSetDate()` via `root.vnPickerParse` (used to
normalize the input value before updating the filter range); deleting the
whole file would remove that still-needed pure half too. The DOM/popup half
(`open`/`render`/`bind`...) is now inert dead weight (no classic `.datepick`
is left anywhere for its listener to find) — left for a future dedicated
refactor to split the pure half out, not urgent since there's no functional
benefit to doing it right now. `tests/ui-route-structure.test.js`'s `router`
string concatenation dropped `date-box-html.ts` (deleted, would otherwise
throw a file-read error).

Verified: `npm test` 431/431, `typecheck` clean, `build:pilot` succeeds
(4/4 artifacts), `check-build-freshness` matches, `a11y-audit` 0 violations
(18/18 modals, 11/11 pages — including `manage:add-lot`/`edit-lot`/
`tea-lab-profile`, which carry the just-converted date fields),
`ui-workflow-check` 29/29, `nce-workflow-check` 91/91 (including the EXACT
check "Sau ngày hoàn thành, cổng cho phép trở lại vẫn còn thiếu" —
`page.fill('#aActionCompletedDate', ...)` confirms the real container
onChange correctly replaced the old workaround), plus an ad-hoc Playwright
script confirming: Audit filters correctly by date (seeded 2 fake rows, set
a future date, confirmed filtering down to 0/2 — proving real STATE
changed, not just DOM); Reagent's rcDate commits correctly to `model.date`
on blur; Report's rStartDate retains the correct value after blur; zero
console errors on any page.

**Giai đoạn 5 (removing `dangerouslySetInnerHTML`) is essentially complete
for its core scope — both 5a (easy group) and 5c (date-picker, the hardest
part) are done.** What remains of Giai đoạn 5 is a narrower slice of 5b than
originally scoped: `icoDownloadHtml`'s 2 spots in SigmaPage (shares
`icoDownload()` with the nav icon — low risk/benefit either way to split
out); `ActionDetailModal`/`UserPermissionsModal`'s checkbox grid/
`ActionsPage.tsx`'s dynamic HTML blocks (evidenceTimelineHtml,
thresholdHtml, rerunEvidenceHtml, referenceHtml, incidentBanner) — these
were ALREADY evaluated and deliberately kept as-is back in Giai đoạn 3 for
substantive reasons (100%-read-only content, or genuinely complex content
where a JSX rewrite has no functional benefit), not neglected debt; the
Avatar modal (the side-finding from Bước 1 — the 20th modal, never counted
before — still 'html'-kind, convertible to 'react' for absolute
completeness if wanted).

**Giai đoạn 6 — Router chuẩn (done, 2026-08-30).** Key design decision
(different from the original idea of "React Router or a Zustand-backed
page state"): after surveying the options, chose **hash-based navigation
via the plain History API** (`location.hash`/`history.pushState`/
`popstate`), NOT adding `react-router-dom` as a dependency. Reasoning: (1)
the app has 11 FLAT pages, no nested routes or dynamic params — a real
router would be disproportionate machinery for this; (2) the sidebar nav
(`<nav id="nav">`) is STILL classic HTML (`router-shell-controller.ts`'s
`nav()`, building `data-action="go" data-args='["id"]'` buttons), not
React — a real router would first need that sidebar converted to React
too, a separate, larger undertaking outside Giai đoạn 6's actual scope;
(3) it matches the codebase's existing minimal-dependency philosophy
(CLAUDE.md: zero runtime npm dependencies except electron-updater; zustand
is the ONE deliberate exception, with a clear reason). A hash (`#/entry`)
is the technically correct choice for a static-file app (runs via `file://`
in Electron, or any static HTTP server — there's no server-side route to
serve `index.html` for an arbitrary path-based URL).

Implementation: 2 new pure functions in `src/presentation/router/
router-hash.ts` (`pageIdFromHash(hash)`/`hashForPage(id)`, no DOM touch).
`router-dispatch-controller.ts`'s `go(p)` split its shared "activate this
page" logic into an internal `activate()`, reused by TWO paths: `go(p)`
(in-app navigation — button/nav-sidebar clicks, also calls `pushUrl` to
push a new history entry) and `goFromHistory(p)` (browser-driven navigation
— Back/Forward, does NOT call `pushUrl` since the browser already changed
its own history; calling it again would create a redundant entry, making
Back require two clicks to go back one page). `app-bootstrap.ts` (which
already centralizes the app's top-level `window`/`document` listener
registrations from Pha H) gained an `onPopState` dep → binds
`window.addEventListener('popstate', ...)` calling
`goFromHistory(pageFromUrlHash())`. `modular-pilot.global.ts` wiring:
`pushUrl` uses `history.pushState(null,'',hashForPage(id))` (guarded by
`typeof history!=='undefined'` for DOM-less sandbox tests); `root.
pageFromUrlHash` reads `location.hash` via `pageIdFromHash` (same guard).
`showApp()` (runs after login/session restore) now prefers opening the
page named in the URL hash if the user can ACTUALLY access it (bookmark/
page reload/shared link) — falling back to the existing `firstAccessPage()`
logic only if not; both that fallback branch and the analogous one in
`applyUserPerms()` (when the current page's access is revoked) call
`history.replaceState` (not `pushState`) to resync the URL without adding a
spurious history entry for an "invalid, correcting" hash. `logout()` resets
the hash to `#/dash`, matching the existing `page='dash'` reset.

Verified: `npm test` 431/431 (no sandbox test needed updating — `go()` kept
its exact signature; `pushUrl`/`pageFromUrlHash` safely no-op when
`history`/`location` don't exist), `typecheck` clean, `build:pilot`
succeeds (4/4 artifacts), `check-build-freshness` matches, `a11y-audit` 0
violations (18/18 modals, 11/11 pages — the script navigates constantly via
`go()`), `ui-workflow-check` 29/29, `nce-workflow-check` 91/91,
`visual-check` passes, plus an ad-hoc Playwright script confirming the full
lifecycle: `go('manage')`/`go('sigma')` correctly update the hash
(`#/manage`, `#/sigma`) and page title; clicking the browser Back button
correctly returns to `#/manage`; Forward correctly returns to `#/sigma`;
clicking the classic sidebar nav button ("Nhập QC") still works via
`data-action="go"`, correctly updating to `#/entry`; reloading with
`#/report` in the URL opens the Report page DIRECTLY (the bookmark/shared-
link scenario); logging out correctly resets to `#/dash`; zero console
errors at any step.

**Giai đoạn 7 — state genuinely immutable, group 1 of 6 (users/settings/lab
profile, done, 2026-08-30).** Key design decision, different from the
original "write a clear Zustand action" wording: after investigation
(surveyed via a background agent before writing any code), confirmed
`users`/`lab`/etc. CANNOT be moved out of the single `state` object into a
"real" separate Zustand store — the entire persistence stack (localStorage/
IndexedDB), Firebase merge-by-branch sync, backup import/export, and
`validateStateInvariants()`/`ensureShape()` all operate on `state` as ONE
object; splitting fields out would require rewriting all of that for
unclear benefit. "Immutable" for Giai đoạn 7 therefore does NOT mean
"move state out of the classic object into Zustand" — it means: **`state`
STAYS a single object (so the existing persistence/sync/validation
machinery keeps working unchanged), but how each of its fields gets
UPDATED changes from "mutate the nested object/array in place"
(`Object.assign`, `.push()`, `.splice()`, `delete`) to "replace the field
with a newly-computed value"** (`state.users = newArray`, `state.lab =
newObject`). This is the actual "immutable update" the original 3-agent
survey's finding was about (the risk being an intermediate variable holding
a STALE reference) — no storage-architecture change needed to fix it.

**Group 1: users/settings/lab profile (done, 2026-08-30).** A dedicated
background-agent survey (before writing any code) confirmed: mutation call
sites are HIGHLY concentrated (mostly one large file,
`modular-pilot.global.ts`, plus 2 small controllers,
`settings-page-controller.ts`/`avatar-modal-controller.ts` — not scattered);
every READ site is a lazy closure (`() => state.lab`), so it's safe against
reference replacement; and the group's SINGLE HIGHEST RISK: `currentUser`
is a SEPARATE variable (`AuthUIState.currentUser`, not inside `state`)
holding a reference into one element of `state.users` — without actively
re-syncing it after `state.users` is replaced with a new array,
`currentUser` would point at the OLD object the very first time a user
edits their own profile/avatar/password (a silent bug, no visible error).

The `lab` half turned out to be ALREADY mostly correct
(`lab-profile-service.ts`/`settings-profile-command.ts` already return new
objects via spread every time, and `set: lab => { state.lab = lab; }` was
already a replace, not a mutation) — only 2 spots needed fixing:
`foundation-normalization.ts`'s `delete state.lab.kpiTargets` (mutated an
object that could be a SHARED reference from the original `input`, since
the surrounding spread is only SHALLOW — fixed by copying `state.lab =
{...state.lab}` before deleting the field) and
`settings-page-controller.ts`'s `ensureLabBrandShape()` (`Object.assign` →
replace with `state.lab = {...old, ...newProfile}`).

The `users` half needed deeper changes: rewrote ALL 6 functions in
`user-management-command.ts` (`add`/`updatePermissions`/`resetPassword`/
`toggle`/`setAvatar`/`clearAvatar`) from mutate-and-return-the-same-
reference to PURE — each returns a NEW object, touching nothing passed in;
dropped `remove` from this file entirely (filtering out one id needs no
dedicated logic). Added a new module `user-store-update.ts`
(`createUserStoreUpdate`) — the SINGLE place that finds-and-replaces one
element of `state.users` by id, then calls `syncCurrentUser(updated)` after
every successful replacement — shared by both `user-lifecycle-command.ts`
(permissions/password/lock changes) and `user-avatar-command.ts` (avatar
changes), avoiding writing the "resync currentUser" logic twice.
`user-lifecycle-command.ts`'s API changed from accepting a `user` reference
(already `find()`'d by the caller) to accepting `id` directly (matching
what `remove(id)` already did) — the caller
(`modular-pilot.global.ts`'s `applyUserPerms`/`applyResetPass`/`toggleUser`)
got simpler too (no longer needs to `find()` just to pass a reference
through). `user-avatar-command.ts` DELIBERATELY KEPT its old public
signature (still takes the whole `user` object, not just an id) —
`avatar-modal-controller.ts` (its only caller) already has the full user
via `deps.currentUser()`, so nothing there needed to change; internally,
the new `user-avatar-command.ts` uses `user.id` to call
`userStore.replaceById()`. The `syncCurrentUser` wiring
(`modular-pilot.global.ts`): `user => { if (currentUser && currentUser.id
=== user.id) currentUser = user; }` — reassigns `currentUser` DIRECTLY,
matching the exact `page = ...` convention already used throughout this
file (a bare-global accessor via `AuthUIState`/`installUiState`).

Rewrote all 3 affected tests (`user-management-command.test.js`/
`user-lifecycle-command.test.js`/`user-avatar-command.test.js`) to match
the new pure contract — `user-avatar-command.test.js` specifically proves
the exact bug the survey flagged: captures a reference to the OLD user
before calling `setAvatar()`, confirms that OLD reference stays UNCHANGED
(proof it's no longer mutated in place) while `currentUser`/`state.users`
DID update correctly (proof the `userStore`-based sync works). Verified:
`npm test` 431/431, `typecheck` clean, `build:pilot` succeeds (4/4
artifacts), `check-build-freshness` matches, `a11y-audit` 0 violations
(18/18 modals — including `users:edit-permissions`), `ui-workflow-check`
29/29, `nce-workflow-check` 91/91, `benchmarks/verify-release.js` PASSES IN
FULL (the ISO 15189 dossier gate: 431/431 tests, build freshness matches,
clean dependency audit, performance regression within budget — confirming
no performance regression), plus an ad-hoc Playwright script confirming the
EXACT highest-risk scenario in a REAL BROWSER (not just a unit test):
self-service password change through the real `resetPass`/`applyResetPass`
flow (filling the form, clicking Save) — `passHash` genuinely changes AND
`currentUser` is ALWAYS the same object reference as the matching element
in `state.users` afterward (no "two copies diverging" bug); the avatar
modal still opens correctly; zero console errors.

Remaining for Giai đoạn 7 (not yet done): activity/audit log →
instruments/qcLots/qcPanels → tests/teaRefs/lotTransitions → actions (NCE)
→ `state.data` (QC points, the largest, highest-risk, done LAST) — each
group repeats the same discipline: survey before coding, convert
mutate-in-place to replace-the-reference, check for any intermediate
variable holding a long-lived reference outside a single function call's
lifetime (the `currentUser` lesson from this group), full verification +
`benchmarks/verify-release.js` after EACH group.

**Group 2: activity/audit log (done, 2026-08-30).** A dedicated background-
agent survey (before writing any code) found this group was ALREADY nearly
fully correct — unlike group 1, which needed deep changes. Every place that
assigns `state.activity`/`state.activityAnchor` (`activity-archive-command.ts`,
`qc-core.ts`'s `ensureShape()`, `reset-operational-data-command.ts`,
`backup-restore-command.ts` via the `setActivity` dep, `blank-app-state.ts`)
was ALREADY replacing with a newly-computed value (arrays from `.slice()`/
`.map()`/`.filter()`, no in-place `.push()`/`.splice()`) — only ONE spot
didn't follow the convention: `audit-service.ts`'s `pushRaw()` used
`state.activity.push(entry)` (in-place mutation) — fixed to
`state.activity=[...state.activity,entry]`. The survey also confirmed NO
stale-reference risk in this group: `chainCache` (the memo behind
`auditChainStatus()`/`chainStatus()`) only stores 3 PRIMITIVE values
(`"${length}|${lastHash}|${anchor}"`), never an array reference — so
replacing the array with a new reference can't make this cache go stale the
way the `currentUser` lesson from Group 1 warned about. Every read site
(`auditModel`, `exportActivityCSV`, `activityTotal`, etc.) is a lazy closure
over `state.activity`, entirely safe against reference replacement.
Verified: `npm test` 431/431 (no test needed updating — the change is fully
behavior-compatible), `typecheck` clean, `build:pilot` succeeds (4/4),
`check-build-freshness` matches, `a11y-audit` 0 violations (18/18 modals —
including `audit:archive-log`), `ui-workflow-check` 29/29 (including
several audit-logging checks), `nce-workflow-check` 91/91,
`benchmarks/verify-release.js` PASSES IN FULL, plus an ad-hoc Playwright
script logging 5 activity entries in a row and confirming
`auditVerifyChain()` still passes (`chainOk: true`), in the correct order,
with zero console errors — confirming the hash-chained log still links
correctly after switching from in-place `.push()` to reassigning a new
array.

**Group 3: instruments/qcLots/qcPanels (partly done, deliberately scoped,
2026-08-31).** A dedicated background-agent survey found this group MUCH
more complex than the first two — `manage-config-service.ts` has 20+
mutation spots spread across instruments/qcLots/qcPanels/lotGroups/
test.levels, and critically: **a REAL risk if EVERY element-level mutation
were converted to create-a-new-object** — 2 variables hold an OBJECT
reference (not an id) into one `lotGroups` element across a long ASYNC gap
(a password re-auth prompt / confirm dialog):
`manage-tests-actions-controller.ts`'s `ui().targetSwitchCtx.group` (held
across `reauthenticateCurrentUser()`) and `activateLotGroup()`'s `g`/
`preview.group` variables (held across `confirmDialog()`). Under the
CURRENT mutate-in-place design, these two are safe (nothing ever REPLACES a
`lotGroups` element with a new object — only push/filter, keeping surviving
elements' identity intact) — but if Group 3 converted the functions that
create/update `lotGroups` (`saveLotGroup`/`stopLotGroup`/
`applyAcceptedLotTransition`/`normalizeLotGroups`/`applyLotGroupActivation`)
to "always create a new object" WITHOUT also fixing these two reference-
holding variables, it would recreate the exact `currentUser` bug from
Group 1.

**Deliberate scope narrowing decision**: fixed ONLY the `.push()` calls that
don't reassign the parent array (`state.instruments`/`state.qcLots`/
`state.qcPanels` — the 3 arrays this group actually names, same bug class
as Group 2's `pushRaw()`), LEAVING every element-FIELD mutation
(`Object.assign(record, patch)`, `lot.groupId = ...`) UNCHANGED — since
elements stay the SAME reference throughout, this keeps `targetSwitchCtx`/
`activateLotGroup` safe. Converting EVERY element mutation to "always
create a new object" (matching the depth done for `users` in Group 1) is
deferred to a SEPARATE, more careful pass specifically on `lotGroups`
(belongs to Group 4 "tests/teaRefs/lotTransitions" or its own split) — at
that point, the two reference-holding variables MUST be fixed at the same
time (switch to holding an id, `find()` again when needed), never done in
isolation.

Fixed 5 non-reassigning `.push()` spots: `manage-config-service.ts`'s
`saveInstrument()`/`savePanel()`/`saveLot()` (3 spots), and
`test-configuration-normalization.ts`'s 3 spots that auto-generate an
instrument from legacy data (migration, runs inside `ensureShape()`),
`configuration-relations.ts`'s 1 spot that auto-generates a Panel QC from
legacy `assayGroups` — ALL changed from `.push(x)` to
`state.array=[...state.array,x]`. DELIBERATELY LEFT
`state.lotGroups.push(...)`/`group.lotIds.push(...)` untouched in BOTH
migration files (for the exact reason above — splitting this out of this
pass avoids doing it half-finished).

The survey also confirmed the `derived()`/`derivedIndex` cache
(`src/domain/qc/derived-index.ts`) DOES read `qcPanels`/`qcLots`/
`lotGroups`/`lotTransitions`/`tests` as part of its signature (reference +
length + a few per-element fields) but was ALREADY self-verifying correctly
(replacing the array reference changes the signature → auto-rebuild, no
stale read) — nothing needed fixing there. The other memos (`wgMemo`/
`acceptedMemo`/`cusumMemo`/`pointsCache`) aren't reference-based (manually
invalidated via `clearDerived`), so this change doesn't affect them either
way. Verified: `npm test` 431/431 (no test needed updating), `typecheck`
clean, `build:pilot` succeeds (4/4), `check-build-freshness` matches,
`a11y-audit` 0 violations (18/18 modals — including `manage:add-instrument`/
`add-lot`/`add-assay`), `ui-workflow-check` 29/29 (including "Form thêm máy
lưu đủ dữ liệu"/"Thêm máy ghi audit"/"Form sửa máy cập nhật đúng bản ghi"),
`nce-workflow-check` 91/91, `benchmarks/verify-release.js` PASSES IN FULL,
plus an ad-hoc Playwright script calling `ManageConfigService.saveInstrument()`
directly confirming `state.instruments` is a NEW array afterward
(`sameArrayRef: false`), the count correctly increments, and the new
instrument renders correctly right after `rerender()` — no cache read stale
data.

**Group 4: lotGroups + tests/teaRefs/lotTransitions (partly done, deliberately
scoped, 2026-08-31).** A dedicated background-agent survey found one MORE risk
point beyond Group 3's `targetSwitchCtx.group`/`activateLotGroup`'s `g`/
`preview.group`: `saveTargetMatrix()` (same `manage-config-service.ts` file)
also holds its own local `group` variable (an OBJECT reference into a
`state.lotGroups` element) across TWO consecutive `await`s
(`confirmDialog()` then `reauthenticateCurrentUser()`) before reusing it in
the `!overwrites.length` branch — the same risk class as the two Group 3
variables, just a different call site.

**Deliberate scope-narrowing decision (differs from the plan file's original
wording, which said all three reference-holding variables MUST be fixed
simultaneously)**: with the Group 4 survey in hand, confirmed none of them
need touching to reach Group 7's actual goal (no parent array left mutated
via bare `.push()`) — applying the SAME narrowing already used in Group 3:
fix only the `.push()` spots that don't reassign the parent array, LEAVE
every mutate-a-field-of-an-EXISTING-element spot unchanged
(`Object.assign(record, patch)`, `group.lotIds.push(...)` when `group` is an
existing element). Safe because none of this pass's fixes REPLACE an
EXISTING `lotGroups` element with a different object — every
`state.lotGroups=[...state.lotGroups,x]` only fires when CREATING a brand-new
element (`x` is a fresh object nothing held a reference to before the push).
Converting every field-mutation on an EXISTING element to also create a new
object (matching the depth already done for `users` in Group 1) is deferred
to a SEPARATE, more careful pass — at that point all THREE reference-holding
variables (`targetSwitchCtx.group`, `activateLotGroup`'s `g`/`preview.group`,
`saveTargetMatrix`'s `group`) must be fixed at the same time (switch to
holding an id, `find()` again when needed), not in isolation.

Fixed the non-reassigning `.push()` spots: `manage-config-service.ts`'s
`saveLotGroup()` (new lot group), `saveLotTransition()` (new transition
record), `saveAssay()` (new test — `state.tests.push(record)` → reassign,
same line that initializes `state.data[record.id]=[]`), `applyTargetPick()`
(`test.levels.push(target);test.levels.sort(...)` → reassign `test.levels`
to a new sorted array), `applyAcceptedLotTransition()` (the branch that
creates an "archived/stopped" lot group inside the accepted-transition loop
— reassign instead of push). `tea-reference-service.ts`'s `ensure()`
(`state.teaRefs.push(record)` → reassign, dropping the now-redundant
`state.teaRefs=state.teaRefs||[]` line before it). The two migration files
DELIBERATELY LEFT UNFINISHED in Group 3 are now complete:
`test-configuration-normalization.ts`'s `migrateLegacyLots` (3 spots —
`state.lotGroups.push(group)`, `state.qcLots.push(lot)`,
`group.lotIds.push(lot.id)` — all only CREATE new groups/lots during
one-time legacy-data migration, never REPLACE an existing one, so safe to
fix without waiting on the reference-holding variables) and
`configuration-relations.ts`'s `group.lotIds.push(lot.id)` (just a
string-id array, no OBJECT element replaced — the `group` object itself
still mutates in place, only its `lotIds` field changes, so
`targetSwitchCtx`/`activateLotGroup`/`saveTargetMatrix` are unaffected).

Verified: `npm test` 431/431 (no test needed updating), `typecheck` clean,
`build:pilot` succeeds (4/4), `check-build-freshness` matches, `a11y-audit`
0 violations (18/18 modals), `ui-workflow-check` 29/29, `nce-workflow-check`
91/91, `benchmarks/verify-release.js` PASSES IN FULL, plus an ad-hoc
Playwright script calling `ManageConfigService.saveLotGroup()`/`saveAssay()`/
`TeaReferenceService.ensure()` directly confirming all three:
`state.lotGroups`/`state.tests`/`state.teaRefs` are NEW arrays afterward
(`sameRef: false`), the count correctly increments, and the new element
renders correctly on the Manage page (tab "Danh mục xét nghiệm"/"Lô & Nhóm
QC") right after `rerender()` — no cache read stale data.

**Group 5: actions/NCE (partly done, deliberately scoped, 2026-08-31).** A
dedicated background-agent survey confirmed exactly 5 non-reassigning
`.push()` spots against `state.actions` (creating a new NCE record):
`entry-service.ts`'s `voidPoint()` (auto-opens an NCE when a QC point is
voided), `range-target-command.ts`'s `applyLab()`/`revertMfg()` (opens an
NCE when the QC range is changed/reverted), `action-record-service.ts`'s
`create()`, `action-escalation-service.ts`'s `createFollowUp()` (opens the
next NCE round on escalate). Every other write (`update()`,
`action-review-service.ts`'s `cancel/approve/returnForRevision/reopen`) is
an `Object.assign()` field-mutation on an EXISTING element — left unchanged,
matching the same scope-narrowing already used in Group 3/4. No
`.splice()`/`delete` anywhere (cancelling a record is always
`recordStatus='cancelled'`, a soft delete). `ActionPointIndexService`'s
cache (signature = `state.actions`'s reference+length) was already
self-verifying correctly; `ActionRerunService`/`actionLotPoints()` don't
read `state.actions` as part of their signature at all, so neither needed
touching.

The survey also found ONE new reference-holding risk (a different class
from the `lotGroups` one): `actions-page-controller.ts`'s `reopenAction()`
captures `a=state().actions[i]` and reuses that SAME `a` (no id re-fetch)
after `await deps.reauthenticateCurrentUser(...)` to build the modal's
label — unlike its sibling `cancelAction`/`approveAction`/`returnAction`
(all of which re-fetch `current` by id AFTER the await). Harmless today
(every review function still mutates in place, so `a`'s identity never
changes) but WOULD go stale if `action-review-service.ts` is ever converted
to always create a new object — deliberately NOT touched in this pass
(matches the narrow scope), noted for whenever that deeper conversion
happens.

**Design decision for a `.push()` reached through multiple service layers
(a different shape than Groups 1-4's direct fixes)**: `action-record-
service.ts`'s `create()` and `action-escalation-service.ts`'s
`createFollowUp()` only receive the `actions` array as a plain parameter —
no access to the real `state` object — so neither can do
`state.actions=[...]` itself. Rather than threading `state` down into these
pure services (breaking the existing "pure service never touches state"
boundary), the reassignment responsibility moved UP to the outermost layer
that already holds the real `state`:
- `action-record-service.ts`'s `create(values, user)` changed signature
  (dropped the `actions` parameter entirely) — it now ONLY builds and
  returns a new record, no side effect at all. `nce-form-command.ts`'s
  `submit()` calls `deps.records.create(candidate, input.user)` (dropped
  `input.actions`). `nce-form-workflow-command.ts`'s `submit()` (the ONLY
  place with the real `state` via `deps.current()`) assigns
  `state.actions=[...actions,result.record]` itself when
  `result.mode==='create'` — AFTER `form.submit()` returns success.
- `action-escalation-service.ts`'s `createFollowUp()` still takes `actions`
  (needed to compute `nextNceId`/`activeFollowUp`) but dropped the
  `(actions||[]).push(record)` line — it only returns the new record.
  `nce-lifecycle-workflow-command.ts`'s `execute()` (also holding the real
  `state` via `deps.current()`) assigns
  `state.actions=[...actions,result.record]` itself when
  `input.kind==='escalate'` AND `result.ok` — after `lifecycle.execute()`
  returns success.
- `entry-service.ts`'s `voidPoint()` and `range-target-command.ts`'s
  `applyLab()`/`revertMfg()` already held a real `state`/`input.state`
  reference, so those just changed `.push(x)` to
  `state.actions=[...state.actions,x]` in place — no layer-splitting needed.

Fixed 5 broken tests exactly as expected (matching the new signature/
contract, same test intent preserved): `action-record-service.test.js`
(dropped the now-unused `records=[]` param), `action-workflow-service.test.js`
(the test calling `createFollowUp()` directly now simulates the caller's
reassignment step itself, plus a new assertion confirming `createFollowUp()`
no longer mutates the array it's given), `nce-form-command.test.js` (the
`records.create` stub's signature changed, and the `actions.length`
assertion changed from 1 to 0 since `submit()` no longer pushes itself),
`nce-form-workflow-command.test.js` (the `state` assertion changed from
`{actions:[]}` to `{actions:[{id:'n1'}]}` since `submit()` now assigns the
reassignment itself after a successful create), `typescript-module-pilot.test.js`
(2 new comments in `action-record-service.ts`/`action-escalation-service.ts`
accidentally contained the literal word "state", matching the
`doesNotMatch(/\bstate\b/)` regex of the test asserting "this pure service
must not read global state" — FIXED THE WORD CHOICE in the comments, not
the test's intent, since the assertion itself is still correct: neither
service actually reads any global, the comment just happened to use a
matching word).

Verified: `npm test` 431/431 (5 tests fixed as above), `typecheck` clean,
`build:pilot` succeeds (4/4), `check-build-freshness` matches, `a11y-audit`
0 violations (18/18 modals), `ui-workflow-check` 29/29, `nce-workflow-check`
91/91 (including the EXACT "một hồ sơ không được mở vòng tiếp theo hai
lần"/"Đã chuyển hồ sơ thì không còn kẹt" checks — both directly exercise
the just-changed behavior through a real browser), `benchmarks/verify-release.js`
PASSES IN FULL, plus an ad-hoc Playwright script calling
`NceFormWorkflowCommand.submit()` directly (creating a real NCE from a
voided QC point) and `NceLifecycleWorkflowCommand.execute({kind:'escalate'})`
confirming both: `state.actions` is a NEW array after success
(`sameRef: false`), the count correctly increments, the new record/follow-up
is found in the array, and `parent.followUpNceId` is set correctly (the
in-place field mutation still works normally) — no console errors.

**Group 6: `state.data` — QC points (partly done, deliberately scoped, the
LAST group of Giai đoạn 7, 2026-08-31).** A dedicated background-agent
survey ran before writing any code — this group was rated the HIGHEST RISK
in the original plan (the largest dataset, the most complex caches, the
center of every Westgard/Sigma/CUSUM calculation), but the survey found the
actual CODE fix needed is SMALLER than every prior group: exactly ONE
non-reassigning `.push()` spot — `entry-service.ts`'s `addPoint()`
(`state.data[tid].push(point)`). No `.splice()` anywhere (voiding a point
is always a soft-delete via the `voided` field, never an element removal).
Every other "bulk" operation on QC points (`renameLotPoints()` for lot
renames, `applyTargetPick()`'s Mean/SD backfill) only mutates a FIELD on an
EXISTING element (`point.lot=...`, `point.qcMean=...`) — no new/replaced
elements, left unchanged, matching the same scope-narrowing used in
Groups 3-5. `delete state.data[id]` (`removeAssay()`, deleting a whole
test) is a key deletion, not a non-reassigning push, and is already swept
clean by `save({})`'s default full `clearDerived()` — out of scope for
this pass.

Caches: the survey drew a clear line between two entirely different kinds
despite similar-sounding names. (a) SELF-VERIFYING by reference+length —
`qcPointCache` (`src/application/qc/point-cache-service.ts`, backing
`pointsOf`/`pointsWithIndex`/`pointsForLot`) and `ActionRerunService` —
both confirmed to correctly auto-rebuild when `state.data[testId]` is
REASSIGNED to a new array (not just on `.push()`), with no hidden
assumption anywhere depending on array identity staying stable. (b) PURELY
MANUAL, keyed by the `testId` string — `wgMemo`/`acceptedMemo`/`cusumMemo`
— these do NOT check array reference at all, they rely entirely on
`clearDerivedForTest(testId)`/`clearDerived()` being called at the right
moment at the command layer (already in place, independent of how the
mutation happens) — switching `.push()` to reassignment doesn't affect
group (b) either way. The 3 raw Maps `pointsCache`/`pointsIndexCache`/
`pointsLotCache` declared in `modular-pilot.global.ts` were confirmed to be
DEAD CODE — only ever constructed and registered into `clearAll()`, never
actually read or written anywhere else — no action needed (out of Giai
đoạn 7's scope).

**Found ONE real reference-holding risk that this very change would
"unlock"** (same class as `currentUser`/`targetSwitchCtx.group`/
`reopenAction`'s `a`): `manage-tests-actions-controller.ts`'s `delTest()`
captures `points=context.points` (a DIRECT reference into
`state.data[id]`, from `ManageConfigService.assayRemoval()`) and uses
`points.length` to show the point count in BOTH confirmation dialogs — the
second (`reauthenticateCurrentUser`) reads `points.length` AFTER
`confirmDialog` has already resolved. Before fixing `addPoint()`
(`.push()` → reassign), this risk didn't exist — `.push()` kept
`points.length` "live"-correct even if new points were added while waiting;
after the fix, if another flow calls `addPoint()` for the SAME test while
the user is mid-password-entry, the stale `points` would show an
UNDERCOUNT in the reauth dialog (display-only — the actual deletion via
`ManageAssayWorkflowCommand.remove()` re-reads fresh state, never uses the
captured `points`). Fixed by capturing `pointsCount=points.length` as a
plain number right after getting `context` (before `confirmDialog` even
runs), using `pointsCount` in both messages instead of holding the live
array across two `await`s.

**Real before/after performance measurement (specific to Group 6, not
needed for the prior 5 groups since none had comparable write frequency +
data volume)**: since `[...arr,point]` is O(n) per insert versus
`.push()`'s O(1) amortized, and `addPoint()` is the single MOST FREQUENTLY
user-triggered operation in the whole app (every QC point entry), measured
directly with an ad-hoc script: 500 consecutive `EntryService.addPoint()`
calls against a test that already holds 40,000 points — BEFORE the fix:
346.82ms total / 0.6936ms per call; AFTER the fix: 413.23ms total /
0.8265ms per call (~19% slower per call, but still under 1ms/point at
40,000+ scale — negligible for a user-triggered action, not a hot loop).
`benchmarks/verify-release.js`'s full scenario (50 tests × 3 levels × 730
days = 109,500 points) also PASSES every performance budget in full, no
regression.

Verified: `npm test` 431/431 (no test needed updating), `typecheck` clean,
`build:pilot` succeeds (4/4), `check-build-freshness` matches, `a11y-audit`
0 violations (18/18 modals), `ui-workflow-check` 29/29, `nce-workflow-check`
91/91, `benchmarks/verify-release.js` PASSES IN FULL (including the full
performance budget at 109,500-point scale), plus an ad-hoc Playwright
script calling `EntryService.addPoint()` directly confirming
`state.data[testId]` is a NEW array (`sameRef: false`), the count correctly
increments, the new point is found in the result, AND `pointsOf(testId,level)`
(routed through `qcPointCache`) correctly auto-rebuilds and finds the new
point right after the array reference changes — no cache read stale data,
the Entry page still renders normally after `rerender()`, no console
errors.

**Giai đoạn 7 (state genuinely immutable) is now essentially complete for
its core scope — all 6 data groups (users/settings/lab, activity/audit
log, instruments/qcLots/qcPanels, lotGroups/tests/teaRefs/lotTransitions,
actions/NCE, state.data/QC points) have had every non-reassigning parent-
array `.push()`/`.splice()` eliminated.** What remains (NOT done, deferred
to separate, more careful passes, NOT required to meet Giai đoạn 7's
minimum goal): converting mutate-a-field-on-an-EXISTING-element to
always-create-a-new-object more deeply for `state.lotGroups` (requires
simultaneously fixing `targetSwitchCtx.group`/`activateLotGroup`'s
`g`/`preview.group`/`saveTargetMatrix`'s `group`) and for `state.actions`
(requires patching `reopenAction()`'s stale-`a`-after-await at the same
time) — both reasons for deferring are already documented in CLAUDE.md/the
plan file under their respective groups.

Then shrink/delete the now-dead
`root.X=` aliases, `global.d.ts`'s
ambient bare-global declarations, and rewrite the 61 sandbox tests + ~88
bridge-wiring text-scanner tests. See the plan file for the full phase
breakdown and the risks already identified (LIS Gateway's
`lis-client-service.ts` shares the same `getState`/`rerender` deps shape and
gets swept into this even though it's unrelated to the UI rewrite; several
`data-*` conventions in `action-dispatcher.ts` encode real event-timing
semantics that a naive `onClick`-only conversion would silently drop; a
`dangerouslySetInnerHTML`-rendered field needs its own native
`addEventListener` if it must notify an ancestor's `onChange`, since it sits
outside React's fiber tree — see the Actions page bullet above; a modal that
shares its DOM container with a still-classic caller must convert BOTH sides
together, not just the one being planned — see the `reauthenticateCurrentUser`
finding above).

`assets/core.js` is the one exception: it's wrapped in a UMD shim so it also
works via `require()` — that's what makes it usable from both the browser
(as `window.QCCore`) and Node test files (`require('../assets/core.js')`).
Since 2026-08-20 (nhóm D) this file is a Vite build artifact, not hand-written
— see "Module roles" → `core.js` for the source path and build command; the
UMD shape itself is unchanged, generated by Rollup's own UMD template instead
of a hand-written wrapper. It holds pure, side-effect-free domain math (stats,
Westgard rule evaluation, Sigma metric, measurement uncertainty, CUSUM, backup
validation/sanitization) with no DOM or state dependency — new pure
calculations belong here, not in the bundle's `state`/Westgard wiring (former
classic `state.js`/`qc-domain.js`, retired 2026-08-20 — see "Module roles").

**Code style is dense/minified-looking by convention, not generated.** Most
`assets/*.js` files are hand-written with minimal whitespace (multiple
statements per line, short names). Match the existing density when editing
these files rather than reformatting; a diff that just reflows a file makes
review harder and pollutes the `?v=` cache-busting query strings (see below).

**Cache-busting via query strings.** Every `<script>`/`<link>` tag in
`index.html` has a `?v=<tag>-<date>-<n>` suffix. Bump the version suffix on
any file you edit so browsers pick up the change (there's no build hash). The
Westgard worker URL, wired in `src/compat/modular-pilot.global.ts`
(`new Worker('assets/workers/...')`) since the classic `qc-domain.js` that
used to hold it retired into the bundle on 2026-08-20, carries its own `?v=`
— bump it there (and rebuild via `npm run build:pilot`) when editing the
worker.

**CSP + SRI (2026-07-24, `script-src` tightened further 2026-08-20).**
`index.html` sets a `<meta>` Content-Security-Policy: scripts limited to self
+ `www.gstatic.com` (no `'unsafe-inline'` since Pha H2's last lát — see
`action-dispatcher.ts` above for the event-delegation work that made this
possible), connections limited to the Firebase Auth/RTDB endpoints,
fonts/images/workers to self. `style-src` keeps `'unsafe-inline'` — a
separate directive, unrelated to the script-src change, since this codebase
still assigns `style="..."` directly from JS in hundreds of places (changing
that is a separate, much larger project). The three Firebase CDN tags carry
`integrity="sha384-..."` + `crossorigin="anonymous"` — when bumping the
Firebase version, recompute each hash
(`curl -sf <url> | openssl dgst -sha384 -binary | openssl base64 -A`) or the
browser will refuse to load the SDK. The CSP deliberately has no `unsafe-eval`;
dev scripts (a11y audit) call app functions directly via Playwright instead of
`window.eval`, and load axe-core itself via `page.evaluate(AXE_SOURCE)` (a
bare string, run through the DevTools Protocol, not a page `<script>` tag)
rather than `page.addScriptTag()`, which the tightened `script-src` now
blocks. The print window (`openPrint()` in `report-print-controller.ts`)
inherits this CSP (same-origin `document.write()`) — its former inline
`<script>` (defining `qcSavePdf`/`qcDoPrint`) is gone; the click listener and
`window.__qcPrintToken` property are now set from the OPENER side after
`document.write()`, plain property assignment being unaffected by CSP. It
loads Manrope from self-hosted `assets/tokens.css` — do not reintroduce the
Google Fonts link, offline labs must print with correct metrics.

### Module roles (load order matters — see `index.html`)

- `core.js` — pure domain math, UMD (see above). Also
  `validateStateInvariants()`, run at every load/merge/import gateway
  (`state-storage.js`, `firebase-sync.js`, `backup-service.js`), and
  `STATE_SCHEMA_VERSION` (currently 6). Version 6 introduced an `archiveRegistry`
  branch for a year-archive feature that was **removed again on 2026-08-01, before
  any release** — do not roll the number back to 5, because dev states already stamped
  6 and `validateStateInvariants()` rejects a state whose `schemaVersion` exceeds the
  app's. `sanitizeBackup()` only overwrites the fields it knows and does **not** strip
  unknown ones, so `ensureShape()` deletes the stale `archiveRegistry` explicitly;
  that is the pattern to copy whenever a state branch is retired.
  Holds the pure error-classification
  helpers too (`errorType`, `primaryErrorRule`, `fixHint`,
  `WG_RULE_DESCRIPTIONS`); the Westgard wiring (see "Module roles" below,
  retired into the TS bundle 2026-08-20) re-exports them under the same
  global names for the UI. Since 2026-08-01 it also owns the **rule-semantics tables**
  — `defaultRuleAction`/`resolveRuleAction` (which rules only warn:
  `WG_ALERT_RULES` = 1-2s/6x/7T) and `defaultRuleScope`/`resolveRuleScope`
  (within/across/both by rule and QC level count), plus `ruleEnabled`,
  `ruleOnInScope`, `ruleVerdictLevel`. These are the SINGLE SOURCE for both
  Westgard engines: the Westgard wiring feeds them state (global toggles, per-test
  `ruleActions`/`ruleScopes`, `operationalLevels().length`) and
  `workers/westgard-worker.js` feeds them the job payload. Do not re-inline
  either table into a caller — until 2026-08-01 both files carried their own
  hand-written copy, and mutating only the worker's copy passed all 58 tests
  while silently changing accept/reject verdicts for any test over
  `WG_WORKER_POINT_THRESHOLD` points. `tests/westgard-worker.test.js` now pins
  main-thread/worker parity across every rule × level count × override case.
  Also since 2026-08-01, the **rule list itself** is one registry:
  `WG_RULE_REGISTRY` — one object per rule carrying `id`, `desc`, `err` (SE/RE/''),
  `defaultOn`, `alert`, `scope`+`scopeMin`, `priority`, the `run` predicate triple
  for the "N consecutive points" family, and the `fix` hint. `WG_RULES`,
  `WG_DEFAULT_ON`, `WG_RUN_RULES`, `WG_ALERT_RULES`, `WG_SE_RULES`/`WG_RE_RULES`,
  `WG_RULE_DESCRIPTIONS`, `primaryErrorRule`'s priority order and the Westgard
  page's guide table are all **derived** from it — before this, that list was
  spelled out in 8 source files, so adding a rule meant 8 edits and one forgotten
  edit drifted silently (the guide table's descriptions and reject/warn column
  were hand-typed and nothing compared them to the engine). Adding a rule is now
  one row here, plus engine work only if it isn't a `run`-family rule.
  `tests/westgard-rule-registry.test.js` pins both halves: every derived list must
  match the registry, and **no source file outside `core.js` may spell out three or
  more rule ids** (a text scan, like `button-conventions.test.js`; 1–2 ids is
  legitimate single-rule logic — the registry-list scan itself now reads
  `src/domain/core/qc-core.ts` rather than the built `assets/core.js`, see
  below). **Retired to TypeScript 2026-08-20 (nhóm D, the last classic-app
  file — `assets/workers/westgard-worker.js` retired the same day, see its own
  bullet below).** Source is `src/domain/core/qc-core.ts` — a near-verbatim
  port (deliberately not "cleaned up" while porting, for the same reason
  `data-io.js`'s Route 15 wasn't: a misplaced line here silently changes a
  Westgard verdict app-wide with no test catching it, so minimizing the diff
  minimizes that risk) with real ES `export`s instead of the classic
  `return{...}` object, and mostly `any`-typed parameters — matching this
  repo's typecheck philosophy (catch typos/arity errors, not model every
  dynamic JSON shape precisely) rather than attempting a rigorous type system
  for `sanitizeBackup()`/`validateBackup()`/`validateStateInvariants()`'s
  deliberately-loose input shapes. Built by `npm run build:core`
  (`vite build --config vite.core.config.mjs`, folded into `build:pilot`),
  `formats:['umd']`, `name:'QCCore'` — Rollup's own UMD template reproduces
  the same `module.exports=`/`window.QCCore=` dual shape the hand-written
  wrapper used to provide, so every consumer (`index.html`'s script tag, the
  7+ `require('../assets/core.js')` test files, `modular-pilot.global.ts`'s
  `root.QCCore` guard, the `vm`-sandboxed benchmarks) needed zero changes.
  `tsconfig.json` excludes the built `assets/core.js` from `checkJs` (like
  `assets/generated/**`) — its real type-checking now happens on the `.ts`
  source under `tsconfig.modules.json`'s `strict:true`.
- `assets/workers/westgard-worker.js` — the Westgard-evaluation Web Worker
  bootstrap (see below, "Westgard rule wiring" bullet, for when it's used and
  what `computeWestgardJob`/`ruleAction`/etc. do). Retired to TypeScript
  2026-08-20 (nhóm D) as `src/workers/westgard-worker.ts` — kept as ONE file,
  bootstrap and pure logic together, deliberately NOT split the way most other
  route retirements were: `tests/westgard-worker-onmessage.test.js` reads this
  file's raw built TEXT and `vm.runInContext`s it directly in a context
  containing only `self` (no `module`, no `importScripts`) to exercise the
  real `self.onmessage` path a plain Node `require()` never reaches — splitting
  bootstrap from logic into two files would mean the built bootstrap needs a
  second `importScripts()` to reach the logic, which that minimal `vm` context
  doesn't support, breaking the test's success path. Built by
  `npm run build:worker` (`tsc -p tsconfig.worker.json`, folded into
  `build:pilot`) rather than Vite: Vite/Rollup's ES-module output wraps any
  file that references `module`/`require`/`exports`-like identifiers in a
  CommonJS-interop shim and appends a top-level `export default ...` — which
  broke both the "plain script, not a module" contract `vm.runInContext` needs
  and silently changed `require('../core.js')` into a custom `__require()`
  proxy shim. Plain `tsc` targeting `module:"commonjs"` for this one file
  (which has zero real `import`/`export` statements — `module`/`require`/
  `importScripts` are just `declare`d ambient identifiers referenced through
  `typeof` guards, exactly like the original hand-written file) emits an
  almost byte-identical file, since TypeScript only adds module-wrapper
  boilerplate when a file actually contains `import`/`export` syntax.
- `QCLAB_APP`/`QCLAB_CLOUD` — sets `window.QCLAB_APP` (name/version/releaseDate
  — bump both per `docs/validation/RELEASE-PUBLISH.md`) and `window.QCLAB_CLOUD`
  (Firebase config, `labCode`, `anonymous`/`locked` flags). Contains the live
  Firebase project keys — treat edits here as deploy/config changes, not
  routine code changes. Retired from classic `app-meta.js` on 2026-08-19 (Pha G
  hạ tầng, lát 3): pure data with zero functions, so it moved as-is into
  `src/compat/modular-pilot.global.ts` as `root.QCLAB_APP = {...}` /
  `root.QCLAB_CLOUD = root.QCLAB_CLOUD || {...}`, right after `const root =
  globalThis as QCLabGlobal`. Every consumer (`users-auth.js`'s login screen,
  the Firebase config source service, the router shell's version display, the
  Sigma/report export metadata) already read `window.QCLAB_APP`/`QCLAB_CLOUD`
  through a lazy closure, so moving the assignment later in script load order
  (the bundle now loads after `state.js`/`qc-domain.js`/`firebase-sync.js`
  instead of right after `core.js`) changed nothing observable — confirmed
  with a live browser boot showing the correct version on the login screen.
- The single in-memory `state` object (tests, instruments, QC lots/panels, QC
  data points, actions, users, etc.) plus `ensureShape()` migration/
  normalization logic run after every load/merge. `ensureShape()` stamps
  `STATE_SCHEMA_VERSION` (from `core.js`) onto `state.schemaVersion`. It also
  reconciles Sigma levels with lot-group membership: removing a live lot
  level from every group unlinks that level and deletes its stale
  `sigmaData[testId][].lv[level]`, while stopped/planned groups retain
  history. **`state` and the derived caches (`pointsCache`/`pointsIndexCache`/
  `pointsLotCache`/`wgMemo`/`acceptedMemo`/`cusumMemo`/`derivedIndex`) plus
  `mem`/`startupProblem` are `root.X` data properties, NOT `let` (Pha G hạ
  tầng, tách nền 2026-08-19, folded into the bundle at lát 6 below).** Not an
  accessor — that would add getter overhead on the app's hottest binding; the
  caches stay stable Map references (invalidation only `.clear()`/
  `.delete()`s, never reassigns). checkJs sees these via `declare var` in
  `global.d.ts` (for the 3 remaining classic files) and via a module-local
  `declare let` inside `modular-pilot.global.ts` itself. Retired from classic
  `state.js` (140 lines) TOGETHER with `analyte-catalog.js` (below) on
  2026-08-20 (Pha G nhóm C, lát 6 — the slice that closes nhóm C,
  `assets/modules/` is empty after it): every function there already only
  forwarded to an existing TypeScript service (`qcStateFoundation`/
  `qcStateLifecycle`/`qcLevelReconciliation`/`qcRangeLimitRepair`/
  `ManageConfigService`/`qcLotTargetHistory`/`derivedCacheInvalidation`/
  `qcStaffIdentity`/`qcDateFormat`/`qcBasicFormat`/`qcValueFormat`/
  `qcTestConfiguration`/`qcConfigurationRelations`/`PeriodService`/
  `ReagentComparisonService`), so it moved as-is into
  `src/compat/modular-pilot.global.ts` — but unlike every prior lát, placed at
  the very TOP of the bundle's runtime code (right after the guard that
  validates `root.QCCore`), not next to its own dependency cluster. Reason:
  `SigmaTeaResolution`'s factory reads `TEA_SOURCE_REGISTRY`/
  `TEA_ANALYTE_CATALOG`/`REFTESTS` eagerly (not through a lazy closure) much
  later in the same file, mirroring how classic `sigma-tea.js` used to; this
  port had to land before that read, matching the classic load order
  (`analyte-catalog.js` → `state.js` → every other module). Confirmed by a
  two-line `vm.runInContext` experiment: a `const` declared inside a function
  in one script execution throws `ReferenceError` when referenced bare from a
  *separate* later script execution on the same context, while a `root.X=`
  (or `globalThis.X=`) assignment from the first resolves fine in the second
  — the same "IIFE-scope trap" documented for `state-storage.js`'s lát, this
  time hitting DATA consts (`WG_RULES`/`REFTESTS`/`TEA_SOURCE_REGISTRY`/
  `QC_DECIMALS_DEFAULT`/`teaAnalyteKey`/…), not just mutable variables — these
  used to be readable bare purely because `state.js` was still a separate
  classic `<script>` loaded before the bundle (V8's shared top-level lexical
  scope across sequential script evaluations in one realm), a mechanism that
  stops working the moment they're declared inside the bundle's own IIFE.
  Fixed the same way as every mutable binding before them: `root.X=`
  assignment instead of a bundle-local `const`. No dead code to drop this
  time — every function/const in `state.js` still had a real caller. One
  test (`tests/tea-reference-service-bridge.test.js`) pins the literal
  ambient-declare text `declare const REFTESTS: readonly any[][];`, so the
  `Object.freeze(array.map(row=>Object.freeze([...])))` construction (whose
  real type is `readonly (readonly any[])[]`) got a local `as readonly
  any[][]` cast at the assignment instead of a type change.
- `TEA_ANALYTE_CATALOG`, a frozen built-in measurand registry (one
  international name + abbreviation per analyte, with CLIA/Ricos TEa values).
  Provenance lives in `docs/tea-sources.md` (CLIA 2024 final rule + EFLM BV
  database references, per-measurand trace table, review log) — treat any
  edit to a `clia`/`ricos`/`cliaAbsolute` figure as a data change needing its
  own justification recorded there, not a routine code edit.
  `tests/tea-sources.test.js` fails if any measurand loses its source row;
  since classic `analyte-catalog.js` retired together with `state.js` above
  (2026-08-20), that test now loads the catalog from the bundle
  (`loadSandbox(['core.js','generated/modular-pilot.js'])` +
  `run(ctx,'TEA_ANALYTE_CATALOG')`) instead of `vm`-evaluating the deleted
  classic file's source text directly.
- Westgard rule wiring, error-type classification (thin re-exports of the
  pure helpers in `core.js`), point derivation helpers (`pointsOf`,
  `derived()`, lot/panel lookups) built on top of `state`, and the Westgard
  background worker plumbing: at ≥3000 points the dashboard offloads Westgard
  evaluation to `assets/workers/westgard-worker.js`, hydrating results only
  when the generation/revision still matches current state, and falls back to
  the synchronous engine if Workers are unavailable or error out. Also owns
  the parallel-lot machinery for lot transitions (`parallelLotForLevel()`,
  `parallelWestgard()` — see the parallel-run decision below). Each rule's
  action (`inactive`/`alert`/`reject`) and scope (`within`/`across`/`both`
  run) can be overridden per test via `t.ruleActions`/`t.ruleScopes`
  (`testRuleAction()`/`testRuleScope()`), layered on top of the global
  defaults in `state.westgardRules`. Retired from classic `qc-domain.js` on
  2026-08-20 (Pha G nhóm C, lát 5): every function there already only
  forwarded to an existing TypeScript service (`westgardRulePolicy`/
  `westgardRuleSettings`/`westgardMemoCache`/`qcCusumMemoCache`/
  `qcAcceptedMemoCache`/`qcDerivedIndex`/`qcPointCache`/`qcOperationalAccess`/
  `qcActiveWestgard`/`qcParallelWestgard`/`qcPointVoidVerdict`/`qcLotLineage`/
  `qcLotGroupLevels`/`qcErrorDetail`/`westgardWorkerRevisionService`/
  `westgardWorkerPrewarmPlanner`/`westgardWorkerJobBuilder`/
  `westgardWorkerHydrate`/…), so it moved as-is into
  `src/compat/modular-pilot.global.ts` right after `root.westgardRuleSettings`
  is constructed (the last of its dependencies to come online). No
  eager-construction guard was hiding behind this one — every dependency
  closure was already lazy — but the classic constant
  `WG_WORKER_POINT_THRESHOLD` was confirmed dead (only a comment reference
  remained; the real value `3000` had already migrated to
  `createWestgardWorkerPrewarmPlanner(3000)`) and was dropped rather than
  moved. The 6 worker-state variables (`wgWorker`/`wgWorkerGeneration`/
  `wgWorkerRevisions`/`wgWorkerPending`/`wgWorkerFailed`/`wgWorkerRenderT`)
  became `root.X` data properties, not `let` — `tests/westgard-worker.test.js`
  reads/writes several of them bare through a separate `vm.runInContext` call,
  which a `let` trapped inside the bundle's IIFE would not see (same trap as
  `state-storage.js`'s lát). Removing the classic file exposed one test-only
  gap, not a port bug: `tests/render-downsampling.test.js` stubs
  `testRuleOn` to disable all Westgard rules for a synthetic 20,000-point
  dataset, but never stubbed `testRuleOnWithin`/`testRuleOnAcross` — those two
  used to be `undefined` (so `legacyWestgardRuleScope` always fell through to
  the `testRuleOn` stub) and are now real functions the scope-resolution
  fallback calls directly instead, re-enabling real rule evaluation and
  flooding the chart's display-sample "preserve" set with flagged points.
  Fixed by stubbing both alongside `testRuleOn`, matching the test's original
  intent. `derived()` (index cấu hình: panel/thứ tự test/lô/nhóm lô/chuyển tiếp đã duyệt)
  TỰ KIỂM CHỨNG từ 2026-08-01, cùng kỹ thuật với cache của
  `ActionRerunService`: `derivedStampWalk()` so tham chiếu + độ dài của
  đúng những lát state mà nó đọc, cộng các trường vô hướng nó lọc theo
  (`active`/`status`/`fromLotId`/`toLotId`). Trước đó nó là memo thuần nên chỉ
  đúng khi MỌI đường ghi cấu hình nhớ gọi `clearDerived()` — quên một chỗ thì màn
  hình hiện panel/nhóm lô/mức vận hành cũ mà không có gì báo. **Đọc thêm trường
  nào của cấu hình thì phải thêm trường đó vào chữ ký**, nếu không cache sẽ không
  trượt khi trường đó đổi tại chỗ. Một hàm duy nhất lo cả dựng lẫn đối chiếu
  (`prev=null` là dựng) để hai chiều không lệch thứ tự; đường warm cố ý KHÔNG cấp
  phát mảng — bản dựng mảng mỗi lần gọi làm `derived()` chậm 29 lần (2,7 µs so với
  0,095 µs, đo ở 50 xét nghiệm × 3 mức) và đẩy `warmDomainColdRatio` từ 0,0001 lên
  0,00035. `tests/derived-cache.test.js` chốt CẢ HAI nửa hợp đồng: đổi thứ
  `derived()` đọc thì phải dựng lại, đổi thứ nó không đọc (điểm QC, Mean/SD, NCE,
  khóa kỳ) thì phải giữ nguyên — thiếu nửa sau, một chữ ký hỏng kiểu "luôn khác
  nhau" vẫn qua sạch. Chốt bằng tính tự trượt, không bằng mốc thời gian.
- `LocalStore` — an IndexedDB snapshot mirror used as a recovery fallback for
  `localStorage`. Writes are partitioned (boot shell + per-test records) and
  rotate between slots A/B with a manifest — the active marker flips only
  after all records are written, so an interrupted save leaves the previous
  slot recoverable; legacy single-record snapshots migrate on the next save.
  Retired from classic `local-store.js` on 2026-08-19 (Pha G hạ tầng, lát 1):
  the classic file was already a pure bridge to `localStoreService`
  (`src/application/storage/local-store-service.ts`, the real IndexedDB
  read/write/partition logic), so this slice just folded that thin facade
  into `src/compat/modular-pilot.global.ts` as `root.LocalStore =
  Object.freeze({...})` right after `root.localStoreService` is constructed —
  no new logic. `LocalStore` stays a genuine global (assignment, not a
  classic `let`/`const` declaration) so it's still reachable as a bare
  identifier from `tests/local-store.test.js` and the storage benchmark. The
  one real fix: `modularIndexedDbOpenService`/`modularIndexedDbRecordService`
  used to be gated on `typeof LocalStore !== 'undefined'` — an eager,
  construction-time check that only worked because classic `local-store.js`
  loaded before the bundle. Folding `LocalStore` into the bundle itself would
  have made that guard permanently false (evaluated before `root.LocalStore`
  is even assigned later in the same script). Fixed by constructing both
  services unconditionally — `createIndexedDbOpenService`'s `open()` and
  `createIndexedDbRecordService`'s `get`/`put`/`delete` already resolve to a
  safe empty value when `indexedDB` itself is undefined, so the outer
  existence guard was redundant leftover, not load-bearing.
- Firebase Realtime Database sync (`fbMerge`/`fbHandleValue`/`initFirebase`/
  `syncNow`/`scheduleFbPush`/`fbFlushPush`/…) — optional, per-branch/per-element
  3-way merge (list branches merge by `id`/content key; scalar branches like
  `lab`/`westgardRules` replace wholesale). Failed pushes retry via
  `fbScheduleRetry()` with exponential backoff (1s doubling to a 30s cap), and
  `online`/`offline` listeners re-trigger push/pull. Merge semantics are covered
  by `tests/firebase-merge.test.js`/`firebase-offline.test.js` — keep them in
  step with any merge change. Retired from classic `firebase-sync.js` on
  2026-08-20 (Pha G nhóm C, lát 3): every function there already only forwarded
  to an existing TypeScript service, so it moved as-is into
  `src/compat/modular-pilot.global.ts` right before the block that constructs
  those services. That block used to guard each construction with
  `if (typeof (root as any).fbDisconnect === 'function') root.firebaseDisconnectService = ...`
  (and 16 more, on 13 different classic names) — valid only because
  `firebase-sync.js` used to load *before* the bundle in `index.html`, so the
  classic function already existed when the guard ran; every dependency closure
  inside was already a lazy arrow (calling the bare name at *call* time, not at
  service-construction time), so the guard was never behaviorally necessary —
  it just happened to hold thanks to classic load order. Moving the classic
  functions into the same script and placing them after those guards would have
  made every one of them permanently false, silently turning all of Firebase
  sync into a no-op. Fixed by deleting all 17 guards and constructing
  unconditionally (same fix as the `LocalStore` trap above). Removing the guards
  exposed two latent environment-safety gaps rather than causing them — both
  found by running the *full* `npm test`, not just this file's own tests:
  `root.fb`'s initial `clientId: 'c_'+uid()` ran at bundle-load time (not
  inside a closure) and broke ~28 sandbox tests that load the bundle without
  `state.js` (where `uid()` lives), since `fb` used to be inert classic-only
  data those tests never touched; and
  `firebaseConfigSourceService`'s `cloud`/`readStored` closures assumed
  `window`/`localStorage` always exist, which used to be masked because their
  caller (`fbDataPath()` in `state-storage.js`'s `persistSigmaDraft()`) guarded
  itself with `typeof fbDataPath==='function'` and `fbDataPath` was always
  `undefined` in sandboxes that didn't load `firebase-sync.js` — now that it
  always exists, that guard stopped skipping the real call. Both fixed with
  defensive `typeof`-checks, the same idiom already used elsewhere in this file
  for optional `window` access.
- `localStorage`/IndexedDB persistence pipeline (`loadBootState`/`save`/
  `persistLocalSnapshot`/`lsFlush`/…) — retired from classic `state-storage.js`
  on 2026-08-20 (Pha G nhóm C, lát 4): every function there already only
  forwarded to an existing TypeScript service (`storageLifecycleService`,
  `indexedDbMirrorService`, `storageSerializePolicy`, `localSaveScheduler`,
  `storageSnapshotService`, `saveService`, `sigmaDraftService`,
  `corruptLocalQuarantine`), so it moved as-is into
  `src/compat/modular-pilot.global.ts` right before
  `root.storageSerializePolicy` is constructed. Unlike the `firebase-sync.js`
  retirement, no eager-construction guard was hiding behind this one — every
  dependency closure in those services was already lazy — but this file had a
  much larger set of mutable module-level variables (14 of them: `lsDirty`,
  `lsRevision`, `partitionSlot`, `LS_FULL_ROTATE_MAX_INCREMENTALS`, etc.) that
  the *existing* bundle code and several tests already read/wrote as bare
  globals. Since Vite wraps the whole compat bundle in one IIFE
  (`(function(){...})();`), any of those declared as a plain `let` inside it
  would be invisible both to a test's separate `vm.runInContext` call and to
  any classic script — so all of them became `root.X` data properties instead
  (same fix as `state`/`mem`/`fb` before them), verified by grepping bare
  references to each name across both `modular-pilot.global.ts` and `tests/*.js`
  before deciding. `loadBootState()` tries `localStorage` first, then the
  `LocalStore` IndexedDB mirror; boot loads a small shell first and hydrates
  the full QC data in the background — login and Firebase sync wait for full
  hydration. Corrupt/invalid `localStorage` payloads are quarantined
  (`quarantineCorruptLocal()`) rather than silently dropped. Saves are
  debounced via `lsSaveDelay()` — 400ms normally, backing off to 700ms/1200ms
  as payload size or serialize time grows — flushed on
  `beforeunload`/`pagehide`/`visibilitychange`, and mirrored to `LocalStore`.
  It also owns `save(opts)`, the app's single write gateway, whose `opts` do
  three separate jobs at once — pass them deliberately
  (`tests/cache-invalidation.test.js` locks the semantics):
  `{}` (default) is the fail-safe: drops every derived cache
  (`pointsCache`/`wgMemo`/`acceptedMemo`/`cusumMemo`/`derivedIndex`) and marks
  the whole snapshot dirty. `{testId}`/`{testIds}` narrows both the cache drop
  and the partitioned localStorage write to those tests — use it whenever a QC
  point changed, it's what keeps large datasets fast. `{clearDerived:false}` is
  for saves that touch no QC math at all (actions, period locks, settings,
  backup bookkeeping); using it after a data change leaves stale Westgard
  results on screen. `{cloud:false}` skips the Firebase push and the `_ts` bump.
- `qc-rules.js`, `period-service.js`, `sigma-cohort-service.js`, `entry-service.js`,
  `reagent-comparison-service.js`, `manage-config-service.js` — smaller service-style modules (some
  IIFE-wrapped) layered on `state`/`qc-domain`. `PeriodService` locks/unlocks
  reporting periods (`state.periodLocks`, a synced list branch); `entry-service.js`
  enforces the lock (blocks add/edit/void once a period is locked), and the
  "Khóa kỳ báo cáo" panel on the Reports page
  (`src/presentation/report/report-page-controller.ts`) is the only
  UI that actually calls `PeriodService.lock()`/`.unlock()` — until 2026-07-22
  this service had no caller at all, so locks could never actually be created.
  The lock panel promises users it blocks editing/voiding QC points of that
  period **across every test**, so any BULK destroy-or-rewrite path must ask
  `PeriodService.lockedPoints(state, points)` (pure; counts per period,
  voided points included — they are still that period's records) before
  touching state. Two paths went straight through the lock until 2026-08-01:
  `delTest()`'s `delete state.data[id]` and `renameLotAcrossPoints()`. `delTest()`
  now **refuses** — the correct route is to unlock the period first, which
  demands a reason and logs itself, exactly the ISO 15189 trail. The lot rename
  is still allowed (a lot number is an identity label, and not rewriting old
  points makes them vanish from every lot filter) but now **asks first**, with
  the affected count and which locked periods it touches, before any mutation —
  cancelling must leave no trace. `tests/locked-period-guards.test.js` pins both,
  and was verified to fail when either guard is removed. Adding another bulk
  path over `state.data` means adding the same question.
  `ManageConfigService` owns the DOM-free validation and state mutation for
  instruments and assays. Keep confirmation, re-authentication, audit logging,
  persistence and rendering in `manage-tests-actions-controller.ts`; do not
  move those UI side effects into the service.
  `EntryService` normalizes QC-point input
  (`preparePointInput`/`addPoint`/`voidPoint`/`recordPoint`) and builds the
  entry sheet/window data; called from `entry-page-controller.ts`.
  `SigmaCohortService` builds period/level cohorts directly from raw QC data,
  split by lot; Sigma precision imports must not reuse `acceptedLotPoints()`
  because that display/operational helper selects one acceptable rerun per day.
- `westgard-view-model.js`, `chart-view-model.js` — pure (DOM-free)
  view-model builders: `WestgardViewModel` for the Westgard page (used by
  `westgard-page-controller.ts`), `ChartViewModel` for charts (used by
  `after-render-controller.ts` and by `qc-chart-renderer.ts`'s downsampling).
- `entry-ui-state.js`, `analysis-ui-state.js`, `sigma-ui-state.js`,
  `reagent-ui-state.js`, `manage-ui-state.js`, `auth-ui-state.js` —
  page-level UI state gathered into named objects (`EntryUIState`, …); each
  field is also exposed as a bare global via
  `Object.defineProperty(globalThis, …)` getter/setter so older code keeps
  working unchanged. Never re-declare a top-level `let`/`var` with one of
  these variable names in another module — it shadows the accessor and
  silently detaches that module from the shared state.
- `audit.js` — tamper-evident audit log: `logAct()` appends hash-chained
  entries using a synchronous pure-JS SHA-256 (`auditSha256`) over a canonical
  JSON form; `auditVerifyChain()` validates the chain. Not for passwords —
  those use PBKDF2 in `users-auth.js`. `core.js` also exposes the pure
  `verifyAuditChain()` ingress gate: backup import and both directions of
  Firebase sync MUST validate each source chain before merge/relink, otherwise
  re-hashing the merged array can hide a broken source payload. A failed cloud
  check disconnects sync and preserves local state; a failed backup check
  rejects the import. The app deliberately has no "delete all audit" action;
  admins may only use the verified archive flow below. Retention: cutting old rows (the admin
  "Lưu trữ nhật ký cũ" flow, `archiveActivityLog`/`ActivityArchiveCommand` — see
  "Module roles" for where users-auth.js's Users/Audit/Auth retired to, or
  `auditRotateOverflow()` past
  `ACTIVITY_HARD_CAP`) removes a **prefix** and records the removed segment's
  tip hash in `state.activityAnchor`; `auditVerifyChain()`/`auditRelinkChain()`
  seed from that anchor instead of `''`. Do not go back to re-hashing the
  retained rows: that cost 2 235ms per 20 000 rows (~11s at the old 120 000
  cap) *inside* `logAct()`, i.e. a silent freeze in the middle of an unrelated
  save, and it rewrote historical hashes so an archived CSV no longer matched
  the live chain. The anchor keeps the cut O(1) and keeps the archive CSV
  cryptographically continuous with what remains. The anchor is only meaningful
  while the log is non-empty — `auditPushRaw()` clears it when appending to an
  empty list, so every path that rebuilds the log (backup import, reset)
  is covered without remembering to. `activityAnchor` is in `FB_TOP` because a
  machine that pulls a cut log without the anchor would report a false "audit
  bị sửa". `root.auditModel()` (the pure-data function behind
  `src/react/pages/AuditPage.tsx` — see "Module roles" below; formerly
  `pageAudit()`, retired 2026-08-29) no longer verifies on every render
  (paging/filtering rerenders): `auditChainStatus()` caches by (row count,
  last hash, anchor) and skips auto-verification above
  `AUDIT_AUTO_VERIFY_MAX`, offering a button instead.
- `src/presentation/modal/` (`modal-focus-trap.ts`, `modal-template.ts`,
  `modal-controller.ts`, `dialog-overlay-controller.ts`) — retired the classic
  `modals.js` on 2026-08-18 (Pha G slice 1); wired into the global scope via
  `src/compat/modular-pilot.global.ts` (`root.openModal`/`closeModal`/
  `modalTemplate`/`modalCloseButton`/`confirmDialog`/`infoDialog`/
  `openDialogOverlay`/`closeDialogOverlay`) so the ~20 classic route files
  still calling these as bare globals keep working unchanged. Two
  independent, non-nesting modal layers, each a single slot (opening a second
  modal in the same layer replaces the first, no stacking within a layer):
  - `openModal()`/`closeModal()` (`modal-controller.ts`) render into
    `#modalRoot` — page/feature forms (edit Panel QC, edit user, etc).
  - `confirmDialog(opts)`/`infoDialog(message,opts)` (`dialog-overlay-
    controller.ts`) render into a *separate* `#dialogRoot` layer, on top of
    whatever's in `#modalRoot` (2026-07-18). These replace the browser's
    native `confirm()`/`alert()` — both return a Promise (`confirmDialog` →
    boolean, `infoDialog` → resolves on dismiss) and neither is called
    natively anywhere in app code anymore. They're deliberately kept off
    `#modalRoot`: alert()/confirm() guards fire constantly from *inside* open
    form modals (a validation error while editing), and `innerHTML` only
    reflects an input's original `value` attribute, not what the user has
    since typed into the `value` property — reusing `#modalRoot` would
    silently wipe whatever they'd typed. `infoDialog` takes an optional
    `{type:'success'}` (teal) vs. the default `'warn'` (amber) icon.
  - The two layers' focus-trap keydown handling (Escape closes, Tab wraps) is
    shared via `modal-focus-trap.ts`'s `createFocusTrapKeydown()` — the only
    consolidation done during the TS port; each layer still keeps its own
    return-focus state and resolver, per the reasoning above.
  - `requireWrite()`/`requireAdmin()` (`src/presentation/router/router-permission.ts`) call `infoDialog()`
    without `await`-ing it on purpose: ~68 call sites across the app do
    `if(!requireWrite())return;`, so the guard has to stay synchronous. Not
    awaiting is safe because the dialog's own DOM write happens synchronously
    before the returned Promise settles — the caller's boolean is unaffected
    either way.
- `src/presentation/router/` (`router-dispatch-controller.ts`,
  `router-permission.ts`, `router-icons.ts`, `live-row-filter.ts`,
  `date-box-html.ts`) plus `src/presentation/shared/ui-primitives.ts`
  (`btn`/`emptyState`/`headOnly`/`topUserBox`) and
  `src/presentation/range/range-actions-html.ts` — retired the classic
  `router-render.js` on 2026-08-18 (Pha G slice 3, ~50 bridged globals; see
  `docs/TYPESCRIPT-MIGRATION-PLAN.md`). `router-dispatch-controller.ts` owns
  `go()`/`resetMainScroll()`/`render()`/`restoreRouteFilters()`/`rerender()`
  and the current-page dispatch table; the current page id itself moved into
  `RouterUIState` (`src/presentation/state/ui-state.ts`'s `createRouterUiState()`,
  the `page` field) so `page` stays a bare classic-compatible global the same
  way `dashTestQ`/`currentUser`/etc. already do. `router-permission.ts` owns
  `role()`/`canWrite()`/`requireWrite()`/`requireAdmin()`/`roleLabel()`/
  `roleSelectOptions()`. All of this is wired in
  `src/compat/modular-pilot.global.ts`, which every classic route file still
  calls as bare globals unchanged (`btn`, `emptyState`, `headOnly`, `dateBox`,
  `liveRowFilter`, `icon`, `go`, `rerender`, `page`, …). A `PERM` const existed
  in the classic file but had zero callers anywhere in the app — confirmed
  dead and dropped rather than carried forward as a bridge global.
  Since 2026-07-24 the three biggest pages live in their own files:
  `pageEntry()` retired to `src/presentation/entry/entry-page-controller.ts`
  (`createEntryPageController(deps)`) on 2026-08-19 (Pha G route slice 10) —
  a faithful port of the sheet/tree/Levey-Jennings page including the parallel-
  lot columns; its UI state (`entrySel`/`entryDays`/`entryPrevOpen`/…) stays in
  the `EntryUIState` bag (written directly from onclick handlers, so it must
  remain accessor globals). `document`/`window`/`localStorage` are lazy
  getters in its deps since tests reassign the bare `document` global between
  keyboard-navigation cases. **`pageEntry()` no longer exists**: the page
  retired again on 2026-08-30 to `src/react/pages/EntryPage.tsx` — the
  **last** page in the React migration (see `docs/REACT-ADOPTION-PLAN.md`).
  Entry needed one architectural fix none of the other 9 pages did: classic
  `entryRenderKeepScroll()` never called standard `rerender()` (which
  replaces all of `#main.innerHTML`, resetting `.qc-sheet-wrap`'s own scroll
  position and dropping keyboard focus) — instead it hand-patched
  `.entry-main` via `element.innerHTML=...`, and nearly every interaction
  handler (`entryPick`, `entryFocusLevel`, `entryShowPrevLot`/
  `entryShowCurrentLot`, `entryUnlockExtraRun`, `entryInlineSaveCommit`,
  `confirmVoidQcPoint`, `entryToggleRows`) called it as its last step. Live
  verification (scroll `.qc-sheet-wrap` to 300px, save a new QC point,
  confirm `scrollTop` unchanged and the DOM node reused) confirmed React's
  own reconciliation (`mountReactPage()` → real `root.render()`, never
  `innerHTML=`) already preserves scroll/focus for free — no manual
  snapshot/restore needed. `entryModel()` (the pure-data twin) was added
  alongside the still-live classic branch first, and only once React owned
  the page for real did `entryRenderKeepScroll()` collapse to a bare
  `deps.rerender()` call (name kept unchanged — `tests/entry-service.test.js`
  pins the literal call site inside `entryPick()`). Deleting the classic
  branch cascaded: `entryLatestTreeState`/`entrySyncTreeState` (only caller
  of both) became dead, which made `entry-tree-state.ts`/
  `entry-tree-group-state.ts` dead too — all four removed together with the
  19 classic HTML-builder files `pageEntry()` used to call
  (`entry-tree-html.ts`, `entry-page-layout-html.ts`, `entry-worksheet-html.ts`,
  `entry-levey-panel-html.ts`, `entry-points-panel-html.ts`,
  `entry-point-table-card-html.ts`, `entry-point-table-row-html.ts`,
  `entry-range-summary-html.ts`, `entry-voided-points-html.ts`,
  `entry-voided-point-row-html.ts`, `entry-cumulative-stats-html.ts`,
  `entry-table-window-note-html.ts`, `entry-sheet-day-row-html.ts`,
  `entry-sheet-cell-html.ts`, `entry-sheet-day-summary-html.ts`,
  `entry-sheet-day-detail-html.ts`, `entry-sheet-run-slot-html.ts`,
  `entry-chart-html.ts`, `entry-empty-page-html.ts`) and their 21 test files.
  `entry-void-modal-html.ts`/`entry-pre-save-warning-modal-html.ts` stay —
  both render into `#modalRoot`, outside React. The parity check
  (`scripts/react-migration-parity-check.js`) caught one real bug this way:
  `TableCardView` only rendered the cumulative-stats block when
  `card.rows.length>0`, but classic code always renders it (cumulative stats
  come from `cumulativePts`, a separate point set independent of the
  windowed `rows`) — fixed by moving that block outside the conditional.
  Because Entry was the last page, removing `pageEntry()` also retired the
  router-level strangler-fig scaffolding itself:
  `router-dispatch-controller.ts`'s `pageMap()`/classic `innerHTML` branch
  and `unmountReactPageIfMounted()` had no remaining consumer (every id in
  `ROUTER_PAGE_DEFS` is now in the React registry), so `render()` collapsed
  to `deps.mountReactPage(deps.isReactPage(id) ? id : 'dash', m)` — the
  `'dash'` fallback exists only for a corrupt/unknown page id, not normal
  flow. `pageWestgard()` retired to
  `src/presentation/westgard/westgard-page-controller.ts`
  (`createWestgardPageController(deps)`) on 2026-08-18 (Pha G route slice 3) —
  a faithful port of the whole page including the archived-lot-group and CUSUM
  branches; its UI state (`selTest`/`wgViewMode`/`wgChartMode`/`wgPrevOpen`/…)
  stays in the `AnalysisUIState` bag (written directly from onclick handlers
  like `selTest=this.value`, so it must remain accessor globals, unlike the
  Report page's closure state). **`pageWestgard()`/`pageWestgardArchived()`
  no longer exist**: the page retired again on 2026-08-30 to
  `src/react/pages/WestgardPage.tsx` (see the `westgard-page-controller.ts`
  bullet further below and `docs/REACT-ADOPTION-PLAN.md`), and `pageMap()` in
  `modular-pilot.global.ts` no longer carries a `westgard` entry at all —
  `isReactPage('westgard')` intercepts it first. `pageDash()` retired to
  `src/presentation/dashboard/dashboard-page-controller.ts` on 2026-08-18
  (Pha G slice 2) and `router-dispatch-controller.ts`'s dispatch table called
  it as `root.pageDash` through the compat bridge like any other bundle-owned
  global, same as `pageEntry`/`pageWestgard`/etc. — **`pageDash`/`root.pageDash`
  no longer exist**: the page retired again on 2026-08-29 to
  `src/react/pages/DashboardPage.tsx` (see "Module roles" below and
  `docs/REACT-ADOPTION-PLAN.md`), and `router-dispatch-controller.ts`'s
  dispatch table no longer carries a `dash` entry at all — `isReactPage('dash')`
  intercepts it before the dispatch table is ever consulted.
  On 2026-07-30 the same treatment
  reached `actions-routes.js`, which had been holding **two** whole pages and
  had grown to 105 KB, in two steps:
  - `pageReportV2()` and every `report*` helper (period lock/unlock, test
    search, date range, print icons) moved to `report-routes.js` — and then on
    2026-08-18 (Pha G route slice 2) the whole page moved again to
    `src/presentation/report/report-page-controller.ts`
    (`createReportPageController(deps)`), retiring the classic file. Its page
    state (`reportQ`/`reportTest`/`reportRangeStart`/`reportRangeEnd`/
    `reportLockYm`) now lives as **controller closure `let`** (persists across
    `rerender()` because the factory runs once) — it is set only through
    `reportSetLockPart()`/`reportSearchSet()` handlers, never by direct global
    assignment, so nothing outside may write it. Those two pages share no
    function — only `professional-reports.css`, see "CSS structure".
    **`pageReportV2()`/`reportLockPanelHtml()`/`reportRangePicker()`/
    `reportApplySearch()` no longer exist**: the page retired again on
    2026-08-30 to `src/react/pages/ReportPage.tsx` (see the
    `report-page-controller.ts` bullet further below and
    `docs/REACT-ADOPTION-PLAN.md`), and `pageMap()` in
    `modular-pilot.global.ts` no longer carries a `report` entry at all —
    `isReactPage('report')` intercepts it first.
  - The NCE form then moved to classic `action-form.js`: the `ACT_*` option/
    suggestion constants, `actSel()`, the `<details>` section machinery, the
    investigation checklist, the draft that survives `rerender()`,
    `actionFormModel()`, `addAction()`, and `actionFormHtml()` — extracted out
    of `pageActionsV4()`, a single 17 KB function that had been rendering the
    8-section form, the issue list and the log table together. `pageActionsV4()`
    became ~20 lines and passed the already-computed issue count into
    `actionFormHtml(issues.length)` rather than calling `currentIssues()` a
    second time (two calls could disagree). Classic `actions-routes.js` kept
    the issue list, the record lifecycle (approve/return/cancel/escalate/reopen
    + version tokens) and the detail sheet.

  Both retired to TypeScript on 2026-08-19 (Pha G route slice 11 — the
  **largest single slice**, 226 + 464 dense lines): `actions-routes.js` →
  `src/presentation/actions/actions-page-controller.ts`
  (`createActionsPageController(deps)`), `action-form.js` →
  `src/presentation/actions/action-form-controller.ts`
  (`createActionFormController(deps)`). Unlike the report cut, **this one is
  deliberately not one-directional**: the form calls back into the page's
  evidence builders (`actionEvidenceTimelineHtml`, `actionRerunEvidenceHtml`,
  `actionLevelShort`) because the detail sheet renders the very same blocks,
  and the page calls into the form to open/save a record.
  `tests/ui-route-structure.test.js` still asserts the **split of
  responsibility** (which function lives in which file — the Report page in
  `report-page-controller.ts`, the Actions page split across
  `actions-page-controller.ts`/`action-form-controller.ts`), not an acyclic
  dependency graph. `modular-pilot.global.ts` resolves the two-way reference
  with a two-phase build: `action-form-controller.ts` is constructed first,
  its 3 dependencies into the page controller call through a `let
  actionsPageControllerRef` set only after the page controller is built;
  the page controller's `formHtml`/`captureFormDraft` deps then point
  straight at the already-built form controller. No cyclic import between the
  two TypeScript modules — the forward reference lives in the bridge, which is
  exactly its job as a transitional mechanism.

  Corrective action/"Khắc phục sự cố" retired to React 2026-08-30:
  `src/react/pages/ActionsPage.tsx` now owns the whole page, and `pageMap()`
  in `modular-pilot.global.ts` no longer carries an `actions` entry at all —
  `isReactPage('actions')` intercepts it first. `pageActionsV4()`
  (issue list + log table) and `actionFormHtml()` (the 8-section form) are
  deleted outright, along with the 19 classic HTML-builder files whose only
  caller was one of those two functions (`action-issue-row-html.ts`,
  `action-open-issue-html.ts`, `action-issue-group-html.ts`,
  `action-log-row-html.ts`, `action-review-buttons-html.ts`,
  `action-side-chips-html.ts`, `action-approval-tag-html.ts`,
  `action-issues-panel-html.ts`, `action-log-panel-html.ts`,
  `action-page-html.ts`, `action-select-html.ts`, `action-suggest-box-html.ts`,
  `action-suggest-row-html.ts`, `action-form-closed-html.ts`,
  `action-form-section-html.ts`, `action-investigation-field-html.ts`,
  `action-staff-options-html.ts`, `action-form-panel-html.ts`,
  `action-form-steps-html.ts`) and their 19 dedicated test files. Only
  `actionsModel()` (issue list + log table, pure data, in
  `actions-page-controller.ts`) and `actionFormViewModel()` (the 8-section
  form, pure data, in `action-form-controller.ts`) remain. The two-way bridge
  above is now one-way in practice: the page no longer calls into the form
  (`deps.formHtml` is gone from `actions-page-controller.ts`'s deps — React
  calls `actionFormViewModel(model.issueCount)` directly from
  `ActionsPage.tsx`), but the form still calls back into the page's evidence
  builders (`actionEvidenceTimelineHtml`, `actionRerunEvidenceHtml`,
  `actionLevelShort`), since the classic detail modal (`viewActionDetail()`,
  unchanged — renders into `#modalRoot` like every other page's modals) still
  reuses those same blocks. Much of the issue-list/log-table "presentation
  builder" tier turned out to be unnecessary for React: `ActionReviewPresentation.buttons()`/
  `.approvalTag()` and `ActionStatusPresentation.sideChips()` already return
  plain data (button-visibility flags, `{cls,label}` chip arrays), not HTML —
  `actionsModel()` calls them directly and `ActionsPage.tsx` renders buttons/
  chips as real JSX, skipping the `deps.pres.actionReviewButtonsHtml`/
  `actionSideChipsHtml` wrapper tier `pageActionsV4()` used to go through.
  This page hit a **new variant** of the stale-`defaultValue` bug class:
  classic `syncActionSuggestions()` refreshed the cause/action suggestion-chip
  rows via `node.outerHTML = ...` — replacing the DOM node outright, unlike
  every prior direct-DOM-patch precedent (bias hint, section chips, risk
  score), which only ever mutate a stable node's `textContent`/`className`.
  Reusing that function for the React page would let an unrelated `rerender()`
  arrive after the outerHTML swap and hand React a now-detached node to
  reconcile (a real `NotFoundError` risk on `removeChild`). Fixed by NOT
  reusing it: the cause-category (`aCauseCategory`) and error-type (`aErr`)
  fields recompute their sibling suggestion boxes via local `useState` in two
  small components (`CauseSection`'s `causeCategory` state,
  `ErrTypeSelect`/`ActSuggestBox`'s `errType` state), calling the already-pure
  `actionCausePhrases()`/`actionActionPhrases()` directly — no DOM mutation at
  all. Also hit a real remount bug independent of that fix:
  `beginActionManual()` always seeds the identical shape `{manual:true}`, so
  opening the manual form, typing, closing, then opening it manually AGAIN
  produced the same `formKey` both times — React reused the old DOM node and
  the previously-typed (already `clearDraft()`-cleared in the model) text
  stayed visible in the uncontrolled fields despite the fresh model saying
  empty. Fixed with a monotonic `openSeq` counter on `ActionFormUiState`
  (incremented in `startManual()`/`startIssue()`/`edit()`), folded into
  `actionFormViewModel()`'s `formKey` — every *open* action now gets a distinct
  key regardless of seed shape, confirmed live in the browser (typed a marker,
  closed, reopened, confirmed the field came back empty). Running
  `scripts/nce-workflow-check.js` for real surfaced a further, more general
  finding that applies to every React page, not just this one: a script that
  calls a `rerender()`-triggering function and reads the DOM back in the
  *same* `page.evaluate()` call races React's asynchronous `createRoot().render()`
  commit — 10 of 91 checks failed this way at first, including one in the
  Dashboard block (a latent bug dating back to Dashboard's own 2026-08-29
  React migration that nothing had exercised via this script until now).
  Fixed by splitting each offending trigger+read pair into two separate
  `page.evaluate()` calls, matching the pattern already used successfully
  elsewhere in the same script — not a real user-facing regression (a genuine
  browser click is itself an async DOM event, always leaving React time to
  flush before the next script step), just a gap in how directly the test
  script was calling internal functions.

  `router-page-policy.ts` owns the page list
  (`PAGES`, bridged as `root.PAGES`) and per-role page permissions:
  `rolePageIds(role)` gives each role's default page set, and a user's own
  `pagePerms` (edited in `users-auth.js`) can only narrow that set further,
  never expand past it. Page-level UI state lives in the `*-ui-state.js`
  modules above.
- `src/presentation/export/data-io-controller.ts`
  (`createDataIoController(deps)`) — every CSV/XLSX export: the printable
  report's Excel twin (`reportXlsxDoc`/`exportReportXLSX`), the Westgard
  Excel export (`westgardXlsxDoc`/`exportWestgardXLSX`), the Six Sigma
  exports (`buildSigmaXlsx`/`exportSigmaPeriodXLSX`/`exportSigmaPeriodsXLSX`),
  the CSV exports (`exportReportCSV`/`exportActionsCSV`), and the hand-rolled
  byte-precise ZIP/OOXML engines (`XlsxCore` — the shared ZIP-write/CRC32/
  cell-building core; `SigmaXlsx` and `ReportXlsx`, the two worksheet
  builders on top of it). Retired from classic `data-io.js` on
  2026-08-19 (Pha G route 15, closing nhóm B). Nearly every function in the
  classic file was a thin wrapper reading `globalThis.X` *inside its own
  body* (re-read on every call, not once at module load) — six of those
  wrappers forward to object-shaped services
  (`reportExportHelpers`/`qcReportContext`/`qcReportRowsService`/
  `sigmaExportMetaService`/`westgardXlsxRows`/`qcExportValueFormat`); wiring
  them as a single `root.X` value captured once at construction time (the
  same eager-construction trap as Route 12/14) broke every test that
  overrides one of these services with `globalThis.X={...}` *after* the
  bundle already loaded — fixed by wrapping each method in a closure that
  re-reads `root.X` per call, matching what the classic per-call reads
  actually did. `exportActionsCSV` hit the same self-reference trap as
  `openPrint` in Route 14: it called `exportMetaRows` as a local closure
  rather than a dependency, so a test's bare `exportMetaRows=()=>[]` override
  had no effect — fixed by adding `exportMetaRows` as a self-referencing
  dependency (`(globalThis as any).exportMetaRows(kind)`, wired back to
  itself) and calling it via `deps.exportMetaRows(...)`. `WG_RULES` repeated
  the exact const-vs-`globalThis` scoping bug from Route 14 (referencing the
  bare ambient-declared identifier instead of a `globalThis` property read),
  and `errorType` needed the same bare treatment — the classic file mixed
  both styles (`WG_RULES`/`errorType` bare, `QCCore.westgardByPoint`
  prefixed), and copying the wrong one for either would have silently
  regressed the export in production without any Node test catching it (only
  `visual-check`/`print-check` render real print/PDF output). One confirmed
  dead-code drop: the classic `ReportXlsx` IIFE read
  `globalThis.reportXlsxStyles`/`reportXlsxSheet`/`reportXlsxDrawing` into
  local consts it never used again (only `build`, already fully self-
  contained via its own closure over `root.X`, was ever called) — dropped the
  three unused local reads; the three `root.X` bridge assignments themselves
  stay required since `root.reportXlsxBuild` still calls them internally.
- `src/presentation/report/report-print-controller.ts`
  (`createReportPrintController(deps)`) — every printable report:
  `openPrint()` (the shared print-window bootstrap), `printReport`/
  `printWestgard`/`printSigmaPeriod`/`printSigmaPeriods`/`printRangeForm`,
  plus the small `reportQcValue`/`reportQcStat`/`reportQcPoint`/
  `reportHeader`/`signBlock`/`sigmaMuPrintCard`/`reportNceSummaryHtml`/
  `reportNceDetailHtml`/`reportNceAppendixHtml` wrappers that used to forward
  to other `globalThis.X` presentation services. Retired from classic
  `reports.js` on 2026-08-19 (Pha G route 14). `esc()`/`escAttr()` — called
  via `(root as any).esc(...)` by dozens of already-ported TypeScript files —
  turned out to be defined *only* in classic `reports.js`, which loaded
  *after* the bundle in `index.html`; safe only because every call site was a
  lazy closure. Split out to `src/presentation/shared/html-escape.ts`
  (`escapeHtml`/`escapeHtmlAttr`, same pattern as `jsq()` in Route 10) so
  they're real TypeScript globals now, assigned earlier in the bundle than
  before. This route's real find came from `visual-check`/`print-check`, not
  from the 613 Node tests: a `WG_RULES` dependency wired as
  `(globalThis as any).WG_RULES` read `undefined` in a real browser, because
  `WG_RULES` in `state.js` is a top-level `const` — and per the ECMAScript
  spec, top-level `const`/`let` in a classic script do **not** become
  properties of the global object (`window`/`globalThis`), only `var` and
  `function` declarations (or an explicit `root.X = value` assignment) do.
  `printWestgard()` threw in real Chromium/Electron; the Node vm sandbox
  tests missed it because their stubs used bare assignment (`WG_RULES=[...]`,
  which *does* create an implicit global property in sloppy mode). Fixed by
  referencing the bare identifier `WG_RULES` (already ambient-declared in
  `modular-pilot.global.ts`, next to `QC_DECIMALS_DEFAULT` for the same
  reason) instead of a `globalThis` property read — this is the first time in
  Pha G a browser-level gate caught something all the Node tests missed,
  confirming why nhóm B needs those two extra gates. Also hit the
  eager-construction trap twice more: four object-shaped dependencies
  (`reportQcFormat`/`sigmaPrintRowsService`/`sigmaMuPrintRowsService`/
  `actionReportHtml`) were first wired by reading `root.X` once at
  construction time, which broke `tests/sigma-print.test.js`'s strategy of
  overriding those services *after* the bundle loads — fixed by wrapping each
  method in a closure that re-reads `root.X` per call; and the five top-level
  `print*` functions called the module's own `openPrint` as a local closure
  reference, which made `tests/westgard-print.test.js`/`sigma-print.test.js`'s
  `openPrint = async (...) => {...}` override (needed to intercept output
  without touching a real DOM `window.open`) silently do nothing — fixed by
  routing that one call through a self-referencing `deps.openPrint` (wired to
  `root.openPrint`) instead of the local function.
- `src/presentation/chart/qc-chart-renderer.ts`
  (`createQcChartRenderer(deps)`) — canvas renderer for the Levey-Jennings
  (single/multi-level) and CUSUM trend charts, retired from classic `draw.js`
  on 2026-08-19 (Pha G route 13, mở đầu nhóm B). Every dependency (geometry,
  colors, point-render models, tooltip controller) was already a TypeScript
  factory from an earlier pilot phase — this route only stopped reading them
  off `globalThis` and started taking them as injected `deps`. Along the way
  it fixed a real production bug that predates this route: `cusum-display-
  plan.ts`/`cusum-hover-model.ts` existed and were unit-tested but were never
  wired to `root.X` anywhere, so `drawCUSUM()` (the "Xu hướng CUSUM" tab on
  the Westgard page) threw `TypeError` for any test with CUSUM enabled — no
  gate caught it because no browser-level check opens that tab. Fixed by
  wiring `root.cusumDisplayPlan`/`root.cusumHoverModel` for the first time.
- `src/presentation/sigma/sigma-page-controller.ts`
  (`createSigmaPageController(deps)`) — renders the Six Sigma page (see
  "Confirmed business-logic decisions" below for how its numbers relate to
  the printed report), retired from classic `sigma.js` on 2026-08-19 (Pha G route
  slice 12, the last file in the "Route/presentation" group). Large dependency
  surface (~35 classic/bridged functions, 14 Sigma services, the 11-function
  TEa layer, 26 presentation builders) but no new patterns — one dead wrapper
  confirmed and dropped (`sgRun()`, zero callers anywhere, unlike its sibling
  `sgZone()` which the canvas export renderers still call), and one guard in
  `data-io-controller.ts`'s `sigmaReportRowsService` (written for the transitional period
  when `sgVisibleLevels` might not exist) that a test alone relied on — fixed
  by stubbing `sgVisibleLevels` in that test, not by changing the guard.
  `sgCohortCtx` (the cohort-picker modal's transient context, read/written as
  a bare global by a regression test) joined `sgBiasCtx`/`sgMuCtx` in
  `SigmaUIState`. Six Sigma/"Six Sigma & Sai số" (`pageSigma()`,
  `sgTrackedOptions()`, `sigma-analysis-setup-html.ts`,
  `sigma-no-levels-panel-html.ts`, `sigma-period-table-html.ts`,
  `sigma-period-table-head-html.ts`, `sigma-period-row-html.ts`,
  `sigma-charts-panel-html.ts`, `sigma-tracked-options-html.ts`) retired to
  React 2026-08-30: `src/react/pages/SigmaPage.tsx` now owns the page's body,
  reading data from `sigmaModel()` (a new pure-data function added right
  where `pageSigma()` used to sit — the biggest dependency surface migrated
  so far). `pageSigma()`, `sgTrackedOptions()` and all 7 HTML builders are
  deleted outright, along with their 7 dedicated test files. The panels that
  compute AFTER the initial render (`#sgStatus`/`#sgTrend`/`#sgMDC`/`#sgFreq`/
  `#sgMUAction`/`#sgMU`, filled by `sgRefresh()`) needed no change at all —
  they were already just empty containers in the classic HTML too, and
  `sgRefresh()` keeps patching them via `innerHTML` from a `useEffect` with no
  dependency array, the same trigger point as Reagent's `rcCompute()`. Every
  modal (`sgOpenBias`, `sgOpenMU`, `sgRenderAddTestModal`,
  `sgRenderCohortModal`) is unchanged since they render into `#modalRoot`.
  This page surfaced a **new variant** of the stale-`defaultValue` bug class
  already seen on Reagent/Report: each period row's month/year `<select>`
  (`sgPart()`) does NOT call `rerender()` on a successful change (only
  `sgRefreshSoon()`), but DOES call `rerender()` when the change is REJECTED
  (duplicate period) — and at that point the select must revert to the OLD
  value even though that value is unchanged between the two render passes.
  A fully controlled `value=` select (no local state) was tried first and
  **failed** — confirmed live in the browser: `notify()` ran, the model was
  correct, but the select kept showing the just-rejected value, because React
  compares the new `value` prop against what it last set itself, not against
  the DOM's actual live value after an out-of-band native mutation. Fixed by
  keying just those two `<select>` elements with `renderVersion` (a counter
  from `useRenderVersion()` that increments on every `rerender()`), forcing a
  fresh remount with a fresh `defaultValue` on every render pass — matching
  the classic page's own cost profile (it rebuilt the whole table on every
  rerender too), scoped down to only these two small elements instead of the
  whole row. The outer `<div key={model.testId}>` wrapping the rest of the
  page reuses the same Reagent-class fix to avoid stale CV/Bias data when
  switching tracked tests.
- `src/presentation/westgard/westgard-page-controller.ts` — Westgard
  analysis/"Phân tích Westgard" retired to React 2026-08-30:
  `src/react/pages/WestgardPage.tsx` now owns both view modes (operational
  tests and archived/stopped lot groups), reading data from `westgardModel()`
  (a new pure-data function added right where `pageWestgard()`/
  `pageWestgardArchived()` used to sit). Those two functions,
  `wgChartModeTabs()`, `wgViewModeTabs()`, `wgRowsControl()`, `wgLotBlock()`,
  `pageWestgardCusum()`, and their 8 classic HTML-builder files
  (`westgard-mode-tabs.ts`, `westgard-point-rows-html.ts`,
  `westgard-rows-control.ts`, `westgard-cusum-page-html.ts`,
  `westgard-lot-block-html.ts`, `westgard-rule-guide-html.ts`,
  `westgard-rule-toggles-html.ts`, `westgard-export-actions-html.ts`) are
  deleted outright, along with their 8 dedicated test files; the pure
  `icoRefArrow()` helper in `router-icons.ts` lost its only remaining caller
  in the same cleanup and was dropped too. The three near-identical classic
  row-table builders (current-lot level, previous-lot-after-transition,
  archived-lot-group) collapsed into one `<LevelBlock>` component reading a
  single `WestgardBlock` shape from the model, keyed off whether `badgeText`
  is present (lot-block contexts) vs absent (the live current level). Canvas
  drawing (`wgLJMulti`/`wgLJMultiArchived` Levey-Jennings, `cusumChart`) needed
  no new logic — those stay empty `<canvas>` elements exactly like the classic
  HTML, and the existing `afterRender()` sweep (an `IntersectionObserver`+rAF
  service already keyed by CSS class/`dataset`, see
  `src/presentation/render/after-render-controller.ts` and
  `visible-canvas-service.ts`) keeps painting them — the only change is
  calling `afterRender('westgard')` from a dependency-free `useEffect` in
  `WestgardPage.tsx` instead of relying on the classic `rerender()` → `render()`
  → `afterRender()` call chain, because that chain calls `afterRender()`
  synchronously right after `render()` while `createRoot().render()` commits
  asynchronously, so the `<canvas>` might not exist in the DOM yet at that
  point (found by code inspection, not a live failure). Applied the Sigma-page
  `key={renderVersion}` remount fix to the Westgard rule-toggle checkboxes:
  `wgSet()`/`wgReset()` both call `rerender()` unconditionally, and
  `wgReset()` in particular can change many checkboxes' `on` state at once
  without any of them being individually clicked — confirmed live in the
  browser that a plain `defaultChecked` row left every checkbox showing its
  pre-reset state, fixed by keying the whole toggle row with `renderVersion`
  so it remounts fresh on every `rerender()`, matching the classic page's own
  full-HTML-rebuild cost profile for just that one row. Testing also
  reconfirmed (as first found on the Report page) that the canvases' lazy
  `IntersectionObserver`-gated draw does not fire automatically in this
  session's headless browser regardless of React or classic rendering —
  calling `canvas._ljDraw()` directly confirmed the paint function and
  underlying chart data are both correct on both versions, so this is an
  environment limitation, not a regression.
- `src/domain/sigma/sigma-tea-resolution.ts` (`createSigmaTeaResolution(deps)`) —
  the Six Sigma page's **TEa resolution layer**, split out of `sigma.js` on
  2026-08-01 as classic `sigma-tea.js` and retired to TypeScript on 2026-08-19
  (Pha G route slice 7); wired via `src/compat/modular-pilot.global.ts` (`root.sgRef`,
  `root.sgTea`, etc.) guarded behind `typeof TEA_SOURCE_REGISTRY!=='undefined'` — a
  guard that predates classic `state.js`'s retirement (Pha G nhóm C lát 6,
  2026-08-20) and is now always true since the bundle constructs
  `TEA_SOURCE_REGISTRY` itself at load time, kept as a cheap safety net rather
  than removed. It answers "what is this
  assay's TEa, from which source, with what traceability": the effective TEa table
  (`REFTESTS` defaults overlaid with `state.teaRefs`), assay↔reference-row matching
  (`sgRef`, exact-then-longest-prefix), the CLIA percent/absolute/greater-of
  criterion, and the per-period TEa snapshot. It knows nothing about Sigma, MU,
  charts or modals — that boundary is one-directional and pinned by
  `tests/ui-route-structure.test.js`, and it is what makes the layer testable in
  Node (`tests/sigma-tea.test.js` loads the bundle with only `core.js`).
- `src/presentation/dashboard/dashboard-page-controller.ts` — originally
  `createDashboardPageController(deps)` owned `pageDash()`/`pageDashLoading()`/
  `dashTestFilter()`/`dashTestSetStatus()`, retired from classic
  `dashboard-routes.js` on 2026-08-18 (Pha G slice 2) as pure orchestration
  over `dashboardXxx` builders under `src/presentation/dashboard/`/
  `src/domain/qc/`. **Retired again on 2026-08-29** (React island, see below):
  `pageDash`/`pageDashLoading` and every `*Html`-only builder they called
  (25 files — `dashboard-page-html.ts`, `dashboard-loading.ts`,
  `dashboard-*-list-html.ts`/`dashboard-*-item-html.ts`,
  `dashboard-kpi-items.ts`, `dashboard-test-rank.ts`,
  `dashboard-test-action.ts`, `dashboard-test-status-tags.ts`,
  `dashboard-level-pill(s)-html.ts`, `dashboard-latest-point-text.ts`, plus
  their ~27 dedicated test files) are deleted outright, not just superseded —
  `src/react/pages/DashboardPage.tsx` now owns the "Tổng quan" page, styled
  with real JSX instead of template strings. The controller's only remaining
  export is `dashboardModel()` (a pure-data twin of the old `pageDash()`
  pipeline — same domain calls in the same order, stopping before any HTML
  composition) plus `dashTestSetStatus()`, which is still `data-action`-driven
  from React markup per the React-island convention below. The still-pure
  data-shaping files that pipeline depends on (`dashboard-status-filter.ts`,
  `dashboard-shift-status.ts`, `dashboard-test-search-text.ts`,
  `dashboard-latest-point.ts`, `dashboard-expiring-lot-items.ts`,
  `dashboard-level-data.ts`, `dashboard-missing-target-items.ts`,
  `dashboard-overdue-actions.ts`, `dashboard-test-items.ts`,
  `dashboard-westgard-alerts.ts`, plus `dashboard-head-html.ts` — the one HTML
  builder React still calls, via `dangerouslySetInnerHTML` for the shared
  top-user/avatar header) are untouched and still bridged the same way. A
  dashboard KPI/CAPA panel (`dashboardKpiSnapshot()`) existed briefly
  (`5673eb49`) and was removed again before release (`890604eb`, "tinh gon
  dashboard") — the dashboard page has no such panel today.
- Activity log/"Nhật ký hoạt động" (`pageAudit()`, defined inline in
  `src/compat/modular-pilot.global.ts` rather than its own controller file)
  retired to React the same way as Dashboard, same day (2026-08-29):
  `src/react/pages/AuditPage.tsx` now owns the page, reading data from
  `root.auditModel()` (a new pure-data function added right next to where
  `pageAudit()` used to sit, running the identical filter → chain-status →
  paginate pipeline but returning plain data instead of composing HTML).
  `pageAudit()` itself and its two now-unused HTML builders
  (`activity-audit-page-html.ts`, `activity-audit-row-html.ts`) are deleted
  outright, along with their 2 dedicated test files; `tests/audit-filter.test.js`
  (the real behavioral coverage — search/date-range/pagination correctness)
  was repointed at `auditModel()` instead of scanning `pageAudit()`'s HTML
  output. The search box is the one control that doesn't use `data-action`
  (see "React island" above) — it calls the still-existing `auditSetQuery()`
  directly from a real `onChange`, so the existing debounce
  (`scheduleSearchRender`) keeps working unchanged. The date-range boxes
  (`dateBox()`) and page header (`headOnly()`) are still classic HTML-string
  builders, reused as-is via `dangerouslySetInnerHTML` — same pattern as
  Dashboard's `topUserBox()`/`dashboardHeadHtml()`, not worth porting to JSX
  for a shared, page-agnostic widget.
- Users/"Người dùng" (`pageUsers()`, `user-row-html.ts`, `users-page-html.ts`)
  retired to React the same day (2026-08-29): `src/react/pages/UsersPage.tsx`
  now owns the page, reading data from `root.usersModel()` (a new one-line
  pure-data function, `() => root.userListModel(state.users, currentUser &&
  currentUser.id)`, added right where `pageUsers()` used to sit).
  `pageUsers()` and both HTML builders are deleted outright, along with their
  2 dedicated test files. This page needed the narrowest migration surface of
  the three so far: every modal/action handler (`addUser`, `openUserPerms`,
  `applyUserPerms`, `resetPass`, `applyResetPass`, `toggleUser`, `delUser`)
  needed zero changes, since they either render into `#modalRoot` (a separate
  DOM root outside React's control) or read `document.getElementById(...)
  .value` directly at submit time — an uncontrolled form React never
  intercepts. `userPermissionsModalHtml()`/`resetPasswordModalHtml()`/
  `roleSelectOptions()`/`userPermChecks()`/`headOnly()` are all still classic
  HTML-string builders, reused as-is via `dangerouslySetInnerHTML` for the
  role `<select>` options and the permissions checkbox grid. The "Thêm người
  dùng" form's inputs and role select are plain uncontrolled JSX
  (`defaultValue`, no `onChange`) — safe because nothing reads or resets
  their value except the submit-time handler, unlike Dashboard/Audit's search
  boxes which need live external resets and so keep the local-state+
  `onChange` pattern documented above.
- `src/presentation/settings/settings-page-controller.ts` —
  `createSettingsPageController(deps)` owns the Settings page's form handlers
  (`saveLab`/`saveBrand`/`pickLogo`/`clearLogo`/`saveFb`/`clearFb`/
  `copyFirebaseRules`/`readBrandInputs`/`checkStorageUsage`) and the
  `ensureLabBrandShape()` state-normalization callback `state.js`'s
  `ensureShape()` invokes. Retired classic `settings.js` on 2026-08-18 (Pha G
  route slice 1). It is a DOM/browser adapter — every computation is already a
  TypeScript command/service (`SettingsProfileCommand`, `SettingsFirebaseCommand`,
  `firebaseSettingsService`); the controller reads the form, drives
  FileReader/canvas for the logo, opens dialogs, and delegates. Browser APIs
  (`FileReader`/`Image`/canvas/clipboard/`navigator`) are injected as deps so
  it stays testable. Wired via `src/compat/modular-pilot.global.ts`
  (`root.saveLab`, `root.ensureLabBrandShape`, …) so `ensureShape()`'s bare
  `ensureLabBrandShape` call keeps working unchanged. Settings/"Cài đặt"
  (`pageSettings()`, `admin-tools-html.ts`, `brand-panel-html.ts`,
  `brand-preview-html.ts`, `firebase-connection-panel-html.ts`,
  `firebase-rules-panel-html.ts`, `lis-gateway-panel-html.ts`,
  `settings-page-layout-html.ts`, `unit-profile-html.ts`) retired to React the
  same day as Users, 2026-08-29: `src/react/pages/SettingsPage.tsx` now owns
  the page, reading data from `root.settingsModel()` (a new pure-data function
  added right where `pageSettings()` used to sit, gathering the same lab/
  brand/backup/firebase/LIS fields the old function composed into HTML).
  `pageSettings()` and all 8 now-unused HTML builders are deleted outright,
  along with their 8 dedicated test files — every field the page renders
  (unit profile, brand/logo, admin tools, Firebase connection, LIS Gateway)
  is read only at submit time via `document.getElementById(...).value`, so
  every input/textarea/select in `SettingsPage.tsx` is plain uncontrolled JSX
  (`defaultValue`/`defaultChecked`), matching Users' add-user form rather than
  Dashboard/Audit's live-reset search boxes. `firebaseGuideHtml()` (a static
  `<details>` block) and `headOnly()` are still classic HTML-string builders,
  reused as-is via `dangerouslySetInnerHTML`. None of the controller's form
  handlers needed any change — they already read the DOM by id at call time,
  oblivious to whether React or a template string produced those elements.
- Manage/"Cấu hình chung" (`src/presentation/manage/manage-page-controller.ts`)
  retired to React 2026-08-29: `src/react/pages/ManagePage.tsx` now owns the
  page's 8 tabs (máy xét nghiệm, danh mục xét nghiệm, Panel QC, lô & nhóm lô,
  Mean/SD, chuyển tiếp lô, lịch sử dữ liệu, bảng TEa tham chiếu), the largest
  single page migrated so far. `manageShell`/`manageToolbar`/`manageLots`/
  `manageInstruments`/`managePanels`/`manageTransitionsV2`/`manageTargets`/
  `manageAssays`/`manageHistory`/`manageTeaRefs`/`manageView`/
  `renderManageBody`/`pageManage` and their 37 backing `*-html.ts` files
  (one table/row builder per tab, plus the whole `target-*-html.ts` cluster
  for the Mean/SD matrix) are deleted outright, along with 37 dedicated test
  files. `root.manageModel()` — a new pure-data function reading the same
  filtered/sorted state each classic `manageXxx()` used to, one branch per
  active tab — is the only page-body export left; every modal-opening
  function (`teaRefOpenAdd`, `teaLabProfileOpen`, `teaRefEdit`, …) stays
  unchanged since modals render into `#modalRoot`, outside React. The Mean/SD
  matrix (tab `targets`) is the highest-risk part of this page — dozens of
  per-row checkboxes and 4 number inputs (mean/low/high/sd) with live
  cross-field sync — and is deliberately left fully uncontrolled
  (`defaultChecked`/`defaultValue`, keyed by `${testId}:${lotId}`):
  `syncTargetRange()`/`toggleTargetRow()`/`targetCheckAll()`
  (`manage-tests-actions-controller.ts`) read/write only the DOM of the row
  being edited via `querySelector`/`closest`, and never call `rerender()`, so
  React never re-renders these inputs mid-keystroke and there is no reset-on-
  type risk — confirmed live (typed into `.tm-mean`, cross-synced `.tm-low`/
  `.tm-high` from `.tm-sd`, toggled the row checkbox, saved through the
  re-authentication modal, and the saved Mean/SD showed up correctly on both
  the matrix and the History tab afterward). Three `<select>`s — Panel QC/
  Nhóm lô QC (tab `targets`) and Xét nghiệm (tab `history`) — DO need live
  external resets (`ensureTargetSelection()` can silently correct an invalid
  panel/group, and search can auto-switch the selected assay), so those use
  real `value=`/`onChange` calling `setTargetPanel`/`setTargetGroup`/
  `setHistoryTest` directly, same exception class as the search boxes below.
  The page's own search box (`manageSearchSet`) used to debounce into a
  narrow `renderManageBody()` that replaced only `.config-shell-main`'s
  `innerHTML` — unsafe once React owns that DOM node — so it now debounces
  into `deps.rerender()` directly (matching every other migrated page's
  search box), a strict simplification since `renderManageBody()` already
  fell back to full `rerender()` whenever `.config-shell-main` was missing.
- `src/presentation/reagent/reagent-page-controller.ts` —
  `createReagentPageController(deps)` owns the reagent lot-comparison page
  (`rcCompute`/`rcMeta`/`rcCell`/row+quick-list+picker+create modals/`rcPrint`/
  `rcPrintSummary`/…), retired classic `reagent.js` on 2026-08-18 (Pha G route
  slice 4). Page state (`rcId`/`rcModalQ`/`rcQuickType`/…) is written directly
  from handlers into the `ReagentUIState` bag (accessor globals), like the
  Westgard page. Every stat/render is a TS domain/service/presentation reached
  through `deps` (`ReagentComparisonService`, `ReagentComparisonWorkflowCommand`,
  `reagentComparisonCalculator`, the modal/print HTML builders); the palette
  consts `RCC`/`RCPAD`/`RC_MIN_PAIRS` live in the controller.
  `tests/reagent-stats.test.js` drives `rcCalc`/`rcReportSummaryTable` (bridged
  as globals) directly. Reagent/"So sánh hóa chất" (`pageReagent()`,
  `reagent-toolbar-html.ts`, `reagent-info-panel-html.ts`,
  `reagent-pair-panel-html.ts`, `reagent-pair-row-html.ts`,
  `reagent-results-panels-html.ts`, `reagent-charts-panel-html.ts`,
  `reagent-select-options-html.ts`, `reagent-empty-page-html.ts`) retired to
  React 2026-08-29: `src/react/pages/ReagentPage.tsx` now owns the page,
  reading data from `root.reagentModel()` (a new pure-data function added
  right where `pageReagent()` used to sit). `pageReagent()` and all 8 HTML
  builders are deleted outright, along with their 8 dedicated test files.
  `rcCompute()` — which patches `#rcStats`/`#rcCrit`/`#rcVerdict`/`#rcScatter`/
  `#rcBland` directly via `innerHTML`, entirely outside React — is unchanged;
  `ReagentPage.tsx` calls it once via `useEffect` after every mount/re-render,
  the same trigger point classic code reached through
  `postRenderPageActions.run('reagent', {reagent: rcCompute, …})` on an
  animation frame after `afterRender()`. This page surfaced a real bug in the
  "uncontrolled input" pattern already used for Users/Settings/Manage: typing
  is safe with `defaultValue` (`rcMeta`/`rcCell` never call `rerender()`), but
  *switching to a different comparison* (`rcSwitch`/`rcCreateFrom`/`rcPick`/
  `rcDelete`, all of which DO call `rerender()`) left every field showing the
  **previous** comparison's data — confirmed live in the browser — because
  React reuses the same DOM node at the same tree position across renders and
  never re-applies `defaultValue` after first mount. Fixed by wrapping the
  toolbar + info/pair panels in `<div key={model.currentId}
  style={{display:'contents'}}>` so switching comparisons forces a full
  remount, and keying each pair-row by `` `${rows.length}-${row.index}` ``
  (not `row.index` alone) so deleting a middle row — which renumbers every
  row after it — also forces a remount instead of leaving stale values in
  shifted positions. `scripts/react-migration-parity-check.js` needed a
  matching fix: it forces the legacy fallback via `render()` alone, which
  never re-triggers `rcCompute()`, so the parity snapshot compared a
  "computed" React version against an "uncomputed" classic one until a
  `POST_RENDER` hook was added to call `rcCompute()` for both sides before
  diffing.
- `src/presentation/report/report-page-controller.ts` — Report/"Báo cáo"
  retired to React 2026-08-30: `src/react/pages/ReportPage.tsx` now owns the
  page, reading data from `reportModel()`/`reportLockPanelModel()` (new
  pure-data functions added right where `pageReportV2()`/`reportLockPanelHtml()`
  used to sit). `pageReportV2()`, `reportLockPanelHtml()`, `reportRangePicker()`,
  `reportApplySearch()` and their 4 classic HTML-builder files
  (`report-page-html.ts`, `report-range-picker-html.ts`,
  `report-lock-panel-html.ts`, `report-lock-list-html.ts`) are deleted
  outright, along with their 5 dedicated test files (the 4 builder tests plus
  `report-page-bridge.test.js`, which pinned only the now-gone `pageHtml`
  bridge contract). `reportApplySearch()` was the sole caller of
  `report-search.ts`'s `createReportSearch()` — confirmed via a repo-wide
  grep before deleting that file too, plus its bridge wiring
  (`root.reportSearch`) and the assertions referencing it in
  `tests/typescript-module-pilot.test.js`/`tests/report-render-bridge.test.js`.
  Every other Report function (`reportLockPeriod`, `reportUnlockPeriod`,
  `reportConfirmUnlockPeriod`, `reportExportSelection`, `reportRangeChanged`,
  `printReport`/`exportReportXLSX`/`exportReportCSV` in
  `report-print-controller.ts`/`data-io-controller.ts`) needed no change —
  they read the DOM directly at call time or render into `#modalRoot`,
  outside React. The Lock Panel's month/year `<select>`s applied the
  Reagent-class `key={ym}` remount fix **proactively, before hitting the bug
  live** (`reportSetLockPart()` changes which value should show via
  `rerender()` without changing the tree's structure — exactly the pattern
  that bit Reagent's `rcSel`); confirmed correct by calling
  `reportSetLockPart('month','3')` directly and checking the rendered
  `<select>` value. Testing this page surfaced one **pre-existing bug
  unrelated to the React migration**: `exportReportCSV()` always threw
  `TypeError: Cannot read properties of undefined (reading 'currentLot')` —
  `root.qcReportCsvRows`'s `rows:` dependency read `root.qcReportRowsService`
  eagerly at construction time (line ordering placed it before
  `root.qcReportRowsService` itself was assigned), the same
  eager-construction trap documented throughout this file for other routes.
  Confirmed the bug predates this migration by reproducing it with
  `isReactPage('report')` forced `false` (the classic path) before fixing;
  fixed by wrapping the dependency in a closure that re-reads `root.X` per
  call, matching the pattern `data-io-controller.ts`'s own
  `qcReportRowsService` dependency already used correctly.
- QC target-range workflow (`rangeCandidate`/`openRangeWorkflow`/`applyNewRange`/
  `confirmApplyNewRange`/`revertRange`/`confirmRevertRange`/`rangeGateHtml`/
  `rangeGatePasses`/`rangeUpdateBiasHint`/`rangeTeaPercent`/`rangeSystematicNce`)
  — the "Áp dụng dải PXN"/"Hoàn về dải NSX" modals on the Entry page. Retired
  from classic `range.js` on 2026-08-19 (Pha G hạ tầng, lát 4): thin glue
  around `qcRangeCandidateService`/`qcRangeTea`/`qcRangeSafetyGate`/
  `qcRangeBiasEvaluation`/`RangeWorkflowCommand`, all already TypeScript, so
  it moved as-is into `src/compat/modular-pilot.global.ts` right after
  `root.RangeWorkflowCommand` is constructed. `rangeCandidate()` is the one
  function with a dedicated behavior test (`tests/range-candidate.test.js`) —
  it's the clinical gate behind "Áp dụng dải PXN" (≥20 results, ≥20
  independent days, 0 rejected/warning points, SD>0), computed from the
  *entire* operating lot including Westgard-violating points (excluding them
  would shrink SD artificially and falsely narrow the new range).
- Corrective-action (NCE) workflow (`actionApprovalStatus`/`actionRecordStatus`/
  `actionCancelled`/`actionWorkflowStatus`/`actionRerunStatus`/`actionCanApprove`/
  `nextNceId`/`pointWorkflowSummary`/…) — retired from classic
  `action-workflow-service.js` on 2026-08-20 (Pha G nhóm C, lát 1): every
  function there already only forwarded to an existing TypeScript service
  (`NceActionIdentityService`, `NceActionBasics`, `ActionProtocolService`,
  `ActionApprovalGates`, `ActionRerunService`, `ActionPointIndexService`,
  `ActionQcLink`, `NceActionRerunPolicy`, `PointWorkflowService`), so it moved
  as-is into `src/compat/modular-pilot.global.ts` right after
  `root.ActionPointIndexService` is constructed. Two classic-only workarounds
  were dropped, not carried over: `actionWorkflowStatus()`'s JS fallback branch
  (dead — `root.ActionWorkflowStatusService` always exists in this bundle,
  confirmed identical logic to `src/domain/nce/action-workflow-status.ts`), and
  the `root.NceActionLabels&&...||ACTION_LABELS` load-order guard on
  `ACTION_LABELS`/`RISK_SCALE` (moot once the assignment lives in the same
  script as `root.NceActionLabels`, after it). Three classic functions
  (`actionLotPoints(testId,level,lot)`, `actionPointIndex(testId)`,
  `actionOpenedFromVoid(a,p)`) were confirmed dead — never exported, never
  called — and dropped rather than moved; do not confuse them with the
  differently-shaped, still-live `NceActionQcIndex.actionLotPoints(points,…)`/
  `.actionPointIndex(points)`. This module owns the corrective-action
  lifecycle: `approvalStatus` is `pending`/`approved`/`returned`; physical
  deletion has been replaced by `recordStatus='cancelled'` plus a
  reason/actor/timestamp. It ignores cancelled records when deciding whether a
  QC point has a real NCE, and `actionWorkflowStatus()` only reports an action
  complete when its rerun requirement, release-to-service gate,
  effectiveness/residual-risk review and independent approval are all met.
  Approval is deliberately independent — `actionCanApprove()` refuses the
  action's own author, matching both the creator and later content editors by
  stable user ID/username, with the free-text `by` field as the legacy
  fallback — and approved actions cannot be cancelled or edited.
- `backup-service.js` —
  feature-specific logic (backup/restore service). Users/Audit/Auth
  (Người dùng, Nhật ký hoạt động, đăng nhập/đổi mật khẩu/khóa đăng nhập) —
  retired from classic `users-auth.js` on 2026-08-20 (Pha G nhóm C, lát 2):
  every DOM-adapter function there already only forwarded to an existing
  TypeScript command/service (`pbkdf2PasswordService`/`legacyPasswordHashService`/
  `isPbkdf2PasswordHash`, `LoginWorkflowCommand`/`RequiredPasswordWorkflowCommand`/
  `AdminBootstrapCommand`/`UserLifecycleCommand`/`ResetOperationalDataCommand`/
  `ActivityArchiveCommand`, `activityAuditFilter`/`activityAuditPagination`/
  `activityAuditCsv`, `userListModel`/`userRowHtml`/`usersPageHtml`/
  `userPermissionsModalHtml`/`resetPasswordModalHtml`), so it moved as-is into
  `src/compat/modular-pilot.global.ts` right after `root.UserLifecycleCommand`
  is constructed. `auditQ`/`auditFrom`/`auditTo`/`auditPage`/`auditPageSize`
  joined `currentUser`/`loginFails`/`loginLockUntil` in `AuthUIState`
  (`src/presentation/state/ui-state.ts`) rather than staying classic `let`s,
  for the same reason those three already were — a vm-sandbox test assigning
  bare `auditQ='...'` must hit the real accessor property on `globalThis`, not
  a `let` trapped inside the bundle's IIFE. Hashes passwords with PBKDF2-SHA256
  via the TypeScript `pbkdf2PasswordService` bridge, whose
  `PASSWORD_HASH_ITERATIONS=600000` (OWASP minimum) lives in
  `src/domain/auth/pbkdf2-password-service.ts` — the single source now, not a
  classic-JS constant. The stored `pbkdf2$<iterations>$<salt>$<hash>` string
  carries its own iteration count, so legacy 210k-iteration hashes still
  verify (via `legacyPasswordHashService`) and silently re-hash at the current
  count on next successful login — don't lower `PASSWORD_HASH_ITERATIONS` or
  drop that upgrade path. Also exports `reauthenticateCurrentUser({title,
  message})` — a password re-prompt gating the app's *critical* operations
  (approving/returning a corrective action, locking/unlocking a reporting
  period, writing or reverting a lot's Mean/SD, concluding a lot transition,
  replacing data from backup, resetting all data, deleting a test with QC data);
  wire any new operation of that weight the same way, `await`-ing it before
  mutating state. `backup-service.js` (split out of `data-io.js` on
  2026-07-24) rejects imports over `BACKUP_IMPORT_MAX_BYTES` (128 MB) before
  parsing. The reagent regression stats
  (Passing-Bablok, Deming/OLS, Bland-Altman, plus a from-scratch incomplete-beta
  t-distribution for CIs) are pure TypeScript in `src/domain/reagent/`
  (`reagentComparisonCalculator` etc.), no stats library, covered by
  `tests/reagent-stats.test.js`.
- `lis-client-service.js` — browser-side client for the LIS Gateway prototype;
  see "LIS Gateway" below.
- Boot entry point (`boot()` awaits `loadBootState()` before login/Firebase
  init). Retired from classic `app.js` (9 lines) on 2026-08-20 (Pha H1, lát
  1): `root.boot = async () => {...}` moved as-is to the very end of
  `src/compat/modular-pilot.global.ts`, but unlike its classic form — which
  called `boot()` immediately, safe only because `app.js` was its own
  `<script defer>` loaded dead last — the port does **not** self-invoke.
  Doing so would run before `#main`/the rest of the DOM exists (still true
  even though this bundle is itself a deferred script) and would crash every
  sandbox test that loads this bundle without a `document`/`window` (most
  don't, since `app.js` was never part of any test's `loadSandbox([...])`
  list before). Fixed by registering
  `document.addEventListener('DOMContentLoaded', () => { root.boot(); })` at
  the bottom of the file instead — per the HTML spec, `DOMContentLoaded`
  always fires after every `<script defer>` has finished running, so
  `root.boot()` still fires at the same real-world moment as before, with no
  race. `index.html` dropped from 3 app `<script>` tags to 2
  (`core.js` + the bundle). A second, unrelated bug surfaced by this port:
  the classic-era `boot()` did `await ensureAdmin().then(...)`, but this
  file's own internal ambient declare said `declare function ensureAdmin():
  void;` (wrong since its creation in the `users-auth.js` retirement,
  Pha G nhóm C lát 2 — nothing had chained off its result until now) —
  fixed to `Promise<void>`.
  `src/presentation/app/app-bootstrap.ts` (`createAppBootstrap(deps)`) is a
  sibling lát-2 change: the 6 top-level `window`/`document.addEventListener`
  registrations that used to sit inline at two unrelated spots in the bundle
  (local-save flush on `beforeunload`/`pagehide`/hidden-tab
  `visibilitychange`; Firebase pull/push on `focus`/`online`/`offline`/
  visible-tab `visibilitychange`) are now one named, dependency-injected
  factory called once. `window`/`document` are passed in only after the
  adapter checks `typeof window.addEventListener === 'function'` itself (not
  `!== 'undefined'` truthiness — TypeScript's `strict` mode flags a plain
  truthy check on a DOM method as "always true" since `Window`/`Document`
  declare it as a required, non-optional member; a `typeof ... ===
  'function'` comparison sidesteps that diagnostic while still being the
  right runtime check for a duck-typed test stub that has `window` but not a
  working `addEventListener`). That distinction is exactly the regression
  this lát hit first: an initial version wrote `typeof window !== 'undefined'
  ? window : undefined` (dropping the second half of the classic double
  guard, `&& window.addEventListener`), which crashed 7 tests whose `window`
  stub exists but has no `addEventListener` method (e.g.
  `westgard-xlsx.test.js`'s `window:{QCLAB_APP:{...}}`) — caught by running
  the full `npm test`, not typecheck.
- `src/presentation/app/action-dispatcher.ts` (`createActionDispatcher(deps)`)
  — Pha H2 (2026-08-20, DONE): the event-delegation replacement for
  hand-written `onclick="fn(...)"`/`oninput=`/`onchange=`/`onkeydown=`/
  `onmousemove=`/`onfocus=`/`onmouseleave=`/`ontoggle=` strings, which is
  what let the CSP's `script-src` drop `'unsafe-inline'` (see "CSP + SRI"
  below). A single `click` listener bound once to `document` (idempotent
  `bind()`, same pattern as `vn-date-picker-controller.ts`/
  `modal-focus-trap.ts`) matches `event.target.closest('[data-action]')`,
  decodes `dataset.args` as JSON, and calls the named global with `this`
  bound to the clicked element — preserving classic `onclick` semantics for
  free. `router-dispatch-controller.ts`'s `render()` only ever replaces
  `#main`'s `innerHTML`, never the node itself, so this one listener
  survives every `rerender()` permanently. `btn()` (`ui-primitives.ts`)
  accepts `{action, args?}` — every real call site across the app now uses
  this object form (confirmed by an exhaustive scan of every `btn(`/
  `button(` call in `src/`, not just a text grep for `onclick=`, since a
  caller building the onclick STRING dynamically at runtime — e.g.
  `` `confirmReturnAction('${jsq(id)}')` `` — leaves no literal `onclick=`
  text in the TypeScript source for a grep to find); the raw-string branch
  in `btn()`/`modalCloseButton()` is dead code at this point but kept rather
  than removed, since deleting it would mean re-touching every caller's
  `action: string | {...} | null` type signature for a purely cosmetic win.
  Also binds `input`/`change`/`focusin` listeners: `data-action-on="input"|
  "change"` auto-appends the element's live value (`.checked` for
  checkbox/radio, else `.value` — or the real `event` for
  `<input type="file">`, whose `.value` is just a filename) as the final
  arg, matching every classic `this.value`/`this.checked` handler's calling
  convention without touching the target function's signature;
  `data-action-on="focus"` listens via `focusin` (bare `focus` doesn't
  bubble) with no value appended, and `data-action-on="mouseout"`
  substitutes for `onmouseleave=` (also non-bubbling) via its bubbling
  equivalent, safe only for a leaf element (SVG point tooltip). `data-action-
  self-only` (present/absent, no value) fires only when the event target IS
  the data-action element itself, not a descendant — replaces the modal
  backdrop's `onclick="if(event.target===this)closeModal()"`.
  `data-keydown-action`+`data-keydown-args`+`data-keydown-keys` (JSON — Space
  is the literal `" "` character) filters by key, always `preventDefault()`s,
  and appends the live value like input/change ("Enter creates"/"Enter
  selects the row"); the same attributes WITHOUT `data-keydown-keys` fire on
  every keydown unfiltered with the real event prepended
  (`fn.apply(el,[event,...args])`) for real keyboard navigation (arrow keys
  in the entry tree/sheet) — those target functions read `this` instead of
  `event.currentTarget`, since a delegated listener's `currentTarget` is
  always `document`. `data-keydown-self-only` is a SEPARATE flag from
  `data-action-self-only` — one row can need `closest()` dedup (no
  self-only) for its click action and self-only for its Enter/Space action
  at the same time. `data-mousemove-action`+`data-mousemove-args` prepends
  the real event the same way, for a point tooltip that follows the cursor.
  `data-notify-changed="tenHam"` is a SEPARATE mechanism from `data-action`:
  it fires a zero-arg function on every bubbled 'input'/'change', even when
  a nested descendant already has its own `data-action` for that same event
  — the one case where a single event legitimately needs to invoke two
  handlers (the NCE form's "any field changed → save draft, refresh section
  chips" catch-all, layered on top of each field's own specific action).
  Three more mechanisms closed the last real gap — one element needing
  MULTIPLE INDEPENDENT events with different target functions/args, which
  `data-action-on` (one event per element) can't express: `data-input-
  action`+`data-input-args` (bound to `input`), `data-focus-action`+
  `data-focus-args` (bound to `focusin`), `data-change-action`+
  `data-change-args` (bound to `change`) — all three call `fn.apply(el,args)`
  with NO live-value append (unlike `data-action-on`), so an element can
  carry `data-action` for one event (needs the live value) and
  `data-focus-action`/`data-change-action` for others (don't) at the same
  time — used by the reagent info panel's lô cũ/mới/Bias/alpha fields
  (`data-action` on input for `rcMeta`, `data-focus-action` for
  `rcMetaFocus`, `data-change-action` for `rcMetaLog`) and the lot-transition
  combobox (`data-input-action`+`data-change-action`, both calling
  `lotTransitionChoiceInput`, `commit` argument differing by event — the
  function itself now reads `this` instead of an explicit `el` param,
  matching every other function converted this way). Finally,
  `data-toggle-action`+`data-toggle-args` covers `<details>`'s `ontoggle=`
  (3 sites: the NCE form's collapsible sections, the entry page's two
  secondary panels) — `toggle` does NOT bubble, so unlike every mechanism
  above it's bound via the CAPTURE phase
  (`addEventListener('toggle',fn,true)`, which reaches every element
  regardless of bubbling) and reads `event.target` directly rather than
  `closest()`; appends `el.open` after the static args, matching the old
  `this.open` argument. Missing this one specific attribute name in the
  original grep sweep (which only checked 5 common event names) is exactly
  why the browser-level gates (`nce-check` here) matter: a `<details>` whose
  open/closed state silently stopped surviving `rerender()` produced no
  TypeScript or Node-test failure at all, only a real-Chromium one.
  `report-print-controller.ts`'s print popup (a genuinely separate
  `document`, built via `w.document.write(...)`) is now driven from the
  OPENER side instead of via its own inline `<script>` — the popup inherits
  the main app's CSP (same-origin `document.write()`), so it would have been
  blocked too; `openPrintImpl()` now attaches the click listener directly
  from the main bundle after `w.document.close()`, using
  `(window as any).qcPrintPdf` (the Electron preload bridge, no longer
  reached via `opener.qcPrintPdf` since this code already runs in the
  opener) instead of a `qcSavePdf`/`qcDoPrint` pair defined inline. Plain
  property assignment (`w.__qcPrintToken = printToken`) is unaffected by CSP
  (only inline SCRIPT EXECUTION is restricted, not property writes), so
  `electron/main.js`/`scripts/print-check.js`'s
  `executeJavaScript('window.__qcPrintToken')` lookup keeps working
  unchanged. `index.html`'s last 2 inline `<script>` blocks moved out the
  same lát: the nav-collapsed pre-render check became
  `assets/nav-collapse-init.js` (loaded via a plain non-deferred
  `<script src=...>` at the exact same DOM position, so it still runs
  synchronously before `<aside>` paints — no flash of an uncollapsed
  sidebar); the Electron-only `window.qcDialog` → `window.alert` override
  moved into the bundle itself (`modular-pilot.global.ts`, right after
  `appBootstrap.run()`), guarded by `(window as any).qcDialog` since
  `global.d.ts`'s `Window.qcDialog` ambient type isn't visible under
  `tsconfig.modules.json` (which only includes `src/**/*.ts`, not the
  repo-root `.d.ts` files). Finding every real site took more than a text
  grep for `onclick=`/etc.: a `btn()`/`button()` call whose action argument
  is built as a runtime template-literal string (` `fn('${id}')` `) leaves
  no literal `onXXX=` text in the source, so it silently survived every
  earlier grep-based sweep and only showed up as an actual CSP violation in
  a real browser (`ui-check`'s void-point/period-lock flows, both of which
  go through a confirm button built this way in
  `entry-page-controller.ts`/`report-page-controller.ts`) — the fix was a
  small Node script that parses every `btn(`/`button(` call's real argument
  list (balanced parens/quotes, not a single regex) and flags any whose
  second argument doesn't start with `{`. Two dev scripts needed their own
  fix once real inline execution was gone: `a11y-audit.js` loaded axe-core
  via `page.addScriptTag({content: AXE_SOURCE})`, which inserts a real
  `<script>` into the page (blocked); switched to
  `page.evaluate(AXE_SOURCE)` (a bare string, not a function) instead, which
  Playwright sends through the browser's DevTools Protocol
  (`Runtime.evaluate`) rather than a page-owned `<script>` element, so it
  runs regardless of the page's own CSP — confirmed with a two-line
  before/after test against a real minimal-CSP page.
  `visual-check.js`'s `window.open` stub (used to capture the print window's
  HTML without actually opening one) only ever implemented
  `document.write`/`close`/`focus`, since the old inline-script version
  never touched the opener-side `document`/`window` after writing it; the
  refactored `openPrintImpl()` now calls `getElementById`/reads
  `document.body`/sets `onbeforeprint`/`onafterprint` from the opener side,
  so the stub needed those added (as harmless no-ops — this script only
  checks the CSS of the captured HTML, not click behavior).

### Button convention

Three color variants, always in this order right after `btn`: `teal`
(primary action), `ghost` (secondary/cancel), `danger` (destructive). Append
`sm` for compact/table-row buttons. `btn(label,onclick,cls='ghost sm',title='',opts={})`
in `src/presentation/shared/ui-primitives.ts` (bridged as `root.btn`) is the shared builder — **always use it**, never
hand-write `<button class="btn ...">`; `opts` supports `{disabled, attrs}` for
disabled state, `style`, `data-*`, or any other extra attribute a button
needs. As of 2026-07-23 every hand-written button in `assets/modules/*.js`
(previously ~140 of them) was converted to call `btn()`, including the ones
that needed dynamic disabled state or a `style=`/`data-*` attribute — so
there's no remaining case that justifies writing one by hand.
`tests/button-conventions.test.js` enforces this as a flat ban (0 hand-written
`<button class="btn ...">` anywhere), not a ratchet, and separately rejects
any hand-written button missing a real teal/ghost/danger variant. Buttons
whose variant is chosen dynamically at runtime (e.g.
`class="btn ${danger?'danger':'teal'}"`) are unaffected — pass that
expression straight through as `btn()`'s `cls` argument.

### CSS structure

`tokens.css` also declares the app's only font (`Manrope`) via `@font-face`,
self-hosted from `assets/fonts/*.woff2` (latin + vietnamese subsets only, 5
weights each) — not loaded from Google Fonts, so text metrics don't shift in
an offline lab or the Electron shell. Regenerate those files the same way if
Manrope needs a new weight: request `fonts.googleapis.com/css2?family=...`
with an old-Chrome user agent (forces discrete static per-weight WOFF2 files
instead of one variable-font file per subset).

`tokens.css` (design tokens), `app.css` (base styles), and
`professional-base.css` (shared professional-theme layout) load first,
followed by `components.css`, then ten page-specific `professional-*.css`
files: `professional-settings.css`, `professional-dashboard.css`,
`professional-entry.css`, `professional-westgard.css`,
`professional-sigma.css`, `professional-reagent.css`,
`professional-config.css` (the "Cấu hình chung"/manage page — not the
Settings page, which is `professional-settings.css`),
`professional-reports.css`, `professional-users.css`,
`professional-audit.css`. `professional-reports.css` covers both the Báo
cáo page and the `actions` page (Khắc phục sự cố) — despite the filename,
that's where `.action-chip`/`.action-log-*`/`.issue-group`/`.issue-row`
live; the `actions` page has no separate file of its own — so the two pages
stay coupled in CSS even though their logic was split apart (Actions in
`src/presentation/actions/actions-page-controller.ts`/`action-form-controller.ts`
/ Report in `src/presentation/report/report-page-controller.ts`).
These files have
overlapping `@media` breakpoints and
height queries and rely on cascade/shorthand ordering between files — check
neighboring `professional-*.css` files for conflicting rules before adding
or reordering selectors, not just the one file you're editing.

`tokens.css` is organized as a small set of hex **primitives** plus semantic
aliases built on them; when a new color is needed, add a primitive and alias
it — don't scatter one-off hex values through the page stylesheets.

Khoảng cách giao diện cũng dùng một thang duy nhất trong `tokens.css`
(`--space-2xs` đến `--space-2xl`) cùng các alias theo component:
`--panel-inline-padding`, `--modal-inline-padding`,
`--table-cell-*-padding`. HTML dựng từ JavaScript dùng các class `flow-*`,
`space-after-*`, `.field-error` và `.sr-only`; không thêm lại
`style="margin-top:...px"`/`style="margin-bottom:...px"` cho bố cục tĩnh.
`tests/spacing-tokens.test.js` khóa quy tắc này; chỉ HTML in độc lập trong
`report-print-controller.ts` được loại trừ (kiểm riêng bằng `doesNotMatch`) vì
cửa sổ in không tải stylesheet của ứng dụng.

`--panel-content-gap` (`14px`) là nguồn duy nhất cho khoảng cách dọc từ
viền dưới header đến nội dung đầu tiên của mọi panel/card/bảng và modal. Không
hard-code `padding-top`/`margin-top` riêng cho quan hệ này trong stylesheet theo
trang; label của hàng form đầu tiên cũng không được cộng thêm margin trên. Nếu
một popup đặc biệt buộc `.modal-b` có `padding-top:0` (như hướng dẫn NCE), phần
tử nội dung đầu tiên phải tự dùng đúng `var(--panel-content-gap)`. Quy tắc này
chỉ áp dụng cho khoảng cách **header → nội dung đầu tiên**; khoảng cách nội bộ
giữa các trường/nhóm vẫn dùng token phù hợp với ngữ nghĩa riêng.
`tests/ui-accessibility.test.js` và `tests/spacing-tokens.test.js` khóa cả
token, modal mặc định và ngoại lệ này.

### Storage and sync model

Data lives in `localStorage`, mirrored on every save to the partitioned
IndexedDB store (`LocalStore`, see "Module roles") used only as a recovery
fallback at boot, and optionally to a per-lab Firebase Realtime Database room
(`labCode`, configured via `QCLAB_CLOUD`, see "Module roles"). There is no backend beyond that.
This is an **accepted tradeoff of a client-only app**, not an open bug: login
state is a JS variable, not a server-verified token/session, and Firebase
Rules by UID are the only real write boundary when sync is enabled. Don't
"fix" client-side auth without discussing the backend-authentication tradeoff
it implies.

Those Rules are a versioned artifact, not something to hand-edit in the
Firebase console: `firebase/database.rules.json` is the single source of truth
(deployment steps and the five post-deploy checks are in
`firebase/HUONG-DAN-FIREBASE-RULES.md`), and the Settings page renders the same
text via `firebaseRulesText()` (`src/presentation/settings/firebase-rules.ts`,
bridged as `settingsFirebaseRulesText`) — `tests/firebase-rules.test.js`
fails if the two diverge, so change both together. The model: a room is
readable/writable only by UIDs listed under `qclab-acl/{labCode}/{uid}`, which
clients can read for themselves but never write; every snapshot must carry a
numeric `_ts`. QC Lab's own admin/technician/viewer roles are client-side UI
permissions layered on top, not a server write boundary.

### LIS Gateway (prototype, out of validation scope)

`lis-gateway/` is a standalone Node HTTP/JSON server (plain `node:http`, zero
dependencies, no HL7/ASTM) that lets an analyzer's existing middleware push QC
results into QC Lab — it is **not** part of the Electron app (`package.json`
`build.files` excludes `lis-gateway/` and `scripts/`) and only runs from the
source tree via `npm run lis:gateway`. It is explicitly out-of-scope in
`docs/validation/URS.md` (prototype/research, not in `TRACEABILITY.md`).
Direction was reversed once (`5d1a061`, "đảo chiều"): the original design had the gateway push QC
accept/review/held gatekeeping status out toward the LIS so it could hold
patient results — that required the LIS vendor to change their release
workflow, which was infeasible, so the gateway now only **receives** QC
results from middleware and makes no decision about patient-result release.
Received results never auto-become QC points; they sit `pending` in an
append-only NDJSON journal (`store.js`'s `JournalStore`, self-heals a
truncated last line after a crash, entries are never deleted) until a tech
reviews the queue in QC Lab and clicks Nhận, at which point they go through
the same `EntryService` path as manual entry — period locks, audit log,
partitioned storage all apply. PHI is hard-rejected (`PHI_NOT_ALLOWED`),
including `specimenRef`, since this is deliberately not a clinical LIS
integration.

`server.js` refuses to start without a `QCLAB_LIS_TOKEN` — an earlier version
fail-opened (`if(!token) return true`) and since `npm run lis:gateway` doesn't
set that env var by default, every endpoint was unauthenticated on a port
gatekeeping patient-adjacent data; the process now auto-generates and persists
a token to `.data/token.txt` (mode 0600) if none is set. `/health` is the only
unauthenticated endpoint and deliberately excludes `bridge.status()`
(pending/mapping counts) — operational numbers require the token via
`/api/v1/status`. All bodied requests must carry `Content-Type: application/json`;
a `text/plain` POST is a CORS "simple request" with no preflight, so before
this check any web page could POST straight into `/api/v1/qc-results`.

Mapping config (`config.example.json`, shape:
`{allowedOrigins, mappings:[{analyzerId, testCode, qclabTestId, displayName,
expectedUnit, levels:[...], lots:[...]}]}`) keys results on `qclabTestId` —
QC Lab's internal generated id (`uid()`, e.g. `a3f9k2p`), not shown in any
screen. A typo doesn't fail to start; that test's results silently sit at
`held/UNMAPPED_TEST` forever. Since app state lives in browser
localStorage/IndexedDB, Node can't read it directly, so
`node scripts/lis-config.js <backup.json> [-o <config.json> | --check <config.json>]`
generates/validates the mapping skeleton from a Settings-page backup export;
`--check` reuses the gateway's own `buildMappingIndex()` (`core.js`) rather
than reimplementing validation, so the two can't drift.

The browser-side LIS client (`src/application/lis/lis-client-service.ts`,
bridged as `LISClientService`) polls the gateway over HTTP (`LIS_POLL_MS`, 5 min), not
a websocket. The gateway origin (`http://127.0.0.1:8787` by default) is
hard-pinned in three places that must stay in sync: `index.html`'s CSP
`connect-src`, `lisNormalizeGatewayUrl()`, and the gateway's own default
`QCLAB_LIS_PORT` — changing the port in only one place fails silently as "Lỗi
kết nối." The queue row's `onclick` wraps the *entire* attribute string in
`escAttr()`, not just the id, because `messageId` is middleware-controlled
(not an internal `uid()`) and so is an XSS-relevant input.
`tests/lis-client-service.test.js` pins that a QC point's date uses local
time (a 06:05 VN result has a UTC `measuredAt` of the previous day), and that
the gateway is only told `imported` *after* the local point write succeeds, so
a crash between the two can't silently drop a result from the queue with
nothing to show for it.

### Validation dossier (ISO 15189 / IVDR-style)

`docs/validation/` holds the controlled protocol set — `URS.md`,
`RISK-ASSESSMENT.md`, `TRACEABILITY.md`, `IQ-OQ-PQ-UAT.md`,
`BACKUP-RESTORE-DRILL.md` — applying to 2.5.0 onward. `TRACEABILITY.md` maps
each URS requirement to the code and the *named automated tests* that evidence
it; if you rename, delete or add a test that is someone's evidence row, update
that table in the same commit. Release evidence is the stdout of `npm ci`,
`npm test`, `npm run typecheck`, `npm run verify-release`, `npm run
visual-check`, `npm run a11y-audit`, `npm run nce-check`, `npm run
print-check` — the same set CI runs, so every check that gates a merge also
leaves a dossier record.

### Confirmed business-logic decisions (don't re-litigate without new input)

- **The app does not delete QC data to save space, and has no year-archive feature.**
  Both were built and then removed on 2026-08-01, before any release (`3e90819`,
  `408170a` hold the full code if it is ever needed again). The measurements that
  settled it: 10 years × 50 tests × 3 levels = 547,500 points = 78 MB and a 14,008 ms
  one-off cold domain (warm stays 0.77 ms); a mid-size lab at 20 tests × 2 levels ×
  2 years is 29,200 points / 4.2 MB. QC points do not live in `localStorage` at all
  (partitioned save writes a shell and `removeItem('qclab')`, data goes to IndexedDB),
  so the 5–10 MB cap is not the constraint. Deleting regulated QC records permanently,
  from a client-only app with no server, no transaction and no undo beyond a file the
  user may have cancelled, is not worth ~13 s of boot time at a scale almost no lab
  reaches. If a real lab ever hits a wall, reopen this with **their** numbers — and
  note the two blockers recorded in `408170a`'s message (Firebase resurrects
  per-point deletions; the NCE guard misses records whose rerun evidence is in the
  deleted year). Backup keeps its SHA-256 package format and the read-only
  "Kiểm tra backup" verifier — those earned their place independently.
- Two "Sigma" numbers are intentionally different: the printed/CSV report's
  Sigma (`reportLevelStats()` in `report-print-controller.ts`/`data-io-controller.ts`) is an observed,
  period-specific value; the Six Sigma page (`sigma-page-controller.ts`) uses
  explicitly reviewed/sourced CV/Bias. Keep them visually disambiguated, don't unify.
- The Six Sigma page's test picker lists only tests defined in "Cấu hình
  chung" — there is deliberately no in-Sigma test creation (an attempt was
  added and reverted once already).
- The Six Sigma page uses a reviewed, single-lot IQC cohort for CV; the cohort
  may cross calendar-month boundaries but is snapshotted at the Sigma period's
  evaluation cutoff. Lots must never be pooled silently, and when more than one
  lot is active in the evaluation month the user chooses the cohort explicitly.
  Bias uses only EQA/EQC results and must not be derived from IQC. When several
  signed EQA/EQC Bias values are entered, Sigma uses their
  root mean square (RMS); the signed arithmetic mean is diagnostic only because
  opposite signs can cancel.
- A CLIA absolute acceptance limit may be converted to TEa% only when the test
  unit exactly matches the criterion unit. On a mismatch, use the percentage
  branch when available and do not persist the absolute branch as applied.
- The Sigma page's `<20`, `20–29`, and `>=30` IQC-point gates are conservative
  application rules, not a claimed CLIA/CLSI minimum: below 20 is estimate-only,
  20–29 is provisional, and only 30+ may drive the page's QC suggestion.
- Mean/SD-from-limits intentionally supports ±2SD only
  (`readTargetMatrixPicks()` in `manage-tests-actions.js` hardcodes
  `sd=(high-low)/4`) — the QC lot inserts actually used never state ±3SD.
- Parallel lot run (chạy song song 2 lô, 2026-07-21): during a lot transition
  the entry sheet renders one column per (level, lot) — a level whose
  transition record (`state.lotTransitions`, synced) is `active` AND whose new
  lot already has its own Mean/SD gets an extra "Song song" column
  (`parallelLotForLevel()` in `qc-domain.js`); it never borrows the old lot's
  Mean/SD. Safety boundary, locked by `tests/parallel-lot-run.test.js`: the
  operating lot stays the only lot deciding patient-result accept/reject —
  parallel points never enter `activeWestgard()`, each lot's chain rules
  (4-1s, 6x, 10x…) run separately via `parallelWestgard()`, and a parallel-lot
  violation never marks the day rejected.
- CUSUM (`cusum()` in `core.js`, opt-in per test via `t.cusum{on,k,h}`,
  configured in the assay modal in `manage-tests-actions-controller.ts`) is a
  reference trend chart only (`drawCUSUM()` in `qc-chart-renderer.ts`, the
  "Xu hướng CUSUM" tab on the Westgard page) — it never changes a point's
  accept/reject/Westgard
  status; only the Westgard rule engine does that.
- The CLIA/Ricos TEa reference table (`REFTESTS`, derived from
  `TEA_ANALYTE_CATALOG` — both `root.X` properties in the bundle since the
  classic files that defined them retired on 2026-08-20, see "Module roles")
  is a built-in default;
  users override/extend it via `state.teaRefs` (synced list branch, edited in the
  "Bảng TEa tham chiếu" tab of the manage page). `sgRef` in
  `sigma-tea-resolution.ts` resolves a test against `effectiveTeaRefs()` (defaults overlaid with
  `state.teaRefs`), matching **exact name first** then longest-prefix — so
  e.g. "CK-MB" no longer inherits "CK". EFLM TEa stays a per-test manual value
  (`t.tea`), not part of this table.
- Measurement uncertainty (MU, ISO 15189:2022 §7.3.4) is a **top-down** budget
  (ISO/TS 20914 + Nordtest TR 537): `uncertaintyBudget()` in `core.js` does the
  math, `sgMU()`/`sgMuHTML()` + the MU modal (`sgOpenMU()`) surface it on the
  Sigma page, and `sigmaMuPrintCard()`/`sigmaMuPeriodsPrintRows()` in
  `report-print-controller.ts` put it on both Sigma print reports. Inputs are the ones the page
  already holds — u(Rw) is the *same* long-term IQC CV% the Sigma cohort uses,
  u(bias) = √(bias² + u(Cref)²) over the stored EQA rounds (u(Cref) = SD between
  rounds / √n, null with a single round), u(cal) is typed from the calibrator
  CoA; u_c = √(Σu²), U = 2·u_c. Four rules are locked by
  `tests/uncertainty.test.js` and must not be "simplified":
  (1) a component that was never assessed stays `null` and lands in `missing[]`
  — it is **never** silently read as 0, because that prints a smaller U than the
  truth with nothing on the report saying so; (2) `uCal: 0` is a *valid
  conclusion* ("CoA says negligible") and must stay distinguishable from "not
  entered", which is why `cleanSigmaLevel()` filters only negatives;
  (3) dropping the bias term is a per-level human decision (`muBiasMode`), never
  automatic, since ISO/TS 20914 only allows it once the bias has been
  investigated and corrected; (4) screen, print and the modal preview all call
  the same `uncertaintyBudget()` — `sgComp()` hangs the result on `r.mu` and
  everything else reads that back, so a level can never show one U on screen and
  another on paper. The app does **not** judge MU pass/fail: the allowable limit
  (MAU) comes from the lab's SOP; it only puts U next to TEa and flags U > TEa.

**Firebase của app-v2 (hoàn tất 2026-09-07).** Thẻ Cài đặt giờ port đủ hai
panel Firebase của app cũ: kết nối Email/Password, Rules có thể copy và hướng
dẫn ACL. Luồng chạy ở main process qua REST Identity Toolkit/Realtime
Database; renderer không nhận token, password không được lưu. DB SQLite được
đóng thành snapshot có checksum trước khi đẩy. Nếu cả máy và cloud đều có dữ
liệu vận hành khác nhau, app dừng và bắt quản trị viên chọn đẩy hoặc tải (tải
phải re-auth, tự chốt safety snapshot); sau kết nối, `writeAudit()` gom các
thay đổi rồi tự đẩy nền. Không thay snapshot SQLite bằng merge SQL tuỳ tiện.
