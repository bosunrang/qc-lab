// ĐỐI CHIẾU WESTGARD/SIGMA GIỮA HAI BẢN — một trong hai tiêu chí cắt sang
// app-v2 (xem CLAUDE.md, "Quyết định sản phẩm 2026-09-02"). Chạy CÙNG input
// qua engine app CŨ (`assets/core.js` + `src/domain/qc/*.ts`) và engine
// app-v2 (`app-v2-dist/main/domain/*`), rồi so từng kết quả.
//
// Vì sao cần: mọi test khác của app-v2 chốt hành vi app-v2 với CHÍNH NÓ. Nếu
// một công thức lâm sàng bị port lệch ngay từ đầu thì cả bộ test vẫn xanh —
// chỉ phép so trực tiếp với bản đang dùng thật mới thấy. Nó đã bắt được đúng
// một lệch như vậy: `acceptedPoints()` bỏ qua snapshot Mean/SD per-point.
//
// VÒNG ĐỜI: file này sống tới lúc cắt bỏ app cũ — khi `src/`+`assets/` bị
// xoá thì xoá file này cùng lúc, đừng cố "sửa cho chạy".
//
// Bản app cũ nạp theo 2 đường: `assets/core.js` là UMD nên `require()` được;
// `src/domain/qc/*.ts` không import chéo gì nên Node's type-stripping nạp
// thẳng .ts được (cùng quy ước đã ghi ở CLAUDE.md mục "Test").
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const REPO = path.join(process.cwd(), '..');
const OLD = require('../../assets/core.js');
const wgV2 = require('../../app-v2-dist/main/domain/westgard-engine.js');
const rulesV2 = require('../../app-v2-dist/main/domain/westgard-rules.js');
const sgV2 = require('../../app-v2-dist/main/domain/sigma-metrics.js');

const tsUrl = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { createAcceptedLotPoints } = await import(tsUrl('src/domain/qc/accepted-lot-points.ts'));
const { createActiveWestgard } = await import(tsUrl('src/domain/qc/active-westgard.ts'));
const { createSigmaBiasService } = await import(tsUrl('src/domain/sigma/sigma-bias-service.ts'));

// Wiring Y HỆT `src/compat/modular-pilot.global.ts` (dòng 2441-2442) — nếu
// bản cũ đổi dependency thì phải đổi ở đây, nếu không đang so một cấu hình
// không tồn tại trong app thật.
const acceptedOld = createAcceptedLotPoints({ pointTarget: OLD.pointTarget, latestRules: OLD.westgardLatestRulesFromZ });
const activeOld = createActiveWestgard({ single: OLD.westgardByPoint, multi: OLD.westgardMultiByPoint });
const biasOld = createSigmaBiasService({ stats: OLD.stats });

let checks = 0;
const ser = (v) => JSON.stringify(v, (k, x) => (typeof x === 'number' && !Number.isFinite(x) ? String(x) : x));
function same(label, a, b) {
  checks++;
  assert.equal(ser(a), ser(b), `lệch app cũ ↔ app-v2 tại ${label}`);
}

// PRNG cố định: cùng một bộ dữ liệu ở mọi lần chạy, nên một lệch mới xuất
// hiện là do CODE đổi chứ không phải do rút trúng số khác.
let seed = 20260910;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const gauss = () => { let s = 0; for (let i = 0; i < 12; i++) s += rnd(); return s - 6; };

// ---------------------------------------------------------------- 1. Registry
{
  const rOld = OLD.WG_RULE_REGISTRY, rV2 = rulesV2.WG_RULE_REGISTRY;
  same('registry:ids', rOld.map(r => r.id), rV2.map(r => r.id));
  const pick = (o) => o && ({ desc: o.desc, err: o.err, defaultOn: o.defaultOn, alert: o.alert, scope: o.scope, scopeMin: o.scopeMin, priority: o.priority, fix: o.fix });
  for (const r of rOld) {
    const v = rV2.find(x => x.id === r.id);
    same(`registry:${r.id}`, pick(r), pick(v));
    // Predicate của họ luật "N điểm liên tiếp cùng phía" là HÀM — so bằng
    // cách chạy thử trên một dải z, không so mã nguồn.
    same(`registry:${r.id}:run-presence`, !!r.run, !!(v && v.run));
    if (r.run && v?.run) {
      const zs = [-4, -3.5, -2.5, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2.5, 3.5, 4];
      same(`registry:${r.id}:run`,
        [r.run[0], zs.map(z => r.run[1](z)), zs.map(z => r.run[2](z))],
        [v.run[0], zs.map(z => v.run[1](z)), zs.map(z => v.run[2](z))]);
    }
  }
  same('WG_RULES', OLD.WG_RULES, rulesV2.WG_RULES);
  same('WG_DEFAULT_ON', [...OLD.WG_DEFAULT_ON].sort(), [...rulesV2.WG_DEFAULT_ON].sort());
  same('WG_ALERT_RULES', OLD.WG_ALERT_RULES, rulesV2.WG_ALERT_RULES);
  same('WG_RULE_DESCRIPTIONS', OLD.WG_RULE_DESCRIPTIONS, rulesV2.WG_RULE_DESCRIPTIONS);
}

