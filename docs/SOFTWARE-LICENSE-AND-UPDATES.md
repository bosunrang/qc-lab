# Kích hoạt phần mềm và cập nhật qua GitHub

Từ phiên bản **1.1.0**, bản cài Windows yêu cầu giấy phép offline gắn với
mã máy và có thể lấy bản cập nhật từ kho public `bosunrang/qc-lab`.

## 1. Cặp khoá cấp phép

Cặp khoá Ed25519 đã được tạo cho dự án này:

- Khoá bí mật: `C:\Users\DELL\.qclab-license-issuer\license-private.pem`.
  Tệp nằm ngoài repository, chỉ dùng ở máy của bên cấp phần mềm.
- Khoá công khai: `app/main/licensing/public-key.json`, được đưa vào bản cài
  để xác minh mã. Khoá công khai không thể dùng để tự cấp mã.
- Dấu vân tay SHA-256 của khoá công khai:
  `170c3c9c3d2eaa49184377db2ab3b8ceca39af661a785f9806e2c4376d473c00`.

Sao lưu khoá bí mật ở nơi riêng có kiểm soát truy cập. Không gửi khoá này cho
khách hàng hoặc đưa lên GitHub. Giữ nguyên khoá công khai khi phát hành các
bản cập nhật: thay khoá sẽ làm các mã đã cấp bằng cặp khoá cũ mất hiệu lực.

Kiểm tra cấu hình công khai trước khi đóng gói:

```powershell
npm run license:check
```

`npm run license:keygen -- --private-key <đường-dẫn-ngoài-repo>` chỉ dành cho
dự án chưa có cặp khoá. Công cụ từ chối ghi đè khoá đã có; dự án này không
cần chạy lại bước tạo khoá.

## 2. Cấp mã cho khách hàng

### Công cụ có giao diện

Mở `dist-issuer/QC-Lab-Cap-Key-1.1.0.exe` bằng cách nhấp đúp hoặc dùng lối
tắt **QC Lab - Cấp key** trên Desktop. Đây là công cụ của bên phát hành,
không phải một trang trong QC Lab và không cần cài Node.js trên máy sử dụng.

1. Công cụ tự nhận khoá tại đường dẫn ở mục 1. Nếu báo chưa sẵn sàng, bấm
   **Chọn khoá…** và chọn `license-private.pem` đã sao lưu. Công cụ chỉ nhận
   khoá khớp khoá công khai của QC Lab; không tạo hoặc thay cặp khoá.
2. Dán **Mã máy** khách hàng gửi và nhập **Tên đơn vị sử dụng**.
3. Giữ **Vĩnh viễn** hoặc bỏ chọn để đặt **Ngày hết hạn**.
4. Bấm **Tạo mã kích hoạt**, sau đó **Sao chép mã** hoặc **Lưu tệp .txt**.
   Chỉ gửi mã/tệp `.txt` cho khách hàng.

Sửa thông tin sẽ bỏ kết quả cũ để không gửi nhầm key. Công cụ nhớ đường dẫn
khoá cho lần mở sau, không lưu nội dung khoá hoặc lịch sử key vào profile.
Khoá bí mật luôn ở tệp riêng, không được nhúng vào EXE công cụ.

Giao diện dùng trực tiếp hệ thống của app chính: panel, field, nút, bảng và
focus từ `app.css`/`tokens.css`; ô ngày dùng `DateField` và `DatePickerPopup`
tiếng Việt, nhập `dd/mm/yyyy`, tuần bắt đầu Thứ Hai. Enter trong ô ngày chỉ
chốt ngày; Esc đóng lịch. Không dùng bộ chọn ngày mặc định của Windows.

Lệnh dành cho người phát triển:

```powershell
npm run license:gui    # mở giao diện từ mã nguồn
npm run license:dist   # tạo EXE portable riêng, không phát hành lên GitHub
```

Mã nguồn ở `app/license-issuer/`, hợp đồng preload ở
`app/shared/qc-api.d.ts`. Bộ đóng gói chỉ lấy các tệp được cho phép cùng khoá
công khai, dùng thư mục tạm `.cache/license-issuer/`. Không đưa
`dist-issuer/` hoặc khoá bí mật vào bộ cài QC Lab gửi khách hàng.

### Cấp mã bằng dòng lệnh

1. Khách hàng mở bản cài và gửi **Mã máy** ở màn hình kích hoạt.
2. Bên cấp có thể chạy lệnh dưới đây trong thư mục dự án. Thay mã ví dụ bằng mã máy
   thực tế và thay tên đơn vị.
3. Gửi riêng nội dung tệp mã kích hoạt cho khách hàng. Khách hàng dán vào
   màn hình kích hoạt, sau đó đăng nhập hoặc tạo quản trị nếu là máy mới.

