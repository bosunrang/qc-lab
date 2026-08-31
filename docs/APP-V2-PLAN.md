# Kế hoạch app-v2 (bản viết lại kiến trúc mới)

> Tài liệu này ghi quyết định và trạng thái của `app-v2/` — bản viết lại QC Lab
> từ đầu bằng kiến trúc khác hẳn phần còn lại của repo (Electron 2 tiến trình +
> `node:sqlite` + React Router + Zustand), **tách biệt hoàn toàn** với "Giai
> đoạn 9" (viết lại composition root + gộp bundle) đang chạy song song trên app
> cũ (`index.html`/`assets/`/`src/` — xem CLAUDE.md, mục "Kernel / gỡ global
> bridge"). Hai track không đọc/ghi chung dữ liệu, không chia sẻ code. Cập nhật
> tại đây khi làm thêm bước, đừng tạo file `NEXT`/`TODO` riêng — CLAUDE.md/
> AGENTS.md vẫn là log chi tiết theo từng module (ai làm gì, ngày nào, verify
> ra sao); file này chỉ giữ **bức tranh tổng thể + lộ trình đề xuất**, không
> lặp lại lịch sử chi tiết đã có trong CLAUDE.md.

**File này được viết lại 2026-08-31** sau khi phát hiện: kế hoạch kiến trúc
gốc của `app-v2/` (nhiều chỗ trong code comment nhắc tới, ví dụ
`schema.ts`: *"Kế hoạch: Viết lại QC Lab thành app mới"*) **chưa từng được lưu
thành file** — nó chỉ tồn tại trong một phiên hội thoại trước đó và mất đi
cùng phiên đó. Từ giờ, mọi quyết định lộ trình cho app-v2 phải được chốt lại
ở đây, không chỉ nói miệng trong hội thoại.

## Vì sao có app-v2

App cũ là 1 global scope dùng chung (`window`/`root.X=`), không backend, chỉ
`localStorage`/IndexedDB — kiến trúc này đã được cải thiện dần qua nhiều giai
đoạn (TypeScript hoá, React hoá từng trang, Zustand notify-bus, gỡ dần global
bridge — xem CLAUDE.md) nhưng vẫn bị giới hạn bởi nền móng ban đầu: không có
nguồn dữ liệu quan hệ thật (mọi truy vấn phức tạp phải tự lọc mảng JS trong bộ
nhớ), không có tiến trình tách biệt renderer/main thật sự. `app-v2/` là câu
trả lời "nếu viết lại từ đầu với kiến trúc chuẩn thì sẽ như nào" — chạy song
song, không thay thế app cũ cho tới khi đạt tiêu chí ở mục "Sẵn sàng thay thế"
bên dưới.

## Kiến trúc đã chốt (không tranh luận lại trừ khi có lý do kỹ thuật mới)

- **`node:sqlite`**, không phải `better-sqlite3` — Node bundled trong Electron
  43 hỗ trợ thẳng, không cần build native module. (Từng có một dependency
  `better-sqlite3` được duyệt cài qua `allowScripts` nhưng chưa từng thật sự
  dùng — đã dọn 2026-08-31, xem lịch sử git.)
- **Schema đủ cho TOÀN BỘ ứng dụng ngay từ đầu** (`main/db/schema.ts`), không
  chỉ đủ cho phần đã code — 17 bảng, đã dùng hết cho 11/11 trang.
- **Mỗi IPC handler theo cùng khuôn**: input thô → validate thuần (`main/
  domain/*-validation.ts`, không đụng DB) → transaction → `writeAudit()` →
  `IpcResult<T>`. Tiện ích dùng chung (`Actor`/`IpcResult`/`writeAudit`/
  `nowIso`/`rowToAuditEntry`) nằm ở `main/ipc/shared.ts` — đừng nhân bản lại
  như 6 handler đầu tiên từng làm trước khi file này ra đời.
- **Handler không import lẫn nhau** — mỗi file tự SQL riêng, chỉ dùng chung
  hàm THUẦN ở tầng domain (ví dụ `entry-handlers.ts` và `report-handlers.ts`
  cùng đọc bảng `period_locks` bằng SQL riêng, chỉ dùng chung `ymOfDate()`).
  Giữ nguyên tắc này khi thêm handler mới.
- **React Router `HashRouter`** (bắt buộc hash vì đóng gói `file://`) — KHÔNG
  cần nested route/param ở quy mô 11 trang phẳng này, đừng thêm phức tạp không
  cần thiết.
- **Zustand store thật** theo `set()`/`get()` chuẩn, mỗi trang 1 store riêng —
  không phải notify-bus bọc `state` lớn như `app-store.ts` của app cũ.
- **`TEMP_ACTOR` đã bị thay hoàn toàn** bằng actor đăng nhập thật
  (`requireActor()` trong `main/index.ts`) từ khi có module Users/Auth.

## Trạng thái hiện tại: 11/11 trang xong (2026-08-31)

Mọi trang đều đọc/ghi qua IPC/SQLite thật, có audit log, có test end-to-end,
đã verify bằng Electron thật (Playwright `_electron`, kịch bản không commit).
Xem CLAUDE.md để biết chi tiết từng module (quyết định, bẫy đã gặp, cách sửa):

| # | Trang | Ghi chú |
|---|---|---|
| 1 | Cấu hình chung | máy/xét nghiệm/mức QC |
| 2 | Nhập QC | thêm/huỷ điểm QC, verdict Westgard song song |
| 3 | Phân tích Westgard | tổng quan + chi tiết mức + CUSUM + bật/tắt luật |
| 4 | Six Sigma | CV/Bias/MU đã review thủ công theo kỳ |
| 5 | Khắc phục sự cố (NCE) | tạo/duyệt/trả lại/huỷ/đánh giá hiệu lực |
| 6 | So sánh hóa chất | Deming/Passing-Bablok/Bland-Altman |
| 7 | Người dùng/Auth | bootstrap admin, PBKDF2, 3 vai trò cố định |
| 8 | Nhật ký hoạt động | lọc/phân trang, domain có sẵn từ đầu, nối muộn |
| 9 | Tổng quan/Dashboard | tổng hợp 3 API có sẵn, KHÔNG có domain riêng |
| 10 | Cài đặt | chỉ hồ sơ phòng xét nghiệm (chưa logo/Firebase/LIS) |
| 11 | Báo cáo | khoá/mở khoá kỳ (enforcement thật trong Entry) + xem lại điểm QC |

## Nguyên tắc làm việc (đã chứng minh hiệu quả, giữ nguyên)

1. **"Thí điểm" trước, đầu tư sau**: mỗi trang bắt đầu tối giản (bảng/input
   trần, không CSS) để chứng minh kiến trúc đúng trước, không polish giao
   diện khi kiến trúc còn có thể đổi.
2. **Không domain mới nếu đã có API phù hợp** — Dashboard/Audit chứng minh
   nhiều trang chỉ cần tổng hợp lại API đã có, không phải phát minh domain
   riêng cho mọi trang.
3. **Verify = build + typecheck + test Node + chạy thật trong Electron qua
   Playwright `_electron`** (kịch bản tạm, KHÔNG commit) — chỉ tin
   typecheck/test Node là không đủ, đã bắt được bug thật nhiều lần theo cách
   này (vd `period-lock-enforcement`, thứ tự seed dữ liệu của Dashboard).
4. **Test giao giữa 2 module thì viết file test riêng**, không nhét vào 1
   trong 2 file test của từng module (xem `period-lock-enforcement.test.mjs`).
5. **Dọn trùng lặp ngay khi thêm cái mới chạm vào chỗ trùng** — đừng đợi tích
   luỹ (xem việc gom `shared.ts` đúng lúc thêm handler thứ 7).
6. **Cập nhật CLAUDE.md + AGENTS.md (đồng bộ byte-identical) trong CÙNG commit
   với code** — đừng để tài liệu trễ so với code như đã xảy ra với 2 commit
   "Giai đoạn 9" đầu track kia.

## Còn thiếu — đề xuất thứ tự ưu tiên

Chưa có quyết định chính thức nào về thứ tự — đây là **đề xuất**, cần xác
nhận với người dùng trước khi bắt đầu mỗi mục:

1. **CSS/styling thật** — mọi trang vẫn `<table>`/`<input>` trần. Ưu tiên cao
   nếu muốn demo cho ai đó ngoài đội kỹ thuật; ưu tiên thấp nếu vẫn đang
   validate kiến trúc.
2. **`pagePerms` theo từng trang** — hiện 3 vai trò (admin/technician/viewer)
   không có gì khác biệt về quyền TRUY CẬP trang (chỉ "Người dùng" bị khoá
   theo admin); mọi IPC ghi cũng chưa kiểm role ngoài module Auth. Đây là một
   lỗ hổng RBAC thật cần biết trước khi coi app-v2 là "production-ready".
3. **Dashboard polling/live-update** — hiện chỉ fetch 1 lần khi mount (xem
   CLAUDE.md, giới hạn đã ghi).
4. **Backup/restore** — app cũ có; app-v2 hiện KHÔNG có đường thoát nào nếu
   file SQLite hỏng ngoài chép tay file `qclab.sqlite`.
5. **In ấn/xuất Excel/CSV** — trang Báo cáo/Westgard/Sigma của app cũ đều có,
   app-v2 chưa có trang nào.
6. **Đồng bộ Firebase** — gói `firebase` đã có trong `dependencies` của
   `package.json` gốc nhưng chưa import ở đâu trong `app-v2/`. Đây là hạng
   mục LỚN nhất còn lại (multi-device sync, model hoàn toàn khác app cũ vì
   giờ có SQLite làm nguồn thật thay vì `localStorage`).
7. **LIS Gateway** — app cũ có tích hợp thí điểm (`lis-gateway/`), app-v2
   chưa có gì.

## Câu hỏi lớn chưa có câu trả lời: khi nào app-v2 thay được app cũ?

Chưa có tiêu chí "sẵn sàng cắt sang app-v2" nào được chốt. Các điều kiện cần
nghĩ tới trước khi đặt tiêu chí thật:

- **Di trú dữ liệu**: các phòng xét nghiệm đang dùng app cũ có dữ liệu QC thật
  trong `localStorage`/IndexedDB — app-v2 hiện KHÔNG có đường nhập dữ liệu từ
  backup app cũ vào SQLite. Không có migration path thì không thể cắt sang.
- **Tương đương tính năng** tối thiểu: xem danh sách "còn thiếu" ở trên.
- **`package.json`'s `build.files`** vẫn đóng gói app cũ (`index.html`/
  `assets/**/*`/`electron/**/*`) — `app-v2/` hoàn toàn chưa nằm trong bản build
  chính thức nào, chạy/test chỉ qua script `app-v2:*` từ source tree.
- Cách hợp lý nhất có thể là **chạy song song một thời gian** (giống mô hình
  "strangler fig" đã dùng cho React trong app cũ — xem
  `docs/REACT-ADOPTION-PLAN.md`) thay vì cắt một lần — nhưng đây là quyết
  định SẢN PHẨM (bao nhiêu phòng xét nghiệm đang dùng app cũ, downtime chấp
  nhận được là bao nhiêu), không phải quyết định kỹ thuật thuần, nên cần hỏi
  người dùng khi tới gần mốc này, không tự quyết.
