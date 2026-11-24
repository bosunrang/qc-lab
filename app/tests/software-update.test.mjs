import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createUpdateService } = require('../../app-dist/main/updates/update-service.js');
const { createSoftwareOperations } = require('../../app-dist/main/ipc/software-operations.js');
const { createLicenseService } = require('../../app-dist/main/licensing/license-service.js');
const { openDatabase } = require('../../app-dist/main/db/open-database.js');

class Updater extends EventEmitter {
  checks = 0; downloads = 0; installs = 0;
  async checkForUpdates() {
    this.checks++; this.emit('update-available', { version: '1.1.0', releaseNotes: '<b>Nội dung mới</b>' });
    if (this.autoDownload) await this.downloadUpdate();
  }
  async downloadUpdate() {
    this.downloads++;
    this.emit('download-progress', { percent: 50, transferred: 5, total: 10 });
    this.emit('update-downloaded', { version: '1.1.0', releaseNotes: 'Đã sửa lỗi' });
    return ['update.exe'];
  }
  quitAndInstall(silent, forceRunAfter) { this.installs++; this.installOptions = { silent, forceRunAfter }; }
}
function setup({ prepareInstall = async () => {}, beforeInstall = () => {} } = {}) {
  const port = new Updater(), changes = [];
  const updates = createUpdateService(port, { currentVersion: '1.0.9', prepareInstall, beforeInstall, changed: () => changes.push(updates.status()) });
  return { port, updates, changes };
}

test('cập nhật: phát hiện bản mới tự tải trong nền, chỉ cài khi xác nhận và không hạ phiên bản', async () => {
  const { port, updates, changes } = setup();
  assert.equal(port.autoDownload, true); assert.equal(port.autoInstallOnAppQuit, false);
  assert.equal(port.allowDowngrade, false); assert.equal(port.allowPrerelease, false); assert.equal(port.disableWebInstaller, true);
  assert.equal((await updates.download()).ok, false);
  assert.equal((await updates.check()).ok, true);
  assert.equal(port.downloads, 1);
  assert.equal(updates.status().phase, 'downloaded'); assert.equal(port.installs, 0);
  assert.ok(changes.some((state) => state.percent === 50));
});

test('cập nhật: chuẩn bị sao lưu và nhật ký xong mới được khởi động bộ cài', async () => {
  const order = [];
  const { port, updates } = setup({ prepareInstall: async () => { order.push('backup'); }, beforeInstall: () => order.push('allow-quit') });
  await updates.check();
  const result = await updates.install(() => order.push('audit'));
  assert.equal(result.ok, true); assert.deepEqual(order, ['backup', 'audit']); assert.equal(port.installs, 0);
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.deepEqual(order, ['backup', 'audit', 'allow-quit']); assert.equal(port.installs, 1);
  assert.deepEqual(port.installOptions, { silent: true, forceRunAfter: true }, 'cập nhật không mở lại trình hướng dẫn cài đặt');
});

test('cập nhật: sao lưu hoặc nhật ký thất bại thì không chạy bộ cài', async () => {
  for (const failed of ['backup', 'audit']) {
    const { port, updates } = setup({ prepareInstall: async () => { if (failed === 'backup') throw new Error('lỗi sao lưu'); } });
    await updates.check();
    const result = await updates.install(() => { if (failed === 'audit') throw new Error('lỗi nhật ký'); });
    assert.equal(result.ok, false); assert.equal(result.error.code, 'update-prepare-failed');
    assert.equal(updates.status().phase, 'downloaded');
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(port.installs, 0);
  }
});

test('cập nhật: chống gọi chồng, lỗi mạng thử lại được, bản phát triển không gọi mạng', async () => {
  const { port, updates } = setup();
  let release;
  port.checkForUpdates = () => new Promise((resolve) => { release = resolve; });
  const first = updates.check();
  assert.equal((await updates.check()).error.code, 'update-busy');
  port.emit('error', new Error('mạng lỗi')); release(); await first;
  port.checkForUpdates = async () => { port.emit('update-not-available', {}); };
  assert.equal((await updates.check()).ok, true); assert.equal(updates.status().phase, 'idle');
  const dev = createUpdateService(null, { currentVersion: '1.0.9', changed() {}, async prepareInstall() {}, beforeInstall() {} });
  assert.equal(dev.status().phase, 'unsupported'); assert.equal((await dev.check()).ok, false);
});

test('quyền cập nhật: KTV không được kiểm tra/tải/cài; quản trị được kiểm tra và có nhật ký', async (t) => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const { updates, port } = setup();
  const license = createLicenseService(db, { required: false, publicKey: '', machineCode: '' });
  const operations = createSoftwareOperations(db, license, updates, { get: () => null, set() {} });
  const actor = { userId: 'admin', username: 'admin', name: 'Quản trị', role: 'technician', clientId: 'test' };
  for (const name of ['checkSoftwareUpdate', 'downloadSoftwareUpdate', 'installSoftwareUpdate']) {
    assert.equal((await operations[name].run({ actor: () => actor })).error.code, 'forbidden');
  }
  assert.equal(port.checks, 0); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM activity').get().n, 0);
  assert.equal((await operations.checkSoftwareUpdate.run({ actor: () => ({ ...actor, role: 'admin' }) })).ok, true);
  assert.equal(port.checks, 1);
  assert.equal(db.prepare('SELECT type FROM activity ORDER BY seq DESC LIMIT 1').get().type, 'Kiểm tra cập nhật');
});
