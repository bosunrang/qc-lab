# Rà soát chuyên sâu Six Sigma & Sai số — 22/09/2026

## Cập nhật khắc phục

Đã triển khai sửa SG01–SG06, SG08–SG12 và bổ sung hàng rào an toàn cho SG07.
Các mô tả lỗi và kết quả probe ở phần bên dưới là **ghi nhận trước sửa**.

- SG01/02/03/11: mã nguồn đúng, blur không thay đổi không ghi dữ liệu, xác
  nhận khi đổi nguồn CV/Bias, kiểm tra ô EQA trống và chặn request/modal cũ.
- SG04/05/06: MDC dùng cùng TEa với Sigma; EFLM lưu riêng; tiêu chí TEa theo
  mức được chụp lại, đổi lô quy đổi từ tiêu chí đó. Không đoán tiêu chí của kỳ
  cũ bị thiếu. EFLM cũ cần xác nhận lại thay vì coi số dùng chung là đáng tin.
- SG07/08: xác nhận rà soát SOP có người/thời điểm/fingerprint trước đề xuất;
  dữ liệu/luật/NCE thay đổi gỡ hiệu lực rà soát; thiếu target bị chặn. Không
  tự chuyển cổng thô thành bộ đánh giá multirule đầy đủ, cũng không tự chứng
  nhận dữ liệu lâm sàng. Thiết kế chung chỉ hiện khi tất cả mức đủ điều kiện.
- SG09/12: không kết luận MU đạt TEa khi thiếu thành phần; export giữ cảnh
  báo/nguồn, không xuất U chưa đầy đủ như kết quả cuối. Hướng dẫn u=U/k và
  chuyển sang %, preview modal cập nhật từ draft.
- SG10: các write bao gồm audit trong transaction; thử lỗi audit cho tạo,
  sửa, đổi kỳ, xóa, tracking và TEa đều rollback.
- Bổ sung: đồ thị không kẹp Sigma ở 0–8; giữ snapshot CV khi sửa Bias/MU;
  không đổi tháng của kỳ đã gắn cohort; chuẩn hóa mã nguồn viết hoa;
  PDF tách thông tin truy xuất khỏi bảng số, dùng bố cục ngang.

Kiểm thử chính thức mới: `app/tests/sigma-review-regressions.test.mjs` (gồm
handler SQLite thật, các hàm renderer/store thực tế và render React SVG/modal).
Script `docs/sigma-review-probes-2026-09-22.cjs` chỉ lưu các ca tái hiện **trước
sửa**, không còn là tiêu chí pass trên bản đã sửa. Chạy `npm test` để xác minh
bản hiện tại. Không sửa hay xóa QC thật trong quá trình kiểm thử.

Kết quả xác minh sau sửa: **139/139 test đạt** (17 ca hồi quy mới),
`npm run typecheck` và `npm run build` đạt. Build vẫn có cảnh báo kích thước
bundle >500 kB. `npm run app:css-parity` còn báo class `wg-chart-mode` ở
`WestgardPage.tsx` chưa có CSS rule; file đó không bị sửa trong lượt Sigma.
Không có kiểm thử click toàn luồng Electron hoặc nghiệm thu chuyên môn
trên dữ liệu lâm sàng thật; đây là các giới hạn cần giữ khi diễn giải kết quả.

## Kết luận

Chưa nên xác nhận thẻ này đã đúng nghiệp vụ toàn diện. Công thức lõi và bảng Sigma Rules có nhiều phần đúng, nhưng luồng nhập/lưu, nguồn TEa, điều kiện đề xuất QC và xuất báo cáo còn vấn đề có thể làm sai kết quả hoặc mất truy xuất dữ liệu.

Ghi nhận 12 mục: 9 mục P1 cần ưu tiên, 3 mục P2. Trong đó SG07 là giới hạn an toàn đã được tài liệu thiết kế thừa nhận, không phải một hồi quy vừa phát sinh; SG12 là hướng dẫn chuyên môn thiếu điều kiện. Không có kết luận về việc các lỗi này đã xảy ra trên dữ liệu thật.

Phạm vi: trang `SigmaPage`, store, biểu đồ, IPC, phép tính Sigma/Bias/MU, TEa, cohort IQC, thiết kế QC, xuất Excel/in PDF. Không phải kiểm định lại toàn bộ thẻ Khắc phục sự cố. Đã đối chiếu `docs/APP-PLAN.md` mục 3.5 và 4.1; đường dẫn `APP-V2-PLAN.md` trong AGENTS không còn tồn tại ở checkout này.

