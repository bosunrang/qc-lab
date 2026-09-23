import type { Db } from './sqlite-like';
import type { ArchivedBlock } from '../../shared/qc-api';
import { listPreviousLotSeriesData } from './lot-lineage';
import { evaluateQcSets } from './westgard-evaluation';
import { acceptedRunPoints, rejectedLevelsByRun, pointTarget } from '../domain/westgard-engine';
import { errorTypeDetail } from '../domain/westgard-rules';
import { compareQcPointOrder, qcRunKey } from '../domain/sort-order';

export function createHistoricalWestgard(db: Db) {
  /** Mean/SD của 1 LÔ CỤ THỂ cho 1 mức — dùng cho tab "Nhóm lô đã dừng/lưu
   * trữ": lô hiện ĐANG gán (`test_levels.qc_lot_id`) thì đọc cột hiện hành;
   * lô đã bị THAY (không còn là lô đang gán) thì tra lại đúng mốc lịch sử
   * của NÓ trong `mean_sd_history_json` (mỗi lần đổi lô đều chốt 1 mốc kèm
   * `qcLotId`, xem `saveTestLevel()`/2 cascade chuyển lô). Không tìm được ở
   * cả hai nơi thì trả `null` — lô đó chưa từng có Mean/SD hợp lệ cho mức
   * này (vd lô được tạo nhưng chưa từng gán cho xét nghiệm nào). */
  function lotMeanSd(testId: string, level: number, lotId: string): { mean: number; sd: number } | null {
    const levelRow = db.prepare('SELECT qc_lot_id, mean, sd, mean_sd_history_json FROM test_levels WHERE test_id=? AND level=?').get(testId, level) as
      { qc_lot_id: string | null; mean: number | null; sd: number | null; mean_sd_history_json: string } | undefined;
    if (levelRow?.qc_lot_id === lotId && levelRow.mean != null && levelRow.sd != null) return { mean: levelRow.mean, sd: levelRow.sd };
    try {
      const history = JSON.parse(levelRow?.mean_sd_history_json || '[]') as { qcLotId: string; mean: number | null; sd: number | null }[];
      const entry = [...history].reverse().find(h => h.qcLotId === lotId && h.mean != null && h.sd != null);
      if (entry) return { mean: entry.mean as number, sd: entry.sd as number };
    } catch { /* ignore */ }
    const snap = db.prepare('SELECT qc_mean,qc_sd FROM qc_points WHERE test_id=? AND level=? AND lot=(SELECT lot_no FROM qc_lots WHERE id=?) AND qc_mean IS NOT NULL AND qc_sd>0 ORDER BY date DESC,rowid DESC LIMIT 1').get(testId, level, lotId) as { qc_mean: number; qc_sd: number } | undefined;
    return snap ? { mean: snap.qc_mean, sd: snap.qc_sd } : null;
  }

  /** Toàn bộ lô của 1 nhóm lô đã dừng/lưu trữ — nhóm "Đã lưu trữ" (do CHẤP
   * NHẬN chuyển tiếp lô tạo ra) giữ ẢNH CHỤP thành viên CŨ ở
   * `archived_lot_ids_json` (xem config-handlers.ts), KHÁC `qc_lots.group_id`
   * SỐNG — phải gộp cả hai nguồn, không chỉ đọc `group_id`. */
  function lotsOfArchivedGroup(groupId: string): { id: string; lot_no: string; level: number }[] {
    const group = db.prepare('SELECT archived_lot_ids_json FROM lot_groups WHERE id=?').get(groupId) as { archived_lot_ids_json: string } | undefined;
    if (!group) return [];
    const byId = new Map<string, { id: string; lot_no: string; level: number }>();
    for (const lot of db.prepare('SELECT id, lot_no, level FROM qc_lots WHERE group_id=?').all(groupId) as { id: string; lot_no: string; level: number }[]) byId.set(lot.id, lot);
    if (group.archived_lot_ids_json) {
      try {
        for (const id of JSON.parse(group.archived_lot_ids_json) as string[]) {
          if (byId.has(id)) continue;
          const lot = db.prepare('SELECT id, lot_no, level FROM qc_lots WHERE id=?').get(id) as { id: string; lot_no: string; level: number } | undefined;
          if (lot) byId.set(id, lot);
        }
      } catch { /* ignore */ }
    }
    return [...byId.values()];
  }

  /** Xét nghiệm nào từng dùng ÍT NHẤT 1 lô của nhóm này — port điều kiện chọn
   * xét nghiệm trong tab "Nhóm lô đã dừng" app cũ (chỉ hiện xét nghiệm có dữ
   * liệu thật để phân tích, không phải mọi xét nghiệm trong hệ thống). */
  function listArchivedGroupTests(groupId: string): { id: string; label: string }[] {
    const lotIds = new Set(lotsOfArchivedGroup(groupId).map(l => l.id));
    if (!lotIds.size) return [];
    const rows = db.prepare(`
      SELECT tl.test_id as test_id, tl.qc_lot_id as qc_lot_id, tl.mean_sd_history_json as history, t.name as name
      FROM test_levels tl JOIN tests t ON t.id = tl.test_id
    `).all() as { test_id: string; qc_lot_id: string | null; history: string; name: string }[];
    const matched = new Map<string, string>();
    for (const row of rows) {
      let hit = !!(row.qc_lot_id && lotIds.has(row.qc_lot_id));
      if (!hit) {
        try { hit = (JSON.parse(row.history || '[]') as { qcLotId: string }[]).some(h => lotIds.has(h.qcLotId)); } catch { /* ignore */ }
      }
      if (hit) matched.set(row.test_id, row.name);
    }
    return [...matched.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }

  /** Phân tích Westgard THẬT cho 1 xét nghiệm trong 1 nhóm lô đã dừng/lưu
   * trữ — port `wgLotBlockModel()` app cũ: TÍNH LẠI theo bộ luật đang bật
   * HIỆN NAY (không phải cấu hình luật tại thời điểm nhóm lô còn hoạt động —
   * đúng hint app cũ hiện ngay trên trang), dùng Mean/SD ĐÃ CHỐT của đúng lô
   * đó (không phải Mean/SD hiện hành của mức, vốn có thể đã đổi sang lô
   * khác). Trước đây tab này chỉ liệt kê Số lô/Mức/Hạn dùng — không có
   * verdict/luật/biểu đồ nào, tức "phân tích Westgard" chưa từng tồn tại ở
   * đây dù đúng là tên trang. */
  function analyzeHistoricalLots(testId: string, lots: { id: string; lot_no: string; level: number }[]): ArchivedBlock[] {
    const archived = lots.flatMap((lot) => {
      const target = lotMeanSd(testId, lot.level, lot.id);
      if (!target) return [];
      const rows = db.prepare('SELECT id, date, run_id, val, qc_mean, qc_sd FROM qc_points WHERE test_id=? AND level=? AND lot=? AND voided=0 ORDER BY date, run_id')
        .all(testId, lot.level, lot.lot_no) as { id: string; date: string; run_id: string; val: number; qc_mean: number | null; qc_sd: number | null }[];
      const points = rows.map(row => ({ ...row, runId: row.run_id, qcMean: row.qc_mean, qcSd: row.qc_sd })).sort(compareQcPointOrder);
      return [{ lot, target, points }];
    });
    // Không được gọi `westgard()` theo từng block ở đây: như vậy R4s/2-2s/
    // 2of3-2s/3-1s của CÙNG nhóm lô bị mất khỏi lịch sử. Dùng đúng đường
    // đánh giá ghép như dữ liệu đang vận hành rồi chỉ tách kết quả để vẽ UI.
    // Scope phải dựa trên toàn bộ mức được lưu trong nhóm, kể cả mức chưa
    // tìm được Mean/SD để đánh giá. Nếu bỏ mức đó trước khi đếm, luật `both`
    // có thể bị đổi âm thầm thành `within` chỉ trên tab lịch sử.
    const historicalSets = archived.map(item => ({ level: item.lot.level, key: `${item.lot.level}:${item.lot.id}`, pts: item.points, mean: item.target.mean, sd: item.target.sd }));
    const byPoint = evaluateQcSets(db, testId, historicalSets, new Set(lots.map(lot => lot.level)).size);
    const accepted = acceptedRunPoints(byPoint);
    // Lý do một điểm bị loại theo LẦN CHẠY, không chỉ cờ bị/không bị. Cùng
    // trường mà `entry:queryPoints` trả, để tab "Xem lô cũ" nói được y hệt
    // chuỗi đang vận hành thay vì chỉ lặng lẽ bớt điểm khỏi thống kê.
    const rejectedBy = rejectedLevelsByRun(historicalSets, byPoint);
    const blocks = archived.map((item) => {
      const points = item.points.map((point) => {
        const flag = byPoint.get(point)!;
        const detail = errorTypeDetail(flag.rules);
        return { id: point.id, date: point.date, runId: point.run_id, val: point.val, z: flag.z, verdict: flag.level, rules: flag.rules, cusumSignal: null, supportRules: flag.supportRules, accepted: accepted.has(point), runRejected: !accepted.has(point), runRejectedBy: rejectedBy.get(qcRunKey(point)) || [], targetMean: pointTarget(point, item.target.mean, item.target.sd).mean, targetSd: pointTarget(point, item.target.mean, item.target.sd).sd, errorType: detail.type, errorDesc: detail.desc };
      });
      return { level: item.lot.level, lotId: item.lot.id, lotNo: item.lot.lot_no, mean: item.target.mean, sd: item.target.sd, analysis: { points, cusum: { cPos: [], cNeg: [], flags: [], k: 0.5, h: 4, ma: [] }, cusumOn: false } };
    });
    blocks.sort((a, b) => a.level - b.level);
    return blocks;
  }

  function listArchivedBlocks(testId: string, groupId: string): ArchivedBlock[] {
    return analyzeHistoricalLots(testId, lotsOfArchivedGroup(groupId));
  }

  /** Cùng bộ đánh giá lịch sử cho cả hai cách xem lô cũ. Nhóm snapshot lưu
   * trữ được ưu tiên vì group_id hiện hành có thể đã đổi sau chuyển tiếp. */
  function listPreviousLotBlocks(testId: string): ArchivedBlock[] {
    const previous = listPreviousLotSeriesData(db, testId);
    const snapshots = db.prepare("SELECT id,archived_lot_ids_json FROM lot_groups WHERE active=0 ORDER BY rowid DESC").all() as { id: string; archived_lot_ids_json: string }[];
    const cache = new Map<string, ArchivedBlock[]>();
    return previous.flatMap(series => {
      const archivedGroup = snapshots.find(group => {
        try { const ids: unknown = JSON.parse(group.archived_lot_ids_json || '[]'); return Array.isArray(ids) && ids.includes(series.lotId); } catch { return false; }
      });
      const lot = db.prepare('SELECT group_id FROM qc_lots WHERE id=?').get(series.lotId) as { group_id: string | null } | undefined;
      const groupId = archivedGroup?.id || lot?.group_id;
      if (!groupId) return analyzeHistoricalLots(testId, [{ id: series.lotId, lot_no: series.lot, level: series.level }]).map(block => ({ ...block, analysis: { ...block.analysis, evaluationNote: 'Không xác định được nhóm lô lịch sử; chưa đủ dữ liệu đối chiếu luật liên mức.' } }));
      if (!cache.has(groupId)) cache.set(groupId, listArchivedBlocks(testId, groupId));
      return cache.get(groupId)!.filter(block => block.lotId === series.lotId);
    });
  }

  return { listArchivedBlocks, listArchivedGroupTests, listPreviousLotBlocks };
}
