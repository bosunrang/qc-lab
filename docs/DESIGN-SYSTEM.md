# Hệ thiết kế QC Lab — Clinical Precision

Cập nhật 2026-09-25. Nguồn giá trị duy nhất là
`app/renderer/styles/tokens.css`; mọi quy tắc dưới đây được khoá bằng
`app/tests/design-system.test.mjs` (chạy qua `npm test`). Khi tài liệu và
tokens.css lệch nhau, tokens.css đúng — sửa tài liệu.

## Cấu trúc token

`tokens.css` có ba lớp, đọc từ trên xuống:

| Lớp | Nội dung | CSS trang được dùng? |
| --- | --- | --- |
| 1. Primitive | Dải màu (`--teal-500`, `--gray-200`, `--ink-*`, `--dark-*`), thang chữ, lưới khoảng cách, bo góc | Màu: **không**. Thang (`--text-*`, `--weight-*`, `--leading-*`, `--space-*`, `--radius-*`): có |
| 2. Vai trò | Bề mặt, viền, chữ, accent, trạng thái, sidebar, bóng đổ, focus | Có — đây là màu được dùng |
| 3. Component | Chiều cao control/hàng bảng, badge, modal, icon, z-index, chuyển động | Có |

Lớp 4 "bí danh tạm" (91 tên đồng nghĩa, 820 chỗ dùng) đã xoá ngày
2026-09-25. Không khai tên đồng nghĩa cho token đã có.

## Các thang

| Nhóm | Giá trị | Token |
| --- | --- | --- |
| Cỡ chữ | 11 / 12 / 13 / 14 / 16 / 20 / 24 / 30px | `--text-2xs` … `--text-2xl` |
| Độ đậm | 400 / 500 / 600 / 700 (chỉ 4 file font) | `--weight-normal/medium/semibold/bold` |
| Dãn dòng | 1 / 1.15 / 1.3 / 1.4 / 1.55 | `--leading-none/display/heading/snug/body` |
| Tiêu đề | trang 24, hero 24, panel 16, khối con 14, thẻ 13, overline 11 | `--title-page/hero/panel/sub/card/overline` |
| Khoảng cách | 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 32px | `--space-0-5` … `--space-8` |
| Bo góc | 8px mọi nơi; pill 999px | `--radius-sm/md/lg`, `--radius-full` |
| Chiều cao control | 28 / 32 / 36px | `--control-h-sm`, `--control-h-compact`, `--control-h` |
| Hàng bảng | 36 / 44 / 52px (hàng có ô nhập) | `--table-row-h-compact`, `--table-row-h`, `--table-row-h-input` |
| Header bảng | 30 / 40px | `--table-header-h-sm`, `--table-header-h` |
| Nhãn → ô nhập | 6px | `--field-label-gap` |
| Giữa các field | 16px, dọc lẫn ngang | `--field-gap` |
| Badge | cao tối thiểu 24px | `--badge-h` |
| Bộ đếm / số thứ tự bước | 20px / 28px | `--count-h`, `--step-number-size` |
| Modal | 440 / 600 / 800 / 1120px | `--modal-w-sm/md/lg/xl` |
| Icon SVG | 10 / 14 / 16 / 20 / 24px | `--icon-xs`, `--icon-sm`, `--icon`, `--icon-md`, `--icon-lg` |
| Chuyển động | 150ms (hover/focus), 200ms (mở/thu khối) | `--motion-fast`, `--motion` |
| Thứ tự lớp | 2 / 3 / 10 / 20 / 30 / 100 / 110 / 120 / 130 | `--z-sticky`, `--z-sticky-head`, `--z-float`, `--z-page-head`, `--z-sidebar`, `--z-modal`, `--z-dialog`, `--z-tooltip`, `--z-picker` |

Ghi chú:

- **Icon**: xs cho mũi tên cây trong ô 16px; sm cho nút vuông 32px trong
  hàng bảng; chuẩn 16 cho icon cạnh chữ, sidebar, ô ngày; md cạnh tiêu đề
  panel; lg cho icon minh hoạ lớn.
- **Chuyển động**: `prefers-reduced-motion` hạ cả hai bậc về 0 ngay trong
  tokens.css, không cần rule riêng ở trang.
- **Thứ tự lớp**: các cặp "phải đè" (ví dụ lịch chọn ngày nằm trên hộp thoại)
  ghi ngay cạnh token. `z-index:1` thô chỉ để nâng một phần tử trên anh em
  trong cùng khối.
- **Bóng đổ**: chỉ dùng `--shadow-*`; `box-shadow` thô chỉ được là `none`
  hoặc `inset` (vạch chỉ báo vẽ bằng bóng trong).

## Màu

- Neo nhận diện: teal thương hiệu `--teal-500` #0b7c83, mực chữ `--gray-900`
  #172b35, sidebar `--navy-950` #14242e, nền trang `--canvas` #f5f7f9.
- Chữ: `--text-primary`, `--text-secondary`, `--text-tertiary`,
  `--text-disabled`, cùng các vai trò hẹp `--text-strong`, `--text-accent`,
  `--text-placeholder`…
- Trạng thái: 5 họ `success / info / warning / danger / neutral`, mỗi họ đủ
  các vai trò `-text`, `-surface`, `-border`, `-accent`.
- Viền: `--surface-border` cho viền bề mặt, `--surface-divider` cho đường chia
  nội bộ.
- Mọi cặp chữ/nền đạt WCAG AA. CSS trang không viết hex, `rgb()`/`hsl()` hay
  `!important`.

## Component dùng chung

