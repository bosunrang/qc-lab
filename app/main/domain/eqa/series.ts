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
  /** Khoá đợt; thiếu thì gom theo năm–số đợt–tên đợt. */
  roundId?: string;
  /** Chương trình ngoại kiểm: tín hiệu chỉ tính trong cùng một chương trình,
   * vì hai nhà cung cấp có cách đánh số đợt và mẫu riêng (N-06). */
  programId?: string;
  reportDate?: string;
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
  /** Đủ số ĐỢT để kết luận về xu hướng (N-07), tính trong chương trình của
   * đợt mới nhất. */
  enough: boolean;
  /** Số đợt của chương trình đó. */
  rounds: number;
  /** Số đợt và `enough` của từng chương trình — màn xem một chương trình phải
   * dùng số của chính chương trình đó, không phải của chương trình mới nhất. */
  programs: { programId: string; rounds: number; enough: boolean }[];
}

/** z làm tròn 2 chữ số như báo cáo, để so ngưỡng không lệch vì phần ẩn. */
const r2 = (z: number) => Math.round(z * 100) / 100;

/** Điểm J của một kết quả: 0/2/4/8 theo |z| < 1 / < 2 / < 3 / ≥ 3, mang dấu z. */
export function eqaJPoint(z: number): number {
  const a = Math.abs(r2(z));
  const p = a < 1 ? 0 : a < 2 ? 2 : a < 3 ? 4 : 8;
  return Math.sign(z) * p;
}

/** Thứ tự trong một chương trình: năm, số đợt, rồi ngày báo cáo (khi số đợt
 * trùng), tên đợt, mẫu. Số đợt luôn có, ngày báo cáo có thể trống. */
function seriesOrder(a: EqaSeriesInput, b: EqaSeriesInput): number {
  return a.year - b.year || a.roundNo - b.roundNo || (a.reportDate || '').localeCompare(b.reportDate || '')
    || a.round.localeCompare(b.round, 'vi') || a.sample.localeCompare(b.sample, 'vi', { numeric: true });
}
const roundKey = (point: EqaSeriesInput) => point.roundId || `${point.year}|${point.roundNo}|${point.round}`;
/** Thứ tự in tín hiệu, dùng chung cho chuỗi và danh sách "Cần chú ý". */
export const EQA_SIGNAL_ORDER: readonly EqaSignal[] = ['reject', 'two_of_three', 'six_same_side', 'j_score'];

/** Tín hiệu của một chương trình. Theo N-07 các luật xu hướng đếm ĐỢT, không
 * đếm mẫu (N-06): một đợt thường có 2–5 mẫu ở nồng độ khác nhau, đếm mẫu thì
 * "2/3" và "6 liên tiếp" nổ ngay trong một đợt. Điểm J và |z| ≥ 3 vẫn theo
 * từng kết quả. */
function programSeries(input: readonly EqaSeriesInput[], config: EqaConfig, series: EqaSeriesConfig): { points: EqaSeriesPoint[]; rounds: number } {
  const sorted = [...input].sort(seriesOrder);
  const points: EqaSeriesPoint[] = [];
  let cum = 0;
  for (const item of sorted) {
    const z = r2(item.z);
    const cls = eqaClass(z, config);
    const signals: EqaSignal[] = cls === 'rej' ? ['reject'] : [];
    // J cộng dồn: đổi dấu thì đặt lại; đạt ngưỡng thì báo rồi đặt lại.
    const jp = eqaJPoint(z);
    if (jp !== 0 && cum !== 0 && Math.sign(jp) !== Math.sign(cum)) cum = 0;
    cum += jp;
    const j = cum;
    if (Math.abs(cum) >= series.jLimit) { signals.push('j_score'); cum = 0; }
    points.push({ ...item, z, cls, j, signals, unsuccessful: false });
  }

  const rounds: { key: string; points: EqaSeriesPoint[] }[] = [];
  for (const point of points) {
    const last = rounds.at(-1);
    if (last && last.key === roundKey(point)) last.points.push(point);
    else rounds.push({ key: roundKey(point), points: [point] });
  }
  const beyond = (round: typeof rounds[number], sign: number) => round.points.some((p) => sign * p.z > config.zWarn);
  // Phía của một đợt: mọi mẫu cùng dấu; đợt có mẫu trái dấu hoặc z = 0 cắt chuỗi.
  const side = (round: typeof rounds[number]) => {
    const signs = new Set(round.points.map((p) => Math.sign(p.z)));
    return signs.size === 1 ? [...signs][0] : 0;
  };
  const rej = (round: typeof rounds[number]) => round.points.some((p) => p.cls === 'rej');
  rounds.forEach((round, i) => {
    const recent = rounds.slice(Math.max(0, i - 2), i + 1);
    // 2 trong 3 đợt gần nhất có mẫu vượt ±2 cùng phía, đợt này là một trong số đó.
    for (const sign of [1, -1]) {
      if (!beyond(round, sign) || recent.filter((r) => beyond(r, sign)).length < 2) continue;
      for (const p of round.points) if (sign * p.z > config.zWarn) p.signals.push('two_of_three');
    }
    // 6 đợt liên tiếp cùng phía.
    if (i >= 5) {
      const sides = rounds.slice(i - 5, i + 1).map(side);
      if (sides[0] !== 0 && sides.every((s) => s === sides[0])) for (const p of round.points) p.signals.push('six_same_side');
    }
    // "Không thành công" theo ĐỢT: đợt không chấp nhận khi có mẫu không chấp
    // nhận; không thành công khi đợt này không chấp nhận và (đợt liền trước
    // cũng vậy, hoặc ≥ 2 trong 3 đợt gần nhất).
    if (rej(round) && ((i > 0 && rej(rounds[i - 1])) || recent.filter(rej).length >= 2)) {
      for (const p of round.points) p.unsuccessful = true;
    }
  });
  for (const p of points) p.signals.sort((a, b) => EQA_SIGNAL_ORDER.indexOf(a) - EQA_SIGNAL_ORDER.indexOf(b));
  return { points, rounds: rounds.length };
}

export function eqaSeries(input: readonly EqaSeriesInput[], config: EqaConfig = EQA_DEFAULT_CONFIG, series: EqaSeriesConfig = EQA_SERIES_DEFAULTS): EqaSeriesResult {
  const byProgram = new Map<string, EqaSeriesInput[]>();
  for (const item of input) byProgram.set(item.programId ?? '', [...(byProgram.get(item.programId ?? '') ?? []), item]);
  const results = [...byProgram].map(([programId, items]) => ({ programId, ...programSeries(items, config, series) }));
  // Gộp lại theo thời gian để vẽ một biểu đồ; chương trình chỉ tách khi tính.
  const points = results.flatMap((r) => r.points)
    .sort((a, b) => seriesOrder(a, b) || (a.programId ?? '').localeCompare(b.programId ?? ''));
  const latest = points.at(-1);
  const rounds = latest ? results.find((r) => r.points.includes(latest))!.rounds : 0;
  return { points, enough: rounds >= series.minPoints, rounds,
    programs: results.map((r) => ({ programId: r.programId, rounds: r.rounds, enough: r.rounds >= series.minPoints })) };
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
