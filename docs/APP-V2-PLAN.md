# Kế hoạch app-v2 — rà soát nghiệp vụ theo từng thẻ

> **Viết lại toàn bộ 2026-09-11.** Ba bản kế hoạch trước (08/2026 – 09/2026) đã
> bị bỏ: chúng tổ chức theo *giai đoạn thi công* (A1, B1…B11, C1…C7, D0…D3.10)
> nên càng làm càng dài, và người dùng không còn theo dõi được đang làm gì.
> Quan trọng hơn, chúng mang một quyết định nay đã bị huỷ: "giao diện lấy app
> cũ làm golden master, parity 100%".
>
> Bản này tổ chức theo **TỪNG THẺ** — cách người dùng thật sự dùng app. Mỗi
> thẻ trả lời đúng 3 câu: *nghiệp vụ của thẻ này là gì*, *app-v2 đã có gì*,
> *còn lại việc gì*.
>
> Nhật ký thi công chi tiết 08–09/2026 nằm ở
> `docs/archive/APP-V2-LOG-2026-08-to-09.md` (lịch sử, không phải chỉ dẫn).
> Rà soát chuyên sâu Sigma/Westgard nằm ở
> `docs/validation/SIGMA-WESTGARD-AUDIT-2026-09-10.md` (có bảng trạng thái
> từng phát hiện ở đầu file).

---

## 1. Hai nguyên tắc chi phối mọi việc còn lại

### 1.1 Giao diện — app cũ CHỈ là tham khảo

Người dùng sở hữu giao diện app-v2. Nhiều chỗ đã được người dùng tự cải tiến
và **tốt hơn app cũ**: chiều cao/màu thẻ header, tab Lịch sử dữ liệu, nút thao
tác trên hàng dạng icon (`.row-action`), một xét nghiệm gán được nhiều máy.

- **Không sửa giao diện app-v2 cho giống app cũ.** Lệch app cũ không phải lỗi.
- Cần dựng màn hình mới thì **xem app cũ để hiểu luồng thao tác và thông tin
  cần hiển thị**, rồi viết code mới theo hệ thống app-v2 (token, component dùng
  chung, CSS trong `renderer/styles/`).
- Thấy chi tiết giao diện nào có vẻ nên đổi thì **hỏi trước**, không tự đổi.
- Cải tiến giao diện về sau của người dùng **không liên quan gì tới app cũ**.

Vì sao phải viết thành nguyên tắc: ba gate parity cũ đều đo theo chiều "app cũ
CÓ mà app-v2 THIẾU", nên mọi cải tiến giao diện của người dùng đều làm gate đỏ,
và phản xạ "làm cho gate xanh" chính là kéo ngược cải tiến đó về app cũ. Đã xảy
ra ít nhất 3 lần. Đó là lỗi cơ chế, không phải lỗi trí nhớ — nên sửa cơ chế:

| Gate | Trước | Nay |
|---|---|---|
| `app-v2:style-parity` | so computed style với app cũ, FAIL nếu khác | **đã xoá** (script + baseline) |
| `app-v2:ui-parity` | FAIL nếu app-v2 thiếu class/dòng chữ so app cũ | **chỉ báo cáo**, luôn exit 0 |
| `app-v2:css-parity` | FAIL nếu app cũ có rule CSS mà app-v2 không | **class chết**: FAIL khi class dùng trong `.tsx` không có rule nào trong `app-v2/renderer/styles/`; không còn đọc `assets/` |

### 1.2 Nghiệp vụ — app cũ là bản ĐỐI CHIẾU, không phải chân lý

Khớp app cũ không chứng minh là đúng. Đợt rà 10–11/09 tìm ra **4 khiếm khuyết
mà CẢ HAI bản đều sai**: cửa sổ `2of3-2s`, số điểm `7T`, snapshot trong
`acceptedPoints()`, mức độ `6x`/`7T`. Thứ tự căn cứ khi có tranh chấp:

1. **Định nghĩa chuẩn** — westgard.com, ISO 15189, ISO/TS 20914, CLIA/EFLM.
   Gate: `app-v2/tests/westgard-standard.test.mjs` (154 phép kiểm, sống tiếp
   sau khi cắt app cũ).
2. **Quyết định sản phẩm** của người dùng, ghi trong tài liệu này.
3. **App cũ** — chỉ dùng để PHÁT HIỆN lệch khi port
   (`app-v2/tests/cross-app-westgard-sigma.test.mjs`, 2442 phép). Đây là bộ dò
   trôi, không phải oracle; sẽ xoá cùng lúc với app cũ.

Mục đã quyết (kể cả quyết "để nguyên") thì **không mở lại** ở lượt sau chỉ vì
app cũ làm khác.

---

## 2. Cách đọc bảng trạng thái

| Ký hiệu | Nghĩa |
|---|---|
| ✅ | Nghiệp vụ đủ, đã có test/kiểm chứng |
| 🟨 | Chạy được nhưng còn thiếu một phần đã ghi rõ |
| ⬜ | Chưa làm |
| 🔷 | **App-v2 có mà app cũ không có** — tính năng riêng, không được "sửa cho giống app cũ" |

---

## 3. Rà soát theo từng thẻ

Phương pháp: liệt kê mọi thao tác nghiệp vụ người dùng bấm được ở app cũ
(handler trong `src/react/pages/*Page.tsx`) rồi đối chiếu với kênh IPC + trang
tương ứng của app-v2 (`app-v2/main/preload.ts`, `app-v2/renderer/pages/`).

### 3.1 Tổng quan (Dashboard) — ✅

**Nghiệp vụ:** chỉ đọc, tổng hợp 3 nguồn có sẵn — không có domain/IPC riêng.
KPI ca làm việc, cảnh báo Westgard, lô sắp hết hạn, mức chưa có Mean/SD, sự cố
NCE quá hạn, bảng xét nghiệm có tìm kiếm + lọc trạng thái.

**Quy tắc nghiệp vụ đã chốt** (khác trực giác, đừng "sửa" lại):
- Báo động tính theo **ĐIỂM CUỐI** của mỗi mức, không phải điểm xấu nhất từng
  có — nếu không, một xét nghiệm đã khắc phục xong vẫn đỏ mãi.
- Một dòng báo động cho mỗi **MỨC**, không phải mỗi xét nghiệm.
- `%` hoàn tất tính theo **XÉT NGHIỆM** (1 xét nghiệm 2 mức mới nhập 1 mức = 0%,
  không phải 50%).
- `daysToExpiry()` đọc `YYYY-MM-DD` là nửa đêm giờ địa phương rồi trừ thời điểm
  hiện tại kèm giờ-phút và `Math.round`.

**Còn lại:** dòng NCE quá hạn hiện "phụ trách —". Trường người phụ trách nay đã
có trong `detail_json.owner` (protocol NCE), chỉ là Dashboard chưa đọc. Việc
nhỏ, chưa làm.

---

### 3.2 Cấu hình chung (8 tab) — ✅

Thẻ lớn nhất. Đối chiếu từng tab:

| Tab | Nghiệp vụ | Trạng thái |
|---|---|---|
| Máy xét nghiệm | CRUD máy | ✅ `saveInstrument`/`removeInstrument` |
| Danh mục xét nghiệm | CRUD xét nghiệm, TEa, CUSUM, 13 luật Westgard theo xét nghiệm | ✅ + 🔷 gán **nhiều máy** cho một xét nghiệm (app cũ chỉ 1) |
| Panel QC | CRUD panel, gán xét nghiệm | ✅ `savePanel`/`removePanel` |
| Lô & Nhóm QC | CRUD lô/nhóm lô, dừng/kích hoạt nhóm, đổi số lô | ✅ |
| Mean/SD | Ma trận gán Mean/SD/giới hạn theo (mức, lô) | 🟨 xem dưới |
| Chuyển tiếp lô | Vòng đời `planned → active → accepted/rejected` | ✅ |
| Lịch sử dữ liệu | Mốc Mean/SD theo lô + modal chi tiết + điểm QC | ✅ |
| Bảng TEa tham chiếu | 77 analyte CLIA/Ricos + ghi đè + hồ sơ TEa PXN | ✅ |

