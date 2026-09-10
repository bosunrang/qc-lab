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

// ------------------------------------------------------ 10. Lớp giải TEa
// Sigma đúng công thức mà TEa sai thì Sigma vẫn sai — đây là đầu vào, không
// phải phép tính. Hai bên khác hẳn cấu trúc: app cũ là factory cần cả bundle
// (`sgTeaBySource` đọc `state.teaRefs` + `TEA_ANALYTE_CATALOG`), app-v2 là
// hàm thuần nhận catalog qua tham số. Nạp bundle app cũ qua chính sandbox
// `vm` mà bộ test app cũ dùng.
{
  const vm = require('node:vm');
  const { loadSandbox } = require('../../tests/helpers/sandbox.js');
  const ctx = loadSandbox(['core.js', 'generated/modular-pilot.js']);
  const run = (code) => vm.runInContext(code, ctx);
  run('state.teaRefs = [];');   // không có hồ sơ TEa PXN — so đúng lớp catalog tích hợp

  const { TEA_CATALOG_WITH_CLIA_ABSOLUTE } = await import(tsUrl('app-v2/renderer/data/tea-catalog.ts'));
  const { resolveTea } = await import(tsUrl('app-v2/renderer/lib/sigma-tea-core.ts'));
  const oldCatalog = run('TEA_ANALYTE_CATALOG.map(r=>({id:r.analyteId,name:r.name,unit:r.unit,clia:r.tea.clia,ricos:r.tea.ricos,cliaAbs:r.tea.cliaAbsolute,cliaAbsUnit:r.tea.cliaAbsoluteUnit}))');
  const byIdV2 = new Map(TEA_CATALOG_WITH_CLIA_ABSOLUTE.map(r => [r.id, r]));

  same('teaCatalog:số-analyte', oldCatalog.length, TEA_CATALOG_WITH_CLIA_ABSOLUTE.length);
  same('teaCatalog:danh-sách-id', oldCatalog.map(r => r.id).sort(), TEA_CATALOG_WITH_CLIA_ABSOLUTE.map(r => r.id).sort());
  for (const o of oldCatalog) {
    const v = byIdV2.get(o.id);
    same(`teaCatalog:${o.id}`,
      { unit: o.unit, clia: o.clia ?? null, ricos: o.ricos ?? null },
      { unit: v.unit, clia: v.clia ?? null, ricos: v.ricos ?? null });
    // Giới hạn CLIA TUYỆT ĐỐI: chỉ dùng được khi đơn vị xét nghiệm khớp đơn
    // vị tiêu chí, nên một dòng có `cliaAbsolute` mà `cliaAbsoluteUnit` RỖNG
    // là dữ liệu không bao giờ áp dụng được. app cũ có đúng 1 dòng như vậy
    // (pH, ±0.04 nhưng đơn vị rỗng); app-v2 bỏ nó — chốt đúng ranh giới đó
    // thay vì đòi hai bảng giống nhau từng ô.
    const oldUsable = o.cliaAbs > 0 && String(o.cliaAbsUnit || '').trim() !== '';
    same(`teaCatalog:${o.id}:cliaAbsolute-dùng-được`,
      oldUsable ? { abs: o.cliaAbs, unit: o.cliaAbsUnit } : null,
      v.cliaAbsolute != null ? { abs: v.cliaAbsolute, unit: v.cliaAbsoluteUnit } : null);
  }

  // Giá trị TEa GIẢI RA, cho từng analyte × nguồn × nhiều Mean (Mean quyết
  // định việc quy đổi giới hạn tuyệt đối sang %, nên phải quét cả 0/null).
  for (const o of oldCatalog) {
    const v = byIdV2.get(o.id);
    for (const src of ['clia', 'ricos']) {
      for (const mean of [null, 0, 100, 5.5, 140, 0.9]) {
        const oldVal = run(`sgTeaBySource(${JSON.stringify({ name: o.name, unit: o.unit, analyteId: o.id, tea: 0, teaSource: src })}, ${JSON.stringify(src)}, ${mean === null ? 'undefined' : mean})`);
        const r = resolveTea({ name: v.name, tea_ref_key: v.id, unit: v.unit, tea: 0 }, [], TEA_CATALOG_WITH_CLIA_ABSOLUTE, src, mean);
        // app cũ dùng 0 cho "không xác định được", app-v2 dùng null.
        checks++;
        assert.ok(Math.abs(oldVal - (r.value == null ? 0 : r.value)) < 1e-9,
          `lệch TEa tại ${o.id} nguồn=${src} mean=${mean}: cũ=${oldVal} v2=${r.value}`);
      }
    }
  }

  // KHÁC BIỆT CÓ CHỦ ĐÍCH, chốt lại để không ai "sửa" nhầm: app cũ khớp tên
  // theo exact-rồi-longest-prefix (`sgRef`), nên "Glucose (huyết tương)" tự
  // thừa hưởng TEa của "Glucose". app-v2 CHỈ khớp tuyệt đối id/tên/viết
  // tắt/alias và đòi liên kết tường minh qua `tea_ref_key` — TEa là tiêu chí
  // lâm sàng, đoán theo tiền tố có ngày nuốt nhầm ("CK" ↔ "CK-MB").
  {
    const custom = { name: 'Glucose (huyết tương)', unit: 'mmol/L', analyteId: '', tea: 0, teaSource: 'ricos' };
    const oldVal = run(`sgTeaBySource(${JSON.stringify(custom)}, 'ricos')`);
    assert.ok(oldVal > 0, 'app cũ: tên tự đặt vẫn thừa hưởng TEa qua khớp tiền tố');
    const v2 = resolveTea({ name: custom.name, tea_ref_key: '', unit: custom.unit, tea: 0 }, [], TEA_CATALOG_WITH_CLIA_ABSOLUTE, 'ricos');
    assert.equal(v2.value, null, 'app-v2: tên tự đặt KHÔNG tự đoán TEa, phải gán tea_ref_key');
    const linked = resolveTea({ name: custom.name, tea_ref_key: 'qclab-glucose', unit: custom.unit, tea: 0 }, [], TEA_CATALOG_WITH_CLIA_ABSOLUTE, 'ricos');
    assert.equal(linked.value, oldVal, 'gán tea_ref_key thì ra đúng con số app cũ');
    checks += 3;
  }
}

