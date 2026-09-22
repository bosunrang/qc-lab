# Rà soát chuyên sâu thẻ Westgard — lần 2 — 22/09/2026

## Cập nhật khắc phục

**Đã sửa toàn bộ WG-15 → WG-25.** Phần mô tả bên dưới là ghi nhận **trước
sửa**; số dòng cũ không còn là vị trí hiện hành.

- **WG-15** — `WG_RULE_REGISTRY` khai kênh hỗ trợ qua `allowedRuleScopes()`;
  `makeScopeOf()`, `parseRuleScopes()` (đường backup) và `saveRuleScope()`
  (IPC) đều chặn scope không có engine, dropdown chỉ hiện lựa chọn hợp lệ.
- **WG-16** — `acceptedRunPoints()` chỉ loại cả lần chạy theo `level === 'rej'`;
  điểm có `z` không hữu hạn chỉ rụng chính nó.
- **WG-17/WG-18** — `errorClass()` / `normalizeErrorClass()` trong registry;
  trang Hành động và các cổng ghi NCE dùng chung mã `SE|RE|''`.
- **WG-19** — họ luật đếm chuỗi cắt theo `trendTarget`, ở **cả** kênh trong-mức
  lẫn kênh liên mức (chia epoch theo mốc đổi Mean/SD).
- **WG-20** — `2of3-2s` trong-mức gán kết luận cho **điểm vượt mới nhất trong
  cửa sổ**, không phải điểm chốt cửa sổ. Với `[+2,5; +2,5; 0,0]` điểm z = 0 nay
  là "Đạt" và `acceptedRunPoints()` loại đúng lần chạy có điểm vượt.
- **WG-21** — `evaluateQcSets()` nhận `levelCount` tường minh; tab lô cũ truyền
  số mức của cả nhóm lô.
- **WG-22** — `MultiLevelSet.key` phân biệt lô, hai lô cùng mức không đè nhau.
- **WG-23** — `globalRuleList()` phân giải qua `makeRuleActionLayered()`.
- **WG-24** — `listParallelColumns()` đánh giá **cả bộ cột song song** qua
  `evaluateQcSets()` + `acceptedRunPoints()`, cùng đường với chuỗi đang vận
  hành và tab lô lịch sử: luật liên mức (R4s/2-2s/2of3-2s/3-1s) và mốc "đã
  khắc phục xong" nay đều áp. Các cột song song chỉ gộp với NHAU — chúng là
  các mức của cùng một lô mới trong cùng lần chạy; không trộn với lô đang vận
  hành để kết luận thẩm định lô mới không lẫn với kết luận thường quy.
  `EntryPage` dùng cờ `accepted` của main thay cho `verdict !== 'rej'` theo
  từng điểm.
- **WG-25** — `WESTGARD_RULES = WG_RULES`.

Kiểm thử: `westgard-standard.test.mjs` đổi kỳ vọng ở ca `2of3-2s` (assertion cũ
khoá đúng hành vi sai) và thêm ca cửa sổ kết thúc bằng điểm vượt; thêm
`app/tests/entry-parallel-lot-cross-level.test.mjs` cho WG-24, trong đó có một
assertion chốt tiền đề — chạy riêng từng mức thì cặp ±2,5SD chỉ ra `1-2s`, nên
ca test mất ý nghĩa nếu ai quay về `westgardByPoint()` per-column.

### Dọn nốt cột `actions.error_type` (tiếp theo WG-18)

WG-18 đã chuẩn hoá phía ĐỌC; lượt dọn này chuẩn hoá nốt phía GHI và dữ liệu đã
lưu, để cột chỉ còn chứa mã `SE` / `RE` / `''`:

- `ERROR_CLASS_LABEL` trong `westgard-rules.ts` là nguồn duy nhất của nhãn hiển
  thị; `errorType()` nay chỉ là `ERROR_CLASS_LABEL[errorClass(...)]`.
- `createRangeAction()` ghi `''` — loại việc đã nằm ở cột `rule`
  ("Thiết lập dải QC mới" / "Hoàn dải QC") và cờ `rangeWorkflow` trong
  `detail_json`, không nhét mô tả vào cột phân loại sai số.
- `migrate-legacy.ts` (nạp backup app cũ) và `nce-handlers.reopen()` (chép lại
  hồ sơ cũ) đều đi qua `normalizeErrorClass()`.
