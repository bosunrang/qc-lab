# QC Lab — hiện trạng và nguyên tắc phát triển

## 1. Mục đích

QC Lab là ứng dụng desktop phục vụ nội kiểm xét nghiệm: cấu hình danh mục,
nhập điểm QC, đánh giá Westgard, theo dõi Six Sigma, quản lý sai lệch và lập
báo cáo. Tài liệu này mô tả **ứng dụng hiện tại** và là căn cứ chung khi mở
rộng hoặc chỉnh sửa mã nguồn.

## 2. Kiến trúc đang dùng

- Mã nguồn sản phẩm chỉ nằm trong `app/`.
- Electron là lớp desktop; React renderer dùng `HashRouter`; SQLite chạy ở
  main process.
- Hợp đồng IPC tập trung tại `app/shared/qc-api.d.ts`. Dữ liệu đọc từ SQLite
  giữ `snake_case`; dữ liệu nháp biểu mẫu dùng `camelCase`.
- Bản xem trước chạy bằng Vite và sql.js/WASM. Bản Electron dùng `node:sqlite`.
- Renderer chỉ gọi API đã công bố qua preload; không tự thực hiện SQL hoặc
  lặp lại nghiệp vụ của main process.
- Phân tích Westgard hiển thị lô hiện hành trước, chỉ đọc phân tích lô đã
  chuyển tiếp khi người dùng mở lô cũ. Nhập QC đọc một lượt điểm thuộc tháng
  của bảng hoặc khoảng ngày của biểu đồ. Main đánh giá trên toàn bộ chuỗi
  và các mức liên quan trước khi lọc điểm gửi về, đồng thời tính thống kê
  tích luỹ từ đầu lô tới ngày kết thúc khoảng biểu đồ.
- Thông báo nhập/huỷ QC dùng cùng toast góc dưới phải với Cài đặt, tự tắt
  sau 4–8 giây theo độ dài. Giữ màu thành công/cảnh báo/loại bỏ; lỗi không
  lưu được vẫn hiện ở ô nhập hoặc hộp thoại. Không đặt thông báo dưới bảng.
- Phần nền Gateway chạy độc lập trong `app/main/gateway/`, dùng SQLite riêng
  `gateway.sqlite`: API tiếp nhận QC chuẩn hoá, token phân quyền/gắn nguồn,
  ánh xạ chính xác, hàng chờ bền vững, quyết định nhận/bỏ, nhật ký và sao lưu.
  Cổng QC Lab/quản trị chỉ nghe loopback 8787. Có thể bật cổng ingress HTTPS
  riêng, chỉ nhận token nguồn LIS. Không tự thêm dữ liệu mẫu khi chạy thật.
  Bộ chuyển đổi theo giao thức của từng LIS chưa nằm trong phần nền này.
  Xem `docs/LIS-GATEWAY.md` để vận hành và bàn giao hợp đồng tích hợp.
- Bản cài từ 1.1.0 xác minh giấy phép offline Ed25519 gắn với mã máy ở main;
  máy chưa kích hoạt hoặc hết hạn bị chặn cả IPC nghiệp vụ và máy trạm LAN.
  Khoá bí mật cấp mã nằm ngoài repository; bộ cài chỉ có khoá công khai.
- Công cụ cấp key có giao diện riêng trong `app/license-issuer/`, đóng gói
  bằng `npm run license:dist` ra `dist-issuer/`. Chỉ bên phát hành giữ công
  cụ và khoá bí mật; không thêm công cụ vào app của khách hàng. Công cụ
  không mở CSDL QC hoặc cổng LAN. GUI và CLI dùng chung bộ ký QCL1. Giao diện
  công cụ bundle trực tiếp `tokens.css`, `app.css`, `DateField` và
  `DatePickerPopup` của app chính; CSS riêng chỉ quản lý bố cục.
- Bản cài Windows dùng electron-updater lấy thông tin từ GitHub Releases
  public `bosunrang/qc-lab`. Tự phát hiện và tải trong nền, tải xong hỏi khởi
  động lại để cài; trước cài phải sao lưu và ghi nhật ký thành công. Không
  thêm thẻ kích hoạt/cập nhật vào Cài đặt hoặc bản xem trước trình duyệt.

## 3. Nguyên tắc dữ liệu và nghiệp vụ

- Nhận QC từ LIS dùng lô đã ánh xạ rõ ràng: chỉ lô đang dùng hoặc lô song
  song hợp lệ của đúng xét nghiệm/mức. Đơn vị nguồn phải khớp đơn vị danh mục;
  không tự quy đổi hoặc thay lô. Giá trị thiếu, rỗng, boolean hay sai định dạng
  bị từ chối; số 0 thật vẫn hợp lệ.
  Schema 13 thêm `lis_imports`: mã bản tin theo nguồn Gateway, ảnh chụp nguồn
  và điểm QC được ghi trong cùng transaction. Nhận lại chỉ trả điểm cũ và gửi
  lại xác nhận, kể cả sau khởi động lại, chuyển lô, khoá kỳ hoặc huỷ điểm.
  Hàng chờ tự gửi lại tối đa 20 xác nhận mỗi lượt đọc khi Gateway phục hồi;
  bản tin cùng mã nhưng thay nội dung bị giữ để đối chiếu. Bản tin đã tạo điểm
  không được Bỏ ở Gateway; muốn huỷ điểm phải dùng quy trình Huỷ QC.
  Dấu vết LIS nằm trong backup và được bảo vệ khi phục hồi ở chế độ vận hành.
  Không tự gán bản tin vào điểm nhập tay hoặc điểm cũ chưa có dấu vết LIS chỉ
  vì trùng lần chạy; các trường hợp này phải được đối chiếu để tránh nhận nhầm.
- Mỗi cổng ghi IPC thực hiện theo thứ tự: kiểm tra quyền, kiểm tra dữ liệu
  thuần, transaction, `writeAudit()`, rồi `notifyChanged()`.
- Không xoá cứng điểm QC. Khi cần loại bỏ, dùng quy trình huỷ điểm hiện có để
  giữ dấu vết, lý do và liên kết khắc phục sai lệch.
  Hộp thoại huỷ đọc phân loại Westgard và luật làm căn cứ từ main theo toàn
  bộ lần chạy trước huỷ, cùng ảnh chụp dùng khi lập NCE; tách lô song song
  khỏi lô chính. Chỉ luật thực sự gây loại quyết định RE/SE, cảnh báo không
  tự thành căn cứ. Thiếu căn cứ thì báo rõ, không tự điền loại hoặc lý do huỷ.
- Kỳ đã khoá không được sửa dữ liệu QC liên quan. Mọi thay đổi có ảnh hưởng
  đánh giá phải tôn trọng cổng khoá kỳ.
