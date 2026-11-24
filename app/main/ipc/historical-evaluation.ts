// Kết luận Westgard của điểm QC thuộc lô KHÔNG còn vận hành: chuỗi lô cũ đã
// chuyển tiếp, rồi các nhóm còn chứa dữ liệu lịch sử (kể cả nhóm vẫn đang
// vận hành ở mức khác). Đây là nguồn chung cho báo cáo chi tiết, biên bản
// tháng và cổng huỷ điểm: cùng một điểm phải mang cùng một kết luận ở mọi nơi, và việc ngừng
// dùng một nhóm lô không được làm điểm đã đánh giá thành "chưa đánh giá".
import type { Db } from '../db/sqlite-like';
import type { ArchivedBlock, LevelAnalysis } from '../../shared/qc-api';
import { createHistoricalWestgard } from '../db/historical-westgard';
import { previousLotsOf } from './previous-lot-cache';
import { qcRunKey } from '../domain/sort-order';

export type HistoricalPointEvaluation = LevelAnalysis['points'][number] & Pick<ArchivedBlock, 'level' | 'lotNo'>;

/** Kết luận theo `id` cho các điểm `rows` (chưa huỷ) của một xét nghiệm.
 * Khi một mức đã đổi lô, các mức còn lại của CÙNG lần chạy cũng phải lấy
 * kết luận trong ngữ cảnh nhóm cũ. Không lấy kết luận thiếu mức của tập đang
 * vận hành áp lại cho lần chạy lịch sử. Chỉ trả điểm thuộc `rows`. */
export function historicalPointEvaluations(
  db: Db, testId: string, rows: readonly { id: string; level: number; lot: string }[],
): Map<string, HistoricalPointEvaluation> {
  const out = new Map<string, HistoricalPointEvaluation>();
  const needed = new Set(rows.map((row) => row.id));
  if (!needed.size) return out;
  const covered = () => out.size >= needed.size;
  const readBlocks = (blocks: readonly ArchivedBlock[]) => {
    for (const block of blocks) for (const point of block.analysis.points) {
      if (needed.has(point.id) && !out.has(point.id)) out.set(point.id, { ...point, level: block.level, lotNo: block.lotNo });
    }
  };
  readBlocks(previousLotsOf(db, testId).blocks);
  if (covered()) return out;
  const lotKeys = new Set(rows.filter((row) => !out.has(row.id)).map((row) => `${row.level}\u0000${row.lot}`));
  const allLots = db.prepare('SELECT id,group_id,lot_no,level FROM qc_lots').all() as { id: string; group_id: string | null; lot_no: string; level: number }[];
  const lots = allLots.filter((lot) => lotKeys.has(`${lot.level}\u0000${lot.lot_no}`));
  if (!lots.length) return out;
  const lotIds = new Set(lots.map((lot) => lot.id)), groups = new Set(lots.map((lot) => lot.group_id));
  const archived = createHistoricalWestgard(db);
  const levels = db.prepare('SELECT level,qc_lot_id,mean_sd_history_json FROM test_levels WHERE test_id=?').all(testId) as
    { level: number; qc_lot_id: string | null; mean_sd_history_json: string }[];
  const currentLots = new Map(levels.map((row) => [row.level, row.qc_lot_id]));
  const replacedLots = new Set<string>();
  for (const level of levels) try {
    const history: unknown = JSON.parse(level.mean_sd_history_json || '[]');
    if (Array.isArray(history)) for (const item of history) {
      if (item && typeof item.qcLotId === 'string') replacedLots.add(item.qcLotId);
    }
  } catch { /* Mốc hỏng không được dùng làm bằng chứng đã đổi lô. */ }
  const replaced = (level: number, lotId: string) => currentLots.get(level) !== lotId
    && (!!currentLots.get(level) || replacedLots.has(lotId));
  const hasPoints = db.prepare('SELECT 1 FROM qc_points WHERE test_id=? AND level=? AND lot=? AND voided=0 LIMIT 1');
  const candidates = db.prepare('SELECT id,active,status,archived_lot_ids_json FROM lot_groups ORDER BY active, rowid DESC').all() as
    { id: string; active: number; status: string; archived_lot_ids_json: string }[];
  for (const group of candidates) {
    const members = new Set(allLots.filter((lot) => lot.group_id === group.id).map((lot) => lot.id));
    try {
      const ids: unknown = JSON.parse(group.archived_lot_ids_json || '[]');
      if (Array.isArray(ids)) for (const id of ids) if (typeof id === 'string') members.add(id);
    } catch { /* Nhóm không có ảnh chụp hợp lệ vẫn tra được qua group_id. */ }
    if (!groups.has(group.id) && ![...members].some((id) => lotIds.has(id))) continue;
    const inactive = !group.active || group.status === 'stopped' || group.status === 'planned';
    // Nhóm vẫn chạy chỉ cần tính lại khi có lô của chính xét nghiệm đã bị
    // thay và còn điểm. Lô dự phòng chưa dùng không tạo ngữ cảnh lịch sử.
    if (!inactive && !allLots.some((lot) => members.has(lot.id) && replaced(lot.level, lot.id)
      && hasPoints.get(testId, lot.level, lot.lot_no))) continue;
    const blocks = archived.listArchivedBlocks(testId, group.id);
    const historicalRuns = new Set(blocks.flatMap((block) => inactive || replaced(block.level, block.lotId)
      ? block.analysis.points.map(qcRunKey) : []));
    for (const block of blocks) for (const point of block.analysis.points) {
      if (needed.has(point.id) && !out.has(point.id) && historicalRuns.has(qcRunKey(point))) {
        out.set(point.id, { ...point, level: block.level, lotNo: block.lotNo });
      }
    }
    if (covered()) break;
  }
  return out;
}