- `applySchema()` thêm một bước di trú idempotent dọn dữ liệu đã lưu; phép ánh
  xạ SQL được test đối chiếu trực tiếp với `normalizeErrorClass()`.
- Chỗ hiển thị: hộp thoại duyệt NCE và bảng NCE của trang Báo cáo đọc mã ra
  nhãn thay vì in thô; CSV xuất mã đã chuẩn hoá. Bảng điểm Westgard dùng
  `ERROR_CLASS_LABEL.SE` cho tín hiệu CUSUM thay vì mã trần `'SE'` đứng cạnh
  "SE — Sai số hệ thống" của các luật khác.

Kiểm thử: `app/tests/action-error-class.test.mjs` (4 ca — hằng nhãn, bước di
trú idempotent đối chiếu `normalizeErrorClass()`, ba cổng ghi thật qua handler,
và các chỗ hiển thị).

Xác minh sau sửa: **156/156 test đạt**, `npm run typecheck`, `npm run build`,
`npm run app:css-parity` đều đạt. `docs/westgard-review-probes-2026-09-22-lan2.cjs`
nay PHẢI fail (nó khẳng định trạng thái lỗi), đúng như thiết kế.

Tiếp nối `WESTGARD-REVIEW-2026-09-22.md` (WG-01…WG-14, đã sửa). Lần này rà
phần **cấu hình luật, phân giải phạm vi, tập accepted và đường NCE** — những
chỗ lần 1 chưa chạm tới. Đánh số tiếp từ **WG-15** để không đụng số cũ.

## Phạm vi và bằng chứng

- Đọc `westgard-rules.ts` (registry 13 luật), `westgard-engine.ts` (đơn mức /
  liên mức / accepted / CUSUM), `rule-config.ts` (phân giải 3 tầng action +
  scope), `westgard-evaluation.ts`, `operational-levels.ts`,
  `historical-westgard.ts`, `lot-lineage.ts`, `westgard-handlers.ts`,
  `entry-handlers.ts`, `sigma-cohort.ts`, `WestgardPage.tsx`,
  `ActionsPage.tsx`, `manage/TestsTab.tsx`.
- Chạy `npm test`: **139/139 đạt**. Không test nào phủ các ca dưới đây.
- Mọi phát hiện đều **chạy thật** trên `app-dist` vừa build từ mã hiện tại,
  không suy đoán từ đọc mã. Script tái hiện:
  `docs/westgard-review-probes-2026-09-22-lan2.cjs`.

P1: có thể làm sai kết luận QC hoặc làm luật không còn hiệu lực. P2: sai biểu
diễn, sai dữ liệu ghi vào hồ sơ, hoặc mất nhất quán giữa các màn hình.

---

## Phát hiện

### WG-15 — P1: Ghi đè "Phạm vi áp dụng" có 4 tổ hợp làm luật CHẾT ÂM THẦM

Hai kênh đánh giá không cài đặt cùng một tập luật:

| Kênh | Luật có cài đặt |
|---|---|
| `within` — `westgard()` (`westgard-engine.ts:61`) | 1-3s, 1-2s, 2of3-2s, 7T + họ chuỗi |
| `across` — `westgardMultiByPoint()` (`westgard-engine.ts:207`) | R4s, 2-2s, 2of3-2s, 3-1s + họ chuỗi |

Không có ở `across`: **1-3s, 1-2s, 7T**. Không có ở `within`: **R4s**.

Mặc định `defaultRuleScope()` không bao giờ rơi vào các ô trống đó, nhưng
`manage/TestsTab.tsx:400` cho chọn **cả ba** phạm vi cho **mọi** luật, không
cảnh báo gì.

**Đã tái hiện:**

```
R4s  scope=within  -> []   (một mức +3SD, một mức −3SD cùng run: không nổ)
1-3s scope=across  -> []   (điểm z=+4: không nổ)
1-2s scope=across  -> []
7T   scope=across  -> []   (8 điểm tăng đều: không nổ)
```

Phòng xét nghiệm đặt 1-3s thành "Chỉ chéo mức/lần chạy" là từ đó **không còn
điểm 1-3s nào bị loại**, không cảnh báo, không log. Đây là lỗi an toàn nặng
nhất của đợt rà này.

