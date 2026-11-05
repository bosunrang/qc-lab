import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(new URL('../renderer/lib/search-options.ts', import.meta.url), 'utf8');
const logic = source.replace(/export /g, '');
const { normalizeSearchText, filterSearchOptions, prioritizeSearchOptions } = vm.runInNewContext(`${stripTypeScriptTypes(logic)}\n({ normalizeSearchText, filterSearchOptions, prioritizeSearchOptions })`);

const options = [
  { value: 'alt', label: 'Alanine aminotransferase (ALT) · Beckman DxC 700 AU', keywords: 'U/L hoá sinh' },
  { value: 'na', label: 'Sodium (Na) · EasyLyte Plus', keywords: 'mmol/L điện cực chọn lọc' },
  { value: 'k', label: 'Potassium (K) · EasyLyte Plus', keywords: 'mmol/L điện cực chọn lọc' },
];

test('ô chọn tìm không phân biệt dấu, hoa thường và khớp nhiều từ', () => {
  assert.equal(normalizeSearchText('Điện cực  HÓA-SINH'), 'dien cuc hoa sinh');
  assert.deepEqual(Array.from(filterSearchOptions(options, 'alanine dxc'), (item) => item.value), ['alt']);
  assert.deepEqual(Array.from(filterSearchOptions(options, 'điện cực sodium'), (item) => item.value), ['na']);
  assert.deepEqual(Array.from(filterSearchOptions(options, 'easylyte mmol'), (item) => item.value), ['na', 'k']);
});

test('từ khoá không khớp trả danh sách rỗng; ô trống giữ nguyên thứ tự', () => {
  assert.deepEqual(Array.from(filterSearchOptions(options, 'glucose')), []);
  assert.deepEqual(Array.from(filterSearchOptions(options, ''), (item) => item.value), ['alt', 'na', 'k']);
});

test('gợi ý được đưa lên đầu đúng một lần và giữ thứ tự trong từng nhóm', () => {
  const prioritized = Array.from(prioritizeSearchOptions(options, ['k', 'na']));
  assert.deepEqual(prioritized.map((item) => item.value), ['na', 'k', 'alt']);
  assert.deepEqual(prioritized.map((item) => item.suggested), [true, true, false]);
});
