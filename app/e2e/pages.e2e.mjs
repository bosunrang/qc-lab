// Mở lần lượt mọi trang ở thanh điều hướng, với dữ liệu thật đã cấu hình:
// không trang nào rơi vào `PageErrorBoundary`, không có lỗi console hay lỗi
// không được bắt. Đây là lưới an toàn cho các đợt tách trang lớn (giai đoạn D).
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, enterValue, launchApp, openPage, seedOperationalTest, todayIn } from './helpers.mjs';

test('mọi trang ở thanh điều hướng mở được không lỗi', { timeout: 180_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    await seedOperationalTest(page);
    // Có sẵn một điểm để Westgard, Sigma, Báo cáo có dữ liệu mà vẽ.
    await openPage(page, 'Nhập QC & Biểu đồ');
    await enterValue(page, await todayIn(page), 1, 5.1);
    const saved = page.locator('.toast-ok', { hasText: 'Đã lưu Mức 1' });
    await saved.waitFor();
    await saved.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
    const initial = await saved.boundingBox();
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert.ok(initial.x > viewport.width / 2 && initial.y > viewport.height / 2, 'thông báo nằm ở góc dưới bên phải cửa sổ');
    assert.equal(await page.locator('.toast-stack').evaluate((element) => getComputedStyle(element).position), 'fixed');
    await page.locator('main').evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const scrolled = await saved.boundingBox();
    assert.ok(Math.abs(initial.y - scrolled.y) < 2, 'cuộn trang vẫn thấy thông báo ở cùng vị trí');
    assert.equal(await page.locator('.entry-sheet-message').count(), 0, 'không còn thông báo dưới bảng nhập');
    await page.screenshot({ path: path.join(userDataDir, 'entry-toast-corner.png') });
    console.log(`Ảnh thông báo nhập QC ở góc màn hình: ${path.join(userDataDir, 'entry-toast-corner.png')}`);
    await saved.waitFor({ state: 'detached', timeout: 9000 });
    await page.locator('main').evaluate((element) => { element.scrollTop = 0; });

    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    const labels = await nav.getByRole('link').allInnerTexts();
    assert.equal(labels.length, 12, `quản trị viên thấy đủ 12 trang: ${labels.join(', ')}`);
    for (const label of labels) {
      await openPage(page, label.trim());
      await page.locator('main .head').first().waitFor();
      // Cho các lệnh nạp dữ liệu bất đồng bộ của trang kịp chạy xong.
      await page.waitForTimeout(400);
      const crashed = await page.getByText('Trang này gặp lỗi khi hiển thị').count();
      assert.equal(crashed, 0, `trang "${label}" rơi vào PageErrorBoundary`);
      if (label.trim() === 'Phân tích Westgard') {
        // Bảng điểm dùng chung (`WestgardPointTable`) hiện đúng điểm vừa nhập.
        await page.locator('.wg-table tbody tr', { hasText: '5.10' }).first().waitFor();
      }
      if (label.trim() === 'Phân tích ngoại kiểm') {
        await page.getByText('Chưa có đợt ngoại kiểm nào').waitFor();
      }
      if (label.trim() === 'Six Sigma & Sai số') {
        await page.getByRole('heading', { name: 'Tình trạng' }).waitFor();
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
