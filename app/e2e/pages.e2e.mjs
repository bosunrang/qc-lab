// Mở lần lượt mọi trang ở thanh điều hướng, với dữ liệu thật đã cấu hình:
// không trang nào rơi vào `PageErrorBoundary`, không có lỗi console hay lỗi
// không được bắt. Đây là lưới an toàn cho các đợt tách trang lớn (giai đoạn D).
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, enterValue, launchApp, openPage, seedOperationalTest, todayIn } from './helpers.mjs';

test('mọi trang ở thanh điều hướng mở được không lỗi', { timeout: 180_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    await seedOperationalTest(page);
    // Có sẵn một điểm để Westgard, Sigma, Báo cáo có dữ liệu mà vẽ.
    await openPage(page, 'Nhập QC & Biểu đồ');
    await enterValue(page, await todayIn(page), 1, 5.1);
    await page.locator('.entry-sheet-message .alert.ok').waitFor();

    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    const labels = await nav.getByRole('link').allInnerTexts();
    assert.equal(labels.length, 11, `quản trị viên thấy đủ 11 trang: ${labels.join(', ')}`);
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
      if (label.trim() === 'Six Sigma & Sai số') {
        await page.getByRole('heading', { name: 'Tình trạng' }).waitFor();
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
