// Nguồn kết luận dùng chung cho báo cáo và lịch sử dữ liệu QC.
import type { Db } from '../db/sqlite-like';
import type { ReportPointRow } from '../../shared/qc-api';
import { acceptedRunPoints, pointTarget, rejectedLevelsByRun } from '../domain/westgard-engine';
import { qcRunKey } from '../domain/sort-order';
import { activeEvaluationOf } from './active-evaluation';
import { historicalPointEvaluations } from './historical-evaluation';
import { listParallelColumns } from './parallel-columns';

type PointEvaluation = Pick<ReportPointRow, 'target_mean' | 'target_sd' | 'z' | 'verdict' | 'rules' | 'accepted' | 'run_rejected_by'>;

/** Giữ ngữ cảnh đầy đủ của chuỗi Westgard rồi mới chọn điểm trong báo cáo.
 * Không đánh giá lại chuỗi đã cắt ngày, không lấy Mean/SD lô hiện tại áp
 * cho lô cũ. Các nguồn đúng như Nhập QC và hai tab Phân tích Westgard. */
export function pointEvaluationsOf(db: Db, testId: string, rows: readonly Pick<ReportPointRow, 'id' | 'level' | 'lot'>[]): Map<string, PointEvaluation> {
  const out = new Map<string, PointEvaluation>();
  const needed = new Set(rows.map((point) => point.id));
  if (!needed.size) return out;
  const covered = () => [...needed].every((id) => out.has(id));
  const active = activeEvaluationOf(db, testId);
  const accepted = acceptedRunPoints(active.byPoint);
  const rejectedBy = rejectedLevelsByRun(active.levels, active.byPoint);
  for (const level of active.levels) for (const point of level.pts) {
    if (!needed.has(point.id)) continue;
    const flag = active.byPoint.get(point);
    if (!flag || level.mean === null || level.sd === null) continue;
    const target = pointTarget(point, level.mean, level.sd);
    out.set(point.id, {
      target_mean: target.mean, target_sd: target.sd, z: Number.isFinite(flag.z) ? flag.z : null,
      verdict: flag.level, rules: [...flag.rules], accepted: accepted.has(point),
      run_rejected_by: rejectedBy.get(qcRunKey(point)) || [],
    });
  }
  if (!covered()) for (const column of listParallelColumns(db, testId)) for (const point of column.points) {
    if (!needed.has(point.id) || out.has(point.id)) continue;
    const target = pointTarget({ val: point.val, qcMean: point.qc_mean, qcSd: point.qc_sd }, column.mean, column.sd);
    out.set(point.id, {
      target_mean: target.mean, target_sd: target.sd, z: Number.isFinite(target.z) ? target.z : null,
      verdict: point.verdict, rules: [...point.rules], accepted: point.accepted === true,
      run_rejected_by: point.runRejectedBy || [],
    });
  }
  if (!covered()) {
    for (const [id, point] of historicalPointEvaluations(db, testId, rows)) {
      out.set(id, {
        target_mean: point.targetMean, target_sd: point.targetSd, z: Number.isFinite(point.z) ? point.z : null,
        verdict: point.verdict, rules: [...point.rules], accepted: point.accepted,
        run_rejected_by: point.runRejectedBy || [],
      });
    }
  }
  return out;
}
