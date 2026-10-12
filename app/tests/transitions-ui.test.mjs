// Biểu mẫu chuyển tiếp đọc các ô Mean/SD trực tiếp từ DOM để người dùng có
// thể gõ nhanh qua nhiều dòng. Vì vậy hàng phải được dựng lại khi đổi cặp lô
// và hàng bị bộ lọc ẩn vẫn phải còn trong DOM để lúc lưu không mất số đã nhập.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(ROOT, 'renderer', 'pages', 'manage', 'TransitionsTab.tsx'), 'utf8');
const css = readFileSync(join(ROOT, 'renderer', 'styles', 'pages', 'manage.css'), 'utf8');

test('đổi lô cùng mức dựng lại ô Mean/SD của chuyển tiếp', () => {
  assert.match(source,
    /key=\{`\$\{test\.id\}:\$\{draftFromLotId\}:\$\{draftToLotId\}:\$\{levelNo\}:\$\{saved \? '1' : '0'\}`\}/,
    'key của hàng phải gồm cả lô cũ và lô mới, không chỉ mức QC');
});

test('lọc xét nghiệm không loại ô Mean/SD khỏi dữ liệu sẽ lưu', () => {
  assert.match(source, /target-row\$\{matches \? '' : ' is-filtered-out'\}/,
    'hàng không khớp phải còn được dựng để submit vẫn đọc đủ các ô');
  assert.match(css, /\.target-row\.is-filtered-out\{display:none;\}/,
    'CSS chỉ ẩn hàng không khớp thay vì bỏ dữ liệu khỏi DOM');
});
