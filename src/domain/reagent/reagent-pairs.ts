export type ReagentPair = readonly unknown[] | null | undefined;

export function reagentValidPairs(rows: readonly ReagentPair[] | null | undefined) {
  const o: number[] = [], n: number[] = [];
  (rows || []).forEach(row => {
    const oldValue = Number.parseFloat(String(row?.[0] ?? '')), newValue = Number.parseFloat(String(row?.[1] ?? ''));
    if (!Number.isNaN(oldValue) && !Number.isNaN(newValue)) { o.push(oldValue); n.push(newValue); }
  });
  return { o, n };
}

export function reagentPairCalc(row: ReagentPair) {
  const oldValue = Number.parseFloat(String(row?.[0] ?? '')), newValue = Number.parseFloat(String(row?.[1] ?? ''));
  return Number.isFinite(oldValue) && Number.isFinite(newValue) ? { avg: (oldValue + newValue) / 2, dif: oldValue - newValue } : null;
}

export const reagentPairMath = Object.freeze({ validPairs: reagentValidPairs, pairCalc: reagentPairCalc });
