// Bộ máy đánh giá Westgard từng mức, liên mức và CUSUM. R4s/2-2s/2of3-2s
// được đánh giá trong cùng lần chạy; các luật chuỗi 3-1s/4-1s/6x… theo thứ tự
// lần chạy rồi đến mức QC.
import { WG_RUN_RULES, defaultRuleAction, wgScanRuns } from './westgard-rules';
import type { RuleAction } from './rule-config';
import { compareQcRunKey, qcRunKey } from './sort-order';

export interface StatsResult { n: number; m: number; sd: number; cv: number }

export function stats(values: readonly unknown[]): StatsResult | null {
  const vals = (values || []).map(Number).filter(Number.isFinite);
  const n = vals.length;
  if (!n) return null;
  const m = vals.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { n, m, sd, cv: m ? (sd / Math.abs(m)) * 100 : 0 };
}

export interface QcPointLike { val: unknown; qcMean?: unknown; qcSd?: unknown; runId?: unknown; date?: unknown; trendTarget?: unknown }

export interface PointTarget { mean: number; sd: number; key: string; z: number }

const KEY_SEP = String.fromCharCode(0);

export function pointTarget(point: QcPointLike | null | undefined, fallbackMean: unknown, fallbackSd: unknown): PointTarget {
  const savedMean = Number(point && point.qcMean);
  const savedSd = Number(point && point.qcSd);
  const hasSnapshot = Number.isFinite(savedMean) && Number.isFinite(savedSd) && savedSd > 0;
  const mean = hasSnapshot ? savedMean : Number(fallbackMean);
  const sd = hasSnapshot ? savedSd : Number(fallbackSd);
  const valid = Number.isFinite(mean) && Number.isFinite(sd) && sd > 0;
  const key = valid ? (String(mean) + KEY_SEP + String(sd)) : '';
  const z = key ? (Number(point && point.val) - mean) / sd : NaN;
  return { mean, sd, key, z };
}

export function pointZ(point: QcPointLike | null | undefined, fallbackMean: unknown, fallbackSd: unknown): number {
  return pointTarget(point, fallbackMean, fallbackSd).z;
}

function sameTrendTarget(points: readonly QcPointLike[], start: number, end: number): boolean {
  const first = points && points[start] && points[start].trendTarget;
  for (let i = start + 1; i <= end; i++) if ((points[i] && points[i].trendTarget) !== first) return false;
  return true;
}

export type RuleVerdict = 'ok' | 'warn' | 'rej';
export interface PointFlag { level: RuleVerdict; rules: string[]; supportRules: string[] }
export interface WestgardResult { F: PointFlag[]; zs: number[] }

