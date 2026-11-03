// Đánh giá Westgard phục vụ hồ sơ NCE: chụp snapshot một lần chạy, liệt kê
// lần chạy bị loại cho hàng chờ, và kết luận từng lần chạy cho khoảng nghi
// ngờ. Tập điểm giống hệt trang Phân tích Westgard (`activeLevels()` trong
// `ipc/westgard-handlers.ts`): mức đang vận hành, điểm chưa huỷ của đúng lô
// đang gán. Kiểm lại bằng chứng đã chốt dùng đúng chuỗi lô lịch sử của nó.
// Mốc cắt đọc từ `nce_cuts`, cộng mốc giả định khi đánh giá rerun.
import type { Db } from './sqlite-like';
import { isTestInActivePanel, listOperationalLevels } from './operational-levels';
import { evaluateQcSets, testRuleActionOf } from './westgard-evaluation';
import type { QcCut } from '../domain/qc-cuts';
import { rejectingRules, type CombinedPointFlag } from '../domain/westgard-engine';
import { compareQcPointOrder, qcRunKey } from '../domain/sort-order';
import type { NceRunKey, NceRunPoint, NceRunSnapshot, NceStatus } from '../domain/nce/types';
import { buildNceQueue, type NceQueuePoint, type NceQueueRow } from '../domain/nce/queue';
import type { NceRunMark, NceRunOutcome, NceSuspectChain } from '../domain/nce/patient-impact';

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

/** Chuỗi điểm theo đúng mức + lô đã chụp trong một snapshot (không theo lô
 * đang gán hiện tại, có thể đã đổi sau sự cố). */
function referenceSets(db: Db, testId: string, reference: NceRunSnapshot) {
  return [...new Map(reference.points.map((p) => [`${p.level}:${p.lot}`, p])).values()].map((p) => {
    const rows = db.prepare('SELECT id,date,run_id,level,lot,val,qc_mean,qc_sd FROM qc_points WHERE test_id=? AND level=? AND lot=? AND voided=0')
      .all(testId, p.level, p.lot) as { id: string; date: string; run_id: string; level: number; lot: string; val: number; qc_mean: number | null; qc_sd: number | null }[];
    return { level: p.level, key: `${p.level}:${p.lot}`, mean: p.mean, sd: p.sd,
      pts: rows.map((row) => ({ ...row, runId: row.run_id, qcMean: row.qc_mean, qcSd: row.qc_sd })).sort(compareQcPointOrder) };
  });
}

function evaluateReference(db: Db, testId: string, reference: NceRunSnapshot, extraCuts: readonly QcCut[] = []) {
  const sets = referenceSets(db, testId, reference);
  return { sets, byPoint: evaluateQcSets(db, testId, sets, new Set(sets.map((s) => s.level)).size, extraCuts) };
}

function verdictOf(flag: CombinedPointFlag | undefined): NceRunPoint['verdict'] {
  return flag && Number.isFinite(flag.z) ? flag.level : 'none';
}

/** Snapshot MỌI điểm của một lần chạy (mọi mức, kể cả đã huỷ hay khác lô).
 * Điểm ngoài tập đang vận hành mang kết luận `none`. `extraCuts` để đánh giá
 * lần rerun trong giai đoạn mới (D-04). */
export function nceRunSnapshot(db: Db, testId: string, run: NceRunKey, extraCuts: readonly QcCut[] = [], reference?: NceRunSnapshot): NceRunSnapshot {
  // Khi kiểm lại bằng chứng đã cho chạy lại, dùng đúng chuỗi lô đã chốt,
  // không dùng lô hiện hành có thể đã đổi. Vẫn đọc giá trị/điểm huỷ hiện tại
  // và tính lại bằng engine chung, không tin verdict đã lưu trong snapshot.
  const { sets, byPoint } = reference ? evaluateReference(db, testId, reference, extraCuts) : evaluate(db, testId, extraCuts);
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
  // Đổi lô không được làm biến mất công việc chưa đóng. Snapshot sự kiện là
  // bằng chứng đã ghi nhận; chỉ bổ sung các điểm còn tồn tại, chưa bị huỷ.
  const known = new Set(out.map((p) => p.pointId));
  const pending = db.prepare(`SELECT r.snapshot_json FROM nce_runs r JOIN nce_records n ON n.id=r.nce_record_id
    WHERE r.role<>'rerun' AND n.status NOT IN ('closed','cancelled')`).all() as { snapshot_json: string }[];
  const livePoint = db.prepare('SELECT id FROM qc_points WHERE id=? AND voided=0');
  for (const row of pending) {
    let snapshot: NceRunSnapshot;
    try { snapshot = JSON.parse(row.snapshot_json) as NceRunSnapshot; } catch { continue; }
    for (const p of snapshot.points ?? []) {
      if (p.verdict !== 'rej' || known.has(p.pointId)) continue;
      const live = livePoint.get(p.pointId);
      if (!live) continue;
      out.push({ pointId: p.pointId, testId: snapshot.testId, level: p.level, lot: p.lot, date: snapshot.date, runId: snapshot.runId, verdict: 'rej', rules: [...p.rules] });
      known.add(p.pointId);
    }
  }
  return out;
}