- Danh mục xét nghiệm, máy, lô QC và mức QC là nguồn dữ liệu chung. Các trang
  Nhập QC, Westgard, Six Sigma và Báo cáo không tự tạo danh mục theo dõi riêng.
- Kết luận Westgard, Sigma, TEa, Bias, CV và độ không đảm bảo đo phải do main
  process tính hoặc xác thực; renderer chỉ trình bày kết quả.
  Bias từ ngoại kiểm dùng bộ lọc chung lúc đề xuất và lưu mẫu mới, đối chiếu
  NCE bằng khoá nội dung nguồn và chặn mã kết quả trùng trong mỗi mức.
  Tỷ lệ u/σp ước tính > 0,3 chỉ cảnh báo để rà soát giá trị ấn định, không tự
  loại mẫu khỏi Bias Sigma; mẫu vẫn phải đạt điều kiện thời gian, số liệu và NCE.
  Bias chung lấy mọi mẫu hợp lệ trong số tháng người dùng chọn (nguyên từ 1
  trở lên, mặc định 3), đến hết tháng Sigma, bỏ lọc
  ±25% nồng độ. Thao tác áp dụng Bias chung cập nhật các mức trong đúng kỳ,
  giữ CV/TEa/Mean riêng. Khi sửa CV/MU,
  giữ mã, nhãn và số liệu các vòng đã lưu; không tự lọc lại lịch sử theo
  báo cáo, NCE hoặc Mean mới. Chi tiết tại `SIGMA-REVIEW-2026-11-17.md`.
  Số tháng được chụp cùng căn cứ khi áp dụng và khôi phục khi mở lại; sửa
  CV/MU không đổi khoảng đã lưu. Đổi số tháng yêu cầu lấy lại mẫu trước khi
  áp dụng, không dùng danh sách của khoảng cũ.
- Hai ô tại Sigma và danh mục đều là Nguồn TEa vận hành, dùng cùng tên nguồn
  của Sigma và đồng bộ hai chiều cho đúng cặp xét nghiệm–máy. Nguồn chung
  lưu ở `tests.operational_tea_source`, đồng thời ghi `tests.tea_source` để
  giữ tương thích. Hỗ trợ TEa chuẩn hóa PXN, CLIA PT, Ricos và EFLM nhập từ
  database; EFLM giữ riêng giá trị và thông tin truy vết đã nhập. Nguồn đã
  chọn không bị nguồn khác ghi đè khi thiếu giá trị. Cấu hình cũ chưa chọn
  riêng giữ thứ tự PXN rồi nguồn Sigma đã khai. Cổng Bias và ngoại kiểm dùng
  cùng lựa chọn; thay đổi ở Sigma là đổi nguồn vận hành, không phải so sánh.
  Màn Sigma đọc chế độ `operational`: toàn bộ bảng, Tình trạng, biểu đồ và
  báo cáo tính lại theo nguồn vừa chọn, giữ CV/Bias/Mean của từng kỳ. Không
  cần nút tính lại. Chế độ đọc `stored` giữ căn cứ đã lưu để truy vết; màn
  hiện hành mang `savedTea` và `teaSnapshot` gốc để sửa CV/Bias không ghi
  nguồn đang tính lên dữ liệu TEa lịch sử. Thiếu nguồn hiện hành thì báo
  thiếu, không tiếp tục hiện Sigma theo nguồn cũ.
  Snapshot kỳ cũ giữ nguyên. Kỳ cũ chưa chụp TEa được giữ giá trị đang hiển
  thị cùng nguồn thực đã giải trong chính giao dịch đổi cấu hình. Mức chưa
  có TEa (null) vẫn được giải từ nguồn hợp lệ để tính Sigma; không khóa
  trạng thái thiếu, kể cả cờ teaLocked cũ đã ghi nhầm cho null.
  Form đặt Nguồn TEa và Tiêu chí CLIA/TEa% cùng hai
  cột với Tên/Đơn vị và Phương pháp/Số thập phân, trên ô Hoá chất. Giá trị
  đọc từ catalog/hồ sơ PXN; CLIA tuyệt đối giữ đơn vị và quy đổi tại đúng
  nồng độ của từng mức QC hoặc mẫu ngoại kiểm.
  Ở Sigma, dưới từng mức ghi TEa% quy đổi và Mean kèm đơn vị thực dùng.
  Mean lấy từ căn cứ giải TEa/snapshot của mức; kỳ cũ chưa lưu căn cứ Mean
  thì báo "Chưa lưu Mean", không gán Mean hiện hành cho snapshot lịch sử.
  Trong danh sách, TEa chuẩn hoá của phòng xét nghiệm đứng đầu và là mặc
  định khi thêm mới; ô chưa có giá trị chỉ ghi "Chưa có", không có chú thích
  dài bên dưới hàng TEa.
- Khi đổi lô từng mức, báo cáo và cổng huỷ điểm giữ ngữ cảnh đầy đủ của lần
  chạy cũ, kể cả nhóm lô vẫn vận hành ở mức khác. Các mức còn gán hiện hành
  trong lần chạy đó không được nhận kết luận từ một tập đang thiếu mức cũ.
- Chi tiết Lịch sử dữ liệu giữ cột Z và dùng cột Kết luận QC lấy từ cùng
  nguồn đánh giá với báo cáo nội kiểm, trước khi chia bảng theo mức/lô hoặc
  phân trang. Hiển thị Đạt/Cảnh báo/Loại/Chưa đánh giá; một mức không tự
  vi phạm nhưng thuộc lần chạy bị loại vẫn hiện Loại, kèm mức gây loại.
  Luật vi phạm và mức gây loại hiển thị ngay dưới nhãn, không chỉ trong tooltip.
  Dòng phụ chỉ ghi tên luật (ví dụ 4-1s); điểm bị loại do mức khác ghi
  "Bị loại theo Mức 1", không lặp lời giải thích dài của tooltip.
  Không suy kết luận QC từ khoảng Z của điểm riêng lẻ.
- Thay đổi danh mục theo nhiều máy và chuyển lô giữa các nhóm cũng phải giữ
  lần chạy bị loại chưa lập hồ sơ trong hàng chờ NCE. Tạo nhóm mới bằng lô
  đang dùng không được bỏ qua cổng này; bị chặn thì hoàn nguyên cả lần ghi.

## 4. Giao diện và báo cáo

- Các màn đăng nhập, khởi tạo quản trị, đổi mật khẩu bắt buộc và kích hoạt
  dùng chung nền `.auth-overlay` với mẫu Naviva xanh đậm nằm ngang
  (trang 1 của PDF được cung cấp), kết xuất thành ảnh trong `renderer/assets`.
  Nền phủ kín và giữ tỷ lệ; khung biểu mẫu trắng ở giữa. Tài nguyên được đóng
  gói cùng ứng dụng, không phụ thuộc đường dẫn OneDrive hay kết nối mạng.
