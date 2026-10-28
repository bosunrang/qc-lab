// Đọc và kiểm tra một lần nhập kỳ ngoại kiểm (docs/EQA-PLAN-2026-10-28.md,
// giai đoạn 1).
//
// Hai nguồn, cùng một dạng chuẩn:
//   - file Excel theo mẫu `Mau_nhap_du_lieu_EQA.xlsx` của công cụ cũ: renderer
//     đọc bằng exceljs thành mảng 2 chiều theo sheet rồi gọi `parseEqaWorkbook`;
//   - dữ liệu đã lưu của công cụ cũ (`phan_tich_ngoai_kiem.html` hoặc file sao
//     lưu `.json`): `parseLegacyEqa` tách thành từng kỳ.
// Main KHÔNG tin dữ liệu renderer đã đọc: `checkEqaImport` ép kiểu, kiểm và
// tính lại toàn bộ trước khi xem trước lẫn khi ghi.
import {
  EQA_DEFAULT_CONFIG, EQA_PEER_LEVELS, eqaClass, eqaInstrumentSwapped, eqaNormalize, eqaPct, eqaProviderCheck, eqaSuggestTests, eqaZ,
  type EqaCatalogTest, type EqaClass, type EqaConfig, type EqaPeer, type EqaPeerStats, type EqaProviderCheck,
} from './evaluation';

export interface EqaRoundInput {
  program: string; provider: string; programCode: string; unitCode: string;
  year: number | null; round: string; reportCode: string;
  receivedDate: string; reportDate: string; assignedLevel: string; enteredBy: string;
}

export interface EqaRowInput {
  /** Vị trí trong nguồn ("tệp · dòng 5"), để báo lỗi đúng chỗ. */
  ref: string;
  code: string; instrument: string; level: string; sample: string; unit: string;
  result: number | null; assigned: number | null; sigmaP: number | null; zProvider: number | null; tolerancePct: number | null;
  runDate: string; reagentLot: string; method: string; operator: string; iqcNote: string; peerGroup: string;
  peer: EqaPeer;
}

export interface EqaParsedSource { round: EqaRoundInput; rows: EqaRowInput[]; errors: string[] }

// ------------------------------------------------------------ ép kiểu ô

