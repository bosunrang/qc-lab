// Hàng chờ ngoại kiểm và căn cứ điều tra: chỉ đọc, không suy nguyên nhân.
import type { Db } from '../db/sqlite-like';
import type { EqaCorrectiveRow, EqaNceEvidence, EqaNceSource, EqaReportScope, EqaResultRow, EqaRoundRow, EqaRoundView } from '../../shared/qc-api';
import { listNceRows } from '../db/nce-repository';
import { nceRunOutcomes, nceRunSnapshot } from '../db/nce-evaluation';
import { cleanId } from '../domain/text-utils';
import { sha256Hex } from '../domain/sha256';
import { isoLocalDate } from '../domain/local-date';
import { eqaNceSourceKey } from '../domain/eqa/source-key';

function eqaInvestigationReasons(result: EqaResultRow): { required: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (result.class === 'rej') reasons.push('Kết quả không chấp nhận');
  if (result.trend?.unsuccessful) reasons.push('Không thành công qua các đợt');
  const labels = { two_of_three: '2/3 đợt vượt ±2 cùng phía', six_same_side: '6 đợt cùng phía', j_score: 'Điểm J vượt ngưỡng' };
  for (const signal of result.trend?.signals || []) if (signal !== 'reject') reasons.push(labels[signal]);
  const required = reasons.length > 0;
  if (!required && result.class === 'warn') reasons.push('Cảnh báo đơn lẻ · xem xét trước khi quyết định điều tra');
  return { required, reasons };
}

export { eqaNceSourceKey } from '../domain/eqa/source-key';

