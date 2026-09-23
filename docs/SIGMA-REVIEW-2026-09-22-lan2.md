# Rà soát chuyên sâu Six Sigma & Sai số — lần 2 — 22/09/2026

## Cập nhật khắc phục

Đã sửa **SG13 → SG19**; SG20 sửa một phần; SG21 giữ nguyên có chủ đích. Phần
mô tả bên dưới là ghi nhận **trước sửa**, số dòng cũ không còn là vị trí hiện
hành.

- **SG13/SG14** — `designLevelCount()` trong `sigma-handlers.ts` chọn bảng
  Westgard Sigma Rules theo **thiết kế QC đang vận hành**, ba bậc:
  `countOperationalLevels()` → số mức đã khai trong `test_levels` → số mức có
  trong chính kỳ. `savePeriod()` thêm cổng `unknown-level` (chặn mức chưa khai,
  nhưng mức đã nằm trong bản ghi cũ vẫn sửa được để kỳ lịch sử không bị khoá).
  `listTestLevels()` trả thêm cờ `operational`; `SigmaPage` lọc theo cờ đó thay
  vì đếm cả danh sách thô.
- **SG15** — cổng cohort đổi sang `> 3 SD`, khớp đúng `a > 3` của `1-3s`. Điểm
  đúng `|z| = 3` không còn chặn nhóm (Westgard cũng không loại nó, nên sẽ không
  bao giờ có NCE để gỡ chặn).
- **SG16** — `cohortFingerprint()` chỉ còn băm ĐÚNG những gì
  `buildSigmaCohorts()` đọc: điểm QC của (xét nghiệm, mức, lô) và tập điểm đã
  có NCE duyệt + hiệu quả. Bỏ `tests.rule_*_json` và `app_meta.westgardRules`;
  `actions` thu hẹp về các dòng có `point_id`.
- **SG17** — `SigmaLevelResult` tách `teaSnapshot` (giá trị ĐÃ CHỐT) khỏi `tea`
  (giá trị đã giải để hiển thị); `levelPayload()` gửi lại `teaSnapshot`. Sửa CV
  không còn đóng băng một TEa đến từ bậc dự phòng và không kèm `teaBasis`.
- **SG18** — biểu đồ MDC dùng thang thích ứng (`axis()` + tick tự sinh) thay
  cho `Math.min(60/100, …)`. Dữ liệu nằm trong thang vẫn ra đúng khung 0–60 /
  0–100 như trước, không đổi hình.
- **SG19** — `uncertaintyBudget()` trả `uCref: null` khi chưa có bias (u(Cref)
  chỉ vào ngân sách qua nhánh `u(bias)`); cột hồ sơ trong Excel/PDF chuyển sang
  đọc giá trị ĐÃ NHẬP `level.uCref`/`level.uCal`.
- **SG20** — sửa một phần: `resolvedActionsDigest()` tính một lần cho cả lượt
  đọc, nên `listPeriods()`/`listCohorts()` không còn truy vấn `actions` lại cho
  từng mức; `cohortFingerprint()` giảm từ 4 truy vấn xuống 1. Chưa cache kết
  quả băm giữa các lần gọi IPC.
- **SG21** — GIỮ NGUYÊN: RMS mất dấu khi ≥2 vòng cùng dấu là quyết định nghiệp
  vụ đã chốt, UI đã ghi nhãn "(RMS)" và có `mean`/`mixedSigns`. Cần người phụ
  trách quyết nếu muốn đổi.

## Cập nhật 23/09/2026

Ba mục còn treo của đợt trên đã được xử lý.