## Kiểm chứng

- `npm test`: **122/122 đạt** trên mã hiện tại.
- `node docs/sigma-review-probes-2026-09-22.cjs`: **11 tình huống được tái hiện**, kết thúc exit code 0.
- Script dùng SQLite `:memory:`, handler thật đã build bởi bộ test, và trích các hàm/biểu thức không chứa JSX từ renderer hiện tại. Không thao tác database người dùng.
- SG01/05/06 tái hiện payload của giao diện qua handler; SG02/03/08/09/11 thực thi các hàm hoặc đoạn tính toán trích trực tiếp; SG04 thực thi biểu thức chọn TEa của MDC. Đây không phải kiểm thử click trên Electron/DOM thực tế.
- Chỉ tạo báo cáo và script kiểm chứng; **không sửa mã sản phẩm**. Script cố ý xác nhận hành vi lỗi hiện tại, không được coi là bộ regression test yêu cầu hành vi đúng. Sau khi sửa phải đảo kỳ vọng và đưa test phù hợp vào bộ chính.

## Các phát hiện cần ưu tiên

### SG11 — P1: Phản hồi cũ có thể hiển thị và ghi dữ liệu sang xét nghiệm mới

Vị trí: `app/renderer/store/sigma-store.ts:38`; `app/renderer/pages/SigmaPage.tsx:195`, `:338`, `:365`.

`loadPeriods()` luôn ghi phản hồi vào một mảng dùng chung, không kiểm tra request mới nhất và không xóa dữ liệu cũ lúc đổi xét nghiệm. Trang không lọc lại `period.testId`; các lệnh lưu lại sử dụng `testId` đang chọn thay vì xác nhận kỳ thuộc xét nghiệm đó.

Tái hiện: yêu cầu A rồi B; trả B trước, A sau → cuối cùng store chứa A. Thực thi `commitBias` với kỳ cũ A nhưng test đang chọn B: CV của B từ **7 thành 0,58**, dù thao tác chỉ sửa Bias và 0,58 là CV của A. Trường hợp nhanh có thể chỉ tạo cửa sổ ngắn; phản hồi đảo thứ tự làm dữ liệu cũ tồn tại lâu hơn.

Khắc phục: request revision/key theo test; xóa/khóa dữ liệu trong lúc tải; kiểm tra quyền sở hữu kỳ trước mọi lần sửa/export/modal; không cho phản hồi cũ ghi đè state mới. Test phải bao gồm cả tải trễ và sửa sau chuyển xét nghiệm.

### SG02 — P1: Chỉ rời ô CV/Bias cũng thay đổi nguồn dữ liệu, làm tròn và mất vòng EQA

Vị trí: `SigmaPage.tsx:62`, `:338`, `:365`, `:544`, `:550`.

Ô nhập dùng `toFixed(2)` rồi luôn lưu khi blur, không kiểm tra người dùng có thực sự thay đổi hay không. `commitCv()` chuyển CV sang nhập tay và xóa nguồn lô/n/ngày/trạng thái. `commitBias()` xóa toàn bộ `eqaRounds`.

Tái hiện: CV cohort **0,5753559618 → 0,58**, nguồn `iqc-cohort → manual`; Bias **2,3449999999 → 2,34**; **1 vòng EQA → 0 vòng** sau gọi đúng hai hàm blur với chuỗi đang hiển thị. Hậu quả gồm sai Sigma, mất hồ sơ nguồn và mất điều kiện đề xuất QC.

Khắc phục: không lưu blur khi giá trị không đổi; phân biệt sửa giá trị với chuyển nguồn; giữ độ chính xác gốc; yêu cầu hành động rõ ràng trước khi thay dữ liệu được suy từ EQA/cohort bằng số nhập tay.

### SG01 — P1: Nút thêm kỳ gửi mô tả nguồn TEa vào trường chỉ chấp nhận mã nguồn

Vị trí: `SigmaPage.tsx:232`, `:348`; `app/main/ipc/sigma-handlers.ts:309`.

Trang gán `configuredTeaSource = teaResolution.criterion`, trong khi handler chỉ chấp nhận `lab/eflm/clia/ricos` hoặc rỗng. `criterion` là mô tả để đọc, không phải mã.

