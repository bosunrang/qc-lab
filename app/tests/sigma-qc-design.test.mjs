// ĐỐI CHIẾU BẢNG WESTGARD SIGMA RULES VỚI ĐỊNH NGHĨA CÔNG BỐ — không so với
// app cũ.
//
// Vì sao cần file này: `cross-app-westgard-sigma.test.mjs` chỉ chứng minh hai
// bản GIỐNG NHAU. Ở đúng hàm này thì app cũ (`QCCore.westgardSigmaRules()`)
// dùng MỘT bảng duy nhất pha trộn hai bảng của Westgard, nên "giống app cũ"
// nghĩa là cùng sai. File này chốt theo NGUỒN NGOÀI nên SỐNG TIẾP sau khi app
// cũ bị cắt.
//
// Nguồn: https://www.westgard.com/lessons/westgard-rules/westgard-rules/westgard-sigma-rules.html
//
//   2 mức QC:
//     6σ   1-3s                          N=2 R=1
//     5σ   1-3s/2-2s/R4s                 N=2 R=1
//     4σ   1-3s/2-2s/R4s/4-1s            N=4 R=1  (hoặc N=2 R=2)
//     <4σ  multirule kèm 8x              N=4 R=2  (hoặc N=2 R=4)
//
//   3 mức QC:
//     6σ   1-3s                          N=3 R=1
//     5σ   1-3s/2of3-2s/R4s              N=3 R=1
//     4σ   1-3s/2of3-2s/R4s/3-1s         N=3 R=1
//     <4σ  multirule kèm 6x              N=6 R=1  (hoặc N=3 R=2);
//          "if a 9x rule were substituted for the 6x rule, then a day's work
//           could be divided into 3 runs with 3 controls per run (N=3,R=3)"
//
// sigma-metrics.ts không import chéo module nào trong main/ nên import thẳng
// .ts qua ESM được (giống eqa-rounds-stats.test.mjs).
import assert from 'node:assert/strict';
import { sigmaQualityDesign } from '../main/domain/sigma-metrics.ts';

let checks = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };

// ---------------------------------------------------------------------------
// 1) Bảng 2 mức QC, đúng từng ô.
// ---------------------------------------------------------------------------
{
  const d = sigmaQualityDesign(6.2, 2);
  eq(d.rules, ['1-3s'], '2 mức · ≥6σ: một quy tắc 1-3s');
  eq([d.n, d.r], [2, 1], '2 mức · ≥6σ: N=2 R=1');
  eq(d.alternatives, [], '2 mức · ≥6σ: không có phương án thay thế');
  eq([d.capable, d.tier, d.levels], [true, '≥6', 2], '2 mức · ≥6σ: tier/levels');
}
{
  const d = sigmaQualityDesign(5.0, 2);
  eq(d.rules, ['1-3s', '2-2s', 'R4s'], '2 mức · 5σ: KHÔNG có 4-1s');
  eq([d.n, d.r], [2, 1], '2 mức · 5σ: N=2 R=1 (không phải N=4)');
}
{
  const d = sigmaQualityDesign(4.0, 2);
  eq(d.rules, ['1-3s', '2-2s', 'R4s', '4-1s'], '2 mức · 4σ: thêm 4-1s, KHÔNG có 8x');
  eq([d.n, d.r], [4, 1], '2 mức · 4σ: N=4 R=1');
  eq(d.alternatives, [{ n: 2, r: 2 }], '2 mức · 4σ: phương án N=2 R=2');
}
{
  const d = sigmaQualityDesign(3.5, 2);
  eq(d.rules, ['1-3s', '2-2s', 'R4s', '4-1s', '8x'], '2 mức · <4σ: thêm 8x (KHÔNG phải 6x)');
  eq([d.n, d.r], [4, 2], '2 mức · <4σ: N=4 R=2');
  eq(d.alternatives, [{ n: 2, r: 4 }], '2 mức · <4σ: phương án N=2 R=4');
  eq(d.capable, true, '2 mức · 3–4σ vẫn thiết kế được');
}

// ---------------------------------------------------------------------------
// 2) Bảng 3 mức QC — KHÁC bảng 2 mức cả ở bộ luật lẫn N/R.
// ---------------------------------------------------------------------------
{
  const d = sigmaQualityDesign(6.2, 3);
  eq(d.rules, ['1-3s'], '3 mức · ≥6σ: một quy tắc 1-3s');
  eq([d.n, d.r], [3, 1], '3 mức · ≥6σ: N=3 (không phải 2)');
}
{
  const d = sigmaQualityDesign(5.0, 3);
  eq(d.rules, ['1-3s', '2of3-2s', 'R4s'], '3 mức · 5σ: dùng 2of3-2s thay 2-2s');
  eq([d.n, d.r], [3, 1], '3 mức · 5σ: N=3 R=1');
}
{
  const d = sigmaQualityDesign(4.0, 3);
  eq(d.rules, ['1-3s', '2of3-2s', 'R4s', '3-1s'], '3 mức · 4σ: thêm 3-1s (không phải 4-1s)');
  eq([d.n, d.r], [3, 1], '3 mức · 4σ: N=3 R=1');
}
{
  const d = sigmaQualityDesign(3.5, 3);
  eq(d.rules, ['1-3s', '2of3-2s', 'R4s', '3-1s', '6x'], '3 mức · <4σ: thêm 6x');
  eq([d.n, d.r], [6, 1], '3 mức · <4σ: N=6 R=1');
  eq(d.alternatives, [{ n: 3, r: 2 }, { n: 3, r: 3, note: 'dùng 9x thay 6x' }],
    '3 mức · <4σ: hai phương án, trong đó 9x thay 6x thì N=3 R=3');
}

