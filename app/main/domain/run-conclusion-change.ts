// Kết luận Westgard theo LẦN CHẠY và phần chênh trước/sau một thao tác dữ
// liệu (N26–N28, đợt rà soát 09/11/2026).
//
// GV2 đã khoá "không hồi tố" khi ĐỔI LUẬT: lần chạy giữ kết luận theo phiên
// bản cấu hình lúc nhập. Nhưng luật nhiều lần chạy (2-2s, 4-1s, 10x…) nhìn lại
// các lần chạy trước, nên ĐỔI DỮ LIỆU vẫn đổi được kết luận của lần chạy đã
// có: huỷ điểm "bằng chứng" của hôm trước xoá việc loại bỏ của hôm sau, nhập
// lùi một điểm biến lần chạy đang Đạt thành Loại bỏ (hoặc ngược lại). Kết luận
// chấp nhận/loại bỏ một lần chạy là hồ sơ đã dùng để quyết định trả kết quả
// bệnh nhân (ISO 15189:2022 7.3.7.2, 8.4), nên nơi ghi phải so kết luận trước
// và sau, đòi lý do khi đổi trạng thái loại bỏ, và chặn khi chạm kỳ đã khoá.
//
// Tệp này chỉ gồm hàm thuần; phần đọc CSDL và cổng ghi nằm ở tệp
// `ipc/entry-handlers.ts` của main process.
import type { CombinedPointFlag, MultiLevelSet, QcPointLike, RuleVerdict } from './westgard-engine';
import { compareQcRunKey, qcRunKey } from './sort-order';
import { viDate } from './local-date';
import type { QcRunConclusionChange } from '../../shared/qc-api';

export type { QcRunConclusionChange };

/** Kết luận của MỘT lần chạy: mức nặng nhất trong các điểm của nó, cùng hợp
 * các luật đã nổ. Dấu "bằng chứng" (`supportRules`) không tính — đó là luật
 * của lần chạy khác gắn ngược lên điểm này. */
export interface RunConclusion { date: string; runId: string; verdict: RuleVerdict; rules: string[] }

const SEVERITY: Record<RuleVerdict, number> = { ok: 0, warn: 1, rej: 2 };

/** Kết luận theo lần chạy của một tập mức đã đánh giá, khoá `qcRunKey()`. */
export function runConclusions<T extends QcPointLike>(
  levelSets: readonly MultiLevelSet<T>[],
  byPoint: ReadonlyMap<T, CombinedPointFlag>,
): Map<string, RunConclusion> {
  const out = new Map<string, RunConclusion>();
  for (const set of levelSets) for (const point of set.pts) {
    const flag = byPoint.get(point);
    if (!flag) continue;
    const key = qcRunKey(point);
    let entry = out.get(key);
    if (!entry) {
      entry = { date: String(point.date || ''), runId: String(point.runId || ''), verdict: 'ok', rules: [] };
      out.set(key, entry);
    }
    if (SEVERITY[flag.level] > SEVERITY[entry.verdict]) entry.verdict = flag.level;
    for (const rule of flag.rules) if (!entry.rules.includes(rule)) entry.rules.push(rule);
  }
  for (const entry of out.values()) entry.rules.sort();
  return out;
}

/** Các lần chạy có mặt ở CẢ hai phía mà kết luận (mức hoặc tập luật) khác
 * nhau, sắp theo ngày–lần chạy. `skipKeys` là lần chạy của chính điểm vừa
 * nhập/huỷ: kết luận của nó đổi là lẽ đương nhiên và đã có cổng riêng (N4). */
