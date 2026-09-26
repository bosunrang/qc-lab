// Log ra tệp, chỉ lưu tại máy (kế hoạch kiến trúc G.2): che dữ liệu nhạy cảm,
// xoay vòng theo cỡ tệp, lỗi `internal-error` của IPC và lỗi không được bắt
// của renderer đều có dòng trong log.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);

const { redactText, redactValue } = require('../../app-dist/main/domain/log-redact.js');
const { createFileLogger } = require('../../app-dist/main/logging/file-logger.js');
const { logEvent, setLogSink } = require('../../app-dist/main/logging/log-sink.js');
const { errorResult, NotSignedInError } = require('../../app-dist/main/ipc/operations.js');
const { createDesktopOperations } = require('../../app-dist/main/ipc/desktop-operations.js');

const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
const tech = { ...admin, userId: 'u-tech', role: 'technician' };

function captureLog(t) {
  const entries = [];
  setLogSink((entry) => entries.push(entry));
  t.after(() => setLogSink(null));
  return entries;
}

test('che mật khẩu, token và khoá API trong chuỗi lẫn trong đối tượng', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LWFkbWluIn0.c2lnbmF0dXJlLWxvbmc';
  const text = redactText(`login password=bi-mat-123 token: "abc.def" Authorization: Bearer tok_987 idToken=${jwt} key AIzaSyA1234567890abcdefghijklmnopqrstu`);
  for (const secret of ['bi-mat-123', 'abc.def', 'tok_987', jwt, 'AIzaSyA1234567890abcdefghijklmnopqrstu']) {
    assert.ok(!text.includes(secret), `lộ "${secret}" trong: ${text}`);
  }
  assert.match(text, /\[đã che\]/);
  assert.equal(redactText('Không tìm thấy xét nghiệm Glucose'), 'Không tìm thấy xét nghiệm Glucose', 'câu thường giữ nguyên');

  const value = redactValue({ username: 'admin', password: 'x1', nested: { lisToken: 'y2', list: [{ apiKey: 'z3' }, 'refresh_token=w4'] } });
  assert.equal(value.username, 'admin');
  assert.equal(value.password, '[đã che]');
  assert.equal(value.nested.lisToken, '[đã che]');
  assert.equal(value.nested.list[0].apiKey, '[đã che]');
  assert.doesNotMatch(JSON.stringify(value), /x1|y2|z3|w4/);
});

test('ghi mỗi sự kiện một dòng JSON và xoay vòng khi vượt cỡ tệp', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qclab-log-'));
  const logger = createFileLogger({ dir, maxBytes: 400, maxFiles: 3, now: () => new Date('2026-09-26T01:02:03.000Z') });
  logger.write({ level: 'info', source: 'app', message: 'Khởi động' });
  const first = JSON.parse(readFileSync(logger.file, 'utf8').trim());
  assert.deepEqual(first, { ts: '2026-09-26T01:02:03.000Z', level: 'info', source: 'app', message: 'Khởi động' });

  for (let i = 0; i < 40; i++) logger.write({ level: 'error', source: 'ipc', message: `lỗi số ${i} ${'x'.repeat(60)}` });
  const files = readdirSync(dir).sort();
  assert.deepEqual(files, ['qclab.1.log', 'qclab.2.log', 'qclab.log'], 'giữ đúng 3 tệp, tệp cũ nhất bị bỏ');
  for (const name of files) assert.ok(readFileSync(path.join(dir, name)).length <= 400, `${name} không vượt cỡ tối đa`);
  const newest = readFileSync(logger.file, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.match(newest.at(-1).message, /lỗi số 39/, 'dòng mới nhất nằm ở tệp đang ghi');
});

test('lỗi internal-error của IPC có dòng trong log, kèm tên thao tác; chưa đăng nhập thì không', (t) => {
  const entries = captureLog(t);
  const result = errorResult(new Error('SQLITE_BUSY: database is locked password=abc'), 'addPoint');
  assert.equal(result.error.code, 'internal-error');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].level, 'error');
  assert.equal(entries[0].source, 'ipc');
  assert.match(entries[0].message, /^addPoint: SQLITE_BUSY/);
  assert.doesNotMatch(entries[0].message, /abc/, 'thông báo lỗi cũng được che');
  assert.match(String(entries[0].detail), /Error: SQLITE_BUSY/, 'kèm ngăn xếp lỗi');

  errorResult(new NotSignedInError());
  assert.equal(entries.length, 1, 'chưa đăng nhập là trạng thái bình thường, không phải sự cố');
});

test('lỗi của renderer gửi về main có dòng trong log; mở thư mục log chỉ dành cho quản trị viên', async (t) => {
  const entries = captureLog(t);
  const opened = [];
  let current = null;
  const ops = createDesktopOperations({ db: {}, auth: {}, backup: {}, firebase: {} }, {
    session: { get: () => current, set: (actor) => { current = actor; } },
    pickBackupSavePath: async () => null, pickBackupOpenPath: async () => null,
    buildXlsxBase64: async () => '', printHtmlToPdf: async () => ({ ok: true, data: { path: '' } }), basename: (p) => p,
    logDir: 'C:/qclab/logs', openFolder: async (folder) => { opened.push(folder); return ''; },
  });
  assert.equal(ops.reportClientError.lan, false, 'máy trạm LAN không ghi được vào log của máy chính');
  assert.equal(ops.openLogFolder.lan, false);

  const ctx = { actor: () => { if (!current) throw new NotSignedInError(); return current; } };
  const reported = await ops.reportClientError.run(ctx, { message: 'Cannot read properties of undefined', stack: 'TypeError\n    at EntrySheet' });
  assert.deepEqual(reported, { ok: true, data: null }, 'ghi được cả khi chưa đăng nhập (lỗi ở màn hình đăng nhập)');
  assert.deepEqual(entries.map((e) => [e.level, e.source, e.message]), [['error', 'renderer', 'Cannot read properties of undefined']]);
  await ops.reportClientError.run(ctx, { message: 'x'.repeat(5000) });
  assert.equal(entries[1].message.length, 2000, 'cắt thông báo quá dài');

  await assert.rejects(() => ops.openLogFolder.run(ctx), NotSignedInError);
  current = tech;
  assert.equal((await ops.openLogFolder.run(ctx)).ok, false, 'KTV không mở được thư mục log');
  current = admin;
  assert.deepEqual(await ops.openLogFolder.run(ctx), { ok: true, data: { path: 'C:/qclab/logs' } });
  assert.deepEqual(opened, ['C:/qclab/logs']);
});

test('chưa gắn nơi ghi thì logEvent không làm gì; lỗi của bước ghi log không làm hỏng thao tác', () => {
  setLogSink(null);
  assert.doesNotThrow(() => logEvent({ level: 'error', source: 'ipc', message: 'x' }));
  setLogSink(() => { throw new Error('đĩa đầy'); });
  assert.doesNotThrow(() => logEvent({ level: 'error', source: 'ipc', message: 'x' }));
  setLogSink(null);
});
