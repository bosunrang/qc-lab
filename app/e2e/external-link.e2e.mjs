// Liên kết nguồn TEa ra Internet không được mở trong cửa sổ app: bấm vào thì
// giao cho trình duyệt hệ thống (`shell.openExternal`), cửa sổ app giữ nguyên
// trang và không có cửa sổ Electron mới. Xem `main/window-guard.ts`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

test('liên kết nguồn TEa mở bằng trình duyệt hệ thống', { timeout: 120_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    // Không mở trình duyệt thật trong lúc test: ghi lại URL được giao đi.
    await app.evaluate(({ shell }) => {
      globalThis.__openedExternal = [];
      shell.openExternal = async (url) => { globalThis.__openedExternal.push(url); };
    });
    await bootstrapAndLogin(page);
    await openPage(page, 'Cấu hình chung');
    await page.getByRole('button', { name: 'Bảng TEa tham chiếu' }).click();
    const link = page.locator('.tea-source-card a', { hasText: 'Mở nguồn chính thức' }).first();
    const href = await link.getAttribute('href');
    assert.match(href, /^https:\/\//);

    const urlBefore = page.url();
    await link.click();
    await page.waitForTimeout(500);
    const opened = await app.evaluate(() => globalThis.__openedExternal);
    assert.deepEqual(opened, [href], 'URL được giao cho trình duyệt hệ thống');
    // Đếm ở main process: cửa sổ trống mở ra rồi mới bị chặn điều hướng vẫn là
    // lỗi, dù Playwright có thể chưa kịp thấy nó.
    const windowCount = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    assert.equal(windowCount, 1, 'không mở cửa sổ Electron mới');
    assert.equal(page.url(), urlBefore, 'cửa sổ app giữ nguyên trang');
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