/** Kết luận từng lần chạy của một xét nghiệm (bị loại hay không), kèm luật
 * nổ và luật làm bằng chứng ở từng mức để lần ngược chuỗi vi phạm nhiều lần
 * chạy (`nceSuspectWindow`). Mặc định theo các mức đang vận hành; có
 * `reference` thì theo đúng mức + lô của snapshot đó (khoảng nghi ngờ tính
 * trên lô đang dùng lúc sự cố, không đổi khi thay lô sau này). */
export function nceRunOutcomes(db: Db, testId: string, extraCuts: readonly QcCut[] = [], reference?: NceRunSnapshot): NceRunOutcome[] {
  const { sets, byPoint } = reference ? evaluateReference(db, testId, reference, extraCuts) : evaluate(db, testId, extraCuts);
  const runs = new Map<string, NceRunOutcome & { marks: NceRunMark[] }>();
  const assessed = new Map<string, Set<number>>();
  for (const set of sets) for (const point of set.pts) {
    const key = qcRunKey(point);
    const run = runs.get(key) ?? { date: point.date, runId: point.run_id, rejected: false, complete: false, marks: [] };
    const flag = byPoint.get(point);
    if (flag?.level === 'rej') run.rejected = true;
    const levels = assessed.get(key) ?? new Set<number>();
    if (flag && Number.isFinite(flag.z)) {
      levels.add(set.level);
      run.marks.push({ level: set.level, rules: [...new Set([...flag.rules, ...flag.supportRules])] });
    }
    assessed.set(key, levels);
    runs.set(key, run);
  }
  return [...runs.entries()].map(([key, run]) => ({ ...run, complete: sets.length > 0 && sets.every((set) => assessed.get(key)?.has(set.level)) }));
}

/** Luật LOẠI BỎ (theo hành động có hiệu lực tại lần chạy khởi đầu — GV2) của
 * các điểm bị loại trong lần chạy đó, và các mức mang luật đó. Luật chỉ cảnh
 * báo không kéo dài khoảng nghi ngờ. */
export function nceSuspectChain(db: Db, testId: string, trigger: NceRunSnapshot): NceSuspectChain {
  const actionOf = testRuleActionOf(db, testId, { date: trigger.date, runId: trigger.runId });
  const rules = new Set<string>(), levels = new Set<number>();
  for (const point of trigger.points) {
    if (point.voided || point.verdict !== 'rej') continue;
    const rejecting = rejectingRules(point.rules, actionOf);
    rejecting.forEach((rule) => rules.add(rule));
    if (rejecting.length) levels.add(point.level);
  }
  return { rules: [...rules].sort(), levels: [...levels].sort((a, b) => a - b) };
}

/** Lần chạy QC mới nhất đang có của xét nghiệm (mọi mức, chưa huỷ). */
export function nceLatestRun(db: Db, testId: string): NceRunKey | null {
  const rows = db.prepare('SELECT DISTINCT date, run_id FROM qc_points WHERE test_id=? AND voided=0').all(testId) as { date: string; run_id: string }[];
  const keys = rows.map((row) => ({ date: row.date, runId: row.run_id }));
  return keys.sort((a, b) => compareQcPointOrder({ date: a.date, run_id: a.runId }, { date: b.date, run_id: b.runId })).at(-1) ?? null;
}

/** Các mức đang vận hành — mức phải có trong lần chạy xác minh của hồ sơ không phải IQC. */
export function nceOperationalLevels(db: Db, testId: string): number[] {
  return listOperationalLevels(db, testId).map((level) => level.level);
}

/** Hàng chờ NCE theo lần chạy (D-01, D-14): lần chạy bị loại chưa thuộc hồ sơ
 * đã đóng. Dùng chung cho trang NCE và cổng khoá kỳ (GV4). */
export function nceQueueRows(db: Db): NceQueueRow[] {
  const records = db.prepare('SELECT id, nce_id, status, test_id FROM nce_records WHERE test_id IS NOT NULL').all() as { id: string; nce_id: string; status: NceStatus; test_id: string }[];
  const runs = db.prepare("SELECT nce_record_id, date, run_id FROM nce_runs WHERE role<>'rerun'").all() as { nce_record_id: string; date: string; run_id: string }[];
  const runsByRecord = new Map<string, NceRunKey[]>();
  for (const run of runs) runsByRecord.set(run.nce_record_id, [...(runsByRecord.get(run.nce_record_id) ?? []), { date: run.date, runId: run.run_id }]);
  return buildNceQueue(nceRejectedPoints(db), records.map((r) => ({ id: r.id, nceId: r.nce_id, status: r.status, testId: r.test_id, runs: runsByRecord.get(r.id) ?? [] })));
}
