// Màu dùng chung cho biểu đồ vẽ bằng canvas/SVG, nơi không đọc được biến CSS.
// Giá trị phải trùng token tương ứng trong `styles/tokens.css` (test
// `design-system.test.mjs` đối chiếu), để biểu đồ cùng một màu teal với nút
// và liên kết của app. Trước đây ba biểu đồ dùng ba mã teal khác nhau.

/** Trùng `--teal-500` (`--accent`). */
export const CHART_TEAL = '#0b7c83';