export function westgard(
  points: readonly QcPointLike[], mean: unknown, sd: unknown,
  isOn: (rule: string) => boolean = () => true,
  actionOf?: (rule: string) => RuleAction,
): WestgardResult {
  const meanN = Number(mean);
  const sdN = Number(sd);
  if (!Number.isFinite(meanN) || !Number.isFinite(sdN) || sdN <= 0) {
    return { F: (points || []).map(() => ({ level: 'ok', rules: [], supportRules: [] })), zs: (points || []).map(() => NaN) };
  }
  const zs = (points || []).map(p => (Number(p.val) - meanN) / sdN);
  const F: PointFlag[] = zs.map(() => ({ level: 'ok', rules: [], supportRules: [] }));
  const order: Record<RuleVerdict, number> = { ok: 0, warn: 1, rej: 2 };
  const set = (i: number, l: RuleVerdict, r: string) => {
    if (i < 0 || i >= F.length) return;
    const action = actionOf?.(r);
    if (action === 'inactive') return;
    const resolved: RuleVerdict = action === 'alert' ? 'warn' : action === 'reject' ? 'rej' : l;
    if (!F[i].rules.includes(r)) F[i].rules.push(r);
    if (order[resolved] > order[F[i].level]) F[i].level = resolved;
  };
  const support = (i: number, r: string) => {
    if (i < 0 || i >= F.length || F[i].rules.includes(r)) return;
    if (!F[i].supportRules.includes(r)) F[i].supportRules.push(r);
  };
  for (let i = 0; i < zs.length; i++) {
    const a = Math.abs(zs[i]);
    if (isOn('1-3s') && a > 3) set(i, 'rej', '1-3s');
    // Giữ nhãn 1-3s gọn ở cấu hình thường, nhưng không để nó che một
    // hành động 1-2s nghiêm ngặt hơn do xét nghiệm ghi đè.
    if (isOn('1-2s') && a > 2 && (!F[i].rules.includes('1-3s') || (actionOf?.('1-2s') === 'reject' && F[i].level !== 'rej'))) set(i, 'warn', '1-2s');
    // 2of3-2s: "2 trong 3 kết quả cùng vượt một phía ±2SD" — quét CẢ cửa sổ
    // [i-2..i], KHÔNG đòi điểm hiện tại phải là một trong hai điểm vượt.
    // Cửa sổ được xét toàn bộ: không đòi điểm hiện tại phải là một trong hai
    // điểm vượt ngưỡng, nên [+2,1; +2,2; 0] vẫn được phát hiện.
    if (isOn('2of3-2s') && i >= 2 && sameTrendTarget(points, i - 2, i)) {
      const pos: number[] = [];
      const neg: number[] = [];
      for (let k = i - 2; k <= i; k++) { if (zs[k] > 2) pos.push(k); if (zs[k] < -2) neg.push(k); }
      // Điểm MỚI NHẤT TRONG SỐ CÁC ĐIỂM VƯỢT mang kết luận loại bỏ, các điểm
      // vượt còn lại là bằng chứng — cùng quy ước "điểm mới nhất mang kết
      // luận" mà `wgScanRuns()` dùng cho 2-2s/4-1s/10x…
      //
      // KHÔNG dùng điểm chốt cửa sổ (`i`) như bản trước: với cửa sổ
      // [+2,5; +2,5; 0,0] thì điểm z = 0 — một điểm ĐẠT — bị dán "Loại bỏ",
      // còn hai điểm thật sự vượt chỉ hiện là "bằng chứng"; `acceptedRunPoints()`
      // theo đó cũng loại nhầm lần chạy. Lý do biện hộ cũ ("`acceptedPoints()`
      // quét tăng dần chỉ đọc điểm mới nhất") đã hết hiệu lực: hàm đó là
      // `@deprecated` và chỉ còn test tham chiếu.
      const flag = (hits: readonly number[]) => {
        if (hits.length < 2) return;
        set(hits[hits.length - 1], 'rej', '2of3-2s');
        hits.slice(0, -1).forEach(k => support(k, '2of3-2s'));
      };
      flag(pos);
      flag(neg);
    }
    // 7T là bảy phép đo QC cùng chiều, tương ứng sáu bước liên tiếp.
    if (isOn('7T') && i >= 6 && sameTrendTarget(points, i - 6, i)) {
      let inc = true;
      let dec = true;
      for (let k = i - 5; k <= i; k++) { if (!(zs[k] > zs[k - 1])) inc = false; if (!(zs[k] < zs[k - 1])) dec = false; }
      // 'rej' khớp `defaultRuleAction('7T')` — mức độ mặc định CHỈ được khai ở
      // `WG_RULE_REGISTRY`; giá trị ở đây là nhánh dự phòng khi caller không
      // truyền `actionOf`, để nó nói khác registry là tự mâu thuẫn.
      if (inc || dec) { set(i, 'rej', '7T'); for (let k = i - 6; k < i; k++) support(k, '7T'); }
    }
  }
  // Chuỗi đếm (2-2s/4-1s/6x…) không được vượt qua mốc đổi Mean/SD.
  // `trendTarget` đã là snapshot của từng điểm nên lịch sử vẫn giữ nguyên,
  // chỉ quan hệ liên tiếp giữa hai baseline khác nhau bị chặn.
  for (let start = 0; start < points.length;) {
    const key = points[start]?.trendTarget || '';
    let end = start + 1;
    while (end < points.length && (points[end]?.trendTarget || '') === key) end++;
    wgScanRuns(zs.slice(start, end), WG_RUN_RULES, isOn, (idx, rule) => {
      const indices = idx.map(index => index + start), trigger = indices.at(-1)!;
      set(trigger, 'rej', rule);
      indices.slice(0, -1).forEach(k => support(k, rule));
    });
    start = end;
  }
  return { F, zs };
}

