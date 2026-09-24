/** Định dạng thời gian nhìn thấy trong nhật ký và CSV audit. Giữ một hàm
 * thuần dùng chung cho main/renderer để tìm kiếm, bảng và file xuất không
 * lệch nhau theo locale. */
export function formatAuditDateTimeVN(value: unknown): string {
  const date = new Date(String(value || ''));
  if (!Number.isFinite(+date)) return '';
  return `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} ${date.toLocaleDateString('vi-VN')}`;
}

/** Đổi ngày ISO nằm trong phần mô tả audit sang định dạng người dùng Việt Nam.
 * Dùng lúc hiển thị để các log đã có cũng được chuẩn hoá, không sửa dữ liệu
 * hay chuỗi hash đã lưu. */
export function formatAuditDetailVN(value: unknown): string {
  return String(value || '').replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_match, year, month, day) => `${day}/${month}/${year}`);
}


