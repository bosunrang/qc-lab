/**
 * Đối chiếu Westgard multirule với ĐỊNH NGHĨA LUẬT từ nguồn ngoài, không phải
 * với chính code app. Đây là hạng mục ưu tiên cao nhất trong đánh giá chuyên
 * sâu 2026-08-21: các test hiện có (tests/qccore.test.js, westgard-worker.test.js)
 * đều đối chiếu implementation với implementation (worker so với main-thread,
 * hoặc tự nhấc giá trị ra để "khớp" với luật đã đọc trong code) — không có test
 * nào chốt bằng một nguồn ĐỘC LẬP với qc-core.ts. Nếu bản port từ core.js gốc
 * (hoặc chính core.js gốc) có lỗi chung ở logic multirule, một test tự-đối-chiếu
 * không thể bắt được.
 *
 * Nguồn tham chiếu (đọc trực tiếp 2026-08-21, không suy đoán):
 *   [W] James O. Westgard, "The Multirule Interpretation" — Lesson 18,
 *       https://westgard.com/lessons/basic-qc-practices/lesson18.html
 *       — xác nhận 1_2s CHỈ là luật sàng lọc/cảnh báo (không tự loại bỏ một
 *         mình); 1_3s/2_2s/R_4s/4_1s/10_x là bộ 5 luật loại bỏ cốt lõi.
 *   [WHO] WHO Quality Management Handbook, Annex 12.3 "Levey-Jennings control
 *       charts and Westgard rules" (bản PDF của WHO, mục Measles/Rubella lab
 *       manual), đọc 2 trang đầy đủ 2026-08-21 — xác nhận định nghĩa từng luật
 *       bằng lời: 1_3s "one value more than three SD"; 2_2s "two consecutive
 *       values more than two SD, same side"; 3_1s "three consecutive values
 *       more than one SD, same side".
 *
 * Giá trị mong đợi (level/rules) dưới đây được TỰ TÍNH TAY từ hai nguồn trên
 * (điểm nào cách Mean bao nhiêu SD → luật nào theo định nghĩa phải khớp) TRƯỚC
 * khi chạy qua QCCore, không phải đọc code rồi chép lại. isOn dùng đúng
 * QCCore.WG_DEFAULT_ON — bộ luật một phòng xét nghiệm thật sẽ chạy đồng thời ở
 * cấu hình mặc định (1_2s/1_3s/2_2s/4_1s/6x/10x/R4s) — không cô lập từng luật
 * như các test isOn tuỳ chọn đã có, để việc phối hợp nhiều luật cùng lúc cũng
 * được xác nhận, không chỉ hành vi từng luật riêng lẻ.
 */
const assert = require('node:assert/strict');
const QCCore = require('../assets/core.js');

const isOnDefault = (rule) => QCCore.WG_DEFAULT_ON.has(rule);

/* ===== 1. Chuỗi sạch — không điểm nào vượt ±1SD → tất cả 'ok' =====
   [W]/[WHO]: không luật nào trong bộ multirule có ngưỡng dưới 1SD; một chuỗi
   toàn bộ nằm trong ±1SD không thể khớp bất kỳ luật nào. */
{
  const points = [{ val: 100 }, { val: 98 }, { val: 103 }, { val: 97 }, { val: 101 }];
  const { F } = QCCore.westgard(points, 100, 5, isOnDefault);
  F.forEach((f, i) => assert.equal(f.level, 'ok', `điểm ${i} phải 'ok' (z=${((points[i].val - 100) / 5).toFixed(2)})`));
}

/* ===== 2. 1_3s — một điểm vượt ±3SD → loại bỏ ngay, không cần điểm khác =====
   [WHO]: "one value more than three SD" là lỗi ngẫu nhiên lớn, tự nó đủ để
   loại bỏ, không cần luật hỗ trợ. z điểm cuối = (118-100)/5 = 3.6 > 3. */
{
  const points = [{ val: 100 }, { val: 98 }, { val: 103 }, { val: 97 }, { val: 118 }];
  const { F } = QCCore.westgard(points, 100, 5, isOnDefault);
  [0, 1, 2, 3].forEach(i => assert.equal(F[i].level, 'ok', `điểm ${i} phải 'ok'`));
  assert.equal(F[4].level, 'rej', 'z=3.6 > 3SD phải bị loại bởi 1-3s');
  assert.deepEqual(F[4].rules, ['1-3s']);
}

/* ===== 3. 1_2s ĐƠN LẺ — chỉ cảnh báo, KHÔNG tự loại bỏ =====
   Đây là điểm mấu chốt mà [W] nêu rõ: multirule ra đời chính để tránh loại bỏ
   oan chỉ vì một điểm vượt 2SD đơn độc (tỷ lệ báo động giả cao nếu dùng 1_2s
   một mình). z điểm cuối = (111-100)/5 = 2.2 — nằm giữa 2SD và 3SD, không có
   điểm liền trước nào cũng vượt 2SD để hỗ trợ 2-2s/2of3-2s. Kỳ vọng: 'warn',
   không phải 'rej' — nếu code lỡ tự loại bỏ 1_2s đơn lẻ, đây là đúng loại lỗi
   nghiêm trọng (loại bỏ oan) mà test này phải bắt được. */
{
  const points = [{ val: 100 }, { val: 99 }, { val: 101 }, { val: 98 }, { val: 111 }];
  const { F } = QCCore.westgard(points, 100, 5, isOnDefault);
  assert.equal(F[4].level, 'warn', 'z=2.2 đơn lẻ chỉ được CẢNH BÁO, không được tự loại bỏ');
  assert.deepEqual(F[4].rules, ['1-2s']);
}

