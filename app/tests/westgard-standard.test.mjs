// ĐỐI CHIẾU LUẬT WESTGARD VỚI ĐỊNH NGHĨA CHUẨN — không so với app cũ.
//
// Vì sao cần file này: `cross-app-westgard-sigma.test.mjs` chỉ chứng minh hai
// bản GIỐNG NHAU; nếu app cũ định nghĩa sai thì cả hai vẫn xanh. Đó đúng là
// chuyện đã xảy ra với `7T` (app cũ đợi 8 điểm) và `2of3-2s` (app cũ đòi điểm
// mới nhất phải là một trong hai điểm vượt) — cả hai sai so với định nghĩa
// công bố, và chính bộ test cũ đang KHOÁ hành vi sai đó.
//
// File này chốt hành vi theo NGUỒN NGOÀI, nên nó SỐNG TIẾP sau khi app cũ bị
// cắt (khác `cross-app-westgard-sigma.test.mjs`, sẽ bị xoá cùng lúc).
//
// Nguồn định nghĩa: https://westgard.com/westgard-rules/
//   1-3s     "reject when a single control measurement exceeds the mean plus
//             3s or the mean minus 3s control limit"
//   1-2s     dùng làm luật CẢNH BÁO
//   2-2s     "reject when 2 consecutive control measurements exceed the same
//             mean plus 2s or the same mean minus 2s control limit"
//   R4s      "reject when 1 control measurement in a group exceeds the mean
//             plus 2s and another exceeds the mean minus 2s" — CHỈ within-run
//   4-1s     "reject when 4 consecutive control measurements exceed the same
//             mean plus 1s or the same mean minus 1s control limit"
//   10x      "reject when 10 consecutive control measurements fall on one
//             side of the mean"
//   2of3-2s  "reject when 2 out of 3 control measurements exceed the same
//             mean plus 2s or mean minus 2s control limit"
//   3-1s     "reject when 3 consecutive control measurements exceed the same
//             mean plus 1s or mean minus 1s control limit"
//   6x/8x/9x/12x  N phép đo liên tiếp cùng một phía so với Mean
//   7T       "reject when seven control measurements trend in the same
//             direction, i.e. get progressively higher or progressively lower"
//
// Chạy qua bản ĐÃ BUILD (CommonJS) vì westgard-engine.ts import chéo
// westgard-rules.ts — cùng lý do đã ghi ở westgard-engine.test.mjs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { westgard, westgardMultiByPoint } = require('../../app-dist/main/domain/westgard-engine.js');
const { WG_RULE_BY_ID, errorType, errorTypeDetail, defaultRuleScope } = require('../../app-dist/main/domain/westgard-rules.js');

let checks = 0;
// Mean=0/SD=1 nên `val` chính là z — đọc kịch bản trực tiếp bằng số SD.
const pts = (zs) => zs.map((z) => ({ val: z, trendTarget: 'same' }));
const only = (id) => (r) => r === id;
const flags = (zs, id) => westgard(pts(zs), 0, 1, only(id)).F;
/** Luật `id` có nổ ở BẤT KỲ điểm nào của chuỗi không. */
const fires = (zs, id) => flags(zs, id).some((f) => f.rules.includes(id));
const check = (id, zs, want, why) => {
  checks++;
  assert.equal(fires(zs, id), want, `${id} [${zs.join(', ')}] — ${why}`);
};

// ------------------------------------------------- 1 điểm: 1-3s và 1-2s
check('1-3s', [3.1], true, 'vượt +3SD phải loại');
check('1-3s', [-3.1], true, 'vượt -3SD phải loại');
check('1-3s', [3], false, '"exceeds" là VƯỢT HẲN, đúng 3SD chưa tính');
check('1-3s', [2.9], false, 'chưa tới 3SD');
check('1-2s', [2.1], true, 'vượt 2SD là cảnh báo');
check('1-2s', [2], false, 'đúng 2SD chưa tính');
{
  checks += 2;
  assert.equal(flags([2.5], '1-2s')[0].level, 'warn', '1-2s chỉ CẢNH BÁO, không loại bỏ');
  assert.equal(flags([3.5], '1-3s')[0].level, 'rej', '1-3s là luật loại bỏ');
}

// ----------------------------------------------------- Chuỗi liên tiếp
check('2-2s', [2.1, 2.2], true, '2 điểm liên tiếp cùng phía vượt 2SD');
check('2-2s', [-2.1, -2.2], true, 'cùng phía âm');
check('2-2s', [2.1, -2.2], false, 'KHÁC phía thì không phải 2-2s');
check('2-2s', [2.1, 0, 2.2], false, 'không liên tiếp');
check('2-2s', [2.1, 2], false, 'điểm thứ hai đúng 2SD, chưa vượt');

