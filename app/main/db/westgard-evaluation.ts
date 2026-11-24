import type { Db } from './sqlite-like';
import { combinedWestgardByPoint, type CombinedPointFlag, type MultiLevelSet, type QcPointLike } from '../domain/westgard-engine';
import { makeIsOnLayered, makeRuleActionLayered, makeScopeOf, type RuleAction } from '../domain/rule-config';
import type { QcCut } from '../domain/qc-cuts';
import { qcRunKey } from '../domain/sort-order';
import { countOperationalLevels } from './operational-levels';
import { ruleConfigVersions, ruleVersionIndexOf, runEntrySeqs, type RuleConfigVersion } from './rule-config-history';

/** Mốc bắt đầu lại chuỗi của một xét nghiệm (`domain/qc-cuts.ts`). Mốc được
 * ghi khi cho phép hoạt động trở lại một hồ sơ NCE (lần chạy rerun), hoặc do
 * migration chuyển từ hồ sơ phiên bản cũ đã duyệt và hiệu quả (mốc theo ngày).
 * Hồ sơ đã cho chạy lại không huỷ được, nên mốc không bị gỡ ngược. */
export function qcCuts(db: Db, testId: string): QcCut[] {
  const rows = db.prepare('SELECT date, run_id FROM nce_cuts WHERE test_id=? ORDER BY date, run_id').all(testId) as { date: string; run_id: string | null }[];
  return rows.map((row) => ({ date: row.date, runId: row.run_id }));
}

/** Các hàm luật của MỘT phiên bản cấu hình: hành động, và hai kênh từng
 * mức/liên mức theo phạm vi. */
export interface RuleFunctions {
  actionOf: (rule: string) => RuleAction;
  within: (rule: string) => boolean;
  across: (rule: string) => boolean;
}

function ruleFunctions(version: RuleConfigVersion, levelCount: number): RuleFunctions {
  const on = makeIsOnLayered(version.globalRules, version.actions, levelCount);
  const scope = makeScopeOf(version.scopes, levelCount);
  return {
    actionOf: makeRuleActionLayered(version.globalRules, version.actions, levelCount),
    within: (rule) => on(rule) && ['within', 'both'].includes(scope(rule)),
    across: (rule) => on(rule) && ['across', 'both'].includes(scope(rule)),
  };
}

type RunLike = { date?: unknown; runId?: unknown };

/** Cấu hình luật theo LẦN CHẠY của một xét nghiệm (GV2, không hồi tố — xem
 * `db/rule-config-history.ts`): `at(run)` trả các hàm luật đang hiệu lực lúc
 * lần chạy đó được nhập. Chỉ đọc thứ tự nhập khi đã có lần đổi cấu hình. */
export function ruleResolver(db: Db, testId: string, levelCount: number) {
  const versions = ruleConfigVersions(db, testId);
  const fns = versions.map((version) => ruleFunctions(version, levelCount));
  const seqs = versions.length > 1 ? runEntrySeqs(db, testId) : new Map<string, number>();
  const indexOf = (run: RunLike) => versions.length > 1 ? ruleVersionIndexOf(versions, seqs.get(qcRunKey(run))) : 0;
  return { fns, indexOf, at: (run: RunLike) => fns[indexOf(run)], latest: fns[fns.length - 1] };
}

/** Hành động của từng luật cho một xét nghiệm (mặc định chung + ghi đè) tại
 * một lần chạy — cùng phép phân giải mà `evaluateQcSets()` dùng để kết luận
 * loại bỏ. Không truyền `run` thì lấy cấu hình hiện hành. */
export function testRuleActionOf(db: Db, testId: string, run?: { date: string; runId: string }) {
  // Luật bật sẵn phụ thuộc số mức đang vận hành (WG-26), cùng số mức mà
  // `activeEvaluationOf()` dùng để kết luận.
  const rules = ruleResolver(db, testId, countOperationalLevels(db, testId));
  return (run ? rules.at(run) : rules.latest).actionOf;
}

/** `extraCuts`: mốc giả định chưa ghi, để đánh giá lần rerun ứng viên TRONG
 * giai đoạn mới trước khi cho chạy lại (D-04).
 *
 * Mỗi lần chạy mang kết luận theo phiên bản cấu hình đang hiệu lực lúc nó
 * được nhập. Với phiên bản k, engine chạy trên các điểm tới hết giai đoạn của
 * k (luật nhiều lần chạy vẫn nhìn lại các lần chạy trước, kể cả của phiên bản
 * cũ) và chỉ lấy kết luận cho điểm thuộc k. Thứ tự nhập có thể khác thứ tự
 * ngày (nhập lùi ngày), nên "tới hết giai đoạn" là theo thứ tự ngày–lần chạy
 * của chuỗi: điểm thuộc phiên bản sau vẫn có thể đứng trước. Kết luận của một
 * điểm chỉ phụ thuộc các lần chạy đứng trước nó trong chuỗi, còn dấu "bằng
 * chứng" mà lần chạy sau gắn ngược lên điểm trước phải do chính cấu hình của
 * lần chạy sau quyết định. */
export function evaluateQcSets<T extends QcPointLike>(db: Db, testId: string, sets: readonly MultiLevelSet<T>[], levelCount?: number, extraCuts: readonly QcCut[] = []): Map<T, CombinedPointFlag> {
  const configuredLevelCount = Number.isInteger(levelCount) && levelCount! > 0 ? levelCount! : new Set(sets.map(set => set.level)).size;
  return evaluateQcSetsWithRules(db, testId, sets, ruleResolver(db, testId, configuredLevelCount), extraCuts);
}

/** Như `evaluateQcSets()` với bộ phân giải luật nơi gọi đã dựng (và còn
 * dùng tiếp), để không đọc lại thứ tự nhập của cả xét nghiệm hai lần. */
export function evaluateQcSetsWithRules<T extends QcPointLike>(db: Db, testId: string, sets: readonly MultiLevelSet<T>[], rules: ReturnType<typeof ruleResolver>, extraCuts: readonly QcCut[] = []): Map<T, CombinedPointFlag> {
  const cuts = [...qcCuts(db, testId), ...extraCuts];
  const evaluate = (input: readonly MultiLevelSet<T>[], fns: RuleFunctions) => combinedWestgardByPoint(input, fns.within, fns.across, fns.actionOf, cuts);
  if (rules.fns.length === 1) return evaluate(sets, rules.latest);
  const versionOf = new Map<T, number>();
  for (const set of sets) for (const point of set.pts) versionOf.set(point, rules.indexOf(point));
  const used = [...new Set(versionOf.values())];
  if (used.length === 1) return evaluate(sets, rules.fns[used[0]]);
  const out = new Map<T, CombinedPointFlag>();
  for (const version of used) {
    // Cắt chuỗi ở lần chạy CUỐI CÙNG của phiên bản này (theo thứ tự chuỗi).
    const upTo = sets.map((set) => {
      const last = set.pts.reduce((end, point, index) => versionOf.get(point) === version ? index : end, -1);
      return { ...set, pts: set.pts.slice(0, last + 1) };
    });
    for (const [point, flag] of evaluate(upTo, rules.fns[version])) if (versionOf.get(point) === version) out.set(point, flag);
  }
  return out;
}
