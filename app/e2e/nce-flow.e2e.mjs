// Vòng đời hồ sơ NCE trên giao diện thật (docs/NCE-REDESIGN-2026-10-12.md,
// giai đoạn 3): lập hồ sơ từ hàng chờ, ghi ảnh hưởng bệnh nhân, cho phép hoạt
// động trở lại bằng lần rerun, phân tầng, checklist, nộp duyệt; người báo cáo
// không duyệt được, một KTV được cấp quyền duyệt thì đóng hồ sơ.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, enterValue, launchApp, login, openPage, seedOperationalTest, TECH, todayIn } from './helpers.mjs';

const section = (page, title) => page.locator(`section[aria-label="${title}"]`);

test('hồ sơ NCE: lập, cho chạy lại, nộp duyệt, người độc lập duyệt đóng', { timeout: 240_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const today = await todayIn(page);
    // KTV được cấp quyền duyệt hồ sơ NCE.
    await page.evaluate(async (user) => {
      const created = await window.qcApi.createUser({ data: { ...user, role: 'technician' } });
      if (!created.ok) throw new Error(JSON.stringify(created.error));
      const caps = await window.qcApi.setUserNceCapabilities({ id: created.data.id, capabilities: ['nce.approve'] });
      if (!caps.ok) throw new Error(JSON.stringify(caps.error));
    }, TECH);

    await openPage(page, 'Nhập QC & Biểu đồ');
    await page.locator('.qc-sheet-title strong', { hasText: seeded.testName }).waitFor();
    await enterValue(page, today, 1, 5.1);
    await page.locator('.entry-sheet-message .alert.ok', { hasText: 'Mức 1' }).waitFor();
    await enterValue(page, today, 2, 17.1);
    await page.locator('.entry-sheet-message .alert.rej', { hasText: '1-3s' }).waitFor();
    // Lần chạy QC lại sau khi xử lý: hai mức đều đạt.
    const rerunId = await page.evaluate(async ({ testId, day }) => {
      const [first] = await window.qcApi.queryPoints(testId, 1);
      const runId = `${first.run_id}-chay-lai`;
      for (const [level, val] of [[1, 5], [2, 15]]) {
        const added = await window.qcApi.addPoint({ data: { testId, level, date: day, runId, val } });
        if (!added.ok) throw new Error(JSON.stringify(added.error));
      }
      return runId;
    }, { testId: seeded.testId, day: today });

    // 1. Lập hồ sơ từ hàng chờ.
    await openPage(page, 'Khắc phục sự cố');
    const queueRow = page.locator('table.nce-table tbody tr', { hasText: seeded.testName }).first();
    await queueRow.getByRole('button', { name: 'Lập hồ sơ' }).click();
    const modal = page.locator('.modal[role=dialog]', { hasText: 'Lập hồ sơ NCE' });
    await modal.locator('#nceCorrection').fill('Dừng trả kết quả mức 2, chạy lại QC với lọ mới.');
    await modal.getByLabel('Có, đã dừng/giữ').check();
    await modal.getByRole('button', { name: 'Lập hồ sơ' }).click();
    await page.locator('.panel-head h2', { hasText: /Hồ sơ NCE-/ }).waitFor();
    await page.locator('.nce-missing', { hasText: 'Chưa có quyết định ảnh hưởng kết quả bệnh nhân' }).waitFor();

    // 2. Ảnh hưởng kết quả bệnh nhân.
    const impact = section(page, 'Ảnh hưởng kết quả bệnh nhân');
    await impact.getByRole('button', { name: 'Ghi quyết định' }).click();
    await impact.locator('#impOutcome').selectOption('not_reported');
    await impact.locator('#impDesc').fill('Đã giữ toàn bộ kết quả trong khoảng nghi ngờ.');
    await impact.getByRole('button', { name: 'Ghi quyết định' }).click();
    await impact.locator('td', { hasText: 'Chưa trả kết quả nào' }).waitFor();

    // 3. Cho phép hoạt động trở lại bằng lần rerun, xem trước kết quả đánh giá.
    const release = section(page, 'Cho phép hoạt động trở lại');
    const option = release.locator('#relRun option', { hasText: 'chay-lai' });
    await option.waitFor({ state: 'attached' });
    await release.locator('#relRun').selectOption(await option.getAttribute('value'));
    await release.locator('.alert.ok', { hasText: 'Lần chạy đạt khi đánh giá trong giai đoạn mới' }).waitFor();
    await release.locator('#relReason').fill('QC chạy lại đạt cả hai mức sau khi thay lọ.');
    await release.getByRole('button', { name: 'Cho phép hoạt động trở lại' }).click();
    await page.locator('.modal[role=dialog]', { hasText: 'luật Westgard nhiều lần chạy và CUSUM bắt đầu chuỗi mới' }).getByRole('button', { name: 'Cho phép' }).click();
    await page.locator('.tag', { hasText: 'Đã cho chạy lại' }).first().waitFor();
    assert.match(await release.innerText(), new RegExp(`lần ${rerunId}`));

    // 4–5. Phân tầng, nguy cơ và checklist.
    const tier = section(page, 'Phân tầng và đánh giá nguy cơ');
    await tier.getByRole('button', { name: 'Sửa' }).click();
    await tier.locator('#tierSel').selectOption('low');
    await tier.locator('#tierReason').fill('Lỗi đơn lẻ do lọ QC, đã khôi phục ngay.');
    await tier.locator('#riskS').selectOption('1');
    await tier.locator('#riskP').selectOption('1');
    await tier.locator('#riskL').selectOption('low');
    await tier.locator('#riskB').fill('SOP-QC-07 bảng 3');
    await tier.getByRole('button', { name: 'Lưu' }).click();
    await tier.locator('dd', { hasText: 'Thấp · mức độ 1 × khả năng 1 = 1' }).waitFor();
    const investigation = section(page, 'Điều tra và nguyên nhân');
    await investigation.getByRole('button', { name: 'Sửa' }).click();
    const checks = investigation.locator('select[aria-label^="Kết quả"]');
    for (let i = 0; i < await checks.count(); i++) await checks.nth(i).selectOption('ok');
    await investigation.getByRole('button', { name: 'Lưu' }).click();
    await page.locator('.alert.ok', { hasText: 'hồ sơ đã đủ điều kiện' }).waitFor();

    // 8. Nộp duyệt; người báo cáo không được duyệt.
    await page.getByRole('button', { name: 'Nộp duyệt' }).click();
    await page.locator('.tag', { hasText: 'Chờ duyệt' }).first().waitFor();
    await section(page, 'Nộp duyệt và phê duyệt').locator('.alert.info', { hasText: 'người báo cáo' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Duyệt đóng hồ sơ' }).count(), 0);

    // KTV có quyền duyệt và không tham gia hồ sơ thì đóng được.
    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await login(page, TECH);
    await openPage(page, 'Khắc phục sự cố');
    await page.getByRole('button', { name: /Chờ duyệt/ }).click();
    // Dòng hàng chờ của lần chạy cũng có nút "Mở hồ sơ"; chọn đúng dòng trong bảng hồ sơ.
    await page.locator('table.nce-table tbody tr', { hasText: 'Chờ duyệt' }).getByRole('button', { name: 'Mở hồ sơ' }).click();
    await page.getByRole('button', { name: 'Duyệt đóng hồ sơ' }).click();
    await page.locator('.tag', { hasText: 'Đã đóng' }).first().waitFor();
    assert.equal(await page.locator('.nce-step.is-done').count(), 4);
    await section(page, 'Lịch sử hồ sơ').locator('b', { hasText: 'Duyệt đóng hồ sơ' }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
