# Kế hoạch tối ưu kiến trúc QC Lab

Lập ngày 2026-09-25, sau khi gộp nhánh sửa "mức 1" vào `main`. Nguồn phát
hiện: ba đợt rà soát kiến trúc cùng ngày (main process, ranh giới nghiệp vụ,
renderer). Chỉ ghi điều đã đọc và xác nhận trong mã; chỗ nào còn là nghi ngờ
thì ghi rõ "cần xác nhận".

Mỗi hạng mục làm theo cùng một cách đã dùng cho quy tắc giao diện:

1. Kiểm kê bằng script hoặc grep, không đoán.
2. Sửa theo từng nhánh nhỏ, mỗi hạng mục một commit.
3. Thêm test khoá hành vi mới; thử gắn lại lỗi cũ để chắc test bắt được.
4. Chạy `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Đã xong (2026-09-25)

| Hạng mục | Kết quả |
| --- | --- |
| Transaction cho cổng ghi | `withTransaction()` (SAVEPOINT, lồng được) ở `db/transaction.ts`; mọi handler ghi chạy trong transaction, trừ Firebase |
| Phép tính nghiệp vụ | Mean/SD/CV (`domain/observed-stats.ts`), Z-score (`pointZ`), gợi ý Sigma theo QGI, Bias% EQA dùng chung từ main |
| Migration schema | Danh sách bước đánh số, `SCHEMA_VERSION = 2`; chạy lại sau khi phục hồi |
| Backup | Tệp SQLite (`VACUUM INTO`), không còn trần 128 MB; ba kênh backup không mở qua LAN |
| Lỗi nhỏ | Mã NCE không trùng; token LIS và thao tác bỏ kết quả LIS có kiểm quyền; cây Nhập QC cập nhật ngay |
| Công cụ | ESLint + luật React hooks trong CI |
| A.1–A.4 (nhánh `refactor/ipc-channels`) | Bảng thao tác một nguồn `main/ipc/operations.ts` + `desktop-operations.ts`; IPC, RPC của LAN và bản xem trước sinh từ bảng; LAN chỉ gọi dòng `lan: true`; actor truyền theo từng lời gọi, bỏ `lanCalls`; test ở `tests/ipc-operations.test.mjs` |
| A.5 (nhánh `refactor/ipc-error-boundary`) | Exception của thao tác trả `IpcResult` thành `{ ok: false }` (`unauthenticated` / `internal-error`) ở IPC, LAN và bản xem trước; thao tác đọc vẫn ném, danh sách do trình biên dịch kiểm theo `QcApi` |
| A.6 (nhánh `refactor/window-hardening`) | `main/window-guard.ts`: mọi webContents chỉ hiện trang của app; `https:` ra ngoài mở bằng trình duyệt hệ thống; còn lại bị chặn. Cửa sổ chính khai `sandbox: true` |
| E.1 (nhánh `perf/async-password-hash`) | Khởi tạo quản trị, tạo tài khoản, đặt lại, đổi và kiểm mật khẩu băm bất đồng bộ (`hashPasswordAsync`); điều kiện kiểm lại sau khi băm (trùng tên, tài khoản bị xoá, mật khẩu vừa bị đặt lại); test `tests/auth-async.test.mjs` |
| E.2 (nhánh `perf/audit-sql-query`) | `audit.query` đếm, lọc ngày, phân trang bằng SQL; tìm chữ so trên vài cột rồi mới nạp đủ cột cho trang. 50.000 dòng: lật trang 351 ms → dưới 1 ms, tìm chữ 4,5 s → 0,6 s. Test đối chiếu với cách cũ trên 546 tổ hợp |
| Lọc ngày Nhật ký (nhánh `fix/audit-local-date-filter`) | Lọc theo ngày giờ địa phương như bảng hiển thị, không theo ngày UTC (trước đây 00:00–06:59 sáng bị xếp vào hôm trước); ngày không hợp lệ bị bỏ qua |
| D.4–D.5 (nhánh `feat/error-boundary`) | `PageErrorBoundary` bọc từng trang trong `AppShell` (đổi trang thì tự bỏ lỗi) và bọc cả app; promise bị từ chối và lỗi trong trình xử lý sự kiện được báo bằng hộp thoại, không mở đè hộp thoại đang chờ; Tổng quan hiện lỗi kèm Thử lại thay vì treo ở trạng thái tải |
| E.3 (nhánh `perf/sqlite-wal`) | CSDL mở ở WAL, giữ `synchronous = FULL`: mỗi thao tác ghi có nhật ký 11 ms → 3 ms. Backup và bản an toàn (`VACUUM INTO`) vẫn là tệp SQLite thường, đọc chỉ đọc không để lại tệp phụ; đóng kết nối khi thoát app để gộp `-wal`; cỡ dữ liệu ở Cài đặt tính cả `-wal`. Test `tests/sqlite-wal.test.mjs` |
| E.4 (nhánh `perf/realistic-benchmark`) | Bài đo `realistic-dataset-performance.perf.mjs`: 60 xét nghiệm × 5 năm × 2 lần chạy/ngày, lô đổi mỗi 6 tháng (492.750 điểm, tệp WAL thật). Phát hiện câu đọc điểm theo lô không dùng được chỉ mục; thêm `idx_qc_points_lot_active (test_id, level, lot, date) WHERE voided = 0`. Tổng quan/Westgard 3,8 s → 0,59 s; một mức Westgard 75 → 11 ms, Nhập QC 86 → 20 ms; lô cũ Westgard 1,4 s → 0,30 s, Nhập QC 2,0 s → 0,45 s. Tệp lớn thêm khoảng 15%. Test `tests/qc-points-index.test.mjs` kiểm kế hoạch truy vấn của mọi câu đọc theo lô |
| C.2–C.5 (nhánh `refactor/main-process-small`) | `db/period-locks.ts` thay 3 bản `isPeriodLocked`; 15 khối BEGIN/COMMIT viết tay (config, entry, report, sigma, phục hồi, xoá sạch) chuyển sang `withTransaction()`, không còn khối nào trong `app/main`; `listComparisons` chỉ đọc, dòng so sánh trống do `seedInitialRows()` tạo khi mở CSDL và sau phục hồi/xoá sạch; xoá kênh `config:listActivity`. Kèm sửa: Firebase không còn coi phép so sánh trống là dữ liệu cục bộ (trước đây chỉ cần mở trang So sánh hoá chất là máy mới không tải được từ đám mây) |
| G.1 (nhánh `test/e2e-electron`) | `npm run test:e2e`: Playwright (`playwright-core`, không tải trình duyệt) chạy app Electron đã build trên thư mục dữ liệu tạm và cổng LAN trống (`QCLAB_USER_DATA_DIR`, `QCLAB_LAN_PORT`). 5 luồng ở `app/e2e/`: tài khoản; nhập điểm → vi phạm 1-3s → lập NCE → huỷ điểm; mở mọi trang không lỗi; máy trạm LAN nhập điểm, thao tác quản trị bị từ chối; liên kết TEa ra ngoài không mở cửa sổ app. Chạy trong `verify-release`. Kèm sửa: renderer nhận biết máy trạm LAN theo cổng 3200 gắn cứng, nay theo cách được phục vụ (bản build qua HTTP, không có preload) |
| E.6 bước 1–2, D.1 phần dữ liệu QC (nhánh `perf/fewer-summary-reloads`) | `entry-store` không tự nạp lại sau nhập/huỷ điểm và sửa ghi chú ngày (EntryPage đã nạp lại qua `useStoreInvalidation`); dải QC giữ nguyên trong lúc nạp lại cùng mức, không chớp trống. Tổng quan nghe danh sách bảng tường minh thay cho `activity`. Nhập một điểm: `listTestSummaries` 2 → 1 lần, nạp dữ liệu xét nghiệm 2 → 1 lần; thao tác không liên quan QC không còn làm Tổng quan tính lại. Test `e2e/reload-count.e2e.mjs` đếm lời gọi IPC ở main |
| D.6 (nhánh `refactor/split-entry-page`) | `EntryPage.tsx` 1.068 → 334 dòng, chỉ điều phối dữ liệu; khối hiển thị ở `pages/entry/`: `EntryTree`, `EntrySheet`, `EntryLjPanel`, `EntryPointsPanel`, `EntryRangePanel` (bọc `memo`), `VoidPointModal`, `RangeWorkflowModal` (tự giữ form), `operational.ts`, `shared.tsx`. Cột dựng bằng `useMemo`, callback bằng `useCallback`, store đọc bằng `useShallow` (D.2 cho trang này). Test đọc mã chuyển sang đọc gộp trang và thư mục con (`tests/helpers/entry-page-source.mjs`). Chưa đo số lần render bằng công cụ; hiệu quả `memo` suy từ cấu trúc props |
| C.1 phần tách tệp (nhánh `refactor/split-config-handlers`) | `config-handlers.ts` 1.358 → 23 dòng, chỉ ghép ba nhóm: `config-catalog-handlers.ts` (máy, xét nghiệm, mức QC, phạm vi luật, Panel), `config-lot-handlers.ts` (lô, nhóm lô, Mean/SD dự kiến, chuyển tiếp lô), `config-tea-handlers.ts` (TEa). `lotGroupInUse` chuyển xuống `db/lot-groups.ts`. Tách thuần: đối chiếu từng dòng thân hàm với bản gốc, chỉ khác đúng hàm vừa chuyển; 34 hàm xuất ra giữ nguyên |
| D.7 (nhánh `refactor/split-sigma-westgard-pages`) | `WestgardPage.tsx` 652 → 413 dòng: tab nhóm lô đã dừng ở `westgard/useArchivedWestgard.ts` + `ArchivedGroupView.tsx`; hai bảng điểm gần giống nhau gộp thành `WestgardPointTable` (điểm lịch sử có `cusumSignal: null` nên hiển thị như cũ). `SigmaPage.tsx` 946 → 535 dòng: hàm thuần ở `sigma/shared.ts`, 4 hộp thoại mỗi cái một tệp, 4 khối hiển thị ở `SigmaPanels.tsx`; phần thiết lập và vùng làm việc theo kỳ (các thao tác ghi) giữ ở trang. Trang Westgard đọc store bằng `useShallow`. Test đọc mã dùng `tests/helpers/page-source.mjs`; e2e thêm luồng tab nhóm lô đã dừng |
| G.2 (nhánh `feat/local-logging`) | Log ra `userData/logs/qclab.log`, mỗi dòng một JSON, xoay vòng 1 MB × 5 tệp (`main/logging/`). Nguồn: `internal-error` của IPC (kèm tên thao tác), lỗi không được bắt và lỗi hiển thị của renderer (kênh `log:clientError`, chỉ máy chính), yêu cầu LAN hỏng, exception/promise không được bắt ở main (`uncaughtExceptionMonitor`, không đổi hành vi), tiến trình hiển thị dừng. Che mật khẩu, token, khoá API trước khi ghi (`domain/log-redact.ts`). `crashReporter` với `uploadToServer: false`, tệp crash ở `logs/crashes`. Trang Cài đặt có nút "Mở thư mục log" (chỉ quản trị viên). Test `tests/logging.test.mjs`, `e2e/logging.e2e.mjs` |

## Thứ tự đề xuất

| Giai đoạn | Nội dung | Cỡ | Rủi ro nếu để lại |
| --- | --- | --- | --- |
| A | Bảng kênh IPC một nguồn, đóng lỗ hổng LAN | M | Cao — máy trạm chiếm được phiên máy chính |
| B | Firebase chỉ để sao lưu | S–M | Trung bình — app giật khi dữ liệu lớn, đồng bộ âm thầm ngừng |
| C | Tái cấu trúc main process | M–L | Thấp — khó mở rộng, dễ lặp lỗi |
| D | Tái cấu trúc renderer | L | Trung bình — màn hình chớp, lỗi render làm trắng app |
| E | Hiệu năng | S–M | Trung bình — app đứng khi băm mật khẩu, nhật ký lớn |
| F | Ranh giới nghiệp vụ còn lại | S | Thấp — lệch số liệu ở vài chỗ phụ |
| G | Test end-to-end và vận hành (log, báo crash) | M | Trung bình — thay đổi không được chạy trên Electron thật; sự cố ở phòng xét nghiệm không có dữ liệu để tra |

A làm trước vì là lỗ hổng bảo mật và vì bảng kênh một nguồn giúp các giai
đoạn sau (thêm kênh mới) ít sai hơn. C và D độc lập, có thể làm song song.
G.1 nên làm trước các đợt tái cấu trúc lớn (C, D): bộ test end-to-end là thứ
chứng minh app Electron thật vẫn chạy đúng sau mỗi đợt. E.5 chỉ làm sau khi
có kết quả E.4.

## A. Bảng kênh IPC một nguồn và bảo mật LAN

**Hiện trạng (đã xác nhận):**

- Tên kênh khai ở 3 nơi: `main/preload.ts`, các `ipcMain.handle` trong
  `main/index.ts`, và bảng `routes` của `invokeLan`.
- `invokeLan` tìm handler theo **đuôi tên**
  (`name.endsWith(':' + channel)`), nên mọi kênh đều gọi được qua LAN trừ
  vài kênh bị chặn tay:
  - method `login` khớp `auth:login`: handler gán `sessionActor` sau `await`,
    tức máy trạm thay được danh tính phiên đang mở trên máy chính, và lời gọi
    này né bộ đếm đăng nhập sai của `lan/http-server.ts`;
  - `print:htmlToPdf` mở hộp thoại lưu tệp trên máy chính;
  - chặn `bootstrapAdmin` so `channel` thay vì `target`, nên gọi bằng tên
    ngắn vẫn lọt (hiện vô hại vì hàm tự từ chối khi đã có người dùng).
- Hàng đợi LAN (`lanCalls`) chờ cả phần `await` của handler: một lệnh LIS hay
  Firebase chậm làm mọi máy trạm đứng theo.
- Gốc của hàng đợi này: danh tính nằm trong biến toàn cục `sessionActor`
  (`main/index.ts`), mỗi lời gọi LAN tráo tạm biến này sang actor của máy trạm
  rồi trả lại. Trong khi đó các hàm handler đã nhận `actor` làm tham số
  (`auth.createUser(input, requireActor())`); chỉ lớp đăng ký trong
  `index.ts` là đọc biến toàn cục.
- Cửa sổ chính không có `will-navigate` hay `setWindowOpenHandler`: một liên
  kết trong dữ liệu có thể điều hướng cửa sổ app sang trang ngoài.
  `sandbox` chỉ dựa vào mặc định của Electron, không khai tường minh (cửa sổ
  in PDF ở `export-handlers.ts` thì có khai).

**Việc cần làm:**

1. Tạo `shared/ipc-channels.ts`: một bảng
   `{ api: 'importBackup', channel: 'backup:import', lan: false, … }`.
   Sinh `preload`, đăng ký `ipcMain.handle` và tuyến LAN từ bảng này.
2. LAN chỉ gọi kênh có `lan: true` (danh sách cho phép tường minh). Bỏ khớp
   theo đuôi tên. Mặc định `lan: false` cho kênh mới.
3. Kênh đăng nhập/đăng xuất, backup, in PDF, xuất Excel qua hộp thoại, khởi tạo
   quản trị: `lan: false`.
4. Truyền actor theo từng lời gọi thay cho biến toàn cục: bảng kênh đăng ký
   handler dạng `(actor, ...args) => …`; nhánh desktop truyền actor của phiên
   đăng nhập, nhánh LAN truyền actor của request. Bỏ việc tráo `sessionActor`
   và bỏ hàng đợi `lanCalls`: không còn khoảng hở danh tính qua `await`, lệnh
   chậm của một máy trạm không chặn máy khác. `sessionActor` chỉ còn là phiên
   của máy chính, do `login`/`logout` desktop đặt.
5. Bọc lỗi một chỗ khi đăng ký handler: exception (kể cả `requireActor()`)
   thành `{ ok: false, error }` thay vì ném qua IPC.
6. Chặn điều hướng ở cửa sổ chính: `will-navigate` chỉ cho phép URL của app;
   `setWindowOpenHandler` từ chối mọi cửa sổ mới (liên kết ngoài, nếu cần,
   mở bằng `shell.openExternal` sau khi kiểm `https:`). Khai `sandbox: true`
   tường minh trong `webPreferences`.

**Ghi chú khi làm A.1–A.4:**

- Bảng nằm ở `main/ipc/` thay vì `shared/`: `tsconfig.app-main.json` đặt
  `rootDir` là `app/main`, nên main không nạp được module thực thi ngoài đó.
- Preload vẫn viết tay: preload chạy trong sandbox của Electron, không
  `require` được module local. Test so preload với bảng (cùng tên hàm, cùng
  kênh, không thừa không thiếu).
- Máy trạm LAN chỉ nhập liệu (người dùng chốt 2026-09-25): mở mọi thao tác
  đọc và thao tác ghi của KTV (điểm QC, ghi chú ngày, lập dải, NCE, Sigma, so
  sánh hoá chất, nhận/bỏ kết quả LIS, mật khẩu và ảnh của mình). Mọi thao tác
  quản trị chỉ làm trên máy chính, kể cả với tài khoản admin — gồm khởi tạo
  lại dữ liệu, Nhật ký, cấu hình luật Westgard. Test canh quy tắc "handler đòi
  admin thì `lan: false`" và khoá danh sách mở.
- Đổi hành vi LAN so với trước: `createNce`, `saveNceProtocol`, `approveNce`,
  `cancelNce`, `getReportTemplateSettings`, `backupStatus` trước đây bị chặn
  nhầm vì tên hàm khác đuôi tên kênh, nay gọi được. `login`, `logout`,
  `currentUser`, `listActivity` không còn gọi được qua `/api/rpc`.
- Giao diện máy trạm vẫn hiện menu và nút quản trị; bấm vào sẽ báo "Thao tác
  không được mở qua mạng nội bộ." Cần ẩn các phần này khi chạy qua LAN (việc
  của giai đoạn D).
- Máy trạm vẫn chưa xuất Excel/in PDF được (như trước); nên dùng
  `browser-export.ts` như bản xem trước.

**Test:** mỗi kênh trong preload có trong bảng; LAN gọi `login`, `htmlToPdf`,
`bootstrapAdmin` bị từ chối; một handler bất đồng bộ chậm không chặn handler
khác của LAN; hai lời gọi LAN của hai actor chạy xen nhau, mỗi lời gọi ghi
nhật ký đúng actor của mình và phiên desktop không đổi.

**Quyết định còn chờ:** có chuyển LAN sang HTTPS không. Mạng bệnh viện dùng
chung nên nên làm; cách đề xuất là chứng chỉ tự ký do app tạo, cho phép nạp
chứng chỉ của CA nội bộ. Việc này tách riêng, làm sau bước 1–5.

## B. Firebase chỉ để sao lưu

Người dùng xác nhận chỉ một máy đẩy lên để sao lưu, nên không cần đồng bộ
từng bản ghi.

**Hiện trạng:** sau mỗi thao tác ghi (chờ 1 giây), `firebase-handlers.ts`
dựng toàn bộ CSDL thành JSON trên luồng chính rồi PUT đè lên RTDB. Với
300.000 điểm, bước dựng mất khoảng 4 giây và thêm khoảng 670 MB RAM. Firebase
giới hạn 256 MB mỗi lần ghi qua REST (khoảng 350.000 điểm); khi chạm giới hạn
app chỉ báo "Lỗi đồng bộ tự động".

**Việc cần làm:**

1. Đẩy theo chu kỳ khi có thay đổi (đề xuất 15 phút) và khi đóng app, thay vì
   sau mỗi thao tác. Giữ nút "Đẩy lên ngay".
2. Dựng dữ liệu ở worker thread để không chặn luồng chính.
3. Đo kích thước trước khi gửi; cảnh báo rõ khi vượt 80% giới hạn.
4. Bọc transaction cho `disconnect()` (còn sót từ mức 1).
5. Về sau: gửi tệp `.sqlite` nén thay JSON (cần đổi cả phía tải về).

**Quyết định còn chờ:** chu kỳ đẩy (15 phút hay khác).

## C. Tái cấu trúc main process

1. **Tách `ipc/config-handlers.ts`** — phần tách tệp đã xong, xem bảng "Đã
   xong". Còn lại: logic kích hoạt nhóm lô (`activateLotGroup`, khoảng 110
   dòng) và cascade chuyển lô (`createLotTransition`, khoảng 130 dòng) vẫn
   nằm trong `config-lot-handlers.ts`, chưa chuyển xuống `domain/` hoặc `db/`;
   và thống nhất kiểu báo lỗi transaction (xem C.3).
2. ~~**`isPeriodLocked` có 3 bản**~~ — đã xong, xem bảng "Đã xong".
3. ~~**Khối BEGIN/COMMIT viết tay**~~ — đã xong, xem bảng "Đã xong". Còn lại
   hai kiểu báo lỗi: phần lớn handler cấu hình bắt lỗi transaction thành
   `{ ok: false, code: 'save-failed' | 'delete-failed' }`, một số để lỗi ném
   lên thành `internal-error` (A.5). Giữ nguyên để không đổi thông báo mà
   renderer đang hiện; thống nhất khi tách `config-handlers.ts` (C.1).
4. ~~**Đọc mà ghi**~~ — đã xong, xem bảng "Đã xong".
5. ~~**API chết `config:listActivity`**~~ — đã xong, xem bảng "Đã xong".
6. **Tên bảng/cột trong SQL:** hiện chỉ lấy từ `sqlite_master` hoặc hằng số
   nên an toàn; thêm dấu nháy định danh để phòng xa.
7. **Cần xác nhận nghiệp vụ:** bật/tắt luật Westgard chung chỉ cần quyền ghi
   (`westgard-handlers.ts`), trong khi đổi phạm vi luật cần admin.

**Test:** các test end-to-end hiện có của config phải qua nguyên vẹn sau khi
tách (tách thuần, không đổi hành vi).

## D. Tái cấu trúc renderer

**Dữ liệu và trạng thái:**

1. **Một nguồn làm mới** (đã làm cho `entry-store` và Tổng quan, xem E.6;
   còn `manage-store`, `nce-store`, `reagent-store`, `sigma-store`,
   `settings-store`, `users-store`, `report-store` — các store này nạp lại
   danh sách nhỏ nên ít tốn, làm cùng `catalog-store` ở mục 3): mỗi hàm ghi
   trong store tự nạp lại, rồi
   `notifyChanged` làm `useStoreInvalidation` nạp thêm lần nữa. Bỏ phần tự
   nạp trong store; giữ dữ liệu cũ trong lúc nạp (cờ `refreshing`) thay vì
   xoá mảng — hiện Westgard, Sigma, Nhập QC chớp trống sau mỗi lần ghi.
2. **Selector zustand:** hầu hết trang lấy cả store (`useManageStore()`), nên
   bất kỳ trường nào đổi cũng render lại cả trang. Dùng selector hoặc
   `useShallow`.
3. **`catalog-store`:** tách danh mục chung (xét nghiệm, máy, lô, tóm tắt) khỏi
   `manage-store` và `westgard-store`; hook `useCatalog()` tự nạp và tự đăng ký
   làm mới, thay cho danh sách bảng chép lại ở từng trang.

**Lỗi và trạng thái tải:**

4. Thêm `ErrorBoundary` quanh từng trang và handler `unhandledrejection`
   (hiện một lỗi render làm trắng cả app).
5. `dashboard-store` không bắt lỗi trong khi `loading` khởi tạo `true`: IPC
   lỗi thì Tổng quan treo ở trạng thái tải.

**Tách trang lớn:**

6. ~~`EntryPage.tsx`~~ — đã xong, xem bảng "Đã xong". Mô tả gốc: (khoảng 1.080 dòng, 35 state): `EntryTree`,
   `EntrySheet`, `EntryLjPanel`, `VoidPointModal`, `RangeWorkflowModal`, hook
   `useEntryColumns()` có memo. Hiện gõ vào ô lý do huỷ làm render lại cả bảng
   31 ngày và vẽ lại mọi biểu đồ.
7. ~~`SigmaPage.tsx` và phần xem lô lưu trữ của `WestgardPage.tsx`~~ — đã
   xong, xem bảng "Đã xong".

**Dùng chung:**

8. `<TestPicker>` + `useTestSelection()` thay 3 bản bộ chọn xét nghiệm
   (Báo cáo, Sigma, Westgard); `useCanvasDraw()` cho phần khung canvas lặp ở 3
   biểu đồ trong `QcChart.tsx`; `zText`/`lotLabelFor` trùng giữa Nhập QC và
   Westgard.
9. `lib/export.ts` với `downloadCsv()` có BOM: Nhật ký và Khắc phục sự cố xuất
   CSV thiếu BOM (cần xác nhận: có thể lỗi font khi mở bằng Excel).
10. Hỏi hàng chờ LIS chỉ chạy khi trang Cài đặt đang mở và theo ô tick nháp;
    chuyển sang main hoặc `AppShell`, theo cấu hình đã lưu.
11. Modal lịch sử lô (`HistoryTab`) render mọi điểm của lô: phân trang.
12. Renderer import thẳng khoảng 20 module `main/domain`. Đều là hàm thuần,
    nhưng không có gì giữ chúng thuần: chuyển sang `shared/domain` và thêm luật
    ESLint `no-restricted-imports`.

## E. Hiệu năng

1. ~~**Băm mật khẩu đồng bộ**~~ — đã xong, xem bảng "Đã xong".
2. ~~**Nhật ký lọc bằng JavaScript**~~ — đã xong, xem bảng "Đã xong".
3. ~~**Chế độ WAL cho SQLite**~~ — đã xong, xem bảng "Đã xong".
4. ~~**Bài đo sát thực tế**~~ — đã xong, xem bảng "Đã xong". Chạy bằng
   `npm run test:performance`, chạy kèm bài đo cũ 500.000 điểm một lô (vẫn
   7,9 s vì trường hợp đó không có nhiều lô để chỉ mục mới giúp).

   Sau khi thêm chỉ mục, phần còn lại của Tổng quan (khoảng 0,5 s) là phép tính
   Westgard trên 135 mức, không còn là SQL. Việc đáng làm tiếp theo là số lần
   gọi, không phải tốc độ mỗi lần (xem E.6).
5. **Việc tính nặng ra khỏi luồng chính.** Hiện SQLite (`node:sqlite`, đồng
   bộ) và phép tính Westgard/Sigma chạy trên main process: trong lúc tính,
   cửa sổ máy chính và mọi máy trạm LAN đứng (bài đo cũ: Westgard 8,3 s với
   500.000 điểm). **Kết luận sau E.4 (2026-09-26): chưa cần.** Màn nặng nhất
   với dữ liệu 5 năm còn khoảng 0,6 s; làm E.6 trước vì rẻ hơn nhiều. Xem lại
   nếu phòng xét nghiệm có trên 100 xét nghiệm hoặc E.6 không đủ. Hướng làm
   khi cần:
   - chuyển phần tính thuần (`domain/westgard-engine.ts`, `sigma-*`) sang
     `utilityProcess` hoặc `worker_threads`; main chỉ đọc dữ liệu và điều phối;
   - worker mở kết nối SQLite chỉ đọc riêng (cần WAL, xem E.3) thay vì nhận
     cả khối dữ liệu qua tin nhắn;
   - bản xem trước giữ đường chạy đồng bộ như hiện nay (trình duyệt không có
     `utilityProcess`), nên phần tính phải giữ là hàm thuần dùng chung.

   **Test:** kết quả của đường worker trùng đường đồng bộ trên bộ dữ liệu của
   E.4; trong lúc worker tính, một lời gọi IPC khác vẫn trả lời ngay.

6. **Giảm số lần nạp lại Tổng quan** — bước 1–2 đã xong, xem bảng "Đã xong";
   bước 3 (tính lại theo từng xét nghiệm) chưa làm. `listTestSummaries`
   tính lại mọi xét nghiệm mỗi lần được gọi, và được gọi rất thường xuyên:
   Tổng quan nạp lại khi bảng `activity` đổi, tức sau MỌI thao tác ghi; cây
   Nhập QC nạp lại khi `qc_points` đổi, còn `entry-store` tự gọi thêm một lần
   sau khi ghi (D.1). Với k máy đang mở Tổng quan hoặc Nhập QC, mỗi điểm QC
   nhập vào làm main process tính khoảng (k + 1) × 0,5 s, và vì SQLite chạy
   đồng bộ nên mọi máy khác chờ trong lúc đó. Hướng làm, theo thứ tự:
   - D.1 trước (bỏ lần tự nạp trong store);
   - Tổng quan chỉ nạp lại theo các bảng nó thật sự hiển thị. Hiện trang
     không hiện nhật ký nhưng vẫn nghe `activity`, và đang dựa vào đó để thấy
     thay đổi ở `test_levels`, `lot_groups`, `qc_panels`, `app_meta` (không có
     trong danh sách nghe): phải thay bằng danh sách bảng tường minh, không
     chỉ bỏ `activity`;
   - cân nhắc tính lại theo từng xét nghiệm: `notifyChanged` đã mang
     `testIds`, main giữ kết quả của từng xét nghiệm và chỉ tính lại xét
     nghiệm đổi. Rủi ro là kết quả cũ nếu một đường ghi quên báo, nên cần test
     canh "mọi handler ghi đều gọi `notifyChanged`" trước khi làm.

## F. Ranh giới nghiệp vụ còn lại

1. Gợi ý TEa ở renderer (`lib/tea-suggest.ts`) bỏ mất giá trị CLIA/Ricos mặc
   định khi có dòng ghi đè, khác cách main giải TEa (cần xác nhận bằng test).
2. Quy tắc NCE quá hạn chỉ có ở `view-models/dashboard-view-model.ts`; main
   nên trả `overdueDays` trong `listNceRecords`.
3. Suy SD từ giới hạn (`lib/target-range.ts`) chỉ có ở renderer; main chỉ
   kiểm hình thức.
4. `sigmaDesignEligible` ở renderer lặp điều kiện main đã áp khi đặt
   `qualityDesign = null`; rút về kiểm tra kết quả của main.
5. 7 chỗ renderer tự `JSON.parse` cột `*_json` thô; main nên trả dữ liệu đã
   giải.

## G. Test end-to-end và vận hành

**Hiện trạng (đã xác nhận):** 92 tệp `node:test` kiểm nghiệp vụ ở main khá
kỹ, nhưng 13 tệp kiểm bằng cách đọc mã nguồn như văn bản (regex), và không có
test nào chạy app Electron thật: preload, đăng ký IPC, cửa sổ, máy chủ LAN chỉ
được kiểm gián tiếp. Main không có `crashReporter` hay log ra tệp; lỗi chỉ nằm
trong console của máy đang chạy.

1. **Test end-to-end bằng Playwright cho Electron** (`_electron.launch`), chạy
   trên thư mục dữ liệu tạm (không đụng CSDL thật của người dùng), 5–10 luồng
   chính:
   - khởi tạo quản trị, đăng nhập, đăng xuất;
   - nhập điểm QC, huỷ điểm, tạo NCE từ điểm vi phạm;
   - mở từng trang ở thanh bên không lỗi (bắt cả `PageErrorBoundary` và
     console error);
   - máy trạm: mở `http://127.0.0.1:3200`, đăng nhập, nhập điểm; thao tác quản
     trị bị từ chối;
   - liên kết nguồn TEa không mở trong cửa sổ app.

   Chạy trong `verify-release` trước khi đóng gói. Khi đã có bộ này, thay dần
   các test đọc mã bằng regex (vd kiểm `AppShell` bọc `PageErrorBoundary`)
   bằng kiểm hành vi thật.

   **Đã xong 2026-09-26**, xem bảng "Đã xong". Còn lại: thay dần 13 test đọc
   mã bằng regex; luồng khởi tạo lại dữ liệu/backup qua hộp thoại hệ thống
   chưa có (cần giả lập `dialog.showSaveDialog`).
