// Oracle cho erf/normalCdf/dpmoFromSigma/sigmaMetric — so voi ban cu
// (assets/core.js) tren nhieu input khac nhau. Khong co import cheo giua cac
// file trong sigma-metrics.ts nen import thang .ts duoc.
//
// PHAN uncertaintyBudget KHONG con so voi app cu (11/09/2026): app-v2 da doi
// y nghia u(Cref) theo Nordtest TR 537 (do khong dam bao cua GIA TRI GAN do
// nha cung cap EQA/CRM cong bo) thay vi SUY tu SD chuoi bias quan sat nhu app
// cu. So bang nhau se khoa lai chinh cai sai. O day chot theo CONG THUC
// (tinh tay), con lech co chu dich voi app cu duoc chot rieng o
// cross-app-westgard-sigma.test.mjs muc 9.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const QCCore = require('../../assets/core.js');
import { erf, normalCdf, dpmoFromSigma, sigmaMetric, uncertaintyBudget } from '../main/domain/sigma-metrics.ts';

for (const x of [-3, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3, 5]) {
  assert.ok(Math.abs(erf(x) - QCCore.erf(x)) < 1e-12, `erf(${x}) lech ban cu`);
  assert.ok(Math.abs(normalCdf(x) - QCCore.normalCdf(x)) < 1e-12, `normalCdf(${x}) lech ban cu`);
}

for (const sigma of [1, 2, 3, 4, 5, 6, 7]) {
  assert.ok(Math.abs(dpmoFromSigma(sigma) - QCCore.dpmoFromSigma(sigma)) < 1e-9, `dpmoFromSigma(${sigma}) lech ban cu`);
}

const sigmaCases = [
  [15, 2, 3], [10, -1.5, 2], [0, 1, 2], [15, 2, 0], [15, 2, -1], [NaN, 2, 3],
];
for (const [tea, bias, cv] of sigmaCases) {
  const newR = sigmaMetric(tea, bias, cv);
  const oldR = QCCore.sigmaMetric(tea, bias, cv);
  assert.deepEqual(newR, oldR, `sigmaMetric(${tea},${bias},${cv}) lech ban cu`);
}

// --------------------------------------------------------------------------
// Ngan sach MU — chot theo cong thuc, khong so voi app cu.
//   u_c = sqrt(u(Rw)^2 + u(bias)^2 + u(cal)^2),  u(bias) = sqrt(bias^2 + u(Cref)^2)
//   U   = k * u_c, k = 2 mac dinh
// Nguon: Nordtest TR 537 (nhanh cong u(bias) khi bias KHONG duoc hieu chinh);
// ISO/TS 20914 la nhanh con lai (bias phai hieu chinh, khong cong vao ngan
// sach) — chinh la `includeBias: false`.
// --------------------------------------------------------------------------
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-12, `${what}: ${a} vs ${b}`);

// 1) Du ca 4 thanh phan.
{
  const r = uncertaintyBudget({ cv: 3, bias: 1.2, uCref: 0.3, uCal: 0.5 });
  const uBias = Math.sqrt(1.2 * 1.2 + 0.3 * 0.3);
  near(r.uRw, 3, 'u(Rw)');
  near(r.uCref, 0.3, 'u(Cref)');
  near(r.uBias, uBias, 'u(bias)');
  near(r.uc, Math.sqrt(9 + uBias * uBias + 0.25), 'u_c');
  near(r.U, 2 * r.uc, 'U = 2*u_c');
  assert.equal(r.complete, true, 'du 4 thanh phan phai la complete');
  assert.deepEqual(r.missing, []);
  // Ti trong phuong sai phai cong lai bang 1.
  near(Object.values(r.shares).reduce((s, v) => s + v, 0), 1, 'tong ti trong');
}