- **SG13b — một mức QC không được mượn bảng của hai mức.** SG13/SG14 đã sửa
  việc ĐẾM số mức, nhưng `sigmaQualityDesign()` vẫn rơi về `levels: 2` cho mọi
  `levelCount < 3`, kể cả `= 1`. Westgard Sigma Rules chỉ công bố bảng cho **2
  và 3 mức**; một mức không có khuyến nghị N/R nào trong chuẩn, nên đưa ra
  bảng 2 mức là app tự bịa ra một thiết kế QC. Nay `count === 1` trả `null`,
  trang Sigma nói thẳng "Cần tối thiểu 2 mức QC đang vận hành" ở cả cột thiết
  kế từng mức lẫn dòng đề xuất dùng chung. `sigmaQualityDesign(5, 1) === null`
  và ca `SG13b` khoá lại.
- **SG21 — đã xử lý, KHÔNG đổi công thức.** Quyết định cũ giữ nguyên: Sigma
  vẫn ăn **Bias RMS**, vì RMS mới là độ lớn sai số tổng hợp. Thứ được thêm là
  **hiển thị** trung bình có dấu bên cạnh: `SigmaLevelResult.biasMean` (null
  khi Bias nhập tay), hiện dưới ô Bias khi có ≥2 vòng, và một cột riêng "Bias
  TB có dấu%" khi xuất. Mọi nhãn "Bias EQA%" đổi thành **"Bias RMS EQA%"** để
  không ai đọc nhầm con số đang dùng là trung bình cộng. Người phụ trách giờ
  thấy được hệ thống lệch về phía nào mà không phải mở từng vòng EQA.
- **Xác nhận rà soát IQC tách khỏi cổng `eligible`.** Trước đây
  `savePeriod()` chỉ ghi `cohortReview` khi `found.status === 'eligible'`, nên
  một nhóm còn thiếu điểm thì người dùng bấm xác nhận mà không có gì được lưu
  — không lỗi, không dấu vết, lần sau mở lại vẫn "Chưa xác nhận rà soát". Xác
  nhận là **hành động của người dùng**, không phải kết luận về chất lượng dữ
  liệu, nên nay luôn được ghi (kèm tên, thời điểm, fingerprint). Điều này
  KHÔNG nới cổng: `listPeriods()` vẫn độc lập chặn `qualityDesign` cho tới khi
  cohort đạt `eligible` — ca test khoá đúng cặp `cohortReviewed: true` +
  `qualityDesign: null`. Hộp xác nhận chuyển sang `confirmDialog` trung tâm,
  ghi rõ người dùng đang xác nhận điều gì.

> **Một lần rà soát lại sau khi cập nhật:** đổi công thức `cohortFingerprint`
> (SG16) làm MỌI `cohortFingerprint`/`cohortReview` đã lưu không còn khớp, nên
> lần mở trang đầu tiên các mức lấy CV từ cohort sẽ hiện "Cần nạp và rà soát
> lại" và tạm mất gợi ý thiết kế QC. Đây là chi phí một lần; sau đó đổi cấu
> hình luật Westgard không còn gỡ hiệu lực rà soát nữa.

Kiểm thử chính thức mới: `app/tests/sigma-review-lan2.test.mjs` (8 ca, gồm
handler SQLite thật và render React SVG của biểu đồ MDC). Hai fixture cũ được
cập nhật cho đúng cấu hình thật: `sigma-handlers.test.mjs` và
`sigma-review-regressions.test.mjs` nay khai mức QC trước khi lập kỳ (trước đây
lập kỳ cho xét nghiệm chưa có dòng `test_levels` nào); `sigma-cohort.test.mjs`
đổi kỳ vọng ở ca `|z| = 3` — assertion cũ khoá đúng hành vi sai mà chính
comment ngay trên nó đã nói là sai.

Xác minh sau sửa: **150/150 test đạt**, `npm run typecheck`, `npm run build` và
`npm run app:css-parity` đều đạt. `docs/sigma-review-probes-2026-09-22-lan2.cjs`
nay PHẢI fail (nó khẳng định trạng thái lỗi), đúng như thiết kế.

