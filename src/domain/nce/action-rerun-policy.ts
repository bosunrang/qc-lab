export function openedFromVoid(action: Record<string, any> | null | undefined, point: Record<string, any> | null | undefined): boolean {
  return !!(action && point && point.voided
    && (action.openedFromVoid === true || (point.voidedAt && action.createdAt && point.voidedAt === action.createdAt)));
}

export function rerunGateDate(action: Record<string, any> | null | undefined, point: Record<string, any> | null | undefined): string {
  const gates = [String(point?.date || '')];
  if (action && Number(action.protocolVersion) >= 3 && action.actionCompletedDate && !openedFromVoid(action, point)) {
    gates.push(String(action.actionCompletedDate));
  }
  if (action?.parentNceId && action.date) gates.push(String(action.date));
  return gates.filter(Boolean).sort().pop() || '';
}

export const nceActionRerunPolicy = Object.freeze({ openedFromVoid, rerunGateDate });
export type NceActionRerunPolicy = typeof nceActionRerunPolicy;
