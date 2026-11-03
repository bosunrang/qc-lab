// Handler phân hệ Ngoại kiểm (docs/EQA-PLAN-2026-10-28.md): xem trước và nhập
// một kỳ, huỷ kỳ, đọc danh sách, chi tiết và chuỗi theo xét nghiệm. Mọi phép
// tính (z, xếp loại, đối chiếu nhà cung cấp, tín hiệu chuỗi) chạy lại ở đây
// bằng `domain/eqa/*`; renderer chỉ gửi dữ liệu thô đã đọc từ báo cáo PDF.
import type { Db } from '../db/sqlite-like';
import type {
  EqaAttentionRow, EqaDecisionRow, EqaImportInput, EqaImportPreview, EqaInstrumentGridRow, EqaInstrumentSummary, EqaResultRow, EqaRoundRow,
  EqaRoundView, EqaSeriesView,
} from '../../shared/qc-api';
import { cleanId, uid } from '../domain/text-utils';
import {
  EQA_CLASS_LABEL, EQA_DEFAULT_CONFIG, eqaCounts, eqaNormalize, eqaPeerComparison, eqaRoundNumber,
  type EqaCatalogTest, type EqaClass, type EqaConfig, type EqaPeer,
} from '../domain/eqa/evaluation';
import { checkEqaImport, eqaPairKey, type EqaImportCheck } from '../domain/eqa/import';
import { eqaMissingInstruments } from '../domain/eqa/overview';
import { eqaAssignedUncertainty, eqaSeries, EQA_SERIES_DEFAULTS, EQA_SIGNAL_ORDER, type EqaSeriesResult } from '../domain/eqa/series';
import { type IpcResult, nowIso } from './shared';
import { writeCommand } from './write-command';
import { operationalTeaResolver } from '../db/operational-tea';

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
  return { zWarn, zReject: zReject > zWarn ? zReject : EQA_DEFAULT_CONFIG.zReject };
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

  /** Chương trình nhận diện theo mã chương trình + mã đơn vị khi có cả hai,
   * nếu không thì theo tên + đơn vị tổ chức, không phân biệt cách viết. */
  function findProgram(round: Record<string, unknown>): { id: string } | undefined {
    const rows = db.prepare('SELECT id, name, provider, program_code, unit_code FROM eqa_programs').all() as { id: string; name: string; provider: string; program_code: string; unit_code: string }[];
    const code = eqaNormalize(round.programCode), unit = eqaNormalize(round.unitCode);
    const byCode = code && unit ? rows.find((row) => eqaNormalize(row.program_code) === code && eqaNormalize(row.unit_code) === unit) : undefined;
    return byCode ?? rows.find((row) => eqaNormalize(row.name) === eqaNormalize(round.program) && eqaNormalize(row.provider) === eqaNormalize(round.provider));
  }

  /** Máy của các kết quả đang hiện hành trong một kỳ (id → tên). */
  function currentInstruments(round: RoundRecord): Map<string, string> {
    const rows = db.prepare(`SELECT DISTINCT t.instrument_id, i.name FROM eqa_results e JOIN tests t ON t.id=e.test_id JOIN instruments i ON i.id=t.instrument_id
      WHERE e.round_id=? AND e.version=?`).all(round.id, round.version) as { instrument_id: string; name: string }[];
    return new Map(rows.map((row) => [row.instrument_id, row.name]));
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

  interface Prepared {
    input: EqaImportInput; check: EqaImportCheck; programId: string | undefined; existing: RoundRecord | undefined;
    /** Máy đang có kết quả hiện hành trong kỳ (id → tên) và tên các máy mà lần nhập này thay kết quả. */
    present: Map<string, string>; replaces: string[];
    /** Máy (id) của các dòng trong lần nhập này. */
    incoming: Set<string>;
  }

  function prepare(raw: unknown): Prepared {
    const input = objectInput(objectInput(raw).data) as unknown as EqaImportInput;
    const tests = catalogTests();
    const testIds = new Set(tests.map((t) => t.id));
    const programId = findProgram(objectInput(input.round))?.id;
    const check = checkEqaImport({ round: input.round, rows: input.rows }, { tests, mapping: mappingFor(programId, input, testIds), config: readEqaConfig(db) });
    const existing = findRound(programId, check.round.year, check.round.round);
    // Một kỳ gom kết quả của nhiều máy (báo cáo PDF: mỗi máy một file). Nhập
    // máy mới là bổ sung; chỉ kết quả của máy đã có mới bị thay.
    const present = existing && existing.status === 'open' ? currentInstruments(existing) : new Map<string, string>();
    const instrumentOf = new Map(tests.map((t) => [t.id, t.instrument_id]));
    const incoming = new Set(check.rows.map((row) => (row.testId ? instrumentOf.get(row.testId) : undefined)).filter((id): id is string => !!id));
    const replaces = [...present].filter(([id]) => incoming.has(id)).map(([, name]) => name);
    return { input, check, programId, existing, present, replaces, incoming };
  }

  /** Nhập vào kỳ đã có cần lý do khi thay kết quả của máy đã có hoặc mở lại kỳ đã huỷ. */
  const needsReason = (p: Prepared) => !!p.existing && (p.existing.status !== 'open' || p.replaces.length > 0);

  function previewEqaImport(raw: unknown): IpcResult<EqaImportPreview> {
    const prepared = prepare(raw);
    const { check, existing } = prepared;
    const counts = eqaCounts(check.rows.filter((row) => row.cls).map((row) => row.cls as EqaClass));
    return { ok: true, data: {
      round: check.round, round_errors: check.roundErrors, rows: check.rows, blocking: check.blocking,
      pairs: check.pairs.map((p) => ({ code: p.code, instrument: p.instrument, test_id: p.testId, suggestions: p.suggestions, rows: p.rows })),
      counts: { total: counts.total, ok: counts.ok, warn: counts.warn, rej: counts.rej, accept_pct: counts.acceptPct },
      existing: existing ? {
        id: existing.id, version: existing.version, row_version: existing.row_version, status: existing.status,
        instruments: [...prepared.present.values()].sort((a, b) => a.localeCompare(b, 'vi')), replaces: prepared.replaces, needs_reason: needsReason(prepared),
      } : null,
    } };
  }

  const importEqaRound = writeCommand(db, 'importEqaRound', 'write', (w, raw: unknown): IpcResult<EqaRoundView> => {
    const prepared = prepare(raw);
    const { input, check, programId, existing } = prepared;
    if (check.blocking) return fail('blocking', `Còn ${check.blocking} lỗi chặn trong dữ liệu nhập. Xem trước để sửa trước khi ghi.`);
    const replaceReason = text(input.replaceReason, 1000);
    const replacing = needsReason(prepared);
    if (existing) {
      if (replacing && replaceReason.length < 10) {
        return fail('replace-reason', existing.status !== 'open'
          ? 'Kỳ này đã bị huỷ. Ghi lý do nhập lại (ít nhất 10 ký tự).'
          : `Kỳ này đã có kết quả của ${prepared.replaces.join(', ')}. Ghi lý do nhập lại (ít nhất 10 ký tự); phiên bản cũ vẫn được giữ.`);
      }
      if (input.expectedVersion !== undefined && Number(input.expectedVersion) !== existing.row_version) return fail('stale', 'Kỳ ngoại kiểm vừa được người khác cập nhật, hãy xem trước lại.');
    }
    const source = 'pdf';
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
        db.prepare(`UPDATE eqa_rounds SET report_code=?,report_date=?,assigned_level=?,source=?,source_name=?,status='open',
          version=?,row_version=row_version+1,updated_at=? WHERE id=?`)
          .run(round.reportCode, round.reportDate, round.assignedLevel, source, sourceName, version, now, roundId);
      } else {
        db.prepare(`INSERT INTO eqa_rounds(id,program_id,year,round,round_no,report_code,report_date,assigned_level,source,source_name,status,version,row_version,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,'open',1,1,?,?)`)
          .run(roundId, pid, round.year, round.round, eqaRoundNumber(round.round), round.reportCode, round.reportDate, round.assignedLevel, source, sourceName, now, now);
      }
      const insert = db.prepare(`INSERT INTO eqa_results(id,round_id,version,test_id,code,instrument_label,sample,unit,result,assigned,sigma_p,z,z_provider,z_official,pct,class,
        provider_check,method,peer_group,peer_json,warnings_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      // Giữ kết quả hiện hành của các máy không có trong lần nhập này.
      if (existing && prepared.present.size) {
        const previous = db.prepare('SELECT e.*, t.instrument_id FROM eqa_results e JOIN tests t ON t.id=e.test_id WHERE e.round_id=? AND e.version=?')
          .all(existing.id, existing.version) as Record<string, unknown>[];
        for (const old of previous) {
          if (prepared.incoming.has(String(old.instrument_id))) continue;
          insert.run(uid(), roundId, version, old.test_id, old.code, old.instrument_label, old.sample, old.unit, old.result, old.assigned, old.sigma_p,
            old.z, old.z_provider, old.z_official, old.pct, old.class, old.provider_check, old.method, old.peer_group, old.peer_json, old.warnings_json);
        }
      }
      for (const row of check.rows) {
        insert.run(uid(), roundId, version, row.testId, row.code, row.instrument, row.sample, row.unit, row.result, row.assigned, row.sigmaP,
          row.z, row.zProvider, row.zOfficial, row.pct, row.cls, row.providerCheck, row.method, row.peerGroup, JSON.stringify(row.peer), JSON.stringify(row.warnings));
      }
      const decide = db.prepare('INSERT INTO eqa_decisions(id,round_id,type,payload_json,actor_user_id,actor_name,decided_at) VALUES (?,?,?,?,?,?,?)');
      const actorName = w.actor.name || w.actor.username;
      const kind = !existing ? 'import' : replacing ? 'reimport' : 'append';
      decide.run(uid(), roundId, kind, JSON.stringify({
        source, sourceName, version, rows: counts.total, ok: counts.ok, warn: counts.warn, rej: counts.rej,
        replaces: prepared.replaces, reason: replacing ? replaceReason : '',
      }), w.actor.userId, actorName, now);
      const label = `${round.program} · ${round.round}/${round.year}`;
      tx.audit(kind === 'import' ? 'Nhập kỳ ngoại kiểm' : kind === 'append' ? 'Bổ sung máy vào kỳ ngoại kiểm' : 'Nhập lại kỳ ngoại kiểm',
        `${label} · ${counts.total} kết quả (${counts.ok} ${EQA_CLASS_LABEL.ok.toLowerCase()}, ${counts.warn} cảnh báo, ${counts.rej} không chấp nhận)${existing ? ` · phiên bản ${version}` : ''}${replacing ? `: ${replaceReason}` : ''}`, label);
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

  const ROUND_SQL = `SELECT r.id, r.program_id, r.year, r.round, r.round_no, r.report_code, r.report_date, r.assigned_level, r.source, r.source_name,
    r.status, r.version, r.row_version, r.created_at, r.updated_at, p.name AS program_name, p.provider, p.program_code, p.unit_code
    FROM eqa_rounds r JOIN eqa_programs p ON p.id=r.program_id`;

  /** Chuỗi z của một xét nghiệm qua các đợt đang dùng (phiên bản hiện hành). */
  function seriesOf(testId: string): EqaSeriesResult & { meta: Map<string, { round_id: string; report_date: string; pct: number | null }> } {
    const rows = db.prepare(`SELECT e.id, e.z_official, e.sample, e.pct, r.id AS round_id, r.program_id, r.year, r.round, r.round_no, r.report_date
      FROM eqa_results e JOIN eqa_rounds r ON r.id=e.round_id AND e.version=r.version
      WHERE r.status='open' AND e.test_id=?`).all(testId) as { id: string; z_official: number; sample: string; pct: number | null; round_id: string; program_id: string; year: number; round: string; round_no: number; report_date: string }[];
    const result = eqaSeries(rows.map((r) => ({ id: r.id, year: r.year, roundNo: r.round_no, round: r.round, sample: r.sample, z: r.z_official, roundId: r.round_id, programId: r.program_id, reportDate: r.report_date })), readEqaConfig(db));
    return { ...result, meta: new Map(rows.map((r) => [r.id, { round_id: r.round_id, report_date: r.report_date, pct: r.pct }])) };
  }

  /** Kết quả hiện hành của một kỳ kèm so sánh nhóm, độ tin cậy giá trị ấn định
   * và tín hiệu chuỗi — chỉ trang chi tiết kỳ cần. */
  function resultRows(roundId: string, version: number): EqaResultRow[] {
    const rows = db.prepare(`SELECT e.id, e.test_id, e.code, e.instrument_label, e.sample, e.unit, e.result, e.assigned, e.sigma_p, e.z, e.z_provider,
      e.z_official, e.pct, e.class, e.provider_check, e.method, e.peer_group, e.peer_json, e.warnings_json,
      COALESCE(NULLIF(t.display_name,''), t.name) AS test_name, t.instrument_id, i.name AS instrument_name
      FROM eqa_results e JOIN tests t ON t.id=e.test_id JOIN instruments i ON i.id=t.instrument_id
      WHERE e.round_id=? AND e.version=? ORDER BY i.name, test_name, e.sample`).all(roundId, version) as unknown as (Omit<EqaResultRow, 'peer' | 'warnings' | 'assigned_check' | 'tea_pct' | 'within_tea' | 'trend'> & { peer_json: string; warnings_json: string })[];
    const series = new Map<string, EqaSeriesResult>();
    const teaOf = operationalTeaResolver(db);
    return rows.map(({ peer_json, warnings_json, ...row }) => {
      const peer = parseJson<EqaPeer>(peer_json, {});
      const check = eqaAssignedUncertainty(row.result, row.assigned, row.sigma_p, peer);
      if (!series.has(row.test_id)) series.set(row.test_id, seriesOf(row.test_id));
      const point = series.get(row.test_id)?.points.find((p) => p.id === row.id);
      // TEa vận hành (hồ sơ TEa PXN trước, TEa chung vì mẫu ngoại kiểm không
      // ứng với mức QC nào), quy đổi giới hạn tuyệt đối tại giá trị ấn định
      // của mẫu. Thiếu TEa thì để trống, không báo "Vượt TEa".
      const tea = teaOf(row.test_id, row.assigned)?.value ?? null;
      return {
        ...row, peer: eqaPeerComparison(row.result, peer), warnings: parseJson<string[]>(warnings_json, []),
        assigned_check: check ? { level: check.level, n: check.n, u: check.u, ratio: check.ratio, uncertain: check.uncertain, z_prime: check.zPrime } : null,
        tea_pct: tea, within_tea: tea !== null && row.pct !== null ? Math.abs(row.pct) <= tea : null,
        trend: point ? { signals: point.signals, unsuccessful: point.unsuccessful, j: point.j, enough: series.get(row.test_id)!.enough } : null,
      };
    });
  }

  /** Chuỗi của một xét nghiệm cho biểu đồ z và bảng điểm J (N-07). */
  function getEqaSeries(testId: unknown): EqaSeriesView | null {
    const id = cleanId(testId);
    const test = db.prepare(`SELECT t.id, COALESCE(NULLIF(t.display_name,''), t.name) AS test_name, t.unit, t.instrument_id, i.name AS instrument_name
      FROM tests t JOIN instruments i ON i.id=t.instrument_id WHERE t.id=?`).get(id) as { id: string; test_name: string; unit: string; instrument_id: string; instrument_name: string } | undefined;
    if (!test) return null;
    const series = seriesOf(id);
    return {
      test_id: test.id, test_name: test.test_name, instrument_id: test.instrument_id, instrument_name: test.instrument_name, unit: test.unit, enough: series.enough, rounds: series.rounds,
      j_limit: EQA_SERIES_DEFAULTS.jLimit, min_points: EQA_SERIES_DEFAULTS.minPoints,
      points: series.points.map((p) => {
        const meta = series.meta.get(p.id)!;
        return { result_id: p.id, round_id: meta.round_id, year: p.year, round: p.round, sample: p.sample, report_date: meta.report_date,
          z: p.z, class: p.cls, pct: meta.pct, j: p.j, signals: p.signals, unsuccessful: p.unsuccessful };
      }),
    };
  }

  /** Xét nghiệm có tín hiệu hoặc không thành công ở đợt mới nhất (N5): xét
   * MỌI mẫu của đợt mới nhất của từng chương trình, không chỉ mẫu cuối —
   * mẫu không đạt đứng trước trong cùng đợt từng bị bỏ sót. Dòng hiện kết
   * quả nặng nhất và hợp mọi tín hiệu của các mẫu đó. */
  function listEqaAttention(): EqaAttentionRow[] {
    const tests = db.prepare(`SELECT DISTINCT e.test_id FROM eqa_results e JOIN eqa_rounds r ON r.id=e.round_id AND e.version=r.version WHERE r.status='open'`).all() as { test_id: string }[];
    const severity = (p: EqaSeriesResult['points'][number]) => (p.unsuccessful ? 4 : 0) + (p.cls === 'rej' ? 2 : 0) + Math.abs(p.z) / 100;
    return tests.flatMap(({ test_id }) => {
      const test = db.prepare(`SELECT COALESCE(NULLIF(t.display_name,''), t.name) AS test_name, t.instrument_id, i.name AS instrument_name
        FROM tests t JOIN instruments i ON i.id=t.instrument_id WHERE t.id=?`).get(test_id) as { test_name: string; instrument_id: string; instrument_name: string } | undefined;
      if (!test) return [];
      const series = seriesOf(test_id);
      // Điểm đã xếp theo thời gian: đợt cuối cùng gặp của mỗi chương trình là đợt mới nhất.
      const latestRound = new Map<string, string>();
      for (const p of series.points) latestRound.set(p.programId ?? '', p.roundId ?? '');
      const latestIds = new Set(latestRound.values());
      const flagged = series.points.filter((p) => latestIds.has(p.roundId ?? '') && (p.signals.length || p.unsuccessful));
      if (!flagged.length) return [];
      const worst = flagged.reduce((a, b) => (severity(b) > severity(a) ? b : a));
      const signals = EQA_SIGNAL_ORDER.filter((s) => flagged.some((p) => p.signals.includes(s)));
      return [{ test_id, test_name: test.test_name, instrument_id: test.instrument_id, instrument_name: test.instrument_name, points: series.points.length, flagged: flagged.length,
        latest: { round_id: worst.roundId ?? '', year: worst.year, round: worst.round, sample: worst.sample, z: worst.z, class: worst.cls, signals, unsuccessful: flagged.some((p) => p.unsuccessful) } }];
    }).sort((a, b) => Number(b.latest.unsuccessful) - Number(a.latest.unsuccessful) || a.instrument_name.localeCompare(b.instrument_name, 'vi') || a.test_name.localeCompare(b.test_name, 'vi'));
  }

  interface ResultBrief { class: EqaClass; instrument_id: string; instrument_name: string }

  function instrumentSummaries(results: readonly ResultBrief[]): EqaInstrumentSummary[] {
    const byInstrument = new Map<string, ResultBrief[]>();
    for (const r of results) byInstrument.set(r.instrument_id, [...(byInstrument.get(r.instrument_id) ?? []), r]);
    return [...byInstrument.values()].map((list) => {
      const c = eqaCounts(list.map((r) => r.class));
      return { instrument_id: list[0].instrument_id, instrument_name: list[0].instrument_name, total: c.total, ok: c.ok, warn: c.warn, rej: c.rej, accept_pct: c.acceptPct };
    }).sort((a, b) => a.instrument_name.localeCompare(b.instrument_name, 'vi'));
  }

  /** Kết quả rút gọn (xếp loại, máy) của phiên bản hiện hành, gom theo đợt. */
  function briefsByRound(where = '', ...params: (string | number)[]): Map<string, ResultBrief[]> {
    const rows = db.prepare(`SELECT e.round_id, e.class, t.instrument_id, i.name AS instrument_name FROM eqa_results e JOIN eqa_rounds r ON r.id=e.round_id AND e.version=r.version
      JOIN tests t ON t.id=e.test_id JOIN instruments i ON i.id=t.instrument_id ${where}`).all(...params) as (ResultBrief & { round_id: string })[];
    const out = new Map<string, ResultBrief[]>();
    for (const b of rows) out.set(b.round_id, [...(out.get(b.round_id) ?? []), b]);
    return out;
  }

  /** Máy chưa có báo cáo của từng đợt, theo các đợt cùng chương trình–năm. */
  function missingByRound(rounds: readonly Record<string, unknown>[], briefs: ReadonlyMap<string, readonly ResultBrief[]>): Map<string, EqaRoundRow['missing_instruments']> {
    const names = new Map<string, string>();
    for (const list of briefs.values()) for (const b of list) names.set(b.instrument_id, b.instrument_name);
    const missing = eqaMissingInstruments(rounds.map((r) => ({
      id: String(r.id), programId: String(r.program_id), year: Number(r.year), status: String(r.status),
      instrumentIds: [...new Set((briefs.get(String(r.id)) ?? []).map((b) => b.instrument_id))],
    })));
    return new Map([...missing].map(([roundId, ids]) => [roundId, ids
      .map((id) => ({ instrument_id: id, instrument_name: names.get(id) ?? '' }))
      .sort((a, b) => a.instrument_name.localeCompare(b.instrument_name, 'vi'))]));
  }

  function toRoundRow(row: Record<string, unknown>, results: readonly ResultBrief[], missing: EqaRoundRow['missing_instruments'] = []): EqaRoundRow {
    const counts = eqaCounts(results.map((r) => r.class));
    const byInstrument = instrumentSummaries(results);
    return {
      ...(row as unknown as EqaRoundRow),
      total: counts.total, ok: counts.ok, warn: counts.warn, rej: counts.rej, accept_pct: counts.acceptPct,
      instruments: byInstrument.map((i) => i.instrument_name), by_instrument: byInstrument, missing_instruments: missing,
    };
  }

  /** Danh sách chỉ cần đếm xếp loại theo máy, không dựng lại từng kết quả. */
  function listEqaRounds(): EqaRoundRow[] {
    const rounds = db.prepare(`${ROUND_SQL} ORDER BY r.year DESC, r.round_no DESC, p.name`).all() as Record<string, unknown>[];
    const briefs = briefsByRound();
    const missing = missingByRound(rounds, briefs);
    return rounds.map((row) => toRoundRow(row, briefs.get(String(row.id)) ?? [], missing.get(String(row.id))));
  }

  /** Lưới z của một máy trong một chương trình–năm: mỗi xét nghiệm một dòng,
   * mỗi đợt đang dùng một ô (một đợt có thể có nhiều mẫu). */
  function getEqaInstrumentGrid(raw: unknown): EqaInstrumentGridRow[] {
    const input = objectInput(raw);
    const programId = cleanId(input.programId), instrumentId = cleanId(input.instrumentId), year = Number(input.year);
    if (!programId || !instrumentId || !Number.isInteger(year)) return [];
    const rows = db.prepare(`SELECT e.id, e.test_id, e.sample, e.z_official, e.class, e.round_id, t.unit,
      COALESCE(NULLIF(t.display_name,''), t.name) AS test_name
      FROM eqa_results e JOIN eqa_rounds r ON r.id=e.round_id AND e.version=r.version JOIN tests t ON t.id=e.test_id
      WHERE r.status='open' AND r.program_id=? AND r.year=? AND t.instrument_id=?
      ORDER BY test_name, e.sample`).all(programId, year, instrumentId) as
      { id: string; test_id: string; sample: string; z_official: number; class: EqaClass; round_id: string; unit: string; test_name: string }[];
    const byTest = new Map<string, EqaInstrumentGridRow>();
    for (const r of rows) {
      const entry = byTest.get(r.test_id) ?? { test_id: r.test_id, test_name: r.test_name, unit: r.unit, cells: [] };
      entry.cells.push({ round_id: r.round_id, result_id: r.id, sample: r.sample, z: r.z_official, class: r.class });
      byTest.set(r.test_id, entry);
    }
    return [...byTest.values()];
  }

  function getEqaRound(id: unknown): EqaRoundView | null {
    const row = db.prepare(`${ROUND_SQL} WHERE r.id=?`).get(cleanId(id)) as Record<string, unknown> | undefined;
    if (!row) return null;
    const results = resultRows(String(row.id), Number(row.version));
    const config = readEqaConfig(db);
    // Máy còn thiếu cần mọi đợt cùng chương trình–năm.
    const siblings = db.prepare(`${ROUND_SQL} WHERE r.program_id=? AND r.year=?`).all(String(row.program_id), Number(row.year)) as Record<string, unknown>[];
    const missing = missingByRound(siblings, briefsByRound('WHERE r.program_id=? AND r.year=?', String(row.program_id), Number(row.year)));
    const round = toRoundRow(row, results, missing.get(String(row.id)));
    return {
      round, results,
      decisions: db.prepare('SELECT id, type, payload_json, actor_name, decided_at FROM eqa_decisions WHERE round_id=? ORDER BY decided_at, rowid').all(row.id) as unknown as EqaDecisionRow[],
      instruments: round.by_instrument,
      config: { z_warn: config.zWarn, z_reject: config.zReject },
    };
  }

  return { listEqaRounds, getEqaRound, getEqaSeries, getEqaInstrumentGrid, listEqaAttention, previewEqaImport, importEqaRound, cancelEqaRound };
}