- Thanh điều hướng dùng nền xanh đen trơn `--sidebar-bg` ở cả chế độ mở rộng
  và thu gọn. Chữ, nhãn nhóm và biểu tượng dùng màu sáng; mục đang chọn có
  điểm nhấn xanh ngọc.
- Tổng quan chọn điểm gần nhất theo ngày và mã lần chạy tự nhiên dùng chung;
  thiếu Mean hoặc SD không được coi là đủ dải QC. Tổng quan và Ngoại kiểm chỉ
  nhận dữ liệu/lỗi của lượt tải mới nhất; biên bản tháng phải mở lại nút tải
  khi đọc lỗi, không để trạng thái đang tổng hợp bị treo.
- Nhắc hạn ngoại kiểm trên Tổng quan nằm trong Cần xử lý / Theo dõi, dùng
  cùng dòng công việc với cảnh báo QC và hồ sơ quá hạn, không có dải riêng
  phía trên. Mỗi lịch hiện loại mẫu, đợt, máy, hạn nộp và nút mở lịch; tối
  đa bốn lịch kèm lối mở toàn bộ khi còn nhiều hơn. Đọc ngoại kiểm độc lập
  với lượt tổng hợp QC, chỉ nhận phản hồi mới nhất; không báo hết việc khi
  còn lịch cần nộp, đang tải hoặc đọc lịch lỗi. Nút mở từng lịch định vị theo
  mã lịch riêng, chọn đúng tháng/ngày hạn nộp, bỏ lọc loại mẫu và đưa chi tiết
  đợt vào tầm nhìn; các lịch cùng chương trình–đợt vẫn phân biệt theo nhóm máy.
- Lịch sử dữ liệu giữ thứ tự mức QC; trong từng mức, lô đang dùng đứng đầu,
  các mốc lô cũ xếp theo ngày bắt đầu hiệu lực từ mới đến cũ. Mốc thiếu ngày
  đứng cuối; khi trùng hoặc cùng thiếu ngày thì mốc ghi sau đứng trước.
  Bộ lọc Tất cả/Mức QC nằm bên phải phía trên bảng, chỉ lọc phần hiển thị;
  đổi xét nghiệm trở về Tất cả và không đổi thứ tự lô hoặc dữ liệu chi tiết.
  Bảng điểm QC trong Chi tiết xếp ngày mới nhất trước, cùng ngày xếp lần chạy
  sau trước (thứ tự số tự nhiên, ví dụ 10 trước 2), rồi mới phân trang.
  Thứ tự biểu đồ và chuỗi đánh giá QC giữ nguyên từ cũ đến mới.
  Góc phải phía trên bảng điểm có bộ lọc Tất cả/Đạt/Cảnh báo/Loại, dùng đúng
  Kết luận QC đang hiển thị (gồm loại theo mức khác). Lọc trước phân trang,
  đổi bộ lọc về trang đầu; mở lô khác trở về Tất cả. Tất cả gồm cả điểm chưa
  đánh giá. Số điểm hiển thị dạng số khớp/tổng khi lọc; số liệu tích luỹ giữ
  toàn bộ điểm của lô, không phụ thuộc bộ lọc kết luận.
- Hồ sơ TEa chuẩn hoá chọn cách áp dụng bằng hai thẻ radio: TEa chung chỉ
  có một ô nhập; TEa theo mức ghép checkbox và ô nhập
  trong cùng thẻ mức. Chế độ theo mức không có TEa chung/dự phòng và gửi
  `labValue` rỗng khi lưu; chỉ chế độ chung mới lưu giá trị chung. Đổi qua
  lại vẫn giữ bản nháp trong lần mở biểu mẫu; không tự sửa các hồ sơ cũ.
- Người chuẩn bị và người duyệt hồ sơ TEa chọn từ tài khoản đang hoạt động,
  hiển thị họ tên kèm tên đăng nhập. Hồ sơ vẫn lưu bản tên tại thời điểm lập;
  tên đã lưu hiện riêng khi sửa, không đổi theo tài khoản bị đổi tên/ngừng dùng.
- Ứng dụng được tối ưu cho desktop. Màu sắc, kích thước, khoảng cách, tiêu đề
  và control sử dụng token trong `app/renderer/styles/`.
  Thang chữ màn hình: nội dung chính/ô nhập/nút 14px, nội dung bảng/tiêu đề
  cột/nhãn/bộ lọc 13.5px, chữ phụ/thông tin nguồn 13px. Chữ phụ cũ 11–12px
  dùng lại cỡ 13px; tiêu đề lớn và KPI giữ cấp bậc riêng. Rà bố cục ở cửa sổ
  hẹp khi đổi thang, cho nhãn xuống dòng hoặc cuộn bảng thay vì cắt chữ.
- Khi sửa giao diện, ưu tiên component và token dùng chung thay vì thêm giá trị
  cục bộ. Giữ các thao tác nguy hiểm có xác nhận rõ ràng.
- Ô tìm/chọn xét nghiệm và gợi ý tên trong form Thêm xét nghiệm dùng chung
  kiểu danh sách nhẹ có đường phân cách. Bấm vào tên đã chọn sẽ chọn toàn bộ
  chữ để gõ thay, có nút × để tìm lại nhanh trong toàn app. Với ô chọn có sẵn,
  nút này chỉ xoá nội dung tìm, giữ xét nghiệm đang xem cho tới khi chọn mục
  mới; Escape hoặc rời ô khôi phục tên đã chọn. Với ô tên trong form thêm/sửa,
  nút × xoá tên trong bản nháp và gỡ liên kết gợi ý TEa như khi xoá bằng bàn phím.
  Tab không tự mở danh sách. Các ô chọn chỉ nhận xét nghiệm
  có sẵn, giữ lựa chọn cũ khi huỷ tìm kiếm; form tạo mới vẫn cho nhập tên tự
  do. Nút xuất trên cùng hàng căn theo ô chọn, không dùng nhãn trống để đẩy nút.
- Danh sách xổ xuống mở bằng chuột không có vòng focus quanh mục được chọn,
  kể cả lần mở đầu. Thao tác bàn phím khôi phục vòng focus chung ngay khi
  điều hướng; giữ nguyên nền mục đang chọn và hành vi chọn giá trị.
