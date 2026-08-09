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
| R-11 | Audit bị dựng lại | 4/2/4 | 32 | Chuỗi hash; chặn backup/cloud có audit hỏng; không cho xóa trắng audit; cân nhắc backend append-only |
| R-12 | Dependency desktop có CVE | 5/2/2 | 20 | Electron/builder được nâng; release gate chặn ở `npm audit --omit=dev` |
| R-12b | CVE trong chuỗi công cụ build | 2/3/2 | 12 | Không đóng gói vào bản cài; audit dev chỉ báo cáo; xem ghi chú bên dưới |
| R-13 | Cold calculation làm treo UI | 3/2/2 | 12 | Cache theo test, worker, performance gate |
| R-14 | Báo cáo PDF sai layout | 3/2/2 | 12 | Visual/print check trên browser và Electron |
| R-15 | Đồng hồ máy sai | 4/3/3 | 36 | OQ kiểm tra NTP; SOP cấm chỉnh giờ; audit theo timestamp máy |

R-10 là rủi ro tồn dư đáng kể: trước khi dùng làm hồ sơ duy nhất, đơn vị phải quyết
định bổ sung backend identity/audit append-only hoặc chấp nhận bằng đánh giá rủi ro
có chữ ký.

R-12b (rà soát 2026-07-28): `npm audit` báo 16 lỗ hổng high trong cây
devDependencies, tất cả bắt nguồn từ một advisory duy nhất — `brace-expansion`
GHSA-mh99-v99m-4gvg (DoS, dải bị ảnh hưởng `<=5.0.7`) — lan qua
`minimatch → glob/rimraf/temp/dir-compare/@electron/asar → electron-builder`.
Đánh giá: dependency runtime duy nhất của bản desktop là `electron-updater`, và cây
phụ thuộc của nó không chạm gói nào trong danh sách này; `build.files` cũng chỉ đóng
gói `index.html`/`assets`/`electron`/`package.json`. Do đó không có mã lỗi nào trong
bản cài đặt giao cho phòng xét nghiệm — phơi nhiễm giới hạn ở máy chạy `npm run dist`.
Không có đường vá: `electron-builder` 26.15.3 đã là bản mới nhất, upstream chưa phát
hành `minimatch` vá cho các nhánh 1.x/2.x, và ép `overrides: brace-expansion@^5.0.8`
đã được thử rồi loại bỏ — bản 5.x đổi sang named export `{ expand }` nên
`minimatch@3.1.5`/`5.1.9` ném `expand is not a function`, tức là audit xanh nhưng
build hỏng. Kiểm soát: chấp nhận rủi ro, rà lại mỗi kỳ phát hành khi
`npm run verify-release` in dòng "Build tooling audit", và chỉ dựng bản phát hành
trên máy build được kiểm soát.

Cập nhật 2026-08-04: `npm audit` (nhánh devDependencies) phát hiện thêm advisory
`fast-uri` GHSA-7p8r-x3mc-p8w7 (host confusion qua dấu `\` mở đầu authority, severity
high, dải bị ảnh hưởng `3.0.0 - 3.1.4`) — lan qua
`electron-builder → app-builder-lib → ajv@8.20.0 → fast-uri@3.1.4`. Đánh giá giống hệt
brace-expansion ở trên: đây là dependency của `ajv` (electron-builder dùng để validate
schema config lúc build), không nằm trong cây phụ thuộc của `electron-updater` (dependency
runtime duy nhất được đóng gói) và không thuộc `build.files`, nên không có mã lỗi nào lọt
vào bản cài đặt giao cho phòng xét nghiệm — `npm audit --omit=dev --audit-level=high` (cổng
chặn release) vẫn báo 0 lỗ hổng. Kiểm soát: chấp nhận rủi ro theo cùng cơ chế R-12b, không
thêm `overrides` khi chưa xác nhận nó không phá `npm run dist`/`dist:publish`.
