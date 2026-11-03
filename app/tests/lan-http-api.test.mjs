// GV5/Q1: client LAN (`renderer/lan/http-api.ts`) xét mã HTTP thay vì trả
// thẳng `response.json()`. Trước đây 401 và lỗi đọc thành `{ok:false}` ở chỗ
// trang chờ mảng, `.map` hỏng và cả trang rơi vào màn lỗi.
// Chạy mã nguồn trong vm (cách `westgard-view.test.mjs` chạy QcChart), thay
// các import bằng bản giả.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

function loadClient() {
  const source = readFileSync(new URL('../renderer/lan/http-api.ts', import.meta.url), 'utf8')
    .split('\n').filter((line) => !line.startsWith('import ')).join('\n')
    .replace(/^export /gm, '');
  const ended = [];
  const context = vm.createContext({
    announceSessionEnded: () => ended.push(true),
    exportTableXlsxInBrowser: () => {}, printHtmlToPdfInBrowser: () => {},
  });
  vm.runInContext(stripTypeScriptTypes(source), context);
  return { context, ended };
}

const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

test('401 của thao tác thường: báo phiên kết thúc và ném lỗi', async () => {
  const { context, ended } = loadClient();
  const api = context.createLanHttpApi(async () => reply(401, { ok: false, error: { code: 'unauthenticated', message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' } }));
  await assert.rejects(api.listTests(), (error) => error.code === 'unauthenticated');
  assert.equal(ended.length, 1);
});

test('đăng nhập sai (401) chỉ trả lỗi cho form, không báo phiên kết thúc', async () => {
  const { context, ended } = loadClient();
  const api = context.createLanHttpApi(async () => reply(401, { ok: false, error: { code: 'bad-login', message: 'Sai mật khẩu.' } }));
  const result = await api.login({ data: { username: 'a', password: 'b' } });
  assert.equal(result.error.code, 'bad-login');
  assert.equal(ended.length, 0);
});

test('thao tác đọc lỗi (readFailed) thì ném lỗi; thao tác ghi lỗi vẫn trả IpcResult', async () => {
  const { context } = loadClient();
  let body = { ok: false, readFailed: true, error: { code: 'forbidden', message: 'Tài khoản không có quyền dùng trang "Six Sigma & Sai số".' } };
  const api = context.createLanHttpApi(async () => reply(200, body));
  await assert.rejects(api.listSigmaPeriods('t1'), (error) => error.code === 'forbidden' && /Six Sigma/.test(error.message));
  body = { ok: false, error: { code: 'weak-password', message: 'Mật khẩu phải có ít nhất 8 ký tự.' } };
  assert.equal((await api.changeOwnPassword({ data: {} })).error.code, 'weak-password');
  body = null;
  assert.equal(await api.getNce('x'), null, 'thao tác đọc trả đúng null thì giữ null');
});

test('currentUser: chưa đăng nhập là null, không báo phiên kết thúc', async () => {
  const { context, ended } = loadClient();
  const api = context.createLanHttpApi(async () => reply(401, { ok: false }));
  assert.equal(await api.currentUser(), null);
  assert.equal(ended.length, 0);
});

test('mọi nơi nghe dùng chung một luồng sự kiện, đóng khi không còn ai nghe', () => {
  const { context } = loadClient();
  const opened = [];
  const api = context.createLanHttpApi(async () => reply(200, {}), (url) => {
    const source = { url, closed: false, handlers: [], addEventListener(_name, fn) { this.handlers.push(fn); }, close() { this.closed = true; } };
    opened.push(source);
    return source;
  });
  const got = [];
  const offA = api.onStoreChanged((payload) => got.push(['a', payload.tables[0]]));
  const offB = api.onStoreChanged((payload) => got.push(['b', payload.tables[0]]));
  assert.equal(opened.length, 1, 'hai nơi nghe, một kết nối');
  opened[0].handlers[0]({ data: JSON.stringify({ tables: ['qc_points'], testIds: [] }) });
  assert.deepEqual(got, [['a', 'qc_points'], ['b', 'qc_points']]);
  offA();
  assert.equal(opened[0].closed, false);
  offB();
  assert.equal(opened[0].closed, true);
  api.onStoreChanged(() => {});
  assert.equal(opened.length, 2, 'nghe lại thì mở kết nối mới');
});

test('màn đăng nhập của máy trạm không gọi RPC khi chưa có phiên', async () => {
  const { context, ended } = loadClient();
  const calls = [];
  const api = context.createLanHttpApi(async (path) => { calls.push(path); return reply(401, { ok: false }); });
  assert.equal(await api.hasAnyUsers(), true, 'máy trạm không khởi tạo tài khoản đầu tiên');
  assert.equal((await api.reportClientError({ message: 'x' })).ok, true);
  assert.deepEqual(calls, []);
  assert.equal(ended.length, 0, 'không báo phiên kết thúc trước khi đăng nhập');
});
