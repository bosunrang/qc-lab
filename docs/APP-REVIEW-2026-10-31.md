# Đánh giá tổng thể QC Lab — 31/10/2026

Phạm vi: toàn bộ `app/` ở nhánh `feat/nce-redesign` (commit `86b3dbc` cộng các
thay đổi EQA chưa commit). Bốn mảng được rà song song — nghiệp vụ, kiến trúc &
bảo mật, chất lượng mã & kiểm thử, giao diện & UX — rồi các phát hiện mức Cao
được đọc lại mã để kiểm chứng.

Ký hiệu cột "Kiểm":

- **✔** đã đọc lại mã (hoặc chạy thử) để xác nhận trong đợt tổng hợp này;
- **○** do người rà soát mảng xác nhận bằng đọc mã/probe, chưa kiểm lại lần hai.

Bối cảnh khi đọc: app **chưa lên production**, dữ liệu là dữ liệu test, hồ sơ
ISO 15189 đang chuẩn bị. Các mục "trước khi chạy thật" vì vậy là việc cần làm
trước khi đưa vào vận hành, không phải sự cố đang xảy ra.

Lệnh đã chạy: `npm run typecheck` đạt, `npm run lint` đạt (0 cảnh báo),
`npm test` 439/439 đạt. Không chạy `npm run test:e2e`.

## 1. Kết luận chung

| Mảng | Đánh giá | Một câu |
|---|---|---|
| Nghiệp vụ | Khá, còn lỗ hổng toàn vẹn hồ sơ | Phép tính Westgard/Sigma/EQA đúng và đã qua nhiều đợt rà; chỗ yếu là **ai được đổi điều gì** và **kết luận QC có bị viết lại về sau không**. |
| Kiến trúc | Tốt | Một bảng thao tác duy nhất cho IPC/LAN/bản xem trước, `writeCommand` ép giao dịch + audit, migration có đánh số, Electron đã gia cố cơ bản. |
| Bảo mật | Trung bình | Lớp truyền tải LAN làm tốt (TLS, cookie, chống dò mật khẩu) nhưng **phiên không thu hồi**, quyền theo trang chỉ ở giao diện, Firebase đẩy cả bí mật. |
| Chất lượng mã & test | Tốt | typecheck/lint sạch, test chạy trên handler + SQLite thật, có bộ ca thẩm định độc lập. Thiếu test renderer và đường lỗi qua LAN. |
| Giao diện & UX | Trung bình | Hệ token chặt, badge đạt tương phản; nhưng focus/Esc trong modal lỗi, nhiều biến thể component, nhãn chưa gắn ô nhập. |

Ba việc ảnh hưởng lớn nhất tới hồ sơ ISO 15189, nên làm trước tiên:

1. Nâng quyền các thao tác **thay đổi tiêu chí chấp nhận QC** (luật theo xét nghiệm,
   dải Mean/SD tay, TEa) lên admin hoặc quy trình hai người (mục N1, N2, N8).
2. Ngừng **tự xoá nhật ký** và ngừng **tính lại kết luận QC hồi tố** (mục A2, N2).
3. **Thu hồi phiên LAN** khi khoá/hạ quyền/xoá tài khoản (mục A1).

## 2. Nghiệp vụ

