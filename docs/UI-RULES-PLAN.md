# Kế hoạch hoàn thiện quy tắc giao diện

Lập ngày 2026-09-24, hoàn tất 2026-09-25 trên nhánh
`refactor/ui-rules-remaining`. Tài liệu tổng hợp các quy tắc nằm ở
`docs/DESIGN-SYSTEM.md`; tệp này chỉ còn ghi lại quá trình và việc còn chờ.

Mỗi mục làm theo cùng một cách:

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
| Màu | Bảng Clinical Precision, không mã màu ở CSS trang, tương phản WCAG AA, không còn lớp bí danh |
| Chữ | 8 cỡ chữ, 4 độ đậm, 5 dãn dòng, thang tiêu đề 6 cấp, nhãn form 13px |
| Khoảng cách | Lưới 4px; nhãn → ô 6px (`--field-label-gap`); giữa các field 16px (`--field-gap`) |
| Chiều cao | Control 28/32/36px; hàng bảng 36/44/52px; header bảng 30/40px; badge 24px |
| Thứ tự lớp | 9 token `--z-*` theo vai trò; chỉ 0/1/auto được viết thô |
| Icon | 5 cỡ 10/14/16/20/24px (`--icon-*`) |
| Bóng đổ, chuyển động | Chỉ `--shadow-*` (hoặc `inset`); 150/200ms (`--motion-fast`, `--motion`), giảm chuyển động về 0 |
| Linh kiện | `EmptyState` một hình thức; `.hint-inline`; badge `.tag`/`.pill`; `.count`; `.step-number`; `Modal` 4 cỡ; một vòng focus |
| Cấu trúc | Mọi cặp nhãn + ô trong `.field`; không rule `margin-top:0` thừa cho nhãn; không comment nào được nuốt rule CSS; mọi `var()` ở CSS và TSX có định nghĩa |

## Nhật ký thực hiện (2026-09-25)

| Mục | Kết quả |
| --- | --- |
| 1. z-index | 17 số → 9 token. Đổi một chỗ: sidebar nay nằm trên header trang (nút thu gọn nhô sang vùng header từng bị che) |
| 2. Cỡ icon | 8 cỡ → 5 token. Nhìn thấy: sidebar 17→16, nút huỷ điểm 15→14, icon trong nút 15→16, icon tiêu đề Cài đặt 21→20 |
| 3. Bóng đổ, chuyển động | 10 bóng viết tay → token, gộp 3 bóng trùng; 6 thời lượng → 2 |
| 4. Bộ đếm, số thứ tự bước | `.count`, `.step-number` dùng chung; bộ đếm tab Cấu hình đang chọn đổi sang nền teal như Tổng quan |
| 5. Dòng gợi ý, placeholder | Bỏ `.empty-state` (13 chỗ → EmptyState, 4 chỗ → `.hint-inline`). Placeholder Sigma/So sánh hoá chất về kiểu EmptyState chung, không icon (theo yêu cầu người dùng) |
| 6. Dọn nợ cũ | Xoá lớp 4 (91 bí danh, 739 chỗ thay, 16 tên chuyển lên lớp 2/3); xoá 9 rule `margin-top:0` thừa; sửa `var(--type-body)` trỏ vào token đã xoá ở Westgard; viết `docs/DESIGN-SYSTEM.md` |

## Việc ngoài giao diện đang chờ

- Nhánh `refactor/ui-rules-remaining` chưa push, chưa merge vào `main`;
  `main` vẫn đi trước `origin/main`.
- Nhánh đã merge có thể xoá: `fix/lan-login-security`,
  `refactor/ui-empty-state-heights`, `refactor/ui-field-badge-modal`.
- LAN vẫn chạy HTTP thường: cần quyết định có dùng HTTPS (chứng chỉ tự ký
  hoặc CA nội bộ) hay không.
- Một số câu thông báo trong test cũ còn viết không dấu (ví dụ
  `auth-handlers.test.mjs`); có thể thêm dấu nếu muốn.
