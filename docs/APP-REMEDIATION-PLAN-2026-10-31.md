# Kế hoạch khắc phục sau đánh giá tổng thể — 31/10/2026

Đi kèm `docs/APP-REVIEW-2026-10-31.md`; mã phát hiện (N1, A2, U1…) lấy theo
tài liệu đó. Kế hoạch chia thành **gói việc** (GV), mỗi gói là một thay đổi có
thể review và commit riêng, kèm test hồi quy trong `app/tests/`.

Ước lượng: **S** ≤ nửa ngày · **M** 1–2 ngày · **L** 3 ngày trở lên (gồm cả test).

Nguyên tắc chung cho mọi gói:

- Mọi ghi dữ liệu mới vẫn đi qua `writeCommand()`; thay đổi schema thêm bước
  migration kế tiếp (hiện là 7 → 8…), không sửa bước đã phát hành.
- Quyết định nghiệp vụ lấy căn cứ từ ISO 15189:2022, CLSI C24-Ed4, Westgard và
  các quyết định đã chốt (D-03 "không hồi tố"…), ghi căn cứ ngay trong gói.
- Gói chạm tệp đang có thay đổi EQA chưa commit (`operations.ts`,
  `eqa-handlers.ts`, `preload.ts`, `qc-api.d.ts`) chỉ bắt đầu sau khi phần EQA
  đó đã được commit.

## Tổng quan và thứ tự

| Gói | Nội dung | Phát hiện | Ưu tiên | Ước lượng | Phụ thuộc |
|---|---|---|---|---|---|
| GV0 | Enter trong danh sách `select` | U1 | P0 | S | — |
| GV1 | Quyền cấu hình tiêu chí QC | N1, N3, N8 | P0 | M | — |
| GV2 | Kết luận QC không hồi tố | N2 | P0 | L | sau GV1 |
| GV3 | Toàn vẹn nhật ký | A2, A7, A8 | P0 | M | — |
| GV4 | Huỷ điểm của run bị loại + xem xét định kỳ dữ liệu QC | N4, ISO 7.3.7.2 | P0 | M–L | sau GV1 |
| GV5 | Phiên và quyền truy cập | A1, A3, A10, Q1 | P0 | M | sau commit EQA |
| GV6 | Đồng bộ Firebase an toàn | A4, A5 | P0 | M | — |
| GV7 | Sửa nghiệp vụ EQA | N5, N6 | P1 | S–M | sau commit EQA |
| GV8 | Sửa nghiệp vụ Westgard, lô, dải | N7, N9–N12, N14 | P1 | M | sau GV2 |
| GV9 | Modal, focus, màu | U2–U6 | P1 | M | sau GV0 |
| GV10 | Đóng gói, phát hành, phụ thuộc | Q3, A9 | P1 | M | cần chứng chỉ ký số |
| GV11 | Dọn chất lượng mã và giao diện | Q2, Q4–Q8, U7–U12, A6, A11 | P2 | dần dần | — |

Các gói chạy song song được (không chạm cùng tệp): **GV0, GV1, GV3, GV6**.
GV2 và GV4 cùng chạm luồng Westgard/nhập điểm với GV1 nên đi sau GV1.

## GV0 — Enter trong danh sách `select` (U1, P0, S) — đã làm 31/10/2026

- **Vấn đề:** từ commit `86b3dbc`, Enter khi danh sách đang mở phát ra từ
  `OPTION` và lan lên `Modal`, làm bấm nút Lưu.
- **Đã làm:** bộ lọc phím Enter tách thành hàm thuần `modalEnterSubmits()`
  (`renderer/lib/modal-enter.ts`), thêm cổng loại trừ `OPTION`. Enter trên ô
  `SELECT` đang đóng vẫn lưu form như trước. `DialogHost.tsx` không tự xử lý
  Enter nên không cần sửa.
- **Test:** `app/tests/modal-enter.test.mjs`.

## GV1 — Quyền cấu hình tiêu chí QC (N1, N3, N8, P0, M)

