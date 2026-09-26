// Cổng ghi `writeCommand()`: kiểm quyền trước, ghi trong một transaction, bắt
// buộc có nhật ký và khai bảng đổi, chỉ báo renderer sau khi commit; thiếu
// bước nào thì huỷ toàn bộ phần ghi thay vì để lại dữ liệu nửa vời.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { writeCommand, WRITE_COMMAND, WriteCommandError } = require('../../app-dist/main/ipc/write-command.js');
const { addChangeListener } = require('../../app-dist/main/ipc/shared.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');

const admin = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
const tech = { ...admin, userId: 'u2', username: 'ktv', role: 'technician' };
const viewer = { ...admin, userId: 'u3', username: 'xem', role: 'viewer' };

function setup() {
  const db = openDatabase(':memory:');
  db.exec('CREATE TABLE wc_probe(id TEXT PRIMARY KEY, val TEXT)');
  const events = [];
  const stop = addChangeListener((payload) => events.push(payload));
  const rows = () => db.prepare('SELECT id, val FROM wc_probe ORDER BY id').all().map((r) => ({ ...r }));
  const audits = () => db.prepare("SELECT type FROM activity WHERE type LIKE 'wc:%' ORDER BY seq").all().map((r) => r.type);
  return { db, events, stop, rows, audits };
}

test('kiểm quyền TRƯỚC khi chạy thân handler', () => {
  const { db, stop } = setup();
  let ran = 0;
  const save = writeCommand(db, 'probe', 'write', () => { ran++; return { ok: false, error: { code: 'x', message: 'x' } }; });
  const configure = writeCommand(db, 'probeAdmin', 'admin', () => { ran++; return { ok: false, error: { code: 'x', message: 'x' } }; });
  assert.equal(save(viewer).error.code, 'forbidden');
  assert.equal(configure(tech).error.code, 'forbidden');
  assert.equal(ran, 0, 'thân handler không chạy khi bị từ chối');
  save(tech); configure(admin);
  assert.equal(ran, 2);
  stop();
});

test('ghi, nhật ký và báo thay đổi đúng thứ tự; lời báo chỉ gửi sau commit', () => {
  const { db, events, stop, rows, audits } = setup();
  let seenInsideTx = null;
  const save = writeCommand(db, 'probe', 'write', (w, input) => {
    const value = w.commit((tx) => {
      db.prepare('INSERT INTO wc_probe(id,val) VALUES (?,?)').run(input.id, input.val);
      tx.audit('wc:lưu', `giá trị ${input.val}`, input.id);
      tx.changed(['wc_probe'], ['t1']);
      tx.changed(['actions']);
      seenInsideTx = events.filter((e) => e.tables[0] !== 'activity').length;
      return input.id;
    });
    return { ok: true, data: value };
  });
  assert.deepEqual(save({ id: 'a', val: '1' }, tech), { ok: true, data: 'a' });
  assert.deepEqual(rows(), [{ id: 'a', val: '1' }]);
  assert.deepEqual(audits(), ['wc:lưu']);
  assert.equal(seenInsideTx, 0, 'chưa commit thì chưa báo renderer');
  assert.deepEqual(events.filter((e) => e.tables[0] !== 'activity'), [
    { tables: ['wc_probe'], testIds: ['t1'] },
    { tables: ['actions'], testIds: [] },
  ], 'mỗi lời khai một lời báo, giữ thứ tự, không gộp');
  assert.equal(save[WRITE_COMMAND], 'probe');
  stop();
});