/* ===== 4. 2_2s — hai điểm LIÊN TIẾP cùng phía vượt ±2SD → loại bỏ =====
   [WHO]: "two consecutive values more than two SD, same side" là lỗi hệ
   thống. z = [.., 2.4, 2.6] (hai điểm cuối, cùng phía dương, cả hai >2SD).
   Điểm áp chót (z=2.4) một mình chỉ là 1_2s (warn) — nó KHÔNG được tự nâng
   lên 'rej' chỉ vì góp phần tạo nên vi phạm 2_2s ở điểm sau; theo cách
   qc-core.ts ghi lại tiến trình (support), 2-2s phải xuất hiện ở
   supportRules của nó, không phải rules/level. Điểm cuối (z=2.6) mới là điểm
   THỰC SỰ bị loại, mang cả '1-2s' và '2-2s'. */
{
  const points = [{ val: 100 }, { val: 99 }, { val: 101 }, { val: 112 }, { val: 113 }];
  const { F } = QCCore.westgard(points, 100, 5, isOnDefault);
  assert.equal(F[3].level, 'warn', 'điểm hỗ trợ (z=2.4) không được tự nâng lên rej');
  assert.deepEqual(F[3].rules, ['1-2s']);
  assert.ok(F[3].supportRules.includes('2-2s'), 'điểm hỗ trợ phải ghi nhận đã góp phần vào 2-2s');
  assert.equal(F[4].level, 'rej', 'z=2.6, điểm thứ hai liên tiếp vượt 2SD cùng phía, phải bị loại theo 2-2s');
  assert.ok(F[4].rules.includes('2-2s'), 'điểm loại phải mang luật 2-2s');
}

/* ===== 5. R_4s — MỘT mức > +2SD và MỘT mức khác < -2SD trong CÙNG lần chạy,
   chênh nhau trên 4SD → loại bỏ (lỗi ngẫu nhiên lớn, không phải lỗi hệ thống,
   nên tách khỏi 2-2s: hai mức lệch NGƯỢC HƯỚNG, không cùng phía). =====
   Mức 1: mean=100,sd=5 → val=112 → z=(112-100)/5=2.4.
   Mức 2: mean=200,sd=10 → val=175 → z=(175-200)/10=-2.5.
   Theo [W]: R_4s dùng CHÊNH LỆCH giữa hai mức tính bằng SD riêng của từng
   mức, không phải giá trị thô — 2.4 và -2.5 đều đã ở đơn vị SD nên chênh lệch
   là 2.4-(-2.5)=4.9 > 4 → khớp. Cả hai điểm cùng lần chạy phải bị loại. */
{
  const p1 = { val: 112, runId: 'r1' };
  const p2 = { val: 175, runId: 'r1' };
  const flags = QCCore.westgardMulti(
    [
      { level: 1, mean: 100, sd: 5, pts: [p1] },
      { level: 2, mean: 200, sd: 10, pts: [p2] },
    ],
    isOnDefault,
  );
  assert.deepEqual(flags.get(p1), ['R4s'], 'mức 1 (z=2.4) phải bị loại theo R4s');
  assert.deepEqual(flags.get(p2), ['R4s'], 'mức 2 (z=-2.5) phải bị loại theo R4s');
  assert.equal(flags.support.size, 0, 'chỉ 1 lần chạy, 2 điểm — không đủ để bất kỳ luật N-liên-tiếp nào phát sinh chứng cứ hỗ trợ');
}

/* ===== 6. Cùng lần chạy, hai mức CÙNG PHÍA vượt ±2SD (không phải R4s vì
   không ngược hướng) → phải khớp 2-2s (biến thể chéo mức), KHÔNG khớp R4s. =====
   Mức 1: mean=100,sd=5 → val=113 → z=2.6.
   Mức 2: mean=200,sd=10 → val=225 → z=2.5. Cùng phía dương, không có mức nào
   âm → R4s không thể khớp (định nghĩa R4s đòi một mức dương một mức âm). */
{
  const p1 = { val: 113, runId: 'r1' };
  const p2 = { val: 225, runId: 'r1' };
  const flags = QCCore.westgardMulti(
    [
      { level: 1, mean: 100, sd: 5, pts: [p1] },
      { level: 2, mean: 200, sd: 10, pts: [p2] },
    ],
    isOnDefault,
  );
  assert.deepEqual(flags.get(p1), ['2-2s'], 'hai mức cùng phía vượt 2SD trong cùng lần chạy phải khớp 2-2s, không phải R4s');
  assert.deepEqual(flags.get(p2), ['2-2s']);
}