const text = (value: unknown, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  // Báo cáo tiếng Việt hay dùng dấu phẩy thập phân.
  const parsed = Number(/^-?\d+,\d+$/.test(raw) ? raw.replace(',', '.') : raw);
  return Number.isFinite(parsed) ? parsed : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Ngày `YYYY-MM-DD` từ số ngày Excel, `dd/mm/yyyy`, `YYYY-MM-DD` hoặc chuỗi
 * ISO; chuỗi rỗng nếu không đọc được. */
export function eqaDate(value: unknown): string {
  if (typeof value === 'number' && value > 0 && value < 100000) {
    const at = new Date(Math.round((value - 25569) * 86400000));
    return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
  }
  const raw = String(value ?? '').trim();
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return '';
}

function year(value: unknown): number | null {
  const n = num(value) ?? num(String(value ?? '').match(/\d{4}/)?.[0]);
  return n !== null && Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
}

// ------------------------------------------------------- Excel theo mẫu

/** Tiêu đề cột/nhãn dòng: bỏ dấu `*` bắt buộc, chữ thường. */
const header = (value: unknown) => String(value ?? '').replace(/\*/g, '').trim().toLowerCase();

const COLUMNS = {
  code: 'mã thông số', unit: 'đơn vị', sample: 'mẫu', result: 'kết quả pxn (x)', assigned: 'giá trị ấn định (x)', sigmaP: 'σp',
  level: 'mức nồng độ', tolerancePct: 'sai số cho phép (%)', instrument: 'thiết bị', reagentLot: 'lô thuốc thử', method: 'phương pháp',
  operator: 'người thực hiện', runDate: 'ngày chạy mẫu', iqcNote: 'qc nội kiểm cùng ngày', zProvider: 'z-score nhà cung cấp', peerGroup: 'nhóm đồng đẳng',
} as const;
const REQUIRED: readonly (keyof typeof COLUMNS)[] = ['code', 'unit', 'sample', 'result', 'assigned', 'sigmaP', 'instrument'];
const PEER_TITLE: Readonly<Record<string, string>> = { all: 'tất cả pp', method: 'nhóm pp', instrument: 'nhóm tb' };
const PEER_FIELD: Readonly<Record<keyof EqaPeerStats, string>> = { mean: 'ấn định', sd: 'sd', cv: '%cv', n: 'n' };

const ROUND_LABELS: Readonly<Record<keyof EqaRoundInput, string>> = {
  program: 'chương trình ngoại kiểm', round: 'vòng', year: 'năm', unitCode: 'mã đơn vị', programCode: 'mã chương trình',
  reportCode: 'mã báo cáo', assignedLevel: 'cấp nhóm làm giá trị ấn định', receivedDate: 'ngày nhận', reportDate: 'ngày báo cáo',
  provider: 'đơn vị tổ chức ngoại kiểm', enteredBy: 'người nhập dữ liệu',
};

function roundFromPairs(get: (label: string) => unknown): EqaRoundInput {
  return {
    program: text(get(ROUND_LABELS.program)), provider: text(get(ROUND_LABELS.provider)), programCode: text(get(ROUND_LABELS.programCode), 60),
    unitCode: text(get(ROUND_LABELS.unitCode), 60), year: year(get(ROUND_LABELS.year)), round: text(get(ROUND_LABELS.round), 40),
    reportCode: text(get(ROUND_LABELS.reportCode), 60), receivedDate: eqaDate(get(ROUND_LABELS.receivedDate)), reportDate: eqaDate(get(ROUND_LABELS.reportDate)),
    assignedLevel: text(get(ROUND_LABELS.assignedLevel), 60), enteredBy: text(get(ROUND_LABELS.enteredBy), 120),
  };
}

/** Đọc một file Excel đã chuyển thành mảng 2 chiều theo tên sheet. Ô ngày nên
 * được renderer đổi sẵn thành `YYYY-MM-DD`; số ngày Excel vẫn đọc được. */
export function parseEqaWorkbook(sheets: Readonly<Record<string, readonly (readonly unknown[])[]>>, sourceName = ''): EqaParsedSource {
  const errors: string[] = [];
  const prefix = sourceName ? `${sourceName} · ` : '';
  const info = sheets['Thông tin kỳ'] ?? [];
  const pairs = new Map(info.filter((row) => row && row[0] != null).map((row) => [header(row[0]), row[1]]));
  const round = roundFromPairs((label) => pairs.get(label));
  const catalog = new Map((sheets['Danh mục thông số'] ?? []).slice(1).filter((row) => row && row[0] != null)
    .map((row) => [text(row[0]), num(row[2])]));
  const data = sheets['Dữ liệu EQA'];
  if (!data?.length) return { round, rows: [], errors: [`${prefix}thiếu sheet "Dữ liệu EQA".`] };
  const titles = (data[0] ?? []).map(header);
  const col = (title: string) => titles.indexOf(title);
  const missing = REQUIRED.filter((key) => col(COLUMNS[key]) < 0);
  if (missing.length) return { round, rows: [], errors: [`${prefix}thiếu cột bắt buộc: ${missing.map((key) => COLUMNS[key]).join(', ')}.`] };
  const at = (row: readonly unknown[], key: keyof typeof COLUMNS) => { const i = col(COLUMNS[key]); return i < 0 ? null : row[i]; };
  const rows: EqaRowInput[] = [];
  data.slice(1).forEach((row, index) => {
    if (!row || at(row, 'code') == null || text(at(row, 'code')) === '') return;
    const code = text(at(row, 'code'), 80);
    const peer: EqaPeer = {};
    for (const level of EQA_PEER_LEVELS) {
      const stats = Object.fromEntries((Object.keys(PEER_FIELD) as (keyof EqaPeerStats)[])
        .map((field) => { const i = col(`${PEER_FIELD[field]} - ${PEER_TITLE[level]}`); return [field, i < 0 ? null : num(row[i])]; })) as unknown as EqaPeerStats;
      if (stats.mean !== null || stats.sd !== null || stats.cv !== null || stats.n !== null) peer[level] = stats;
    }
    rows.push({
      ref: `${prefix}dòng ${index + 2}`, code, instrument: text(at(row, 'instrument'), 120), level: text(at(row, 'level'), 40),
      sample: text(at(row, 'sample'), 40), unit: text(at(row, 'unit'), 40),
      result: num(at(row, 'result')), assigned: num(at(row, 'assigned')), sigmaP: num(at(row, 'sigmaP')), zProvider: num(at(row, 'zProvider')),
      tolerancePct: num(at(row, 'tolerancePct')) ?? catalog.get(code) ?? null,
      runDate: eqaDate(at(row, 'runDate')), reagentLot: text(at(row, 'reagentLot'), 80), method: text(at(row, 'method'), 120),
      operator: text(at(row, 'operator'), 120), iqcNote: text(at(row, 'iqcNote'), 200), peerGroup: text(at(row, 'peerGroup'), 120), peer,
    });
  });
  if (!rows.length) errors.push(`${prefix}sheet "Dữ liệu EQA" không có dòng kết quả nào.`);
  return { round, rows, errors };
}

/** Gộp nhiều file của CÙNG một kỳ (mỗi máy một file). File khác kỳ bị từ chối. */
export function mergeEqaSources(sources: readonly EqaParsedSource[], names: readonly string[] = []): EqaParsedSource {
  const errors = sources.flatMap((source) => source.errors);
  const usable = sources.filter((source) => source.rows.length);
  const base = usable[0] ?? sources[0];
  if (!base) return { round: roundFromPairs(() => null), rows: [], errors: ['Chưa chọn file nào.'] };
  const sig = (r: EqaRoundInput) => [eqaNormalize(r.program), eqaNormalize(r.round), r.year ?? ''].join('|');
  const rows: EqaRowInput[] = [];
  usable.forEach((source, i) => {
    if (source !== base && sig(source.round) !== sig(base.round)) {
      errors.push(`${names[sources.indexOf(source)] || `File ${i + 1}`}: thuộc kỳ khác (${source.round.program} / ${source.round.round} / ${source.round.year ?? '?'}); không nhập file này.`);
      return;
    }
    rows.push(...source.rows);
  });
  return { round: base.round, rows, errors };
}

// ------------------------------------------------- dữ liệu của công cụ cũ

/** Tách dữ liệu đã lưu của `phan_tich_ngoai_kiem.html` thành từng kỳ. Nhận
 * nội dung file `.json` sao lưu hoặc cả file `.html` (vùng `eqa-embed`). */
export function parseLegacyEqa(content: string): { sources: EqaParsedSource[]; error: string } {
  let raw = content.trim();
  const embedded = raw.match(/<script id="eqa-embed" type="application\/json">([\s\S]*?)<\/script>/);
  if (embedded) raw = embedded[1];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return { sources: [], error: 'File không chứa dữ liệu của công cụ phân tích ngoại kiểm.' }; }
  const periods = data && typeof data === 'object' && Array.isArray((data as { periods?: unknown }).periods) ? (data as { periods: unknown[] }).periods : null;
  if (!periods) return { sources: [], error: 'File không chứa danh sách kỳ ngoại kiểm (periods).' };
  const sources = periods.filter((p): p is Record<string, unknown> => !!p && typeof p === 'object').map((period, pi) => {
    const info = (period.info && typeof period.info === 'object' ? period.info : {}) as Record<string, unknown>;
    const round: EqaRoundInput = {
      program: text(period.pg), provider: text(info.tc), programCode: text(info.mct, 60), unitCode: text(info.mdv, 60),
      year: year(period.nm), round: text(period.vg, 40), reportCode: text(info.mbc, 60),
      receivedDate: eqaDate(info.nhan), reportDate: eqaDate(info.bao), assignedLevel: text(info.cap, 60), enteredBy: text(info.nhap, 120),
    };
    const label = `${round.round || `Kỳ ${pi + 1}`}/${round.year ?? '?'}`;
    const rows = (Array.isArray(period.rows) ? period.rows : []).filter((r): r is Record<string, unknown> => !!r && typeof r === 'object').map((r, ri): EqaRowInput => {
      const g = (r.g && typeof r.g === 'object' ? r.g : {}) as Record<string, Record<string, unknown> | undefined>;
      const peer: EqaPeer = {};
      ([['all', 'A'], ['method', 'M'], ['instrument', 'T']] as const).forEach(([level, key]) => {
        const q = g[key];
        if (q && (q.m != null || q.sd != null)) peer[level] = { mean: num(q.m), sd: num(q.sd), cv: num(q.cv), n: num(q.n) };
      });
      return {
        ref: `${label} · dòng ${ri + 1}`, code: text(r.code ?? r.c, 80), instrument: text(r.dv, 120), level: text(r.lv, 40),
        sample: text(r.m, 40), unit: text(r.u, 40), result: num(r.x), assigned: num(r.X), sigmaP: num(r.s), zProvider: num(r.zn),
        tolerancePct: num(r.tol), runDate: eqaDate(r.dt), reagentLot: text(r.lo, 80), method: text(r.vt, 120), operator: text(r.who, 120),
        iqcNote: text(r.qc, 200), peerGroup: text(r.pe, 120), peer,
      };
    });
    return { round, rows, errors: [] };
  });
  return { sources, error: sources.length ? '' : 'File không có kỳ ngoại kiểm nào.' };
}

