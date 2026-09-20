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

**Quy ước bàn phím trong modal (chốt 2026-09-11).** Enter = bấm **nút chính**,
định nghĩa là nút `.btn.teal` trong `.modal-f`. Cài đặt MỘT chỗ ở
`components/Modal.tsx`, không phải từng modal — ~20 modal đều cần, mỗi modal tự
viết một bản sẽ lệch nhau. Bốn cổng loại trừ, mỗi cổng là một lỗi thật nếu
thiếu: bộ gõ tiếng Việt đang dựng ký tự (`isComposing`), ô đã tự xử lý Enter
(`defaultPrevented`), `textarea`/`contenteditable` (Enter là xuống dòng), và
`button`/`a` (Enter đã là bấm chính nó).

- **Nút `danger` KHÔNG nhận Enter** — "Hủy điểm này", "Xác nhận mở khóa" là
  thao tác không rút lại được, phải bấm chuột. Modal chỉ có nút "Đóng" (picker,
  hướng dẫn) cũng không có gì để chạy.
- **`DateField`: Enter CHỐT ngày đang gõ rồi dừng ở đó**, không lưu modal luôn.
  Ô ngày chỉ commit khi blur; để Enter nổi bọt lên `Modal` là modal lưu TRƯỚC
  khi commit và ngày vừa gõ mất im lặng. Bấm Enter lần nữa mới lưu.
- `preventDefault()` trong `Modal` là thứ chặn submit chạy HAI lần với modal
  dùng `<form>` thật: nó huỷ implicit submission của trình duyệt trước khi gọi
  `click()`. Đã đo bằng bộ đếm lời gọi trong trình duyệt thật: đúng 1 lần.

Vì sao phải viết thành nguyên tắc: ba gate parity cũ đều đo theo chiều "app cũ
CÓ mà app-v2 THIẾU", nên mọi cải tiến giao diện của người dùng đều làm gate đỏ,
và phản xạ "làm cho gate xanh" chính là kéo ngược cải tiến đó về app cũ. Đã xảy
ra ít nhất 3 lần. Đó là lỗi cơ chế, không phải lỗi trí nhớ — nên sửa cơ chế:

| Gate | Trước | Nay |
|---|---|---|
| `app-v2:style-parity` | so computed style với app cũ, FAIL nếu khác | **đã xoá** (script + baseline) |
| `app-v2:ui-parity` | FAIL nếu app-v2 thiếu class/dòng chữ so app cũ | **chỉ báo cáo**, luôn exit 0 |
| `app-v2:css-parity` | FAIL nếu app cũ có rule CSS mà app-v2 không | **class chết**: FAIL khi class dùng trong `.tsx` không có rule nào trong `app-v2/renderer/styles/`; không còn đọc `assets/` |

### 1.1b Desktop-only — đã gỡ bố cục mobile (2026-09-11)

Người dùng chốt app đi theo hướng **desktop**. Đã gỡ:

- **57 khối `@media(max-width:N)` với N ≤ 980** (520/560/640/760/900/980) khỏi
  `app-v2/renderer/styles/**` — bố cục xếp dọc cho điện thoại/tablet, modal
  biến thành bottom-sheet, cỡ chữ bảng thu nhỏ, sidebar ẩn hoàn toàn.
- **2 prelude chỉ tồn tại để CHẶN nhánh mobile** được gỡ bỏ hoặc viết lại:
  `@media(min-width:761px) and (min-height:481px)` và `@media(min-width:500px)`
  (luôn đúng → bỏ lớp bọc); `@media(min-width:901px) and (max-width:1050px)`
  → `@media(max-width:1050px)`.
- **`-webkit-overflow-scrolling:touch`** (5 chỗ) — thuộc tính chỉ có tác dụng
  trên iOS Safari, chết trong Electron. Giữ `overscroll-behavior-x:contain`:
  cái đó CÓ tác dụng trên desktop (chặn cuộn ngang lan ra ngoài/gesture lùi
  trang trên trackpad).
- **Class `assay-name`** — CSS duy nhất của nó nằm trong khối mobile đã gỡ, ở
  desktop không có tác dụng gì. Gate "class chết" bắt được đúng nó cùng với
  `cfg-assay-scope` (class này là ĐỊNH DANH, giữ lại và ghi vào baseline như
  `cfg-assay-rule` đã làm).

**Giữ lại có chủ đích:** `@media(max-width:1050px)` (thu gọn sidebar),
`1150px` (Cấu hình chung đổi sidebar dọc thành thanh tab ngang), `1280px` —
đó là **laptop hẹp**, vẫn là desktop thật. Và `prefers-reduced-motion` là
accessibility, không phải mobile.