// -------------------------------------------- 2. Chính sách luật + loại sai số
{
  for (const id of OLD.WG_RULES) {
    for (const on of [true, false]) same(`defaultRuleAction:${id}:${on}`, OLD.defaultRuleAction(id, on), rulesV2.defaultRuleAction(id, on));
    for (const n of [0, 1, 2, 3, 4, 6]) same(`defaultRuleScope:${id}:${n}`, OLD.defaultRuleScope(id, n), rulesV2.defaultRuleScope(id, n));
  }
  const combos = [['1-2s'], ['1-3s'], ['R4s'], ['2-2s', '1-2s'], ['7T', '10x'], ['1-3s', 'R4s', '4-1s']];
  for (const c of combos) {
    same(`primaryErrorRule:${c.join('+')}`, OLD.primaryErrorRule(c), rulesV2.primaryErrorRule(c));
    same(`errorType:${c.join('+')}`, OLD.errorType(c), rulesV2.errorType(c));
  }
  // Với danh sách RỖNG hoặc luật KHÔNG có trong registry, hai bên trả khác
  // nhau (`''`/chính chuỗi đó vs `null`) — khác biệt HỢP ĐỒNG, không phải
  // khác biệt lâm sàng: app-v2 chỉ gọi `primaryErrorRule()` bên trong
  // `errorTypeDetail()`, và nhánh đó đã thoát sớm khi `errorType()` trả '—'.
  // Chốt đúng tính chất đó thay vì ép hai chữ ký giống nhau.
  for (const c of [[], ['khong-ton-tai']]) {
    same(`errorType:rác:${c.join('+')}`, OLD.errorType(c), rulesV2.errorType(c));
    assert.equal(rulesV2.errorType(c), '—', 'luật lạ không được dán nhãn SE/RE');
    assert.deepEqual(rulesV2.errorTypeDetail(c), { type: '—', desc: '' }, 'luật lạ không được sinh mô tả');
  }
}

// ------------------------------------------------------ 3. stats / pointTarget
{
  const cases = [[], [1], [1, 2], [10, 10, 10], [1, 2, 3, 4, 5], [-5, 0, 5], ['x', 2, 3], [null, 1, 2], [0, 0], [1e6, 1e6 + 1]];
  for (let i = 0; i < 40; i++) cases.push(Array.from({ length: 3 + Math.floor(rnd() * 20) }, () => 100 + gauss() * 5));
  cases.forEach((c, i) => same(`stats#${i}`, OLD.stats(c), wgV2.stats(c)));

  const pts = [
    [{ val: 10 }, 10, 1], [{ val: 12, qcMean: 10, qcSd: 2 }, 5, 5], [{ val: 12, qcMean: 10 }, 5, 2],
    [{ val: 12, qcSd: 2 }, 10, 5], [{ val: 'x' }, 10, 1], [null, 10, 1], [{ val: 3 }, 10, 0],
    [{ val: 3 }, 'a', 1], [{ val: 3, qcMean: 0, qcSd: 0 }, 10, 2], [{ val: -3, qcMean: -5, qcSd: 1 }, 0, 1],
  ];
  pts.forEach(([p, m, s], i) => {
    same(`pointTarget#${i}`, OLD.pointTarget(p, m, s), wgV2.pointTarget(p, m, s));
    same(`pointZ#${i}`, OLD.pointZ(p, m, s), wgV2.pointZ(p, m, s));
  });
}

