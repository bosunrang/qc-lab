// Bộ ca thẩm định QC Lab — dữ liệu dựng sẵn có đáp án theo định nghĩa.
//
// Mỗi ca là MỘT xét nghiệm riêng trong CSDL tạm. Giá trị QC ghi dưới dạng
// Z-score so với Mean/SD đích của mức (giá trị đo = Mean + Z × SD), để người
// xem thấy ngay vì sao đáp án là như vậy. Đáp án ghi TƯỜNG MINH ở từng ca; bộ
// tính độc lập `reference.mjs` chỉ dùng để kiểm lại các đáp án số khi soạn.
//
// Quy ước đáp án Westgard:
// - `points['3/1']` = lần chạy thứ 3, mức 1. Điểm KHÔNG liệt kê phải là
//   "Đạt" và không mang luật nào.
// - `verdict`: 'ok' Đạt · 'warn' Cảnh báo · 'rej' Loại bỏ.
// - `rules`: đúng tập luật gắn cho điểm (không kể luật chỉ là "bằng chứng").
// - Được đưa vào thống kê (`accepted`): lần chạy có BẤT KỲ điểm "Loại bỏ" nào
//   thì mọi mức của lần chạy đó bị loại khỏi thống kê (quyết định WG-16).
//
// Luật bật mặc định (registry): 1-2s (cảnh báo), 1-3s, 2-2s, R4s, 4-1s, 6x,
// 10x. Ca cần luật khác thì ghi ở `rules` (hành động riêng của xét nghiệm).

export const L1 = { level: 1, mean: 100, sd: 2 };
export const L2 = { level: 2, mean: 200, sd: 5 };
export const L3 = { level: 3, mean: 300, sd: 10 };

/** Chuỗi một mức: mỗi Z là một lần chạy của mức 1. */
const seq = (zs) => zs.map((z) => ({ z: { 1: z } }));
/** Nhiều mức: mỗi phần tử là một lần chạy, `[z mức 1, z mức 2, (z mức 3)]`. */
const multi = (rows) => rows.map((row) => ({ z: Object.fromEntries(row.map((z, i) => [i + 1, z])) }));

const REF = {
  westgard: 'Westgard JO. "Westgard Rules" và "Multirule QC" — westgard.com',
  wg16: 'Quyết định WG-16 (docs/WESTGARD-REVIEW-2026-09-22-lan2.md): lần chạy có điểm Loại bỏ thì mọi mức của lần chạy đó ra khỏi thống kê',
  wg19: 'Quyết định WG-19: luật đếm chuỗi không nối qua mốc đổi Mean/SD; điểm cũ giữ Mean/SD đã chốt lúc nhập',
  wg20: 'Quyết định WG-20: điểm vượt MỚI NHẤT trong cửa sổ mang kết luận 2of3-2s',
  wg14: 'Quyết định WG-14: SD mẫu (mẫu số n − 1), cần ≥ 2 điểm; CV = SD / |Mean| × 100',
  sigmaRules: 'Westgard JO. "Westgard Sigma Rules" — westgard.com; bảng 2 mức và 3 mức QC',
  sigma: 'Sigma = (TEa − |Bias|) / CV; DPMO với dịch chuyển 1,5σ',
  qgi: 'Parry DM. "Quality Goal Index" — QGI < 0,8 do độ chụm, 0,8–1,2 cả hai, > 1,2 do độ chệch',
  eqa: 'Bias nhiều vòng EQA lấy RMS (quyết định Six Sigma của app, không dùng trung bình có dấu)',
  cusum: 'CUSUM dạng bảng: C+ = max(0, C+ + z − k), C− = min(0, C− + z + k); tín hiệu khi |C| ≥ h',
};

// ---------------------------------------------------------------------------
// 1. Luật Westgard
// ---------------------------------------------------------------------------