/** @deprecated Luồng vận hành dùng `acceptedRunPoints()` trên cùng kết luận
 * ghép với bảng, không đánh giá lại chuỗi đã lọc. Không dùng hàm này cho
 * thống kê hoặc biểu đồ mới.
 * Chuỗi điểm được chấp nhận của một mức: đi lần lượt từng điểm, điểm nào
 * làm nổ luật LOẠI BỎ thì KHÔNG được vào chuỗi (và cũng không tính vào cửa
 * sổ để đánh giá các điểm sau) — nghĩa là 1 lần chạy bị loại không "làm
 * bẩn" chuỗi của những lần chạy sau.
 *
 * Chỉ dùng cho phần trình bày của trang Nhập QC (biểu đồ Levey-Jennings, số
 * điểm, thống kê Mean/SD/CV thực), không dùng cho Six Sigma. Một điểm bị loại
 * khi engine kết luận `level === 'rej'`; cửa sổ đánh giá giữ tối đa 11 điểm.
 *
 * MỖI ĐIỂM DÙNG TARGET RIÊNG của nó (`pointTarget`, ưu tiên snapshot
 * `qc_mean`/`qc_sd` đã chốt lúc nhập) — KHÔNG phải Mean/SD hiện hành dùng
 * chung. Nhờ đó, khi Mean/SD của mức thay đổi, verdict, biểu đồ và thống kê
 * thực tế vẫn dùng cùng baseline của từng điểm. */
export function acceptedPoints<T extends QcPointLike>(
  points: readonly T[], mean: unknown, sd: unknown, isOn: (rule: string) => boolean = () => true,
  actionOf?: (rule: string) => RuleAction,
  /** Điểm đã bị một luật NGOÀI phạm vi chuỗi này loại (thực tế: luật LIÊN
   * MỨC, chỉ thấy được khi xét cả lần chạy). Bị loại khỏi chuỗi VÀ khỏi cửa
   * sổ đánh giá các điểm sau — cùng ngữ nghĩa "lần chạy bị loại thì chạy
   * lại, kết quả cũ không dùng" mà hàm này vốn áp cho luật từng mức. Thiếu
   * cổng này thì một điểm có thể vừa `verdict: 'rej'` vừa `accepted: true`. */
  rejectedOutside?: (point: T) => boolean,
): T[] {
  const out: T[] = [];
  // Cửa sổ giữ điểm ĐÃ CHUẨN HOÁ sang z (cùng cách `westgardByPoint` làm),
  // nên chạy luật trên thang z với mean=0/sd=1.
  const window: QcPointLike[] = [];
  for (const point of points || []) {
    if (rejectedOutside?.(point)) continue;
    const target = pointTarget(point, mean, sd);
    const normalized: QcPointLike = { val: target.z, trendTarget: target.key };
    const { F } = westgard([...window, normalized], 0, 1, isOn, actionOf);
    if (F[F.length - 1].level === 'rej') continue;
    out.push(point);
    window.push(normalized);
    if (window.length > 11) window.shift();
  }
  return out;
}

export function westgardByPoint(
  points: readonly QcPointLike[], mean: unknown, sd: unknown,
  isOn: (rule: string) => boolean = () => true,
  actionOf?: (rule: string) => RuleAction,
): WestgardResult {
  const normalized = (points || []).map(p => {
    const target = pointTarget(p, mean, sd);
    return { val: target.z, trendTarget: target.key };
  });
  return westgard(normalized, 0, 1, isOn, actionOf);
}

export interface MultiLevelSet<T extends QcPointLike = QcPointLike> {
  level: number;
  /** Phân biệt các lô song song cùng mức khi đọc lịch sử. */
  key?: string;
  pts: readonly T[];
  mean: unknown;
  sd: unknown;
}
export interface MultiWestgardResult<T extends QcPointLike = QcPointLike> extends Map<T, string[]> { support: Map<T, string[]> }

/** Luật Westgard liên mức. Mỗi điểm dùng snapshot Mean/SD của chính nó; Map giữ tham chiếu điểm gốc để
 * caller ghép kết quả đơn mức và liên mức mà không dựa vào index toàn cục. */
