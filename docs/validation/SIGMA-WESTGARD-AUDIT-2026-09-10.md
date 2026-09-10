# Rà soát sâu nghiệp vụ Six Sigma và Westgard — app-v2

**Ngày rà soát:** 10/09/2026  
**Mốc mã nguồn:** `a8ba010784615faa42f824173db6a22f4b6017cf` cộng các thay đổi Sigma/TEa chưa commit đang có trong working tree  
**Phạm vi:** công thức Sigma, nguồn TEa, chọn CV/Bias, gợi ý thiết kế QC, Westgard đơn mức/liên mức, CUSUM, tính điểm được chấp nhận, tính nhất quán giữa Entry/Westgard và tính truy vết lịch sử.

## Trạng thái từng phát hiện (cập nhật 10/09/2026, sau đợt sửa cùng ngày)

Phần thân dưới đây giữ NGUYÊN VĂN bản rà soát để truy xuất. Bảng này nói
mục nào đã xử lý, để lần đọc sau không sửa lại thứ đã sửa:

| Phát hiện | Trạng thái |
| --- | --- |
| Entry và Westgard không dùng cùng tập "mức QC đang vận hành" | **ĐÃ SỬA** — `activeLevels()` port đủ 2 cổng của `canEnterQcForLevel()` app cũ (nhóm lô còn vận hành + Panel QC đang hoạt động); `app-v2/tests/westgard-active-levels.test.mjs` chốt cả 4 nhánh kèm đối chứng |
| TEa cấp kỳ không giải lại theo Mean từng mức (CLIA tuyệt đối) | **ĐÃ SỬA** — `computeLevel()` xếp thứ tự snapshot theo mức → giải tại Mean của mức → `periodTea`; `app-v2/tests/sigma-level-tea.test.mjs` + mục 10 của `cross-app-westgard-sigma.test.mjs` |
| Cổng truy vết EFLM thiếu (mọi `tea` gõ tay đều thành "TEa EFLM") | **ĐÃ SỬA** — port `hasEflmTrace` app cũ, đối chiếu 45/45 tổ hợp |
| Nhãn tiêu chí CLIA in % đã quy đổi thay vì giới hạn tuyệt đối | **ĐÃ SỬA** — `teaCriterionText()` + suy `clia_rule` từ dữ liệu, đối chiếu 76/77 analyte |
| Điểm bị loại CHỈ bởi luật liên mức vẫn `accepted:true` | **GIỐNG APP CŨ** — `acceptedLotPoints()` app cũ cũng chỉ nhận tập luật `within` (đã đối chiếu trong mục 8 của `cross-app-westgard-sigma.test.mjs`). Đây là câu hỏi SẢN PHẨM, không phải lỗi port: đổi đi là lệch golden master có chủ đích, cần quyết định riêng |
| Luật `2of3-2s` và `7T` | **GIỐNG APP CŨ** — mục 1/2 của `cross-app-westgard-sigma.test.mjs` so registry + predicate của cả 13 luật và 29 chuỗi điểm (có tổ hợp `7T`/`10x`) đều khớp. Nếu sai thì sai từ app cũ, sửa là lệch golden master |
| Cohort IQC không kiểm trạng thái in-control | **CHƯA SỬA** — tầng cohort đã đối chiếu khớp app cũ (mục 11), nên đây cũng là câu hỏi sản phẩm chung cho hai bản |
| Bảng gợi ý Sigma Rules chưa đúng N/R theo số mức QC | **CHƯA SỬA** |
| Mô hình MU gán sai ý nghĩa `u(Cref)` | **CHƯA SỬA** — `uncertaintyBudget()` đã đối chiếu khớp app cũ (mục 9) |
## Kết luận điều hành

**Chưa nên coi nghiệp vụ Sigma/Westgard của app-v2 là đã được thẩm định để dùng làm căn cứ vận hành độc lập.** Lõi có nhiều phần làm đúng và thận trọng, nhưng còn ba lỗi mức cao có thể đổi kết luận QC hoặc làm đẹp/sai số liệu Sigma:

1. Entry và trang Westgard không dùng cùng tập “mức QC đang vận hành”, nên cùng một điểm có thể bị Entry kết luận **Loại bỏ** nhưng Westgard chỉ **Cảnh báo**.
2. Một điểm bị loại chỉ bởi luật liên mức vẫn có thể được gắn `accepted:true`, rồi lọt vào biểu đồ/thống kê “điểm được chấp nhận”.
3. Cohort IQC chỉ kiểm tra số lượng, lô và việc đổi Mean/SD; nó không kiểm tra trạng thái in-control/Westgard. Một cohort 30 điểm có 1 điểm lệch **+40 SD** vẫn được gắn `eligible` và được phép chi phối khuyến nghị QC theo Sigma.

Ngoài ra còn hai lỗi thuật toán rõ ràng ở luật tùy chọn `2of3-2s` và `7T`, một bảng gợi ý Sigma Rules chưa đúng N/R theo số mức QC, và mô hình MU đang gán sai ý nghĩa cho `u(Cref)`.

Điểm tích cực: công thức Sigma cơ bản đúng; 1-2s/1-3s/2-2s/R4s/4-1s/10x chủ đạo phần lớn đúng; R4s được giới hạn trong cùng run; Mean/SD được snapshot theo điểm; CUSUM reset khi đổi baseline; thay đổi TEa đang làm đã xử lý đúng bài toán CLIA dạng giới hạn tuyệt đối theo Mean từng mức.

## Chuẩn đối chiếu và cách đánh giá