// ------------------------------------------------ kiểm tra tại main

export interface EqaCheckedRow extends EqaRowInput {
  testId: string | null;
  z: number | null; pct: number | null; zOfficial: number | null; cls: EqaClass | null;
  providerCheck: EqaProviderCheck; swapped: boolean; withinTolerance: boolean | null;
  errors: string[]; warnings: string[];
}

export interface EqaPairCheck { code: string; instrument: string; testId: string | null; suggestions: string[]; rows: number }
export interface EqaSwapCheck { instrument: string; rows: number; swappedRows: number; flagged: boolean; confirmed: boolean }

export interface EqaImportCheck {
  round: EqaRoundInput; roundErrors: string[]; rows: EqaCheckedRow[];
  pairs: EqaPairCheck[]; swaps: EqaSwapCheck[]; blocking: number;
}

export interface EqaCheckContext {
  tests: readonly EqaCatalogTest[];
  /** Ánh xạ khoá `eqaPairKey()` → `test_id` (đã lưu cộng với lựa chọn của lần nhập này). */
  mapping: ReadonlyMap<string, string>;
  /** Máy người dùng xác nhận đảo lại cột kết quả/giá trị ấn định (tên đã chuẩn hóa). */
  confirmedSwaps: ReadonlySet<string>;
  config?: EqaConfig;
}

