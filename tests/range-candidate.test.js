/**
 * Tests for rangeCandidate() (assets/modules/range.js).
 *
 * Đây là phép tính LÂM SÀNG đứng sau nút "Áp dụng dải PXN": nó chốt các cổng chấp
 * nhận (≥20 kết quả, ≥20 ngày độc lập, 0 điểm bị loại, 0 điểm cảnh báo, SD>0) và
 * tính Mean/SD đề xuất sẽ được ghi đè lên dải kiểm soát của lô. Từ lúc dải mới được
 * áp dụng, MỌI đánh giá Westgard về sau đo theo Mean/SD này — sai ở đây là sai toàn
 * bộ nội kiểm của lô đó, nên nó phải có test riêng dù phần còn lại của range.js là
 * DOM thuần không chạy được trong sandbox.
 *
 * Hợp đồng quan trọng nhất: Mean/SD tính từ TOÀN BỘ điểm của lô đang vận hành,
 * KHÔNG loại điểm vi phạm. Loại điểm vi phạm sẽ làm SD nhỏ đi giả tạo, dải mới hẹp
 * hơn thực tế, và lô đó từ đó về sau bị báo lỗi Westgard oan. Vì vậy các cổng chấp
 * nhận chặn thẳng khi còn điểm vi phạm, thay vì âm thầm bỏ điểm ra khỏi phép tính.
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/action-workflow-service.js', 'modules/range.js']);
run(ctx, 'function __setState(s){state=s;clearDerived();}');

/* Chỉ bật 1-2s (cảnh báo) và 1-3s (loại): hai luật đơn điểm, không có luật chuỗi nào
   khác chen vào nên mỗi điểm trong fixture cho đúng verdict mà test cố ý dựng. */
function baseState(points) {
  const rules = Object.fromEntries(ctx.QCCore.WG_RULES.map(rule => [rule, ['1-2s', '1-3s'].includes(rule)]));
  return {
    lab: {}, machines: [], instruments: [{ id: 'i1', name: 'Analyzer A', active: true }], assayGroups: [],
    qcPanels: [{ id: 'p1', name: 'Panel A', instrumentId: 'i1', testIds: ['T1'], active: true }],
    lotTransitions: [], lotGroups: [{ id: 'g1', name: 'L1', lotIds: ['lot1'], active: true }],
    qcLots: [{ id: 'lot1', groupId: 'g1', lotNo: 'L1', level: 1, exp: '2026-12-31', active: true }],
    tests: [{
      id: 'T1', name: 'Glucose', unit: 'mmol/L', instrumentId: 'i1', machine: 'Analyzer A', active: true,
      levels: [{ level: 1, qcLotId: 'lot1', lot: 'L1', mean: 100, sd: 10, exp: '2026-12-31' }],
    }],
    data: { T1: points }, actions: [], activity: [], users: [], reagentTests: [], reagentOperators: [],
    reagentSampleTypes: [], sigmaData: {}, periodLocks: [], westgardRules: rules, configMigrationVersion: 1,
  };
}

const day = i => `2026-0${Math.floor(i / 28) + 1}-${String((i % 28) + 1).padStart(2, '0')}`;
/* val quanh 100 với sd thật ~2 → mọi z nằm trong ±0.2 so với dải khai báo (mean 100,
   sd 10), nên không luật nào nổ trừ những điểm test cố ý đẩy ra ngoài. */
