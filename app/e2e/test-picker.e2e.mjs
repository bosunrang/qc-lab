// Bộ chọn xét nghiệm dùng chung (kế hoạch kiến trúc D.8) ở Báo cáo và Phân
// tích Westgard: một ô chọn có tìm kiếm (`SearchSelect`, cùng ô ở Ngoại kiểm),
// tìm không dấu. Trước 2026-09-26, Westgard chỉ hạ chữ thường nên gõ
// "dien giai" không tìm được "Điện giải".
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest } from './helpers.mjs';

test('Báo cáo và Westgard tìm xét nghiệm không dấu ngay trong ô chọn', { timeout: 120_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const created = await page.evaluate((instrumentId) => window.qcApi.saveTest({ data: { name: 'Điện giải đồ E2E', instrumentId, unit: 'mmol/L' } }), seeded.instrumentId);
    assert.equal(created.ok, true, JSON.stringify(created));

    for (const [label, inputId, countId] of [
      ['Phân tích Westgard', '#wgTestSelect', '#wgTestCount'],
      ['Báo cáo & Biểu mẫu', '#rTest', '#reportTestCount'],
    ]) {
      await openPage(page, label);
      const input = page.locator(inputId);
      await input.waitFor();
      assert.equal(await page.locator(countId).innerText(), '(2)', `${label}: đủ hai xét nghiệm`);
      assert.notEqual(await input.inputValue(), '', `${label}: mở trang đã có xét nghiệm được chọn sẵn`);
      await input.fill('dien giai');
      const options = page.locator('[role="listbox"] [role="option"]');
      await options.first().waitFor();
      assert.equal(await options.count(), 1, `${label}: tìm không dấu chỉ còn mục khớp`);
      await input.press('Enter');
      assert.match(await input.inputValue(), /Điện giải đồ E2E/, `${label}: Enter chọn mục khớp`);
      await input.fill('khong co xet nghiem nay');
      await page.locator('.search-select-empty').waitFor();
      await input.press('Escape');
      assert.match(await input.inputValue(), /Điện giải đồ E2E/, `${label}: Esc giữ xét nghiệm đang chọn`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