// ---------------------------------------------------------------------------
// 3) Hai bảng phải THẬT SỰ khác nhau — chốt riêng để một bản cài đặt bỏ qua
//    `levelCount` (đúng lỗi của app cũ và của bản app trước 11/09) không
//    thể lọt qua bộ test này.
// ---------------------------------------------------------------------------
for (const sigma of [6.5, 5.2, 4.3, 3.2, 2.0]) {
  const two = sigmaQualityDesign(sigma, 2);
  const three = sigmaQualityDesign(sigma, 3);
  assert.notDeepEqual({ rules: two.rules, n: two.n, r: two.r }, { rules: three.rules, n: three.n, r: three.r },
    `Sigma ${sigma}: bảng 2 mức và 3 mức không được giống nhau`);
  checks++;
}

// ---------------------------------------------------------------------------
// 4) Dưới 3σ: KHÔNG có thiết kế QC nào hợp thức hoá được phương pháp.
// ---------------------------------------------------------------------------
for (const levels of [2, 3]) {
  const d = sigmaQualityDesign(2.4, levels);
  eq([d.capable, d.tier], [false, '<3'], `${levels} mức · <3σ: capable=false`);
  assert.match(d.plan, /khắc phục phương pháp/, `${levels} mức · <3σ: kế hoạch phải là khắc phục phương pháp`);
  checks++;
}

// ---------------------------------------------------------------------------
// 5) Chọn bảng theo SỐ MỨC THẬT. Westgard chỉ công bố bảng cho 2 và 3 mức:
//    1 mức không được bịa ra khuyến nghị, còn ≥4 mức dùng bảng 3 mức.
// ---------------------------------------------------------------------------
eq(sigmaQualityDesign(5, 1), null, '1 mức → không có gợi ý Sigma Rules');
eq([sigmaQualityDesign(5, 2).levels, sigmaQualityDesign(5, 2).levelCount], [2, 2], '2 mức → bảng 2 mức');
eq([sigmaQualityDesign(5, 3).levels, sigmaQualityDesign(5, 3).levelCount], [3, 3], '3 mức → bảng 3 mức');
eq([sigmaQualityDesign(5, 4).levels, sigmaQualityDesign(5, 4).levelCount], [3, 4], '4 mức → bảng 3 mức');
// Thiếu `levelCount` giữ bảng 2 mức — cấu hình phổ biến nhất, và là hành vi
// bảo toàn cho caller cũ.
eq(sigmaQualityDesign(5).levels, 2, 'thiếu levelCount → bảng 2 mức');

// ---------------------------------------------------------------------------
// 6) Biên tier: đúng 6/5/4/3 thuộc tier CAO hơn (>=), không phải tier dưới.
// ---------------------------------------------------------------------------
eq(sigmaQualityDesign(6, 2).tier, '≥6', 'sigma = 6 đúng bằng thuộc tier ≥6');
eq(sigmaQualityDesign(5.999, 2).tier, '5–6', 'sigma 5,999 thuộc tier 5–6');
eq(sigmaQualityDesign(5, 2).tier, '5–6', 'sigma = 5 đúng bằng thuộc tier 5–6');
eq(sigmaQualityDesign(4.999, 2).tier, '4–5', 'sigma 4,999 thuộc tier 4–5');
eq(sigmaQualityDesign(4, 2).tier, '4–5', 'sigma = 4 đúng bằng thuộc tier 4–5');
eq(sigmaQualityDesign(3.999, 2).tier, '3–4', 'sigma 3,999 thuộc tier 3–4');
eq(sigmaQualityDesign(3, 2).tier, '3–4', 'sigma = 3 đúng bằng thuộc tier 3–4');
eq(sigmaQualityDesign(2.999, 2).tier, '<3', 'sigma 2,999 thuộc tier <3');

// ---------------------------------------------------------------------------
// 7) Sigma không tính được thì không đưa ra thiết kế nào — không được rơi về
//    một bảng mặc định, vì đó là gợi ý lâm sàng.
// ---------------------------------------------------------------------------
for (const bad of [null, undefined, '', 'abc', NaN, Infinity]) {
  assert.equal(sigmaQualityDesign(bad, 3), null, `sigma ${String(bad)} → null`);
  checks++;
}

console.log(`Westgard Sigma Rules theo bảng công bố: ${checks} phép kiểm đều đúng`);