| # | Mức | Kiểm | Phát hiện | Bằng chứng |
|---|---|---|---|---|
| N1 | Cao | ✔ | KTV tự đổi hành động luật Westgard của từng xét nghiệm (vd 1-3s → Cảnh báo). `saveRuleAction` chỉ cần quyền `write`, trong khi cấu hình luật chung cần `admin`. | `app/main/ipc/westgard-handlers.ts:262` (so `:81`) |
| N2 | Cao | ○ | Kết luận QC không được lưu, luôn tính lại theo cấu hình luật **hiện hành** và không kiểm khoá kỳ: đổi luật làm run cũ (kể cả kỳ đã khoá) đổi Đạt ↔ Loại, rời/vào hàng chờ NCE. | `app/main/db/westgard-evaluation.ts:159-168`; `period-locks` không được gọi từ handler luật |
| N3 | Cao | ✔ | "Thiết lập dải QC mới" chỉ cần quyền `write` (sửa mức QC thường cần `admin`); Mean/SD tay không bị giới hạn so với dải đề xuất; `bias` là số client gửi lên và không vào audit. | `app/main/ipc/entry-handlers.ts:297`, `:306-317`, `:332`; `config-catalog-handlers.ts:261` |
| N4 | Cao | ✔ | Huỷ điểm loại "nhập sai dữ liệu" không bắt buộc lý do, không mở NCE — kể cả khi điểm đó làm run bị loại. Huỷ rồi nhập lại là run "Đạt", hàng chờ NCE trống, chỉ còn một dòng audit. | `app/main/domain/entry-validation.ts:99-101`; `entry-handlers.ts:389-394` |
| N5 | Cao | ✔ | Danh sách EQA "Cần chú ý" chỉ xét **mẫu cuối** của đợt mới nhất; mẫu không đạt đứng trước trong cùng đợt bị bỏ sót. | `app/main/ipc/eqa-handlers.ts:290` |
| N6 | TB | ○ | Tín hiệu xu hướng EQA đếm theo mẫu nhưng nhãn ghi "đợt"; `enough` (≥ 6 đợt) đếm mẫu; chuỗi sắp theo năm + số đợt, trộn nhiều chương trình. | `app/main/domain/eqa/series.ts:191-212`; `eqa-handlers.ts:236-239` |
| N7 | TB | ○ | Sót của WG-15: xét nghiệm 2 mức, phạm vi duy nhất UI cho chọn với 2of3-2s là `across`, mà kênh liên mức đòi ≥ 3 mức → luật chết. | `westgard-rules.ts:57,85-88`; `westgard-engine.ts:230`; `TestsTab.tsx:387` |
| N8 | TB | ○ | TEa: `saveTeaConfig` chỉ cần `write`, audit không ghi giá trị trước→sau; EFLM coi là "đã truy vết" khi chỉ có `tea_source`; hồ sơ TEa PXN ghi đè không lưu phiên bản; `nextReviewDate`/`effectiveDate` không được dùng ở đâu. Hồ sơ "Nguồn khác đã thẩm định" không có trường liên kết tài liệu riêng. | `sigma-handlers.ts:261`; `sigma-tea-core.ts:99`; `config-tea-handlers.ts:61,92` |
| N9 | TB | ○ | Nhập điểm không chặn ngày tương lai, lô hết hạn, và snapshot Mean/SD của điểm nhập lùi ngày lấy dải **hiện hành** thay vì dải hiệu lực theo ngày. | `entry-validation.ts:72-76`; `entry-handlers.ts:376-411` |
| N10 | TB | ○ | Lập dải PXN bị chặn vĩnh viễn nếu lô có bất kỳ run bị loại nào (CLSI C24 chỉ yêu cầu loại run đó khỏi phép tính) — đẩy người dùng sang huỷ điểm (N4). | `app/main/domain/range-workflow.ts:25,32` |
| N11 | TB | ○ | Nhóm IQC cho Sigma thành `unstable` vĩnh viễn sau khi chuyển dải NSX → PXN (đúng quy trình), dù CV không phụ thuộc đích. | `app/main/domain/sigma-cohort.ts:138-139` |
| N12 | TB | ○ | Chấp nhận lô QC mới không kiểm dữ liệu chạy song song (n, số ngày, run bị loại). | `config-lot-handlers.ts:322-341` |
| N13 | TB | ○ | So sánh lô hoá chất: Bias trên trung bình gộp mọi mẫu, ngưỡng 6% cố định không suy từ TEa — Natri lệch +5% vẫn "Đạt" dù TEa CLIA ≈ 2,9%. | `app/main/domain/reagent-stats.ts:145-146` |
| N14 | Thấp | ○ | `applyLabRange` lấy ngày hiệu lực theo UTC (`nowIso().slice(0,10)`), trái D-13; EQA coi đợt không đạt khi chỉ một mẫu không đạt (CLIA dùng < 80%) — cần chốt trong SOP; CLIA thiếu giới hạn tuyệt đối cho Urea và pH (cần đối chiếu CMS-3355-F). | `entry-handlers.ts:326,331`; `eqa/series.ts:229`; `tea-catalog.ts:194,218-232` |

Mâu thuẫn tài liệu cần chốt: **N-15** (EQA-PLAN, Bias có dấu cho Sigma) và **SG21**
(Sigma dùng RMS, `sigma-handlers.ts:101`) — cần một đợt SIGMA-REVIEW quyết trước
khi nối Bias EQA vào Sigma.

