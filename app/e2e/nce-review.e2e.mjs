// Bước phê duyệt mới giữ quyền huỷ, xác nhận và bản nháp khi đổi bước.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage, todayIn } from './helpers.mjs';

test('NCE phê duyệt: điều kiện dẫn về đúng bước, huỷ có xác nhận và giữ lịch sử', { timeout: 90_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    await page.evaluate(async (date) => {
      const user = await window.qcApi.currentUser();
      const result = await window.qcApi.createNce({ data: { source: 'other', description: 'Hồ sơ lập nhầm cần huỷ có dấu vết', correction: 'Đã kiểm soát sự cố ban đầu', holdResults: false, detectedAt: date, ownerUserId: user.id } });
      if (!result.ok) throw new Error(JSON.stringify(result.error));
    }, await todayIn(page));
    await openPage(page, 'Khắc phục sự cố');
    await page.getByRole('region', { name: 'Danh sách hồ sơ NCE' }).getByRole('button', { name: 'Mở hồ sơ', exact: true }).click();
    const navigation = page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' });
    const openReview = () => navigation.getByRole('button', { name: /Phê duyệt & lịch sử/ }).click();
    await openReview();
    const review = page.getByRole('region', { name: 'Phê duyệt & lịch sử', exact: true });
    await review.getByRole('heading', { name: 'Hoàn tất xử lý trước khi nộp duyệt', exact: true }).waitFor();
    assert.equal(await review.getByRole('button', { name: 'Nộp duyệt', exact: true }).count(), 0);
    assert.equal(await review.locator('.panel').count(), 0);
    await review.locator('.nce-review-missing > summary').click();
    await review.locator('.nce-review-missing button').first().click();
    assert.equal(await navigation.getByRole('button', { name: /Phê duyệt & lịch sử/ }).getAttribute('aria-pressed'), 'false');
    await openReview();
    const cancelGroup = review.locator('.nce-review-cancel');
    assert.equal(await cancelGroup.getAttribute('open'), null, 'huỷ hồ sơ thu gọn để không lẫn với duyệt');
    await cancelGroup.locator('summary').click();
    const reason = 'Lập trùng hồ sơ, đã đối chiếu hồ sơ gốc của sự cố';
    await cancelGroup.locator('#cancelReason').fill(reason);
    await navigation.getByRole('button', { name: /Ghi nhận sự cố/ }).click();
    await openReview();
    assert.equal(await cancelGroup.locator('#cancelReason').inputValue(), reason);
    await review.screenshot({ path: path.join(userDataDir, 'nce-review-open.png') });
    await cancelGroup.getByRole('button', { name: 'Huỷ hồ sơ', exact: true }).click();
    const confirmation = page.getByRole('dialog');
    await confirmation.getByRole('button', { name: 'Quay lại', exact: true }).click();
    assert.equal(await cancelGroup.locator('#cancelReason').inputValue(), reason);
    await cancelGroup.getByRole('button', { name: 'Huỷ hồ sơ', exact: true }).click();
    await confirmation.getByRole('button', { name: 'Huỷ hồ sơ', exact: true }).click();
    await review.getByRole('heading', { name: 'Hồ sơ đã huỷ', exact: true }).waitFor();
    await review.locator('.nce-review-saved-note', { hasText: reason }).waitFor();
    assert.equal(await review.locator('.nce-review-cancel').count(), 0);
    await review.getByRole('region', { name: 'Dòng thời gian hồ sơ' }).getByText('Huỷ hồ sơ', { exact: true }).waitFor();
    await review.screenshot({ path: path.join(userDataDir, 'nce-review-cancelled.png') });
    console.log(`Ảnh bước phê duyệt: ${userDataDir}`);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