test('thiếu nhật ký, thiếu khai bảng đổi hoặc lỗi giữa chừng: huỷ toàn bộ, không báo gì', () => {
  const { db, events, stop, rows, audits } = setup();
  const cases = [
    ['thiếu nhật ký', (tx) => { tx.changed(['wc_probe']); }, /thiếu nhật ký/],
    ['thiếu khai bảng đổi', (tx) => { tx.audit('wc:x', ''); }, /thiếu khai báo bảng đổi/],
    ['lỗi giữa chừng', (tx) => { tx.audit('wc:x', ''); tx.changed(['wc_probe']); throw new Error('hỏng'); }, /hỏng/],
  ];
  for (const [label, finish, pattern] of cases) {
    const save = writeCommand(db, 'probe', 'write', (w) => {
      w.commit((tx) => { db.prepare("INSERT INTO wc_probe(id,val) VALUES ('b','2')").run(); finish(tx); });
      return { ok: true, data: null };
    });
    assert.throws(() => save(tech), pattern, label);
    assert.deepEqual(rows(), [], `${label}: không còn dòng nào`);
    assert.deepEqual(audits(), [], `${label}: nhật ký cũng bị huỷ`);
    assert.deepEqual(events.filter((e) => e.tables[0] !== 'activity'), [], `${label}: không báo renderer`);
  }
  stop();
});

test('trả thành công mà không ghi, hoặc commit hai lần: báo lỗi lập trình', () => {
  const { db, stop } = setup();
  const noWrite = writeCommand(db, 'probe', 'write', () => ({ ok: true, data: null }));
  assert.throws(() => noWrite(tech), /không ghi gì/);
  const twice = writeCommand(db, 'probe', 'write', (w) => {
    const once = (tx) => { tx.audit('wc:x', ''); tx.changed(['wc_probe']); };
    w.commit(once); w.commit(once);
    return { ok: true, data: null };
  });
  assert.throws(() => twice(tech), /chỉ được gọi một lần/);
  const { events } = { events: [] };
  const stopNoChange = addChangeListener((payload) => events.push(payload));
  const unchanged = writeCommand(db, 'probe', 'write', (w) => w.noChange('giữ nguyên'));
  assert.deepEqual(unchanged(tech), { ok: true, data: 'giữ nguyên' }, 'không đổi thì khai tường minh w.noChange()');
  assert.deepEqual(events, [], 'không đổi thì không nhật ký, không báo renderer');
  stopNoChange();
  const rejected = writeCommand(db, 'probe', 'write', () => ({ ok: false, error: { code: 'invalid', message: 'Sai.' } }));
  assert.deepEqual(rejected(tech), { ok: false, error: { code: 'invalid', message: 'Sai.' } }, 'lỗi kiểm dữ liệu trả nguyên, không cần ghi');
  stop();
});

test('handler bắt lỗi quanh commit: lỗi lập trình vẫn nổi lên, lỗi dữ liệu thì trả "Lưu thất bại"', () => {
  const { db, stop, rows } = setup();
  const guarded = (finish) => writeCommand(db, 'probe', 'write', (w) => {
    try {
      w.commit((tx) => { db.prepare("INSERT INTO wc_probe(id,val) VALUES ('c','3')").run(); finish(tx); });
    } catch (e) {
      return { ok: false, error: { code: 'save-failed', message: e.message } };
    }
    return { ok: true, data: null };
  });
  // Thiếu nhật ký: không được biến thành "Lưu thất bại" để lọt khỏi log.
  assert.throws(() => guarded((tx) => { tx.changed(['wc_probe']); })(tech), (e) => e instanceof WriteCommandError && /thiếu nhật ký/.test(e.message));
  // Lỗi dữ liệu thật (vd ràng buộc CSDL): handler trả lỗi như thiết kế.
  const dataError = guarded((tx) => { tx.audit('wc:x', ''); tx.changed(['wc_probe']); throw new Error('UNIQUE constraint failed'); })(tech);
  assert.deepEqual(dataError, { ok: false, error: { code: 'save-failed', message: 'UNIQUE constraint failed' } });
  assert.deepEqual(rows(), [], 'cả hai trường hợp đều huỷ phần ghi');
  stop();
});

test('mọi thao tác ghi của Nhập QC đi qua cổng ghi', () => {
  const entry = createEntryHandlers(openDatabase(':memory:'));
  for (const name of ['applyLabRange', 'revertManufacturerRange', 'addPoint', 'voidPoint', 'setDayNote']) {
    assert.equal(entry[name][WRITE_COMMAND], name, name);
  }
});
