# Hệ thiết kế QC Lab — Clinical Precision

Cập nhật thang chữ 2026-11-24. Nguồn giá trị duy nhất là
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
| Cỡ chữ | chữ phụ 13, bảng/nhãn/bộ lọc 13.5, nội dung/control 14, tiêu đề 16 / 20 / 24, KPI 30px | `--text-xs/sm/base/md/lg/xl/2xl`; tên `--text-2xs` cũ trỏ về chữ phụ 13px |
| Độ đậm | 400 / 500 / 600 / 700 (chỉ 4 file font) | `--weight-normal/medium/semibold/bold` |
| Dãn dòng | 1 / 1.15 / 1.3 / 1.4 / 1.55 | `--leading-none/display/heading/snug/body` |
| Tiêu đề | trang 24, hero 24, panel 16, khối con 14, thẻ 13.5, overline 13 | `--title-page/hero/panel/sub/card/overline` |
| Thanh điều hướng | mục 14 px, nhãn nhóm 11 px, icon 16 × 16 px | `--text-base`, `--sidebar-group-font-size`, `--icon` |
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
  panel; lg cho icon minh hoạ lớn. Mọi mục trên sidebar dùng `--icon` ở cả
  chế độ mở rộng và thu gọn. Mục đang mở dùng `--sidebar-active-accent`.
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
- Viền mặc định của ô biểu mẫu và ô nhập trong bảng dùng
  `--control-border`, cùng màu `--surface-border` của khung Hướng dẫn nhanh
  luật Westgard. Đường chia nội bộ dùng `--surface-divider`.
- Khi bấm vào ô, viền lấy nét dùng teal `--focus-ring`. Khi dùng bàn phím,
  vòng lấy nét dùng cùng màu. Ô có lỗi dùng `--danger-accent`. Các dấu hiệu
  lấy nét và báo lỗi đạt tối thiểu **3:1** trên nền liền kề.
- Chữ thông thường, kể cả chữ mô tả và chữ gợi ý, đạt tối thiểu **4,5:1**
  trên nền đang hiển thị. Dùng `--text-tertiary` cho mô tả và
  `--text-placeholder` cho chữ gợi ý. Nhãn và thông tin phụ trên thẻ Sigma
  dùng màu `--on-accent` ở độ đục đầy đủ.
- Điểm cảnh báo Levey–Jennings và chú giải dùng cùng màu
  `--warning-accent`. Điểm đạt tối thiểu **3:1** trên các dải nền và có
  hình tam giác để nhận biết trạng thái. Chữ thông báo trong biểu đồ dùng
  màu tương đương `--text-tertiary`.
- CSS trang không viết hex, `rgb()`/`hsl()` hay `!important`. Ngưỡng
  tương phản theo [WCAG 2.2 về chữ](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
  và [tín hiệu phi văn bản](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## Component dùng chung

| Component | Cách dùng | Không được |
| --- | --- | --- |
| `EmptyState` (`components/EmptyState.tsx`) | Mọi thông báo trống, đang tải, lỗi tải của một khối. Một hình thức: `title` + nội dung + `action`; `size="page"` thay cả panel, `size="compact"` trong danh sách/bộ chọn | Tự dựng `.empty*`; đè viền/nền/chữ; thêm icon |
| `.hint-inline` | Chữ "Chưa có./Chưa ghi nhận." nằm giữa nội dung hồ sơ | Dùng cho cả khối trống |
| `Modal` | Chọn cỡ bằng `size="sm|md|lg|xl"` (mặc định md) | Truyền `width`/`style`; CSS trang đặt width cho modal |
| `.field` | Mọi cặp nhãn + ô nhập bọc trong `<div className="field">`. Nhãn cách ô `--field-label-gap`; khối cha tạo khoảng cách giữa các field bằng `gap:var(--field-gap)` | Nhãn tự thêm margin-top; rule trang chỉ để đặt `margin-top:0` cho nhãn |
| Ô tìm kiếm | Dùng `type="search"` hoặc lớp `.search-input` cho ô lọc kiểu text. Cách trình bày chung đặt kính lúp 16 px bên trái, kể cả trong `SearchSelect` | Tự thêm icon hoặc dùng hai nút xóa trong cùng ô |
| `.tag` + `ok|warn|rej|none` | Badge trạng thái | Tạo lớp `*-chip`, `*-pill`, `*-badge`; đổi kích thước/chữ/màu ở CSS trang |
| `.pill` | Nhãn thông tin trung tính | Như trên |
| `.count` | Bộ đếm trong tab/nút lọc; tab `.on` đổi sang nền teal | Đổi kích thước, chữ hay màu ở CSS trang |
| `.step-number` | Số thứ tự bước, tròn 28px | Đổi kích thước/chữ; chỉ được đổi màu nền theo khối chứa |
| `RowActionButton` | Nút sửa/xoá vuông trong hàng | Nút danger có chữ riêng cho cùng thao tác |
| Vòng focus | Một vòng `--focus-ring` cho cả app | Tạo viền focus thứ hai |

### Lề trang và khoảng cách giữa các khung

Tiêu đề và nội dung cùng dùng `--page-gutter` cho lề trái và phải.
Lề là **24 px** trên desktop và thu dần tới **20 px** ở cửa sổ hẹp.

Các khung nội dung cùng cấp xếp dọc trên trang cách nhau **16 px** theo
`--panel-stack-gap`. Luồng thông thường dùng lề dưới mặc định của `.panel`.
Với lưới hoặc flex xếp dọc, khối cha có thể dùng token đó cho khoảng cách
giữa các hàng và đặt lề dưới của khung con về 0 để tránh cộng dồn.

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
| Chữ gợi ý và nhãn Sigma | chữ gợi ý và nhãn Sigma giữ màu đủ đậm khi hiển thị |
| Chỉ 4 độ đậm | chỉ dùng độ đậm có file font thật |
| Không dùng màu primitive | CSS trang không được đụng thẳng vào lớp primitive |
| Lưới khoảng cách | mọi padding/margin/gap đều nằm trên thang khoảng cách |
| Khung xếp dọc cách nhau 16 px | các khung xếp dọc dùng khoảng cách 16 px |
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
Các tab Tổng quan, Lịch, Báo cáo và Khắc phục của Ngoại kiểm dùng cùng
quy tắc giao diện. Kiểm thử thang chữ trên Electron cũng mở từng tab này
ở các độ rộng cửa sổ dùng chung của ứng dụng.
