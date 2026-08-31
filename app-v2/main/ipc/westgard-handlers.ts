// IPC handler cho trang Phan tich Westgard: tong quan tat ca xet nghiem/muc
// theo verdict te nhat hien tai, xem chi tiet 1 muc kem CUSUM, bat/tat tung
// luat rieng cho 1 xet nghiem.
import type { Db } from '../db/open-database';
import { westgard, cusum, type QcPointLike, type RuleVerdict } from '../domain/westgard-engine';
import { parseRuleActions, serializeRuleActions, makeIsOn, effectiveRuleList, type RuleActionsMap } from '../domain/rule-config';
import { WG_RULE_REGISTRY } from '../domain/westgard-rules';
import { type Actor, type IpcResult, writeAudit } from './shared';

const VERDICT_RANK: Record<RuleVerdict, number> = { ok: 0, warn: 1, rej: 2 };

export interface TestSummary {
  testId: string; testName: string; instrumentName: string;
  levels: { level: number; mean: number | null; sd: number | null; worstVerdict: RuleVerdict; pointCount: number }[];
}

export interface LevelAnalysis {
  points: { id: string; date: string; runId: string; val: number; z: number; verdict: RuleVerdict; rules: string[] }[];
  cusum: { cPos: number[]; cNeg: number[]; flags: RuleVerdict[] };
  ruleActions: { id: string; desc: string; on: boolean }[];
}

export function createWestgardHandlers(db: Db) {
  function ruleActionsFor(testId: string): RuleActionsMap {
    const row = db.prepare('SELECT rule_actions_json FROM tests WHERE id=?').get(testId) as { rule_actions_json: string } | undefined;
    return parseRuleActions(row ? row.rule_actions_json : null);
  }

  /** Danh sach tat ca xet nghiem + tung muc, kem verdict TE NHAT trong so
   * cac diem CHUA huy hien co - dung cho man hinh tong quan. */
  function listTestSummaries(): TestSummary[] {
    const tests = db.prepare(`
      SELECT t.id as test_id, t.name as test_name, i.name as instrument_name
      FROM tests t LEFT JOIN instruments i ON i.id = t.instrument_id
      ORDER BY t.name
    `).all() as { test_id: string; test_name: string; instrument_name: string }[];

    return tests.map(t => {
      const isOn = makeIsOn(ruleActionsFor(t.test_id));
      const levelRows = db.prepare('SELECT level, mean, sd FROM test_levels WHERE test_id=? ORDER BY level').all(t.test_id) as { level: number; mean: number | null; sd: number | null }[];
      const levels = levelRows.map(lv => {
        const points = db.prepare('SELECT val, run_id, date FROM qc_points WHERE test_id=? AND level=? AND voided=0 ORDER BY date, run_id')
          .all(t.test_id, lv.level) as { val: number; run_id: string; date: string }[];
        let worstVerdict: RuleVerdict = 'ok';
        if (lv.mean != null && lv.sd != null && points.length) {
          const asWestgard: QcPointLike[] = points.map(p => ({ val: p.val, runId: p.run_id, date: p.date }));
          const result = westgard(asWestgard, lv.mean, lv.sd, isOn);
          for (const flag of result.F) if (VERDICT_RANK[flag.level] > VERDICT_RANK[worstVerdict]) worstVerdict = flag.level;
        }
        return { level: lv.level, mean: lv.mean, sd: lv.sd, worstVerdict, pointCount: points.length };
      });
      return { testId: t.test_id, testName: t.test_name, instrumentName: t.instrument_name || '', levels };
    });
  }

  /** Chi tiet 1 muc: tung diem kem z-score/verdict/luat, chuoi CUSUM, va
   * trang thai bat/tat cua tung luat cho xet nghiem nay. */
  function analyzeLevel(testId: string, level: number): LevelAnalysis {
    const levelRow = db.prepare('SELECT mean, sd FROM test_levels WHERE test_id=? AND level=?').get(testId, level) as { mean: number | null; sd: number | null } | undefined;
    const overrides = ruleActionsFor(testId);
    const isOn = makeIsOn(overrides);
    const rows = db.prepare('SELECT id, date, run_id, val FROM qc_points WHERE test_id=? AND level=? AND voided=0 ORDER BY date, run_id')
      .all(testId, level) as { id: string; date: string; run_id: string; val: number }[];
    const asWestgard: QcPointLike[] = rows.map(r => ({ val: r.val, runId: r.run_id, date: r.date }));
    const hasTarget = levelRow && levelRow.mean != null && levelRow.sd != null;
    const wg = hasTarget ? westgard(asWestgard, levelRow!.mean, levelRow!.sd, isOn) : { F: rows.map(() => ({ level: 'ok' as RuleVerdict, rules: [], supportRules: [] })), zs: rows.map(() => NaN) };
    const cs = hasTarget ? cusum(asWestgard, levelRow!.mean, levelRow!.sd) : { cPos: rows.map(() => 0), cNeg: rows.map(() => 0), flags: rows.map(() => 'ok' as RuleVerdict), k: 0.5, h: 4 };
    const points = rows.map((r, i) => ({ id: r.id, date: r.date, runId: r.run_id, val: r.val, z: wg.zs[i], verdict: wg.F[i].level, rules: wg.F[i].rules }));
    const ruleActions = effectiveRuleList(overrides).map(r => ({ id: r.id, on: r.on, desc: WG_RULE_REGISTRY.find(x => x.id === r.id)?.desc || '' }));
    return { points, cusum: { cPos: cs.cPos, cNeg: cs.cNeg, flags: cs.flags }, ruleActions };
  }

  function saveRuleAction(testId: string, ruleId: string, on: boolean, actor: Actor): IpcResult<{ ruleId: string; on: boolean }> {
    const test = db.prepare('SELECT id, name, rule_actions_json FROM tests WHERE id=?').get(testId) as { id: string; name: string; rule_actions_json: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Khong tim thay xet nghiem.' } };
    if (!WG_RULE_REGISTRY.some(r => r.id === ruleId)) return { ok: false, error: { code: 'invalid-rule', message: 'Ma luat khong hop le.' } };
    const overrides = parseRuleActions(test.rule_actions_json);
    overrides[ruleId] = on;
    db.prepare('UPDATE tests SET rule_actions_json=? WHERE id=?').run(serializeRuleActions(overrides), testId);
    writeAudit(db, actor, 'Sua cau hinh luat Westgard', `Luat ${ruleId} chuyen thanh ${on ? 'bat' : 'tat'}`, test.name);
    return { ok: true, data: { ruleId, on } };
  }

  return { listTestSummaries, analyzeLevel, saveRuleAction };
}

export type WestgardHandlers = ReturnType<typeof createWestgardHandlers>;
