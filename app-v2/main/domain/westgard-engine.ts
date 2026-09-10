// Bo may danh gia Westgard don muc + CUSUM - tham khao thuat toan tu
// src/domain/core/qc-core.ts (westgard/westgardByPoint/cusumScan) ban cu,
// viet lai nguyen ven logic (khong "don lai" cau truc de giam rui ro lech
// ket luan Westgard - xem canh bao goc o westgard-rules.ts). Danh gia
// Có cả đánh giá từng mức và liên mức theo cùng lần chạy. Phần liên mức giữ
// nguyên quy tắc của app cũ: R4s/2-2s/2of3-2s xét trong một run; các chuỗi
// 3-1s/4-1s/6x… đi theo thứ tự run rồi level.
import { WG_RUN_RULES, defaultRuleAction, wgScanRuns } from './westgard-rules';
import type { RuleAction } from './rule-config';
import { compareRunId } from './sort-order';

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

// Moi diem QC co the mang "snapshot" Mean/SD tai thoi diem nhap (qcMean/
// qcSd) - dung snapshot do thay vi Mean/SD hien hanh neu co, de lich su bieu
// do khong doi nguoc khi Mean/SD duoc cap nhat sau nay.
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

// Danh gia mot chuoi diem CUNG mot muc QC theo Mean/SD chung (mean/sd truyen
// vao) - dung khi moi diem co cung target, khong co snapshot per-point (xem
// westgardByPoint ben duoi cho truong hop moi diem mang snapshot rieng).
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
    else if (isOn('1-2s') && a > 2) set(i, 'warn', '1-2s');
    if (isOn('2of3-2s') && i >= 2) {
      const pos: number[] = [];
      const neg: number[] = [];
      for (let k = i - 2; k < i; k++) { if (zs[k] > 2) pos.push(k); if (zs[k] < -2) neg.push(k); }
      if (zs[i] > 2 && pos.length >= 1) { set(i, 'rej', '2of3-2s'); pos.forEach(k => support(k, '2of3-2s')); }
      if (zs[i] < -2 && neg.length >= 1) { set(i, 'rej', '2of3-2s'); neg.forEach(k => support(k, '2of3-2s')); }
    }
    if (isOn('7T') && i >= 7 && sameTrendTarget(points, i - 7, i)) {
      let inc = true;
      let dec = true;
      for (let k = i - 6; k <= i; k++) { if (!(zs[k] > zs[k - 1])) inc = false; if (!(zs[k] < zs[k - 1])) dec = false; }
      if (inc || dec) { set(i, 'warn', '7T'); for (let k = i - 7; k < i; k++) support(k, '7T'); }
    }
  }
  wgScanRuns(zs, WG_RUN_RULES, isOn, (idx, rule) => {
    const trigger = idx[idx.length - 1];
    set(trigger, 'rej', rule);
    idx.slice(0, -1).forEach(k => support(k, rule));
  });
  return { F, zs };
}

/** Port `acceptedLotPoints()` app cũ (`src/domain/qc/accepted-lot-points.ts`)
 * — CHUỖI ĐIỂM ĐƯỢC CHẤP NHẬN của 1 mức: đi lần lượt từng điểm, điểm nào
 * làm nổ luật LOẠI BỎ thì KHÔNG được vào chuỗi (và cũng không tính vào cửa
 * sổ để đánh giá các điểm sau) — nghĩa là 1 lần chạy bị loại không "làm
 * bẩn" chuỗi của những lần chạy sau.
 *
 * Dùng cho phần TRÌNH BÀY của trang Nhập QC (biểu đồ Levey-Jennings, số
 * điểm, thống kê Mean/SD/CV thực), đúng như app cũ. KHÔNG dùng cho Six
 * Sigma: mục "Confirmed business-logic decisions" của CLAUDE.md ghi rõ Sigma
 * phải dùng cohort IQC đã rà soát, không dùng helper trình bày này.
 *
 * Khác app cũ 1 chi tiết đã ghi rõ: app cũ hỏi `reject.has(rule)` theo bảng
 * hành động từng luật, app-v2 dùng `level === 'rej'` của chính engine (mô
 * hình rút gọn: hành động loại-bỏ/cảnh-báo nằm trong `WG_RULE_REGISTRY`).
 * Cửa sổ 11 điểm giữ nguyên như bản cũ. */
