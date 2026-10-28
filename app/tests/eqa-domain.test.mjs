// Nghiệp vụ thuần của phân hệ Ngoại kiểm (docs/EQA-PLAN-2026-10-28.md):
// xếp loại theo ISO 13528 (E-01), đối chiếu z nhà cung cấp và đảo cột (E-03),
// đọc file mẫu và dữ liệu của công cụ cũ.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  eqaClass, eqaZ, eqaPct, eqaProviderCheck, eqaInstrumentSwapped, eqaPeerComparison, eqaCounts, eqaSuggestTests, eqaRoundNumber,
} = require('../../app-dist/main/domain/eqa/evaluation.js');
const { parseEqaWorkbook, mergeEqaSources, parseLegacyEqa, checkEqaImport, eqaPairKey, eqaDate } = require('../../app-dist/main/domain/eqa/import.js');

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

test('E-03: đối chiếu z nhà cung cấp và nhận diện đảo cột theo máy', () => {
  assert.equal(eqaProviderCheck(0.147, 0.15), 'match', 'lệch do làm tròn của nhà cung cấp');
  assert.equal(eqaProviderCheck(-0.147, 0.15), 'swapped');
  assert.equal(eqaProviderCheck(0.5, 1.2), 'mismatch');
  assert.equal(eqaProviderCheck(0.01, -0.01), 'match');
  assert.equal(eqaProviderCheck(0.3, null), 'none');
  assert.equal(eqaInstrumentSwapped(['swapped', 'swapped', 'match', 'none']), true);
  assert.equal(eqaInstrumentSwapped(['swapped', 'match']), false, 'không quá nửa');
  assert.equal(eqaInstrumentSwapped(['none', 'none']), false);
});

test('so nhóm đồng đẳng, PT score, gợi ý xét nghiệm, số đợt', () => {
  const [peer] = eqaPeerComparison(105, { instrument: { mean: 100, sd: 2.5, cv: 2.5, n: 30 } });
  assert.deepEqual([peer.level, peer.sdi, peer.pct], ['instrument', 2, 5]);
  assert.deepEqual(eqaCounts(['ok', 'ok', 'warn', 'rej']), { total: 4, ok: 2, warn: 1, rej: 1, ptScore: 50 });
  const catalog = [
    { id: 'alt-au', name: 'ALT', display_name: '', standard_name: '', abbreviation: 'ALT', aliases: ['GPT'], instrument_id: 'au', instrument_name: 'AU5800', instrument_model: '', active: true },
    { id: 'alt-dxc', name: 'ALT', display_name: '', standard_name: '', abbreviation: 'ALT', aliases: [], instrument_id: 'dxc', instrument_name: 'DxC 700', instrument_model: 'DxC700', active: true },
    { id: 'ast-au', name: 'AST', display_name: '', standard_name: '', abbreviation: 'AST', aliases: [], instrument_id: 'au', instrument_name: 'AU5800', instrument_model: '', active: true },
  ];
  assert.deepEqual(eqaSuggestTests('ALT(GPT)', 'AU5800', catalog), ['alt-au']);
  assert.deepEqual(eqaSuggestTests('ALT(GPT)', 'DxC700', catalog), ['alt-dxc'], 'so tên máy không phân biệt khoảng trắng');
  assert.deepEqual(eqaSuggestTests('Calcium', 'AU5800', catalog), []);
  assert.equal(eqaRoundNumber('ĐỢT 09'), 9);
  assert.equal(eqaDate('15/03/2026'), '2026-03-15');
  assert.equal(eqaDate(46096), '2026-03-15', 'số ngày Excel');
});

