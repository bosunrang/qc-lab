# Rà soát QC Lab — 10/11/2026

Phạm vi: mã hiện tại trong `app/`, HEAD `b57c311`, nhánh
`feat/nce-redesign`, bao gồm các thay đổi chưa commit đã có sẵn khi bắt đầu.
Đọc kiến trúc, cổng ghi, phân quyền, báo cáo, ngoại kiểm, hàng chờ NCE,
đường huỷ điểm và các tài liệu rà soát liên quan. Không sửa mã sản phẩm.
Các ca bổ sung chạy trên SQLite trong bộ nhớ, không dùng CSDL người dùng.

## Kết luận

**Nền tảng kỹ thuật và các công thức đã kiểm có bằng chứng tốt, nhưng chưa
nên chốt bản hiện tại cho vận hành chính thức.** Có năm vấn đề ưu tiên cao
về tính nhất quán hồ sơ, bằng chứng QC và việc cần xử lý, cùng một vấn đề
khoá kỳ tương lai. Tất cả sáu tình huống bên dưới đã chạy lại trên handler thật
của bản build hiện tại, không chỉ suy luận từ mã hoặc chép kết luận đợt cũ.

640 bài kiểm thử và 35 ca Electron đều đạt nhưng chưa bao phủ các tình huống
này. Đạt bộ kiểm thử hiện tại không đồng nghĩa mọi đường nghiệp vụ đều đúng.
ISO 15189:2022 đặt yêu cầu về chất lượng và năng lực của phòng xét nghiệm;
đợt rà mã này chưa phải đánh giá sự phù hợp đầy đủ của phòng xét nghiệm,
SOP và hồ sơ triển khai theo [phạm vi ISO công bố](https://committee.iso.org/standard/15189).

## Kiểm chứng đã thực hiện

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Đạt |
| `npm run lint` | Đạt |
| `npm test` | 640/640 đạt, không bỏ qua ca nào |
| `npm run app:css-parity` | Đạt; còn 5 class thiếu rule thuộc baseline đã có |
| `npm run build` | Đạt; cảnh báo chunk lớn hơn 500 kB |
| Electron qua `npm run verify-release` | 35/35 đạt; toàn lệnh thoát 0 |
| `node app/validation/run-validation.mjs` | 54/54 ca, 804 phép kiểm đạt |
| Hai bài hiệu năng chính thức | 2/2 đạt ngưỡng hiện tại |
| Ca quan sát bổ sung | Tái hiện đủ sáu vấn đề dưới đây |

Đã xem ảnh sinh từ E2E của biên bản tháng và dòng thời gian NCE. Đây là kiểm
tra giao diện có giới hạn, chưa phải nghiệm thu trực quan mọi màn hình và PDF.
Chưa chạy `npm run dist` hoặc kiểm bản cài trên một máy Windows sạch.

## Các vấn đề cần xử lý

### R01 — P1: Biên bản của kỳ đã khoá đổi kết luận sau khi dừng nhóm lô

Vị trí: `app/main/ipc/report-handlers.ts:93`,
`app/main/ipc/config-lot-handlers.ts:445`.

Ca thật: nhập hai mức trong cùng lần chạy tháng 10; mức 1 vi phạm 1-3s.
Biên bản có `rejected=2`, `rejected_runs=1`. Ký biên bản, khoá kỳ với xác nhận
việc còn tồn, rồi gọi `stopLotGroup()` bằng quyền quản trị.
Thao tác dừng thành công và kỳ vẫn đang khoá, nhưng đọc lại biên bản cho
`rejected=0`, `rejected_runs=0`; hai điểm thành chưa đánh giá. Báo cáo chi tiết
cùng kỳ vẫn ghi mức 1 bị loại, mức 2 không được dùng thống kê.

Nguyên nhân: `pointStatuses()` chỉ lấy tập vận hành, song song và chuỗi lô
chuyển tiếp; thiếu đường đánh giá nhóm dừng thủ công. Trong khi đó,
`reportEvaluations()` của báo cáo chi tiết đã có đường đọc nhóm lưu trữ.
Không có điểm QC nào bị xoá trong ca này; chính kết luận tổng hợp bị thay đổi.

Đề xuất: dùng chung nguồn kết luận đầy đủ cho biên bản và báo cáo; thêm hồi
quy cho kỳ đã khoá khi dừng/kích hoạt nhóm lô. Việc ngừng dùng lô không được
làm thay đổi kết luận lịch sử đã được đánh giá.

### R02 — P1: Mẫu ngoại kiểm khác của cùng máy bị thay khỏi phiên bản hiện hành

Vị trí: `app/main/ipc/eqa-handlers.ts:185`,
`app/renderer/pages/eqa/EqaImportModal.tsx:91`.

Ca thật: nhập mẫu `09-01`, z=3,2; sau đó nhập mẫu `09-02`, z=0,5 của cùng máy,
cùng chương trình và đợt. Lần thứ hai được yêu cầu lý do như một lần thay báo
cáo. Sau khi cung cấp lý do và phiên bản hợp lệ, phiên bản hiện hành chỉ còn
`09-02`; danh sách Cần chú ý giảm từ 1 xuống 0. Dòng `09-01` vẫn còn trong
lịch sử phiên bản, nhưng không còn tham gia chuỗi và cảnh báo hiện hành.

Nguyên nhân: thay theo máy, không phân biệt mẫu. Giao diện cũng chặn hai tệp
cùng máy trong cùng đợt, nên không giải quyết được bằng cách chọn cả hai tệp.
Quyết định N-16 trong `docs/EQA-REVIEW-2026-10-28.md` đã nêu một đợt VEQAS có
thể gồm nhiều mẫu.

Đề xuất: phân biệt bổ sung mẫu mới với sửa mẫu đã có; xác định phạm vi thay
theo máy và mẫu, đồng thời cập nhật cổng chọn tệp. Kiểm lại cảnh báo và xu
hướng sau mọi lần bổ sung.

### R03 — P1: Tắt panel làm lần QC bị loại chưa lập hồ sơ biến khỏi hàng chờ

Vị trí: `app/main/db/nce-evaluation.ts:20`,
`app/main/db/nce-evaluation.ts:90`,
`app/main/ipc/config-catalog-handlers.ts:381`.

Ca thật: một lần QC bị loại, chưa có hồ sơ NCE, hàng chờ có 1 dòng.
Gọi `savePanel()` đặt panel duy nhất chứa xét nghiệm thành không hoạt động.
Lưu thành công; hàng chờ còn 0, dù cả hai điểm QC vẫn còn và chưa bị huỷ.

Nguyên nhân: hàng chờ lấy đánh giá từ tập đang vận hành. Nhánh bổ sung bằng
snapshot chỉ bảo vệ lần chạy đã gắn hồ sơ NCE đang mở, không bảo vệ sự cố chưa
được lập hồ sơ. Đợt 09/11 đã ghi nhận cùng họ lỗi N17; ca này xác nhận vẫn còn.

Đề xuất: giữ nguồn việc cần xử lý độc lập với trạng thái danh mục hiện hành,
hoặc chặn/cảnh báo việc ngừng sử dụng khi còn sự cố chưa được tiếp nhận.
Không tự coi tắt panel là đã xử lý sự cố.

### R04 — P1: Chữ ký cũ vẫn được dùng để khoá bộ số liệu đã thay đổi

Vị trí: `app/main/ipc/report-handlers.ts:73`,
`app/main/ipc/report-handlers.ts:178`,
`app/main/ipc/report-handlers.ts:214`.

Ca thật: ký biên bản tháng 10 lúc có 2 điểm đạt; thêm 2 điểm đạt khác, rồi
khoá tháng 10 mà không truyền `acknowledge`. Khoá thành công. Snapshot lúc ký
vẫn có 2 điểm, còn số liệu đang hiển thị có 4 điểm và vẫn kèm chữ ký trước đó.

Nguyên nhân: đã lưu `summary_json` nhưng cổng `hasReview()` chỉ kiểm có một
dòng ký cho tháng, không kiểm chữ ký còn áp dụng cho dữ liệu hiện hành.
Đây là N29 của đợt 09/11, đã xác nhận còn tồn tại.

Đề xuất: so dấu vân tay của nội dung được ký; số liệu hoặc kết luận liên quan
thay đổi thì đánh dấu cần xem xét lại. Khi trình bày/in cần phân biệt bản đã
ký với số liệu đang tính lại.

### R05 — P1: Huỷ điểm lô cũ vi phạm R4s không đòi lý do, không giữ bằng chứng loại

Vị trí: `app/main/ipc/entry-handlers.ts:438`,
`app/main/ipc/entry-handlers.ts:445`,
`app/main/ipc/entry-handlers.ts:455`.

Ca thật: hai mức cùng lần chạy z=+2,5 và z=-2,5; trước đổi lô, điểm được đánh
giá `rej`, luật gồm R4s. Đổi lô được gán cho cả hai mức, rồi huỷ điểm mức 1
thuộc lô cũ với loại `data-entry` và lý do rỗng. Handler trả thành công;
`voided=1`, `void_rejection_json=''`.

Nguyên nhân: nhánh lịch sử đánh giá riêng một mức bằng `rules.within`, nên
không thấy luật liên mức. Cổng yêu cầu lý do và lưu bằng chứng dựa vào kết
luận thiếu này. Đây là N31 của đợt 09/11, đã xác nhận còn tồn tại.

Đề xuất: dùng kết luận của cả lần chạy ở đúng tập lô lịch sử, cùng nguồn với
Westgard; áp dụng cổng lý do và giữ bằng chứng trước khi huỷ. R4s được diễn
giải trong cùng lần chạy theo [Westgard](https://www.westgard.com/westgard-rules).

### R06 — P2: Khoá được tháng tương lai

Vị trí: `app/main/domain/period-lock-validation.ts:20`.

Ngày kiểm 10/11/2026, gọi khoá `2027-03` với `acknowledge=true` vẫn thành công.
Cổng chỉ kiểm định dạng tháng; chưa kiểm kỳ đã đến/đã kết thúc. Việc chốt
tháng hiện tại và khoá trước tháng tương lai cần được định nghĩa rõ theo SOP,
tránh vô tình chặn nhập dữ liệu của một kỳ chưa diễn ra.

### Trạng thái sửa (10/11/2026)

Cả sáu mục đã sửa; hồi quy ở `app/tests/review-2026-11-10.test.mjs`.

- **R01:** biên bản tháng (`pointStatuses`) và báo cáo chi tiết
  (`reportEvaluations`) dùng chung nguồn kết luận lô không còn vận hành
  `ipc/historical-evaluation.ts` (lô cũ chuyển tiếp, rồi nhóm dừng thủ công).
- **R02:** kỳ ngoại kiểm thay kết quả theo khoá máy + mẫu. Mẫu mới của cùng
  máy là bổ sung, không cần lý do. Giao diện chỉ chặn hai tệp cùng máy khi
  trùng mẫu.
- **R03:** tắt hoặc xoá Panel, bỏ xét nghiệm khỏi Panel, ngừng dùng hoặc đổi
  máy của xét nghiệm bị huỷ cả lần lưu (`pending-rejected-runs`) nếu làm lần
  chạy bị loại chưa lập hồ sơ NCE rời hàng chờ. Phải lập hồ sơ trước, vì hồ sơ
  lập từ hàng chờ cần xét nghiệm còn vận hành.
- **R04:** cổng khoá kỳ so dấu vân tay số liệu QC của lần ký cuối
  (`reviewDataFingerprint`) với số liệu hiện tại. Lệch thì thành việc còn tồn
  "cần ký lại". Biên bản trên màn hình và bản in ghi rõ khi chữ ký đã cũ.
- **R05:** huỷ điểm lô cũ lấy kết luận theo lần chạy của chuỗi lô lịch sử, nên
  thấy R4s, đòi lý do và giữ bằng chứng.
- **R06:** không khoá kỳ sau tháng hiện tại, cùng mốc với cổng ký biên bản.
  Tháng hiện tại vẫn khoá được như cũ.

Cùng họ R03 (đã tái hiện rồi sửa): đổi lô của một mức, dừng, kích hoạt hoặc
sửa nhóm lô, và chấp nhận lô mới ở hồ sơ chuyển lô cũng làm lần chạy bị loại
chưa lập hồ sơ rời hàng chờ. Các thao tác này nay đi qua cùng cổng
(`ipc/pending-runs-guard.ts`). Sửa Mean/SD không đổi lô không bị chặn.

## Hiệu năng và bảo mật

Hai bài hiệu năng đều đạt, nhưng ngưỡng kiểm thử không phải cam kết phản hồi
nhanh cho mọi tình huống. Số đo trong phiên này:

| Dữ liệu | Kết quả |
|---|---|
| 492.750 điểm, 60 xét nghiệm, 5 năm, thay lô mỗi 6 tháng | Tổng quan lần đầu 1.147 ms; lần hai 1 ms; sau thêm điểm 24 ms |
| Cùng dữ liệu thực tế | Westgard một mức 23 ms; lô cũ 443 ms; Sigma tháng 205 ms; heap cuối bài 66 MB |
| 500.000 điểm dồn vào một xét nghiệm | Westgard 19.678 ms; Nhập QC 15.170 ms; heap cuối bài 1.466 MB |

Bài đo chạy trong lúc bộ E2E cũng hoạt động nên số thời gian là số tham khảo
của máy hiện tại. Trường hợp dồn dữ liệu là tình huống tải nặng; không dùng
nó để suy ra thao tác thường ngày đều mất 15–20 giây. Tuy vậy cần cân nhắc
phân trang/cắt phạm vi tính khi một xét nghiệm tích luỹ nhiều điểm cùng lô.

Điểm tốt đã kiểm: cửa sổ chính bật sandbox, tách ngữ cảnh, tắt Node; các ca
phân quyền, thu hồi phiên LAN, giao dịch và nhật ký đều đạt. Còn việc tăng
cường cần đọc sâu thêm: `registerIpcOperations()` bỏ qua `_event` nên chưa
kiểm nguồn frame gọi IPC, trong khi [Electron khuyến nghị kiểm sender](https://www.electronjs.org/docs/latest/tutorial/security).
Đây là nhận xét từ mã, chưa phải một đường khai thác đã tái hiện.

Chưa đo lại cỡ gói Firebase, chưa kiểm cấu hình Firebase Rules của tài khoản
triển khai, chưa kiểm phục hồi sau mất điện hoặc nghiệm thu nhiều máy trạm
trong thời gian dài. Không kết luận các phần đó đã đạt từ bộ E2E hiện tại.

## Thứ tự xử lý và ca tái hiện

Ưu tiên R01–R05 trước khi chốt vận hành; R06 cần chốt chính sách kỳ theo SOP.
Sau sửa, chuyển từng ca sang hồi quy chính thức trong `app/tests/`, chạy lại
toàn bộ cổng phát hành và thẩm định nghiệp vụ liên quan. Chưa cần làm lại toàn
bộ ứng dụng để xử lý những vấn đề đã xác nhận này.

Ca quan sát được lưu tại `docs/app-review-probes-2026-11-10.cjs`:

```powershell
npm run build
node docs/app-review-probes-2026-11-10.cjs
```

Script in sáu dòng bằng chứng JSON, chỉ dùng CSDL trong bộ nhớ. Nó ghi nhận
hành vi hiện tại, không phải bộ test tuyên bố hành vi đó là đúng. Biên bản
thẩm định số học sinh ở
`validation-output/QC-Lab-tham-dinh-1.0.9-2026-11-10.xlsx`.
