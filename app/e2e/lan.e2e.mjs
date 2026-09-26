// Máy trạm LAN trên máy chủ thật: một cửa sổ Chromium mở địa chỉ LAN của app
// như trình duyệt của máy nhân viên, đăng nhập bằng tài khoản KTV, nhập điểm
// QC qua bảng Nhập QC; thao tác quản trị bị từ chối (máy trạm chỉ nhập liệu).
// Kết nối là HTTPS bằng CA app tạo trong thư mục dữ liệu tạm; địa chỉ http://
// chỉ dẫn tới trang hướng dẫn cài chứng chỉ.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { TECH, bootstrapAndLogin, enterValue, launchApp, login, openPage, seedOperationalTest, todayIn, watchErrors } from './helpers.mjs';

test('máy trạm LAN đăng nhập, nhập điểm, không làm được thao tác quản trị', { timeout: 180_000 }, async () => {
  const { app, page, errors, port, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const created = await page.evaluate((user) => window.qcApi.createUser({ data: { ...user, role: 'technician' } }), TECH);
    assert.equal(created.ok, true, JSON.stringify(created));

    // Cửa sổ máy trạm trong test là cửa sổ Electron của app, nên bộ chặn điều
    // hướng (`window-guard.ts`) giao mọi chuyển trang sang https:// cho
    // `shell.openExternal`: ghi lại thay vì mở trình duyệt thật.
    await app.evaluate(({ shell }) => {
      globalThis.__openedExternal = [];
      shell.openExternal = async (url) => { globalThis.__openedExternal.push(url); };
    });

    // Máy chưa cài chứng chỉ gốc: mở http:// thấy hướng dẫn, không vào được app.
    const caPem = readFileSync(path.join(userDataDir, 'lan-tls', 'ca-cert.pem'), 'utf8');
    const stranger = await openStation(app, `http://127.0.0.1:${port}/`, { partition: 'stranger' });
    await stranger.getByRole('link', { name: 'Tải chứng chỉ gốc' }).waitFor();
    assert.equal(stranger.url(), `http://127.0.0.1:${port}/`);
    assert.deepEqual(await app.evaluate(() => globalThis.__openedExternal), [], 'chưa tin chứng chỉ thì không chuyển sang https://');
    await stranger.close();

    // Máy đã cài chứng chỉ gốc: trang ở địa chỉ http:// cũ tự chuyển sang
    // https:// (trình duyệt của máy nhân viên chuyển thẳng; ở đây thấy qua URL
    // được giao cho `openExternal`). Rồi mở https:// để đăng nhập.
    const secureUrl = `https://127.0.0.1:${port}/`;
    const redirecting = await openStation(app, `http://127.0.0.1:${port}/`, { partition: 'station', trustedCaPem: caPem });
    await waitFor(async () => (await app.evaluate(() => globalThis.__openedExternal)).includes(secureUrl), 'trang http:// chuyển sang https://');
    await redirecting.close();

    const station = await openStation(app, secureUrl, { partition: 'station', trustedCaPem: caPem });
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

/** Mở một cửa sổ như trình duyệt của máy nhân viên, phiên riêng theo
 * `partition`. `trustedCaPem` giả lập việc đã cài chứng chỉ gốc: Chromium chỉ
 * được phép báo lỗi "không rõ nơi cấp", và chứng chỉ máy chủ phải do đúng CA
 * đó ký — mọi lỗi khác (sai IP, hết hạn…) vẫn bị từ chối. */
async function openStation(app, url, { partition, trustedCaPem }) {
  const [win] = await Promise.all([
    app.waitForEvent('window'),
    app.evaluate(({ BrowserWindow, session }, input) => {
      const stationSession = session.fromPartition(input.partition);
      if (input.trustedCaPem) {
        const { X509Certificate } = process.getBuiltinModule('node:crypto');
        const ca = new X509Certificate(input.trustedCaPem);
        stationSession.setCertificateVerifyProc((request, callback) => {
          if (request.verificationResult === 'net::OK') return callback(0);
          const leaf = new X509Certificate(request.certificate.data);
          const signedByCa = leaf.checkIssued(ca) && leaf.verify(ca.publicKey);
          callback(request.verificationResult === 'net::ERR_CERT_AUTHORITY_INVALID' && signedByCa ? 0 : -2);
        });
      }
      const station = new BrowserWindow({ width: 1280, height: 800, webPreferences: { sandbox: true, contextIsolation: true, session: stationSession } });
      void station.loadURL(input.url);
    }, { url, partition, trustedCaPem: trustedCaPem || null }),
  ]);
  win.setDefaultTimeout(20_000);
  return win;
}

async function waitFor(check, message, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(message);
}
