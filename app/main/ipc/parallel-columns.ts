// Cột lô song song của Nhập QC: lô mới của hồ sơ chuyển tiếp đang chạy song
// song, đánh giá theo Mean/SD ứng viên. Dùng chung cho trang Nhập QC và cổng
// chấp nhận lô mới (`config-lot-handlers.ts`, N12), để cổng đếm đúng các kết
// quả mà người dùng thấy trên cột song song.
import type { Db } from '../db/sqlite-like';
import { countOperationalLevels } from '../db/operational-levels';
import { evaluateQcSets } from '../db/westgard-evaluation';
import { acceptedRunPoints, rejectedLevelsByRun } from '../domain/westgard-engine';
import { compareQcPointOrder, qcRunKey } from '../domain/sort-order';
import type { ParallelEntryColumn } from '../../shared/qc-api';
import type { ActivePoint } from './active-evaluation';

export type TransitionCriterion = { testId: string; level: number; mean: number; sd: number; low?: number | null; high?: number | null };

export function pointsForLot(db: Db, testId: string, level: number, lot: string): ActivePoint[] {
  const rows = db.prepare('SELECT * FROM qc_points WHERE test_id=? AND level=? AND voided=0 AND lot=? ORDER BY date,run_id')
    .all(testId, level, lot) as unknown as Omit<ActivePoint, 'runId' | 'qcMean' | 'qcSd'>[];
  return rows.map((point) => ({ ...point, runId: point.run_id, qcMean: point.qc_mean, qcSd: point.qc_sd })).sort(compareQcPointOrder);
}

/** Cột lô song song chỉ nhận hồ sơ active, đúng Panel chứa xét nghiệm, lô
 * cũ vẫn đang gán và criteria có Mean/SD hợp lệ. Mỗi mức lấy hồ sơ khớp đầu tiên.
 *
 * `override`: Mean/SD ứng viên đang được lưu cùng lúc với việc chấp nhận lô,
 * dùng thay cho bản đã lưu của đúng hồ sơ đó. */
export function listParallelColumns(db: Db, testId: string, override?: { transitionId: string; criteria: readonly TransitionCriterion[] }): ParallelEntryColumn[] {
  const test = db.prepare('SELECT rule_actions_json,rule_scopes_json FROM tests WHERE id=?').get(testId) as { rule_actions_json: string; rule_scopes_json: string } | undefined;
  if (!test) return [];
  // Phạm vi within/across phải giống MỌI endpoint khác của xét nghiệm này,
  // nên đếm mức ĐANG VẬN HÀNH chứ không phải mọi dòng `test_levels`.
  const levelCount = countOperationalLevels(db, testId);
  const rows = db.prepare(`SELECT tr.id transition_id,tr.start_date,tr.criteria_json,tl.level,
      ql.id lot_id,ql.lot_no,ql.exp
    FROM lot_transitions tr
    JOIN qc_panel_tests pt ON pt.panel_id=tr.panel_id AND pt.test_id=?
    JOIN test_levels tl ON tl.test_id=pt.test_id AND tl.qc_lot_id=tr.from_lot_id
    JOIN qc_lots ql ON ql.id=tr.to_lot_id AND ql.level=tl.level
    WHERE tr.status='active' ORDER BY tr.rowid`)
    .all(testId) as { transition_id: string; start_date: string; criteria_json: string; level: number; lot_id: string; lot_no: string; exp: string }[];
  const seen = new Set<number>();
  const columns: { row: typeof rows[number]; target: { mean: number; sd: number; low?: number | null; high?: number | null }; pts: ActivePoint[] }[] = [];
  for (const row of rows) {
    if (seen.has(row.level)) continue;
    let criteria: readonly TransitionCriterion[] = [];
    if (override && override.transitionId === row.transition_id) criteria = override.criteria;
    else try { const parsed = JSON.parse(row.criteria_json || '[]'); if (Array.isArray(parsed)) criteria = parsed; } catch { /* hồ sơ hỏng không tạo cột nhập */ }
    const target = criteria.find((item) => item.testId === testId && Number(item.level) === row.level && Number.isFinite(Number(item.mean)) && Number(item.sd) > 0);
    if (!target) continue;
    columns.push({ row, target: { ...target, mean: Number(target.mean), sd: Number(target.sd) }, pts: pointsForLot(db, testId, row.level, row.lot_no) });
    seen.add(row.level);
  }
  if (!columns.length) return [];
  // Đánh giá CẢ BỘ cột song song qua cùng một đường với chuỗi đang vận hành
  // và tab lô lịch sử. Bản trước gọi `westgardByPoint()` cho TỪNG cột, tức
  // chỉ kênh trong-mức: hai mức của lô mới đo cùng một lần chạy mà một mức
  // +2,5SD còn mức kia −2,5SD thì R4s/2-2s liên mức không bao giờ nổ, và
  // mốc "đã khắc phục xong" cũng không được áp. Lô đang chạy thẩm định là
  // lúc CẦN bắt sai số ngẫu nhiên lớn nhất, không phải lúc nới cổng.
  //
  // Chỉ gộp các cột song song với NHAU: chúng là các mức của cùng một lô
  // mới trong cùng lần chạy. Không trộn với lô đang vận hành — đó là hai
  // dòng dữ liệu khác nhau, kết luận thẩm định lô mới không được lẫn với
  // kết luận thường quy.
  const parallelSets = columns.map((column) => ({ level: column.row.level, key: `${column.row.level}:${column.row.lot_no}`, pts: column.pts, mean: column.target.mean, sd: column.target.sd }));
  const byPoint = evaluateQcSets(db, testId, parallelSets, levelCount);
  const accepted = acceptedRunPoints(byPoint);
  const rejectedBy = rejectedLevelsByRun(parallelSets, byPoint);
  return columns.map(({ row, target, pts }) => ({
    transitionId: row.transition_id, level: row.level, lotId: row.lot_id, lot: row.lot_no, startDate: row.start_date,
    mean: target.mean, sd: target.sd, low: target.low ?? null, high: target.high ?? null, exp: row.exp || '',
    points: pts.map((point) => {
      const flag = byPoint.get(point);
      return { ...point, verdict: flag?.level || 'ok', rules: flag?.rules || [], accepted: accepted.has(point), runRejectedBy: rejectedBy.get(qcRunKey(point)) || [] };
    }),
  }));
}
