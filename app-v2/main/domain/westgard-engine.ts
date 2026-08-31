// Bo may danh gia Westgard don muc + CUSUM - tham khao thuat toan tu
// src/domain/core/qc-core.ts (westgard/westgardByPoint/cusumScan) ban cu,
// viet lai nguyen ven logic (khong "don lai" cau truc de giam rui ro lech
// ket luan Westgard - xem canh bao goc o westgard-rules.ts). Danh gia
// nhieu muc cheo lo (westgardMulti, R4s cheo muc) CHUA port o buoc nay -
// module thi diem Entry chi can don muc truoc.
import { WG_RUN_RULES, wgScanRuns } from './westgard-rules';

export interface StatsResult { n: number; m: number; sd: number; cv: number }

export function stats(values: readonly unknown[]): StatsResult | null {
  const vals = (values || []).map(Number).filter(Number.isFinite);
  const n = vals.length;
  if (!n) return null;
  const m = vals.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { n, m, sd, cv: m ? (sd / Math.abs(m)) * 100 : 0 };
}

export interface QcPointLike { val: unknown; qcMean?: unknown; qcSd?: unknown; runId?: unknown; date?: unknown; trendTarget?: unknown }

export interface PointTarget { mean: number; sd: number; key: string; z: number }

const KEY_SEP = String.fromCharCode(0);

// Moi diem QC co the mang "snapshot" Mean/SD tai thoi diem nhap (qcMean/
// qcSd) - dung snapshot do thay vi Mean/SD hien hanh neu co, de lich su bieu
// do khong doi nguoc khi Mean/SD duoc cap nhat sau nay.
export function pointTarget(point: QcPointLike | null | undefined, fallbackMean: unknown, fallbackSd: unknown): PointTarget {
  const savedMean = Number(point && point.qcMean);
  const savedSd = Number(point && point.qcSd);
  const hasSnapshot = Number.isFinite(savedMean) && Number.isFinite(savedSd) && savedSd > 0;
  const mean = hasSnapshot ? savedMean : Number(fallbackMean);
  const sd = hasSnapshot ? savedSd : Number(fallbackSd);
  const valid = Number.isFinite(mean) && Number.isFinite(sd) && sd > 0;
  const key = valid ? (String(mean) + KEY_SEP + String(sd)) : '';
  const z = key ? (Number(point && point.val) - mean) / sd : NaN;
  return { mean, sd, key, z };
}

export function pointZ(point: QcPointLike | null | undefined, fallbackMean: unknown, fallbackSd: unknown): number {
  return pointTarget(point, fallbackMean, fallbackSd).z;
}

function sameTrendTarget(points: readonly QcPointLike[], start: number, end: number): boolean {
  const first = points && points[start] && points[start].trendTarget;
  for (let i = start + 1; i <= end; i++) if ((points[i] && points[i].trendTarget) !== first) return false;
  return true;
}

export type RuleVerdict = 'ok' | 'warn' | 'rej';
export interface PointFlag { level: RuleVerdict; rules: string[]; supportRules: string[] }
export interface WestgardResult { F: PointFlag[]; zs: number[] }

