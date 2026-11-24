// Hồi quy ngày hồi cứu và tải QC khi hồ sơ đang mở, trên profile Electron tạm.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest, todayIn } from './helpers.mjs';

test('NCE hồi cứu: đính chính có lịch sử, giải thích QC bị lọc và tự tải QC mới', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const today = await todayIn(page);
    const historical = await page.evaluate(async (testId) => {
      const d = new Date(); d.setDate(d.getDate() - 2);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      for (const [runId, values] of [['1', [5, 17.1]], ['2', [5, 15]]]) {
        for (const [index, val] of values.entries()) {
          const r = await window.qcApi.addPoint({ data: { testId, level: index + 1, date: day, runId, val } });
          if (!r.ok) throw new Error(JSON.stringify(r.error));
        }
      }
      return day;
    }, seeded.testId);
    await openPage(page, 'Khắc phục sự cố');
    await page.locator(`tr.nce-queue-item[aria-label^="Sự cố ${seeded.testName} "]`).getByRole('button', { name: 'Lập hồ sơ' }).click();
    const modal = page.getByRole('dialog');
    await modal.getByLabel(/Nhập hồi cứu/).check();
    assert.equal(await modal.locator('#nceDetected').inputValue(), '', 'không tự lùi ngày phát hiện theo ngày QC');
    await modal.getByLabel(/Nhập hồi cứu/).uncheck();
    assert.equal(await modal.locator('#nceDetected').inputValue(), today.split('-').reverse().join('/'));
    await modal.locator('#nceCorrection').fill('Giữ kết quả và thay lọ QC theo nhật ký');
    await modal.getByLabel('Có, đã dừng/giữ').check();
    await modal.getByRole('button', { name: 'Lập hồ sơ', exact: true }).click();
    await page.locator('.nce-dossier-summary').waitFor();
    const stage = async (name) => page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name }).click();
    await stage(/Cho hoạt động trở lại/);
    const release = page.getByRole('region', { name: 'Cho phép hoạt động trở lại' });
    await release.locator('.nce-rerun-excluded', { hasText: 'Trước ngày phát hiện' }).waitFor();
    assert.equal(await release.locator('#relRun option').count(), 1);
    await release.screenshot({ path: path.join(userDataDir, 'nce-excluded.png') });
    await release.getByRole('button', { name: 'Đến phần ghi nhận' }).click();
    const identity = page.getByRole('region', { name: 'Ghi nhận và xử lý tức thời' });
    await identity.getByRole('button', { name: 'Đính chính ngày phát hiện', exact: true }).click();
    await identity.locator('#nceCorrectDetected').fill(historical);
    await identity.locator('#nceCorrectReason').fill('Nhập nhầm ngày lập; đối chiếu nhật ký QC thực tế');
    await identity.screenshot({ path: path.join(userDataDir, 'nce-date-correction.png') });
    await identity.getByRole('button', { name: 'Lưu đính chính', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Lưu đính chính', exact: true }).click();
    await identity.getByRole('button', { name: 'Đính chính ngày phát hiện', exact: true }).waitFor();
    const record = await page.evaluate(async () => (await window.qcApi.listNce())[0]);
    assert.equal(record.detected_at, historical);
    assert.equal(record.status, 'open', 'QC đạt không tự cho hoạt động trở lại');
    assert.equal(new Date(record.created_at).getDate(), new Date(`${today}T12:00:00`).getDate());
    await stage(/Cho hoạt động trở lại/);
    const oldOption = release.locator('#relRun option', { hasText: /lần 2 ·/ });
    await oldOption.waitFor({ state: 'attached' });
    await release.locator('#relRun').selectOption(await oldOption.getAttribute('value'));
    await release.locator('.nce-release-result', { hasText: 'Lần chạy đạt' }).waitFor();
    assert.equal(await release.getByRole('button', { name: 'Cho phép hoạt động trở lại', exact: true }).isDisabled(), true, 'checklist và ảnh hưởng chưa đủ');
    await page.evaluate(async ({ testId, date }) => {
      for (const [level, val] of [[1, 5], [2, 15]]) {
        const r = await window.qcApi.addPoint({ data: { testId, level, date, runId: '3-live', val } });
        if (!r.ok) throw new Error(JSON.stringify(r.error));
      }
    }, { testId: seeded.testId, date: historical });
    const live = release.locator('#relRun option', { hasText: '3-live' });
    await live.waitFor({ state: 'attached' });
    await release.locator('#relRun').selectOption(await live.getAttribute('value'));
    await release.locator('.nce-release-result', { hasText: 'Lần chạy đạt' }).waitFor();
    // Huỷ một điểm ở cửa sổ khác: preview đang chọn phải tự đánh giá lại.
    await page.evaluate(async (testId) => {
      const point = (await window.qcApi.queryPoints(testId, 2)).find((p) => p.run_id === '3-live');
      const r = await window.qcApi.voidPoint({ data: { pointId: point.id, reason: 'Huỷ dữ liệu thử nhập sai', kind: 'data-entry' } });
      if (!r.ok) throw new Error(JSON.stringify(r.error));
    }, seeded.testId);
    await release.locator('.alert.rej', { hasText: 'thiếu mức M2' }).waitFor();
    await page.setViewportSize({ width: 1366, height: 768 });
    await release.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(userDataDir, 'nce-retrospective.png'), fullPage: true });
    console.log(`Ảnh kiểm tra: ${path.join(userDataDir, 'nce-retrospective.png')}`);
    await stage(/Phê duyệt & lịch sử/);
    const history = page.getByRole('region', { name: 'Lịch sử hồ sơ' });
    await history.locator('.nce-history-disclosure > summary').click();
    await history.getByText(/Nhập nhầm ngày lập; đối chiếu nhật ký QC thực tế/).waitFor();
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
