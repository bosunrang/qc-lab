// Gói log để gửi khi báo lỗi (kế hoạch kiến trúc G.2): ZIP hợp lệ gồm log,
// tệp crash và thông tin môi trường; không kèm CSDL; chỉ quản trị viên.
// Tệp ZIP được đọc lại bằng bộ đọc viết riêng ở đây (thư mục trung tâm →
// header cục bộ → inflate + CRC32), không dùng mã ghi của app.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crc32, inflateRawSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { buildLogBundle } = require('../../app-dist/main/logging/log-bundle.js');
const { createDesktopOperations } = require('../../app-dist/main/ipc/desktop-operations.js');
const { openDatabase } = require('../../app-dist/main/db/open-database.js');

const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
const tech = { ...admin, userId: 'u-tech', role: 'technician' };

/** Đọc mọi tệp trong ZIP: tìm End of Central Directory, duyệt thư mục trung tâm. */
function readZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, 'có End of Central Directory');
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(at), 0x02014b50, 'chữ ký thư mục trung tâm');
    const method = buf.readUInt16LE(at + 10), crc = buf.readUInt32LE(at + 16), size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28), extraLen = buf.readUInt16LE(at + 30), commentLen = buf.readUInt16LE(at + 32);
    const localAt = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nameLen).toString('utf8');
    assert.equal(buf.readUInt32LE(localAt), 0x04034b50, `${name}: chữ ký header cục bộ`);
    const dataAt = localAt + 30 + buf.readUInt16LE(localAt + 26) + buf.readUInt16LE(localAt + 28);
    const data = inflateRawSync(buf.subarray(dataAt, dataAt + size));
    assert.equal(method, 8, `${name}: nén deflate`);
    assert.equal(crc32(data) >>> 0, crc, `${name}: CRC32 khớp`);
    files[name] = data;
    at += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function fakeLogDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qclab-logbundle-'));
  writeFileSync(path.join(dir, 'qclab.log'), '{"level":"error","message":"Lỗi thử nghiệm"}\n');
  writeFileSync(path.join(dir, 'qclab.1.log'), '{"level":"warn","message":"cũ hơn"}\n');
  mkdirSync(path.join(dir, 'crashes'));
  writeFileSync(path.join(dir, 'crashes', 'abc.dmp'), Buffer.from([0, 1, 2, 3, 255]));
  return dir;
}

test('gói log là ZIP hợp lệ gồm log, tệp crash và thông tin môi trường', () => {
  const dir = fakeLogDir();
  const { zip, files } = buildLogBundle(dir, { appVersion: '1.0.5', electronVersion: '43.2.0', exportedBy: 'Quản trị' });
  assert.equal(files, 3);
  const entries = readZip(zip);
  assert.deepEqual(Object.keys(entries).sort(), ['logs/crashes/abc.dmp', 'logs/qclab.1.log', 'logs/qclab.log', 'thong-tin.txt']);
  assert.equal(entries['logs/qclab.log'].toString('utf8'), '{"level":"error","message":"Lỗi thử nghiệm"}\n', 'nội dung giữ nguyên, tiếng Việt đúng');
  assert.deepEqual([...entries['logs/crashes/abc.dmp']], [0, 1, 2, 3, 255], 'tệp nhị phân giữ nguyên');
  const info = entries['thong-tin.txt'].toString('utf8');
  assert.match(info, /Phiên bản app: 1\.0\.5/);
  assert.match(info, /Người xuất: Quản trị/);
  assert.doesNotMatch(Object.keys(entries).join(','), /sqlite/, 'không kèm CSDL');
});

test('thư mục log chưa có: gói vẫn có tệp thông tin', () => {
  const { zip, files } = buildLogBundle(path.join(os.tmpdir(), 'qclab-khong-co-thu-muc-nay'), { appVersion: 'x', electronVersion: 'y', exportedBy: 'z' });
  assert.equal(files, 0);
  assert.deepEqual(Object.keys(readZip(zip)), ['thong-tin.txt']);
});

test('xuất gói log: chỉ quản trị viên, huỷ hộp thoại thì không ghi, có nhật ký', async () => {
  const db = openDatabase(':memory:');
  let current = null;
  const written = [];
  let pick = 'D:/bao-loi/goi.zip';
  const ops = createDesktopOperations({ db, auth: {}, backup: {}, firebase: {} }, {
    session: { get: () => current, set: (actor) => { current = actor; } },
    pickBackupSavePath: async () => null, pickBackupOpenPath: async () => null,
    buildXlsxBase64: async () => '', printHtmlToPdf: async () => ({ ok: true, data: { path: '' } }), basename: (p) => p,
    logDir: fakeLogDir(), openFolder: async () => '',
    pickLogBundleSavePath: async (name) => { assert.match(name, /^QC-Lab-log-\d{12}\.zip$/); return pick; },
    writeFile: async (p, data) => { written.push([p, data]); },
    appVersion: '1.0.5', electronVersion: '43.2.0',
  });
  assert.equal(ops.exportLogBundle.lan, false, 'máy trạm LAN không lấy được log của máy chính');
  const ctx = { actor: () => current };
  current = tech;
  assert.equal((await ops.exportLogBundle.run(ctx)).error.code, 'forbidden');
  current = admin;
  const done = await ops.exportLogBundle.run(ctx);
  assert.equal(done.ok, true);
  assert.equal(done.data.path, 'D:/bao-loi/goi.zip');
  assert.equal(done.data.files, 3);
  assert.equal(written.length, 1);
  assert.ok(readZip(written[0][1])['logs/qclab.log']);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM activity WHERE type='Xuất gói log'").get().n, 1);
  pick = null;
  assert.deepEqual(await ops.exportLogBundle.run(ctx), { ok: true, data: null }, 'huỷ hộp thoại');
  assert.equal(written.length, 1, 'huỷ thì không ghi tệp');
});
