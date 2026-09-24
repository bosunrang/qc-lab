// Bảng đăng ký luật Westgard — nguồn duy nhất cho toàn ứng dụng. Mọi danh sách dẫn xuất
// (WG_RULES, WG_DEFAULT_ON, WG_ALERT_RULES, WG_RULE_DESCRIPTIONS, thứ tự ưu
// tiên của primaryErrorRule, họ WG_RUN_RULES) đều tính từ bảng này — thêm
// một luật chỉ cần thêm một dòng, không sửa nhiều nơi.
//
// `alert: true` = luật CHỈ cảnh báo, không loại điểm. Theo Westgard chỉ `1-2s`
// thuộc loại này; `6x`/`7T` là luật loại bỏ. Phòng xét nghiệm
// muốn hạ một luật xuống cảnh báo thì đặt ghi đè theo TỪNG xét nghiệm ở cột
// "Hành động" trong modal Danh mục xét nghiệm, không sửa mặc định ở đây.
//
// `scope` — CHÚ Ý thuật ngữ, dễ đọc ngược so với tài liệu Westgard:
//   `within` = trong TỪNG mức QC, qua nhiều lần chạy  ≈ Westgard "across runs"
//   `across` = chéo các mức QC trong CÙNG lần chạy    ≈ Westgard "across materials"
//
// Cả họ luật đếm chuỗi liên tiếp (`2-2s` `3-1s` `4-1s` `6x` `8x` `9x` `10x`
// `12x`) đều là `both`, vì định nghĩa chuẩn cho phép đếm theo CẢ HAI chiều:
// tức chiều cơ bản là qua nhiều lần chạy của cùng một mức, còn gộp mức là
// phần mở rộng — không phải phần thay thế. Vì vậy các luật chuỗi đều dùng
// `both`: một mức trôi dần một phía vẫn phải được phát hiện dù mức khác ổn
// định quanh Mean.
//
// Hai ngoại lệ CỐ Ý giữ nguyên:
//   `R4s`  — `across`: Westgard ghi rõ "should only be interpreted
//   `7T`   — `within`: xu hướng tăng/giảm đều chỉ có nghĩa trong cùng một
//            mức; gộp mức thì thứ tự M1/M2 tự tạo ra răng cưa giả.
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
  { id: '3-1s', desc: '3 điểm liên tiếp hoặc 3 mức cùng phía vượt ±1SD', err: 'SE', defaultOn: false, alert: false, scope: 'both', scopeMin: 3, priority: 5, run: [3, z => z > 1, z => z < -1], fix: 'Nghi dịch chuyển hệ thống nhỏ; kiểm tra hiệu chuẩn và lô thuốc thử.' },
  { id: '4-1s', desc: '4 điểm liên tiếp cùng phía vượt ±1SD', err: 'SE', defaultOn: true, alert: false, scope: 'both', scopeMin: 2, priority: 6, run: [4, z => z > 1, z => z < -1], fix: 'Nghi lệch hệ thống nhẹ, kiểm tra xu hướng và hiệu chuẩn.' },
  { id: '6x', desc: '6 điểm liên tiếp nằm cùng một phía so với Mean', err: 'SE', defaultOn: true, alert: false, scope: 'both', scopeMin: 2, priority: 7, run: [6, z => z > 0, z => z < 0], fix: 'Phát hiện dịch chuyển sớm, khá nhạy khi gộp nhiều mức; xem lại Mean, hiệu chuẩn và lô mới. Muốn chỉ cảnh báo thì hạ hành động xuống "Cảnh báo" cho từng xét nghiệm theo SOP.' },
  { id: '8x', desc: '8 điểm liên tiếp nằm cùng một phía so với Mean', err: 'SE', defaultOn: false, alert: false, scope: 'both', scopeMin: 2, priority: 8, run: [8, z => z > 0, z => z < 0], fix: 'Biến thể thường dùng khi chạy 2 hoặc 4 mức QC; nghi lệch hệ thống.' },
  { id: '9x', desc: '9 điểm liên tiếp nằm cùng một phía so với Mean', err: 'SE', defaultOn: false, alert: false, scope: 'both', scopeMin: 2, priority: 9, run: [9, z => z > 0, z => z < 0], fix: 'Biến thể phù hợp khi chạy 3 mức QC qua nhiều lần chạy.' },
  { id: '10x', desc: '10 điểm liên tiếp nằm cùng một phía so với Mean', err: 'SE', defaultOn: true, alert: false, scope: 'both', scopeMin: 2, priority: 10, run: [10, z => z > 0, z => z < 0], fix: 'Nghi dịch chuyển nền, xem lại Mean/SD, lô mới, hiệu chuẩn.' },
  { id: '12x', desc: '12 điểm liên tiếp nằm cùng một phía so với Mean', err: 'SE', defaultOn: false, alert: false, scope: 'both', scopeMin: 2, priority: 11, run: [12, z => z > 0, z => z < 0], fix: 'Biến thể ít nhạy hơn 8x/10x, dùng để theo dõi bias dài hơn.' },
  { id: '7T', desc: '7 điểm QC liên tiếp tăng dần hoặc giảm dần', err: 'SE', defaultOn: false, alert: false, scope: 'within', scopeMin: 2, priority: 12, run: null, fix: 'Kiểm tra bảo quản QC, thuốc thử, môi trường. Muốn chỉ cảnh báo thì hạ hành động xuống "Cảnh báo" cho từng xét nghiệm theo SOP.' },
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

