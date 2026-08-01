# Backlog — việc còn lại sau đợt rà soát 2026-08-01

Danh sách này ra đời từ một lượt rà soát toàn bộ codebase theo ba trục: **vận hành
tốt**, **nghiệp vụ chắc chắn**, **dễ sửa và dễ nâng cấp**.

Xếp theo mức độ gây đau, không theo mức độ dễ làm. Số hiệu mục giữ nguyên khi làm
xong (mục làm xong chuyển lên phần "Đã xong") để tham chiếu cũ không lệch.

---

## ✅ Đã xong (để lại đây làm ngữ cảnh)

- **Chặn khóa kỳ ở mọi đường phá hủy hàng loạt.** `delTest()` từng `delete state.data[id]`
  xóa cả điểm QC của kỳ đã chốt; `renameLotAcrossPoints()` viết lại `p.lot` của kỳ đã
  chốt mà không hỏi. Nay có `PeriodService.lockedPoints()` dùng chung.
  → `tests/locked-period-guards.test.js`
- **`derived()` tự kiểm chứng.** Trước là memo thuần, chỉ đúng khi mọi đường ghi cấu
  hình nhớ gọi `clearDerived()`. → `tests/derived-cache.test.js`
- **Job CI cho Windows.** `.github/workflows/test.yml` có thêm job `windows`
  (`runs-on: windows-latest`) chạy `node scripts/run-tests.js` (trước `npm ci`, giữ
  tính chất không-cần-cài) rồi `npm ci` + `npm run print-check` — không cần
  `xvfb-run`, runner Windows có session desktop thật. Đã xác minh `print-check` chạy
  qua trên Windows thật trước khi thêm job (120,7 KB PDF, 0 khối xám lớn, 3 vùng tô
  header teal, 641 thao tác chữ).
  **Sửa trong lượt rà soát lại:** bản đầu của job này gọi thẳng `node --test
  tests/*.test.js`. PowerShell không nở glob và `node --test` với mẫu không khớp gì
  thì **exit 0** — job sẽ xanh mà chạy 0 test. Nay cả ba đường (hook pre-commit,
  job `test` Linux, job `windows`) đều đi qua `scripts/run-tests.js`, tự liệt kê file
  và coi "0 file test" là lỗi; `verify-release.js` cũng từ chối danh sách rỗng.
- **Cổng hiệu năng nâng lên cỡ triển khai.** `performance-budget.json` (`version: 2`)
  đổi kịch bản từ 20 × 3 × 365 (21.900 điểm) sang **50 × 3 × 730 (109.500 điểm)** —
  đúng hình dạng `deployment` mà `performance-baseline.js` đã định nghĩa. Chỉ nới hai
  ngưỡng thời gian (`fullStartupMs` 1500 → 3500, `coldDomainMs` 2500 → 12000, giữ
  khoảng dư ~3–5 lần như bản cũ) và **siết** hai tỉ lệ đếm byte thuần
  (`bootShellRatio` 0,03 → 0,006, `saveIncrementalBytesRatio` 0,25 → 0,05) vì chúng
  cho cùng một con số ở mọi máy. Bảng số đo cũ/mới nằm trong `benchmarks/README.md`.
- **Bảng đăng ký luật Westgard.** `WG_RULE_REGISTRY` trong `core.js` là nguồn duy
  nhất; `WG_RULES`, `WG_DEFAULT_ON`, `WG_RUN_RULES`, `WG_ALERT_RULES`,
  `WG_SE_RULES`/`WG_RE_RULES`, `WG_RULE_DESCRIPTIONS`, thứ tự ưu tiên của
  `primaryErrorRule` và **bảng hướng dẫn trên trang Westgard** đều dẫn xuất từ nó.
  Bảng hướng dẫn trước đây gõ tay 13 dòng kèm cột kết luận — không ai đối chiếu nó
  với engine bao giờ. → `tests/westgard-rule-registry.test.js` (chốt cả nửa dẫn xuất
  lẫn nửa quét nguồn: ngoài `core.js`, không file nào được liệt kê ≥ 3 id luật)
- **Đo độ phủ rồi tách `sigma.js`.** `npm run coverage-map` (`scripts/coverage-map.js`,
  dùng `NODE_V8_COVERAGE` có sẵn của Node, không cài gì, KHÔNG phải cổng chặn) sinh
  `docs/coverage-map.md`. Có bản đồ rồi thì đường cắt không còn là phỏng đoán: lớp giải
  TEa — phần thuần quyết định con số TEa đi vào mọi phép Sigma/MU/báo cáo — tách sang
  `sigma-tea.js`, ranh giới một chiều chốt bằng `tests/ui-route-structure.test.js`,
  và có test riêng `tests/sigma-tea.test.js` (nạp sandbox chỉ với `core.js` +
  `state.js`, nên nếu ai kéo mã dựng giao diện vào đó thì đổ ngay).
  Trước tách: `sigma.js` 85 KB, 34,4%, 51 hàm chưa chạy — một con số trung bình không
  nói lên gì. Sau tách: `sigma.js` 26,9% (toàn giao diện) và `sigma-tea.js` **90,4%,
  không còn hàm nào chưa chạy**.