Hướng sửa: khai báo kênh hỗ trợ ngay trong `WG_RULE_REGISTRY`, rồi (a)
`makeScopeOf()` kẹp về phạm vi hợp lệ và (b) `effectiveRuleConfigList()` trả
danh sách scope cho phép để dropdown chỉ hiện đúng lựa chọn.

### WG-16 — P1: Một mức chưa có Mean/SD làm hỏng `accepted` của MỌI mức cùng lần chạy

`acceptedRunPoints()` (`westgard-engine.ts:303`) loại cả run khi *bất kỳ* điểm
nào có `z` không hữu hạn. `listOperationalLevels()` **không** lọc mức có
`mean/sd` NULL, và `addPoint()` cũng không chặn nhập khi mức chưa có dải — tức
đúng giai đoạn thiết lập Mean/SD cho mức hoặc lô mới.

**Đã tái hiện:**

```
Mức 1 (Mean/SD đầy đủ, 3 điểm đúng tâm): verdict  = ok, ok, ok
                                          accepted = false, false, false
Mức 2 (chưa có Mean/SD, cùng 3 run)     : accepted = false, false, false
Đối chứng (cả hai mức đều có dải)        : accepted = true, true, true
```

Hệ quả người dùng thấy: mức 1 hoàn toàn đạt nhưng mọi điểm mang thẻ đỏ
"Lần chạy bị loại" (`WestgardPage.tsx:548`, tooltip còn giải thích sai là
"Mức khác trong cùng lần chạy bị loại"), CV ở Tổng quan = `—`,
`observedStats()` n=0, export ghi "Dùng thống kê: Không", CUSUM không còn điểm
nào để chạy.

Hướng sửa: tách "chưa đánh giá được" khỏi "mất kiểm soát". Chỉ
`flag.level === 'rej'` mới loại cả run; điểm có `z` không hữu hạn bị loại khỏi
thống kê **riêng nó**, không kéo theo mức khác.

### WG-17 — P1: Phân loại SE/RE ở trang Hành động không đọc registry — sót 9x, 12x

`ActionsPage.tsx:25` hardcode `SE_RULES`, thiếu đúng hai luật:

```
registry SE : 2-2s, 3-1s, 4-1s, 6x, 8x, 9x, 10x, 12x, 7T, 2of3-2s
ActionsPage : 2-2s, 3-1s, 4-1s, 6x, 8x,      10x,      7T, 2of3-2s
MISSING     : 9x, 12x
```

Vi phạm 9x hoặc 12x → hiện **"RE — Sai số ngẫu nhiên"**, gợi ý xử lý sai hướng
(bọt khí/pipet thay vì hiệu chuẩn/lô thuốc thử), và `error_type` sai đó được
ghi thẳng vào hồ sơ NCE. Trái với tuyên bố ở đầu `westgard-rules.ts` rằng mọi
danh sách dẫn xuất phải tính từ registry.

Hướng sửa: trang này đã import từ `../../main/domain/*`, dùng thẳng
`errorType()` / `WG_RULE_BY_ID`.

### WG-18 — P2: `actions.error_type` có 3 bộ từ vựng, UI so sánh `=== 'SE'`

| Nguồn ghi | Giá trị thực ghi vào DB |
|---|---|
| `entry-handlers.ts:460` — hủy điểm mở NCE | `'SE — Sai số hệ thống'` |
| `entry-handlers.ts:273` — hồ sơ quản lý dải | `'Quản lý dải kiểm soát'` |
| Form NCE (`nce-handlers.ts:54`) | `'SE'` / `'RE'` |

`ActionsPage.tsx:272` là `record.error_type === 'SE' ? 'Sai số hệ thống' :
'Sai số ngẫu nhiên'` → hai nguồn đầu **hiển thị ngược thành "Sai số ngẫu
nhiên"**; `<select>` ở dòng 406 hiện trống vì giá trị không khớp option nào.

Hướng sửa: chuẩn hoá về mã `SE`/`RE` ngay tại cổng ghi; phần mô tả dài để
renderer tự dựng.

### WG-19 — P2: Luật đếm chuỗi đếm xuyên qua lần đổi Mean/SD, CUSUM thì reset