Tái hiện với Sodium: TEa được phân giải hợp lệ nhưng payload gửi **`CLIA: ±4 mmol/L`** → **`invalid-tea-source`**, không tạo được kỳ. Các mô tả mặc định của EFLM/Ricos/Lab cũng không thuộc enum. Lỗi không phụ thuộc công thức Sigma.

Khắc phục: tách mã nguồn và mô tả tiêu chí; lưu đủ snapshot truy xuất, không dùng cùng một trường cho cả hai. Bổ sung kiểm thử payload thực tế của nút thêm kỳ cho cả bốn nguồn.

### SG05 — P1: Đổi nguồn TEa làm mất giá trị EFLM nhưng giữ nhãn và tài liệu EFLM

Vị trí: `SigmaPage.tsx:238`; `sigma-handlers.ts:212`; `app/main/domain/sigma-tea-core.ts:71`.

`tests.tea` dùng chung cho các nguồn. Chuyển sang CLIA ghi giá trị CLIA vào đó. Quay về EFLM không gửi lại số EFLM cũ; handler giữ số CLIA, trong khi metadata EFLM vẫn còn nên resolver nhận số này là EFLM.

Tái hiện: **EFLM 10% → CLIA 2,857142857% → EFLM 2,857142857%**, vẫn giữ tài liệu EFLM ban đầu. Có thể làm sai các kỳ mới hoặc kỳ chưa có snapshot; không khẳng định các snapshot mức đã chốt bị đổi theo.

Khắc phục: lưu giá trị và nguồn chứng cứ riêng cho EFLM; chuyển nguồn không ghi đè giá trị nhập tay của nguồn khác; migration không tự đoán lại số EFLM đã mất.

### SG06 — P1: Chọn lô khác đổi Mean nhưng giữ TEa% của lô cũ

Vị trí: `SigmaPage.tsx:698`; `sigma-handlers.ts:287`; `sigma-handlers.ts:100`.

Nạp cohort cập nhật CV và Mean mục tiêu nhưng giữ nguyên `level.tea`. Handler tự kiểm CV/n/ngày/trạng thái, song không đồng bộ Mean và TEa với cohort. Snapshot mức lại được ưu tiên cao nhất khi tính Sigma.

Tái hiện giả lập: Sodium ±4 mmol/L, snapshot cũ Mean 140 nên TEa 2,857%. Chọn cohort Mean 100: Mean đổi thành 100 nhưng TEa vẫn 2,857% thay vì 4%. Với CV đã tái hiện, Sigma hiện **4,96587**, trong khi dùng TEa của lô được chọn ra **6,95222**. Đây là thay đổi cả bậc thiết kế QC.

Khắc phục: ràng buộc snapshot TEa với nguồn/tiêu chí/Mean/lô và phiên bản; khi chủ động đổi cohort phải có bước đánh giá lại đồng bộ. Không giải lại tất cả lịch sử từ cấu hình hiện tại một cách âm thầm.

### SG04 — P1: Biểu đồ MDC ưu tiên TEa cấp kỳ, mâu thuẫn với Sigma theo mức

Vị trí: `app/renderer/components/SigmaCharts.tsx:102`.

MDC dùng `period.tea ?? levelData.sigma.tea`; backend ưu tiên TEa của mức. Khi các mức có TEa khác nhau, biểu đồ dùng mẫu số sai.

Tái hiện: TEa kỳ 4%, mức 1 là 2%, mức 2 là 8%; cả hai có CV 1%, Bias 0,5%. Sigma đúng lần lượt **1,5 và 7,5**, nhưng MDC đặt cả hai tại tỷ lệ CV/TEa 25%, Bias/TEa 12,5%, tương ứng **3,5σ**. Tooltip có thể nói một Sigma trong khi vị trí biểu đồ nói một chất lượng khác.

Khắc phục: dùng cùng TEa thực sự đã tính Sigma của từng mức; một hàm chuẩn hóa duy nhất cho bảng, biểu đồ và export; test đặc biệt cho giới hạn tuyệt đối theo nồng độ.

### SG03 — P1: Bỏ trống kết quả PXN trong EQA bị hiểu là kết quả bằng 0

Vị trí: `SigmaPage.tsx:805`.

Parser chuyển chuỗi trống qua `Number('')`, thành 0. Điều kiện `complete` dùng OR, còn kiểm tra thiếu chỉ kiểm số hữu hạn/target khác 0; không phát hiện ô kết quả đang trống.