```powershell
npm run license:issue -- --private-key "C:\Users\DELL\.qclab-license-issuer\license-private.pem" --machine "QC-01234567-89ABCDEF-01234567-89ABCDEF" --customer "Phòng xét nghiệm A" --out "$env:USERPROFILE\Desktop\ma-kich-hoat.txt"
```

Mặc định mã có thời hạn **vĩnh viễn**. Để cấp đến hết một ngày theo giờ Việt
Nam, thêm `--expires 2027-12-31`. Công cụ từ chối ngày đã qua, khoá không
khớp và tệp đầu ra đã tồn tại. Không truyền `--out` thì mã được in ra màn hình.

Mã máy được băm từ định danh cài đặt Windows (MachineGuid), không phụ thuộc
thư mục cài ứng dụng. Đổi máy hoặc cài lại Windows có thể cần cấp mã mới.
Đây là cấp phép offline; không có máy chủ thu hồi mã trực tuyến. Thời hạn
được đối chiếu với đồng hồ máy tính.

Chữ ký, sản phẩm, mã máy và thời hạn đều được kiểm ở Electron main process.
Máy chính chưa kích hoạt hoặc hết hạn không được đăng nhập và thao tác
nghiệp vụ; cổng LAN cũng chặn truy cập nghiệp vụ tương ứng. Máy trạm LAN
dùng giấy phép của máy chính, không nhập mã riêng.

Không có thẻ kích hoạt trong Cài đặt. Máy đã kích hoạt hợp lệ vào ứng dụng
bình thường. Khi hết hạn, màn hình kích hoạt xuất hiện lại để nhập mã mới;
có thể đăng xuất phiên hiện tại ngay tại màn hình này. Mã mới không hợp lệ
không làm mất mã đang lưu.

Giấy phép là cấu hình riêng của máy: không đi theo dữ liệu đồng bộ đám mây;
phục hồi sao lưu giữ giấy phép hiện tại của máy nhận. Xoá dữ liệu vận hành
không xoá giấy phép. Không cần gửi tệp dữ liệu QC để cấp mã.

Hạn dùng hiện ở chân menu trái sau khi đăng nhập: ngày `dd/mm/yyyy` hoặc
**Vĩnh viễn**. Khi menu thu gọn, di chuột lên biểu tượng lịch để xem hạn.
Khi còn từ 7 ngày lịch Việt Nam trở xuống, có thông báo gia hạn dưới tiêu đề
trang; thông báo không chặn thao tác và không xuất hiện trong bản in. Hôm
cuối sẽ báo **hết hạn hôm nay**. Gia hạn thành công thì hạn dùng và thông báo
tự cập nhật. Máy trạm dùng cùng hạn của máy chủ. Bản xem trước/chế độ phát
triển không giả lập một giấy phép đã kích hoạt để hiển thị hạn dùng.

## 3. Cách cập nhật trong ứng dụng

Bản cài Windows đã kích hoạt kiểm tra GitHub sau khoảng 30 giây mở ứng dụng
và mỗi 6 giờ trong lúc chạy; lần kích hoạt thành công cũng kiểm tra ngay.
Khi có bản mới, ứng dụng **tự tải trong nền**, không cần vào Cài đặt hay bấm
kiểm tra. Tải xong hiện thông báo Windows với hai lựa chọn:
**Khởi động lại và cập nhật** hoặc **Để sau**. Quy trình hoạt động ở bản EXE
trên máy chính, không yêu cầu đăng nhập bằng tài khoản quản trị QC.

Trước khi cài, hãy lưu các biểu mẫu đang nhập và thông báo cho máy trạm LAN.
Sau xác nhận, ứng dụng tạo bản sao lưu SQLite theo định dạng phục hồi của
QC Lab tại `<userData>\before-update-<thời-điểm>.sqlite`, đẩy nốt thay đổi
đám mây, ghi nhật ký rồi đóng ứng dụng, cài bản mới ở chế độ im lặng và mở
lại QC Lab. Không chuẩn bị được sao lưu, đồng bộ hoặc nhật ký thì không
khởi chạy bộ cài. Máy trạm LAN sẽ tạm mất
kết nối trong lúc máy chính cập nhật.

Chọn **Để sau** thì tiếp tục làm việc; ứng dụng không tự đóng hoặc tự cài
khi thoát. Lần mở sau sẽ nhận lại bản đã tải từ bộ nhớ đệm và hỏi cập nhật.
Ứng dụng không nhận bản prerelease và không hạ phiên bản. Không đưa GitHub
token vào mã nguồn hoặc bộ cài; kho public cho phép máy khách đọc bản phát
hành công khai.