- Lỗi nhập liệu trong biểu mẫu dùng `useInvalidField` để đánh dấu viền đỏ và
  focus vào ô cần sửa. `FormErrorMessage` đặt lời nhắc ngay dưới trường đó,
  gỡ lời nhắc khi người dùng sửa ô; không gom lỗi nhập liệu ở đầu biểu mẫu.
  Đây là quy tắc bắt buộc cho toàn app, kể cả đăng nhập, kích hoạt, danh mục,
  nhập QC, Sigma, EQA, báo cáo và hồ sơ NCE. Kiểu dáng duy nhất nằm ở khối
  `QUY TẮC LỖI BIỂU MẪU TOÀN APP` trong `styles/app.css`; không tạo dải lỗi
  riêng ở đầu modal. Lỗi thao tác không gắn với ô nhập (quyền, mạng nội bộ,
  kết nối, lỗi ghi...) dùng `reportFormError`/`errorDialog` mở hộp thoại lỗi
  chung, luôn thấy được khi cuộn biểu mẫu và giữ dữ liệu đang nhập. Dải
  `.alert` chỉ dành cho trạng thái nghiệp vụ cần hiển thị liên tục như lỗi tải,
  dữ liệu nguồn không hợp lệ, xung đột phiên bản hoặc kết quả chưa xác định.
  Các trường nằm cùng một hàng phải căn từ trên; lời nhắc dưới một trường chỉ
  làm hàng đó cao thêm để đẩy hàng kế tiếp xuống, không được kéo lệch trường
  bên cạnh. `.field`, các helper hàng/lưới dùng chung và lưới biểu mẫu đặc thù
  đều phải giữ `align-self/align-items: start` cho nguyên tắc này.
- Màn kích hoạt dùng cùng `AuthBrand`, khung đăng nhập, control và focus chung.
  Tiêu đề có cấp bậc riêng, mã máy có thao tác sao chép; chỉ hiện cảnh báo khi
  giấy phép lỗi/hết hạn. Không dùng nhãn nhỏ của khối thiết lập làm tiêu đề.
- Giấy phép đã kích hoạt hiển thị hạn dùng tại chân menu trái (thu gọn thì
  có biểu tượng và tooltip). Từ 7 ngày lịch Việt Nam trở xuống, nhắc gia hạn
  dưới tiêu đề trang bằng trạng thái warning chung; không đưa nhắc này vào
  bản in. Giấy phép vĩnh viễn không có cảnh báo. Trạng thái lấy từ main và
  được nạp lại mỗi phút; giao diện không tự quyết định quyền sử dụng.
- Báo cáo Excel và PDF lấy dữ liệu tại thời điểm xuất. Tiêu đề đơn vị, địa chỉ,
  biểu mẫu và thông tin ký duyệt lấy từ phần cài đặt hiện hành.
- Báo cáo theo kỳ chỉ biểu diễn dữ liệu của kỳ được chọn; báo cáo nhiều kỳ chỉ
  dùng khi người dùng yêu cầu phạm vi tổng hợp.
- PDF So sánh hoá chất chỉ xuất phép so sánh đang chọn, chờ các ô vừa sửa lưu
  xong và đọc lại dữ liệu trước khi dựng báo cáo. Bản in gồm đủ thông tin đánh
  giá, mọi dòng đo bắt cặp (kể cả dòng thiếu), thống kê, tiêu chí, kết luận và
  hai biểu đồ tương quan/Bland–Altman. Màn hình và PDF dùng chung component
  trình bày kết quả và biểu đồ; thống kê luôn lấy từ main. Khi thiếu cỡ mẫu,
  giữ thông báo chưa đủ dữ liệu, không tạo kết quả hoặc biểu đồ giả. Bảng đo
  lặp tiêu đề khi qua trang; từng biểu đồ và khu vực ký được giữ nguyên khối.
  Stylesheet PDF hoá chất nằm riêng ở `renderer/print/reagent.css`, nạp bằng
  `?raw` vào HTML bản in, không đưa vào cascade CSS của màn hình.
- PDF nội kiểm theo khoảng ngày có Levey–Jennings tổng hợp bằng chính hàm vẽ
  Westgard; mỗi mức/lô là một đường riêng, điểm đã huỷ chỉ giữ ở bảng chi tiết.
  Main cung cấp Z/kết luận từ các chuỗi đang chạy, song song, lô cũ và nhóm
  lưu trữ trước khi cắt ngày hiển thị. Bảng chi tiết chia theo mức, tiêu đề
  mức/cột lặp lại khi sang trang. Trang báo cáo có in/PDF và Excel; Excel giữ
  cấu trúc dữ liệu từng dòng.
- Biên bản xem xét QC tháng nhấn vàng các ô Bị loại/Huỷ có số lượng lớn hơn
  0, không có hàng tổng hợp riêng. Hồ sơ NCE và việc còn tồn nằm trong mục thu/mở dưới
  bảng, có nhãn nhắc rà soát khi còn việc.
  Trạng thái ký nằm cùng phần kết luận, không lặp lại thành các dải thông báo.
  Bảng trên màn hình và bản in cùng đặt Máy trước Xét nghiệm, gộp dọc các
  ô liền nhau theo máy và định danh xét nghiệm, giữ riêng số liệu từng mức/lô.
  Các xét nghiệm khác định danh không gộp dù trùng tên.
  Trong mỗi nhóm máy, xét nghiệm xếp theo thứ tự thêm trong danh mục (cũ
  trước, mới sau), rồi theo mức/lô; không tự sắp lại theo tên xét nghiệm.

## 5. Các khu vực nghiệp vụ

| Khu vực | Trách nhiệm chính |
| --- | --- |
| Cấu hình chung | Máy, xét nghiệm, panel, lô, Mean/SD, TEa và quyền cấu hình |
| Nhập QC | Ghi điểm, theo dõi lần chạy, ghi chú, huỷ điểm và dải vận hành |
| Phân tích Westgard | Đánh giá luật, cảnh báo, lịch sử lô và biểu đồ |
| Six Sigma & Sai số | Kỳ đánh giá, TEa, CV/Bias, MU, OPSpecs và xuất báo cáo |
| Phân tích ngoại kiểm | Tổng quan, lịch, báo cáo xem xét và khắc phục: nhập PDF, đối chiếu z/nhóm so sánh, liên kết kết quả cần điều tra với hồ sơ NCE và căn cứ đã chụp |
| Khắc phục sự cố | Hồ sơ NCE theo lần chạy: kiểm soát, cho phép hoạt động trở lại, CAPA, hiệu lực và duyệt độc lập |
| Báo cáo & Biểu mẫu | Báo cáo dữ liệu, báo cáo Sigma, PDF/Excel và mẫu biểu |
| Cài đặt & Kết nối | Hồ sơ đơn vị, sao lưu, đồng bộ và cấu hình tích hợp |

