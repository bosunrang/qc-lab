// Bat/tat tung luat Westgard THEO TUNG XET NGHIEM - tham khao
// resolveRuleAction/defaultRuleAction cua ban cu nhung rut gon: app moi giai
// doan nay chi can bat/tat (khong phan biet 'alert' rieng 'reject', khong co
// scope within/across da muc - de danh cho khi lam da muc/cheo lo).
import { WG_DEFAULT_ON, WG_RULES } from './westgard-rules';

export type RuleActionsMap = Record<string, boolean>;

export function parseRuleActions(json: string | null | undefined): RuleActionsMap {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function serializeRuleActions(overrides: RuleActionsMap): string {
  return JSON.stringify(overrides);
}

/** Tra ve ham isOn(ruleId) dung cho westgard()/cusumScan - moi luat mac dinh
 * theo WG_DEFAULT_ON, tru khi xet nghiem tu ghi de qua overrides. */
export function makeIsOn(overrides: RuleActionsMap): (ruleId: string) => boolean {
  return (ruleId: string) => {
    const override = overrides[ruleId];
    return typeof override === 'boolean' ? override : WG_DEFAULT_ON.has(ruleId);
  };
}

export function effectiveRuleList(overrides: RuleActionsMap): { id: string; on: boolean }[] {
  const isOn = makeIsOn(overrides);
  return WG_RULES.map(id => ({ id, on: isOn(id) }));
}
