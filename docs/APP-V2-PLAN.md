# Kế hoạch app-v2 (bản viết lại kiến trúc mới)

> Tài liệu này ghi quyết định, quy trình và tiến độ của `app-v2/` — bản viết
> lại QC Lab từ đầu bằng kiến trúc khác hẳn phần còn lại của repo (Electron 2
> tiến trình + `node:sqlite` + React Router + Zustand), **tách biệt hoàn
> toàn** với "Giai đoạn 9" (viết lại composition root + gộp bundle) đang chạy
> song song trên app cũ (`index.html`/`assets/`/`src/` — xem CLAUDE.md, mục
> "Kernel / gỡ global bridge"). Hai track không đọc/ghi chung dữ liệu, không
> chia sẻ code. Cập nhật tại đây khi làm thêm bước — đặc biệt là bảng "Tiến
> độ" ở cuối file, đây là nơi DUY NHẤT theo dõi trạng thái tổng thể. Đừng tạo
> file `NEXT`/`TODO` riêng. CLAUDE.md/AGENTS.md vẫn là log chi tiết theo từng
> module (ai làm gì, ngày nào, verify ra sao) — file này chỉ giữ **bức tranh
> tổng thể + kế hoạch + quy trình + tiến độ**, không lặp lại lịch sử chi tiết.

