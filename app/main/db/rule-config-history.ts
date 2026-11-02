// Lịch sử cấu hình luật Westgard — kết luận QC không hồi tố (gói GV2 của kế
// hoạch khắc phục 2026-10-31; ISO 15189:2022 8.4; cùng tinh thần D-03).
//
// Trước đây kết luận của mọi điểm được tính lại theo cấu hình luật HIỆN HÀNH:
// đổi 1-3s sang "Cảnh báo" hôm nay làm lần chạy bị loại tuần trước (có thể đã
// dẫn tới giữ kết quả bệnh nhân, kể cả trong kỳ đã khoá) thành "Đạt" và rời
// hàng chờ NCE. Nay mỗi lần đổi ghi một phiên bản cấu hình; mỗi lần chạy được
// đánh giá bằng phiên bản đang hiệu lực LÚC NÓ ĐƯỢC NHẬP — tức lúc kết luận
// của nó được đưa ra lần đầu (`db/westgard-evaluation.ts`). Engine vẫn là
// nguồn duy nhất, không lưu kết luận: tính lại bao nhiêu lần cũng ra cùng kết
// quả.
//
// Mốc theo THỨ TỰ NHẬP (`qc_points.entry_seq`), không theo ngày của lần chạy:
// - lần chạy đã có lúc đổi — kể cả của hôm nay — giữ cấu hình cũ;
// - lần chạy nhập sau thời điểm đổi dùng cấu hình mới, kể cả khi nhập lùi
//   ngày: kết luận của nó chưa từng được đưa ra, và đó là đường phòng xét
//   nghiệm cấu hình luật trước rồi mới nhập dữ liệu cũ vào.
// Thứ tự của một lần chạy là thứ tự của điểm nhập ĐẦU TIÊN trong lần chạy đó
// (kể cả điểm đã huỷ), nên mọi mức của một lần chạy dùng cùng một phiên bản.
// Vì không lần chạy đã có nào đổi kết luận, không cần chặn theo kỳ đã khoá.
import type { Db } from './sqlite-like';
import { readGlobalRules } from './rule-settings';
import { parseRuleActions, parseRuleScopes, serializeRuleActions, serializeRuleScopes, type RuleActionsMap, type RuleScopesMap } from '../domain/rule-config';
import { qcRunKey } from '../domain/sort-order';
import { uid } from '../domain/text-utils';

export const GLOBAL_RULE_SCOPE = 'global';

export interface RuleConfigVersion {
  /** Lần chạy có thứ tự nhập LỚN HƠN số này thuộc phiên bản; `null` là
   * phiên bản gốc, áp từ đầu. */
  afterEntrySeq: number | null;
  globalRules: RuleActionsMap;
  actions: RuleActionsMap;
  scopes: RuleScopesMap;
}

export interface RuleConfigState { rules: RuleActionsMap; scopes: RuleScopesMap }

interface HistoryRow { seq: number; scope: string; rules_json: string; scopes_json: string; boundary_entry_seq: number | null }

/** Ghi một lần đổi cấu hình, TRONG transaction của thao tác đổi. Phạm vi chưa
 * có lịch sử thì ghi trước cấu hình cũ làm dòng gốc (áp từ đầu), nên CSDL có
 * từ trước bản này không cần bước nạp sẵn. */
export function recordRuleConfigChange(db: Db, scope: string, before: RuleConfigState, after: RuleConfigState, changedBy: string, at: Date = new Date()): void {
  const nextSeq = () => Number((db.prepare('SELECT COALESCE(MAX(seq),0) AS n FROM rule_config_history').get() as { n: number }).n) + 1;
  const insert = db.prepare(`INSERT INTO rule_config_history(id,seq,scope,rules_json,scopes_json,boundary_entry_seq,changed_at,changed_by)
    VALUES (?,?,?,?,?,?,?,?)`);
  if (!db.prepare('SELECT 1 FROM rule_config_history WHERE scope=? LIMIT 1').get(scope)) {
    insert.run(uid(), nextSeq(), scope, serializeRuleActions(before.rules), serializeRuleScopes(before.scopes), null, '', '');
  }
  const boundary = Number((db.prepare('SELECT COALESCE(MAX(entry_seq),0) AS n FROM qc_points').get() as { n: number }).n);
  insert.run(uid(), nextSeq(), scope, serializeRuleActions(after.rules), serializeRuleScopes(after.scopes), boundary, at.toISOString(), changedBy);
}

