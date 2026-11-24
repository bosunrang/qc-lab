// Tổng hợp và đường thu nhỏ phải giữ xếp loại chính thức, mẫu và đợt thiếu.
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let server;
let model;
before(async () => {
  server = await createServer({ configFile: false, root: fileURLToPath(new URL('../renderer', import.meta.url)),
    logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] } });
  model = await server.ssrLoadModule('/pages/eqa/overview-model.ts');
});
after(async () => { await server?.close(); });
const rounds = ['r1', 'r2', 'r3'].map((id) => ({ id }));
const cell = (id, round, z, cls = 'ok', sample = '') => ({ result_id: id, round_id: round, z, class: cls, sample });
const row = (id, cells) => ({ test_id: id, test_name: id, unit: 'mmol/L', cells });

test('ngoại kiểm: danh sách đợt giữ số liệu từng máy, bỏ đợt không có máy và giữ đợt đã huỷ để tra cứu', () => {
  const a = { instrument_id: 'a', instrument_name: 'Máy 1', total: 2, ok: 2, warn: 0, rej: 0 };
  const b = { instrument_id: 'b', instrument_name: 'Máy 2', total: 3, ok: 1, warn: 1, rej: 1 };
  const round = (id, by_instrument, extra = {}) => ({ id, year: 2026, program_id: 'p', status: 'open', by_instrument, total: 5, ok: 3, warn: 1, rej: 1, ...extra });
  const shared = round('shared', [a, b]), onlyA = round('only-a', [a]), cancelled = round('cancelled', [a, b], { status: 'cancelled' });
  const data = [shared, onlyA, cancelled, round('old-year', [b], { year: 2025 }), round('other-program', [b], { program_id: 'other' })];
  const selected = model.overviewRoundRows(data, 2026, 'p', 'b');
  assert.deepEqual(selected.map(item => item.round.id), ['shared', 'cancelled']);
  assert.deepEqual(selected.map(item => item.instrument), [b, b]);
  assert.equal(selected[0].instrument.total, 3, 'không dùng tổng 5 kết quả của cả báo cáo');
  assert.equal(selected[0].instrument.rej, 1, 'giữ xếp loại main đã trả về');
  assert.deepEqual(model.overviewRoundRows(data, 2026, 'p', 'missing'), []);
  assert.deepEqual(model.overviewRoundRows(data, 2026, 'p', '').map(item => [item.round.id, item.instrument.instrument_id]),
    [['shared', 'a'], ['shared', 'b'], ['only-a', 'a'], ['cancelled', 'a'], ['cancelled', 'b']], 'tất cả máy vẫn tách từng máy thành dòng riêng');
});

test('ngoại kiểm: tỷ lệ tính theo kết quả đã nhập, dùng xếp loại main và không coi ô thiếu là đạt', () => {
  const totals = model.overviewTotals([row('Na', [cell('a', 'r1', 3.2, 'ok'), cell('b', 'r2', 2.4, 'warn')]), row('K', [cell('c', 'r1', -3.5, 'rej')])]);
  assert.deepEqual(totals, { total: 3, ok: 1, warn: 1, rej: 1, acceptPct: 100 / 3 });
  assert.equal(model.overviewTotals([]).acceptPct, null, 'chưa có dữ liệu không hiển thị tỷ lệ 0% hoặc 100%');
});

test('ngoại kiểm: lọc xét nghiệm vẫn giữ các mẫu, đợt và kết quả đạt để đối chiếu', () => {
  const rows = [row('Na', [cell('a', 'r1', 1), cell('b', 'r2', -3.4, 'rej')]), row('K', [cell('c', 'r1', 2.2, 'warn')])];
  assert.deepEqual(model.filterOverviewRows(rows, 'rej'), [rows[0]]);
  assert.equal(model.filterOverviewRows(rows, 'rej')[0].cells.length, 2);
  assert.deepEqual(model.filterOverviewRows(rows, 'warn'), [rows[1]]);
  assert.equal(model.filterOverviewRows(rows, 'attention').length, 2);
  assert.equal(model.filterOverviewRows(rows, 'ok').length, 1);
});

test('ngoại kiểm: không tự chọn ô nặng nhất; loại URL sai điểm hoặc sai đợt', () => {
  const rows = [row('Na', [cell('p1', 'r1', -3.4, 'rej')])];
  const select = (query) => model.overviewSelection(rows, rounds, new URLSearchParams(query));
  assert.equal(select(''), undefined);
  assert.equal(select('assay=Na&round=r2&point=p1'), undefined);
  assert.equal(select('assay=Na&round=r1&point=unknown'), undefined);
  assert.equal(select('assay=Na&round=outside&point=p1'), undefined);
  assert.deepEqual(select('assay=Na&round=r1&point=p1'), { testId: 'Na', roundId: 'r1', resultId: 'p1', sample: '' });
  assert.deepEqual(select('assay=Na&round=r2&sample=B'), { testId: 'Na', roundId: 'r2', resultId: undefined, sample: 'B' });
});

test('ngoại kiểm: đường z tách mẫu A/B, ngắt ở đợt thiếu và dùng chung thang đo', () => {
  const values = row('Na', [cell('a1', 'r1', 1, 'ok', 'A'), cell('a3', 'r3', 2, 'ok', 'A'), cell('b1', 'r1', -1, 'ok', 'B'), cell('b2', 'r2', -2.5, 'warn', 'B')]);
  const [a, b] = model.overviewSparkline(values, rounds, 4);
  assert.equal(a.sample, 'A');
  assert.equal(b.sample, 'B');
  assert.equal((a.path.match(/M/g) ?? []).length, 2, 'thiếu r2 của mẫu A phải ngắt đường');
  assert.equal((b.path.match(/L/g) ?? []).length, 1, 'chỉ nối hai đợt liền nhau của mẫu B');
  assert.deepEqual(a.points.map((point) => point.x), [6, 106]);
  assert.equal(a.points[0].y, 16);
  assert.equal(b.points[0].y, 24, 'hai giá trị ±1 đối xứng theo cùng thang z');
  const single = model.overviewSparkline(row('K', [cell('only', 'r1', 0)]), [rounds[0]], 4);
  assert.equal(single[0].points[0].x, 56);
});
