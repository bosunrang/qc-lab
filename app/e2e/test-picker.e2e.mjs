// Bộ chọn xét nghiệm dùng chung (kế hoạch kiến trúc D.8) ở Báo cáo và Phân
// tích Westgard: một ô chọn có tìm kiếm (`SearchSelect`, cùng ô ở Ngoại kiểm),
// tìm không dấu. Trước 2026-09-26, Westgard chỉ hạ chữ thường nên gõ
// "dien giai" không tìm được "Điện giải".
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest } from './helpers.mjs';

test('ô chọn xét nghiệm thống nhất kiểu gợi ý, không tự bôi đen và chỉ nhận lựa chọn có sẵn', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const created = await page.evaluate((instrumentId) => window.qcApi.saveTest({ data: { name: 'Điện giải đồ E2E', instrumentId, unit: 'mmol/L' } }), seeded.instrumentId);
    assert.equal(created.ok, true, JSON.stringify(created));

    let pickerStyle;
    for (const [label, inputId, countId] of [
      ['Phân tích Westgard', '#wgTestSelect', '#wgTestCount'],
      ['Báo cáo & Biểu mẫu', '#rTest', '#reportTestCount'],
      ['Six Sigma & Sai số', '#sgTestSelect, #sgTestSelectNoLevel', null],
    ]) {
      await openPage(page, label);
      const input = page.locator(inputId);
      await input.waitFor();
      if (countId) assert.equal(await page.locator(countId).innerText(), '(2)', `${label}: đủ hai xét nghiệm`);
      assert.notEqual(await input.inputValue(), '', `${label}: mở trang đã có xét nghiệm được chọn sẵn`);
      if (label === 'Phân tích Westgard') {
        for (const width of [900, 1366]) {
          await page.setViewportSize({ width, height: 900 });
          const inputBox = await input.boundingBox();
          for (const button of await page.locator('.wg-export-actions .btn').all()) {
            const box = await button.boundingBox();
            assert.ok(Math.abs(box.y - inputBox.y) < 1, `Westgard ${width}px: nút xuất thẳng hàng ô chọn`);
            assert.ok(Math.abs(box.height - inputBox.height) < 1, 'nút và ô chọn cùng chiều cao');
          }
        }
        await page.locator('.wg-setup-panel').screenshot({ path: path.join(userDataDir, 'westgard-picker-aligned.png') });
      }
      assert.equal(await input.getAttribute('type'), 'text');
      await input.focus();
      assert.equal(await page.getByRole('listbox').count(), 0, `${label}: focus không tự mở danh sách`);
      await input.click();
      assert.equal(await input.evaluate((el) => el.selectionStart === el.selectionEnd), true, `${label}: bấm vào ô không tự bôi đen chữ`);
      await input.press('Escape');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.getByRole('listbox').count(), 0, `${label}: Tab không mở danh sách`);
      await input.press('ArrowDown');
      await page.getByRole('listbox').waitFor();
      await input.press('Escape');
      await input.fill('dien giai');
      const options = page.locator('[role="listbox"] [role="option"]');
      await options.first().waitFor();
      assert.equal(await options.count(), 1, `${label}: tìm không dấu chỉ còn mục khớp`);
      pickerStyle = await options.first().evaluate((el) => {
        const css = getComputedStyle(el);
        return [css.fontSize, css.minHeight, css.paddingTop, css.paddingLeft, css.borderBottomWidth];
      });
      await input.press('Enter');
      assert.match(await input.inputValue(), /Điện giải đồ E2E/, `${label}: Enter chọn mục khớp`);
      await input.fill('khong co xet nghiem nay');
      await page.locator('.search-select-empty').waitFor();
      await input.press('Enter');
      assert.equal(await input.inputValue(), 'khong co xet nghiem nay', `${label}: không nhận tên tự gõ thành lựa chọn`);
      await input.press('Escape');
      assert.match(await input.inputValue(), /Điện giải đồ E2E/, `${label}: Esc giữ xét nghiệm đang chọn`);
      await input.fill('glucose');
      await page.getByRole('option').first().click();
      assert.match(await input.inputValue(), /Glucose E2E/, `${label}: bấm chuột đổi được xét nghiệm`);
      assert.equal(await input.evaluate((el) => el.selectionStart === el.selectionEnd), true, `${label}: chọn xong không bôi đen chữ`);
    }

    await openPage(page, 'Cấu hình chung');
    await page.getByRole('button', { name: /Lịch sử dữ liệu/ }).click();
    const history = page.locator('#history-test');
    await history.fill('dien giai');
    await page.getByRole('option').first().click();
    assert.match(await history.inputValue(), /Điện giải đồ E2E/);
    await page.getByRole('button', { name: /Danh mục xét nghiệm/ }).click();
    await page.getByRole('button', { name: /Thêm xét nghiệm/ }).click();
    const name = page.locator('#test-name');
    await name.fill('glucose');
    const suggestion = page.locator('#assayTeaSuggestions [role="option"]').first();
    await suggestion.waitFor();
    const formStyle = await suggestion.evaluate((el) => {
      const css = getComputedStyle(el);
      return [css.fontSize, css.minHeight, css.paddingTop, css.paddingLeft, css.borderBottomWidth];
    });
    assert.deepEqual(formStyle.slice(0, 4), pickerStyle.slice(0, 4), 'gợi ý trong form và ô chọn dùng cùng cách trình bày');
    await page.screenshot({ path: path.join(userDataDir, 'assay-search-shared.png'), fullPage: true });
    await suggestion.click();
    assert.match(await name.inputValue(), /Glucose/i);
    await name.fill('Xét nghiệm tự đặt mới');
    await name.press('Escape');
    await page.locator('#test-unit').click();
    assert.equal(await name.inputValue(), 'Xét nghiệm tự đặt mới', 'form thêm xét nghiệm vẫn cho phép nhập tên mới');
    await name.click();
    assert.equal(await name.evaluate((el) => el.selectionStart === el.selectionEnd), true);
    console.log(`Ảnh kiểm tra: ${userDataDir}`);
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
