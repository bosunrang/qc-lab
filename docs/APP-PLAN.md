# QC Lab — hiện trạng và nguyên tắc phát triển

## 1. Mục đích

QC Lab là ứng dụng desktop phục vụ nội kiểm xét nghiệm: cấu hình danh mục,
nhập điểm QC, đánh giá Westgard, theo dõi Six Sigma, quản lý sai lệch và lập
báo cáo. Tài liệu này mô tả **ứng dụng hiện tại** và là căn cứ chung khi mở
rộng hoặc chỉnh sửa mã nguồn.

## 2. Kiến trúc đang dùng

- Mã nguồn sản phẩm chỉ nằm trong `app/`.
- Electron là lớp desktop; React renderer dùng `HashRouter`; SQLite chạy ở
  main process.
- Hợp đồng IPC tập trung tại `app/shared/qc-api.d.ts`. Dữ liệu đọc từ SQLite
  giữ `snake_case`; dữ liệu nháp biểu mẫu dùng `camelCase`.
- Bản xem trước chạy bằng Vite và sql.js/WASM. Bản Electron dùng `node:sqlite`.
- Renderer chỉ gọi API đã công bố qua preload; không tự thực hiện SQL hoặc
  lặp lại nghiệp vụ của main process.

## 3. Nguyên tắc dữ liệu và nghiệp vụ

- Mỗi cổng ghi IPC thực hiện theo thứ tự: kiểm tra quyền, kiểm tra dữ liệu
  thuần, transaction, `writeAudit()`, rồi `notifyChanged()`.
- Không xoá cứng điểm QC. Khi cần loại bỏ, dùng quy trình huỷ điểm hiện có để
  giữ dấu vết, lý do và liên kết khắc phục sai lệch.
- Kỳ đã khoá không được sửa dữ liệu QC liên quan. Mọi thay đổi có ảnh hưởng
  đánh giá phải tôn trọng cổng khoá kỳ.
- Danh mục xét nghiệm, máy, lô QC và mức QC là nguồn dữ liệu chung. Các trang
  Nhập QC, Westgard, Six Sigma và Báo cáo không tự tạo danh mục theo dõi riêng.
- Kết luận Westgard, Sigma, TEa, Bias, CV và độ không đảm bảo đo phải do main
  process tính hoặc xác thực; renderer chỉ trình bày kết quả.

## 4. Giao diện và báo cáo

- Ứng dụng được tối ưu cho desktop. Màu sắc, kích thước, khoảng cách, tiêu đề
  và control sử dụng token trong `app/renderer/styles/`.
- Khi sửa giao diện, ưu tiên component và token dùng chung thay vì thêm giá trị
  cục bộ. Giữ các thao tác nguy hiểm có xác nhận rõ ràng.
- Báo cáo Excel và PDF lấy dữ liệu tại thời điểm xuất. Tiêu đề đơn vị, địa chỉ,
  biểu mẫu và thông tin ký duyệt lấy từ phần cài đặt hiện hành.
- Báo cáo theo kỳ chỉ biểu diễn dữ liệu của kỳ được chọn; báo cáo nhiều kỳ chỉ
  dùng khi người dùng yêu cầu phạm vi tổng hợp.

## 5. Các khu vực nghiệp vụ

| Khu vực | Trách nhiệm chính |
| --- | --- |
| Cấu hình chung | Máy, xét nghiệm, panel, lô, Mean/SD, TEa và quyền cấu hình |
| Nhập QC | Ghi điểm, theo dõi lần chạy, ghi chú, huỷ điểm và dải vận hành |
| Phân tích Westgard | Đánh giá luật, cảnh báo, lịch sử lô và biểu đồ |
| Six Sigma & Sai số | Kỳ đánh giá, TEa, CV/Bias, MU, OPSpecs và xuất báo cáo |
| Khắc phục sự cố | Hồ sơ sai lệch, nguyên nhân, hành động và phê duyệt |
| Báo cáo & Biểu mẫu | Báo cáo dữ liệu, báo cáo Sigma, PDF/Excel và mẫu biểu |
| Cài đặt & Đám mây | Hồ sơ đơn vị, sao lưu, đồng bộ và cấu hình tích hợp |

## 6. Kiểm chứng thay đổi

Với thay đổi mã nguồn, chạy đầy đủ:

```powershell
npm test
npm run typecheck
npm run build
```

Khi cần đo khả năng xử lý dữ liệu lớn, chạy riêng bài đo 500.000 điểm QC để
không làm chậm hồi quy thường ngày:

```powershell
npm run test:performance
```

Các quyết định nghiệp vụ chuyên sâu của Westgard và Six Sigma được ghi trong
`docs/WESTGARD-REVIEW-*.md` và `docs/SIGMA-REVIEW-*.md`. Phải đọc tài liệu
phù hợp trước khi thay đổi logic của hai khu vực này, đồng thời cập nhật kiểm
thử hồi quy khi thay đổi quyết định nghiệp vụ.

## 7. Quy ước mã nguồn

- Chú thích giải thích mã viết bằng tiếng Việt có đầy đủ dấu.
- Giữ nguyên tên định danh, SQL, tên trường IPC và chuỗi máy đọc để tránh làm
  sai giao thức.
- Không thêm mã mô phỏng hoặc đường lui chuyển đổi dữ liệu vào sản phẩm nếu
  không có yêu cầu nghiệp vụ rõ ràng.
