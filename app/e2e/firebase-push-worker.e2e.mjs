// Tiến trình phụ đẩy sao lưu Firebase (kế hoạch kiến trúc B.2) trên Electron
// thật: `utilityProcess` mở tệp CSDL của app bằng kết nối chỉ đọc riêng, dựng
// gói backup có checksum và PUT tới URL do main đưa. Test dùng một máy chủ
// HTTP giả trên máy vì cấu hình Firebase thật bắt buộc HTTPS của Google.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { bootstrapAndLogin, launchApp, seedOperationalTest } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { validateBackupEnvelope } = require('../../app-dist/main/domain/backup.js');
const { SCHEMA_VERSION } = require('../../app-dist/main/db/schema.js');
const MAIN_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'app-dist', 'main');

test('tiến trình phụ dựng và gửi gói sao lưu từ tệp CSDL', { timeout: 120_000 }, async () => {
  const received = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => { received.push({ method: req.method, url: req.url, body: Buffer.concat(chunks).toString('utf8') }); res.end('{}'); });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { app, page, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    await seedOperationalTest(page);
    const result = await app.evaluate(async (_electron, args) => {
      const { createUtilityPushRunner } = process.mainModule.require(args.runner);
      const run = createUtilityPushRunner(args.worker);
      // Trong lúc tiến trình phụ làm việc, main vẫn trả lời ngay.
      const started = Date.now();
      const pending = run({ dbPath: args.dbPath, uploadUrl: args.url });
      const mainLatency = await new Promise((resolve) => setImmediate(() => resolve(Date.now() - started)));
      return { ...(await pending), mainLatency };
    }, {
      runner: path.join(MAIN_DIST, 'sync', 'firebase-push-runner.js'),
      worker: path.join(MAIN_DIST, 'sync', 'firebase-push-worker.js'),
      dbPath: path.join(userDataDir, 'qclab.sqlite'),
      url: `http://127.0.0.1:${server.address().port}/qclab-shared/khoaXN.json?auth=token`,
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.ok(result.mainLatency < 200, `main không bị chặn (${result.mainLatency} ms)`);
    assert.equal(received.length, 1);
    assert.equal(received[0].method, 'PUT');
    assert.equal(received[0].url, '/qclab-shared/khoaXN.json?auth=token');
    const payload = JSON.parse(received[0].body);
    assert.equal(payload._format, 'qclab-v2-firebase');
    assert.equal(validateBackupEnvelope(payload.backup, SCHEMA_VERSION).ok, true, 'checksum hợp lệ');
    assert.equal(payload.backup.checksum, result.checksum);
    assert.equal(Buffer.byteLength(received[0].body), result.bytes, 'số byte báo về đúng cỡ đã gửi');
    assert.deepEqual(payload.backup.data.instruments.map((row) => row.name), ['Máy E2E'], 'đọc được dữ liệu vừa ghi (qua WAL)');
    assert.ok(payload.backup.data.users.length >= 1);
  } finally {
    await app.close();
    server.close();
  }
});
