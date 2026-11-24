// Gợi ý cho checklist "Kiểm tra nhanh" từ dữ liệu app đã có (đánh giá giao
// diện 09/11/2026): lô QC của lần khởi đầu đã/sắp hết hạn, hoặc mới bắt đầu
// dùng ngay trước sự cố. Chỉ là lời nhắc cạnh mục tương ứng; KHÔNG tự chọn kết
// quả — người rà soát vẫn đánh giá và ghi bằng chứng như cổng hiện hành.
import { viDate } from '../local-date';

/** Lô mới dùng trong chừng này ngày trước sự cố thì nhắc ở mục "Thay lô". */
export const RECENT_LOT_DAYS = 14;
/** Lô hết hạn trong chừng này ngày sau sự cố thì nhắc ở mục "Vật liệu QC". */
export const EXPIRY_WARN_DAYS = 14;

export interface HintLot { lotNo: string; exp: string; firstUsed: string }

function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number), [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Khoá là mã mục checklist (`qcMaterial`, `lotChange`). */
export function nceChecklistHints(incidentDate: string, lots: readonly HintLot[]): Record<string, string> {
  const material: string[] = [], change: string[] = [];
  for (const lot of lots) {
    if (isDate(lot.exp)) {
      const left = daysBetween(incidentDate, lot.exp);
      if (left < 0) material.push(`Lô QC ${lot.lotNo} đã hết hạn ngày ${viDate(lot.exp)}, trước ngày sự cố.`);
      else if (left <= EXPIRY_WARN_DAYS) material.push(`Lô QC ${lot.lotNo} hết hạn ngày ${viDate(lot.exp)} (còn ${left} ngày lúc sự cố).`);
    }
    if (isDate(lot.firstUsed)) {
      const since = daysBetween(lot.firstUsed, incidentDate);
      if (since >= 0 && since <= RECENT_LOT_DAYS) change.push(`Lô QC ${lot.lotNo} mới bắt đầu dùng từ ${viDate(lot.firstUsed)} (${since} ngày trước sự cố).`);
    }
  }
  const hints: Record<string, string> = {};
  if (material.length) hints.qcMaterial = material.join(' ');
  if (change.length) hints.lotChange = change.join(' ');
  return hints;
}
