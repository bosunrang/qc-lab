export function entryPointContext(testId: unknown, level: unknown, lotNo: unknown, activeLot: unknown) {
  const parallel = !!lotNo && String(lotNo) !== String(activeLot || '');
  return { parallel, selection: { testId, level } };
}
