// Backup, xoá sạch và phục hồi trên app thật, đi qua đúng các nút ở trang Cài
// đặt: hộp thoại lưu/mở tệp của hệ thống được giả lập ở main (`dialog`), còn
// hộp thoại xác nhận, xác thực lại mật khẩu và thông báo kết quả là của app.
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ADMIN, bootstrapAndLogin, launchApp, openPage, seedOperationalTest } from './helpers.mjs';

/** Hộp thoại app có đúng tiêu đề này (lời nhắc của hộp xác thực lại có thể
 * lặp chữ của tiêu đề hộp xác nhận, nên không lọc theo nội dung). */
const dialogTitled = (page, title) => page.locator('.modal[role=dialog]')
  .filter({ has: page.getByRole('heading', { name: title, exact: true }) });

/** Bấm nút xác nhận của hộp thoại app đang mở (theo tiêu đề). */
async function confirmIn(page, title, button) {
  const dialog = dialogTitled(page, title);
  await dialog.getByRole('button', { name: button, exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
}

async function reauth(page) {
  await page.fill('#reauth-password', ADMIN.password);
  await page.getByRole('button', { name: 'Xác thực', exact: true }).click();
}

/** Đọc thông báo kết quả rồi đóng. */
async function closeInfo(page, text) {
  const dialog = page.locator('.info-modal[role=dialog]', { hasText: text });
  const message = await dialog.innerText();
  await dialog.getByRole('button', { name: 'Đã hiểu' }).click();
  await dialog.waitFor({ state: 'detached' });
  return message;
}

const testNames = (page) => page.evaluate(async () => (await window.qcApi.listTests()).map((test) => test.name));

test('xuất backup, xoá sạch dữ liệu rồi phục hồi lại từ tệp vừa xuất', { timeout: 180_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  const backupPath = path.join(userDataDir, 'e2e-backup.sqlite');
  try {
    await bootstrapAndLogin(page);
    const { testName } = await seedOperationalTest(page);
    await app.evaluate(({ dialog }, file) => {
      globalThis.__dialogs = { save: [], open: [] };
      globalThis.__cancelNext = false;
      dialog.showSaveDialog = async (_win, options) => {
        globalThis.__dialogs.save.push(options.defaultPath);
        if (globalThis.__cancelNext) { globalThis.__cancelNext = false; return { canceled: true, filePath: '' }; }
        return { canceled: false, filePath: file };
      };
      dialog.showOpenDialog = async () => { globalThis.__dialogs.open.push(file); return { canceled: false, filePaths: [file] }; };
    }, backupPath);
    await openPage(page, 'Cài đặt & Đám mây');

    // Huỷ hộp thoại lưu: không có tệp, không có thông báo.
    await app.evaluate(() => { globalThis.__cancelNext = true; });
    await page.getByRole('button', { name: 'Xuất backup', exact: true }).click();
    await page.waitForTimeout(300);
    assert.equal(existsSync(backupPath), false, 'huỷ thì không ghi tệp');
    assert.equal(await page.locator('.modal[role=dialog]').count(), 0);

    await page.getByRole('button', { name: 'Xuất backup', exact: true }).click();
    const exported = await closeInfo(page, 'Đã xuất backup');
    assert.match(exported, new RegExp(backupPath.replace(/[\\.]/g, '\\$&')));
    assert.ok(statSync(backupPath).size > 0, 'tệp backup có nội dung');
    const { save } = await app.evaluate(() => globalThis.__dialogs);
    assert.match(save.at(-1), /^qclab-backup-\d{4}-\d{2}-\d{2}\.sqlite$/, 'tên gợi ý của hộp thoại lưu');

    await page.getByRole('button', { name: 'Xóa sạch dữ liệu' }).click();
    await confirmIn(page, 'Xóa sạch dữ liệu test', 'Xóa sạch');
    await reauth(page);
    const reset = await closeInfo(page, 'Đã xoá');
    const resetSnapshot = reset.match(/Bản sao lưu trước khi xoá: (.+)$/m)?.[1].trim();
    assert.ok(resetSnapshot && existsSync(resetSnapshot), 'main chốt bản an toàn trước khi xoá');
    assert.deepEqual(await testNames(page), [], 'xét nghiệm đã bị xoá');

    await page.getByRole('button', { name: 'Chọn file backup' }).click();
    const confirm = dialogTitled(page, 'Phục hồi từ backup');
    assert.match(await confirm.innerText(), /e2e-backup\.sqlite hợp lệ/);
    await confirmIn(page, 'Phục hồi từ backup', 'Phục hồi');
    await reauth(page);
    const restored = await closeInfo(page, 'Đã phục hồi thành công');
    const restoreSnapshot = restored.match(/được lưu tại:\s*(.+)$/m)?.[1].trim();
    assert.ok(restoreSnapshot && existsSync(restoreSnapshot), 'main chốt bản an toàn trước khi phục hồi');
    assert.deepEqual(await testNames(page), [testName], 'dữ liệu trở lại đúng như lúc xuất');

    // Phiên vẫn dùng được sau phục hồi: mở trang khác không lỗi.
    await openPage(page, 'Nhập QC & Biểu đồ');
    await page.locator('.qc-sheet').first().waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
