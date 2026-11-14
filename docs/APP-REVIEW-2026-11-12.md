# Rà soát mã nguồn và CSS — 12/11/2026

## Phạm vi và phương pháp

- Quét tĩnh 330 tệp TypeScript/TSX của main, renderer, hợp đồng dùng chung và
  công cụ cấp key; phân tích cú pháp 17 stylesheet, gồm bản in độc lập.
- Đối chiếu tài liệu APP-PLAN, quy ước IPC, đường nạp dữ liệu, các bộ chọn,
  mô hình Tổng quan, nhật ký/sao lưu và những phần giao diện vừa chỉnh.
- Tìm hàm chép nguyên nội dung theo token (ngưỡng 50 token), selector CSS
  lặp trong cùng ngữ cảnh, thuộc tính trùng trong cùng rule, token không có
  khai báo và class không có CSS. Đọc lại các kết quả nghi vấn trước khi sửa;
  class sinh động và class định danh DOM không bị coi là rác chỉ vì quét
  chuỗi tĩnh không tìm thấy tên đầy đủ.
- Chạy hồi quy, kiểm kiểu, lint, CSS parity, dựng ứng dụng, thẩm định số học
  và kiểm thử Electron. Dữ liệu thử dùng CSDL tạm, không sửa CSDL người dùng.

## Lỗi hành vi đã khắc phục

| Mục | Tình huống và ảnh hưởng | Khắc phục |
| --- | --- | --- |
| A01 | Tổng quan chọn điểm “Gần nhất” bằng thứ tự chữ: cùng ngày, lần 2 có thể đứng sau lần 10 | Dùng bộ so sánh ngày và mã lần chạy tự nhiên dùng chung; kiểm cả mã số và mã có tiền tố ngày |
| A02 | Mean trống nhưng SD hợp lệ bị `Number(null)` đổi thành 0, khiến Tổng quan coi là đủ dải | Kiểm tra có Mean/SD trước khi kiểm tính hữu hạn; Mean bằng 0 thực vẫn hợp lệ |
| A03 | Hai lượt tải Tổng quan chồng nhau: phản hồi hoặc lỗi cũ có thể ghi đè kết quả mới | Chỉ lượt yêu cầu mới nhất được cập nhật dữ liệu và lỗi |
| A04 | Danh sách Ngoại kiểm có cùng lỗi phản hồi lệch thứ tự, còn có thể hạ cờ tải của lượt mới | Bảo vệ đồng thời đợt, lịch, chương trình, lỗi và cờ tải bằng số thứ tự yêu cầu |
| A05 | Lỗi kết nối khi tổng hợp biên bản tháng giữ `reviewLoading=true`, khoá nút tải lại | Hạ cờ trong `finally` của đúng lượt mới nhất; giữ dữ liệu đã có và đưa lỗi tới bộ báo lỗi chung |

Nhóm tải dữ liệu có 8 ca hồi quy: trước sửa 6 ca thất bại, sau sửa 8/8 đạt.
Hai lỗi Tổng quan có kiểm tra hồi quy trực tiếp trên mô hình hiển thị thật.

## Mã trùng và mã không dùng

- Gom ánh xạ hàng nhật ký SQLite về `main/db/audit-row.ts`; đọc nhật ký và
  kiểm tra/phục hồi sao lưu dùng cùng hàm. Không còn hai bản ánh xạ song song.
- Gom thao tác tải nhận diện ở đăng nhập/đổi mật khẩu về `useLoginBrand`.
- Nhãn lần chạy NCE dùng cùng hàm định dạng cho lỗi và giao diện, giữ tên
  export cũ cho các nơi gọi.
- Bỏ 13 định danh không dùng phát hiện trong lượt quét đầu (import, selector,
  biến và tham số); bật `noUnusedLocals`/`noUnusedParameters` ở cấu hình biên
  dịch main và renderer để chặn tái xuất hiện.
- Sau dọn, phép quét hàm chép nguyên nội dung từ 50 token không còn nhóm
  trùng giữa các tệp. Các khối CSS ngắn giống nhau ở những component có vai
  trò khác nhau không bị ép thành một class chung chỉ để giảm số dòng.

## CSS

- Bỏ các rule Dashboard bị chép lại giữa `pages.css` và `pages/dashboard.css`;
  gom phần bố cục Dashboard về stylesheet của trang.
- Gộp selector lặp trong Nhập QC, Ngoại kiểm, cấu hình, hoá chất và Westgard;
  bỏ khai báo `letter-spacing` bị ghi đè ngay trong cùng rule.
- Bỏ class gợi ý xét nghiệm không dùng và các rule bố cục thừa đã xác nhận.
- Tách CSS PDF hoá chất sang `renderer/print/reagent.css`, nạp dạng `?raw` để
  giữ nguyên stylesheet độc lập khi xuất PDF. CSS bản in không được nạp vào
  cascade màn hình.
- CSS parity đọc cả stylesheet màn hình và bản in, tránh báo nhầm các class
  PDF là thiếu kiểu dáng. Baseline không được nới: còn đúng 5 class `tm-*`
  cố ý dùng làm móc DOM của ma trận Mean/SD.
- Phân tích cú pháp CSS không có lỗi; không còn khai báo thuộc tính lặp
  trong cùng rule hoặc rule màn hình bị chép nguyên selector và nội dung.
  `--sg-color` được gán inline tại thẻ Sigma; các class `modal-*`, `levels-*`,
  `empty-notice-*`, `is-*` sinh động vẫn cần thiết và được giữ lại.

## Kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| `npm test` trên mã cuối | 710/710 đạt |
| `npm run typecheck` | Đạt, gồm các cổng kiểm mã không dùng mới bật |
| `npm run lint` | Đạt |
| `npm run app:css-parity` | Đạt; 968 class được phát hiện, đúng 5 móc DOM trong baseline |
| `npm run build` trên mã cuối | Đạt |
| Toàn bộ kiểm thử Electron trong `verify-release` | 46/46 đạt |
| Electron chạy lại các vùng ảnh hưởng trên bản dựng cuối | 9/9 đạt |
| Thẩm định số học | 54/54 ca, 804 phép kiểm đạt |
| `git diff --check` | Đạt |

Lượt Electron toàn bộ chạy sau dọn CSS và sửa mô hình Tổng quan. Sau các sửa
tải dữ liệu và gom hàm cuối, đã chạy lại toàn bộ 710 hồi quy, dựng lại app và
chạy 9 ca Electron của đăng nhập, Ngoại kiểm, biên bản tháng, luồng NCE,
mọi trang điều hướng, số lượt tải và cửa sổ ứng dụng trên bản dựng mới.

Biên bản thẩm định: `validation-output/QC-Lab-tham-dinh-1.1.1-2026-11-12.xlsx`.
Các log kiểm nằm trong `.cache/app-review-*.log`; phép quét tĩnh cuối ở
`.cache/app-code-audit.json`. Đây là bằng chứng phát triển cục bộ, không
được đóng gói vào ứng dụng.

## Điểm còn lưu ý

- Vite còn cảnh báo một số bundle lớn hơn 500 kB, gồm thư viện Excel/PDF.
  Đây là cảnh báo kích thước, không phải lỗi CSS hoặc lỗi dựng ứng dụng.
- Kết quả tìm trùng là theo phạm vi và ngưỡng đã mô tả, không phải chứng nhận
  mọi đoạn mã tương tự về ngữ nghĩa đều đã được loại bỏ.
