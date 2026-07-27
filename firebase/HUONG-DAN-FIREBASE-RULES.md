# Triển khai Firebase Rules cho QC Lab

Nguồn chuẩn duy nhất là `database.rules.json` trong thư mục này. Nội dung mà
trang Cài đặt của QC Lab hiển thị phải giống file này; test
`tests/firebase-rules.test.js` sẽ chặn commit nếu hai bản lệch nhau.

## Quy trình

1. Bật Firebase Authentication bằng Email/Password và tắt Anonymous.
2. Tạo một tài khoản Firebase riêng cho mỗi người hoặc thiết bị được phép đồng bộ.
3. Trong Realtime Database, thêm UID vào:
   `qclab-acl/{labCode}/{uid}: true`.
4. Publish nguyên file `database.rules.json`.
5. Kết nối ứng dụng bằng đúng `labCode`, email và mật khẩu Firebase.

Mọi UID có mặt trong ACL của một phòng hiện có quyền đọc và ghi toàn bộ snapshot
của phòng đó. Vai trò admin/technician/viewer trong QC Lab là phân quyền giao diện
phía client, không thay thế Firebase ACL. Khi cần phân quyền ghi ở mức server, phải
thiết kế schema cloud và custom claims riêng trước khi thay đổi rules.

## Kiểm tra sau triển khai

- UID có trong đúng `labCode`: đọc và ghi `qclab-shared/{labCode}` thành công.
- UID không có trong ACL: cả đọc và ghi bị từ chối.
- UID của phòng A: không đọc hoặc ghi được phòng B.
- Ghi snapshot thiếu `_ts` hoặc `_ts` không phải số: bị từ chối.
- Nhánh `qclab-acl` không thể sửa từ ứng dụng client.

Lưu ảnh/chứng cứ của năm trường hợp trên cùng hồ sơ OQ của từng môi trường Firebase.
