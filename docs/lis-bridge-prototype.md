# Prototype LIS Gateway — nhận kết quả QC từ middleware

## Phạm vi và chiều dữ liệu

Chiều: **máy xét nghiệm → middleware LIS (phần mềm trung gian sẵn có của phòng) →
Gateway này → QC Lab**. Middleware vốn đã có kết quả chạy mẫu QC vì nó đi chung đường
với mọi kết quả khác; mục tiêu là lấy từ nơi đã có, thay vì bắt KTV gõ tay lại.

Gateway chạy thành tiến trình Node riêng, chỉ bind `127.0.0.1` mặc định. Nó **không**
quyết định gì về việc phát hành kết quả bệnh nhân — không có khái niệm
accepted/review/held. Nó chỉ nhận một loại bản ghi mới ("kết quả QC") và giữ ở hàng chờ
cho tới khi người dùng QC Lab xem và xác nhận.

Kết quả nhận vào **không tự thành điểm QC**. Nó nằm ở trạng thái `pending` cho tới khi
KTV mở **QC Lab → Cài đặt → Xem hàng chờ QC**, đối chiếu mức/lô rồi bấm **Nhận** — lúc
đó mới đi qua `EntryService` như một điểm nhập tay, nên vẫn chịu khóa kỳ báo cáo, vẫn
ghi audit, vẫn lưu theo phân vùng.

Gateway chủ động từ chối các trường như `patientName`, `patientId`, ngày sinh, điện
thoại, địa chỉ, `specimenRef`. Đây chưa phải LIS lâm sàng — không dùng dữ liệu bệnh
nhân thật ở giai đoạn này. `lis-gateway/` cũng chưa được đóng vào bộ cài Electron dành
cho người dùng cuối, chỉ chạy được từ source tree.

## Chạy thử

```powershell
npm run lis:gateway
```

Terminal báo địa chỉ `http://127.0.0.1:8787`, journal tại
`lis-gateway/.data/events.ndjson`, và **Bearer token**. Thư mục `.data/` bị Git bỏ qua.

## Xác thực — không có chế độ mở

Gateway **không chạy nếu thiếu token**. Lần đầu chạy, nó tự sinh một token 32 byte và
lưu vào `lis-gateway/.data/token.txt` (quyền 0600), rồi in ra terminal. Muốn tự đặt thì
dùng biến môi trường `QCLAB_LIS_TOKEN`.

Dán token đó vào **QC Lab → Cài đặt → LIS Gateway → Bearer token**. Token nằm ở
`localStorage` của từng máy, không đồng bộ Firebase — mỗi máy chạy QC Lab phải dán
riêng.

Ba lớp bảo vệ, mỗi lớp có test riêng trong `tests/lis-gateway.test.js`:

1. **Token bắt buộc** — `createLisServer()` ném lỗi nếu không có token; so sánh bằng
   `crypto.timingSafeEqual`.
2. **Bắt buộc `content-type: application/json`** cho mọi request có thân → 415 nếu
   khác. Đây là rào chống CSRF: `POST` kèm `text/plain` là "simple request" nên trình
   duyệt không preflight.
3. **Allowlist origin ở preflight** — origin lạ bị 403 trước khi tới handler.

`/health` không cần token (liveness) nên **không** kèm số liệu vận hành; số liệu nằm ở
`GET /api/v1/status` phía sau token.

## Mapping: sinh và đối chiếu bằng `npm run lis:config`

`qclabTestId` là **ID nội bộ** do app sinh (`uid()`, dạng `a3f9k2p`), không phải tên
hiển thị, và không màn hình nào trong app hiện nó. Mapping còn cần khai **`levels`**
(bắt buộc — mỗi hãng gọi mức QC một kiểu: `1/2/3`, `L/N/H`, `NORMAL/ABNORMAL`...) và
**`lots`** (tùy chọn — không khai thì lấy nguyên mã lô middleware gửi). Đoán sai một
mức QC là ghi điểm vào **nhầm mức**, hỏng cả Levey-Jennings lẫn Westgard của cả hai
mức — đây là chỗ nghiêm trọng nhất trong toàn bộ cấu hình.

