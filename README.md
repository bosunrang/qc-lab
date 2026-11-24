# QC Lab

QC Lab là ứng dụng desktop quản lý nội kiểm chất lượng xét nghiệm (IQC) bằng
tiếng Việt: Westgard, Six Sigma, Levey–Jennings, CUSUM, so sánh lô thuốc thử,
hồ sơ khắc phục và audit trail.

Mã nguồn hiện hành là **app**: Electron hai tiến trình, React và SQLite.
Mã nguồn sản phẩm nằm trong thư mục `app/`.

## Phát triển

```powershell
npm install
npm run dev       # bản xem trước tại http://localhost:5174
npm start         # Electron thật, dùng SQLite trên đĩa
```

## Thử nhận QC từ LIS trên Electron

Phần nền Gateway có SQLite, API nhận QC chuẩn hoá, phân quyền token, ánh xạ,
nhật ký và sao lưu. Xem [hướng dẫn Gateway](docs/LIS-GATEWAY.md) để khởi tạo
và vận hành. Bộ kết nối theo tài liệu từng LIS sẽ được bổ sung riêng.

Chạy tại thư mục dự án:

```powershell
npm.cmd run lis:demo
```

Lệnh này build và mở Electron, tự tạo tài khoản, đăng nhập, tạo xét nghiệm
**Glucose LIS Demo** cùng hai mức/lô QC, bật Gateway giả lập tại
`http://127.0.0.1:8787` và mở **Hàng chờ QC từ LIS Gateway**.
Mỗi lần chạy tạo hồ sơ SQLite riêng trong `.cache/lis-demo-*`.
Tài khoản demo là `admin` / `lis-demo-123`.

- **Sẵn sàng nhận (3):** mức 1 giá trị 5.1, mức 2 giá trị 15.2 và mức 1
  giá trị 4.9 để thử Bỏ. Bấm Nhận rồi mở Nhập QC, chọn Glucose LIS Demo
  để kiểm tra điểm vừa nhận. Bấm Bỏ không tạo điểm QC.
- **Chưa khớp cấu hình (3):** sai đơn vị, sai lô và mã xét nghiệm chưa ánh
  xạ. Các bản tin này chỉ có nút Bỏ.
- Bấm **Làm mới** sau khi xử lý để kiểm tra hàng chờ; điểm đã nhận không
  được tạo lại.

Thử lỗi xác nhận một lần bằng `npm.cmd run lis:demo -- --fail-ack-once`:
sau khi Nhận, điểm đã lưu nhưng hiện cảnh báo. Đóng cảnh báo và bấm
Làm mới để xác nhận lại, vẫn chỉ có một điểm QC.

Ctrl+C trong terminal để thoát phiên demo và dừng Gateway. Chạy lại lệnh
để có bộ dữ liệu mới. Gateway giữ hàng chờ trong bộ nhớ và chỉ nghe loopback;
đây là dữ liệu giả lập, không kết nối LIS hoặc máy xét nghiệm thật.
Nếu cổng 8787 đã có tiến trình khác, lệnh báo lỗi và không thay thế tiến trình đó.

Để chạy riêng Gateway với xét nghiệm đã có:
`npm.cmd run lis:mock -- --test-id <ID-xét-nghiệm>`.
Gateway in Bearer token ra terminal; cần cấu hình xét nghiệm đơn vị `mmol/L`
và lô `LIS-DEMO-L1`/`LIS-DEMO-L2` tương ứng. Bản web ở cổng 5174 không
gọi Gateway; dùng Electron để thử kết nối.

Để thử cùng bộ dữ liệu mẫu trên Gateway SQLite thật, chạy
`npm.cmd run lis:demo -- --persistent`. Dữ liệu Gateway cũng nằm trong hồ sơ
demo riêng, đi qua API tiếp nhận HTTP có xác thực. Dừng demo trước khi chạy
các bài test Electron về Gateway vì các phiên này đều dùng cổng 8787.

## Kiểm tra và đóng gói

```powershell
npm test
npm run typecheck
npm run build
npm run verify-release
npm run dist
```

`npm run dist:publish` phát hành installer Windows lên GitHub Releases và cần
biến môi trường `GH_TOKEN` có quyền ghi nội dung vào repository đích. Không
ghi token vào repository.

Từ 1.1.0, bản cài yêu cầu mã kích hoạt offline theo máy trước khi đăng nhập
hoặc khởi tạo tài khoản admin. Bản EXE tự nhận diện và tải bản mới từ GitHub
trong nền, sau đó hỏi khởi động lại để cập nhật. Xem
[hướng dẫn cấp mã và phát hành](docs/SOFTWARE-LICENSE-AND-UPDATES.md).
Bản chạy từ mã nguồn không yêu cầu kích hoạt và không tự cập nhật.

Công cụ cấp key có giao diện riêng cho bên phát hành: `npm run license:gui`
để mở, `npm run license:dist` để tạo EXE portable trong `dist-issuer/`.
Người sử dụng EXE chỉ cần nhập mã máy, tên đơn vị rồi bấm tạo key.

Dữ liệu được lưu trong SQLite ở thư mục user-data của ứng dụng; sử dụng
chức năng Sao lưu & phục hồi trước khi can thiệp dữ liệu.

Tài liệu trạng thái nằm tại [`docs/APP-PLAN.md`](docs/APP-PLAN.md). Các đợt rà
soát nghiệp vụ Westgard và Six Sigma cùng quyết định đã chốt nằm ở
`docs/WESTGARD-REVIEW-*.md` và `docs/SIGMA-REVIEW-*.md`.