// --------------------------------------- 4. westgard / westgardByPoint / cusum
function makeSeries(n, opt = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let z;
    if (opt.trend) z = -3 + i * 0.4;
    else if (opt.shift && i >= n - 8) z = 1.4 + rnd() * 0.4;
    else z = gauss();
    if (opt.spike && i === n - 1) z = 3.6;
    out.push({ id: `p${i}`, val: 100 + z * 5, date: `2026-01-${String(1 + (i % 28)).padStart(2, '0')}`, runId: `r${i}` });
  }
  return out;
}
const isOnAll = () => true;
const isOnDefault = (r) => OLD.WG_DEFAULT_ON.has(r);
const series = [[], [{ val: 100 }]];
for (const opt of [{}, { trend: 1 }, { shift: 1 }, { spike: 1 }, { trend: 1, spike: 1 }])
  for (const n of [3, 8, 12, 20, 40]) series.push(makeSeries(n, opt));
series.push(Array.from({ length: 10 }, (_, i) => ({ val: 100 + i * 0.5 })));      // 7T tăng đều
series.push(Array.from({ length: 14 }, () => ({ val: 100.5 })));                   // plateau: KHÔNG phải 7T
series.push(Array.from({ length: 14 }, (_, i) => ({ val: 100 + (i % 2 ? 0.5 : 0.6) })));

series.forEach((pts, i) => {
  same(`westgard#${i}:mọi-luật`, OLD.westgard(pts, 100, 5, isOnAll), wgV2.westgard(pts, 100, 5, isOnAll));
  same(`westgard#${i}:mặc-định`, OLD.westgard(pts, 100, 5, isOnDefault), wgV2.westgard(pts, 100, 5, isOnDefault));
  same(`westgard#${i}:sd=0`, OLD.westgard(pts, 100, 0, isOnAll), wgV2.westgard(pts, 100, 0, isOnAll));
  same(`westgardByPoint#${i}`, OLD.westgardByPoint(pts, 100, 5, isOnAll), wgV2.westgardByPoint(pts, 100, 5, isOnAll));
  // Mỗi điểm mang snapshot Mean/SD riêng → đổi target giữa chuỗi, phải cắt
  // đứt xu hướng 7T ở đúng chỗ đổi (cả hai bên).
  const snap = pts.map((p, j) => ({ ...p, qcMean: j < pts.length / 2 ? 100 : 102, qcSd: 5 }));
  same(`westgardByPoint-snapshot#${i}`, OLD.westgardByPoint(snap, 100, 5, isOnAll), wgV2.westgardByPoint(snap, 100, 5, isOnAll));
  for (const [k, h] of [[0.5, 4], [1, 5], [0.25, 3]]) {
    same(`cusum#${i}:k=${k},h=${h}`, OLD.cusum(pts, 100, 5, k, h), wgV2.cusum(pts, 100, 5, k, h));
  }
});

// ------------------------------------------------ 5. Luật liên mức (một lần chạy)
function makeLevelSets(nLevels, nRuns, opt = {}) {
  const sets = [];
  for (let L = 1; L <= nLevels; L++) {
    const pts = [];
    for (let r = 0; r < nRuns; r++) {
      let z = gauss();
      if (opt.bothHigh && r % 5 === 4) z = 2.2;
      if (opt.split && r % 5 === 4) z = L === 1 ? 2.5 : -2.5;
      if (opt.spike && r === nRuns - 1 && L === 1) z = 3.5;
      pts.push({ id: `L${L}r${r}`, val: 100 + z * 5, runId: `run${r}`, date: `2026-04-${String(1 + (r % 28)).padStart(2, '0')}` });
    }
    sets.push({ level: L, pts, mean: 100, sd: 5 });
  }
  return sets;
}
const multiCases = [];
for (const opt of [{}, { bothHigh: 1 }, { split: 1 }, { spike: 1 }, { bothHigh: 1, spike: 1 }])
  for (const nl of [2, 3, 4]) for (const nr of [1, 3, 6, 10]) multiCases.push(makeLevelSets(nl, nr, opt));
multiCases.push([{ level: 1, pts: [{ id: 'x', val: 120, runId: 'a' }], mean: 100, sd: 0 }]);
multiCases.push([]);