| Component | Cách dùng | Không được |
| --- | --- | --- |
| `EmptyState` (`components/EmptyState.tsx`) | Mọi thông báo trống, đang tải, lỗi tải của một khối. Một hình thức: `title` + nội dung + `action`; `size="page"` thay cả panel, `size="compact"` trong danh sách/bộ chọn | Tự dựng `.empty*`; đè viền/nền/chữ; thêm icon |
| `.hint-inline` | Chữ "Chưa có./Chưa ghi nhận." nằm giữa nội dung hồ sơ | Dùng cho cả khối trống |
| `Modal` | Chọn cỡ bằng `size="sm|md|lg|xl"` (mặc định md) | Truyền `width`/`style`; CSS trang đặt width cho modal |
| `.field` | Mọi cặp nhãn + ô nhập bọc trong `<div className="field">`. Nhãn cách ô `--field-label-gap`; khối cha tạo khoảng cách giữa các field bằng `gap:var(--field-gap)` | Nhãn tự thêm margin-top; rule trang chỉ để đặt `margin-top:0` cho nhãn |
| `.tag` + `ok|warn|rej|none` | Badge trạng thái | Tạo lớp `*-chip`, `*-pill`, `*-badge`; đổi kích thước/chữ/màu ở CSS trang |
| `.pill` | Nhãn thông tin trung tính | Như trên |
| `.count` | Bộ đếm trong tab/nút lọc; tab `.on` đổi sang nền teal | Đổi kích thước, chữ hay màu ở CSS trang |
| `.step-number` | Số thứ tự bước, tròn 28px | Đổi kích thước/chữ; chỉ được đổi màu nền theo khối chứa |
| `RowActionButton` | Nút sửa/xoá vuông trong hàng | Nút danger có chữ riêng cho cùng thao tác |
| Vòng focus | Một vòng `--focus-ring` cho cả app | Tạo viền focus thứ hai |

## Thêm một giá trị mới

1. Kiểm tra thang hiện có trước — đa số trường hợp là làm tròn về bậc gần nhất.
2. Nếu thật sự thiếu, thêm token ở đúng lớp trong `tokens.css`, kèm chú thích
   nói **nó dùng để làm gì** và vì sao thang cũ không đủ. Màu mới thêm vào
   lớp 1 rồi đặt tên vai trò ở lớp 2; không viết hex tại trang.
3. Nếu là thang có test khoá hình dạng (z-index, icon, control…), cập nhật
   danh sách trong test cùng lúc.
4. Chạy `npm test`, `npm run typecheck`, `npm run build`,
   `npm run app:css-parity`.

## Test khoá từng quy tắc

Tất cả nằm trong `app/tests/design-system.test.mjs`:

| Quy tắc | Test |
| --- | --- |
| Neo màu, 4 bậc mỗi họ | bảng màu Clinical Precision giữ đúng các neo nhận diện |
| Viền bề mặt / đường chia | viền bề mặt mảnh được tách khỏi đường chia và trạng thái active |
| Thang chữ, độ đậm, dãn dòng, khoảng cách, bo góc | thang chữ, độ đậm, dãn dòng, khoảng cách, bo góc đúng hình dạng |
| Tiêu đề, header bảng | tiêu đề và header bảng đi theo thang, không tự đặt cỡ |
| Control 28/32/36 | mật độ control dùng token component, không viết lại số chuẩn tại trang |
| Mọi `var()` có định nghĩa (CSS và TSX) | mọi var() trong CSS đều có định nghĩa và không tham chiếu vòng |
| WCAG AA | mọi cặp màu chữ/nền đạt WCAG AA |
| Chỉ 4 độ đậm | chỉ dùng độ đậm có file font thật |
| Không dùng màu primitive | CSS trang không được đụng thẳng vào lớp primitive |
| Lưới khoảng cách | mọi padding/margin/gap đều nằm trên thang khoảng cách |
| Một vòng focus | chỉ có một vòng focus dùng chung; focus chuột và bàn phím không tạo hai viền accent |
| Không hex/rgb/!important/cỡ chữ thô | CSS trang không còn giá trị thô nào |
| EmptyState | thông báo trống chỉ dựng qua EmptyState, CSS trang không đè viền/nền |
| Chiều cao control, hàng bảng | chiều cao control và hàng bảng nằm trên thang, không tự đặt số |
| Nhãn → ô nhập | nhãn → ô nhập: một khoảng cách, một nguồn, trong khối .field |
| Nhãn không có margin-top thừa | nhãn đứng trên control dùng thang form chung |
| Comment không nuốt rule | không comment nào nuốt mất rule CSS |
| Giữa các field | khoảng cách giữa các field: một token, do khối cha tạo |
| Badge | badge: hai kiểu .tag/.pill, một chiều cao, trang không đổi hình dạng |
| Modal | modal: bốn cỡ qua prop size, trang không tự đặt độ rộng |
| Thứ tự lớp | z-index: thang theo vai trò, không số thô |
| Cỡ icon | cỡ icon: năm bậc theo khung chứa, không số thô |
| Bóng đổ, chuyển động | bóng đổ và chuyển động chỉ dùng token |
| Bộ đếm, số thứ tự bước | bộ đếm và số thứ tự bước: hai kiểu dùng chung, một kích thước |
| Không bí danh | không còn lớp bí danh: tên đồng nghĩa cũ không được định nghĩa lại |

Các test còn lại trong tệp khoá quyết định giao diện riêng của từng trang
(Sigma, Nhập QC, Westgard…), ghi lý do ngay trong thông báo lỗi.