check('4-1s', [1.1, 1.2, 1.3, 1.4], true, '4 điểm liên tiếp cùng phía vượt 1SD');
check('4-1s', [1.1, 1.2, 1.3], false, 'mới 3 điểm');
check('4-1s', [1.1, 1.2, -1.3, 1.4], false, 'bị cắt bởi điểm khác phía');
check('3-1s', [1.1, 1.2, 1.3], true, '3 điểm liên tiếp cùng phía vượt 1SD');
check('3-1s', [1.1, 1.2], false, 'mới 2 điểm');

for (const [id, n] of [['6x', 6], ['8x', 8], ['9x', 9], ['10x', 10], ['12x', 12]]) {
  const run = Array.from({ length: n }, (_, i) => 0.1 + i * 0.01);
  check(id, run, true, `${n} điểm liên tiếp cùng phía Mean`);
  check(id, run.slice(0, n - 1), false, `${n - 1} điểm thì chưa đủ`);
  const broken = run.slice();
  broken[Math.floor(n / 2)] = -0.1;
  check(id, broken, false, 'một điểm sang phía kia là đứt chuỗi');
  const atMean = run.slice();
  atMean[Math.floor(n / 2)] = 0;
  check(id, atMean, false, 'điểm đúng bằng Mean không thuộc phía nào');
}

// ------------------------------------------------------------- 2of3-2s
// "2 out of 3" — KHÔNG đòi điểm mới nhất phải là một trong hai điểm vượt.
check('2of3-2s', [2.1, 2.2, 0], true, 'hai điểm ĐẦU của cửa sổ cùng vượt +2SD');
check('2of3-2s', [2.1, 0, 2.2], true, 'điểm đầu và điểm cuối cùng vượt');
check('2of3-2s', [0, 2.1, 2.2], true, 'hai điểm CUỐI cùng vượt');
check('2of3-2s', [-2.1, -2.2, 0], true, 'cùng phía âm');
check('2of3-2s', [2.1, -2.2, 0], false, 'khác phía thì không phải "same limit"');
check('2of3-2s', [2.1, 0, 0], false, 'mới 1 điểm vượt trong cửa sổ');
check('2of3-2s', [2.1, 0, 0, 2.2], false, 'hai điểm vượt cách nhau quá xa, không cùng một cửa sổ 3');
{
  // Điểm MỚI NHẤT TRONG SỐ CÁC ĐIỂM VƯỢT mang kết luận, điểm vượt còn lại là
  // bằng chứng — cùng quy ước "điểm mới nhất mang kết luận" của mọi luật
  // nhiều điểm khác (2-2s/4-1s/10x…). Điểm chốt cửa sổ mà KHÔNG vượt thì
  // không được dán "Loại bỏ": nó là một điểm đạt.
  const F = flags([2.1, 2.2, 0], '2of3-2s');
  checks += 3;
  assert.deepEqual(F[1].rules, ['2of3-2s'], 'điểm vượt mới nhất mang kết luận');
  assert.deepEqual(F[2].rules, [], 'điểm z = 0 chốt cửa sổ vẫn là điểm đạt');
  assert.ok(F[0].supportRules.includes('2of3-2s'), 'điểm vượt còn lại là bằng chứng');
}
{
  // Cửa sổ kết thúc đúng bằng một điểm vượt thì điểm đó mang kết luận.
  const F = flags([0, 2.1, 2.2], '2of3-2s');
  checks += 2;
  assert.deepEqual(F[2].rules, ['2of3-2s'], 'điểm cuối vừa vượt vừa chốt cửa sổ');
  assert.ok(F[1].supportRules.includes('2of3-2s'), 'điểm vượt trước đó là bằng chứng');
}

