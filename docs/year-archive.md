# Lưu trữ dữ liệu QC theo năm

## Hợp đồng hiện tại

- Archive năm là gói `qclab-backup` phiên bản 1, `type: year-archive`.
- Gói có năm, thời điểm tạo, phiên bản app/schema và SHA-256 của payload JSON.
- Payload giữ cấu hình xét nghiệm, thiết bị, panel và lô để đọc ngữ cảnh; chỉ giữ
  điểm QC, Sigma, so sánh hóa chất, NCE và audit thuộc năm đã chọn.
- `users` luôn rỗng để archive không mang hash mật khẩu.
- Nút **Kiểm tra backup / archive** xác minh checksum, schema, invariant, số điểm
  và khoảng ngày nhưng không gán vào `state`.
- Nút **Nhập backup** từ chối `year-archive`; archive không được phép vô tình
  thay thế dữ liệu đang vận hành.
- Sau khi người dùng chọn lại archive và SHA-256 hợp lệ, app ghi metadata vào
  `state.archiveRegistry` (schema 6) và đồng bộ Firebase. ID được suy ra từ
  `year + checksum`, nên hai máy xác minh cùng file không tạo bản ghi trùng.
- Registry giữ tên file, checksum, dung lượng, số điểm, khoảng ngày, người/thời
  điểm xác minh và số điểm theo xét nghiệm; không tải payload archive lên cloud.
- Cài đặt có trình xem registry chỉ đọc. Hồ sơ NCE mất điểm gốc trong state sẽ
  hiển thị bằng chứng archive cùng checksum nếu năm sự cố đã có registry.
- Xuất archive không xóa dữ liệu. Đây là chủ ý an toàn, không phải phần việc còn
  thiếu của nút xuất.

## Dọn dữ liệu đã lưu trữ

Nút **Chọn archive để dọn** chỉ mở đường dọn khi đáp ứng đủ các điều kiện sau:

1. Người dùng chọn lại chính file archive; app xác minh SHA-256 và đối chiếu mọi
   điểm hiện có của năm đó theo test/id/nội dung, không chỉ đối chiếu số lượng.
2. `PeriodService.lockedPoints()` trả về 0. Nếu có kỳ khóa, phải mở khóa bằng lý
   do và audit trước; archive không được đi xuyên qua khóa kỳ.
3. Mọi NCE tham chiếu điểm sắp dọn đã khép hoặc đã hủy đúng quy trình. NCE đang mở
   luôn chặn thao tác để không làm mất bằng chứng gốc giữa quy trình.
4. File phải có bản ghi cùng `year + checksum` trong `archiveRegistry`; một file
   mới tải về nhưng chưa được chọn lại và xác minh không đủ điều kiện.

Đường dọn tạo backup đầy đủ trước thay đổi, xác nhận hai bước, rồi chạy lại toàn bộ
đối chiếu/khóa kỳ/NCE ngay trước mutation để tránh thay đổi đồng thời trong lúc hộp
thoại đang mở. Nó chỉ xóa điểm QC của đúng năm; Sigma, NCE, audit và cấu hình vẫn
được giữ. Sau đó app gọi `save({testIds})`, ghi audit kèm checksum, lưu
`cleanedAt/cleanedBy/removedPoints` vào registry và chạy invariant. Nếu invariant
không đạt, mảng điểm và metadata registry được rollback trước khi báo lỗi. Hủy ở
bất kỳ bước nào không tạo mutation.

## Lý do không xóa tự động sau khi xuất

Một file tải xuống bằng browser có thể bị người dùng hủy lưu dù `a.click()` đã
thành công. Ngoài ra, xóa điểm nhưng giữ NCE sẽ làm `actionPoint()` mất bằng
chứng gốc; xóa cả NCE lại phá traceability ISO 15189. Vì vậy “đã phát lệnh tải
file” không đủ làm bằng chứng cho thao tác phá hủy.
