// Hàng chờ theo lần chạy (D-01, D-14), tái diễn, quá hạn và cấu hình NCE.
// Ca nghiệm thu 1, 20; phần quá hạn của ca 16.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { buildNceQueue } = require('../../app-dist/main/domain/nce/queue.js');
const { nceIsRecurrence } = require('../../app-dist/main/domain/nce/tier.js');
const { nceRecordOverdueDays, nceActionOverdueDays } = require('../../app-dist/main/domain/nce/overdue.js');
const { prepareNceConfig, defaultNceDueDate, NCE_DEFAULT_CONFIG } = require('../../app-dist/main/domain/nce/config.js');

const qp = (testId, date, runId, level, verdict, rules = []) => ({ pointId: `${testId}-${date}-${runId}-${level}`, testId, date, runId, level, lot: `L${level}`, verdict, rules });

test('ca 1: một lần chạy hỏng hai mức là MỘT dòng hàng chờ', () => {
  const rows = buildNceQueue([
    qp('T1', '2026-10-01', '1', 1, 'rej', ['R4s']), qp('T1', '2026-10-01', '1', 2, 'rej', ['R4s']),
  ], []);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].rejectedLevels.map((l) => l.level), [1, 2]);
  assert.equal(rows[0].record, null);
});

test('ca 20: lần chạy chỉ có cảnh báo không vào hàng chờ', () => {
  const rows = buildNceQueue([qp('T1', '2026-10-01', '1', 1, 'warn', ['1-2s']), qp('T1', '2026-10-01', '1', 2, 'ok')], []);
  assert.deepEqual(rows, []);
});

test('lần chạy thuộc hồ sơ đã đóng rời hàng chờ; đang xử lý thì hiện để mở tiếp; đã hủy coi như chưa có', () => {
  const points = [qp('T1', '2026-10-01', '1', 2, 'rej', ['1-3s'])];
  const run = { date: '2026-10-01', runId: '1' };
  assert.deepEqual(buildNceQueue(points, [{ id: 'r1', nceId: 'NCE-1', status: 'closed', testId: 'T1', runs: [run] }]), []);
  assert.deepEqual(buildNceQueue(points, [{ id: 'r1', nceId: 'NCE-1', status: 'released', testId: 'T1', runs: [run] }])[0].record, { id: 'r1', nceId: 'NCE-1' });
  assert.equal(buildNceQueue(points, [{ id: 'r1', nceId: 'NCE-1', status: 'cancelled', testId: 'T1', runs: [run] }])[0].record, null);
});

test('lần hỏng tiếp theo được gợi ý gắn vào hồ sơ đang mở, chưa cho chạy lại, cùng xét nghiệm', () => {
  const points = [qp('T1', '2026-10-01', '1', 2, 'rej', ['1-3s']), qp('T1', '2026-10-01', '2', 2, 'rej', ['1-3s']), qp('T2', '2026-10-01', '3', 1, 'rej', ['1-3s'])];
  const open = { id: 'r1', nceId: 'NCE-1', status: 'open', testId: 'T1', runs: [{ date: '2026-10-01', runId: '1' }] };
  const rows = buildNceQueue(points, [open]);
  const second = rows.find((row) => row.testId === 'T1' && row.runId === '2');
  assert.deepEqual(second.attachTo, { id: 'r1', nceId: 'NCE-1' });
  assert.equal(rows.find((row) => row.testId === 'T2').attachTo, null, 'khác xét nghiệm không gợi ý');
  const released = buildNceQueue(points, [{ ...open, status: 'released' }]).find((row) => row.runId === '2');
  assert.equal(released.attachTo, null, 'đã cho chạy lại thì lần hỏng mới là sự kiện mới');
});