Tiếp nối `SIGMA-REVIEW-2026-09-22.md` (SG01…SG12, đã sửa). Lần này rà phần
**số mức QC đầu vào của gợi ý thiết kế, cổng cohort IQC, vòng đời snapshot TEa
và biểu đồ MDC** — những chỗ lượt 1 chưa chạm tới, hoặc mới chỉ ghi ở mục
"Quan sát bổ sung". Đánh số tiếp từ **SG13**.

> Trạng thái: **chỉ mới phát hiện, CHƯA sửa gì.** Số dòng là vị trí hiện hành
> tại thời điểm viết.

## Phạm vi và bằng chứng

- Đọc `sigma-metrics.ts` (Sigma/DPMO/MU/Sigma Rules), `sigma-cohort.ts`,
  `sigma-tea-core.ts`, `tea-catalog.ts`, `sigma-handlers.ts`,
  `sigma-workflow.ts`, `sigma-tea.ts`, `SigmaPage.tsx`, `SigmaCharts.tsx`,
  `sigma-store.ts`; đối chiếu với `operational-levels.ts` và
  `westgard-engine.ts` ở chỗ hai thẻ dùng chung khái niệm.
- Chạy `npm test`: **142/142 đạt** trên mã hiện tại (đang trong lượt sửa
  Westgard WG-15…WG-25). Không test nào phủ các ca dưới đây.
- Mọi phát hiện đều **chạy thật** qua handler IPC trên SQLite `:memory:` hoặc
  trên hàm thuần đã build, không suy đoán từ đọc mã. Script tái hiện:
  `docs/sigma-review-probes-2026-09-22-lan2.cjs`.

P1: có thể làm sai kết luận năng lực phương pháp hoặc sai khuyến nghị thiết kế
QC. P2: sai biểu diễn, mất truy xuất nguồn, hoặc gỡ hiệu lực rà soát ngoài ý.

---

## Phát hiện

### SG13 — P1: Bảng Westgard Sigma Rules chọn theo SỐ DÒNG của kỳ, không theo thiết kế QC thật

`listPeriods()` gọi `computeLevel(s, r.tea, chain.bySource, stored.length,
chain.fallback)` (`sigma-handlers.ts:163`) — `levelCount` chính là **số phần tử
trong `lv_json`**, tức số dòng người dùng đã tạo trong kỳ đó.
`sigmaQualityDesign()` dùng nó để chọn giữa hai bảng Westgard công bố.

**Đã tái hiện** — cùng một xét nghiệm khai 3 mức, hai kỳ khác nhau:

```
kỳ đủ 3 dòng  → bảng 3 mức · 1-3s/2of3-2s/R4s/3-1s/6x · N=6 R=1
kỳ chỉ 2 dòng → bảng 2 mức · 1-3s/2-2s/R4s/4-1s/8x   · N=4 R=2
```

Chưa có EQA cho mức 3 nên chỉ nhập 2 dòng là đủ để nhận **một thiết kế QC khác
hẳn** cho cùng phòng xét nghiệm đó. `SigmaPage.tsx:624` còn in thẳng
"(xét nghiệm đang có {levelCount} mức)" — một câu sai sự thật.

Kèm theo: cổng lưu **không kiểm tra mức có tồn tại trong `test_levels` không**.
Đã lưu được một kỳ chứa `level: 7` cho xét nghiệm chỉ khai 1 mức, và dòng ma đó
cũng tính vào `levelCount`.

Hướng sửa: `levelCount` lấy từ `countOperationalLevels(db, testId)` — đúng
nguồn mà `operational-levels.ts:60` tuyên bố phải dùng ở mọi endpoint — và từ
chối mức không có trong `test_levels` ngay tại `savePeriod()`.

### SG14 — P1: Trang Sigma đếm mức bằng `listTestLevels`, không qua cổng vận hành

