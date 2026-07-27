# Triển khai Firebase Rules cho QC Lab

Nguồn chuẩn duy nhất là `database.rules.json` trong thư mục này. Nội dung mà
trang Cài đặt của QC Lab hiển thị phải giống file này; test
`tests/firebase-rules.test.js` sẽ chặn commit nếu hai bản lệch nhau.

## Quy trình

1. Bật Firebase Authentication bằng Email/Password và tắt Anonymous.
2. Tạo một tài khoản Firebase riêng cho mỗi người hoặc thiết bị được phép đồng bộ.
3. Trong Realtime Database, tạo ACL theo quyền:

   ```text
   qclab-acl
     MA_PHONG_XN
       UID_QUAN_TRI
         read: true
         write: true
         admin: true
       UID_NHAP_LIEU
         read: true
         write: true
         admin: false
       UID_CHI_XEM
         read: true
         write: false
         admin: false
   ```

   Thay `MA_PHONG_XN` bằng đúng mã phòng đơn vị nhập trong app. Phải có ít nhất
   một UID `admin: true` trước khi publish rules mới. ACL cũ
   dạng `{uid}: true` vẫn được đọc/ghi dữ liệu nghiệp vụ để chuyển tiếp an toàn,
   nhưng không còn được sửa nhánh `users`.
4. Publish nguyên file `database.rules.json`.
5. Kết nối ứng dụng bằng đúng `labCode`, email và mật khẩu Firebase.

- `read: true`: đọc snapshot của phòng.
- `write: true`: ghi các nhánh nghiệp vụ và chỉ thêm dòng audit mới.
- `admin: true`: bao gồm quyền đọc/ghi, đồng thời được thay đổi nhánh `users`.

Vai trò admin/technician/viewer trong QC Lab vẫn là phân quyền giao diện phía
client. Cờ `admin` trong Firebase ACL là ranh giới máy chủ riêng; nên chỉ cấp cho
tài khoản Firebase của máy/người chịu trách nhiệm quản trị.

Nhánh `activity` được ghi theo từng chỉ số. Rules cho phép tạo dòng mới hoặc ghi
lại đúng giá trị cũ, nhưng từ chối sửa và xóa dòng đã tồn tại. Vì vậy phải dùng
phiên bản ứng dụng có `fbExpandProtectedUpdates()` trước khi publish rules này;
phiên bản cũ dùng `set()` toàn phòng sẽ bị từ chối.

## Kiểm tra sau triển khai

- UID `write: true` trong đúng `labCode`: đọc và ghi nghiệp vụ thành công.
- UID `read: true`, `write: false`: đọc được nhưng ghi bị từ chối.
- UID `admin: false`: thay đổi `users` bị từ chối.
- UID `admin: true`: thay đổi `users` thành công.
- UID không có trong ACL: cả đọc và ghi bị từ chối.
- UID của phòng A: không đọc hoặc ghi được phòng B.
- Thêm `activity/{index}` mới với hash 64 ký tự: thành công.
- Sửa hoặc xóa `activity/{index}` đã tồn tại: bị từ chối.
- Ghi snapshot thiếu `_ts` hoặc `_ts` không phải số: bị từ chối.
- Nhánh `qclab-acl` không thể sửa từ ứng dụng client.

Lưu ảnh/chứng cứ của các trường hợp trên cùng hồ sơ OQ của từng môi trường Firebase.
