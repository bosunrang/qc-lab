# Diễn tập backup và restore

Tần suất đề xuất: trước go-live, sau mỗi thay đổi schema, và ít nhất mỗi quý.

## Chuẩn bị

- Dùng dữ liệu giả hoặc bản sao đã khử định danh.
- Ghi version app, máy nguồn, máy đích, kích thước và SHA-256 backup.
- Chuẩn bị ít nhất: 2 xét nghiệm, 2 lô, 3 mức, điểm đã hủy, CAPA đã duyệt,
  một kỳ khóa, Sigma và reagent comparison.

## Thực hiện

1. Chụp số lượng tests, points, actions, activity, periodLocks và sigma periods.
2. Xuất backup JSON; xác nhận file không rỗng và tính SHA-256.
3. Đóng app, sao chép file sang máy/profile thử nghiệm sạch.
4. Cài cùng phiên bản hoặc phiên bản mới hơn đã hỗ trợ schema.
5. Đăng nhập admin, chọn Nhập backup và xác nhận backup an toàn trước nhập.
6. Sau import, đối chiếu các số lượng ở bước 1.
7. Mở ít nhất một biểu đồ Westgard, Sigma và báo cáo; xuất PDF/Excel.
8. Kiểm tra điểm đã hủy, CAPA, period lock, lot transition và audit import.
9. Restart app; xác nhận dữ liệu vẫn còn.
10. Nếu dùng Firebase, kết nối vào phòng thử nghiệm riêng và xác nhận sync.

## Tiêu chí pass

- Import không báo lỗi với file ≤64 MB.
- 100% số lượng và khóa định danh nghiệp vụ đối chiếu đúng.
- Mean/SD snapshot, lot, void status và approval status không đổi.
- Báo cáo tạo được và release gate không fail.
- Không ghi đè dữ liệu môi trường thật.

## Biên bản

| Trường | Giá trị |
|---|---|
| Ngày/giờ | |
| App nguồn/đích | |
| Máy nguồn/đích | |
| Kích thước backup | |
| SHA-256 | |
| Kết quả đối chiếu | |
| Deviation | |
| Người thực hiện | |
| Người kiểm tra | |
| Phê duyệt | |

Nếu fail: giữ nguyên backup, export dữ liệu thô của máy đích, không tiếp tục ghi dữ
liệu và mở deviation trước khi thử lại.
