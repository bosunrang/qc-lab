// Oracle: xac nhan stats/pointTarget/pointZ/westgard/westgardByPoint/cusum
// moi cho ket qua GIONG HET ban cu (assets/core.js) tren nhieu kich ban khac
// nhau - dong vai tro "bo de kiem chung" thay the cho tests/qc-rules.test.js
// (va cac test lien quan) cua repo goc, tro vao module MOI.
// westgard-engine.ts import cheo toi westgard-rules.ts trong CUNG thu muc
// main/ - can chay qua ban DA BUILD (CommonJS), giong config-handlers.test.mjs
// (khong import thang .ts qua ESM type-stripping, xem ghi chu o do).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const QCCore = require('../../assets/core.js');
const {
  stats, pointTarget, pointZ, westgard, westgardByPoint, westgardMultiByPoint,
  combinedWestgardByPoint, cusum,
} = require('../../app-v2-dist/main/domain/westgard-engine.js');

// 1) stats()
{
  const values = [10, 10.2, 9.8, 10.1, 9.9, 10.3];
  const newR = stats(values);
  const oldR = QCCore.stats(values);
  assert.deepEqual(newR, oldR, 'stats() phai giong het ban cu');
  assert.equal(stats([]), null);
  assert.equal(QCCore.stats([]), null);
}

// 2) pointTarget()/pointZ() - co snapshot va khong co snapshot
{
  const withSnapshot = { val: 12, qcMean: 10, qcSd: 1 };
  const withoutSnapshot = { val: 12 };
  for (const p of [withSnapshot, withoutSnapshot]) {
    const newT = pointTarget(p, 11, 2);
    const oldT = QCCore.pointTarget(p, 11, 2);
    assert.deepEqual(newT, oldT, 'pointTarget() phai giong het ban cu cho ' + JSON.stringify(p));
    assert.equal(pointZ(p, 11, 2), QCCore.pointZ(p, 11, 2));
  }
  // sd <= 0 phai cho ra key rong / z = NaN o ca hai ban
  const badSd = pointTarget({ val: 5 }, 10, 0);
  const badSdOld = QCCore.pointTarget({ val: 5 }, 10, 0);
  assert.equal(badSd.key, '');
  assert.equal(badSdOld.key, '');
  assert.ok(Number.isNaN(badSd.z) && Number.isNaN(badSdOld.z));
}

// 3) westgard() - nhieu kich ban kich hoat luat khac nhau
function makePoints(vals) { return vals.map((v, i) => ({ val: v, runId: 'R' + i, date: '2026-08-' + String(i + 1).padStart(2, '0') })); }

const scenarios = [
  { name: '1-3s vuot xa', vals: [10, 10.1, 9.9, 14, 10.2] },       // z=4 tai i=3
  { name: '1-2s canh bao', vals: [10, 10.1, 9.9, 12.1, 10.2] },     // z=2.1
  { name: '2-2s hai diem lien tiep cung phia', vals: [10, 12.1, 12.2, 10] },
  { name: '4-1s bon diem lien tiep vuot 1SD', vals: [10, 11.1, 11.2, 11.3, 11.4, 10] },
  { name: '6x sau diem cung phia Mean', vals: [10, 10.3, 10.2, 10.4, 10.1, 10.2, 10.3, 10] },
  { name: '10x muoi diem cung phia', vals: [10, ...Array.from({ length: 10 }, (_, i) => 10.1 + i * 0.01), 10] },
  { name: 'binh thuong khong vi pham gi', vals: [10, 9.9, 10.1, 9.95, 10.05] },
];
for (const s of scenarios) {
  const points = makePoints(s.vals);
  const newR = westgard(points, 10, 1);
  const oldR = QCCore.westgard(points, 10, 1);
  assert.deepEqual(newR, oldR, `westgard() lech ban cu o kich ban "${s.name}": moi=${JSON.stringify(newR)} cu=${JSON.stringify(oldR)}`);
}

// 4) 7T - xu huong tang/giam 7 buoc lien tiep (can 8 diem, cung trendTarget)
{
  const trendPoints = Array.from({ length: 8 }, (_, i) => ({ val: 10 + i * 0.15, trendTarget: 'same' }));
  const newR = westgard(trendPoints, 10, 1);
  const oldR = QCCore.westgard(trendPoints, 10, 1);
  assert.deepEqual(newR, oldR, '7T scenario lech ban cu');
}

