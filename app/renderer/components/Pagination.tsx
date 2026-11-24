// Phân trang dùng chung cho bảng (U9). Trước đây Nhật ký, Lịch sử Mean/SD và
// danh sách lô mỗi nơi tự dựng một kiểu: nút chữ "‹ Trước" ở hai nơi, nút
// icon vuông ở nơi còn lại, hai bộ CSS khác lề.
// Chỉ hiện khi có từ hai trang trở lên; số dòng khớp đã có ở đầu bảng.

export interface PaginationProps {
  page: number;
  pageCount: number;
  /** Số thứ tự dòng đầu/cuối của trang đang xem (đếm từ 1). */
  from: number;
  to: number;
  total: number;
  /** Đơn vị đếm: "dòng", "điểm", "lô QC"… */
  unit: string;
  /** Tên vùng cho trình đọc màn hình: "Phân trang nhật ký". */
  label: string;
  onPageChange: (page: number) => void;
}

/** `from`/`to` của trang `page` khi chia `total` dòng theo cỡ `pageSize`. */
export function pageBounds(page: number, pageSize: number, total: number): { from: number; to: number } {
  const from = (page - 1) * pageSize + 1;
  return { from, to: Math.min(total, page * pageSize) };
}

export function Pagination({ page, pageCount, from, to, total, unit, label, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;
  return <nav className="table-pagination" aria-label={label}>
    <span className="hint" role="status">Hiển thị {from}–{to} / {total} {unit}</span>
    <div>
      <button type="button" className="btn ghost sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>‹ Trước</button>
      <b aria-current="page">Trang {page}/{pageCount}</b>
      <button type="button" className="btn ghost sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Sau ›</button>
    </div>
  </nav>;
}
