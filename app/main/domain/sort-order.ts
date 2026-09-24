// Thứ tự sắp xếp dùng chung cho chuỗi điểm QC. Không import module nào khác
// để test oracle chạy thẳng trên TypeScript được.
//
// LÝ DO TỒN TẠI (hiệu năng, đo được): `a.localeCompare(b, 'vi', {numeric:true})`
// dựng một Intl.Collator MỚI cho mỗi lần so sánh. Đo trên 730 phần tử:
// 31,6 ms mỗi lần sắp xếp, so với 1,4 ms khi dùng lại một collator — chậm hơn
// ~23 lần. Chuỗi điểm QC được sắp lại ở MỌI lần đánh giá Westgard (mỗi mức
// của mỗi xét nghiệm), nên đây là phần chi phí lớn nhất của
// `listTestSummaries()`. Ngữ nghĩa so sánh giữ NGUYÊN VẸN — cùng locale,
// cùng cờ numeric, chỉ khác ở chỗ collator được tạo một lần.
const RUN_COLLATOR = new Intl.Collator('vi', { numeric: true });

/** So sánh mã lần chạy theo thứ tự tự nhiên, để "2026-03-02-10" đứng sau
 * "2026-03-02-9". */
export function compareRunId(a: string, b: string): number {
  return RUN_COLLATOR.compare(a, b);
}

/** Một lần chạy được định danh trong ngày; mã do LIS gửi có thể lặp ngày sau. */
export function qcRunKey(point: { date?: unknown; runId?: unknown }): string {
  return `${String(point.date || '')}\u0000${String(point.runId || '')}`;
}

export function compareQcRunKey(a: string, b: string): number {
  const [dateA, runA] = a.split('\u0000');
  const [dateB, runB] = b.split('\u0000');
  return compareIsoDate(dateA, dateB) || compareRunId(runA || '', runB || '');
}

/** So sánh ngày ISO `YYYY-MM-DD`. Định dạng cố định, chỉ gồm chữ số và dấu
 * gạch nối, nên so sánh chuỗi thuần cho ĐÚNG thứ tự thời gian mà không phải
 * gọi vào Intl. */
export function compareIsoDate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Thứ tự chuẩn của một chuỗi điểm QC: theo ngày, rồi theo lần chạy. */
export function compareQcPointOrder(a: { date: string; run_id: string }, b: { date: string; run_id: string }): number {
  return compareIsoDate(a.date, b.date) || compareRunId(a.run_id, b.run_id);
}

