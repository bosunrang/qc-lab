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
const { westgard, westgardMultiByPoint } = require('../../app-v2-dist/main/domain/westgard-engine.js');
const { WG_RULE_BY_ID, errorType, errorTypeDetail } = require('../../app-v2-dist/main/domain/westgard-rules.js');

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
  // Điểm CHỐT cửa sổ mang kết luận, các điểm vượt còn lại là bằng chứng —
  // cùng quy ước mọi luật nhiều điểm khác (2-2s/4-1s/10x…), nhờ đó
  // `acceptedPoints()` (quét tăng dần, chỉ đọc điểm mới nhất) vẫn đúng.
  const F = flags([2.1, 2.2, 0], '2of3-2s');
  checks += 2;
  assert.deepEqual(F[2].rules, ['2of3-2s'], 'điểm chốt cửa sổ mang kết luận');
  assert.ok(F[0].supportRules.includes('2of3-2s') && F[1].supportRules.includes('2of3-2s'), 'hai điểm vượt là bằng chứng');
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
  assert.equal(flags(rise(7), '7T')[6].level, 'warn', '7T là cảnh báo theo mặc định của app (SOP có thể nâng thành loại bỏ)');
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

assert.ok(checks >= 60, `số phép kiểm quá ít (${checks})`);
console.log(`Westgard theo định nghĩa chuẩn: ${checks} phép kiểm đều đúng`);
