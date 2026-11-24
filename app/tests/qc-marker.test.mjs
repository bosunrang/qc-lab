// U6: biểu đồ Levey-Jennings không dùng màu làm tín hiệu duy nhất.
// - Đạt, Cảnh báo, Loại mỗi loại một hình (tròn, tam giác, vuông).
// - Biểu đồ nhiều mức tách mức bằng kiểu nét, không bằng hình.
// - Điểm Loại ghi tên luật, nhãn không đè lên nhau.
// - Mọi chỗ vẽ điểm trong QcChart đi qua `traceMarker`, không tự vẽ chấm tròn.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { levelDash, markerShape, markerSize, pickRejectLabels, rejectRuleLabel, traceMarker } from '../renderer/lib/qc-marker.ts';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('mỗi kết luận một hình, Cảnh báo và Loại khác hình nhau', () => {
  assert.equal(markerShape('ok'), 'circle');
  assert.equal(markerShape('none'), 'circle');
  assert.equal(markerShape('warn'), 'triangle');
  assert.equal(markerShape('rej'), 'square');
  assert.ok(markerSize('warn') > markerSize('ok') && markerSize('rej') > markerSize('ok'), 'điểm bất thường to hơn điểm Đạt');
});

test('traceMarker vẽ đúng hình, tam giác lấy trọng tâm làm tâm', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, name) => (...args) => calls.push([name, ...args]) });
  traceMarker(ctx, 'square', 10, 20, 5);
  assert.deepEqual(calls, [['beginPath'], ['rect', 5, 15, 10, 10]]);
  calls.length = 0;
  traceMarker(ctx, 'triangle', 0, 0, 6);
  const vertices = calls.filter(([name]) => name === 'moveTo' || name === 'lineTo').map(([, x, y]) => [x, y]);
  assert.equal(vertices.length, 3);
  const cx = vertices.reduce((s, [x]) => s + x, 0) / 3, cy = vertices.reduce((s, [, y]) => s + y, 0) / 3;
  assert.ok(Math.abs(cx) < 1e-9 && Math.abs(cy) < 1e-9, 'trọng tâm tam giác trùng toạ độ điểm');
  assert.equal(calls.at(-1)[0], 'closePath');
});

test('ba mức đầu có ba kiểu nét khác nhau, mức 1 nét liền', () => {
  const dashes = [0, 1, 2].map((i) => JSON.stringify(levelDash(i)));
  assert.equal(new Set(dashes).size, 3);
  assert.deepEqual(levelDash(0), []);
  assert.deepEqual(levelDash(3), levelDash(0), 'lặp lại sau ba mức');
  const dash = levelDash(1); dash.push(99);
  assert.notDeepEqual(levelDash(1), dash, 'trả bản sao, người gọi sửa không ảnh hưởng bảng gốc');
});

test('nhãn luật của điểm Loại: tối đa hai luật', () => {
  assert.equal(rejectRuleLabel(['1-3s']), '1-3s');
  assert.equal(rejectRuleLabel(['2-2s', 'R-4s']), '2-2s, R-4s');
  assert.equal(rejectRuleLabel(['1-3s', '2-2s', 'R-4s']), '1-3s, 2-2s…');
  assert.equal(rejectRuleLabel([]), '');
});

test('nhãn cùng phía chồng nhau thì bỏ nhãn sau, khác phía thì giữ cả hai', () => {
  const picked = pickRejectLabels([
    { x: 100, above: true, width: 30 },
    { x: 110, above: true, width: 30 }, // đè nhãn đầu → bỏ
    { x: 112, above: false, width: 30 }, // phía dưới, chưa có nhãn → giữ
    { x: 160, above: true, width: 30 }, // cách đủ xa → giữ
  ]);
  assert.deepEqual(picked, [0, 2, 3]);
});

test('QcChart vẽ mọi điểm qua traceMarker, không còn chấm tròn tự vẽ', () => {
  const source = fs.readFileSync(path.join(APP, 'renderer', 'components', 'QcChart.tsx'), 'utf8');
  assert.doesNotMatch(source, /ctx\.arc\(/);
  assert.match(source, /setLineDash\(levelDash\(li\)\)/, 'đường và chú giải nhiều mức dùng kiểu nét theo mức');
  // Kết luận do luật quyết định, không do khoảng SD: điểm trong ±3SD vẫn bị loại theo 2-2s/R-4s.
  const legend = source.slice(source.indexOf('export function QcChartLegend('), source.indexOf('</ul>;', source.indexOf('export function QcChartLegend(')));
  assert.doesNotMatch(legend, /ngoài 3SD|2–3SD|Trong ±2SD/, 'chú giải không gắn kết luận với khoảng SD');
  assert.match(legend, /Loại bỏ theo luật Westgard/);
  for (const file of ['pages/entry/EntryLjPanel.tsx', 'pages/WestgardPage.tsx', 'pages/westgard/ArchivedGroupView.tsx']) {
    assert.match(fs.readFileSync(path.join(APP, 'renderer', file), 'utf8'), /<QcChartLegend \/>/, `${file} có chú giải hình điểm`);
  }
});

test('PDF Westgard có biểu đồ L-J tổng hợp đặt trên bảng số liệu', () => {
  const chart = fs.readFileSync(path.join(APP, 'renderer', 'components', 'QcChart.tsx'), 'utf8');
  const page = fs.readFileSync(path.join(APP, 'renderer', 'pages', 'WestgardPage.tsx'), 'utf8');
  // Ảnh in vẽ bằng chính `drawMulti()` của biểu đồ trên màn hình, không có bản vẽ thứ hai.
  assert.match(chart, /export function renderQcMultiChartPng\([^)]*\)[^{]*\{[\s\S]*?drawMulti\(ctx, width, height, series\);/);
  const printPdf = page.slice(page.indexOf('async function printPdf('), page.indexOf('printHtmlToPdf(html'));
  assert.match(printPdf, /renderQcMultiChartPng\(multiSeries\)/, 'PDF dùng cùng các đường đang xem trên màn hình');
  assert.match(printPdf, /\$\{chart\}<table>/, 'biểu đồ đứng ngay trên bảng số liệu');
  assert.match(printPdf, /hình rỗng: lần chạy bị loại/, 'bản in có chú giải hình điểm bằng chữ');
});
