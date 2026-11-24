# QC Lab Gateway — phần nền

Gateway lưu và chuyển kết quả nội kiểm QC đã chuẩn hoá vào QC Lab. Bộ kết
nối HL7/ASTM/API/tệp của từng LIS sẽ được bổ sung khi có tài liệu. Các lệnh
dưới đây chạy tại thư mục dự án, dùng Node.js của môi trường phát triển;
đã kiểm thử với Node.js 26.5.0. Gateway hiện chạy bằng tiến trình Node riêng,
chưa có bộ cài dịch vụ Windows hoặc cơ chế tự khởi động cùng Windows.

## Luồng dữ liệu

LIS → bộ chuyển đổi → API nhận QC → SQLite Gateway → Electron QC Lab →
người dùng Nhận/Bỏ → Gateway lưu quyết định.

Mặc định Gateway chỉ nghe `127.0.0.1:8787`. Bộ chuyển đổi chạy cùng máy có
thể dùng cổng này. Nếu bộ chuyển đổi ở máy khác, bật cổng ingress HTTPS
riêng. QC Lab vẫn dùng địa chỉ cục bộ và không truy cập trực tiếp máy LIS.

## Khởi tạo và chạy

```powershell
npm.cmd run lis:gateway -- init
npm.cmd run lis:gateway -- token-create --role ingest --source LIS01 --label "LIS chính"
npm.cmd run lis:gateway -- start
```

`init` tạo `%LOCALAPPDATA%\QC Lab Gateway\gateway.sqlite`, in token `admin`
và `app` đúng một lần. Lệnh cấp token nguồn in token `ingest`. Lưu bí mật
trong kho quản lý của đơn vị; CSDL chỉ lưu hash SHA-256, không khôi phục
được token nguyên văn. Chạy lại `init` bị từ chối và giữ token cũ.

Thêm `--data-dir "D:\QC-Gateway"` vào **mọi lệnh** nếu đổi thư mục dữ liệu.
Thư mục này chứa bản tin, ánh xạ, hash token, nhật ký và phải được giới hạn
quyền truy cập cho tài khoản vận hành cùng người quản trị.

Trong Electron, đăng nhập quản trị → Cài đặt & Đám mây → LIS Gateway:

1. Nhập `http://127.0.0.1:8787`.
2. Nhập **token app**, bật kiểm tra hàng chờ và bấm Lưu & kiểm tra.
3. Xem hàng chờ QC, đối chiếu rồi Nhận/Bỏ. Kết quả không tự thành điểm QC.

Gateway thật khởi động với hàng chờ rỗng, không tạo mẫu hoặc ghi vào CSDL
nghiệp vụ của QC Lab. Ctrl+C dừng máy chủ, chờ yêu cầu đang xử lý rồi đóng
SQLite; nếu tiến trình bị dừng đột ngột, SQLite WAL phục hồi lúc mở lại.
Không chạy đồng thời demo hoặc Gateway khác trên cổng 8787.

## Token và quyền

| Vai trò | Quyền |
|---|---|
| `admin` | Quản lý token, ánh xạ, đọc nhật ký/trạng thái/hàng chờ, quyết định Nhận/Bỏ |
| `app` | Đọc trạng thái/hàng chờ, xác nhận Nhận/Bỏ; dùng trong Electron |
| `ingest` | Chỉ gửi QC cho `sourceId` được gắn khi cấp token và kiểm tra health |

Mọi API đều cần `Authorization: Bearer <token>`. Không gửi token qua URL.
Token nguồn không được đọc hàng chờ hoặc tự quyết định nhận/bỏ. Nguồn được
xác định từ token, bên gửi không được tự truyền hoặc giả mạo `sourceId`.
`admin` không được gửi QC thay nguồn; dùng token ingest cho dữ liệu đầu vào.

```powershell
npm.cmd run lis:gateway -- token-list
npm.cmd run lis:gateway -- token-create --role app --label "QC Lab thay thế"
npm.cmd run lis:gateway -- token-revoke --id "ID-TOKEN-CU"
```

Cấp token mới, cập nhật nơi sử dụng, kiểm tra kết nối rồi thu hồi token cũ.
Thu hồi có hiệu lực ở yêu cầu tiếp theo. Không cho thu hồi token admin cuối
cùng trước khi cấp token thay thế. Các lệnh CLI quản trị dựa vào quyền truy
cập hệ điều hành của người vận hành; API quản trị yêu cầu token admin.

## Ánh xạ danh mục

