# Hệ thiết kế QC Lab v2 — Clinical Precision

Nguồn duy nhất: `app-v2/renderer/styles/tokens.css`.
Gate: `app-v2/tests/design-system.test.mjs`.

## Vì sao dựng lại (chốt 2026-09-19)

Trước ngày này, hệ giao diện app-v2 là bản sao token của app cũ. Rà soát đo được:

| Trục | Trước | Vấn đề |
|---|---|---|
| Cỡ chữ | 13 bậc, có 10.5 / 13.5 / 14.5px | 4 bậc nằm trong dải 1,5px — mắt không phân biệt được |
| Độ đậm | 12 giá trị (400…900) | chỉ có 5 file font; 65 khai báo bị trình duyệt làm tròn về face khác |
| Khoảng cách | 28 giá trị, gồm 1/3/5/7/9/11/13/15/17px | không còn là một thang |
| Bo góc | 3/6/7/8/9/10/12/13/16/50%/99/999px | 12 giá trị cho 4 vai trò |
| Dải xám | 8 bậc, trống hẳn khoảng giữa (300→600 cách 46 điểm sáng) | **nguyên nhân gốc của 107 mã hex tự do**: cần màu ở khoảng giữa thì không có token nào để lấy |
| Chữ phụ | 4.31:1 | trượt WCAG AA |
| Chiều cao control | input 36px, nút 37px | lệch 1px giữa hai thứ đứng cạnh nhau |

Quyết định của người dùng: **dừng kế hoạch sửa giao diện cũ và xây một giao
diện mới cho QC Lab**. Hệ mới giữ Manrope, giữ luồng nghiệp vụ và mật độ dữ
liệu phù hợp phòng xét nghiệm; bố cục, bề mặt và nhịp component được phép đổi
để đạt cảm giác chuyên nghiệp. Chưa làm dark mode nhưng token được đặt theo
vai trò để sau này thêm được.

App cũ (`assets/`) từ đây **không còn là tham chiếu giao diện** dưới bất kỳ
hình thức nào. Nó vẫn là bản đối chiếu NGHIỆP VỤ (xem CLAUDE.md).

## Bốn lớp của `tokens.css`

1. **Primitive** — dải màu, thang chữ, lưới khoảng cách, bo góc.
   CSS trang **không được** dùng lớp này (gate chặn).
2. **Vai trò** — `surface-*`, `border-*`, `text-*`, `accent-*`, trạng thái,
   sidebar, focus. Mỗi token nói *nó dùng để làm gì*. Đây là thứ CSS trang dùng.
3. **Component** — kích thước dùng chung của control/panel/bảng/modal.
4. **Bí danh tạm** — 146 tên token cũ trỏ sang Lớp 2, để chuyển 14 file CSS
   theo từng đợt thay vì một lần. **Đích đến là xoá sạch lớp này.**
   Không thêm tên mới vào đó.

Màu pha (`rgb`/`rgba`/`hsl`), bóng đổ và nền trong suốt cũng là giá trị thô:
chúng chỉ được khai báo ở `tokens.css`, không được tự pha ở stylesheet trang.
`!important` bị cấm hoàn toàn; sửa selector hoặc thứ tự cascade thay vì tăng
độ ưu tiên.

## Màu

Clinical Precision dùng một bảng màu độc lập, chốt ngày 2026-09-19:

- **clinical navy** `#172b35` cho mực chính và sidebar — đủ sâu nhưng không
  đen gắt;
- **mineral teal** `#0b7c83` cho hành động chính, mục đang chọn và trạng thái
  Đạt — sạch hơn teal xám cũ;
- **cool neutral** từ `#fbfcfd` tới `#536a76` cho nền, viền và chữ phụ — giữ
  giao diện sáng mà vẫn đủ tương phản;
- xanh lam/amber/đỏ chỉ dùng cho thông tin/cảnh báo/nguy hiểm, không dùng để
  trang trí.

Màu được phân phối theo vai trò, không theo trang: nền trang `#f3f6f8`, panel
trắng, header bảng `#edf2f4`, viền `#dce5e9`. Teal đậm chỉ xuất hiện ở nút
chính, focus, selection và trạng thái; các vùng nội dung lớn không tô teal.

