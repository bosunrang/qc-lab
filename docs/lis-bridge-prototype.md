# Prototype LIS Bridge + QC Gate

## Phạm vi

Prototype chạy thành tiến trình Node riêng, chỉ bind `127.0.0.1` mặc định. Nó nhận
kết quả máy đã ẩn danh, mapping mã máy sang `qclabTestId`, rồi dùng trạng thái QC gần
nhất để quyết định:

- `accepted / QC_ACCEPTED`: được đi tiếp;
- `review / QC_ALERT`: cần duyệt thủ công;
- `held / QC_REJECTED`: giữ vì QC bị loại;
- `held / QC_UNKNOWN|QC_STALE`: chưa có, chưa đủ bằng chứng hoặc QC quá cũ;
- `held / UNMAPPED_TEST|UNIT_MISMATCH`: cấu hình giao tiếp chưa an toàn.

Đây chưa phải LIS lâm sàng. Gateway chủ động từ chối các field như `patientName`,
`patientId`, ngày sinh, điện thoại và địa chỉ. `specimenRef` trong demo chỉ là mã mẫu
ẩn danh. Không dùng dữ liệu bệnh nhân thật ở giai đoạn này.

## Chạy thử

```powershell
npm run lis:gateway
```

Terminal sẽ báo địa chỉ `http://127.0.0.1:8787`, journal tại
`lis-gateway/.data/events.ndjson`, và **Bearer token**. Thư mục `.data/` bị Git bỏ qua.

## Xác thực — không có chế độ mở

Gateway **không chạy nếu thiếu token**. Lần đầu chạy, nó tự sinh một token 32 byte và lưu
vào `lis-gateway/.data/token.txt` (quyền 0600), rồi in ra terminal. Muốn tự đặt thì dùng
biến môi trường `QCLAB_LIS_TOKEN`.

Dán token đó vào **Cài đặt → LIS Gateway → Bearer token** trong QC Lab. Token nằm ở
`localStorage` của từng máy, không đồng bộ Firebase.

Ba lớp bảo vệ, mỗi lớp có test riêng trong `tests/lis-gateway.test.js`:

1. **Token bắt buộc** — `createLisServer()` ném lỗi nếu không có token; so sánh bằng
   `crypto.timingSafeEqual`. Bản đầu có `if(!token)return true` nên mặc định là mở toang.
2. **Bắt buộc `content-type: application/json`** cho mọi request có thân → 415 nếu khác.
   Đây là rào chống CSRF: `POST` kèm `text/plain` là "simple request" nên trình duyệt
   không preflight, và bản đầu `JSON.parse` bất kể content-type — một trang web bất kỳ
   ghi thẳng được vào journal (đã đo: 201 từ `https://evil.example`; nay là 401/415).
3. **Allowlist origin ở preflight** — origin lạ bị 403 trước khi tới handler.

`/health` không cần token (liveness) nên **không** kèm số liệu vận hành; số liệu nằm ở
`GET /api/v1/status` phía sau token.

## Gửi trạng thái QC

App gửi **cả lô trong một request** và tự gửi lại theo nhịp 30 phút
(`LIS_HEARTBEAT_MS`). Gateway coi trạng thái hết hạn sau 90 phút
(`DEFAULT_STALE_MINUTES`) và chuyển sang **giữ** kết quả — 90 phút cho phép lỡ 2 nhịp.

Thử tay bằng PowerShell (thay `$tok` bằng token in ra ở trên):

```powershell
$h = @{ Authorization = "Bearer $tok" }
$qc = @{ items = @(@{ qclabTestId='T1'; status='ok'; asOf=(Get-Date).ToString('o'); reason='Westgard đạt' }) } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Put -Uri http://127.0.0.1:8787/api/v1/qc-status -Headers $h -ContentType application/json -Body $qc
```

Hoặc vào **Cài đặt → LIS Gateway (thử nghiệm)** trong QC Lab, bật tự động và bấm
**Lưu & kiểm tra**. App sẽ gửi snapshot ngay khi đăng nhập và lên lịch gửi lại sau
các thay đổi ảnh hưởng phép tính QC. Không có điểm QC gửi `unknown`; thiếu mức trong
ngày gửi `warn`; chỉ đủ mức và Westgard đạt mới gửi `ok`.

Gửi kết quả máy giả lập:

```powershell
$result = Get-Content -Raw lis-gateway/examples/result-glucose.json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/api/v1/messages -Headers $h -ContentType application/json -Body $result
```

Xem inbox và tình trạng dịch vụ:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/v1/messages -Headers $h
Invoke-RestMethod http://127.0.0.1:8787/api/v1/status -Headers $h
Invoke-RestMethod http://127.0.0.1:8787/health   # khong can token
```

Gửi lại đúng `messageId` + nội dung trả về bản cũ với `duplicate: true`; cùng
`messageId` nhưng nội dung khác trả HTTP 409. Journal append-only giúp dựng lại inbox
và trạng thái QC sau khi tiến trình khởi động lại. Dòng cuối chưa hoàn chỉnh do tắt máy
đột ngột được cách ly; lỗi ở giữa journal bị chặn thay vì âm thầm bỏ qua.

## Cấu hình và bảo mật

- Copy `config.example.json` ra ngoài repo rồi đặt đường dẫn bằng
  `QCLAB_LIS_CONFIG`.
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

Prototype hiện chỉ chạy từ source tree; `lis-gateway/` chưa được đóng vào bộ cài
Electron dành cho người dùng cuối.

## Bước tiếp theo

1. Chốt mapping theo thiết bị + mã xét nghiệm + đơn vị với một máy thật.
2. Viết adapter đầu tiên từ file/ASTM/HL7 của đúng model máy.
3. Thêm màn hình inbox chỉ đọc và cơ chế giải phóng kết quả có audit.
4. Chỉ sau khi hoàn tất threat model mới thêm Patient, ServiceRequest, Specimen,
   Observation và DiagnosticReport vào PostgreSQL.