**Viết lại lần 3, 2026-08-31.** Lần 1 phục hồi kế hoạch kiến trúc gốc từ
`Cấu trúc thư mục app mới Đặt tại.docx`. Lần 2 chốt lại mục tiêu cuối theo
yêu cầu người dùng ("giống app cũ cả giao diện lẫn nghiệp vụ, kiến trúc React
sạch") và liệt kê việc còn thiếu theo module. Lần 3 (bản này) trả lời câu hỏi
"kế hoạch này ổn chưa" bằng cách vá 4 lỗ hổng đã tự phát hiện: (1) chưa có
ước lượng độ lớn từng việc, (2) Giai đoạn A ôm quá nhiều thứ chưa chặn việc
bắt đầu, (3) chưa chốt độ nghiêm ngặt kiểm thử, (4) thiếu quy trình dừng lại
xác nhận giữa các module lớn. Thêm 2 phần mới: **Quy trình làm việc** (các
bước lặp lại cho mỗi module) và **Tiến độ** (bảng theo dõi trạng thái sống,
cập nhật liên tục thay vì chỉ có kế hoạch tĩnh).

## Vì sao có app-v2

App cũ là 1 global scope dùng chung (`window`/`root.X=`), không backend, chỉ
`localStorage`/IndexedDB — kiến trúc này đã được cải thiện dần qua nhiều giai
đoạn (TypeScript hoá, React hoá từng trang, Zustand notify-bus, gỡ dần global
bridge — xem CLAUDE.md) nhưng vẫn bị giới hạn bởi nền móng ban đầu: không có
nguồn dữ liệu quan hệ thật, không có tiến trình tách biệt renderer/main thật
sự. `app-v2/` là câu trả lời "nếu viết lại từ đầu với kiến trúc chuẩn thì sẽ
như nào" — chạy song song, không thay thế app cũ cho tới khi đạt tiêu chí ở
mục "Khi nào app-v2 thay được app cũ" bên dưới.

## Kiến trúc đã chốt (không tranh luận lại trừ khi có lý do kỹ thuật mới)

- **`node:sqlite`**, không phải `better-sqlite3` — Node bundled trong Electron
  43 hỗ trợ thẳng, không cần build native module.
- **Schema đủ cho TOÀN BỘ ứng dụng ngay từ đầu** (`main/db/schema.ts`) — 20
  bảng, đã dùng hết cho 11/11 trang. Không cần sửa schema cho lộ trình dưới
  đây, trừ khi một mục cụ thể nói rõ cần thêm cột/bảng.
- **Mỗi IPC handler theo cùng khuôn**: input thô → validate thuần (`main/
  domain/*-validation.ts`, không đụng DB) → transaction → `writeAudit()` →
  `IpcResult<T>`. Tiện ích dùng chung nằm ở `main/ipc/shared.ts`.
- **Handler không import lẫn nhau** — mỗi file tự SQL riêng, chỉ dùng chung
  hàm THUẦN ở tầng domain.
- **React Router `HashRouter`**, **Zustand store thật** (`set()`/`get()`
  chuẩn, mỗi trang 1 store), **actor đăng nhập thật** qua `requireActor()`.

## Hiện trạng thật (kiểm chứng bằng code, không phải phỏng đoán)

- **Domain (`main/domain/*.ts`) đã khá đầy đủ cho phần đã làm**:
  `westgard-rules.ts` port trung thực 13 luật + priority + fix-hint từ
  `WG_RULE_REGISTRY` cũ; `westgard-engine.ts` có `westgard()`/
  `westgardByPoint()`/`westgardMultiByPoint()`/`cusumScan()`; `rule-config.ts`
  có scope `within/across/both` và Entry/Westgard đã thực thi scope này trên
  đúng lô đang vận hành; `sigma-metrics.ts` có `sigmaMetric()`/
  `uncertaintyBudget()`. Đây là phần **không cần làm lại**, chỉ cần tiếp tục
  nối các luồng UI còn thiếu theo bảng Giai đoạn B.
- **UI (`renderer/pages/*.tsx`) chỉ là khung xương thí điểm** — mỗi trang
  37–96 dòng, `<table>`/`<input>` trần, không một file CSS nào tồn tại.
  `EntryPage.tsx` (56 dòng) chỉ có 1 dropdown + 1 bảng phẳng + 1 form thêm
  điểm — không cây điều hướng, không sheet theo ngày, không biểu đồ LJ,
  không cột song song 2 lô.
- **`store:changed` (invalidation có phạm vi) mà tài liệu gốc mô tả — CHƯA
  ĐƯỢC CÀI ĐẶT.** `grep` toàn bộ `app-v2/main` không có `webContents.send`
  nào. Mọi store hiện chỉ fetch khi trang mount.
- **Không có CSS/RBAC theo trang/Firebase/LIS Gateway/backup-restore/print-
  export nào trong `app-v2/`.**

**Kết luận:** phần "kiến trúc đúng" (backend) đã xong. Phần còn lại — để đạt
"giống app cũ" — là viết lại gần như toàn bộ lớp trình bày cộng vài hạng mục
hạ tầng lớn. Coi mỗi trang như một lượt việc mới, không phải "hoàn thiện nốt".

## "Giống app cũ" nghĩa là gì, cụ thể theo từng lớp

1. **Nghiệp vụ (công thức/luật/validate): giống 100%.** Bắt buộc: với MỖI hàm
   domain, lấy file test CŨ tương ứng trong `tests/*.test.js`, viết bản test
   MỚI trỏ vào hàm mới với cùng bộ input/output, xác nhận pass trước khi coi
   là xong. Không tin "nhìn có vẻ đúng".
2. **Giao diện nhìn/dùng: lấy app cũ làm golden master, kết quả hiển thị phải
   tương đương 100% trong cùng Electron/Chromium.** "100%" ở đây là cùng DOM
   có ý nghĩa, bố cục, nhãn, trạng thái, modal, breakpoint và luồng thao tác;
   không đòi file CSS/HTML giống byte-for-byte và không so pixel tuyệt đối
   giữa hai máy khác nhau (font anti-aliasing/DPI có thể khác). CSS/JSX được
   phép tổ chức lại cho React sạch, nhưng ảnh chụp trong CÙNG môi trường phải
   nằm trong ngưỡng visual-regression đã chốt và không được có control chết.
3. **Component tương tác (modal/dialog/date-picker): viết chuẩn React ngay
   từ đầu** — app-v2 không có gánh nặng tương thích ngược nên không cần
   strangler-fig như app cũ đang làm.
4. **Dữ liệu hiển thị** (định dạng ngày/số, nhãn Westgard, gợi ý khắc phục):
   copy nguyên văn nội dung lâm sàng từ `core.js`/`qc-core.ts`.

## Giai đoạn D — UI parity 100% với app cũ (khởi động 2026-09-01)

Giai đoạn D ghi đè mọi quyết định cũ cho phép "đơn giản hoá có chủ đích" ở
lớp trình bày. Kiến trúc dữ liệu app-v2 KHÔNG đổi: renderer React chỉ gọi
Zustand → `window.qcApi` → IPC → SQLite. Chỉ mang sang lớp presentation của
app cũ; tuyệt đối không kéo `window.*`, bridge global, `localStorage` hoặc
DOM handler cổ điển vào app-v2.

### D0 — đóng băng chuẩn và dựng gate trước khi sửa hàng loạt

1. App cũ ở working tree hiện tại là **golden master**. Mọi thay đổi giao diện
   app cũ sau mốc này phải được ghi riêng; không âm thầm làm chuẩn di động.
2. Thêm manifest parity cho 11 trang, các sub-tab/modal bắt buộc và 4 viewport
   chuẩn: 1440×900, 1150×820, 980×760, 760×900.
3. Dùng cùng một bộ seed có xét nghiệm, 2 mức QC, điểm đạt/cảnh báo/loại bỏ,
   lô sắp hết hạn, NCE quá hạn và 2 người dùng cho cả hai bản.
4. Gate tạo ảnh cặp `old`/`v2`, báo console/page error, kiểm tra route/surface
   tồn tại và xuất `report.json`. Ảnh sinh ra là artifact gitignored; baseline
   chỉ cập nhật bằng cờ rõ ràng, không ghi đè im lặng.
5. Khi phần DOM đã ổn định, thêm pixel-diff trong cùng Electron; ngưỡng ban
   đầu tối đa 0,5% pixel khác ngoài anti-aliasing, sau đó siết dần. DOM/text/
   accessibility là hard-fail ngay từ đầu, không chờ pixel-diff.

### D1 — component nền tảng, làm một lần cho 11 trang

- Port đúng `professional-base.css` + `components.css` theo kết quả hiển thị,
  giữ thứ tự cascade đã được app cũ kiểm chứng.
- `PageHeader`/sidebar/auth/modal/dialog/badge/table/empty/loading phải dùng
  đúng DOM/class và breakpoint của app cũ.
- Bỏ `DateField` native đang "đơn giản hoá"; port `DatePickerPopup` React của
  app cũ sang store riêng app-v2.
- Port hình học/legend/tooltip LJ + CUSUM từ các hàm thuần đã có; canvas vẫn
  được React sở hữu qua `ref`/`useEffect`, không thao tác DOM ngoài React.
- Xoá dần style nội tuyến mang tính layout; style động thật sự (độ rộng progress,
  màu verdict tính toán) được giữ.

### D2 — trang mẫu Dashboard

Dashboard là trang mẫu đầu tiên vì khác golden master nhiều nhất nhưng chỉ
đọc dữ liệu. Mục tiêu: port nguyên `dash-hero`, KPI, "Cần xử lý / Theo dõi",
"Lô & hạn dùng", bảng xét nghiệm, filter/search và responsive. Nếu read-model
thiếu trường, mở rộng endpoint đọc hiện có (`westgard:listTestSummaries`),
không tạo đường ghi mới và không cho handler import lẫn nhau.

Dashboard chỉ được coi là mẫu đạt khi:

- cùng cấu trúc/nhãn/trạng thái rỗng-loading-có dữ liệu với app cũ;
- dữ liệu thay đổi ở trang khác cập nhật qua `store:changed`;
- test domain/IPC cũ vẫn pass, typecheck/build sạch;
- gate D0 chụp đủ 4 viewport, không console error.

### D3 — thứ tự 10 trang còn lại

> **XONG 2026-09-03 (11/11 trang).** Gate `app-v2:ui-parity` đạt 72/72
> surface, 36 ở 0/0; 9 nhóm surface còn lệch (settings, sigma, reagent,
> westgard + 5 tab Cấu hình chung) đều có `surfaceNotes` nêu lý do sản
> phẩm/kỹ thuật — xem cột Ghi chú trong bảng Tiến độ.

| Đợt | Trang | Lý do/thành phần bắt buộc |
|---|---|---|
| D3.1 | Người dùng | Khôi phục layout tạo tài khoản + quyền theo trang; phụ thuộc A2 `pagePerms` |
| D3.2 | Báo cáo | Search/range/NCE appendix/lock panel/print-export đúng golden master |
| D3.3 | Cài đặt | Unit/brand/admin tools/LIS/Firebase Rules; đồng bộ Firebase chạy qua IPC main process |
| D3.4 | Cấu hình chung | 8 tab, toàn bộ modal và breakpoint của `professional-config.css` |
| D3.5 | Nhập QC | Sheet/cây/chart + song song 2 lô + workflow đổi dải Mean/SD |
| D3.6 | Six Sigma | Bảng kỳ, Bias/MU và toàn bộ modal/legend/print-export |
| D3.7 | So sánh hoá chất | Picker, icon, tiêu chí, biểu đồ, report detail |
| D3.8 | Khắc phục sự cố | Form/NCE 8 phần đầy đủ, suggestion/evidence/review modal |
| D3.9 | Westgard | Rà hình học chart, archived groups, view mode và responsive |
| D3.10 | Nhật ký hoạt động | Trang gần nhất; dùng làm lượt siết cuối table/filter/pagination |

### Quy tắc port cho từng trang

1. Copy DOM/class/nhãn từ `src/react/pages/*Page.tsx` và file
   `assets/professional-*.css` tương ứng; không thiết kế lại bằng trí nhớ.
2. Tạo view-model/adapter typed ở renderer hoặc mở rộng read-only IPC khi dữ
   liệu SQLite chưa đủ. Component presentation không biết SQL và handler
   không biết JSX.
3. Mọi nút nhìn thấy phải có hành vi thật. Tính năng backend chưa có thì hoặc
   triển khai trước, hoặc ghi ngoại lệ sản phẩm được người dùng chấp thuận —
   không dựng nút giả để đạt ảnh chụp.
4. Verify bốn trạng thái tối thiểu: loading, empty, populated, error/modal;
   thêm trạng thái nghiệp vụ riêng của trang khi có.
5. Chỉ chuyển sang trang kế tiếp sau khi cập nhật manifest + bảng tiến độ và
   báo người dùng kết quả trang vừa xong.

## Quy trình làm việc — áp dụng cho MỌI module ở Giai đoạn A/B/C

Đây là các bước lặp lại mỗi khi bắt đầu một module (trang, hoặc 1 hạng mục
hạ tầng lớn). Không bỏ bước, kể cả khi module có vẻ nhỏ:

1. **Đọc lại phần mô tả module đó trong CLAUDE.md** (log chi tiết app cũ) để
   liệt kê đầy đủ tính năng/UI/luồng thao tác cần có — không dựa vào trí nhớ.
2. **Liệt kê domain function cần port thêm/mở rộng** cho module này, tìm
   đúng file test cũ tương ứng trong `tests/*.test.js`.
3. **Viết domain trước** (nếu thiếu) trong `main/domain/*.ts`, kèm test mới
   trỏ vào file test cũ (xem mục 1 "Giống app cũ nghĩa là gì").
4. **Bổ sung IPC handler/validate** nếu cần trường dữ liệu mới, theo đúng
   khuôn đã chốt (không import chéo handler khác).
5. **Viết/mở rộng Zustand store** cho trang.
6. **Viết UI**, bắt buộc dùng component dùng chung từ Giai đoạn A1 (Modal/
   Dialog/DateField/QcChart) — không tự viết lại một bản khác.
7. **Verify**: `app-v2:typecheck` + `app-v2:test` + `app-v2:build` sạch, cộng
   kịch bản Playwright `_electron` xác nhận luồng chính (không commit kịch
   bản, ghi kết quả vào CLAUDE.md).
8. **Cập nhật CLAUDE.md + AGENTS.md** (đồng bộ byte-identical) trong CÙNG
   commit với code, và cập nhật dòng trạng thái trong bảng "Tiến độ" ở cuối
   file này.
9. **ĐIỂM DỪNG BẮT BUỘC**: báo cáo kết quả module vừa xong cho người dùng,
   xác nhận module tiếp theo trong bảng Giai đoạn B/C vẫn đúng thứ tự ưu
   tiên trước khi bắt đầu — KHÔNG tự động chạy liên tiếp qua nhiều module
   lớn (Manage → Entry → Westgard → ...) mà không hỏi lại, vì mỗi module là
   1 quyết định ưu tiên sản phẩm (phòng xét nghiệm cần trang nào trước) mà
   chỉ người dùng biết, không phải quyết định kỹ thuật thuần.

## Quyết định đã chốt: mức độ nghiêm ngặt kiểm thử cho app-v2

App cũ có thêm 1 bộ gate riêng ngoài test Node: `a11y-audit` (ratchet theo
baseline), `visual-check` (in ấn CSS), `print-check` (PDF thật qua Electron),
`ui-workflow-check`/`nce-workflow-check` (kịch bản Playwright commit sẵn).
Xây dựng lại toàn bộ bộ gate này song song với từng trang sẽ rất tốn công
trong khi CSS/UI còn đổi liên tục ở Giai đoạn B (baseline ratchet phải viết
lại mỗi lần đổi UI). **Quyết định**: trong Giai đoạn B, mỗi trang chỉ cần
kịch bản Playwright `_electron` tạm (không commit) làm gate tối thiểu, như
đã làm với 11 module thí điểm. Việc dựng `a11y-audit`/`visual-check`/
`print-check`/kịch bản Playwright COMMIT SẴN kiểu app cũ dời sang **đầu Giai
đoạn C**, sau khi phần lớn UI đã ổn định — tránh viết lại baseline nhiều lần.
Đây là quyết định có thể xem lại nếu người dùng muốn nghiêm ngặt sớm hơn.

## Giai đoạn A — hạ tầng dùng chung, tách 2 phần theo mức độ chặn việc khác

### A1 — LÕI, phải xong trước khi viết bất kỳ trang nào ở Giai đoạn B
Làm 1 lần, dùng chung cho mọi trang — tránh mỗi trang tự phát minh lại:

1. **Design tokens + layout khung** (`renderer/styles/tokens.css`, dựng từ
   giá trị của `assets/tokens.css` cũ) + shell chung (sidebar nav, header có
   tên/vai trò, `<Outlet/>`). Route guard đọc `auth-store` chặn trang chưa
   đăng nhập.
2. **Modal/Dialog/DateField component chuẩn** (`renderer/components/`):
   `<Modal>`, `<ConfirmDialog>`/`<InfoDialog>`, `<ReauthDialog>` (port nguyên
   danh sách ~9 thao tác nhạy cảm cần re-auth từ app cũ), `<DateField>`.
3. **`store:changed` — invalidation có phạm vi thật.** Sau mỗi transaction
   ghi ở main, handler phát `win.webContents.send('store:changed',
   {tables, testIds})`; renderer có `useStoreInvalidation()` để từng store tự
   quyết định refetch dựa trên `tables`/`testIds` đang mount.
4. **Canvas chart component dùng chung** (`renderer/components/QcChart.tsx`)
   — vẽ Levey-Jennings + CUSUM, dùng lại công thức của `qc-chart-renderer.ts`
   cũ, viết thành hook/canvas ref chuẩn React.

### A2 — có thể dời sau, KHÔNG chặn việc bắt đầu Giai đoạn B
5. **`pagePerms` theo trang** — hiện 3 vai trò cố định vẫn chạy được (chỉ
   "Người dùng" bị khoá theo admin), nên đây không phải điều kiện tiên quyết
   để bắt đầu viết trang. Làm khi: (a) đã có ít nhất 2-3 trang Giai đoạn B
   xong (để biết chính xác trang nào thật sự cần phân quyền khác nhau), hoặc
   (b) người dùng yêu cầu sớm hơn vì lý do vận hành thật. Nội dung: cột/JSON
   quyền theo trang trong bảng `users`, `requirePagePermission(actor,pageId)`
   ở IPC ghi, sidebar chỉ hiện trang được phép.

## Giai đoạn B — theo module, giữ đúng thứ tự đã dùng ở lượt thí điểm

Thứ tự này đã chứng minh đúng (Cấu hình chung trước vì mọi trang khác phụ
thuộc `testId`). **Nhắc lại: dừng lại xác nhận với người dùng sau MỖI module**
(xem "Quy trình làm việc" bước 9) — thứ tự dưới đây là đề xuất kỹ thuật, có
thể đảo nếu nhu cầu vận hành thật khác đi (ví dụ phòng xét nghiệm cần Report/
Entry gấp hơn NCE).

Cột "Cỡ" là ước lượng ĐỘ LỚN TƯƠNG ĐỐI (không phải mốc ngày — quy mô công
việc kiểu này khó ước lượng theo lịch chính xác), dùng S/M/L/XL:
- **S**: chủ yếu nối UI với domain/IPC đã có sẵn, ít component mới.
- **M**: cần thêm 1-2 domain function hoặc 1 modal phức tạp.
- **L**: nhiều tab/luồng con, hoặc domain cần mở rộng đáng kể.
- **XL**: form/luồng phức tạp nhất app cũ, nhiều trạng thái, nhiều component mới (chart, cây điều hướng...).

| # | Trang | Cỡ | Việc chính còn thiếu |
|---|---|---|---|
| 1 | Cấu hình chung | **L** | 8 tab như app cũ (máy / danh mục xét nghiệm / Panel QC / lô & nhóm lô / Mean-SD matrix / chuyển tiếp lô / lịch sử dữ liệu / TEa tham chiếu); form xét nghiệm đủ 13 dòng luật Westgard, cả hành động inactive/alert/reject và scope within/across/both đã được engine thực thi; CUSUM k/h, TEa autocomplete; combobox chuyển lô có gợi ý mờ + xem trước Mean/SD; hồ sơ TEa chuẩn hoá đủ 6 trường bắt buộc |
| 2 | Nhập QC | **XL** | Cây điều hướng theo máy/panel; sheet theo ngày; biểu đồ Levey-Jennings (`QcChart`); cột "song song 2 lô" khi có `lot_transitions` active (điểm song song không vào verdict Westgard chính — port nguyên tắc an toàn này); modal huỷ điểm có lý do; enforcement khoá kỳ đã có, giữ nguyên |
| 3 | Phân tích Westgard | **L** | Tab mức hiện tại/CUSUM; bảng luật hướng dẫn; bật/tắt luật theo xét nghiệm (nối mục 1); xem lại nhóm lô đã dừng |
| 4 | Six Sigma | **L** | Bộ chọn xét nghiệm chỉ lấy từ Cấu hình chung (không tạo xét nghiệm trong Sigma); bảng kỳ theo tháng; modal Bias% từ EQA/EQC (nhiều vòng, RMS); modal MU budget (thành phần chưa đánh giá luôn `null`, không phải 0); TEa tự khớp `tea_refs` (exact rồi longest-prefix) + ghi đè thủ công |
| 5 | Khắc phục sự cố (NCE) | **XL** | Form 8 phần (nhận diện → điều tra → nguyên nhân → khắc phục → rerun → release-to-service → hiệu lực → residual-risk) với chip gợi ý theo `causeCategory`/SE-RE; duyệt/trả lại/huỷ/mở lại (không tự duyệt); liên kết bằng chứng rerun tới điểm QC thật; hướng dẫn quy trình 8 bước |
| 6 | So sánh hóa chất | **M** | Form metadata 9 trường; bảng cặp mẫu (thêm/xoá/xoá hết); Deming/Passing-Bablok/Bland-Altman (kiểm tra `reagent-stats.ts` đã đủ 3 phương pháp chưa) + biểu đồ; modal chọn/tạo phép so sánh có tìm kiếm |
| 7 | Người dùng/Auth | **S** | Modal sửa quyền dạng checkbox theo trang (phụ thuộc A2 `pagePerms`) |
| 8 | Nhật ký hoạt động | **S** | Lưu trữ log cũ (12/24/36 tháng) + xuất CSV; nút xác minh chuỗi hash thủ công |
| 9 | Tổng quan/Dashboard | **S** | Sống nhờ `store:changed` (A1) thay vì fetch 1 lần; UI đẹp hơn cho 3 khối cảnh báo đã có domain |
| 10 | Cài đặt | **M** | Logo/brand ảnh; kết nối Firebase; LIS Gateway settings; backup/restore UI; kiểm tra dung lượng lưu trữ |
| 11 | Báo cáo | **M** | In báo cáo (`printToPDF`, Giai đoạn C); xuất Excel/CSV; phụ lục NCE trong báo cáo in |

## Giai đoạn C — hạng mục hạ tầng lớn, độc lập theo trang

Mỗi mục cần hỏi người dùng xác nhận phạm vi/độ ưu tiên trước khi bắt đầu:

| Hạng mục | Cỡ | Ghi chú |
|---|---|---|
| In ấn & xuất Excel/CSV | **M–L** | Cần chốt trước: (a) port nguyên bộ máy ZIP/OOXML viết tay của bản cũ (rủi ro thấp, logic đã đúng/đã test) hay (b) dùng thư viện npm thật như `exceljs` (main process giờ là Node thật, không còn ràng buộc "0 dependency" của app cũ chạy trong trình duyệt). In PDF dùng `webContents.printToPDF`, không có rào cản. |
| Đồng bộ Firebase | **XL** | Hoàn thiện qua REST ở main process: Email/Password, RTDB Rules, snapshot SQLite có checksum, xung đột bắt buộc chọn hướng và đẩy nền sau thao tác ghi. Mật khẩu/token không lưu hoặc đi qua renderer. |
| Backup/restore | **M** | Xuất toàn bộ DB ra file JSON/gói có chữ ký (giữ định dạng SHA-256 như bản cũ để tương thích khi cần đọc backup cũ); nhập lại có xác nhận + reauth. |
| Di trú dữ liệu từ app cũ | **L** | **Bắt buộc trước khi bàn cắt sang thật** — các phòng xét nghiệm đang dùng app cũ có dữ liệu QC thật trong `localStorage`/IndexedDB. Đọc backup JSON app cũ → map field sang bảng SQLite → validate tương đương `validateStateInvariants()` → ghi 1 lần. Chưa có dòng code nào. |
| LIS Gateway | **S** | Ưu tiên thấp nhất — gateway giao tiếp qua HTTP/JSON độc lập, có thể trỏ sang app-v2 sau khi Entry xong. |
| Bộ gate kiểm thử kiểu app cũ (a11y/visual/print/workflow-check commit sẵn) | **M** | Dời sang đầu Giai đoạn C theo quyết định ở mục "Mức độ nghiêm ngặt kiểm thử" — làm sau khi phần lớn UI Giai đoạn B đã ổn định. |

## Nguyên tắc làm việc chung (đã chứng minh hiệu quả, giữ nguyên)

1. **"Thí điểm" đã xong nhiệm vụ** — lượt này là "làm đầy đủ", không dừng ở
   bảng/input trần.
2. **Không domain mới nếu đã có API phù hợp.**
3. **Verify = build + typecheck + test Node + chạy thật trong Electron qua
   Playwright `_electron`** (kịch bản tạm, KHÔNG commit ở Giai đoạn B).
4. **Test giao giữa 2 module thì viết file test riêng.**
5. **Dọn trùng lặp ngay khi thêm cái mới chạm vào chỗ trùng** — kể cả
   component dùng chung ở Giai đoạn A1 (đừng để mỗi trang tự viết `<Modal>`
   một kiểu).
6. **Cập nhật CLAUDE.md + AGENTS.md trong CÙNG commit với code.**
7. **Mỗi hàm domain port lại phải đối chiếu test cũ trước khi coi là xong.**
8. **Dừng lại xác nhận sau mỗi module** (xem "Quy trình làm việc" bước 9) —
   không tự chạy liên tiếp nhiều module lớn mà không hỏi lại.

## Definition of Done cho một trang (Giai đoạn B)

- Mọi tính năng liệt kê ở bảng Giai đoạn B cho trang đó đã có.
- Có CSS thật (không style inline rải rác), dùng token chung từ A1.
- Mọi modal/dialog/date field dùng component chung A1, không tự viết lại.
- Subscribe `store:changed` đúng phạm vi, không fetch-once nếu dữ liệu có
  thể đổi từ trang khác.
- `npm run app-v2:test` + `app-v2:typecheck` + `app-v2:build` sạch.
- Có kịch bản Playwright `_electron` xác nhận luồng chính (không commit, ghi
  kết quả vào CLAUDE.md).
- Nếu trang có phép tính domain: đối chiếu bằng test cũ.

## Tiến độ (bảng theo dõi sống — cập nhật MỖI khi hoàn thành một mục)

Trạng thái: ⬜ Chưa bắt đầu · 🟨 Đang làm · ✅ Xong (đã qua Definition of Done)

| Giai đoạn | Mục | Cỡ | Trạng thái | Ghi chú |
|---|---|---|---|---|
| A1 | Tokens + layout khung | M | ✅ | `AppShell.tsx` + `tokens.css`/`app.css`, verify Electron thật 2026-08-31 |
| A1 | Modal/Dialog/DateField chuẩn | M | ✅ | `Modal.tsx`/`DialogHost.tsx`/`DateField.tsx` + `auth:verifyPassword` IPC mới |
| A1 | `store:changed` thật | M | ✅ | `notifyChanged()` trong `writeAudit()` (activity) + 9 handler còn lại; verify 2 sự kiện liên tiếp qua Electron thật |
| A1 | `QcChart` (LJ + CUSUM) | M | ✅ | Canvas ref chuẩn React, chưa nối vào trang nào (chờ Giai đoạn B2/B3) |
| A2 | Chặn route + quyền ghi theo vai trò | M | ✅ | D0b 2026-09-02: `renderer/lib/permissions.ts` + `requireWrite`/`requireAdmin` ở main (34 guard), test `role-gating`/`permissions`; xem CLAUDE.md |
| A2 | `pagePerms` tuỳ biến theo từng tài khoản | S–M | ✅ | 2026-09-02 cùng D3.1: cột `page_perms_json` đã có sẵn trong schema từ đầu, chỉ chưa ai dùng. Thu hẹp ở MAIN (không tin danh sách renderer gửi), nav + route đọc `canUserAccessPage` |
| B1 | Cấu hình chung | L | ✅ | 8 tab đủ, 2 bug thật bắt qua Electron (window.prompt không hỗ trợ; race Mean/SD) — xem CLAUDE.md |
| B2 | Nhập QC | XL | ✅ | Đủ worksheet/chart/chi tiết/workflow dải; 2026-09-06 thêm cột song song 2 lô, “Xem lô cũ” và tra cứu điểm đã hủy, Westgard từng lô tách khỏi verdict lô chính, kiểm thử SQLite + Electron thật |
| B3 | Phân tích Westgard | L | ✅ | Tab tổng quan/nhóm lô đã dừng, LJ+CUSUM, bảng luật+gợi ý khắc phục |
| B4 | Six Sigma | L | ✅ | Modal Bias RMS nhiều vòng, modal MU 3 thành phần, TEa tự khớp tea_refs |
| B5 | Khắc phục sự cố (NCE) | XL | ✅ | Form 8 phần, chip SE/RE (tập rút gọn), rerun/release/residual-risk, mở vòng tiếp theo |
| B6 | So sánh hóa chất | M | ✅ | Picker modal, 9 trường metadata, scatter+Bland-Altman; xác nhận app cũ KHÔNG có Deming (chỉ OLS+PB) |
| B7 | Người dùng/Auth | S | 🟨 | CSS polish xong; modal sửa quyền theo trang chờ A2 (pagePerms) |
| B8 | Nhật ký hoạt động | S | ✅ | Xuất CSV, lưu trữ 12/24/36 tháng (anchor qua app_meta), xác minh chuỗi hash |
| B9 | Tổng quan/Dashboard | S | ✅ | Sống nhờ store:changed thật (đã kiểm chứng: sửa dữ liệu trang khác, quay lại KHÔNG reload vẫn cập nhật) |
| B10 | Cài đặt | M | 🟨 | Logo+dung lượng lưu trữ xong (sửa 1 bug CSP img-src thật); Firebase/LIS/backup chờ Giai đoạn C |
| B11 | Báo cáo | M | 🟨 | Khoá/mở kỳ qua reauth thật + xuất CSV xong; in PDF/xuất Excel chờ Giai đoạn C |
| C1 | In ấn & xuất Excel/CSV | M–L | 🟨 | Cơ chế xong (exceljs thật + printToPDF thật, verify file thật trên đĩa), mới áp dụng cho Báo cáo — Sigma/Westgard chưa nối |
| C2 | Đồng bộ Firebase | XL | ✅ | 2026-09-07: UI + Rules parity, xác thực Email/Password qua main process, backup SQLite có checksum, chọn hướng khi hai nguồn khác nhau và tự đẩy nền sau mọi audit write. Cần config/ACL Firebase thật của đơn vị chỉ khi vận hành. |
| C6 | Chặn ĐỌC nhật ký hoạt động theo vai trò | S | ⬜ | `audit:query`/`exportCsv`/`verifyChainNow` còn mở cho mọi vai trò đã đăng nhập (route đã chặn, IPC chưa). Đòi đổi 3 hàm sang trả `IpcResult` — lỗ bảo mật ĐỌC, không phải toàn vẹn dữ liệu |
| C3 | Backup/restore | M | ✅ | Định dạng riêng `qclab-v2-backup` (khác bản cũ, cố ý — xem CLAUDE.md), transaction thật + snapshot an toàn trước khi ghi đè, verify Electron thật (dữ liệu thay thế đúng) |
| C4 | Di trú dữ liệu từ app cũ | L | ✅ ⏸️ | Xong nhưng **ĐÓNG BĂNG 2026-09-02**: người dùng chốt KHÔNG di trú (app chưa có dữ liệu thật). Giữ code làm đường lùi, KHÔNG đầu tư thêm — 2 giới hạn đã biết (tea_ref_key để trống, section suy từ máy) cố ý KHÔNG sửa vì sẽ không bao giờ chạy. Đừng xoá: `main/db/table-io.ts` dùng chung với C3, xoá C4 mà xoá cả file đó là vỡ backup |
| C5 | LIS Gateway | S | ✅ | Client mới trong app-v2 gọi gateway server CŨ (không đổi gì ở `lis-gateway/`); verify với gateway thật + Electron thật song song, đối chiếu trạng thái cả 2 phía |
| D0d | Gate style parity (`app-v2:style-parity`) | M | ✅ | 2026-09-03: lớp thứ ba — so COMPUTED STYLE (màu/viền/cỡ chữ/line-height/padding/canh lề) từng phần tử giữa 2 bản trên 18 surface, ratchet theo `app-v2/tests/style-parity-baseline.json`. Lượt đầu ra 25 selector lệch chỉ trên tab Mean/SD, gồm 4 lệch HỆ THỐNG (reset `font:inherit` làm ô nhập in đậm; thiếu `th,td{line-height:1.4}`; thiếu `td .hint{margin-top:2px}`; `.field label{margin:0}` xoá khoảng hở nhãn). Sau khi sửa: Mean/SD về 0, các trang khác 1–6 (phần còn lại là khác biệt DOM). Đã chứng minh gate FAIL đúng khi đổi tạm 1 giá trị CSS |
| D0c | Gate CSS parity (`app-v2:css-parity`) | S | ✅ | 2026-09-03: bù ĐÚNG điểm mù của `app-v2:ui-parity` — gate đó so TẬP class trong DOM nên một class CÓ ở cả 2 bản mà app-v2 KHÔNG có rule CSS nào vẫn qua. `app-v2/scripts/css-parity-check.cjs` quét mọi `className` trong renderer, FAIL nếu app cũ có selector mà app-v2 không. Lần đầu ra **30 class** (gồm `.sg-setup-fields` làm vỡ lưới panel Six Sigma, `.action-form-panel-head`, `.issue-group`, `.lot-config-left/right`, `.wg-rule-item`, `.qc-note-input`...), đã port hết → 0. Giới hạn ghi trong file: chỉ kiểm CÓ/KHÔNG rule, không so giá trị và không kiểm ngữ cảnh `@media` |
| C6/D0 | Bộ gate kiểm thử + UI parity | M | ✅ | D0b 2026-09-02: siết thành 4 lớp (lỗi console 2 bản + selector 2 bản + tiêu đề khớp + ratchet `ui-parity-baseline.json`), đã chứng minh gate FAIL đúng khi vượt baseline. Pixel-diff cố ý vẫn để sau (D0 mục 5) |
| C7 | Test đối chiếu `browser-mock` vs handler thật | M | ✅ | 2026-09-02: `tests/mock-parity.test.mjs` — **phủ đủ 87/87 hàm QcApi** qua 3 nửa: 126 bước so BẰNG NHAU (73 hàm), 10 hàm CỐ Ý KHÁC (`not-available-in-browser-preview`), 4 hàm HỢP ĐỒNG RIÊNG (`getStorageInfo`/`verifyActivityChainNow`/`printHtmlToPdf`/`onStoreChanged`). Bắt được 18 lệch thật: **79 chuỗi tiếng Việt của bản Electron thật mất dấu**, **nhật ký bản xem trước chỉ ghi 19/40 dòng**, `saveLisSettings` mất cả cổng admin lẫn allowlist origin, CSV xuất ra không escape (vỡ cột), thiếu cổng TEa>0, và 18 cột thiếu trên 3 bảng. Đã chứng minh cả 3 nửa FAIL đúng khi cố tình làm lệch |
| D1 | Component nền tảng parity | L | 🟨 | Shell/auth xong; **DateField xong 2026-09-02** (DOM `.datebox`/`.date-text`/`.datepick`/`.native-date` như app cũ, lịch dùng `showPicker()` thay vì tự vẽ); QcChart/cascade base còn phải port chính xác |
| D2 | Dashboard golden-master parity | M | ✅ | 2026-09-02: 0 class / 0 dòng chữ lệch trên cả 4 viewport, baseline siết về 0. Sửa 9 mục, trong đó **3 lệch NGHIỆP VỤ thật** (báo động theo điểm cuối chứ không phải điểm xấu nhất; 1 dòng mỗi MỨC; % hoàn tất theo xét nghiệm) — xem CLAUDE.md |
| D3.1 | Người dùng | M | ✅ | 2026-09-02: 0/0 lệch trên cả 4 viewport ngay lượt đầu (từ 16 class/36 dòng). Form thêm inline 2 thẻ + bảng 4 cột + lưới thẻ quyền; thêm `deleteUser` (app cũ có nút Xóa, app-v2 chưa có đường nào) — xem CLAUDE.md |
| D3.2 | Báo cáo | M | ✅ | 2026-09-02: 0/0 cả 4 viewport (từ 13 class/32 dòng). Bỏ panel "Xem lại điểm QC" tự thêm; thêm phụ lục NCE cho PDF/Excel/CSV; mở khoá qua modal lý do. **Kéo theo sửa D1: `DateField` viết lại theo DOM `.datebox` app cũ** — xem CLAUDE.md |
| D3.3 | Cài đặt | M | ✅ | 2026-09-07: Firebase hoàn tất; thẻ Đồng bộ/Firebase Rules về 0 class/0 dòng thiếu so với app cũ. Thêm xác thực Email/Password, Rules có thể copy, snapshot checksum, xử lý xung đột an toàn, tự đẩy nền. Logo, backup, kiểm tra backup, xoá sạch, di trú và LIS vẫn giữ nguyên. |
| D3.4 | Cấu hình chung | L | 🟨 | 2026-09-02: người dùng tự port (0 class lệch, 8 tab đủ); tôi rà soát + sửa 2 lỗi CỦA GATE (seed cho 2 bản khác dữ liệu; gate chỉ đo 1/8 tab → nay 48 surface) + vá thiếu sót: 3/8 tab về 0/0, thêm 4 handler xoá/dừng. Còn 5 surface (xoá xét nghiệm/panel, ma trận Mean/SD, tab Lịch sử, danh mục TEa) — lý do trong surfaceNotes |
| D3.4b | Cấu hình chung — rà nghiệp vụ + giao diện | L | ✅ | 2026-09-03: **8/8 tab về 0 class/0 dòng** (baseline 5 surface còn lệch → 0). Bắt được 4 CONTROL CHẾT ở tab Mean/SD (checkbox "Dùng", "Chọn/Bỏ chọn tất cả", **"Lưu Mean/SD mức này"** không có onClick — bảng không thể lưu) và port đủ `syncTargetRange`/`toggleTargetRow`/`targetCheckAll`/`saveTargetMatrix` + `normalizeTargetPick`. Thêm 4 IPC app cũ có mà app-v2 chưa từng có: `config:removeTest` (chặn khi còn điểm QC thuộc kỳ đã khoá), `config:removePanel`, `config:setTeaRefValue`, `config:restoreTeaRefDefaults` (sửa TEa CLIA%/Ricos% ngay trên bảng như app cũ). Viết lại tab Lịch sử dữ liệu theo đúng khung/10 cột app cũ + modal Chi tiết. Sửa lệch CẤU TRÚC chung 6/8 tab (toolbar phải nằm NGOÀI panel) + 8 nhóm CSS thiếu/sai — xem CLAUDE.md mục D3.4b |
| D3.4c | Cấu hình chung — dọn giao diện và luồng máy | M | ✅ | 2026-09-06: đồng bộ nền header, viền bảng/ô chọn, kích thước modal và khoảng cách form; bỏ ghi chú không dùng ở Panel/Lô/Nhóm lô; gỡ khung lồng dư thừa ở trạng thái rỗng và bảng lô; làm rõ lịch sử bằng nhãn **xét nghiệm — máy** không kèm khu vực. Sửa lỗi danh mục tách cùng xét nghiệm sau khi đổi cấu hình một máy: bảng nay gom theo tên + đơn vị, không lệ thuộc `analyte_id` cũ có thể không đồng nhất giữa máy. `typecheck`, 44 test, renderer build và các gate giao diện đều đạt. |
| D3.5 | Nhập QC | XL | ✅ | 2026-09-02: **0/0 cả 4 viewport** (từ 77 class/104 dòng — surface lớn nhất tới nay). Gate tự bắt lỗi manifest (`.entry-layout` không tồn tại ở bản nào); 2/3 phần lệch chỉ vì app-v2 không tự chọn xét nghiệm như app cũ. Dựng lại cây máy→NHÓM LÔ→xét nghiệm, port `acceptedPoints()` (chuỗi điểm được chấp nhận — biểu đồ/thống kê app cũ dùng tập này) + IPC `entry:setDayNote`, đóng luôn điều hướng chéo trang còn treo từ D2. Ba phần backend từng còn thiếu — song song 2 lô, workflow đổi dải và điều hướng bàn phím — đã hoàn tất trong B2, chốt ngày 2026-09-06. |
| D3.6 | Six Sigma | L | ✅ | 2026-09-09: hoàn tất nghiệp vụ và UI: Bias RMS/EQA truy vết, MU, chọn cohort IQC theo lô, OPSpecs chỉ-gợi-ý, bảng kỳ/biểu đồ/print-export và TEa 4 nguồn. Catalog giữ đủ giới hạn CLIA tuyệt đối; chỉ quy đổi ra % khi Mean + đơn vị hợp lệ, có test oracle. Nhãn trục canvas cố ý được thay bằng chú giải DOM đọc được. |
| D3.7 | So sánh hoá chất | M | 🟨 | 2026-09-03: từ **26 class/58 dòng xuống 1/18**. Seed CHƯA HỀ có phép so sánh nào ở cả 2 bản (lỗi đo lường lần 4 — thêm `REAGENT_SEED` 24 cặp lệch +1%). Trang được VIẾT LẠI TOÀN BỘ đúng bố cục app cũ: `rc-toolbar-panel` → `rc-entry-grid` (thông tin 10 trường + bảng cặp mẫu có TB/Hiệu tính sẵn) → `rc-stats-panel` → `rc-crit-panel` (6 tiêu chí + banner kết luận) → `rc-chart-panel` kèm chú giải. Tách 2 hàm định dạng khác nhau (`fmt` cắt số 0 cho thống kê, `fmtFixed` giữ số 0 cho bảng cặp) đúng app cũ. Còn 1 class `rc-icon-btn` (3 danh sách chọn nhanh lô/xét nghiệm/mẫu) + 18 dòng là NHÃN TRỤC biểu đồ (app cũ vẽ SVG có text node, app-v2 vẽ canvas — cùng lý do đã ghi ở D3.6) |
| D3.8 | Khắc phục sự cố | XL | ✅ | 2026-09-03: **0/0 cả 4 viewport** (từ 42 class/66 dòng). Panel "Sự cố cần xử lý" dựng lại theo NHÓM (xét nghiệm + ngày, `issue-group`/`issue-group-h`/`issue-group-count`) thay danh sách phẳng, và KHÔNG ẩn hàng khi đã có hồ sơ NCE — app cũ đổi nút thành "Tiếp tục hồ sơ", khớp hồ sơ bằng `point_id` chứ không bằng test+mức. Bảng nhật ký đổi từ 7 cột phẳng sang 5 cột xếp tầng đúng app cũ + nút "Xuất CSV nhật ký" + nút "Hủy hồ sơ" (có lưu vết). Form dùng `action-form-panel` có đầu panel + 2 trạng thái rỗng |
| D3.9 | Westgard | M | 🟨 | 2026-09-03: từ **18 class/31 dòng xuống 0/1**. Thêm ô "Tìm nhanh" + bộ đếm khớp/tổng + nhãn xét nghiệm kèm LOT (`testPickerLabel`), 2 nút Xuất Excel/In PDF, nút "Khôi phục mặc định" (dùng `WG_OFF_BY_DEFAULT`), cột "Loại sai số" SE/RE kèm mô tả luật (`errorTypeOf`), Z có dấu + hậu tố `s`, nhãn `rej` = "Loại bỏ", class canvas `wgLJMulti`. Còn đúng 1 dòng: câu giới thiệu biểu đồ của app cũ nhắc công tắc "Xem lô cũ" — app-v2 chưa có tính năng đó (cùng nhóm với cột song song 2 lô đã hoãn từ Giai đoạn B2), câu của app-v2 chỉ nói phần nó thật sự làm thay vì hứa một công tắc không tồn tại |
| D3.10 | Nhật ký hoạt động | S | ✅ | 2026-09-03: **0/0 cả 4 viewport** (từ 9 class/16 dòng) — trang cuối của Giai đoạn D3. Ô "Số dòng mỗi trang" ghi "25 dòng", cột thời gian dùng `formatDateTimeVN` thay ISO, ô người dùng đảo lại đúng thứ tự (TÊN in đậm, dưới là "vai trò · @tài khoản"), huy hiệu chuỗi hash 3 trạng thái + tự kiểm khi nhật ký còn nhỏ (`AUTO_VERIFY_MAX`), 2 ô ngày mang class `audit-date`. Kéo theo `filteredCount`/`total` xuyên `audit-filter.ts` → handler → `qc-api.d.ts` → bản giả lập → store (app cũ hiện "N/M dòng") — `audit-filter.test.mjs` sửa để so đúng 4 khoá app cũ có và chốt riêng trường mới |

## Khi nào app-v2 thay được app cũ?

**Chốt 2026-09-02 (quyết định người dùng): CẮT THẲNG, không chạy song song.**
Lý do là một dữ kiện sản phẩm, không phải sở thích kỹ thuật: app chưa lên
production, dữ liệu hai bên đều là dữ liệu TEST. Mô hình chạy song song
(strangler-fig, như đã dùng cho React trong app cũ) tồn tại để bảo vệ dữ
liệu thật đang chạy — không có dữ liệu thật thì nó chỉ là gấp đôi công bảo
trì. Kéo theo: **không di trú dữ liệu** (C4 đóng băng, xem bảng Tiến độ),
và app cũ KHÔNG cần giữ lại để tra cứu lịch sử.

Điều kiện cắt, còn đúng 2 mục — cả hai đều kiểm PHẦN MỀM, không kiểm dữ liệu:

- Giai đoạn D xong (giao diện đạt golden master, gate `app-v2:ui-parity`
  xanh với baseline = 0 cho mọi surface trong manifest).
- Đối chiếu Westgard/Sigma trên cùng bộ dữ liệu test giữa 2 bản, khớp 100%
  — mục này GIỮ vì nó kiểm công thức lâm sàng, không liên quan dữ liệu thật.

Thao tác cắt khi tới lúc: đổi `package.json`'s `build.files` sang app-v2,
xoá DB test, khởi tạo admin mới. Không có bước di trú nào.

## Bước tiếp theo ngay bây giờ

**Cập nhật 2026-09-01 — quyết định mới của người dùng:** ưu tiên tuyệt đối
Giai đoạn D, đưa giao diện app-v2 về golden master app cũ trước khi bàn mốc
cắt sản phẩm. Việc đang làm theo đúng thứ tự:

1. ~~D0: manifest + seed + lệnh chụp/kiểm tra cặp old-v2.~~ Xong; siết
   thành gate thật ở D0b (2026-09-02, xem bảng Tiến độ + CLAUDE.md).
2. ~~Quyền ghi + chặn route theo vai trò~~ — xong ở D0b. Làm TRƯỚC D3 có
   chủ đích: quyền quyết định control nào được render, làm sau thì phải sờ
   lại từng trang lần hai.
3. ~~D2: Dashboard~~ — XONG 2026-09-02, baseline 0/0 trên cả 4 viewport.
   Bài học mang sang D3: `missingClasses` đã bằng 0 từ trước khi sửa, toàn
   bộ lệch nằm ở READ-MODEL (và 3/9 là lệch NGHIỆP VỤ thật) — nên với mỗi
   trang D3, tra thẳng hàm dựng dữ liệu của app cũ trước, đừng chỉ so CSS.
4. ~~D3.1: Người dùng~~ — XONG 2026-09-02 (0/0, đóng luôn A2 pagePerms).
   ~~D3.2: Báo cáo~~ — XONG 2026-09-02 (0/0, kéo theo sửa `DateField` ở D1).
   ~~D3.3: Cài đặt~~ — HOÀN TẤT 2026-09-07. Firebase và Firebase Rules đã
   được nối bằng IPC main process, giao diện về 0 class/0 dòng thiếu; phần
   đồng bộ dùng snapshot SQLite có checksum và bắt chọn hướng khi có xung đột.
   Tiếp theo là D3.4 Cấu hình chung.
5. Sau mỗi trang, dừng báo kết quả và đi tiếp D1/D3 theo bảng trên; component
   nền tảng phát hiện thiếu trong lúc làm Dashboard được đưa về D1 ngay,
   không vá riêng một bản chỉ dùng cho Dashboard.

**Quy trình bắt buộc cho MỖI trang D3 từ đây:** thêm trang vào manifest
(`capture:true`) → chạy `npm run app-v2:ui-parity -- --all` để có số đo đầu
vào → port JSX/CSS → chạy lại tới khi `missingClasses`/`missingTextLines` về
0 → `--update-baseline` để siết. Baseline CHỈ được đi xuống.

**C2 (Firebase) đã hoàn tất 2026-09-07.** App không gắn cứng một dự án: quản
trị viên dán config/ACL Firebase thật của đơn vị tại thẻ Cài đặt khi vận hành.
Mật khẩu và token chỉ ở bộ nhớ của main process; snapshot có checksum và xung
đột bắt buộc người dùng chọn nguồn trước khi thay thế dữ liệu. **A2** đã tách làm 2: chặn route + quyền ghi theo vai trò
XONG ở D0b; `pagePerms` tuỳ biến theo từng TÀI KHOẢN vẫn kéo vào D3.1 vì đó
là một phần nhìn thấy và tương tác được của trang Người dùng cũ.