const HEAD = ['Mã thông số*', 'Đơn vị*', 'Mẫu*', 'Kết quả PXN (x)*', 'Giá trị ấn định (X)*', 'σp*', 'Thiết bị*', 'Z-score nhà cung cấp', 'Ấn định - Nhóm TB', 'SD - Nhóm TB', 'N - Nhóm TB'];
const INFO = [['Chương trình ngoại kiểm', 'CHƯƠNG TRÌNH SINH HÓA'], ['Vòng', 'ĐỢT 02'], ['Năm', 2026], ['Đơn vị tổ chức ngoại kiểm', 'TTKCXN TP. HCM'], ['Ngày báo cáo', '20/03/2026']];

test('đọc file Excel theo mẫu cũ: thông tin kỳ, cột bắt buộc, nhóm đồng đẳng, gộp nhiều file', () => {
  const parsed = parseEqaWorkbook({
    'Thông tin kỳ': INFO,
    'Danh mục thông số': [['Mã thông số', 'Đơn vị', 'Sai số cho phép (%)'], ['ALT', 'U/L', 15]],
    'Dữ liệu EQA': [HEAD, ['ALT', 'U/L', 'S1', 55, 54.278, 4.917, 'AU5800', 0.15, 53, 2, 40], [null], ['AST', 'U/L', 'S1', '30,5', 30, 2, 'AU5800', null, null, null, null]],
  }, 'au.xlsx');
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.round.program, 'CHƯƠNG TRÌNH SINH HÓA');
  assert.equal(parsed.round.year, 2026);
  assert.equal(parsed.round.reportDate, '2026-03-20');
  assert.equal(parsed.rows.length, 2, 'bỏ dòng trống');
  assert.equal(parsed.rows[0].tolerancePct, 15, 'sai số cho phép lấy từ danh mục khi dòng không ghi');
  assert.deepEqual(parsed.rows[0].peer, { instrument: { mean: 53, sd: 2, cv: null, n: 40 } });
  assert.equal(parsed.rows[1].result, 30.5, 'dấu phẩy thập phân');
  assert.equal(parsed.rows[0].ref, 'au.xlsx · dòng 2');

  const missing = parseEqaWorkbook({ 'Dữ liệu EQA': [['Mã thông số', 'Đơn vị']] });
  assert.match(missing.errors[0], /thiếu cột bắt buộc/);

  const other = parseEqaWorkbook({ 'Thông tin kỳ': [['Chương trình ngoại kiểm', 'KHÁC'], ['Vòng', 'ĐỢT 02'], ['Năm', 2026]], 'Dữ liệu EQA': [HEAD, ['ALT', 'U/L', 'S1', 1, 1, 1, 'DxC700']] });
  const merged = mergeEqaSources([parsed, other], ['au.xlsx', 'dxc.xlsx']);
  assert.equal(merged.rows.length, 2);
  assert.match(merged.errors[0], /dxc\.xlsx: thuộc kỳ khác/);
});

test('đọc dữ liệu của công cụ cũ từ file HTML (vùng nhúng) hoặc JSON sao lưu', () => {
  const data = { savedAt: '2026-10-26T13:38:40.312Z', periods: [{ pg: 'SINH HÓA', vg: 'ĐỢT 01', nm: '2026', info: { tc: 'TTKCXN', mdv: 10026, nhan: '01/02/2026' },
    rows: [{ code: 'ALT(GPT)', c: 'ALT(GPT) · AU5800', dv: 'AU5800', m: 'M1', u: 'U/L', x: 54.278, X: 55, s: 4.917, zn: 0.15, g: { T: { m: 53, sd: 2, cv: 3.7, n: 40 } } }] }] };
  const html = `<html><script id="eqa-embed" type="application/json">${JSON.stringify(data)}</script></html>`;
  for (const content of [html, JSON.stringify(data)]) {
    const { sources, error } = parseLegacyEqa(content);
    assert.equal(error, '');
    assert.equal(sources.length, 1);
    assert.deepEqual([sources[0].round.round, sources[0].round.year, sources[0].round.unitCode, sources[0].round.receivedDate], ['ĐỢT 01', 2026, '10026', '2026-02-01']);
    assert.deepEqual([sources[0].rows[0].code, sources[0].rows[0].instrument, sources[0].rows[0].zProvider], ['ALT(GPT)', 'AU5800', 0.15]);
    assert.deepEqual(sources[0].rows[0].peer.instrument, { mean: 53, sd: 2, cv: 3.7, n: 40 });
  }
  assert.match(parseLegacyEqa('không phải dữ liệu').error, /không chứa dữ liệu/);
});

