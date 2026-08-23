# Lộ trình hoàn thiện QC Lab

Rà soát lần đầu: 2026-08-23. Cập nhật lần này: 2026-08-23 (sau khi xử lý xong 2 mục
đầu tiên của lượt rà soát). Không có lỗi nghiêm trọng nào đang mở — các mục dưới đây
là nợ kỹ thuật đã biết rõ vị trí, cộng một quyết định nghiệp vụ cần chủ phòng xét
nghiệm ký, không phải việc lập trình viên tự quyết được.

## Trạng thái hiện tại

| Chỉ số | Giá trị |
|---|---|
| Test tự động | 611/611 pass |
| Mã `.ts` được test import trực tiếp | ~24,7% (750 file) |
| TODO/FIXME còn sót trong `src/` | 0 |
| Rủi ro cần chủ PXN quyết định | 1 (R-10, xem bên dưới) |
| Hex màu viết cứng ngoài `tokens.css` | 236 (đã khóa trần bằng ratchet, không tăng thêm được) |
| Gate chốt build đã commit khớp nguồn | Có (`benchmarks/check-build-freshness.js`) |

## Đã xử lý xong từ lượt rà soát 2026-08-23

### 1. Test trực tiếp cho logic quan trọng — xong, dưới dạng điều chỉnh

Kế hoạch ban đầu là viết test trực tiếp cho 4 file controller lớn nhất
(`sigma-page-controller.ts`, `action-form-controller.ts`,
`manage-tests-actions-controller.ts`, `entry-page-controller.ts`). Sau khi đọc
mã nguồn thật, hóa ra 3/4 file này chỉ là lớp điều phối DOM mỏng — logic tính
toán thật đã được tách ra và test riêng từ trước (`ActionFormModel`,
`ActionProtocolService`, `SigmaCohortService`, `ManageConfigService`...).
Viết thêm test cho chính các file controller đó sẽ chỉ mô phỏng DOM giả để
gọi lại logic đã được test kỹ rồi — giá trị thấp.

Thay vào đó:

- **`tests/qc-core-ts-parity.test.js`** — đối chiếu trực tiếp
  `src/domain/core/qc-core.ts` với bản build `assets/core.js`. Trước đó mọi
  test Westgard/Sigma/backup chỉ kiểm bản đã build; sửa nguồn `.ts` mà quên
  `npm run build:core` sẽ qua sạch toàn bộ 610 test cũ. Đã kiểm chứng bằng
  thực nghiệm: đổi `alert:true→false` của luật `6x` thẳng trong nguồn, không
  rebuild — test cũ vẫn xanh, test mới báo lỗi đúng 3 chỗ lệch.
- **`tests/action-form-fields-consistency.test.js`** — khóa bất biến
  `ACT_FIELDS` trong `action-form-controller.ts` (49 trường) phải được đọc
  lại đầy đủ khi lưu hồ sơ NCE. Phát hiện rủi ro thật: nếu ai thêm trường mới
  vào form mà quên đọc lúc lưu, người dùng gõ xong bấm lưu sẽ mất trắng giá
  trị mà không có cảnh báo nào. Đã kiểm chứng bằng thực nghiệm tương tự.

### 2. Gate chốt build đã commit khớp nguồn — phát hiện thêm, ngoài kế hoạch ban đầu

Trong lúc làm mục 1, phát hiện rủi ro lớn hơn: `npm test`/pre-commit hook cố
tình không rebuild (để không cần `npm install`), nên chỉ test đúng bản
`assets/*.js` đã commit sẵn — sửa bất kỳ file `.ts` nào mà quên
`npm run build:pilot` trước khi commit đều qua sạch cả hook lẫn CI job `test`.

**`benchmarks/check-build-freshness.js`** — build lại cả 3 artefact
(`modular-pilot.js`, `core.js`, `westgard-worker.js`) vào thư mục tạm, đối
chiếu byte-for-byte với bản đã commit. Nối vào `verify-release.js`, chạy sau
`npm ci` trong CI job `release-gate` — chặn phát hành nếu lệch.

### 3. Dọn màu hex rải rác — làm phần an toàn, khóa phần còn lại bằng ratchet

Con số 242 ban đầu hóa ra phần lớn không phải "cùng màu lặp lại" mà là hàng
trăm sắc độ navy/teal khác nhau (168/236 xuất hiện đúng 1 lần) — nhiều khả
năng là gradient/shading riêng cho từng khối UI. Ép gộp máy móc rủi ro làm
mất chi tiết thiết kế mà không cách nào soát lại bằng mắt trong phiên làm
việc từ xa.

Đã làm:
- Gộp **6 chỗ trùng khớp tuyệt đối** với token đã có (nền sidebar/màn đăng
  nhập, nền icon lặp lại 3 nơi) — kiểm chứng bằng computed style, không đổi
  một pixel nào.
- **`tests/css-hex-ratchet.test.js`** — khóa trần số hex hiện tại của từng
  file CSS (`tests/css-hex-ratchet-baseline.json`), không cho tăng thêm.
  Không ép xóa 236 chỗ cũ, chỉ chặn không cho nợ mới cộng dồn thêm.

Còn lại 236 chỗ **cần người thiết kế xem trực tiếp và chọn 3–5 tông màu
chuẩn muốn giữ** trước khi gộp tiếp — không phải việc đoán hộ bằng script.

## Còn tồn đọng

### Cần quyết định từ bạn — không phải việc lập trình viên tự quyết

**R-10 — client có thể bị sửa để vượt quyền** (RPN 40, điểm cao nhất trong
toàn bộ hồ sơ rủi ro, `docs/validation/RISK-ASSESSMENT.md`). Đơn vị phải chọn
giữa thêm backend xác thực/audit append-only, hoặc chấp nhận bằng đánh giá
rủi ro có chữ ký. Không có dòng code nào tự giải quyết được việc này.

### Làm khi thuận tiện

- **236 hex còn lại** — cần bạn (hoặc người thiết kế) xem `professional-entry.css`
  (58 chỗ) và `professional-config.css` (44 chỗ) — hai file nhiều nhất — rồi
  chốt tông màu chuẩn muốn giữ.
- **Rà lại 2 CVE devDependency mỗi kỳ phát hành** (`brace-expansion`,
  `fast-uri`, R-12b/R-12c) — quy trình đã có sẵn, chỉ cần lặp lại khi
  `npm run verify-release` in dòng "Build tooling audit".

### Chỉ khi đổi hướng sản phẩm

- **Gỡ global bridge** (`src/compat/modular-pilot.global.ts`, 6.283 dòng) —
  hạng mục lớn nhất còn lại theo `docs/TYPESCRIPT-MIGRATION-PLAN.md`, chi phí
  ước tính ngang hoặc lớn hơn cả đợt chuyển TypeScript đã qua. Chỉ đáng làm
  khi cần tách bundle để tải nhanh hơn, hoặc đội ngũ lớn lên và va chạm tên
  biến thường xuyên.
- **Chuyển sang backend SQL / mô hình đa phòng xét nghiệm** — chỉ hợp lý nếu
  mục tiêu đổi thành SaaS phục vụ nhiều PXN với báo cáo tổng hợp xuyên đơn vị.

## Đã ổn, không cần đụng vào

- Ma trận truy xuất nguồn gốc (traceability) — toàn bộ 20 nhóm yêu cầu URS
  đều có bằng chứng test tự động.
- Accessibility ratchet — 0 vi phạm ở mọi trang trong baseline hiện tại.
- Không có TODO/FIXME còn sót trong toàn bộ mã TypeScript.
- Bản build đã commit nay được canh khớp nguồn tự động ở cổng phát hành.