export function westgardMultiByPoint<T extends QcPointLike>(levelSets: readonly MultiLevelSet<T>[], isOn: (rule: string) => boolean = () => true): MultiWestgardResult<T> {
  type Item = { p: T; z: number; level: number; run: string; targetKey: string };
  const flags = new Map<T, string[]>() as MultiWestgardResult<T>;
  const support = new Map<T, string[]>(); flags.support = support;
  // Key theo material/lô, không chỉ số mức: nhóm lô lịch sử có thể chứa hai
  // lô M1. Đè một điểm bằng điểm sau làm mất bằng chứng liên mức.
  const runs = new Map<string, Map<string, Item>>();
  for (const set of levelSets || []) for (const point of set.pts || []) {
    const target = pointTarget(point, set.mean, set.sd), z = target.z; if (!Number.isFinite(z)) continue;
    const run = qcRunKey(point);
    let byMaterial = runs.get(run);
    if (!byMaterial) { byMaterial = new Map<string, Item>(); runs.set(run, byMaterial); }
    byMaterial.set(set.key || String(set.level), { p: point, z, level: set.level, run, targetKey: target.key });
  }
  const addRule = (map: Map<T, string[]>, point: T, rule: string) => { const list = map.get(point) || []; if (!list.includes(rule)) list.push(rule); map.set(point, list); };
  const add = (items: Item[], rule: string) => items.forEach((item) => addRule(flags, item.p, rule));
  const orderedRuns = [...runs.keys()].sort(compareQcRunKey);
  for (const byMaterial of runs.values()) {
    if (byMaterial.size < 2) continue;
    const items = [...byMaterial.values()];
    const pos2 = items.filter((item) => item.z > 2), neg2 = items.filter((item) => item.z < -2);
    if (isOn('R4s')) {
      const lo = items.reduce((a, b) => b.z < a.z ? b : a), hi = items.reduce((a, b) => b.z > a.z ? b : a);
      if (hi.z > 2 && lo.z < -2 && hi.z - lo.z > 4) add([lo, hi], 'R4s');
    }
    if (isOn('2-2s')) { if (pos2.length >= 2) add(pos2, '2-2s'); if (neg2.length >= 2) add(neg2, '2-2s'); }
    if (new Set(items.map(item => item.level)).size >= 3) {
      if (isOn('2of3-2s')) { if (pos2.length >= 2) add(pos2, '2of3-2s'); if (neg2.length >= 2) add(neg2, '2of3-2s'); }
      if (isOn('3-1s')) { const pos1 = items.filter((item) => item.z > 1), neg1 = items.filter((item) => item.z < -1); if (pos1.length >= 3) add(pos1, '3-1s'); if (neg1.length >= 3) add(neg1, '3-1s'); }
    }
  }
  let epoch = 0;
  const targetByLevel = new Map<number, string>();
  const seq: Array<Item & { epoch: number }> = [];
  for (const run of orderedRuns) {
    const items = [...(runs.get(run)?.values() ?? [])].sort((a, b) => a.level - b.level);
    let changedTarget = false;
    for (const item of items) {
      const prior = targetByLevel.get(item.level);
      if (prior !== undefined && prior !== item.targetKey) changedTarget = true;
      targetByLevel.set(item.level, item.targetKey);
    }
    if (changedTarget) epoch++;
    seq.push(...items.map(item => ({ ...item, epoch })));
  }
  for (let start = 0; start < seq.length;) {
    const currentEpoch = seq[start].epoch;
    let end = start + 1;
    while (end < seq.length && seq[end].epoch === currentEpoch) end++;
    wgScanRuns(seq.slice(start, end).map(item => item.z), WG_RUN_RULES.filter(([rule]) => rule !== '2-2s'), isOn, (indices, rule) => {
      const items = indices.map(index => seq[index + start]), triggerRun = items.at(-1)?.run;
      for (const item of items) addRule(item.run === triggerRun ? flags : support, item.p, rule);
    });
    start = end;
  }
  return flags;
}

export interface CombinedPointFlag extends PointFlag {
  z: number;
  /** Phần luật đến TỪ đánh giá liên mức (một lần chạy). Tách riêng khỏi
   * `rules` vì `acceptedPoints()` chỉ quét được luật từng mức — caller cần
   * biết luật nào nằm ngoài tầm nhìn đó để loại điểm cho đúng. */
  crossRules: string[];
}

/** Trong danh sách luật đã nổ, luật nào THỰC SỰ gây LOẠI BỎ sau khi áp hành
 * động ghi đè của phòng xét nghiệm. Phép phân giải giống hệt chỗ tính `level`
 * bên dưới — tách ra làm một hàm để nơi thứ hai (bảng nhập QC tách cột "Vi
 * phạm cảnh báo"/"Vi phạm loại bỏ") không dựng bản sao thứ hai của cùng một
 * quy tắc. Ví dụ điểm z=2,5 nổ `2-2s`: `rules` là `['1-2s','2-2s']` nhưng chỉ
 * `2-2s` là căn cứ loại bỏ, `1-2s` vẫn chỉ là cảnh báo. */
export function rejectingRules(rules: readonly string[], actionOf?: (rule: string) => RuleAction): string[] {
  return rules.filter((rule) => (actionOf?.(rule) || defaultRuleAction(rule, true)) === 'reject');
}

