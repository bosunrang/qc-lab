import type { Db } from './sqlite-like';
import { readGlobalRules } from './rule-settings';
import { combinedWestgardByPoint, type MultiLevelSet, type QcPointLike } from '../domain/westgard-engine';
import { makeIsOnLayered, makeRuleActionLayered, makeScopeOf, parseRuleActions, parseRuleScopes } from '../domain/rule-config';

/** Khắc phục một sự cố của xét nghiệm mở giai đoạn vận hành mới cho run.
 * Ngày hoàn thành thuộc giai đoạn cũ (DB chưa có mốc theo giờ/run). */
export function effectiveQcFixDates(db: Db, testId: string): string[] {
  const rows = db.prepare(`SELECT DISTINCT action_completed_date FROM actions
    WHERE test_id=? AND record_status<>'cancelled' AND approval_status='approved'
      AND effectiveness_status='effective' AND action_completed_date<>''
    ORDER BY action_completed_date`).all(testId) as { action_completed_date: string }[];
  return rows.map(row => row.action_completed_date);
}

export function evaluateQcSets<T extends QcPointLike>(db: Db, testId: string, sets: readonly MultiLevelSet<T>[], levelCount?: number) {
  const test = db.prepare('SELECT rule_actions_json,rule_scopes_json FROM tests WHERE id=?').get(testId) as
    { rule_actions_json: string; rule_scopes_json: string } | undefined;
  const global = readGlobalRules(db), overrides = parseRuleActions(test?.rule_actions_json);
  const on = makeIsOnLayered(global, overrides), actionOf = makeRuleActionLayered(global, overrides);
  const configuredLevelCount = Number.isInteger(levelCount) && levelCount! > 0 ? levelCount! : new Set(sets.map(set => set.level)).size;
  const scope = makeScopeOf(parseRuleScopes(test?.rule_scopes_json), configuredLevelCount);
  return combinedWestgardByPoint(sets,
    rule => on(rule) && ['within', 'both'].includes(scope(rule)),
    rule => on(rule) && ['across', 'both'].includes(scope(rule)),
    actionOf, effectiveQcFixDates(db, testId));
}


