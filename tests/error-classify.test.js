const assert = require('node:assert/strict');
const QCCore = require('../assets/core.js');

// errorType: RE = 1-3s/R4s; SE = các luật hệ thống; SE ưu tiên khi lẫn cả hai
assert.equal(QCCore.errorType(['1-3s']), 'RE — Sai số ngẫu nhiên');
assert.equal(QCCore.errorType(['R4s']), 'RE — Sai số ngẫu nhiên');
assert.equal(QCCore.errorType(['2-2s']), 'SE — Sai số hệ thống');
assert.equal(QCCore.errorType(['7T']), 'SE — Sai số hệ thống');
assert.equal(QCCore.errorType(['1-3s', '2-2s']), 'SE — Sai số hệ thống', 'SE được xét trước RE');
assert.equal(QCCore.errorType(['1-2s']), '—', '1-2s chỉ là cảnh báo, không thuộc SE/RE');
assert.equal(QCCore.errorType([]), '—');
assert.equal(QCCore.errorType(), '—', 'không throw khi thiếu tham số');

// primaryErrorRule: theo thứ tự ưu tiên cố định
assert.equal(QCCore.primaryErrorRule(['4-1s', '1-3s']), '1-3s');
assert.equal(QCCore.primaryErrorRule(['10x', '2-2s', '7T']), '2-2s');
assert.equal(QCCore.primaryErrorRule(['1-2s']), '1-2s');
assert.equal(QCCore.primaryErrorRule([]), '');

// fixHint: khớp nhóm sai số của errorType (dùng chung list SE/RE)
assert.match(QCCore.fixHint(['3-1s']), /^Hướng hệ thống/);
assert.match(QCCore.fixHint(['R4s']), /^Hướng ngẫu nhiên/);
assert.equal(QCCore.fixHint(['1-2s']), '');
assert.equal(QCCore.fixHint([]), '');

// Mọi luật đều có mô tả
['1-2s', '1-3s', '2-2s', 'R4s', '2of3-2s', '3-1s', '4-1s', '6x', '8x', '9x', '10x', '12x', '7T']
  .forEach(r => assert.ok(QCCore.WG_RULE_DESCRIPTIONS[r], `thiếu mô tả cho ${r}`));

console.log('Error-classification tests passed');
