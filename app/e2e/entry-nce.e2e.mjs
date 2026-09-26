// Luồng nghiệp vụ chính trên app thật: nhập điểm QC ở bảng Nhập QC, điểm vi
// phạm 1-3s hiện đúng cảnh báo, lập hồ sơ NCE từ trang Khắc phục sự cố, rồi
// huỷ một điểm theo quy trình huỷ (không xoá cứng) và thấy hồ sơ NCE tự mở.
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

    // Lập hồ sơ NCE cho mức vi phạm từ danh sách "Sự cố cần xử lý".
    await openPage(page, 'Khắc phục sự cố');
    const issue = page.locator('.issue-row.rej', { hasText: 'M2' });
    await issue.getByRole('button', { name: 'Lập hồ sơ' }).click();
    await page.locator('.field', { hasText: 'Xử lý tức thời đã thực hiện' }).locator('textarea')
      .fill('Dừng trả kết quả mức 2, chạy lại QC với lọ mới.');
    await page.getByRole('button', { name: 'Lập hồ sơ NCE' }).click();
    const logRow = page.locator('table.action-log-table tbody tr', { hasText: seeded.testName }).first();
    await logRow.waitFor();
    assert.match(await logRow.innerText(), /NCE-/);

    // Huỷ điểm mức 1 do nhập sai: điểm được giữ lại với dấu huỷ, không mở NCE.
    await openPage(page, 'Nhập QC & Biểu đồ');
    await page.getByRole('button', { name: `Hủy điểm QC ngày ${ddmmyyyy(today)}` }).first().click();
    const dialog = page.locator('.modal[role=dialog]', { hasText: 'Hủy điểm QC' });
    await dialog.locator('#voidKindInput').selectOption('data-entry');
    await dialog.locator('#voidReasonInput').fill('Gõ nhầm giá trị khi nhập tay.');
    await dialog.getByRole('button', { name: 'Hủy điểm này' }).click();
    await page.locator('.alert.warn', { hasText: 'Đã hủy điểm QC' }).waitFor();

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
