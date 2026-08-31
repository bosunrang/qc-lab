// IPC handler cho module Entry (nhap/huy diem QC). Dung dung index nong nhat
// (test_id, level, date) da thiet ke trong schema. Danh gia Westgard tinh
// SONG SONG voi Mean/SD hien hanh cua muc do (chua ho tro snapshot per-point
// rieng nhu westgardByPoint - de danh cho khi lam Levey-Jennings lich su dai).
import type { Db } from '../db/open-database';
import { uid } from '../domain/text-utils';
import { validateQcPointInput, validateVoidInput, type QcPointInput, type VoidPointInput } from '../domain/entry-validation';
import { westgard, type QcPointLike, type RuleVerdict } from '../domain/westgard-engine';
import { parseRuleActions, makeIsOn } from '../domain/rule-config';
import { type Actor, type IpcResult, nowIso, writeAudit } from './shared';

interface QcPointRow {
  id: string; test_id: string; level: number; date: string; run_id: string; val: number;
  note: string; operator_name: string; voided: number; void_reason: string;
}

export interface QcPointView extends QcPointRow { verdict: RuleVerdict; rules: string[] }

export function createEntryHandlers(db: Db) {
  function pointsForLevel(testId: string, level: number, includeVoided = false): QcPointRow[] {
    const sql = includeVoided
      ? 'SELECT * FROM qc_points WHERE test_id=? AND level=? ORDER BY date, run_id'
      : 'SELECT * FROM qc_points WHERE test_id=? AND level=? AND voided=0 ORDER BY date, run_id';
    return db.prepare(sql).all(testId, level) as unknown as QcPointRow[];
  }

  /** Danh sach diem QC cua 1 muc, kem verdict Westgard tinh theo Mean/SD hien
   * hanh cua muc do (khong bao gom diem da huy trong phep tinh z-score).
   * Ton trong cau hinh bat/tat luat rieng cua xet nghiem (rule_actions_json)
   * - CUNG mot ham isOn ma trang Westgard dung, de verdict khong lech nhau
   * giua hai trang. */
  function queryPoints(testId: string, level: number): QcPointView[] {
    const levelRow = db.prepare('SELECT mean, sd FROM test_levels WHERE test_id=? AND level=?').get(testId, level) as { mean: number | null; sd: number | null } | undefined;
    const testRow = db.prepare('SELECT rule_actions_json FROM tests WHERE id=?').get(testId) as { rule_actions_json: string } | undefined;
    const isOn = makeIsOn(parseRuleActions(testRow ? testRow.rule_actions_json : null));
    const points = pointsForLevel(testId, level, false);
    const asWestgard: QcPointLike[] = points.map(p => ({ val: p.val, runId: p.run_id, date: p.date }));
    const result = levelRow && levelRow.mean != null && levelRow.sd != null
      ? westgard(asWestgard, levelRow.mean, levelRow.sd, isOn)
      : { F: points.map(() => ({ level: 'ok' as RuleVerdict, rules: [], supportRules: [] })), zs: points.map(() => NaN) };
    return points.map((p, i) => ({ ...p, verdict: result.F[i].level, rules: result.F[i].rules }));
  }

  function addPoint(input: { data: QcPointInput }, actor: Actor): IpcResult<QcPointView> {
    const knownLevels = (db.prepare('SELECT level FROM test_levels WHERE test_id=?').all(String(input.data.testId || '')) as { level: number }[]).map(r => r.level);
    const result = validateQcPointInput(input.data, knownLevels);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { testId, level, date, val, runId, note, operatorName } = result.data;
    const test = db.prepare('SELECT name FROM tests WHERE id=?').get(testId) as { name: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Khong tim thay xet nghiem.' } };
    const id = uid();
    db.prepare(`INSERT INTO qc_points(id,test_id,level,date,run_id,val,value_decimals,note,operator_name)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(id, testId, level, date, runId, val, 2, note, operatorName);
    writeAudit(db, actor, 'Nhap QC', `Diem QC muc ${level}, ngay ${date}, gia tri ${val}`, test.name);
    const [view] = queryPoints(testId, level).filter(p => p.id === id);
    return { ok: true, data: view };
  }

  function voidPoint(input: { data: VoidPointInput }, actor: Actor): IpcResult<{ id: string }> {
    const result = validateVoidInput(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { pointId, reason } = result.data;
    const point = db.prepare('SELECT id, test_id, voided FROM qc_points WHERE id=?').get(pointId) as { id: string; test_id: string; voided: number } | undefined;
    if (!point) return { ok: false, error: { code: 'not-found', message: 'Khong tim thay diem QC.' } };
    if (point.voided) return { ok: false, error: { code: 'already-voided', message: 'Diem QC nay da bi huy truoc do.' } };
    const test = db.prepare('SELECT name FROM tests WHERE id=?').get(point.test_id) as { name: string } | undefined;
    db.prepare('UPDATE qc_points SET voided=1, void_reason=?, voided_at=?, voided_by=? WHERE id=?')
      .run(reason, nowIso(), actor.username, pointId);
    writeAudit(db, actor, 'Huy diem QC', `Ly do: ${reason}`, test ? test.name : '');
    return { ok: true, data: { id: pointId } };
  }

  return { queryPoints, addPoint, voidPoint };
}

export type EntryHandlers = ReturnType<typeof createEntryHandlers>;
