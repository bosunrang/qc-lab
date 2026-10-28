// Dạng chuẩn và kiểm tra một lần nhập kỳ ngoại kiểm (docs/EQA-PLAN-2026-10-28.md).
//
// Nguồn duy nhất là báo cáo PDF của trung tâm ngoại kiểm (`pdf-report.ts`):
// mỗi file một máy, nhiều file của cùng đợt được gộp bằng `mergeEqaSources`.
// Main KHÔNG tin dữ liệu renderer đã đọc: `checkEqaImport` ép kiểu, kiểm và
// tính lại toàn bộ trước khi xem trước lẫn khi ghi.
import {
  EQA_DEFAULT_CONFIG, EQA_PEER_LEVELS, eqaClass, eqaNormalize, eqaPct, eqaProviderCheck, eqaSuggestTests, eqaZ,
  type EqaCatalogTest, type EqaClass, type EqaConfig, type EqaPeer, type EqaProviderCheck,
} from './evaluation';

export interface EqaRoundInput {
  program: string; provider: string; programCode: string; unitCode: string;
  year: number | null; round: string; reportCode: string; reportDate: string; assignedLevel: string;
}

export interface EqaRowInput {
  /** Vị trí trong nguồn ("tệp · trang 5"), để báo lỗi đúng chỗ. */
  ref: string;
  code: string; instrument: string; sample: string; unit: string;
  result: number | null; assigned: number | null; sigmaP: number | null; zProvider: number | null;
  /** Nhóm phương pháp và nhóm thiết bị ghi trên báo cáo. */
  method: string; peerGroup: string;
  peer: EqaPeer;
}

/** `errors` chặn ghi (đọc sai/thiếu, file khác đợt); `warnings` chỉ để người dùng kiểm lại. */
export interface EqaParsedSource { round: EqaRoundInput; rows: EqaRowInput[]; errors: string[]; warnings?: string[] }

// ------------------------------------------------------------ ép kiểu

