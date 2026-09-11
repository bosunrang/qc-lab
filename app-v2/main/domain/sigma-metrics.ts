// Toan hoc Six Sigma / do khong dam bao do (MU) - tham khao tu
// src/domain/core/qc-core.ts ban cu (sigmaMetric/uncertaintyBudget/erf/
// normalCdf/dpmoFromSigma), port nguyen ven thuat toan.
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  return sign * (1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax));
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function dpmoFromSigma(sigma: number): number {
  return Math.max(0, (1 - normalCdf(Number(sigma) - 1.5)) * 1e6);
}

export interface SigmaMetricResult { tea: number; bias: number; cv: number; sigma: number; dpmo: number; yieldPercent: number }

export interface SigmaQcDesign {
  /** `false` khi Sigma < 3: không có thiết kế QC nào hợp thức hoá được phương pháp. */
  capable: boolean;
  tier: '≥6' | '5–6' | '4–5' | '3–4' | '<3';
  /** Bảng nào được áp — 2 hoặc 3 mức QC. Hiện ra UI để người đọc biết căn cứ. */
  levels: 2 | 3;
  /** Số mức QC thật của xét nghiệm; khác `levels` khi có 1 mức (rơi về bảng 2
   * mức) hoặc ≥4 mức (rơi về bảng 3 mức) — Westgard chỉ công bố 2 bảng. */
  levelCount: number;
  rules: string[];
  /** N = tổng số phép đo QC mỗi lần chạy, R = số lần chạy trong ngày. */
  n: number;
  r: number;
  /** Phương án tương đương Westgard nêu kèm (vd N=2 R=2 thay cho N=4 R=1). */
  alternatives: { n: number; r: number; note?: string }[];
  risk: string;
  plan: string;
}

/** **Westgard Sigma Rules** — gợi ý thiết kế QC (OPSpecs). CHỈ là gợi ý: không
 * tự đổi cấu hình luật đang vận hành.
 *
 * Nguồn: https://www.westgard.com/lessons/westgard-rules/westgard-rules/westgard-sigma-rules.html
 * Westgard công bố HAI bảng khác nhau theo số mức QC, và chúng khác nhau cả ở
 * bộ luật lẫn ở N/R:
 *
 * | Sigma | 2 mức QC                          | 3 mức QC                                |
 * |-------|-----------------------------------|-----------------------------------------|
 * | ≥6    | 1-3s · N=2 R=1                    | 1-3s · N=3 R=1                          |
 * | 5–6   | 1-3s/2-2s/R4s · N=2 R=1           | 1-3s/2of3-2s/R4s · N=3 R=1              |
 * | 4–5   | +4-1s · N=4 R=1 (hoặc N=2 R=2)    | +3-1s · N=3 R=1                         |
 * | <4    | +8x · N=4 R=2 (hoặc N=2 R=4)      | +6x · N=6 R=1 (hoặc N=3 R=2); 9x thay 6x → N=3 R=3 |
 *
 * **Bản trước SAI, và sai giống hệt app cũ** (`QCCore.westgardSigmaRules()` —
 * cùng một bảng duy nhất, không phân biệt số mức), nên `cross-app` không thể
 * phát hiện: nó dùng MỘT bảng pha trộn hai bảng trên — thêm `4-1s` ở 5σ, thêm
 * `8x` ở 4σ, dùng `6x` (luật của bảng 3 mức) cho dưới 4σ, và N=8 ở 4σ/3σ
 * (con số không xuất hiện trong bảng nào của Westgard). Hệ quả: phòng xét
 * nghiệm chạy 3 mức nhận gợi ý của bảng 2 mức, và mọi tier từ 5σ xuống đều bị
 * đề nghị nhiều luật + nhiều điểm QC hơn Westgard thật sự khuyến nghị.
 *
 * `levelCount` là số mức QC thật của xét nghiệm trong kỳ đang xét. Westgard
 * chỉ công bố 2 bảng nên ≥3 mức dùng bảng 3 mức, còn lại dùng bảng 2 mức;
 * `levels` trả về cho biết bảng nào đã được áp. Thiếu `levelCount` thì giữ
 * bảng 2 mức — cấu hình phổ biến nhất, và là hành vi bảo toàn tương thích cho
 * caller cũ. */
