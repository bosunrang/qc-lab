import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

let server, dashboard, eqa, report;
before(async () => {
  server = await createServer({ configFile: false, root: fileURLToPath(new URL('../renderer', import.meta.url)), logLevel: 'error',
    appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
  ({ useDashboardStore: dashboard } = await server.ssrLoadModule('/store/dashboard-store.ts'));
  ({ useEqaStore: eqa } = await server.ssrLoadModule('/store/eqa-store.ts'));
  ({ useReportStore: report } = await server.ssrLoadModule('/store/report-store.ts'));
});
after(async () => { await server?.close(); });

function setup(t, method) {
  const previousWindow = globalThis.window;
  const pending = [];
  globalThis.window = { qcApi: {
    listTestSummaries: async () => [], listNce: async () => [], listLots: async () => [],
    listTests: async () => [{ id: 'old', active: 1 }, { id: 'new', active: 1 }],
    listPanels: async () => [{ active: 1, testIds: ['old', 'new'] }],
    listEqaRounds: async () => [], listEqaSchedule: async () => [], listEqaPrograms: async () => [],
    [method]: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
  } };
  dashboard.setState({ testSummaries: [], overdueActions: [], lots: [], loading: true, error: null });
  eqa.setState({ rounds: [], schedule: [], programs: [], loading: false, loaded: false, error: '' });
  report.setState({ review: null, reviewLoading: false });
  t.after(() => { globalThis.window = previousWindow; });
  return pending;
}
const summaries = (id) => [{ testId: id, levels: [{}] }];

test('Tổng quan: phản hồi cũ không ghi đè dữ liệu mới', async (t) => {
  const pending = setup(t, 'listTestSummaries');
  const old = dashboard.getState().load(), latest = dashboard.getState().load();
  pending[1].resolve(summaries('new')); await latest;
  pending[0].resolve(summaries('old')); await old;
  assert.equal(dashboard.getState().testSummaries[0].testId, 'new');
});

test('Tổng quan: lỗi cũ đến muộn không che kết quả tải thành công', async (t) => {
  const pending = setup(t, 'listTestSummaries');
  const old = dashboard.getState().load(), latest = dashboard.getState().load();
  pending[1].resolve(summaries('new')); await latest;
  pending[0].reject(new Error('Mất mạng ở lượt cũ')); await old;
  assert.equal(dashboard.getState().error, null);
  assert.equal(dashboard.getState().testSummaries[0].testId, 'new');
});

test('Ngoại kiểm: phản hồi cũ không thay đợt, lịch và chương trình mới', async (t) => {
  const pending = setup(t, 'listEqaRounds');
  const old = eqa.getState().load(), latest = eqa.getState().load();
  pending[1].resolve([{ id: 'new' }]); await latest;
  pending[0].resolve([{ id: 'old' }]); await old;
  assert.equal(eqa.getState().rounds[0].id, 'new');
  assert.equal(eqa.getState().error, '');
});

test('Ngoại kiểm: lỗi cũ không xoá trạng thái tải mới đã thành công', async (t) => {
  const pending = setup(t, 'listEqaRounds');
  const old = eqa.getState().load(), latest = eqa.getState().load();
  pending[1].resolve([{ id: 'new' }]); await latest;
  pending[0].reject(new Error('Mất mạng ở lượt cũ')); await old;
  assert.equal(eqa.getState().error, '');
  assert.equal(eqa.getState().rounds[0].id, 'new');
});

test('Ngoại kiểm: lượt cũ không hạ cờ tải trong lúc lượt mới còn chờ', async (t) => {
  const pending = setup(t, 'listEqaRounds');
  const old = eqa.getState().load(), latest = eqa.getState().load();
  pending[0].resolve([{ id: 'old' }]); await old;
  assert.equal(eqa.getState().loading, true);
  pending[1].resolve([{ id: 'new' }]); await latest;
  assert.equal(eqa.getState().loading, false);
});

test('Ngoại kiểm: lỗi mới nhất vẫn hiện và lần thử lại cập nhật được dữ liệu', async (t) => {
  const pending = setup(t, 'listEqaRounds');
  const failed = eqa.getState().load();
  pending[0].reject(new Error('Không kết nối được máy chủ')); await failed;
  assert.equal(eqa.getState().error, 'Không kết nối được máy chủ');
  assert.equal(eqa.getState().loading, false);
  const retry = eqa.getState().load();
  pending[1].resolve([{ id: 'retried' }]); await retry;
  assert.equal(eqa.getState().rounds[0].id, 'retried');
  assert.equal(eqa.getState().error, '');
});

test('Biên bản tháng: lỗi tải mở lại nút thử lại, giữ dữ liệu đã có', async (t) => {
  const pending = setup(t, 'getQcMonthlyReview');
  const saved = { ym: '2026-11' };
  report.setState({ review: saved });
  const failed = report.getState().loadReview('2026-11');
  pending[0].reject(new Error('Không kết nối được máy chủ'));
  await assert.rejects(failed, /Không kết nối được máy chủ/);
  assert.equal(report.getState().reviewLoading, false);
  assert.equal(report.getState().review, saved);
  const retry = report.getState().loadReview('2026-11');
  pending[1].resolve({ ym: '2026-11', retried: true }); await retry;
  assert.equal(report.getState().review.retried, true);
  assert.equal(report.getState().reviewLoading, false);
});

test('Biên bản tháng: lỗi tháng cũ không hạ cờ tổng hợp tháng mới', async (t) => {
  const pending = setup(t, 'getQcMonthlyReview');
  const old = report.getState().loadReview('2026-10'), latest = report.getState().loadReview('2026-11');
  pending[0].reject(new Error('Lỗi lượt cũ'));
  await assert.rejects(old, /Lỗi lượt cũ/);
  assert.equal(report.getState().reviewLoading, true);
  pending[1].resolve({ ym: '2026-11' }); await latest;
  assert.equal(report.getState().review.ym, '2026-11');
  assert.equal(report.getState().reviewLoading, false);
});
