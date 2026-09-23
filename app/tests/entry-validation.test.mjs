// Oracle cho cảnh báo giá trị QC vượt ±5SD trước khi lưu.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { extremeQcPointDeviation } = require('../../app-dist/main/domain/entry-validation.js');

assert.equal(extremeQcPointDeviation(15, 10, 1), null, 'đúng +5SD không cảnh báo');
assert.equal(extremeQcPointDeviation(5, 10, 1), null, 'đúng -5SD không cảnh báo');
assert.equal(extremeQcPointDeviation(15.01, 10, 1), 5.01, 'trên +5SD phải cảnh báo');
assert.equal(extremeQcPointDeviation(4.99, 10, 1), -5.01, 'dưới -5SD phải cảnh báo');
assert.equal(extremeQcPointDeviation(20, 10, 0), null, 'SD không hợp lệ không tính cảnh báo ±5SD');
assert.equal(extremeQcPointDeviation(6, null, 1), null, 'thiếu Mean không tính cảnh báo ±5SD');
assert.equal(extremeQcPointDeviation('x', 10, 1), null, 'giá trị không phải số không tính độ lệch');


// Ngày điểm QC phải tồn tại TRÊN LỊCH, không chỉ khớp `YYYY-MM-DD`. Cả app cũ
// (`preparePointInput`) và app trước 2026-09-10 đều chỉ kiểm định dạng, nên
// `2026-02-31` lưu được — rồi làm mốc thời gian của cohort Sigma và báo cáo
// thành vô nghĩa. Đây là cổng ghi DUY NHẤT của `qc_points` nên siết ở đây.
{
  const { validateQcPointInput } = require('../../app-dist/main/domain/entry-validation.js');
  const base = { testId: 'T1', level: 1, val: 10, date: '2026-08-01' };
  assert.equal(validateQcPointInput(base, [1]).ok, true, 'ngày thật thì qua');
  for (const date of ['2026-02-31', '2026-13-01', '2026-04-31', '2025-02-29', '2026-00-10', '2026-08-00', '2026-08-32']) {
    const result = validateQcPointInput({ ...base, date }, [1]);
    assert.equal(result.ok, false, `ngày không tồn tại phải bị chặn: ${date}`);
    assert.equal(result.code, 'invalid-date');
  }
  assert.equal(validateQcPointInput({ ...base, date: '2024-02-29' }, [1]).ok, true, 'năm nhuận thật thì qua');
}

// Giá trị QC phải là MỘT SỐ ĐẦY ĐỦ. `parseFloat()` đọc tới đâu hay tới đó rồi
// bỏ phần còn lại, nên `"12,5"` (dấu phẩy thập phân, cách gõ quen thuộc ở VN)
// lưu thành 12 mà không một cảnh báo nào. Renderer gửi `number` nên không
// dính, nhưng đây là cổng ghi DUY NHẤT — LIS và client LAN đi cùng đường này.
{
  const { validateQcPointInput } = require('../../app-dist/main/domain/entry-validation.js');
  const base = { testId: 'T1', level: 1, date: '2026-08-01' };
  for (const [val, expected] of [[12.5, 12.5], ['12.5', 12.5], [' 12.5 ', 12.5], ['-0.75', -0.75], ['+3', 3], ['.5', 0.5], ['1.2e5', 120000]]) {
    const result = validateQcPointInput({ ...base, val }, [1]);
    assert.equal(result.ok, true, `số hợp lệ phải qua: ${JSON.stringify(val)}`);
    assert.equal(result.data.val, expected, `đọc đúng giá trị: ${JSON.stringify(val)}`);
  }
  for (const val of ['12,5', '12.5abc', '12 5', '0x10', '1.2.3', '', '  ', 'abc', null, undefined, {}, '--4']) {
    const result = validateQcPointInput({ ...base, val }, [1]);
    assert.equal(result.ok, false, `chuỗi không phải số phải bị chặn: ${JSON.stringify(val)}`);
    assert.equal(result.code, 'invalid-value');
  }
  assert.equal(validateQcPointInput({ ...base, val: NaN }, [1]).ok, false, 'NaN vẫn bị chặn');
}

console.log('app entry-validation ±5SD oracle tests passed');
