// Khung cửa sổ của app thật, thay cho các test đọc mã nguồn bằng regex:
// - cửa sổ chính chạy sandbox, tách ngữ cảnh, không có Node;
// - mở app lần hai thì không mở phiên thứ hai, cửa sổ đang chạy hiện lên;
// - một trang lỗi khi hiển thị chỉ thay vùng nội dung, thanh bên còn nguyên,
//   đổi trang thì hết lỗi;
// - lỗi không được bắt ở renderer hiện hộp thoại cho người dùng.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

const require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('cửa sổ chính: sandbox, tách ngữ cảnh, không có Node', { timeout: 120_000 }, async () => {
  const { app, page } = await launchApp();
  try {
    await page.locator('#bootstrap-username').waitFor();
    const prefs = await app.evaluate(({ BrowserWindow }) => {
      const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return { sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration };
    });
    assert.deepEqual(prefs, { sandbox: true, contextIsolation: true, nodeIntegration: false });
    assert.equal(await page.evaluate(() => typeof globalThis.require), 'undefined', 'renderer không gọi được require');
    // Điều hướng ra trang lạ bị chặn ở main (`window-guard.ts`), cửa sổ giữ trang app.
    const before = page.url();
    await page.evaluate(() => { window.location.href = 'file:///C:/Windows/win.ini'; });
    await page.waitForTimeout(500);
    assert.equal(page.url(), before);
  } finally {
    await app.close();
  }
});

test('mở app lần hai: phiên mới tự thoát, cửa sổ đang chạy hiện lên', { timeout: 120_000 }, async () => {
  const { app, page, userDataDir, port } = await launchApp();
  try {
    await page.locator('#bootstrap-username').waitFor();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());

    // Cùng thư mục dữ liệu nên cùng khoá một phiên chạy.
    const env = { ...process.env, QCLAB_USER_DATA_DIR: userDataDir, QCLAB_LAN_PORT: String(port) };
    delete env.QCLAB_DEV_SERVER_URL;
    delete env.ELECTRON_RUN_AS_NODE;
    const second = spawn(require('electron'), ['.'], { cwd: REPO_ROOT, env, stdio: 'ignore' });
    const exitCode = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { second.kill(); reject(new Error('phiên thứ hai không tự thoát')); }, 30_000);
      second.once('exit', (code) => { clearTimeout(timer); resolve(code); });
    });
    assert.equal(exitCode, 0);

    const state = await app.evaluate(async ({ BrowserWindow }) => {
      // `second-instance` đến sau khi phiên hai thoát một chút.
      for (let i = 0; i < 50 && BrowserWindow.getAllWindows()[0].isMinimized(); i++) await new Promise((r) => setTimeout(r, 100));
      const win = BrowserWindow.getAllWindows()[0];
      return { count: BrowserWindow.getAllWindows().length, minimized: win.isMinimized(), visible: win.isVisible() };
    });
    assert.deepEqual(state, { count: 1, minimized: false, visible: true });
  } finally {
    await app.close();
  }
});

test('trang lỗi khi hiển thị chỉ thay vùng nội dung; lỗi không được bắt hiện hộp thoại', { timeout: 120_000 }, async () => {
  const { app, page } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    // Main trả dữ liệu hỏng cho đúng một kênh đọc: trang Khắc phục sự cố lỗi khi vẽ.
    await app.evaluate(({ ipcMain }) => {
      const handlers = ipcMain._invokeHandlers;
      if (!(handlers instanceof Map)) throw new Error('ipcMain._invokeHandlers không còn là Map.');
      globalThis.__nceList = handlers.get('nce:listRecords');
      handlers.set('nce:listRecords', () => null);
    });
    await openPage(page, 'Khắc phục sự cố');
    const alert = page.locator('[role=alert]', { hasText: 'Trang này gặp lỗi khi hiển thị' });
    await alert.waitFor();
    assert.match(await alert.innerText(), /Dữ liệu đã lưu không bị ảnh hưởng/);
    assert.equal(await page.getByRole('navigation', { name: 'Điều hướng chính' }).count(), 1, 'thanh bên còn nguyên');

    await app.evaluate(({ ipcMain }) => { ipcMain._invokeHandlers.set('nce:listRecords', globalThis.__nceList); });
    await openPage(page, 'Tổng quan');
    await page.locator('main .head').first().waitFor();
    assert.equal(await alert.count(), 0, 'đổi trang thì hết trạng thái lỗi');

    await page.evaluate(() => { setTimeout(() => { throw new Error('lỗi thử E2E'); }); });
    const dialog = page.locator('.modal[role=dialog]', { hasText: 'lỗi thử E2E' });
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /Dữ liệu đã lưu không bị ảnh hưởng/);
  } finally {
    await app.close();
  }
});
