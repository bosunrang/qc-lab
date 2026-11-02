// Hộp thoại trên app thật (U2, U3, U7 của đánh giá 2026-10-31): mở form là gõ
// được ngay, Esc chỉ đóng lớp trên cùng và hỏi trước khi bỏ dữ liệu đã nhập,
// bấm Lưu hai lần liền chỉ tạo một bản ghi, đóng xong focus về nút đã mở.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

const activeName = (page) => page.evaluate(() => document.activeElement?.getAttribute('name') ?? '');
const activeText = (page) => page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');

test('modal: focus, Esc theo lớp, hỏi khi bỏ dữ liệu, chặn lưu trùng', { timeout: 180_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    await openPage(page, 'Cấu hình chung');

    // U2: mở form là con trỏ nằm ở ô đầu tiên, gõ được ngay.
    await page.getByRole('button', { name: '＋ Thêm máy xét nghiệm' }).click();
    const modal = page.locator('.modal[role=dialog]', { hasText: 'Thêm máy xét nghiệm' });
    await modal.waitFor();
    assert.equal(await activeName(page), 'name', 'focus vào ô Tên hiển thị, không phải nút ✕');
    await page.keyboard.type('Máy E2E');
    const nameInput = modal.locator('input[name=name]');
    assert.equal(await nameInput.inputValue(), 'Máy E2E');

    // U3: Esc khi form đã sửa thì hỏi; Esc lần nữa chỉ đóng hộp hỏi.
    await page.keyboard.press('Escape');
    const confirm = page.locator('.confirm-modal', { hasText: 'Bỏ thay đổi chưa lưu?' });
    await confirm.waitFor();
    await page.keyboard.press('Escape');
    await confirm.waitFor({ state: 'detached' });
    assert.equal(await modal.isVisible(), true, 'Esc trên hộp hỏi không đóng luôn form');
    // Bấm ra nền cũng hỏi; chọn "Tiếp tục sửa" thì giữ nguyên dữ liệu.
    await page.mouse.click(5, 5);
    await confirm.waitFor();
    await confirm.getByRole('button', { name: 'Tiếp tục sửa' }).click();
    await confirm.waitFor({ state: 'detached' });
    assert.equal(await nameInput.inputValue(), 'Máy E2E');

    // U7: hai cú bấm trong cùng một khung hình — trước khi nút kịp khoá.
    await modal.locator('button[type=submit]').evaluate((button) => { button.click(); button.click(); });
    await modal.waitFor({ state: 'detached' });
    const saved = await page.evaluate(async () => (await window.qcApi.listInstruments()).filter((item) => item.name === 'Máy E2E').length);
    assert.equal(saved, 1, 'bấm Lưu hai lần liền chỉ tạo một máy');
    assert.equal(await activeText(page), '＋ Thêm máy xét nghiệm', 'đóng xong focus về nút đã mở form');

    // U3: Esc khi lịch chọn ngày đang mở trong modal chỉ đóng lịch.
    await page.locator('.config-shell-tabs').getByRole('button', { name: /Lô & Nhóm QC/ }).click();
    await page.getByRole('button', { name: '+ Thêm lô' }).click();
    const lotModal = page.locator('.modal[role=dialog]', { hasText: 'Thêm lô QC' });
    await lotModal.waitFor();
    await lotModal.locator('.field', { hasText: 'Hạn sử dụng' }).locator('.datepick').click();
    const picker = page.locator('#vnDatePicker');
    await picker.waitFor();
    await page.keyboard.press('Escape');
    await picker.waitFor({ state: 'detached' });
    assert.equal(await lotModal.isVisible(), true, 'Esc chỉ đóng lịch, không đóng modal');
    // Chưa gõ gì thì Esc đóng ngay, không hỏi.
    await page.keyboard.press('Escape');
    await lotModal.waitFor({ state: 'detached' });
    assert.equal(await page.locator('.confirm-modal').count(), 0);

    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
