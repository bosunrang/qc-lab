// Kiểm tra bước Điều tra & CAPA: các biểu mẫu, hành động và lịch sử hiệu lực
// trên profile Electron riêng, không chạm hồ sơ của người dùng.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage, todayIn } from './helpers.mjs';

test('NCE CAPA: điều tra, hoàn thành hành động và giữ lịch sử đánh giá hiệu lực', { timeout: 180_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const today = await todayIn(page);
    const created = await page.evaluate(async (date) => {
      const api = window.qcApi, user = await api.currentUser();
      const must = (result) => { if (!result.ok) throw new Error(JSON.stringify(result.error)); return result.data; };
      let view = must(await api.createNce({ data: { source: 'other', description: 'Rà soát sai sót lưu hồ sơ trong ca xét nghiệm', correction: 'Đã kiểm soát và đối chiếu hồ sơ liên quan', holdResults: false, detectedAt: date, ownerUserId: user.id } }));
      view = must(await api.recordNcePatientImpact({ data: { id: view.record.id, expectedVersion: view.record.row_version, impact: { outcome: 'not_applicable', description: 'Sai sót hồ sơ hành chính không liên quan kết quả bệnh nhân.', resultCount: null, reference: '', notified: '' } } }));
      return must(await api.releaseNce({ data: { id: view.record.id, expectedVersion: view.record.row_version, release: { notApplicable: true, reason: 'Không phải dừng dịch vụ, đã kiểm soát việc lưu hồ sơ.' } } }));
    }, today);
    await openPage(page, 'Khắc phục sự cố');
    await page.getByRole('region', { name: 'Danh sách hồ sơ NCE' }).locator('tbody tr', { hasText: created.record.nce_id }).getByRole('button', { name: 'Mở hồ sơ' }).click();
    const navigation = page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' });
    const stage = (name) => navigation.getByRole('button', { name }).click();
    await stage(/Điều tra & CAPA/);
    const tier = page.getByRole('region', { name: 'Phân tầng và đánh giá nguy cơ' });
    const cause = page.getByRole('region', { name: 'Điều tra và nguyên nhân' });
    const actions = page.getByRole('region', { name: 'Hành động khắc phục và phòng ngừa' });
    const effectiveness = page.getByRole('region', { name: 'Đánh giá hiệu lực và nguy cơ còn lại' });
    async function expand(group) {
      const toggle = group.locator('.nce-capa-toggle');
      if (await toggle.count() && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    }
    async function checkLayout(mode) {
      for (const width of [1647, 1366, 1000, 800, 480]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const overflow = await page.locator('.nce-stage:not([hidden])').evaluate((root) => [root, ...root.querySelectorAll('.panel, .nce-section-body, .nce-capa-form, .nce-capa-overview, .nce-effectiveness-item')].filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.className));
        assert.deepEqual(overflow, [], `${mode} không tràn ở ${width}px`);
      }
      await page.setViewportSize({ width: 1366, height: 900 });
    }
    await checkLayout('Chưa ghi CAPA');
    assert.equal(await page.locator('.nce-capa-shell').count(), 1, 'phần 6 nằm trong một khung thống nhất');
    assert.equal(await tier.evaluate((element) => getComputedStyle(element).boxShadow), 'none', 'các nhóm không còn đổ bóng như thẻ riêng');
    await tier.getByRole('button', { name: 'Sửa', exact: true }).click();
    await tier.locator('#tierSel').selectOption('capa');
    await tier.locator('#riskS').selectOption('2');
    await tier.locator('#riskP').selectOption('2');
    await tier.locator('#riskL').selectOption('low');
    await tier.locator('#riskB').fill('SOP-HS-01 ma trận nguy cơ nội bộ');
    await checkLayout('Đang phân tầng');
    await stage(/Ghi nhận sự cố/);
    await stage(/Điều tra & CAPA/);
    assert.equal(await tier.locator('#riskB').inputValue(), 'SOP-HS-01 ma trận nguy cơ nội bộ');
    await tier.getByRole('button', { name: 'Lưu', exact: true }).click();
    assert.equal(await tier.locator('.nce-capa-toggle').getAttribute('aria-expanded'), 'false', 'lưu phân tầng thì thu gọn và chuyển sang nguyên nhân');
    assert.equal(await cause.locator('.nce-capa-toggle').getAttribute('aria-expanded'), 'true');
    await expand(tier);
    await tier.locator('.nce-capa-overview').getByText('2 × 2', { exact: true }).waitFor();
    await tier.screenshot({ path: path.join(userDataDir, 'nce-capa-tier.png') });
    await expand(cause);
    await cause.getByRole('button', { name: 'Sửa', exact: true }).click();
    await cause.locator('#causeStatus').selectOption('undetermined');
    await cause.locator('#causePlan').fill('Đối chiếu nhật ký bàn giao và kiểm tra quy trình lưu hồ sơ.');
    await expand(actions);
    await expand(cause);
    assert.equal(await cause.locator('#causePlan').inputValue(), 'Đối chiếu nhật ký bàn giao và kiểm tra quy trình lưu hồ sơ.', 'thu/mở nhóm giữ bản nháp');
    await cause.getByRole('button', { name: 'Lưu', exact: true }).click();
    assert.equal(await actions.locator('.nce-capa-toggle').getAttribute('aria-expanded'), 'true', 'lưu nguyên nhân thì chuyển sang hành động');
    await expand(cause);
    await cause.getByText('Kế hoạch kiểm tra tiếp', { exact: true }).waitFor();
    await cause.getByRole('button', { name: 'Sửa', exact: true }).click();
    await cause.locator('#causeStatus').selectOption('identified');
    await cause.locator('#causeCat').selectOption('operator');
    await cause.locator('#causeText').fill('Thiếu bước kiểm tra chéo khi bàn giao hồ sơ giữa hai ca.');
    await cause.getByRole('button', { name: 'Lưu', exact: true }).click();
    await actions.getByRole('button', { name: 'Thêm hành động', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    const actionDescription = dialog.locator('#actDesc');
    const actionError = actionDescription.locator('..').getByRole('alert');
    await actionError.waitFor();
    assert.match(await actionError.innerText(), /Mô tả hành động ít nhất 10 ký tự/);
    assert.equal(await actionDescription.getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('.nce-dossier-error').count(), 0, 'lỗi hành động không tạo thanh lỗi đầu hồ sơ');
    await dialog.locator('#actDesc').fill('Bổ sung kiểm tra chéo và hướng dẫn lại quy trình bàn giao.');
    await dialog.locator('#actOwner').selectOption(created.record.owner_user_id);
    await dialog.locator('#actDue').fill(today);
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await actions.getByRole('button', { name: 'Hoàn thành', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.locator('#actEvidence').fill('Biên bản HD-HS-01 và bảng kiểm bàn giao đã được ký xác nhận.');
    await dialog.getByRole('button', { name: 'Xác nhận hoàn thành', exact: true }).click();
    assert.equal(await effectiveness.locator('.nce-capa-toggle').getAttribute('aria-expanded'), 'true', 'hoàn thành hành động thì mở hiệu lực');
    await expand(actions);
    await actions.locator('tbody .tag', { hasText: 'Hoàn thành' }).waitFor();
    await expand(effectiveness);
    await effectiveness.getByRole('button', { name: 'Sửa', exact: true }).click();
    await effectiveness.locator('#effCrit').fill('Hồ sơ bàn giao có đủ chữ ký và không còn sai sót qua các ca theo dõi.');
    await effectiveness.locator('#effDue').fill(today);
    await effectiveness.getByRole('button', { name: 'Lưu', exact: true }).click();
    await effectiveness.getByRole('button', { name: 'Ghi đánh giá hiệu lực', exact: true }).click();
    await effectiveness.getByRole('button', { name: 'Ghi đánh giá', exact: true }).click();
    const resultControl = effectiveness.locator('#revResult');
    const resultError = resultControl.locator('..').getByRole('alert');
    await resultError.waitFor();
    assert.match(await resultError.innerText(), /Chọn kết luận hiệu lực/);
    assert.equal(await resultControl.getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('.nce-dossier-error').count(), 0, 'lỗi đánh giá hiệu lực nằm tại ô nhập');
    await effectiveness.locator('#revResult').selectOption('extend');
    await effectiveness.locator('#revEvidence').fill('Đã hướng dẫn lại, cần theo dõi thêm dữ liệu bàn giao ở các ca tiếp theo.');
    await effectiveness.getByRole('button', { name: 'Ghi đánh giá', exact: true }).click();
    await effectiveness.locator('.tag', { hasText: 'Cần theo dõi thêm' }).waitFor();
    await effectiveness.getByRole('button', { name: 'Ghi đánh giá hiệu lực', exact: true }).click();
    await effectiveness.locator('#revResult').selectOption('effective');
    await effectiveness.locator('#revEvidence').fill('Đối chiếu toàn bộ hồ sơ theo dõi, không còn sai sót và đủ chữ ký bàn giao.');
    await effectiveness.locator('#revS').selectOption('1');
    await effectiveness.locator('#revP').selectOption('1');
    await effectiveness.locator('#revL').selectOption('low');
    await effectiveness.locator('#revB').fill('Ma trận SOP-HS-01 sau kiểm tra chéo');
    await checkLayout('Đang đánh giá hiệu lực');
    await effectiveness.screenshot({ path: path.join(userDataDir, 'nce-capa-effectiveness-form.png') });
    await effectiveness.getByRole('button', { name: 'Ghi đánh giá', exact: true }).click();
    assert.equal(await effectiveness.locator('.nce-capa-toggle').getAttribute('aria-expanded'), 'false', 'đánh giá hiệu quả xong thì thu gọn kết quả');
    await page.locator('.nce-capa-shell').screenshot({ path: path.join(userDataDir, 'nce-capa-completed-summary.png') });
    await expand(effectiveness);
    await effectiveness.locator(':scope > .nce-section-body > .nce-effectiveness-list .tag', { hasText: 'Hiệu quả' }).waitFor();
    await effectiveness.getByText('Ma trận SOP-HS-01 sau kiểm tra chéo', { exact: true }).waitFor();
    const history = effectiveness.locator('.nce-effectiveness-history');
    assert.equal(await history.getAttribute('open'), null);
    await history.locator('summary').click();
    await history.getByText('Đã hướng dẫn lại, cần theo dõi thêm dữ liệu bàn giao ở các ca tiếp theo.', { exact: true }).waitFor();
    await checkLayout('Đã ghi CAPA và lịch sử hiệu lực');
    await effectiveness.screenshot({ path: path.join(userDataDir, 'nce-capa-effectiveness.png') });
    await expand(cause);
    await cause.screenshot({ path: path.join(userDataDir, 'nce-capa-cause.png') });
    await expand(actions);
    await actions.screenshot({ path: path.join(userDataDir, 'nce-capa-actions.png') });
    assert.equal(await page.locator('.nce-dossier-error').count(), 0);
    const stored = await page.evaluate((id) => window.qcApi.getNce(id), created.record.id);
    assert.equal(stored.decisions.filter((row) => row.type === 'effectiveness').length, 2);
    assert.equal(stored.actions[0].status, 'done');
    // Đổi sang xử lý nhanh chỉ thu gọn các mục bổ sung, vẫn mở lại được dữ
    // liệu và lịch sử đã ghi; chế độ toàn bộ phục vụ người rà soát.
    await expand(tier);
    await tier.getByRole('button', { name: 'Sửa', exact: true }).click();
    await tier.locator('#tierSel').selectOption('low');
    await tier.locator('#tierReason').fill('Nguy cơ thấp, sự cố đơn lẻ đã được kiểm soát và theo dõi đầy đủ.');
    await tier.getByRole('button', { name: 'Lưu', exact: true }).click();
    assert.equal(await page.locator('.nce-capa-steps').isVisible(), false);
    await page.getByRole('button', { name: 'Thông tin điều tra & hành động đã ghi', exact: true }).click();
    await expand(effectiveness);
    await effectiveness.getByText('Ma trận SOP-HS-01 sau kiểm tra chéo', { exact: true }).waitFor();
    await navigation.getByRole('button', { name: 'Xem toàn bộ hồ sơ', exact: true }).click();
    for (const group of [tier, cause, actions, effectiveness]) {
      assert.equal(await group.locator(':scope > .nce-section-body').isVisible(), true, 'xem toàn bộ mở đầy đủ bằng chứng');
    }
    assert.deepEqual(errors, []);
    console.log(`Ảnh CAPA: ${userDataDir}`);
  } finally { await app.close(); }
});