Khoảng trống so với ISO 15189:2022:

- 7.3.7.2 — chưa có **xem xét định kỳ dữ liệu QC** có ký duyệt (xu hướng CV,
  dịch Mean, tổng hợp run bị loại); `lockPeriod` không kiểm NCE còn mở hay run
  bị loại chưa xử lý trong kỳ (`report-handlers.ts:58`).
- 7.3.7.2 — chưa có **phê duyệt người thứ hai** cho Mean/SD và lô mới (N3, N12).
- 7.3.7.3 — EQA mới tới giai đoạn 2a; N-01, N-08, N-12, N-14 chưa cài (đúng lộ trình).
- Bộ ca thẩm định (`docs/VALIDATION.md`) chưa có ca cho EQA (z, J, không thành
  công), MU, EP26, lập dải và khoảng nghi ngờ bệnh nhân.

Các quyết định đã chốt ở các đợt trước đã cài đúng: WG-16, WG-19, WG-20, WG-22,
D-03, SG13/13b, SG15, D-19/D-22, N-04/N-05.

## 3. Kiến trúc và bảo mật

| # | Mức | Kiểm | Phát hiện | Bằng chứng |
|---|---|---|---|---|
| A1 | Cao | ✔ | Phiên LAN lưu nguyên `Actor` (gồm `role`) lúc đăng nhập, sống 8 giờ; khoá, hạ quyền, xoá tài khoản, đặt lại mật khẩu, phục hồi backup đều **không thu hồi** phiên — chỉ đăng xuất mới gọi `revoke`. | `app/main/lan/session-store.ts:6,13-17,27`; `lan/http-server.ts:174` |
| A2 | Cao | ✔ | Nhật ký hoạt động tự **xoá vĩnh viễn** dòng cũ khi vượt 50.000 dòng (mỗi lần nhập điểm là một dòng), không xuất CSV. Trái yêu cầu lưu giữ hồ sơ. | `app/main/ipc/shared.ts:46-47,149-161` |
| A3 | TB | ✔ | Bản đóng gói vẫn có menu mặc định của Electron (DevTools) vì không gọi `Menu.setApplicationMenu`; nhiều thao tác đọc qua IPC không gọi `ctx.actor()` → người chưa đăng nhập ở máy chính đọc được báo cáo qua DevTools. Quyền theo trang (`pagePerms`) chỉ được kiểm ở renderer. | `app/main/index.ts` (không có `setApplicationMenu`); `ipc/operations.ts:174-237`, ví dụ `queryPoints` dòng 215 |
| A4 | TB | ○ | Firebase đẩy **toàn bộ CSDL** gồm `users.pass_hash`, avatar, nhật ký và token LIS dạng rõ; checksum không khoá; kéo về thay toàn bộ bảng kể cả `users` → một UID có quyền ghi trong ACL có thể cấy tài khoản admin. | `sync/firebase-payload.ts:20`; `db/table-io.ts:16-22`; `ipc/firebase-handlers.ts:161-168,212` |
| A5 | TB | ○ | Firebase không làm mới `idToken` (~1 giờ): sao lưu tự động 15 phút âm thầm trả 401 sau khoảng một giờ, chỉ báo chung "Lỗi đồng bộ tự động". | `domain/firebase-client.ts:18-28` |
| A6 | TB | ○ | Chuỗi hash nhật ký dùng SHA-256 không khoá, bỏ qua dòng không có hash, anchor sửa được trong `app_meta`, `qc_points` không thuộc chuỗi → chỉ chống sửa thô. | `domain/audit-chain.ts:33-37,52,64` |
| A7 | TB | ○ | Audit không phân biệt máy trạm LAN (`clientId` luôn `'app-desktop'`), không ghi IP, không ghi đăng nhập sai. | `ipc/desktop-operations.ts:50`; `auth-handlers.ts:135` |
| A8 | TB | ○ | "Xoá sạch dữ liệu" xoá cứng `qc_points` — trái quy tắc "không xoá cứng điểm QC"; chấp nhận được khi còn dữ liệu test, cần khoá trước khi chạy thật. | `ipc/backup-handlers.ts:237-258` |
| A9 | Thấp | ○ | Gia cố Electron còn thiếu: bản đóng gói vẫn nhận `QCLAB_DEV_SERVER_URL`; không có Electron fuses; IPC không kiểm `senderFrame`; cửa sổ in PDF bật JavaScript. | `index.ts:67,308`; `operations.ts:323`; `export-handlers.ts:27-32` |
| A10 | Thấp | ○ | Main không kiểm `must_change_password`; LIS `importResult` tin bản ghi client gửi lên; đăng nhập lộ tài khoản tồn tại qua thời gian phản hồi; `verifyOwnPassword` không giới hạn số lần thử. | `auth-handlers.ts:124-125`; `lis-handlers.ts:99-112` |
| A11 | Thấp | ○ | Hiệu năng: `previewLotRename` quét toàn bảng (thiếu `test_id`); kéo Firebase parse tới 256 MB trên luồng main; trang Nhập QC tính lại Westgard mọi mức cho mỗi mức. | `config-lot-handlers.ts:135`; `firebase-handlers.ts:234`; `entry-handlers.ts:93-114` |