- **Căn cứ:** ISO 15189:2022 6.2.3 (phân quyền nhân sự cho từng hoạt động),
  7.3.7.2 (tiêu chí chấp nhận QC do người có thẩm quyền đặt), CLSI C24-Ed4 (giới
  hạn kiểm soát dựa trên SD quan sát).
- **Đã làm (31/10/2026)** — chi tiết khác bản thiết kế đầu ghi ở cuối mục:
  1. Capability `qc.config` trong `domain/capabilities.ts` (danh sách chung cùng
     `nce.release`/`nce.approve`, cột `users.capabilities_json`, không cần
     migration). Admin mặc nhiên có; cấp riêng ở trang Người dùng, mục "Quyền
     nghiệp vụ". Tên IPC `setUserNceCapabilities` giữ nguyên.
  2. Cổng `requireQcConfig(db)` (`ipc/shared.ts`) đọc capability từ CSDL ở mỗi
     lần ghi, áp cho `applyLabRange`, `revertManufacturerRange` (trang Nhập QC)
     và `saveTeaConfig` (trang Six Sigma). Giao diện khoá nút/ô và nói rõ lý do.
  3. `saveRuleAction` chuyển sang `admin`, cùng mức `saveRuleScope`; lưu lại y
     nguyên giá trị cũ là `noChange`.
  4. Nhật ký ghi trước → sau cho hành động luật, dải QC, hoàn dải, TEa Six
     Sigma, phân quyền. Lập dải ghi thêm dải đề xuất, mức lệch của Mean/SD tay
     (`manualRangeDeviation`, cảnh báo khi SD tay > 1,5 × SD quan sát hoặc Mean
     dời > 1 SD — ngưỡng nội bộ), căn cứ cổng sai số hệ thống và Bias đối chiếu
     so với Mean nhà sản xuất. Modal lập dải hiện cảnh báo tương ứng.
  5. Hồ sơ TEa PXN có trường `sourceUrl` (chỉ nhận http/https), **bắt buộc**
     với "Nguồn khác đã thẩm định". EFLM chỉ coi là đã truy vết khi có ngày tra.
- **Khác thiết kế đầu, và lý do:**
  - Không mở các thao tác TEa đang `admin` cho người có `qc.config`: chúng nằm
    ở trang Cấu hình chung vốn chỉ admin vào được, mở ở main là nới quyền vô ích.
  - Bias ở cổng sai số hệ thống vẫn do người dùng nhập: đó là số đo ngoài app
    (ngoại kiểm, vật liệu chuẩn sau hiệu chuẩn), main không tính lại đúng nghĩa
    được. Giờ chỉ người có `qc.config` nhập, và main ghi kèm Bias đối chiếu.
  - Không thêm ô "lý do riêng" cho Mean/SD tay vượt ngưỡng (sẽ phải sửa
    `qc-api.d.ts` đang có thay đổi EQA chưa commit); mức lệch và nhãn "VƯỢT
    NGƯỠNG CẢNH BÁO" được ghi thẳng vào nhật ký.
  - EFLM chỉ cần ngày tra (không đòi tên xét nghiệm EFLM): ô tên ở trang Six
    Sigma mặc định hiện tên xét nghiệm, để trống hiểu là tên đó.
- **Test:** `app/tests/qc-config-permissions.test.mjs` (9 ca); cập nhật
  `role-gating.test.mjs` (KTV không còn đổi được hành động luật) và SG05 trong
  `sigma-review-regressions.test.mjs` (EFLM cần ngày tra).

## GV2 — Kết luận QC không hồi tố (N2, P0, L)

- **Căn cứ:** ISO 15189:2022 8.4 (tính toàn vẹn hồ sơ); quyết định D-03 (không
  hồi tố); khoá kỳ báo cáo phải bất biến.
