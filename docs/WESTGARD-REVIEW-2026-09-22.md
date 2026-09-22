# Rà soát chuyên sâu thẻ Westgard — 22/09/2026

## Cập nhật khắc phục sau khi được người dùng đồng ý

Đã triển khai bản sửa cho WG-01 đến WG-14; phần phát hiện bên dưới giữ nguyên
để làm bằng chứng trạng thái **trước sửa**, các số dòng cũ không còn là vị trí
hiện hành.

- WG-01/02/03/04: bảo toàn snapshot từng điểm, thứ tự ngày/run tự nhiên,
  định danh run gồm ngày, dùng chung bộ đánh giá lô lịch sử ở Entry và Westgard.
- WG-05/06/07: thống nhất verdict và accepted; loại cả run khỏi thống kê khi
  một mức bị loại. Không tự nhận lại điểm reject bằng cách quét chuỗi đã lọc.
  Chỉ bắt đầu giai đoạn mới sau ngày hoàn thành khắc phục đã duyệt, hiệu quả,
  không bị hủy. Quyết định này thay thế kỳ vọng legacy đã ghi trong test cũ;
  không thay đổi điều kiện thiết lập dải PXN hoặc cohort Sigma.
- WG-08/09/12/13: không để cảnh báo 1-3s che hành động 1-2s nghiêm ngặt hơn;
  chặn phản hồi cũ, hiện lỗi nạp; theo dõi đủ nguồn invalidation; thay đổi luật
  và audit cùng transaction, có thông báo khi thao tác thất bại.
- WG-10/11/14: export dùng cùng block đang xem, thêm lot/target/run/accepted/
  bằng chứng; tooltip mô tả đúng là xuất bảng (chưa xuất ảnh biểu đồ). LJ và
  CUSUM dùng chung trục run tự nhiên, hover đúng lot. Thống kê hiện n thật,
  trạng thái mẫu nhỏ/n<2 và giữ được SD nhỏ khác 0.
- Bổ sung `westgard-review-regressions.test.mjs`, `westgard-view.test.mjs`;
  cập nhật ca accepted theo quyết định mới và ca lô legacy thiếu nhóm.
  Các kiểm thử dùng SQLite bộ nhớ và API/canvas giả lập, không sửa DB người dùng.
- Kiểm chứng sau sửa: **122/122 test đạt**, `npm run typecheck` và
  `npm run build` đạt. Build còn cảnh báo kích thước bundle lớn; không có
  lỗi biên dịch. Có kiểm thử tọa độ canvas thật, không chỉ đối chiếu mã nguồn.
- Browser: xác nhận bản xem trước khởi động; phiên này chưa có tài khoản nên
  chưa kiểm thử trực quan bảng có dữ liệu hoặc bấm xuất PDF trong Electron.
  Không tạo tài khoản/dữ liệu vào hệ thống để vượt giới hạn này.

Giới hạn còn phải nghiệm thu: SOP thực tế của phòng xét nghiệm, mốc khắc phục
trong cùng ngày (DB chưa lưu tới run/giờ), và giao diện/export trên dữ liệu thật.
Đây là khắc phục phần mềm có kiểm thử, không phải chứng nhận lâm sàng.

## Kết luận

Chưa thể kết luận thẻ Westgard đúng nghiệp vụ từ đầu đến cuối. Các phép tính nền và nhiều luật đơn lẻ đã có kiểm thử tốt, nhưng cách chọn dữ liệu, đánh giá lịch sử, xác định lần chạy và đồng bộ kết quả còn tạo ra kết luận mâu thuẫn.

Không sửa mã sản phẩm trong lượt rà soát này. Mọi ca dữ liệu được chạy trong SQLite `:memory:`; các ca renderer chạy trong môi trường giả lập bộ nhớ. Không đọc hoặc thay đổi cơ sở dữ liệu vận hành của người dùng.

## Phạm vi và bằng chứng