**Điều làm cho việc gỡ này an toàn, không chỉ là "chưa ai thử":** cửa sổ
Electron nay có `minWidth: 1024` / `minHeight: 700` (`app-v2/main/index.ts`).
Dưới mức đó không còn bố cục nào đỡ, nên cửa sổ không được phép nhỏ hơn.
Chọn 1024 (không phải 980) để mọi khối đã gỡ không bao giờ khớp lại được, kể
cả khi trừ viền cửa sổ. `minHeight: 700` vẫn vừa màn hình 1366×768.

`app-v2/ui-parity.manifest.json` bỏ 2 viewport `tablet` (980×760) và `mobile`
(760×900), còn `desktop` 1440×900 + `compact` 1150×820; baseline bỏ 36 surface
tương ứng. **Đừng thêm lại breakpoint < 1024 hay viewport hẹp hơn.**

---

### 1.2 Nghiệp vụ — app cũ là bản ĐỐI CHIẾU, không phải chân lý

Khớp app cũ không chứng minh là đúng. Đợt rà 10–11/09 tìm ra **5 khiếm khuyết
mà CẢ HAI bản đều sai**: cửa sổ `2of3-2s`, số điểm `7T`, snapshot trong
`acceptedPoints()`, mức độ `6x`/`7T`, và **phạm vi họ luật đếm chuỗi** (mục
3.4). Thứ tự căn cứ khi có tranh chấp:

1. **Định nghĩa chuẩn** — westgard.com, ISO 15189, ISO/TS 20914, CLIA/EFLM.
   Gate: `app-v2/tests/westgard-standard.test.mjs` (174 phép kiểm, sống tiếp
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
| Mean/SD | Ma trận gán Mean/SD/giới hạn theo (mức, lô) | ✅ gồm cả nhánh "Dự kiến" |
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
- **Bảng luật nâng cao phải NÓI RA mặc định đang là gì** (2026-09-11): hai ô
  để trống hiện "Theo cấu hình chung — Loại bỏ"/"Theo chuẩn — Cả hai phạm vi"
  thay vì chỉ "Theo cấu hình chung"/"Phạm vi SOP khuyến nghị". Trước đó không
  màn hình nào đọc ra được một luật đang chạy phạm vi/mức độ nào — chính chỗ
  đã giấu lỗi phạm vi `6x` (mục 3.4). Số mức do MAIN tự đếm
  (`countOperationalLevels`), renderer không được truyền vào: phạm vi khuyến
  nghị phụ thuộc số mức ĐANG VẬN HÀNH, thứ renderer không biết đúng —
  `TestsTab` từng truyền cứng `2`. `app_meta.westgardRules` chuyển thành module
  dùng chung `main/db/rule-settings.ts` vì nay có HAI handler đọc nó
  (`westgard-handlers` cho panel cấu hình chung, `config-handlers` cho nhãn
  này); nhân bản SQL ở đây là lớp lỗi "hai màn hình nói hai chuyện".

- **Mean/SD "Dự kiến" (làm 2026-09-12) — port đúng nghiệp vụ app cũ.** Người
  dùng chốt luồng: *"nhóm lô mới thì set Mean/SD rồi Kích hoạt; nhóm đang dùng
  chuyển sang nhóm mới là chuyển HẾT; chuyển một mức thì tự vào thẻ Chuyển tiếp
  lô"*. Bảng Mean/SD có 3 đường đi khi mức QC đang gắn lô của nhóm KHÁC (nguyên
  văn `targetSwitchModalHtml()` app cũ): **Hủy / Dự kiến / Chuyển qua nhóm lô
  này**.
  - **Dự kiến** = chỉ lưu Mean/SD đã nhập cho nhóm lô mới, **chưa áp dụng** —
    nhóm đang dùng vẫn chạy bình thường; nhóm nhận số mang nhãn `planned`
    ("Dự kiến" trên thẻ ở tab Lô & Nhóm QC, port `group.status='planned'`).
    Bấm **Kích hoạt** ở tab Lô & Nhóm QC mới áp vào `test_levels`, rồi **xoá**
    dòng dự kiến (giữ lại sẽ áp đè lại chính số đó ở lần kích hoạt sau).
  - **Chuyển qua nhóm lô này** = áp ngay; nhóm bị thay đánh dấu "Đã dừng", nhóm
    vừa nhận gỡ nhãn (port `commitTargetMatrix(mode:'switch')`).
  - Lưu ở **bảng riêng `planned_targets`**, KHÔNG nhét cờ `planned` vào
    `mean_sd_history_json` như app cũ: lịch sử là các giai đoạn ĐÃ có hiệu lực
    (trang Lịch sử dữ liệu, cảnh báo điểm QC và `lotTargetSnapshot()` đều đọc
    nó) — trộn số chưa từng áp vào đó là đúng lớp lỗi "áp nhầm số chưa duyệt".
  - Thứ tự ưu tiên khi kích hoạt: **số dự kiến → rồi mới tới lịch sử** (nhóm
    từng dùng rồi quay lại). Ngược lại sẽ áp số CŨ đè lên số vừa chuẩn bị.
  - Lô ĐANG DÙNG thì bị từ chối (`planned-current-lot`) — không tạo hai nguồn
    sự thật cho cùng một lô đang vận hành; lưu thẳng Mean/SD thay vì dự kiến.
  - **Lệch app cũ CÓ CHỦ ĐÍCH — chỉ dừng/đánh nhãn nhóm khi nó thật sự hết được
    dùng.** App cũ dừng nhóm cũ ngay khi có mức QC chuyển đi, và đánh nhãn
    `planned` cho nhóm nhận số dù nhóm đó đang chạy. Cả `stopped` lẫn `planned`
    đều bị loại khỏi "mức QC đang vận hành", nên những xét nghiệm Ở LẠI nhóm đó
    **biến mất khỏi thẻ Nhập QC và Westgard** dù lô của chúng còn nguyên — dựng
    lại được: 3 xét nghiệm dùng nhóm A, chỉ 1 có Mean/SD cho nhóm B, kích hoạt B
    → 2 xét nghiệm còn lại mất sạch mức QC. Cả hai đường (kích hoạt nhóm và
    "Chuyển qua nhóm lô này") nay đều kiểm `lotGroupInUse()` trước khi đổi
    trạng thái. Với luồng đã chốt ("chuyển là chuyển hết") kết quả giống app cũ;
    khác biệt chỉ lộ ra đúng ở ca chuyển dở dang — ca mà app cũ làm hỏng.
  - Di trú từ app cũ tách đôi luôn: mốc `meanSdHistory[].planned` vào
    `planned_targets`, không vào lịch sử (`migrate-legacy.ts`).
  - Gate: `app-v2/tests/planned-targets.test.mjs` (10 nhóm phép kiểm; đã chứng
    minh bắt được lỗi bằng cách đảo thứ tự ưu tiên và gỡ cổng `lotGroupInUse`)
    + phần mới của `migrate-legacy.test.mjs`.
