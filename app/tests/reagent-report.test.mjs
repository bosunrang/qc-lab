import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

const require = createRequire(import.meta.url);
const { calculateReagentComparison } = require('../../app-dist/main/domain/reagent-stats.js');
let server, buildReagentReport, ReagentChart;
before(async () => {
  server = await createServer({ configFile: false, root: fileURLToPath(new URL('../renderer', import.meta.url)), logLevel: 'error',
    appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
  ({ buildReagentReport } = await server.ssrLoadModule('/lib/reagent-report.tsx'));
  ({ ReagentChart } = await server.ssrLoadModule('/components/ReagentChart.tsx'));
});
after(async () => { await server?.close(); });

const identity = { labName: 'Phòng xét nghiệm kiểm thử', labDept: 'Khoa Hoá sinh', labAddress: 'Địa chỉ kiểm thử', logoData: '',
  form: { formCode: 'BM-HC-01', version: '02', effectiveDate: '2026-11-01' } };
function comparison(rows = Array.from({ length: 20 }, (_, i) => [String(10 + i * 5), String((10 + i * 5) * 1.01 + (i % 3) * 0.1)])) {
  return { id: 'selected', reagent: 'Glucose đang chọn', unit: 'mmol/L', lot_old: 'CU-001', lot_new: 'MOI-002', date: '2026-11-11',
    operator: 'Nguyễn Văn Kiểm', sample_type: 'Huyết thanh', bias_target: 6, alpha: 0.05, coverage_confirmed: 1, rows,
    result: calculateReagentComparison({ rows, test: { biasTarget: 6, alpha: 0.05, coverageConfirmed: true } }) };
}

test('PDF chứa đủ dữ liệu của phép so sánh được truyền vào và hai biểu đồ giống màn hình', () => {
  const selected = comparison();
  const html = buildReagentReport(selected, identity);
  for (const text of ['Glucose đang chọn', 'mmol/L', 'CU-001', 'MOI-002', '11/11/2026', 'Nguyễn Văn Kiểm', 'Huyết thanh',
    'BM-HC-01', 'Khoa Hoá sinh', 'Bias mong muốn (%)', 'Mức ý nghĩa', 'Đã xác nhận theo SOP',
    'Dữ liệu đo bắt cặp', 'Kết quả thống kê', 'Phương sai', 'Bậc tự do', 'Giá trị t', 'một phía', 'hai phía',
    'Passing-Bablok', 'OLS', 'Chênh lệch tương đối TB', 'Tiêu chí chấp nhận', 'Kết luận: Đạt tiêu chí sàng lọc phần mềm',
    'Biểu đồ tương quan', 'Biểu đồ Bland-Altman', 'NGƯỜI LẬP BÁO CÁO', 'PHÊ DUYỆT']) assert.ok(html.includes(text), text);
  assert.equal((html.match(/<tr>/g) || []).length, 21, 'giữ đủ 20 cặp và một hàng tiêu đề');
  assert.equal((html.match(/class="rc-crit-item"/g) || []).length, 6);
  for (const [oldValue, newValue] of selected.rows) {
    assert.ok(html.includes(`<td>${oldValue}</td><td>${newValue}</td>`));
  }
  for (const mode of ['scatter', 'bland']) {
    const svg = renderToStaticMarkup(createElement(ReagentChart, { mode, result: selected.result, lotOld: selected.lot_old, lotNew: selected.lot_new }));
    assert.ok(html.includes(svg), `biểu đồ ${mode} khớp chính component trên màn hình`);
  }
  const other = buildReagentReport({ ...selected, reagent: 'Creatinine khác', lot_old: 'KHAC-003' }, identity);
  assert.ok(!other.includes('Glucose đang chọn'));
  assert.ok(!other.includes('CU-001'));
});

test('PDF giữ dòng nhập thiếu và không tạo kết quả hay biểu đồ khi chưa đủ cặp', () => {
  const html = buildReagentReport(comparison([['10', '11'], ['12', ''], ['', '13'], ['', '']]), identity);
  assert.ok(html.includes('<td>2</td><td>12</td><td>—</td><td>—</td><td>—</td>'));
  assert.ok(html.includes('Chưa đủ dữ liệu để kết luận'));
  assert.ok(html.includes('Chưa có biểu đồ'));
  assert.ok(!html.includes('<svg'));
  assert.ok(!html.includes('Kết luận: Đạt'));
});

test('PDF thoát ký tự HTML trong thông tin, số lô, dữ liệu nhập và nhãn trục', () => {
  const selected = comparison();
  const html = buildReagentReport({ ...selected, reagent: '<script>alert(1)</script>', operator: '<img src=x onerror=alert(1)>',
    lot_old: '<svg onload=alert(1)>', rows: [...selected.rows, ['<b>lỗi</b>', '']] }, identity);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<svg onload='));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;b&gt;lỗi&lt;/b&gt;'));
});

test('PDF giữ kết luận chưa đủ điều kiện và không đạt, kể cả t vô hạn', () => {
  for (const factor of [1.01, 2]) {
    const selected = comparison(Array.from({ length: 5 }, (_, i) => [String(10 + i * 10), String((10 + i * 10) * factor)]));
    const html = buildReagentReport(selected, identity);
    assert.ok(html.includes(factor === 2 ? 'Kết luận: Hai lô hoá chất có khác biệt' : 'Kết luận: Chưa đủ điều kiện sàng lọc'));
  }
  const html = buildReagentReport(comparison(Array.from({ length: 20 }, (_, i) => [String(i + 10), String(i + 11)])), identity);
  assert.ok(html.includes('−∞'));
  assert.ok(!html.includes('NaN'));
});
