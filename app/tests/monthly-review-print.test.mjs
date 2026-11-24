import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    try { return next(`${specifier}.ts`, context); } catch { /* Vite tự nối đuôi trong ứng dụng. */ }
  }
  return next(specifier, context);
} });
const { buildMonthlyReviewPrintHtml, REVIEW_HEADERS, reviewRowCells, reviewRowGroups } = await import('../renderer/lib/monthly-review-print.ts');
const identity = { labName: 'Phòng xét nghiệm', labDept: '', labAddress: '', logoData: '', form: { formCode: 'BM-XX-01', version: '1.0', effectiveDate: '' } };
const row = (over = {}) => ({ test_id: 'cl', test_name: 'Chloride (Cl)', instrument_name: 'Máy A', unit: '', decimal_places: 2, level: 1, lot: '1102', n: 10, accepted: 10, rejected: 0, unevaluated: 0, mean: 102, sd: 2, cv: 1.96, target_mean: 102, target_sd: 2, target_cv: 1.96, target_changed: false, shift_sd: 0, bias_pct: 0, voided: 0, voided_rejected: 0, ...over });
const table = (rows) => buildMonthlyReviewPrintHtml(identity, { ym: '2026-11', rows, nce: [], totals: { points: 0, accepted: 0, rejected: 0, rejected_runs: 0, voided: 0, voided_rejected: 0, nce: 0, nce_open: 0 }, open_items: '', signatures: [] }).match(/<table>([\s\S]*?)<\/table>/)[1];

test('bản in tháng: gộp máy chung và tên xét nghiệm, giữ đủ dòng mức/lô và giá trị', () => {
  const rows = ['cl', 'k', 'na'].flatMap((id, index) => [1, 2].map((level) => row({ test_id: id, test_name: id, level, mean: 100 + index * 10 + level })));
  const html = table(rows);
  assert.deepEqual(REVIEW_HEADERS.slice(0, 2), ['Máy', 'Xét nghiệm']);
  assert.deepEqual(reviewRowCells(rows[0]).slice(0, 2), ['Máy A', 'cl']);
  assert.match(html, /<tr><td rowspan="6">Máy A<\/td><td rowspan="2">cl<\/td>/);
  assert.deepEqual(reviewRowGroups(rows).flat().map((item) => item.row), rows);
  assert.match(html, /<td rowspan="6">Máy A<\/td>/);
  for (const id of ['cl', 'k', 'na']) assert.match(html, new RegExp(`<td rowspan="2">${id}</td>`));
  assert.equal((html.match(/<tr>/g) || []).length, 7);
  assert.equal((html.match(/<td>M1<\/td>/g) || []).length, 3);
  assert.equal((html.match(/<td>M2<\/td>/g) || []).length, 3);
  for (const r of rows) assert.ok(html.includes(`<td>${r.mean.toFixed(2)}</td>`));
});

test('bản in tháng: không gộp trùng tên khác định danh, khác máy hoặc nhóm không liền nhau', () => {
  const html = table([row({ test_id: 'a' }), row({ test_id: 'b' }), row({ test_id: 'a', instrument_name: 'Máy B' }), row({ test_id: 'a' })]);
  assert.equal((html.match(/<td rowspan="1">Chloride \(Cl\)<\/td>/g) || []).length, 4);
  assert.equal((html.match(/<tbody class="review-group">/g) || []).length, 3);
  assert.match(html, /<td rowspan="2">Máy A<\/td>/);
});

test('bản in tháng: giữ số liệu khác lô, escape ô gộp và xử lý tháng rỗng', () => {
  const html = table([row({ test_name: 'Cl <1>', instrument_name: 'Máy & A', lot: 'A' }), row({ test_name: 'Cl <1>', instrument_name: 'Máy & A', lot: 'B', level: 2 })]);
  assert.match(html, /<td rowspan="2">Cl &lt;1&gt;<\/td>/);
  assert.match(html, /<td rowspan="2">Máy &amp; A<\/td>/);
  assert.match(html, /<td>A<\/td>/);
  assert.match(html, /<td>B<\/td>/);
  assert.match(table([]), /<td colspan="15">Không có kết quả QC trong tháng\.<\/td>/);
});