- Cột "Hành động" của bảng luật Westgard nâng cao **đã nối** từ 2026-09-06
  (`inactive`/`alert`/`reject`, phân giải 3 lớp: ghi đè theo xét nghiệm →
  cấu hình chung → mặc định registry). Ghi chú cũ nói "chưa nối" là **đã lỗi
  thời**, đừng làm lại.

**Còn lại:** không. ✅

---

### 3.3 Nhập QC — ✅

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
- Mỗi tổ hợp **xét nghiệm + mức + lô + ngày + run ID** chỉ ghi một điểm còn
  hiệu lực. Điểm đã huỷ có thể nhập lại cùng run ID; mọi nguồn ghi khác, kể
  cả LIS, đều bị chặn trùng ngay tại `addPoint()`.
- Huỷ điểm có 3 loại: `analytical` (luôn mở/dùng lại hồ sơ NCE gắn đúng
  `point_id`), `data-entry` (không mở NCE), `other` (người dùng chọn, bắt buộc
  lý do ≥5 ký tự).
- Kết luận NGÀY lấy **lần chạy cuối cùng không bị loại** của mỗi mức, không
  phải "tệ nhất trong mọi lần chạy".
- Lần chạy gần nhất trong ngày bị loại thì **tự mở ô nhập bổ sung**.
- `acceptedPoints()` — chuỗi được chấp nhận dùng cho biểu đồ và Mean/SD/CV
  thực: điểm bị loại rời khỏi cả chuỗi LẪN cửa sổ đánh giá các điểm sau. Điểm
  bị loại CHỈ bởi luật liên mức cũng bị loại (sửa 11/09).

**Điều hướng bàn phím — đã xong cả hai nửa:**
- **Bảng worksheet** (2026-09-11, `2f370e5`): `renderer/lib/entry-sheet-navigation.ts`
  — mũi tên trái/phải đi ngang giữa các mức cùng ngày, lên/xuống và Enter đi
  dọc giữa các ngày cùng một mức.
- **Cây danh mục** (2026-09-12): `renderer/lib/entry-tree-navigation.ts` —
  Enter/Space kích hoạt nút, ArrowRight mở nhóm đang đóng, ArrowLeft đóng nhóm
  đang mở, ArrowUp/Down đi giữa các nút đang thấy (quay vòng), Home/End về nút
  đầu/cuối. Trước đó mọi `.tnode` đều không focus được: cả cây chỉ dùng được
  bằng chuột. Lệch app cũ có chủ đích: nút MÁY của app-v2 luôn mở và không có
  hành vi bấm nên KHÔNG nhận focus — không dựng điểm dừng bàn phím cho một nút
  không làm gì. Thêm `.tree .tnode:focus-visible` (viền teal) vì nút vừa mới
  focus được lần đầu.