Hai khung Thiết lập phân tích và Tình trạng của Sigma tự giãn bằng chiều cao
của bên có nhiều nội dung hơn. Thẻ mức QC nhận phần chiều cao còn lại khi
khung thiết lập dài; khuyến nghị vẫn hiện đầy đủ khi làm khung Tình trạng cao hơn.
Trong Thiết lập phân tích, ô xét nghiệm rộng bằng ô nguồn TEa. Hai ô đơn vị
và thiết bị chiếm lần lượt 40% và 60% phần bên phải, ghép lại bằng ô tiêu chí TEa bên dưới.
Panel hẹp chuyển ô xét nghiệm và TEa sang cả hàng, giữ đơn vị/thiết bị cùng hàng.

Số liệu theo kỳ của Sigma dùng thanh kéo chung giữa lịch sử kỳ và bảng mức
QC. Kéo chuột hoặc dùng phím trái/phải để đổi độ rộng danh sách, nhớ lựa
chọn khi mở lại; giới hạn theo bề ngang khung để bảng số liệu còn đủ chỗ.

Tổng quan ngoại kiểm dùng tỷ lệ chấp nhận theo số kết quả đã nhập của đúng
máy–chương trình–năm; đây là chỉ số tổng hợp, không thay kết luận từng mẫu
hoặc trạng thái xử lý. Lọc theo xếp loại chỉ lọc xét nghiệm, giữ các đợt và
mẫu để đối chiếu; đổi phạm vi rồi quay về vẫn đặt lại bộ lọc về tất cả.
Lỗi tải có trạng thái và nút thử lại riêng, không hiển thị như danh sách rỗng
hoặc kết luận không có tín hiệu. Bảng tổng hợp z-score dùng nhãn số đợt/năm; đường z nhỏ có cùng thang đo,
tách đường theo mẫu và ngắt khi thiếu đợt. Chi tiết chỉ mở khi chọn đúng ô,
không tự thay bằng kết quả khác. Tín hiệu chuỗi vẫn lấy từ main theo toàn
bộ lịch sử chương trình. Phần tín hiệu chỉ hiển thị đúng máy–chương trình–năm
đang chọn, không có bảng hoặc thông báo tín hiệu ngoài phạm vi.
Danh sách Đợt báo cáo có bộ lọc Đợt và Máy riêng trên tiêu đề, mặc định
Tất cả đợt và Tất cả máy; kết hợp hai bộ lọc để tìm nhanh và không đổi
bảng z-score phía trên. Mỗi dòng là một máy trong một
đợt; tên máy và số kết quả/xếp loại lấy theo đúng máy đó. Mở dòng nào thì
chi tiết giữ máy của dòng đó, kể cả khi tải lại. Quay lại giữ bộ lọc danh
sách, kể cả trạng thái Hiện đợt đã huỷ; khi ẩn đợt đã huỷ thì bỏ lựa chọn
đợt đã huỷ đang lọc. Đổi năm/chương trình đặt lại hai dropdown về Tất cả.
Thông tin, dải tổng hợp và
bảng kết quả chi tiết cùng dùng máy đã mở. Máy chưa có dữ liệu không tự
chuyển sang xem tất cả máy. Vẫn tra cứu được theo máy khi mọi đợt đã huỷ.
Chi tiết đợt không có dropdown đổi máy hoặc chế độ Tất cả máy: chỉ hiện máy
đã mở từ danh sách, chuỗi xét nghiệm hoặc lịch một máy. Liên kết cũ chỉ suy
ra máy khi có kết quả cụ thể hoặc cả đợt có một máy; nếu chưa xác định được
thì trở về danh sách chọn dòng máy cần đọc, không gộp kết quả các máy.
Kỳ báo cáo dùng cùng dải tổng hợp với Tổng quan: tỷ lệ kèm số kết quả,
không chấp nhận và cảnh báo của máy đã mở; lọc xếp loại chỉ đổi bảng,
không đổi mẫu số tổng hợp.
Lọc xếp loại ở kỳ báo cáo dùng dropdown, mặc định “Tất cả xét nghiệm”,
đồng bộ với thao tác bấm số liệu trên dải tổng hợp.
Hai màn chi tiết dùng chung dropdown đánh giá; đổi máy, xét nghiệm hoặc
phạm vi xem đặt lại bộ lọc về tất cả. Các lượt tải kỳ chồng nhau chỉ nhận
phản hồi mới nhất, không ghi đè dữ liệu đã cập nhật bằng phản hồi cũ.
“Cần xem” ở cả hai màn chi tiết gồm cả kết quả vượt TEa nội bộ; tiêu chí
lọc này không đổi đánh giá ngoại kiểm chính thức.
Nhãn “Có lưu ý” và bộ lọc “Cần xem” ở bảng Kết quả từng đợt dùng cùng căn
cứ với chi tiết đợt: độ không đảm bảo giá trị ấn định, đối chiếu z nhà cung
cấp và cảnh báo báo cáo. Có thể đọc nhanh nội dung qua nhãn và mở đúng đợt
để rà soát; xếp loại “Chấp nhận” vẫn giữ theo đánh giá chính thức.
Bảng kết quả kỳ và bảng kết quả từng đợt dùng chung khung cuộn hai chiều,
giữ hàng tiêu đề cột trên cùng khi cuộn dọc; cuộn ngang giữ tiêu đề và dữ liệu thẳng cột.
Trong chi tiết kết quả, z tính lại nằm trong mục đối chiếu; nếu main báo lệch
hoặc ngược dấu nhà cung cấp thì nhắc ngay dưới z chính thức. Trạng thái chuỗi
phân biệt thiếu dữ liệu, chưa đủ đợt và không có tín hiệu; vẫn hiện tín hiệu
đã có khi chưa đủ đợt kết luận xu hướng. Mã và ngày báo cáo luôn hiện, tên tệp
nguồn nằm trong mục mở rộng.
Đối chiếu TEa chỉ ghi trong/vượt khi main đã trả kết luận; giá trị trống
được hiển thị là chưa đủ dữ liệu đối chiếu.
Chi tiết xét nghiệm chỉ có dòng tổng hợp nhỏ dưới tiêu đề biểu đồ; không có
khối kết quả đang chọn riêng. Biểu đồ một đợt có chiều cao gọn, vẫn giữ điểm/mẫu riêng và ngắt ở
dữ liệu thiếu; nhãn thiếu đợt lấy trạng thái của toàn bộ chương trình từ main.
Bảng từng đợt giữ kết quả, giá trị ấn định, z và đánh giá chính thức; không có
khối chi tiết mở rộng. Nút “Mở kỳ báo cáo” dẫn đến đúng kỳ và kết quả của dòng.
Dropdown của bảng từng đợt mặc định “Tất cả kết quả”, có các lựa chọn cần xem,
chấp nhận, cảnh báo và không chấp nhận; chỉ lọc bảng, giữ nguyên chuỗi biểu đồ.
Danh sách xét nghiệm giữ vị trí cuộn khi đổi xét nghiệm hoặc mở kỳ rồi quay
lại; thay đổi cấu hình nạp lại cả chuỗi lẫn danh sách. Biểu đồ phần trăm có
chú giải riêng cho điểm chưa có đối chiếu TEa, không coi là trong/vượt TEa.