// Danh gia mot chuoi diem CUNG mot muc QC theo Mean/SD chung (mean/sd truyen
// vao) - dung khi moi diem co cung target, khong co snapshot per-point (xem
// westgardByPoint ben duoi cho truong hop moi diem mang snapshot rieng).
export function westgard(points: readonly QcPointLike[], mean: unknown, sd: unknown, isOn: (rule: string) => boolean = () => true): WestgardResult {
  const meanN = Number(mean);
  const sdN = Number(sd);
  if (!Number.isFinite(meanN) || !Number.isFinite(sdN) || sdN <= 0) {
    return { F: (points || []).map(() => ({ level: 'ok', rules: [], supportRules: [] })), zs: (points || []).map(() => NaN) };
  }
  const zs = (points || []).map(p => (Number(p.val) - meanN) / sdN);
  const F: PointFlag[] = zs.map(() => ({ level: 'ok', rules: [], supportRules: [] }));
  const order: Record<RuleVerdict, number> = { ok: 0, warn: 1, rej: 2 };
  const set = (i: number, l: RuleVerdict, r: string) => {
    if (i < 0 || i >= F.length) return;
    if (!F[i].rules.includes(r)) F[i].rules.push(r);
    if (order[l] > order[F[i].level]) F[i].level = l;
  };
  const support = (i: number, r: string) => {
    if (i < 0 || i >= F.length || F[i].rules.includes(r)) return;
    if (!F[i].supportRules.includes(r)) F[i].supportRules.push(r);
  };
  for (let i = 0; i < zs.length; i++) {
    const a = Math.abs(zs[i]);
    if (isOn('1-3s') && a > 3) set(i, 'rej', '1-3s');
    else if (isOn('1-2s') && a > 2) set(i, 'warn', '1-2s');
    if (isOn('2of3-2s') && i >= 2) {
      const pos: number[] = [];
      const neg: number[] = [];
      for (let k = i - 2; k < i; k++) { if (zs[k] > 2) pos.push(k); if (zs[k] < -2) neg.push(k); }
      if (zs[i] > 2 && pos.length >= 1) { set(i, 'rej', '2of3-2s'); pos.forEach(k => support(k, '2of3-2s')); }
      if (zs[i] < -2 && neg.length >= 1) { set(i, 'rej', '2of3-2s'); neg.forEach(k => support(k, '2of3-2s')); }
    }
    if (isOn('7T') && i >= 7 && sameTrendTarget(points, i - 7, i)) {
      let inc = true;
      let dec = true;
      for (let k = i - 6; k <= i; k++) { if (!(zs[k] > zs[k - 1])) inc = false; if (!(zs[k] < zs[k - 1])) dec = false; }
      if (inc || dec) { set(i, 'warn', '7T'); for (let k = i - 7; k < i; k++) support(k, '7T'); }
    }
  }
  wgScanRuns(zs, WG_RUN_RULES, isOn, (idx, rule) => {
    const trigger = idx[idx.length - 1];
    set(trigger, 'rej', rule);
    idx.slice(0, -1).forEach(k => support(k, rule));
  });
  return { F, zs };
}

// Nhu westgard(), nhung moi diem dung snapshot Mean/SD rieng cua no (qua
// pointTarget) thay vi mot Mean/SD chung - dung khi hien thi lich su dai
// xuyen qua nhieu lan doi Mean/SD (Levey-Jennings that).
export function westgardByPoint(points: readonly QcPointLike[], mean: unknown, sd: unknown, isOn: (rule: string) => boolean = () => true): WestgardResult {
  const normalized = (points || []).map(p => {
    const target = pointTarget(p, mean, sd);
    return { val: target.z, trendTarget: target.key };
  });
  return westgard(normalized, 0, 1, isOn);
}

export interface CusumResult { cPos: number[]; cNeg: number[]; flags: RuleVerdict[]; k: number; h: number; ma?: number[] }

// Tabular CUSUM (hai phia) tren chuoi z-score chuan hoa qua pointZ - bat
// drift/shift nho keo dai ma rule don diem kho thay.
export function cusumScan(points: readonly QcPointLike[], mean: unknown, sd: unknown, k = 0.5, h = 4, maWindow = 0): CusumResult {
  const meanN = Number(mean);
  const sdN = Number(sd);
  const kAbs = Math.abs(Number(k));
  const kFinal = Number.isFinite(kAbs) && kAbs > 0 ? kAbs : 0.5;
  const hAbs = Math.abs(Number(h));
  const hFinal = Number.isFinite(hAbs) && hAbs > 0 ? hAbs : 4;
  const window = maWindow ? Math.max(1, Math.round(Number(maWindow)) || 5) : 0;
  let cPos = 0;
  let cNeg = 0;
  let maSum = 0;
  let maCount = 0;
  const cPosArr: number[] = [];
  const cNegArr: number[] = [];
  const flags: RuleVerdict[] = [];
  const ma: number[] = [];
  const queue: number[] = [];
  (points || []).forEach(p => {
    const z = pointZ(p, meanN, sdN);
    if (Number.isFinite(z)) { cPos = Math.max(0, cPos + z - kFinal); cNeg = Math.min(0, cNeg + z + kFinal); }
    cPosArr.push(cPos);
    cNegArr.push(cNeg);
    flags.push(Number.isFinite(z) && (cPos >= hFinal || cNeg <= -hFinal) ? 'rej' : 'ok');
    if (window) {
      queue.push(z);
      if (Number.isFinite(z)) { maSum += z; maCount++; }
      if (queue.length > window) { const old = queue.shift() as number; if (Number.isFinite(old)) { maSum -= old; maCount--; } }
      ma.push(maCount ? maSum / maCount : NaN);
    }
  });
  return window ? { cPos: cPosArr, cNeg: cNegArr, flags, k: kFinal, h: hFinal, ma } : { cPos: cPosArr, cNeg: cNegArr, flags, k: kFinal, h: hFinal };
}

export function cusum(points: readonly QcPointLike[], mean: unknown, sd: unknown, k = 0.5, h = 4): CusumResult {
  return cusumScan(points, mean, sd, k, h, 0);
}
