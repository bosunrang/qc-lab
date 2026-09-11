// Bảng đăng ký luật Westgard — NGUỒN DUY NHẤT cho toàn app mới. Nội dung mô
// tả/gợi ý xử lý là dữ liệu lâm sàng tham khảo từ bản cũ
// (src/domain/core/qc-core.ts's WG_RULE_REGISTRY) — giữ nguyên vì đây là nội
// dung nghiệp vụ đúng, không phải kiến trúc cũ. Mọi danh sách dẫn xuất
// (WG_RULES, WG_DEFAULT_ON, WG_ALERT_RULES, WG_RULE_DESCRIPTIONS, thứ tự ưu
// tiên của primaryErrorRule, họ WG_RUN_RULES) đều tính từ bảng này — thêm
// một luật chỉ cần thêm một dòng, không sửa nhiều nơi.
export type RuleScope = 'within' | 'across' | 'both';
export const RULE_SCOPES: RuleScope[] = ['within', 'across', 'both'];

export type WgRunPredicate = readonly [n: number, pos: (z: number) => boolean, neg: (z: number) => boolean];

export interface WgRuleDef {
  readonly id: string;
  readonly desc: string;
  readonly err: 'SE' | 'RE' | '';
  readonly defaultOn: boolean;
  readonly alert: boolean;
  readonly scope: RuleScope;
  readonly scopeMin: number;
  readonly priority: number;
  readonly run: WgRunPredicate | null;
  readonly fix: string;
}

