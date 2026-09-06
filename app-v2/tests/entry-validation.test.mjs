// Oracle cho cảnh báo giá trị QC vượt ±5SD trước khi lưu.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { extremeQcPointDeviation } = require('../../app-v2-dist/main/domain/entry-validation.js');

assert.equal(extremeQcPointDeviation(15, 10, 1), null, 'đúng +5SD không cảnh báo');
assert.equal(extremeQcPointDeviation(5, 10, 1), null, 'đúng -5SD không cảnh báo');
assert.equal(extremeQcPointDeviation(15.01, 10, 1), 5.01, 'trên +5SD phải cảnh báo');
assert.equal(extremeQcPointDeviation(4.99, 10, 1), -5.01, 'dưới -5SD phải cảnh báo');
assert.equal(extremeQcPointDeviation(20, 10, 0), null, 'SD không hợp lệ không tính cảnh báo ±5SD');
assert.equal(extremeQcPointDeviation(6, null, 1), null, 'thiếu Mean không tính cảnh báo ±5SD');
assert.equal(extremeQcPointDeviation('x', 10, 1), null, 'giá trị không phải số không tính độ lệch');

console.log('app-v2 entry-validation ±5SD oracle tests passed');
