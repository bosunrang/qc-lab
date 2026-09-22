// Oracle: tương đương "Nửa 1" (hành vi) của tests/westgard-rule-registry.test.js
// cũ (repo gốc) — cùng những khẳng định, trỏ vào module MỚI
// app/main/domain/westgard-rules.ts thay vì assets/core.js cũ. Xác nhận
// hành vi Westgard không đổi khi viết lại.
import assert from 'node:assert/strict';
import {
  WG_RULE_REGISTRY, WG_RULES, WG_DEFAULT_ON, WG_ALERT_RULES, WG_RULE_DESCRIPTIONS,
  RULE_SCOPES, defaultRuleAction, defaultRuleScope, allowedRuleScopes, primaryErrorRule, errorType,
  errorClass, normalizeErrorClass,
} from '../main/domain/westgard-rules.ts';

const REG = WG_RULE_REGISTRY;
const IDS = REG.map(r => r.id);

assert.ok(Array.isArray(REG) && REG.length >= 13, 'WG_RULE_REGISTRY phải là mảng đủ bộ luật');
assert.equal(new Set(IDS).size, IDS.length, 'id luật trong bảng đăng ký phải duy nhất');
for (const r of REG) {
  assert.ok(r.id && typeof r.id === 'string', 'mỗi luật phải có id');
  assert.ok(r.desc && typeof r.desc === 'string', `${r.id}: thiếu mô tả điều kiện`);
  assert.ok(['SE', 'RE', ''].includes(r.err), `${r.id}: err phải là 'SE' | 'RE' | ''`);
  assert.equal(typeof r.defaultOn, 'boolean', `${r.id}: defaultOn phải là boolean`);
  assert.equal(typeof r.alert, 'boolean', `${r.id}: alert phải là boolean`);
  assert.ok(RULE_SCOPES.includes(r.scope), `${r.id}: scope phải nằm trong RULE_SCOPES`);
  assert.ok(r.scopeMin >= 2, `${r.id}: scopeMin phải >= 2`);
  assert.ok(Number.isFinite(r.priority), `${r.id}: thiếu priority cho primaryErrorRule`);
  assert.ok(r.fix && typeof r.fix === 'string', `${r.id}: thiếu gợi ý xử lý cho bảng hướng dẫn`);
  if (r.run !== null) {
    assert.ok(Number.isInteger(r.run[0]) && r.run[0] >= 2, `${r.id}: run[0] phải là số điểm liên tiếp`);
    assert.equal(typeof r.run[1], 'function', `${r.id}: run[1] phải là vị-từ dương`);
    assert.equal(typeof r.run[2], 'function', `${r.id}: run[2] phải là vị-từ âm`);
  }
}

assert.deepEqual(allowedRuleScopes('1-3s'), ['within'], '1-3s không có kênh liên mức');
assert.deepEqual(allowedRuleScopes('R4s'), ['across'], 'R4s chỉ được xét cùng lần chạy giữa các mức');
assert.deepEqual(allowedRuleScopes('4-1s'), RULE_SCOPES, 'luật both phải cho cả ba phạm vi hợp lệ');
assert.deepEqual(allowedRuleScopes('khong-ton-tai'), [], 'luật lạ không được cấp scope');
assert.equal(errorClass(['1-3s']), 'RE');
assert.equal(errorClass(['2-2s', '1-3s']), 'SE');
assert.equal(normalizeErrorClass('SE — Sai số hệ thống'), 'SE');
assert.equal(normalizeErrorClass('RE — Sai số ngẫu nhiên'), 'RE');
assert.equal(normalizeErrorClass('Quản lý dải kiểm soát'), '');
assert.equal(new Set(REG.map(r => r.priority)).size, REG.length, 'priority phải duy nhất');

assert.ok(Object.isFrozen(REG), 'WG_RULE_REGISTRY phải đóng băng');
REG.forEach((r) => {
  assert.ok(Object.isFrozen(r), `${r.id}: dòng luật phải đóng băng`);
  if (r.run) assert.ok(Object.isFrozen(r.run), `${r.id}: bộ vị-từ run phải đóng băng`);
});

assert.deepEqual(WG_RULES, IDS, 'WG_RULES phải là danh sách id của bảng đăng ký, đúng thứ tự');
assert.deepEqual([...WG_DEFAULT_ON].sort(), REG.filter(r => r.defaultOn).map(r => r.id).sort(), 'WG_DEFAULT_ON phải dẫn xuất từ cột defaultOn');
assert.deepEqual(WG_ALERT_RULES.slice().sort(), REG.filter(r => r.alert).map(r => r.id).sort(), 'WG_ALERT_RULES phải dẫn xuất từ cột alert');
assert.deepEqual(Object.keys(WG_RULE_DESCRIPTIONS).sort(), IDS.slice().sort(), 'WG_RULE_DESCRIPTIONS phải phủ đúng bộ luật của bảng đăng ký');
for (const r of REG) assert.equal(WG_RULE_DESCRIPTIONS[r.id], r.desc, `${r.id}: mô tả trong WG_RULE_DESCRIPTIONS phải lấy từ bảng đăng ký`);

for (const r of REG) {
  assert.equal(defaultRuleAction(r.id, true), r.alert ? 'alert' : 'reject', `${r.id}: defaultRuleAction không khớp cột alert`);
  assert.equal(defaultRuleAction(r.id, false), 'inactive', `${r.id}: luật tắt phải là inactive`);
  assert.equal(defaultRuleScope(r.id, 1), 'within', `${r.id}: dưới 2 mức QC luôn phải là within`);
  assert.equal(defaultRuleScope(r.id, r.scopeMin), r.scope, `${r.id}: đủ scopeMin mức phải dùng scope của bảng`);
  if (r.scopeMin > 2) assert.equal(defaultRuleScope(r.id, r.scopeMin - 1), 'within', `${r.id}: dưới scopeMin phải lùi về within`);
}

const byPriority = REG.slice().sort((a, b) => a.priority - b.priority).map(r => r.id);
assert.equal(primaryErrorRule(IDS), byPriority[0], 'primaryErrorRule phải chọn luật có priority nhỏ nhất');
for (const r of REG) {
  const expected = r.err === 'SE' ? 'SE — Sai số hệ thống' : r.err === 'RE' ? 'RE — Sai số ngẫu nhiên' : '—';
  assert.equal(errorType([r.id]), expected, `${r.id}: errorType không khớp cột err`);
}

console.log('app Westgard rules oracle tests passed');
