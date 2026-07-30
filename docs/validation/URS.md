# User Requirement Specification

| ID | Yêu cầu | Tiêu chí chấp nhận |
|---|---|---|
| URS-01 | Quản lý xét nghiệm, máy, panel và lô QC | Danh mục tạo/sửa được theo quyền; quan hệ không mất sau restart |
| URS-02 | Ghi kết quả IQC theo ngày, lần chạy, mức và lô | Giá trị, Mean/SD snapshot, người nhập và run ID được lưu |
| URS-03 | Đánh giá Westgard | Luật cấu hình, luật liên mức và action alert/reject cho kết quả tái lập |
| URS-04 | Chạy song song khi chuyển lô | Lô song song không quyết định chấp nhận bệnh nhân; không gộp chuỗi hai lô |
| URS-05 | Levey–Jennings và CUSUM | Biểu đồ giữ điểm vi phạm và CUSUM không đổi verdict Westgard |
| URS-06 | Xử lý điểm sai | Không xóa vật lý; hủy cần lý do, người hủy và thời gian |
| URS-07 | CAPA/khắc phục | Có hành động, chạy lại QC, duyệt/trả lại và trạng thái khép vòng |
| URS-08 | Phê duyệt độc lập | Người tạo không tự duyệt; thao tác quan trọng yêu cầu nhập lại mật khẩu |
| URS-09 | Khóa kỳ báo cáo | Kỳ khóa chặn thêm/sửa/hủy cho tới khi admin mở bằng lý do và xác thực lại |
| URS-10 | Six Sigma | CV theo cohort một lô; Bias từ EQA/EQC; lưu snapshot nguồn TEa |
| URS-11 | So sánh lô hóa chất | Có Passing–Bablok, Deming/OLS, Bland–Altman và tiêu chí do người dùng xác nhận |
| URS-12 | Báo cáo | Excel/PDF có metadata, nguồn TEa, người xuất và dữ liệu khắc phục |
| URS-13 | Audit | Ghi loại thao tác, thời gian, tài khoản, vai trò và chuỗi hash kiểm tra sai lệch |
| URS-14 | Phân quyền | Viewer chỉ đọc; technician vận hành; admin cấu hình và duyệt |
| URS-15 | Lưu trữ cục bộ | IndexedDB phân vùng chịu được ghi gián đoạn và khôi phục slot trước |
| URS-16 | Backup/restore | Backup JSON tới 64 MB nhập lại được sau validate/sanitize/invariant check |
| URS-17 | Đồng bộ | Firebase yêu cầu UID có trong ACL đúng labCode; retry khi offline |
| URS-18 | Hiệu năng | Release gate đạt ngân sách trong `benchmarks/performance-budget.json` |
| URS-19 | Accessibility | Không tăng vi phạm so với ratchet; thao tác bàn phím có focus rõ |
| URS-20 | Desktop | Installer, activation, auto-update và print-to-PDF hoạt động trên Windows hỗ trợ |
| URS-21 | Độ không đảm bảo đo (MU) | Ngân sách top-down u(Rw)/u(bias)/u(cal), U=k·u_c với k=2; thành phần chưa đánh giá phải hiện là thiếu, không được coi bằng 0; có nguồn CoA, người rà soát và xuất ra báo cáo |

## Ngoài phạm vi

- Không phải LIS/HIS và không phát hành kết quả bệnh nhân.
- Không thay thế server-side identity hoặc chữ ký số chống chối bỏ.
- Audit hash phía client là tamper-evident trong snapshot, không phải kho append-only.
- Việc lựa chọn luật Westgard, TEa và tần suất QC vẫn phải theo SOP của đơn vị.
- Giới hạn MU cho phép (MAU) và quyết định coi độ chệch là "đã hiệu chỉnh" do đơn
  vị ấn định; phần mềm tính và trình bày ngân sách chứ không kết luận đạt/không đạt.
