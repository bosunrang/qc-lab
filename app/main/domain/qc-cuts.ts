// Mốc bắt đầu lại chuỗi QC sau sự cố (D-03 trong
// `docs/NCE-REDESIGN-2026-10-12.md`; phụ lục 12/10/2026 của
// `WESTGARD-REVIEW-2026-09-22.md`). Luật nhiều lần chạy và CUSUM không ghép
// bằng chứng qua một mốc cắt.
//
// - Mốc theo LẦN CHẠY (`runId` khác null): lần chạy rerun được chấp nhận khi
//   cho phép hoạt động trở lại. Chính lần chạy đó là lần đầu của giai đoạn mới.
// - Mốc theo NGÀY (`runId` null): chỉ còn cho hồ sơ phiên bản cũ đã duyệt và
//   hiệu quả; giai đoạn mới bắt đầu từ ngày SAU ngày hoàn thành, đúng như cách
//   tính trước khi đổi.
import { compareIsoDate, compareQcRunKey, qcRunKey } from './sort-order';

export interface QcCut { date: string; runId: string | null }

function atOrAfter(point: { date?: unknown; runId?: unknown }, cut: QcCut): boolean {
  const date = String(point.date || '');
  if (cut.runId === null) return compareIsoDate(date, cut.date) > 0;
  return compareQcRunKey(qcRunKey(point), qcRunKey({ date: cut.date, runId: cut.runId })) >= 0;
}

/** Giai đoạn của một điểm: số mốc cắt mà điểm nằm tại hoặc sau. */
export function qcEpochOf(point: { date?: unknown; runId?: unknown }, cuts: readonly QcCut[]): number {
  let epoch = 0;
  for (const cut of cuts) if (atOrAfter(point, cut)) epoch++;
  return epoch;
}