/** Một số luật chỉ có một kênh đánh giá thật. Không cho UI/backup ghi một
 * scope không có engine tương ứng, vì nó sẽ biến luật đang bật thành im lặng. */
export function allowedRuleScopes(ruleId: string): readonly RuleScope[] {
  const scope = WG_RULE_BY_ID[ruleId]?.scope;
  return scope === 'both' ? RULE_SCOPES : scope ? [scope] : [];
}

/** Kiểm tra cả enum và kênh engine hỗ trợ; dùng chung ở lớp đọc backup và IPC
 * để không có đường ghi nào tạo scope "chết". */
export function isAllowedRuleScope(ruleId: string, scope: unknown): scope is RuleScope {
  return typeof scope === 'string' && RULE_SCOPES.includes(scope as RuleScope) && allowedRuleScopes(ruleId).includes(scope as RuleScope);
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
 * cùng loại sai số với `type`; điều này giúp nhãn và mô tả luôn nhất quán.
 * Với
 * `['1-3s','2-2s']`, `errorType()` trả SE (vì 2-2s là SE) còn primary lại là
 * 1-3s (priority 1) — một luật RE. Bảng điểm khi đó in
 * "SE — Sai số hệ thống" kèm mô tả của một luật RE sẽ tự mâu thuẫn. */
export function errorTypeDetail(ruleIds: readonly string[]): { type: string; desc: string } {
  const type = errorType(ruleIds);
  if (type === '—') return { type, desc: '' };
  const wanted: 'SE' | 'RE' = type.startsWith('SE') ? 'SE' : 'RE';
  const sameClass = ruleIds.filter((id) => WG_RULE_BY_ID[id]?.err === wanted);
  const primary = primaryErrorRule(sameClass.length ? sameClass : ruleIds);
  return { type, desc: primary ? WG_RULE_DESCRIPTIONS[primary] || '' : '' };
}

/** NHÃN HIỂN THỊ của từng loại sai số — nguồn duy nhất cho mọi bảng/biểu đồ.
 * Cột `actions.error_type` lưu MÃ (`SE`/`RE`/`''`), không lưu nhãn này. */
export const ERROR_CLASS_LABEL: Readonly<Record<'SE' | 'RE' | '', string>> = Object.freeze({
  SE: 'SE — Sai số hệ thống',
  RE: 'RE — Sai số ngẫu nhiên',
  '': '—',
});

export function errorType(ruleIds: readonly string[]): string {
  return ERROR_CLASS_LABEL[errorClass(ruleIds)];
}

/** Mã bền vững để lưu NCE. Chuỗi mô tả chỉ dùng khi hiển thị, không phải dữ
 * liệu lưu trữ. */
export function errorClass(ruleIds: readonly string[]): 'SE' | 'RE' | '' {
  for (const id of ruleIds) if (WG_RULE_BY_ID[id]?.err === 'SE') return 'SE';
  for (const id of ruleIds) if (WG_RULE_BY_ID[id]?.err === 'RE') return 'RE';
  return '';
}

/** Chuẩn hoá giá trị `actions.error_type` về mã lưu trữ. Nhận cả mã và nhãn
 * hiển thị để dữ liệu đã lưu luôn có thể được đọc nhất quán. */
export function normalizeErrorClass(value: unknown): 'SE' | 'RE' | '' {
  const text = String(value ?? '').trim().toUpperCase();
  if (text === 'SE' || text.startsWith('SE ') || text.includes('SAI SỐ HỆ THỐNG')) return 'SE';
  if (text === 'RE' || text.startsWith('RE ') || text.includes('SAI SỐ NGẪU NHIÊN')) return 'RE';
  return '';
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