- **Phương án — cấu hình luật có hiệu lực theo ngày:**
  1. Migration 8: bảng `rule_config_history(id, scope, rules_json, scopes_json,
     effective_from, changed_by, changed_at, reason)` với `scope` là `'global'`
     hoặc `test_id`. Nạp sẵn một dòng từ cấu hình hiện hành với
     `effective_from = ''` (áp cho mọi dữ liệu cũ).
  2. Mọi thay đổi luật ghi một dòng mới với `effective_from` = ngày làm việc
     hiện tại (theo giờ địa phương, D-13), **không cho chọn ngày lùi**; bắt buộc
     lý do. Không cho `effective_from` rơi vào kỳ đã khoá.
  3. Engine: đổi chữ ký `isOn(rule)` / `actionOf(rule)` thành
     `isOn(rule, i)` / `actionOf(rule, i)`. Tầng `db/westgard-evaluation.ts` dựng
     dòng thời gian cấu hình và chọn cấu hình theo ngày của điểm `i`. Luật đếm
     chuỗi vẫn nhìn lại các điểm trước, nhưng quyết định của điểm `i` dùng cấu
     hình hiệu lực tại điểm `i`.
  4. Bộ đệm tóm tắt Westgard huỷ theo cả `rule_config_history`.
  5. Trang Westgard và modal xét nghiệm hiện "Cấu hình hiệu lực từ …" và lịch sử thay đổi.
- **Vì sao không chọn lưu snapshot kết luận từng run:** snapshot phải được ghi
  lại mỗi khi điểm trước đó bị huỷ hay sửa, dễ lệch với engine; còn cấu hình theo
  ngày giữ engine là nguồn duy nhất và tính lại luôn ra cùng kết quả.
- **Test:** đổi 1-3s sang "Cảnh báo" hôm nay không đổi kết luận của run hôm qua;
  thay đổi không được rơi vào kỳ đã khoá; thêm ca vào bộ thẩm định `app/validation/`.

## GV3 — Toàn vẹn nhật ký (A2, A7, A8, P0, M)

- **Căn cứ:** ISO 15189:2022 8.4.3 (lưu giữ hồ sơ), quy tắc dự án "không xoá cứng điểm QC".
- **Phương án:**
  1. Bỏ `rotateAuditOverflow` tự xoá. Thay bằng cảnh báo cho admin khi bảng
     `activity` vượt ngưỡng (giữ `AUDIT_HARD_CAP` làm ngưỡng cảnh báo), trỏ tới
     "Lưu trữ nhật ký cũ" — đường này đã xuất CSV trước khi gỡ. Kiểm lại kích
     thước gói Firebase khi nhật ký lớn (ngưỡng 256 MB).
  2. `clientId` của máy trạm LAN thành `lan:<ip>`; ghi audit cho lần đăng nhập sai.
  3. Thêm "chế độ vận hành" (cờ trong `app_meta`, bật một chiều, cần xác thực lại
     mật khẩu): khi bật, ẩn và chặn "Xoá sạch dữ liệu test" ở main.
- **Tệp:** `ipc/shared.ts`, `ipc/desktop-operations.ts`, `ipc/auth-handlers.ts`,
  `lan/http-server.ts`, `ipc/backup-handlers.ts`, `SettingsPage.tsx`, `AuditPage.tsx`.
- **Test:** vượt ngưỡng không xoá dòng nào; `resetOperationalData` bị chặn khi đã bật chế độ vận hành.

## GV4 — Huỷ điểm của run bị loại và xem xét định kỳ (N4, ISO 7.3.7.2, P0, M–L)

- **Căn cứ:** ISO 15189:2022 7.3.7.2 (xử lý khi IQC không đạt và xem xét dữ liệu
  QC định kỳ), 7.5/8.4 (sửa hồ sơ phải có lý do và người có thẩm quyền).
- **Phương án:**
  1. Khi huỷ một điểm có kết luận `rej` hoặc thuộc run bị loại: bắt buộc lý do
     ≥ 10 ký tự với mọi loại huỷ (kể cả "nhập sai dữ liệu"); lưu bền sự kiện "run
     bị loại đã được huỷ/nhập lại" để không còn phụ thuộc hàng chờ NCE tính lại.
     Loại "nhập sai dữ liệu" vẫn không mở NCE (đúng thiết kế hiện tại).
  2. Thêm **biên bản xem xét dữ liệu QC theo tháng**: tổng hợp CV, dịch Mean, run
     bị loại, các lần huỷ điểm của run bị loại, NCE còn mở; người có `qc.config`
     ký xem xét.
  3. `lockPeriod` cảnh báo (hoặc chặn) khi kỳ còn NCE mở hay run bị loại chưa
     được xem xét.