const REGISTRY: WgRuleDef[] = [
  { id: '1-2s', desc: '1 điểm QC vượt ±2SD', err: '', defaultOn: true, alert: true, scope: 'within', scopeMin: 2, priority: 13, run: null, fix: 'Theo dõi điểm kế tiếp, chưa loại bỏ nếu không kèm luật khác.' },
  { id: '1-3s', desc: '1 điểm QC vượt ±3SD', err: 'RE', defaultOn: true, alert: false, scope: 'within', scopeMin: 2, priority: 1, run: null, fix: 'Kiểm tra sai số ngẫu nhiên: thao tác, bọt khí, pipet, QC pha/bảo quản.' },
  { id: '2-2s', desc: '2 điểm liên tiếp hoặc 2 mức cùng lần chạy, cùng phía vượt ±2SD', err: 'SE', defaultOn: true, alert: false, scope: 'both', scopeMin: 2, priority: 3, run: [2, z => z > 2, z => z < -2], fix: 'Nghi sai số hệ thống: hiệu chuẩn, lô QC/hóa chất, nhiệt độ, máy.' },
  { id: 'R4s', desc: 'Cùng lần chạy có 1 mức > +2SD và 1 mức < -2SD, chênh nhau trên 4SD', err: 'RE', defaultOn: true, alert: false, scope: 'across', scopeMin: 2, priority: 2, run: null, fix: 'Nghi sai số ngẫu nhiên lớn: hút mẫu, bọt khí, thao tác, điện áp.' },
  { id: '3-1s', desc: '3 điểm liên tiếp hoặc 3 mức cùng phía vượt ±1SD', err: 'SE', defaultOn: false, alert: false, scope: 'across', scopeMin: 3, priority: 5, run: [3, z => z > 1, z => z < -1], fix: 'Nghi dịch chuyển hệ thống nhỏ; kiểm tra hiệu chuẩn và lô thuốc thử.' },
  { id: '4-1s', desc: '4 điểm liên tiếp cùng phía vượt ±1SD', err: 'SE', defaultOn: true, alert: false, scope: 'both', scopeMin: 2, priority: 6, run: [4, z => z > 1, z => z < -1], fix: 'Nghi lệch hệ thống nhẹ, kiểm tra xu hướng và hiệu chuẩn.' },
  { id: '6x', desc: '6 điểm liên tiếp nằm cùng một phía so với Mean', err: 'SE', defaultOn: true, alert: true, scope: 'across', scopeMin: 2, priority: 7, run: [6, z => z > 0, z => z < 0], fix: 'Phát hiện dịch chuyển sớm, khá nhạy khi gộp nhiều mức; xem lại Mean, hiệu chuẩn và lô mới. Có thể nâng thành loại bỏ theo SOP từng xét nghiệm.' },
  { id: '8x', desc: '8 điểm liên tiếp nằm cùng một phía so với Mean', err: 'SE', defaultOn: false, alert: false, scope: 'across', scopeMin: 2, priority: 8, run: [8, z => z > 0, z => z < 0], fix: 'Biến thể thường dùng khi chạy 2 hoặc 4 mức QC; nghi lệch hệ thống.' },
  { id: '9x', desc: '9 điểm liên tiếp nằm cùng một phía so với Mean', err: 'SE', defaultOn: false, alert: false, scope: 'across', scopeMin: 2, priority: 9, run: [9, z => z > 0, z => z < 0], fix: 'Biến thể phù hợp khi chạy 3 mức QC qua nhiều lần chạy.' },
  { id: '10x', desc: '10 điểm liên tiếp nằm cùng một phía so với Mean', err: 'SE', defaultOn: true, alert: false, scope: 'across', scopeMin: 2, priority: 10, run: [10, z => z > 0, z => z < 0], fix: 'Nghi dịch chuyển nền, xem lại Mean/SD, lô mới, hiệu chuẩn.' },
  { id: '12x', desc: '12 điểm liên tiếp nằm cùng một phía so với Mean', err: 'SE', defaultOn: false, alert: false, scope: 'across', scopeMin: 2, priority: 11, run: [12, z => z > 0, z => z < 0], fix: 'Biến thể ít nhạy hơn 8x/10x, dùng để theo dõi bias dài hơn.' },
  { id: '7T', desc: '7 điểm QC liên tiếp tăng dần hoặc giảm dần', err: 'SE', defaultOn: false, alert: true, scope: 'within', scopeMin: 2, priority: 12, run: null, fix: 'Theo dõi xu hướng, kiểm tra bảo quản QC, thuốc thử, môi trường.' },
  { id: '2of3-2s', desc: 'Trong 3 kết quả, có ít nhất 2 điểm cùng phía vượt ±2SD', err: 'SE', defaultOn: false, alert: false, scope: 'across', scopeMin: 3, priority: 4, run: null, fix: 'Nghi sai số hệ thống; đặc biệt hữu ích khi chạy 3 mức QC.' },
];
REGISTRY.forEach(r => { if (r.run) Object.freeze(r.run); Object.freeze(r); });
export const WG_RULE_REGISTRY: readonly WgRuleDef[] = Object.freeze(REGISTRY);

export const WG_RULE_BY_ID: Readonly<Record<string, WgRuleDef>> = Object.freeze(Object.fromEntries(WG_RULE_REGISTRY.map(r => [r.id, r])));
export const WG_RULES: readonly string[] = WG_RULE_REGISTRY.map(r => r.id);
export const WG_DEFAULT_ON: ReadonlySet<string> = new Set(WG_RULE_REGISTRY.filter(r => r.defaultOn).map(r => r.id));
export const WG_ALERT_RULES: readonly string[] = WG_RULE_REGISTRY.filter(r => r.alert).map(r => r.id);
export const WG_RULE_DESCRIPTIONS: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries(WG_RULE_REGISTRY.map(r => [r.id, r.desc])));
export const WG_RUN_RULES: readonly [string, number, (z: number) => boolean, (z: number) => boolean][] =
  WG_RULE_REGISTRY.filter(r => r.run).map(r => [r.id, r.run![0], r.run![1], r.run![2]]);

export function defaultRuleAction(ruleId: string, on: boolean): 'inactive' | 'alert' | 'reject' {
  if (!on) return 'inactive';
  const rule = WG_RULE_BY_ID[ruleId];
  return rule && rule.alert ? 'alert' : 'reject';
}

