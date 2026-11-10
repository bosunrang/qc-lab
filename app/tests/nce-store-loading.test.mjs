import assert from 'node:assert/strict';
import test from 'node:test';
import { useNceStore } from '../renderer/store/nce-store.ts';

function setup(t) {
  const previousWindow = globalThis.window;
  const pending = [];
  globalThis.window = { qcApi: {
    listNce() {
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      pending.push({ resolve, reject });
      return promise;
    },
    listNceQueue: async () => [{ id: `queue-${pending.length}` }],
    listNceUsers: async () => [{ id: `user-${pending.length}` }],
  } };
  useNceStore.setState({ records: [], queue: [], users: [], loading: false, error: null });
  t.after(() => { globalThis.window = previousWindow; });
  return { pending, load: () => useNceStore.getState().load(), state: () => useNceStore.getState() };
}

test('danh sách NCE: phản hồi cũ không ghi đè hồ sơ, hàng chờ và người phụ trách mới', async (t) => {
  const { pending, load, state } = setup(t);
  const first = load(), latest = load();
  pending[1].resolve([{ id: 'new' }]);
  await latest;
  pending[0].resolve([{ id: 'old' }]);
  await first;
  assert.deepEqual(state().records, [{ id: 'new' }]);
  assert.deepEqual(state().queue, [{ id: 'queue-2' }]);
  assert.deepEqual(state().users, [{ id: 'user-2' }]);
  assert.equal(state().loading, false);
});

test('danh sách NCE: lỗi đến muộn không thay kết quả tải mới thành lỗi', async (t) => {
  const { pending, load, state } = setup(t);
  const first = load(), latest = load();
  pending[1].resolve([{ id: 'new' }]);
  await latest;
  pending[0].reject(new Error('Lỗi kết nối của lần tải cũ'));
  await first;
  assert.equal(state().error, null);
  assert.deepEqual(state().records, [{ id: 'new' }]);
});

test('danh sách NCE: phản hồi cũ không hạ cờ tải của yêu cầu mới đang chờ', async (t) => {
  const { pending, load, state } = setup(t);
  const first = load(), latest = load();
  pending[0].resolve([{ id: 'old' }]);
  await first;
  assert.equal(state().loading, true);
  assert.deepEqual(state().records, []);
  pending[1].resolve([{ id: 'new' }]);
  await latest;
  assert.equal(state().loading, false);
});

test('danh sách NCE: lỗi mới nhất được hiển thị, giữ dữ liệu đã có để đối chiếu', async (t) => {
  const { pending, load, state } = setup(t);
  useNceStore.setState({ records: [{ id: 'saved' }] });
  const first = load(), latest = load();
  pending[1].reject(new Error('Không kết nối được máy chính'));
  await latest;
  pending[0].resolve([{ id: 'old' }]);
  await first;
  assert.equal(state().loading, false);
  assert.equal(state().error, 'Không kết nối được máy chính');
  assert.deepEqual(state().records, [{ id: 'saved' }]);
});
