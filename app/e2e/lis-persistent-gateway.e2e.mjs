import assert from 'node:assert/strict';
import test from 'node:test';
import { launchLisDemo } from '../scripts/lis-demo.mjs';

test('Gateway SQLite: Electron nhận/bỏ qua HTTP thật, không tạo trùng và giữ ba bản tin lỗi để đối chiếu', { timeout: 120_000 }, async () => {
  const { app, page, gateway, testId } = await launchLisDemo({ persistent: true });
  try {
    const modal = page.getByRole('dialog', { name: 'Hàng chờ QC từ LIS Gateway', exact: true });
    const row = modal.locator('tr').filter({ has: page.getByRole('cell', { name: '5.1', exact: true }) });
    await row.getByRole('button', { name: 'Nhận', exact: true }).click();
    await modal.getByText('Sẵn sàng nhận (2)', { exact: true }).waitFor();
    await modal.getByRole('button', { name: 'Làm mới', exact: true }).click();
    const points = await page.evaluate((id) => window.qcApi.queryPoints(id, 1), testId);
    assert.equal(points.length, 1);
    assert.equal(points[0].val, 5.1);
    const queue = await (await fetch(gateway.url + '/api/v1/qc-results?status=pending', { headers: { authorization: `Bearer ${gateway.token}` } })).json();
    const discard = queue.items.find((r) => r.message.value === 4.9);
    const rejected = await page.evaluate((id) => window.qcApi.rejectLisResult({ data: { messageId: id } }), discard.id);
    assert.equal(rejected.ok, true);
    await modal.getByRole('button', { name: 'Làm mới', exact: true }).click();
    await modal.getByText('Sẵn sàng nhận (1)', { exact: true }).waitFor();
    await modal.getByText('Chưa khớp cấu hình (3)', { exact: true }).waitFor();
    assert.equal((await page.evaluate((id) => window.qcApi.queryPoints(id, 1), testId)).length, 1);
  } finally { await app.close(); await gateway.close(); }
});