- Đọc engine, registry 13 luật, cấu hình hành động/phạm vi, handler đang vận hành/lưu trữ/lô chuyển tiếp, chuỗi accepted, CUSUM, store, bảng, biểu đồ và đường xuất Excel/PDF.
- Đọc tài liệu hiện hành `docs/APP-PLAN.md`, đặc biệt mục 1.2 và 3.4. Tên `APP-V2-PLAN.md` trong AGENTS.md đã cũ; file hiện có là `APP-PLAN.md`.
- Chạy lại `npm test`: **107/107 test đạt**. Bài `westgard-standard.test.mjs` báo 183 phép kiểm đạt.
- Chạy thêm các tình huống biên độc lập trên handler/engine thật đã được build từ mã hiện tại; kiểm tra race trong store và tọa độ vẽ của hàm biểu đồ thật.
- Những phát hiện chỉ dựa trên mã nguồn được ghi rõ. Không coi kiểm tra tọa độ vẽ là kiểm thử giao diện tương tác hoàn chỉnh.

P1: ưu tiên cao vì có thể làm sai kết luận, nguồn dữ liệu hoặc diễn giải QC. P2: lỗi có điều kiện, sai biểu diễn/xuất dữ liệu hoặc thiếu kiểm soát tính nhất quán. Đây là ưu tiên sửa phần mềm, không phải phân loại sự cố lâm sàng đã xảy ra.

## Phát hiện

### WG-01 — P1: Lưu trữ làm mất Mean/SD tại thời điểm nhập

**Đã tái hiện bằng các handler công khai.** Với Mean=100, SD=2, nhập giá trị 107: Z=+3,5, vi phạm 1-3s, kết luận Loại bỏ. Sau đó đổi Mean cùng lô thành 110 và dừng nhóm lô. Thẻ lưu trữ trả Z=−1,5 và Đạt cho chính điểm đó.

`listArchivedBlocks()` chỉ SELECT `id,date,run_id,val`, rồi gán Mean/SD của lô vào tất cả điểm. Trong khi thẻ đang vận hành ưu tiên snapshot `qc_mean/qc_sd` của từng điểm. Một lô có nhiều giai đoạn Mean/SD sẽ bị đánh giá lại sai lịch sử, ngay cả khi bộ luật không đổi.

Vị trí: `app/main/ipc/westgard-handlers.ts:419–421`.

Hướng sửa: đọc snapshot từng điểm ở mọi đường phân tích; dùng target lịch sử làm dự phòng khi snapshot thực sự thiếu. Kiểm thử đổi dải nhiều lần trong cùng lô, không chỉ đổi sang lô khác.

### WG-02 — P1: Thứ tự lần chạy trong lưu trữ khác thẻ hiện hành

**Đã tái hiện.** Cùng một ngày, ba lần chạy 1, 2, 10 có Z lần lượt +2,5; 0; +2,5. Thẻ hiện hành giữ thứ tự 1→2→10, điểm cuối chỉ Cảnh báo. Thẻ lưu trữ dùng thứ tự chuỗi SQL 1→10→2, khiến hai điểm +2,5 thành liền nhau và phát sinh 2-2s/Loại bỏ.

Vị trí: `app/main/ipc/westgard-handlers.ts:419`. Thẻ hiện hành đã có comparator số tự nhiên trong `app/main/domain/sort-order.ts`.

Hướng sửa: thống nhất sắp theo ngày và số lần chạy ở tất cả đường dữ liệu, bao gồm lịch sử và biểu đồ.

### WG-03 — P1: “Xem lô cũ” bỏ luật liên mức

**Đã tái hiện.** Hai mức của cùng lần chạy có Z=+2,5 và −2,5. Khi xem qua “Nhóm lô đã dừng”, cả hai điểm vi phạm R4s và bị loại. Cùng các lô đó, qua nút “Xem lô cũ” chỉ còn 1-2s/Cảnh báo.

`listPreviousLotBlocks()` đánh giá từng mức riêng bằng `westgardByPoint()`, trong khi `listArchivedBlocks()` dùng bộ đánh giá ghép nhiều mức. Việc lô đã dừng không làm mất những lần chạy liên mức đã xảy ra trong quá khứ.

Vị trí: `app/main/ipc/westgard-handlers.ts:456–466`.

Hướng sửa: phục dựng các mức cùng lần chạy lịch sử, đánh giá nhất quán với thẻ lưu trữ. Nếu không đủ dữ liệu để kiểm tra luật liên mức, cần thể hiện giới hạn đánh giá thay vì ngầm trả kết luận như đã kiểm đủ.