Kẽ hở luật lint ranh giới (chưa thấy vi phạm thực tế): mẫu `'../ipc/**'` không
khớp `../../ipc/` từ `domain/eqa|nce`; `main/sync` không nằm trong danh sách cấm;
`desktop-operations.ts:78,181` gọi thẳng `writeAudit`; `domain/firebase-client.ts`
làm I/O mạng trong tầng "thuần".

## 4. Chất lượng mã và kiểm thử

| # | Mức | Kiểm | Phát hiện | Bằng chứng |
|---|---|---|---|---|
| Q1 | Cao | ✔ | Client LAN trả thẳng `response.json()`, không xét mã HTTP: phiên hết hạn (401) hoặc thao tác đọc lỗi (400) làm hàm đọc nhận `{ok:false}` thay cho mảng → `.map` hỏng, trang rơi vào ErrorBoundary; renderer không xử lý `unauthenticated` ở đâu. Không có test cho `http-api.ts`. | `app/renderer/lan/http-api.ts:4-7,25` |
| Q2 | TB | ○ | Mỗi đăng ký nghe thay đổi mở một `EventSource` riêng; một trang tới ~4 luồng SSE, hai tab là chạm giới hạn 6 kết nối HTTP/1.1 → RPC treo. | `http-api.ts:13` |
| Q3 | TB | ○ | Chưa ký số bộ cài, chưa có cập nhật tự động (dù đã sinh `latest.yml`); Electron 43.2.0 sau bản vá 43.8.x; `npm audit` 10 mục ở phụ thuộc chạy cùng app (qua `exceljs`); CI dùng `lts/*`, không ghim Node. | `package.json` |
| Q4 | TB | ○ | ESLint chỉ bật luật hooks + ranh giới (không `no-unused-vars`, `no-floating-promises`); bật thử `noUnusedLocals` ra 13 lỗi. | `eslint.config.mjs:8-31` |
| Q5 | TB | ○ | 63/114 tệp test viết kiểu script (assert ở cấp module); ~17 tệp regex trên `.tsx/.css`, vỡ khi đổi định dạng; không có test render React. | `app/tests/` |
| Q6 | TB | ○ | Ngưỡng độ dài lý do (5/10 ký tự) gõ cứng ~12 chỗ ở main và chép lại ≥ 5 chỗ ở renderer; thời hạn phiên LAN khai hai nơi. | `entry-handlers.ts:299,341`; `VoidPointModal.tsx:28`; `http-server.ts:171` |
| Q7 | TB | ○ | Hàm quá phức tạp: `SigmaPage` (complexity 91), `savePeriod` (86, kiểm dữ liệu lẫn trong handler), `WestgardPage` (77), `resolveTea` (69). | `SigmaPage.tsx:34`; `sigma-handlers.ts:292` |
| Q8 | Thấp | ○ | Trùng tiện ích (`todayIso` ×3, phân trang ×3); 6 export chết (`lastHashOf`, `sameRun`, `nceFailureRuns`, …); `catch {}` lặng lẽ khi JSON luật Westgard hỏng; `manage-store` không chặn phản hồi cũ. | `rule-config.ts:24,84`; `audit-chain.ts:75` |

## 5. Giao diện và UX