export function changedRunConclusions(
  before: ReadonlyMap<string, RunConclusion>,
  after: ReadonlyMap<string, RunConclusion>,
  skipKeys: ReadonlySet<string> = new Set(),
): QcRunConclusionChange[] {
  const out: Array<QcRunConclusionChange & { key: string }> = [];
  for (const [key, previous] of before) {
    if (skipKeys.has(key)) continue;
    const next = after.get(key);
    if (!next) continue;
    if (previous.verdict === next.verdict && previous.rules.join('|') === next.rules.join('|')) continue;
    out.push({ key, date: previous.date, runId: previous.runId, before: previous.verdict, after: next.verdict, rulesBefore: previous.rules, rulesAfter: next.rules });
  }
  return out.sort((a, b) => compareQcRunKey(a.key, b.key)).map(({ key: _key, ...change }) => change);
}

/** Đổi trạng thái chấp nhận ↔ loại bỏ của lần chạy — loại thay đổi cần lý do. */
export function flipsRejection(change: QcRunConclusionChange): boolean {
  return (change.before === 'rej') !== (change.after === 'rej');
}

const VERDICT_LABEL: Record<RuleVerdict, string> = { ok: 'Đạt', warn: 'Cảnh báo', rej: 'Loại bỏ' };

/** Mã lần chạy mặc định có dạng `<ngày>-<số>`; chỉ in phần số cho gọn. */
function runLabel(date: string, runId: string): string {
  return runId.startsWith(`${date}-`) ? runId.slice(date.length + 1) : runId;
}

/** Một dòng mô tả để in vào thông báo lỗi và nhật ký, ví dụ
 * "05/10/2026 lần chạy 1: Loại bỏ (2-2s) → Đạt". */
export function describeRunChange(change: QcRunConclusionChange): string {
  const side = (verdict: RuleVerdict, rules: readonly string[]) => `${VERDICT_LABEL[verdict]}${rules.length ? ` (${rules.join(', ')})` : ''}`;
  return `${viDate(change.date)} lần chạy ${runLabel(change.date, change.runId) || '(không mã)'}: ${side(change.before, change.rulesBefore)} → ${side(change.after, change.rulesAfter)}`;
}

export function describeRunChanges(changes: readonly QcRunConclusionChange[]): string {
  return changes.map(describeRunChange).join('; ');
}

/** Cùng ngưỡng với lý do huỷ điểm thuộc lần chạy bị loại (N4). */
export const RETRO_REASON_MIN = 10;

/** Cổng của một thao tác làm đổi kết luận lần chạy khác:
 * - lần chạy đổi kết luận (kể cả chỉ đổi luật) thuộc kỳ đã khoá → chặn hẳn,
 *   vì kỳ đã khoá phải bất biến (N28);
 * - lần chạy đổi trạng thái loại bỏ ở kỳ đang mở → cần lý do ≥10 ký tự.
 * Đổi Đạt ↔ Cảnh báo ở kỳ mở chỉ ghi nhật ký. `action` là động từ in vào câu
 * báo lỗi ("Nhập điểm này", "Huỷ điểm này"). */
export function retroChangeError(
  changes: readonly QcRunConclusionChange[],
  isDateLocked: (date: string) => boolean,
  reason: string,
  action: string,
  reasonCode: string,
): { code: string; message: string } | null {
  const locked = changes.filter((change) => isDateLocked(change.date));
  if (locked.length) {
    const months = [...new Set(locked.map((change) => change.date.slice(0, 7)))].join(', ');
    return { code: 'retro-locked', message: `${action} làm đổi kết luận của lần chạy thuộc kỳ đã khoá (${months}): ${describeRunChanges(locked)}. Kỳ đã khoá không được đổi kết luận; mở khoá kỳ trước nếu thật sự cần sửa.` };
  }
  const flips = changes.filter(flipsRejection);
  if (flips.length && reason.trim().length < RETRO_REASON_MIN) {
    return { code: reasonCode, message: `${action} làm đổi kết luận loại bỏ của lần chạy đã có: ${describeRunChanges(flips)}. Cần ghi lý do tối thiểu ${RETRO_REASON_MIN} ký tự.` };
  }
  return null;
}
