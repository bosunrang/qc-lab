import assert from 'node:assert/strict';
import test from 'node:test';
import { launchLisDemo } from '../scripts/lis-demo.mjs';

test('LIS demo: Electron nhận dữ liệu từ HTTP thật, chặn bản tin lỗi và xác nhận lại không tạo trùng', { timeout: 120_000 }, async () => {
  const demo = await launchLisDemo({ failAckOnce: true });
  const { app, page, testId, gateway } = demo;
  try {
    const modal = page.getByRole('dialog', { name: 'Hàng chờ QC từ LIS Gateway', exact: true });
    assert.equal(await modal.getByRole('button', { name: 'Nhận', exact: true }).count(), 3);
    await modal.getByRole('button', { name: 'Nhận', exact: true }).first().click();
    const warning = page.locator('.info-modal');
    await warning.getByText(/Mã bản tin đã được giữ/).waitFor();
    await warning.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();
    await modal.getByRole('button', { name: 'Làm mới', exact: true }).click();
    await modal.getByText('Sẵn sàng nhận (2)', { exact: true }).waitFor();
    const points = await page.evaluate((id) => window.qcApi.queryPoints(id, 1), testId);
    assert.equal(points.length, 1);
    assert.equal(points[0].val, 5.1);
    assert.equal(points[0].lot, 'LIS-DEMO-L1');
    const retried = await page.evaluate((record) => window.qcApi.importLisResult({ data: { record } }), demo.records[0]);
    assert.equal(retried.ok, true);
    assert.equal(retried.data.pointId, points[0].id);
    const rejected = await page.evaluate((messageId) => window.qcApi.rejectLisResult({ data: { messageId } }), demo.records[2].message.messageId);
    assert.equal(rejected.ok, true);
    assert.equal((await page.evaluate((id) => window.qcApi.queryPoints(id, 1), testId)).length, 1);
    const invalid = await page.evaluate((record) => window.qcApi.importLisResult({ data: { record } }), demo.records[3]);
    assert.equal(invalid.ok, false);
    const imported = await (await fetch(gateway.url + '/api/v1/qc-results?status=imported', {
      headers: { authorization: `Bearer ${gateway.token}` },
    })).json();
    assert.equal(imported.items.length, 1);
  } finally { await app.close(); await gateway.close(); }
});