### WG-04 — P1 có điều kiện: Mã lần chạy trùng ở hai ngày bị gộp

**Đã tái hiện qua `entry.addPoint()`.** Mức 1 ngày 01/08 có Z=+2,5; mức 2 ngày 02/08 có Z=−2,5; cùng mã tùy chỉnh `same-run`. App cho lưu hợp lệ nhưng ghép thành một lần chạy và báo R4s cho hai ngày khác nhau.

Engine chỉ lấy `runId` làm khóa. Khi cùng mức xuất hiện nhiều ngày với cùng mã, `Map.set(level, ...)` còn ghi đè điểm trước. Thứ tự chuỗi liên mức cũng chỉ sắp theo mã, thiếu ngày.

Vị trí: `app/main/domain/westgard-engine.ts:216–223`. Validation tại `app/main/domain/entry-validation.ts` cho phép mã tùy chỉnh; mã tự sinh theo ngày trong UI giảm khả năng gặp nhưng không đóng được lỗ hổng này.

Hướng sửa: định danh lần chạy bằng ngày+mã trong mô hình hiện tại, sắp theo ngày rồi mã tự nhiên; hoặc áp đặt một định danh run duy nhất và kiểm tra nó tại mọi cổng ghi.

### WG-05 — P1 về nhất quán: Điểm “Loại bỏ” vẫn vào thống kê “Thực tế”

**Đã tái hiện.** Ba lần chạy hai mức:

| Lần chạy | Z mức 1 | Z mức 2 |
|---|---:|---:|
| 1 | 0 | 0 |
| 2 | +2,5 | −2,5 |
| 3 | +2,2 | 0 |

Lần 2 bị R4s loại. Mức 1 lần 3 được bảng kết luận Loại bỏ/2-2s do xét chuỗi thô, nhưng `accepted=true` do cửa sổ accepted đã bỏ lần 2. Điểm này vẫn đi vào Mean/SD/CV thực và CUSUM.

Vị trí: `app/main/ipc/westgard-handlers.ts:299–331`, `app/main/domain/westgard-engine.ts:157–178`, `app/renderer/pages/WestgardPage.tsx:33–39`.

**Phân biệt thiết kế cũ với lỗi mới:** `app/tests/accepted-across-rules.test.mjs` mục 4 cố ý khóa hành vi này. Vì vậy không thể coi đây chỉ là một dòng code bị viết nhầm, hoặc đổi assertion để test xanh. Tuy nhiên UI hiện đưa ra một kết luận chung và gọi tập còn lại là “được chấp nhận”, nên hai ý nghĩa đó gây mâu thuẫn cho người dùng.

Hướng xử lý: thống nhất mô hình kết luận vận hành và tập điểm dùng cho thống kê; nếu giữ phân tích chuỗi thô như công cụ hồi cứu, cần đặt tên và giải thích riêng. Việc bỏ điểm phải gắn với quy trình xử lý sự cố, không chỉ lọc nối chuỗi tự động.

### WG-06 — P1 về chính sách thống kê: Chưa loại cả lần chạy mất kiểm soát

**Đã tái hiện.** Chỉ bật 1-3s: mức 1 Z=+3,5 bị loại, nhưng mức 2 cùng lần chạy Z=+0,7 vẫn `accepted=true` và tham gia thống kê.

