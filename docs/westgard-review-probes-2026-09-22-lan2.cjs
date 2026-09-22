// HISTORICAL PRE-FIX PROBES cho WESTGARD-REVIEW-2026-09-22-lan2.md (WG-15 … WG-25).
// TOÀN BỘ WG-15…WG-25 ĐÃ ĐƯỢC SỬA, nên file này BÂY GIỜ DỪNG SỚM (fail ở
// WG-16) — đó là kết quả đúng. Nó chỉ còn giá trị làm bằng chứng trạng thái
// trước sửa. Hồi quy chính thức nằm trong `npm test`:
// `westgard-standard.test.mjs` (WG-20) và
// `entry-parallel-lot-cross-level.test.mjs` (WG-24), cùng các ca WG khác.
// Các assert dưới đây mô tả KHUYẾT TẬT LÚC ĐÓ, không phải kỳ vọng hồi quy.
// Chỉ đọc: chạy trên engine thuần, không đụng DB người dùng.
// Chạy: npm run app:build:main && node docs/westgard-review-probes-2026-09-22-lan2.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const E = require(path.join(root, 'app-dist/main/domain/westgard-engine.js'));
const R = require(path.join(root, 'app-dist/main/domain/westgard-rules.js'));

const log = (tag, value) => console.log(tag.padEnd(10), value);

// ── WG-15: ghi đè phạm vi làm luật chết âm thầm ──────────────────────────────
{
  const run1 = { runId: 'r1', date: '2026-01-01' };
  const sets = [
    { level: 1, pts: [{ ...run1, val: 13 }], mean: 10, sd: 1 },   // z = +3
    { level: 2, pts: [{ ...run1, val: 7 }], mean: 10, sd: 1 },    // z = −3
  ];
  const rulesOf = (within, across) =>
    [...E.combinedWestgardByPoint(sets, within, across).values()].flatMap(f => f.rules);

  // R4s chỉ tồn tại ở kênh `across`; đặt scope='within' là tắt hẳn.
  assert.deepEqual(rulesOf(r => r === 'R4s', () => false), [], 'WG-15 R4s scope=within');
  assert.deepEqual(rulesOf(() => false, r => r === 'R4s'), ['R4s', 'R4s'], 'WG-15 R4s scope=across');

  // 1-3s / 1-2s chỉ tồn tại ở kênh `within`; đặt scope='across' là tắt hẳn.
  const hot = [{ level: 1, pts: [{ ...run1, val: 14 }], mean: 10, sd: 1 },
               { level: 2, pts: [{ ...run1, val: 10 }], mean: 10, sd: 1 }];
  for (const rule of ['1-3s', '1-2s']) {
    const got = [...E.combinedWestgardByPoint(hot, () => false, r => r === rule).values()].flatMap(f => f.rules);
    assert.deepEqual(got, [], `WG-15 ${rule} scope=across`);
  }

  // 7T cũng chỉ có ở kênh `within`.
  const trend = Array.from({ length: 8 }, (_, i) => ({ val: 10 + i * 0.1, runId: 'r' + i, date: `2026-01-0${i + 1}` }));
  const got7T = [...E.combinedWestgardByPoint([{ level: 1, pts: trend, mean: 10, sd: 1 }], () => false, r => r === '7T').values()].flatMap(f => f.rules);
  assert.deepEqual(got7T, [], 'WG-15 7T scope=across');
  log('WG-15', 'xác nhận: R4s/within, 1-3s/1-2s/7T/across đều không nổ luật nào');
}