export const WESTGARD_CASES = [
  {
    id: 'WG-01', title: '1-3s: một điểm vượt +3SD bị loại',
    levels: [L1], runs: seq([0.5, -0.5, 3.2]),
    expect: { points: { '3/1': { verdict: 'rej', rules: ['1-3s'] } } },
    basis: `${REF.westgard}: 1-3s — một kết quả ngoài Mean ± 3SD, loại lần chạy.`,
  },
  {
    id: 'WG-02', title: '1-3s: đúng bằng 3SD chưa vượt, chỉ cảnh báo 1-2s',
    levels: [L1], runs: seq([0.5, -0.5, 3.0, -0.5]),
    expect: { points: { '3/1': { verdict: 'warn', rules: ['1-2s'] } } },
    basis: `Ngưỡng 1-3s là VƯỢT 3SD (> 3), không phải ≥ 3; điểm vẫn vượt 2SD nên là 1-2s.`,
  },
  {
    id: 'WG-03', title: '1-3s: vượt −3SD bị loại',
    levels: [L1], runs: seq([-0.5, 0.5, -3.5]),
    expect: { points: { '3/1': { verdict: 'rej', rules: ['1-3s'] } } },
    basis: `${REF.westgard}: 1-3s áp cho cả hai phía.`,
  },
  {
    id: 'WG-04', title: '1-2s: chỉ cảnh báo, vẫn vào thống kê',
    levels: [L1], runs: seq([0.5, -0.5, 2.4, -0.5]),
    expect: { points: { '3/1': { verdict: 'warn', rules: ['1-2s'] } } },
    basis: `${REF.westgard}: 1-2s là luật cảnh báo, không loại lần chạy.`,
  },
  {
    id: 'WG-05', title: '2-2s trong mức: hai lần chạy liên tiếp cùng vượt +2SD',
    levels: [L1], runs: seq([0.5, -0.5, 2.3, 2.6]),
    expect: { points: { '3/1': { verdict: 'warn', rules: ['1-2s'] }, '4/1': { verdict: 'rej', rules: ['1-2s', '2-2s'] } } },
    basis: `${REF.westgard}: 2-2s qua các lần chạy của cùng một mức. Điểm mới nhất mang kết luận loại; điểm trước chỉ là bằng chứng.`,
  },
  {
    id: 'WG-06', title: '2-2s: hai điểm vượt 2SD nhưng không liên tiếp thì không nổ',
    levels: [L1], runs: seq([0.5, -0.5, 2.3, 1.0, 2.6]),
    expect: { points: { '3/1': { verdict: 'warn', rules: ['1-2s'] }, '5/1': { verdict: 'warn', rules: ['1-2s'] } } },
    basis: `${REF.westgard}: 2-2s đòi hai kết quả LIÊN TIẾP.`,
  },
  {
    id: 'WG-07', title: '2-2s: hai điểm liên tiếp khác phía thì không nổ',
    levels: [L1], runs: seq([0.5, -0.5, 2.3, -2.6]),
    expect: { points: { '3/1': { verdict: 'warn', rules: ['1-2s'] }, '4/1': { verdict: 'warn', rules: ['1-2s'] } } },
    basis: `${REF.westgard}: 2-2s đòi CÙNG phía; R4s không áp qua hai lần chạy.`,
  },
  {
    id: 'WG-08', title: '4-1s trong mức: bốn điểm liên tiếp vượt +1SD',
    levels: [L1], runs: seq([-0.5, 1.2, 1.5, 1.3, 1.6]),
    expect: { points: { '5/1': { verdict: 'rej', rules: ['4-1s'] } } },
    basis: `${REF.westgard}: 4-1s — bốn kết quả liên tiếp cùng phía vượt 1SD.`,
  },
  {
    id: 'WG-09', title: '4-1s: chuỗi bị ngắt ở điểm thứ tư thì không nổ',
    levels: [L1], runs: seq([-0.5, 1.2, 1.5, 1.3, 0.4]),
    expect: { points: {} },
    basis: `${REF.westgard}: 4-1s đòi đủ bốn kết quả liên tiếp.`,
  },
  {
    id: 'WG-10', title: '6x: sáu điểm liên tiếp cùng phía Mean',
    levels: [L1], runs: seq([-0.5, 0.3, 0.5, 0.2, 0.6, 0.4, 0.3]),
    expect: { points: { '7/1': { verdict: 'rej', rules: ['6x'] } } },
    basis: 'Luật 6x (bật mặc định): sáu kết quả liên tiếp cùng phía so với Mean.',
  },
  {
    id: 'WG-11', title: '6x: chỉ năm điểm cùng phía thì không nổ',
    levels: [L1], runs: seq([-0.5, 0.3, 0.5, 0.2, 0.6, 0.4, -0.3]),
    expect: { points: {} },
    basis: 'Luật 6x đòi đủ sáu kết quả liên tiếp.',
  },
  {
    id: 'WG-12', title: '10x: mười điểm liên tiếp cùng phía Mean (tắt 6x)',
    levels: [L1], rules: { '6x': 'inactive' },
    runs: seq([-0.5, 0.3, 0.5, 0.2, 0.6, 0.4, 0.3, 0.7, 0.2, 0.5, 0.4]),
    expect: { points: { '11/1': { verdict: 'rej', rules: ['10x'] } } },
    basis: `${REF.westgard}: 10x — mười kết quả liên tiếp cùng phía Mean.`,
  },
  {
    id: 'WG-13', title: '8x: tám điểm liên tiếp cùng phía Mean (bật 8x, tắt 6x)',
    levels: [L1], rules: { '8x': 'reject', '6x': 'inactive' },
    runs: seq([-0.5, 0.3, 0.5, 0.2, 0.6, 0.4, 0.3, 0.7, 0.2]),
    expect: { points: { '9/1': { verdict: 'rej', rules: ['8x'] } } },
    basis: `${REF.westgard}: 8x — biến thể cho 2 hoặc 4 mức QC.`,
  },
  {
    id: 'WG-14', title: '9x: chín điểm liên tiếp cùng phía Mean (bật 9x, tắt 6x)',
    levels: [L1], rules: { '9x': 'reject', '6x': 'inactive' },
    runs: seq([0.5, -0.3, -0.5, -0.2, -0.6, -0.4, -0.3, -0.7, -0.2, -0.5]),
    expect: { points: { '10/1': { verdict: 'rej', rules: ['9x'] } } },
    basis: `${REF.westgard}: 9x — biến thể cho 3 mức QC; áp cho phía dưới Mean.`,
  },
  {
    id: 'WG-15', title: '12x: mười hai điểm liên tiếp cùng phía Mean (bật 12x, tắt 6x và 10x)',
    levels: [L1], rules: { '12x': 'reject', '6x': 'inactive', '10x': 'inactive' },
    runs: seq([-0.5, 0.3, 0.5, 0.2, 0.6, 0.4, 0.3, 0.7, 0.2, 0.5, 0.4, 0.6, 0.3]),
    expect: { points: { '13/1': { verdict: 'rej', rules: ['12x'] } } },
    basis: `${REF.westgard}: 12x — mười hai kết quả liên tiếp cùng phía Mean.`,
  },
  {
    id: 'WG-16', title: '3-1s trong mức: ba điểm liên tiếp vượt +1SD (bật 3-1s)',
    levels: [L1], rules: { '3-1s': 'reject' },
    runs: seq([-0.5, 1.2, 1.4, 1.3]),
    expect: { points: { '4/1': { verdict: 'rej', rules: ['3-1s'] } } },
    basis: `${REF.westgard}: 3-1s — ba kết quả liên tiếp cùng phía vượt 1SD.`,
  },
  {
    id: 'WG-17', title: '7T: bảy điểm liên tiếp tăng dần (bật 7T)',
    levels: [L1], rules: { '7T': 'reject' },
    runs: seq([-0.9, -0.6, -0.3, 0.0, 0.3, 0.6, 0.9]),
    expect: { points: { '7/1': { verdict: 'rej', rules: ['7T'] } } },
    basis: 'Luật xu hướng 7T: bảy kết quả liên tiếp tăng dần (hoặc giảm dần) trong cùng một mức.',
  },
  {
    id: 'WG-18', title: '7T: điểm thứ bảy giảm thì không nổ',
    levels: [L1], rules: { '7T': 'reject' },
    runs: seq([-0.9, -0.6, -0.3, 0.0, 0.3, 0.6, 0.5]),
    expect: { points: {} },
    basis: 'Luật 7T đòi bảy kết quả tăng (giảm) liên tục.',
  },
  {
    id: 'WG-19', title: '2of3-2s trong mức: 2 trong 3 lần chạy vượt +2SD (bật 2of3-2s)',
    levels: [L1], rules: { '2of3-2s': 'reject' },
    runs: seq([-0.5, 2.3, 0.4, 2.5]),
    expect: { points: { '2/1': { verdict: 'warn', rules: ['1-2s'] }, '4/1': { verdict: 'rej', rules: ['1-2s', '2of3-2s'] } } },
    basis: `${REF.westgard}: 2of3-2s. ${REF.wg20}.`,
  },
  {
    id: 'WG-20', title: 'Hành động riêng: nâng 1-2s thành Loại bỏ',
    levels: [L1], rules: { '1-2s': 'reject' },
    runs: seq([0.5, -0.5, 2.4]),
    expect: { points: { '3/1': { verdict: 'rej', rules: ['1-2s'] } } },
    basis: 'Hành động ghi đè theo xét nghiệm được ưu tiên hơn cấu hình chung và mặc định (phân giải 3 tầng).',
  },
  {
    id: 'WG-21', title: 'Hành động riêng: hạ 1-3s xuống Cảnh báo',
    levels: [L1], rules: { '1-3s': 'alert' },
    runs: seq([0.5, -0.5, 3.5, -0.5]),
    expect: { points: { '3/1': { verdict: 'warn', rules: ['1-3s'] } } },
    basis: 'Hành động "Cảnh báo" giữ nhãn luật nhưng không loại lần chạy.',
  },
  {
    id: 'WG-22', title: 'Hành động riêng: tắt 1-3s thì điểm +3,5SD chỉ còn 1-2s',
    levels: [L1], rules: { '1-3s': 'inactive' },
    runs: seq([0.5, -0.5, 3.5, -0.5]),
    expect: { points: { '3/1': { verdict: 'warn', rules: ['1-2s'] } } },
    basis: 'Luật "Không dùng" không được đánh giá; các luật còn bật vẫn áp.',
  },
  {
    id: 'WG-23', title: 'R4s: cùng lần chạy một mức > +2SD, một mức < −2SD',
    levels: [L1, L2], runs: multi([[0.5, -0.5], [-0.5, 0.5], [2.5, -2.4]]),
    expect: { points: { '3/1': { verdict: 'rej', rules: ['1-2s', 'R4s'] }, '3/2': { verdict: 'rej', rules: ['1-2s', 'R4s'] } } },
    basis: `${REF.westgard}: R4s chỉ trong một lần chạy, giữa các mức; cả hai phía vượt 2SD.`,
  },
  {
    id: 'WG-24', title: 'R4s: mức kia chưa vượt −2SD thì không nổ',
    levels: [L1, L2], runs: multi([[0.5, -0.5], [-0.5, 0.5], [2.5, -1.8]]),
    expect: { points: { '3/1': { verdict: 'warn', rules: ['1-2s'] } } },
    basis: `${REF.westgard}: R4s đòi một kết quả > +2SD VÀ một kết quả < −2SD.`,
  },
  {
    id: 'WG-25', title: 'R4s: +2,5SD và −2,5SD ở hai lần chạy khác nhau thì không nổ',
    levels: [L1, L2], runs: multi([[0.5, -0.5], [2.5, 0.4], [-2.5, -0.4]]),
    expect: { points: { '2/1': { verdict: 'warn', rules: ['1-2s'] }, '3/1': { verdict: 'warn', rules: ['1-2s'] } } },
    basis: `${REF.westgard}: R4s "chỉ diễn giải trong một lần chạy".`,
  },
  {
    id: 'WG-26', title: '2-2s liên mức: hai mức cùng lần chạy cùng vượt +2SD',
    levels: [L1, L2], runs: multi([[0.5, -0.5], [-0.5, 0.5], [2.3, 2.6]]),
    expect: { points: { '3/1': { verdict: 'rej', rules: ['1-2s', '2-2s'] }, '3/2': { verdict: 'rej', rules: ['1-2s', '2-2s'] } } },
    basis: `${REF.westgard}: 2-2s giữa các mức trong cùng lần chạy.`,
  },
  {
    id: 'WG-27', title: '4-1s liên mức: 2 lần chạy × 2 mức cùng vượt +1SD',
    levels: [L1, L2], runs: multi([[0.5, -0.5], [1.3, 1.4], [1.2, 1.5]]),
    expect: { points: { '3/1': { verdict: 'rej', rules: ['4-1s'] }, '3/2': { verdict: 'rej', rules: ['4-1s'] } } },
    basis: `${REF.westgard}: 4-1s đếm qua các mức và các lần chạy; lần chạy mới nhất mang kết luận.`,
  },
  {
    id: 'WG-28', title: '3-1s liên mức: ba mức cùng lần chạy vượt +1SD (bật 3-1s)',
    levels: [L1, L2, L3], rules: { '3-1s': 'reject' }, runs: multi([[0.5, -0.5, 0.4], [1.2, 1.5, 1.3]]),
    expect: { points: { '2/1': { verdict: 'rej', rules: ['3-1s'] }, '2/2': { verdict: 'rej', rules: ['3-1s'] }, '2/3': { verdict: 'rej', rules: ['3-1s'] } } },
    basis: `${REF.westgard}: 3-1s với ba mức QC trong một lần chạy.`,
  },
  {
    id: 'WG-29', title: '2of3-2s liên mức: 2 trong 3 mức cùng vượt +2SD (bật 2of3-2s)',
    levels: [L1, L2, L3], rules: { '2of3-2s': 'reject' }, runs: multi([[0.5, -0.5, 0.4], [2.3, 2.5, 0.2]]),
    expect: { points: { '2/1': { verdict: 'rej', rules: ['1-2s', '2-2s', '2of3-2s'] }, '2/2': { verdict: 'rej', rules: ['1-2s', '2-2s', '2of3-2s'] } } },
    basis: `${REF.westgard}: 2of3-2s dùng cho 3 mức QC; hai mức cùng vượt 2SD cũng là 2-2s liên mức. Mức 3 Đạt nhưng cả lần chạy bị loại (WG-16).`,
  },
  {
    id: 'WG-30', title: 'Lần chạy bị loại: mức khác Đạt nhưng không vào thống kê',
    levels: [L1, L2], runs: multi([[0.5, -0.5], [-0.5, 0.5], [3.5, 0.3]]),
    expect: { points: { '3/1': { verdict: 'rej', rules: ['1-3s'] } } },
    basis: `${REF.wg16}.`,
  },
  {
    id: 'WG-31', title: 'Đổi Mean/SD giữa chuỗi: không nối 2-2s, điểm cũ giữ Z cũ',
    levels: [L1],
    runs: [{ z: { 1: 0.5 } }, { z: { 1: -0.5 } }, { z: { 1: 2.4 } }, { setTarget: { level: 1, mean: 102, sd: 2 } }, { z: { 1: 2.4 } }],
    expect: {
      points: { '3/1': { verdict: 'warn', rules: ['1-2s'], z: 2.4 }, '4/1': { verdict: 'warn', rules: ['1-2s'], z: 2.4 } },
    },
    basis: `${REF.wg19}. Lần chạy 4 có Z = +2,4 so với Mean mới 102.`,
  },
];

