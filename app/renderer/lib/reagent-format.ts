// Trang này dùng ĐÚNG HAI formatter khác nhau:
//   • phần THỐNG KÊ/tiêu chí (`fmt`) bỏ số 0 dư: "R² = 1", "6%",
//     "139.2 / 140.592";
//   • cột tính sẵn của hàng cặp mẫu (`fmtFixed`) giữ nguyên số 0:
//     "130.650", "-1.300".
// Trộn 2 chỗ này là lệch hàng loạt dòng chữ, nên giữ riêng.
export const fmt = (value: unknown, decimals = 2): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return String(Number(n.toFixed(decimals)));
};
export const fmtFixed = (value: unknown, decimals = 3): string => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : '–';
};

export const fmtT = (value: unknown): string => {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(4)).toString() : (n > 0 ? '+∞' : '−∞');
};
export const equation = (slope: number, intercept: number) =>
  `y = ${fmt(slope, 4)}x ${intercept >= 0 ? '+' : '−'} ${fmt(Math.abs(intercept), 4)}`;

export const MIN_PAIRS = 5;
