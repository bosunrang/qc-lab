import type { Db } from './sqlite-like';
import { readGlobalRules } from './rule-settings';
import { combinedWestgardByPoint, type MultiLevelSet, type QcPointLike } from '../domain/westgard-engine';
import { makeIsOnLayered, makeRuleActionLayered, makeScopeOf, parseRuleActions, parseRuleScopes } from '../domain/rule-config';
import type { QcCut } from '../domain/qc-cuts';

/** Mốc bắt đầu lại chuỗi của một xét nghiệm (`domain/qc-cuts.ts`). Mốc được
 * ghi khi cho phép hoạt động trở lại một hồ sơ NCE (lần chạy rerun), hoặc do
 * migration chuyển từ hồ sơ phiên bản cũ đã duyệt và hiệu quả (mốc theo ngày).
 * Hồ sơ đã cho chạy lại không hủy được, nên mốc không bị gỡ ngược. */
export function qcCuts(db: Db, testId: string): QcCut[] {
  const rows = db.prepare('SELECT date, run_id FROM nce_cuts WHERE test_id=? ORDER BY date, run_id').all(testId) as { date: string; run_id: string | null }[];
  return rows.map((row) => ({ date: row.date, runId: row.run_id }));
}

/** `extraCuts`: mốc giả định chưa ghi, để đánh giá lần rerun ứng viên TRONG
 * giai đoạn mới trước khi cho chạy lại (D-04). */
export function evaluateQcSets<T extends QcPointLike>(db: Db, testId: string, sets: readonly MultiLevelSet<T>[], levelCount?: number, extraCuts: readonly QcCut[] = []) {
  const test = db.prepare('SELECT rule_actions_json,rule_scopes_json FROM tests WHERE id=?').get(testId) as
    { rule_actions_json: string; rule_scopes_json: string } | undefined;
  const global = readGlobalRules(db), overrides = parseRuleActions(test?.rule_actions_json);
  const on = makeIsOnLayered(global, overrides), actionOf = makeRuleActionLayered(global, overrides);
  const configuredLevelCount = Number.isInteger(levelCount) && levelCount! > 0 ? levelCount! : new Set(sets.map(set => set.level)).size;
  const scope = makeScopeOf(parseRuleScopes(test?.rule_scopes_json), configuredLevelCount);
  return combinedWestgardByPoint(sets,
    rule => on(rule) && ['within', 'both'].includes(scope(rule)),
    rule => on(rule) && ['across', 'both'].includes(scope(rule)),
    actionOf, [...qcCuts(db, testId), ...extraCuts]);
}