export function createEqaCorrectiveReader(db: Db, list: () => EqaRoundRow[], get: (id: unknown) => EqaRoundView | null) {
  function sourceOf(round: EqaRoundRow, result: EqaResultRow): EqaNceSource {
    return { round, result, ...eqaInvestigationReasons(result),
      fingerprint: sha256Hex(JSON.stringify([round.id, round.version, result.id, eqaNceSourceKey({ round, result })])) };
  }
  /** Ngày chạy theo lịch của đúng máy; lịch cũ chưa khai máy áp dụng cho mọi máy của đợt. */
  function scheduledDate(round: EqaRoundRow, instrumentId: string): string {
    return (db.prepare(`SELECT s.run_date FROM eqa_schedule s
      WHERE s.program_id=? AND s.year=? AND s.round_no=? AND (
        EXISTS (SELECT 1 FROM eqa_schedule_instruments m WHERE m.schedule_id=s.id AND m.instrument_id=?)
        OR NOT EXISTS (SELECT 1 FROM eqa_schedule_instruments m WHERE m.schedule_id=s.id))
      ORDER BY EXISTS (SELECT 1 FROM eqa_schedule_instruments m WHERE m.schedule_id=s.id AND m.instrument_id=?) DESC, s.updated_at DESC LIMIT 1`)
      .get(round.program_id, round.year, round.round_no, instrumentId, instrumentId) as { run_date: string } | undefined)?.run_date || '';
  }
  function listEqaCorrective(raw: unknown): EqaCorrectiveRow[] {
    const scope = raw as EqaReportScope;
    if (!scope || typeof scope.programId !== 'string' || !cleanId(scope.programId) || !Number.isInteger(scope.year)
      || (scope.roundId !== undefined && (typeof scope.roundId !== 'string' || !cleanId(scope.roundId)))
      || (scope.instrumentId !== undefined && (typeof scope.instrumentId !== 'string' || !cleanId(scope.instrumentId)))) throw new Error('Phạm vi khắc phục ngoại kiểm không hợp lệ.');
    const rounds = list().filter(r => r.program_id === scope.programId && r.year === scope.year && r.status === 'open' && (!scope.roundId || r.id === scope.roundId));
    const records = listNceRows(db, isoLocalDate()).filter(r => r.source === 'eqa' && r.eqa_source_key && r.status !== 'cancelled');
    const used = new Set<string>();
    const rows: EqaCorrectiveRow[] = [];
    const summary = (r: typeof records[number]): NonNullable<EqaCorrectiveRow['record']> => ({ id: r.id, nce_id: r.nce_id, status: r.status,
      owner_name: r.owner_name, due_date: r.due_date, overdue_days: r.overdue_days, open_actions: r.open_actions, overdue_actions: r.overdue_actions });
    const evidenceOf = (json: string): EqaNceEvidence | null => { try { return JSON.parse(json) as EqaNceEvidence; } catch { return null; } };
    for (const round of rounds) for (const result of get(round.id)!.results) {
      if (scope.instrumentId && result.instrument_id !== scope.instrumentId) continue;
      const source = sourceOf(round, result);
      const record = records.find(r => r.eqa_source_key === eqaNceSourceKey(source)) || null;
      if (!source.reasons.length && !record) continue;
      if (record) used.add(record.id);
      rows.push({ ...source, current: true, record: record ? summary(record) : null, evidence: record ? evidenceOf(record.eqa_snapshot_json) : null });
    }
    for (const record of records) {
      if (used.has(record.id)) continue;
      try {
        const saved = JSON.parse(record.eqa_snapshot_json) as EqaNceEvidence;
        if (saved.round.program_id !== scope.programId || saved.round.year !== scope.year
          || (scope.roundId && saved.round.id !== scope.roundId) || (scope.instrumentId && saved.result.instrument_id !== scope.instrumentId)) continue;
        rows.push({ round: saved.round, result: saved.result, required: saved.required, reasons: saved.reasons, fingerprint: saved.fingerprint,
          current: false, record: summary(record), evidence: saved });
      } catch { /* Hồ sơ thiếu ảnh chụp không được gán nhầm sang một kết quả mới. */ }
    }
    return rows.sort((a, b) => Number(b.required && !b.record) - Number(a.required && !a.record)
      || (b.record?.overdue_days || 0) - (a.record?.overdue_days || 0) || b.round.round_no - a.round.round_no || a.result.test_name.localeCompare(b.result.test_name, 'vi'));
  }
  function getEqaCorrectiveEvidence(raw: unknown): EqaNceEvidence {
    const input = raw as { resultId?: unknown; runDate?: unknown };
    if (typeof input?.resultId !== 'string' || !cleanId(input.resultId)) throw new Error('Mã kết quả ngoại kiểm không hợp lệ.');
    const id = cleanId(input?.resultId);
    const ref = db.prepare('SELECT round_id,version FROM eqa_results WHERE id=?').get(id) as { round_id: string; version: number } | undefined;
    const view = ref ? get(ref.round_id) : null;
    const result = view?.results.find(r => r.id === id);
    if (!view || view.round.status !== 'open' || !result || ref?.version !== view.round.version) throw new Error('Kết quả đã được thay thế hoặc đợt đã bị huỷ. Tải lại danh sách trước khi lập hồ sơ.');
    const runDate = input.runDate === undefined ? scheduledDate(view.round, result.instrument_id) : String(input.runDate);
    if (runDate && (!/^\d{4}-\d{2}-\d{2}$/.test(runDate) || !Number.isFinite(Date.parse(runDate)) || new Date(runDate).toISOString().slice(0, 10) !== runDate || runDate > isoLocalDate())) throw new Error('Ngày chạy mẫu ngoại kiểm không hợp lệ hoặc sau hôm nay.');
    const prior = list().filter(r => r.program_id === view.round.program_id && r.status === 'open'
      && (r.year < view.round.year || r.year === view.round.year && r.round_no < view.round.round_no)).sort((a, b) => b.year - a.year || b.round_no - a.round_no);
    const last = prior.find(r => { const samples = get(r.id)!.results.filter(p => p.test_id === result.test_id); return samples.length > 0 && samples.every(p => p.class === 'ok' && !eqaInvestigationReasons(p).required); });
    const runs = runDate ? nceRunOutcomes(db, result.test_id).filter(r => r.date === runDate) : [];
    return { ...sourceOf(view.round, result), run_date: runDate, captured_at: new Date().toISOString(),
      last_accepted: last ? { round_id: last.id, round: last.round, year: last.year, report_date: last.report_date } : null,
      related_results: view.results.filter(r => r.id !== result.id && (r.instrument_id === result.instrument_id || r.sample === result.sample)),
      iqc_runs: runs.map(r => ({ date: r.date, run_id: r.runId, complete: r.complete,
        points: nceRunSnapshot(db, result.test_id, r).points.map(p => ({ level: p.level, lot: p.lot, value: p.val, z: p.z, verdict: p.verdict, rules: [...p.rules], voided: p.voided })) })) };
  }
  return { listEqaCorrective, getEqaCorrectiveEvidence };
}