**Phát sinh trong lúc chạy đủ bộ kiểm tra (không nằm trong danh sách rà soát):**

- `a11y-audit` **đang đỏ sẵn ở HEAD**: ô nhập QC trống dùng hex lạc `#6f8390` trên nền
  trắng, chỉ đạt 3,94:1 (chữ 12px đậm cần 4,5:1). Lỗi này chỉ lộ vào những ngày đầu
  tháng — khi bảng nhập gần như trống nên axe mới thấy đủ nhiều ô. Đã đổi sang
  `var(--muted)` (6,01:1).
- `nce-check` cũng **đỏ sẵn ở HEAD**: script còn gọi `dashboardKpiSetScope()`, một hàm
  không tồn tại — commit KPI trước đó tách nó thành `dashboardKpiSetInstrument()` và
  `dashboardKpiSetTest()` mà quên sửa script. Đã sửa (99 đạt / 0 lỗi).

---

## Ngoài danh sách — cần quyết định của con người, không phải việc code

Ba điều dưới đây không sửa được bằng một commit, ghi lại để không quên:

- **Chuỗi băm chứng minh bản ghi, chưa chứng minh người ký.** Đăng nhập vẫn là biến
  JavaScript; Firebase Rules theo UID là ranh giới ghi thật duy nhất. `CLAUDE.md` gọi đây
  là đánh đổi đã chấp nhận của app client-only — đúng về kỹ thuật, nhưng nó va vào chính
  điểm mạnh nhất của sản phẩm khi đi ISO 15189. Sửa được thì phải có backend thật.
- **Khóa kỳ không chặn được máy khác.** `data` và `periodLocks` đều là nhánh đồng bộ:
  máy B offline nhập điểm tháng 7 → máy A khóa tháng 7 → đồng bộ → điểm của B vào được kỳ
  đã khóa. Không sửa triệt để được trong mô hình client-only, nhưng phần **im lặng** thì
  sửa được: khi merge phát hiện điểm rơi vào kỳ đã khóa, ghi một dòng nhật ký.
- **Câu hỏi chưa có lời đáp: phòng xét nghiệm dùng bản desktop có bật đồng bộ Firebase
  không?** Nếu không, dữ liệu QC nhiều năm chỉ nằm ở `localStorage` + IndexedDB trong hồ sơ
  người dùng Windows của một máy. Cài lại máy là mất, và `BACKUP_REMIND_DAYS` chỉ là lời
  nhắc chứ không phải cơ chế. Với yêu cầu lưu trữ hồ sơ của ISO 15189, đây có thể là rủi ro
  lớn hơn cả bốn mục trên — nhưng cần biết thực tế triển khai mới kết luận được.

---

## Nhập QC từ máy xét nghiệm (đã phác thảo, chưa làm — chủ ý hoãn)

Bản phác thảo đầy đủ nằm trong lịch sử hội thoại. Tóm tắt các quyết định thiết kế để không
phải nghĩ lại:

- **Không viết parser riêng cho từng máy** — không có chuẩn chung, firmware đổi là hỏng.
  Dùng bộ đọc văn bản phân tách chung + **hồ sơ ánh xạ lưu theo từng máy**
  (`state.importProfiles`), ánh xạ một lần rồi các lần sau là một cú bấm.
- **Phần khó là khớp danh tính**, không phải đọc file: mã xét nghiệm → `t.id`, tên mức →
  `level`, chuỗi số lô → `lot`. Ba bảng bí danh phải **tự lớn dần** sau mỗi lần khớp tay.
- **Không bao giờ ghi thẳng**: `đọc → khớp → kiểm tra → xem trước → xác nhận`. Bước kiểm
  tra chặn 6 loại: kỳ đã khóa, trùng, chưa khớp, thiếu Mean/SD, giá trị không phải số,
  ngày sai định dạng.
- **Bốn chỗ dễ sai**: (1) `nextRunIdFor()` tính từ dữ liệu hiện có nên nhập hàng loạt phải
  tự cấp số lần chạy theo lô, không gọi lại cho từng dòng; (2) nhập lại chồng lấn — gắn
  khóa nguồn `srcKey` cho từng điểm; (3) **từ chối** nhập vào mức đang chạy song song ở bản
  đầu; (4) nhập là đổi dữ liệu QC nên tuyệt đối không dùng `save({clearDerived:false})`.
- **Cần trước khi làm**: 2–3 file QC thật do máy xuất ra + tên máy tương ứng. Không có file
  thật thì phần đọc/ánh xạ chỉ là phỏng đoán.
