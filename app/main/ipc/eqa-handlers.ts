// Handler phân hệ Ngoại kiểm, giai đoạn 1 (docs/EQA-PLAN-2026-10-28.md):
// xem trước và nhập một kỳ, huỷ kỳ, đọc danh sách và chi tiết. Mọi phép tính
// (z, xếp loại, đối chiếu nhà cung cấp, đảo cột) chạy lại ở đây bằng
// `domain/eqa/*`; renderer chỉ gửi dữ liệu thô đã đọc từ file.
import type { Db } from '../db/sqlite-like';
import type {
  EqaDecisionRow, EqaImportInput, EqaImportPreview, EqaResultRow, EqaRoundRow, EqaRoundView,
} from '../../shared/qc-api';
import { cleanId, uid } from '../domain/text-utils';
import {
  EQA_CLASS_LABEL, EQA_DEFAULT_CONFIG, eqaCounts, eqaNormalize, eqaPeerComparison, eqaRoundNumber,
  type EqaCatalogTest, type EqaClass, type EqaConfig, type EqaPeer,
} from '../domain/eqa/evaluation';
import { checkEqaImport, eqaPairKey, type EqaImportCheck } from '../domain/eqa/import';
import { type IpcResult, nowIso } from './shared';
import { writeCommand } from './write-command';

const fail = <T>(code: string, message: string): IpcResult<T> => ({ ok: false, error: { code, message } });
const objectInput = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
const parseJson = <T>(raw: string, fallback: T): T => { try { return JSON.parse(raw || '') as T; } catch { return fallback; } };

/** Các bảng một lần ghi ngoại kiểm có thể đổi; renderer nghe `eqa_rounds`. */
const EQA_TABLES = ['eqa_programs', 'eqa_test_map', 'eqa_rounds', 'eqa_results', 'eqa_decisions'];

interface RoundRecord {
  id: string; program_id: string; year: number; round: string; status: string; version: number; row_version: number;
}

export function readEqaConfig(db: Db): EqaConfig {
  const row = db.prepare("SELECT value FROM app_meta WHERE key='eqaConfig'").get() as { value: string } | undefined;
  const raw = parseJson<Record<string, unknown>>(row?.value ?? '', {});
  const pick = (key: keyof EqaConfig, min: number, max: number) => {
    const n = Number(raw[key]);
    return Number.isFinite(n) && n >= min && n <= max ? n : EQA_DEFAULT_CONFIG[key];
  };
  const zWarn = pick('zWarn', 0.5, 5), zReject = pick('zReject', 1, 10);
  return { zWarn, zReject: zReject > zWarn ? zReject : EQA_DEFAULT_CONFIG.zReject, ptMin: pick('ptMin', 0, 100) };
}

