// Handler phân hệ Ngoại kiểm (docs/EQA-PLAN-2026-10-28.md): xem trước và nhập
// một kỳ, huỷ kỳ, đọc danh sách, chi tiết và chuỗi theo xét nghiệm. Mọi phép
// tính (z, xếp loại, đối chiếu nhà cung cấp, tín hiệu chuỗi) chạy lại ở đây
// bằng `domain/eqa/*`; renderer chỉ gửi dữ liệu thô đã đọc từ báo cáo PDF.
import type { Db } from '../db/sqlite-like';
import { createEqaCorrectiveReader } from './eqa-corrective-reader';
import type {
  EqaAttentionRow, EqaDecisionRow, EqaImportInput, EqaImportPreview, EqaInstrumentGridRow, EqaInstrumentSummary, EqaResultRow, EqaRoundRow,
  EqaRoundView, EqaSeriesView, EqaProgramOption, EqaScheduleInstrument, EqaScheduleRow, EqaAssigneeOption,
} from '../../shared/qc-api';
import { daysBetween, eqaScheduleStatus, validateEqaSchedule } from '../domain/eqa/schedule';
import { isoLocalDate, viDate } from '../domain/local-date';
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
import { createEqaReportHandlers } from './eqa-report-handlers';

const fail = <T>(code: string, message: string): IpcResult<T> => ({ ok: false, error: { code, message } });
const objectInput = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
const parseJson = <T>(raw: string, fallback: T): T => { try { return JSON.parse(raw || '') as T; } catch { return fallback; } };

/** Hai màn chi tiết dùng cùng căn cứ lưu ý; không đổi xếp loại nhà cung cấp. */
function resultChecks(row: Pick<EqaResultRow, 'result' | 'assigned' | 'sigma_p' | 'provider_check'>, peer: EqaPeer, warnings: string[]): Pick<EqaResultRow, 'assigned_check' | 'provider_check' | 'warnings'> {
  const check = eqaAssignedUncertainty(row.result, row.assigned, row.sigma_p, peer);
  return { provider_check: row.provider_check, warnings,
    assigned_check: check ? { level: check.level, n: check.n, u: check.u, ratio: check.ratio, uncertain: check.uncertain, z_prime: check.zPrime } : null };
}

/** Các bảng một lần ghi ngoại kiểm có thể đổi; renderer nghe `eqa_rounds`. */
const EQA_TABLES = ['eqa_programs', 'eqa_test_map', 'eqa_rounds', 'eqa_results', 'eqa_decisions'];

interface RoundRecord {
  id: string; program_id: string; year: number; round: string; status: string; version: number; row_version: number;
  report_code: string; report_date: string; assigned_level: string;
}