Điều hướng đang chọn trên sidebar dùng nền teal pha navy `#203b43`, chuyển
nhẹ dần sang trong suốt và thanh trái 2px. Không dùng mảng navy đặc hoặc thanh
3px vì làm mục active trông dày hơn các mục còn lại.

Gate chốt 11 neo nhận diện và cấm CSS trang dùng thẳng primitive. Thay đổi một
neo là quyết định cấp hệ thống, không phải chỉnh riêng một màn hình.

### Trạng thái dùng 5 họ, cùng một khuôn

`--{success|info|warning|danger|neutral}-{text|surface|border|accent}`.

Dải nhấn trái của alert/thẻ trạng thái dùng **3px**; màu lấy từ token
`--{state}-accent`. Đây là dấu ngữ nghĩa, không phải viền bao quanh control.

**"Đạt" dùng chính họ teal thương hiệu.** Có lúc tôi đổi nó sang xanh lá theo
lập luận "nhãn trạng thái không nên trùng màu nút hành động"; người dùng không
chọn hướng đó và nó đã trả về teal. Đây là quyết định sản phẩm — đừng mở lại.

Hệ quả: `--success-*` và `--accent-*` gần như trùng nhau. Vì vậy **đừng mượn**
`--success-*` để lấy "sắc teal nhạt" cho thứ không phải trạng thái — dùng
`--accent-*`. Đã có 2 chỗ mượn sai như thế (`.row-action:hover`, nút "Lấy CV"),
và chính chúng là nơi hỏng khi success đổi màu.

### Biểu đồ

Levey-Jennings, CUSUM, Sigma, So sánh hoá chất và bản in giữ bảng màu nghiệp
vụ riêng. Không ép màu đường biểu đồ vào palette giao diện vì ý nghĩa thống kê
quan trọng hơn nhận diện thương hiệu.

### Tương phản

Toàn bộ cặp chữ/nền, chữ trạng thái, nút chính, viền control và vòng focus đã
đạt ngưỡng WCAG mà gate yêu cầu. Bảng màu mới không còn danh sách ngoại lệ;
thêm bất kỳ cặp trượt nào sẽ làm `design-system.test.mjs` thất bại.

## Chữ

8 bậc, **toàn số nguyên**, gốc 14px cho app dữ liệu dày:

| Token | px | Dùng cho |
|---|---|---|
| `--text-2xs` | 11 | overline, mã, badge rất nhỏ |
| `--text-xs` | 12 | caption, nhãn form, header cột bảng |
| `--text-sm` | 13 | chữ phụ, thân bảng |
| `--text-base` | 14 | thân chữ, control, nút |
| `--text-md` | 16 | tiêu đề panel |
| `--text-lg` | 20 | tiêu đề modal |
| `--text-xl` | 24 | tiêu đề trang |

Nhãn đứng trên một control luôn dùng `--text-xs` (12px), `--weight-semibold`
và `--text-secondary`. Các tên nhóm chọn nhiều mục, tiêu đề thẻ hoặc nhãn
checkbox không phải nhãn control và có thể theo vai trò riêng.
| `--text-2xl` | 30 | số KPI |

### Thang tiêu đề — mỗi cấp cấu trúc một cỡ

Trước khi chuẩn hoá, cùng một cấp lại ra ba cỡ tuỳ trang: header khối con
trong panel là 16px ở Sigma và So sánh hoá chất, 14px ở Nhập QC và Cấu hình
chung, 13px ở Cài đặt. Tiêu đề hộp thoại thì 20 / 16 / 16.

| Vai trò | Cỡ | Đậm | Dùng cho |
|---|---|---|---|
| `--title-page` | 24 | 700 | tên trang (`.head h1`) |
| `--title-hero` | 24 | 700 | khối hero Tổng quan — cùng cỡ tên trang nhưng khác vai trò, giữ có chủ đích |
| `--title-panel` | 16 | 600 | header panel, modal, hộp thoại |
| `--title-sub` | 14 | 600 | header khối con trong panel |
| `--title-card` | 13 | 600 | header thẻ nhỏ, nhóm trường |
| `--title-overline` | 11 | 600 | nhãn nhóm, chữ hoa, giãn .06em |

### Header bảng — hai tầng