multiCases.forEach((sets, i) => {
  const flat = sets.flatMap(s => s.pts);
  const norm = (m) => ({
    flags: [...m.entries()].map(([p, v]) => [flat.indexOf(p), v]).sort((a, b) => a[0] - b[0]),
    support: [...(m.support || new Map()).entries()].map(([p, v]) => [flat.indexOf(p), v]).sort((a, b) => a[0] - b[0]),
  });
  same(`westgardMultiByPoint#${i}`, norm(OLD.westgardMultiByPoint(sets, isOnAll)), norm(wgV2.westgardMultiByPoint(sets, isOnAll)));
});

// -------------------------------- 6. Chuỗi được chấp nhận + kết luận hợp nhất
const ON = new Set(OLD.WG_RULES.filter(r => OLD.WG_DEFAULT_ON.has(r)));
const REJECT = new Set(OLD.WG_RULES.filter(r => OLD.defaultRuleAction(r, true) === 'reject'));
const isOn = (r) => ON.has(r);
const actionOf = (r) => rulesV2.defaultRuleAction(r, ON.has(r));

{
  const cases = [];
  for (const opt of [{}, { trend: 1 }, { shift: 1 }, { spike: 1 }, { shift: 1, spike: 1 }])
    for (const n of [1, 5, 12, 25, 60]) cases.push({ opt, pts: makeSeries(n, opt) });
  // Nhánh SNAPSHOT là nhánh đã từng lệch: `acceptedPoints()` bản đầu dùng
  // Mean/SD chung, còn `acceptedLotPoints()` app cũ dùng target riêng của
  // từng điểm. Không có nhánh này thì lệch đó vô hình.
  for (const opt of [{ snap: 1 }, { snap: 1, spike: 1 }, { snap: 1, trend: 1 }])
    for (const n of [12, 30, 60]) {
      const pts = makeSeries(n, opt).map((p, i) => ({ ...p, qcMean: i < n / 2 ? 100 : 101.5, qcSd: i < n / 2 ? 5 : 4.5 }));
      cases.push({ opt, pts });
    }
  let snapCases = 0;
  cases.forEach((c, i) => {
    if (c.opt.snap) snapCases++;
    same(`acceptedPoints#${i}${c.opt.snap ? ':snapshot' : ''}`,
      acceptedOld(c.pts, { mean: 100, sd: 5 }, ON, REJECT).map(p => p.id),
      wgV2.acceptedPoints(c.pts, 100, 5, isOn, actionOf).map(p => p.id));
  });
  assert.ok(snapCases >= 9, 'phải còn nhánh snapshot — nó là nhánh đã bắt được lệch thật');
}

{
  // `activeWestgard()` app cũ nhận SET luật liên mức đã lọc sẵn (caller lọc),
  // app-v2 nhận predicate — truyền cùng một tập cho cả hai, nếu không là so
  // hai cấu hình khác nhau chứ không so hai engine.
  const across = new Set(['R4s', '2-2s', '2of3-2s', '3-1s'].filter(r => ON.has(r)));
  const verdict = (rules) => OLD.ruleVerdictLevel(rules, (r) => OLD.defaultRuleAction(r, ON.has(r)));
  multiCases.forEach((sets, i) => {
    if (!sets.length) return;
    const oldOut = activeOld(sets.map(s => ({ l: { level: s.level, mean: s.mean, sd: s.sd }, pts: s.pts })), ON, across, verdict).byPoint;
    const v2Out = wgV2.combinedWestgardByPoint(sets, isOn, (r) => across.has(r), actionOf);
    const flat = sets.flatMap(s => s.pts);
    same(`combinedWestgardByPoint#${i}`,
      flat.map(p => [p.id, oldOut.get(p.id) || null]),
      flat.map(p => {
        const v = v2Out.get(p);
        return [p.id, v ? { level: v.level, rules: v.rules, supportRules: v.supportRules, z: v.z } : null];
      }));
  });
}

