// Kết luận Westgard của điểm QC thuộc lô KHÔNG còn vận hành: chuỗi lô cũ đã
// chuyển tiếp, rồi các nhóm lô dừng thủ công (không nằm trên chuỗi chuyển
// tiếp). Đây là nguồn chung cho báo cáo chi tiết, biên bản tháng và cổng huỷ
// điểm: cùng một điểm phải mang cùng một kết luận ở mọi nơi, và việc ngừng
// dùng một nhóm lô không được làm điểm đã đánh giá thành "chưa đánh giá".
import type { Db } from '../db/sqlite-like';
import type { ArchivedBlock, LevelAnalysis } from '../../shared/qc-api';
import { createHistoricalWestgard } from '../db/historical-westgard';
import { previousLotsOf } from './previous-lot-cache';

export type HistoricalPointEvaluation = LevelAnalysis['points'][number] & Pick<ArchivedBlock, 'level' | 'lotNo'>;

/** Kết luận theo `id` cho các điểm `rows` (chưa huỷ) của một xét nghiệm.
 * Điểm không thuộc lô cũ nào thì không có trong kết quả. Dựng lô cũ tốn kém
 * nên dừng ngay khi đã phủ hết `rows`; nhóm dừng thủ công chỉ đọc nhóm chứa
 * lô còn thiếu. */
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
  const lots = (db.prepare('SELECT id,group_id,lot_no,level FROM qc_lots').all() as { id: string; group_id: string | null; lot_no: string; level: number }[])
    .filter((lot) => lotKeys.has(`${lot.level}\u0000${lot.lot_no}`));
  if (!lots.length) return out;
  const lotIds = new Set(lots.map((lot) => lot.id)), groups = new Set(lots.map((lot) => lot.group_id));
  const archived = createHistoricalWestgard(db);
  const candidates = db.prepare("SELECT id,archived_lot_ids_json FROM lot_groups WHERE active=0 OR status='stopped' ORDER BY rowid DESC").all() as { id: string; archived_lot_ids_json: string }[];
  for (const group of candidates) {
    let matches = groups.has(group.id);
    if (!matches) try {
      const ids: unknown = JSON.parse(group.archived_lot_ids_json || '[]');
      matches = Array.isArray(ids) && ids.some((id) => lotIds.has(id));
    } catch { /* Nhóm không có ảnh chụp hợp lệ vẫn tra được qua group_id. */ }
    if (matches) readBlocks(archived.listArchivedBlocks(testId, group.id));
    if (covered()) break;
  }
  return out;
}
