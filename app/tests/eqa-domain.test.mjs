// Nghiệp vụ thuần của phân hệ Ngoại kiểm (docs/EQA-PLAN-2026-10-28.md):
// xếp loại theo ISO 13528 (E-01), đối chiếu z với báo cáo (E-03), gộp báo cáo
// từng máy và kiểm một lần nhập. Bộ đọc PDF có test riêng ở `eqa-pdf.test.mjs`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  eqaClass, eqaZ, eqaPct, eqaProviderCheck, eqaPeerComparison, eqaCounts, eqaSuggestTests, eqaRoundNumber,
} = require('../../app-dist/main/domain/eqa/evaluation.js');
const { mergeEqaSources, checkEqaImport, eqaPairKey, eqaDate } = require('../../app-dist/main/domain/eqa/import.js');

test('E-01: |z| ≤ 2,0 chấp nhận, 2,0 < |z| < 3,0 cảnh báo, |z| ≥ 3,0 không chấp nhận', () => {
  assert.equal(eqaClass(2), 'ok', '|z| = 2,00 là chấp nhận (công cụ cũ xếp nhầm cảnh báo)');
  assert.equal(eqaClass(-2.004), 'ok', 'so trên z làm tròn 2 chữ số như báo cáo');
  assert.equal(eqaClass(2.01), 'warn');
  assert.equal(eqaClass(-2.99), 'warn');
  assert.equal(eqaClass(3), 'rej');
  assert.equal(eqaClass(-3.5), 'rej');
  assert.equal(eqaZ(54.278, 55, 4.917).toFixed(4), '-0.1468');
  assert.equal(eqaZ(1, 1, 0), null, 'σp phải dương');
  assert.equal(eqaPct(110, 100), 10);
  assert.equal(eqaPct(1, 0), null);
});

test('E-03: đối chiếu z với z trên báo cáo', () => {
  assert.equal(eqaProviderCheck(0.147, 0.15), 'match', 'lệch do làm tròn của nhà cung cấp');
  assert.equal(eqaProviderCheck(-0.147, 0.15), 'swapped');
  assert.equal(eqaProviderCheck(0.5, 1.2), 'mismatch');
  assert.equal(eqaProviderCheck(0.01, -0.01), 'match');
  assert.equal(eqaProviderCheck(0.3, null), 'none');
});

test('so nhóm đồng đẳng, PT score, gợi ý xét nghiệm, số đợt', () => {
  const [peer] = eqaPeerComparison(105, { instrument: { mean: 100, sd: 2.5, cv: 2.5, n: 30 } });
  assert.deepEqual([peer.level, peer.sdi, peer.pct], ['instrument', 2, 5]);
  assert.deepEqual(eqaCounts(['ok', 'ok', 'warn', 'rej']), { total: 4, ok: 2, warn: 1, rej: 1, acceptPct: 50 });
  const catalog = [
    { id: 'alt-au', name: 'ALT', display_name: '', standard_name: '', abbreviation: 'ALT', aliases: ['GPT'], instrument_id: 'au', instrument_name: 'AU5800', instrument_model: '', active: true },
    { id: 'alt-dxc', name: 'ALT', display_name: '', standard_name: '', abbreviation: 'ALT', aliases: [], instrument_id: 'dxc', instrument_name: 'DxC 700', instrument_model: 'DxC700', active: true },
    { id: 'ast-au', name: 'AST', display_name: '', standard_name: '', abbreviation: 'AST', aliases: [], instrument_id: 'au', instrument_name: 'AU5800', instrument_model: '', active: true },
  ];
  assert.deepEqual(eqaSuggestTests('ALT(GPT)', 'AU5800', catalog), ['alt-au']);
  assert.deepEqual(eqaSuggestTests('ALT(GPT)', 'DxC700', catalog), ['alt-dxc'], 'so tên máy không phân biệt khoảng trắng');
  assert.deepEqual(eqaSuggestTests('Calcium', 'AU5800', catalog), []);
  assert.equal(eqaRoundNumber('ĐỢT 09'), 9);
  assert.equal(eqaDate('2026-03-15T08:00:00Z'), '2026-03-15');
  assert.equal(eqaDate('15/03/2026'), '', 'chỉ nhận ngày ISO');
});

