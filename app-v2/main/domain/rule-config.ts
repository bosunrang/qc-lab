// Chính sách từng luật Westgard THEO TỪNG XÉT NGHIỆM. Cấu hình chung vẫn là
// boolean bật/tắt; ghi đè riêng xét nghiệm có đủ ba hành động như app cũ:
// không dùng / cảnh báo / loại bỏ. Boolean cũ vẫn được đọc để dữ liệu đã lưu
// trước khi nâng cấp không bị mất nghĩa.
import { WG_DEFAULT_ON, WG_RULES, WG_RULE_BY_ID, defaultRuleAction, defaultRuleScope, type RuleScope } from './westgard-rules';

export type RuleAction = 'inactive' | 'alert' | 'reject';
export type RuleActionsMap = Record<string, boolean | RuleAction>;

export function isRuleAction(value: unknown): value is RuleAction {
  return value === 'inactive' || value === 'alert' || value === 'reject';
}

export function parseRuleActions(json: string | null | undefined): RuleActionsMap {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: RuleActionsMap = {};
    for (const [ruleId, value] of Object.entries(parsed)) {
      if ((typeof value === 'boolean' || isRuleAction(value)) && WG_RULE_BY_ID[ruleId]) clean[ruleId] = value;
    }
    return clean;
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
    if (isRuleAction(override)) return override !== 'inactive';
    return typeof override === 'boolean' ? override : WG_DEFAULT_ON.has(ruleId);
  };
}

/** Phân giải luật ĐÚNG 2 TẦNG như app cũ (`resolveRuleAction(rule,
 * enabled(rule), test.ruleActions[rule])`):
 *   1. Ghi đè RIÊNG của xét nghiệm (`tests.rule_actions_json`) — chỉnh ở
 *      modal "Sửa xét nghiệm" của trang Cấu hình chung;
 *   2. Cấu hình CHUNG toàn phòng xét nghiệm (`app_meta.westgardRules`, app cũ
 *      là `state.westgardRules`) — chỉnh ở panel "Cấu hình chung của luật"
 *      trên trang Phân tích Westgard;
 *   3. Mặc định của `WG_RULE_REGISTRY` (`defaultOn`).
 * Trước đây app-v2 chỉ có tầng 1: checkbox trên trang Westgard ghi thẳng vào
 * `rule_actions_json` của RIÊNG xét nghiệm đang chọn, trong khi app cũ đổi
 * MẶC ĐỊNH CHO MỌI XÉT NGHIỆM — sai hẳn phạm vi tác động. */
export function makeIsOnLayered(globalRules: RuleActionsMap, overrides: RuleActionsMap): (ruleId: string) => boolean {
  const actionOf = makeRuleActionLayered(globalRules, overrides);
  return (ruleId: string) => actionOf(ruleId) !== 'inactive';
}

/** Phân giải đúng thứ tự app cũ: hành động riêng của xét nghiệm → trạng thái
 * chung → mặc định registry. `true` cũ mang hành động mặc định của luật. */
export function makeRuleActionLayered(globalRules: RuleActionsMap, overrides: RuleActionsMap): (ruleId: string) => RuleAction {
  return (ruleId: string) => {
    const override = overrides[ruleId];
    if (isRuleAction(override)) return override;
    if (typeof override === 'boolean') return defaultRuleAction(ruleId, override);
    const shared = globalRules[ruleId];
    if (isRuleAction(shared)) return shared;
    if (typeof shared === 'boolean') return defaultRuleAction(ruleId, shared);
    return defaultRuleAction(ruleId, WG_DEFAULT_ON.has(ruleId));
  };
}

export function effectiveRuleList(overrides: RuleActionsMap): { id: string; on: boolean }[] {
  const isOn = makeIsOn(overrides);
  return WG_RULES.map(id => ({ id, on: isOn(id) }));
}

/** Danh sách trạng thái luật CHUNG (không tính ghi đè theo xét nghiệm) — panel
 * "Cấu hình chung của luật" của trang Westgard hiển thị đúng tầng này. */
export function globalRuleList(globalRules: RuleActionsMap): { id: string; on: boolean }[] {
  return WG_RULES.map(id => ({
    id,
    on: typeof globalRules[id] === 'boolean' ? globalRules[id] : WG_DEFAULT_ON.has(id),
  }));
}

export type RuleScopesMap = Record<string, RuleScope>;

export function parseRuleScopes(json: string | null | undefined): RuleScopesMap {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: RuleScopesMap = {};
    for (const [ruleId, value] of Object.entries(parsed)) {
      // `protocol` từng xuất hiện trong backup app cũ nhưng có nghĩa là dùng
      // phạm vi SOP mặc định, nên không giữ nó như một scope thật.
      if (WG_RULE_BY_ID[ruleId] && (value === 'within' || value === 'across' || value === 'both')) clean[ruleId] = value;
    }
    return clean;
  } catch {
    return {};
  }
}

export function serializeRuleScopes(overrides: RuleScopesMap): string {
  return JSON.stringify(overrides);
}

/** Phạm vi áp dụng luật (within/across/both) theo xét nghiệm, ghi đè lên mặc
 * định `defaultRuleScope()` (phụ thuộc số mức đang vận hành). Entry và
 * Westgard dùng kết quả này để tách hai kênh đánh giá từng mức/liên mức. */
export function makeScopeOf(overrides: RuleScopesMap, levelCount: number): (ruleId: string) => RuleScope {
  return (ruleId: string) => overrides[ruleId] || defaultRuleScope(ruleId, levelCount);
}

export function effectiveScopeList(overrides: RuleScopesMap, levelCount: number): { id: string; scope: RuleScope; scopeMin: number; desc: string }[] {
  const scopeOf = makeScopeOf(overrides, levelCount);
  return WG_RULES.map(id => ({ id, scope: scopeOf(id), scopeMin: WG_RULE_BY_ID[id]?.scopeMin ?? 2, desc: WG_RULE_BY_ID[id]?.desc ?? '' }));
}
