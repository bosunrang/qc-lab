# IQ–OQ–PQ và UAT

## IQ — Installation Qualification

- Ghi mã máy, Windows version, RAM, dung lượng đĩa và timezone.
- Xác minh SHA-256 installer so với bản phát hành được duyệt.
- Cài bằng user chuẩn; kiểm tra shortcut và thư mục userData.
- Xác nhận version hiển thị trùng `package.json` và `QCLAB_APP`.
- Xác nhận `contextIsolation=true`, `nodeIntegration=false`.
- Nếu dùng cloud: ghi Firebase project, labCode và UID đã cấp.

## OQ — Operational Qualification

Thực thi với dữ liệu giả:

1. Tạo admin, technician, viewer; xác nhận quyền từng trang và quyền ghi.
2. Tạo máy, panel, ba mức QC và hai lô.
3. Nhập chuỗi điểm kích hoạt 1-2s, 1-3s, 2-2s, R4s và luật chuỗi.
4. Hủy một điểm; kiểm tra lý do, audit và yêu cầu QC chạy lại.
5. Technician ghi CAPA; cùng tài khoản không được duyệt; admin khác duyệt sau re-auth.
6. Chạy song song hai lô; xác nhận lô mới không thay verdict vận hành.
7. Khóa kỳ; thử thêm/sửa/hủy; mở khóa bằng lý do và re-auth.
8. Tạo Sigma với IQC single-lot và nhiều vòng EQA; kiểm tra RMS Bias.
9. Xuất/đọc lại Excel và PDF.
10. Chạy toàn bộ lệnh trong traceability matrix.

## PQ — Performance Qualification

- Nạp dữ liệu tương đương hoặc lớn hơn 24 tháng vận hành dự kiến.
- `npm run verify-release` phải pass.
- Mở dashboard, entry, Westgard, Sigma và report; không có thao tác thường xuyên
  nào khóa UI quá tiêu chí nội bộ đã phê duyệt.
- Mô phỏng mất mạng và hai máy nhập khác điểm; dữ liệu phải hội tụ.
- Thực hiện restore drill theo tài liệu riêng.

## UAT

Tối thiểu có một KTV, một quản trị và một người phụ trách khoa:

| Kịch bản | Người thực hiện | Pass/Fail | Bằng chứng |
|---|---|---|---|
| Nhập QC và đọc verdict | KTV | | |
| Xử lý vi phạm và chạy lại | KTV | | |
| Duyệt độc lập CAPA | Phụ trách | | |
| Chuyển lô và Mean/SD | Quản trị + phụ trách | | |
| Khóa kỳ và xuất báo cáo | Phụ trách | | |
| Backup và restore | Quản trị | | |
| Mất mạng/đồng bộ lại | Quản trị | | |

Go-live chỉ khi mọi dòng pass, deviation đã đóng và ba vai trò ký biên bản.
