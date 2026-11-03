// Đánh giá Westgard của các mức ĐANG VẬN HÀNH một xét nghiệm — nguồn chung
// cho Nhập QC (`queryPoints`, `rangeCandidate`) và Phân tích Westgard
// (`analyzeLevel`, `listTestSummaries`). Sau mỗi lần nhập điểm, renderer gọi
// các endpoint này cho từng mức gần như cùng lúc (2026-11-03: 7 lời gọi, mỗi
// lời gọi tự đánh giá lại TOÀN BỘ các mức), nên kết quả được giữ lại để dùng
// chung trong lượt nạp đó.
//
// Kết quả chỉ được dùng lại khi chắc chắn CSDL chưa đổi: cùng số dòng đã ghi
// của kết nối (`total_changes()` đếm cả lệnh SQL ghi thẳng không qua
// `notifyChanged`), chưa có lời báo thay đổi nào, và chưa quá `MAX_AGE_MS`.
// Kết quả tính giữa một transaction không được giữ: transaction có thể bị
// huỷ mà `total_changes()` không lùi lại.
// Không cố giữ qua các lần ghi như bộ nhớ đệm tóm tắt: nhóm lời gọi cần gộp
// luôn nằm sát nhau, nên ngắn hạn là đủ và không phải liệt kê bảng nào ảnh
// hưởng tới kết quả.
import type { Db } from '../db/sqlite-like';
import { listOperationalLevels, isTestInActivePanel, type OperationalLevel } from '../db/operational-levels';
import { evaluateQcSetsWithRules, ruleResolver } from '../db/westgard-evaluation';
import { inTransaction } from '../db/transaction';
import type { CombinedPointFlag } from '../domain/westgard-engine';
import { compareQcPointOrder } from '../domain/sort-order';
import { addChangeListener } from './shared';

export interface QcPointRow {
  id: string; test_id: string; level: number; date: string; run_id: string; val: number;
  note: string; operator_name: string; operator_code: string;
  /** Cột INTEGER trong SQLite nhưng chỉ nhận 0/1 — khai hẹp cho khớp hợp
   * đồng `shared/qc-api.d.ts`, nơi renderer đọc nó như cờ nhị phân. */
  voided: 0 | 1;
  void_reason: string;
}
export type ActivePoint = QcPointRow & { lot: string; qc_mean: number | null; qc_sd: number | null; runId: string; qcMean: number | null; qcSd: number | null };
export type ActiveLevel = OperationalLevel & { pts: ActivePoint[] };
export interface ActiveEvaluation {
  levels: ActiveLevel[];
  byPoint: Map<ActivePoint, CombinedPointFlag>;
  /** Hàm luật theo LẦN CHẠY (GV2, không hồi tố), cùng phép phân giải đã dùng
   * để đánh giá — xem `ruleResolver()`. */
  rules: ReturnType<typeof ruleResolver>;
}

/** Đủ dài cho một lượt nạp lại (vài chục tới vài trăm ms), đủ ngắn để không
 * phải lo các thay đổi mà `total_changes()` không thấy (kết nối khác). */
const MAX_AGE_MS = 2000;
/** Vài xét nghiệm gần nhất là đủ; `listTestSummaries` duyệt mọi xét nghiệm
 * nên không giữ hết để khỏi tốn bộ nhớ. */
const MAX_ENTRIES = 8;

function computeActiveEvaluation(db: Db, testId: string): ActiveEvaluation {
  // Panel tắt: vẫn liệt kê mức nhưng không mức nào có điểm (lý do ở
  // đầu tệp `db/operational-levels.ts`).
  const inActivePanel = isTestInActivePanel(db, testId);
  const levels: ActiveLevel[] = listOperationalLevels(db, testId).map((config) => {
    const rows = inActivePanel
      ? db.prepare('SELECT * FROM qc_points WHERE test_id=? AND level=? AND voided=0 AND lot=?').all(testId, config.level, config.lot_no) as unknown as Omit<ActivePoint, 'runId' | 'qcMean' | 'qcSd'>[]
      : [];
    const pts = rows.map((p) => ({ ...p, runId: p.run_id, qcMean: p.qc_mean, qcSd: p.qc_sd })).sort(compareQcPointOrder);
    return { ...config, pts };
  });
  const rules = ruleResolver(db, testId, levels.length);
  return { levels, byPoint: evaluateQcSetsWithRules(db, testId, levels, rules), rules };
}

interface Entry { value: ActiveEvaluation; changes: number; at: number }
interface DbCache { entries: Map<string, Entry> }
const caches = new WeakMap<Db, DbCache>();

function totalChanges(db: Db): number {
  return Number((db.prepare('SELECT total_changes() AS n').get() as { n: number }).n);
}

/** Kết quả dùng chung, KHÔNG được sửa: nơi gọi chỉ đọc hoặc chép ra đối tượng mới. */
export function activeEvaluationOf(db: Db, testId: string): ActiveEvaluation {
  let cache = caches.get(db);
  if (!cache) {
    const created: DbCache = { entries: new Map() };
    addChangeListener(() => { created.entries.clear(); });
    caches.set(db, created);
    cache = created;
  }
  const changes = totalChanges(db), now = Date.now();
  const hit = cache.entries.get(testId);
  if (hit && hit.changes === changes && now - hit.at <= MAX_AGE_MS) return hit.value;
  for (const [key, entry] of cache.entries) if (entry.changes !== changes || now - entry.at > MAX_AGE_MS) cache.entries.delete(key);
  const value = computeActiveEvaluation(db, testId);
  if (inTransaction(db)) return value;
  cache.entries.delete(testId);
  cache.entries.set(testId, { value, changes, at: now });
  while (cache.entries.size > MAX_ENTRIES) cache.entries.delete(cache.entries.keys().next().value!);
  return value;
}