// ------------------------------------------------------------------ 7T
// "seven control measurements trend in the same direction" — BẢY phép đo,
// tức 6 bước tăng/giảm, KHÔNG phải 7 bước/8 điểm.
{
  const rise = (n) => Array.from({ length: n }, (_, i) => -3 + i * 0.5);
  check('7T', rise(7), true, 'bảy điểm tăng dần liên tục');
  check('7T', rise(6), false, 'sáu điểm thì chưa đủ');
  check('7T', rise(7).map((z) => -z), true, 'bảy điểm giảm dần cũng nổ');
  check('7T', [-3, -2.5, -2, -2, -1.5, -1, -0.5], false, 'hai điểm bằng nhau là đứt xu hướng');
  checks += 2;
  assert.equal(flags(rise(7), '7T')[6].level, 'rej', '7T là luật LOẠI BỎ theo Westgard (SOP có thể hạ xuống cảnh báo cho từng xét nghiệm)');
  const changed = rise(7).map((z, i) => ({ val: z, trendTarget: i < 3 ? 'a' : 'b' }));
  assert.equal(westgard(changed, 0, 1, only('7T')).F.some((f) => f.rules.includes('7T')), false, 'đổi dải mục tiêu giữa chuỗi thì không còn là một xu hướng');
}

// ------------------------------------------- R4s: CHỈ trong cùng một run
{
  const asLevels = (zs) => zs.map((z, i) => ({ level: i + 1, pts: [{ val: z, runId: 'R1' }], mean: 0, sd: 1 }));
  const firedMulti = (zs, id) => {
    const sets = asLevels(zs);
    const map = westgardMultiByPoint(sets, only(id));
    return sets.some((s) => (map.get(s.pts[0]) || []).includes(id));
  };
  const m = (zs, id, want, why) => { checks++; assert.equal(firedMulti(zs, id), want, `${id} liên mức [${zs.join(', ')}] — ${why}`); };
  m([2.5, -2.5], 'R4s', true, '1 mức > +2SD và 1 mức < -2SD trong cùng lần chạy');
  m([2.5, -1.8], 'R4s', false, 'mức thấp chưa vượt -2SD');
  m([2.5, 2.6], 'R4s', false, 'cùng phía không phải R4s');
  checks++;
  const acrossRuns = [{ level: 1, pts: [{ val: 2.5, runId: 'R1' }, { val: -2.5, runId: 'R2' }], mean: 0, sd: 1 }];
  const mapAcross = westgardMultiByPoint(acrossRuns, only('R4s'));
  assert.equal(acrossRuns[0].pts.some((p) => (mapAcross.get(p) || []).includes('R4s')), false, 'R4s chỉ within-run, không xét giữa hai lần chạy');
  // Luật dùng cho thiết kế 3 mức.
  m([2.1, 2.2, 0], '2of3-2s', true, '2 trong 3 mức cùng vượt +2SD trong một lần chạy');
  m([1.1, 1.2, 1.3], '3-1s', true, '3 mức cùng vượt +1SD trong một lần chạy');
  m([2.1, 2.2], '2-2s', true, '2 mức cùng vượt +2SD trong một lần chạy');

  // ---- Chuỗi GỘP qua nhiều lần chạy (Westgard, "Multirule Interpretation")
  //   41s: "can be applied 'across materials and across runs'" — 2 điểm lần
  //        chạy này + 2 điểm lần chạy trước.
  //   10x: "applied to both control measurements in a run for the last five
  //        runs, OR to the measurements on just one material for the last ten
  //        runs" — chính là lý do họ đếm chuỗi phải là `both`.
  //   22s: "can also be applied to the last two measurements 'within a
  //        material and across runs'".
  // Chuỗi gộp xếp theo LẦN CHẠY rồi tới MỨC, nên 2 mức × 2 lần chạy = 4 điểm
  // liên tiếp đúng như mô tả trên.
  const twoLevels = (runs) => [
    { level: 1, pts: runs.map(([a], i) => ({ val: a, runId: `R${i + 1}` })), mean: 0, sd: 1 },
    { level: 2, pts: runs.map(([, b], i) => ({ val: b, runId: `R${i + 1}` })), mean: 0, sd: 1 },
  ];
  const firedIn = (runs, id) => {
    const sets = twoLevels(runs);
    const map = westgardMultiByPoint(sets, only(id));
    return sets.some((set) => set.pts.some((point) => (map.get(point) || []).includes(id)));
  };
  const seq = (runs, id, want, why) => { checks++; assert.equal(firedIn(runs, id), want, `${id} chuỗi gộp — ${why}`); };

  seq([[1.2, 1.3], [1.4, 1.5]], '4-1s', true, '2 mức × 2 lần chạy = 4 điểm cùng phía vượt 1SD');
  seq([[1.2, 1.3], [1.4, 0.5]], '4-1s', false, 'điểm cuối chưa vượt 1SD thì chưa đủ 4');
  seq([[1.2, -1.3], [1.4, -1.5]], '4-1s', false, 'phải CÙNG phía, xen kẽ dấu không tính');
  seq([[0.5, 0.6], [0.7, 0.8], [0.9, 0.4], [0.3, 0.2], [0.1, 0.5]], '10x',
    true, '5 lần chạy × 2 mức = 10 phép đo cùng phía Mean');
  seq([[0.5, 0.6], [0.7, 0.8], [0.9, 0.4], [0.3, 0.2], [0.1, -0.5]], '10x',
    false, 'một điểm khác phía làm đứt chuỗi 10');
  // 22s "within a material and across runs" do KÊNH TỪNG MỨC lo, không phải
  // kênh liên mức: chuỗi gộp CỐ Ý loại 2-2s
  // (`WG_RUN_RULES.filter(rule !== '2-2s')`), nếu không thì hai điểm cùng một
  // lần chạy sẽ bị tính hai lần — một lần ở nhánh "2 mức cùng vượt" ngay bên
  // trên, một lần nữa vì chúng nằm cạnh nhau trong chuỗi gộp.
  // Ca phân biệt: hai điểm này NẰM CẠNH NHAU trong chuỗi gộp (mức 2 của lần
  // chạy trước + mức 1 của lần chạy này) và đều vượt +2SD, nhưng chúng không
  // cùng một lần chạy VÀ cũng không cùng một mức — ghép chúng thành "2 phép
  // đo liên tiếp" là vô nghĩa. Bỏ bộ lọc `2-2s` khỏi chuỗi gộp là ca này nổ.
  seq([[0.1, 2.2], [2.3, 0.2]], '2-2s', false, 'chéo cả mức lẫn lần chạy không phải 2-2s');
  seq([[2.1, 0.1], [2.2, 0.2]], '2-2s', false, 'chuỗi gộp không lặp lại 2-2s; kênh từng mức mới lo việc này');
  checks++;
  assert.equal(flags([2.1, 2.2], '2-2s')[1].level, 'rej',
    '22s qua hai lần chạy của CÙNG một mức phải nổ ở kênh từng mức');

  // Với 3 mức QC, Westgard khuyến cáo dùng bộ 13s/2of3-2s/R4s/31s/6x/9x vì
  // "The 22s, 41s, and 10x rules ... just don't fit with multiples of 3".
  // Đây là khuyến cáo THIẾT KẾ (chọn luật nào cho bao nhiêu mức), app đưa vào
  // bảng gợi ý ở `sigma-qc-design.test.mjs`, KHÔNG chặn ở engine — phòng xét
  // nghiệm vẫn được bật luật họ muốn. Chốt ở đây để không ai "sửa" engine
  // theo hướng tự tắt luật.
  checks++;
  assert.equal(firedMulti([1.1, 1.2, 1.3], '3-1s'), true,
    '3 mức: 31s vẫn là luật dùng được, không bị engine tự chặn');
}