**Quy tắc nghiệp vụ đã chốt:**
- Trạng thái nhóm lô **SUY RA**, không lưu cứng: `status` chỉ có `''`/`stopped`/
  `planned`; "Đang hoạt động" = có lô đang được gán cho xét nghiệm (`inUse`).
- Chuyển lô: Mean/SD ứng viên lưu ở `lot_transitions.criteria_json`, **chỉ áp
  vào `test_levels` khi bấm "Chấp nhận lô mới"** — `planned`/`active` không
  được đụng cấu hình sống.
- Chấp nhận chuyển lô: nhóm lô cũ được **lưu trữ thành bản ghi riêng** giữ
  nguyên thành viên cũ (`archived_lot_ids_json`), nhóm đang chạy giữ id gốc và
  thay lô cũ bằng lô mới.
- Mean/SD áp qua chuyển lô hoặc kích hoạt nhóm lô luôn ghi nguồn `'mfg'`;
  `'lab'` chỉ dành riêng cho workflow "Xây dựng dải PXN" ở thẻ Nhập QC.
- Đổi số lô cascade sang `qc_points.lot` trong cùng transaction, hỏi trước kèm
  số điểm bị ảnh hưởng.
- Trùng xét nghiệm xét theo `(máy, teaRefKey hoặc tên)` — cùng Glucose trên hai
  máy là hợp lệ.
- Xoá xét nghiệm bị **từ chối** khi còn điểm QC thuộc kỳ báo cáo đã khoá.

**Còn lại (2 mục, đều đã chốt lý do):**
1. **Nhánh "Dự kiến" khi lưu Mean/SD sang nhóm lô khác** — app cũ có 3 lựa chọn
   (Hủy / Dự kiến / Chuyển qua nhóm này), app-v2 chỉ có Hủy/Chuyển. "Dự kiến"
   cần chỗ lưu Mean/SD ứng viên chưa áp ở tầng mức QC. ⬜
2. Cột "Hành động" của bảng luật Westgard nâng cao **đã nối** từ 2026-09-06
   (`inactive`/`alert`/`reject`, phân giải 3 lớp: ghi đè theo xét nghiệm →
   cấu hình chung → mặc định registry). Ghi chú cũ nói "chưa nối" là **đã lỗi
   thời**, đừng làm lại.

---

### 3.3 Nhập QC — 🟨

**Nghiệp vụ:** cây điều hướng (máy → nhóm lô → xét nghiệm), bảng worksheet theo
tháng (mỗi hàng 1 ngày, mỗi cột 1 mức), nhiều lần chạy trong ngày, ghi chú theo
ngày, biểu đồ Levey-Jennings, cửa sổ ngày, huỷ điểm có phân loại, tra cứu điểm
đã huỷ, cột lô song song, xem lô cũ, workflow đổi dải Mean/SD.

**Đã có:** `addPoint` `voidPoint` `queryPoints` `listVoidedPoints`
`listHistoryPoints` `setDayNote` `listParallelColumns` `listPreviousLotSeries`
`rangeCandidate` `applyLabRange` `revertManufacturerRange`.

**Quy tắc nghiệp vụ đã chốt:**
- `addPoint()` chốt `qc_mean`/`qc_sd`/`lot`/`operator_*` vào từng điểm **tại
  thời điểm nhập** — Levey-Jennings lịch sử không bị đổi verdict ngược khi ai
  sửa lại Mean/SD.