export function sigmaQualityDesign(value: unknown, levelCount?: unknown): SigmaQcDesign | null {
  // `Number(null)`/`Number("")` ra 0 - huu han - nen ban cu (va app cu) tra ve
  // thiet ke tier `<3` cho mot Sigma CHUA TINH DUOC, tuc noi "phuong phap khong
  // du nang luc" khi that ra chi la thieu CV/Bias. Day la cau lam sang, khong
  // duoc suy tu du lieu trong.
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const sigma = Number(value);
  if (!Number.isFinite(sigma)) return null;
  const countRaw = Number(levelCount);
  const count = Number.isFinite(countRaw) && countRaw > 0 ? Math.trunc(countRaw) : 2;
  const levels: 2 | 3 = count >= 3 ? 3 : 2;
  const base = { levels, levelCount: count };

  if (levels === 3) {
    if (sigma >= 6) return { ...base, capable: true, tier: '≥6', rules: ['1-3s'], n: 3, r: 1, alternatives: [], risk: 'Thấp', plan: 'Một quy tắc là đủ. Vẫn thiết kế tần suất QC theo đánh giá nguy cơ, không tự động giảm.' };
    if (sigma >= 5) return { ...base, capable: true, tier: '5–6', rules: ['1-3s', '2of3-2s', 'R4s'], n: 3, r: 1, alternatives: [], risk: 'Thấp–trung bình', plan: 'Xác nhận bằng dữ liệu ổn định và SOP trước khi đơn giản hóa QC.' };
    if (sigma >= 4) return { ...base, capable: true, tier: '4–5', rules: ['1-3s', '2of3-2s', 'R4s', '3-1s'], n: 3, r: 1, alternatives: [], risk: 'Trung bình', plan: 'Đa quy tắc là bắt buộc; tăng giám sát theo nguy cơ lâm sàng.' };
    if (sigma >= 3) return { ...base, capable: true, tier: '3–4', rules: ['1-3s', '2of3-2s', 'R4s', '3-1s', '6x'], n: 6, r: 1, alternatives: [{ n: 3, r: 2 }, { n: 3, r: 3, note: 'dùng 9x thay 6x' }], risk: 'Cao', plan: 'Tăng số phép đo QC và ưu tiên cải thiện phương pháp.' };
    return { ...base, capable: false, tier: '<3', rules: ['1-3s', '2of3-2s', 'R4s', '3-1s', '6x'], n: 6, r: 1, alternatives: [{ n: 3, r: 2 }], risk: 'Rất cao', plan: 'Không dùng Sigma để hợp thức hóa vận hành; phải khắc phục phương pháp.' };
  }

  if (sigma >= 6) return { ...base, capable: true, tier: '≥6', rules: ['1-3s'], n: 2, r: 1, alternatives: [], risk: 'Thấp', plan: 'Một quy tắc là đủ. Vẫn thiết kế tần suất QC theo đánh giá nguy cơ, không tự động giảm.' };
  if (sigma >= 5) return { ...base, capable: true, tier: '5–6', rules: ['1-3s', '2-2s', 'R4s'], n: 2, r: 1, alternatives: [], risk: 'Thấp–trung bình', plan: 'Xác nhận bằng dữ liệu ổn định và SOP trước khi đơn giản hóa QC.' };
  if (sigma >= 4) return { ...base, capable: true, tier: '4–5', rules: ['1-3s', '2-2s', 'R4s', '4-1s'], n: 4, r: 1, alternatives: [{ n: 2, r: 2 }], risk: 'Trung bình', plan: 'Đa quy tắc là bắt buộc; tăng giám sát theo nguy cơ lâm sàng.' };
  if (sigma >= 3) return { ...base, capable: true, tier: '3–4', rules: ['1-3s', '2-2s', 'R4s', '4-1s', '8x'], n: 4, r: 2, alternatives: [{ n: 2, r: 4 }], risk: 'Cao', plan: 'Tăng số phép đo QC và ưu tiên cải thiện phương pháp.' };
  return { ...base, capable: false, tier: '<3', rules: ['1-3s', '2-2s', 'R4s', '4-1s', '8x'], n: 4, r: 2, alternatives: [{ n: 2, r: 4 }], risk: 'Rất cao', plan: 'Không dùng Sigma để hợp thức hóa vận hành; phải khắc phục phương pháp.' };
}