| # | Mức | Kiểm | Phát hiện | Bằng chứng |
|---|---|---|---|---|
| U1 | Cao | ✔ | **Lỗi do commit `86b3dbc` (dropdown `base-select`)**: khi danh sách đang mở, Enter phát ra từ `OPTION` và lan lên modal; `Modal` chỉ bỏ qua `TEXTAREA/BUTTON/A` nên Enter để chọn mục sẽ **bấm nút Lưu** và mục không được chọn. Đã tái hiện: keydown Enter có `target = OPTION`, `defaultPrevented = false`. | `app/renderer/components/Modal.tsx:54-60` |
| U2 | Cao | ✔ | `autoFocus` vô tác dụng trong mọi Modal/Dialog: React không ghi thuộc tính `autofocus` vào DOM nên `querySelector('[autofocus]')` trống và focus rơi vào nút ✕; gõ ngay không vào ô, Enter thì đóng hộp thoại. Khi đóng, focus không trả về nút đã mở modal. | `app/renderer/components/useFocusTrap.ts:24-29` |
| U3 | Cao | ○ | Esc đóng nhiều lớp cùng lúc (lịch chọn ngày + modal chứa nó; `confirmDialog` + modal bên dưới); bấm ra nền cũng đóng modal; không cảnh báo dữ liệu chưa lưu. | `useFocusTrap.ts:113`; `DatePickerPopup.tsx:53`; `Modal.tsx:67` |
| U4 | Cao | ○ | Vòng focus 1px trùng màu nền nút teal (1,00:1) → gần như không thấy focus bàn phím trên nút chính. | `tokens.css`, `app.css:139` |
| U5 | Cao | ○ | Màu Sigma ngoài hệ token, 4 bảng màu khác nhau; "Cận biên" chữ trắng trên `#dd8b1f` chỉ 2,70:1. | `pages/sigma/shared.ts:88`; `SigmaCharts.tsx:9`; `lib/sigma-summary-export.ts:18` |
| U6 | TB | ○ | Biểu đồ Levey-Jennings dùng màu làm tín hiệu duy nhất (Cảnh báo/Loại cùng kích thước, cam/đỏ 2,15:1); biểu đồ nhiều mức không phân biệt mức bằng hình dạng/nét. | `QcChart.tsx:56-58,322-345,446-470` |
| U7 | TB | ○ | Biểu mẫu: 16/23 tệp có Modal không khoá nút khi đang lưu (bấm đúp tạo bản trùng); 49 cặp nhãn–ô nhập không gắn `htmlFor/id`; không có `aria-invalid`; lỗi hiện đầu form không chỉ ra ô sai. | ví dụ `InstrumentsTab.tsx:82-87` |
| U8 | TB | ○ | Thông báo không thống nhất: lỗi hiện màu vàng `warn` (không có kiểu `error`); thành công lúc là modal chặn, lúc im lặng; `confirmDialog` mặc định nút đỏ kể cả thao tác không phá huỷ. | `dialog-store.ts:5`; `DialogHost.tsx:33` |
| U9 | TB | ○ | Component dựng lại: 3 kiểu thẻ số liệu, 3 kiểu phân trang, ≥ 8 biến thể header panel (lề 14/16/20px), 4 hộp trống tự dựng thay `EmptyState`; ô ngày cao 38px lệch ô nhập 36px. | `app.css:104-113,409-425`; `entry.css:27` |
| U10 | TB | ○ | Bố cục cửa sổ nhỏ: `.qc-sheet` cần cuộn ngang ở 1366 nhiều hơn ở 1280; `max-height:574px` cố định; từ 1024–1050px sidebar chỉ còn icon mà không có tooltip. | `entry.css:58-62`; `app.css:50-58`; `AppShell.tsx:79` |
| U11 | Thấp | ○ | Khối `::-webkit-scrollbar*` trong `tokens.css` là mã chết (Chromium mới bỏ qua khi đã đặt `scrollbar-width/color`); ~400 khai báo khoảng cách px thô ở các tệp CSS cũ; 3 màu teal khác nhau trên biểu đồ. | `tokens.css:428-432` |
| U12 | Thấp | ○ | Chữ tiếng Việt: "Xoá/Xóa", "Huỷ/Hủy" lẫn lộn; EQA có 3 tên "kỳ/đợt/vòng"; "Hủy" vừa là nút đóng vừa là thao tác nghiệp vụ; sót "app", "backup", "test"; nhãn menu khác tiêu đề trang ở 4 trang. | `TeaRefsTab.tsx:104,109`; `page-roles.ts:32-42` |

