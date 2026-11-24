import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest } from './helpers.mjs';

test('LIS: giao diện chặn dữ liệu sai và tự xác nhận lại bản tin đã lưu khi Gateway phục hồi', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const record = await page.evaluate((testId) => ({ id: 'lis-e2e', status: 'pending', receivedAt: new Date().toISOString(),
      message: { messageId: 'lis-e2e', analyzerId: 'E2E', testCode: 'GLU', qcLevel: '1', qcLotCode: 'E2E-1A',
        unit: 'mmol/L', value: 5, measuredAt: new Date().toISOString(), runId: 'lis-e2e-run' },
      resolved: { ok: true, code: 'RESOLVED', qclabTestId: testId, level: 1, lot: 'E2E-1A', displayName: 'Glucose E2E' },
    }), seeded.testId);
    await app.evaluate((_electron, record) => {
      const badValue = structuredClone(record), badUnit = structuredClone(record);
      badValue.id = badValue.message.messageId = 'bad-value'; badValue.message.value = '';
      badUnit.id = badUnit.message.messageId = 'bad-unit'; badUnit.message.unit = 'mg/dL';
      const state = { queue: [record, badValue, badUnit], fail: true, calls: [] };
      globalThis.__lisImportTest = state;
      const original = globalThis.fetch;
      globalThis.fetch = async (input, options) => {
        const url = String(input);
        if (!url.startsWith('http://127.0.0.1:8787')) return original(input, options);
        if (url.includes('qc-results?')) return { ok: true, json: async () => ({ items: structuredClone(state.queue) }) };
        if (url.endsWith('/decide')) {
          const decision = JSON.parse(options.body); state.calls.push(decision);
          if (state.fail) throw new Error('Mất xác nhận thử nghiệm');
          state.queue = state.queue.filter((item) => item.message.messageId !== decision.messageId);
        }
        return { ok: true, json: async () => ({ ok: true }) };
      };
    }, record);
    const settings = await page.evaluate(() => window.qcApi.saveLisSettings({ data: { enabled: true, url: 'http://127.0.0.1:8787', token: 'e2e-only' } }));
    assert.equal(settings.ok, true);
    await openPage(page, 'Cài đặt & Kết nối');
    await page.getByRole('button', { name: 'Xem hàng chờ QC', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Hàng chờ QC từ LIS Gateway', exact: true });
    await modal.getByText('Sẵn sàng nhận (1)', { exact: true }).waitFor();
    await modal.getByText('Chưa khớp cấu hình (2)', { exact: true }).waitFor();
    assert.equal(await modal.getByRole('button', { name: 'Nhận', exact: true }).count(), 1);
    await modal.getByRole('button', { name: 'Nhận', exact: true }).click();
    const warning = page.locator('.info-modal');
    await warning.getByText(/Mã bản tin đã được giữ/).waitFor();
    await warning.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();
    let points = await page.evaluate((testId) => window.qcApi.queryPoints(testId, 1), seeded.testId);
    assert.equal(points.length, 1); assert.equal(points[0].val, 5); assert.equal(points[0].lot, 'E2E-1A');
    const pointId = points[0].id;
    await app.evaluate(() => { globalThis.__lisImportTest.fail = false; });
    await modal.getByRole('button', { name: 'Làm mới', exact: true }).click();
    await modal.getByText('Sẵn sàng nhận (0)', { exact: true }).waitFor();
    points = await page.evaluate((testId) => window.qcApi.queryPoints(testId, 1), seeded.testId);
    assert.equal(points.length, 1); assert.equal(points[0].id, pointId);
    const retried = await page.evaluate((record) => window.qcApi.importLisResult({ data: { record } }), record);
    assert.equal(retried.ok, true); assert.equal(retried.data.pointId, pointId);
    assert.equal(retried.data.gatewayWarning, undefined);
    assert.equal(await app.evaluate(() => globalThis.__lisImportTest.queue.some((item) => item.message.messageId === 'lis-e2e')), false);
    await modal.screenshot({ path: path.join(userDataDir, 'lis-import-recovered.png') });
    console.log(`Ảnh phục hồi LIS: ${userDataDir}`);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
