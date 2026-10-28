// Kiểm bộ điều phối hồ sơ renderer thật: phản hồi đến muộn, xung đột và lỗi
// kết nối không được ghi đè dữ liệu mới hoặc tự gửi lại một lệnh chưa rõ kết quả.
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const RENDERER = fileURLToPath(new URL('../renderer', import.meta.url));
let server;
let createDossierSession;
before(async () => {
  server = await createServer({
    configFile: false, root: RENDERER, logLevel: 'error', appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ createDossierSession } = await server.ssrLoadModule('/pages/actions/dossier-session.ts'));
});
after(async () => { await server?.close(); });

const view = (version) => ({ record: { id: 'nce-1', row_version: version } });
const ok = (version) => ({ ok: true, data: view(version) });
const failure = (code, message = code) => ({ ok: false, error: { code, message } });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function until(check, message = 'bộ điều phối hoàn tất tác vụ') {
  const deadline = Date.now() + 1_000;
  while (!check() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 1));
  assert.ok(check(), message);
}
async function start(t, get = async () => view(1), options = {}) {
  const session = createDossierSession('nce-1', get, options);
  t.after(() => session.getState().dispose());
  session.getState().activate();
  await until(() => !session.getState().loading);
  return session;
}

test('hồ sơ: lỗi đọc ban đầu hạ cờ tải, không ném lỗi và có thể thử lại', async (t) => {
  const reported = [];
  let failed = true;
  const session = await start(t, async (id) => {
    assert.equal(id, 'nce-1');
    if (failed) throw new Error('IPC mất kết nối');
    return view(1);
  }, { reportError: (error) => reported.push(error) });
  assert.equal(session.getState().dossier, undefined);
  assert.equal(session.getState().error.kind, 'load');
  assert.match(session.getState().error.message, /IPC mất kết nối/);
  assert.equal(session.getState().busy, false);
  assert.equal(reported.length, 1);
  failed = false;
  assert.equal(await session.getState().reload(true), true);
  assert.deepEqual(session.getState().dossier, view(1));
  assert.equal(session.getState().error, null);
});

for (const [name, invalid] of [
  ['envelope lỗi IPC', failure('unauthenticated', 'Phiên hết hạn')],
  ['đối tượng thiếu record', { runs: [], actions: [] }],
  ['record thiếu phiên bản', { record: { id: 'nce-1' } }],
]) {
  test(`hồ sơ: đọc ${name} không đưa dữ liệu hỏng vào giao diện`, async (t) => {
    let reads = 0;
    const session = await start(t, async () => ++reads === 1 ? view(1) : invalid);
    assert.equal(await session.getState().reload(), false);
    assert.deepEqual(session.getState().dossier, view(1));
    assert.equal(session.getState().loading, false);
    assert.equal(session.getState().error.kind, 'load');
    if (name === 'envelope lỗi IPC') assert.match(session.getState().error.message, /Phiên hết hạn/);
  });
}

test('hồ sơ: hai lần đọc trả ngược thứ tự không làm lùi dữ liệu', async (t) => {
  const pending = [];
  const session = createDossierSession('nce-1', () => {
    const read = deferred(); pending.push(read); return read.promise;
  });
  t.after(() => { session.getState().dispose(); for (const read of pending) read.resolve(view(1)); });
  session.getState().activate();
  const latest = session.getState().reload();
  assert.equal(pending.length, 2);
  pending[1].resolve(view(3));
  assert.equal(await latest, true);
  pending[0].resolve(view(1));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(session.getState().dossier, view(3));
  assert.equal(session.getState().loading, false);
});

test('hồ sơ: phản hồi đọc cũ không đè kết quả ghi mới', async (t) => {
  const late = deferred();
  let reads = 0;
  const session = await start(t, () => ++reads === 1 ? Promise.resolve(view(1)) : late.promise);
  const oldRead = session.getState().reload();
  assert.equal(await session.getState().run(async (base) => {
    assert.deepEqual(base, { id: 'nce-1', expectedVersion: 1 });
    return ok(2);
  }), true);
  late.resolve(view(1));
  await oldRead;
  assert.deepEqual(session.getState().dossier, view(2));
  assert.equal(session.getState().loading, false);
});

test('hồ sơ: lệnh ghi bị từ chối vì điều kiện giữ dữ liệu và trả false', async (t) => {
  const session = await start(t);
  assert.equal(await session.getState().run(async () => failure('gate', 'Thiếu bằng chứng')), false);
  assert.deepEqual(session.getState().dossier, view(1));
  assert.equal(session.getState().error.kind, 'write');
  assert.equal(session.getState().error.stale, false);
  assert.equal(session.getState().error.message, 'Thiếu bằng chứng');
  assert.equal(session.getState().busy, false);
});

for (const mode of ['throw', 'internal-error']) {
  test(`hồ sơ: ghi ${mode} giữ dữ liệu và khóa gửi lại đến khi đối chiếu thành công`, async (t) => {
    const session = await start(t);
    let writes = 0;
    const write = async () => {
      writes++;
      if (mode === 'throw') throw new Error('Mất phản hồi sau khi gửi');
      return failure('internal-error', 'Lỗi máy chính');
    };
    assert.equal(await session.getState().run(write), false);
    assert.deepEqual(session.getState().dossier, view(1));
    assert.equal(session.getState().busy, false);
    assert.equal(session.getState().error.kind, 'uncertain');
    session.getState().clearError();
    assert.equal(session.getState().error.kind, 'uncertain', 'không thể bỏ cảnh báo để gửi lặp lệnh chưa rõ kết quả');
    assert.equal(await session.getState().run(write), false);
    assert.equal(writes, 1);
    assert.equal(await session.getState().reload(), true);
    assert.equal(session.getState().error.kind, 'uncertain', 'đọc nền chưa phải xác nhận đối chiếu');
    assert.equal(await session.getState().reload(true), true);
    assert.equal(session.getState().error, null);
    assert.equal(await session.getState().run(async () => ok(2)), true);
  });
}

