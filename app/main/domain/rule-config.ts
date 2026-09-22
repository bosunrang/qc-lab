// Chính sách từng luật Westgard THEO TỪNG XÉT NGHIỆM. Cấu hình chung vẫn là
// boolean bật/tắt; ghi đè riêng xét nghiệm có đủ ba hành động như app cũ:
// không dùng / cảnh báo / loại bỏ. Boolean cũ vẫn được đọc để dữ liệu đã lưu
// trước khi nâng cấp không bị mất nghĩa.
import { WG_DEFAULT_ON, WG_RULES, WG_RULE_BY_ID, allowedRuleScopes, defaultRuleAction, defaultRuleScope, isAllowedRuleScope, type RuleScope } from './westgard-rules';

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

/** Phân giải luật ĐÚNG 2 TẦNG như app cũ (`resolveRuleAction(rule,
 * enabled(rule), test.ruleActions[rule])`):
 *   1. Ghi đè RIÊNG của xét nghiệm (`tests.rule_actions_json`) — chỉnh ở
 *      modal "Sửa xét nghiệm" của trang Cấu hình chung;
 *   2. Cấu hình CHUNG toàn phòng xét nghiệm (`app_meta.westgardRules`, app cũ
 *      là `state.westgardRules`) — chỉnh ở panel "Cấu hình chung của luật"
 *      trên trang Phân tích Westgard;
 *   3. Mặc định của `WG_RULE_REGISTRY` (`defaultOn`).
 * Trước đây app chỉ có tầng 1: checkbox trên trang Westgard ghi thẳng vào
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

/** Danh sách trạng thái luật CHUNG (không tính ghi đè theo xét nghiệm) — panel
 * "Cấu hình chung của luật" của trang Westgard hiển thị đúng tầng này. */
export function globalRuleList(globalRules: RuleActionsMap): { id: string; on: boolean }[] {
  const actionOf = makeRuleActionLayered(globalRules, {});
  return WG_RULES.map(id => ({
    id,
    on: actionOf(id) !== 'inactive',
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
      if (WG_RULE_BY_ID[ruleId] && isAllowedRuleScope(ruleId, value)) clean[ruleId] = value;
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
  return (ruleId: string) => {
    const override = overrides[ruleId];
    return isAllowedRuleScope(ruleId, override) ? override : defaultRuleScope(ruleId, levelCount);
  };
}

/** Trạng thái HIỆU LỰC của từng luật cho MỘT xét nghiệm, kèm giá trị mà ô
 * "để trống" thực sự rơi về — `defaultScope` (phạm vi khuyến nghị theo số mức
 * đang vận hành) và `defaultAction` (hành động theo cấu hình chung toàn phòng
 * xét nghiệm).
 *
 * Hai trường `default*` tồn tại vì modal "Sửa xét nghiệm" trước đây chỉ ghi
 * "Phạm vi SOP khuyến nghị"/"Theo cấu hình chung" mà không nói khuyến nghị đó
 * LÀ GÌ — người dùng không có màn hình nào đọc ra được luật đang chạy phạm vi
 * nào. Đó chính là lý do `6x` chạy sai phạm vi một thời gian dài mà không ai
 * thấy (xem mục 3.4 `docs/APP-V2-PLAN.md`). */
export function effectiveRuleConfigList(
  overrides: RuleScopesMap, levelCount: number, globalRules: RuleActionsMap = {}, actionOverrides: RuleActionsMap = {},
): { id: string; scope: RuleScope; scopeMin: number; desc: string; allowedScopes: readonly RuleScope[]; defaultScope: RuleScope; defaultAction: RuleAction; action: RuleAction }[] {
  const scopeOf = makeScopeOf(overrides, levelCount);
  // `defaultAction` = phân giải KHI xét nghiệm không có ghi đè riêng, nên
  // truyền `{}` ở tham số overrides — đúng thứ ô "Theo cấu hình chung" hứa.
  const defaultActionOf = makeRuleActionLayered(globalRules, {});
  const actionOf = makeRuleActionLayered(globalRules, actionOverrides);
  return WG_RULES.map(id => ({
    id,
    scope: scopeOf(id),
    scopeMin: WG_RULE_BY_ID[id]?.scopeMin ?? 2,
    desc: WG_RULE_BY_ID[id]?.desc ?? '',
    allowedScopes: allowedRuleScopes(id),
    defaultScope: defaultRuleScope(id, levelCount),
    defaultAction: defaultActionOf(id),
    action: actionOf(id),
  }));
}