export function sigmaMetric(tea: unknown, bias: unknown, cv: unknown): SigmaMetricResult | null {
  const teaN = Number(tea);
  const biasN = Number(bias);
  const cvN = Number(cv);
  if (!Number.isFinite(teaN) || teaN <= 0 || !Number.isFinite(biasN) || !Number.isFinite(cvN) || cvN <= 0) return null;
  const sigma = (teaN - Math.abs(biasN)) / cvN;
  const dpmo = dpmoFromSigma(sigma);
  return { tea: teaN, bias: biasN, cv: cvN, sigma, dpmo, yieldPercent: 100 - dpmo / 1e4 };
}

export interface EqaRoundsStats { rms: number; mean: number; n: number; biasSem: number | null; mixedSigns: boolean }

/** Bias% từ nhiều vòng EQA/EQC — Sigma dùng RMS (root-mean-square) của các
 * vòng làm bias đại diện, KHÔNG dùng trung bình cộng có dấu: dấu trái nhau
 * (1 vòng +, 1 vòng -) có thể triệt tiêu lẫn nhau trong trung bình cộng
 * (chỉ mang tính tham khảo, trả về ở `mean`), che mất sai số hệ thống thật —
 * xem CLAUDE.md "Confirmed business-logic decisions" → mục Six Sigma.
 * `biasSem` = SD giữa các vòng / căn(n) — sai số chuẩn của CHÍNH ước lượng
 * bias của phòng xét nghiệm, null khi chỉ có 1 vòng. **Đây KHÔNG phải
 * u(Cref).** Nordtest TR 537 định nghĩa u(Cref) là độ không đảm bảo của
 * GIÁ TRỊ GÁN (chứng chỉ CRM: U(Cref)/2; kết quả EQA/PT theo ISO 13528:
 * U/2 của giá trị gán vòng đó) — một con số do nhà cung cấp công bố, không
 * suy được từ chuỗi bias của chính mình. App cũ gọi số này là
 * `referenceUncertainty` và nạp thẳng vào u(bias); app-v2 giữ nó lại như một
 * chỉ số THAM KHẢO (cho biết ước lượng bias ổn định tới đâu) và nhận u(Cref)
 * thật qua input riêng của `uncertaintyBudget()`. */
export function eqaRoundsStats(rounds: readonly unknown[]): EqaRoundsStats | null {
  const values = rounds.map(Number).filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  // MỘT vòng duy nhất giữ NGUYÊN DẤU của vòng đó (khớp `SigmaBiasService.stats()`
  // app cũ: `valid.length === 1 ? valid[0].bias : sqrt(...)`). Sigma và MU đều
  // lấy |bias| nên con số không đổi, nhưng bảng Bias EQA% phải cho thấy phương
  // pháp lệch về phía nào — `sqrt(v²)` sẽ biến −2% thành +2% và mất thông tin đó.
  // Từ 2 vòng trở lên mới dùng RMS, vì lúc đó dấu trái nhau có thể triệt tiêu.
  const rms = n === 1 ? values[0] : Math.sqrt(values.reduce((s, v) => s + v * v, 0) / n);
  const mixedSigns = values.some((v) => v > 0) && values.some((v) => v < 0);
  let biasSem: number | null = null;
  if (n > 1) {
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    biasSem = Math.sqrt(variance) / Math.sqrt(n);
  }
  return { rms, mean, n, biasSem, mixedSigns };
}

export interface UncertaintyBudgetInput {
  cv?: unknown; k?: unknown; includeBias?: unknown; bias?: unknown; uCref?: unknown; uCal?: unknown;
  tea?: unknown; target?: unknown;
}

export interface UncertaintyBudgetResult {
  k: number; uRw: number; uBias: number | null; uCal: number | null; bias: number | null; uCref: number | null;
  includeBias: boolean; uc: number; U: number; shares: Record<string, number | null>; complete: boolean; missing: string[];
  target: number | null; absoluteUc: number | null; absoluteU: number | null;
  tea: number | null; teaRatio: number | null; withinTea: boolean | null;
}

