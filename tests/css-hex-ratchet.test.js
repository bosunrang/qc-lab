'use strict';
// Chặn hex màu MỚI viết cứng ngoài assets/tokens.css — không phải cấm hoàn toàn (236
// chỗ cũ vẫn còn, xem CLAUDE.md/lộ trình rà soát 2026-08-23: phần lớn là sắc độ
// gradient riêng từng khối, gộp về token cần người thiết kế quyết định, không phải
// việc quét-thay tự động). Đây là RATCHET (cùng kiểu tests/a11y-ratchet.json qua
// scripts/a11y-audit.js, tests/button-conventions.test.js): số hex của một file chỉ
// được đứng yên hoặc giảm, không bao giờ được tăng. Thêm một trang mới với hex viết
// cứng, hoặc thêm hex vào file đã có, đều bị chặn ngay tại đây thay vì lặng lẽ cộng
// dồn thêm vào đúng loại nợ vừa được rà soát.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const baselinePath = path.join(__dirname, 'css-hex-ratchet-baseline.json');
const cssDir = path.join(root, 'assets');

function countHex(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return (text.match(/#[0-9a-fA-F]{6}\b/g) || []).length;
}

function currentCounts() {
  const files = fs.readdirSync(cssDir)
    .filter(name => name.endsWith('.css') && name !== 'tokens.css')
    .sort();
  const counts = {};
  for (const name of files) {
    const rel = 'assets/' + name;
    const n = countHex(path.join(cssDir, name));
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

if (process.argv.includes('--update-baseline')) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  baseline.files = currentCounts();
  baseline.generatedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
  console.log('Đã cập nhật tests/css-hex-ratchet-baseline.json với số hex hiện tại.');
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).files;
const current = currentCounts();
const regressions = [];

for (const [file, count] of Object.entries(current)) {
  const allowed = baseline[file] || 0;
  if (count > allowed) regressions.push(`${file}: ${count} hex (trần cho phép ${allowed}) — dùng biến trong assets/tokens.css thay vì viết hex trực tiếp, hoặc thêm token mới nếu chưa có màu phù hợp.`);
}

assert.deepEqual(regressions, [], 'CSS hex ratchet bị vượt trần:\n  ' + regressions.join('\n  '));
console.log(`CSS hex ratchet: ${Object.values(current).reduce((a, b) => a + b, 0)} hex tổng cộng, không vượt trần file nào.`);
