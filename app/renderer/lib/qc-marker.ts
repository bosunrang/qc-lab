// Hình điểm QC trên biểu đồ Levey-Jennings (U6). Trước đây mọi điểm đều là
// chấm tròn, Cảnh báo và Loại chỉ khác nhau ở màu cam/đỏ (tương phản giữa hai
// màu 2,15:1): người nhìn màu kém hoặc bản in đen trắng không phân biệt được.
// WCAG 2.2 mục 1.4.1 không cho màu là tín hiệu duy nhất, nên mỗi kết luận có
// một hình riêng; màu giữ nguyên.
//
// Không dùng hình để phân biệt MỨC trên biểu đồ nhiều mức: hình đã dành cho
// kết luận, mức phân biệt bằng màu và kiểu nét (`levelDash`).

export type QcVerdict = 'ok' | 'warn' | 'rej' | 'none';
export type QcMarkerShape = 'circle' | 'triangle' | 'square';

/** Đạt và chưa đánh giá: tròn; Cảnh báo: tam giác; Loại: vuông. */
export function markerShape(verdict: QcVerdict): QcMarkerShape {
  return verdict === 'rej' ? 'square' : verdict === 'warn' ? 'triangle' : 'circle';
}

/** "Bán kính" (nửa cạnh khung bao) theo kết luận. Tam giác cần khung lớn hơn
 * để có diện tích tương đương hình vuông; điểm Đạt nhỏ nhất vì chiếm đa số. */
export function markerSize(verdict: QcVerdict): number {
  return verdict === 'rej' ? 5 : verdict === 'warn' ? 6 : 4;
}

/** Vẽ đường bao của hình lên `ctx` (chưa fill/stroke). Tâm tam giác đặt ở
 * trọng tâm để điểm nằm đúng giá trị như chấm tròn. */
export function traceMarker(ctx: Pick<CanvasRenderingContext2D, 'beginPath' | 'arc' | 'rect' | 'moveTo' | 'lineTo' | 'closePath'>, shape: QcMarkerShape, x: number, y: number, r: number): void {
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (shape === 'square') ctx.rect(x - r, y - r, r * 2, r * 2);
  else {
    const h = r * 1.8;
    ctx.moveTo(x, y - (h * 2) / 3);
    ctx.lineTo(x + h / Math.sqrt(3), y + h / 3);
    ctx.lineTo(x - h / Math.sqrt(3), y + h / 3);
    ctx.closePath();
  }
}

/** Kiểu nét của đường theo thứ tự mức trên biểu đồ nhiều mức: liền, gạch, chấm,
 * rồi lặp. Đi kèm màu để in đen trắng vẫn tách được mức. */
const LEVEL_DASHES: readonly (readonly number[])[] = [[], [8, 5], [2, 4]];
export function levelDash(index: number): number[] {
  return [...LEVEL_DASHES[index % LEVEL_DASHES.length]];
}

/** Nhãn luật ghi cạnh điểm Loại, ví dụ "1-3s" hoặc "2-2s, R-4s". Rỗng khi điểm
 * không có luật nào. Tối đa hai luật cho gọn; tooltip vẫn có đủ. */
export function rejectRuleLabel(rules: readonly string[]): string {
  const shown = rules.slice(0, 2).join(', ');
  return rules.length > 2 ? `${shown}…` : shown;
}

/** Chọn những điểm Loại được ghi nhãn mà không đè lên nhau: nhãn đặt về phía
 * giữa biểu đồ (điểm trên Mean thì nhãn ở dưới và ngược lại); nhãn cùng phía
 * chồng ngang lên nhãn trước thì bỏ, tooltip vẫn có đủ luật. `width` là bề
 * rộng chữ đo được. Trả về chỉ số của các điểm được ghi nhãn. */
export function pickRejectLabels(items: readonly { x: number; above: boolean; width: number }[], gap = 6): number[] {
  const lastRight = { above: -Infinity, below: -Infinity };
  const picked: number[] = [];
  items.forEach((item, index) => {
    const side = item.above ? 'above' : 'below';
    const left = item.x - item.width / 2;
    if (left < lastRight[side] + gap) return;
    lastRight[side] = item.x + item.width / 2;
    picked.push(index);
  });
  return picked;
}