**Còn lại:** không. ✅

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
- **Luật liên mức đã đối chiếu chuẩn (2026-09-11).** Nguồn: Westgard, "The
  Multirule Interpretation". Ba điều chốt lại, đều đã có test ở
  `westgard-standard.test.mjs` (183 phép kiểm):
  - Chuỗi GỘP xếp theo LẦN CHẠY rồi tới MỨC, nên `4-1s` = 2 mức × 2 lần chạy
    (*"across materials and across runs"*) và `10x` = 5 lần chạy × 2 mức, hoặc
    10 lần chạy của một mức (*"or to the measurements on just one material for
    the last ten runs"*) — câu sau là căn cứ TRỰC TIẾP cho việc họ đếm chuỗi
    phải là `both`.
  - `2-2s` CỐ Ý bị loại khỏi chuỗi gộp
    (`WG_RUN_RULES.filter(rule !== '2-2s')`): *"within a material and across
    runs"* đã do kênh TỪNG MỨC lo. Không loại thì mức 2 của lần chạy trước ghép
    với mức 1 của lần chạy này thành "2 phép đo liên tiếp" — chéo cả mức lẫn
    lần chạy, vô nghĩa. Có ca phân biệt riêng cho chính điều này.
  - `R4s` chỉ within-run, đúng *"should only be interpreted within-run"*.
  Ghi chú thiết kế: với 3 mức QC, Westgard khuyến cáo bộ
  `13s/2of3-2s/R4s/31s/6x/9x` vì *"The 22s, 41s, and 10x rules ... just don't
  fit with multiples of 3"*. Đó là khuyến cáo CHỌN LUẬT, đã nằm ở bảng gợi ý
  (`sigma-qc-design.test.mjs`); engine KHÔNG tự tắt luật nào — phòng xét nghiệm
  vẫn được bật theo SOP của họ.
- **Còn treo:** luật liên mức chạy trên MỌI điểm chưa huỷ, kể cả điểm đã bị
  Westgard loại và chạy lại — khác CUSUM (đã chuyển sang chuỗi chấp nhận
  2026-09-11). Chưa sửa vì có phụ thuộc vòng thật: `acceptedPoints()` cần biết
  điểm nào bị luật liên mức loại (`rejectsAcross`), mà luật liên mức lại cần
  biết chuỗi chấp nhận. Phạm vi ảnh hưởng hẹp hơn CUSUM (các luật trong-run
  R4s/2-2s/2of3-2s/3-1s chỉ nhìn một lần chạy nên không bị); chỉ chuỗi gộp
  (`4-1s`/`6x`/`10x`…) mới đọc điểm cũ đã bị loại. Cần một phương án 2 pha
  trước khi đụng vào.
- Tập "mức QC đang vận hành" dùng chung với thẻ Nhập QC qua
  `main/db/operational-levels.ts` — nhóm lô không vận hành thì mức bị loại
  HẲN; Panel tắt thì mức còn trong danh sách nhưng không điểm nào được đánh
  giá. `tests/entry-westgard-symmetry.test.mjs` khoá tính đối xứng.
- Tab **nhóm lô đã dừng** cũng chạy đường ghép `combinedWestgardByPoint()`,
  không đánh giá rời từng block: vì vậy các luật liên mức như `R4s`, `2-2s`,
  `2of3-2s`, `3-1s` của chính lần chạy lịch sử vẫn được kết luận đúng. Phạm vi
  mặc định lấy theo số mức của nhóm lô lịch sử (không theo panel hiện hành);
  `westgard-archived.test.mjs` khoá ca `+2,5SD/-2,5SD` cùng run.
- Theo chuẩn Westgard, `2of3-2s` là "2 trong 3 điểm bất kỳ" (không đòi điểm mới
  nhất phải vượt) và `7T` là **7 phép đo** (6 bước). Cả hai lệch app cũ có chủ
  đích.
- **CUSUM (rà soát 2026-09-11).** Công thức tabular khớp NIST
  (`C+ = max(0, C+ + z − k)`, `C− = min(0, C− + z + k)`), mặc định k=0,5/h=4
  khớp Minitab, khởi tạo 0, đặt lại khi đổi baseline Mean/SD, bỏ điểm đã huỷ,
  và KHÔNG đổi verdict Westgard (CUSUM là cảnh báo xu hướng). Hai điểm đã sửa:
  - **Chạy trên CHUỖI ĐƯỢC CHẤP NHẬN**, không phải mọi điểm chưa huỷ. Điểm đã
    bị Westgard loại đã được chạy lại; để nó tiếp tục đẩy C+ là đếm MỘT sự cố
    hai lần, và làm hai nửa của cùng một bảng nói về hai chuỗi khác nhau.
    Điểm ngoài chuỗi thừa kế C+/C− của điểm trước và không mang cờ CUSUM.
  - **Đặt lại theo mốc NCE đã duyệt + kết luận hiệu quả**
    (`action_completed_date`, không phải ngày đánh giá hiệu lực). Thực hành
    CUSUM chuẩn đặt lại sau khi nguyên nhân bị loại bỏ; không có mốc này thì
    C+ chỉ trôi về 0,5/điểm — đo được: drift 8 điểm ở +1,5SD rồi trở lại hoàn
    toàn bình thường vẫn để lại **8 điểm mang cờ**. Đúng lớp lỗi "đã khắc phục
    xong vẫn đỏ mãi" mà mục 3.1 đã tránh có chủ đích. Hồ sơ chưa duyệt hoặc
    chưa kết luận hiệu quả KHÔNG đặt lại — nếu không, chỉ cần mở một hồ sơ là
    cờ tự biến mất.
- **Phạm vi họ luật đếm chuỗi là `both`, không phải `across` thuần** (sửa
  2026-09-11 sau khi người dùng gặp ca thật: 7 điểm Mức 1 đều cùng phía Mean
  mà không luật nào nổ). Lưu ý thuật ngữ đọc ngược so với tài liệu Westgard:
  `within` của app = "across runs" của Westgard (trong TỪNG mức, qua nhiều lần
  chạy), `across` của app = "across materials" (chéo mức trong cùng lần chạy).
  Định nghĩa chuẩn cho phép đếm CẢ HAI chiều và lấy chiều qua-nhiều-lần-chạy
  làm cơ bản — `4-1s`: *"may be from one control material or ... may ALSO be
  applied across materials"*; `10x`: *"usually has to be applied ACROSS RUNS
  and OFTEN across materials"*. app cũ để `2-2s`/`4-1s` là `both` nhưng
  `3-1s`/`6x`/`8x`/`9x`/`10x`/`12x` là `across` thuần — tự mâu thuẫn trong
  cùng một họ, và bỏ sót đúng ca một mức trôi dần trong khi mức kia ổn định
  (chuỗi gộp xen kẽ dấu nên triệt tiêu tín hiệu). Hai ngoại lệ giữ nguyên:
  `R4s` là `across` (*"should only be interpreted within-run"*), `7T` là
  `within` (gộp mức tạo răng cưa giả). Chốt ở `westgard-standard.test.mjs`
  và mục 4d của `cross-app-westgard-sigma.test.mjs`.

**Đã xong 2026-09-11 (`ef6435b`), trước đó ghi là "chưa commit":**
- **"Xem lô cũ" trên trang Westgard** — `listPreviousLotBlocks` +
  `main/db/lot-lineage.ts` + test. ✅
- **Mức độ `6x`/`7T`** — Westgard xếp cả hai là LOẠI BỎ; app cũ để cảnh báo.
  Người dùng chốt 2026-09-11: **theo chuẩn, mặc định loại bỏ**
  (`alert: false` trong `WG_RULE_REGISTRY`); ai cần cảnh báo thì hạ mức độ
  theo từng xét nghiệm trong thẻ Cấu hình chung. ✅

**Còn lại (1 mục):**
1. Bảng điểm hiện toàn bộ dòng; app cũ có nút "hiện thêm N dòng"
   (`wgLoadMoreRows`). Vấn đề hiệu năng khi chuỗi rất dài, không phải nghiệp
   vụ. ⬜ chờ khi có dữ liệu thật đủ lớn.

---

### 3.5 Six Sigma — ✅

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
  tiên: snapshot của mức → giải theo nguồn **đã chốt của kỳ** → TEa cấp kỳ →
  giải theo nguồn **đang khai của xét nghiệm**. Bậc cuối thêm 2026-09-11: một
  kỳ tạo lúc nguồn TEa chưa giải được sẽ chốt `tea = null`, mà snapshot NULL
  không phải lịch sử cần bảo vệ — ghim vào nó thì kỳ đó vĩnh viễn không tính
  được Sigma kể cả sau khi đã khai nguồn, và người dùng không có cách nào biết
  phải xoá kỳ rồi tạo lại. Mọi snapshot THẬT (một con số) vẫn thắng bậc này nên
  kỳ lịch sử không bị kéo theo cấu hình hôm nay (`sigma-level-tea.test.mjs`).
- Thành phần MU chưa đánh giá để `null` và vào `missing[]`, **không đọc là 0**.
  `uCal: 0` là kết luận hợp lệ, khác "chưa nhập".
- Backend **tự dựng lại** mô tả cohort từ `qc_points`; renderer chỉ chọn lô.
- **Tra analyte cho TEa là khớp TUYỆT ĐỐI, không đoán theo tiền tố** (app cũ
  dùng exact-rồi-longest-prefix nên "Glucose (huyết tương)" tự thừa hưởng TEa
  của "Glucose" — lệch có chủ đích: thừa hưởng sai còn tệ hơn báo "chưa có").
  Tập tên hợp lệ gồm mã/tên/viết tắt/alias **và dạng `Tên (Viết tắt)`** — đó là
  định dạng ô "Tên xét nghiệm" tự sinh khi gợi ý analyte. Sửa 2026-09-11 sau
  phản hồi người dùng: trước đó một xét nghiệm tên "Sodium (Na)" mà chưa gán
  `tea_ref_key` không tra được analyte của chính nó, và trang Six Sigma chỉ nói
  "chưa có" (`sigma-tea.test.mjs`). Hồ sơ TEa PXN của analyte có sẵn cũng được
  khớp thêm theo `analyte_id` của dòng danh mục đã tra ra, không chỉ theo tên.
- Thiếu bất kỳ đầu vào nào trong ba (TEa/CV/Bias) thì thông báo phải **nói đích
  danh** thứ còn thiếu, không nói chung chung "chưa đủ dữ liệu".

**Ba mục áp chuẩn quốc tế — ĐÃ LÀM 2026-09-11** (chi tiết ở mục 4.1):
1. ✅ **Bảng gợi ý Sigma Rules theo số mức QC** — Westgard công bố hai bảng
   khác nhau cho 2 mức và 3 mức; cả hai bản trước đó dùng một bảng pha trộn.
2. ✅ **`u(Cref)` đúng nghĩa Nordtest** — độ không đảm bảo của **giá trị gán**
   EQA/CRM, nhập từ báo cáo nhà cung cấp, không suy từ chuỗi bias quan sát.
3. ✅ **Cohort IQC kiểm trong tầm kiểm soát** — nhóm còn điểm vượt ±3SD chưa
   có hồ sơ khắc phục hiệu quả thì không được `eligible`; **không** tự loại
   điểm khỏi CV (selection bias).

**Còn lại:** không. ✅ (thẻ này để 🟨 tới 2026-09-12 là do sót cập nhật sau khi
ba mục trên xong ngày 11/09, không phải còn việc chưa làm.)

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
- **Cả 4 hàm đều admin-only, kể cả 3 hàm ĐỌC** (chặn 2026-09-12). Trang Nhật
  ký là `ADMIN_ONLY`, nhưng route guard của renderer chỉ là hiển thị — trước
  bản này gọi thẳng `window.qcApi.queryActivity()` từ DevTools vẫn đọc được
  toàn bộ nhật ký (tên tài khoản + mọi thao tác của từng người). Vì thế 3 hàm
  đó trả `IpcResult` thay vì trả thẳng dữ liệu như các hàm đọc khác; với
  `verifyChainNow`, `.ok` là cổng quyền còn `.data.ok` mới là kết luận chuỗi
  hash. Khoá ở `role-gating.test.mjs` mục 7 (đã chứng minh test bắt được lỗi
  bằng cách gỡ tạm cổng quyền). Hai chỗ bị chặn đọc trong toàn app là đây và
  xuất backup — mọi hàm đọc khác vẫn mở cho mọi vai trò.
- Không xuất được bản sao CSV thì **không cắt log**: modal lưu trữ dừng lại và
  báo lỗi, vì bước cắt không thể hoàn tác.

**Còn lại:** không. ✅

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

**Nghiệp vụ app-v2 đã đầy đủ so với app cũ.** Rà lại toàn bộ thao tác người
dùng bấm được ở app cũ, cả **8 mục thiếu ban đầu đều đã xong** (2026-09-12).

| # | Mục | Thẻ | Loại | Ưu tiên |
|---|---|---|---|---|
| ~~1~~ | ~~"Xem lô cũ" trên trang Westgard~~ | Westgard | ✅ xong 11/09 (`ef6435b`) | — |
| ~~2~~ | ~~Mức độ `6x`/`7T` theo chuẩn~~ | Westgard | ✅ xong 11/09 (`ef6435b`) | — |
| ~~3~~ | ~~Điều hướng bàn phím cây + worksheet~~ | Nhập QC | ✅ worksheet 11/09 (`2f370e5`), cây 12/09 | — |
| ~~4~~ | ~~Chặn quyền 3 hàm đọc nhật ký~~ | Nhật ký | ✅ xong 12/09 | — |
| ~~5~~ | ~~Sigma Rules theo số mức QC (N/R)~~ | Six Sigma | ✅ xong 11/09 | — |
| ~~6~~ | ~~Cohort IQC kiểm in-control~~ | Six Sigma | ✅ xong 11/09 | — |
| ~~7~~ | ~~`u(Cref)` đúng nghĩa Nordtest~~ | Six Sigma | ✅ xong 11/09 | — |
| ~~8~~ | ~~Nhánh "Dự kiến" Mean/SD sang nhóm lô khác~~ | Cấu hình chung | ✅ xong 12/09 | — |

Ba mục Six Sigma (5–7) đã làm xong ngày 2026-09-11 — xem 4.1. Cả ba là **lệch
app cũ có chủ đích**: app cũ cũng sai như nhau nên `cross-app` không thể phát
hiện, và ba lệch đó nay được chốt tường minh trong bộ test.

**Ngoài phạm vi, đã đóng băng:** di trú dữ liệu từ app cũ (C4 — người dùng chốt
cắt thẳng, không di trú), gợi ý Bias tự động ở NCE, phân trang bảng điểm
Westgard.

---

### 4.2 Clinical Precision — hệ giao diện độc lập của QC Lab (2026-09-19) — 🟨

Người dùng quyết định **dừng toàn bộ kế hoạch chỉnh giao diện dựa trên app cũ
hoặc app cước phí**. Từ mốc này QC Lab có hệ giao diện riêng, ưu tiên cảm giác
chính xác, sạch, tin cậy và chuyên nghiệp của phần mềm y khoa desktop.

- ✅ Hệ token bốn lớp trong `renderer/styles/tokens.css`: primitive → vai trò
  → component → alias chuyển tiếp; CSS trang không được viết màu/cỡ chữ/bo
  góc tuỳ ý.
- ✅ Font Manrope với đúng bốn weight 400/500/600/700; thang chữ nguyên pixel,
  tương phản và focus được khóa bằng `tests/design-system.test.mjs`.
- ✅ Khung mới: sidebar navy có chiều sâu nhẹ, topbar trắng trong, khoảng lề
  trang rộng hơn và điều hướng active rõ nhưng không phủ teal khắp màn hình.
- ✅ Bề mặt mới: panel trắng, bo 8px, viền nhẹ và bóng rất mỏng; header panel
  dùng nền trắng thay cho các dải xám nặng. Trạng thái chọn/cảnh báo mới dùng
  bề mặt màu.
- ✅ Control và form chuẩn cao 40px; nhãn 12px/600, nội dung 14px/400.
  Bảng có header 40px, hàng danh sách 44px, nền trắng và hover teal rất nhạt.
- ✅ Dashboard là màn tham chiếu đầu tiên của ngôn ngữ mới: khối tiến độ có
  tint teal nhẹ, KPI trắng có accent mảnh, danh sách và bộ lọc dùng cùng nhịp.
- ✅ Bảng màu Clinical Precision chốt lại theo ba họ: clinical navy
  (`#172b35`), mineral teal (`#0b7c83`) và cool neutral. Toàn bộ cặp chữ/nền,
  trạng thái, nút và focus đạt gate tương phản, không còn ngoại lệ WCAG cũ.
- 🟨 Tiếp tục rà trực quan từng nhóm màn nghiệp vụ (Nhập QC, Westgard, Sigma,
  Cấu hình, Báo cáo, Cài đặt) để loại các override bố cục cũ còn sót; không
  mở lại việc “làm giống” bất kỳ ứng dụng nào khác.

---

### 4.1 Áp chuẩn quốc tế cho Six Sigma (2026-09-11)

Người dùng yêu cầu "vừa đối chiếu app cũ vừa đọc tài liệu Sigma chuẩn để áp
dụng chuẩn quốc tế". Ba mục dưới đây **app cũ cũng sai y hệt**, nên bộ đối
chiếu `cross-app` không thể phát hiện — mỗi mục nay có một bài test chốt theo
NGUỒN NGOÀI, sống tiếp sau khi cắt app cũ.

**(1) Bảng Westgard Sigma Rules theo SỐ MỨC QC.**
Nguồn: [Westgard Sigma Rules](https://www.westgard.com/lessons/westgard-rules/westgard-rules/westgard-sigma-rules.html).
Westgard công bố HAI bảng khác nhau:

| Sigma | 2 mức QC | 3 mức QC |
|---|---|---|
| ≥6 | `1-3s` · N=2 R=1 | `1-3s` · N=3 R=1 |
| 5–6 | `1-3s/2-2s/R4s` · N=2 R=1 | `1-3s/2of3-2s/R4s` · N=3 R=1 |
| 4–5 | +`4-1s` · N=4 R=1 (hoặc N=2 R=2) | +`3-1s` · N=3 R=1 |
| <4 | +`8x` · N=4 R=2 (hoặc N=2 R=4) | +`6x` · N=6 R=1 (hoặc N=3 R=2); `9x` thay `6x` → N=3 R=3 |

`QCCore.westgardSigmaRules(sigma)` của app cũ chỉ nhận sigma, nên dùng MỘT
bảng pha trộn: thêm `4-1s` ở 5σ, thêm `8x` ở 4σ, lấy `6x` (luật của bảng 3
mức) cho dưới 4σ, và N=8 ở 4σ/3σ — con số không có trong bảng nào. Hệ quả:
phòng chạy 3 mức nhận gợi ý của bảng 2 mức, và mọi tier từ 5σ xuống bị đề nghị
nhiều luật + nhiều điểm QC hơn Westgard khuyến nghị.

`sigmaQualityDesign(sigma, levelCount)` nay trả đúng hai bảng, kèm `levels`
(bảng nào được áp), `levelCount` (số mức thật), `tier` và `alternatives`. Giao
diện OPSpecs nói rõ "theo bảng Westgard Sigma Rules cho N mức QC". Sigma chưa
tính được thì trả `null` thay vì tier `<3` — app cũ nói "phương pháp chưa đủ
năng lực" cho một ô trống, vì `Number(null)` ra 0.

Test: `app-v2/tests/sigma-qc-design.test.mjs` (50 phép kiểm theo bảng công bố).

**(2) `u(Cref)` — độ không đảm bảo của GIÁ TRỊ GÁN.**
Nguồn: Nordtest TR 537 — `u(bias) = √(RMS_bias² + u(Cref)²)`, trong đó
`u(Cref)` là độ không đảm bảo của giá trị chứng nhận/giá trị gán: chứng chỉ
CRM lấy `U(Cref)/2`; kết quả PT/EQA theo ISO 13528 lấy `U/2` của giá trị gán.

Cả hai bản trước đó nạp vào chỗ đó **SD của chuỗi bias quan sát / √n** — sai số
chuẩn của chính ước lượng bias, một đại lượng khác hẳn, và là con số app tự
suy ra nên ngân sách MU **luôn "đủ thành phần" một cách giả tạo**.

Nay: `uCref` là một ô nhập riêng trong modal MU (có ghi rõ lấy số ở đâu), lưu
theo từng mức; thiếu thì **vắng mặt** và ngân sách bị đánh dấu chưa đủ, đúng
nguyên tắc đã áp cho `u(cal)` — không đọc là 0. Số SEM cũ được giữ lại dưới
tên đúng của nó (`biasSem`) làm chỉ số tham khảo, không vào ngân sách.

Ghi chú mô hình: app dùng `u_c = √(u(Rw)² + u(bias)² + u(cal)²)` — HỖN HỢP có
chủ đích. ISO/TS 20914 lấy `√(u(Rw)² + u(cal)²)` và đòi bias phải được **hiệu
chỉnh**; Nordtest cộng `u(bias)` khi bias không hiệu chỉnh. Công tắc
"Đưa u(bias) vào ngân sách" chính là chỗ chọn giữa hai nhánh, và đó là quyết
định của người phụ trách — phần mềm không tự chọn. Tắt nhánh bias thì không
đòi `u(Cref)` nữa.

Test: `app-v2/tests/sigma-metrics.test.mjs` (viết lại theo công thức thay vì so
với app cũ), `sigma-handlers.test.mjs`, và mục 9 của `cross-app` chốt lệch.

**(3) Cohort IQC phải TRONG TẦM KIỂM SOÁT.**
ISO/TS 20914 lấy `u(Rw)` từ dữ liệu IQC 6–12 tháng **đại diện cho hoạt động
thường quy đã được thẩm định sau khi quản lý QC** — tức mọi lần mất kiểm soát
đã được điều tra và xử lý. Một nhóm 30 điểm có 1 điểm +40 SD chưa ai đụng tới
không thoả điều kiện đó, nhưng cả hai bản vẫn gắn `eligible` và vẫn cho nó chi
phối khuyến nghị thiết kế QC.

Nay có trạng thái mới `out-of-control`: nhóm còn điểm vượt ±3SD **chưa** có hồ
sơ NCE đã duyệt + kết luận hiệu quả (khớp theo `point_id` đã có sẵn) thì không
được `eligible`. Hai quyết định quan trọng:

- **KHÔNG tự loại điểm mất kiểm soát khỏi CV.** Loại theo kết quả là selection
  bias — CV sẽ đẹp giả và MU/Sigma lạc quan hơn thực tế. Điểm vẫn nằm trong
  CV; thứ bị chặn là dùng nhóm đó để ĐỀ XUẤT thiết kế QC.
- **Cổng này là cổng THÔ (`1-3s`)**, không chạy toàn bộ multirule — module
  cohort cố ý không import engine Westgard. Một nhóm qua được cổng VẪN cần
  người phụ trách rà soát biểu đồ trước khi dùng.

Test: `app-v2/tests/sigma-cohort.test.mjs` mục (5).

**Verify chung:** `app-v2:typecheck` sạch, `app-v2:test` **78/78** (thêm
`sigma-qc-design.test.mjs`; `cross-app` lên 2463 phép), `app-v2:build` sạch,
`app-v2:css-parity` đạt. Cả ba bản sửa đều được chứng minh test BẮT ĐƯỢC lỗi
bằng cách hoàn tác tạm rồi xác nhận đỏ đúng assertion, sau đó phục hồi.

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
2. ✅ Hết 4 mục ưu tiên 1–2 ở bảng mục 4 (xong 2026-09-12).
3. ⬜ Người dùng xác nhận giao diện app-v2 đã đủ dùng (tiêu chí này thuộc về
   người dùng, **không** đo bằng gate parity).

Khi cắt: đổi `build.files`, xoá DB test, khởi tạo admin mới, xoá
`app-v2/tests/cross-app-westgard-sigma.test.mjs` (bộ dò trôi khi port, hết tác
dụng khi không còn app cũ), và loại file `.wasm` của sql.js khỏi gói Electron
(Electron dùng `node:sqlite`, không bao giờ tải WASM).