Biểu mẫu thêm/sửa lịch ngoại kiểm đặt Người phụ trách và Ghi chú cùng hàng,
ô người phụ trách hẹp hơn, dùng cùng dropdown với Chương trình và Loại mẫu.
Chọn tài khoản đang hoạt động bằng họ tên kèm
tên đăng nhập; lịch lưu bản tên để giữ nguyên thông tin phân công cũ.

Thẻ Lịch ngoại kiểm chỉ giữ hai cách xem Lịch tháng và Danh sách ở bên trái
thanh công cụ; bên phải lần lượt là tháng, năm, loại mẫu và Thêm đợt, dùng
cùng kiểu nút chuyển và ô chọn của hệ thống. Hai cách xem giữ chung
mốc năm và bộ lọc loại mẫu; bỏ tab Năm và dòng thời gian 12 tháng. Danh sách
vẫn liệt kê các lịch theo năm đã chọn. Ở cách xem Lịch tháng, ô chọn tháng nằm
ngay trước ô chọn năm trên thanh công cụ. Chỉ dùng hai ô này để chọn mốc
thời gian, bỏ dòng tháng/năm và các nút trước/sau, Hôm nay bên dưới;
không lọc danh sách cả năm theo tháng. Tháng thể hiện đủ ngày
nhận mẫu, chạy mẫu và hạn nộp, kể cả khi trùng ngày; thu gọn còn hai mốc và
báo số mốc còn lại. Chọn
ngày hiện đủ công việc, gộp các mốc cùng đợt để không lặp thao tác nộp.
Danh sách chiếm trọn chiều ngang, không dựng khung công việc ngày hoặc
hướng dẫn ở bên phải. Khung chi tiết ngày chỉ hiện trong Lịch tháng, đổi
cách xem vẫn giữ ngày đang chọn. Danh sách nhóm các lịch cùng mã chương trình thành các hàng liền nhau và
gộp ô Chương trình theo chiều dọc, hiện tên và trung tâm một lần. Trong mỗi
chương trình, nhóm tiếp theo số đợt chuẩn hoá và gộp ô Đợt, kể cả khi các
hạn nộp xen kẽ đợt khác; không gộp cùng số đợt giữa các chương trình. Loại mẫu
là cột riêng cho từng lịch; bỏ cột Nhận mẫu, giữ ngày chạy và hạn nộp riêng.
Lọc loại mẫu tính lại số hàng gộp; máy, trạng thái và thao tác vẫn theo từng lịch.
Ô gộp chạm đáy bảng bỏ đường kẻ cuối như các ô khác; nhóm ở giữa vẫn có
đường phân cách. Rê chuột vào ngày cuối tuần vẫn dùng nền tương tác chung,
còn ngày được chọn hoặc có hạn cảnh báo giữ nguyên màu trạng thái.
Chú giải tháng chỉ có Chạy mẫu (chấm xanh dương) và Hạn nộp (chấm cam).
Các ký hiệu công việc dùng chấm tròn đặc theo màu trạng thái, không kèm
gạch dọc bên trái.
Ô ngày có hạn nộp quá hạn dùng nền đỏ nhạt; hạn nộp chưa hoàn tất trong
7 ngày tới dùng nền vàng nhạt. Khi có nhiều công việc, quá hạn ưu tiên cao
nhất. Chọn ngày giữ nguyên nền cảnh báo và dùng viền xanh ngọc; ngày chạy
đơn thuần hoặc hạn đã nộp/đã có báo cáo không tự tạo nền cảnh báo.
Chỉ giữ lịch và chi tiết ngày, không có dải nhắc việc hoặc khung Cần xử lý.
Cảnh báo gọn chỉ xuất hiện khi main trả đợt quá hạn, lấy từ mọi năm và mọi
loại mẫu. Mở cảnh báo để chọn đợt, định vị đúng tháng/ngày và gỡ bộ lọc loại
mẫu đang che đợt. Không cảnh báo cho đợt chỉ sắp đến hạn hoặc đã nộp chờ
báo cáo; trạng thái vẫn hiện ở lịch và chi tiết. Tiến độ nộp theo máy và
trạng thái lấy từ main; số đợt có báo cáo nằm trong tổng hợp năm.
Từ schema 14, cùng chương trình–năm–số đợt có thể có nhiều lịch cho các nhóm
máy không giao nhau, mỗi lịch có loại mẫu, ngày chạy và hạn nộp riêng.
Đổi loại mẫu chỉ sửa lịch đang thao tác, không đổi nhãn các lịch khác hoặc
phân loại chương trình. Máy đã có lịch trong đợt đó không được thêm vào
lịch khác, kể cả đổi loại mẫu; lỗi chỉ rõ máy trùng ở phần chọn máy.
Lịch không khai máy là lịch chung, không cùng tồn tại với lịch khác của
đúng chương trình–năm–đợt. Chương trình gợi sẵn loại mẫu và máy từ cùng một
lịch gần nhất; đổi loại mẫu khi thêm mới gỡ lựa chọn máy gợi từ loại cũ.
Báo cáo và dấu nộp chỉ hoàn thành các lịch có đúng máy tương ứng. Lịch
chưa nộp/chưa có báo cáo của máy mình vẫn xoá được khi máy khác cùng đợt
đã có báo cáo. Bộ đếm danh sách tính số lịch theo nhóm máy, không gọi nhầm
là số kỳ báo cáo. Nâng schema giữ
toàn bộ mã lịch, dấu nộp, ngày giờ và loại mẫu hiện có của dữ liệu cũ.
Chưa khai lịch vẫn hiện lịch tháng và hướng dẫn thêm đợt bên cạnh. Hai khung
thẳng mép trên, mép dưới và dải tiêu đề; lưới ngày tự giãn theo phần hướng dẫn,
không đặt chiều cao cố định. Khi xếp dọc, mỗi khung cao theo nội dung.
Không hiện bộ lọc loại mẫu chưa có dữ liệu. Chọn ngày
có thể dùng làm hạn nộp gợi sẵn khi thêm đợt. Biểu mẫu chỉ có Ngày chạy mẫu
và Hạn nộp kết quả, nằm cùng hàng theo lưới chung; đợt mới không khai ngày
nhận mẫu, sửa đợt giữ nguyên ngày nhận mẫu đã lưu. Ràng buộc ngày của dữ
liệu cũ vẫn được main kiểm tra và báo vào ô ngày đang nhập. Lỗi tải có nút thử lại riêng, dữ liệu
cũ còn hiển thị phải kèm thông báo lỗi làm mới. Quyền ghi và hộp xác nhận
xoá lịch giữ nguyên qua các cách xem.

