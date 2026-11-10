import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    try { return next(`${specifier}.ts`, context); } catch { /* Vite tự nối đuôi khi chạy trong app. */ }
  }
  return next(specifier, context);
} });
const { iqcLevelGroups, iqcChartSeries, buildIqcPrintHtml } = await import('../renderer/lib/iqc-report.ts');
const identity = { labName: 'Phòng xét nghiệm', labDept: '', labAddress: '', logoData: '', form: { formCode: 'BM-NK-01', version: '1.0', effectiveDate: '' } };
const row = (over = {}) => ({ id: 'p1', test_id: 't1', level: 1, date: '2026-11-02', run_id: '1', val: 10, lot: 'A', note: '', operator_name: 'KTV', voided: 0, void_reason: '', target_mean: 10, target_sd: 1, z: 0, verdict: 'ok', rules: [], accepted: true, run_rejected_by: [], ...over });

test('báo cáo nội kiểm: nhóm từng mức và chỉ giữ đúng khoảng ngày, thứ tự run tự nhiên', () => {
  const points = [row({ id: 'late', date: '2026-11-04' }), row({ id: 'm2', level: 2 }), row({ id: 'r10', run_id: '10' }), row({ id: 'r2', run_id: '2' }), row({ id: 'early', date: '2026-10-31' })];
  const groups = iqcLevelGroups(points, '2026-11-01', '2026-11-03');
  assert.deepEqual(groups.map((group) => group.level), [1, 2]);
  assert.deepEqual(groups[0].points.map((point) => point.id), ['r2', 'r10']);
  assert.equal(points[0].id, 'late', 'không sửa mảng dữ liệu nguồn');
});

test('biểu đồ báo cáo: không nối khác lô, không vẽ điểm huỷ/chưa đánh giá và giữ kết luận liên mức', () => {
  const points = [row(), row({ id: 'old-lot', lot: 'B' }), row({ id: 'm2', level: 2, lot: 'C', verdict: 'warn', z: 2.5, rules: ['1-2s'], accepted: false, run_rejected_by: [1] }), row({ id: 'void', voided: 1 }), row({ id: 'none', verdict: 'none', z: null }), row({ id: 'outside', date: '2026-12-01' })];
  const series = iqcChartSeries(points, '2026-11-01', '2026-11-10');
  assert.deepEqual(series.map((item) => [item.level, item.lot, item.points.length]), [[1, 'A', 1], [1, 'B', 1], [2, 'C', 1]]);
  assert.deepEqual(series[2].points[0].runRejectedBy, [1]);
  assert.equal(series[2].points[0].accepted, false);
  assert.equal(series[2].points[0].verdict, 'warn');
});

test('trang in: bảng riêng từng mức, có điểm huỷ/lý do, chú giải và ký duyệt; dữ liệu được escape', () => {
  const html = buildIqcPrintHtml({ identity, label: 'Chloride <Cl>', from: '2026-11-01', to: '2026-11-10', nce: null,
    points: [row(), row({ id: 'm2', level: 2, val: 200 }), row({ id: 'void', voided: 1, void_reason: 'Nhập nhầm <giá trị>' }), row({ id: 'none', z: null, verdict: 'none', accepted: false })], charts: ['data:image/png;base64,aGVsbG8='] });
  const m1 = /<section class="iqc-level" data-qc-level="1">([\s\S]*?)<\/section>/.exec(html)?.[1];
  const m2 = /<section class="iqc-level" data-qc-level="2">([\s\S]*?)<\/section>/.exec(html)?.[1];
  assert.ok(m1 && m2);
  assert.doesNotMatch(m1, /<td>200<\/td>/);
  assert.match(m2, /<td>200<\/td>/);
  assert.match(m1, /<thead><tr><th class="level-heading"/);
  assert.match(m1, /Đã huỷ: Nhập nhầm &lt;giá trị&gt;/);
  assert.match(html, /Chloride &lt;Cl&gt;/);
  assert.match(html, /Có 1 điểm chưa đủ dữ liệu đánh giá/);
  assert.match(html, /alt="Biểu đồ Levey-Jennings tổng hợp trong khoảng ngày báo cáo"/);
  assert.match(html, /NGƯỜI LẬP BÁO CÁO/);
  assert.doesNotMatch(html, /Phụ lục NCE|NaN|Infinity/);
});

test('trang in: khoảng rỗng và chỉ có dữ liệu chưa đánh giá không tạo biểu đồ giả', () => {
  const html = buildIqcPrintHtml({ identity, label: 'Test', from: '', to: '', points: [], nce: [], charts: [] });
  assert.match(html, /Không có dữ liệu QC trong khoảng ngày đã chọn/);
  assert.match(html, /Không có điểm QC còn hiệu lực và đủ Mean\/SD/);
  assert.doesNotMatch(html, /<figure/);
  assert.match(html, /Không có hồ sơ khắc phục nào/);
});