- Westgard định nghĩa 1-2s là cảnh báo, 1-3s/2-2s/R4s/4-1s/10x là tiêu chí loại; R4s chỉ được xét **within-run**; 2-of-3-2s là bất kỳ 2 trong 3 điểm cùng phía vượt 2 SD; 7T là **bảy phép đo** tăng/giảm liên tục. N là tổng số phép đo QC sẵn có lúc ra quyết định. [Westgard multirules](https://www.westgard.com/westgard-rules.html)
- Westgard Sigma Rules có thiết kế khác nhau cho 2 và 3 mức QC: với 2 mức, 5σ dùng 1-3s/2-2s/R4s, N=2 R=1; 4σ thêm 4-1s và ưu tiên N=4 R=1 hoặc N=2 R=2; dưới 4σ thêm 8x và tăng R. Với 3 mức, 5σ dùng 1-3s/2of3-2s/R4s, 4σ thêm 3-1s, dưới 4σ thêm 6x và N=6 hoặc tăng R. [Westgard Sigma Rules](https://www.westgard.com/lessons/westgard-rules/westgard-rules/westgard-sigma-rules.html)
- CLSI C24 yêu cầu chiến lược SQC được thiết kế cho từng hệ thống đo, gồm xác lập target/SD, tần suất/lịch QC, hiệu năng phát hiện lỗi và quy trình phục hồi out-of-control; C24 không đưa một bảng luật duy nhất dùng cho mọi máy/xét nghiệm. [CLSI C24](https://clsi.org/shop/standards/c24/)
- CLSI EP23 đặt QC trong mô hình nguy cơ theo hệ thống đo, môi trường phòng xét nghiệm và mục đích lâm sàng. [CLSI EP23](https://clsi.org/shop/standards/ep23/)
- CLSI EP15 mô tả thiết kế thực nghiệm có cấu trúc để ước lượng precision và bias; chất lượng giá trị gán của vật liệu quyết định ý nghĩa của bias. [CLSI EP15](https://clsi.org/shop/standards/ep15/)
- ISO/TS 20914 là hướng dẫn hiện hành cho ước lượng và biểu diễn MU trong phòng xét nghiệm y khoa. [ISO/TS 20914:2019](https://www.iso.org/standard/69445.html?browse=tc)
- Trong mô hình Nordtest, `u(Cref)` là độ không đảm bảo chuẩn của giá trị chứng nhận/giá trị gán, không phải SEM của chuỗi bias phòng xét nghiệm; mô hình top-down cơ bản kết hợp `u(Rw)` và `u(bias)`. [Nordtest TR 537](https://www.nordtest.info/wp/wp-content/uploads/2017/11/NT_TR_537_edition4_English_Handbook_for_calculation_of_measurement_uncertainty_in_environmental_laboratories.pdf)
- EFLM tách riêng APS cho imprecision, bias, maximum allowable uncertainty và TEa; chúng không phải một đại lượng có thể thay thế nhau mặc định. [EFLM — APS từ biological variation](https://www.eflm.eu/upload/publications/2030-2024-ClinChemLabMed-Sandberg-et-al.pdf.pdf)
- CMS-3355-F là tiêu chí chấp nhận **proficiency testing** của Hoa Kỳ. Quy định có hiệu lực 11/07/2024 và được triển khai 01/01/2025; dùng nó làm TEa cho Sigma là một lựa chọn chính sách cần ghi rõ, không phải yêu cầu phổ quát cho mọi ứng dụng lâm sàng. [CMS implementation notice](https://www.cms.gov/medicare/provider-enrollment-and-certification/surveycertificationgeninfo/administrative/implementation-notification-final-rule-cms-3355-f-clinical-laboratory-improvement-amendments-1988)

## Phát hiện chi tiết

### [P1] Entry và Westgard có thể cho hai kết luận khác nhau

`westgard-handlers.ts:87-103` chỉ lấy mức có lô thuộc nhóm đang vận hành và chỉ lấy điểm khi xét nghiệm nằm trong panel hoạt động. Ngược lại, `entry-handlers.ts:115-130` lấy mọi `test_levels`, kể cả lô thuộc nhóm `stopped`, `planned`, `active=0`, hoặc lô không thuộc nhóm; số mức này còn quyết định scope within/across.

Ca tái hiện bằng DB thật:

- Mức 1 đang chạy: +2,5 SD.
- Mức 2 thuộc nhóm đã dừng: +2,5 SD, cùng run.
- Entry: `rej`, luật `1-2s + 2-2s`.
- Westgard: `warn`, chỉ `1-2s`.

Đây là sai lệch quyết định QC, không phải khác biệt trình bày. Cần dùng chung một khái niệm `operationalLevels` ở cả hai handler và thêm test đối xứng Entry ↔ Westgard.

### [P1] Điểm bị loại bởi luật liên mức vẫn được tính là “accepted”

`westgard-handlers.ts:242` tạo verdict hợp nhất đơn mức + liên mức, nhưng `westgard-handlers.ts:260-263` lại tính `acceptedIds` bằng `acceptedPoints()` trên riêng từng mức với `active.within`. Vì vậy R4s, 2-2s hoặc 2of3-2s nổ chỉ ở phạm vi across có thể tạo trạng thái mâu thuẫn:

```text
verdict = rej
rules = [2-2s]
accepted = true
```

Ca đối chứng với hai mức cùng run, mỗi mức +2,1 SD đã cho đúng trạng thái trên. Cần xây chuỗi accepted ở cấp run/multi-level, hoặc tối thiểu loại mọi điểm có verdict hợp nhất `rej` trước khi đưa vào thống kê/biểu đồ. Khi sửa phải xác định rõ rejected run có bị bỏ khỏi cửa sổ đánh giá các run sau hay không và áp dụng nhất quán.

### [P1] Cohort Sigma “eligible” chưa chứng minh quá trình ổn định

`sigma-cohort.ts:65-109` loại điểm void/rỗng, tách lô và kiểm tra Mean/SD snapshot có đổi hay không. Nó không đọc verdict Westgard, không phát hiện outlier/shift/trend, không có bước review/phê duyệt và không kiểm tra trạng thái vận hành của lô.

Ca đối chứng: 29 điểm bằng 100, một điểm bằng 140, target 100/SD 1. Kết quả hiện tại:

```text
n = 30
CV = 7,2069%
issues = []
status = eligible
```

Điểm cuối lệch +40 SD nhưng cohort vẫn đủ điều kiện chi phối “Thiết kế QC dùng chung”. Điều này có thể làm CV tăng mạnh, Sigma giảm giả tạo và dẫn tới khuyến nghị siết QC không phản ánh trạng thái ổn định; chiều ngược lại cũng có thể xảy ra nếu người dùng đã void/chỉnh chọn dữ liệu không phù hợp.

Khuyến nghị: không tự động xóa mọi điểm Westgard-reject khỏi CV (việc đó có thể tạo selection bias). Thay vào đó cần workflow review có truy vết: hiển thị số điểm reject/warn, trạng thái NCE/khắc phục, cho người có thẩm quyền chấp nhận/loại từng lý do; chỉ cohort đã được phê duyệt mới mang trạng thái `eligible-for-design`.

### [P1] `2of3-2s` bỏ sót một cửa sổ hợp lệ

Trong `westgard-engine.ts:90-95`, engine chỉ kích hoạt khi **điểm hiện tại** vượt 2 SD và ít nhất một trong hai điểm trước vượt. Với chuỗi z `[+2,1; +2,2; 0]`, cửa sổ ba điểm có đúng 2/3 điểm cùng phía vượt +2 SD nhưng engine trả cả ba là `ok`.

Luật đúng là “trong ba kết quả có ít nhất hai điểm cùng phía vượt 2 SD”, không yêu cầu điểm thứ ba phải là một trong hai điểm vi phạm. Cần quét cả cửa sổ `[i-2..i]`, xác định mọi điểm vượt ngưỡng là evidence và gắn trigger cho điểm chốt cửa sổ/run theo quy ước UI.

Mức ảnh hưởng hiện tại thấp hơn các P1 trên vì luật mặc định đang tắt và scope mặc định là across khi có 3 mức; tuy nhiên người dùng có thể bật/chuyển scope, và Sigma Rules cho 3 mức dùng chính luật này.

### [P2] `7T` đang định nghĩa 8 điểm thay vì 7 điểm

Registry ghi “7 lần tăng/giảm liên tiếp (8 điểm QC)” và `westgard-engine.ts:97-101` đợi `i >= 7`, tức tám phép đo và bảy bước tăng/giảm. Tài liệu Westgard định nghĩa 7T là **bảy control measurements** tăng hoặc giảm dần. Chuỗi bảy điểm tăng liên tục hiện trả `ok`.

Nếu phòng xét nghiệm muốn dùng biến thể “7 bước/8 điểm”, phải đặt tên khác và mô tả là local rule; còn tên 7T chuẩn nên dùng bảy điểm.

### [P1] Bảng gợi ý Sigma Rules chưa đúng theo N/R và số mức QC

`sigma-metrics.ts:24-31` chỉ nhận một giá trị Sigma, không nhận số mức kiểm soát, tần suất run hay mục tiêu P_ed/P_fr. Các khác biệt cụ thể:

| Mức Sigma | App hiện tại | Westgard Sigma Rules |
|---|---|---|
| ≥6 | 1-3s, N=2 R=1 | Phù hợp cho thiết kế 2 mức; với 3 mức là N=3 R=1 |
| ≥5 | thêm 2-2s/R4s/4-1s, N=4 | 2 mức: 1-3s/2-2s/R4s, N=2 R=1; 3 mức: 1-3s/2of3-2s/R4s, N=3 R=1 |
| ≥4 | thêm 8x, N=8 R=1 | 2 mức: thêm 4-1s, N=4 R=1 hoặc N=2 R=2; 3 mức: thêm 3-1s, N=3 R=1 |
| 3–<4 | dùng 6x, N=8 R=1 | 2 mức thường thêm 8x và tăng số run; 3 mức dùng 6x với N=6 R=1 hoặc N=3 R=2 |

UI có ghi “gợi ý” và không tự áp luật — đây là hàng rào tốt — nhưng nhãn “Westgard Sigma Rules (OPSpecs)” khiến bảng trông như ánh xạ chuẩn. Cần tạo thiết kế theo ít nhất: số mức QC, N mỗi run, R/ngày; tốt hơn là thêm P_ed/P_fr và đánh giá nguy cơ theo CLSI C24/EP23.

### [P1] `u(Cref)` bị tính sai đại lượng; trạng thái MU có thể gây hiểu nhầm

`sigma-metrics.ts:51-69` gán `biasRefU = SD(các bias vòng EQA) / sqrt(n)` và gọi đó là `u(Cref)`. Đây là SEM của các sai lệch quan sát tại phòng xét nghiệm, không phải độ không đảm bảo của giá trị gán EQA/CRM. `u(Cref)` phải đến từ nhà cung cấp/PT scheme hoặc từ quy trình xác lập target, và có thể khác theo từng vòng.

Hệ quả:

- Scatter của các vòng vừa nằm trong RMSbias vừa đi vào `biasRefU`, có nguy cơ đếm chồng.
- Độ không đảm bảo thật của target EQA không được nhập/lưu.
- UI cho phép một vòng EQA và vẫn có thể báo “Đủ thành phần” nếu có `uCal`, dù Nordtest khuyến nghị dữ liệu PT đủ nhiều vòng để ước lượng ổn định.
- `uCal` được cộng bắt buộc vào `uRw + uBias` mà chưa chứng minh thành phần này chưa được bao phủ trong dữ liệu dài hạn; có nguy cơ đếm hai lần.
- So trực tiếp `U <= TEa` là chỉ báo tham khảo, không tương đương kiểm tra MAU. EFLM cung cấp MAU và TEa riêng.

Cần đổi model dữ liệu EQA: provider/scheme, peer group/method, ngày, target, uncertainty target chuẩn hoặc expanded + k, tính commutability/ghi chú. Tách rõ hai đầu ra: Sigma bias estimate và MU bias component; không buộc cùng một phép tổng hợp.

### [P2] Bias RMS cho Sigma là chính sách bảo thủ, không phải estimator chuẩn mặc định

`eqaRoundsStats()` dùng RMS của nhiều bias có dấu để tránh triệt tiêu. RMSbias phù hợp với một số mô hình Nordtest cho thành phần MU, nhưng dùng thẳng RMSbias làm `|Bias|` trong công thức Sigma là lựa chọn nội bộ, không phải quy tắc duy nhất của Westgard/CLSI. Nó trộn độ lệch hệ thống với biến thiên giữa vòng EQA và thường làm Sigma thấp hơn.

Nên cho phép cấu hình/chứng minh phương pháp lấy bias: method comparison, CRM, mean signed bias theo cùng concentration/peer group, hoặc RMS theo SOP. Báo cáo phải ghi estimator, số vòng, khoảng ngày và nguồn target.

### [P2] Tính bất biến và phê duyệt kỳ Sigma chưa đủ

`sigma-handlers.ts:236-246` cho technician cập nhật kỳ cũ tại chỗ; `renamePeriod()` đổi tháng; admin có thể xóa thật. Period lock của báo cáo chỉ chặn add/void điểm QC, không khóa Sigma. Audit ghi “Sửa kỳ Six Sigma” nhưng không snapshot before/after CV/Bias/TEa/MU.

Thay đổi chưa commit hiện nay ưu tiên giải lại TEa từ **cấu hình hiện tại** khi bản ghi cũ thiếu `levels[].tea`, trước khi dùng `periodTea`. Điều này sửa đúng ý nghĩa CLIA theo mức, nhưng có thể làm số Sigma lịch sử đổi theo TEa ref/Mean hiện hành mà không tạo audit. Đặc biệt `tea_source` trong dữ liệu cũ có thể là mã (`clia`) hoặc nhãn/criterion tự do, nên khả năng backfill không đồng nhất.

Khuyến nghị: kỳ Sigma có trạng thái draft/reviewed/approved/locked; approved là append-only/versioned. Backfill TEa theo mức phải là migration có version, báo cáo tác động và audit; nếu không đủ Mean snapshot thì đánh dấu “không tái lập được”, không lấy Mean hiện hành im lặng.

### [P2] Catalog TEa có nguồn rõ nhưng chưa đủ để tự nhận là bộ tiêu chí CLIA hoàn chỉnh

Phần đang sửa làm đúng hai việc quan trọng: match analyte chính xác, và chỉ áp giới hạn tuyệt đối khi đơn vị khớp. Tuy nhiên:

- CMS-3355-F là tiêu chí PT, không mặc nhiên là TEa tối ưu cho mọi mục đích lâm sàng.
- Catalog thiếu hoặc chưa mô hình hóa hết các tiêu chí absolute/greater-of, ví dụ pH ±0,04; Urea Nitrogen ±9% hoặc ±2 mg/dL; một số measurand/đơn vị của catalog không trùng tên pháp quy. [42 CFR §493.931, bản 2025](https://www.govinfo.gov/content/pkg/CFR-2025-title42-vol5/pdf/CFR-2025-title42-vol5-sec493-931.pdf)
- Nguồn Ricos 2014 đã cũ; Westgard ghi nhận EFLM/SEQC yêu cầu ngừng bổ sung cơ sở dữ liệu này và chuyển sang EFLM. [Thông báo về Ricos/BV database](https://www.westgard.com/clia-and-quality-regulation-requirements/quality-requirements/optimal-biodatabase1htm.html)
- “EFLM” trong app là số nhập tay kèm metadata, không phải tra cứu/đồng bộ live database. Cách làm này chấp nhận được nếu UI gọi đúng là “nhập từ EFLM” và bắt buộc tài liệu/ngày/APS/người duyệt.

Nên version catalog theo nguồn + ngày hiệu lực + ngày rà soát; thêm automated fixture đối chiếu toàn bảng pháp quy, thay vì chỉ đối chiếu app-v2 với catalog app cũ.

### [P2] Nhãn loại sai số có thể tự mâu thuẫn

`westgard-rules.ts:65-90` chọn mô tả theo rule có priority cao nhất, nhưng `errorType()` ưu tiên bất kỳ SE nào trước RE. Ví dụ:

```text
rules: 1-3s + 2-2s
type:  SE — Sai số hệ thống
desc:  1 điểm QC vượt ±3SD   (rule được gắn RE)
```

Với nhiều rule cùng nổ, không nên ép thành một loại duy nhất. Có thể hiển thị `SE + RE`, hoặc lấy cả type và description từ cùng primary rule rồi ghi các rule còn lại là evidence.

### [P2] Backend tin metadata cohort do renderer gửi lên

`savePeriod()` kiểm tra `cohortN` là số nguyên không âm nhưng không xác nhận `cvSource`, lot/date/status/CV với dữ liệu `qc_points`. Một caller qua `window.qcApi` có thể tự gửi `cohortStatus:'eligible'` và khiến UI dùng nó cho gợi ý thiết kế QC. Với app Electron có F12/DevTools, đây không chỉ là giả thuyết API từ xa.

Backend nên nhận `cohortId` hoặc khóa định danh `(test, level, lot, cutoff, reviewVersion)`, tự tính/lấy snapshot đã phê duyệt, không nhận kết luận eligibility từ client.

## Những phần đã đúng hoặc có hàng rào tốt

- `Sigma = (TEa - |Bias|) / CV` được cài đúng và từ chối TEa/CV không dương.
- DPMO/Yield ghi rõ dùng dịch 1,5σ và chỉ mang tính tham khảo.
- Bias thiếu không bị ngầm coi là 0; chưa đủ CV/Bias thì không tạo Sigma lạc quan.
- CV nhập tay hoặc cohort <30 điểm không được dùng để sinh thiết kế QC chung ở UI.
- TEa snapshot theo mức giải đúng bài toán CLIA absolute khác nhau theo Mean từng mức; snapshot có sẵn thắng cấu hình hiện hành.
- Điểm QC dùng snapshot Mean/SD lúc nhập, tránh viết lại lịch sử sau khi đổi range.
- R4s chỉ xét trong cùng run; run ID mới có prefix ngày và được dùng chung giữa các mức.
- 1-2s mặc định là cảnh báo, không loại; action/scope có thể cấu hình theo xét nghiệm.
- CUSUM hai phía có k/h, reset khi baseline đổi và chỉ nâng cảnh báo ở trang phân tích; không lẫn vào verdict Westgard.
- Điểm void không tham gia phân tích; add/void QC bị chặn khi kỳ báo cáo đã khóa.

## Về bộ test hiện tại

Kết quả tại working tree lúc rà soát:

```text
npm run app-v2:test       72/72 pass
npm run app-v2:typecheck  pass
```

Suite có chất lượng tốt ở regression, IPC/SQLite thật và parity với app cũ. Tuy nhiên dòng “2305 phép đối chiếu Westgard/Sigma đều khớp” chỉ chứng minh hai phiên bản giống nhau; nếu app cũ có cùng định nghĩa sai thì cả hai vẫn xanh. Chính test `westgard-engine.test.mjs` hiện mô tả 7T là 8 điểm, nên đang khóa hành vi cũ thay vì kiểm chứng theo chuẩn ngoài.

Các test bắt buộc nên thêm:

1. Bảng truth-table độc lập cho từng rule, gồm mọi vị trí của 2-of-3 và đúng bảy điểm cho 7T.
2. Contract test cùng DB: `entry.queryPoints()` và `westgard.analyzeLevel()` phải trả cùng verdict/rules/accepted cho cùng point.
3. Ca stopped/planned/inactive/no-group/no-panel cho cả Entry, Westgard, Dashboard và Sigma cohort.
4. Accepted-chain test có R4s/2-2s/2of3 across-level.
5. Cohort stability/review test với outlier, shift, trend, NCE và quyết định include/exclude có audit.
6. Sigma Rules matrix test theo số mức QC × Sigma × N/R.
7. MU test lấy `u(Cref)` từ từng EQA round; không suy nó từ SD bias.
8. Fixture đối chiếu catalog CLIA với bản CFR hiện hành và migration/version test khi nguồn TEa thay đổi.
9. Test lịch sử: approved period không đổi khi Mean/TEa ref/catalog hiện tại thay đổi.

## Thứ tự sửa đề xuất

1. **Dừng dùng thiết kế QC tự động trong quyết định vận hành** cho tới khi sửa P1 về cohort và Sigma Rules; giữ nó ở trạng thái “tham khảo/chưa thẩm định”.
2. Hợp nhất nguồn operational levels và contract Entry ↔ Westgard.
3. Thiết kế accepted-chain đa mức, rồi sửa thống kê/Levey-Jennings.
4. Sửa truth-table `2of3-2s`, `7T`, và nhãn SE/RE hỗn hợp.
5. Thêm workflow cohort review/phê duyệt; backend tự xác nhận provenance.
6. Viết lại `sigmaQualityDesign()` theo số mức + N/R và bổ sung đánh giá P_ed/P_fr/risk.
7. Tách mô hình Bias cho Sigma khỏi u(bias) cho MU; thêm uncertainty của target EQA và MAU.
8. Version hóa TEa/catalog và khóa/version kỳ Sigma đã duyệt.
9. Chạy OQ/PQ với bộ dữ liệu thật, được người phụ trách chuyên môn phòng xét nghiệm duyệt trước khi phát hành.

## Phán quyết cuối

- **Westgard lõi:** đúng phần lớn luật kinh điển, nhưng **chưa đạt** vì có lỗi liên màn hình, accepted-chain, 2-of-3 và 7T.
- **Sigma metric:** công thức số học **đúng**, nhưng chất lượng đầu vào CV/Bias/TEa và bảng thiết kế QC **chưa đủ đúng để tự động hóa quyết định**.
- **MU:** cấu trúc top-down có hướng đúng, nhưng `u(Cref)` và tiêu chí “đủ thành phần/U ≤ TEa” cần sửa trước khi gọi là phù hợp ISO/TS 20914/Nordtest.
- **Sẵn sàng sản xuất:** phù hợp cho pilot/validation nội bộ; **chưa phù hợp để coi là công cụ quyết định QC đã thẩm định**.
