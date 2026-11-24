// Bảng điểm Phân tích Westgard (đánh giá giao diện 09/11/2026): mặc định chỉ
// hiện điểm có vi phạm, mới nhất trước, chia trang 25 dòng; không có vi phạm
// thì hiện tất cả. Cột "#" giữ số thứ tự theo thời gian của cả chuỗi.
import assert from 'node:assert/strict';
import test from 'node:test';
import { POINT_PAGE_SIZE, effectiveFilter, filterCounts, matchesFilter, pointRows } from '../renderer/pages/westgard/point-filter.ts';

const point = (id, verdict = 'ok', extra = {}) => ({ id, verdict, runRejected: false, cusumSignal: null, ...extra });

test('đếm và lọc: loại bỏ gồm cả lần chạy bị loại ở mức khác; cảnh báo gồm CUSUM', () => {
  const points = [
    point('a'), point('b', 'warn'), point('c', 'rej'),
    point('d', 'ok', { runRejected: true }), point('e', 'ok', { cusumSignal: 'C+' }), point('f', 'warn', { runRejected: true }),
  ];
  assert.deepEqual(filterCounts(points), { issues: 5, warn: 2, rej: 3, all: 6 });
  assert.deepEqual(points.filter((p) => matchesFilter(p, 'rej')).map((p) => p.id), ['c', 'd', 'f']);
  assert.deepEqual(points.filter((p) => matchesFilter(p, 'warn')).map((p) => p.id), ['b', 'e']);
  assert.deepEqual(points.filter((p) => matchesFilter(p, 'issues')).map((p) => p.id), ['b', 'c', 'd', 'e', 'f']);
});

test('mặc định "Có vi phạm"; không có vi phạm thì "Tất cả"; lựa chọn của người dùng được giữ', () => {
  assert.equal(effectiveFilter(null, filterCounts([point('a'), point('b', 'warn')])), 'issues');
  assert.equal(effectiveFilter(null, filterCounts([point('a'), point('b')])), 'all');
  assert.equal(effectiveFilter('rej', filterCounts([point('a')])), 'rej');
});

test('mới nhất trước, chia trang, "#" giữ thứ tự thời gian', () => {
  const points = Array.from({ length: 60 }, (_, i) => point(`p${i + 1}`, i % 2 ? 'warn' : 'ok'));
  const first = pointRows(points, 'all', 1);
  assert.equal(first.total, 60);
  assert.equal(first.pageCount, Math.ceil(60 / POINT_PAGE_SIZE));
  assert.deepEqual(first.rows.slice(0, 2).map((row) => [row.point.id, row.seq]), [['p60', 60], ['p59', 59]]);
  const last = pointRows(points, 'all', 99);
  assert.equal(last.page, last.pageCount, 'trang vượt quá bị kẹp về trang cuối');
  assert.deepEqual(last.rows.at(-1).seq, 1);
  const issues = pointRows(points, 'issues', 1);
  assert.equal(issues.total, 30);
  assert.deepEqual(issues.rows.slice(0, 2).map((row) => row.seq), [60, 58]);
});