`SigmaPage.tsx:266` đặt tên biến là `operationalLevels` nhưng lấy từ
`levelsByTestId` → `listTestLevels()` → `SELECT * FROM test_levels` **không
cổng nào** (`config-handlers.ts:267`): không lọc Panel QC đang hoạt động, không
lọc nhóm lô còn vận hành. Biến này là đầu vào của `addPeriod()`
(`SigmaPage.tsx:375`), tức quyết định kỳ mới có bao nhiêu dòng → nối thẳng vào
SG13.

**Đã tái hiện** — mức 2 gắn lô thuộc nhóm đã dừng:

```
listTestLevels (SigmaPage.operationalLevels): [1, 2]
listOperationalLevels (Nhập QC + Westgard)  : [1]
```

Cùng một xét nghiệm, thẻ Sigma nói 2 mức còn thẻ Nhập QC/Westgard nói 1 mức.

### SG15 — P1: Cổng cohort dùng `|z| ≥ 3` còn engine `1-3s` dùng `> 3` — có thể chặn vĩnh viễn

`sigma-cohort.ts:131` bỏ qua điểm khi `Math.abs(z) < 3`, tức **đếm** điểm có
`|z|` đúng bằng 3. `westgard()` lại dùng `a > 3` cho `1-3s`.

**Đã tái hiện** với Mean 100 / SD 2 / giá trị 106 (z = +3,000 chẵn):

```
Westgard: warn (1-2s)            ← KHÔNG bị loại
cohort  : out-of-control
issues  : 1 điểm vượt ±3SD chưa có hồ sơ khắc phục hiệu quả
```

Vì điểm không bị loại nên sẽ **không ai mở NCE** cho nó; mà `resolvedPointIds`
chỉ nhận điểm có NCE đã duyệt + hiệu quả. Nhóm IQC đó kẹt ở `out-of-control`
không có lối ra, trừ khi hủy điểm — tức phải làm sai quy trình để gỡ.

Hướng sửa: đổi cổng thành `> 3` cho khớp `1-3s`, hoặc tốt hơn là hỏi thẳng
engine Westgard thay vì cài lại ngưỡng lần thứ hai.

### SG16 — P2: Đổi bất kỳ cấu hình luật Westgard nào cũng gỡ hiệu lực rà soát cohort

`cohortFingerprint()` (`sigma-handlers.ts:147`) băm
`[rows, rules, global, actions]`, trong đó `rules` là `rule_actions_json` /
`rule_scopes_json` của xét nghiệm và `global` là `app_meta.westgardRules`.
Nhưng `buildSigmaCohorts()` **không hề đọc cấu hình luật** — cổng duy nhất của
nó là `|z| ≥ 3`. Ảnh hưởng thật của việc đổi luật (điểm bị loại → mở NCE) đã
nằm trong `actions`, vốn cũng đã ở trong fingerprint.

**Đã tái hiện** — bật luật `9x` ở cấu hình chung:

```
trước: stale=false reviewed=true  design=1-3s/2-2s/R4s/4-1s/8x
sau  : stale=true  reviewed=false design=null
```

Một thao tác ở trang Westgard làm **mọi xét nghiệm** mất xác nhận rà soát IQC
và mất gợi ý thiết kế QC cho tới khi có người vào rà soát lại từng mức. Đáng
lưu ý ngay lúc này vì lượt sửa WG-15…WG-25 sẽ chạm đúng các khoá đó.

Hướng sửa: bỏ `rules` và `global` khỏi fingerprint.

### SG17 — P2: TEa lấy từ bậc dự phòng bị đóng băng thành snapshot, hồ sơ nói sai nguồn

`SigmaLevelResult.tea` là giá trị **đã giải** qua 4 bậc của `computeLevel()`
(`sigma-handlers.ts:121-124`), không phải snapshot. `levelPayload()`
(`SigmaPage.tsx:287`) gửi lại chính con số đó như `tea` của mức, nên bất kỳ lần
sửa CV/Bias nào cũng ghi cứng nó vào `lv_json`.