const text = (value: unknown, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(/^-?\d+,\d+$/.test(raw) ? raw.replace(',', '.') : raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Ngày `YYYY-MM-DD` (nhận cả chuỗi ISO đầy đủ); chuỗi rỗng nếu không đọc được. */
export function eqaDate(value: unknown): string {
  const m = String(value ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function year(value: unknown): number | null {
  const n = num(value);
  return n !== null && Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
}

/** Gộp các báo cáo của CÙNG một đợt (mỗi máy một file). File khác đợt bị từ chối. */
export function mergeEqaSources(sources: readonly EqaParsedSource[], names: readonly string[] = []): EqaParsedSource {
  const errors = sources.flatMap((source) => source.errors);
  const warnings = sources.flatMap((source) => source.warnings ?? []);
  const base = sources.find((source) => source.rows.length) ?? sources[0];
  if (!base) return { round: cleanRound(null), rows: [], errors: ['Chưa chọn file nào.'], warnings };
  const sig = (r: EqaRoundInput) => [eqaNormalize(r.programCode || r.program), eqaNormalize(r.unitCode), eqaNormalize(r.round), r.year ?? ''].join('|');
  const rows: EqaRowInput[] = [];
  sources.forEach((source, i) => {
    if (!source.rows.length) return;
    if (source !== base && sig(source.round) !== sig(base.round)) {
      errors.push(`${names[i] || `File ${i + 1}`}: thuộc đợt khác (${source.round.programCode || source.round.program} / ${source.round.round} / ${source.round.year ?? '?'}); không nhập file này.`);
      return;
    }
    rows.push(...source.rows);
  });
  return { round: base.round, rows, errors, warnings };
}

// ------------------------------------------------ kiểm tra tại main

export interface EqaCheckedRow extends EqaRowInput {
  testId: string | null;
  z: number | null; pct: number | null; zOfficial: number | null; cls: EqaClass | null;
  providerCheck: EqaProviderCheck;
  errors: string[]; warnings: string[];
}

export interface EqaPairCheck { code: string; instrument: string; testId: string | null; suggestions: string[]; rows: number }

export interface EqaImportCheck {
  round: EqaRoundInput; roundErrors: string[]; rows: EqaCheckedRow[];
  pairs: EqaPairCheck[]; blocking: number;
}

export interface EqaCheckContext {
  tests: readonly EqaCatalogTest[];
  /** Ánh xạ khoá `eqaPairKey()` → `test_id` (đã lưu cộng với lựa chọn của lần nhập này). */
  mapping: ReadonlyMap<string, string>;
  config?: EqaConfig;
}

/** Khoá ánh xạ: mã thông số × tên máy, không phân biệt cách viết. */
export function eqaPairKey(code: string, instrument: string): string { return `${eqaNormalize(code)}|${eqaNormalize(instrument)}`; }

function cleanRound(raw: unknown): EqaRoundInput {
  const r = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return {
    program: text(r.program), provider: text(r.provider), programCode: text(r.programCode, 60), unitCode: text(r.unitCode, 60),
    year: year(r.year), round: text(r.round, 40), reportCode: text(r.reportCode, 60),
    reportDate: eqaDate(r.reportDate), assignedLevel: text(r.assignedLevel, 60),
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
    ref: text(r.ref, 120) || `dòng ${index + 1}`, code: text(r.code, 80), instrument: text(r.instrument, 120),
    sample: text(r.sample, 40), unit: text(r.unit, 40), result: num(r.result), assigned: num(r.assigned), sigmaP: num(r.sigmaP),
    zProvider: num(r.zProvider), method: text(r.method, 120), peerGroup: text(r.peerGroup, 120), peer: cleanPeer(r.peer),
  };
}

const MAX_ROWS = 2000;

/** Kiểm toàn bộ một lần nhập: thông tin đợt, từng dòng, ánh xạ, đối chiếu z
 * với báo cáo (E-03) và tính z, xếp loại (E-01, E-04). `blocking` > 0 thì
 * không được ghi. */
export function checkEqaImport(input: { round?: unknown; rows?: unknown }, ctx: EqaCheckContext): EqaImportCheck {
  const config = ctx.config ?? EQA_DEFAULT_CONFIG;
  const round = cleanRound(input.round);
  const roundErrors: string[] = [];
  if (round.program.length < 3) roundErrors.push('Thiếu tên chương trình ngoại kiểm.');
  if (!round.round) roundErrors.push('Thiếu đợt ngoại kiểm.');
  if (round.year === null) roundErrors.push('Năm ngoại kiểm không hợp lệ.');
  const rawRows = Array.isArray(input.rows) ? input.rows : [];
  if (!rawRows.length) roundErrors.push('Không có dòng kết quả nào.');
  if (rawRows.length > MAX_ROWS) roundErrors.push(`Một đợt nhận tối đa ${MAX_ROWS} dòng kết quả.`);
  const testIds = new Set(ctx.tests.map((t) => t.id));

  const rows: EqaCheckedRow[] = rawRows.slice(0, MAX_ROWS).map((raw, i) => {
    const row = cleanRow(raw, i);
    const errors: string[] = [], warnings: string[] = [];
    if (!row.code) errors.push('thiếu mã thông số');
    if (!row.instrument) errors.push('thiếu máy');
    if (row.result === null || row.assigned === null) errors.push('kết quả hoặc giá trị ấn định không phải số');
    if (row.sigmaP === null || !(row.sigmaP > 0)) errors.push('σp phải là số lớn hơn 0');
    const mapped = ctx.mapping.get(eqaPairKey(row.code, row.instrument)) ?? null;
    const testId = mapped && testIds.has(mapped) ? mapped : null;
    const z = eqaZ(row.result, row.assigned, row.sigmaP);
    const providerCheck = eqaProviderCheck(z, row.zProvider);
    const zOfficial = row.zProvider ?? z;
    const pct = eqaPct(row.result, row.assigned);
    if (providerCheck === 'swapped') errors.push('z tính lại ngược dấu z trên báo cáo: đối chiếu kết quả và giá trị ấn định với báo cáo gốc');
    if (providerCheck === 'mismatch') warnings.push(`z (${z?.toFixed(2)}) lệch z trên báo cáo (${row.zProvider?.toFixed(2)}): đối chiếu giá trị ấn định, σp và kết quả với báo cáo gốc`);
    if (row.code && row.instrument && !testId) errors.push('chưa ánh xạ sang xét nghiệm trong danh mục');
    return { ...row, testId, z, pct, zOfficial, cls: zOfficial === null ? null : eqaClass(zOfficial, config), providerCheck, errors, warnings };
  });

  // Trùng mẫu của cùng thông số × máy trong một đợt.
  const seen = new Map<string, string>();
  for (const row of rows) {
    const key = `${eqaPairKey(row.code, row.instrument)}|${eqaNormalize(row.sample)}`;
    if (seen.has(key)) row.errors.push(`trùng mẫu ${row.sample || '(trống)'} với ${seen.get(key)}`);
    else seen.set(key, row.ref);
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
  return { round, roundErrors, rows, pairs: [...pairMap.values()], blocking };
}
