
export interface TargetFromLimits { low: number; high: number; mean: number; sd: number; k: number }
export interface LimitsFromTarget { mean: number; sd: number; low: number; high: number; k: number }

export function targetFromLimits(low: unknown, high: unknown, k = 2): TargetFromLimits | null {
  if (low == null || high == null || String(low).trim() === '' || String(high).trim() === '') return null;
  const lo = Number(low), hi = Number(high), kk = Number(k);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo || !Number.isFinite(kk) || kk <= 0) return null;
  return { low: lo, high: hi, mean: (lo + hi) / 2, sd: (hi - lo) / (2 * kk), k: kk };
}

export function limitsFromTarget(mean: unknown, sd: unknown, k = 2): LimitsFromTarget | null {
  if (mean == null || sd == null || String(mean).trim() === '' || String(sd).trim() === '') return null;
  const m = Number(mean), s = Number(sd), kk = Number(k);
  if (!Number.isFinite(m) || !Number.isFinite(s) || s <= 0 || !Number.isFinite(kk) || kk <= 0) return null;
  return { mean: m, sd: s, low: m - kk * s, high: m + kk * s, k: kk };
}

export interface NormalizedTargetPick { use: true; mean: number; sd: number; low: number | null; high: number | null }
export interface TargetPickError { error: string; message: string }


export function normalizeTargetPick(input: {
  meanRaw?: string; lowRaw?: string; highRaw?: string; sdRaw?: string; k?: number; deriveLimits?: boolean;
}): NormalizedTargetPick | TargetPickError {
  const meanRaw = String(input.meanRaw || '').trim();
  const lowRaw = String(input.lowRaw || '').trim();
  const highRaw = String(input.highRaw || '').trim();
  const sdRaw = String(input.sdRaw || '').trim();
  const k = input.k && input.k > 0 ? input.k : 2;

  let mean: number | null = meanRaw === '' ? null : parseFloat(meanRaw);
  let low: number | null = lowRaw === '' ? null : parseFloat(lowRaw);
  let high: number | null = highRaw === '' ? null : parseFloat(highRaw);
  let sd: number | null = sdRaw === '' ? null : parseFloat(sdRaw);

  const fromLimits = targetFromLimits(low, high, k);
  if (fromLimits) {
    if (mean == null || !Number.isFinite(mean)) mean = fromLimits.mean;
    if (sd == null || !Number.isFinite(sd) || sd <= 0) sd = fromLimits.sd;
  }
  const fromTarget = input.deriveLimits === false ? null : limitsFromTarget(mean, sd, k);
  if (fromTarget && lowRaw === '' && highRaw === '') { low = fromTarget.low; high = fromTarget.high; }

  if (mean == null || !Number.isFinite(mean)) {
    return { error: 'invalid-mean', message: 'Các xét nghiệm được chọn phải có trung bình mục tiêu hợp lệ.' };
  }
  if ((lowRaw !== '' && (low == null || !Number.isFinite(low))) || (highRaw !== '' && (high == null || !Number.isFinite(high)))) {
    return { error: 'invalid-limits', message: 'Giới hạn dưới/trên phải là số hợp lệ.' };
  }
  if ((lowRaw !== '' || highRaw !== '') && (low == null || high == null || !Number.isFinite(low) || !Number.isFinite(high) || high <= low)) {
    return {
      error: 'invalid-range',
      message: 'Nếu nhập giới hạn, cần nhập đủ giới hạn dưới và trên; giới hạn trên phải lớn hơn giới hạn dưới.',
    };
  }
  if (sdRaw !== '' && (sd == null || !Number.isFinite(sd) || sd <= 0)) {
    return { error: 'invalid-sd', message: 'Độ lệch chuẩn phải là số lớn hơn 0.' };
  }
  if ((sd == null || !Number.isFinite(sd)) && low != null && high != null && Number.isFinite(low) && Number.isFinite(high)) {
    sd = (high - low) / (2 * k);
  }
  if (sd == null || !Number.isFinite(sd) || sd <= 0) {
    return { error: 'missing-sd', message: 'Các xét nghiệm được chọn cần có SD, hoặc có đủ giới hạn dưới/trên để suy ra SD.' };
  }
  return { use: true, mean, sd, low, high };
}

/** In số theo số thập phân của xét nghiệm. */
export function targetNumberText(value: number | null | undefined, decimals: number): string {
  if (value == null || !Number.isFinite(value)) return '';
  return Number(value).toFixed(decimals);
}


export function syncTargetRange(el: HTMLInputElement, source: 'limits' | 'target'): void {
  const row = el.closest('.target-row');
  if (!row) return;
  const decimals = Number(row.getAttribute('data-decimals') || 2);
  const k = Number(row.getAttribute('data-k') || 2) || 2;
  const pick = (selector: string) => row.querySelector<HTMLInputElement>(selector);
  const read = (selector: string) => { const input = pick(selector); return input ? input.value.trim() : ''; };
  if (source === 'limits') {
    const result = targetFromLimits(read('.tm-low'), read('.tm-high'), k);
    if (!result) return;
    const mean = pick('.tm-mean'), sd = pick('.tm-sd');
    if (mean) mean.value = targetNumberText(result.mean, decimals);
    if (sd) sd.value = targetNumberText(result.sd, decimals);
  } else {
    const result = limitsFromTarget(read('.tm-mean'), read('.tm-sd'), k);
    if (!result) return;
    const low = pick('.tm-low'), high = pick('.tm-high');
    if (low) low.value = targetNumberText(result.low, decimals);
    if (high) high.value = targetNumberText(result.high, decimals);
  }
}