// ── WG-16: mức chưa có Mean/SD làm hỏng accepted của mọi mức cùng run ────────
{
  const l1 = [1, 2, 3].map(i => ({ id: 'a' + i, val: 10, runId: 'r' + i, date: '2026-01-0' + i }));
  const l2 = [1, 2, 3].map(i => ({ id: 'b' + i, val: 20, runId: 'r' + i, date: '2026-01-0' + i }));

  const broken = E.combinedWestgardByPoint(
    [{ level: 1, pts: l1, mean: 10, sd: 1 }, { level: 2, pts: l2, mean: null, sd: null }], () => true, () => true);
  const brokenAccepted = E.acceptedRunPoints(broken);
  assert.deepEqual(l1.map(p => broken.get(p).level), ['ok', 'ok', 'ok'], 'WG-16 mức 1 vẫn Đạt');
  assert.deepEqual(l1.map(p => brokenAccepted.has(p)), [false, false, false], 'WG-16 nhưng bị loại khỏi thống kê');

  const ok = E.combinedWestgardByPoint(
    [{ level: 1, pts: l1, mean: 10, sd: 1 }, { level: 2, pts: l2, mean: 20, sd: 1 }], () => true, () => true);
  assert.deepEqual(l1.map(p => E.acceptedRunPoints(ok).has(p)), [true, true, true], 'WG-16 đối chứng');
  log('WG-16', 'xác nhận: mức 1 verdict=ok nhưng accepted=false vì mức 2 thiếu Mean/SD');
}

// ── WG-17: danh sách SE ở ActionsPage lệch registry ──────────────────────────
{
  const page = fs.readFileSync(path.join(root, 'app/renderer/pages/ActionsPage.tsx'), 'utf8');
  const literal = /const SE_RULES = \[([^\]]*)\]/.exec(page)[1];
  const pageSE = [...literal.matchAll(/'([^']+)'/g)].map(m => m[1]).filter(id => !id.startsWith('CUSUM'));
  const registrySE = R.WG_RULE_REGISTRY.filter(r => r.err === 'SE').map(r => r.id);
  const missing = registrySE.filter(id => !pageSE.includes(id));
  assert.deepEqual(missing, ['9x', '12x'], 'WG-17 luật SE bị sót ở renderer');
  assert.equal(R.errorType(['9x']), 'SE — Sai số hệ thống', 'WG-17 registry nói 9x là SE');
  log('WG-17', `xác nhận: renderer sót ${missing.join(', ')} → bị dán nhãn RE`);
}

// ── WG-18: actions.error_type có 3 bộ từ vựng, UI so sánh === 'SE' ───────────
{
  const entry = fs.readFileSync(path.join(root, 'app/main/ipc/entry-handlers.ts'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'app/renderer/pages/ActionsPage.tsx'), 'utf8');
  assert.ok(entry.includes('errorType(rules)'), 'WG-18 hủy điểm ghi chuỗi dài');
  assert.ok(entry.includes("'Quản lý dải kiểm soát'"), 'WG-18 hồ sơ dải ghi nhãn riêng');
  assert.ok(page.includes("record.error_type === 'SE'"), 'WG-18 UI so sánh mã ngắn');
  assert.notEqual(R.errorType(['2-2s']), 'SE', 'WG-18 giá trị ghi thật KHÔNG bằng "SE"');
  log('WG-18', `xác nhận: ghi "${R.errorType(['2-2s'])}" nhưng UI so sánh === 'SE' → hiện ngược`);
}

// ── WG-19: luật chuỗi đếm xuyên dải, CUSUM thì reset ─────────────────────────
{
  const pts = [];
  for (let i = 0; i < 5; i++) pts.push({ val: 11.5, qcMean: 10, qcSd: 1, runId: 'r' + i, date: `2026-01-0${i + 1}` });
  for (let i = 5; i < 10; i++) pts.push({ val: 21.5, qcMean: 20, qcSd: 1, runId: 'r' + i, date: `2026-01-0${i + 1}` });

  const tenX = E.westgardByPoint(pts, 10, 1, r => r === '10x').F.map(f => f.rules.join('|'));
  assert.equal(tenX[9], '10x', 'WG-19 10x nổ dù đếm qua hai dải khác nhau');
  const cs = E.cusumScan(pts, 10, 1, 0.5, 4);
  assert.equal(cs.cPos[5], 1, 'WG-19 CUSUM reset đúng chỗ đổi dải');
  log('WG-19', '10x đếm 5 điểm dải cũ + 5 điểm dải mới; CUSUM khởi tạo lại tại điểm 6');
}

