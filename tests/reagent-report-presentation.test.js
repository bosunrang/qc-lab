'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-report-presentation.ts')).href;
const program = `
  import { reagentReportPresentation as p } from ${JSON.stringify(source)};
  const colors = { okBg: '#1', okFg: '#2', midBg: '#3', midFg: '#4', noBg: '#5', noFg: '#6' };
  console.log(JSON.stringify({
    values: [p.formatNumber(1.2300), p.formatNumber(Infinity), p.formatTStatistic(Infinity), p.formatTStatistic(-Infinity)],
    missing: p.verdict(null, colors), ok: p.verdict({ level: 'ok' }, colors), mid: p.verdict({ level: 'mid' }, colors), no: p.verdict({ level: 'no' }, colors),
    conclusions: [p.conclusion({ level: 'ok' }), p.conclusion({ level: 'mid' }), p.conclusion({ level: 'no' })],
    rows: p.summaryRows([{ ds: { test: { reagent: 'Glucose', unit: 'mmol/L', lotOld: 'A', lotNew: 'B' } }, R: { level: 'ok', N: 20, r: 0.98765, bias: 1.234, p2: 0.01234 } }], colors),
    detail: p.detailModel({ level: 'ok', o: [10], n: [11], mO: 10, mN: 11, r: 0.9, tStat: -2, df: 19, p2: 0.02, bias: 10, fit: { a: -1.5, b: 1.1, r2: 0.81 }, pb: { a: 2.5, b: 0.9 } }, { reagent: 'Glucose', lotOld: 'A', lotNew: 'B', biasTarget: 6, alpha: 0.05 }, 20, '11/08/2026'),
  }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'không thể chạy mô-đun TypeScript báo cáo hóa chất');
const output = JSON.parse(result.stdout);
assert.deepEqual(output.values, ['1.23', '—', '+∞', '−∞']);
assert.deepEqual(output.missing, { text: 'Thiếu dữ liệu', cls: 'mid', bg: '#3', fg: '#4' });
assert.deepEqual(output.ok, { text: 'Đạt sàng lọc', cls: 'ok', bg: '#1', fg: '#2' });
assert.deepEqual(output.mid, { text: 'Chưa đủ điều kiện', cls: 'mid', bg: '#3', fg: '#4' });
assert.deepEqual(output.no, { text: 'Có khác biệt', cls: 'no', bg: '#5', fg: '#6' });
assert.match(output.conclusions[0], /trình phê duyệt theo SOP/);
assert.match(output.conclusions[1], /bổ sung dữ liệu/);
assert.match(output.conclusions[2], /không dùng lô mới/);
assert.deepEqual(output.rows, [{ index: 1, reagent: 'Glucose', unit: 'mmol/L', lotOld: 'A', lotNew: 'B', result: { level: 'ok', N: 20, r: 0.98765, bias: 1.234, p2: 0.01234 }, n: 20, r: '0.9877', bias: '1.23%', p2: '0.0123', verdict: { text: 'Đạt sàng lọc', cls: 'ok', bg: '#1', fg: '#2' } }]);
assert.equal(output.detail.complete, true);
assert.deepEqual(output.detail.pairs, [{ index: 1, oldValue: 10, newValue: 11, average: '10.500', difference: '-1.000' }]);
assert.deepEqual(output.detail.metrics, { meanOld: '10', meanNew: '11', correlation: '0.9', tStatistic: '-2', df: 19, p2: '0.02', bias: '10', olsSlope: '1.1', olsIntercept: '1.5', olsInterceptSign: '−', olsR2: '0.81', pbSlope: '0.9', pbIntercept: '2.5', pbInterceptSign: '+' });

console.log('Reagent report presentation TypeScript tests passed');