Sao chép `app/gateway-examples/mappings.example.json`, sửa theo danh mục thật
và nhập:

```powershell
npm.cmd run lis:gateway -- mappings-import --file "D:\QC-Gateway\mappings.json"
npm.cmd run lis:gateway -- mappings-list
```

Mỗi ánh xạ có khoá chính xác gồm `sourceId`, `analyzerId`, `testCode`,
`qcLevel`, `qcLotCode`. Đích là `qclabTestId`, `level`, `lot`, `unit` và
`displayName`. `qclabTestId` là ID của đúng cấu hình xét nghiệm–máy, không
phải tên xét nghiệm. Khi chạy từ mã nguồn, quản trị có thể đối chiếu ID qua
API có sẵn `window.qcApi.listTests()` trong DevTools của Electron sau đăng
nhập. Bản cài không mở DevTools; cần lấy danh mục qua quy trình bàn giao.

Nhập lại cùng khoá cập nhật ánh xạ; dùng `active: false` để tắt. Mỗi lần
nhập 1–50 dòng, toàn bộ lô ánh xạ được kiểm tra rồi ghi trong một transaction.
Sai bất kỳ dòng nào sẽ không ghi dòng nào. Dữ liệu phải khớp cả chữ hoa,
chữ thường; không tự chuẩn hoá mã, đoán lô hoặc quy đổi đơn vị.

Bản tin chưa có ánh xạ vẫn được lưu chờ. Khi sửa ánh xạ, bản tin pending
được phân giải lại ở lần đọc tiếp theo. Bản tin đã quyết định giữ ảnh chụp
ánh xạ và không thay đổi theo cấu hình mới. QC Lab kiểm tra lại đơn vị,
lô đang dùng/lô song song và điều kiện nghiệp vụ trước khi tạo điểm.

## Hợp đồng API phiên bản 1

Đây là API chuẩn hoá của Gateway; không giả định bên LIS đã hỗ trợ sẵn.
Bộ chuyển đổi sau này phải đọc bản tin của LIS rồi tạo đối tượng dưới đây.

### Nhận QC

`POST /api/v1/qc-results`, token `ingest`, `Content-Type: application/json`.
Gửi **một** kết quả mỗi yêu cầu. Ví dụ trong
`app/gateway-examples/qc-result.example.json`:

```json
{
  "messageId": "QC-20261114-0001",
  "analyzerId": "MAY01",
  "testCode": "GLU",
  "qcLevel": "L1",
  "qcLotCode": "LOT01",
  "value": 5.1,
  "unit": "mmol/L",
  "measuredAt": "2026-11-14T08:00:00+07:00",
  "runId": "RUN-20261114-01",
  "operator": "KTV mẫu"
}
```

- Bắt buộc mọi trường ngoài `runId` và `operator`. `value` phải là số JSON
  hữu hạn; số 0 hợp lệ, null/boolean/chuỗi số bị từ chối.
- `messageId` tối đa 200 ký tự; mã máy/xét nghiệm tối đa 120; mức nguồn 40;
  lô và đơn vị 80; lần chạy/người thực hiện 120. Không chấp nhận ký tự điều
  khiển hoặc khoảng trắng thừa ở đầu/cuối.
- `measuredAt` phải có giây và múi giờ `Z` hoặc `±HH:mm`; phần giây lẻ tối đa
  ba chữ số. Gateway lưu theo UTC. QC Lab hiển thị ngày đo theo giờ máy;
  máy QC Lab phải dùng múi giờ vận hành đúng của phòng xét nghiệm.
- Chỉ nhận các trường đã công bố. Không nhận trường dữ liệu bệnh nhân,
  `sourceId` hoặc `resolved` do bên gửi tự gán. Các trường hợp ngoài hợp
  đồng trả 400; bộ chuyển đổi phải lọc đúng kết quả QC trước khi gửi.

Phản hồi 201 chỉ được gửi sau khi bản tin và nhật ký đã commit:

```json
{
  "duplicate": false,
  "messageId": "UUID-DO-GATEWAY-CAP",
  "sourceMessageId": "QC-20261114-0001",
  "status": "pending"
}
```

Khoá chống trùng là `(sourceId, messageId nguồn)`, không dùng giá trị đo để
đoán trùng. Mã `messageId` trong hàng chờ QC Lab là UUID ổn định do Gateway
cấp, tránh đụng mã giữa hai nguồn. Giữ nguyên mã nguồn khi thử lại:

- Cùng mã và nội dung chuẩn hoá: trả 200 cùng UUID, kể cả đã Nhận/Bỏ hoặc
  đã khởi động lại; không thêm bản tin.
- Cùng mã nhưng nội dung khác: trả 409 `message-conflict`, giữ nguyên bản
  tin cũ. Đối chiếu với LIS, không tự ghi đè hoặc cấp mã mới để né xung đột.
- Thiếu ánh xạ hoặc sai đơn vị: bản tin hợp cấu trúc vẫn được lưu pending,
  hiện ở Chưa khớp cấu hình; chưa thể nhận thành điểm QC.
- 201/200 nghĩa là Gateway đã giữ bản tin, **chưa có nghĩa QC Lab đã nhận**.

Bộ chuyển đổi chỉ đánh dấu đã giao sau 200/201. Nếu mất kết nối, 429 hoặc
5xx, giữ bản tin tại nguồn và thử lại cùng mã với khoảng chờ tăng dần; tôn
trọng `Retry-After`. 400/401/403/409/413/415 cần sửa dữ liệu, quyền hoặc cấu
hình trước khi thử lại. Phần tự đọc/gửi lại từ LIS thuộc bộ kết nối sau này.

### Hàng chờ và quyết định

| API | Vai trò | Nội dung |
|---|---|---|
| `GET /health` | Tất cả | `{ok:true,mode:"gateway",version:1}` |
| `GET /api/v1/qc-results?status=pending&limit=500` | app/admin | `{items:[...],nextCursor:null hoặc UUID}` |
| `POST /api/v1/qc-results/decide` | app/admin | `{messageId:"UUID",status:"imported hoặc rejected",by:"Tên người dùng",note:"Tuỳ chọn"}` |
| `GET /api/v1/status` | app/admin | Số bản tin theo trạng thái và số ánh xạ |
| `GET /api/v1/mappings` | admin | Danh sách ánh xạ |
| `PUT /api/v1/mappings` | admin | Mảng 1–50 ánh xạ như tệp mẫu |
| `GET /api/v1/tokens` | admin | Metadata token, không có token/hash |
| `POST /api/v1/tokens` | admin | `{role:"ingest",sourceId:"LIS01",label:"LIS chính"}`, trả token mới đúng một lần |
| `POST /api/v1/tokens/{id}/revoke` | admin | Body `{}`, thu hồi token |
| `GET /api/v1/audit?after=0&limit=100` | admin | Nhật ký tăng dần theo ID |

Hàng chờ hỗ trợ `pending`, `imported`, `rejected`; giới hạn 1–500 và tham số
`after=<nextCursor>` để đọc tiếp. Bản ghi trả `id`, `receivedAt`, `status`,
`message`, `resolved` theo hợp đồng IPC hiện có, cùng `source`
(`{sourceId, messageId}` là nguồn và mã bản tin gốc của LIS). QC Lab đọc
lần lượt các trang theo `nextCursor`, tối đa 20 trang (10.000 bản tin chờ)
mỗi lượt, nên bản tin chưa ánh xạ dồn lại không che mất bản tin hợp lệ mới.
Nên Bỏ định kỳ các bản tin không dùng để hàng chờ không phình to.

Trường `by` của quyết định tối đa 200 ký tự, `note` tối đa 1000 ký tự, đều
một dòng. QC Lab tự gộp khoảng trắng và cắt họ tên người dùng cho vừa giới hạn.

Nhận/Bỏ là trạng thái cuối, không xoá cứng. Xác nhận lại cùng trạng thái
trả 200; đổi từ imported sang rejected hoặc ngược lại trả 409. QC Lab ghi
điểm và dấu vết trong cùng transaction trước khi xác nhận; nếu mất xác
nhận, lần làm mới hàng chờ sẽ thử lại mà không tạo thêm điểm. Gateway vẫn
chấp nhận xác nhận sau khi ánh xạ bị đổi/tắt để không kẹt dấu vết đã lưu.

Mỗi thao tác ghi kiểm quyền, kiểm dữ liệu thuần, ghi transaction kèm nhật
ký rồi thông báo thay đổi trong tiến trình. Lỗi ghi nhật ký rollback cả
thao tác. Nhật ký Gateway ghi token ID, thao tác, mã bản tin và cấu hình
ánh xạ; không ghi token nguyên văn. Đây là nhật ký vận hành, chưa có chữ
ký chống sửa bởi người có quyền trực tiếp lên tệp SQLite.