`npm run dev` và Electron chạy từ mã nguồn không yêu cầu kích hoạt, không
chạy bộ cập nhật; không thêm thẻ hoặc thao tác phần mềm vào trang Cài đặt.
Biến `QCLAB_REQUIRE_ACTIVATION=1` và `QCLAB_LICENSE_PUBLIC_KEY` phục vụ kiểm
thử Electron từ mã nguồn; bản đã đóng gói luôn yêu cầu kích hoạt và chỉ dùng
khoá công khai đi kèm, bỏ qua các biến ghi đè đó.

## 4. Phát hành bản mới

Bản **1.0.9 trở về trước chưa có bộ cập nhật**: khách hàng cần cài thủ công
bản 1.1.0 một lần và kích hoạt. Các bản tiếp theo có thể cập nhật trong app.
Giữ `appId` và đường dẫn dữ liệu hiện tại để tiếp tục dùng CSDL cũ.

Quy trình cho người quản lý repository:

1. Tăng phiên bản trong `package.json` và `package-lock.json`, ví dụ
   `npm version patch --no-git-tag-version` cho bản kế tiếp.
2. Chạy `npm run license:check` và `npm run verify-release`.
3. Commit mã nguồn, khoá **công khai**, lockfile và thay đổi phiên bản.
4. Tạo tag trùng phiên bản, ví dụ `v1.1.0` cho bản hiện tại, rồi đẩy commit
   và tag lên GitHub khi sẵn sàng phát hành.
5. Workflow `.github/workflows/release.yml` kiểm tra tag, chạy kiểm thử và
   đóng gói/phát hành bằng `GITHUB_TOKEN` của workflow. Đợi release công khai
   hoàn tất rồi kiểm tra các tệp đính kèm.

Bản phát hành cần có `QC-Lab-Setup-<version>.exe`, tệp `.exe.blockmap` và
`latest.yml` do electron-builder tạo. Không chỉ tải riêng bộ cài lên release
mà bỏ tệp metadata. Có thể dùng `npm run dist` để tạo bộ cài tại máy mà không
phát hành, hoặc `npm run dist:publish` với `GH_TOKEN` riêng khi chủ động
phát hành từ máy quản trị. Token cần quyền ghi nội dung vào repository đích.