// ---------------------------------------------------------------------------
// 2. Thống kê: Z-score, Mean, SD, CV
// ---------------------------------------------------------------------------

/** 20 giá trị mức 1 (Mean 100, SD 2), xen kẽ hai phía, không nổ luật nào. */
const STABLE_20 = [100.8, 98.9, 101.5, 99.2, 102.1, 97.8, 100.4, 99.6, 101.9, 98.3, 100.2, 99.1, 102.6, 98.7, 100.9, 97.5, 101.2, 99.8, 100.6, 98.4];

export const STATS_CASES = [
  {
    id: 'ST-01', title: 'Z-score từng điểm = (giá trị − Mean) / SD',
    levels: [L1], runs: [98.5, 101.3, 103.7, 96.1].map((val) => ({ val: { 1: val } })),
    expect: { z: { '1/1': -0.75, '2/1': 0.65, '3/1': 1.85, '4/1': -1.95 } },
    basis: 'Định nghĩa Z-score so với Mean/SD đích của mức.',
  },
  {
    id: 'ST-02', title: 'Mean, SD, CV quan sát của 20 điểm được chấp nhận',
    levels: [L1], runs: STABLE_20.map((val) => ({ val: { 1: val } })),
    expect: { stats: { 1: { n: 20, mean: 99.975, sd: 1.478931, cv: 1.479301, provisional: false } } },
    basis: `${REF.wg14}. Đủ 20 phép đo trong ≥ 10 ngày nên không còn "tạm thời".`,
  },
  {
    id: 'ST-03', title: 'Điểm bị loại 1-3s không vào thống kê',
    levels: [L1], runs: [...STABLE_20.slice(0, 10), 107, ...STABLE_20.slice(10)].map((val) => ({ val: { 1: val } })),
    expect: {
      points: { '11/1': { verdict: 'rej', rules: ['1-3s'] } },
      stats: { 1: { n: 20, mean: 99.975, sd: 1.478931, cv: 1.479301, provisional: false } },
    },
    basis: 'Thống kê chỉ dùng điểm được chấp nhận; kết quả phải trùng ST-02.',
  },
  {
    id: 'ST-04', title: 'Lần chạy bị loại ở mức 1 cũng bị bỏ khỏi thống kê mức 2',
    levels: [L1, L2],
    runs: [
      [100.9, 201.5], [98.8, 197.8], [101.4, 203.1], [99.1, 198.6], [107.5, 202.2],
      [98.2, 196.9], [101.6, 201.8], [99.4, 199.3], [100.7, 202.7], [98.9, 198.1],
    ].map(([a, b]) => ({ val: { 1: a, 2: b } })),
    expect: {
      points: { '5/1': { verdict: 'rej', rules: ['1-3s'] } },
      stats: {
        1: { n: 9, mean: 99.888889, sd: 1.263373, cv: 1.264778, provisional: true },
        2: { n: 9, mean: 199.977778, sd: 2.315587, cv: 1.157922, provisional: true },
      },
    },
    basis: `${REF.wg16}. Dưới 20 phép đo nên thống kê còn "tạm thời".`,
  },
  {
    id: 'ST-05', title: 'Một điểm: chưa đủ để tính SD và CV',
    levels: [L1], runs: [{ val: { 1: 101 } }],
    expect: { stats: { 1: { n: 1, mean: 101, sd: null, cv: null, provisional: true } } },
    basis: `${REF.wg14}.`,
  },
];

