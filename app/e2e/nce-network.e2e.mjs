// Tạo lỗi phản hồi ở transport LAN trên profile tạm, không sửa API sản phẩm.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { request as httpsRequest } from 'node:https';
import { ADMIN, bootstrapAndLogin, launchApp, login, openPage, todayIn, watchErrors } from './helpers.mjs';

/** Tiếp tục yêu cầu bị giữ bằng đúng CA của profile tạm. route.fetch dùng
 * kho CA của Node, không dùng certificateVerifyProc của cửa sổ Electron. */
async function forwardRpc(route, ca) {
  const request = route.request(), url = new URL(request.url());
  assert.equal(url.hostname, '127.0.0.1');
  const headers = await request.allHeaders();
  return new Promise((resolve, reject) => {
    const forwarded = httpsRequest(url, { method: request.method(), headers, ca }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: Object.fromEntries(Object.entries(response.headers).filter(([, value]) => value !== undefined).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value)])), body: Buffer.concat(chunks) }));
    });
    forwarded.setTimeout(15_000, () => forwarded.destroy(new Error('Yêu cầu kiểm thử LAN không nhận được phản hồi.')));
    forwarded.on('error', reject);
    forwarded.end(request.postDataBuffer());
  });
}

test('NCE LAN: thử lại khi tải lỗi, giữ nháp khi mất phản hồi ghi và bỏ đọc cũ sau ghi', { timeout: 120_000 }, async () => {
  const { app, page, errors, port, userDataDir } = await launchApp();
  let releaseOldRead = () => {};
  try {
    await bootstrapAndLogin(page);
    const created = await page.evaluate(async (date) => {
      const user = await window.qcApi.currentUser();
      const r = await window.qcApi.createNce({ data: { source: 'other', description: 'Hồ sơ kiểm tra phục hồi kết nối mạng', correction: 'Đã kiểm soát sự cố ban đầu', holdResults: false, detectedAt: date, ownerUserId: user.id } });
      if (!r.ok) throw new Error(JSON.stringify(r.error));
      return r.data;
    }, await todayIn(page));
    const ca = readFileSync(path.join(userDataDir, 'lan-tls', 'ca-cert.pem'), 'utf8');
    const [station] = await Promise.all([
      app.waitForEvent('window'),
      app.evaluate(({ BrowserWindow, session }, { port, ca }) => {
        const { X509Certificate } = process.getBuiltinModule('node:crypto');
        const authority = new X509Certificate(ca), stationSession = session.fromPartition('nce-network');
        stationSession.setCertificateVerifyProc((req, callback) => {
          if (req.verificationResult === 'net::OK') return callback(0);
          const leaf = new X509Certificate(req.certificate.data);
          callback(req.verificationResult === 'net::ERR_CERT_AUTHORITY_INVALID' && leaf.checkIssued(authority) && leaf.verify(authority.publicKey) ? 0 : -2);
        });
        const win = new BrowserWindow({ width: 1366, height: 900, webPreferences: { sandbox: true, contextIsolation: true, session: stationSession } });
        void win.loadURL(`https://127.0.0.1:${port}/`);
      }, { port, ca }),
    ]);
    station.setDefaultTimeout(20_000);
    await login(station, ADMIN);
    const stationErrors = watchErrors(station);
    let readMode = 'fail', loseWriteResponse = false, writes = 0;
    let capturedRead;
    const captured = new Promise((resolve) => { capturedRead = resolve; });
    const hold = new Promise((resolve) => { releaseOldRead = resolve; });
    let servedRead;
    const served = new Promise((resolve) => { servedRead = resolve; });
    await station.route('**/api/rpc', async (route) => {
      const input = route.request().postDataJSON();
      if (input.method === 'getNce' && readMode === 'fail') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'unavailable', message: 'Lỗi đọc giả lập để kiểm thử phục hồi' } }) });
        return;
      }
      if (input.method === 'getNce' && readMode === 'hold') {
        readMode = 'normal';
        const response = await forwardRpc(route, ca);
        capturedRead();
        await hold;
        await route.fulfill(response);
        servedRead();
        return;
      }
      if (input.method === 'updateNce') {
        writes++;
        if (loseWriteResponse) {
          loseWriteResponse = false;
          const response = await forwardRpc(route, ca);
          assert.equal(JSON.parse(response.body.toString('utf8')).ok, true, 'máy chính đã commit trước khi làm mất phản hồi');
          await route.fulfill({ status: 200, contentType: 'application/json', body: '{phan-hoi-bi-cat' });
          return;
        }
      }
      await route.continue();
    });

    await openPage(station, 'Khắc phục sự cố');
    await station.getByRole('region', { name: 'Danh sách hồ sơ NCE' }).locator('tbody tr', { hasText: created.record.nce_id }).getByRole('button', { name: 'Mở hồ sơ' }).click();
    await station.getByText('Không tải được hồ sơ', { exact: true }).waitFor();
    await station.getByText(/Lỗi đọc giả lập/).waitFor();
    assert.equal(await station.getByText('Đang tải hồ sơ…', { exact: true }).count(), 0);
    readMode = 'normal';
    await station.getByRole('button', { name: 'Thử lại', exact: true }).click();
    const stage = (name) => station.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name }).click();
    await stage(/Ghi nhận sự cố/);
    const identity = station.getByRole('region', { name: 'Ghi nhận và xử lý tức thời' });
    await identity.getByRole('button', { name: 'Sửa', exact: true }).click();
    const savedText = 'Mô tả đã lưu ở máy chính dù phản hồi bị mất';
    await identity.locator('#idDesc').fill(savedText);
    loseWriteResponse = true;
    await identity.getByRole('button', { name: 'Lưu', exact: true }).click();
    await station.locator('.nce-dossier-error', { hasText: 'Chưa xác nhận được thao tác' }).waitFor();
    assert.equal(await identity.locator('#idDesc').inputValue(), savedText);
    assert.equal(await identity.getByRole('button', { name: 'Lưu', exact: true }).isDisabled(), true);
    const committed = await page.evaluate((id) => window.qcApi.getNce(id), created.record.id);
    assert.equal(committed.record.description, savedText);
    assert.equal(committed.record.row_version, created.record.row_version + 1);
    assert.equal(writes, 1, 'không tự gửi lại lệnh ghi');

    // Lần đối chiếu lỗi không được đóng bản nháp hoặc gỡ khoá chưa rõ kết quả.
    readMode = 'fail';
    await station.getByRole('button', { name: 'Tải dữ liệu mới', exact: true }).click();
    await station.getByRole('dialog').getByRole('button', { name: 'Tải dữ liệu mới', exact: true }).click();
    await station.locator('.nce-dossier-error', { hasText: 'Lỗi đọc giả lập' }).waitFor();
    assert.equal(await identity.locator('#idDesc').inputValue(), savedText);
    await station.screenshot({ path: path.join(userDataDir, 'nce-network-recovery.png'), fullPage: true });
    readMode = 'normal';
    await station.getByRole('button', { name: 'Tải dữ liệu mới', exact: true }).click();
    await station.getByRole('dialog').getByRole('button', { name: 'Tải dữ liệu mới', exact: true }).click();
    await identity.getByRole('button', { name: 'Sửa', exact: true }).waitFor();
    await identity.getByText(savedText, { exact: true }).waitFor();
    assert.equal(await station.locator('.nce-dossier-error').count(), 0);

    // Thông báo từ hồ sơ khác kích hoạt đọc nền phiên bản hiện tại; giữ
    // phản hồi này rồi ghi mới vào hồ sơ đang xem trước khi cho đọc cũ về.
    readMode = 'hold';
    await page.evaluate(async (date) => {
      const user = await window.qcApi.currentUser();
      const r = await window.qcApi.createNce({ data: { source: 'other', description: 'Hồ sơ khác để phát thông báo thay đổi', correction: 'Đã kiểm soát', holdResults: false, detectedAt: date, ownerUserId: user.id } });
      if (!r.ok) throw new Error(JSON.stringify(r.error));
    }, await todayIn(page));
    await captured;
    await identity.getByRole('button', { name: 'Sửa', exact: true }).click();
    const finalText = 'Mô tả mới không bị phản hồi đọc cũ ghi đè';
    await identity.locator('#idDesc').fill(finalText);
    await identity.getByRole('button', { name: 'Lưu', exact: true }).click();
    await identity.getByText(finalText, { exact: true }).waitFor();
    releaseOldRead();
    await served;
    await station.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await identity.getByText(finalText, { exact: true }).waitFor();
    assert.equal(await station.locator('.nce-dossier-description').innerText(), finalText);
    assert.equal(writes, 2);
    assert.deepEqual(stationErrors, []);
    assert.deepEqual(errors, []);
    console.log(`Ảnh phục hồi kết nối: ${path.join(userDataDir, 'nce-network-recovery.png')}`);
  } finally { releaseOldRead(); await app.close(); }
});