test('hàng chờ xếp lần chạy mới nhất lên trước, mã run theo thứ tự tự nhiên', () => {
  const rows = buildNceQueue([qp('T1', '2026-10-01', '9', 1, 'rej'), qp('T1', '2026-10-01', '10', 1, 'rej'), qp('T1', '2026-09-30', '1', 1, 'rej')], []);
  assert.deepEqual(rows.map((row) => `${row.date}/${row.runId}`), ['2026-10-01/10', '2026-10-01/9', '2026-09-30/1']);
});

test('tái diễn: cùng xét nghiệm, cùng loại sai số, trong cửa sổ, không tính hồ sơ hủy', () => {
  const current = { id: 'c', testId: 'T1', source: 'iqc', errorClass: 'SE', detectedDate: '2026-10-01', cancelled: false };
  const other = (over) => ({ id: 'o', testId: 'T1', source: 'iqc', errorClass: 'SE', detectedDate: '2026-08-01', cancelled: false, ...over });
  assert.equal(nceIsRecurrence(current, [other()], 90), true);
  assert.equal(nceIsRecurrence(current, [other({ detectedDate: '2026-06-01' })], 90), false, 'ngoài cửa sổ');
  assert.equal(nceIsRecurrence(current, [other({ errorClass: 'RE' })], 90), false);
  assert.equal(nceIsRecurrence(current, [other({ testId: 'T2' })], 90), false);
  assert.equal(nceIsRecurrence(current, [other({ cancelled: true })], 90), false);
  assert.equal(nceIsRecurrence(current, [{ ...current }], 90), false, 'không tự so với chính nó');
  assert.equal(nceIsRecurrence({ ...current, errorClass: '' }, [other({ errorClass: '' })], 90), false, 'thiếu loại sai số thì không đoán');
});

test('quá hạn của hồ sơ và hành động', () => {
  assert.equal(nceRecordOverdueDays({ status: 'open', dueDate: '2026-10-01' }, '2026-10-04'), 3);
  assert.equal(nceRecordOverdueDays({ status: 'pending_approval', dueDate: '2026-10-01' }, '2026-10-04'), 3, 'chậm duyệt cũng là chậm khép hồ sơ');
  assert.equal(nceRecordOverdueDays({ status: 'closed', dueDate: '2026-10-01' }, '2026-10-04'), 0);
  assert.equal(nceRecordOverdueDays({ status: 'open', dueDate: '2026-10-04' }, '2026-10-04'), 0, 'đến hạn hôm nay chưa quá hạn');
  assert.equal(nceRecordOverdueDays({ status: 'open', dueDate: '' }, '2026-10-04'), 0);
  assert.equal(nceActionOverdueDays({ status: 'open', dueDate: '2026-10-01' }, '2026-10-02'), 1);
  assert.equal(nceActionOverdueDays({ status: 'done', dueDate: '2026-10-01' }, '2026-10-02'), 0);
});

test('cấu hình: giá trị hỏng về mặc định; ngoại lệ phân tách cần mã SOP', () => {
  assert.deepEqual(prepareNceConfig(null), NCE_DEFAULT_CONFIG);
  const config = prepareNceConfig({ dueDays: { low: 3, capa: 0 }, recurrenceWindowDays: 'x', separationException: { enabled: true, sopRef: '  ' } });
  assert.deepEqual(config.dueDays, { low: 3, capa: 30 });
  assert.equal(config.recurrenceWindowDays, 90);
  assert.equal(config.separationException.enabled, false);
  assert.equal(prepareNceConfig({ separationException: { enabled: true, sopRef: 'SOP-QM-02' } }).separationException.enabled, true);
});

test('hạn mặc định theo tầng; chưa phân tầng dùng hạn ngắn hơn', () => {
  assert.equal(defaultNceDueDate('2026-10-28', 'low'), '2026-11-04');
  assert.equal(defaultNceDueDate('2026-10-28', 'capa'), '2026-11-27');
  assert.equal(defaultNceDueDate('2026-10-28', ''), '2026-11-04');
  assert.equal(defaultNceDueDate('', 'low'), '');
});