/** Ghép luật từng mức và liên mức thành một kết luận duy nhất cho mỗi điểm. */
export function combinedWestgardByPoint<T extends QcPointLike>(
  levelSets: readonly MultiLevelSet<T>[], within: (rule: string) => boolean, across: (rule: string) => boolean,
  actionOf?: (rule: string) => RuleAction,
  resetDates: readonly string[] = [],
): Map<T, CombinedPointFlag> {
  // Ngày hoàn thành khắc phục là ngày cuối của giai đoạn cũ. Không ghép
  // bằng chứng qua ranh giới này, và không thay đổi kết luận giai đoạn cũ.
  if (resetDates.length) {
    const cuts = [...new Set(resetDates)].sort();
    const epochs = new Map<number, MultiLevelSet<T>[]>();
    for (const set of levelSets) {
      const parts = new Map<number, T[]>();
      for (const point of set.pts) {
        const epoch = cuts.filter(date => date < String(point.date || '')).length;
        const pts = parts.get(epoch) || []; pts.push(point); parts.set(epoch, pts);
      }
      for (const [epoch, pts] of parts) {
        const sets = epochs.get(epoch) || []; sets.push({ ...set, pts }); epochs.set(epoch, sets);
      }
    }
    const merged = new Map<T, CombinedPointFlag>();
    for (const sets of epochs.values()) for (const [point, flag] of combinedWestgardByPoint(sets, within, across, actionOf)) merged.set(point, flag);
    return merged;
  }
  const singles = levelSets.map((set) => ({ set, result: westgardByPoint(set.pts, set.mean, set.sd, within, actionOf) }));
  const cross = westgardMultiByPoint(levelSets, across);
  const out = new Map<T, CombinedPointFlag>();
  for (const { set, result } of singles) set.pts.forEach((point, index) => {
    const one = result.F[index] || { level: 'ok' as const, rules: [], supportRules: [] };
    const crossRules = cross.get(point) || [];
    const rules = [...new Set([...one.rules, ...crossRules])];
    const supportRules = [...new Set([...one.supportRules, ...(cross.support.get(point) || [])])].filter((rule) => !rules.includes(rule));
    const level: RuleVerdict = rejectingRules(rules, actionOf).length ? 'rej' : rules.length ? 'warn' : 'ok';
    out.set(point, { level, rules, supportRules, crossRules: [...crossRules], z: result.zs[index] });
  });
  return out;
}

/** MỨC NÀO làm hỏng từng lần chạy — khoá `qcRunKey()`, giá trị là các mức có
 * điểm mang kết luận LOẠI BỎ trong lần chạy đó.
 *
 * `acceptedRunPoints()` loại CẢ lần chạy khi một mức bị loại, nhưng điểm của
 * những mức còn lại vẫn giữ verdict riêng của chúng ('Đạt'). Không có bản đồ
 * này thì màn hình chỉ nói được "Đạt" rồi lặng lẽ bỏ điểm đó khỏi n — người
 * dùng thấy 11 chấm xanh mà thống kê ghi n=9 và không có cách nào biết vì
 * sao. Tính ở đây, cạnh chính `acceptedRunPoints()`, để lý do và việc loại
 * không thể nói hai chuyện khác nhau. */
export function rejectedLevelsByRun<T extends QcPointLike>(
  levelSets: readonly MultiLevelSet<T>[],
  byPoint: ReadonlyMap<T, CombinedPointFlag>,
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  // Mức đọc từ TẬP MỨC chứ không từ điểm: hàng `qc_points` có cột `level`
  // nhưng nhiều nơi chỉ SELECT những cột cần vẽ, và chính `levelSets` mới là
  // thứ đã sinh ra `byPoint` — lấy cùng một nguồn thì không có đường lệch.
  for (const set of levelSets || []) for (const point of set.pts || []) {
    if (byPoint.get(point)?.level !== 'rej') continue;
    const key = qcRunKey(point);
    const levels = out.get(key) || [];
    if (!levels.includes(set.level)) levels.push(set.level);
    out.set(key, levels);
  }
  for (const levels of out.values()) levels.sort((a, b) => a - b);
  return out;
}

/** Tập thống kê dùng cùng kết luận với bảng; loại mọi mức của run bị loại.
 * Không tự tính lại luật trên một chuỗi đã lọc để nhận lại điểm bị reject. */
