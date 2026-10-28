// Theo dõi ngoại kiểm qua nhiều đợt của MỘT xét nghiệm (thông số trên một
// máy) — docs/EQA-REVIEW-2026-10-28.md, N-05..N-07. Hàm thuần, main gọi để
// dựng chuỗi; renderer chỉ trình bày.
//
// Tín hiệu là "cần xem xét", không tự gán kiểu sai số (H-04). Bộ tín hiệu thu
// gọn để hạn chế báo động giả trên hàng chục chuỗi (H-05); không dùng RSZ/SSZ
// làm tiêu chí vì RSZ có thể che hai z lớn trái dấu (RSC AMC TB16).
import { eqaAssignedLevel, eqaClass, type EqaClass, type EqaConfig, type EqaPeer, type EqaPeerLevel, EQA_DEFAULT_CONFIG } from './evaluation';

/** Giá trị tạm chờ SOP (EQA-REVIEW mục 6). */
export interface EqaSeriesConfig { jLimit: number; minPoints: number }
export const EQA_SERIES_DEFAULTS: EqaSeriesConfig = { jLimit: 8, minPoints: 6 };

export type EqaSignal = 'reject' | 'two_of_three' | 'six_same_side' | 'j_score';
export const EQA_SIGNAL_LABEL: Readonly<Record<EqaSignal, string>> = {
  reject: '|z| ≥ 3',
  two_of_three: '2/3 đợt |z| > 2 cùng phía',
  six_same_side: '6 đợt liên tiếp cùng phía',
  j_score: 'Điểm J cộng dồn đạt ngưỡng',
};

export interface EqaSeriesInput {
  /** Định danh kết quả (để ghép lại với dòng gốc). */
  id: string;
  year: number; roundNo: number; round: string; sample: string;
  /** z dùng đánh giá chính thức (của nhà cung cấp khi có). */
  z: number;
}

export interface EqaSeriesPoint extends EqaSeriesInput {
  cls: EqaClass;
  /** Điểm J cộng dồn sau điểm này (trước khi đặt lại vì đạt ngưỡng). */
  j: number;
  signals: EqaSignal[];
  /** Xét nghiệm "không thành công" tính tới đợt này (N-06). */
  unsuccessful: boolean;
}

export interface EqaSeriesResult {
  points: EqaSeriesPoint[];
  /** Đủ số điểm để kết luận về xu hướng (N-07). */
  enough: boolean;
}

/** z làm tròn 2 chữ số như báo cáo, để so ngưỡng không lệch vì phần ẩn. */
const r2 = (z: number) => Math.round(z * 100) / 100;

/** Điểm J của một kết quả: 0/2/4/8 theo |z| < 1 / < 2 / < 3 / ≥ 3, mang dấu z. */
export function eqaJPoint(z: number): number {
  const a = Math.abs(r2(z));
  const p = a < 1 ? 0 : a < 2 ? 2 : a < 3 ? 4 : 8;
  return Math.sign(z) * p;
}

function seriesOrder(a: EqaSeriesInput, b: EqaSeriesInput): number {
  return a.year - b.year || a.roundNo - b.roundNo || a.round.localeCompare(b.round, 'vi') || a.sample.localeCompare(b.sample, 'vi', { numeric: true });
}

export function eqaSeries(input: readonly EqaSeriesInput[], config: EqaConfig = EQA_DEFAULT_CONFIG, series: EqaSeriesConfig = EQA_SERIES_DEFAULTS): EqaSeriesResult {
  const sorted = [...input].sort(seriesOrder);
  const points: EqaSeriesPoint[] = [];
  let cum = 0;
  sorted.forEach((item, i) => {
    const z = r2(item.z);
    const cls = eqaClass(z, config);
    const signals: EqaSignal[] = [];
    if (cls === 'rej') signals.push('reject');
    // 2 trong 3 điểm gần nhất vượt ±2 cùng phía, điểm hiện tại là một trong số đó.
    const window = sorted.slice(Math.max(0, i - 2), i + 1).map((p) => r2(p.z));
    const beyond = (sign: number) => window.filter((v) => sign * v > config.zWarn).length;
    if (Math.abs(z) > config.zWarn && beyond(Math.sign(z)) >= 2) signals.push('two_of_three');
    // 6 điểm liên tiếp cùng phía (z = 0 cắt chuỗi).
    if (i >= 5) {
      const six = sorted.slice(i - 5, i + 1).map((p) => Math.sign(r2(p.z)));
      if (six[0] !== 0 && six.every((s) => s === six[0])) signals.push('six_same_side');
    }
    // J cộng dồn: đổi dấu thì đặt lại; đạt ngưỡng thì báo rồi đặt lại.
    const jp = eqaJPoint(z);
    if (jp !== 0 && cum !== 0 && Math.sign(jp) !== Math.sign(cum)) cum = 0;
    cum += jp;
    const j = cum;
    if (Math.abs(cum) >= series.jLimit) { signals.push('j_score'); cum = 0; }
    points.push({ ...item, z, cls, j, signals, unsuccessful: false });
  });

  // "Không thành công" theo ĐỢT (một đợt có thể có nhiều mẫu): đợt không chấp
  // nhận khi có mẫu không chấp nhận; không thành công khi đợt này không chấp
  // nhận và (đợt liền trước cũng vậy, hoặc ≥ 2 trong 3 đợt gần nhất).
  const rounds: { key: string; rej: boolean; points: EqaSeriesPoint[] }[] = [];
  for (const point of points) {
    const key = `${point.year}|${point.roundNo}|${point.round}`;
    const last = rounds.at(-1);
    if (last && last.key === key) { last.points.push(point); last.rej ||= point.cls === 'rej'; }
    else rounds.push({ key, rej: point.cls === 'rej', points: [point] });
  }
  rounds.forEach((round, i) => {
    if (!round.rej) return;
    const lastThree = rounds.slice(Math.max(0, i - 2), i + 1).filter((r) => r.rej).length;
    if ((i > 0 && rounds[i - 1].rej) || lastThree >= 2) round.points.forEach((p) => { p.unsuccessful = true; });
  });
  return { points, enough: points.length >= series.minPoints };
}

export interface EqaAssignedUncertainty {
  /** Nhóm so sánh có trung bình trùng giá trị ấn định. */
  level: EqaPeerLevel;
  n: number; u: number; ratio: number;
  /** u(x_pt) > 0,3·σ_pt: giá trị ấn định kém chắc chắn. */
  uncertain: boolean;
  /** z′ = (x − x_pt) / √(σ_pt² + u²(x_pt)), chỉ để tham khảo (N-05). */
  zPrime: number;
}

/** Ước lượng u(x_pt) ≈ 1,25·SD/√N của nhóm làm giá trị ấn định (trung bình
 * bền vững, ISO 13528). `null` khi không xác định được nhóm hoặc thiếu N/SD. */
export function eqaAssignedUncertainty(result: number, assigned: number, sigmaP: number, peer: EqaPeer): EqaAssignedUncertainty | null {
  if (!(sigmaP > 0)) return null;
  const level = eqaAssignedLevel(peer, assigned);
  const stats = level ? peer[level] : undefined;
  if (!level || !stats?.n || !stats.sd || stats.n < 1 || stats.sd <= 0) return null;
  const u = 1.25 * stats.sd / Math.sqrt(stats.n);
  const ratio = u / sigmaP;
  return { level, n: stats.n, u, ratio, uncertain: ratio > 0.3, zPrime: (result - assigned) / Math.sqrt(sigmaP ** 2 + u ** 2) };
}