Hiện `acceptedIdsOf()` loại theo điểm/mức. Điều này chưa phù hợp nếu “Thực tế” được dùng như ước lượng Mean/SD của hoạt động ổn định: hướng dẫn Westgard nói loại các kết quả QC của cả lần chạy mất kiểm soát khỏi thống kê dùng cho mục đích đó. Nguồn: [Westgard — FAQ, câu hỏi về loại dữ liệu khỏi thống kê](https://www.westgard.com/lessons/westgard-rules/westgard-rules/quest4.html).

Vị trí: `app/main/ipc/westgard-handlers.ts:30–40` và `app/renderer/pages/WestgardPage.tsx:34`.

Cần chốt rõ: đây là thống kê mô tả tập đã lọc theo điểm, hay thống kê hiệu năng ổn định theo lần chạy? Không dùng trực tiếp tập lọc này để thay Mean/SD chuẩn, đánh giá Sigma hoặc MU. Báo cáo này không kết luận phần Sigma có cùng lỗi.

### WG-07 — P1: Luật chuỗi chưa bắt đầu lại sau khắc phục hiệu quả

**Đã tái hiện.** Chỉ bật 4-1s; mức 1 có bốn ngày Z=+1,5, ngày 4 bị loại. Thêm hồ sơ khắc phục đã duyệt và hiệu quả, hoàn thành ngày 4. Ngày 5 nhập Z=+1,1; app vẫn gắn 4-1s vì tiếp tục nối với chuỗi trước khắc phục.

Mốc khắc phục hiện chỉ được đưa vào CUSUM. Westgard qua nhiều lần chạy không đọc mốc này. Theo hướng dẫn Westgard, sau khi loại run và sửa được nguyên nhân, chuỗi kiểm soát cần được thiết lập lại từ quá trình đã khắc phục. Nguồn: [The Multirule Interpretation — mục áp dụng across-runs sau khi reject](https://www.westgard.com/lessons/basic-qc-practices/lesson18.html).

Vị trí: `app/main/ipc/westgard-handlers.ts:245–276` so với `:299`; `app/main/domain/westgard-engine.ts:260–261`.

Hướng sửa: cùng một khái niệm giai đoạn vận hành và mốc khắc phục cho các luật chuỗi. Việc chỉ xóa một điểm bị loại khỏi cửa sổ không tương đương bắt đầu lại một giai đoạn. Cần thống nhất hiệu lực theo ngày hay theo lần chạy; hiện NCE chỉ có ngày nên không xác định được ranh giới giữa các run trong cùng ngày.

### WG-08 — P2: 1-3s cảnh báo che mất 1-2s loại bỏ

**Đã tái hiện bằng cấu hình app cho phép.** Đặt 1-2s=Loại bỏ, 1-3s=Cảnh báo, tắt các luật khác. Z=+2,5 bị loại nhưng Z=+3,5 chỉ cảnh báo và được accepted.

Nguyên nhân: nhánh `else if` bỏ qua 1-2s khi 1-3s đã nổ, dù hành động của 1-2s nghiêm ngặt hơn.

Vị trí: `app/main/domain/westgard-engine.ts:88–89`.

Hướng sửa: đánh giá đủ các luật đang có hiệu lực và lấy hành động nghiêm ngặt nhất; hoặc chặn tổ hợp cấu hình không được hỗ trợ tại cổng validation. Không để UI cho lưu rồi engine bỏ qua một luật đang bật.

### WG-09 — P1 khi xảy ra: Kết quả xét nghiệm cũ có thể ghi đè xét nghiệm mới

**Đã tái hiện store thật với API bất đồng bộ giả lập.** Gọi nạp A rồi B. Cho B hoàn tất trước: store hiển thị B. Sau đó A hoàn tất: store bị ghi đè thành A, dù lựa chọn cuối là B.

Store chỉ khóa theo số mức, không khóa theo testId và không bỏ phản hồi cũ. Trên UI, tiêu đề/lô/Mean-SD đọc theo lựa chọn mới còn các điểm có thể thuộc xét nghiệm cũ. Điều kiện gặp rõ hơn khi đường gọi có độ trễ hoặc phản hồi sai thứ tự; đây chưa phải bằng chứng người dùng đã gặp lỗi trong phiên Electron hiện tại.

Vị trí: `app/renderer/store/westgard-store.ts:36–44`, `app/renderer/pages/WestgardPage.tsx:81–84`.

Hướng sửa: request revision hoặc cache khóa theo testId; bỏ kết quả không còn khớp lựa chọn; có trạng thái nạp để không ghép dữ liệu cũ vào header mới.

### WG-10 — P2: Xuất Excel/PDF không theo lô đang xem

**Xác định từ mã nguồn; chưa bấm xuất file trong UI.** Khi “Xem lô cũ” được mở, bảng lấy `prevBlock.analysis`. Cả `exportXlsx()` lẫn `printPdf()` vẫn đọc `analysisByLevel` của lô hiện hành. File xuất vì vậy có thể chứa bộ điểm khác màn hình.

Ngoài ra tooltip hứa xuất biểu đồ/bằng chứng nhưng payload hiện chỉ có bảng; không có ảnh biểu đồ, `supportRules`, mã lô hay Mean/SD đối chiếu. PDF còn thiếu mã lần chạy, nên nhiều kết quả trong cùng ngày khó phân biệt.

Vị trí: `app/renderer/pages/WestgardPage.tsx:279–296`, so với phần chọn `prevBlock` gần dòng 496.

Hướng sửa: một mô hình “dữ liệu đang xem” dùng chung cho bảng, biểu đồ và xuất; ghi rõ xét nghiệm, máy, lô, mức, lần chạy, target, bộ luật và thời điểm đánh giá.

### WG-11 — P2: Biểu đồ chưa bảo toàn định danh/thứ tự lần chạy

**Đã kiểm tra trực tiếp tọa độ do hàm vẽ thật tạo ra.**

- Levey-Jennings tổng hợp chỉ phân biệt ngày. Ba run cùng ngày có tọa độ x `[489,489,489]`, nên chồng nhau; điểm cùng giá trị có thể che nhau và không đọc được đầy đủ bằng hover.
- CUSUM tổng hợp tạo khóa ngày+mã nhưng dùng sort chuỗi. Với run 1, 2, 10, tọa độ theo thứ tự dữ liệu là `[66,912,489]`: đường vẽ quay ngược trên trục X dù engine đã tính đúng thứ tự.
- Từ mã nguồn: tooltip LJ tìm số lô bằng `level`, không bằng chuỗi trúng hover. Khi thêm lô cũ cùng mức, tooltip có thể ghi số lô hiện hành cho điểm lô cũ.

Vị trí: `app/renderer/components/QcChart.tsx:381`, `:394–448`, `:580–581`.

Hướng sửa: dùng ngày+mã run và comparator thống nhất; giữ định danh series/lô trong kết quả hit-test.

### WG-12 — P2: Một số thay đổi không làm thẻ phân tích tự nạp lại

**Xác định từ mã nguồn.** Hai đăng ký invalidation chỉ theo dõi `tests,test_levels,qc_points,qc_lots,lot_groups`; thiếu `actions`, `app_meta` và thay đổi Panel QC.

- CUSUM phụ thuộc hồ sơ NCE nhưng NCE chỉ phát sự kiện `actions`.
- Cấu hình luật chung phát `app_meta`. Nút tại chỗ có nạp thủ công, nhưng thay đổi từ phiên khác không đi qua callback đó.
- Điểm đang vận hành phụ thuộc Panel hoạt động.

Vị trí: `app/renderer/pages/WestgardPage.tsx:88`, `:222`; `app/main/ipc/nce-handlers.ts:43`.

Hướng sửa: theo dõi đủ các nguồn dữ liệu tham gia tính toán; kiểm tra tình huống LAN/phiên khác cập nhật trong lúc người dùng giữ nguyên trang.

### WG-13 — P2: Đổi luật chưa nguyên tử với nhật ký

**Đã tái hiện bằng trigger gây lỗi ghi audit trong DB bộ nhớ.** `saveRuleSetting('1-3s', false)` ném lỗi ghi nhật ký nhưng luật đã được lưu thành tắt. Không có rollback; luồng không tới bước thông báo thay đổi.

Vị trí: `app/main/ipc/westgard-handlers.ts:133–153`, `:479–492`.

Hướng sửa: bao thay đổi cấu hình và `writeAudit()` trong cùng transaction, chỉ `notifyChanged()` sau commit; báo lỗi thao tác tại renderer. AGENTS.md cũng yêu cầu trình tự transaction cho các handler ghi.

### WG-14 — P2/hoàn thiện nghiệp vụ: Dòng “Thực tế” thiếu ngữ cảnh thống kê

**Xác định từ mã nguồn mới thêm.** Công thức Mean, SD mẫu n−1 và CV=SD/|Mean|×100 là đúng về đại số với tập đầu vào. Tuy nhiên:

- Số “n điểm” trên header đếm tất cả điểm, còn thống kê chỉ dùng `accepted`; không hiện n thực sự tham gia tính.
- Cố định hai số lẻ cho Mean/SD, không theo độ chính xác của xét nghiệm. Ví dụ giá trị 0,101 và 0,102 cho SD khoảng 0,000707 nhưng hiển thị `SD 0.00`.
- Lô cũ được trả `accepted:false` toàn bộ, nên dòng thống kê biến mất dù có nhiều điểm hợp lệ.
- Dưới hai điểm thì dòng bị ẩn, chưa có trạng thái “chưa đủ dữ liệu”.
- Hai điểm đủ để tính SD mẫu, không đủ để khẳng định đã ước lượng tốt hiệu năng hay thiết lập dải kiểm soát. Nên ghi rõ thống kê tạm thời và n. Hướng dẫn khởi tạo LJ của Westgard dùng tối thiểu 20 phép đo trong ít nhất 10 ngày; điều đó không đồng nghĩa phải cấm hiển thị thống kê mô tả khi n nhỏ. Nguồn: [Westgard — Levey-Jennings Control Chart](https://www.westgard.com/lessons/basic-qc-practices/lesson12.html).

Vị trí: `app/renderer/pages/WestgardPage.tsx:33–39`, `:500–511`; các flag lịch sử ở `app/main/ipc/westgard-handlers.ts:435`, `:466`.

Đính chính nhận định trước: dùng token màu của hệ thống là vấn đề giao diện; nó không chứng minh phần thống kê đã đúng nghiệp vụ. Phần mới thêm cần được rà lại cùng WG-05/WG-06.

## Những phần đã có bằng chứng hoạt động đúng

- Bộ test có kiểm tra luật đơn mức/liên mức, 7T dùng bảy phép đo, 2of3-2s, điểm bằng chứng, hành động alert/reject và đối xứng Entry–Westgard trong các ca đã xét.
- R4s trên hai mức cùng run +2,5/−2,5 được bắt đúng trong đường phân tích hiện hành và nhóm lưu trữ khi dữ liệu đầu vào đúng.
- Công thức tabular CUSUM được kiểm tra thêm: tám điểm Z=1 với k=0,5 cho C+ lần lượt 0,5→4,0; đổi snapshot baseline làm CUSUM khởi tạo lại. Phù hợp công thức mô tả trong [NIST — CUSUM](https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/cusum.htm). Kiểm chứng công thức không xác nhận chính sách lọc accepted là phù hợp cho mọi SOP.
- Điểm hủy được loại khỏi các truy vấn phân tích đang rà. Đường hiện hành giữ snapshot Mean/SD từng điểm.
- CUSUM được truyền như tín hiệu riêng, không trực tiếp biến verdict Westgard thành reject.

## Vì sao 107/107 test vẫn đạt?

Bộ test chủ yếu kiểm các điều kiện đã được dự kiến. Lịch sử hiện có test đổi lô nhưng thiếu ca đổi Mean/SD nhiều lần trong cùng lô; ca run 10 thiếu; test lô cũ chủ yếu một mức; store thiếu phản hồi đảo thứ tự. Riêng mâu thuẫn accepted/verdict đã được ghi thành kỳ vọng trong test cũ. Vì vậy việc bộ test đạt không chứng minh các luồng trên đúng nghiệp vụ.

## Thứ tự xử lý đề xuất

1. Sửa bảo toàn snapshot, thứ tự run, định danh ngày+run và đánh giá lô cũ nhất quán. Thêm ca tái hiện cho từng lỗi.
2. Thống nhất theo SOP: kết luận theo điểm/theo run, tập thống kê accepted, và bắt đầu lại chuỗi sau khắc phục. Giải quyết WG-05/06/07 cùng nhau.
3. Khóa phản hồi cũ theo xét nghiệm; đồng bộ sự kiện; sửa tổ hợp hành động luật và transaction nhật ký.
4. Thống nhất mô hình dữ liệu đang xem cho biểu đồ/bảng/xuất; bổ sung n và độ chính xác cho thống kê thực.

Đây là rà soát mã và các tình huống kiểm thử được mô tả, chưa phải xác nhận lâm sàng hay thẩm định đầy đủ tất cả SOP của phòng xét nghiệm. Không có thay đổi sản phẩm được thực hiện trong báo cáo này.