State nằm trong localStorage/IndexedDB của trình duyệt nên script Node không đọc thẳng
được; nguồn offline duy nhất là file backup do chính app xuất ra
(**Cài đặt → Quản trị dữ liệu → Xuất backup**).

```bash
npm run lis:config -- qclab-backup.json -o D:\qclab-lis\config.json
```

Sinh sẵn một dòng mapping cho mỗi xét nghiệm đang bật, điền trước `qclabTestId`,
`displayName`, `expectedUnit`, `levels` và `lots` theo đúng cấu hình QC Lab hiện có;
`analyzerId`/`testCode`/mã mức/mã lô để giá trị mẫu cho người dùng thay. Script
**không ghi đè** file đã tồn tại. Nhận cả gói backup mới lẫn backup cũ dạng state thô.

Sau khi điền mã máy thật, đối chiếu lại:

```bash
npm run lis:config -- qclab-backup.json --check D:\qclab-lis\config.json
```

Bắt các lớp lỗi sau, mỗi lớp có test riêng trong `tests/lis-config.test.js`:

| Lỗi | Hậu quả nếu không bắt |
|---|---|
| Còn giá trị mẫu | chạy với mã máy/mức/lô giả, mọi kết quả nằm mãi ở hàng chờ |
| `qclabTestId` không có trong backup | nằm mãi ở hàng chờ với `UNMAPPED_TEST` — lỗi khó tìm nhất |
| Mức QC không khớp cấu hình xét nghiệm | ghi điểm vào nhầm mức nếu lỡ nhận — sửa **trước khi** bấm Nhận |
| `expectedUnit` lệch đơn vị xét nghiệm | mọi kết quả `UNIT_MISMATCH` |
| Trùng `analyzerId`+`testCode` | gateway từ chối khởi động (bắt bằng chính `buildMappingIndex()`) |

Thêm cảnh báo (không chặn) cho: xét nghiệm chưa được mapping, mã lô không khớp cấu
hình hiện tại, `allowedOrigins` rỗng.

## Middleware đẩy kết quả QC vào

```powershell
$h = @{ Authorization = "Bearer $tok" }
$body = @{
  messageId='M-001'; analyzerId='EASYLYTE-01'; testCode='NA'; qcLevel='1'
  qcLotCode='LOT-2026-A'; value=141.2; unit='mmol/L'
  measuredAt=(Get-Date).ToString('o'); runId='lan-1'; operator='KTV A'
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/api/v1/qc-results -Headers $h -ContentType application/json -Body $body
```

Gửi cả lô trong một request: `{"items":[{...},{...}]}` (tối đa 500, tất cả được chuẩn
hóa rồi mới ghi — một phần tử hỏng làm hỏng cả lô, thay vì ghi nửa chừng).
`messageId` dùng để chống trùng: gửi lại đúng id + nội dung trả về bản cũ với
`duplicate: true`; cùng id nhưng nội dung khác trả HTTP 409.

Kết quả nhận vào rơi vào một trong ba nhóm:
- **`held`** (thực ra vẫn `pending`, nhưng `resolved.ok=false`) nếu thiếu mapping, sai
  mức, hoặc lệch đơn vị — kèm `resolved.reason` để biết sửa cấu hình chỗ nào.
- **`pending`, `resolved.ok=true`** nếu khớp mapping — sẵn sàng để nhận.
- Middleware gửi trực tiếp trường bệnh nhân (`patientId`, `patientName`,...) hay
  `specimenRef` → bị từ chối thẳng với `PHI_NOT_ALLOWED`, không được ghi vào journal.

## QC Lab nhận kết quả

**Cài đặt → LIS Gateway (thử nghiệm)**: dán token, tích **Tự động kiểm tra hàng chờ
mỗi 5 phút**, bấm **Lưu & kiểm tra**. Sau đó bấm **Xem hàng chờ QC** bất kỳ lúc nào để
mở danh sách:

- **Sẵn sàng nhận** — đã khớp mapping. Bấm **Nhận** để ghi thành điểm QC thật (đi qua
  `EntryService`, chịu khóa kỳ, ghi audit); bấm **Bỏ** để loại khỏi hàng chờ
  (`confirmDialog` xác nhận trước).
- **Chưa khớp cấu hình** — hiện lý do gateway trả về; chỉ có thể **Bỏ**, không thể
  **Nhận** (tránh ghi điểm rác vào nhầm xét nghiệm/mức).

Ngày của điểm QC lấy theo **giờ địa phương của máy chạy app**, không phải phần ngày
của chuỗi UTC — một kết quả đo 06:05 sáng giờ Việt Nam có `measuredAt` là 23:05 UTC hôm
trước.

## Xem hàng chờ / trạng thái qua API

```powershell
Invoke-RestMethod "http://127.0.0.1:8787/api/v1/qc-results?status=pending" -Headers $h
Invoke-RestMethod http://127.0.0.1:8787/api/v1/status -Headers $h
Invoke-RestMethod http://127.0.0.1:8787/health   # khong can token
```

Journal append-only giúp dựng lại hàng chờ và quyết định đã ghi sau khi tiến trình
khởi động lại. Dòng cuối chưa hoàn chỉnh do tắt máy đột ngột được cách ly; lỗi ở giữa
journal bị chặn thay vì âm thầm bỏ qua.

## Cấu hình và bảo mật

- Copy `config.example.json` ra ngoài repo rồi đặt đường dẫn bằng `QCLAB_LIS_CONFIG`.
  Đừng gõ tay `qclabTestId` — dùng `npm run lis:config` (ở trên).
- Đổi thư mục dữ liệu bằng `QCLAB_LIS_DATA`.
- `QCLAB_LIS_PORT` đổi cổng, **nhưng chỉ dùng được cho kiểm thử bằng curl/PowerShell**.
  App KHÔNG kết nối được sang cổng khác 8787: CSP `connect-src` trong `index.html` chỉ
  mở `http://127.0.0.1:8787` và `http://localhost:8787`, và `lisNormalizeGatewayUrl()`
  cũng chốt đúng hai origin đó. Đổi cổng mà quên hai chỗ này thì fetch bị chặn ở tầng
  CSP — app chỉ hiện "Lỗi kết nối" chứ không nói vì sao. Muốn đổi thật thì sửa cả ba.
- `QCLAB_LIS_TOKEN` ghi đè token tự sinh. Không có chế độ chạy thiếu token.
- Token tự sinh nằm ở `<data>/token.txt`; xóa file này để cấp lại token mới.

Journal NDJSON phù hợp cho prototype và kiểm chứng contract, không phải kho lâm sàng
production. Bước production phải thay bằng PostgreSQL có transaction, inbox/outbox,
mã hóa, backup và kiểm soát truy cập.

## Ngoài phạm vi đã validate

`docs/validation/URS.md` mục "Ngoài phạm vi" ghi rõ: `lis-gateway/` là prototype
nghiên cứu, không thuộc sản phẩm đã validate — không nằm trong `build.files`, mặc định
tắt phía app, không có hàng nào trong `TRACEABILITY.md`.

## Bước tiếp theo

1. Chốt mapping (mã máy + mã xét nghiệm + mức + lô + đơn vị) với một máy thật, dùng
   `npm run lis:config --check` để xác nhận trước khi chạy thật.
2. Xác nhận với đơn vị vận hành middleware LIS: họ đẩy kết quả QC vào Gateway theo
   đúng hợp đồng `POST /api/v1/qc-results` ở trên, không phải chỉnh quy trình phát
   hành kết quả bệnh nhân của họ.
3. Chỉ sau khi có nhu cầu thật từ một phòng cụ thể mới tính production: thay journal
   NDJSON bằng kho có transaction, thêm kiểm soát truy cập/mã hóa, và đưa `lis-gateway/`
   vào bộ cài Electron.
