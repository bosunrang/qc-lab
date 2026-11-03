// N7 (2026-11-03): phạm vi luật Westgard chỉ cho chọn và lưu phạm vi mà engine
// chạy được với số mức đang vận hành. Trước đây 2of3-2s ở xét nghiệm 2 mức chỉ
// có lựa chọn "chéo mức", mà kênh đó cần ≥ 3 mức nên luật không bao giờ chạy.
// Cấu hình đã lưu từ trước KHÔNG bị tự sửa ở bước đánh giá (không hồi tố, GV2).
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { must } from './helpers/nce-flow.mjs';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';

const require = createRequire(import.meta.url);
const { allowedRuleScopes, isAllowedRuleScope } = require('../../app-dist/main/domain/westgard-rules.js');
const { makeScopeOf } = require('../../app-dist/main/domain/rule-config.js');
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };

test('phạm vi chạy được theo số mức', () => {
  assert.deepEqual(allowedRuleScopes('2of3-2s', 2), ['within'], '2 mức: chỉ kênh trong-mức');
  assert.deepEqual(allowedRuleScopes('2of3-2s', 3), ['within', 'across', 'both']);
  assert.deepEqual(allowedRuleScopes('3-1s', 2), ['within']);
  assert.deepEqual(allowedRuleScopes('R4s', 1), [], 'một mức thì R4s không có kênh nào');
  assert.deepEqual(allowedRuleScopes('2-2s', 2), ['within', 'across', 'both']);
  assert.deepEqual(allowedRuleScopes('2of3-2s'), ['within', 'across', 'both'], 'không biết số mức: chỉ xét kênh engine');
  assert.equal(isAllowedRuleScope('2of3-2s', 'across', 2), false);
  // Đánh giá giữ nguyên cấu hình đã lưu, kể cả phạm vi không còn chạy được.
  assert.equal(makeScopeOf({ '2of3-2s': 'across' }, 2)('2of3-2s'), 'across');
});

function scenario(levels) {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const inst = must(config.saveInstrument({ data: { name: 'Máy A' } }, actor), 'máy');
  const t = must(config.saveTest({ data: { name: 'Glucose', instrumentId: inst.id } }, actor), 'xét nghiệm');
  for (let level = 2; level <= levels; level++) db.prepare('INSERT INTO test_levels(id,test_id,level) VALUES (?,?,?)').run(`${t.id}:${level}`, t.id, level);
  makeOperationalQc(db, { testId: t.id, instrumentId: inst.id, assignments: Array.from({ length: levels }, (_, i) => ({ level: i + 1 })) });
  return { config, testId: t.id };
}

test('xét nghiệm 2 mức: không lưu được 2of3-2s "chéo mức", lưu được "trong từng mức"', () => {
  const { config, testId } = scenario(2);
  const hint = config.listRuleScopes(testId).find((item) => item.id === '2of3-2s');
  assert.deepEqual([hint.defaultScope, hint.allowedScopes], ['within', ['within']]);
  const across = config.saveRuleScope(testId, '2of3-2s', 'across', actor);
  assert.equal(across.error?.code, 'scope-needs-levels');
  assert.match(across.error.message, /ít nhất 3 mức.*có 2 mức/);
  assert.equal(config.saveRuleScope(testId, '2of3-2s', 'within', actor).ok, true);
});

test('xét nghiệm 3 mức: lưu được "chéo mức"', () => {
  const { config, testId } = scenario(3);
  assert.equal(config.saveRuleScope(testId, '2of3-2s', 'across', actor).ok, true);
});