- **Tệp:** `domain/entry-validation.ts`, `ipc/entry-handlers.ts`,
  `VoidPointModal.tsx`, `ipc/report-handlers.ts`, trang Báo cáo; migration cho
  bảng sự kiện và biên bản xem xét.
- **Test:** huỷ điểm của run bị loại thiếu lý do bị từ chối; sự kiện vẫn còn sau
  khi nhập lại; khoá kỳ cảnh báo khi còn mục chưa xem xét.

## GV5 — Phiên và quyền truy cập (A1, A3, A10, Q1, P0, M)

- **Phương án:**
  1. `LanSession` chỉ giữ `userId` và dấu vân tay `pass_hash`. Hàm
     `session(req)` của `lan/http-server.ts` (điểm vào duy nhất của mọi yêu cầu
     LAN) đọc lại người dùng mỗi lần: tài khoản không còn, đã khoá, hoặc mật khẩu
     đã đổi thì thu hồi phiên và trả 401; vai trò, quyền trang, capability lấy từ
     dòng mới đọc. Cách này phủ luôn trường hợp phục hồi backup.
  2. Thao tác đọc qua IPC/LAN phải gọi `ctx.actor()` (trừ `hasAnyUsers`,
     `getLoginBrand`); thêm cổng quyền theo trang ở main dựa trên `page-roles.ts`.
  3. Bản đóng gói: `Menu.setApplicationMenu(null)` (hoặc menu tối giản không có
     DevTools) và `devTools: false` khi `app.isPackaged`; bỏ nhận
     `QCLAB_DEV_SERVER_URL` khi đã đóng gói.
  4. Main chặn mọi thao tác trừ đổi mật khẩu khi `must_change_password = 1`.
  5. Client LAN (`renderer/lan/http-api.ts`): gặp 401 thì phát sự kiện hết phiên
     để app về màn đăng nhập; với thao tác đọc nhận `{ok:false}` thì ném lỗi.
     Dùng chung một `EventSource` cho mọi nơi nghe (Q2).
- **Test:** khoá tài khoản thì phiên LAN đang mở bị từ chối ngay ở yêu cầu kế
  tiếp; đọc khi chưa đăng nhập bị từ chối; test cho `createLanHttpApi`.

## GV6 — Đồng bộ Firebase an toàn (A4, A5, P0, M)

- **Phương án:**
  1. Gói đẩy lên không chứa token LIS và các khoá bí mật trong `app_meta`.
  2. Khi kéo về máy **đã có người dùng**: giữ nguyên bảng `users` cục bộ, chỉ
     thay dữ liệu vận hành. Máy mới cài (chưa có người dùng) vẫn nhận `users` để
     dựng lại hệ thống.
  3. Ký gói bằng HMAC với khoá của phòng xét nghiệm (nhập khi kết nối, lưu bằng
     `safeStorage`); gói sai chữ ký thì từ chối kéo về.
  4. Lưu `refreshToken` bằng `safeStorage` và đổi token qua
     `securetoken.googleapis.com` trước mỗi lần đẩy; lỗi 401 báo rõ "phiên đám
     mây hết hạn, cần kết nối lại".
- **Tệp:** `sync/firebase-payload.ts`, `ipc/firebase-handlers.ts`,
  `domain/firebase-client.ts`, `db/table-io.ts`.
- **Test:** gói không chứa token; kéo về không đổi `users` ở máy đã có tài khoản;
  gói sai chữ ký bị từ chối; token được làm mới.

## GV7 — Sửa nghiệp vụ EQA (N5, N6, P1, S–M)