// ── WG-20: 2of3-2s dán "Loại bỏ" lên điểm đạt ────────────────────────────────
{
  const F = E.westgard([{ val: 12.5 }, { val: 12.5 }, { val: 10 }], 10, 1, r => r === '2of3-2s').F;
  assert.deepEqual(F.map(f => f.level), ['ok', 'ok', 'rej'], 'WG-20 điểm z=0 bị loại');
  assert.deepEqual(F[0].supportRules, ['2of3-2s'], 'WG-20 điểm vượt thật chỉ là bằng chứng');
  const engine = fs.readFileSync(path.join(root, 'app/main/domain/westgard-engine.ts'), 'utf8');
  assert.ok(engine.includes('@deprecated'), 'WG-20 acceptedPoints() — lý do biện hộ — đã deprecated');
  log('WG-20', 'xác nhận: [+2.5, +2.5, 0.0] → điểm 3 (z=0) mang kết luận Loại bỏ');
}

// ── WG-21: tab lô cũ suy levelCount từ lô, không từ mức đang vận hành ────────
{
  const src = fs.readFileSync(path.join(root, 'app/main/db/westgard-evaluation.ts'), 'utf8');
  assert.ok(src.includes('new Set(sets.map(set => set.level)).size'), 'WG-21 levelCount suy từ sets');
  // Cùng một xét nghiệm 2 mức: nếu lô mức 2 không tra được dải, 2-2s tụt về within.
  assert.equal(R.defaultRuleScope('2-2s', 2), 'both');
  assert.equal(R.defaultRuleScope('2-2s', 1), 'within');
  log('WG-21', 'xác nhận: mất một lô ⇒ levelCount 2→1 ⇒ 2-2s "both"→"within"');
}

// ── WG-22: hai lô cùng mức trong một run → điểm bị nuốt ở kênh liên mức ──────
{
  const run1 = { runId: 'r1', date: '2026-01-01' };
  const A = { id: 'A', ...run1, val: 13 }, B = { id: 'B', ...run1, val: 13.5 }, C = { id: 'C', ...run1, val: 7 };
  const flags = E.westgardMultiByPoint([
    { level: 1, pts: [A], mean: 10, sd: 1 },
    { level: 1, pts: [B], mean: 10, sd: 1 },
    { level: 2, pts: [C], mean: 10, sd: 1 },
  ], () => true);
  assert.equal(flags.get(A), undefined, 'WG-22 điểm lô A bị ghi đè, không nhận luật nào');
  assert.deepEqual(flags.get(B), ['R4s']);
  log('WG-22', 'xác nhận: lô A mức 1 vô hình với kênh liên mức');
}

// ── WG-23 / WG-25: nguồn sự thật bị nhân bản ─────────────────────────────────
{
  const cfg = fs.readFileSync(path.join(root, 'app/main/domain/rule-config.ts'), 'utf8');
  assert.ok(/globalRuleList[\s\S]*typeof globalRules\[id\] === 'boolean'/.test(cfg), 'WG-23 chỉ đọc boolean');
  const shared = fs.readFileSync(path.join(root, 'app/renderer/pages/manage/shared.tsx'), 'utf8');
  const hardcoded = [...(/const WESTGARD_RULES = \[([^\]]*)\]/.exec(shared)[1]).matchAll(/'([^']+)'/g)].map(m => m[1]);
  // Hiện đang TRÙNG KHỚP registry — WG-25 là rủi ro trôi, không phải lỗi đang xảy ra.
  assert.deepEqual(hardcoded, R.WG_RULES, 'WG-25 bản sao hiện còn khớp registry');
  log('WG-23/25', 'xác nhận: panel chung bỏ qua action dạng chuỗi; modal hardcode lại danh sách luật (hiện còn khớp)');
}

console.log('\nTất cả probe WG-15…WG-25 tái hiện được trên mã hiện tại.');