| | cỡ | đậm | giãn chữ | cao | dùng cho |
|---|---|---|---|---|---|
| bảng lớn | 13 | 600 | .02em | 40 | phiếu QC, danh mục, nhật ký NCE, danh sách Tổng quan, lịch sử Mean/SD, ma trận Mean/SD |
| bảng nhỏ | 11 | 600 | .04em | 30 | 4 bảng Sigma, hướng dẫn luật Westgard, cặp mẫu So sánh hoá chất, bảng mục tiêu trong modal chuyển lô |

Lý do tách: header bảng lớn 13px/600 cần dễ quét như dữ liệu trong bảng; header
bảng nhỏ 11px/600 nằm ngay dưới header panel 16px đậm thì phải nhỏ và thưa chữ
hơn để lùi về đúng vai trò "nhãn cột", thay vì thành một tiêu đề nữa.

### Không còn tên cỡ chữ song song

CSS trang từng gọi cùng một cỡ bằng nhiều tên: 13px là `--type-meta` (57 lần)
**và** `--type-body-sm` (56 lần); 14px là `--type-body` **và** `--type-subhead`;
16px là `--section-head-size` **và** `--type-heading-sm`; 24px là
`--type-page-title` **và** `--type-heading-lg`. Đọc một rule không biết nó
đang ở cấp nào.

264 chỗ đã đổi về thang; 15 alias bị xoá. Gate chốt danh sách **đóng** những
token được phép đứng sau `font-size:` — thêm tên mới là fail.

**Độ đậm chỉ 4 nấc: 400 / 500 / 600 / 700.** Đây không phải sở thích:
`tokens.css` chỉ nạp bốn weight Manrope này; mọi con số khác bị trình duyệt
làm tròn về face gần nhất — `750` không cho ra nét nào tên là 750. 800 đã bị
loại khỏi giao diện: đó là nét *display*, không phải nét chữ UI, và là thứ
khiến bản trước trông nặng hơn phần mềm cùng loại.

Dãn dòng 5 bậc theo vai trò: `none 1` / `display 1.15` / `heading 1.3` /
`snug 1.4` / `body 1.55`.

## Khoảng cách

Lưới **4px**, cộng nửa bậc 2/6/10/14 cho mật độ dày (đều nằm trong thang
Tailwind). Mọi giá trị lẻ bị loại.

```
--space-0 0   --space-0-5 2   --space-1 4    --space-1-5 6   --space-2 8
--space-2-5 10  --space-3 12  --space-3-5 14  --space-4 16
--space-5 20  --space-6 24    --space-8 32
```

## Bo góc

Mọi thành phần có góc bo dùng `8px` (`--radius-xs`, `--radius-sm`,
`--radius-md`, `--radius-lg`). `--radius-full` chỉ dành cho pill và hình tròn;
đây là hình dạng riêng, không phải một bậc bo góc giao diện.

## Component

Control chuẩn dùng `--control-h: 40px` cho input, select **và** nút. Bốn mật
độ ngoại lệ cũng là token component, không viết số tại trang: `--control-h-row`
30px (hành động hàng), `--control-h-compact` 32px (toolbar) và
`--control-h-table` 34px (ô bảng). Form dùng chung chuẩn `--control-h: 40px`.
`--control-h-sm: 28px` chỉ dành cho nút cực gọn trong hàng bảng. Trước đây nút
cao 37px còn input 36px.

Panel: `--panel-padding 20`, `--panel-content-gap 16` (header → nội dung đầu
tiên), `--panel-header-h 48`, bo 8px và `--panel-shadow` rất nhẹ. Header panel
dùng nền cool-neutral `#f5f8fa`; độ sâu đến từ nền dịu, viền mảnh + bóng khuếch
tán, không còn các dải xám phủ kín từng khu vực.

Mọi bề mặt có ranh giới (panel, card, modal, bảng, vùng chọn) dùng
`1px solid var(--surface-border)`; đây là viền xám xanh đủ rõ nhưng vẫn mảnh.
Đường chia hàng/cột bên trong dùng `--surface-divider` nhẹ hơn. Teal chỉ dùng
cho trạng thái đang chọn, hoạt động hoặc cần chú ý — không dùng làm viền mặc
định cho toàn bộ giao diện.

Bảng có **hai** tầng mật độ, không hơn:

| | padding ô | dùng cho |
|---|---|---|
| mặc định | `--table-cell-py 10` × `--table-cell-px 12` | bảng danh sách, nhật ký |
| gọn | `--table-cell-py-compact 6` × `--table-cell-px-compact 8` | bảng nhập liệu dày (Sigma) |

Một chiều cao header duy nhất `--table-header-h 40`, hàng danh sách
`--table-row-h 44`. Header 13px/600 + giãn chữ .02em; thân 13px; dãn dòng
`--leading-snug` cho cả bảng.

Bảng, panel và modal cùng dùng bo 8px. Sự phân cấp đến từ khoảng cách, viền
và bóng mảnh, không đến từ nhiều mức bo góc.

Focus: **một** vòng focus cho cả app, khai đúng một lần trong `app.css`:

```css
:focus-visible{outline:var(--focus-ring-width) solid var(--focus-ring);
               outline-offset:var(--focus-ring-offset);}
```

`--focus-ring-offset: -2px` bằng đúng độ dày vòng, nên viền teal nằm đè lên
đường viền control thay vì bao thêm một lớp bên ngoài. Control không đổi kích
thước và không còn cảm giác hai viền. Nơi nào cần khác thì **chỉ được đổi
`outline-offset`** (hàng bảng, ô trong lưới). Cấm tắt outline, cấm tự vẽ vòng
bằng `box-shadow`, cấm tự đặt màu/độ dày. Ngoại lệ duy nhất được ghi trong
gate: ô nhập bên trong `.datebox` không vẽ vòng vì chính khung `.datebox` nhận
vòng, nếu không sẽ có hai vòng lồng nhau.

## Biểu đồ và bản in — nằm NGOÀI hệ thống này, có chủ đích

Biểu đồ (Levey-Jennings, CUSUM, Sigma, So sánh hoá chất) và HTML in giữ bảng
màu riêng của chúng, viết thẳng mã hex trong `.tsx`. Đây không phải nợ kỹ
thuật bị bỏ sót.

Lý do: canvas không đọc được biến CSS, và cửa sổ in là tài liệu độc lập không
nạp `tokens.css`. Một đợt đã thử bắc cầu (`chart-theme.ts` + token `--chart-*`,
đọc token qua `getComputedStyle`) — việc đó **đổi màu biểu đồ**, và người dùng
bác bỏ (18/09). Toàn bộ 7 file đã revert về nguyên trạng.

Nếu sau này muốn làm lại, hai điều phải biết trước:

- Biểu đồ Sigma và biểu đồ QC dùng **giá trị khác nhau** cho cùng vai trò
  (lưới, nhãn trục, dải nền). Gom chúng về một token là đổi màu, không phải
  dọn dẹp.
- Bất kỳ lớp cầu nối nào đọc token rồi nhớ lại kết quả đều phải gọi **lúc vẽ**,
  không phải lúc nạp module: nạp module chạy trước khi stylesheet áp vào, nhớ
  trúng bảng rỗng thì mọi biểu đồ đen thui mà không lỗi nào báo.

## Gate — không còn ratchet nào

Bước B đã dọn hết, nên mọi luật đều **cứng**: sai là fail, không có baseline
để nới.

| Luật | Trước (18/09) | Nay |
|---|---|---|
| màu hex trong CSS trang | 141 | 0 |
| màu hàm trong CSS trang | chưa đo | 0 |
| `!important` trong CSS trang | chưa đo | 0 |
| khoảng cách lệch thang | 193 | 0 |
| dãn dòng ngoài 5 bậc | 83 (17 giá trị) | 0 |
| bo góc ngoài bậc 8px hoặc pill | 27 (10 giá trị) | 0 |
| cỡ chữ viết thẳng | 6 | 0 |
| độ đậm không có file font | 65 | 0 |
| cách thể hiện vòng focus | 6 | 1 |
| mật độ bảng | 5 | 2 |
| cặp màu trượt WCAG AA | 9 | 0 |

Gate còn kiểm những thứ không đếm được bằng số: dải màu phải đơn điệu, mọi
`var()` phải có định nghĩa và không tham chiếu vòng, CSS trang không được đụng
lớp primitive, `PRINT_PALETTE` phải khớp token.

Mỗi luật đều đã được **kiểm chứng là bắt được thật** bằng cách cắm lỗi vào rồi
gỡ ra — không luật nào chỉ xanh vì không tìm thấy gì.
