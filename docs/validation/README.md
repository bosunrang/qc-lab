# Hồ sơ validation QC Lab

Áp dụng cho QC Lab 2.5.0 và các bản kế tiếp cho tới khi một thay đổi được đánh giá
là cần tái validation. Đây là bộ protocol kiểm soát; một đơn vị chỉ được tuyên bố
validation sau khi đã thực thi, lưu bằng chứng và ký duyệt tại môi trường thật.

| Tài liệu | Mục đích |
|---|---|
| `URS.md` | Yêu cầu người dùng và tiêu chí chấp nhận |
| `RISK-ASSESSMENT.md` | Rủi ro dữ liệu, kết quả QC và biện pháp kiểm soát |
| `TRACEABILITY.md` | Ánh xạ yêu cầu → code/test/bằng chứng |
| `IQ-OQ-PQ-UAT.md` | Protocol cài đặt, vận hành, hiệu năng và nghiệm thu |
| `BACKUP-RESTORE-DRILL.md` | Quy trình diễn tập phục hồi và biên bản thực hiện |
| `RELEASE-PUBLISH.md` | Phát hành bản desktop lên GitHub Releases và kiểm tra auto-update |

## Kiểm soát tài liệu

- Chủ sở hữu nghiệp vụ: Phụ trách phòng xét nghiệm.
- Chủ sở hữu kỹ thuật: Người quản trị QC Lab.
- Phiên bản app, Node/Electron, Windows và Firebase project phải được ghi trong
  biên bản thực thi.
- Screenshot, PDF, JSON report, log CI và hash SHA-256 của installer/backup phải
  được lưu cùng hồ sơ.
- Bất kỳ lỗi critical/high chưa xử lý, test release gate fail, hoặc restore drill
  fail đều chặn phát hành.