**Đã tái hiện** — kỳ chốt nguồn `lab` (chưa có hồ sơ TEa PXN nên không giải
được), xét nghiệm đang khai `ricos`:

```
màn hình hiện TEa 6.96%      ← thật ra từ bậc dự phòng "ricos"
sau 1 lần sửa CV:
  lv_json.tea = 6.96
  teaBasis    = KHÔNG CÓ
```

Hồ sơ kỳ giờ mang một TEa ghi cứng **không nguồn gốc**, trong khi
`sigma_data.tea_source` vẫn ghi `lab`. Đúng lớp lỗi mà SG05/SG06 đi gỡ, chỉ
khác đường vào. Cột "Tiêu chí TEa" trong Excel/PDF của kỳ đó sẽ trống.

Hướng sửa: tách `teaSnapshot` khỏi `tea` đã giải trong `SigmaLevelResult` và
chỉ gửi lại snapshot thật; hoặc bắt buộc đính `teaBasis` của đúng bậc đã dùng
(kể cả bậc dự phòng, có ghi rõ là dự phòng).

### SG18 — P2: Biểu đồ MDC kẹp điểm ngoài thang, không dấu hiệu gì

`SigmaCharts.tsx:109` vẽ điểm tại `Math.min(60, cvRatio)` /
`Math.min(100, biasRatio)`. Biểu đồ xu hướng Sigma đã được sửa sang thang thích
ứng ở lượt 1; MDC thì chưa.

**Đã tái hiện:**

```
thật: CV/TEa 95% · |Bias|/TEa 130% → Sigma −0,32
vẽ  : CV/TEa 60% · |Bias|/TEa 100% → đọc ra Sigma 0,00
```

Một phương pháp âm Sigma nằm đúng trên đường 0σ của hình. Tooltip có số thật
nhưng phải rê chuột mới thấy, và bản in PDF thì không có tooltip.

### SG19 — nhỏ: u(Cref) hiện ra nhưng không vào ngân sách khi chưa có bias

`uncertaintyBudget({ cv, uCref, uCal })` trả `uCref: 0.8` trong khi
`uBias: null` — u(Cref) chỉ được cộng qua nhánh `u(bias)`. Bảng MU vì thế có
thể in một con số u(Cref) không đóng góp gì vào `u_c`.

### SG20 — nhỏ: `cohortFingerprint` băm lại toàn bộ dữ liệu ở MỖI lần đọc

`listPeriods()` gọi `cohortFingerprint()` cho từng mức của từng kỳ; mỗi lần là
một SHA-256 trên toàn bộ `qc_points` của (test, level, lot) cộng toàn bộ
`actions` của xét nghiệm. 24 kỳ × 3 mức = 72 lần băm mỗi lần mở trang. Chưa đo
được thành vấn đề thật, nhưng nên cache theo `notifyChanged`.

### SG21 — nhỏ: RMS mất dấu ngay cả khi các vòng CÙNG dấu

`eqaRoundsStats([-3, -5])` → `4.123` (dương). Chính comment của hàm nói dấu
quan trọng để biết phương pháp lệch phía nào, và giữ dấu cho trường hợp 1 vòng
vì lý do đó. Khi mọi vòng cùng dấu thì không có gì để triệt tiêu, nên RMS có
thể mang dấu chung. UI có nhãn "(RMS)" và có `mean` nên chỉ là ghi chú.

### Ghi chú bảng: bậc `<3` của bảng 3 mức thiếu phương án `9x`

Bậc `3–4` có `alternatives: [{n:3,r:2}, {n:3,r:3, note:'dùng 9x thay 6x'}]`,
bậc `<3` cùng bộ luật nhưng chỉ còn `[{n:3,r:2}]` (`sigma-metrics.ts:85-86`).
Có thể là cố ý (không gợi ý đơn giản hoá cho phương pháp không đủ năng lực) —
nếu vậy nên ghi comment, vì hiện đọc như một chỗ sót.