`cusumScan()` reset C+/C−/MA khi `target.key` đổi (`westgard-engine.ts:347`),
có lập luận rõ trong comment: "không được mang phần cộng dồn của dải CŨ sang
dải MỚI". Họ luật chuỗi thì không — `sameTrendTarget()` đã tồn tại trong cùng
file nhưng chỉ dùng cho 7T.

**Đã tái hiện** — 5 điểm +1,5SD trên dải (10;1) rồi 5 điểm +1,5SD trên dải
(20;1):

```
6x    : - - - - - 6x 6x 6x 6x 6x
10x   : - - - - - -  -  -  -  10x      (đếm 5 điểm dải cũ + 5 điểm dải mới)
4-1s  : - - - 4-1s 4-1s ...
cusum : 1 2 3 4 5 | 1 2 3 4 5           (reset đúng chỗ)
```

Lập luận của CUSUM áp dụng y hệt cho 6x/8x/9x/10x/12x/4-1s/3-1s/2-2s. Cần chốt
một hướng cho cả hai.

### WG-20 — P2: `2of3-2s` trong-mức dán "Loại bỏ" lên điểm ĐẠT

`westgard-engine.ts:106` lấy điểm chốt cửa sổ làm điểm nổ, kể cả khi điểm đó
nằm trong kiểm soát.

**Đã tái hiện** với `z = [+2,5; +2,5; 0,0]`:

```
điểm 1: Đạt      (bằng chứng 2of3-2s)
điểm 2: Đạt      (bằng chứng 2of3-2s)
điểm 3: Loại bỏ  ← z = 0
```

Comment tại chỗ biện hộ bằng "`acceptedPoints()` quét tăng dần, chỉ đọc điểm
mới nhất" — nhưng `acceptedPoints()` đang là `@deprecated` và **chỉ còn test
tham chiếu**; luồng vận hành dùng `acceptedRunPoints()`. Lý do giữ nguyên đã
hết hiệu lực.

Hướng sửa: trigger = `pos.at(-1)` / `neg.at(-1)`. Vẫn giữ quy ước "điểm mới
nhất mang kết luận" mà không dán nhãn sai lên điểm trong kiểm soát.

### WG-21 — P2: Tab lô cũ/lưu trữ tính số mức khác với các trang khác

`evaluateQcSets()` (`westgard-evaluation.ts:21`) suy `levelCount` từ chính các
set truyền vào. Mọi nơi khác truyền `listOperationalLevels()`; riêng
`historical-westgard.ts:92` truyền các **lô lưu trữ tra được Mean/SD**. Một lô
mức 2 không tra được dải → `levelCount = 1` → 2-2s/6x/10x tụt về `within`
thuần, cùng một điểm cho hai kết luận ở hai tab.