### Giới hạn và lỗi

Body tối đa 64 KiB, chỉ JSON UTF-8, không nén; giới hạn 600 yêu cầu/phút/IP
trên mỗi cổng, 429 kèm `Retry-After`. Timeout nhận yêu cầu 10 giây. API không
bật CORS và từ chối Origin của trang web. Các phản hồi lỗi có `code`,
`message`, `requestId`; log vận hành nằm trong `logs/qclab.log`, xoay vòng
5 tệp tối đa khoảng 1 MiB/tệp. Log lỗi chỉ chứa mã lỗi và requestId, không
có body, token hoặc URL do client gửi. Giới hạn tần suất là bộ nhớ mỗi
tiến trình, không phải cơ chế chặn tấn công phân tán.

## Bật tiếp nhận từ mạng

Ví dụ khi đã có chứng chỉ phù hợp tên/IP Gateway và bộ chuyển đổi ở máy khác:

```powershell
npm.cmd run lis:gateway -- start --ingress-host 192.168.1.72 --ingress-port 8788 --tls-cert "D:\QC-Gateway\server.crt" --tls-key "D:\QC-Gateway\server.key"
```

Bên gửi phải tin chuỗi chứng chỉ và kiểm tra tên/IP, không bỏ kiểm TLS.
Phần nền không tự tạo hoặc gia hạn chứng chỉ. Cổng ingress chỉ nhận
`GET /health` và `POST /api/v1/qc-results` bằng token ingest; không mở API
quản trị, hàng chờ hoặc quyết định trên mạng. Cổng quản trị vẫn là loopback.
Khi triển khai thực tế, cấu hình firewall chỉ cho máy LIS/bộ chuyển đổi
truy cập cổng ingress đã thống nhất.

## Sao lưu và phục hồi

```powershell
npm.cmd run lis:gateway -- backup --file "D:\QC-Backup\gateway-20261114.sqlite"
npm.cmd run lis:gateway -- status
```

Sao lưu dùng [SQLite backup của Node.js](https://nodejs.org/api/sqlite.html#sqlitebackupsourceDb-path-options),
tạo ảnh nhất quán cả khi đang có WAL, không ghi đè bản sao lưu sẵn có. Sao
lưu riêng Gateway bên cạnh bản sao lưu QC Lab: hai CSDL có vai trò khác nhau.

Phục hồi khi đã dừng Gateway và các tiến trình CLI: giữ nguyên thư mục cũ,
tạo thư mục mới, chép bản sao lưu thành `gateway.sqlite` trong thư mục mới,
rồi chạy với `--data-dir` mới. Không chép kèm WAL/SHM từ thư mục cũ. Token
đã cấp trước thời điểm sao lưu vẫn dùng được; token/quyết định phát sinh sau
bản sao lưu cần đối chiếu trước khi cho bộ kết nối chạy lại. Giữ nguyên
nguồn và mã bản tin khi gửi lại để cơ chế chống trùng tiếp tục hoạt động.

Bản tin đã nhận sau thời điểm sao lưu có thể được LIS gửi lại và nhận UUID
Gateway mới. QC Lab so `source` với dấu vết đã nhận: nếu cùng nguồn và mã
gốc, bản tin hiện ở Chưa khớp cấu hình với lý do đã nhận trước đó và không
thể Nhận lần hai; đối chiếu rồi Bỏ. Dấu vết nhận trước bản cập nhật này
không có `source` nên không được bảo vệ theo cách này.

## Kiểm thử

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
node --test app/e2e/lis-persistent-gateway.e2e.mjs
npm.cmd run lis:demo -- --persistent
```

Demo SQLite tạo tài khoản/danh mục/mẫu trong `.cache/lis-demo-*`, gửi mẫu qua
API ingress cục bộ có xác thực và mở hàng chờ trên Electron. Khác với
Gateway thật, demo tạo dữ liệu mẫu và tự dừng Gateway khi thoát phiên.
Bản demo giả lập trong bộ nhớ vẫn có ở `npm.cmd run lis:demo` hoặc
`npm.cmd run lis:mock -- --test-id <ID>`.

Phần nền có thể dùng để tích hợp và nghiệm thu; khả năng tương thích với
một LIS cụ thể chỉ được xác nhận sau khi hoàn thành bộ chuyển đổi và đối
chiếu kết quả thật. Chưa có cơ chế tự đẩy quyết định ngược vào LIS; API
quyết định hiện phục vụ xác nhận giữa QC Lab và Gateway.