/** Khoá ánh xạ: mã thông số × tên máy, không phân biệt cách viết. */
export function eqaPairKey(code: string, instrument: string): string { return `${eqaNormalize(code)}|${eqaNormalize(instrument)}`; }

function cleanRound(raw: unknown): EqaRoundInput {
  const r = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return {
    program: text(r.program), provider: text(r.provider), programCode: text(r.programCode, 60), unitCode: text(r.unitCode, 60),
    year: year(r.year), round: text(r.round, 40), reportCode: text(r.reportCode, 60), receivedDate: eqaDate(r.receivedDate),
    reportDate: eqaDate(r.reportDate), assignedLevel: text(r.assignedLevel, 60), enteredBy: text(r.enteredBy, 120),
  };
}

function cleanPeer(raw: unknown): EqaPeer {
  const p = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const out: EqaPeer = {};
  for (const level of EQA_PEER_LEVELS) {
    const q = p[level] && typeof p[level] === 'object' ? p[level] as Record<string, unknown> : null;
    if (q) out[level] = { mean: num(q.mean), sd: num(q.sd), cv: num(q.cv), n: num(q.n) };
  }
  return out;
}

function cleanRow(raw: unknown, index: number): EqaRowInput {
  const r = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return {
    ref: text(r.ref, 120) || `dòng ${index + 1}`, code: text(r.code, 80), instrument: text(r.instrument, 120), level: text(r.level, 40),
    sample: text(r.sample, 40), unit: text(r.unit, 40), result: num(r.result), assigned: num(r.assigned), sigmaP: num(r.sigmaP),
    zProvider: num(r.zProvider), tolerancePct: num(r.tolerancePct), runDate: eqaDate(r.runDate), reagentLot: text(r.reagentLot, 80),
    method: text(r.method, 120), operator: text(r.operator, 120), iqcNote: text(r.iqcNote, 200), peerGroup: text(r.peerGroup, 120),
    peer: cleanPeer(r.peer),
  };
}

const MAX_ROWS = 2000;

/** Kiểm toàn bộ một lần nhập: thông tin kỳ, từng dòng, ánh xạ, chiều dữ liệu
 * (E-03) và tính z, xếp loại (E-01, E-04). `blocking` > 0 thì không được ghi. */