export function createEqaHandlers(db: Db) {
  function catalogTests(): EqaCatalogTest[] {
    const rows = db.prepare(`SELECT t.id, t.name, t.display_name, t.standard_name, t.abbreviation, t.aliases_json, t.instrument_id, t.active,
      i.name AS instrument_name, i.model AS instrument_model FROM tests t JOIN instruments i ON i.id=t.instrument_id`).all() as
      { id: string; name: string; display_name: string; standard_name: string; abbreviation: string; aliases_json: string; instrument_id: string; active: number; instrument_name: string; instrument_model: string }[];
    return rows.map((row) => ({
      id: row.id, name: row.name, display_name: row.display_name, standard_name: row.standard_name, abbreviation: row.abbreviation,
      aliases: parseJson<unknown[]>(row.aliases_json, []).filter((a): a is string => typeof a === 'string'),
      instrument_id: row.instrument_id, instrument_name: row.instrument_name, instrument_model: row.instrument_model, active: !!row.active,
    }));
  }

  /** Chương trình nhận diện theo tên + đơn vị tổ chức, không phân biệt cách viết. */
  function findProgram(name: string, provider: string): { id: string } | undefined {
    const rows = db.prepare('SELECT id, name, provider FROM eqa_programs').all() as { id: string; name: string; provider: string }[];
    return rows.find((row) => eqaNormalize(row.name) === eqaNormalize(name) && eqaNormalize(row.provider) === eqaNormalize(provider));
  }

  function findRound(programId: string | undefined, year: number | null, round: string): RoundRecord | undefined {
    if (!programId || year === null) return undefined;
    const rows = db.prepare('SELECT id, program_id, year, round, status, version, row_version FROM eqa_rounds WHERE program_id=? AND year=?').all(programId, year) as unknown as RoundRecord[];
    return rows.find((row) => eqaNormalize(row.round) === eqaNormalize(round));
  }

  /** Ánh xạ đã lưu của chương trình, đè bằng lựa chọn của lần nhập này. */
  function mappingFor(programId: string | undefined, input: EqaImportInput, testIds: ReadonlySet<string>): Map<string, string> {
    const map = new Map<string, string>();
    if (programId) for (const row of db.prepare('SELECT pair_key, test_id FROM eqa_test_map WHERE program_id=?').all(programId) as { pair_key: string; test_id: string }[]) map.set(row.pair_key, row.test_id);
    for (const item of Array.isArray(input.mappings) ? input.mappings : []) {
      const m = objectInput(item), testId = cleanId(m.testId);
      if (testIds.has(testId)) map.set(eqaPairKey(text(m.code, 80), text(m.instrument, 120)), testId);
    }
    return map;
  }

  function prepare(raw: unknown): { input: EqaImportInput; check: EqaImportCheck; programId: string | undefined; existing: RoundRecord | undefined } {
    const input = objectInput(objectInput(raw).data) as unknown as EqaImportInput;
    const tests = catalogTests();
    const testIds = new Set(tests.map((t) => t.id));
    const round = objectInput(input.round);
    const programId = findProgram(text(round.program, 200), text(round.provider, 200))?.id;
    const confirmedSwaps = new Set((Array.isArray(input.swaps) ? input.swaps : []).map((s) => eqaNormalize(objectInput(s).instrument)).filter(Boolean));
    const check = checkEqaImport({ round: input.round, rows: input.rows }, { tests, mapping: mappingFor(programId, input, testIds), confirmedSwaps, config: readEqaConfig(db) });
    return { input, check, programId, existing: findRound(programId, check.round.year, check.round.round) };
  }

  function previewEqaImport(raw: unknown): IpcResult<EqaImportPreview> {
    const { check, existing } = prepare(raw);
    const counts = eqaCounts(check.rows.filter((row) => row.cls).map((row) => row.cls as EqaClass));
    return { ok: true, data: {
      round: check.round, round_errors: check.roundErrors, rows: check.rows, blocking: check.blocking,
      pairs: check.pairs.map((p) => ({ code: p.code, instrument: p.instrument, test_id: p.testId, suggestions: p.suggestions, rows: p.rows })),
      swaps: check.swaps.map((s) => ({ instrument: s.instrument, rows: s.rows, swapped_rows: s.swappedRows, flagged: s.flagged, confirmed: s.confirmed })),
      counts: { total: counts.total, ok: counts.ok, warn: counts.warn, rej: counts.rej, pt_score: counts.ptScore },
      existing: existing ? { id: existing.id, version: existing.version, row_version: existing.row_version, status: existing.status } : null,
    } };
  }

  const importEqaRound = writeCommand(db, 'importEqaRound', 'write', (w, raw: unknown): IpcResult<EqaRoundView> => {
    const { input, check, programId, existing } = prepare(raw);
    if (check.blocking) return fail('blocking', `Còn ${check.blocking} lỗi chặn trong dữ liệu nhập. Xem trước để sửa trước khi ghi.`);
    const swapReasons = new Map((Array.isArray(input.swaps) ? input.swaps : []).map((s) => [eqaNormalize(objectInput(s).instrument), text(objectInput(s).reason, 1000)]));
    for (const swap of check.swaps.filter((s) => s.confirmed)) {
      if ((swapReasons.get(eqaNormalize(swap.instrument)) ?? '').length < 10) return fail('swap-reason', `Ghi lý do đảo cột cho máy ${swap.instrument} (ít nhất 10 ký tự).`);
    }
    const replaceReason = text(input.replaceReason, 1000);
    if (existing) {
      if (replaceReason.length < 10) return fail('replace-reason', 'Kỳ này đã được nhập. Ghi lý do nhập lại (ít nhất 10 ký tự); phiên bản cũ vẫn được giữ.');
      if (input.expectedVersion !== undefined && Number(input.expectedVersion) !== existing.row_version) return fail('stale', 'Kỳ ngoại kiểm vừa được người khác cập nhật, hãy xem trước lại.');
    }
    const source = input.source === 'html-import' ? 'html-import' : 'excel';
    const sourceName = text(input.sourceName, 200);
    const round = check.round;
    const counts = eqaCounts(check.rows.map((row) => row.cls as EqaClass));
    const roundId = existing?.id ?? uid();
    const version = existing ? existing.version + 1 : 1;
    w.commit((tx) => {
      const now = nowIso();
      let pid = programId;
      if (!pid) {
        pid = uid();
        db.prepare('INSERT INTO eqa_programs(id,name,provider,program_code,unit_code,created_at) VALUES (?,?,?,?,?,?)')
          .run(pid, round.program, round.provider, round.programCode, round.unitCode, now);
      } else {
        db.prepare("UPDATE eqa_programs SET program_code=CASE WHEN program_code='' THEN ? ELSE program_code END, unit_code=CASE WHEN unit_code='' THEN ? ELSE unit_code END WHERE id=?")
          .run(round.programCode, round.unitCode, pid);
      }
      const upsertMap = db.prepare(`INSERT INTO eqa_test_map(id,program_id,pair_key,code,instrument_label,test_id) VALUES (?,?,?,?,?,?)
        ON CONFLICT(program_id,pair_key) DO UPDATE SET test_id=excluded.test_id, code=excluded.code, instrument_label=excluded.instrument_label`);
      for (const pair of check.pairs) if (pair.testId) upsertMap.run(uid(), pid, eqaPairKey(pair.code, pair.instrument), pair.code, pair.instrument, pair.testId);
      if (existing) {
        db.prepare(`UPDATE eqa_rounds SET report_code=?,received_date=?,report_date=?,assigned_level=?,entered_by=?,source=?,source_name=?,status='open',
          version=?,row_version=row_version+1,updated_at=? WHERE id=?`)
          .run(round.reportCode, round.receivedDate, round.reportDate, round.assignedLevel, round.enteredBy, source, sourceName, version, now, roundId);
      } else {
        db.prepare(`INSERT INTO eqa_rounds(id,program_id,year,round,round_no,report_code,received_date,report_date,assigned_level,entered_by,source,source_name,status,version,row_version,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'open',1,1,?,?)`)
          .run(roundId, pid, round.year, round.round, eqaRoundNumber(round.round), round.reportCode, round.receivedDate, round.reportDate, round.assignedLevel, round.enteredBy, source, sourceName, now, now);
      }
      const insert = db.prepare(`INSERT INTO eqa_results(id,round_id,version,test_id,code,instrument_label,level_label,sample,unit,result,assigned,sigma_p,z,z_provider,z_official,pct,class,
        provider_check,swapped,tolerance_pct,within_tolerance,run_date,reagent_lot,method,operator,iqc_note,peer_group,peer_json,warnings_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const row of check.rows) {
        insert.run(uid(), roundId, version, row.testId, row.code, row.instrument, row.level, row.sample, row.unit, row.result, row.assigned, row.sigmaP,
          row.z, row.zProvider, row.zOfficial, row.pct, row.cls, row.providerCheck, row.swapped ? 1 : 0, row.tolerancePct,
          row.withinTolerance === null ? null : row.withinTolerance ? 1 : 0, row.runDate, row.reagentLot, row.method, row.operator,
          row.iqcNote, row.peerGroup, JSON.stringify(row.peer), JSON.stringify(row.warnings));
      }
      const decide = db.prepare('INSERT INTO eqa_decisions(id,round_id,type,payload_json,actor_user_id,actor_name,decided_at) VALUES (?,?,?,?,?,?,?)');
      const actorName = w.actor.name || w.actor.username;
      decide.run(uid(), roundId, existing ? 'reimport' : 'import', JSON.stringify({
        source, sourceName, version, rows: counts.total, ok: counts.ok, warn: counts.warn, rej: counts.rej, reason: existing ? replaceReason : '',
      }), w.actor.userId, actorName, now);
      for (const swap of check.swaps.filter((s) => s.confirmed)) {
        decide.run(uid(), roundId, 'column_swap', JSON.stringify({ instrument: swap.instrument, rows: swap.rows, swappedRows: swap.swappedRows, reason: swapReasons.get(eqaNormalize(swap.instrument)), version }), w.actor.userId, actorName, now);
      }
      const label = `${round.program} · ${round.round}/${round.year}`;
      tx.audit(existing ? 'Nhập lại kỳ ngoại kiểm' : 'Nhập kỳ ngoại kiểm',
        `${label} · ${counts.total} kết quả (${counts.ok} ${EQA_CLASS_LABEL.ok.toLowerCase()}, ${counts.warn} cảnh báo, ${counts.rej} không chấp nhận)${existing ? ` · phiên bản ${version}: ${replaceReason}` : ''}`, label);
      for (const swap of check.swaps.filter((s) => s.confirmed)) tx.audit('Đảo cột dữ liệu ngoại kiểm', `${label} · ${swap.instrument}: ${swapReasons.get(eqaNormalize(swap.instrument))}`, label);
      tx.changed(EQA_TABLES);
    });
    return { ok: true, data: getEqaRound(roundId)! };
  });

  const cancelEqaRound = writeCommand(db, 'cancelEqaRound', 'write', (w, raw: unknown): IpcResult<EqaRoundView> => {
    const data = objectInput(objectInput(raw).data);
    const id = cleanId(data.id);
    const round = db.prepare('SELECT r.id, r.status, r.row_version, r.year, r.round, p.name AS program FROM eqa_rounds r JOIN eqa_programs p ON p.id=r.program_id WHERE r.id=?').get(id) as
      { id: string; status: string; row_version: number; year: number; round: string; program: string } | undefined;
    if (!round) return fail('not-found', 'Không tìm thấy kỳ ngoại kiểm.');
    if (round.status !== 'open') return fail('status', 'Kỳ này đã được huỷ.');
    if (Number(data.expectedVersion) !== round.row_version) return fail('stale', 'Kỳ ngoại kiểm vừa được người khác cập nhật, hãy tải lại.');
    const reason = text(data.reason, 1000);
    if (reason.length < 10) return fail('missing-reason', 'Huỷ kỳ phải ghi lý do (ít nhất 10 ký tự).');
    w.commit((tx) => {
      const now = nowIso();
      db.prepare("UPDATE eqa_rounds SET status='cancelled', row_version=row_version+1, updated_at=? WHERE id=?").run(now, id);
      db.prepare('INSERT INTO eqa_decisions(id,round_id,type,payload_json,actor_user_id,actor_name,decided_at) VALUES (?,?,?,?,?,?,?)')
        .run(uid(), id, 'cancel', JSON.stringify({ reason }), w.actor.userId, w.actor.name || w.actor.username, now);
      const label = `${round.program} · ${round.round}/${round.year}`;
      tx.audit('Huỷ kỳ ngoại kiểm', `${label}: ${reason}`, label);
      tx.changed(['eqa_rounds', 'eqa_decisions']);
    });
    return { ok: true, data: getEqaRound(id)! };
  });

  // Đọc dữ liệu

  const ROUND_SQL = `SELECT r.*, p.name AS program_name, p.provider, p.program_code, p.unit_code FROM eqa_rounds r JOIN eqa_programs p ON p.id=r.program_id`;

  function resultRows(roundId: string, version: number): EqaResultRow[] {
    const rows = db.prepare(`SELECT e.*, COALESCE(NULLIF(t.display_name,''), t.name) AS test_name, t.instrument_id, i.name AS instrument_name
      FROM eqa_results e JOIN tests t ON t.id=e.test_id JOIN instruments i ON i.id=t.instrument_id
      WHERE e.round_id=? AND e.version=? ORDER BY i.name, test_name, e.level_label, e.sample`).all(roundId, version) as unknown as (Omit<EqaResultRow, 'peer' | 'warnings'> & { peer_json: string; warnings_json: string })[];
    return rows.map(({ peer_json, warnings_json, ...row }) => ({
      ...row, peer: eqaPeerComparison(row.result, parseJson<EqaPeer>(peer_json, {})), warnings: parseJson<string[]>(warnings_json, []),
    }));
  }

  function toRoundRow(row: Record<string, unknown>, results: readonly EqaResultRow[]): EqaRoundRow {
    const counts = eqaCounts(results.map((r) => r.class));
    return {
      ...(row as unknown as EqaRoundRow),
      total: counts.total, ok: counts.ok, warn: counts.warn, rej: counts.rej, pt_score: counts.ptScore,
      swapped_rows: results.filter((r) => r.swapped).length,
      instruments: [...new Set(results.map((r) => r.instrument_name))].sort((a, b) => a.localeCompare(b, 'vi')),
    };
  }

  function listEqaRounds(): EqaRoundRow[] {
    const rounds = db.prepare(`${ROUND_SQL} ORDER BY r.year DESC, r.round_no DESC, p.name`).all() as Record<string, unknown>[];
    return rounds.map((row) => toRoundRow(row, resultRows(String(row.id), Number(row.version))));
  }

  function getEqaRound(id: unknown): EqaRoundView | null {
    const row = db.prepare(`${ROUND_SQL} WHERE r.id=?`).get(cleanId(id)) as Record<string, unknown> | undefined;
    if (!row) return null;
    const results = resultRows(String(row.id), Number(row.version));
    const byInstrument = new Map<string, EqaResultRow[]>();
    for (const r of results) byInstrument.set(r.instrument_id, [...(byInstrument.get(r.instrument_id) ?? []), r]);
    const config = readEqaConfig(db);
    return {
      round: toRoundRow(row, results), results,
      decisions: db.prepare('SELECT id, type, payload_json, actor_name, decided_at FROM eqa_decisions WHERE round_id=? ORDER BY decided_at, rowid').all(row.id) as unknown as EqaDecisionRow[],
      instruments: [...byInstrument.values()].map((list) => {
        const c = eqaCounts(list.map((r) => r.class));
        return { instrument_id: list[0].instrument_id, instrument_name: list[0].instrument_name, total: c.total, ok: c.ok, warn: c.warn, rej: c.rej, pt_score: c.ptScore };
      }),
      config: { z_warn: config.zWarn, z_reject: config.zReject, pt_min: config.ptMin },
    };
  }

  return { listEqaRounds, getEqaRound, previewEqaImport, importEqaRound, cancelEqaRound };
}
