export function actionRerunCacheKey(action: Record<string, any> | null | undefined, decimalPlaces: unknown): string {
  const value = action || {};
  return [
    value.id, value.testId, value.pointId, Number(value.protocolVersion) || 0,
    value.actionCompletedDate || '', value.parentNceId || '', value.date || '', value.openedFromVoid ? 1 : 0,
    decimalPlaces != null ? decimalPlaces : 'auto',
  ].join('|');
}

export const nceActionRerunCacheKey = Object.freeze({ actionRerunCacheKey });
export type NceActionRerunCacheKey = typeof nceActionRerunCacheKey;
