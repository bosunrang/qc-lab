// Máy trạm LAN trên máy chủ thật: một cửa sổ Chromium mở địa chỉ LAN của app
// như trình duyệt của máy nhân viên, đăng nhập bằng tài khoản KTV, nhập điểm
// QC qua bảng Nhập QC; thao tác quản trị bị từ chối (máy trạm chỉ nhập liệu).
import assert from 'node:assert/strict';
import test from 'node:test';
import { TECH, bootstrapAndLogin, enterValue, launchApp, login, openPage, seedOperationalTest, todayIn, watchErrors } from './helpers.mjs';

test('máy trạm LAN đăng nhập, nhập điểm, không làm được thao tác quản trị', { timeout: 180_000 }, async () => {
  const { app, page, errors, port } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const created = await page.evaluate((user) => window.qcApi.createUser({ data: { ...user, role: 'technician' } }), TECH);
    assert.equal(created.ok, true, JSON.stringify(created));

    const lanUrl = `http://127.0.0.1:${port}/`;
    const [station] = await Promise.all([
      app.waitForEvent('window'),
      app.evaluate(({ BrowserWindow }, url) => {
        const win = new BrowserWindow({ width: 1280, height: 800, webPreferences: { sandbox: true, contextIsolation: true } });
        void win.loadURL(url);
      }, lanUrl),
    ]);
    station.setDefaultTimeout(20_000);
    await station.locator('#login-username').waitFor();
    await login(station, TECH);
    // Chỉ đếm lỗi từ sau khi đăng nhập: trước đó `/api/session` và
    // `/api/events` trả 401 là đúng thiết kế, trình duyệt vẫn in ra console.
    const stationErrors = watchErrors(station);

    const nav = station.getByRole('navigation', { name: 'Điều hướng chính' });
    assert.equal(await nav.getByRole('link', { name: 'Cấu hình chung' }).count(), 0, 'KTV không thấy trang quản trị');

    const today = await todayIn(station);
    await openPage(station, 'Nhập QC & Biểu đồ');
    await station.locator('.qc-sheet-title strong', { hasText: seeded.testName }).waitFor();
    await enterValue(station, today, 1, 4.95);
    await station.locator('.entry-sheet-message .alert.ok', { hasText: 'Mức 1' }).waitFor();

    // Điểm máy trạm nhập nằm trong CSDL của máy chính, ghi đúng người nhập.
    const saved = await page.evaluate((testId) => window.qcApi.queryPoints(testId, 1), seeded.testId);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].val, 4.95);
    assert.equal(saved[0].operator_username, TECH.username);

    // Thao tác quản trị gọi thẳng qua API của máy trạm vẫn bị máy chủ từ chối.
    const denied = await station.evaluate(() => window.qcApi.saveInstrument({ data: { name: 'Máy lạ từ LAN' } }));
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, 'unknown-operation');
    const instruments = await page.evaluate(() => window.qcApi.listInstruments());
    assert.deepEqual(instruments.map((i) => i.name), ['Máy E2E'], 'máy chính không nhận thao tác quản trị từ LAN');

    assert.deepEqual(stationErrors, []);
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