// ISO 15189:2022 §7.3.4 — mô hình TOP-DOWN.
//
// u_c = √(u(Rw)² + u(bias)² + u(cal)²), với u(bias) = √(bias² + u(Cref)²)
// (Nordtest TR 537) và U = k·u_c, k = 2.
//
// Đây là mô hình HỖN HỢP có chủ đích, không phải một chuẩn duy nhất:
//   - ISO/TS 20914 lấy u_c = √(u(Rw)² + u(cal)²) và yêu cầu bias phải được
//     HIỆU CHỈNH chứ không cộng vào ngân sách; nó cũng không hướng dẫn dùng
//     dữ liệu EQA cho MU.
//   - Nordtest TR 537 cộng u(bias) khi bias KHÔNG được hiệu chỉnh.
// Cờ `includeBias` chính là chỗ chọn giữa hai nhánh đó, và nó là quyết định
// của người phụ trách — phần mềm không tự chọn.
//
// Ba điểm KHÔNG được đơn giản hoá:
//   (1) bật/tắt nhánh bias là quyết định của người phụ trách;
//   (2) thiếu CoA thì u(cal) VẮNG MẶT và ngân sách bị đánh dấu chưa đủ —
//       tuyệt đối không thay bằng 0;
//   (3) u(Cref) là độ không đảm bảo của GIÁ TRỊ GÁN do nhà cung cấp EQA/CRM
//       công bố (U(Cref)/2, hoặc U/2 của giá trị gán PT theo ISO 13528).
//       KHÔNG được suy nó từ SD của chuỗi bias quan sát — đó là sai số chuẩn
//       của ước lượng bias, một đại lượng khác hẳn (xem `eqaRoundsStats()`).
//       Chưa có thì cũng vắng mặt, không đọc là 0.
export function uncertaintyBudget(input: UncertaintyBudgetInput): UncertaintyBudgetResult | null {
  const o = input && typeof input === 'object' ? input : {};
  const pct = (v: unknown): number | null => {
    const n = Number(v);
    return String(v == null ? '' : v).trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const uRw = pct(o.cv);
  if (uRw == null || uRw <= 0) return null;
  const k = Number.isFinite(+(o.k as number)) && +(o.k as number) > 0 ? +(o.k as number) : 2;
  const includeBias = o.includeBias !== false;
  const biasRaw = Number(o.bias);
  const bias = String(o.bias == null ? '' : o.bias).trim() !== '' && Number.isFinite(biasRaw) ? Math.abs(biasRaw) : null;
  const uCref = pct(o.uCref);
  const uCal = pct(o.uCal);
  const uBias = includeBias && bias != null ? Math.sqrt(bias * bias + (uCref || 0) * (uCref || 0)) : null;
  const parts = Object.entries({ uRw, uBias, uCal }).filter(([, v]) => v != null && v > 0) as [string, number][];
  const variance = parts.reduce((s, [, v]) => s + v * v, 0);
  const uc = Math.sqrt(variance);
  const U = k * uc;
  const missing: string[] = [];
  if (includeBias && bias == null) missing.push('u(bias)');
  // u(Cref) chỉ có nghĩa khi nhánh bias được cộng vào ngân sách; ở chế độ
  // ISO/TS 20914 (bias đã hiệu chỉnh) thì không đòi.
  if (includeBias && bias != null && uCref == null) missing.push('u(Cref)');
  if (uCal == null) missing.push('u(cal)');
  const shares: Record<string, number | null> = Object.fromEntries(parts.map(([key, v]) => [key, variance > 0 ? (v * v) / variance : null]));
  const teaRaw = Number(o.tea);
  const tea = Number.isFinite(teaRaw) && teaRaw > 0 ? teaRaw : null;
  const targetRaw = Number(o.target);
  const target = Number.isFinite(targetRaw) && targetRaw !== 0 ? Math.abs(targetRaw) : null;
  return {
    k, uRw, uBias, uCal, bias: includeBias ? bias : null, uCref: includeBias ? uCref : null, includeBias,
    uc, U, shares, complete: !missing.length, missing,
    target, absoluteUc: target != null ? (uc * target) / 100 : null, absoluteU: target != null ? (U * target) / 100 : null,
    tea, teaRatio: tea != null ? U / tea : null, withinTea: tea != null ? U <= tea : null,
  };
}