- Cổng ghi: xét nghiệm còn hoạt động **và** thuộc Panel QC đang hoạt động
  **và** mức đang nhập gắn lô thuộc nhóm còn vận hành **và** kỳ báo cáo chưa
  khoá. Cổng nằm ở handler nên LIS và mọi lời gọi IPC đều chung ranh giới.
- Huỷ điểm có 3 loại: `analytical` (luôn mở/dùng lại hồ sơ NCE gắn đúng
  `point_id`), `data-entry` (không mở NCE), `other` (người dùng chọn, bắt buộc
  lý do ≥5 ký tự).
- Kết luận NGÀY lấy **lần chạy cuối cùng không bị loại** của mỗi mức, không
  phải "tệ nhất trong mọi lần chạy".
- Lần chạy gần nhất trong ngày bị loại thì **tự mở ô nhập bổ sung**.
- `acceptedPoints()` — chuỗi được chấp nhận dùng cho biểu đồ và Mean/SD/CV
  thực: điểm bị loại rời khỏi cả chuỗi LẪN cửa sổ đánh giá các điểm sau. Điểm
  bị loại CHỈ bởi luật liên mức cũng bị loại (sửa 11/09).

**Còn lại (1 mục):**
- **Điều hướng bàn phím** trong cây và bảng worksheet (`entryTreeKey`/
  `entrySheetKey` của app cũ: mũi tên di chuyển giữa ô/nút). app-v2 mới có 2
  `onKeyDown`. ⬜ — đây là tính năng thao tác thật, không phải trang trí.

---

### 3.4 Phân tích Westgard — 🟨

**Nghiệp vụ:** chọn xét nghiệm, bật/tắt + đặt mức độ 13 luật, bảng hướng dẫn
luật, biểu đồ LJ/CUSUM, một panel cho mỗi mức kèm bảng điểm 7 cột (#/Ngày/Giá
trị/Z/Kết luận/Luật/Loại sai số), tab nhóm lô đã dừng, xem lô cũ, xuất Excel/in
PDF.

**Đã có:** `listTestSummaries` `analyzeLevel` `saveRuleAction` `saveRuleSetting`
`resetRuleSettings` `listRuleSettings` `listArchivedGroupTests`
`listArchivedBlocks` `listPreviousLotBlocks`.

**Quy tắc nghiệp vụ đã chốt:**
- 13 luật ở `WG_RULE_REGISTRY` là **nguồn duy nhất**: mô tả, mức độ mặc định,
  phạm vi, gợi ý khắc phục.
- Phạm vi `within`/`across`/`both` được **thực thi thật** từ 2026-09-06;
  `makeScopeOf()` phụ thuộc SỐ mức **đang vận hành**.
- Tập "mức QC đang vận hành" dùng chung với thẻ Nhập QC qua
  `main/db/operational-levels.ts` — nhóm lô không vận hành thì mức bị loại
  HẲN; Panel tắt thì mức còn trong danh sách nhưng không điểm nào được đánh
  giá. `tests/entry-westgard-symmetry.test.mjs` khoá tính đối xứng.
- Theo chuẩn Westgard, `2of3-2s` là "2 trong 3 điểm bất kỳ" (không đòi điểm mới
  nhất phải vượt) và `7T` là **7 phép đo** (6 bước). Cả hai lệch app cũ có chủ
  đích.

**Còn lại (2 mục):**
1. **"Xem lô cũ" trên trang Westgard** — `listPreviousLotBlocks` + test đã viết
   xong nhưng **chưa commit**, đang nằm trong working tree cùng
   `main/db/lot-lineage.ts`. 🟨 → cần commit.
2. **Mức độ `6x`/`7T`** — Westgard xếp cả hai là LOẠI BỎ; app cũ để cảnh báo.
   Người dùng chốt 2026-09-11: **theo chuẩn, mặc định loại bỏ**; ai cần cảnh
   báo thì hạ mức độ theo từng xét nghiệm trong thẻ Cấu hình chung. Thay đổi đã
   viết, **chưa commit**. 🟨