// 2) u(Cref) VANG MAT thi khong duoc doc la 0 — ngan sach bi danh dau chua du.
//    Day la diem lech co chu dich voi app cu: app cu luon co mot con so
//    (SD chuoi bias / can n) nen ngan sach luon "du" mot cach gia tao.
{
  const r = uncertaintyBudget({ cv: 3, bias: 1.2, uCal: 0.5 });
  assert.equal(r.uCref, null, 'chua nhap u(Cref) phai la null');
  assert.equal(r.complete, false);
  assert.ok(r.missing.includes('u(Cref)'), `mong doi u(Cref) trong missing, nhan duoc ${r.missing}`);
  // Van tinh duoc mot U so bo tu bias quan sat, nhung phai bi danh dau chua du.
  near(r.uBias, 1.2, 'u(bias) = |bias| khi chua co u(Cref)');
}

// 3) Tat nhanh bias (che do ISO/TS 20914): u(Cref) khong con y nghia nen
//    KHONG duoc doi, va u(bias) bien mat khoi ngan sach.
{
  const r = uncertaintyBudget({ cv: 3, bias: 1.2, uCref: 0.3, includeBias: false, uCal: 0.5 });
  assert.equal(r.includeBias, false);
  assert.equal(r.uBias, null, 'tat nhanh bias thi u(bias) phai vang mat');
  assert.equal(r.bias, null);
  assert.equal(r.uCref, null, 'tat nhanh bias thi u(Cref) khong duoc bao cao');
  assert.ok(!r.missing.includes('u(Cref)'), 'tat nhanh bias thi khong doi u(Cref)');
  near(r.uc, Math.sqrt(9 + 0.25), 'u_c chi con u(Rw) + u(cal)');
}

// 4) Bias chua danh gia: doi u(bias), va KHONG doi u(Cref) (khong co bias thi
//    ghep u(Cref) vao dau).
{
  const r = uncertaintyBudget({ cv: 3, uCal: 0.5 });
  assert.ok(r.missing.includes('u(bias)'));
  assert.ok(!r.missing.includes('u(Cref)'), 'chua co bias thi chua doi u(Cref)');
}

// 5) `uCal: 0` la KET LUAN hop le ("CoA noi khong dang ke"), khac han bo trong.
{
  const zero = uncertaintyBudget({ cv: 3, bias: 1.2, uCref: 0.3, uCal: 0, target: 5, tea: 15 });
  assert.equal(zero.uCal, 0);
  assert.ok(!zero.missing.includes('u(cal)'), 'uCal = 0 khong phai thieu');
  assert.equal(zero.complete, true);
  const blank = uncertaintyBudget({ cv: 3, bias: 1.2, uCref: 0.3, uCal: '' });
  assert.equal(blank.uCal, null);
  assert.ok(blank.missing.includes('u(cal)'));
}

// 6) Quy doi sang don vi xet nghiem + ti le U/TEa.
{
  const r = uncertaintyBudget({ cv: 2, bias: 1, uCref: 0, uCal: 0, tea: 10, target: 140 });
  near(r.uc, Math.sqrt(4 + 1), 'u_c');
  near(r.absoluteUc, (r.uc * 140) / 100, 'u_c tai Mean');
  near(r.absoluteU, (r.U * 140) / 100, 'U tai Mean');
  near(r.teaRatio, r.U / 10, 'U/TEa');
  assert.equal(r.withinTea, r.U <= 10);
}

// 7) k tuy chon.
near(uncertaintyBudget({ cv: 3, bias: 0, uCref: 0, uCal: 0, k: 3 }).U, 9, 'k = 3');

// 8) CV khong hop le thi khong co ngan sach nao — u(Rw) la thanh phan bat buoc.
for (const bad of [{ cv: 0 }, { cv: -1 }, { cv: 'x' }, {}]) {
  assert.equal(uncertaintyBudget(bad), null, `uncertaintyBudget(${JSON.stringify(bad)}) phai la null`);
}

console.log('app-v2 sigma-metrics oracle tests passed');