export function acceptedPoints<T extends QcPointLike>(
  points: readonly T[], mean: unknown, sd: unknown, isOn: (rule: string) => boolean = () => true,
  actionOf?: (rule: string) => RuleAction,
): T[] {
  const out: T[] = [];
  const window: T[] = [];
  for (const point of points || []) {
    const trial = [...window, point];
    const { F } = westgard(trial, mean, sd, isOn, actionOf);
    if (F[F.length - 1].level === 'rej') continue;
    out.push(point);
    window.push(point);
    if (window.length > 11) window.shift();
  }
  return out;
}

// Nhu westgard(), nhung moi diem dung snapshot Mean/SD rieng cua no (qua
// pointTarget) thay vi mot Mean/SD chung - dung khi hien thi lich su dai
// xuyen qua nhieu lan doi Mean/SD (Levey-Jennings that).
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

export interface MultiLevelSet<T extends QcPointLike = QcPointLike> { level: number; pts: readonly T[]; mean: unknown; sd: unknown }
export interface MultiWestgardResult<T extends QcPointLike = QcPointLike> extends Map<T, string[]> { support: Map<T, string[]> }

/** Luật Westgard liên mức, port từ app cũ's `westgardMultiByPoint()`. Mỗi
 * điểm dùng snapshot Mean/SD của chính nó; Map giữ tham chiếu điểm gốc để
 * caller ghép kết quả đơn mức và liên mức mà không dựa vào index toàn cục. */
export function westgardMultiByPoint<T extends QcPointLike>(levelSets: readonly MultiLevelSet<T>[], isOn: (rule: string) => boolean = () => true): MultiWestgardResult<T> {
  type Item = { p: T; z: number; level: number; run: string };
  const flags = new Map<T, string[]>() as MultiWestgardResult<T>;
  const support = new Map<T, string[]>(); flags.support = support;
  // Gộp trùng mức NGAY khi nạp (Map theo `level`, giá trị sau đè giá trị
  // trước — đúng ngữ nghĩa `new Map(items.map(i => [i.level, i]))` của bản
  // gốc, và Map giữ nguyên vị trí của lần đầu gặp key). Trước đây phép gộp
  // này chạy HAI lần cho mỗi lần chạy (một lần trong vòng lặp per-run, một
  // lần nữa khi dựng `seq`), tức 3 mảng + 2 Map rác cho mỗi lần chạy —
  // với 730 lần chạy × 50 xét nghiệm đó là phần chi phí lớn nhất của
  // `listTestSummaries()`. Kết quả trả về không đổi.
  const runs = new Map<string, Map<number, Item>>();
  for (const set of levelSets || []) for (const point of set.pts || []) {
    const z = pointZ(point, set.mean, set.sd); if (!Number.isFinite(z)) continue;
    const run = String(point.runId || point.date || '').slice(0, 120);
    let byLevel = runs.get(run);
    if (!byLevel) { byLevel = new Map<number, Item>(); runs.set(run, byLevel); }
    byLevel.set(set.level, { p: point, z, level: set.level, run });
  }
  const addRule = (map: Map<T, string[]>, point: T, rule: string) => { const list = map.get(point) || []; if (!list.includes(rule)) list.push(rule); map.set(point, list); };
  const add = (items: Item[], rule: string) => items.forEach((item) => addRule(flags, item.p, rule));
  const orderedRuns = [...runs.keys()].sort(compareRunId);
  for (const byLevel of runs.values()) {
    if (byLevel.size < 2) continue;
    const items = [...byLevel.values()];
    const pos2 = items.filter((item) => item.z > 2), neg2 = items.filter((item) => item.z < -2);
    if (isOn('R4s')) {
      const lo = items.reduce((a, b) => b.z < a.z ? b : a), hi = items.reduce((a, b) => b.z > a.z ? b : a);
      if (hi.z > 2 && lo.z < -2 && hi.z - lo.z > 4) add([lo, hi], 'R4s');
    }
    if (isOn('2-2s')) { if (pos2.length >= 2) add(pos2, '2-2s'); if (neg2.length >= 2) add(neg2, '2-2s'); }
    if (items.length >= 3) {
      if (isOn('2of3-2s')) { if (pos2.length >= 2) add(pos2, '2of3-2s'); if (neg2.length >= 2) add(neg2, '2of3-2s'); }
      if (isOn('3-1s')) { const pos1 = items.filter((item) => item.z > 1), neg1 = items.filter((item) => item.z < -1); if (pos1.length >= 3) add(pos1, '3-1s'); if (neg1.length >= 3) add(neg1, '3-1s'); }
    }
  }
  const seq = orderedRuns.flatMap((run) => [...(runs.get(run)?.values() ?? [])].sort((a, b) => a.level - b.level));
  wgScanRuns(seq.map((item) => item.z), WG_RUN_RULES.filter(([rule]) => rule !== '2-2s'), isOn, (indices, rule) => {
    const items = indices.map((index) => seq[index]), triggerRun = items.at(-1)?.run;
    for (const item of items) addRule(item.run === triggerRun ? flags : support, item.p, rule);
  });
  return flags;
}