3. Bảng điểm hiện toàn bộ dòng; app cũ có nút "hiện thêm N dòng"
   (`wgLoadMoreRows`). Vấn đề hiệu năng khi chuỗi rất dài, không phải nghiệp
   vụ. ⬜ chờ khi có dữ liệu thật đủ lớn.

---

### 3.5 Six Sigma — 🟨

**Nghiệp vụ:** theo dõi xét nghiệm, kỳ đánh giá theo tháng, CV từ cohort IQC
hoặc nhập tay, Bias% từ nhiều vòng EQA/EQC (RMS), TEa theo 4 nguồn, thẻ tình
trạng, khuyến nghị cải thiện, ngân sách MU, thiết kế QC theo Sigma (OPSpecs),
biểu đồ xu hướng + MDC, xuất Excel/in PDF.

**Đã có:** `setTracking` `listPeriods` `savePeriod` `removePeriod`
`renamePeriod` `saveTeaConfig` `listCohorts`.

**Quy tắc nghiệp vụ đã chốt:**
- Sigma của thẻ này (CV/Bias đã được rà soát, có nguồn) **khác** Sigma trong
  báo cáo in (quan sát theo kỳ). Hai con số cố ý tách biệt.
- Bias nhiều vòng EQA dùng **RMS**, không dùng trung bình cộng có dấu.
- TEa giải lại **tại Mean của TỪNG MỨC** khi nguồn là CLIA dạng giới hạn tuyệt
  đối (Sodium ±4 mmol/L ở Mean 140 = 2,857%; ở Mean 100 = 4,000%). Thứ tự ưu
  tiên: snapshot của mức → giải từ nguồn đang khai → TEa cấp kỳ.
- Thành phần MU chưa đánh giá để `null` và vào `missing[]`, **không đọc là 0**.
  `uCal: 0` là kết luận hợp lệ, khác "chưa nhập".
- Backend **tự dựng lại** mô tả cohort từ `qc_points`; renderer chỉ chọn lô.

**Còn lại (3 mục — đều là câu hỏi SẢN PHẨM chung cho cả hai bản, không phải lỗi
port; cần người dùng quyết trước khi code):**
1. **Cohort IQC không kiểm trạng thái in-control.** 30 điểm có 1 điểm +40 SD
   vẫn `eligible` và vẫn chi phối khuyến nghị QC. **Không nên** tự động loại
   điểm Westgard-reject khỏi CV (tạo selection bias); cần workflow review có
   truy vết. ⬜
2. **Bảng gợi ý Sigma Rules chưa nhận số mức QC.** `sigmaQualityDesign(sigma)`
   chỉ nhận sigma nên N/R lệch bảng Westgard Sigma Rules (2 mức và 3 mức có
   thiết kế khác nhau: 3 mức dùng `2of3-2s`/`3-1s`/`6x`, N=6…). ⬜
3. **`u(Cref)` đang là SEM của chuỗi bias quan sát**, trong khi Nordtest định
   nghĩa là độ không đảm bảo của **giá trị gán** EQA/CRM. ⬜

---

### 3.6 Khắc phục sự cố (NCE) — ✅

**Nghiệp vụ:** panel "Sự cố cần xử lý" (gom theo xét nghiệm + ngày), hồ sơ 8
phần (nhận diện → kiểm soát → FMEA → checklist điều tra → nguyên nhân/hành động
→ rerun → release-to-service → hiệu lực/rủi ro tồn dư), duyệt độc lập, trả lại,
huỷ có lưu vết, mở vòng tiếp theo, xuất CSV.

**Đã có:** `create` `saveProtocol` `listRecords` `approve` `returnForRevision`
`cancel` `reopen` `setRerunEvidence` `setReleaseDecision`
`setActionCompletedDate` `markEffectiveness`.

