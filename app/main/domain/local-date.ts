// Ngày làm việc HÔM NAY theo GIỜ ĐỊA PHƯƠNG của máy chạy app.
//
// `new Date().toISOString().slice(0,10)` trả ngày theo UTC. Ở Việt Nam
// (UTC+7), từ 00:00 tới 07:00 giờ địa phương thì ngày UTC vẫn là NGÀY HÔM
// TRƯỚC — nghĩa là ca QC buổi sáng sớm bị tính vào hôm qua: "đã đủ QC hôm
// nay" đếm sai, hạn xử lý NCE +7 ngày lệch một ngày, và mốc cắt kỳ Sigma
// nhảy về tháng trước vào sáng ngày mùng 1. Đây đúng lớp lỗi đã được chốt
// cho LIS Gateway (`resultToPointInput()` phải suy ngày theo giờ địa
// phương, xem CLAUDE.md Giai đoạn C5) — cùng một nguyên tắc, áp cho mọi
// chỗ tính "hôm nay" ở main process.
export function isoLocalDate(at: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** Ngày địa phương cách hôm nay `days` ngày (dùng cho hạn xử lý NCE). */
export function isoLocalDateAfter(days: number, at: Date = new Date()): string {
  const shifted = new Date(at.getFullYear(), at.getMonth(), at.getDate() + days);
  return isoLocalDate(shifted);
}


