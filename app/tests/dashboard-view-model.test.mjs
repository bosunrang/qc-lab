import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

// Nạp cùng module và các hàm sắp xếp mà renderer dùng khi chạy thật.
const server = await createServer({ configFile: false, root: fileURLToPath(new URL('../renderer', import.meta.url)), logLevel: 'error',
  appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
let model;
try { model = await server.ssrLoadModule('/view-models/dashboard-view-model.ts'); }
finally { await server.close(); }
const {
  buildDashboardViewModel, normalizeDashboardSearch, daysToExpiry, dashboardShiftStatus, levelTargetOk,
  dashboardNceOverdue, dashboardTestRank, operationalDashboardSummaries,
} = model;

function level(over = {}) {
  return {
    level: 1, mean: 100, sd: 2, qcLotId: 'L1', lot: 'LOT-1', exp: '2026-09-20',
    worstVerdict: 'ok', latestVerdict: 'ok', latestRules: [], pointCount: 5, todayPointCount: 1,
    cv: 1.5, latest: { date: '2026-09-01', runId: '1', val: 100 }, ...over,
  };
}

// ── 1) Điểm CUỐI quyết định, không phải điểm xấu nhất ─────────────────────
// Mức từng vi phạm (worstVerdict='rej') nhưng điểm mới nhất đã đạt
// (latestVerdict='ok') thì KHÔNG được vào "Cần xử lý" và không làm xét
// nghiệm đỏ. Đây chính là chỗ bản trước sai.
const healed = buildDashboardViewModel([{
  testId: 'T1', testName: 'Glucose', instrumentName: 'May A', unit: 'mmol/L', decimalPlaces: 2,
  levels: [level({ worstVerdict: 'rej', latestVerdict: 'ok' })],
}], [], []);
assert.equal(healed.tests[0].status, 'ok', 'da khac phuc xong thi khong con bao do');
assert.equal(healed.urgent.length, 0);
assert.equal(healed.kpi.rejected, 0);

// ── 2) Một dòng cho mỗi MỨC, kèm đúng điểm + luật của mức đó ──────────────
const alerting = buildDashboardViewModel([{
  testId: 'T1', testName: 'Sodium (Na)', instrumentName: 'May A', unit: 'mmol/L', decimalPlaces: 2,
  levels: [
    level({ level: 1, latestVerdict: 'warn', latestRules: ['1-2s'], latest: { date: '2026-09-01', runId: '1', val: 104 } }),
    level({ level: 2, qcLotId: 'L2', lot: 'LOT-2', latestVerdict: 'rej', latestRules: ['1-3s'], latest: { date: '2026-09-02', runId: '1', val: 109.5 } }),
  ],
}], [], []);
assert.equal(alerting.tests[0].status, 'rej', 'xet nghiem lay muc xau nhat trong cac diem cuoi');
assert.equal(alerting.urgent.length, 1);
assert.equal(alerting.watch.length, 1);
assert.equal(alerting.urgent[0].level.level, 2, 'dong "loai bo" phai la muc 2');
assert.deepEqual(alerting.urgent[0].rules, ['1-3s'], 'kem dung luat cua muc do');
assert.equal(alerting.urgent[0].point.val, 109.5, 'kem dung diem cuoi cua muc do');
assert.equal(alerting.watch[0].level.level, 1);
assert.deepEqual(alerting.watch[0].rules, ['1-2s']);
// 1 xét nghiệm bị loại → chỉ đếm 1 lần ở KPI dù có 2 mức báo động
assert.equal(alerting.kpi.rejected, 1);
assert.equal(alerting.kpi.warnings, 0, 'xet nghiem da tinh la rej thi khong dem lai o warn');

// ── 3) % hoàn tất theo XÉT NGHIỆM, không theo MỨC ─────────────────────────
// 1 xét nghiệm 2 mức, chỉ 1 mức có điểm hôm nay → xét nghiệm CHƯA đủ QC:
// 0/1 xét nghiệm, 0%. (Theo mức sẽ ra 50% — con số bản trước hiển thị sai.)
const halfDone = buildDashboardViewModel([{
  testId: 'T1', testName: 'Glucose', instrumentName: 'May A', unit: 'mmol/L', decimalPlaces: 2,
  levels: [level({ level: 1, todayPointCount: 1 }), level({ level: 2, todayPointCount: 0 })],
}], [], []);
assert.equal(halfDone.kpi.completeTests, 0);
assert.equal(halfDone.kpi.completionPercent, 0);
assert.equal(halfDone.kpi.missingToday, 1);
assert.equal(halfDone.kpi.todayPoints, 1, 'todayPoints van dem theo MUC da co diem hom nay');

// ── 4) daysToExpiry: đếm theo NGÀY LỊCH, không phụ thuộc giờ trong ngày ───
// Trước 2026-09-27 phép tính so với giờ hiện tại nên buổi chiều ra số khác
// buổi sáng, và đúng ngày hết hạn mà quá 12 giờ trưa thì hiện "Hết hạn 1 ngày".
const afternoon = new Date(2026, 8, 2, 15, 45, 0);
assert.equal(daysToExpiry('2026-09-20', afternoon), 18);
assert.equal(daysToExpiry('2026-09-20', new Date(2026, 8, 2, 8, 0, 0)), 18, 'sáng hay chiều cùng một số ngày');
assert.equal(daysToExpiry('2026-08-31', afternoon), -2);
assert.equal(daysToExpiry('2026-09-02', new Date(2026, 8, 2, 13, 0, 0)), 0, 'đúng ngày hết hạn là 0, chưa phải "hết hạn 1 ngày"');
assert.equal(daysToExpiry('', afternoon), null);

// ── 5) Gom lô sắp hết hạn theo lô, giữ ngày gần nhất, đếm số mức dùng chung
const shared = buildDashboardViewModel([
  {
    testId: 'T1', testName: 'Glucose', instrumentName: 'May A', unit: 'mmol/L', decimalPlaces: 2,
    levels: [level({ level: 1, qcLotId: 'L1', lot: 'LOT-1', exp: '2026-09-20' })],
  },
  {
    testId: 'T2', testName: 'Urea', instrumentName: 'May A', unit: 'mmol/L', decimalPlaces: 2,
    levels: [level({ level: 1, qcLotId: 'L1', lot: 'LOT-1', exp: '2026-09-20' }), level({ level: 2, qcLotId: 'L9', lot: 'LOT-9', exp: '2030-01-01' })],
  },
], [], [], afternoon);
assert.equal(shared.expiringLots.length, 1, 'lo dung chung chi hien 1 dong; lo con han 3 nam khong hien');
assert.equal(shared.expiringLots[0].count, 2, 'dem dung 2 muc dung chung lo L1');
assert.equal(shared.expiringLots[0].days, 18);

assert.deepEqual(dashboardShiftStatus({ rejected: 1, overdueActions: 9, warnings: 9, missingToday: 9 }), {
  mood: 'Cần xử lý ngay', text: 'Có xét nghiệm đang bị loại, ưu tiên kiểm tra và ghi nhận khắc phục.',
});
assert.equal(dashboardShiftStatus({ rejected: 0, overdueActions: 2, warnings: 9, missingToday: 9 }).text,
  '2 hồ sơ khắc phục đã qua hạn xử lý mà chưa khép vòng.');
assert.equal(dashboardShiftStatus({ rejected: 0, overdueActions: 0, warnings: 1, missingToday: 9 }).mood, 'Có cảnh báo cần theo dõi');
assert.equal(dashboardShiftStatus({ rejected: 0, overdueActions: 0, warnings: 0, missingToday: 1 }).mood, 'Còn QC cần nhập');
assert.equal(dashboardShiftStatus({ rejected: 0, overdueActions: 0, warnings: 0, missingToday: 0 }).mood, 'Đang trong kiểm soát');
// Hồ sơ NCE quá hạn cũng phải đi vào mood qua model, không chỉ qua hàm thuần
assert.equal(buildDashboardViewModel([], [], [{ id: 'N1' }]).mood, 'Có hồ sơ NCE quá hạn');

// ── 7) Mức thiếu Mean/SD: vào noTarget theo MỨC, không theo xét nghiệm ────
const noTarget = buildDashboardViewModel([{
  testId: 'T1', testName: 'Glucose', instrumentName: 'May A', unit: 'mmol/L', decimalPlaces: 2,
  levels: [level({ level: 1 }), level({ level: 2, mean: null, sd: null }), level({ level: 3, sd: 0 })],
}], [], []);
assert.equal(noTarget.noTarget.length, 2, 'ca muc thieu Mean/SD lan muc SD=0 deu tinh la chua co dai');
assert.deepEqual(noTarget.noTarget.map(item => item.level.level), [2, 3]);
assert.equal(levelTargetOk(level({ sd: 0 })), false);
assert.equal(levelTargetOk(level()), true);
assert.equal(levelTargetOk(level({ mean: null, sd: 2 })), false, 'thiếu Mean không được ép thành 0 rồi coi là đủ dải');
assert.equal(levelTargetOk(level({ mean: 0, sd: 2 })), true, 'Mean bằng 0 thật vẫn là giá trị hữu hạn');
assert.equal(levelTargetOk(level({ mean: NaN })), false);
const missingMean = buildDashboardViewModel([{
  testId: 'T-missing', testName: 'Thiếu Mean', levels: [level({ mean: null, sd: 2 })],
}], [], []);
assert.equal(missingMean.noTarget.length, 1, 'mức thiếu Mean phải xuất hiện trong nhắc thiết lập dải');

// Cột Gần nhất phải dùng cùng thứ tự lần chạy tự nhiên với bảng lịch sử,
// kể cả khi hai mức có điểm cuối khác nhau trong cùng ngày.
for (const prefix of ['', '2026-11-12-']) {
  const latest = buildDashboardViewModel([{
    testId: 'T-order', testName: 'Nhiều lần chạy', levels: [
      level({ level: 1, latest: { date: '2026-11-12', runId: `${prefix}10`, val: 110 } }),
      level({ level: 2, latest: { date: '2026-11-12', runId: `${prefix}2`, val: 102 } }),
      level({ level: 3, latest: { date: '2026-11-11', runId: `${prefix}99`, val: 99 } }),
    ],
  }], [], []);
  assert.equal(latest.tests[0].latest.runId, `${prefix}10`);
  assert.equal(latest.tests[0].latest.level, 1);
  assert.equal(latest.tests[0].latest.val, 110);
}

// ── 8) Tìm kiếm bỏ dấu ───────────────────────────────────────────────────
assert.equal(normalizeDashboardSearch('Điện Giải'), 'dien giai');
assert.equal(normalizeDashboardSearch(null), '');

// ── 9) Chỉ lấy xét nghiệm thực sự đang vận hành ──────────────────────────
const operationalSource = [
  { testId: 'T1', testName: 'Panel trước', levels: [level()] },
  { testId: 'T2', testName: 'Panel sau', levels: [level()] },
  { testId: 'T3', testName: 'Test tắt', levels: [level()] },
  { testId: 'T4', testName: 'Không có nhóm lô', levels: [] },
  { testId: 'T5', testName: 'Panel tắt', levels: [level()] },
];
const operational = operationalDashboardSummaries(
  operationalSource,
  [
    { id: 'T1', active: 1 }, { id: 'T2', active: 1 }, { id: 'T3', active: 0 },
    { id: 'T4', active: 1 }, { id: 'T5', active: 1 },
  ],
  [
    { id: 'P0', active: 0, testIds: ['T5'] },
    { id: 'P1', active: 1, testIds: ['T2'] },
    { id: 'P2', active: 1, testIds: ['T1', 'T3', 'T4'] },
  ],
);
assert.deepEqual(operational.map(item => item.testId), ['T2', 'T1'], 'lọc đủ active/panel/nhóm lô và giữ thứ tự Panel');

// ── 10) Hồ sơ quá hạn: số ngày và tên người phụ trách do main tính
// (`overdue_days`, `owner_name`), ở đây chỉ dựng nhãn. Quy tắc nằm ở
// `domain/nce/overdue.ts`, test ở nce-domain-queue.test.mjs.
const nce = (over = {}) => ({ id: 'N1', due_date: '2026-09-01', status: 'open', owner_name: 'Nguyễn An', overdue_days: 3, ...over });
assert.deepEqual(dashboardNceOverdue(nce()), {
  overdue: true, days: 3, label: 'Quá hạn 3 ngày', owner: 'Nguyễn An',
});
assert.deepEqual(dashboardNceOverdue(nce({ overdue_days: 0 })), { overdue: false, days: 0, label: '', owner: 'Nguyễn An' });
assert.equal(dashboardNceOverdue(null).overdue, false);

// ── 11) Thứ tự bảng: loại → cảnh báo → chưa QC → đạt ───────────────────
assert.deepEqual([
  { status: 'ok', todayCount: 1, levels: [level()] },
  { status: 'ok', todayCount: 0, levels: [level()] },
  { status: 'warn', todayCount: 1, levels: [level()] },
  { status: 'rej', todayCount: 1, levels: [level()] },
].sort((a, b) => dashboardTestRank(a) - dashboardTestRank(b)).map(item => `${item.status}:${item.todayCount}`), [
  'rej:1', 'warn:1', 'ok:0', 'ok:1',
]);

console.log('app dashboard view-model tests passed');