function cleanPoints(n, startDay = 0) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${startDay + i}`, date: day(startDay + i), runId: `${day(startDay + i)}-1`,
    level: 1, lot: 'L1', val: i % 2 ? 102 : 98,
  }));
}
function candidate(points) {
  run(ctx, '__setState(' + JSON.stringify(baseState(points)) + ')');
  return JSON.parse(JSON.stringify(run(ctx, 'rangeCandidate("T1",1)')));
}

/* --- Cổng cơ sở: 20 kết quả trên 20 ngày, sạch luật, SD>0 --- */
{
  const r = candidate(cleanPoints(20));
  assert.equal(r.c.n, 20);
  assert.equal(r.days, 20);
  assert.equal(r.bad, 0);
  assert.equal(r.warn, 0);
  assert.ok(r.c.sd > 0);
  assert.equal(r.eligible, true, '20 kết quả trên 20 ngày, không vi phạm, SD>0 phải đủ điều kiện');
  assert.equal(r.c.m, 100, 'Mean đề xuất là trung bình cộng của chính các giá trị đã nhập');
}

/* --- HỢP ĐỒNG LÂM SÀNG TRỌNG TÂM ---
   Điểm vi phạm vẫn nằm TRONG phép tính Mean/SD. Nếu ai đó "tối ưu" rangeCandidate()
   sang acceptedLotPoints() (helper hiển thị đã lọc sẵn điểm được chấp nhận) thì SD
   sẽ tụt và dải mới hẹp giả tạo. Chốt bằng cách so với SD của CẢ tập, và khẳng định
   nó KHÁC với SD sau khi bỏ điểm vi phạm — thiếu vế sau thì một bản lọc điểm vẫn
   lọt qua khi con số tình cờ gần nhau. */
{
  const points = cleanPoints(20).concat([{ id: 'bad', date: day(20), runId: `${day(20)}-1`, level: 1, lot: 'L1', val: 140 }]);
  const r = candidate(points);
  const all = points.map(p => p.val);
  const withoutViolation = all.slice(0, 20);
  const sd = xs => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); };

  assert.equal(r.c.n, 21, 'điểm vi phạm vẫn được đếm vào n');
  assert.ok(Math.abs(r.c.sd - sd(all)) < 1e-9, 'SD đề xuất phải tính trên TOÀN BỘ điểm, kể cả điểm vi phạm');
  assert.ok(r.c.sd - sd(withoutViolation) > 1, 'SD phải khác rõ rệt so với bản đã loại điểm vi phạm — nếu bằng nhau nghĩa là đã âm thầm lọc điểm');
  assert.equal(r.bad, 1, 'điểm 1-3s phải được đếm là điểm bị loại');
  assert.equal(r.eligible, false, 'còn điểm bị loại thì chặn thẳng, không được lọc điểm ra rồi cho qua');
}

/* --- Từng cổng phải TỰ NÓ quyết định: đổi đúng một biến so với cơ sở --- */
{
  /* 20 kết quả nhưng chỉ 19 ngày (hai điểm cùng ngày) → cổng "ngày độc lập" chặn.
     Đây là cổng dễ mất nhất nếu ai đó đổi days sang đếm số điểm. */
  const sameDay = cleanPoints(19).concat([{ id: 'dup', date: day(0), runId: `${day(0)}-2`, level: 1, lot: 'L1', val: 101 }]);
  const r = candidate(sameDay);
  assert.equal(r.c.n, 20, 'vẫn đủ 20 kết quả');
  assert.equal(r.days, 19, 'nhưng chỉ 19 ngày độc lập');
  assert.equal(r.eligible, false, 'đủ n mà thiếu ngày độc lập thì không được áp dụng');
}
{
  const r = candidate(cleanPoints(19));
  assert.equal(r.days, 19);
  assert.equal(r.c.n, 19);
  assert.equal(r.eligible, false, 'dưới 20 kết quả thì không đủ điều kiện');
}
{
  /* z = 2.5 → chỉ nổ 1-2s, là luật CẢNH BÁO. Cảnh báo cũng phải chặn: dải mới là
     thay đổi cần phê duyệt, không được dựng trên quá trình còn tín hiệu bất thường. */
  const points = cleanPoints(20).concat([{ id: 'warn', date: day(20), runId: `${day(20)}-1`, level: 1, lot: 'L1', val: 125 }]);
  const r = candidate(points);
  assert.equal(r.warn, 1);
  assert.equal(r.bad, 0, 'điểm 1-2s là cảnh báo, không phải điểm bị loại');
  assert.equal(r.eligible, false, 'còn điểm cảnh báo thì chưa được áp dụng dải mới');
}
{
  /* Toàn bộ giá trị giống hệt nhau → SD = 0. Áp dụng dải này thì mọi z sau đó là
     vô cực và Westgard mất tác dụng hoàn toàn. */
  const flat = cleanPoints(20).map(p => ({ ...p, val: 100 }));
  const r = candidate(flat);
  assert.equal(r.c.sd, 0);
  assert.equal(r.eligible, false, 'SD=0 phải bị chặn, nếu không dải mới làm Westgard vô hiệu');
}

/* --- Phạm vi dữ liệu: đúng lô đang vận hành, bỏ điểm đã hủy --- */
{
  const points = cleanPoints(20).concat([
    { id: 'void1', date: day(20), runId: `${day(20)}-1`, level: 1, lot: 'L1', val: 140, voided: true },
    { id: 'lot2', date: day(21), runId: `${day(21)}-1`, level: 1, lot: 'LOT-KHAC', val: 140 },
  ]);
  const r = candidate(points);
  assert.equal(r.c.n, 20, 'điểm đã hủy và điểm của lô khác không được vào phép tính dải mới');
  assert.equal(r.bad, 0);
  assert.equal(r.eligible, true);
}

/* --- Không có dữ liệu: stats() trả null, hàm phải trả về được chứ không nổ --- */
{
  const r = candidate([]);
  assert.equal(r.c, null, 'không có điểm thì stats() trả null');
  assert.equal(r.days, 0);
  assert.equal(r.eligible, false);
}

/* --- Xét nghiệm không tồn tại: openRangeWorkflow() dựa vào r.t/r.l để thoát sớm --- */
{
  run(ctx, '__setState(' + JSON.stringify(baseState(cleanPoints(20))) + ')');
  const missing = JSON.parse(JSON.stringify(run(ctx, '(function(){const r=rangeCandidate("KHONG-CO",1);return{t:r.t===undefined,l:r.l===undefined,eligible:r.eligible};})()')));
  assert.equal(missing.t, true, 'không tìm thấy xét nghiệm thì t phải rỗng để caller thoát sớm');
  assert.equal(missing.eligible, false);
}

/* --- r.nce: dấu hiệu "đang có hồ sơ NCE hệ thống" cho đúng test/mức, dùng để bật
   khối xác nhận 2 điều kiện trước khi áp dụng dải mới (range.js: rangeGateHtml/
   rangeGatePasses). Không ảnh hưởng tới các cổng eligible đã có ở trên. */
{
  const s = baseState(cleanPoints(20));
  s.actions = [{ id: 'a1', nceId: 'NCE-001', date: '2026-01-05', testId: 'T1', level: 1, rule: '8x', recordStatus: 'active', cause: 'Đổi lô hóa chất' }];
  run(ctx, '__setState(' + JSON.stringify(s) + ')');
  const r = JSON.parse(JSON.stringify(run(ctx, 'rangeCandidate("T1",1)')));
  assert.ok(r.nce, 'hồ sơ NCE với luật hệ thống (8x) phải được nhận diện');
  assert.equal(r.nce.id, 'a1');
  assert.equal(r.eligible, true, 'sự có mặt của r.nce không đổi các cổng eligible đã có');
}
{
  const r = candidate(cleanPoints(20));
  assert.equal(r.nce, null, 'không có hồ sơ NCE liên quan thì nce phải là null');
}
{
  /* 1-3s là luật NGẪU NHIÊN (RE), không thuộc nhóm dịch chuyển hệ thống — không
     được kích hoạt khối xác nhận mean-chasing. */
  const s = baseState(cleanPoints(20));
  s.actions = [{ id: 'a1', nceId: 'NCE-002', date: '2026-01-05', testId: 'T1', level: 1, rule: '1-3s', recordStatus: 'active' }];
  run(ctx, '__setState(' + JSON.stringify(s) + ')');
  const r = JSON.parse(JSON.stringify(run(ctx, 'rangeCandidate("T1",1)')));
  assert.equal(r.nce, null, 'luật ngẫu nhiên (RE) không được coi là dịch chuyển hệ thống');
}
{
  /* Hồ sơ đã hủy không còn là căn cứ điều tra hợp lệ — cùng quy tắc mà
     action-workflow-service.js đã áp dụng khi xét một điểm QC có NCE thật hay
     không (actionCancelled). */
  const s = baseState(cleanPoints(20));
  s.actions = [{ id: 'a1', nceId: 'NCE-003', date: '2026-01-05', testId: 'T1', level: 1, rule: '8x', recordStatus: 'cancelled' }];
  run(ctx, '__setState(' + JSON.stringify(s) + ')');
  const r = JSON.parse(JSON.stringify(run(ctx, 'rangeCandidate("T1",1)')));
  assert.equal(r.nce, null, 'hồ sơ NCE đã hủy không được dùng làm căn cứ');
}
{
  /* Nhiều hồ sơ NCE hệ thống: lấy hồ sơ MỚI NHẤT theo ngày. */
  const s = baseState(cleanPoints(20));
  s.actions = [
    { id: 'old', nceId: 'NCE-004', date: '2026-01-01', testId: 'T1', level: 1, rule: '8x', recordStatus: 'active' },
    { id: 'new', nceId: 'NCE-005', date: '2026-01-10', testId: 'T1', level: 1, rule: '4-1s', recordStatus: 'active' },
  ];
  run(ctx, '__setState(' + JSON.stringify(s) + ')');
  const r = JSON.parse(JSON.stringify(run(ctx, 'rangeCandidate("T1",1)')));
  assert.equal(r.nce.id, 'new', 'phải lấy hồ sơ NCE hệ thống mới nhất theo ngày');
}

console.log('rangeCandidate() clinical gate tests passed');
