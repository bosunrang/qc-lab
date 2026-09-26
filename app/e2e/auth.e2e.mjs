// Luồng tài khoản trên app thật: máy mới tạo quản trị viên đầu tiên, đăng
// nhập, đăng xuất, đăng nhập lại; sai mật khẩu thì báo lỗi, không vào app.
import assert from 'node:assert/strict';
import test from 'node:test';
import { ADMIN, bootstrapAndLogin, launchApp, login } from './helpers.mjs';

test('khởi tạo quản trị, đăng nhập, đăng xuất', { timeout: 120_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await page.locator('#bootstrap-username').waitFor();
    await bootstrapAndLogin(page);
    assert.match(await page.locator('.top-user').first().innerText(), new RegExp(ADMIN.name));

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await page.locator('#login-username').waitFor();
    assert.equal(await page.locator('#bootstrap-username').count(), 0, 'đã có quản trị viên thì không hiện lại form khởi tạo');

    await page.fill('#login-username', ADMIN.username);
    await page.fill('#login-password', 'sai-mat-khau');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.locator('.auth-err[role=alert]').waitFor();
    assert.equal(await page.getByRole('navigation', { name: 'Điều hướng chính' }).count(), 0, 'sai mật khẩu không vào được app');

    await login(page, ADMIN);
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
