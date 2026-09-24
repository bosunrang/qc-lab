# Kế hoạch hoàn thiện quy tắc giao diện

Lập ngày 2026-09-24. Tài liệu này ghi các phần quy tắc giao diện còn thiếu
để làm tiếp. Mỗi mục làm theo cùng một cách đã áp dụng:

1. Kiểm kê giá trị đang dùng (script đọc CSS/TSX, không đoán).
2. Chốt thang hoặc component, ghi lý do trong `tokens.css` hoặc component.
3. Chuyển toàn bộ chỗ dùng về thang/component đó.
4. Thêm test trong `app/tests/design-system.test.mjs` chặn tái phạm; thử gắn
   lại một giá trị sai để chắc test bắt được.
5. Chạy `npm test`, `npm run typecheck`, `npm run build`,
   `npm run app:css-parity`.

Người dùng tự kiểm tra giao diện; không dùng bản xem trước trong trình duyệt
để xác minh thay đổi UI.

## Đã có quy tắc (khoá bằng test)

| Nhóm | Quy tắc |
| --- | --- |
| Màu | Bảng Clinical Precision, không mã màu ở CSS trang, tương phản WCAG AA |
| Chữ | 8 cỡ chữ, 4 độ đậm, 5 dãn dòng, thang tiêu đề 6 cấp, nhãn form 13px |
| Khoảng cách | Lưới 4px; nhãn → ô 6px (`--field-label-gap`); giữa các field 16px (`--field-gap`) |
| Chiều cao | Control 28/32/36px; hàng bảng 36/44/52px; header bảng 30/40px; badge 24px |
| Linh kiện | `EmptyState`; badge `.tag`/`.pill`; `Modal` 4 cỡ sm/md/lg/xl; một vòng focus |
| Cấu trúc | Mọi cặp nhãn + ô trong `.field`; không comment nào được nuốt rule CSS |

## Còn lại, theo thứ tự đề xuất

### 1. Thứ tự lớp (z-index)

- Hiện trạng: 17 giá trị khác nhau — 1×6, 2×4, 3×3, 4, 5, 8, 12×2, 20×3, 21,
  24, 40, 41, 90, 900, 1100, 1200, 1400.
- Đề xuất: một thang token theo vai trò, ví dụ
  `--z-raised` (nội dung nổi trong bảng/cột dính), `--z-sticky` (header trang,
  thead dính), `--z-dropdown` (menu, lịch chọn ngày), `--z-modal`,
  `--z-dialog` (hộp xác nhận trên modal), `--z-toast`.
- Việc cần làm trước: đọc từng chỗ để biết lớp nào phải đè lớp nào (ví dụ
  DatePicker mở trong modal phải nằm trên modal). Liệt kê cặp "phải đè" rồi
  mới đặt số.
- Test: `z-index` ở CSS trang chỉ được là `var(--z-*)`, `0`, `1`, `auto`
  (1 dùng cho xếp chồng cục bộ trong cùng một khối).

### 2. Cỡ icon

- Hiện trạng: icon SVG 10/14/15/16/17/23/27px (16px×5, 14×2, 15×2, còn lại
  mỗi cỡ 1 chỗ), cộng vài icon đặt bằng `var(--text-md)`.
- Đề xuất: 3 cỡ `--icon-sm` 14px (trong nút gọn, badge), `--icon` 16px (nút,
  menu), `--icon-lg` 24px (minh hoạ trạng thái trống, hộp thoại).
- Lưu ý: icon trong sidebar 17px và icon minh hoạ Sigma 27px cần xem lại
  bằng mắt khi đổi.
- Test: `width/height` của `svg` ở CSS trang dùng `var(--icon*)`.

### 3. Bóng đổ và chuyển động

- Bóng đổ: đã có token (`--shadow-panel`, `--shadow-floating`,
  `--shadow-dialog`, `--surface-shadow`…) nhưng còn 16 chỗ viết tay (sidebar,
  logo, header trang, nút thu gọn…). Chuyển về token hoặc thêm token còn
  thiếu; test cấm `box-shadow` thô ở CSS trang (trừ `none` và `inset` vẽ thanh
  chỉ báo).
- Chuyển động: 20 chỗ, 6 thời lượng .12/.14/.15/.16/.18/.2s. Đề xuất 2 token
  `--motion-fast` 120ms (hover, focus) và `--motion` 200ms (mở/thu panel,
  sidebar); giữ `prefers-reduced-motion`. Test cấm thời lượng thô.

### 4. Bộ đếm trong tab và số thứ tự bước

- Chưa thuộc quy tắc badge vì không phải trạng thái:
  - Bộ đếm trong tab: `.dash-test-filterbar button b`, `.config-shell-tabs button>small`.
  - Số thứ tự bước: `.action-guide-number`, `.action-form-step-ident>span`,
    `.sg-chart-empty-steps span`.
- Đề xuất: một kiểu `.count` cho bộ đếm, một kiểu `.step-number` cho số thứ
  tự; mỗi kiểu một kích thước cố định.

### 5. Thông báo ngắn và placeholder biểu đồ

- 17 chỗ dùng `.empty-state` làm dòng chữ gợi ý ngắn ("Chưa có.", "Đang
  tải…", "Chọn 1 xét nghiệm…"). Quyết định: giữ làm "dòng gợi ý" riêng (đổi tên
  cho khỏi nhầm với `EmptyState`, ví dụ `.hint-inline`) hoặc chuyển các dòng
  đứng một mình trong panel sang `<EmptyState size="compact">`.
- Placeholder biểu đồ Sigma (`.sg-chart-empty*`) và So sánh hoá chất
  (`.rc-empty-panel-state`) có thiết kế riêng (icon, bước hướng dẫn) — xem
  có nên thành một biến thể của `EmptyState` không.

### 6. Dọn nợ cũ

- Lớp 4 "bí danh tạm" trong `tokens.css` còn khoảng 91 tên; riêng 13 tên
  chính (`--panel`, `--muted`, `--ink`, `--teal`, `--line`…) còn 320 chỗ dùng.
  Chuyển sang token vai trò (lớp 2) theo từng tệp, xoá bí danh khi hết chỗ
  dùng; thêm test ratchet chỉ cho giảm.
- Bỏ các `margin-top:0` thừa trên nhãn ở CSS trang (nhãn trong `.field` đã
  không còn margin-top từ quy tắc chung).
- Viết `docs/DESIGN-SYSTEM.md` — `tokens.css` và test đều trỏ tới tệp này
  nhưng nó chưa tồn tại. Viết SAU khi các mục trên chốt, gồm: các thang, các
  component (`EmptyState`, `Modal`, `.field`, `.tag`/`.pill`), cách thêm một
  giá trị mới, và danh sách test khoá từng quy tắc.

## Việc ngoài giao diện đang chờ

- `main` đi trước `origin/main` 4 commit, nhánh `refactor/ui-field-badge-modal`
  thêm 1 commit và tệp này — chưa push, chưa merge.
- Nhánh đã merge có thể xoá: `fix/lan-login-security`,
  `refactor/ui-empty-state-heights`.
- LAN vẫn chạy HTTP thường: cần quyết định có dùng HTTPS (chứng chỉ tự ký
  hoặc CA nội bộ) hay không.
- Một số câu thông báo trong test cũ còn viết không dấu (ví dụ
  `auth-handlers.test.mjs`); có thể thêm dấu nếu muốn.
