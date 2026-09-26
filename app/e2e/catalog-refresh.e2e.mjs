// Danh mục tự nạp lại khi đổi ở nơi khác (kế hoạch kiến trúc D.3). Trước
// 2026-09-26 trang Nhập QC chỉ nạp lô/nhóm lô/Panel một lần lúc mở: quản trị
// viên dừng nhóm lô trên máy chính thì cây Nhập QC đang mở (ví dụ ở máy trạm)
// vẫn cho chọn xét nghiệm đó và hiện ô nhập tới khi rời trang.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest } from './helpers.mjs';

test('Nhập QC đang mở tự cập nhật khi nhóm lô bị dừng ở nơi khác', { timeout: 120_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    // Thêm một điểm để nhóm lô "đang dùng" và dừng được.
    await page.evaluate((testId) => window.qcApi.addPoint({ data: { testId, level: 1, date: '2026-09-01', val: 5 } }), seeded.testId);

    await openPage(page, 'Nhập QC & Biểu đồ');
    await page.locator('.tnode.tn-config', { hasText: seeded.testName }).waitFor();

    // Dừng nhóm lô qua API, như một thao tác ở cửa sổ/máy khác: trang không
    // được điều hướng lại, chỉ nhận thông báo thay đổi.
    const stopped = await page.evaluate(async () => {
      const groups = await window.qcApi.listLotGroups();
      return window.qcApi.stopLotGroup({ id: groups[0].id });
    });
    assert.equal(stopped.ok, true, JSON.stringify(stopped));
    await page.getByText('Chưa có xét nghiệm sẵn sàng nhập').waitFor({ timeout: 10_000 });
    assert.equal(await page.locator('.qc-sheet input.qc-inline-input').count(), 0, 'không còn ô nhập cho nhóm lô đã dừng');
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