Tái hiện: **KQ PXN trống, Target 100 → Bias −100%**, `hasIncompleteRound=false`; handler nhận `lab:0` và lưu thành công. Đây không phải yêu cầu cấm kết quả 0 thực: phải phân biệt 0 có nhập với chưa nhập.

Khắc phục: kiểm tra cả hai chuỗi trước chuyển số; không cho vòng nhập dở thành dữ liệu; giữ khả năng nhận số 0 thực khi phép đo cho phép.

### SG08 — P1: Thiết kế QC “dùng chung” bỏ qua mức đang mất kiểm soát

Vị trí: `SigmaPage.tsx:274`, `:593`.

Trang lọc bỏ mọi mức không `eligible` trước khi chọn Sigma thấp nhất. Cách này có thể đúng để đưa đề xuất riêng cho mức đủ dữ liệu, nhưng không đủ căn cứ gọi đó là thiết kế chung của xét nghiệm.

Tái hiện: mức 1 **6σ, eligible**; mức 2 **2σ, out-of-control** → đề xuất chung **1-3s**, lấy mức 1 quyết định. Bảng từng mức có cảnh báo và phía dưới có ghi chú tham khảo, nhưng thông điệp dùng chung vẫn mâu thuẫn với mức 2.

Khắc phục: khi mức liên quan còn thiếu/chưa ổn định, chặn kết luận chung hoặc chỉ ghi rõ đề xuất cục bộ chưa được hợp nhất. Không tự dùng số 2σ chưa đáng tin như một thiết kế cuối cùng. Bảng quy tắc theo Sigma tự nó không thay thế đánh giá dữ liệu đầu vào. [Westgard Sigma Rules](https://www.westgard.com/lessons/westgard-rules/westgard-rules/westgard-sigma-rules.html).

### SG09 — P1: MU chưa đủ thành phần vẫn được xuất như kết quả hoàn chỉnh

Vị trí: `app/main/domain/sigma-metrics.ts:190`, `:210`; `SigmaPage.tsx:306`, `:619`.

Hàm vẫn trả U từ các thành phần hiện có và `withinTea=true/false` dù `complete=false`. Giao diện có badge “Chưa đủ”, nhưng tỷ lệ U/TEa vẫn có thể xanh. Excel/PDF xuất U, U tuyệt đối và U/TEa mà không xuất cờ chưa đủ hoặc các thành phần còn thiếu.

Tái hiện: CV 1%, Bias 0, TEa 10%, chưa có u(Cref)/u(cal) → **U=2%, withinTea=true, complete=false**. Dòng xuất chứa **2%; U tại Mean=2; U/TEa=20%**, không kèm cảnh báo thiếu hai thành phần.

Khắc phục: không kết luận đạt TEa khi ngân sách thiếu; nếu vẫn hiển thị tổng tạm tính phải gắn nhãn ngay cạnh số, truyền nhãn đó sang mọi đường export. Xuất thêm mô hình MU, thành phần, nguồn, k, trạng thái và điều kiện áp dụng. DPMO trong file cũng cần giữ chú thích “quy đổi tham khảo với dịch 1,5σ” đang có trên giao diện.

## Các mục P2 và điều kiện chuyên môn

### SG07 — P2: `eligible` chỉ là qua cổng thô, không chứng minh IQC ổn định

Vị trí: `app/main/domain/sigma-cohort.ts:55`, `:120`, `:135`.

Tái hiện cả hai nhóm đều `eligible`: (a) 30 điểm liên tục nằm khoảng +1,25 đến +1,30 SD; (b) 30 điểm không có snapshot Mean/SD. Nhóm (a) có chuỗi thỏa các luật dịch chuyển như 4-1s/10x nếu chúng đang được áp dụng, nhưng cổng cohort chỉ xét từng điểm ±3SD. Nhóm (b) không đủ căn cứ tự kiểm tình trạng kiểm soát.

Đây là **giới hạn đã được chủ ý ghi trong APP-PLAN mục 4.1**. Không gọi hành vi này là sai so với thiết kế hiện tại. Tuy nhiên, UI dùng trạng thái này để mở đề xuất QC mà không có bản ghi rà soát chuyên môn; cần làm rõ “đủ số điểm” khác “đã được duyệt ổn định”. Số điểm cũng không chứng minh dữ liệu đại diện đủ ngày, thay lô thuốc thử hoặc hiệu chuẩn.

Hướng xử lý cần chốt SOP: đánh giá multirule theo cấu hình thật và/hoặc bước duyệt có truy xuất; thiếu snapshot cần cảnh báo; lựa chọn thời gian đại diện không nên hard-code thành một quy định ISO chưa được xác minh. Không tự xóa những điểm xấu để làm đẹp CV. Cần đánh giá các luật đang vận hành chứ không mặc định mọi luật đều bật.

### SG10 — P2: Ghi Sigma và audit không nguyên tử

Vị trí: `sigma-handlers.ts:315`, `:321`; các write handler khác cùng file.

Tái hiện trên database giả: trigger làm INSERT vào `activity` thất bại; `savePeriod()` ném lỗi nhưng bản ghi kỳ mới **vẫn tồn tại**. Do SQL thay đổi dữ liệu được thực hiện trước audit mà không cùng transaction; thông báo thay đổi cũng không chạy.

`renamePeriod()` có transaction cho đổi ID/tháng nhưng audit ở sau COMMIT. `saveTeaConfig`, tracking, xóa kỳ có cùng cấu trúc cần rà và test riêng. Không khẳng định các nhánh này đều đã được fault-injection trong script; script hiện chứng minh trực tiếp nhánh tạo kỳ.

Khắc phục: authorize → validate → transaction bao gồm dữ liệu và audit → notify sau commit, theo AGENTS. Test thất bại audit phải chứng minh toàn bộ dữ liệu rollback.

### SG12 — P2: Hướng dẫn MU mặc định chia 2 thiếu điều kiện và đơn vị

Vị trí: `SigmaPage.tsx:924`, `:926`.

Hướng dẫn lấy U(Cref)/2 hoặc U/2 không nói điều kiện chứng chỉ phải có **k=2**. Ô u(Cref) yêu cầu %, còn ô u(cal) không ghi rõ % trong label. Chứng chỉ có thể cho U bằng đơn vị nồng độ hoặc k khác 2.

Nguyên tắc: dùng **u=U/k** với k trên chứng chỉ; nếu số là tuyệt đối thì **u%=100×u/|giá trị tham chiếu|**. Ví dụ U=6 đơn vị, k=3, giá trị tham chiếu=100: u=2 đơn vị=2%; chia 2 cho ra 3%, sai. Đây là đối chiếu hướng dẫn với định nghĩa, không phải một lỗi làm phép chia bên trong app: app nhận số người dùng đã quy đổi. [NIST — Expanded uncertainty and coverage factors](https://physics.nist.gov/cuu/Uncertainty/coverage.html).

Khắc phục: hướng dẫn và nhãn rõ đơn vị; nhập/lưu được U, k, giá trị tham chiếu và nguồn chứng chỉ nếu muốn phần mềm hỗ trợ chuyển đổi. Nếu chỉ nhận u% đã tính, phải nói rõ và không mặc định U/2 cho mọi chứng chỉ.

## Quan sát bổ sung, chưa tính vào 12 mục chính

- `SigmaCharts.tsx:74`: đường xu hướng kẹp Sigma vào 0–8 mà không gắn dấu vượt thang cho từng điểm. Cần thang thích ứng hoặc dấu/tooltip giá trị thật để không làm −2 và 0, hay 8 và 20, trông như nhau.
- `SigmaPage.tsx:913–930`: kết quả trong modal MU đọc `level.mu` đã lưu, không tính lại từ draft đang chỉnh. Nên ghi “giá trị đã lưu” hoặc cập nhật preview để tránh hiểu là kết quả của số vừa nhập.
- `sigma-handlers.ts:345`: đổi tháng chỉ sửa ID/tháng, không tái đánh giá cohort của tháng mới. Đây là API có sẵn; chưa chứng minh một luồng UI hiện tại sử dụng nó. Cần test nếu tiếp tục hỗ trợ API này.
- Một lần lưu Bias/MU có thể tự tính lại CV của tất cả mức có nguồn cohort từ dữ liệu IQC hiện tại. Cần chốt đây là đánh giá động hay hồ sơ đã duyệt; nếu là hồ sơ đã duyệt, phải có phiên bản và thông báo khi dữ liệu nền thay đổi.
- Validator nhận `CLIA` viết hoa nhưng resolver so sánh mã nguồn phân biệt hoa/thường. Cần thống nhất mã chuẩn, đồng thời giữ nguyên mô tả lịch sử ở trường riêng. Đây là kiểm tra tĩnh, chưa nằm trong 11 probe.

## Những phần đã có cơ sở đúng

- Phép tính Sigma dùng `(TEa − |Bias|)/CV`; đây là công thức được Westgard công bố, khi các đầu vào được quy về cùng hệ đơn vị phù hợp. [Westgard — Advanced QC Strategies, phần công thức Sigma](https://westgard.com/downloads/free-book-preview-chapters-downloads/92-advanced-qc-strategies-2022/file.html).
- Bảng luật cho 2 và 3 mức được tách riêng; các bậc trong hàm thiết kế phù hợp bảng tham khảo đã đối chiếu. Đây không phải phê duyệt tự động một tần suất QC cho mọi xét nghiệm. [Westgard Sigma Rules](https://www.westgard.com/lessons/westgard-rules/westgard-rules/westgard-sigma-rules.html).
- SD cohort dùng mẫu số n−1, không trộn lô/mức, bỏ điểm void; không tự loại điểm mất kiểm soát để làm đẹp CV.
- Backend dựng lại CV/n/ngày/trạng thái từ dữ liệu IQC, không tin trực tiếp kết luận `eligible` do client gửi.
- Bias nhiều vòng dùng RMS theo chính sách đã chốt của app; không triệt tiêu vòng âm/dương bằng trung bình có dấu. Báo cáo này không đề nghị đổi chính sách đó một cách mặc định.
- Có phân biệt số 0 được đánh giá với thành phần MU chưa nhập, và không coi SEM của chuỗi Bias là u(Cref). Vấn đề còn lại là điều kiện sử dụng/xuất kết quả thiếu và quy đổi đầu vào.
- Hệ thống có snapshot TEa/Mean theo mức, nhưng các đường đổi cohort/nguồn và biểu đồ chưa giữ đúng tính nhất quán của chúng.

## Những điều phải được người phụ trách chuyên môn phê duyệt

1. Nguồn TEa, phiên bản, nồng độ/đơn vị, mục đích sử dụng và mức APS EFLM. Không coi một nguồn TEa là phù hợp cho mọi bối cảnh chỉ vì app có trong danh mục.
2. Dữ liệu CV đại diện hoạt động thường quy; khoảng thời gian, điều kiện ổn định, cách quản lý sự cố/đổi lô/hiệu chuẩn và bước duyệt.
3. EQA: nhóm so sánh/giá trị gán phù hợp, khoảng nồng độ đại diện từng mức, vòng đánh giá và khả năng truy xuất.
4. Mô hình MU đang dùng là lựa chọn thiết kế của app, không phải bằng chứng “đạt ISO”. Cần xác nhận thành phần không bị tính trùng, xử lý Bias, cách lấy u(cal)/u(Cref), k và điều kiện so sánh với TEa. Tài liệu Nordtest được viện dẫn có phạm vi gốc là phòng thử nghiệm môi trường/hóa học; việc dùng nó không tự chứng nhận ứng dụng cho xét nghiệm y khoa. [Nordtest TR 537 — phạm vi và lưu ý](https://www.nordtest.info/wp/2017/11/29/handbook-for-calculation-of-measurement-uncertainty-in-environmental-laboratories-nt-tr-537-edition-4/).

Không có đánh giá ISO/CLSI đầy đủ từng điều khoản, không kiểm định độ đúng của toàn bộ 77 dòng danh mục TEa, và không thẩm định bằng bộ dữ liệu lâm sàng độc lập trong lượt này. Không suy “đạt chuẩn” từ việc unit test xanh.

## Thứ tự khắc phục đề xuất

1. Bảo vệ dữ liệu: SG11, SG02, SG01, SG03, SG10.
2. Nhất quán TEa/Sigma/MDC: SG05, SG06, SG04; giữ và migration nguồn/snapshot rõ ràng.
3. An toàn kết luận QC/MU: SG08, SG09; chốt cổng duyệt SG07 và hướng dẫn SG12.
4. Regression test liên tầng + kiểm thử UI trên database giả, sau đó người phụ trách xét nghiệm nghiệm thu bộ ca chuẩn. Không sửa ngược lịch sử hoặc khôi phục số liệu đã mất bằng suy đoán.
