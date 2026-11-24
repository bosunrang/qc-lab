// Chuỗi LÔ CŨ của từng mức QC — nguồn DUY NHẤT cho trang Nhập QC
// (`ipc/entry-handlers.ts`) và trang Phân tích Westgard
// (`ipc/westgard-handlers.ts`), cùng lý do `db/operational-levels.ts` tồn tại:
// hai trang cùng cho người dùng bấm "Xem lô cũ" thì phải thấy CÙNG một lô và
// CÙNG một Mean/SD, nếu không lại sinh đúng lớp lệch giữa hai màn hình mà đợt
// 11/09 vừa đi gỡ.
//
// Ở đây CHỈ chọn dữ liệu (lô nào, Mean/SD nào, điểm nào). Việc chạy luật
// Westgard và dựng hình dạng trả về là của từng handler, vì hai trang cần hai
// hợp đồng khác nhau (Nhập QC cần `QcPointView`, Westgard cần bảng 7 cột kèm
// z/bằng chứng/loại sai số).
import type { Db } from './sqlite-like';
import { listOperationalLevels } from './operational-levels';
import { compareQcPointOrder } from '../domain/sort-order';

/** Điểm QC kèm 3 trường đã đổi tên cho khớp `QcPointLike` của engine. */
export type LineagePoint = Record<string, unknown> & {
  id: string; date: string; run_id: string; val: number;
  runId: string; qcMean: number | null; qcSd: number | null;
};

export interface PreviousLotMetadata {
  level: number;
  lotId: string;
  lot: string;
  mean: number;
  sd: number;
}

export interface PreviousLotSeriesData extends PreviousLotMetadata {
  points: LineagePoint[];
}

export function previousLotPoints(db: Db, testId: string, level: number, lot: string, from = '', to = '\uffff'): LineagePoint[] {
  const rows = db.prepare('SELECT * FROM qc_points WHERE test_id=? AND level=? AND voided=0 AND lot=? AND date BETWEEN ? AND ?')
    .all(testId, level, lot, from, to) as unknown as (LineagePoint & { qc_mean: number | null; qc_sd: number | null })[];
  return rows
    .map((point) => ({ ...point, runId: point.run_id, qcMean: point.qc_mean, qcSd: point.qc_sd }))
    .sort(compareQcPointOrder);
}

/** Các lô cũ nằm trên đúng chuỗi chuyển tiếp ĐÃ CHẤP NHẬN dẫn tới lô đang vận
 * hành của mỗi mức, gần nhất trước. KHÔNG liệt kê mọi lô cùng nhóm — chúng có
 * thể chưa từng được dùng cho xét nghiệm này.
 *
 * Mean/SD ưu tiên mốc đã chốt trong `test_levels.mean_sd_history_json` của
 * đúng lô đó; snapshot `qc_mean`/`qc_sd` trên điểm là fallback cho dữ liệu đã
 * nhập trước khi lịch sử được hoàn thiện. Lô không tra được Mean/SD hợp lệ,
 * hoặc không còn điểm nào, bị bỏ qua — không có gì để vẽ. */
export function listPreviousLotMetadata(db: Db, testId: string): PreviousLotMetadata[] {
  const out: PreviousLotMetadata[] = [];
  const hasPoints = db.prepare('SELECT 1 FROM qc_points WHERE test_id=? AND level=? AND lot=? AND voided=0 LIMIT 1');
  const snapshotDays = db.prepare(`SELECT MAX(date) AS date FROM qc_points
    WHERE test_id=? AND level=? AND lot=? AND voided=0 AND qc_mean IS NOT NULL AND qc_sd>0`);
  const snapshots = db.prepare(`SELECT date,run_id,qc_mean,qc_sd FROM qc_points
    WHERE test_id=? AND level=? AND lot=? AND voided=0 AND qc_mean IS NOT NULL AND qc_sd>0 AND date=?`);
  const transitionFor = db.prepare(`SELECT tr.from_lot_id
    FROM lot_transitions tr JOIN qc_panel_tests pt ON pt.panel_id=tr.panel_id AND pt.test_id=?
    WHERE tr.to_lot_id=? AND tr.status='accepted'
    ORDER BY tr.approved_at DESC,tr.rowid DESC LIMIT 1`);
  const lotById = db.prepare('SELECT id,lot_no,level FROM qc_lots WHERE id=?');
  for (const config of listOperationalLevels(db, testId)) {
    if (!config.qc_lot_id) continue;
    const historyRow = db.prepare('SELECT mean_sd_history_json FROM test_levels WHERE test_id=? AND level=?')
      .get(testId, config.level) as { mean_sd_history_json: string } | undefined;
    let history: { qcLotId?: string; mean?: number | null; sd?: number | null }[] = [];
    try {
      const parsed = JSON.parse(historyRow?.mean_sd_history_json || '[]');
      if (Array.isArray(parsed)) history = parsed;
    } catch { /* bỏ mốc hỏng */ }

    let currentLotId: string | null = config.qc_lot_id;
    // `seen` chặn vòng lặp vô hạn nếu dữ liệu chuyển tiếp bị nối thành vòng.
    const seen = new Set<string>();
    while (currentLotId && !seen.has(currentLotId)) {
      seen.add(currentLotId);
      const transition = transitionFor.get(testId, currentLotId) as { from_lot_id: string } | undefined;
      if (!transition) break;
      const previous = lotById.get(transition.from_lot_id) as
        { id: string; lot_no: string; level: number } | undefined;
      if (!previous || previous.level !== config.level) break;
      currentLotId = previous.id;

      if (!hasPoints.get(testId, config.level, previous.lot_no)) continue;
      const saved = [...history].reverse().find((item) => item.qcLotId === previous.id && item.mean != null && item.sd != null && Number(item.sd) > 0);
      let mean = Number(saved?.mean);
      let sd = Number(saved?.sd);
      if (!saved) {
        // Dữ liệu cũ có thể chỉ có Mean/SD chốt trên điểm. Chỉ đọc ảnh
        // chụp ngày cuối có dải hợp lệ, vẫn xếp mã lần chạy theo số.
        const latest = snapshotDays.get(testId, config.level, previous.lot_no) as { date: string | null };
        if (!latest.date) continue;
        const rows = snapshots.all(testId, config.level, previous.lot_no, latest.date) as
          { date: string; run_id: string; qc_mean: number; qc_sd: number }[];
        const snap = rows.sort(compareQcPointOrder).at(-1);
        mean = Number(snap?.qc_mean);
        sd = Number(snap?.qc_sd);
      }
      if (Number.isFinite(mean) && Number.isFinite(sd) && sd > 0) {
        out.push({ level: config.level, lotId: previous.id, lot: previous.lot_no, mean, sd });
      }
    }
  }
  return out;
}

export function listPreviousLotSeriesData(db: Db, testId: string): PreviousLotSeriesData[] {
  return listPreviousLotMetadata(db, testId).map(lot => ({
    ...lot, points: previousLotPoints(db, testId, lot.level, lot.lot),
  }));
}

