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

## Thứ tự đề xuất

| Giai đoạn | Nội dung | Cỡ | Rủi ro nếu để lại |
| --- | --- | --- | --- |
| A | Bảng kênh IPC một nguồn, đóng lỗ hổng LAN | M | Cao — máy trạm chiếm được phiên máy chính |
| B | Firebase chỉ để sao lưu | S–M | Trung bình — app giật khi dữ liệu lớn, đồng bộ âm thầm ngừng |
| C | Tái cấu trúc main process | M–L | Thấp — khó mở rộng, dễ lặp lỗi |
| D | Tái cấu trúc renderer | L | Trung bình — màn hình chớp, lỗi render làm trắng app |
| E | Hiệu năng | S–M | Trung bình — app đứng khi băm mật khẩu, nhật ký lớn |
| F | Ranh giới nghiệp vụ còn lại | S | Thấp — lệch số liệu ở vài chỗ phụ |

A làm trước vì là lỗ hổng bảo mật và vì bảng kênh một nguồn giúp các giai
đoạn sau (thêm kênh mới) ít sai hơn. C và D độc lập, có thể làm song song.

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

1. **Tách `ipc/config-handlers.ts` (1.370 dòng, khoảng 8 miền)** thành
   máy/xét nghiệm, lô/nhóm lô/chuyển lô, TEa tham chiếu. Logic kích hoạt nhóm
   lô (khoảng 110 dòng) và cascade chuyển lô (khoảng 130 dòng) chuyển xuống
   `domain/` hoặc `db/`.
2. **`isPeriodLocked` có 3 bản** (config, entry, report): gom vào
   `db/period-locks.ts` theo mẫu `db/operational-levels.ts`.
3. **Khoảng 12 khối BEGIN/COMMIT viết tay** còn lại chuyển sang
   `withTransaction()`; bỏ ba kiểu xử lý lỗi khác nhau.
4. **Đọc mà ghi:** `reagent.listComparisons` chèn dòng mẫu khi bảng rỗng;
   chuyển việc tạo dòng mẫu vào migration hoặc lúc khởi tạo.
5. **API chết:** `config:listActivity` không còn ai gọi nhưng đọc được nhật
   ký mà không cần quyền admin; xoá.
6. **Tên bảng/cột trong SQL:** hiện chỉ lấy từ `sqlite_master` hoặc hằng số
   nên an toàn; thêm dấu nháy định danh để phòng xa.
7. **Cần xác nhận nghiệp vụ:** bật/tắt luật Westgard chung chỉ cần quyền ghi
   (`westgard-handlers.ts`), trong khi đổi phạm vi luật cần admin.

**Test:** các test end-to-end hiện có của config phải qua nguyên vẹn sau khi
tách (tách thuần, không đổi hành vi).

## D. Tái cấu trúc renderer

**Dữ liệu và trạng thái:**

1. **Một nguồn làm mới:** mỗi hàm ghi trong store tự nạp lại, rồi
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

6. `EntryPage.tsx` (khoảng 1.080 dòng, 35 state): `EntryTree`,
   `EntrySheet`, `EntryLjPanel`, `VoidPointModal`, `RangeWorkflowModal`, hook
   `useEntryColumns()` có memo. Hiện gõ vào ô lý do huỷ làm render lại cả bảng
   31 ngày và vẽ lại mọi biểu đồ.
7. `SigmaPage.tsx`, và phần xem lô lưu trữ của `WestgardPage.tsx`
   (`ArchivedGroupView` + `useArchivedBlocks`).

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

1. **Băm mật khẩu đồng bộ:** `createUser`, `resetPassword`,
   `changeOwnPassword`, `verifyOwnPassword` gọi PBKDF2 600.000 vòng bản đồng
   bộ, chặn cả app (gọi được cả qua LAN). Đã có sẵn bản bất đồng bộ
   (`login` đang dùng); chuyển sang.
2. **Nhật ký:** `audit.query` nạp cả bảng (tới 50.000 dòng) rồi lọc bằng
   JavaScript; lọc và phân trang bằng SQL.
3. **Chế độ WAL cho SQLite:** ghi nhanh hơn, đọc không bị chặn khi LAN ghi.
   Cần kiểm tra lại backup (`VACUUM INTO`) và bản an toàn khi bật WAL.
4. **Bài đo sát thực tế:** bài đo hiện dồn 500.000 điểm vào một xét nghiệm
   (Westgard 8,3 s, Nhập QC 8,9 s). Dựng bài đo khoảng 60 xét nghiệm × 5 năm,
   nhiều lô, rồi mới quyết định có tối ưu các màn tổng hợp (Tổng quan,
   Westgard) hay không.

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

## Quyết định cần người dùng chốt

| Quyết định | Đề xuất |
| --- | --- |
| LAN có chuyển sang HTTPS | Có, sau giai đoạn A; chứng chỉ tự ký + tuỳ chọn CA nội bộ |
| Chu kỳ đẩy Firebase | 15 phút và khi đóng app |
| Bật/tắt luật Westgard chung cần quyền gì | Tra SOP; nếu là cấu hình chung của phòng thì nên là admin |