Quy trình quản lý khoá, cấp mã theo máy và phát hành cập nhật nằm tại
`docs/SOFTWARE-LICENSE-AND-UPDATES.md`. Giấy phép là cấu hình riêng của máy,
không đồng bộ đám mây và không bị thay bằng giấy phép trong bản sao lưu.

## 6. Kiểm chứng thay đổi

Tab Khắc phục ngoại kiểm (17/11/2026) dùng bộ chọn năm/chương trình/đợt/máy,
dải tổng hợp và danh sách theo trạng thái, kèm khung căn cứ. Bảng kết quả giữ
lề hai bên và đáy theo khoảng đệm panel. Số lượng nằm cạnh tiêu đề; bộ lọc
trạng thái và ô tìm kiếm nằm cùng header, tự xuống hàng khi khung hẹp. Main phân biệt
kết quả bắt buộc điều tra với cảnh báo đơn lẻ từ chính kết quả và tín hiệu
chuỗi hiện có. Tạo hồ sơ qua quy trình NCE chung, không có bộ CAPA thứ hai;
người có quyền ghi và quyền dùng Khắc phục sự cố được lập/mở hồ sơ ngay
trong tab. Người chỉ xem được đọc danh sách và căn cứ, không ghi quyết định.
Mặc định bảng chiếm trọn chiều rộng; khung căn cứ chỉ xuất hiện khi chọn
Xem căn cứ hoặc tên xét nghiệm. Đóng khung để bảng mở rộng trở lại.
Khi mở căn cứ, thanh chia dùng chung cho phép kéo chuột hoặc dùng bàn phím
để chỉnh độ rộng; nhớ lựa chọn trên máy. Giới hạn theo bề ngang cửa sổ để
hai khung còn đọc được; cửa sổ hẹp chuyển thành bố cục dọc và ẩn thanh kéo.
Header căn cứ và các nút thao tác nằm ngoài vùng cuộn. Phần thân tự giới hạn
theo khoảng cửa sổ còn lại, cuộn độc lập và không truyền cuộn sang trang.
Bảng hồ sơ bên trái dùng cùng giới hạn chiều cao; tiêu đề khung và hàng
lọc/tìm kiếm cố định, tiêu đề cột dính trong vùng cuộn của bảng. Hai khung
cuộn độc lập; đổi bộ lọc đưa danh sách về đầu. Khi đặt cạnh nhau, hai khung
giãn bằng chiều cao và thẳng mép dưới, kể cả khi một bên có ít nội dung.
Khi xếp dọc ở cửa sổ hẹp, mỗi khung giữ chiều cao theo nội dung và giới hạn cuộn.
Khung căn cứ chỉ mở sẵn kết quả, giá trị ấn định, z chính thức và lý do điều
tra. Số liệu báo cáo, nhóm so sánh, kết quả liên quan và nội kiểm nằm trong
các mục thu gọn riêng; dữ liệu chi tiết trình bày bằng bảng. Ngày chạy mẫu
để đối chiếu nằm trong mục Nội kiểm, có trạng thái tóm tắt ngay khi thu gọn.
Schema 15 thêm `eqa_result_id`, `eqa_source_key`, `eqa_snapshot_json` vào
`nce_records`: chụp kết quả, tín hiệu, nhóm so sánh, đợt chấp nhận gần nhất,
ngày chạy mẫu thật và QC cùng ngày. Không lấy ngày báo cáo thay ngày chạy.
Hồ sơ trùng nội dung nguồn bị chặn kể cả khi bổ sung máy khác tạo phiên bản
mới. Báo cáo đổi số liệu giữ nguyên hồ sơ/ảnh chụp cũ và tạo việc cần xem xét
mới; không tự huỷ hồ sơ hay tự gắn hồ sơ cũ vào số liệu khác.

NCE có liên kết EQA dùng checklist hành chính, giải thích nhà cung cấp, sáu
nhóm kỹ thuật, chương trình/mẫu và 5 Whys; mỗi mục có trạng thái và bằng
chứng. Kết luận phân loại hành chính/kỹ thuật/chương trình-mẫu hoặc chưa xác
định kèm kế hoạch. Lỗi kỹ thuật không được chọn Không liên quan bệnh nhân;
quyết định ảnh hưởng vẫn cần `nce.release`. Kết luận hiệu lực Hiệu quả chỉ
được ghi khi đợt kế tiếp của cùng xét nghiệm/chương trình chấp nhận tất cả
mẫu, không còn tín hiệu, mẫu chạy sau khi hoàn thành hành động và QC cùng
ngày đủ mức, không có cảnh báo/loại bỏ. Thiếu ngày chạy hoặc QC thì yêu cầu
bổ sung, không suy là đạt. Thay đổi căn cứ sau đánh giá chặn nộp/duyệt cho
tới khi đánh giá lại; CAPA, hoàn thành hành động và duyệt độc lập giữ các
cổng NCE hiện có. Hồ sơ EQA cũ chưa liên kết không bị tự đoán nguồn hay đổi
checklist đã lưu.

Bảng hồ sơ của Khắc phục sự cố hiển thị cột Nguồn / đợt báo cáo. Hồ sơ ngoại
kiểm lấy đợt, năm và chương trình từ ảnh chụp khi lập hồ sơ; tìm kiếm bao gồm
các thông tin này. Hồ sơ cũ chưa có căn cứ không tự suy đợt từ ngày phát hiện.
Bộ lọc Nguồn nằm cùng hàng ô tìm kiếm ở đầu bảng, kết hợp với trạng thái và
tìm kiếm; số đếm trạng thái
theo nguồn đang chọn. Các thẻ tổng quan vẫn tính toàn bộ nguồn.