export function acceptedRunPoints<T extends QcPointLike>(byPoint: ReadonlyMap<T, CombinedPointFlag>): Set<T> {
  const excludedRuns = new Set<string>();
  for (const [point, flag] of byPoint) if (flag.level === 'rej') excludedRuns.add(qcRunKey(point));
  const accepted = new Set<T>();
  for (const [point, flag] of byPoint) {
    if (Number.isFinite(flag.z) && !excludedRuns.has(qcRunKey(point))) accepted.add(point);
  }
  return accepted;
}

export interface CusumResult { cPos: number[]; cNeg: number[]; flags: RuleVerdict[]; k: number; h: number; ma?: number[] }

export function cusumScan(
  points: readonly QcPointLike[], mean: unknown, sd: unknown, k = 0.5, h = 4, maWindow = 0,
  /** Trả `true` để ĐẶT LẠI C+/C− (và MA) NGAY TRƯỚC điểm này — dùng cho mốc
   * "sự cố đã khắc phục xong và được kết luận hiệu quả".
   *
   * Vì sao cần: thực hành CUSUM chuẩn đặt lại chuỗi cộng dồn sau khi tín hiệu
   * đã được điều tra và nguyên nhân bị loại bỏ. Không đặt lại thì C+ chỉ trôi
   * về 0,5 mỗi điểm, nên một đợt drift đã khắc phục xong vẫn kéo cờ thêm
   * nhiều điểm nữa — đo được: drift 8 điểm ở +1,5SD rồi trở lại hoàn toàn
   * bình thường vẫn để lại 8 điểm mang cờ. Đó đúng là lớp lỗi "đã khắc phục
   * xong vẫn đỏ mãi" mà trang Tổng quan đã tránh có chủ đích. */
  resetBefore?: (point: QcPointLike, index: number) => boolean,
): CusumResult {
  const meanN = Number(mean);
  const sdN = Number(sd);
  const kAbs = Math.abs(Number(k));
  const kFinal = Number.isFinite(kAbs) && kAbs > 0 ? kAbs : 0.5;
  const hAbs = Math.abs(Number(h));
  const hFinal = Number.isFinite(hAbs) && hAbs > 0 ? hAbs : 4;
  const window = maWindow ? Math.max(1, Math.round(Number(maWindow)) || 5) : 0;
  let cPos = 0;
  let cNeg = 0;
  let maSum = 0;
  let maCount = 0;
  const cPosArr: number[] = [];
  const cNegArr: number[] = [];
  const flags: RuleVerdict[] = [];
  const ma: number[] = [];
  const queue: number[] = [];
  let targetKey = '';
  (points || []).forEach((p, index) => {
    const target = pointTarget(p, meanN, sdN);
    if (resetBefore?.(p, index)) { cPos = 0; cNeg = 0; maSum = 0; maCount = 0; queue.length = 0; }
    // CUSUM chỉ có ý nghĩa trong một baseline ổn định. Điểm QC lưu snapshot
    // Mean/SD để bảo toàn lịch sử, nhưng không được phép mang phần cộng dồn
    // của dải CŨ sang dải MỚI (kể cả vẫn cùng lô QC). Reset cả C+/C− và MA.
    if (target.key !== targetKey) {
      cPos = 0; cNeg = 0; maSum = 0; maCount = 0; queue.length = 0;
      targetKey = target.key;
    }
    const z = target.z;
    if (Number.isFinite(z)) { cPos = Math.max(0, cPos + z - kFinal); cNeg = Math.min(0, cNeg + z + kFinal); }
    cPosArr.push(cPos);
    cNegArr.push(cNeg);
    flags.push(Number.isFinite(z) && (cPos >= hFinal || cNeg <= -hFinal) ? 'rej' : 'ok');
    if (window) {
      queue.push(z);
      if (Number.isFinite(z)) { maSum += z; maCount++; }
      if (queue.length > window) { const old = queue.shift() as number; if (Number.isFinite(old)) { maSum -= old; maCount--; } }
      ma.push(maCount ? maSum / maCount : NaN);
    }
  });
  return window ? { cPos: cPosArr, cNeg: cNegArr, flags, k: kFinal, h: hFinal, ma } : { cPos: cPosArr, cNeg: cNegArr, flags, k: kFinal, h: hFinal };
}

export function cusum(
  points: readonly QcPointLike[], mean: unknown, sd: unknown, k = 0.5, h = 4,
  resetBefore?: (point: QcPointLike, index: number) => boolean,
): CusumResult {
  return cusumScan(points, mean, sd, k, h, 0, resetBefore);
}