const TESTS = [
  { id: 'alt-au', name: 'ALT', display_name: '', standard_name: '', abbreviation: 'ALT', aliases: [], instrument_id: 'au', instrument_name: 'AU5800', instrument_model: '', active: true },
  { id: 'ast-au', name: 'AST', display_name: '', standard_name: '', abbreviation: 'AST', aliases: [], instrument_id: 'au', instrument_name: 'AU5800', instrument_model: '', active: true },
];
const ROUND = { program: 'SINH HÓA', provider: 'TTKCXN', year: 2026, round: 'ĐỢT 01' };
const row = (over) => ({ ref: 'r', code: 'ALT', instrument: 'AU5800', level: '', sample: 'S1', unit: 'U/L', result: 55, assigned: 54.278, sigmaP: 4.917, zProvider: 0.15, tolerancePct: null, peer: {}, ...over });
const ctx = (over = {}) => ({ tests: TESTS, mapping: new Map([[eqaPairKey('ALT', 'AU5800'), 'alt-au'], [eqaPairKey('AST', 'AU5800'), 'ast-au']]), confirmedSwaps: new Set(), ...over });

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
  assert.match(mismatch.rows[0].warnings[0], /lệch z nhà cung cấp/);

  const badRound = checkEqaImport({ round: { ...ROUND, year: 'x' }, rows: [row()] }, ctx());
  assert.deepEqual(badRound.roundErrors, ['Năm ngoại kiểm không hợp lệ.']);
});

test('E-03: máy đảo cột bị chặn; xác nhận đảo lại thì z cùng dấu nhà cung cấp; không được đảo máy không có dấu hiệu', () => {
  // Như dữ liệu AU5800 đợt 01–08: cột kết quả chứa giá trị ấn định và ngược lại.
  const swappedRows = [row({ result: 54.278, assigned: 55 }), row({ code: 'AST', result: 31.2, assigned: 30, sigmaP: 2, zProvider: -0.6 })];
  const blocked = checkEqaImport({ round: ROUND, rows: swappedRows }, ctx());
  assert.equal(blocked.blocking, 2);
  assert.match(blocked.rows[0].errors[0], /có thể đảo cột/);
  assert.deepEqual(blocked.swaps.map((s) => [s.instrument, s.flagged, s.swappedRows]), [['AU5800', true, 2]]);

  const fixed = checkEqaImport({ round: ROUND, rows: swappedRows }, ctx({ confirmedSwaps: new Set(['au5800']) }));
  assert.equal(fixed.blocking, 0);
  assert.deepEqual(fixed.rows.map((r) => [r.result, r.assigned, r.swapped, r.providerCheck]), [[55, 54.278, true, 'match'], [30, 31.2, true, 'match']]);

  const notFlagged = checkEqaImport({ round: ROUND, rows: [row()] }, ctx({ confirmedSwaps: new Set(['au5800']) }));
  assert.match(notFlagged.rows[0].errors[0], /không có dấu hiệu đảo cột/);

  // Một dòng ngược dấu lẻ trên máy không bị đánh dấu: lỗi riêng dòng đó.
  const single = checkEqaImport({ round: ROUND, rows: [row({ result: 54.278, assigned: 55 }), row({ code: 'AST', result: 40, assigned: 30, sigmaP: 3, zProvider: 3.33 }), row({ code: 'AST', sample: 'S2', result: 33, assigned: 30, sigmaP: 3, zProvider: 1 })] }, ctx());
  assert.equal(single.swaps[0].flagged, false);
  assert.match(single.rows[0].errors[0], /ngược dấu z nhà cung cấp/);
});
