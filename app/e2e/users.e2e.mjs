import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

test('Người dùng: tạo tài khoản qua hộp thoại và sửa thẻ truy cập', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await bootstrapAndLogin(page);
    await openPage(page, 'Người dùng');
    const table = page.getByRole('table');
    await table.getByText('Đang đăng nhập').waitFor();
    await table.getByText('Toàn bộ thẻ').waitFor();
    await page.getByRole('button', { name: /Thêm người dùng/ }).click();
    const create = page.getByRole('dialog', { name: 'Thêm người dùng' });
    await create.getByLabel('Họ tên', { exact: true }).fill('Kỹ thuật viên kiểm thử');
    await create.getByLabel('Tên đăng nhập', { exact: true }).fill('ktv-layout');
    await create.getByLabel('Mật khẩu tạm', { exact: true }).fill('mat-khau-ktv-123');
    await create.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('chua-khop');
    await create.getByRole('button', { name: 'Lưu tài khoản' }).click();
    await create.getByText('Mật khẩu xác nhận chưa khớp.').waitFor();
    assert.equal(await create.getByLabel('Xác nhận mật khẩu', { exact: true }).getAttribute('aria-invalid'), 'true');
    assert.equal(await table.getByText('ktv-layout', { exact: true }).count(), 0);
    await create.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('mat-khau-ktv-123');
    const permissions = create.getByRole('group', { name: 'Thẻ được truy cập' });
    for (const checkbox of await permissions.getByRole('checkbox').all()) await checkbox.uncheck();
    await create.getByRole('button', { name: 'Lưu tài khoản' }).click();
    await permissions.getByText('Cần chọn ít nhất một thẻ được phép dùng.').waitFor();
    await permissions.getByText('Ghi kết quả QC và xem biểu đồ theo lô.').click();
    await permissions.getByText('Cần chọn ít nhất một thẻ được phép dùng.').waitFor({ state: 'hidden' });
    assert.equal(await permissions.getByRole('checkbox', { name: 'Nhập QC & Biểu đồ' }).isChecked(), true);
    await create.screenshot({ path: path.join(userDataDir, 'users-create.png') });
    await page.setViewportSize({ width: 670, height: 800 });
    const layout = await create.locator('.user-perm-card').evaluateAll(cards => cards.map(card => ({
      width: card.clientWidth, scroll: card.scrollWidth, height: card.clientHeight, contentHeight: card.scrollHeight,
    })));
    assert.ok(layout.every(card => card.width >= card.scroll && card.height >= card.contentHeight));
    await create.getByRole('button', { name: 'Lưu tài khoản' }).click();
    await create.waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const row = table.getByRole('row', { name: /ktv-layout/ });
    await row.getByRole('cell', { name: 'Nhập QC & Biểu đồ', exact: true }).waitFor();
    await row.getByRole('button', { name: 'Sửa quyền Kỹ thuật viên kiểm thử' }).click();
    const edit = page.getByRole('dialog', { name: 'Sửa quyền người dùng' });
    assert.equal(await edit.getByRole('checkbox', { name: 'Cài đặt & Kết nối' }).isDisabled(), true);
    await edit.getByRole('checkbox', { name: 'Tổng quan', exact: true }).check();
    await edit.getByRole('button', { name: 'Lưu quyền' }).click();
    await edit.waitFor({ state: 'hidden' });
    await row.getByRole('cell', { name: 'Tổng quan, Nhập QC & Biểu đồ', exact: true }).waitFor();
    await page.screenshot({ path: path.join(userDataDir, 'users-table.png') });
    assert.deepEqual(errors, []);
    console.log(`Ảnh kiểm tra mục Người dùng: ${userDataDir}`);
  } finally { await app.close(); }
});