function readEqaConfig(db: Db): EqaConfig {
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

  /** Khoá thay kết quả trong một kỳ: máy + mẫu (R02 rà soát 10/11/2026). Một
   * đợt VEQAS gồm nhiều mẫu, mỗi mẫu một tệp PDF (N-16 trong
   * `docs/EQA-REVIEW-2026-10-28.md`): nhập mẫu khác của cùng máy là bổ sung,
   * chỉ nhập lại đúng mẫu đã có mới là thay. */
  const slotKey = (instrumentId: string, sample: unknown) => `${instrumentId}\u0000${eqaNormalize(sample)}`;

  /** Máy + mẫu của các kết quả đang hiện hành trong một kỳ (khoá → nhãn). */
  function currentSlots(round: RoundRecord): Map<string, string> {
    const rows = db.prepare(`SELECT DISTINCT t.instrument_id, i.name, e.sample FROM eqa_results e JOIN tests t ON t.id=e.test_id JOIN instruments i ON i.id=t.instrument_id
      WHERE e.round_id=? AND e.version=?`).all(round.id, round.version) as { instrument_id: string; name: string; sample: string }[];
    return new Map(rows.map((row) => [slotKey(row.instrument_id, row.sample), row.sample ? `${row.name} (mẫu ${row.sample})` : row.name]));
  }

  /** Máy của các kết quả đang hiện hành trong một kỳ (id → tên). */
  function currentInstruments(round: RoundRecord): Map<string, string> {
    const rows = db.prepare(`SELECT DISTINCT t.instrument_id, i.name FROM eqa_results e JOIN tests t ON t.id=e.test_id JOIN instruments i ON i.id=t.instrument_id
      WHERE e.round_id=? AND e.version=?`).all(round.id, round.version) as { instrument_id: string; name: string }[];
    return new Map(rows.map((row) => [row.instrument_id, row.name]));
  }

  function findRound(programId: string | undefined, year: number | null, round: string): RoundRecord | undefined {
    if (!programId || year === null) return undefined;
    const rows = db.prepare('SELECT id, program_id, year, round, status, version, row_version, report_code, report_date, assigned_level FROM eqa_rounds WHERE program_id=? AND year=?').all(programId, year) as unknown as RoundRecord[];
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
    /** Máy đang có kết quả hiện hành trong kỳ (id → tên) và nhãn máy + mẫu mà lần nhập này thay kết quả. */
    present: Map<string, string>; replaces: string[];
    /** Máy + mẫu (`slotKey`) của các dòng trong lần nhập này. */
    incoming: Set<string>;
    /** Máy của các dòng trong lần nhập này. */
    incomingInstruments: string[];
    /** Đợt đang dùng và mọi dòng nhập trùng khớp kết quả hiện hành: lưu lại không tạo phiên bản mới. */
    unchanged: boolean;
  }

  /** Nội dung số liệu của một dòng, để so lần nhập lại với kết quả đang lưu. */
  const rowContent = (r: readonly unknown[]) => JSON.stringify(r.map((v) => (typeof v === 'string' ? v.trim() : v ?? null)));

  function prepare(raw: unknown): Prepared {
    const input = objectInput(objectInput(raw).data) as unknown as EqaImportInput;
    const tests = catalogTests();
    const testIds = new Set(tests.map((t) => t.id));
    const programId = findProgram(objectInput(input.round))?.id;
    const check = checkEqaImport({ round: input.round, rows: input.rows }, { tests, mapping: mappingFor(programId, input, testIds), config: readEqaConfig(db) });
    const existing = findRound(programId, check.round.year, check.round.round);
    // Một kỳ gom kết quả của nhiều máy và nhiều mẫu (báo cáo PDF: mỗi máy, mỗi
    // mẫu một file). Nhập máy hoặc mẫu mới là bổ sung; chỉ kết quả của đúng
    // máy + mẫu đã có mới bị thay. Mở lại đợt đã huỷ cũng giữ kết quả các máy
    // khác của phiên bản cuối (E-13), lần nhập chỉ thay đúng máy + mẫu của nó.
    const present = existing ? currentInstruments(existing) : new Map<string, string>();
    const slots = existing ? currentSlots(existing) : new Map<string, string>();
    const instrumentOf = new Map(tests.map((t) => [t.id, t.instrument_id]));
    const incomingInstruments = [...new Set(check.rows.flatMap((row) => {
      const instrumentId = row.testId ? instrumentOf.get(row.testId) : undefined;
      return instrumentId ? [instrumentId] : [];
    }))].sort();
    const incoming = new Set(check.rows.flatMap((row) => {
      const instrumentId = row.testId ? instrumentOf.get(row.testId) : undefined;
      return instrumentId ? [slotKey(instrumentId, row.sample)] : [];
    }));
    const replaces = [...slots].filter(([key]) => incoming.has(key)).map(([, label]) => label);
    let unchanged = false;
    if (existing?.status === 'open' && check.rows.length && [...incoming].every((key) => slots.has(key))
      && existing.report_code === check.round.reportCode && existing.report_date === check.round.reportDate && existing.assigned_level === check.round.assignedLevel) {
      const stored = (db.prepare(`SELECT e.test_id,e.code,e.instrument_label,e.sample,e.unit,e.result,e.assigned,e.sigma_p,e.z_provider,e.method,e.peer_group,e.peer_json,t.instrument_id
        FROM eqa_results e JOIN tests t ON t.id=e.test_id WHERE e.round_id=? AND e.version=?`).all(existing.id, existing.version) as Record<string, unknown>[])
        .filter((r) => incoming.has(slotKey(String(r.instrument_id), r.sample)))
        .map((r) => rowContent([r.test_id, r.code, r.instrument_label, r.sample, r.unit, r.result, r.assigned, r.sigma_p, r.z_provider, r.method, r.peer_group, r.peer_json])).sort();
      const next = check.rows.map((r) => rowContent([r.testId, r.code, r.instrument, r.sample, r.unit, r.result, r.assigned, r.sigmaP, r.zProvider, r.method, r.peerGroup, JSON.stringify(r.peer)])).sort();
      unchanged = stored.length === next.length && stored.every((v, i) => v === next[i]);
    }
    return { input, check, programId, existing, present, replaces, incoming, incomingInstruments, unchanged };
  }

  /** Nhập vào kỳ đã có cần lý do khi thay kết quả của máy đã có hoặc mở lại kỳ đã huỷ. */
  // Chỉ thay số liệu của máy + mẫu đã có hoặc mở lại đợt đã huỷ mới cần lý do.
  // Bổ sung máy/mẫu mới vào đợt đã ký không sửa số liệu đã xem xét (N-08, kế
  // hoạch 2c, chốt 17/11/2026): bản ký riêng từng máy giữ hiệu lực.
  const needsReason = (p: Prepared) => !!p.existing && !p.unchanged && (p.existing.status !== 'open' || p.replaces.length > 0);

  /** Đợt đang có phiếu sơ khởi/phân tích "Tất cả máy" ký trên phiên bản hiện hành:
   * bổ sung máy làm phiếu đó cần ký lại để bao gồm máy mới. */
  const reviewedAllMachines = (p: Prepared) => !!p.existing && p.existing.status === 'open'
    && (db.prepare("SELECT payload_json FROM eqa_decisions WHERE round_id=? AND type IN ('preliminary_review','analysis_review')").all(p.existing.id) as { payload_json: string }[])
      .some((d) => {
        const payload = parseJson<{ scope?: { instrumentId?: string }; snapshot?: { rounds?: EqaRoundView[] } }>(d.payload_json, {});
        return !payload.scope?.instrumentId && !!payload.snapshot?.rounds?.some((r) => r.round.id === p.existing!.id && r.round.version === p.existing!.version);
      });

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
        instruments: [...prepared.present.values()].sort((a, b) => a.localeCompare(b, 'vi')), replaces: prepared.replaces, needs_reason: needsReason(prepared), unchanged: prepared.unchanged,
        reviewed_all: !prepared.unchanged && reviewedAllMachines(prepared),
      } : null,
    } };
  }

  const importEqaRound = writeCommand(db, 'importEqaRound', 'write', (w, raw: unknown): IpcResult<EqaRoundView> => {
    const prepared = prepare(raw);
    const { input, check, programId, existing } = prepared;
    if (check.blocking) return fail('blocking', `Còn ${check.blocking} lỗi chặn trong dữ liệu nhập. Xem trước để sửa trước khi ghi.`);
    if (input.sourceFiles !== undefined && (!Array.isArray(input.sourceFiles) || input.sourceFiles.length > 200
      || !input.sourceFiles.every((f) => f && typeof f.fileName === 'string' && f.fileName.trim().length > 0 && f.fileName.length <= 300
        && typeof f.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(f.sha256)
        && typeof f.creationDate === 'string' && (f.creationDate === '' || /^\d{4}-\d{2}-\d{2}$/.test(f.creationDate))))) return fail('source-files', 'Dấu vết tệp PDF không hợp lệ. Chọn lại tệp trước khi nhập.');
    const sourceFiles = input.sourceFiles?.map((f) => ({ fileName: f.fileName.trim(), sha256: f.sha256.toLowerCase(), creationDate: f.creationDate }));
    // Nhập lại đúng số liệu đang lưu: không tạo phiên bản mới, không làm chữ ký mất hiệu lực.
    if (prepared.unchanged && existing) return w.noChange(getEqaRound(existing.id)!);
    const replaceReason = text(input.replaceReason, 1000);
    const replacing = needsReason(prepared);
    if (existing) {
      if (replacing && replaceReason.length < 10) {
        return fail('replace-reason', existing.status !== 'open'
          ? 'Kỳ này đã bị huỷ. Ghi lý do nhập lại (ít nhất 10 ký tự).'
          : 'Kỳ này đã có kết quả hoặc đã được xem xét. Ghi lý do nhập lại (ít nhất 10 ký tự); phiên bản cũ vẫn được giữ.');
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
      // Giữ kết quả hiện hành của các máy + mẫu không có trong lần nhập này.
      if (existing && prepared.present.size) {
        const previous = db.prepare('SELECT e.*, t.instrument_id FROM eqa_results e JOIN tests t ON t.id=e.test_id WHERE e.round_id=? AND e.version=?')
          .all(existing.id, existing.version) as Record<string, unknown>[];
        for (const old of previous) {
          if (prepared.incoming.has(slotKey(String(old.instrument_id), old.sample))) continue;
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
      // Máy, mã và ngày báo cáo của chính lần nhập: phiếu xem xét theo máy lấy
      // nguồn của đúng máy đó, không lấy báo cáo của máy nhập sau.
      decide.run(uid(), roundId, kind, JSON.stringify({
        source, sourceName, sourceFiles, version, rows: counts.total, ok: counts.ok, warn: counts.warn, rej: counts.rej,
        replaces: prepared.replaces, reason: replacing ? replaceReason : '',
        instrumentIds: prepared.incomingInstruments, reportCode: round.reportCode, reportDate: round.reportDate,
      }), w.actor.userId, actorName, now);
      const label = `${round.program} · ${round.round}/${round.year}`;
      tx.audit(kind === 'import' ? 'Nhập kỳ ngoại kiểm' : kind === 'append' ? 'Bổ sung kết quả vào kỳ ngoại kiểm' : 'Nhập lại kỳ ngoại kiểm',
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
  type SeriesMeta = { round_id: string; report_date: string; pct: number | null; result: number; assigned: number; program_id: string; program_name: string };
  type SeriesWithMeta = EqaSeriesResult & { meta: Map<string, SeriesMeta> };
  type SeriesDbRow = { id: string; test_id: string; z_official: number; sample: string; year: number; round: string; round_no: number } & SeriesMeta;

  function buildSeries(rows: readonly SeriesDbRow[], config: EqaConfig): SeriesWithMeta {
    const result = eqaSeries(rows.map((r) => ({ id: r.id, year: r.year, roundNo: r.round_no, round: r.round, sample: r.sample,
      z: r.z_official, roundId: r.round_id, programId: r.program_id, reportDate: r.report_date })), config);
    return { ...result, meta: new Map(rows.map((r) => [r.id, { round_id: r.round_id, report_date: r.report_date,
      pct: r.pct, result: r.result, assigned: r.assigned, program_id: r.program_id, program_name: r.program_name }])) };
  }

  /** Đọc các chuỗi bằng một truy vấn. Trang chi tiết kỳ và danh sách cần chú
   * ý thường dùng nhiều xét nghiệm; truy vấn từng xét nghiệm gây N+1. */
  function seriesForTests(testIds: readonly string[], config: EqaConfig): Map<string, SeriesWithMeta> {
    const ids = [...new Set(testIds)].filter(Boolean);
    if (!ids.length) return new Map();
    const placeholders = ids.map(() => '?').join(',');
    const rows = db.prepare(`SELECT e.id, e.test_id, e.z_official, e.sample, e.pct, e.result, e.assigned, r.id AS round_id, r.program_id, r.year, r.round, r.round_no, r.report_date, p.name AS program_name
      FROM eqa_results e JOIN eqa_rounds r ON r.id=e.round_id AND e.version=r.version JOIN eqa_programs p ON p.id=r.program_id
      WHERE r.status='open' AND e.test_id IN (${placeholders})`).all(...ids) as SeriesDbRow[];
    const grouped = new Map<string, SeriesDbRow[]>();
    for (const row of rows) {
      const list = grouped.get(row.test_id);
      if (list) list.push(row); else grouped.set(row.test_id, [row]);
    }
    return new Map(ids.map((id) => [id, buildSeries(grouped.get(id) ?? [], config)]));
  }

  function seriesOf(testId: string, config: EqaConfig): SeriesWithMeta {
    return seriesForTests([testId], config).get(testId) ?? buildSeries([], config);
  }

  /** Kết quả hiện hành của một kỳ kèm so sánh nhóm, độ tin cậy giá trị ấn định
   * và tín hiệu chuỗi — chỉ trang chi tiết kỳ cần. */
  function resultRows(roundId: string, version: number): EqaResultRow[] {
    const rows = db.prepare(`SELECT e.id, e.test_id, e.code, e.instrument_label, e.sample, e.unit, e.result, e.assigned, e.sigma_p, e.z, e.z_provider,
      e.z_official, e.pct, e.class, e.provider_check, e.method, e.peer_group, e.peer_json, e.warnings_json,
      COALESCE(NULLIF(t.display_name,''), t.name) AS test_name, t.instrument_id, i.name AS instrument_name
      FROM eqa_results e JOIN tests t ON t.id=e.test_id JOIN instruments i ON i.id=t.instrument_id
      WHERE e.round_id=? AND e.version=? ORDER BY i.name, test_name, e.sample`).all(roundId, version) as unknown as (Omit<EqaResultRow, 'peer' | 'warnings' | 'assigned_check' | 'tea_pct' | 'within_tea' | 'trend'> & { peer_json: string; warnings_json: string })[];
    const config = readEqaConfig(db);
    const series = seriesForTests(rows.map((row) => row.test_id), config);
    const teaOf = operationalTeaResolver(db);
    return rows.map(({ peer_json, warnings_json, ...row }) => {
      const peer = parseJson<EqaPeer>(peer_json, {});
      const point = series.get(row.test_id)?.points.find((p) => p.id === row.id);
      // TEa vận hành (hồ sơ TEa PXN trước, TEa chung vì mẫu ngoại kiểm không
      // ứng với mức QC nào), quy đổi giới hạn tuyệt đối tại giá trị ấn định
      // của mẫu. Thiếu TEa thì để trống, không báo "Vượt TEa".
      const tea = teaOf(row.test_id, row.assigned)?.value ?? null;
      return {
        ...row, peer: eqaPeerComparison(row.result, peer), ...resultChecks(row, peer, parseJson<string[]>(warnings_json, [])),
        tea_pct: tea, within_tea: tea !== null && row.pct !== null ? Math.abs(row.pct) <= tea : null,
        // `enough` theo chương trình của chính kết quả này (N-07).
        trend: point ? { signals: point.signals, unsuccessful: point.unsuccessful, j: point.j,
          enough: series.get(row.test_id)!.programs.find((p) => p.programId === point.programId)?.enough ?? false } : null,
      };
    });
  }

  /** Chuỗi của một xét nghiệm cho biểu đồ z và bảng điểm J (N-07). */
  function getEqaSeries(testId: unknown): EqaSeriesView | null {
    const id = cleanId(testId);
    const test = db.prepare(`SELECT t.id, COALESCE(NULLIF(t.display_name,''), t.name) AS test_name, t.unit, t.instrument_id, i.name AS instrument_name
      FROM tests t JOIN instruments i ON i.id=t.instrument_id WHERE t.id=?`).get(id) as { id: string; test_name: string; unit: string; instrument_id: string; instrument_name: string } | undefined;
    if (!test) return null;
    const config = readEqaConfig(db);
    const series = seriesOf(id, config);
    // Đọc gộp căn cứ lưu ý của các phiên bản hiện hành, không gọi lại từng đợt.
    const checkRows = db.prepare(`SELECT e.id, e.result, e.assigned, e.sigma_p, e.provider_check, e.peer_json, e.warnings_json
      FROM eqa_results e JOIN eqa_rounds r ON r.id=e.round_id AND e.version=r.version
      WHERE r.status='open' AND e.test_id=?`).all(id) as (Pick<EqaResultRow, 'id' | 'result' | 'assigned' | 'sigma_p' | 'provider_check'> & { peer_json: string; warnings_json: string })[];
    const checks = new Map(checkRows.map(row => [row.id, resultChecks(row, parseJson<EqaPeer>(row.peer_json, {}), parseJson<string[]>(row.warnings_json, []))]));
    const teaOf = operationalTeaResolver(db);
    const programNames = new Map([...series.meta.values()].map((m) => [m.program_id, m.program_name]));
    return {
      test_id: test.id, test_name: test.test_name, instrument_id: test.instrument_id, instrument_name: test.instrument_name, unit: test.unit, enough: series.enough, rounds: series.rounds,
      programs: series.programs.map((p) => ({ program_id: p.programId, program_name: programNames.get(p.programId) ?? '', rounds: p.rounds, enough: p.enough })),
      config: { z_warn: config.zWarn, z_reject: config.zReject },
      j_limit: EQA_SERIES_DEFAULTS.jLimit, min_points: EQA_SERIES_DEFAULTS.minPoints,
      points: series.points.map((p) => {
        const meta = series.meta.get(p.id)!;
        // TEa vận hành quy đổi tại giá trị ấn định của từng mẫu, như bảng kết quả kỳ.
        const tea = teaOf(test.id, meta.assigned)?.value ?? null;
        return { result_id: p.id, round_id: meta.round_id, program_id: meta.program_id, program_name: meta.program_name, year: p.year, round: p.round, sample: p.sample, report_date: meta.report_date,
          result: meta.result, assigned: meta.assigned, z: p.z, class: p.cls, pct: meta.pct, tea_pct: tea, ...checks.get(p.id)!,
          within_tea: tea !== null && meta.pct !== null ? Math.abs(meta.pct) <= tea : null, j: p.j, signals: p.signals, unsuccessful: p.unsuccessful };
      }),
    };
  }

  /** Xét nghiệm có tín hiệu hoặc không thành công ở đợt mới nhất (N-06/N-07): xét
   * MỌI mẫu của đợt mới nhất, không chỉ mẫu cuối — mẫu không đạt đứng trước
   * trong cùng đợt từng bị bỏ sót. Mỗi dòng là một xét nghiệm trong MỘT chương
   * trình: gộp chương trình thì tín hiệu nặng ở chương trình này che mất
   * "không thành công" ở chương trình kia (N-09 bắt buộc điều tra cả hai).
   * Dòng hiện kết quả nặng nhất và hợp mọi tín hiệu của các mẫu đó. */
  function listEqaAttention(raw?: unknown): EqaAttentionRow[] {
    const input = objectInput(raw);
    const programId = cleanId(input.programId), instrumentId = cleanId(input.instrumentId);
    const hasYear = input.year !== undefined && input.year !== null;
    const year = Number(input.year);
    if ((input.programId && !programId) || (input.instrumentId && !instrumentId) || (hasYear && !Number.isInteger(year))) return [];
    const conditions = ["r.status='open'"];
    const params: (string | number)[] = [];
    if (programId) { conditions.push('r.program_id=?'); params.push(programId); }
    if (hasYear) { conditions.push('r.year=?'); params.push(year); }
    if (instrumentId) { conditions.push('t.instrument_id=?'); params.push(instrumentId); }
    const tests = db.prepare(`SELECT DISTINCT e.test_id, COALESCE(NULLIF(t.display_name,''), t.name) AS test_name,
      t.instrument_id, i.name AS instrument_name FROM eqa_results e
      JOIN eqa_rounds r ON r.id=e.round_id AND e.version=r.version
      JOIN tests t ON t.id=e.test_id JOIN instruments i ON i.id=t.instrument_id
      WHERE ${conditions.join(' AND ')}`).all(...params) as { test_id: string; test_name: string; instrument_id: string; instrument_name: string }[];
    const series = seriesForTests(tests.map((test) => test.test_id), readEqaConfig(db));
    const severity = (p: { unsuccessful: boolean; cls: string; z: number }) => (p.unsuccessful ? 4 : 0) + (p.cls === 'rej' ? 2 : 0) + Math.abs(p.z) / 100;
    return tests.flatMap((test) => {
      const testSeries = series.get(test.test_id);
      if (!testSeries) return [];
      // Tính chuỗi trên toàn lịch sử trước, rồi chọn đợt mới nhất trong phạm vi đọc.
      const byProgram = new Map<string, EqaSeriesResult['points']>();
      for (const p of testSeries.points) {
        if ((programId && p.programId !== programId) || (hasYear && p.year !== year)) continue;
        const list = byProgram.get(p.programId ?? '');
        if (list) list.push(p); else byProgram.set(p.programId ?? '', [p]);
      }
      return [...byProgram].flatMap(([program, points]) => {
        // Điểm đã xếp theo thời gian: điểm cuối là đợt mới nhất của chương trình.
        const latestId = points.at(-1)?.roundId ?? '';
        const flagged = points.filter((p) => (p.roundId ?? '') === latestId && (p.signals.length || p.unsuccessful));
        if (!flagged.length) return [];
        const worst = flagged.reduce((a, b) => (severity(b) > severity(a) ? b : a));
        const signals = EQA_SIGNAL_ORDER.filter((s) => flagged.some((p) => p.signals.includes(s)));
        return [{ test_id: test.test_id, test_name: test.test_name, instrument_id: test.instrument_id, instrument_name: test.instrument_name, points: points.length, flagged: flagged.length,
          latest: { round_id: worst.roundId ?? '', program_id: program, program_name: testSeries.meta.get(worst.id)?.program_name ?? '',
            year: worst.year, round: worst.round, sample: worst.sample, z: worst.z, class: worst.cls, signals, unsuccessful: flagged.some((p) => p.unsuccessful) } }];
      });
    }).sort((a, b) => Number(b.latest.unsuccessful) - Number(a.latest.unsuccessful) || a.instrument_name.localeCompare(b.instrument_name, 'vi')
      || a.test_name.localeCompare(b.test_name, 'vi') || severity({ ...b.latest, cls: b.latest.class }) - severity({ ...a.latest, cls: a.latest.class }));
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
    const names = new Map((db.prepare('SELECT id, name FROM instruments').all() as { id: string; name: string }[]).map((r) => [r.id, r.name]));
    const planned = new Map<string, string[]>();
    for (const r of db.prepare(`SELECT s.program_id, s.year, s.round_no, si.instrument_id FROM eqa_schedule s
      JOIN eqa_schedule_instruments si ON si.schedule_id=s.id`).all() as { program_id: string; year: number; round_no: number; instrument_id: string }[]) {
      const key = `${r.program_id}\u0000${r.year}\u0000${r.round_no}`;
      planned.set(key, [...(planned.get(key) ?? []), r.instrument_id]);
    }
    const missing = eqaMissingInstruments(rounds.map((r) => ({
      id: String(r.id), programId: String(r.program_id), year: Number(r.year), status: String(r.status),
      instrumentIds: [...new Set((briefs.get(String(r.id)) ?? []).map((b) => b.instrument_id))],
      expectedIds: planned.get(`${String(r.program_id)}\u0000${Number(r.year)}\u0000${Number(r.round_no)}`),
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
      // Lịch sử phục vụ rà soát thao tác gần nhất, nên luôn trả mới nhất trước.
      // `rowid DESC` giữ thứ tự đúng cả khi hai thao tác có cùng mili giây.
      decisions: db.prepare('SELECT id, type, payload_json, actor_name, decided_at FROM eqa_decisions WHERE round_id=? ORDER BY decided_at DESC, rowid DESC').all(row.id) as unknown as EqaDecisionRow[],
      instruments: round.by_instrument,
      config: { z_warn: config.zWarn, z_reject: config.zReject },
    };
  }

  // ---- Lịch đợt và hạn nộp ----

  const SCHEDULE_SQL = `SELECT s.*, p.name AS program_name, p.provider,
      (SELECT r.id FROM eqa_rounds r WHERE r.program_id=s.program_id AND r.year=s.year AND r.round_no=s.round_no AND r.status='open' LIMIT 1) AS round_id
    FROM eqa_schedule s JOIN eqa_programs p ON p.id=s.program_id`;
  type ScheduleDbRow = Omit<EqaScheduleRow, 'status' | 'days_left' | 'instruments'>;
  type ScheduleInstrumentDbRow = Omit<EqaScheduleInstrument, 'reported'> & { schedule_id: string };

  /** Máy khai cho các đợt trong lịch (id đợt lịch → máy); `scheduleId` để đọc một đợt. */
  function scheduleInstruments(scheduleId?: string): Map<string, ScheduleInstrumentDbRow[]> {
    const rows = db.prepare(`SELECT si.schedule_id, si.instrument_id, i.name AS instrument_name, si.submitted_at, si.submitted_by
      FROM eqa_schedule_instruments si JOIN instruments i ON i.id=si.instrument_id
      ${scheduleId ? 'WHERE si.schedule_id=?' : ''} ORDER BY i.name`).all(...(scheduleId ? [scheduleId] : [])) as unknown as ScheduleInstrumentDbRow[];
    const out = new Map<string, ScheduleInstrumentDbRow[]>();
    for (const row of rows) out.set(row.schedule_id, [...(out.get(row.schedule_id) ?? []), row]);
    return out;
  }

  /** Máy có kết quả ở phiên bản hiện hành của các đợt đang dùng (id đợt → máy). */
  function reportedInstruments(roundId?: string): Map<string, Set<string>> {
    const rows = db.prepare(`SELECT DISTINCT e.round_id, t.instrument_id FROM eqa_results e JOIN eqa_rounds r ON r.id=e.round_id AND e.version=r.version
      JOIN tests t ON t.id=e.test_id WHERE r.status='open' ${roundId ? 'AND r.id=?' : ''}`).all(...(roundId ? [roundId] : [])) as { round_id: string; instrument_id: string }[];
    const out = new Map<string, Set<string>>();
    for (const row of rows) out.set(row.round_id, (out.get(row.round_id) ?? new Set()).add(row.instrument_id));
    return out;
  }

  /** Đợt có khai máy: đã nộp khi mọi máy đã nộp hoặc đã có trong báo cáo; đã có
   * báo cáo khi báo cáo của trung tâm có đủ mọi máy. Đợt không khai máy giữ cách
   * tính cho cả đợt. */
  function toScheduleRow(row: ScheduleDbRow, machines: readonly ScheduleInstrumentDbRow[], reported: ReadonlyMap<string, ReadonlySet<string>>, today: string): EqaScheduleRow {
    const roundId = row.round_id || null;
    const present = roundId ? reported.get(roundId) : undefined;
    const instruments = machines.map(({ schedule_id: _scheduleId, ...m }) => ({ ...m, reported: !!present?.has(m.instrument_id) }));
    let { submitted_at, submitted_by } = row;
    if (instruments.length) {
      const done = instruments.every((m) => m.submitted_at || m.reported);
      const last = instruments.filter((m) => m.submitted_at).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0];
      submitted_at = done ? last?.submitted_at ?? '' : '';
      submitted_by = done ? last?.submitted_by ?? '' : '';
    }
    const fullyReported = !!roundId && instruments.every((m) => m.reported);
    return {
      ...row, submitted_at, submitted_by, instruments, round_id: roundId, days_left: daysBetween(today, row.due_date),
      status: eqaScheduleStatus({ due_date: row.due_date, submitted_at, reported: fullyReported }, today),
    };
  }

  function listEqaSchedule(): EqaScheduleRow[] {
    const today = isoLocalDate(), machines = scheduleInstruments(), reported = reportedInstruments();
    return (db.prepare(`${SCHEDULE_SQL} ORDER BY s.due_date, p.name`).all() as unknown as ScheduleDbRow[])
      .map((row) => toScheduleRow(row, machines.get(row.id) ?? [], reported, today));
  }
  const scheduleById = (id: string) => {
    const row = db.prepare(`${SCHEDULE_SQL} WHERE s.id=?`).get(id) as unknown as ScheduleDbRow | undefined;
    return row ? toScheduleRow(row, scheduleInstruments(id).get(id) ?? [], row.round_id ? reportedInstruments(row.round_id) : new Map(), isoLocalDate()) : null;
  };

  /** Chỉ đọc danh tính để chọn người; không mở thông tin quản trị tài khoản. */
  function listEqaAssignees(): EqaAssigneeOption[] {
    return db.prepare("SELECT id, COALESCE(NULLIF(name,''),username) AS name, username FROM users WHERE active<>0 ORDER BY name, username").all() as EqaAssigneeOption[];
  }

  /** Loại mẫu và máy gợi sẵn cùng lấy từ một lịch gần nhất; chưa có lịch thì
   * dùng thông tin chương trình và báo cáo. Không đổi nhãn các lịch đã lưu. */
  function listEqaPrograms(): EqaProgramOption[] {
    const programs = db.prepare('SELECT id, name, provider, sample_type FROM eqa_programs ORDER BY name').all() as unknown as Omit<EqaProgramOption, 'instrument_ids'>[];
    const latest = (rows: { program_id: string; owner: string; instrument_id: string }[]) => {
      const owner = new Map<string, string>(), out = new Map<string, string[]>();
      for (const r of rows) {
        if (!owner.has(r.program_id)) owner.set(r.program_id, r.owner);
        if (owner.get(r.program_id) === r.owner) out.set(r.program_id, [...(out.get(r.program_id) ?? []), r.instrument_id]);
      }
      return out;
    };
    const recent = new Map<string, { id: string; sample_type: string }>();
    for (const row of db.prepare('SELECT id,program_id,sample_type FROM eqa_schedule ORDER BY year DESC,round_no DESC,updated_at DESC,id').all() as { id: string; program_id: string; sample_type: string }[]) {
      if (!recent.has(row.program_id)) recent.set(row.program_id, row);
    }
    const machines = new Map<string, string[]>();
    for (const row of db.prepare(`SELECT si.schedule_id,si.instrument_id FROM eqa_schedule_instruments si
      JOIN instruments i ON i.id=si.instrument_id AND i.active=1 ORDER BY i.name`).all() as { schedule_id: string; instrument_id: string }[]) {
      machines.set(row.schedule_id, [...(machines.get(row.schedule_id) ?? []), row.instrument_id]);
    }
    const fromReports = latest(db.prepare(`SELECT DISTINCT r.program_id, r.id AS owner, t.instrument_id, r.year, r.round_no FROM eqa_rounds r
      JOIN eqa_results e ON e.round_id=r.id AND e.version=r.version JOIN tests t ON t.id=e.test_id JOIN instruments i ON i.id=t.instrument_id AND i.active=1
      WHERE r.status='open' ORDER BY r.year DESC, r.round_no DESC, r.id`).all() as { program_id: string; owner: string; instrument_id: string }[]);
    return programs.map((p) => {
      const plan = recent.get(p.id);
      return { ...p, sample_type: plan?.sample_type ?? p.sample_type, instrument_ids: plan ? machines.get(plan.id) ?? [] : fromReports.get(p.id) ?? [] };
    });
  }

  const instrumentNames = (ids: readonly string[]) => {
    const names = new Map((db.prepare('SELECT id, name FROM instruments').all() as { id: string; name: string }[]).map((r) => [r.id, r.name]));
    return ids.map((id) => names.get(id) ?? id);
  };

  /** Thêm/sửa một đợt trong lịch. Chương trình mới tạo theo tên + đơn vị tổ
   * chức, khớp với báo cáo PDF theo `findProgram()`. Cùng một đợt có thể có
   * nhiều lịch với các nhóm máy không giao nhau, loại mẫu và hạn nộp riêng. */
  const saveEqaSchedule = writeCommand(db, 'saveEqaSchedule', 'write', (w, raw: unknown): IpcResult<EqaScheduleRow> => {
    const input = objectInput(raw);
    const id = cleanId(input.id);
    const result = validateEqaSchedule(objectInput(input.data));
    if (!result.ok) return fail(result.code, result.message);
    const d = result.data;
    const existing = id ? db.prepare('SELECT * FROM eqa_schedule WHERE id=?').get(id) as Record<string, unknown> | undefined : undefined;
    if (id && !existing) return fail('not-found', 'Không tìm thấy đợt trong lịch.');
    let programId = d.programId;
    if (programId && !db.prepare('SELECT 1 FROM eqa_programs WHERE id=?').get(programId)) return fail('not-found', 'Không tìm thấy chương trình ngoại kiểm.');
    if (!programId) programId = findProgram({ program: d.programName, provider: d.provider })?.id ?? '';
    const known = new Set((db.prepare('SELECT id FROM instruments').all() as { id: string }[]).map((r) => r.id));
    if (d.instrumentIds.some((iid) => !known.has(iid))) return fail('invalid-instrument', 'Không tìm thấy máy xét nghiệm.');
    const siblings = programId ? db.prepare(`SELECT s.id,si.instrument_id FROM eqa_schedule s
      LEFT JOIN eqa_schedule_instruments si ON si.schedule_id=s.id
      WHERE s.program_id=? AND s.year=? AND s.round_no=? AND s.id<>?`).all(programId, d.year, d.roundNo, id) as { id: string; instrument_id: string | null }[] : [];
    if (siblings.length) {
      if (!d.instrumentIds.length || siblings.some((r) => !r.instrument_id)) {
        return fail('duplicate-round', `Đợt ${d.round}/${d.year} đã có lịch. Muốn chia hạn nộp riêng, cần khai rõ máy trong từng lịch, không dùng lịch chung chưa chọn máy.`);
      }
      const overlap = [...new Set(siblings.filter((r) => d.instrumentIds.includes(r.instrument_id!)).map((r) => r.instrument_id!))];
      if (overlap.length) return fail('duplicate-instrument', `${instrumentNames(overlap).join(', ')} đã có lịch ${d.round}/${d.year} của chương trình này. Sửa lịch đã có hoặc chọn máy khác.`);
    }
    const before = id ? db.prepare('SELECT instrument_id, submitted_at, submitted_by FROM eqa_schedule_instruments WHERE schedule_id=?').all(id) as { instrument_id: string; submitted_at: string; submitted_by: string }[] : [];
    // Dấu nộp/báo cáo thuộc đúng máy của lịch; không được gỡ để làm mất hồ sơ.
    const removedRecorded = (id ? scheduleById(id)!.instruments : []).filter((m) => (m.submitted_at || m.reported) && !d.instrumentIds.includes(m.instrument_id));
    if (removedRecorded.length) return fail('locked', `${instrumentNames(removedRecorded.map((m) => m.instrument_id)).join(', ')} đã nộp hoặc có báo cáo; không thể gỡ máy khỏi lịch này.`);
    // Dấu nộp gắn với đúng chương trình–năm–đợt của lịch (EQA-REVIEW mục 5): không
    // chuyển lịch đã có dấu nộp/báo cáo sang đợt khác, vì dấu nộp sẽ đi theo sai đợt.
    const recorded = !!existing && (!!existing.submitted_at || scheduleById(id)!.instruments.some((m) => m.submitted_at || m.reported));
    if (recorded && (existing!.program_id !== programId || existing!.year !== d.year || existing!.round_no !== d.roundNo)) {
      return fail('locked', 'Lịch đã có dấu nộp hoặc báo cáo; không thể chuyển sang chương trình, năm hoặc đợt khác. Thêm lịch mới cho đợt đó.');
    }
    const sameInstruments = before.length === d.instrumentIds.length && before.every((m) => d.instrumentIds.includes(m.instrument_id));
    const fields = [d.year, d.round, d.roundNo, d.sampleType, d.receiveDate, d.runDate, d.dueDate, d.assignee, d.note];
    if (existing && existing.program_id === programId && sameInstruments
      && fields.every((value, i) => existing[['year', 'round', 'round_no', 'sample_type', 'receive_date', 'run_date', 'due_date', 'assignee', 'note'][i]] === value)) {
      return w.noChange(scheduleById(id)!);
    }
    const savedId = id || uid();
    w.commit((tx) => {
      const now = nowIso();
      if (!programId) {
        programId = uid();
        db.prepare('INSERT INTO eqa_programs(id,name,provider,program_code,unit_code,created_at,sample_type) VALUES (?,?,?,?,?,?,?)').run(programId, d.programName, d.provider, '', '', now, d.sampleType);
      }
      if (existing) {
        db.prepare(`UPDATE eqa_schedule SET program_id=?,year=?,round=?,round_no=?,sample_type=?,receive_date=?,run_date=?,due_date=?,assignee=?,note=?,updated_at=? WHERE id=?`)
          .run(programId, ...fields, now, savedId);
      } else {
        db.prepare(`INSERT INTO eqa_schedule(id,program_id,year,round,round_no,sample_type,receive_date,run_date,due_date,assignee,note,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(savedId, programId, ...fields, now, now);
      }
      for (const m of before) {
        if (!d.instrumentIds.includes(m.instrument_id)) db.prepare('DELETE FROM eqa_schedule_instruments WHERE schedule_id=? AND instrument_id=?').run(savedId, m.instrument_id);
      }
      // Đợt đã đánh dấu nộp cả đợt trước khi khai máy: lần nộp đó phủ mọi máy.
      const inherited = !before.length && existing?.submitted_at ? [String(existing.submitted_at), String(existing.submitted_by ?? '')] : ['', ''];
      for (const iid of d.instrumentIds) {
        if (!before.some((m) => m.instrument_id === iid)) db.prepare('INSERT INTO eqa_schedule_instruments(schedule_id,instrument_id,submitted_at,submitted_by) VALUES (?,?,?,?)').run(savedId, iid, ...inherited);
      }
      const name = (db.prepare('SELECT name FROM eqa_programs WHERE id=?').get(programId) as { name: string }).name;
      const parts = [name, `${d.round}/${d.year}`, d.sampleType, `hạn nộp ${viDate(d.dueDate)}`,
        d.instrumentIds.length ? `máy: ${instrumentNames(d.instrumentIds).join(', ')}` : '', d.assignee ? `phụ trách ${d.assignee}` : ''];
      tx.audit(existing ? 'Sửa lịch ngoại kiểm' : 'Thêm lịch ngoại kiểm', parts.filter(Boolean).join(' · '), name);
      tx.changed(['eqa_schedule', 'eqa_programs']);
    });
    return { ok: true, data: scheduleById(savedId)! };
  });

  /** Đánh dấu đã nộp kết quả cho trung tâm (hoặc bỏ đánh dấu khi bấm nhầm).
   * Đợt có khai máy ghi theo từng máy: `instrumentIds` là các máy đã nộp. */
  const markEqaSubmitted = writeCommand(db, 'markEqaSubmitted', 'write', (w, raw: unknown): IpcResult<EqaScheduleRow> => {
    const input = objectInput(objectInput(raw).data);
    const id = cleanId(input.id), submitted = input.submitted === true;
    const row = scheduleById(id);
    if (!row) return fail('not-found', 'Không tìm thấy đợt trong lịch.');
    const actor = w.actor.name || w.actor.username;
    const late = row.days_left < 0 ? ` · nộp trễ ${-row.days_left} ngày` : '';
    const where = `${row.program_name} · ${row.round}/${row.year}`;
    if (!row.instruments.length) {
      if (!!row.submitted_at === submitted) return w.noChange(row);
      w.commit((tx) => {
        db.prepare('UPDATE eqa_schedule SET submitted_at=?, submitted_by=?, updated_at=? WHERE id=?')
          .run(submitted ? nowIso() : '', submitted ? actor : '', nowIso(), id);
        tx.audit(submitted ? 'Đã nộp kết quả ngoại kiểm' : 'Bỏ đánh dấu đã nộp ngoại kiểm',
          `${where} · hạn nộp ${viDate(row.due_date)}${submitted ? late : ''}`, row.program_name);
        tx.changed(['eqa_schedule']);
      });
      return { ok: true, data: scheduleById(id)! };
    }
    const ids = Array.isArray(input.instrumentIds) ? new Set(input.instrumentIds.map((v) => cleanId(v))) : null;
    if (ids && [...ids].some((iid) => !row.instruments.some((m) => m.instrument_id === iid))) return fail('invalid-instrument', 'Máy không thuộc đợt này.');
    const want = (iid: string) => (ids ? ids.has(iid) : submitted);
    const marking = row.instruments.filter((m) => !m.submitted_at && want(m.instrument_id));
    const clearing = row.instruments.filter((m) => m.submitted_at && !want(m.instrument_id));
    if (!marking.length && !clearing.length) return w.noChange(row);
    w.commit((tx) => {
      const now = nowIso();
      const set = db.prepare('UPDATE eqa_schedule_instruments SET submitted_at=?, submitted_by=? WHERE schedule_id=? AND instrument_id=?');
      for (const m of marking) set.run(now, actor, id, m.instrument_id);
      for (const m of clearing) set.run('', '', id, m.instrument_id);
      db.prepare('UPDATE eqa_schedule SET updated_at=? WHERE id=?').run(now, id);
      if (marking.length) tx.audit('Đã nộp kết quả ngoại kiểm', `${where} · máy: ${marking.map((m) => m.instrument_name).join(', ')} · hạn nộp ${viDate(row.due_date)}${late}`, row.program_name);
      if (clearing.length) tx.audit('Bỏ đánh dấu đã nộp ngoại kiểm', `${where} · máy: ${clearing.map((m) => m.instrument_name).join(', ')}`, row.program_name);
      tx.changed(['eqa_schedule']);
    });
    return { ok: true, data: scheduleById(id)! };
  });

  /** Xoá một đợt khỏi lịch (lập nhầm). Đợt đã nộp (dù chỉ một máy) hoặc đã có
   * báo cáo là hồ sơ, không xoá. */
  const removeEqaSchedule = writeCommand(db, 'removeEqaSchedule', 'write', (w, raw: unknown): IpcResult<{ id: string }> => {
    const id = cleanId(objectInput(objectInput(raw).data).id);
    const row = scheduleById(id);
    if (!row) return fail('not-found', 'Không tìm thấy đợt trong lịch.');
    if (row.status === 'submitted' || row.status === 'reported' || row.instruments.some((m) => m.submitted_at || m.reported)) {
      return fail('locked', 'Đợt đã nộp hoặc đã có báo cáo là hồ sơ, không xoá được.');
    }
    w.commit((tx) => {
      db.prepare('DELETE FROM eqa_schedule_instruments WHERE schedule_id=?').run(id);
      db.prepare('DELETE FROM eqa_schedule WHERE id=?').run(id);
      tx.audit('Xoá lịch ngoại kiểm', `${row.program_name} · ${row.round}/${row.year} · hạn nộp ${viDate(row.due_date)}`, row.program_name);
      tx.changed(['eqa_schedule']);
    });
    return { ok: true, data: { id } };
  });

  return { ...createEqaCorrectiveReader(db, listEqaRounds, getEqaRound), ...createEqaReportHandlers(db, listEqaRounds, getEqaRound), listEqaRounds, getEqaRound, getEqaSeries, getEqaInstrumentGrid, listEqaAttention, previewEqaImport, importEqaRound, cancelEqaRound,
    listEqaSchedule, listEqaPrograms, listEqaAssignees, saveEqaSchedule, markEqaSubmitted, removeEqaSchedule };
}