**Quy tắc nghiệp vụ đã chốt:**
- Duyệt **độc lập**: người tạo và người sửa nội dung không được tự duyệt.
- Bằng chứng rerun phải là **điểm QC thật** cùng xét nghiệm, không phải mô tả
  tay.
- `residualRisk` bắt buộc **chỉ khi** kết luận "effective".
- Huỷ hồ sơ = `record_status='cancelled'` + lý do/người/thời điểm, không xoá.
- Mỗi hồ sơ chỉ mở **đúng 1** vòng tiếp theo.
- Panel "Sự cố cần xử lý" **không ẩn** mức đã có hồ sơ — đổi nút thành "Tiếp
  tục hồ sơ"; khớp theo `point_id` chứ không theo test+mức.

**Còn lại:** app cũ tự gợi ý Bias trước/sau từ dữ liệu EQA (`actionFillBias`/
`actionUpdateBiasHint`); app-v2 để người dùng tự gõ. Tiện ích, không phải
nghiệp vụ bắt buộc. ⬜

---

### 3.7 So sánh hóa chất — ✅

**Nghiệp vụ:** chọn/tạo phép so sánh, 9–10 trường metadata, bảng cặp mẫu, thống
kê (Pearson r, %Bias, P hai phía, Passing-Bablok, OLS, Bland-Altman kèm LoA), 6
tiêu chí chấp nhận + banner kết luận, 2 biểu đồ, in 1 phép so sánh hoặc báo cáo
tổng hợp, danh sách "chọn nhanh" người thực hiện/loại mẫu.

**Đã có:** `listComparisons` `createComparison` `removeComparison`
`saveMetadata` `saveRows` `listQuickValues` `addQuickValue` `removeQuickValue`.

**Quy tắc nghiệp vụ đã chốt:** **không có hồi quy Deming** — app cũ chỉ có OLS
+ Passing-Bablok; "Deming/OLS" trong mô tả kiến trúc cũ là cách gọi lỏng lẻo.
Đã từng viết rồi xoá lại một `reagentDeming()`; đừng thêm lại.

**Còn lại:** không có mục nghiệp vụ nào.

---

### 3.8 Báo cáo — ✅

**Nghiệp vụ:** chọn xét nghiệm + khoảng ngày, xuất CSV/Excel/PDF kèm phụ lục
NCE tuỳ chọn, khoá/mở khoá kỳ báo cáo.

**Đã có:** `queryReport` `listPeriodLocks` `lockPeriod` `unlockPeriod`,
`export:tableXlsx` (exceljs), `print:htmlToPdf` (`webContents.printToPDF`).

**Quy tắc nghiệp vụ đã chốt:**
- Mở khoá **bắt buộc ghi chú ≥5 ký tự** (khoá thì không) — mở lại một kỳ đã
  chốt là hành động đáng cân nhắc hơn đóng nó.
- Khoá kỳ **thực thi thật** ở `addPoint`/`voidPoint`, không chỉ là nhãn.
- Cả khoá và mở khoá đều qua xác thực lại mật khẩu.

**Còn lại:** không có mục nghiệp vụ nào.

---

### 3.9 Nhật ký hoạt động — ✅

**Nghiệp vụ:** chuỗi hash tamper-evident, tìm kiếm + lọc ngày + phân trang,
xuất CSV, xác minh chuỗi, lưu trữ log cũ (12/24/36 tháng).

**Đã có:** `query` `exportCsv` `verifyChainNow` `archive`.

**Quy tắc nghiệp vụ đã chốt:**
- Lưu trữ cắt **prefix** và ghi tip hash của đoạn bị cắt vào `app_meta
  .activityAnchor`; xác minh seed từ anchor. Xoá log mà giữ anchor (hoặc ngược
  lại) sẽ phá chuỗi ngay dòng đầu.
