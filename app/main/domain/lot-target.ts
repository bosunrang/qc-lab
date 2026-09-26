// Mean/SD đã có của một mức QC cho MỘT lô cụ thể (kế hoạch kiến trúc C.1,
// tách khỏi `ipc/config-lot-handlers.ts`). Hàm thuần: chỉ đọc hàng
// `test_levels` truyền vào, không truy vấn CSDL.

export interface LotTargetLevel {
  qc_lot_id?: string | null; mean: number | null; sd: number | null; low: number | null; high: number | null;
  mean_sd_history_json?: string | null;
}
export interface LotTarget { mean: number; sd: number; low: number | null; high: number | null }

/** Mức đang dùng đúng lô này thì lấy Mean/SD hiện hành; nếu không, tìm NGƯỢC
 * trong lịch sử Mean/SD của mức (nhóm lô từng dùng rồi quay lại). */
export function lotTargetSnapshot(level: LotTargetLevel, lotId: string): LotTarget | null {
  const finite = (value: unknown) => Number.isFinite(Number(value));
  if (level.qc_lot_id === lotId && finite(level.mean) && finite(level.sd)) {
    return { mean: Number(level.mean), sd: Number(level.sd), low: level.low, high: level.high };
  }
  let history: { qcLotId?: string; mean?: number | null; sd?: number | null; low?: number | null; high?: number | null }[] = [];
  try { const parsed = JSON.parse(level.mean_sd_history_json || '[]'); if (Array.isArray(parsed)) history = parsed; } catch { history = []; }
  const found = [...history].reverse().find(entry => entry.qcLotId === lotId && finite(entry.mean) && finite(entry.sd));
  return found ? { mean: Number(found.mean), sd: Number(found.sd), low: found.low ?? null, high: found.high ?? null } : null;
}
