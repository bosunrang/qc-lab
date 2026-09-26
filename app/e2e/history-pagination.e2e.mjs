// Hộp thoại chi tiết lô ở Cấu hình chung → Lịch sử dữ liệu phân trang 100
// điểm mỗi trang (kế hoạch kiến trúc D.11), thay vì vẽ mọi điểm của lô.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest } from './helpers.mjs';

test('chi tiết lô phân trang điểm QC', { timeout: 180_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const added = await page.evaluate(async (testId) => {
      let ok = 0;
      for (let i = 0; i < 130; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const result = await window.qcApi.addPoint({ data: { testId, level: 1, date, val: 5 + ((i % 5) - 2) * 0.05 } });
        if (result.ok) ok++;
      }
      return ok;
    }, seeded.testId);
    assert.equal(added, 130);

    await openPage(page, 'Cấu hình chung');
    await page.getByRole('button', { name: 'Lịch sử dữ liệu' }).click();
    await page.locator('tr', { hasText: 'E2E-1A' }).getByRole('button', { name: 'Chi tiết' }).first().click();
    const dialog = page.locator('.rcfg-history-detail-modal');
    await dialog.getByText('Điểm QC đã nhập (130)').waitFor();
    const rows = dialog.locator('.hist-points-table tbody tr');
    assert.equal(await rows.count(), 100, 'trang đầu chỉ vẽ 100 điểm');
    assert.match(await dialog.locator('.table-pagination').innerText(), /Trang 1\/2/);
    await dialog.getByRole('button', { name: 'Sau ›' }).click();
    await dialog.getByText('Trang 2/2').waitFor();
    assert.equal(await rows.count(), 30, 'trang sau là 30 điểm còn lại');
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