export function defaultRuleScope(ruleId: string, levelCount: number): RuleScope {
  const rule = WG_RULE_BY_ID[ruleId];
  if (!rule) return 'within';
  if (levelCount < rule.scopeMin) return 'within';
  return rule.scope;
}

export function primaryErrorRule(ruleIds: readonly string[]): string | null {
  const rows = ruleIds.map(id => WG_RULE_BY_ID[id]).filter((r): r is WgRuleDef => !!r);
  if (!rows.length) return null;
  return rows.slice().sort((a, b) => a.priority - b.priority)[0].id;
}

/** Loại sai số + mô tả luật CHÍNH. `type` theo `errorType()` (3 nhánh
 * SE/RE/'—', luật không phân loại như `1-2s` KHÔNG bị dán nhãn RE).
 *
 * `desc` lấy theo luật có `priority` NHỎ NHẤT — nhưng CHỈ trong số các luật
 * CÙNG loại sai số với `type`. App cũ (`errorTypeDetailParts()`) chọn primary
 * trên TOÀN BỘ danh sách, nên hai nửa có thể mô tả hai luật khác nhau: với
 * `['1-3s','2-2s']`, `errorType()` trả SE (vì 2-2s là SE) còn primary lại là
 * 1-3s (priority 1) — một luật RE. Bảng điểm khi đó in
 * "SE — Sai số hệ thống" kèm mô tả "1 điểm QC vượt ±3SD", tự mâu thuẫn.
 * Đây là lệch golden master CÓ CHỦ ĐÍCH; `errorType()` và `primaryErrorRule()`
 * giữ nguyên hợp đồng cũ nên mọi chỗ khác không đổi. */
export function errorTypeDetail(ruleIds: readonly string[]): { type: string; desc: string } {
  const type = errorType(ruleIds);
  if (type === '—') return { type, desc: '' };
  const wanted: 'SE' | 'RE' = type.startsWith('SE') ? 'SE' : 'RE';
  const sameClass = ruleIds.filter((id) => WG_RULE_BY_ID[id]?.err === wanted);
  const primary = primaryErrorRule(sameClass.length ? sameClass : ruleIds);
  return { type, desc: primary ? WG_RULE_DESCRIPTIONS[primary] || '' : '' };
}

export function errorType(ruleIds: readonly string[]): string {
  for (const id of ruleIds) {
    const rule = WG_RULE_BY_ID[id];
    if (rule && rule.err === 'SE') return 'SE — Sai số hệ thống';
  }
  for (const id of ruleIds) {
    const rule = WG_RULE_BY_ID[id];
    if (rule && rule.err === 'RE') return 'RE — Sai số ngẫu nhiên';
  }
  return '—';
}

/** Quét zs[]: mỗi rule bật, mọi cửa sổ N liên tiếp mà TẤT CẢ thỏa pos (hoặc
 * tất cả thỏa neg) → onHit(mảngChỉSố, tên luật). */
export function wgScanRuns(
  zs: readonly number[],
  rules: readonly [string, number, (z: number) => boolean, (z: number) => boolean][],
  isOn: (ruleId: string) => boolean,
  onHit: (idx: number[], ruleId: string) => void,
): void {
  rules.forEach(([rule, n, pos, neg]) => {
    if (!isOn(rule)) return;
    let posRun = 0, negRun = 0;
    for (let i = 0; i < zs.length; i++) {
      posRun = pos(zs[i]) ? posRun + 1 : 0;
      negRun = neg(zs[i]) ? negRun + 1 : 0;
      const run = Math.max(posRun, negRun);
      if (run === n) { const w: number[] = []; for (let k = i - n + 1; k <= i; k++) w.push(k); onHit(w, rule); }
      else if (run > n) onHit([i], rule);
    }
  });
}