// ---------------------------------------------------------------------------
// 3. Chỉ số Six Sigma
// ---------------------------------------------------------------------------
//
// SG-01…SG-08 lưu kỳ Sigma với CV nhập tay: kiểm Sigma, DPMO, Bias qua đúng
// đường lưu/đọc của trang Six Sigma. Gợi ý thiết kế QC (bậc, bộ luật, N, R)
// kiểm bằng chính hàm main dùng (`sigmaQualityDesign`) với Sigma app vừa tính
// — vì trang Sigma CHỈ đưa gợi ý khi CV lấy từ nhóm IQC đủ điều kiện và đã
// rà soát (quyết định F.4/SG), CV nhập tay thì không. SG-10 đi trọn đường đó.

export const SIGMA_CASES = [
  {
    id: 'SG-01', title: 'Sigma 5,33 với 2 mức QC → bậc 5–6: 1-3s/2-2s/R4s, N=2',
    levels: [L1, L2], sigma: { tea: 10, levels: [{ level: 1, cv: 1.5, biasEqa: 2 }] },
    expect: { 1: { sigma: 5.333333, dpmo: 63.209, tier: '5–6', rules: ['1-3s', '2-2s', 'R4s'], n: 2, r: 1, capable: true } },
    basis: `${REF.sigma}. ${REF.sigmaRules}.`,
  },
  {
    id: 'SG-02', title: 'Bias âm dùng giá trị tuyệt đối',
    levels: [L1, L2], sigma: { tea: 10, levels: [{ level: 1, cv: 1.5, biasEqa: -2 }] },
    expect: { 1: { sigma: 5.333333, tier: '5–6' } },
    basis: `${REF.sigma}.`,
  },
  {
    id: 'SG-03', title: 'Sigma đúng bằng 3 thuộc bậc 3–4: thêm 4-1s và 8x, N=4 R=2',
    levels: [L1, L2], sigma: { tea: 10, levels: [{ level: 1, cv: 3, biasEqa: 1 }] },
    expect: { 1: { sigma: 3, dpmo: 66807.201, tier: '3–4', rules: ['1-3s', '2-2s', 'R4s', '4-1s', '8x'], n: 4, r: 2, capable: true } },
    basis: `${REF.sigmaRules}: ranh giới 3σ thuộc bậc trên (≥ 3).`,
  },
  {
    id: 'SG-04', title: 'Sigma đúng bằng 6: một luật 1-3s là đủ',
    levels: [L1, L2], sigma: { tea: 12, levels: [{ level: 1, cv: 2, biasEqa: 0 }] },
    expect: { 1: { sigma: 6, dpmo: 3.398, tier: '≥6', rules: ['1-3s'], n: 2, r: 1, capable: true } },
    basis: `${REF.sigmaRules}.`,
  },
  {
    id: 'SG-05', title: 'Sigma dưới 3: không đủ năng lực',
    levels: [L1, L2], sigma: { tea: 8, levels: [{ level: 1, cv: 2, biasEqa: 3 }] },
    expect: { 1: { sigma: 2.5, dpmo: 158655.254, tier: '<3', capable: false } },
    basis: `${REF.sigmaRules}: dưới 3σ không có thiết kế QC nào hợp thức hoá được phương pháp.`,
  },
  {
    id: 'SG-06', title: '3 mức QC, Sigma 4,5 → bảng 3 mức: 1-3s/2of3-2s/R4s/3-1s, N=3',
    levels: [L1, L2, L3], sigma: { tea: 10, levels: [{ level: 1, cv: 2, biasEqa: 1 }] },
    expect: { 1: { sigma: 4.5, dpmo: 1349.898, tier: '4–5', rules: ['1-3s', '2of3-2s', 'R4s', '3-1s'], n: 3, r: 1, capable: true } },
    basis: `${REF.sigmaRules}: bảng riêng cho 3 mức QC.`,
  },
  {
    id: 'SG-07', title: 'Bias từ 3 vòng EQA (+2%, −3%, +1%) lấy RMS, không lấy trung bình có dấu',
    levels: [L1, L2],
    sigma: { tea: 10, levels: [{ level: 1, cv: 2, eqaRounds: [{ lab: 102, target: 100 }, { lab: 97, target: 100 }, { lab: 101, target: 100 }] }] },
    expect: { 1: { biasEqa: 2.160247, biasMean: 0, mixedSigns: true, sigma: 3.919877, tier: '3–4' } },
    basis: `${REF.eqa}. Trung bình có dấu bằng 0 sẽ che mất độ chệch thật.`,
  },
  {
    id: 'SG-08', title: 'Chưa có Bias thì không tính Sigma (không giả định Bias = 0)',
    levels: [L1, L2], sigma: { tea: 10, levels: [{ level: 1, cv: 2 }] },
    expect: { 1: { sigma: null } },
    basis: 'Quyết định Six Sigma của app: Bias chưa đánh giá không đồng nghĩa Bias = 0.',
  },
  {
    id: 'SG-10', title: 'Trọn đường: CV từ 30 điểm IQC của lô, đã rà soát → gợi ý thiết kế QC',
    levels: [L1, L2], cohort: { period: '2026-02', tea: 8, biasEqa: 1 },
    runs: [
      100.8, 98.9, 101.5, 99.2, 102.1, 97.8, 100.4, 99.6, 101.9, 98.3, 100.2, 99.1, 102.6, 98.7, 100.9,
      97.5, 101.2, 99.8, 100.6, 98.4, 101.1, 99.3, 100.7, 98.6, 101.8, 99.0, 100.3, 98.8, 101.4, 99.5,
    ].map((val) => ({ val: { 1: val } })),
    expect: { 1: { cohortN: 30, cohortStatus: 'eligible', cv: 1.360781, sigma: 5.144106, dpmo: 134.161, tier: '5–6', rules: ['1-3s', '2-2s', 'R4s'], n: 2, r: 1, capable: true, designShown: true } },
    basis: `CV lấy từ mọi điểm IQC của lô trong kỳ (không tự loại điểm, tránh CV "đẹp giả"); đủ 30 điểm thì nhóm "đủ điều kiện" (ISO/TS 20914). ${REF.sigma}. ${REF.sigmaRules}.`,
  },
];