export interface CombinedPointFlag extends PointFlag { z: number }

/** Ghép luật từng mức và luật liên mức thành một kết luận duy nhất cho mỗi
 * điểm, cùng mô hình `createActiveWestgard()` của app cũ. */
export function combinedWestgardByPoint<T extends QcPointLike>(
  levelSets: readonly MultiLevelSet<T>[], within: (rule: string) => boolean, across: (rule: string) => boolean,
  actionOf?: (rule: string) => RuleAction,
): Map<T, CombinedPointFlag> {
  const singles = levelSets.map((set) => ({ set, result: westgardByPoint(set.pts, set.mean, set.sd, within, actionOf) }));
  const cross = westgardMultiByPoint(levelSets, across);
  const out = new Map<T, CombinedPointFlag>();
  for (const { set, result } of singles) set.pts.forEach((point, index) => {
    const one = result.F[index] || { level: 'ok' as const, rules: [], supportRules: [] };
    const rules = [...new Set([...one.rules, ...(cross.get(point) || [])])];
    const supportRules = [...new Set([...one.supportRules, ...(cross.support.get(point) || [])])].filter((rule) => !rules.includes(rule));
    const level: RuleVerdict = rules.some((rule) => (actionOf?.(rule) || defaultRuleAction(rule, true)) === 'reject') ? 'rej' : rules.length ? 'warn' : 'ok';
    out.set(point, { level, rules, supportRules, z: result.zs[index] });
  });
  return out;
}

export interface CusumResult { cPos: number[]; cNeg: number[]; flags: RuleVerdict[]; k: number; h: number; ma?: number[] }

// Tabular CUSUM (hai phia) tren chuoi z-score chuan hoa qua pointZ - bat
// drift/shift nho keo dai ma rule don diem kho thay.
export function cusumScan(points: readonly QcPointLike[], mean: unknown, sd: unknown, k = 0.5, h = 4, maWindow = 0): CusumResult {
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
  (points || []).forEach(p => {
    const target = pointTarget(p, meanN, sdN);
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

export function cusum(points: readonly QcPointLike[], mean: unknown, sd: unknown, k = 0.5, h = 4): CusumResult {
  return cusumScan(points, mean, sd, k, h, 0);
}
