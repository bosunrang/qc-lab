// Ô Mean/SD ở Cấu hình chung hiện đủ số chữ số thập phân như giới hạn
// dưới/trên (1.2 → "1.20" cạnh "1.10"), nhưng không làm tròn giá trị đã lưu
// có nhiều chữ số hơn — ô được lưu lại nguyên văn (đánh giá giao diện 09/11/2026).
import assert from 'node:assert/strict';
import test from 'node:test';
import { targetInputText } from '../renderer/lib/target-range.ts';

test('thêm số 0 cho đủ chữ số thập phân, không làm tròn', () => {
  assert.equal(targetInputText(1.2, 2), '1.20');
  assert.equal(targetInputText(12, 1), '12.0');
  assert.equal(targetInputText(0.05, 2), '0.05');
  assert.equal(targetInputText(5.2134, 2), '5.2134', 'giá trị nhiều chữ số hơn giữ nguyên');
  assert.equal(Number(targetInputText(1.2, 3)), 1.2, 'đọc lại ra đúng số cũ');
  assert.equal(targetInputText(null, 2), '');
  assert.equal(targetInputText(undefined, 2), '');
});