Đây đúng là bất biến mà `operational-levels.ts:60` tuyên bố phải giữ ("phải
giống nhau ở MỌI endpoint… chuỗi lô cũ") và là lý do `listParallelColumns()`
gọi `countOperationalLevels()`.

Hướng sửa: truyền `levelCount` tường minh vào `evaluateQcSets()`, lấy từ
`countOperationalLevels()`.

### WG-22 — P2: Nhiều lô cùng một mức trong nhóm lưu trữ → điểm bị nuốt ở kênh liên mức

`westgard-engine.ts:224` `byLevel.set(set.level, item)` — mỗi `(run, level)`
chỉ giữ **một** điểm, ghi sau đè ghi trước.

**Đã tái hiện** — lô A mức 1 (z=+3), lô B mức 1 (z=+3,5), mức 2 (z=−3), cùng
run `r1`:

```
R4s gán cho B và mức 2; điểm A KHÔNG nhận luật liên mức nào
```

Luồng vận hành an toàn (mỗi mức một lô + cổng `duplicate-run` ở
`entry-handlers.ts:370`), nhưng `analyzeHistoricalLots()` truyền một set cho
mỗi **lô**, nên nhóm lưu trữ chứa hai lô cùng mức là va.

Hướng sửa: key theo `(level, lot)`, hoặc gộp set theo mức trước khi đánh giá.

### WG-23 — P2 nhỏ: Panel "Cấu hình chung" đọc sai nếu `app_meta` chứa chuỗi hành động

`globalRuleList()` (`rule-config.ts:68`) chỉ nhận `boolean`, trong khi
`parseRuleActions()` chấp nhận cả `'alert'/'reject'/'inactive'`. Backup phục
hồi có chuỗi hành động ở `app_meta.westgardRules` → panel hiện mặc định
registry còn `makeRuleActionLayered()` chạy theo chuỗi đã lưu.

### WG-24 — P2 nhỏ: Cột lô song song chỉ chạy kênh trong-mức

`listParallelColumns()` (`entry-handlers.ts:176`) gọi `westgardByPoint(...,
within, ...)` → R4s/2-2s liên mức giữa hai cột song song không bao giờ nổ;
không áp mốc reset sau khắc phục. Ngoài ra `EntryPage.tsx:758` coi
`verdict !== 'rej'` là accepted (theo từng điểm), khác ngữ nghĩa loại-cả-run ở
mọi chỗ khác.

### WG-25 — P2 nhỏ: `WESTGARD_RULES` hardcode lại registry

`manage/shared.tsx:22` liệt kê lại 13 mã luật. Đã kiểm: **hiện còn khớp đúng
`WG_RULES` cả nội dung lẫn thứ tự** — đây là rủi ro trôi, không phải lỗi đang
xảy ra. Thêm luật vào `WG_RULE_REGISTRY` sẽ không hiện trong modal
"Sửa xét nghiệm".

---

## Điểm cần chốt theo SOP (không phải lỗi phần mềm)

Với 3 mức, `6x` phạm vi `both` + hành động `reject` nghĩa là **2 lần chạy cùng
phía Mean là loại**. Cả `6x` và `10x` đều `defaultOn`. Khuyến cáo của Westgard
cho N=3 là `9x` (chính registry cũng ghi vậy ở phần mô tả), nhưng `9x` lại
`defaultOn: false`. Nên đối chiếu lại với SOP về tỉ lệ loại giả.

## Những phần đã kiểm và đúng

- Ngưỡng chặt của `1-3s` (`>3`, không phải `>=3`).
- `2-2s`, `4-1s` trong-mức và liên mức.
- `R4s` đòi cả hai phía vượt ±2SD **và** biên độ `>4SD`, chỉ trong một run.
- `7T` đúng bảy phép đo / sáu bước, có cổng `sameTrendTarget()`.
- Ưu tiên snapshot `qc_mean`/`qc_sd` theo từng điểm ở mọi đường đánh giá.
- Cắt giai đoạn theo ngày khắc phục đã duyệt + hiệu quả; ngày hoàn thành thuộc
  giai đoạn cũ.
- Phân giải hành động 3 tầng (ghi đè xét nghiệm → cấu hình chung → registry)
  nhất quán giữa Nhập QC và Phân tích Westgard.
- CUSUM là tín hiệu riêng, không tự biến điểm QC thành reject, không làm bẩn
  tập accepted.
- Cohort Sigma cố ý chỉ dùng cổng thô |z| ≥ 3 và bắt người phụ trách rà soát —
  đúng quyết định đã chốt, không phải thiếu sót.

## Vì sao 139/139 test vẫn đạt?

Bộ test phủ kỹ **thuật toán** nhưng gần như không phủ **cấu hình**: không có ca
nào đặt scope ghi đè lệch kênh (WG-15), không có ca nào để một mức thiếu
Mean/SD trong khi mức khác có (WG-16), không có ca nào so danh sách SE ở
renderer với registry (WG-17), không có ca nào đọc lại `error_type` đã ghi
(WG-18), và không có ca nào đổi Mean/SD giữa chuỗi rồi kiểm luật đếm (WG-19).

## Thứ tự xử lý đề xuất

1. **WG-15, WG-16** — hai lỗi làm sai kết luận QC đang vận hành. Sửa trước.
2. **WG-17, WG-18** — sai dữ liệu ghi vào hồ sơ NCE; ảnh hưởng hồ sơ pháp lý.
3. **WG-19, WG-20** — chốt chính sách rồi sửa engine một lần, kèm ca tái hiện.
4. **WG-21, WG-22** — nhất quán tab lô cũ/lưu trữ với luồng vận hành.
5. **WG-23 → WG-25** — dọn trùng lặp nguồn sự thật.

Đây là rà soát mã kèm tái hiện bằng engine đã build, chưa phải thẩm định lâm
sàng hay xác nhận toàn bộ SOP của phòng xét nghiệm. Không có thay đổi sản phẩm
nào được thực hiện trong báo cáo này.
