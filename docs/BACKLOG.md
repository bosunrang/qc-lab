# Backlog — việc còn lại sau đợt rà soát 2026-08-01

Danh sách này ra đời từ một lượt rà soát toàn bộ codebase theo ba trục: **vận hành
tốt**, **nghiệp vụ chắc chắn**, **dễ sửa và dễ nâng cấp**. Hai mục đầu đã làm xong
và nằm trong commit cùng file này; bốn mục dưới còn nguyên.

Xếp theo mức độ gây đau, không theo mức độ dễ làm.

---

## ✅ Đã xong (để lại đây làm ngữ cảnh)

- **Chặn khóa kỳ ở mọi đường phá hủy hàng loạt.** `delTest()` từng `delete state.data[id]`
  xóa cả điểm QC của kỳ đã chốt; `renameLotAcrossPoints()` viết lại `p.lot` của kỳ đã
  chốt mà không hỏi. Nay có `PeriodService.lockedPoints()` dùng chung.
  → `tests/locked-period-guards.test.js`
- **`derived()` tự kiểm chứng.** Trước là memo thuần, chỉ đúng khi mọi đường ghi cấu
  hình nhớ gọi `clearDerived()`. → `tests/derived-cache.test.js`

---

## 3. Job CI cho Windows

**Vấn đề.** `npm run dist` xuất **NSIS Windows x64** — 100% người dùng chạy Windows.
Cả ba job trong `.github/workflows/test.yml` đều `runs-on: ubuntu-latest`.

Không phải lo hão: `index.html` đang mang sẵn một đoạn vá cho **lỗi chỉ có trên
Windows** (dialog Chromium làm ô nhập chết cứng sau khi đóng → phải định tuyến
`alert()` qua dialog hệ điều hành). Và `print-check` — thứ kiểm đường in ra PDF của
bản desktop — đang chạy Electron dưới `xvfb` **trên Linux**, tức kiểm một đường mã
trên hệ điều hành mà sản phẩm không bao giờ chạy.

**Việc cần làm.** Thêm job `runs-on: windows-latest` chạy `npm test` + `npm run
print-check` (bản Windows không cần `xvfb-run`).

**Ước lượng.** Nhỏ. Chỉ sửa `.github/workflows/test.yml`.

---

## 4. Cổng hiệu năng đang canh ở cỡ nhỏ hơn cỡ triển khai 5 lần

| | Số xét nghiệm | Ngày | Điểm QC |
|---|---|---|---|
| `benchmarks/performance-baseline.js` mốc `deployment` | 50 | 730 | ~109.500 |
| **`verify-release` thực sự chặn ở** | **20** | **365** | **21.900** |

Hình dạng "triển khai thật" đã được tự định nghĩa là 50×3×730 và có sẵn profile, nhưng
cổng phát hành chỉ gác ở một phần năm. Hồi quy chỉ lộ ra ở cỡ lớn sẽ đi lọt. Đây cũng là
nơi mốc `WG_WORKER_POINT_THRESHOLD=3000` mới bắt đầu có ý nghĩa thật.

**Càng đáng làm sau 2026-08-01** vì `derived()` vừa đổi từ memo thuần sang so chữ ký —
đường warm là đúng thứ cổng này canh (`warmDomainMaxColdRatio`).

**Việc cần làm.** Nâng kịch bản trong `benchmarks/performance-regression.js` lên cỡ
`deployment`, chạy vài lần lấy số thật rồi chỉnh lại ngưỡng trong
`performance-budget.json`. **Đừng siết ngưỡng ms tuyệt đối từ một lần chạy nhanh cục bộ**
— tỉ lệ và kiểm tra cấu trúc mới là tín hiệu hồi quy thật (xem `benchmarks/README.md`).

**Ước lượng.** Nhỏ–vừa. Chủ yếu là đo lại và chỉnh ngưỡng.

---

## 5. Bảng đăng ký luật Westgard

**Vấn đề.** Ngày 2026-08-01 đã gộp *ngữ nghĩa* luật (hành động + phạm vi) về `core.js`
làm nguồn duy nhất. Nhưng **danh sách luật** vẫn rải khắp 8 file nguồn:

`core.js` (`WG_RULES`, mô tả, phân loại SE/RE) · `state.js` · `qc-domain.js` ·
`westgard-routes.js` (ô bật/tắt) · `entry-tests-actions.js` (ghi đè theo xét nghiệm) ·
`action-form.js` · `data-io.js` · `reports.js`

**Việc cần làm.** Một bảng đăng ký duy nhất trong `core.js`, mỗi luật là một object:

```js
{ id:'2of3-2s', mô tả, loạiSaiSố:'SE', mặcĐịnhBật:false,
  hànhĐộngMặcĐịnh:'reject', phạmViTheoSốMức: … }
```

Các file khác **đọc bảng** thay vì tự liệt kê. Biến "thêm một luật" từ 8 chỗ thành 1.

**Ước lượng.** Vừa. Là refactor thật — nên làm sau khi mục 3 và 4 đã ổn định.

---

## 6. Đo độ phủ test → rồi mới tách `sigma.js`

**Vấn đề.** 60 file test nhưng **không có công cụ đo độ phủ nào**. Con số 60 nghe yên tâm
nhưng không trả lời được câu duy nhất đáng hỏi: *phần nào của `sigma.js` (87 KB — file lớn
nhất repo), `entry-tests-actions.js`, `firebase-sync.js` chưa có dòng nào chạm tới?*

**Việc cần làm.**
1. Chạy **một lần** bằng cờ đo độ phủ có sẵn của Node (không cần cài gì) để lấy bản đồ
   điểm mù. Không cần biến nó thành cổng chặn.
2. Có bản đồ rồi mới tách `sigma.js` — repo đã có tiền lệ tốt: `actions-routes.js` 105 KB
   tách thành `report-routes.js` + `action-form.js`, và `tests/ui-route-structure.test.js`
   chốt lại ranh giới.

**Ước lượng.** Bước 1 nhỏ. Bước 2 vừa.

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