## 6. Điểm mạnh

- **Một bảng thao tác** (`ipc/operations.ts`) sinh cả IPC, RPC LAN và bản xem
  trước; LAN dùng danh sách cho phép tra bằng `Map`; preload `satisfies QcApi`.
- **`writeCommand`** biến quy ước thành ràng buộc: cổng quyền, giao dịch lồng
  được, bắt buộc audit và khai bảng thay đổi trong cùng giao dịch, có luật lint canh.
- **CSDL**: WAL + `synchronous=FULL`, khoá ngoại, migration đánh số chạy trong
  giao dịch, backup `VACUUM INTO` + `integrity_check`, bản an toàn trước khi phục hồi.
- **Electron**: `contextIsolation`, `sandbox`, không `nodeIntegration`, CSP
  `script-src 'self'`, chặn điều hướng, `openExternal` chỉ `https:`.
- **LAN**: HTTPS với CA riêng giới hạn dải IP nội bộ, khoá CA niêm phong bằng
  DPAPI, cookie `HttpOnly; Secure; SameSite=Strict`, đếm đăng nhập sai trước khi băm.
- **Nghiệp vụ**: registry luật Westgard là nguồn duy nhất; mỗi điểm lưu snapshot
  Mean/SD; Sigma không giả định Bias = 0; ngân sách MU đánh dấu thành phần thiếu;
  EQA đối chiếu z của nhà cung cấp với z tính lại.
- **Kiểm thử**: test chạy trên handler + SQLite thật, có bộ ca thẩm định với máy
  tính tham chiếu độc lập; quy ước chú thích tiếng Việt được test tự động.
- **Giao diện**: `tokens.css` ba lớp, CSS không có `!important` hay hex; badge
  trạng thái đạt tương phản 5–7:1; Enter trong modal tôn trọng bộ gõ tiếng Việt
  (`isComposing`); thao tác không hoàn tác được có xác thực lại mật khẩu.

## 7. Lộ trình đề xuất

**Trước khi chạy thật (P0)**

1. U1 — sửa Enter trong danh sách `select` mở (lỗi mới, sửa nhỏ ở `Modal.tsx`).
2. N1, N3, N8 — nâng quyền đổi luật theo xét nghiệm, dải Mean/SD tay, cấu hình
   TEa lên admin hoặc quy trình đề xuất/duyệt; ghi trước→sau vào audit; main tự tính Bias.
3. A2 — bỏ tự xoá nhật ký; chỉ cảnh báo và buộc lưu trữ có xuất tệp.
4. N2 — lưu snapshot kết luận theo run, hoặc gắn cấu hình luật với "hiệu lực từ ngày"; chặn thay đổi ảnh hưởng kỳ đã khoá.
5. N4 — huỷ điểm thuộc run bị loại phải có lý do và để lại dấu vết NCE.
6. A1, A3, Q1 — thu hồi phiên LAN (hoặc đọc lại người dùng mỗi RPC); tắt
   DevTools khi `app.isPackaged`; mọi thao tác đọc gọi `ctx.actor()`; client LAN xử lý 401/lỗi.
7. A4, A5 — loại `pass_hash`/token khỏi gói Firebase, không ghi đè `users` khi kéo về, làm mới token.
8. A8 — khoá "Xoá sạch dữ liệu" khi đã có dữ liệu thật.

**Ngay sau đó (P1)**

- N5, N6, N7, N9, N10, N11, N12 — các lỗi nghiệp vụ mức Trung bình.
- U2, U3, U4, U5 — focus, Esc theo ngăn xếp lớp, vòng focus, màu Sigma.
- Q2 — dùng chung một `EventSource`.
- Xem xét định kỳ dữ liệu QC có ký duyệt; bổ sung ca thẩm định EQA/MU/EP26.
- Chốt N-15 vs SG21.

**Dần dần (P2)**

- Q3 ký số bộ cài, nâng Electron, ghim Node; Q4 bật thêm luật lint; Q5 tách test
  kiểu script; Q6–Q8 dọn trùng lặp.
- U6–U12 — đồng bộ component, nhãn truy cập, chữ tiếng Việt, bố cục cửa sổ nhỏ.
