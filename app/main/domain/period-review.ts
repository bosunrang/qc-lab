// Việc còn tồn của một kỳ báo cáo trước khi khoá kỳ (GV4 mục 3, ISO 15189:2022
// 7.3.7.2): lần chạy bị loại chưa có hồ sơ NCE và hồ sơ NCE chưa đóng. Khoá kỳ
// làm điểm QC trong kỳ không sửa/huỷ được nữa, nên khoá khi còn tồn phải là
// quyết định có xác nhận và có dấu vết, không phải mặc nhiên.
import type { NceQueueRow } from './nce/queue';
import { viDate } from './local-date';

export interface PeriodOpenRecord { nceId: string; detectedAt: string; runDates: readonly string[] }
export interface PeriodOpenItems {
  /** Lần chạy bị loại trong kỳ chưa thuộc hồ sơ NCE nào. */
  unreviewedRuns: { testId: string; date: string; runId: string }[];
  /** Hồ sơ NCE chưa đóng có lần chạy (hoặc ngày phát hiện) trong kỳ. */
  openNceIds: string[];
}

const inPeriod = (date: string, ym: string) => date.slice(0, 7) === ym;

export function periodOpenItems(ym: string, queue: readonly NceQueueRow[], openRecords: readonly PeriodOpenRecord[]): PeriodOpenItems {
  return {
    unreviewedRuns: queue.filter((row) => !row.record && inPeriod(row.date, ym)).map((row) => ({ testId: row.testId, date: row.date, runId: row.runId })),
    openNceIds: openRecords
      .filter((record) => (record.runDates.length ? record.runDates.some((date) => inPeriod(date, ym)) : inPeriod(record.detectedAt, ym)))
      .map((record) => record.nceId).sort(),
  };
}

export const hasPeriodOpenItems = (items: PeriodOpenItems) => items.unreviewedRuns.length > 0 || items.openNceIds.length > 0;

const LIST_LIMIT = 5;
const listText = (items: readonly string[]) => items.slice(0, LIST_LIMIT).join('; ') + (items.length > LIST_LIMIT ? `; … (+${items.length - LIST_LIMIT})` : '');

/** "2 lần chạy bị loại chưa có hồ sơ NCE (Glucose 05/10/2026 lần 2026-10-05-1; …); 1 hồ sơ NCE chưa đóng (NCE-2026-001)". */
export function periodOpenItemsText(items: PeriodOpenItems, testName: (testId: string) => string): string {
  const parts: string[] = [];
  if (items.unreviewedRuns.length) {
    parts.push(`${items.unreviewedRuns.length} lần chạy bị loại chưa có hồ sơ NCE (${listText(items.unreviewedRuns.map((run) => `${testName(run.testId)} ${viDate(run.date)} lần ${run.runId}`))})`);
  }
  if (items.openNceIds.length) parts.push(`${items.openNceIds.length} hồ sơ NCE chưa đóng (${listText(items.openNceIds)})`);
  return parts.join('; ');
}