export function checkEqaImport(input: { round?: unknown; rows?: unknown }, ctx: EqaCheckContext): EqaImportCheck {
  const config = ctx.config ?? EQA_DEFAULT_CONFIG;
  const round = cleanRound(input.round);
  const roundErrors: string[] = [];
  if (round.program.length < 3) roundErrors.push('Thiếu tên chương trình ngoại kiểm.');
  if (!round.round) roundErrors.push('Thiếu vòng/đợt ngoại kiểm.');
  if (round.year === null) roundErrors.push('Năm ngoại kiểm không hợp lệ.');
  const rawRows = Array.isArray(input.rows) ? input.rows : [];
  if (!rawRows.length) roundErrors.push('Không có dòng kết quả nào.');
  if (rawRows.length > MAX_ROWS) roundErrors.push(`Một kỳ nhận tối đa ${MAX_ROWS} dòng kết quả.`);
  const testIds = new Set(ctx.tests.map((t) => t.id));

  const rows: EqaCheckedRow[] = rawRows.slice(0, MAX_ROWS).map((raw, i) => {
    const row = cleanRow(raw, i);
    const errors: string[] = [], warnings: string[] = [];
    if (!row.code) errors.push('thiếu mã thông số');
    if (!row.instrument) errors.push('thiếu thiết bị');
    if (row.result === null || row.assigned === null) errors.push('kết quả hoặc giá trị ấn định không phải số');
    if (row.sigmaP === null || !(row.sigmaP > 0)) errors.push('σp phải là số lớn hơn 0');
    const mapped = ctx.mapping.get(eqaPairKey(row.code, row.instrument)) ?? null;
    const testId = mapped && testIds.has(mapped) ? mapped : null;
    return { ...row, testId, z: null, pct: null, zOfficial: null, cls: null, providerCheck: 'none', swapped: false, withinTolerance: null, errors, warnings };
  });

  // Trùng mẫu của cùng thông số × máy (× mức) trong một kỳ.
  const seen = new Map<string, string>();
  for (const row of rows) {
    const key = `${eqaPairKey(row.code, row.instrument)}|${eqaNormalize(row.level)}|${eqaNormalize(row.sample)}`;
    if (seen.has(key)) row.errors.push(`trùng mẫu ${row.sample || '(trống)'} với ${seen.get(key)}`);
    else seen.set(key, row.ref);
  }

  // Chiều dữ liệu theo máy, trên giá trị như trong file.
  const byInstrument = new Map<string, EqaCheckedRow[]>();
  for (const row of rows) {
    if (!row.instrument) continue;
    const key = eqaNormalize(row.instrument);
    byInstrument.set(key, [...(byInstrument.get(key) ?? []), row]);
  }
  const swaps: EqaSwapCheck[] = [];
  for (const [key, list] of byInstrument) {
    const checks = list.map((row) => eqaProviderCheck(eqaZ(row.result, row.assigned, row.sigmaP), row.zProvider));
    const flagged = eqaInstrumentSwapped(checks);
    const confirmed = ctx.confirmedSwaps.has(key);
    swaps.push({ instrument: list[0].instrument, rows: list.length, swappedRows: checks.filter((c) => c === 'swapped').length, flagged, confirmed });
    if (confirmed && !flagged) list.forEach((row) => row.errors.push('máy này không có dấu hiệu đảo cột nên không được đảo'));
    if (flagged && confirmed) for (const row of list) { [row.result, row.assigned] = [row.assigned, row.result]; row.swapped = true; }
    if (flagged && !confirmed) list.forEach((row) => row.errors.push('có thể đảo cột kết quả PXN với giá trị ấn định (z ngược dấu z nhà cung cấp ở đa số dòng của máy)'));
  }

  for (const row of rows) {
    row.z = eqaZ(row.result, row.assigned, row.sigmaP);
    row.pct = eqaPct(row.result, row.assigned);
    row.providerCheck = eqaProviderCheck(row.z, row.zProvider);
    row.zOfficial = row.zProvider ?? row.z;
    row.cls = row.zOfficial === null ? null : eqaClass(row.zOfficial, config);
    row.withinTolerance = row.tolerancePct !== null && row.pct !== null ? Math.abs(row.pct) <= row.tolerancePct : null;
    const instrumentFlagged = swaps.find((s) => eqaNormalize(s.instrument) === eqaNormalize(row.instrument))?.flagged;
    if (row.providerCheck === 'swapped' && !instrumentFlagged) row.errors.push('z ngược dấu z nhà cung cấp: kiểm tra lại cột kết quả và giá trị ấn định của dòng này');
    if (row.providerCheck === 'mismatch') row.warnings.push(`z (${row.z?.toFixed(2)}) lệch z nhà cung cấp (${row.zProvider?.toFixed(2)}): đối chiếu X, σp và kết quả với báo cáo gốc`);
    if (row.code && row.instrument && !row.testId) row.errors.push('chưa ánh xạ sang xét nghiệm trong danh mục');
  }

  const pairMap = new Map<string, EqaPairCheck>();
  for (const row of rows) {
    if (!row.code || !row.instrument) continue;
    const key = eqaPairKey(row.code, row.instrument);
    const pair = pairMap.get(key) ?? { code: row.code, instrument: row.instrument, testId: row.testId, suggestions: eqaSuggestTests(row.code, row.instrument, ctx.tests), rows: 0 };
    pair.rows++;
    pairMap.set(key, pair);
  }
  const blocking = roundErrors.length + rows.filter((row) => row.errors.length).length;
  return { round, roundErrors, rows, pairs: [...pairMap.values()], swaps, blocking };
}
