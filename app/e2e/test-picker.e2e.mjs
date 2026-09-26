// Bộ chọn xét nghiệm dùng chung (kế hoạch kiến trúc D.8) ở Báo cáo và Phân
// tích Westgard: tìm không dấu, lựa chọn luôn là mục đang có trong danh sách
// lọc. Trước 2026-09-26, Westgard chỉ hạ chữ thường nên gõ "dien giai" không
// tìm được "Điện giải".
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest } from './helpers.mjs';

test('Báo cáo và Westgard tìm xét nghiệm không dấu', { timeout: 120_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const created = await page.evaluate((instrumentId) => window.qcApi.saveTest({ data: { name: 'Điện giải đồ E2E', instrumentId, unit: 'mmol/L' } }), seeded.instrumentId);
    assert.equal(created.ok, true, JSON.stringify(created));

    for (const [label, searchId, selectId, countId] of [
      ['Phân tích Westgard', '#wgTestSearch', '#wgTestSelect', '#wgTestCount'],
      ['Báo cáo & Biểu mẫu', '#reportSearch', '#rTest', '#reportTestCount'],
    ]) {
      await openPage(page, label);
      const select = page.locator(selectId);
      await select.waitFor();
      assert.equal(await page.locator(countId).innerText(), '(2/2)', `${label}: đủ hai xét nghiệm`);
      await page.fill(searchId, 'dien giai');
      await page.locator(countId, { hasText: '(1/2)' }).waitFor();
      assert.match(await select.locator('option:checked').innerText(), /Điện giải đồ E2E/, `${label}: tìm không dấu và tự chọn mục khớp`);
      await page.fill(searchId, 'khong co xet nghiem nay');
      await page.locator(countId, { hasText: '(0/2)' }).waitFor();
      assert.equal(await select.isDisabled(), true);
      assert.match(await select.innerText(), /Không tìm thấy xét nghiệm phù hợp/);
      await page.fill(searchId, '');
      await page.locator(countId, { hasText: '(2/2)' }).waitFor();
    }
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
