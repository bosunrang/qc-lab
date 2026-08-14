'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-report-presentation.ts')).href;
const program = `
  import { reagentReportPresentation as p } from ${JSON.stringify(source)};
  const colors = { okBg: '#1', okFg: '#2', midBg: '#3', midFg: '#4', noBg: '#5', noFg: '#6', muted: '#7' };
  console.log(JSON.stringify({
    values: [p.formatNumber(1.2300), p.formatNumber(Infinity), p.formatTStatistic(Infinity), p.formatTStatistic(-Infinity)],
    missing: p.verdict(null, colors), ok: p.verdict({ level: 'ok' }, colors), mid: p.verdict({ level: 'mid' }, colors), no: p.verdict({ level: 'no' }, colors),
    conclusions: [p.conclusion({ level: 'ok' }), p.conclusion({ level: 'mid' }), p.conclusion({ level: 'no' })],
    pill: p.pillHtml({ text: '<Đạt>', bg: '#0e8f8f', fg: '#fff' }, value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;')),
    subtitle: p.subtitleHtml('Từ 01/01 đến 31/01', '#667b89'),
    meta: p.detailMetaHtml({ lotOld: '<A>', lotNew: 'B', dateText: '11/08/2026', operator: 'Nguyễn A', sampleType: 'Huyết thanh', biasTarget: '6', alpha: '0.05' }, value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;')),
    metrics: p.metricsHtml({ meanOld: '10', meanNew: '11', correlation: '0.9', tStatistic: '-2', df: 19, p2: '0.02', bias: '10', olsSlope: '1.1', olsInterceptSign: '−', olsIntercept: '1.5', olsR2: '0.81', pbSlope: '0.9', pbInterceptSign: '+', pbIntercept: '2.5' }),
    conclusionHtml: p.conclusionHtml('Đạt &amp; phê duyệt', '#667b89'),
    pairsTable: p.pairTableHtml([{ index: 1, oldValue: 10, newValue: 11, average: '10.500', difference: '-1.000' }]),
    missingHtml: p.missingDataHtml(5),
    table: p.summaryTableHtml([{ ds: { test: { reagent: '<Glucose>', unit: 'mmol/L', lotOld: 'A', lotNew: 'B' } }, R: { level: 'ok', N: 20, r: 0.98765, bias: 1.234, p2: 0.01234 } }], colors, value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;')),
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
assert.equal(output.pill, '<span style="display:inline-block;border-radius:999px;padding:3px 9px;font-weight:800;font-size:var(--type-overline);background:#0e8f8f;color:#fff">&lt;Đạt&gt;</span>');
assert.equal(output.subtitle, '<div style="color:#667b89;font-size:var(--type-meta);margin:-8px 0 14px;text-align:center">Từ 01/01 đến 31/01</div>');
assert.match(output.meta, /Lô cũ: <b>&lt;A&gt;<\/b>/, 'Metadata phải escape số lô');
assert.match(output.meta, /Người thực hiện: Nguyễn A/, 'Metadata phải có người thực hiện');
assert.match(output.meta, /Giới hạn chênh lệch &lt; 6%/, 'Metadata phải có ngưỡng bias');
assert.match(output.metrics, /Pearson r: <b>0\.9<\/b>/);
assert.match(output.metrics, /OLS: <b>y=1\.1x−1\.5<\/b>, R²=0\.81/);
assert.match(output.metrics, /Passing-Bablok: <b>y=0\.9x\+2\.5<\/b>/);
assert.match(output.conclusionHtml, /<b>Kết luận:<\/b> Đạt &amp; phê duyệt/);
assert.match(output.conclusionHtml, /style="color:#667b89"/);
assert.match(output.conclusionHtml, /không dùng riêng các chỉ số này để tự chấp nhận lô mới/);
assert.match(output.pairsTable, /<th>Mẫu<\/th>/);
assert.match(output.pairsTable, /<td class="num">10\.500<\/td>/);
assert.match(output.pairsTable, /<td class="num">-1\.000<\/td>/);
assert.equal(output.missingHtml, '<p><i>Chưa đủ dữ liệu (cần tối thiểu 5 cặp).</i></p>');
assert.match(output.table, /<th>Hóa chất<\/th>/);
assert.match(output.table, /<b>&lt;Glucose&gt;<\/b>/, 'Bảng phải escape tên hóa chất');
assert.match(output.table, /style="color:#7"/, 'Bảng phải dùng màu phụ từ palette');
assert.match(output.table, /Đạt sàng lọc/, 'Bảng phải dựng nhãn kết luận');
assert.deepEqual(output.rows, [{ index: 1, reagent: 'Glucose', unit: 'mmol/L', lotOld: 'A', lotNew: 'B', result: { level: 'ok', N: 20, r: 0.98765, bias: 1.234, p2: 0.01234 }, n: 20, r: '0.9877', bias: '1.23%', p2: '0.0123', verdict: { text: 'Đạt sàng lọc', cls: 'ok', bg: '#1', fg: '#2' } }]);
assert.equal(output.detail.complete, true);
assert.deepEqual(output.detail.pairs, [{ index: 1, oldValue: 10, newValue: 11, average: '10.500', difference: '-1.000' }]);
assert.deepEqual(output.detail.metrics, { meanOld: '10', meanNew: '11', correlation: '0.9', tStatistic: '-2', df: 19, p2: '0.02', bias: '10', olsSlope: '1.1', olsIntercept: '1.5', olsInterceptSign: '−', olsR2: '0.81', pbSlope: '0.9', pbIntercept: '2.5', pbInterceptSign: '+' });

console.log('Reagent report presentation TypeScript tests passed');
