const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const QCCore = require('../assets/core.js');

/* tests/westgard-worker.test.js đã chốt computeWestgardJob() (hàm thuần) khớp main
 * thread, gọi thẳng qua module.exports của Node. Nhưng self.onmessage — cái THẬT SỰ
 * chạy trong trình duyệt khi worker nhận job từ qc-domain.js — chưa test nào chạm tới:
 * nhánh module.exports của file này return SỚM trước khi gán self.onmessage, nên
 * require() trong Node không bao giờ thực thi dòng đó. Đây là lớp bọc mỏng nhưng là
 * đúng ranh giới đã từng lệch trong quá khứ (worker chép tay bảng luật riêng, xem
 * WG_RULE_REGISTRY ở core.js) — nếu onmessage quên post kết quả, hoặc nuốt lỗi thay vì
 * báo type:'error', dashboard sẽ treo ở "đang phân tích nền" vĩnh viễn mà không log gì.
 */
const workerSource = fs.readFileSync(path.join(__dirname, '..', 'assets', 'workers', 'westgard-worker.js'), 'utf8');

function runWorker(context) {
  vm.runInContext(workerSource, context, { filename: 'workers/westgard-worker.js' });
}

const job = {
  type: 'compute', generation: 3, revision: 1, testId: 'T1',
  levels: [{
    level: 1, mean: 100, sd: 10,
    points: [
      { id: 'p1', level: 1, date: '2026-07-01', runId: '2026-07-01-1', val: 131, qcMean: 100, qcSd: 10 },
      { id: 'p2', level: 1, date: '2026-07-02', runId: '2026-07-02-1', val: 104, qcMean: 100, qcSd: 10 },
    ],
  }],
  globalRules: Object.fromEntries(QCCore.WG_RULES.map(rule => [rule, true])),
  ruleActions: {},
};

// 1) Duong thanh cong: self.onmessage phai goi computeWestgardJob va post dung ket qua.
{
  const posted = [];
  const self = { postMessage: msg => posted.push(msg), QCCore };
  const context = vm.createContext({ self });
  runWorker(context);
  assert.equal(typeof context.self.onmessage, 'function', 'self.onmessage phai duoc gan khi chay trong worker that (khong co module.exports)');

  context.self.onmessage({ data: job });
  assert.equal(posted.length, 1, 'phai post dung mot lan cho moi job');
  assert.equal(posted[0].type, 'result');
  assert.equal(posted[0].generation, 3);
  assert.equal(posted[0].testId, 'T1');
  assert.equal(posted[0].levels.length, 1);

  // Job khong phai 'compute' (vd job cu con soc lai tu postMessage khac) phai bi bo qua im lang.
  context.self.onmessage({ data: { type: 'ping' } });
  assert.equal(posted.length, 1, 'job khong phai compute khong duoc post gi them');
}

// 2) Duong loi: neu QCCore chua san sang (importScripts that bai/race luc khoi dong),
//    onmessage phai bat loi va post type:'error' thay vi de exception roi mat tich trong worker.
{
  const posted = [];
  const self = { postMessage: msg => posted.push(msg) }; // KHONG gan self.QCCore
  const context = vm.createContext({ self });
  runWorker(context);

  context.self.onmessage({ data: job });
  assert.equal(posted.length, 1, 'ngay ca khi tinh toan loi cung phai post dung mot thong bao');
  assert.equal(posted[0].type, 'error');
  assert.equal(posted[0].generation, job.generation);
  assert.equal(posted[0].testId, job.testId);
  assert.equal(typeof posted[0].message, 'string');
}

console.log('Westgard worker onmessage tests passed');
