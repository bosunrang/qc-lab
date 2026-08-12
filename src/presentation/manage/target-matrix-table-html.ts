export function targetMatrixTableHtml(rowsHtml: string) {
  return `<div class="target-table"><div class="target-head"><span>Dùng</span><span>Xét nghiệm</span><span>Trung bình mục tiêu</span><span>Giới hạn dưới</span><span>Giới hạn trên</span><span>Độ lệch chuẩn</span><span>Trạng thái</span></div>${rowsHtml}</div>`;
}