for (const [name, invalid] of [
  ['thiếu dữ liệu', undefined],
  ['sai hồ sơ', { record: { id: 'nce-other', row_version: 2 } }],
  ['thiếu phiên bản', { record: { id: 'nce-1' } }],
]) {
  test(`hồ sơ: phản hồi ghi thành công nhưng ${name} phải giữ dữ liệu và cảnh báo chưa rõ kết quả`, async (t) => {
    const session = await start(t);
    assert.equal(await session.getState().run(async () => ({ ok: true, data: invalid })), false);
    assert.deepEqual(session.getState().dossier, view(1));
    assert.equal(session.getState().busy, false);
    assert.equal(session.getState().error.kind, 'uncertain');
    let writes = 0;
    assert.equal(await session.getState().run(async () => { writes++; return ok(2); }), false);
    assert.equal(writes, 0);
  });
}

test('hồ sơ: đối chiếu thất bại không mở khóa lệnh ghi chưa rõ kết quả', async (t) => {
  let reads = 0;
  const session = await start(t, async () => {
    if (++reads > 1) throw new Error('LAN vẫn mất kết nối');
    return view(1);
  });
  await session.getState().run(async () => { throw new Error('Mất phản hồi'); });
  assert.equal(await session.getState().reload(true), false);
  assert.equal(session.getState().error.kind, 'uncertain');
  assert.deepEqual(session.getState().dossier, view(1));
  let writes = 0;
  assert.equal(await session.getState().run(async () => { writes++; return ok(2); }), false);
  assert.equal(writes, 0);
});

test('hồ sơ: đọc nền không xóa cảnh báo lệch phiên bản hoặc lỗi lệnh ghi', async (t) => {
  let reads = 0;
  const session = await start(t, async () => { reads++; return view(3); });
  for (const code of ['stale', 'gate']) {
    assert.equal(await session.getState().run(async () => failure(code, 'Giữ nội dung nháp để đối chiếu')), false);
    assert.equal(session.getState().error.kind, 'write');
    assert.equal(session.getState().error.stale, code === 'stale');
    const previousReads = reads;
    session.getState().invalidate();
    await until(() => reads > previousReads && !session.getState().loading);
    assert.equal(session.getState().error.message, 'Giữ nội dung nháp để đối chiếu');
    assert.equal(await session.getState().reload(true), true);
    assert.equal(session.getState().error, null);
  }
});

test('hồ sơ: chặn đồng bộ hai lệnh ghi trùng trước khi React render lại', async (t) => {
  const pending = deferred();
  const session = await start(t);
  let writes = 0;
  const write = () => { writes++; return pending.promise; };
  const first = session.getState().run(write);
  assert.equal(session.getState().busy, true);
  assert.equal(await session.getState().run(write), false);
  assert.equal(writes, 1);
  pending.resolve(ok(2));
  assert.equal(await first, true);
  assert.equal(session.getState().busy, false);
  assert.deepEqual(session.getState().dossier, view(2));
});

test('hồ sơ: nhiều thông báo thay đổi trong lúc ghi được gom thành một lần tải sau ghi', async (t) => {
  let reads = 0;
  const pending = deferred();
  const session = await start(t, async () => view(++reads === 1 ? 1 : 3));
  const writing = session.getState().run(() => pending.promise);
  session.getState().invalidate();
  session.getState().invalidate();
  session.getState().invalidate();
  assert.equal(reads, 1, 'không đọc trước khi lệnh ghi kết thúc');
  pending.resolve(ok(2));
  assert.equal(await writing, true);
  await until(() => session.getState().dossier?.record.row_version === 3);
  assert.equal(reads, 2);
});

test('hồ sơ: rời trang bỏ qua phản hồi đọc hoặc ghi đến muộn', async (t) => {
  for (const operation of ['read', 'write']) {
    const late = deferred();
    let reads = 0;
    const session = await start(t, () => ++reads === 1 ? Promise.resolve(view(1)) : late.promise);
    const pending = operation === 'read' ? session.getState().reload() : session.getState().run(() => late.promise);
    session.getState().dispose();
    const disposed = session.getState();
    late.resolve(operation === 'read' ? view(9) : ok(9));
    await pending;
    assert.deepEqual(session.getState().dossier, view(1));
    assert.equal(session.getState(), disposed, 'không cập nhật store sau khi rời trang');
  }
});

test('hồ sơ: hết hạn đọc hạ cờ tải và bỏ qua phản hồi rất muộn', async (t) => {
  const late = deferred();
  const session = await start(t, () => late.promise, { timeoutMs: 20 });
  assert.equal(session.getState().loading, false);
  assert.equal(session.getState().error.kind, 'load');
  assert.equal(session.getState().dossier, undefined);
  late.resolve(view(9));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(session.getState().dossier, undefined);
});

test('hồ sơ: hết hạn ghi là chưa rõ kết quả, không tự gửi lại hoặc nhận phản hồi muộn', async (t) => {
  const late = deferred();
  const session = await start(t, async () => view(1), { timeoutMs: 20 });
  assert.equal(await session.getState().run(() => late.promise), false);
  assert.equal(session.getState().busy, false);
  assert.equal(session.getState().error.kind, 'uncertain');
  let writes = 0;
  assert.equal(await session.getState().run(async () => { writes++; return ok(9); }), false);
  assert.equal(writes, 0);
  late.resolve(ok(9));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(session.getState().dossier, view(1));
  assert.equal(session.getState().error.kind, 'uncertain');
});
