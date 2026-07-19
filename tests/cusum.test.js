const assert = require('node:assert/strict');
const QCCore = require('../assets/core.js');

function close(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

{
  // Điểm ổn định quanh mean -> CUSUM không tích lũy, không cảnh báo.
  const points = Array.from({ length: 10 }, () => ({ val: 10 }));
  const c = QCCore.cusum(points, 10, 1);
  assert.ok(c.cPos.every(v => v === 0));
  assert.ok(c.cNeg.every(v => v === 0));
  assert.ok(c.flags.every(f => f === 'ok'));
}

{
  // Trôi bền vững +1SD: 6x mặc định phát hiện chuỗi cùng phía tại điểm thứ 6;
  // CUSUM vẫn được kiểm tra độc lập và vượt ngưỡng h=4 tại điểm thứ 8.
  const points = Array.from({ length: 9 }, () => ({ val: 11 }));
  const wg = QCCore.westgard(points, 10, 1, rule => QCCore.WG_DEFAULT_ON.has(rule));
  assert.ok(wg.F.slice(0,5).every(f => f.level === 'ok'));
  assert.ok(wg.F[5].rules.includes('6x'), 'Westgard mặc định phải phát hiện 6x tại điểm thứ 6');

  const c = QCCore.cusum(points, 10, 1);
  assert.equal(c.k, 0.5);
  assert.equal(c.h, 4);
  close(c.cPos[6], 3.5);
  assert.equal(c.flags[6], 'ok');
  close(c.cPos[7], 4);
  assert.equal(c.flags[7], 'rej');
}

{
  // k/h tùy chỉnh vẫn được tôn trọng, không rơi về mặc định.
  const points = Array.from({ length: 4 }, () => ({ val: 12 })); // z=2 mỗi điểm
  const c = QCCore.cusum(points, 10, 1, 1, 3);
  assert.equal(c.k, 1);
  assert.equal(c.h, 3);
  // cPos: 1,2,3,4 (bước 1 mỗi điểm vì z-k=2-1=1) -> vượt h=3 ở điểm thứ 3 (index 2)
  close(c.cPos[2], 3);
  assert.equal(c.flags[2], 'rej');
}

{
  // Snapshot qcMean/qcSd của điểm phải được ưu tiên hơn mean/sd hiện hành (giống pointZ).
  const points = [{ val: 12, qcMean: 10, qcSd: 1 }];
  const c = QCCore.cusum(points, 100, 10); // fallback mean/sd rất khác, không được dùng
  close(c.cPos[0], 1.5); // z=(12-10)/1=2, cPos=max(0,0+2-0.5)=1.5
  assert.equal(c.flags[0], 'ok');
}

{
  // Điểm không tính được z (thiếu mean/sd hợp lệ) giữ nguyên tổng tích lũy, không phá chuỗi.
  const points = [{ val: 11 }, { val: NaN }, { val: 11 }];
  const c = QCCore.cusum(points, 10, 1);
  close(c.cPos[0], 0.5);
  close(c.cPos[1], 0.5); // giữ nguyên, không reset về 0
  close(c.cPos[2], 1);
}

{
  const points = [{ val: 10 }, { val: 11 }, { val: 12 }, { val: 13 }, { val: 14 }];
  const ma = QCCore.movingAverage(points, 10, 1, 3);
  close(ma[0], 0);
  close(ma[1], 0.5);
  close(ma[2], 1);
  close(ma[3], 2);
  close(ma[4], 3);
}

{
  // window mặc định khi không truyền, và mảng rỗng không lỗi.
  const ma = QCCore.movingAverage([{ val: 10 }, { val: 11 }], 10, 1);
  assert.equal(ma.length, 2);
  assert.equal(QCCore.movingAverage([], 10, 1).length, 0);
}

console.log('CUSUM tests passed');