- Lưu trữ **tự tải CSV toàn bộ log trước** khi xoá, và qua xác thực lại.

**Còn lại:** 3 hàm ĐỌC (`query`/`exportCsv`/`verifyChainNow`) chưa chặn theo vai
trò — route đã chặn nên UI không vào được, nhưng gọi thẳng
`window.qcApi.queryActivity()` vẫn đọc được. Là lỗ **bảo mật đọc**, không phải
toàn vẹn dữ liệu. ⬜

---

### 3.10 Cài đặt — ✅

**Nghiệp vụ:** hồ sơ đơn vị, logo/thương hiệu, dung lượng, sao lưu/phục hồi/
kiểm tra backup/xoá dữ liệu test, di trú từ app cũ, LIS Gateway, đồng bộ
Firebase.

**Đã có:** `settings:*`, `backup:export/import/verify/resetAll/status`,
`migration:previewLegacyBackup/importLegacyBackup`, `lis:*`, `firebase:*`.

**Quy tắc nghiệp vụ đã chốt:**
- Phục hồi/di trú **tự chốt một bản an toàn ra đĩa TRƯỚC** khi xoá gì; bước đó
  lỗi thì huỷ luôn việc phục hồi.
- `resetAll` GIỮ `users` + `activity` + `app_meta` cùng nhau (giữ chuỗi hash).
- LIS: ghi điểm QC cục bộ TRƯỚC, chỉ báo gateway `imported` SAU khi ghi thành
  công; ghi thất bại thì **tuyệt đối không** gọi gateway.
- Ngày điểm QC từ LIS suy từ **giờ địa phương** của `measuredAt`, không cắt
  chuỗi ISO UTC.
- Firebase: đồng bộ bằng **snapshot SQLite có checksum**, không merge SQL tuỳ
  tiện; cả hai bên có dữ liệu khác nhau thì dừng và bắt admin chọn.
- Di trú (C4) **đóng băng** — giữ code làm đường lùi, không đầu tư thêm. Đừng
  xoá `main/db/table-io.ts` (dùng chung với backup).

**Còn lại:** không có mục nghiệp vụ nào.

---

### 3.11 Người dùng — ✅

**Nghiệp vụ:** CRUD tài khoản, 3 vai trò, quyền theo từng thẻ (`pagePerms`),
khoá/mở, đặt lại mật khẩu, đổi ảnh đại diện, xoá tài khoản.

**Đã có:** `listUsers` `createUser` `updateUser` `deleteUser` `resetPassword`
`changeOwnPassword` `setAvatar` `clearAvatar` `login` `logout`
`bootstrapAdmin` `verifyPassword`.

**Quy tắc nghiệp vụ đã chốt:**
- PBKDF2-SHA256 600k vòng; số vòng nằm trong chuỗi lưu nên hash cũ vẫn verify
  và tự nâng cấp khi đăng nhập đúng.
- `pagePerms` chỉ **thu hẹp**, không mở rộng quá vai trò; `null` = chưa thu
  hẹp, `[]` không bao giờ được lưu. Việc thu hẹp chạy **ở main**, không tin
  danh sách renderer gửi lên.
- Không tự khoá/hạ quyền/xoá admin ACTIVE cuối cùng; không tự sửa quyền của
  chính mình.
- Xoá tài khoản là xoá THẬT khỏi `users` (khác `qc_points`), nhật ký họ đã làm
  vẫn còn vì `activity` lưu username/user_id dạng chuỗi phẳng.

**Còn lại:** không có mục nghiệp vụ nào.

---

## 4. Tổng kết rà soát

**Nghiệp vụ app-v2 về cơ bản đã đầy đủ so với app cũ.** Rà lại toàn bộ thao tác
người dùng bấm được ở app cũ, chỉ còn **8 mục** chưa có, và không mục nào chặn
việc dùng app.

