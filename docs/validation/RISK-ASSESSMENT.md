# Risk assessment

Thang điểm: Severity (S), Probability (P), Detectability (D), mỗi yếu tố 1–5.
RPN = S × P × D. RPN ≥40 phải có hành động trước go-live.

| ID | Nguy cơ | S/P/D | RPN | Kiểm soát |
|---|---|---:|---:|---|
| R-01 | Sai thuật toán Westgard | 5/2/2 | 20 | Pure core, test rule/worker/parallel lot, review nghiệp vụ |
| R-02 | Dùng Mean/SD sai lô | 5/2/2 | 20 | Snapshot theo điểm, target matrix, transition test, re-auth |
| R-03 | Gộp lô khi tính Sigma | 4/2/2 | 16 | Sigma cohort service và test single-lot |
| R-04 | Tự duyệt CAPA | 4/2/2 | 16 | `createdByUserId`, chặn self-approval, re-auth |
| R-05 | Sửa dữ liệu kỳ đã chốt | 5/2/2 | 20 | Period lock trong entry service, lý do mở khóa, re-auth |
| R-06 | Backup tạo được nhưng không restore | 5/2/2 | 20 | Giới hạn 64 MB, test round-trip 34+ MB, restore drill định kỳ |
| R-07 | Mất dữ liệu khi ghi gián đoạn | 5/2/2 | 20 | IndexedDB slot A/B, manifest atomic, storage tests |
| R-08 | Xung đột nhiều máy | 4/3/3 | 36 | 3-way merge theo phần tử, retry, offline/merge tests |
| R-09 | UID ngoài phòng truy cập cloud | 5/2/2 | 20 | Default deny, ACL theo labCode/UID, rules contract test |
| R-10 | Client bị sửa để vượt quyền | 5/2/4 | 40 | Chấp nhận giới hạn client-only; dùng máy quản lý, ACL server, kiểm soát OS |
| R-11 | Audit bị dựng lại | 4/2/4 | 32 | Công bố giới hạn; backup/hash; cân nhắc backend append-only |
| R-12 | Dependency desktop có CVE | 5/2/2 | 20 | Electron/builder được nâng; release gate chạy npm audit high |
| R-13 | Cold calculation làm treo UI | 3/2/2 | 12 | Cache theo test, worker, performance gate |
| R-14 | Báo cáo PDF sai layout | 3/2/2 | 12 | Visual/print check trên browser và Electron |
| R-15 | Đồng hồ máy sai | 4/3/3 | 36 | OQ kiểm tra NTP; SOP cấm chỉnh giờ; audit theo timestamp máy |

R-10 là rủi ro tồn dư đáng kể: trước khi dùng làm hồ sơ duy nhất, đơn vị phải quyết
định bổ sung backend identity/audit append-only hoặc chấp nhận bằng đánh giá rủi ro
có chữ ký.
