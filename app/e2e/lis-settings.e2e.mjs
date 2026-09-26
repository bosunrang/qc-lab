// Vòng tự hỏi hàng chờ LIS chạy theo cấu hình ĐÃ LƯU, không theo ô tick
// đang sửa (kế hoạch kiến trúc D.10): tick mà chưa lưu thì trạng thái vẫn
// "Chưa bật", không gọi Gateway rồi báo lỗi.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, countIpcCalls, launchApp, openPage } from './helpers.mjs';

test('tick LIS chưa lưu thì chưa hỏi Gateway', { timeout: 120_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const counter = await countIpcCalls(app, ['lis:pullQueue']);
    await openPage(page, 'Cài đặt & Đám mây');
    const status = page.locator('#lisGatewayStatus');
    await status.waitFor();
    await page.locator('#lisGatewayEnabled').check();
    await page.waitForTimeout(600);
    assert.equal((await counter.read())['lis:pullQueue'], 0, 'chưa lưu thì không hỏi hàng chờ');
    assert.doesNotMatch(await status.innerText(), /chưa được bật|Lỗi/i);
    assert.equal(await status.evaluate((el) => el.classList.contains('rej')), false, 'không hiện trạng thái lỗi');
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