Cấu hình đang dùng `electron-updater` 6.x với NSIS và GitHub provider. Tham
khảo [tài liệu cập nhật của electron-builder](https://www.electron.build/docs/features/auto-update/);
đối chiếu API của phiên bản đã khoá trong dự án khi nâng thư viện.
Chữ ký Ed25519 cho mã kích hoạt độc lập với chứng thư ký bộ cài Windows;
dự án chưa cấu hình chứng thư ký Windows.

## 5. Kiểm chứng

- Unit/integration: chữ ký sai, sai máy, hết hạn, quyền mới nhất của người
  dùng, rollback khi ghi nhật ký lỗi, giữ giấy phép khi phục hồi và loại khỏi
  gói đám mây; LAN chặn đăng nhập khi chưa kích hoạt.
- Bộ cập nhật được kiểm qua port giả: tự tải sau khi phát hiện, không tự cài,
  trạng thái và lỗi mạng, quyền quản trị, thứ tự sao lưu → nhật ký → mở bộ cài, không cài khi
  chuẩn bị thất bại.
- Electron thật: nhập mã sai máy, kích hoạt bằng mã ký hợp lệ, tạo quản trị,
  đăng nhập, nạp lại vẫn giữ kích hoạt; Cài đặt không có hai thẻ phần mềm.

Chạy `npm run verify-release` để kiểm tra toàn bộ. Việc nâng cấp trực tiếp
qua GitHub tới một phiên bản cao hơn cần thêm bản phát hành công khai kế
tiếp; kiểm thử tại máy không thay thế bước nghiệm thu đó.

### Kết quả bản 1.1.0 ngày 10/11/2026

- `npm run verify-release`: đạt typecheck, lint, 673 unit/integration test,
  CSS parity, build và 36 test Electron end-to-end.
- `npm run dist`: tạo `dist/QC-Lab-Setup-1.1.0.exe` (122.865.524 byte),
  `.exe.blockmap` và `latest.yml`; chưa phát hành lên GitHub.
- Chạy trực tiếp `dist/win-unpacked/QC Lab.exe` với profile tạm: chưa có
  giấy phép bị chặn; mã do công cụ cấp ký bằng cặp khoá thật được nhận.
  Biến môi trường không tắt được kích hoạt hoặc thay khoá của bản đóng gói.
- Đối chiếu gói ASAR: có khoá công khai và electron-updater, không có khoá
  bí mật/công cụ cấp mã; main trùng bản đã build, tự tải được bật và cài im
  lặng sau xác nhận. `app-update.yml` trỏ đúng `bosunrang/qc-lab`; SHA-512
  bộ cài khớp `latest.yml`. Bản cài Windows chưa có chữ ký Authenticode.

### Công cụ cấp key có giao diện ngày 11/11/2026

- `npm test`: 676/676 đạt; typecheck (bao gồm JS của công cụ), lint và build đạt.
- Hai bài Electron chạy riêng đạt: công cụ GUI (chọn khoá, nhập sai, tạo mã
  vĩnh viễn/có hạn, sao chép, lưu và chống ghi đè, đổi dữ liệu bỏ mã cũ,
  mở lại nhớ đường dẫn khoá) và quy trình kích hoạt của app QC Lab.
- Tạo EXE portable `dist-issuer/QC-Lab-Cap-Key-1.1.0.exe`, 90.500.879 byte.
  Khởi chạy bản portable thành công, đã tạo lối tắt Desktop **QC Lab - Cấp key**.
- Chạy bản đóng gói thật: tự nhận khoá hiện có, tạo chữ ký được bộ xác minh
  QC Lab chấp nhận. ASAR khớp mã nguồn, không chứa khoá bí mật, CSDL QC hoặc
  thư viện nghiệp vụ của app khách hàng. Không phát hành công cụ lên GitHub.

### Đồng bộ giao diện công cụ với app chính ngày 11/11/2026

- Thay renderer tự dựng bằng React; bundle trực tiếp `tokens.css`, `app.css`,
  `DateField`, `DatePickerPopup` và ngăn xếp Esc của app chính. CSS riêng chỉ
  xếp bố cục, không định nghĩa lại nút, panel, ô nhập hoặc focus.
- Ngày hiển thị `dd/mm/yyyy`; lịch tiếng Việt bắt đầu Thứ Hai. Kiểm tra trên
  Electron cả gõ tay, Enter chốt ngày không gửi form, chọn trên lịch và Esc.
  Chiều cao control và vòng focus bàn phím khớp token chung.
- Typecheck, lint, 676 unit/integration test, CSS parity và build đạt. Test
  GUI Electron đạt; bản đóng gói thật mở lịch chuẩn và ký mã hợp lệ.
- Đóng gói lại `dist-issuer/QC-Lab-Cap-Key-1.1.0.exe` (90.538.043 byte),
  dùng tiếp lối tắt Desktop hiện có. Không đổi khoá hoặc giao thức cấp phép.

### Chỉnh màn hình nhập mã trong app ngày 11/11/2026

- Dùng nhận diện `AuthBrand` từ cấu hình và khung auth chung. Tiêu đề kích
  hoạt có cấp bậc rõ ràng; bỏ thẻ thông báo trạng thái chưa kích hoạt lặp
  lại, chỉ hiện cảnh báo với giấy phép lỗi/hết hạn.
- Khung theo cỡ chuẩn 600px, co theo viewport và cuộn được ở cửa sổ thấp.
  Mã máy có nút sao chép; ô key có nhãn, hướng dẫn, trạng thái lỗi và focus
  chung. Các control không định nghĩa lại màu, chiều cao hoặc vòng focus.
- Typecheck, lint, 676 test, CSS parity và build đạt; Electron xác minh
  khởi tạo/đăng nhập và kích hoạt, sao chép, thứ tự Tab cùng cửa sổ 1024×700.
- Bộ cài `dist/QC-Lab-Setup-1.1.0.exe` đã tạo lại (122.865.794 byte).
  Bản đóng gói thật hiện đúng giao diện, vẫn bắt buộc kích hoạt; SHA-512
  khớp `latest.yml`. Ảnh xem trước: `dist/activation-preview.png`.

### Hiển thị hạn dùng và nhắc gia hạn ngày 11/11/2026

- Chân menu hiển thị hạn theo giấy phép đã xác minh; menu thu gọn vẫn có
  biểu tượng lịch với nhãn truy cập và tooltip. Chế độ phát triển không tự
  hiện giấy phép vĩnh viễn.
- Nhắc từ 7 ngày lịch Việt Nam trở xuống dưới tiêu đề mỗi trang, hôm cuối
  báo hết hạn hôm nay. Gia hạn cập nhật ngay theo thông báo `app_meta`, sau
  đó tiếp tục kiểm tra mỗi phút bằng luồng trạng thái có sẵn.
- 679 test, typecheck, lint, CSS parity và build đạt. Electron kiểm tra mở
  các trang, vĩnh viễn, biên 8/7 ngày, máy trạm, thu menu, gia hạn và không
  đưa thông báo gia hạn vào bản in. Không thêm cổng IPC hoặc thao tác ghi.
- Đã đóng gói lại bộ cài 1.1.0; mã trong ASAR khớp bản build và SHA-512
  bộ cài khớp `latest.yml`. Ảnh xem trước: `dist/license-expiry-preview.png`.
