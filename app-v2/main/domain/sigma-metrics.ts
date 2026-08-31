// Toan hoc Six Sigma / do khong dam bao do (MU) - tham khao tu
// src/domain/core/qc-core.ts ban cu (sigmaMetric/uncertaintyBudget/erf/
// normalCdf/dpmoFromSigma), port nguyen ven thuat toan.
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  return sign * (1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax));
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function dpmoFromSigma(sigma: number): number {
  return Math.max(0, (1 - normalCdf(Number(sigma) - 1.5)) * 1e6);
}

export interface SigmaMetricResult { tea: number; bias: number; cv: number; sigma: number; dpmo: number; yieldPercent: number }

export function sigmaMetric(tea: unknown, bias: unknown, cv: unknown): SigmaMetricResult | null {
  const teaN = Number(tea);
  const biasN = Number(bias);
  const cvN = Number(cv);
  if (!Number.isFinite(teaN) || teaN <= 0 || !Number.isFinite(biasN) || !Number.isFinite(cvN) || cvN <= 0) return null;
  const sigma = (teaN - Math.abs(biasN)) / cvN;
  const dpmo = dpmoFromSigma(sigma);
  return { tea: teaN, bias: biasN, cv: cvN, sigma, dpmo, yieldPercent: 100 - dpmo / 1e4 };
}

export interface UncertaintyBudgetInput {
  cv?: unknown; k?: unknown; includeBias?: unknown; bias?: unknown; biasRefU?: unknown; uCal?: unknown;
  tea?: unknown; target?: unknown;
}

export interface UncertaintyBudgetResult {
  k: number; uRw: number; uBias: number | null; uCal: number | null; bias: number | null; biasRefU: number | null;
  includeBias: boolean; uc: number; U: number; shares: Record<string, number | null>; complete: boolean; missing: string[];
  target: number | null; absoluteUc: number | null; absoluteU: number | null;
  tea: number | null; teaRatio: number | null; withinTea: boolean | null;
}

// ISO 15189:2022 S7.3.4 - mo hinh TOP-DOWN (ISO/TS 20914; Nordtest TR 537).
// Hai diem KHONG duoc don gian hoa: (1) bat/tat nhanh bias la quyet dinh cua
// nguoi phu trach, khong tu chon; (2) thieu CoA thi u(cal) VANG MAT va ngan
// sach bi danh dau chua du, tuyet doi khong thay bang 0.
export function uncertaintyBudget(input: UncertaintyBudgetInput): UncertaintyBudgetResult | null {
  const o = input && typeof input === 'object' ? input : {};
  const pct = (v: unknown): number | null => {
    const n = Number(v);
    return String(v == null ? '' : v).trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const uRw = pct(o.cv);
  if (uRw == null || uRw <= 0) return null;
  const k = Number.isFinite(+(o.k as number)) && +(o.k as number) > 0 ? +(o.k as number) : 2;
  const includeBias = o.includeBias !== false;
  const biasRaw = Number(o.bias);
  const bias = String(o.bias == null ? '' : o.bias).trim() !== '' && Number.isFinite(biasRaw) ? Math.abs(biasRaw) : null;
  const biasRefU = pct(o.biasRefU);
  const uCal = pct(o.uCal);
  const uBias = includeBias && bias != null ? Math.sqrt(bias * bias + (biasRefU || 0) * (biasRefU || 0)) : null;
  const parts = Object.entries({ uRw, uBias, uCal }).filter(([, v]) => v != null && v > 0) as [string, number][];
  const variance = parts.reduce((s, [, v]) => s + v * v, 0);
  const uc = Math.sqrt(variance);
  const U = k * uc;
  const missing: string[] = [];
  if (includeBias && bias == null) missing.push('u(bias)');
  if (uCal == null) missing.push('u(cal)');
  const shares: Record<string, number | null> = Object.fromEntries(parts.map(([key, v]) => [key, variance > 0 ? (v * v) / variance : null]));
  const teaRaw = Number(o.tea);
  const tea = Number.isFinite(teaRaw) && teaRaw > 0 ? teaRaw : null;
  const targetRaw = Number(o.target);
  const target = Number.isFinite(targetRaw) && targetRaw !== 0 ? Math.abs(targetRaw) : null;
  return {
    k, uRw, uBias, uCal, bias: includeBias ? bias : null, biasRefU: includeBias ? biasRefU : null, includeBias,
    uc, U, shares, complete: !missing.length, missing,
    target, absoluteUc: target != null ? (uc * target) / 100 : null, absoluteU: target != null ? (U * target) / 100 : null,
    tea, teaRatio: tea != null ? U / tea : null, withinTea: tea != null ? U <= tea : null,
  };
}
