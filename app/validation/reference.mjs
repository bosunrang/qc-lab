// Bộ tính THAM CHIẾU cho thẩm định — viết lại từ định nghĩa, KHÔNG import mã
// của app. Dùng để kiểm lại các đáp án số ghi trong `cases.mjs` (phát hiện lỗi
// khi soạn ca), không dùng để chấm app: app được chấm bằng đáp án tường minh.
//
// Nguồn định nghĩa:
// - Mean, SD mẫu (mẫu số n − 1), CV = SD / |Mean| × 100; Z = (x − Mean) / SD.
// - Chỉ số Sigma = (TEa − |Bias|) / CV (theo Westgard, "Six Sigma quality design").
// - DPMO theo quy ước dịch chuyển 1,5σ: (1 − Φ(σ − 1,5)) × 10^6.
// - Bias nhiều vòng EQA cho Sigma: trung bình có dấu; RMS chỉ cho ngân sách MU,
//   theo quyết định SB-1 ở docs/SIGMA-REVIEW-2026-11-17.md.
// - TEa CLIA dạng tuyệt đối: TEa% = |giới hạn / Mean| × 100; tiêu chí "lớn hơn
//   giữa" lấy số lớn hơn của giới hạn % và giới hạn tuyệt đối đã quy đổi.
// - Độ không đảm bảo đo theo Nordtest TR 537: u(bias) = √(Bias_RMS² + u(Cref)²),
//   u_c = √(u(Rw)² + u(bias)² + u(cal)²), U = k · u_c với k = 2.
// - Chỉ số mục tiêu chất lượng QGI = |Bias| / (1,5 × CV) (theo Parry).
// - CUSUM dạng bảng: C+ = max(0, C+ + z − k), C− = min(0, C− + z + k),
//   tín hiệu khi C+ ≥ h hoặc C− ≤ −h (Montgomery, Introduction to SQC).

export function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function sampleSd(values) {
  if (values.length < 2) return null;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

export function cvPercent(values) {
  const sd = sampleSd(values);
  const m = mean(values);
  return sd == null || m === 0 ? null : sd / Math.abs(m) * 100;
}

export function zScore(value, targetMean, targetSd) {
  return (value - targetMean) / targetSd;
}

export function sigmaMetric(tea, bias, cv) {
  return (tea - Math.abs(bias)) / cv;
}

/** Φ(x) bằng tích phân số Simpson của mật độ chuẩn trên [0, |x|] — khác hẳn
 * cách app dùng (xấp xỉ erf Abramowitz–Stegun), để hai đường độc lập. */
export function normalCdf(x) {
  const n = 20000;
  const a = 0, b = Math.abs(x);
  const h = (b - a) / n;
  const f = (t) => Math.exp(-t * t / 2) / Math.sqrt(2 * Math.PI);
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  const half = sum * h / 3;
  return x >= 0 ? 0.5 + half : 0.5 - half;
}

export function dpmo(sigma) {
  return (1 - normalCdf(sigma - 1.5)) * 1e6;
}

export function eqaBiasPercent(lab, target) {
  return (lab - target) / Math.abs(target) * 100;
}

export function rms(values) {
  return Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length);
}

export function cliaTeaPercent({ percent, absolute, mean }) {
  const absolutePct = Math.abs(absolute / mean) * 100;
  return percent == null ? absolutePct : Math.max(percent, absolutePct);
}

/** Ngân sách MU; thành phần vắng mặt không góp vào u_c. */
export function muBudget({ cv, bias, uCref, uCal, includeBias = true, k = 2 }) {
  const uBias = includeBias ? Math.sqrt(bias ** 2 + (uCref ?? 0) ** 2) : null;
  const uc = Math.sqrt(cv ** 2 + (uBias ?? 0) ** 2 + (uCal ?? 0) ** 2);
  return { uBias, uc, U: k * uc };
}

export function qgi(bias, cv) {
  return Math.abs(bias) / (1.5 * cv);
}

/** Tabular CUSUM trên chuỗi z; `resetBefore` là tập chỉ số đặt lại trước điểm. */
export function tabularCusum(zs, k = 0.5, h = 4, resetBefore = new Set()) {
  let cPos = 0, cNeg = 0;
  return zs.map((z, index) => {
    if (resetBefore.has(index)) { cPos = 0; cNeg = 0; }
    cPos = Math.max(0, cPos + z - k);
    cNeg = Math.min(0, cNeg + z + k);
    return { cPos, cNeg, signal: cPos >= h || cNeg <= -h };
  });
}
