// Hàng chờ "Lần chạy QC cần xử lý" (đánh giá giao diện 09/11/2026): nhóm theo
// xét nghiệm, nhóm có lần chạy gần nhất lên đầu, trong nhóm mới nhất trước;
// lọc theo một xét nghiệm; chia trang theo số dòng, nhóm giữ tổng của cả hàng chờ.
import assert from 'node:assert/strict';
import test from 'node:test';
import { queuePage, queueTestOptions } from '../renderer/pages/actions/queue-groups.ts';

const row = (testId, testName, date, n = 1) => ({ test_id: testId, test_name: testName, date, run_id: `${date}-${n}`, rejected_levels: [], record: null, attach_to: null });
const rows = [
  row('a', 'ALT', '2026-09-22'),
  row('c', 'Cholesterol', '2026-11-05'), row('c', 'Cholesterol', '2026-11-09'), row('c', 'Cholesterol', '2026-11-07'),
  row('t', 'TSH', '2026-11-06'),
];

test('nhóm có lần chạy gần nhất lên đầu, trong nhóm mới nhất trước', () => {
  const view = queuePage(rows, '', 1);
  assert.deepEqual(view.groups.map((g) => [g.testName, g.total, g.rows.map((r) => r.date)]), [
    ['Cholesterol', 3, ['2026-11-09', '2026-11-07', '2026-11-05']],
    ['TSH', 1, ['2026-11-06']],
    ['ALT', 1, ['2026-09-22']],
  ]);
});

test('lọc theo xét nghiệm; ô lọc xếp xét nghiệm nhiều lần chạy nhất lên đầu', () => {
  assert.deepEqual(queuePage(rows, 't', 1).groups.map((g) => g.testName), ['TSH']);
  assert.deepEqual(queueTestOptions(rows).map((o) => [o.testName, o.count]), [['Cholesterol', 3], ['ALT', 1], ['TSH', 1]]);
});

test('chia trang theo dòng; nhóm bị cắt qua trang vẫn ghi tổng của cả hàng chờ', () => {
  const first = queuePage(rows, '', 1, 2);
  assert.equal(first.pageCount, 3);
  assert.deepEqual(first.groups.map((g) => [g.testName, g.rows.length, g.total]), [['Cholesterol', 2, 3]]);
  const second = queuePage(rows, '', 2, 2);
  assert.deepEqual(second.groups.map((g) => [g.testName, g.rows.length, g.total]), [['Cholesterol', 1, 3], ['TSH', 1, 1]]);
  assert.equal(queuePage(rows, '', 99, 2).page, 3, 'trang vượt quá bị kẹp về trang cuối');
});