/** Các phiên bản cấu hình của một xét nghiệm theo thứ tự thời gian, ghép từ
 * lịch sử cấu hình chung và của riêng xét nghiệm. Phiên bản đầu luôn có
 * `afterEntrySeq: null`. Trạng thái SAU lần đổi cuối của mỗi phạm vi lấy từ
 * cột hiện hành (`app_meta`, `tests`) — đó là giá trị các màn hình cấu hình
 * đang hiện, và là nguồn đúng khi phạm vi chưa từng được ghi lịch sử. */
export function ruleConfigVersions(db: Db, testId: string): RuleConfigVersion[] {
  const test = db.prepare('SELECT rule_actions_json, rule_scopes_json FROM tests WHERE id=?').get(testId) as { rule_actions_json: string; rule_scopes_json: string } | undefined;
  const current = {
    globalRules: readGlobalRules(db),
    actions: parseRuleActions(test?.rule_actions_json),
    scopes: parseRuleScopes(test?.rule_scopes_json),
  };
  const rows = db.prepare('SELECT seq, scope, rules_json, scopes_json, boundary_entry_seq FROM rule_config_history WHERE scope IN (?, ?) ORDER BY seq')
    .all(GLOBAL_RULE_SCOPE, testId) as unknown as HistoryRow[];
  if (!rows.length) return [{ afterEntrySeq: null, ...current }];
  const lastSeq = new Map<string, number>();
  for (const row of rows) lastSeq.set(row.scope, row.seq);
  const stateOf = (row: HistoryRow) => {
    const latest = lastSeq.get(row.scope) === row.seq;
    if (row.scope === GLOBAL_RULE_SCOPE) return { globalRules: latest ? current.globalRules : parseRuleActions(row.rules_json) };
    return latest
      ? { actions: current.actions, scopes: current.scopes }
      : { actions: parseRuleActions(row.rules_json), scopes: parseRuleScopes(row.scopes_json) };
  };
  // Dòng gốc áp từ đầu dù được ghi muộn (lần đổi đầu tiên của phạm vi đó).
  let state = { ...current };
  for (const row of rows) if (row.boundary_entry_seq === null) state = { ...state, ...stateOf(row) };
  const versions: RuleConfigVersion[] = [{ afterEntrySeq: null, ...state }];
  for (const row of rows) {
    if (row.boundary_entry_seq === null) continue;
    state = { ...state, ...stateOf(row) };
    versions.push({ afterEntrySeq: Number(row.boundary_entry_seq), ...state });
  }
  return versions;
}

/** Chỉ số phiên bản cho một lần chạy có thứ tự nhập `runEntrySeq`. Lần chạy
 * chưa có trong CSDL (`undefined`, vd. đang đánh giá thử) là lần chạy mới. */
export function ruleVersionIndexOf(versions: readonly RuleConfigVersion[], runEntrySeq: number | undefined): number {
  if (runEntrySeq === undefined) return versions.length - 1;
  for (let index = versions.length - 1; index > 0; index--) if (runEntrySeq > versions[index].afterEntrySeq!) return index;
  return 0;
}

/** Thứ tự nhập của từng lần chạy của một xét nghiệm (khoá `qcRunKey`): thứ tự
 * của điểm nhập đầu tiên, kể cả điểm đã huỷ. */
export function runEntrySeqs(db: Db, testId: string): Map<string, number> {
  const rows = db.prepare('SELECT date, run_id, MIN(entry_seq) AS seq FROM qc_points WHERE test_id=? GROUP BY date, run_id').all(testId) as { date: string; run_id: string; seq: number }[];
  return new Map(rows.map((row) => [qcRunKey({ date: row.date, runId: row.run_id }), Number(row.seq)]));
}