// ------------------------------------- 11. Cohort IQC (nguồn CV của Sigma)
// Sigma = (TEa − |Bias|) / CV, và CV KHÔNG do người dùng gõ khi chọn "Nạp CV
// lô" — nó do tầng này tính từ chính điểm QC. Hai bên khác hẳn chữ ký: app cũ
// là `cohortsForLevelByLot(state, {testId, level, endDate})` cho MỘT mức, cộng
// một tầng chọn riêng (`SigmaCohortSelectionService`) lo cutoff + lọc "nhóm có
// liên quan tới kỳ"; app-v2 gộp cả ba việc vào `buildSigmaCohorts(points,
// period, levels, today)`. So KẾT QUẢ SAU KHI đã ghép đủ hai tầng của app cũ.
{
  const vm = require('node:vm');
  const { loadSandbox } = require('../../tests/helpers/sandbox.js');
  const ctx = loadSandbox(['core.js', 'generated/modular-pilot.js']);
  const run = (code) => vm.runInContext(code, ctx);
  const { buildSigmaCohorts, periodCutoff } = await import(tsUrl('app-v2/main/domain/sigma-cohort.ts'));

  const TODAY = '2026-09-10';
  const ISSUE = { 'missing-lot': 'Thiếu mã lô QC', 'mixed-target-mean': 'Mean mục tiêu thay đổi', 'mixed-target-sd': 'SD mục tiêu thay đổi' };
  // Tên trường lệch (`qcMean` ↔ `qc_mean`), nên dựng MỘT bộ điểm rồi ánh xạ.
  const toV2 = (pts) => pts.map((p) => ({ level: p.level, date: p.date, lot: p.lot, val: p.val, voided: p.voided ? 1 : 0, qc_mean: p.qcMean ?? null, qc_sd: p.qcSd ?? null }));
  // app cũ trả `cv: 0` cho cả "n=1" lẫn "Mean=0"; app-v2 phân biệt 0 với
  // `null` (Mean=0 thì không có CV). Chuẩn hoá `null`→0 để so phần chung, rồi
  // chốt riêng khác biệt hợp đồng đó ở cuối mục này.
  const norm = (c) => ({
    level: c.level, lot: c.lot, n: c.n, cv: Math.round((c.cv == null ? 0 : c.cv) * 1e9) / 1e9,
    start: c.start, end: c.end, targetMean: c.targetMean, targetSd: c.targetSd,
    issues: (c.issues || []).map((i) => ISSUE[i] || i).sort(), excluded: c.excluded,
  });
  const oldCohorts = (pts, period, levels) => {
    run('state.data = { XT: ' + JSON.stringify(pts) + ' };');
    const cutoff = run('SigmaCohortSelectionService.cutoff(' + JSON.stringify(period) + ')');
    const out = [];
    for (const level of levels) {
      const raw = run('SigmaCohortService.cohortsForLevelByLot(state, {testId:"XT", level:' + level + ', endDate:' + JSON.stringify(cutoff) + '})'
        + '.map(c=>({level:c.level,lot:c.lot,n:c.n,cv:c.stats?c.stats.cv:null,start:c.start,end:c.end,targetMean:c.targetMean,targetSd:c.targetSd,issues:c.issues,excluded:c.excluded}))');
      // Tầng chọn của app cũ: chỉ giữ nhóm còn dữ liệu trong chính kỳ.
      for (const c of raw) if (c.n > 0 && c.end >= period + '-01') out.push(c);
    }
    return out.map(norm).sort((a, b) => a.level - b.level || a.lot.localeCompare(b.lot));
  };
  const v2Cohorts = (pts, period, levels) => buildSigmaCohorts(toV2(pts), period, levels, TODAY)
    .map(norm).sort((a, b) => a.level - b.level || a.lot.localeCompare(b.lot));

  // Bộ dữ liệu chính: lô đi qua ranh giới tháng (vòng đời lô KHÔNG bị cắt ở
  // đầu kỳ), mức thiếu dữ liệu, mức không có mã lô, mức đổi Mean/SD mục tiêu
  // giữa kỳ, mức thiếu snapshot, và điểm sau `today`.
  const pts = [];
  const push = (date, level, lot, val, extra = {}) => pts.push({ date, level, lot, val, runId: date + '-1', ...extra });
  const dd = (n) => String(n).padStart(2, '0');
  for (let d = 1; d <= 28; d++) push('2026-07-' + dd(d), 1, '1101', 100 + gauss() * 2, { qcMean: 100, qcSd: 2 });
  for (let d = 1; d <= 14; d++) push('2026-08-' + dd(d), 1, '1101', 100 + gauss() * 2, { qcMean: 100, qcSd: 2 });
  for (let d = 15; d <= 31; d++) push('2026-08-' + dd(d), 1, '1102', 101 + gauss() * 2, { qcMean: 101, qcSd: 2 });
  for (let d = 1; d <= 9; d++) push('2026-09-' + dd(d), 1, '1102', 101 + gauss() * 2, { qcMean: 101, qcSd: 2 });
  for (let d = 1; d <= 12; d++) push('2026-08-' + dd(d), 2, '2101', 50 + gauss(), { qcMean: 50, qcSd: 1 });
  push('2026-08-13', 2, '2101', 50, { qcMean: 50, qcSd: 1, voided: 1 });
  push('2026-08-14', 2, '2101', NaN, { qcMean: 50, qcSd: 1 });
  for (let d = 1; d <= 25; d++) push('2026-08-' + dd(d), 3, '', 10 + gauss() * 0.3, { qcMean: 10, qcSd: 0.3 });
  for (let d = 1; d <= 15; d++) push('2026-08-' + dd(d), 4, '4101', 7 + gauss() * 0.2, { qcMean: 7, qcSd: 0.2 });
  for (let d = 16; d <= 31; d++) push('2026-08-' + dd(d), 4, '4101', 7.4 + gauss() * 0.2, { qcMean: 7.4, qcSd: 0.25 });
  for (let d = 1; d <= 10; d++) push('2026-08-' + dd(d), 5, '5101', 200 + gauss() * 4, { qcMean: null, qcSd: null });
  for (let d = 11; d <= 25; d++) push('2026-08-' + dd(d), 5, '5101', 200 + gauss() * 4, { qcMean: 200, qcSd: 4 });
  for (let d = 1; d <= 10; d++) push('2026-09-' + dd(d), 6, '6101', 30 + gauss(), { qcMean: 30, qcSd: 1 });
  for (let d = 11; d <= 25; d++) push('2026-09-' + dd(d), 6, '6101', 99 + gauss(), { qcMean: 30, qcSd: 1 });
  const LEVELS = [1, 2, 3, 4, 5, 6];
  for (const period of ['2026-07', '2026-08', '2026-09', '2026-10']) {
    same('cohortCutoff:' + period, run('SigmaCohortSelectionService.cutoff(' + JSON.stringify(period) + ')'), periodCutoff(period, TODAY));
    const o = oldCohorts(pts, period, LEVELS), v = v2Cohorts(pts, period, LEVELS);
    same('cohorts:' + period + ':số-nhóm', o.length, v.length);
    for (let i = 0; i < Math.max(o.length, v.length); i++) same('cohorts:' + period + ':#' + i, o[i] ?? null, v[i] ?? null);
  }

  // Các biên dễ port lệch, mỗi cái từng là một bug thật hoặc suýt là:
  const edges = [
    // `Number('')`/`Number(null)` là 0 và 0 hữu hạn → giá trị rỗng từng lọt
    // vào CV như một điểm 0 thật thay vì bị đếm là `invalidValue`.
    ['val rỗng/null', [{ date: '2026-08-01', level: 1, lot: 'L', val: 10, qcMean: 10, qcSd: 1 }, { date: '2026-08-02', level: 1, lot: 'L', val: null, qcMean: 10, qcSd: 1 }, { date: '2026-08-03', level: 1, lot: 'L', val: '', qcMean: 10, qcSd: 1 }, { date: '2026-08-04', level: 1, lot: 'L', val: 11, qcMean: 10, qcSd: 1 }]],
    // Cùng lý do, ở phía snapshot: điểm thiếu `qc_mean` từng tự đẻ ra một Mean
    // mục tiêu thứ hai (0) và dán nhãn "Mean mục tiêu thay đổi" cho cả nhóm,
    // tức đẩy nhóm sang `unstable` và Sigma không dùng được nó.
    ['snapshot Mean thiếu trộn với có', [{ date: '2026-08-01', level: 1, lot: 'L', val: 10, qcMean: null, qcSd: null }, { date: '2026-08-02', level: 1, lot: 'L', val: 11, qcMean: 10, qcSd: 1 }]],
    // Mean mục tiêu 0 là giá trị THẬT (base excess) — không được lẫn "chưa ghi".
    ['Mean mục tiêu = 0 thật', [{ date: '2026-08-01', level: 1, lot: 'L', val: 0.2, qcMean: 0, qcSd: 0.5 }, { date: '2026-08-02', level: 1, lot: 'L', val: -0.3, qcMean: 0, qcSd: 0.5 }]],
    ['đúng 1 điểm', [{ date: '2026-08-05', level: 1, lot: 'L', val: 10, qcMean: 10, qcSd: 1 }]],
    ['mọi điểm đều bị huỷ', [{ date: '2026-08-01', level: 1, lot: 'L', val: 10, voided: 1, qcMean: 10, qcSd: 1 }]],
    ['khoảng trắng quanh mã lô', [{ date: '2026-08-01', level: 1, lot: ' L ', val: 10, qcMean: 10, qcSd: 1 }, { date: '2026-08-02', level: 1, lot: 'L', val: 11, qcMean: 10, qcSd: 1 }]],
    // Cổng nhập điểm QC của CẢ HAI bản chỉ kiểm ĐỊNH DẠNG `YYYY-MM-DD`, nên
    // một ngày không tồn tại vẫn có thể nằm trong dữ liệu (di trú, hoặc lần
    // nhập trước khi cổng được siết); app cũ lọc nó ở tầng cohort, app-v2 phải
    // làm y hệt, nếu không `start`/`end` của nhóm thành vô nghĩa.
    ['ngày không tồn tại', [{ date: '2026-08-01', level: 1, lot: 'L', val: 10, qcMean: 10, qcSd: 1 }, { date: '2026-02-31', level: 1, lot: 'L', val: 99, qcMean: 10, qcSd: 1 }]],
    ['lô đặt tên số 9 vs 10', [{ date: '2026-08-01', level: 1, lot: '9', val: 10, qcMean: 10, qcSd: 1 }, { date: '2026-08-02', level: 1, lot: '10', val: 10, qcMean: 10, qcSd: 1 }]],
  ];
  for (const [why, rows] of edges) same('cohortBiên:' + why, oldCohorts(rows, '2026-08', [1]), v2Cohorts(rows, '2026-08', [1]));

  // 2 KHÁC BIỆT HỢP ĐỒNG CÓ CHỦ ĐÍCH — chốt lại để không ai "sửa" nhầm:
  // (a) Mean = 0 thì app cũ trả `cv: 0`, app-v2 trả `cv: null`. Cả hai đều
  //     hiện "—" trên giao diện, nhưng `null` không thể bị nhầm thành
  //     "CV = 0%" khi được ghi vào kỳ Sigma.
  {
    const zeroMean = [{ level: 1, date: '2026-08-01', lot: 'L', val: 1, voided: 0, qc_mean: 0, qc_sd: 1 }, { level: 1, date: '2026-08-02', lot: 'L', val: -1, voided: 0, qc_mean: 0, qc_sd: 1 }];
    assert.equal(buildSigmaCohorts(zeroMean, '2026-08', [1], TODAY)[0].cv, null, 'app-v2: Mean 0 thì CV là null, không phải 0');
    checks++;
  }
  // (b) `periodCutoff` chỉ nhận tháng 2 chữ số; `normalizePeriod` app cũ còn
  //     đệm "2026-6" thành "2026-06". Không tiếp cận được từ luồng thật:
  //     `sigma-handlers.ts` chặn bằng CÙNG một regex ở cả đường ghi
  //     (`saveSigmaPeriod`/`renamePeriod`) và đường đọc (`listCohorts`), nên
  //     `period` lưu trong `sigma_data` luôn là `YYYY-MM`.
  {
    assert.equal(periodCutoff('2026-6', TODAY), '', 'app-v2 đòi tháng 2 chữ số');
    assert.equal(run('SigmaCohortService.normalizePeriod("2026-6")'), '2026-06', 'app cũ đệm 0');
    checks += 2;
  }
}

// Một kịch bản rỗng cũng "khớp" — chốt số phép so tối thiểu để việc bộ dữ
// liệu bị teo lại không đi qua âm thầm.
assert.ok(checks >= 900, `số phép đối chiếu quá ít (${checks}) — bộ dữ liệu đã bị teo?`);
console.log(`app-v2 ↔ app cũ: ${checks} phép đối chiếu Westgard/Sigma đều khớp`);
