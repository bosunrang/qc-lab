# Lưu trữ dữ liệu QC theo năm

## Hợp đồng hiện tại

- Archive năm là gói `qclab-backup` phiên bản 1, `type: year-archive`.
- Gói có năm, thời điểm tạo, phiên bản app/schema và SHA-256 của payload JSON.
- Payload giữ cấu hình xét nghiệm, thiết bị, panel và lô để đọc ngữ cảnh; chỉ giữ
  điểm QC, Sigma, so sánh hóa chất, NCE và audit thuộc năm đã chọn.
- `users` luôn rỗng để archive không mang hash mật khẩu, và `activityAnchor` bị xóa
  chứ không thừa kế từ log sống — neo đó thuộc về một lát audit khác, giữ lại thì
  `auditVerifyChain()` chạy trên archive báo "audit bị sửa" giả.
- `BACKUP_IMPORT_MAX_BYTES` (128 MB) là **ngưỡng khuyến nghị, không phải rào chặn**:
  mọi đường xuất/nhập chỉ hỏi xác nhận khi vượt, còn `backupCurrentData()` không có
  rào nào. Trước 2026-08-01 nó chặn cứng cả ba đường cùng lúc nên vượt trần là không
  xuất được, không nhập được, không reset được.
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

## Dọn dữ liệu đã lưu trữ — CHƯA BẬT (2026-08-01)

`cleanupYearFromArchive()` và toàn bộ guard của nó vẫn nằm trong
`backup-service.js` và vẫn được `tests/archive-cleanup.test.js` chốt, nhưng
**không nút nào trong Cài đặt gọi tới**. Xuất archive năm đã đủ làm hồ sơ lưu trữ
theo ISO 15189; nửa phá hủy chưa được bật vì hai lý do:

- **Chưa cần theo số đo.** Phòng 20 XN × 2 mức × 2 năm mới 29.200 điểm / 4,2 MB;
  10 năm cực đoan (50 XN × 3 mức) là 547.500 điểm / 78,2 MB, vẫn dưới trần
  import 128 MB. Điểm QC không còn nằm ở `localStorage` (partitioned save ghi
  shell rồi `removeItem('qclab')`, dữ liệu ở IndexedDB) nên trần 5–10 MB không
  phải nút thắt. Cái duy nhất vượt ngân sách là cold domain 14.008 ms so với
  12.000 ms — một lần lạnh mỗi lần boot, phần lớn là Westgard vốn đã đẩy sang
  worker, còn warm là 0,77 ms.
- **Hai lỗi chặn còn mở.** Chi tiết và hướng sửa nằm trong khối chú thích ngay
  trên `archiveCleanupOpenNces()`: (1) `fbMergeDataBranch()` không hỗ trợ xóa
  từng điểm nên Firebase hồi sinh dữ liệu vừa dọn, trong khi `registry.cleanedAt`
  đã ghi khiến không dọn lại được; (2) guard NCE bỏ sót hồ sơ dùng điểm QC chạy
  lại thuộc năm bị dọn, làm hồ sơ đã khép tự mở lại.

Khi bật lại, đường dọn chỉ được mở khi đáp ứng đủ các điều kiện sau:

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
