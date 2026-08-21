# Báo cáo phân loại global bridge (Lát 0, tự động — 2026-08-21, lượt 3 — sau khi sửa 2 lỗi phát hiện qua lấy mẫu tay)

Tổng số `root.X=` trong `src/compat/modular-pilot.global.ts`: **1480**

| Nhóm | Số lượng | Ý nghĩa |
| --- | --- | --- |
| KEEP-ACTION | 200 | data-action-family (literal hoặc object-form) trong HTML/TS hoặc index.html |
| KEEP-TEST-REFERENCED | 936 | xuất hiện ở ít nhất 1 file tests/*.test.js (override sau nạp HOẶC chỉ được assert tồn tại, ví dụ typescript-module-pilot.test.js) |
| KEEP-SELF-REFERENCED | 344 | được chính modular-pilot.global.ts đọc lại ở một chỗ khác (nội bộ wiring) |
| KEEP-PROPERTY-ACCESS-ELSEWHERE | 0 | có `.NAME` xuất hiện ở một file .ts khác dưới src/ (rộng tay — có thể trùng tên tình cờ, cần soi tay) |
| **DEAD** | **0** | không khớp điều kiện "còn dùng" nào trên — ứng viên xóa, PHẢI xác nhận lại bằng gate trước khi xóa thật |

(16 file test override sau-khi-nạp đã biết trước: action-workflow-service.test.js, backup-download-bridge.test.js, backup-roundtrip.test.js, render-downsampling.test.js, sigma-comp.test.js, local-store.test.js, audit-chain-cache.test.js, firebase-merge.test.js, lis-client-service.test.js, manage-config-service.test.js, manage-history-bridge.test.js, report-xlsx.test.js, sigma-print.test.js, sigma-xlsx.test.js, westgard-print.test.js, westgard-worker.test.js — vẫn nằm trong KEEP-TEST-REFERENCED, không tách riêng ở lượt này vì tiêu chí test đã rộng hơn.)

## Chỗ tên action tính động (không lộ qua grep tĩnh, 3 chỗ, cần soi tay riêng)
- src\compat\modular-pilot.global.ts: data-action="..."
- src\presentation\modal\modal-template.ts: data-action="${deps.escapeAttr(action.action)}"
- src\presentation\sigma\sigma-add-test-rows-html.ts: data-action="${row.action}"

## Danh sách DEAD (ứng viên xóa `root.X=` — sắp xếp theo dòng trong file)