// ------------------------------------ Hàng rào: mô tả registry phải khớp luật
{
  checks += 3;
  assert.match(WG_RULE_BY_ID['7T'].desc, /7 điểm/, 'mô tả 7T phải nói 7 điểm — bản cũ ghi "(8 điểm QC)" đúng theo engine sai');
  assert.equal(WG_RULE_BY_ID['R4s'].scope, 'across', 'R4s phải là luật liên mức trong một lần chạy');
  assert.equal(WG_RULE_BY_ID['R4s'].run, null, 'R4s KHÔNG được nằm trong họ luật quét chuỗi (sẽ thành between-run)');
}

// ------------------------------ Nhãn loại sai số phải tự nhất quán
// `type` và `desc` phải mô tả CÙNG một luật. App cũ chọn `desc` theo luật có
// priority nhỏ nhất trên TOÀN BỘ danh sách, nên `['1-3s','2-2s']` in
// "SE — Sai số hệ thống" kèm mô tả của 1-3s (một luật RE).
{
  const seRules = Object.values(WG_RULE_BY_ID).filter((r) => r.err === 'SE').map((r) => r.id);
  const reRules = Object.values(WG_RULE_BY_ID).filter((r) => r.err === 'RE').map((r) => r.id);
  const descOf = (id) => WG_RULE_BY_ID[id].desc;

  // Mọi tổ hợp 1 luật SE + 1 luật RE: type là SE (chính sách của app cũ, giữ
  // nguyên) và desc PHẢI là mô tả của chính luật SE đó.
  for (const se of seRules) for (const re of reRules) {
    for (const combo of [[se, re], [re, se]]) {
      const d = errorTypeDetail(combo);
      checks += 2;
      assert.match(d.type, /^SE/, `${combo.join('+')}: có luật SE thì type là SE`);
      assert.equal(d.desc, descOf(se), `${combo.join('+')}: mô tả phải là của chính luật SE, không phải luật RE`);
    }
  }
  // Chỉ RE thì desc là của luật RE.
  for (const re of reRules) {
    const d = errorTypeDetail([re, '1-2s']);
    checks += 2;
    assert.match(d.type, /^RE/);
    assert.equal(d.desc, descOf(re));
  }
  // Luật không phân loại (1-2s) không tự sinh nhãn.
  checks += 2;
  assert.deepEqual(errorTypeDetail(['1-2s']), { type: '—', desc: '' });
  assert.equal(errorType(['1-2s']), '—');
  // Bất biến chung: desc luôn thuộc về một luật CÙNG lớp với type.
  for (const combo of [['1-3s', '2-2s'], ['R4s', '4-1s'], ['1-3s', 'R4s'], ['2-2s', '10x'], ['1-2s', '1-3s', '6x']]) {
    const d = errorTypeDetail(combo);
    const owner = combo.find((id) => WG_RULE_BY_ID[id].desc === d.desc);
    checks++;
    assert.equal(WG_RULE_BY_ID[owner].err, d.type.slice(0, 2), `${combo.join('+')}: type và desc phải cùng một lớp sai số`);
  }
}

