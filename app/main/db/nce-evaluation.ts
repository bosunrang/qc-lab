// Đánh giá Westgard phục vụ hồ sơ NCE: chụp snapshot một lần chạy, liệt kê
// lần chạy bị loại cho hàng chờ, và kết luận từng lần chạy cho khoảng nghi
// ngờ. Tập điểm giống hệt trang Phân tích Westgard (`activeLevels()` trong
// `ipc/westgard-handlers.ts`): mức đang vận hành, điểm chưa hủy của đúng lô
// đang gán. Mốc cắt đọc từ `nce_cuts`, cộng mốc giả định khi đánh giá rerun.
import type { Db } from './sqlite-like';
import { isTestInActivePanel, listOperationalLevels } from './operational-levels';
import { evaluateQcSets } from './westgard-evaluation';
import type { QcCut } from '../domain/qc-cuts';
import type { CombinedPointFlag } from '../domain/westgard-engine';
import { compareQcPointOrder, qcRunKey } from '../domain/sort-order';
import type { NceRunKey, NceRunPoint, NceRunSnapshot } from '../domain/nce/types';
import type { NceQueuePoint } from '../domain/nce/queue';
import type { NceRunOutcome } from '../domain/nce/patient-impact';

interface EvalPoint { id: string; date: string; run_id: string; runId: string; level: number; lot: string; val: number; qcMean: number | null; qcSd: number | null }

function operationalSets(db: Db, testId: string) {
  const inActivePanel = isTestInActivePanel(db, testId);
  return listOperationalLevels(db, testId).map((level) => {
    const rows = inActivePanel ? db.prepare(`SELECT id,date,run_id,level,lot,val,qc_mean,qc_sd FROM qc_points
      WHERE test_id=? AND level=? AND voided=0 AND lot=?`).all(testId, level.level, level.lot_no) as
      { id: string; date: string; run_id: string; level: number; lot: string; val: number; qc_mean: number | null; qc_sd: number | null }[] : [];
    const pts: EvalPoint[] = rows.map((row) => ({ ...row, runId: row.run_id, qcMean: row.qc_mean, qcSd: row.qc_sd })).sort(compareQcPointOrder);
    return { level: level.level, mean: level.mean, sd: level.sd, pts };
  });
}

function evaluate(db: Db, testId: string, extraCuts: readonly QcCut[] = []) {
  const sets = operationalSets(db, testId);
  return { sets, byPoint: evaluateQcSets(db, testId, sets, sets.length, extraCuts) };
}

function verdictOf(flag: CombinedPointFlag | undefined): NceRunPoint['verdict'] {
  return flag && Number.isFinite(flag.z) ? flag.level : 'none';
}

/** Snapshot MỌI điểm của một lần chạy (mọi mức, kể cả đã hủy hay khác lô).
 * Điểm ngoài tập đang vận hành mang kết luận `none`. `extraCuts` để đánh giá
 * lần rerun trong giai đoạn mới (D-04). */
export function nceRunSnapshot(db: Db, testId: string, run: NceRunKey, extraCuts: readonly QcCut[] = []): NceRunSnapshot {
  const { sets, byPoint } = evaluate(db, testId, extraCuts);
  const flagById = new Map<string, { flag: CombinedPointFlag; mean: number | null; sd: number | null }>();
  for (const set of sets) for (const point of set.pts) {
    const flag = byPoint.get(point);
    if (flag) flagById.set(point.id, { flag, mean: point.qcMean ?? set.mean, sd: point.qcSd ?? set.sd });
  }
  const rows = db.prepare('SELECT id,level,lot,val,voided,qc_mean,qc_sd FROM qc_points WHERE test_id=? AND date=? AND run_id=? ORDER BY level')
    .all(testId, run.date, run.runId) as { id: string; level: number; lot: string; val: number; voided: number; qc_mean: number | null; qc_sd: number | null }[];
  return {
    testId, date: run.date, runId: run.runId,
    points: rows.map((row) => {
      const found = row.voided ? undefined : flagById.get(row.id);
      return {
        pointId: row.id, level: row.level, lot: row.lot, voided: !!row.voided, val: row.val,
        mean: found?.mean ?? row.qc_mean, sd: found?.sd ?? row.qc_sd,
        z: found && Number.isFinite(found.flag.z) ? found.flag.z : null,
        verdict: verdictOf(found?.flag), rules: found ? [...found.flag.rules] : [],
      };
    }),
  };
}

/** Điểm bị loại của các xét nghiệm đang hoạt động, cho hàng chờ NCE. */
export function nceRejectedPoints(db: Db): NceQueuePoint[] {
  const tests = db.prepare('SELECT id FROM tests WHERE active<>0').all() as { id: string }[];
  const out: NceQueuePoint[] = [];
  for (const test of tests) {
    const { sets, byPoint } = evaluate(db, test.id);
    for (const set of sets) for (const point of set.pts) {
      const flag = byPoint.get(point);
      if (flag?.level !== 'rej') continue;
      out.push({ pointId: point.id, testId: test.id, level: set.level, lot: point.lot, date: point.date, runId: point.run_id, verdict: 'rej', rules: [...flag.rules] });
    }
  }
  return out;
}

/** Kết luận từng lần chạy đang vận hành của một xét nghiệm (bị loại hay không). */
export function nceRunOutcomes(db: Db, testId: string): NceRunOutcome[] {
  const { sets, byPoint } = evaluate(db, testId);
  const runs = new Map<string, NceRunOutcome>();
  for (const set of sets) for (const point of set.pts) {
    const key = qcRunKey(point);
    const run = runs.get(key) ?? { date: point.date, runId: point.run_id, rejected: false };
    if (byPoint.get(point)?.level === 'rej') run.rejected = true;
    runs.set(key, run);
  }
  return [...runs.values()];
}

/** Các mức đang vận hành — mức phải có trong lần chạy xác minh của hồ sơ không phải IQC. */
export function nceOperationalLevels(db: Db, testId: string): number[] {
  return listOperationalLevels(db, testId).map((level) => level.level);
}
