// Nhóm, lọc và chia trang hàng chờ "Lần chạy QC cần xử lý" (đánh giá giao
// diện 09/11/2026). Trước đây mỗi lần chạy là một thẻ lớn, vài chục lần chạy
// thành một danh sách rất dài và các lần của cùng xét nghiệm nằm rải rác. Nay
// là bảng gọn: nhóm theo xét nghiệm, nhóm có lần chạy gần nhất lên đầu, trong
// nhóm mới nhất trước; lọc được theo một xét nghiệm; chia trang theo số dòng.
import type { NceQueueRowView } from '../../../shared/qc-api';

export const QUEUE_PAGE_SIZE = 20;

export interface QueueTestOption { testId: string; testName: string; count: number }
export interface QueueGroup { testId: string; testName: string; total: number; rows: NceQueueRowView[] }

const runKey = (row: NceQueueRowView) => `${row.date}\u0000${row.run_id}`;

/** Xét nghiệm có trong hàng chờ, nhiều lần chạy nhất lên đầu, cho ô lọc. */
export function queueTestOptions(rows: readonly NceQueueRowView[]): QueueTestOption[] {
  const byTest = new Map<string, QueueTestOption>();
  for (const row of rows) {
    const option = byTest.get(row.test_id) ?? { testId: row.test_id, testName: row.test_name, count: 0 };
    option.count++;
    byTest.set(row.test_id, option);
  }
  return [...byTest.values()].sort((a, b) => b.count - a.count || a.testName.localeCompare(b.testName, 'vi'));
}

/** Một trang của hàng chờ đã nhóm. `total` của nhóm là số lần chạy của xét
 * nghiệm đó trong cả hàng chờ (không chỉ trên trang đang xem). */
export function queuePage(rows: readonly NceQueueRowView[], testId: string, page: number, pageSize = QUEUE_PAGE_SIZE) {
  const matched = testId ? rows.filter((row) => row.test_id === testId) : rows.slice();
  const latest = new Map<string, string>();
  const totals = new Map<string, number>();
  for (const row of matched) {
    const key = runKey(row);
    if ((latest.get(row.test_id) ?? '') < key) latest.set(row.test_id, key);
    totals.set(row.test_id, (totals.get(row.test_id) ?? 0) + 1);
  }
  const ordered = matched.sort((a, b) =>
    (latest.get(b.test_id) ?? '').localeCompare(latest.get(a.test_id) ?? '')
    || a.test_name.localeCompare(b.test_name, 'vi')
    || runKey(b).localeCompare(runKey(a)));
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const groups: QueueGroup[] = [];
  for (const row of ordered.slice((current - 1) * pageSize, current * pageSize)) {
    const last = groups[groups.length - 1];
    if (last && last.testId === row.test_id) last.rows.push(row);
    else groups.push({ testId: row.test_id, testName: row.test_name, total: totals.get(row.test_id) ?? 0, rows: [row] });
  }
  return { groups, total: ordered.length, page: current, pageCount };
}