| # | Mục | Thẻ | Loại | Ưu tiên |
|---|---|---|---|---|
| 1 | Commit "Xem lô cũ" trên trang Westgard | Westgard | dọn việc dở | **1** |
| 2 | Commit mức độ `6x`/`7T` theo chuẩn | Westgard | dọn việc dở | **1** |
| 3 | Điều hướng bàn phím cây + worksheet | Nhập QC | tính năng | 2 |
| 4 | Chặn quyền 3 hàm đọc nhật ký | Nhật ký | bảo mật đọc | 2 |
| 5 | Sigma Rules theo số mức QC (N/R) | Six Sigma | cần quyết định | 3 |
| 6 | Cohort IQC kiểm in-control | Six Sigma | cần quyết định | 3 |
| 7 | `u(Cref)` đúng nghĩa Nordtest | Six Sigma | cần quyết định | 3 |
| 8 | Nhánh "Dự kiến" Mean/SD sang nhóm lô khác | Cấu hình chung | tính năng | 4 |

Ba mục Six Sigma (5–7) là **câu hỏi sản phẩm**, không phải lỗi port — app cũ
cũng như vậy. Sửa chúng là lệch app cũ có chủ đích, cần người dùng quyết trước.

**Ngoài phạm vi, đã đóng băng:** di trú dữ liệu từ app cũ (C4 — người dùng chốt
cắt thẳng, không di trú), gợi ý Bias tự động ở NCE, phân trang bảng điểm
Westgard.

---

## 5. Quy trình làm việc

1. Đọc mục của thẻ liên quan trong tài liệu này trước khi sửa gì.
2. Domain thuần trước (`main/domain/`), có test riêng; rồi handler; rồi
   `qc-api.d.ts`; rồi `preload.ts`; rồi store; rồi UI. Đi hết chuỗi và kiểm lại
   từng mắt xích — "thiếu wiring" là lớp lỗi nặng nhất của app này.
3. Verify: `app-v2:typecheck` + `app-v2:test` + `app-v2:build` sạch, cộng chạy
   thật (Electron hoặc `app-v2:dev`) và **đọc lại dữ liệu từ nguồn**, không tin
   thông báo thành công.
4. Chứng minh test mới có khả năng bắt lỗi: hoàn tác tạm bản sửa, xác nhận test
   đỏ đúng chỗ, rồi phục hồi.
5. Cập nhật bảng ở mục 4 của file này trong CÙNG commit với code.
6. **Điểm dừng:** báo kết quả mỗi mục xong, không tự chạy liên tiếp qua nhiều
   mục lớn.

**Không làm, dù thấy "lệch app cũ":** sửa giao diện app-v2 cho giống app cũ;
mở lại một quyết định nghiệp vụ đã chốt; baseline `ui-parity` về 0.

---

## 6. Khi nào cắt app cũ

Người dùng đã chốt 2026-09-02: app chưa lên production, dữ liệu cả hai bên đều
là dữ liệu test → **cắt thẳng**, không di trú, không chạy song song.

Tiêu chí còn lại:

1. ✅ Đối chiếu Westgard/Sigma giữa hai bản — đã đạt, và nay là **gate sống**
   chạy trong `app-v2:test`, không phải một lần đối chiếu rồi thôi.
2. ⬜ Hết 4 mục ưu tiên 1–2 ở bảng mục 4.
3. ⬜ Người dùng xác nhận giao diện app-v2 đã đủ dùng (tiêu chí này thuộc về
   người dùng, **không** đo bằng gate parity).

Khi cắt: đổi `build.files`, xoá DB test, khởi tạo admin mới, xoá
`app-v2/tests/cross-app-westgard-sigma.test.mjs` (bộ dò trôi khi port, hết tác
dụng khi không còn app cũ), và loại file `.wasm` của sql.js khỏi gói Electron
(Electron dùng `node:sqlite`, không bao giờ tải WASM).