test('gộp báo cáo từng máy của cùng đợt; báo cáo khác đợt bị từ chối', () => {
  const round = { program: 'SINH HÓA', provider: 'TTKCXN', programCode: 'BC20C', unitCode: '10026', year: 2026, round: 'ĐỢT 09' };
  const one = (instrument, over = {}) => ({ round: { ...round, ...over }, rows: [{ ref: instrument, code: 'ALT', instrument }], errors: [], warnings: [`${instrument}: cảnh báo`] });
  const merged = mergeEqaSources([one('AU5800'), one('DxC700'), one('Cobas', { round: 'ĐỢT 08' })], ['au.pdf', 'dxc.pdf', 'cobas.pdf']);
  assert.deepEqual(merged.rows.map((r) => r.instrument), ['AU5800', 'DxC700']);
  assert.match(merged.errors[0], /cobas\.pdf: thuộc đợt khác/);
  assert.equal(merged.warnings.length, 3);
});

const TESTS = [
  { id: 'alt-au', name: 'ALT', display_name: '', standard_name: '', abbreviation: 'ALT', aliases: [], instrument_id: 'au', instrument_name: 'AU5800', instrument_model: '', active: true },
  { id: 'ast-au', name: 'AST', display_name: '', standard_name: '', abbreviation: 'AST', aliases: [], instrument_id: 'au', instrument_name: 'AU5800', instrument_model: '', active: true },
];
const ROUND = { program: 'SINH HÓA', provider: 'TTKCXN', year: 2026, round: 'ĐỢT 01' };
const row = (over) => ({ ref: 'r', code: 'ALT', instrument: 'AU5800', sample: 'S1', unit: 'U/L', result: 55, assigned: 54.278, sigmaP: 4.917, zProvider: 0.15, peer: {}, ...over });
const ctx = (over = {}) => ({ tests: TESTS, mapping: new Map([[eqaPairKey('ALT', 'AU5800'), 'alt-au'], [eqaPairKey('AST', 'AU5800'), 'ast-au']]), ...over });

test('kiểm một lần nhập: ánh xạ, trùng mẫu, z và xếp loại theo z nhà cung cấp (E-04)', () => {
  const ok = checkEqaImport({ round: ROUND, rows: [row(), row({ code: 'AST', sample: 'S1', result: 40, assigned: 30, sigmaP: 3, zProvider: 3.33 })] }, ctx());
  assert.equal(ok.blocking, 0, JSON.stringify(ok.rows.map((r) => r.errors)));
  assert.equal(ok.rows[0].cls, 'ok');
  assert.equal(ok.rows[1].cls, 'rej');
  assert.equal(ok.rows[0].providerCheck, 'match');

  const unmapped = checkEqaImport({ round: ROUND, rows: [row({ code: 'GLU' })] }, ctx());
  assert.match(unmapped.rows[0].errors[0], /chưa ánh xạ/);
  assert.deepEqual(unmapped.pairs.map((p) => [p.code, p.testId]), [['GLU', null]]);

  const dup = checkEqaImport({ round: ROUND, rows: [row(), row({ ref: 'r2' })] }, ctx());
  assert.match(dup.rows[1].errors[0], /trùng mẫu/);

  const mismatch = checkEqaImport({ round: ROUND, rows: [row({ zProvider: 0.9 })] }, ctx());
  assert.equal(mismatch.blocking, 0, 'lệch khác chỉ là cảnh báo');
  assert.match(mismatch.rows[0].warnings[0], /lệch z trên báo cáo/);

  const badRound = checkEqaImport({ round: { ...ROUND, year: 'x' }, rows: [row()] }, ctx());
  assert.deepEqual(badRound.roundErrors, ['Năm ngoại kiểm không hợp lệ.']);
});

test('E-03: z tính lại ngược dấu z trên báo cáo là lỗi chặn của dòng đó', () => {
  const flipped = checkEqaImport({ round: ROUND, rows: [row({ result: 54.278, assigned: 55 }), row({ code: 'AST', result: 40, assigned: 30, sigmaP: 3, zProvider: 3.33 })] }, ctx());
  assert.equal(flipped.blocking, 1);
  assert.match(flipped.rows[0].errors[0], /ngược dấu z trên báo cáo/);
  assert.equal(flipped.rows[0].providerCheck, 'swapped');
});
