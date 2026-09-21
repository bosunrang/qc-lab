/** Định dạng thời gian nhìn thấy trong nhật ký và CSV audit. Giữ một hàm
 * thuần dùng chung cho main/renderer để tìm kiếm, bảng và file xuất không
 * lệch nhau theo locale. */
export function formatAuditDateTimeVN(value: unknown): string {
  const date = new Date(String(value || ''));
  if (!Number.isFinite(+date)) return '';
  return `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} ${date.toLocaleDateString('vi-VN')}`;
}