// ------------------------------------------------------------------- 7. Sigma
{
  for (let i = 0; i < 200; i++) {
    const x = -4 + rnd() * 8;
    same(`erf#${i}`, OLD.erf(x), sgV2.erf(x));
    same(`normalCdf#${i}`, OLD.normalCdf(x), sgV2.normalCdf(x));
  }
  for (const s of [-2, 0, 1, 2.5, 3, 4, 5, 6, 7, 10]) same(`dpmoFromSigma:${s}`, OLD.dpmoFromSigma(s), sgV2.dpmoFromSigma(s));

  const cases = [[10, 2, 3], [10, 0, 0], [0, 1, 1], [null, 1, 1], [10, -2, 3], ['x', 1, 2], [5, 5, 1], [10, 2, 0], [3.4, 0.73, 1.1]];
  for (let i = 0; i < 60; i++) cases.push([rnd() * 20, (rnd() - 0.5) * 8, rnd() * 6]);
  cases.forEach(([tea, bias, cv], i) => same(`sigmaMetric#${i}`, OLD.sigmaMetric(tea, bias, cv), sgV2.sigmaMetric(tea, bias, cv)));
}

// -------------------------------------------- 8. Bias EQA/EQC nhiều vòng (RMS)
{
  // Hai bên nhận input KHÁC hình dạng: app cũ nhận cặp {lab,target} rồi tự
  // tính bias%, app-v2 nhận thẳng danh sách bias%. Dựng cặp có target=100 để
  // bias% đúng bằng con số muốn thử, rồi so phần TÍNH TOÁN.
  const roundSets = [
    [], [2], [-2], [-2, 2], [1, 1, 1], [-1.5, 0.5, 2.5], [0, 0], [3, -3, 3, -3],
  ];
  for (let i = 0; i < 30; i++) roundSets.push(Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => (rnd() - 0.5) * 8));
  roundSets.forEach((biases, i) => {
    const rounds = biases.map(b => ({ lab: 100 + b, target: 100 }));
    const o = biasOld.stats(rounds);
    const v = sgV2.eqaRoundsStats(biases);
    checks++;
    if (!biases.length) { assert.equal(v, null, 'không có vòng nào thì app-v2 trả null'); assert.equal(o.rms, null); return; }
    // Sai số dấu phẩy động: (100+b-100)/100*100 không phải lúc nào cũng khớp
    // b tới bit cuối, nên so ở mức ý nghĩa lâm sàng (9 chữ số thập phân).
    const near = (a, b2, what) => assert.ok(Math.abs(a - b2) < 1e-9, `lệch ${what} tại eqaRounds#${i}: ${a} vs ${b2}`);
    near(o.rms, v.rms, 'RMS');
    near(o.signedMean, v.mean, 'trung bình có dấu');
    const refOld = biasOld.referenceUncertainty(rounds);
    if (refOld == null) assert.equal(v.biasRefU, null, `u(Cref) phải null tại eqaRounds#${i}`);
    else near(refOld, v.biasRefU, 'u(Cref)');
  });
}

// ---------------------------------------------- 9. Ngân sách độ không đảm bảo
{
  const cases = [
    {}, { cv: 0 }, { cv: 3 }, { cv: 3, bias: 2 }, { cv: 3, bias: 2, uCal: 0.4 },
    { cv: 3, bias: 2, uCal: 0 }, { cv: 3, bias: -2, biasRefU: 1, uCal: 0.4 },
    { cv: 3, bias: 2, uCal: 0.4, includeBias: false }, { cv: 3, bias: 2, uCal: 0.4, k: 3 },
    { cv: 3, bias: 2, uCal: 0.4, tea: 10 }, { cv: 3, bias: 2, uCal: 0.4, tea: 5, target: 140 },
    { cv: 3, bias: '', uCal: '' }, { cv: '3', bias: '2', uCal: '0.4', target: -100 },
  ];
  for (let i = 0; i < 40; i++) cases.push({ cv: rnd() * 6, bias: (rnd() - 0.5) * 6, biasRefU: rnd() * 2, uCal: rnd() * 2, tea: rnd() * 15, target: rnd() * 200 });
  cases.forEach((c, i) => same(`uncertaintyBudget#${i}`, OLD.uncertaintyBudget(c), sgV2.uncertaintyBudget(c)));
}

// Một kịch bản rỗng cũng "khớp" — chốt số phép so tối thiểu để việc bộ dữ
// liệu bị teo lại không đi qua âm thầm.
assert.ok(checks >= 900, `số phép đối chiếu quá ít (${checks}) — bộ dữ liệu đã bị teo?`);
console.log(`app-v2 ↔ app cũ: ${checks} phép đối chiếu Westgard/Sigma đều khớp`);