Tab Báo cáo trong Ngoại kiểm dùng bộ chọn chung và phiếu BMQL một trang A4
dọc theo mẫu đã duyệt. Chỉ giữ thông tin đợt/máy, kết quả sơ khởi, phân tích
và kết luận, truyền đạt và đề xuất CAR; không lặp bảng kết quả, biểu đồ hoặc
dải tổng hợp của Tổng quan. Không hiển thị nút Dữ liệu gốc và Tệp nguồn trong
tab Báo cáo. Lịch sử phiếu xem xét nằm cạnh bản xem trước, hiển thị lần ký mới
nhất trước, người ký, thời điểm và trạng thái căn cứ; bấm một lần ký để đọc
nội dung đã lưu ngay trong khung xem trước, không mở hộp thoại. Phiếu lịch
sử dùng đúng ảnh chụp số liệu và chữ ký tại thời điểm ký; nhận xét hay dữ
liệu nhập sau không được ghép vào phiếu cũ. Dòng được chọn có dấu nhận diện,
có nút trở về bản đang sửa và giữ nguyên bản nháp. Khi xem phiếu cũ, khung
trái hiển thị đúng các trường của lần ký đó, tự chọn bước sơ khởi/phân tích/
hệ thống tương ứng và chỉ cho xem; không lấy trường trống từ lần ký khác.
Trong lúc tải hoặc lỗi không hiển thị nhầm dữ liệu bản nháp. Quay lại bản
đang sửa khôi phục toàn bộ trường và bước đang nhập. PDF/Word xuất đúng phiếu đang xem. Cửa sổ vừa thu gọn lịch
sử xuống dưới bản xem trước, cửa sổ
hẹp xếp ba khung dọc. Không còn nút mở danh sách lịch sử phía trên phiếu.
Mặc định mở đợt gần nhất; vẫn chọn được xem
xét hệ thống cả năm. Bao phủ 12 tháng được ghi nhận trong hồ sơ xem xét hệ
thống, không dựng lại bảng trên phiếu. Xem xét sơ khởi/phân tích/hệ thống lưu nối tiếp
trong `eqa_decisions`, chụp số liệu cùng dấu vân tay, người ký từ phiên và
quyền `nce.approve`. Nhập lại dữ liệu đã xem xét phải có lý do, tạo phiên bản
mới; lần ký cũ được giữ nhưng báo cần xem xét lại. PDF và Word đọc lại dữ
liệu cùng hồ sơ đơn vị/biểu mẫu tại thời điểm xuất. Word là `.docx` OOXML,
cùng bố cục một trang với PDF. Nhận xét mới giới hạn theo từng mục để vừa
phiếu; nhận xét cũ dài hơn vẫn giữ đầy đủ trong lịch sử, yêu cầu ghi xem xét
ngắn gọn mới trước khi xuất một trang. Không cắt ngầm nội dung đã ký.

Khung nhập thông tin bên trái, biểu mẫu xem trước ở giữa và lịch sử bên
phải; toàn bộ bố cục trải hết chiều ngang và thẳng hai mép với bộ chọn báo
cáo phía trên, cột xem trước nhận phần chiều rộng còn lại. Cả ba khung dùng
cùng kiểu panel và tiêu đề thẳng hàng; nút xuất nằm trong tiêu đề khung xem
trước, nhãn trạng thái nằm cạnh tên khung trên cùng một hàng. Khi xem lịch
sử, thông tin lần ký và nút trở về bản đang sửa nằm phía dưới. Giấy báo cáo đặt trên nền nhẹ
với khoảng đệm đều. Header không chừa thêm margin phía dưới; khung nhập
dùng một nguồn khoảng cách là `--panel-padding` (20 px), tránh cộng dồn với
khoảng chừa 16 px của header. Cửa sổ hẹp xếp
khung nhập phía trên. Bản nháp cập nhật trực tiếp trên phiếu, ghi rõ chưa
ký và giữ riêng theo người dùng, chương trình, năm, đợt, máy và bước xem xét.
Hai nút Bỏ thay đổi/Ký xem xét nằm trên một hàng riêng cuối khung nhập,
ngoài vùng nội dung cuộn và có đường phân cách. Nội dung giữ đủ chỗ để đọc
và thao tác tới ô cuối, không bị hàng nút che; chế độ chỉ xem ẩn hàng nút.
Bộ chọn báo cáo có Máy xét nghiệm, mặc định Tất cả máy hoặc chọn riêng từng
máy. Số liệu, tín hiệu điều tra, bao phủ, hồ sơ xem xét và PDF/Word đều theo
phạm vi máy đã chọn. Bản ký tất cả máy và từng máy độc lập; hồ sơ cũ không
có phạm vi máy vẫn thuộc Tất cả máy. Máy chưa có kết quả hiện trạng thái
trống, không tự chuyển sang dữ liệu máy khác.

Với thay đổi mã nguồn, chạy đầy đủ:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Khi thay đổi preload, đăng ký IPC, cửa sổ, máy chủ LAN hoặc tách trang lớn, chạy
thêm test end-to-end trên app Electron thật (khoảng 30 giây, cũng nằm trong
`npm run verify-release`):

```powershell
npm run test:e2e
```

Khi cần đo khả năng xử lý dữ liệu lớn, chạy riêng bài đo 500.000 điểm QC để
không làm chậm hồi quy thường ngày:

```powershell
npm run test:performance
```

Các quyết định nghiệp vụ chuyên sâu của Westgard và Six Sigma được ghi trong
`docs/WESTGARD-REVIEW-*.md` và `docs/SIGMA-REVIEW-*.md`. Phải đọc tài liệu
phù hợp trước khi thay đổi logic của hai khu vực này, đồng thời cập nhật kiểm
thử hồi quy khi thay đổi quyết định nghiệp vụ.

Kế hoạch làm lại hồ sơ sự không phù hợp (mô hình, trạng thái, cổng, lộ trình)
nằm tại `docs/NCE-REDESIGN-2026-10-12.md`; căn cứ tiêu chuẩn, thuật ngữ và
nguyên tắc vẫn ở `docs/NCE-PLAN-2026-09-27.md`. Phải đọc cả hai và đối chiếu
SOP đã được phòng xét nghiệm phê duyệt trước khi sửa nghiệp vụ NCE.

Kế hoạch phân hệ Ngoại kiểm (EQA) — nhập báo cáo PDF của trung tâm ngoại
kiểm và làm nguồn Bias cho Six Sigma — nằm tại
`docs/EQA-PLAN-2026-10-28.md`; nghiệp vụ chuẩn và căn cứ tiêu chuẩn ở
`docs/EQA-REVIEW-2026-10-28.md`, phải đọc trước khi sửa nghiệp vụ ngoại kiểm.

## 7. Quy ước mã nguồn

- Main và renderer bật `noUnusedLocals`/`noUnusedParameters`; import, biến và
  tham số thừa phải được dọn để kiểm tra kiểu và bản dựng đạt.
- Chú thích giải thích mã viết bằng tiếng Việt có đầy đủ dấu.
- Giữ nguyên tên định danh, SQL, tên trường IPC và chuỗi máy đọc để tránh làm
  sai giao thức.
- Không thêm mã mô phỏng hoặc đường lui chuyển đổi dữ liệu vào sản phẩm nếu
  không có yêu cầu nghiệp vụ rõ ràng.