2. ~~**Log ra tệp và báo crash, chỉ lưu tại máy**~~ — đã xong, xem bảng "Đã
   xong". Còn lại: nút xuất gói log thành một tệp nén (hiện chỉ mở thư mục để
   người quản trị tự gửi). Mô tả gốc:
   - log có cấu trúc (thời điểm, mức, nguồn, thông báo) ghi vào thư mục dữ
     liệu của app, xoay vòng theo cỡ tệp; gồm lỗi `internal-error` của
     `errorResult()`, lỗi không được bắt ở renderer (gửi về main qua IPC), lỗi
     máy chủ LAN;
   - `crashReporter` với `uploadToServer: false`: tệp crash nằm cạnh log;
   - trang Cài đặt có nút mở thư mục log / xuất gói log để gửi khi báo lỗi;
   - không ghi mật khẩu, token LIS/Firebase hay nội dung yêu cầu vào log.

   **Test:** lỗi `internal-error` ở main và lỗi không được bắt ở renderer đều
   có dòng trong tệp log; log xoay vòng khi vượt cỡ; chuỗi nhạy cảm bị che.

## Quyết định cần người dùng chốt

| Quyết định | Đề xuất |
| --- | --- |
| LAN có chuyển sang HTTPS | Có, sau giai đoạn A; chứng chỉ tự ký + tuỳ chọn CA nội bộ |
| Chu kỳ đẩy Firebase | 15 phút và khi đóng app |
| Bật/tắt luật Westgard chung cần quyền gì | Tra SOP; nếu là cấu hình chung của phòng thì nên là admin |
| Log và báo crash có gửi ra ngoài không (G.2) | Không: chỉ lưu tại máy, người dùng tự xuất gói log khi cần báo lỗi |
