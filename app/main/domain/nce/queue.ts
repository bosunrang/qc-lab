// Hàng chờ sự cố NCE tính theo LẦN CHẠY (D-01, D-14; sửa R-07, R-17).
// Mỗi dòng là một lần chạy có ít nhất một mức bị loại; cảnh báo không vào hàng
// chờ. Lần chạy đã thuộc hồ sơ ĐÃ ĐÓNG thì rời hàng chờ; thuộc hồ sơ đang xử
// lý thì vẫn hiện để mở tiếp; hồ sơ đã hủy coi như chưa có hồ sơ.
import type { RuleVerdict } from '../westgard-engine';
import type { NceRunKey, NceStatus } from './types';
import { compareRun, runKeyOf } from './format';

export interface NceQueuePoint extends NceRunKey {
  pointId: string; testId: string; level: number; lot: string;
  verdict: RuleVerdict | 'none'; rules: readonly string[];
}

export interface NceQueueRecord { id: string; nceId: string; status: NceStatus; testId: string | null; runs: readonly NceRunKey[] }

export interface NceQueueRow extends NceRunKey {
  testId: string;
  rejectedLevels: { level: number; lot: string; rules: readonly string[]; pointId: string }[];
  /** Hồ sơ đang xử lý đã chứa lần chạy này. */
  record: { id: string; nceId: string } | null;
  /** Hồ sơ `open` cùng xét nghiệm có thể gắn lần chạy này vào (D-01). */
  attachTo: { id: string; nceId: string } | null;
}

export function buildNceQueue(points: readonly NceQueuePoint[], records: readonly NceQueueRecord[]): NceQueueRow[] {
  const byRun = new Map<string, NceQueueRow>();
  for (const point of points) {
    if (point.verdict !== 'rej') continue;
    const key = `${point.testId}\u0001${runKeyOf(point)}`;
    let row = byRun.get(key);
    if (!row) { row = { testId: point.testId, date: point.date, runId: point.runId, rejectedLevels: [], record: null, attachTo: null }; byRun.set(key, row); }
    row.rejectedLevels.push({ level: point.level, lot: point.lot, rules: point.rules, pointId: point.pointId });
  }

  const live = records.filter((record) => record.status !== 'cancelled' && record.testId);
  const rows: NceQueueRow[] = [];
  for (const row of byRun.values()) {
    const owner = live.find((record) => record.testId === row.testId && record.runs.some((run) => compareRun(run, row) === 0));
    if (owner?.status === 'closed') continue;
    row.rejectedLevels.sort((a, b) => a.level - b.level);
    if (owner) row.record = { id: owner.id, nceId: owner.nceId };
    else {
      // Chỉ gợi ý gắn vào hồ sơ CHƯA cho chạy lại và có lần hỏng trước lần này.
      const candidate = live
        .filter((record) => record.status === 'open' && record.testId === row.testId && record.runs.some((run) => compareRun(run, row) < 0))
        .sort((a, b) => compareRun(latest(b.runs), latest(a.runs)))[0];
      if (candidate) row.attachTo = { id: candidate.id, nceId: candidate.nceId };
    }
    rows.push(row);
  }
  return rows.sort((a, b) => compareRun(b, a) || a.testId.localeCompare(b.testId));
}

function latest(runs: readonly NceRunKey[]): NceRunKey {
  return runs.reduce((max, run) => compareRun(run, max) > 0 ? run : max, runs[0]);
}