/** QGI và nhóm nguyên nhân — hàm dùng chung mà trang Sigma hiển thị. */
export const QGI_CASES = [
  { id: 'SG-09a', title: 'QGI = 1,0 → do cả độ chụm và độ chệch', tea: 10, bias: 3, cv: 2, expect: { qgi: 1, driver: 'both' }, basis: REF.qgi },
  { id: 'SG-09b', title: 'QGI = 0,33 → do độ chụm (CV)', tea: 10, bias: 1, cv: 2, expect: { qgi: 0.333333, driver: 'imprecision' }, basis: REF.qgi },
  { id: 'SG-09c', title: 'QGI = 2,67 → do độ chệch (Bias)', tea: 10, bias: 4, cv: 1, expect: { qgi: 2.666667, driver: 'inaccuracy' }, basis: REF.qgi },
];

// ---------------------------------------------------------------------------
// 4. Biểu đồ tổng tích luỹ CUSUM
// ---------------------------------------------------------------------------

/** Tắt các luật chuỗi để CUSUM được thử riêng (điểm không bị loại). */
const CUSUM_ONLY = { '4-1s': 'inactive', '6x': 'inactive', '10x': 'inactive', '2-2s': 'inactive' };

export const CUSUM_CASES = [
  {
    id: 'CU-01', title: 'C+ cộng dồn z − k và báo +h từ điểm thứ tư (k = 0,5; h = 4)',
    levels: [L1], cusum: { k: 0.5, h: 4 }, rules: CUSUM_ONLY, runs: seq([1.5, 1.5, 1.5, 1.5, 1.5, 1.5]),
    expect: { cPos: [1, 2, 3, 4, 5, 6], signalRuns: [4, 5, 6], signal: 'CUSUM +h' },
    basis: `${REF.cusum}. CUSUM là tín hiệu xu hướng, không tự loại điểm.`,
  },
  {
    id: 'CU-02', title: 'C− cộng dồn z + k và báo −h ở điểm thứ tám',
    levels: [L1], cusum: { k: 0.5, h: 4 }, rules: CUSUM_ONLY, runs: seq([-1, -1, -1, -1, -1, -1, -1, -1, -1]),
    expect: { cNeg: [-0.5, -1, -1.5, -2, -2.5, -3, -3.5, -4, -4.5], signalRuns: [8, 9], signal: 'CUSUM −h' },
    basis: REF.cusum,
  },
  {
    id: 'CU-03', title: 'Dao động hai phía: không tích luỹ, không có tín hiệu',
    levels: [L1], cusum: { k: 0.5, h: 4 }, rules: CUSUM_ONLY, runs: seq([1.5, -1.5, 1.5, -1.5, 1.5, -1.5]),
    expect: { cPos: [1, 0, 1, 0, 1, 0], cNeg: [0, -1, 0, -1, 0, -1], signalRuns: [] },
    basis: REF.cusum,
  },
  {
    id: 'CU-04', title: 'k = 1, h = 5 theo cấu hình của xét nghiệm',
    levels: [L1], cusum: { k: 1, h: 5 }, rules: CUSUM_ONLY, runs: seq([1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8]),
    expect: { cPos: [0.8, 1.6, 2.4, 3.2, 4, 4.8, 5.6], signalRuns: [7], signal: 'CUSUM +h' },
    basis: `${REF.cusum}; k và h lấy từ cấu hình xét nghiệm.`,
  },
  {
    id: 'CU-05', title: 'Đặt lại C+ sau khi sự cố được khắc phục hiệu quả (NCE đã duyệt)',
    levels: [L1], cusum: { k: 0.5, h: 4 }, rules: CUSUM_ONLY,
    runs: [...seq([1.5, 1.5, 1.5]), { nceEffective: { completedRun: 3 } }, ...seq([1.5, 1.5, 1.5, 1.5])],
    expect: { cPos: [1, 2, 3, 1, 2, 3, 4], signalRuns: [7], signal: 'CUSUM +h' },
    basis: `${REF.cusum}. Chuỗi cộng dồn bắt đầu lại sau ngày hoàn thành khắc phục đã được duyệt và kết luận hiệu quả; ngày hoàn thành thuộc giai đoạn cũ.`,
  },
];

export const ALL_GROUPS = [
  { key: 'westgard', label: 'Luật Westgard', cases: WESTGARD_CASES },
  { key: 'stats', label: 'Z-score, Mean, SD, CV', cases: STATS_CASES },
  { key: 'sigma', label: 'Six Sigma', cases: [...SIGMA_CASES, ...QGI_CASES] },
  { key: 'cusum', label: 'CUSUM', cases: CUSUM_CASES },
];
