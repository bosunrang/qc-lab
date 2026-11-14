import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request } from 'node:https';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

test('kích hoạt offline: chặn IPC/LAN, từ chối mã sai máy, nhận mã hợp lệ và giữ sau tải lại', { timeout: 120_000 }, async () => {
  const keys = generateKeyPairSync('ed25519');
  const { app, page, port, userDataDir } = await launchApp({ env: {
    QCLAB_REQUIRE_ACTIVATION: '1', QCLAB_LICENSE_PUBLIC_KEY: keys.publicKey.export({ type: 'spki', format: 'pem' }),
  } });
  try {
    await page.getByRole('heading', { name: 'Kích hoạt phần mềm', exact: true }).waitFor();
    await page.locator('#software-machine-code').waitFor();
    const license = await page.evaluate(() => window.qcApi.getLicenseStatus());
    assert.equal(license.state, 'required');
    await page.setViewportSize({ width: 1024, height: 700 });
    await page.locator('.activation-card').screenshot({ path: path.join(userDataDir, 'software-activation-clean.png') });
    const bounds = await page.locator('.activation-card').boundingBox();
    assert.ok(bounds.y >= 24 && bounds.y + bounds.height <= 700 - 24, 'khung kích hoạt vừa vùng cửa sổ desktop thấp');
    await page.evaluate(() => {
      // Chỉ ghi vào bộ nhớ bài kiểm thử, không thay clipboard của người dùng.
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__activationCopied = text; } } });
    });
    await page.getByRole('button', { name: 'Sao chép mã máy', exact: true }).click();
    await page.getByText('Đã sao chép mã máy. Gửi mã này cho bên cấp phần mềm.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__activationCopied), license.machine_code);
    await page.locator('#software-machine-code').focus();
    await page.keyboard.press('Tab');
    const focus = await page.getByRole('button', { name: 'Sao chép mã máy' }).evaluate((element) => ({ active: element === document.activeElement, ring: getComputedStyle(element).outlineWidth, expected: getComputedStyle(document.documentElement).getPropertyValue('--focus-ring-width').trim() }));
    assert.equal(focus.active, true); assert.equal(focus.ring, focus.expected);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#software-activation-code').evaluate((element) => element === document.activeElement), true);
    const blocked = await page.evaluate(() => window.qcApi.bootstrapAdmin({ data: { username: 'admin', name: 'Quản trị', password: 'mat-khau-e2e-1' } }));
    assert.equal(blocked.error.code, 'activation-required');
    const ca = readFileSync(path.join(userDataDir, 'lan-tls', 'ca-cert.pem'));
    const lan = (pathname, method = 'GET') => new Promise((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port, path: pathname, method, ca, headers: { 'content-type': 'application/json' } }, (res) => {
        let text = ''; res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(text) }));
      });
      req.on('error', reject); req.end(method === 'POST' ? '{}' : undefined);
    });
    assert.equal((await lan('/api/license')).data.state, 'required');
    assert.equal((await lan('/api/auth/login', 'POST')).data.error.code, 'activation-required');
    const issue = (machineCode, expiresAt = null) => {
      const message = 'QCL1.' + Buffer.from(JSON.stringify({ schema: 1, product: 'vn.qclab.desktop', licenseId: 'E2E-OFFLINE',
        licensedTo: 'Phòng xét nghiệm E2E', machineCode, issuedAt: new Date().toISOString(), expiresAt })).toString('base64url');
      return message + '.' + sign(null, Buffer.from(message), keys.privateKey).toString('base64url');
    };
    await page.locator('#software-activation-code').fill(issue('QC-AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD'));
    await page.getByRole('button', { name: 'Kích hoạt phần mềm', exact: true }).click();
    await page.getByRole('alert').getByText('Mã kích hoạt được cấp cho máy khác.', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(userDataDir, 'software-activation.png'), fullPage: true });
    await page.locator('#software-activation-code').fill(issue(license.machine_code));
    await page.getByRole('button', { name: 'Kích hoạt phần mềm', exact: true }).click();
    await page.locator('#bootstrap-username').waitFor();
    await bootstrapAndLogin(page);
    await page.reload();
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).waitFor();
    assert.equal((await page.evaluate(() => window.qcApi.getLicenseStatus())).state, 'active');
    await openPage(page, 'Cài đặt & Đám mây');
    await page.getByRole('heading', { name: 'Thông tin đơn vị', exact: true }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Giấy phép phần mềm' }).count(), 0);
    assert.equal(await page.getByRole('region', { name: 'Cập nhật phần mềm' }).count(), 0);
    assert.equal((await page.evaluate(() => window.qcApi.getLicenseStatus())).licensed_to, 'Phòng xét nghiệm E2E');
    assert.equal((await page.evaluate(() => window.qcApi.getSoftwareUpdateStatus())).phase, 'unsupported', 'bản chạy từ mã nguồn không gọi cập nhật thật');
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.locator('.sidebar-license-expiry').getByText('Hạn dùng: Vĩnh viễn', { exact: true }).waitFor();
    assert.equal(await page.locator('.license-expiry-notice').count(), 0);
    const deadline = (days) => {
      const parts = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      const part = (type) => Number(parts.find((value) => value.type === type).value);
      const iso = new Date(Date.UTC(part('year'), part('month') - 1, part('day') + days)).toISOString().slice(0, 10);
      return { expiresAt: new Date(`${iso}T23:59:59.999+07:00`).toISOString(), label: `Hạn dùng: ${iso.split('-').reverse().join('/')}` };
    };
    const replace = async (expiresAt) => {
      const result = await page.evaluate((activationCode) => window.qcApi.activateSoftware({ data: { activationCode } }), issue(license.machine_code, expiresAt));
      assert.equal(result.ok, true);
    };
    const far = deadline(8);
    await replace(far.expiresAt);
    await page.locator('.sidebar-license-expiry').getByText(far.label, { exact: true }).waitFor();
    assert.equal(await page.locator('.license-expiry-notice').count(), 0, 'chưa cảnh báo khi còn 8 ngày');
    const soon = deadline(7);
    await replace(soon.expiresAt);
    await page.locator('.license-expiry-notice').getByText(/còn 7 ngày sử dụng/).waitFor();
    assert.equal((await lan('/api/license')).data.expires_at, soon.expiresAt, 'máy trạm đọc được cùng hạn của máy chủ');
    await openPage(page, 'Tổng quan');
    await page.locator('.license-expiry-notice').getByText(/còn 7 ngày sử dụng/).waitFor();
    assert.equal(await page.locator('.license-expiry-notice').count(), 1);
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.license-expiry-notice').isVisible(), false, 'không đưa thông báo giấy phép vào bản in');
    await page.emulateMedia({ media: 'screen' });
    await page.getByRole('button', { name: 'Thu gọn thanh điều hướng', exact: true }).click();
    await page.getByRole('img', { name: soon.label, exact: true }).waitFor();
    await page.getByRole('button', { name: 'Mở thanh điều hướng', exact: true }).click();
    await page.locator('.sidebar-license-expiry').getByText(soon.label, { exact: true }).waitFor();
    await page.locator('.app-shell').evaluate(async (element) => { await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {}))); });
    await page.screenshot({ path: path.join(userDataDir, 'software-license-expiry.png') });
    const renewed = deadline(30);
    await replace(renewed.expiresAt);
    await page.locator('.sidebar-license-expiry').getByText(renewed.label, { exact: true }).waitFor();
    assert.equal(await page.locator('.license-expiry-notice').count(), 0, 'gia hạn xong bỏ cảnh báo ngay');
    await replace(null);
    await page.locator('.sidebar-license-expiry').getByText('Hạn dùng: Vĩnh viễn', { exact: true }).waitFor();
    assert.equal(await page.locator('.license-expiry-notice').count(), 0);
    await openPage(page, 'Cài đặt & Đám mây');
    await page.screenshot({ path: path.join(userDataDir, 'software-settings.png'), fullPage: true });
    console.log(`Ảnh kích hoạt và giấy phép: ${userDataDir}`);
  } finally { await app.close(); }
});
