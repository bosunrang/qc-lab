import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

async function focusedAppearance(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    const style = getComputedStyle(element);
    return { tag: element.tagName, outline: style.outlineStyle, width: style.outlineWidth };
  });
}

test('select: chuột không có vòng focus, bàn phím vẫn điều hướng và chọn đúng', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    await page.evaluate(async () => {
      const result = await window.qcApi.saveInstrument({ data: { name: 'Máy kiểm tra focus' } });
      if (!result.ok) throw new Error(result.error.message);
    });
    await openPage(page, 'Cấu hình chung');
    await page.getByRole('button', { name: /^Danh mục xét nghiệm/ }).click();
    await page.getByRole('button', { name: /Thêm xét nghiệm/ }).click();
    const modal = page.locator('.rcfg-assay-modal');
    const source = modal.locator('#test-tea-source');

    // Kiểm tra cả lần mở đầu và mở lại, không chỉ trạng thái ô đang đóng.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await source.click();
      await page.waitForFunction(() => document.querySelector('#test-tea-source').matches(':open'));
      const focus = await focusedAppearance(page);
      assert.equal(focus.tag, 'OPTION');
      assert.equal(focus.outline, 'none', 'chuột không tạo vòng quanh option');
      assert.equal(await source.evaluate((select) => getComputedStyle(select).outlineStyle), 'none');
      assert.equal(await source.inputValue(), 'lab');
      if (attempt === 0) await modal.screenshot({ path: path.join(userDataDir, 'select-pointer.png') });
      await page.keyboard.press('Escape');
      assert.equal(await modal.isVisible(), true, 'Escape chỉ đóng danh sách');
    }

    // Tab thật đưa focus trở lại ô chọn; Space mở và phím mũi tên đổi mục.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await source.evaluate((select) => document.activeElement === select), true);
    assert.equal((await focusedAppearance(page)).outline, 'solid');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.activeElement?.tagName === 'OPTION');
    assert.equal((await focusedAppearance(page)).outline, 'solid');
    await page.keyboard.press('ArrowDown');
    assert.equal((await focusedAppearance(page)).width, '2px');
    await modal.screenshot({ path: path.join(userDataDir, 'select-keyboard.png') });
    await page.keyboard.press('Enter');
    assert.equal(await source.inputValue(), 'clia', 'bàn phím chọn đúng mục');

    await source.click();
    assert.equal((await focusedAppearance(page)).outline, 'none');
    await page.keyboard.press('ArrowDown');
    assert.equal((await focusedAppearance(page)).outline, 'solid', 'chuyển sang bàn phím khi đang mở phải có vòng ngay');
    await page.keyboard.press('Enter');
    assert.equal(await source.inputValue(), 'ricos');
    await source.click();
    await source.locator('option[value=lab]').click();
    assert.equal(await source.inputValue(), 'lab', 'chuột vẫn chọn đúng mục');
    assert.deepEqual(errors, []);
    console.log(`Ảnh kiểm tra focus: ${userDataDir}`);
  } finally { await app.close(); }
});
