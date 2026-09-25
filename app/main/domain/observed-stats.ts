// Thống kê QUAN SÁT ĐƯỢC của một tập điểm QC (khác Mean/SD ĐÍCH đang gán cho
// mức). Nguồn DUY NHẤT của công thức — main dùng cho Tổng quan Westgard,
// renderer dùng cho các panel thống kê theo khoảng ngày người dùng chọn (main
// không tính sẵn được mọi khoảng). Việc điểm nào ĐƯỢC CHẤP NHẬN vào thống kê
// vẫn do main quyết định (`accepted`); hàm này chỉ tính trên tập được đưa vào.
//
// Trước 2026-09-25 có 5 bản viết tay đã lệch nhau: bản Lịch sử lô thiếu
// Math.abs cho CV; hai bản Nhập QC trả 0 khi chưa đủ điểm (1 điểm hiện
// "CV 0.00%"), các bản khác trả null.
//
// Quyết định nghiệp vụ (WESTGARD-REVIEW-2026-09-22.md, WG-14):
// - SD mẫu, mẫu số n − 1; cần ít nhất 2 điểm, ít hơn thì SD và CV là null.
// - CV = SD / |Mean| × 100; Mean bằng 0 thì CV là null.
// - "Tạm thời" khi chưa đủ 20 phép đo trong ít nhất 10 ngày (hướng dẫn khởi
//   tạo biểu đồ Levey-Jennings của Westgard). Không cấm hiển thị khi n nhỏ.

export interface ObservedStats {
  n: number;
  days: number;
  mean: number | null;
  sd: number | null;
  cv: number | null;
  provisional: boolean;
}

export const OBSERVED_MIN_POINTS = 20;
export const OBSERVED_MIN_DAYS = 10;

export function observedStats(points: readonly { val: number; date?: string | null }[]): ObservedStats {
  const used = points.filter((point) => Number.isFinite(point.val));
  const n = used.length;
  const days = new Set(used.map((point) => point.date).filter(Boolean)).size;
  const mean = n ? used.reduce((sum, point) => sum + point.val, 0) / n : null;
  const sd = n >= 2 && mean != null ? Math.sqrt(used.reduce((sum, point) => sum + (point.val - mean) ** 2, 0) / (n - 1)) : null;
  const cv = sd != null && mean ? sd / Math.abs(mean) * 100 : null;
  return { n, days, mean, sd, cv, provisional: n < OBSERVED_MIN_POINTS || days < OBSERVED_MIN_DAYS };
}
