type RecordValue = Record<string, any>;

export type ActionBiasServiceDeps = {
  teaFor: (test: RecordValue, level: RecordValue) => number | null;
  systematicShiftCritical: (tea: number, bias: number, sd: number) => RecordValue | null;
  sigmaBiasValue: (level: RecordValue) => number;
};

export function createActionBiasService({ teaFor, systematicShiftCritical, sigmaBiasValue }: ActionBiasServiceDeps) {
  function numberOrNull(value: unknown) { const raw = String(value == null ? '' : value).trim(), number = Number(raw); return raw !== '' && Number.isFinite(number) ? number : null; }
  function info(test: RecordValue | null | undefined, level: RecordValue | null | undefined, biasBeforeRaw: unknown, biasAfterRaw: unknown) {
    const teaValue = test && level ? teaFor(test, level) : null, hasTea = Number.isFinite(teaValue) && (teaValue as number) > 0;
    const biasBefore = numberOrNull(biasBeforeRaw), biasAfter = numberOrNull(biasAfterRaw), threshold = hasTea ? (teaValue as number) / 4 : null;
    const withinThreshold = threshold != null && biasAfter != null ? Math.abs(biasAfter) <= threshold : null;
    const critical = hasTea && biasBefore != null && level && level.sd > 0 ? systematicShiftCritical(teaValue as number, biasBefore, level.sd) : null;
    const observedDeviation = critical && level && level.sd > 0 ? Math.abs(biasBefore as number) / level.sd : null;
    return { tea: hasTea ? teaValue : null, biasBefore, biasAfter, threshold, withinThreshold, crit: critical, degObs: observedDeviation };
  }
  function latestSigmaBias(test: RecordValue | null | undefined, level: number | string, sigmaData: Record<string, RecordValue[]> | null | undefined) {
    const periods = test && sigmaData && Array.isArray(sigmaData[test.id]) ? sigmaData[test.id] : [];
    if (!periods.length || !level) return null;
    const latest = [...periods].sort((first, second) => String(first.period || '').localeCompare(String(second.period || ''))).pop();
    const entry = latest?.lv?.[level], value = entry ? Number(sigmaBiasValue(entry)) : NaN;
    return entry && Number.isFinite(value) ? { value, period: latest?.period || '' } : null;
  }
  return Object.freeze({ info, latestSigmaBias });
}

export type ActionBiasService = ReturnType<typeof createActionBiasService>;
