export type RangeBiasCritical = { dSEcrit: number; dREcrit: number } | null | undefined;

export type RangeBiasEvaluation = {
  threshold: number | null;
  valid: boolean;
  withinThreshold: boolean;
  critical: RangeBiasCritical;
};

export function rangeBiasEvaluation(
  tea: unknown,
  bias: unknown,
  sd: unknown,
  systematicShiftCritical?: (tea: number, bias: number, sd: unknown) => RangeBiasCritical,
): RangeBiasEvaluation {
  const teaValue = Number(tea), biasValue = Number(bias);
  const threshold = Number.isFinite(teaValue) && teaValue > 0 ? teaValue / 4 : null;
  const valid = Number.isFinite(biasValue);
  return {
    threshold,
    valid,
    withinThreshold: threshold !== null && valid && Math.abs(biasValue) <= threshold,
    critical: threshold !== null && valid && systematicShiftCritical
      ? systematicShiftCritical(teaValue, biasValue, sd) : null,
  };
}

export function rangeSafetyGate(nce: any, tea: unknown, causeConfirmed: unknown, bias: unknown) {
  if (!nce) return { needed: false, threshold: null, passes: true };
  const evaluation = rangeBiasEvaluation(tea, bias, null);
  return { needed: true, threshold: evaluation.threshold, passes: !!causeConfirmed && evaluation.withinThreshold };
}