- Danh sách "Cần chú ý" xét **mọi mẫu** của đợt mới nhất (hoặc mọi mẫu chưa xem xét).
- Tín hiệu 2/3 và 6 gom theo đợt; `enough` đếm số đợt; chuỗi sắp theo
  `report_date` và tách theo chương trình.
- Chốt mâu thuẫn N-15 (Bias có dấu) với SG21 (RMS) trước khi nối Bias EQA vào Sigma.

## GV8 — Sửa nghiệp vụ Westgard, lô, dải (P1, M)

- **N7:** `allowedRuleScopes('2of3-2s')` tính theo số mức của xét nghiệm.
- **N9:** chặn ngày tương lai; cảnh báo/chặn lô hết hạn; snapshot Mean/SD của
  điểm nhập lùi ngày lấy dải hiệu lực theo ngày từ `mean_sd_history_json`.
- **N10:** lập dải PXN loại run bị loại khỏi phép tính, vẫn đòi n ≥ 20 và ≥ 20 ngày.
- **N11:** Sigma chỉ cảnh báo khi đích đổi trong nhóm IQC, không đánh `unstable`.
- **N12:** chấp nhận lô mới cần thống kê cột song song tối thiểu (n, số ngày, run bị loại).
- **N13:** ngưỡng so sánh lô hoá chất lấy từ TEa của xét nghiệm, đánh giá theo từng mức nồng độ.
- **N14:** ngày hiệu lực của `applyLabRange` theo giờ địa phương.

## GV9 — Modal, focus, màu (U2–U6, P1, M)

- `useFocusTrap`: nếu `activeElement` đã nằm trong modal (React đã focus ô
  `autoFocus`) thì giữ nguyên; trả focus về nút đã mở modal khi đóng.
- Ngăn xếp lớp: chỉ lớp trên cùng xử lý Esc; hỏi xác nhận khi đóng form đã sửa.
- Vòng focus 2px, offset dương, tương phản ≥ 3:1 trên cả nền teal.
- Đưa màu Sigma về token, dùng một bảng màu cho trang, biểu đồ, Excel, PDF; chữ
  tối trên nền vàng/cam.
- Biểu đồ Levey-Jennings: điểm Loại bỏ khác hình dạng với Cảnh báo; nhiều mức
  phân biệt bằng hình dạng/nét.

## GV10 — Đóng gói, phát hành, phụ thuộc (Q3, A9, P1, M)

- Nâng Electron lên bản vá mới nhất của dòng đang dùng; `npm audit fix` cho
  vite/zod; xử lý `exceljs`; ghim phiên bản Node ở CI và `engines`.
- Electron fuses (tắt RunAsNode, NODE_OPTIONS; bật kiểm toàn vẹn asar); kiểm
  `senderFrame` ở IPC; cửa sổ in PDF tắt JavaScript.
- Ký số bộ cài (cần chứng chỉ code-signing — quyết định mua thuộc về bạn), sau đó
  mới bật cập nhật tự động.

## GV11 — Dọn dần (P2)

Bật `noUnusedLocals` và `no-floating-promises`; tách test kiểu script khi sửa
tệp đó; gom ngưỡng độ dài lý do về hằng số dùng chung; gỡ export chết; đồng bộ
component (thẻ số liệu, phân trang, header panel, `EmptyState`); gắn nhãn
`htmlFor`; thống nhất chữ tiếng Việt ("Xóa/Hủy", "kỳ/đợt"); xử lý bố cục cửa sổ
1024–1366px; bỏ khối `::-webkit-scrollbar*` chết; neo hash nhật ký ra ngoài CSDL (A6).

## Cần bạn xác nhận

1. **Firebase dùng để làm gì?** Kế hoạch GV6 giả định Firebase vừa là sao lưu
   đám mây vừa để dựng lại máy mới cùng phòng xét nghiệm. Nếu bạn dùng nó để
   nhiều máy cùng ghi song song thì cần thiết kế lại phần xung đột.
2. **Chứng chỉ ký số (GV10)** có chi phí hằng năm; cần bạn quyết có mua không.