---

## Những phần đã kiểm và ĐÚNG

- `Sigma = (TEa − |Bias|) / CV`, và `sigmaMetric()` trả `null` thay vì đoán khi
  thiếu TEa/CV/Bias.
- **DPMO khớp bảng chuẩn** (quy ước dịch 1,5σ, một phía):
  6σ = 3,40 · 5σ = 233 · 4σ = 6.210 · 3σ = 66.807.
- `sigmaQualityDesign(null)` và `('')` trả `null` — Sigma chưa tính được KHÔNG
  bị gán tier "<3σ".
- Hai bảng Westgard Sigma Rules cho 2 mức và 3 mức khớp nguồn đã dẫn; `levels`
  và `levelCount` được trả ra để người đọc biết bảng nào đang áp (vấn đề nằm ở
  **giá trị** `levelCount`, không ở cơ chế — xem SG13).
- **MU kiểm bằng tay khớp tuyệt đối**: `u(bias) = √(bias² + u(Cref)²)`,
  `u_c = √(u(Rw)² + u(bias)² + u(cal)²)`, `U = 2·u_c`; thiếu bất kỳ thành phần
  nào thì `teaRatio`/`withinTea` bị chặn về `null` và `missing` liệt kê đúng.
- Hình học đường σ của MDC đúng dạng normalized OPSpecs:
  `bias% + σ · cv% = 100`.
- Cohort: SD mẫu `n−1`, không trộn lô/mức, bỏ điểm void, **không** tự loại điểm
  mất kiểm soát khỏi CV (tránh selection bias); `isCalendarDate()` chặn
  `2026-02-31`; `periodCutoff()` theo giờ địa phương; `uniqueFinite()` phân
  biệt snapshot NULL với giá trị 0 thật.
- Backend dựng lại `cv`/`n`/`start`/`end`/`status` của cohort từ `qc_points`,
  không tin `cohortStatus` do renderer gửi lên.
- `teaAtMean()` quy đổi giới hạn CLIA tuyệt đối theo Mean của từng mức, và từ
  chối (báo lỗi) thay vì đoán khi kỳ cũ thiếu tiêu chí.

## Vì sao 142/142 test vẫn đạt?

Bộ test phủ tốt **công thức** và các ca hồi quy SG01–SG12, nhưng không có ca
nào: tạo kỳ thiếu một mức rồi đọc lại gợi ý thiết kế (SG13); dựng mức gắn nhóm
lô đã dừng rồi so hai trang (SG14); đặt một điểm đúng `|z| = 3` (SG15); đổi cấu
hình luật rồi đọc lại `cohortStale` (SG16); hay lưu lại một kỳ mà TEa đến từ
bậc dự phòng (SG17).

## Thứ tự xử lý đề xuất

1. **SG13, SG14** — cùng một gốc: số mức QC phải lấy từ
   `countOperationalLevels()`. Sửa một lần cho cả hai, kèm cổng chặn mức lạ ở
   `savePeriod()`.
2. **SG15** — ngưỡng cohort phải khớp `1-3s`; hiện đang tạo bế tắc không lối ra.
3. **SG16** — thu hẹp fingerprint. Nên làm trước khi lượt sửa Westgard kết thúc,
   nếu không mọi rà soát IQC hiện có sẽ bị gỡ hiệu lực hàng loạt.
4. **SG17** — tách snapshot khỏi giá trị đã giải; đây là truy xuất hồ sơ.
5. **SG18 → SG21** — biểu diễn và dọn dẹp.

Đây là rà soát mã kèm tái hiện bằng handler/hàm đã build, **không** phải thẩm
định lâm sàng, không phải đánh giá ISO/CLSI từng điều khoản, và không xác nhận
độ đúng của danh mục TEa. Không có thay đổi sản phẩm nào trong báo cáo này.