// 5) isOn tat mot so luat - phai giong het khi cung mot ham loc
{
  const points = makePoints([10, 12.1, 12.2, 10]);
  const isOn = (rule) => rule !== '2-2s';
  const newR = westgard(points, 10, 1, isOn);
  const oldR = QCCore.westgard(points, 10, 1, isOn);
  assert.deepEqual(newR, oldR, 'westgard() voi isOn tuy chinh phai giong het ban cu');
}

// 6) westgardByPoint() - snapshot rieng tung diem (doi Mean/SD giua chung)
{
  const points = [
    { val: 10, qcMean: 10, qcSd: 1 },
    { val: 10.1, qcMean: 10, qcSd: 1 },
    { val: 15, qcMean: 12, qcSd: 1 }, // doi target giua chung, z=3 nhung khong lien tuc voi truoc
  ];
  const newR = westgardByPoint(points, 10, 1);
  const oldR = QCCore.westgardByPoint(points, 10, 1);
  assert.deepEqual(newR, oldR, 'westgardByPoint() lech ban cu');
}

// 7) cusum() - kich ban drift dan
{
  const points = makePoints([10, 10.3, 10.6, 10.9, 11.2, 11.5, 11.8]);
  const newR = cusum(points, 10, 1, 0.5, 4);
  const oldR = QCCore.cusum(points, 10, 1, 0.5, 4);
  assert.deepEqual(newR, oldR, 'cusum() lech ban cu');
}

// 8) R4s liên mức: hai mức trái phía trong CÙNG run, chênh >4SD, phải gắn
// luật cho cả hai điểm. Khác run thì không được ghép nhầm.
{
  const hi = { val: 12.1, date: '2026-09-01', runId: '2026-09-01-1' };
  const lo = { val: 17.9, date: '2026-09-01', runId: '2026-09-01-1' };
  const otherRun = { val: 7.8, date: '2026-09-01', runId: '2026-09-01-2' };
  const multi = westgardMultiByPoint([
    { level: 1, pts: [hi], mean: 10, sd: 1 },
    { level: 2, pts: [lo], mean: 20, sd: 1 },
    { level: 3, pts: [otherRun], mean: 10, sd: 1 },
  ], (rule) => rule === 'R4s');
  assert.deepEqual(multi.get(hi), ['R4s']);
  assert.deepEqual(multi.get(lo), ['R4s']);
  assert.equal(multi.has(otherRun), false, 'không được ghép R4s giữa hai run khác nhau');
  const old = QCCore.westgardMultiByPoint([
    { level: 1, pts: [hi], mean: 10, sd: 1 },
    { level: 2, pts: [lo], mean: 20, sd: 1 },
    { level: 3, pts: [otherRun], mean: 10, sd: 1 },
  ], (rule) => rule === 'R4s');
  assert.deepEqual(multi, old, 'R4s liên mức phải khớp oracle app cũ');
}

// 9) 2-2s liên mức: hai mức cùng phía >+2SD trong cùng run đều bị loại.
{
  const a = { val: 12.1, date: '2026-09-02', runId: 'run-1' };
  const b = { val: 22.2, date: '2026-09-02', runId: 'run-1' };
  const combined = combinedWestgardByPoint([
    { level: 1, pts: [a], mean: 10, sd: 1 },
    { level: 2, pts: [b], mean: 20, sd: 1 },
  ], () => false, (rule) => rule === '2-2s');
  assert.equal(combined.get(a).level, 'rej');
  assert.equal(combined.get(b).level, 'rej');
  assert.deepEqual(combined.get(a).rules, ['2-2s']);
  assert.deepEqual(combined.get(b).rules, ['2-2s']);
  const old = QCCore.westgardMultiByPoint([
    { level: 1, pts: [a], mean: 10, sd: 1 },
    { level: 2, pts: [b], mean: 20, sd: 1 },
  ], (rule) => rule === '2-2s');
  assert.deepEqual(old.get(a), ['2-2s']);
  assert.deepEqual(old.get(b), ['2-2s']);
}

console.log('app-v2 westgard-engine oracle tests passed');
