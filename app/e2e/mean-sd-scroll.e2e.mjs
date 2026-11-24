import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest } from './helpers.mjs';

test('Mean/SD: nền tiêu đề phủ đủ các cột khi cuộn ngang ở màn hình hẹp', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    await seedOperationalTest(page);
    await openPage(page, 'Cấu hình chung');
    await page.getByRole('navigation', { name: 'Danh mục cấu hình' }).getByRole('button', { name: /^Mean\/SD/ }).click();
    const table = page.locator('.target-table');
    await table.locator('.target-row').first().waitFor();
    for (const width of [1480, 1024, 820]) {
      await page.setViewportSize({ width, height: 850 });
      for (const fraction of [0, 0.5, 1]) {
        await table.evaluate((el, fraction) => { el.scrollLeft = (el.scrollWidth - el.clientWidth) * fraction; }, fraction);
        const layout = await table.evaluate(el => {
          const head = el.querySelector('.target-head');
          const row = el.querySelector('.target-row');
          const box = head.getBoundingClientRect();
          const cells = [...head.children].map(cell => cell.getBoundingClientRect());
          const data = [...row.children].map(cell => cell.getBoundingClientRect());
          return {
            coversAllColumns: cells.every(cell => cell.left >= box.left - 1 && cell.right <= box.right + 1),
            aligned: cells.every((cell, i) => Math.abs((cell.left + cell.right) / 2 - (data[i].left + data[i].right) / 2) <= 1),
            sameWidth: Math.abs(box.width - row.getBoundingClientRect().width) <= 1,
            background: getComputedStyle(head).backgroundColor,
          };
        });
        assert(layout.coversAllColumns, `nền tiêu đề phủ cả cột Trạng thái ở ${width}px, cuộn ${fraction}`);
        assert(layout.aligned && layout.sameWidth, 'tiêu đề và ô nhập thẳng cột');
        assert.notEqual(layout.background, 'rgba(0, 0, 0, 0)');
      }
      await page.screenshot({ path: path.join(userDataDir, `mean-sd-scroll-${width}.png`) });
    }
    assert.deepEqual(errors, []);
    console.log(`Ảnh kiểm tra Mean/SD: ${userDataDir}`);
  } finally {
    await app.close();
  }
});
