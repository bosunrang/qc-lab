// Log ra tệp và báo crash, chỉ lưu tại máy (kế hoạch kiến trúc G.2), trên app
// thật: tệp log nằm trong thư mục dữ liệu của app, có dòng khởi động; lỗi
// không được bắt ở renderer có dòng trong log và đã che mật khẩu; thư mục
// crash nằm cạnh log; nút ở trang Cài đặt mở đúng thư mục đó.
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

function readLog(logFile) {
  return existsSync(logFile) ? readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
}

async function waitForLog(logFile, predicate) {
  for (let i = 0; i < 50; i++) {
    const found = readLog(logFile).find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`Không thấy dòng log mong đợi trong ${logFile}:\n${readFileSync(logFile, 'utf8')}`);
}

test('lỗi được ghi vào tệp log tại máy, không lộ mật khẩu', { timeout: 120_000 }, async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    const logDir = path.join(userDataDir, 'logs');
    const logFile = path.join(logDir, 'qclab.log');
    const started = await waitForLog(logFile, (entry) => entry.source === 'app' && entry.level === 'info');
    assert.match(started.message, /Khởi động QC Lab/);
    assert.equal(await app.evaluate(({ app: electronApp }) => electronApp.getPath('crashDumps')), path.join(logDir, 'crashes'));

    await bootstrapAndLogin(page);
    // Một promise bị từ chối không có `catch`, như lệnh IPC lỗi trong store.
    await page.evaluate(() => { setTimeout(() => { void Promise.reject(new Error('Lỗi thử E2E password=bi-mat-e2e')); }, 0); });
    await page.locator('.confirm-modal', { hasText: 'Thao tác không hoàn tất' }).waitFor();
    const reported = await waitForLog(logFile, (entry) => entry.source === 'renderer');
    assert.equal(reported.level, 'error');
    assert.match(reported.message, /Lỗi thử E2E/);
    assert.ok(!readFileSync(logFile, 'utf8').includes('bi-mat-e2e'), 'mật khẩu trong thông báo lỗi đã được che');
    assert.ok(!readFileSync(logFile, 'utf8').includes('mat-khau-e2e-1'), 'mật khẩu đăng nhập không bao giờ vào log');
    await page.getByRole('button', { name: 'Đã hiểu' }).click();

    await app.evaluate(({ shell }) => {
      globalThis.__openedFolders = [];
      shell.openPath = async (folder) => { globalThis.__openedFolders.push(folder); return ''; };
    });
    await openPage(page, 'Cài đặt & Đám mây');
    await page.getByRole('button', { name: 'Mở thư mục log' }).click();
    await page.waitForTimeout(300);
    assert.deepEqual(await app.evaluate(() => globalThis.__openedFolders), [logDir]);
  } finally {
    await app.close();
  }
});
