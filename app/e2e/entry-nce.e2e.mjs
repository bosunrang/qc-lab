// Luồng nghiệp vụ chính trên app thật: nhập điểm QC ở bảng Nhập QC, điểm vi
// phạm 1-3s hiện đúng cảnh báo, lần chạy bị loại vào hàng chờ của trang Khắc
// phục sự cố, lập hồ sơ NCE từ hàng chờ, rồi huỷ một điểm theo quy trình huỷ
// (không xoá cứng). Vòng đời đầy đủ của hồ sơ ở `nce-flow.e2e.mjs`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, enterValue, launchApp, openPage, seedOperationalTest, todayIn } from './helpers.mjs';

function ddmmyyyy(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

test('nhập điểm, điểm vi phạm, lập NCE, huỷ điểm', { timeout: 180_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const today = await todayIn(page);

    await openPage(page, 'Nhập QC & Biểu đồ');
    await page.locator('.qc-sheet-title strong', { hasText: seeded.testName }).waitFor();

    // Mức 1: Mean 5, SD 0,2 → 5,1 đạt.
    await enterValue(page, today, 1, 5.1);
    await page.locator('.entry-sheet-message .alert.ok', { hasText: 'Mức 1' }).waitFor();
    // Mức 2: Mean 15, SD 0,5 → 17,1 là +4,2SD, vi phạm 1-3s.
    await enterValue(page, today, 2, 17.1);
    await page.locator('.entry-sheet-message .alert.rej', { hasText: '1-3s' }).waitFor();

    const points = await page.evaluate((testId) => Promise.all([1, 2].map((level) => window.qcApi.queryPoints(testId, level))), seeded.testId);
    assert.deepEqual(points.map((list) => list.map((p) => p.val)), [[5.1], [17.1]], 'hai điểm đã lưu vào CSDL');

    // Lần chạy bị loại vào hàng chờ, một dòng cho một lần chạy; lập hồ sơ ngay trên dòng đó.
    await openPage(page, 'Khắc phục sự cố');
    const queueRow = page.locator('article.nce-queue-item', { hasText: seeded.testName }).first();
    await queueRow.waitFor();
    assert.match(await queueRow.innerText(), /M2 \(1-3s\)/);
    await queueRow.getByRole('button', { name: 'Lập hồ sơ' }).click();
    const modal = page.locator('.modal[role=dialog]', { hasText: 'Lập hồ sơ NCE' });
    await modal.locator('#nceCorrection').fill('Dừng trả kết quả mức 2, chạy lại QC với lọ mới.');
    await modal.getByLabel('Có, đã dừng/giữ').check();
    await modal.getByRole('button', { name: 'Lập hồ sơ' }).click();
    const heading = page.locator('.panel-head h2', { hasText: /Hồ sơ NCE-/ });
    await heading.waitFor();
    await page.locator('.tag', { hasText: 'Đang xử lý' }).first().waitFor();

    // Huỷ điểm mức 1 do nhập sai: điểm được giữ lại với dấu huỷ, không mở NCE.
    await openPage(page, 'Nhập QC & Biểu đồ');
    await page.getByRole('button', { name: `Huỷ điểm QC ngày ${ddmmyyyy(today)}` }).first().click();
    const dialog = page.locator('.modal[role=dialog]', { hasText: 'Huỷ điểm QC' });
    await dialog.locator('#voidKindInput').selectOption('data-entry');
    await dialog.locator('#voidReasonInput').fill('Gõ nhầm giá trị khi nhập tay.');
    await dialog.getByRole('button', { name: 'Huỷ điểm này' }).click();
    await page.locator('.alert.warn', { hasText: 'Đã huỷ điểm QC' }).waitFor();

    const voided = await page.evaluate(async (testId) => {
      const active = await window.qcApi.queryPoints(testId, 1);
      const history = await window.qcApi.listVoidedEntryPoints(testId);
      return { active: active.length, voided: history.length };
    }, seeded.testId);
    assert.equal(voided.active, 0, 'điểm đã huỷ không còn tham gia tính toán');
    assert.equal(voided.voided, 1, 'điểm đã huỷ vẫn được lưu lại, không xoá cứng');
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