// ---------------------------------------------------------------- PHẠM VI LUẬT
// Thuật ngữ của app đọc NGƯỢC so với tài liệu Westgard, nên ghi lại ở đây:
//   `within` = trong TỪNG mức QC, qua nhiều lần chạy ≈ Westgard "across runs"
//   `across` = chéo các mức trong CÙNG lần chạy      ≈ Westgard "across materials"
//
// Định nghĩa chuẩn cho họ đếm chuỗi liên tiếp nói rõ CẢ HAI chiều đều hợp lệ,
// và chiều cơ bản là qua nhiều lần chạy của cùng một mức:
//   4-1s "These 4 may be from one control material or they may ALSO be the
//         last 2 points from a high level control material and the last 2
//         points from a normal level control material, thus the rule may
//         also be applied across materials."
//   10x  "The 10x rule usually has to be applied ACROSS RUNS and OFTEN
//         across materials."
// → cả họ phải là `both`. Để `across` thuần là bỏ sót đúng ca lâm sàng hay
// gặp nhất: MỘT mức trôi dần một phía trong khi mức kia ổn định quanh Mean,
// chuỗi gộp liên mức xen kẽ dấu nên không luật nào nổ.
{
  const COUNTING = ['2-2s', '3-1s', '4-1s', '6x', '8x', '9x', '10x', '12x'];
  for (const id of COUNTING) {
    const min = WG_RULE_BY_ID[id].scopeMin;
    checks += 2;
    assert.equal(WG_RULE_BY_ID[id].scope, 'both', `${id}: họ đếm chuỗi phải nhìn cả hai chiều`);
    assert.equal(defaultRuleScope(id, min), 'both', `${id}: đủ số mức thì vẫn giữ cả hai chiều`);
  }
  // Hai ngoại lệ, mỗi cái có câu chữ riêng trong định nghĩa chuẩn.
  checks += 2;
  assert.equal(WG_RULE_BY_ID['R4s'].scope, 'across',
    'R4s: "should only be interpreted within-run, not between-run"');
  assert.equal(WG_RULE_BY_ID['7T'].scope, 'within',
    '7T: xu hướng tăng/giảm chỉ có nghĩa trong cùng một mức');

  // Chuỗi cùng phía Mean trong CHÍNH một mức phải nổ 6x — đây là hành vi mà
  // `scope: 'across'` từng bỏ sót (phát hiện từ dữ liệu thật 2026-09-11).
  const drift = Array.from({ length: 6 }, () => ({ val: 0.5, trendTarget: 'same' }));
  checks += 2;
  assert.equal(westgard(drift, 0, 1, (r) => r === '6x').F.at(-1).level, 'rej',
    '6 điểm liên tiếp cùng phía Mean trong một mức: 6x phải nổ');
  assert.equal(westgard(drift.slice(0, 5), 0, 1, (r) => r === '6x').F.at(-1).level, 'ok',
    '5 điểm thì chưa đủ — không được nổ sớm');
}

assert.ok(checks >= 60, `số phép kiểm quá ít (${checks})`);
console.log(`Westgard theo định nghĩa chuẩn: ${checks} phép kiểm đều đúng`);
