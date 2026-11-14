// Vòng đời hồ sơ NCE trên giao diện thật (docs/NCE-REDESIGN-2026-10-12.md,
// giai đoạn 3): lập hồ sơ từ hàng chờ, ghi ảnh hưởng bệnh nhân, cho phép hoạt
// động trở lại bằng lần rerun, phân tầng, checklist, nộp duyệt; người báo cáo
// không duyệt được, một KTV được cấp quyền duyệt thì đóng hồ sơ.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ADMIN, bootstrapAndLogin, enterValue, launchApp, login, openPage, seedOperationalTest, TECH, todayIn, watchErrors } from './helpers.mjs';

const section = (page, title) => page.locator(`section[aria-label="${title}"]`);

test('hồ sơ NCE: lập, cho chạy lại, nộp duyệt, người độc lập duyệt đóng', { timeout: 240_000 }, async () => {
  const { app, page, errors, port, userDataDir } = await launchApp();
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
    await page.locator('.toast-ok', { hasText: 'Mức 1' }).waitFor();
    await enterValue(page, today, 2, 17.1);
    await page.locator('.toast-rej', { hasText: '1-3s' }).waitFor();
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
    const queueRow = page.locator(`tr.nce-queue-item[aria-label^="Sự cố ${seeded.testName} "]`).first();
    await queueRow.getByRole('button', { name: 'Lập hồ sơ' }).click();
    const modal = page.locator('.modal[role=dialog]', { hasText: 'Lập hồ sơ NCE' });
    await modal.getByRole('button', { name: 'Lập hồ sơ' }).click();
    const holdControl = modal.locator('input[name=nceHold]').first();
    const holdError = holdControl.locator('xpath=ancestor::div[contains(@class,"field")]').getByRole('alert');
    await holdError.waitFor();
    assert.match(await holdError.innerText(), /Chọn có dừng\/giữ kết quả/);
    assert.equal(await modal.locator(':scope > .modal-b > .alert.rej').count(), 0, 'lỗi lập hồ sơ nằm tại trường cần sửa');
    await modal.locator('#nceCorrection').fill('Dừng trả kết quả mức 2, chạy lại QC với lọ mới.');
    await modal.getByLabel('Có, đã dừng/giữ').check();
    await modal.getByRole('button', { name: 'Lập hồ sơ' }).click();
    await page.locator('.panel-head h2', { hasText: /Hồ sơ NCE-/ }).waitFor();
    const workflow = page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' });
    const impactStep = workflow.getByRole('button', { name: /Ảnh hưởng bệnh nhân/ });
    await impactStep.locator('.nce-stage-status', { hasText: 'thiếu' }).waitFor();
    await workflow.locator('.nce-workflow-missing summary').click();
    await workflow.getByRole('button', { name: /Chưa có quyết định ảnh hưởng kết quả bệnh nhân/ }).waitFor();

    // Chế độ xem ưu tiên nội dung chính, trạng thái ngắn và mặc định thu gọn
    // bảng bằng chứng QC để hồ sơ có thể quét nhanh.
    await workflow.getByRole('button', { name: /Ghi nhận sự cố/ }).click();
    const identity = section(page, 'Ghi nhận và xử lý tức thời');
    await identity.getByRole('heading', { level: 3, name: /Lần chạy bị loại/ }).waitFor();
    await identity.getByText('Đã dừng / giữ', { exact: true }).waitFor();
    assert.equal(await identity.locator('.nce-identity-status > div').count(), 3, 'giai đoạn, người phụ trách và hạn nằm trong hàng thông tin gọn');
    await identity.getByText('Ngày phát hiện', { exact: true }).waitFor();
    await identity.getByText('Ngày lập hồ sơ', { exact: true }).waitFor();
    assert.equal(await identity.getByRole('region', { name: 'Dòng thời gian hồ sơ' }).count(), 0, 'dòng thời gian tổng thể chuyển sang Phê duyệt & lịch sử');
    const disclosure = identity.locator('.nce-timeline-disclosure');
    assert.equal(await disclosure.getAttribute('open'), null, 'bằng chứng sự cố mặc định thu gọn');
    await identity.screenshot({ path: path.join(userDataDir, 'nce-identity-seamless.png') });
    console.log(`Ảnh hồ sơ liền mạch: ${path.join(userDataDir, 'nce-identity-seamless.png')}`);
    await disclosure.locator(':scope > summary').click();
    // Bảng điểm gây sự cố còn tại bước ghi nhận, không lẫn với QC chạy lại.
    const initialRun = identity.getByRole('region', { name: 'Bằng chứng QC của sự cố' }).locator('li.has-run details.nce-run', { hasText: 'Lần chạy QC bị loại' });
    await initialRun.waitFor();
    assert.equal(await initialRun.getAttribute('open'), null, 'bằng chứng QC mặc định thu gọn');
    assert.match(await initialRun.locator('summary').innerText(), /1 đạt/);
    assert.match(await initialRun.locator('summary').innerText(), /1 bị loại/);
    const chevron = initialRun.locator('.nce-run-chevron svg');
    assert.equal(await chevron.count(), 1, 'dùng một chevron SVG thay dấu tam giác mặc định');
    const closedTransform = await chevron.evaluate((icon) => getComputedStyle(icon).transform);
    await initialRun.locator('summary').click();
    const openTransform = await chevron.evaluate((icon) => getComputedStyle(icon).transform);
    assert.notEqual(openTransform, closedTransform, 'chevron xoay khi mở bằng chứng');
    const snapshotAlignment = await initialRun.locator('.nce-snapshot-table').evaluate((table) => [...table.querySelectorAll('th, td')].map((cell) => {
      const style = getComputedStyle(cell);
      return { textAlign: style.textAlign, verticalAlign: style.verticalAlign };
    }));
    assert.ok(snapshotAlignment.every((cell) => cell.textAlign === 'center' && cell.verticalAlign === 'middle'), `tiêu đề và nội dung snapshot QC căn giữa: ${JSON.stringify(snapshotAlignment)}`);
    await initialRun.locator('summary').click();
    await identity.screenshot({ path: path.join(userDataDir, 'nce-identity-compact.png') });
    console.log(`Ảnh ghi nhận sự cố tinh gọn: ${path.join(userDataDir, 'nce-identity-compact.png')}`);
    // Mốc thời gian do phần mềm tự dựng; phạm vi kiểm soát điền sẵn phần đã
    // biết, người làm chỉ bổ sung chỗ [cần ghi]. Ô ghi thêm diễn biến để trống.
    await identity.getByRole('region', { name: 'Bằng chứng QC của sự cố' }).getByText('Lần chạy QC bị loại', { exact: true }).waitFor();
    await identity.getByRole('button', { name: 'Bổ sung phạm vi kiểm soát và thông báo' }).click();
    const containment = identity.locator('#idContainment');
    await containment.waitFor();
    assert.equal(await containment.evaluate((element) => element === document.activeElement), true, 'nút bổ sung đưa con trỏ tới đúng mục thiếu');
    // Lỗi nhập liệu của bước ghi nhận phải nằm ngay dưới ô sai, không tạo
    // thanh đỏ ở đầu hồ sơ như trước.
    const description = identity.locator('#idDesc');
    const savedDescription = await description.inputValue();
    await description.fill('');
    await identity.getByRole('button', { name: 'Lưu' }).click();
    const descriptionError = description.locator('..').getByRole('alert');
    await descriptionError.waitFor();
    assert.match(await descriptionError.innerText(), /Mô tả sự kiện ít nhất 10 ký tự/);
    assert.equal(await description.getAttribute('aria-invalid'), 'true');
    assert.equal(await description.getAttribute('aria-describedby'), await descriptionError.getAttribute('id'));
    assert.equal(await page.locator('.nce-dossier-error').count(), 0, 'không đẩy lỗi ô nhập lên thanh đầu hồ sơ');
    assert.equal(await description.evaluate((element) => element === document.activeElement), true, 'focus về ô mô tả cần sửa');
    await identity.screenshot({ path: 'dist/nce-inline-field-error-preview.png' });
    await description.fill(savedDescription);
    await descriptionError.waitFor({ state: 'detached' });
    await identity.getByRole('button', { name: 'Điền sẵn từ dữ liệu' }).click();
    assert.match(await containment.inputValue(), /^Xét nghiệm .+lô QC: M1 .+\nKhoảng nghi ngờ: /);
    await identity.locator('.nce-field-assist.is-warning', { hasText: '[cần ghi]' }).waitFor();
    await containment.fill((await containment.inputValue()).replace('[cần ghi]', '08:15 hôm nay').replace('[cần ghi]', 'phụ trách ca lúc 08:15'));
    assert.equal(await identity.locator('.nce-field-assist.is-warning').count(), 0);
    await identity.getByRole('button', { name: 'Lưu' }).click();
    await identity.getByRole('button', { name: 'Sửa' }).waitFor();
    assert.equal(await identity.getByRole('button', { name: 'Bổ sung phạm vi kiểm soát và thông báo' }).count(), 0, 'đã lưu đủ phạm vi thì không còn nút nhắc bổ sung');

    // Checklist là cổng trước release, không chờ tới nộp duyệt mới kiểm.
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Kiểm tra nhanh/ }).click();
    const investigation = section(page, 'Kiểm tra nhanh các yếu tố thường gặp');
    await investigation.getByRole('button', { name: 'Sửa' }).click();
    // Danh sách gọn: mỗi mục là nhóm ba nút; mục có lời nhắc từ dữ liệu không
    // được đánh dấu hàng loạt nên chọn "Đạt" riêng cho mục còn trống.
    const checks = investigation.locator('[role=group][aria-label^="Kết quả:"]');
    assert.ok(await checks.count() > 0, 'có mục kiểm tra nhanh');
    const allOk = investigation.getByRole('button', { name: /là Đạt$/ });
    if (await allOk.count()) await allOk.click();
    for (let i = 0; i < await checks.count(); i++) {
      if (!(await checks.nth(i).locator('[aria-pressed="true"]').count())) await checks.nth(i).getByRole('button', { name: 'Đạt', exact: true }).click();
    }
    await investigation.getByRole('button', { name: 'Lưu' }).click();
    await investigation.getByRole('button', { name: 'Sửa' }).waitFor();

    // 2. Xác minh kỹ thuật sau xử lý; tín hiệu này không tự thay quyết định
    // ảnh hưởng bệnh nhân ở bước kế tiếp.
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Xác minh kỹ thuật/ }).click();
    const technical = section(page, 'Xác minh kỹ thuật IQC');
    await technical.screenshot({ path: path.join(userDataDir, 'nce-technical-empty.png') });
    await technical.getByRole('button', { name: 'Ghi đánh giá' }).click();
    // Mở form là số liệu định lượng đã điền sẵn từ dữ liệu QC (đơn vị %, TEa,
    // Bias, SD…); ca này là sai số ngẫu nhiên nên chuyển sang không áp dụng.
    await technical.locator('.nce-technical-prefill').waitFor();
    assert.equal(await technical.locator('#techUnit').inputValue(), '%');
    assert.notEqual(await technical.locator('#techSd').inputValue(), '', 'SD đã điền sẵn');
    await technical.screenshot({ path: path.join(userDataDir, 'nce-technical-form.png') });
    await technical.locator('#techNature').selectOption('random');
    await technical.locator('#techMode').selectOption('not_applicable');
    await technical.locator('#techMethod').fill('Đối chiếu vật liệu, máy và nhật ký thao tác của ca chạy.');
    async function expectTechnicalFieldError(id, message) {
      await technical.getByRole('button', { name: 'Ghi đánh giá kỹ thuật', exact: true }).click();
      const control = technical.locator(`#${id}`);
      const inline = control.locator('..').getByRole('alert');
      await inline.waitFor();
      assert.match(await inline.innerText(), message);
      await page.waitForFunction((fieldId) => document.activeElement?.id === fieldId, id);
      assert.equal(await control.getAttribute('aria-invalid'), 'true');
      assert.equal(await control.getAttribute('aria-describedby'), await inline.getAttribute('id'));
      assert.equal(await page.locator('.nce-dossier-error').count(), 0, 'không đẩy lỗi nhập liệu lên đầu hồ sơ');
      const box = await control.boundingBox(), header = await page.locator('.head').boundingBox();
      assert.ok(box.y > header.y + header.height, 'ô lỗi nằm dưới header đang ghim');
    }
    await expectTechnicalFieldError('techEvidence', /Ghi xử lý kỹ thuật và bằng chứng/);
    await technical.locator('#techMethod').focus();
    await expectTechnicalFieldError('techEvidence', /Ghi xử lý kỹ thuật và bằng chứng/);
    await technical.locator('#techEvidence').fill('Đã thay lọ QC, vệ sinh kim hút và chạy lại đủ hai mức.');
    assert.equal(await technical.locator('#techEvidence').getAttribute('aria-invalid'), null);
    await expectTechnicalFieldError('techConclusion', /Ghi kết luận kỹ thuật/);
    await technical.locator('#techConclusion').fill('QC sau xử lý ổn định, chưa ghi nhận lệch hệ thống.');
    await technical.locator('#techMode').selectOption('calculated');
    await technical.locator('#techTea').fill('0');
    await expectTechnicalFieldError('techTea', /TEa phải là số lớn hơn 0/);
    await technical.locator('#techTea').fill('10');
    await technical.locator('#techTeaSource').fill('');
    await expectTechnicalFieldError('techTeaSource', /Ghi nguồn TEa/);
    await technical.locator('#techTeaSource').fill('Tiêu chí TEa kiểm thử');
    await technical.locator('#techStableBias').fill('');
    await expectTechnicalFieldError('techStableBias', /Nhập Bias ổn định/);
    await technical.locator('#techStableBias').fill('1');
    await technical.locator('#techIncidentBias').fill('');
    await expectTechnicalFieldError('techIncidentBias', /Nhập Bias ổn định/);
    await technical.locator('#techMode').selectOption('not_applicable');
    await expectTechnicalFieldError('techMetricReason', /Ghi lý do không áp dụng/);
    await technical.locator('#techMetricReason').fill('Sai số ngẫu nhiên, không đủ nhóm dữ liệu độc lập để ước lượng Bias tin cậy.');
    // Điều hướng chỉ ẩn phần đang sửa, không làm mất bản nháp kỹ thuật.
    await workflow.getByRole('button', { name: /Kiểm tra nhanh/ }).click();
    await workflow.getByRole('button', { name: /Xác minh kỹ thuật/ }).click();
    assert.equal(await technical.locator('#techConclusion').inputValue(), 'QC sau xử lý ổn định, chưa ghi nhận lệch hệ thống.');
    await technical.getByRole('button', { name: 'Ghi đánh giá kỹ thuật' }).click();
    await technical.locator('.nce-technical-record', { hasText: 'Sai số ngẫu nhiên' }).waitFor();
    await technical.screenshot({ path: path.join(userDataDir, 'nce-technical-assessment.png') });
    console.log(`Ảnh xác minh kỹ thuật: ${path.join(userDataDir, 'nce-technical-assessment.png')}`);

    // 3. Ảnh hưởng kết quả bệnh nhân.
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Ảnh hưởng bệnh nhân/ }).click();
    const impact = section(page, 'Ảnh hưởng kết quả bệnh nhân');
    async function assertImpactLayout(mode) {
      for (const width of [1647, 1366, 1000, 800, 480]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const overflow = await impact.locator('.nce-impact-layout').evaluate((root) => [root, ...root.querySelectorAll('*')].filter((element) => element.scrollWidth > element.clientWidth + 1 && element.clientWidth > 0 && !['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)).map((element) => ({ tag: element.tagName, className: element.className, width: element.clientWidth, content: element.scrollWidth })));
        assert.deepEqual(overflow, [], `${mode} không tràn ngang tại ${width}px`);
      }
      await page.setViewportSize({ width: 1366, height: 900 });
    }
    await assertImpactLayout('Chưa có quyết định');
    await impact.screenshot({ path: path.join(userDataDir, 'nce-impact-empty.png') });
    await impact.getByRole('button', { name: 'Ghi quyết định' }).click();
    async function expectImpactFieldError(id, message) {
      await impact.getByRole('button', { name: 'Ghi quyết định', exact: true }).click();
      const control = impact.locator(`#${id}`);
      const inline = control.locator('..').getByRole('alert');
      await inline.waitFor();
      assert.match(await inline.innerText(), message);
      await page.waitForFunction((fieldId) => document.activeElement?.id === fieldId, id);
      assert.equal(await control.getAttribute('aria-invalid'), 'true');
      assert.equal(await page.locator('.nce-dossier-error').count(), 0, 'lỗi quyết định nằm ở ô nhập');
    }
    await expectImpactFieldError('impOutcome', /Chọn kết luận/);
    await impact.locator('#impOutcome').selectOption('reported_corrected');
    await expectImpactFieldError('impDesc', /Ghi căn cứ/);
    await impact.locator('#impDesc').fill('Đã rà soát và đối chiếu các báo cáo trong khoảng nghi ngờ.');
    await impact.locator('#impCount').fill('0');
    await expectImpactFieldError('impCount', /lớn hơn 0/);
    await impact.locator('#impCount').fill('1');
    await expectImpactFieldError('impRef', /mã phiếu/);
    await impact.locator('#impRef').fill('BC-KIEM-THU-01');
    await expectImpactFieldError('impNotified', /thông báo/);
    await assertImpactLayout('Đang ghi quyết định sửa báo cáo');
    await impact.screenshot({ path: path.join(userDataDir, 'nce-impact-form.png') });
    await impact.locator('#impRef').fill('');
    await impact.locator('#impOutcome').selectOption('not_reported');
    await impact.locator('#impDesc').fill('Đã giữ toàn bộ kết quả trong khoảng nghi ngờ.');
    await impact.locator('#impCount').fill('0');
    await workflow.getByRole('button', { name: /Xác minh kỹ thuật/ }).click();
    await workflow.getByRole('button', { name: /Ảnh hưởng bệnh nhân/ }).click();
    assert.equal(await impact.locator('#impDesc').inputValue(), 'Đã giữ toàn bộ kết quả trong khoảng nghi ngờ.');
    await impact.getByRole('button', { name: 'Ghi quyết định' }).click();
    await impact.locator('.nce-impact-decision', { hasText: 'Chưa trả kết quả nào' }).waitFor();
    await impact.getByRole('button', { name: 'Ghi quyết định mới', exact: true }).click();
    await impact.locator('#impOutcome').selectOption('not_reported');
    await impact.locator('#impDesc').fill('Đã rà soát bổ sung, toàn bộ kết quả vẫn được giữ trong phạm vi.');
    await impact.locator('#impCount').fill('0');
    await impact.getByRole('button', { name: 'Ghi quyết định', exact: true }).click();
    const history = impact.locator('.nce-impact-history');
    await history.waitFor();
    assert.equal(await history.getAttribute('open'), null);
    await history.locator('summary').click();
    await assertImpactLayout('Đã ghi quyết định');
    await history.getByText('Đã giữ toàn bộ kết quả trong khoảng nghi ngờ.', { exact: true }).waitFor();
    await history.locator('summary').click();
    await impact.screenshot({ path: path.join(userDataDir, 'nce-impact-decision.png') });
    console.log(`Ảnh ảnh hưởng bệnh nhân: ${path.join(userDataDir, 'nce-impact-empty.png')}, ${path.join(userDataDir, 'nce-impact-form.png')}, ${path.join(userDataDir, 'nce-impact-decision.png')}`);

    // 4. Cho phép hoạt động trở lại bằng lần rerun, xem trước kết quả đánh giá.
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Cho hoạt động trở lại/ }).click();
    const release = section(page, 'Cho phép hoạt động trở lại');
    async function assertReleaseLayout(mode) {
      for (const width of [1647, 1366, 1000, 800, 480]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const overflow = await release.evaluate((root) => [...root.querySelectorAll('.nce-release-flow, .nce-release-selector, .nce-release-verification, .nce-release-decision, .nce-release-record')].filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.className));
        assert.deepEqual(overflow, [], `${mode} không tràn ngang tại ${width}px`);
      }
      await page.setViewportSize({ width: 1366, height: 900 });
    }
    const option = release.locator('#relRun option', { hasText: 'chay-lai' });
    await option.waitFor({ state: 'attached' });
    await assertReleaseLayout('Chưa chọn QC xác minh');
    assert.equal(await release.locator('.nce-release-verification').count(), 0, 'chưa chọn QC thì không dựng thêm khung kết quả trống');
    await release.screenshot({ path: path.join(userDataDir, 'nce-release-empty.png') });
    await release.locator('#relRun').selectOption(await option.getAttribute('value'));
    await release.getByRole('status').filter({ hasText: 'Lần chạy đạt khi đánh giá trong giai đoạn mới' }).waitFor();
    assert.equal(await release.locator('.nce-rerun-excluded').count(), 0, 'đã có lần QC chọn được thì không liệt kê các lần bị lọc');
    await release.locator('#relReason').fill('QC chạy lại đạt cả hai mức sau khi thay lọ.');
    await workflow.getByRole('button', { name: /Ảnh hưởng bệnh nhân/ }).click();
    await workflow.getByRole('button', { name: /Cho hoạt động trở lại/ }).click();
    assert.equal(await release.locator('#relReason').inputValue(), 'QC chạy lại đạt cả hai mức sau khi thay lọ.');
    assert.equal(await release.locator('.nce-snapshot-table tbody tr').count(), 2, 'hiện đủ hai mức của QC xác minh');
    await assertReleaseLayout('QC xác minh đạt');
    await release.screenshot({ path: path.join(userDataDir, 'nce-release-preview.png') });
    await release.getByRole('button', { name: 'Cho phép hoạt động trở lại' }).click();
    await page.locator('.modal[role=dialog]', { hasText: 'luật Westgard nhiều lần chạy và CUSUM bắt đầu chuỗi mới' }).getByRole('button', { name: 'Cho phép' }).click();
    await page.locator('.tag', { hasText: 'Đã cho chạy lại' }).first().waitFor();
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Cho hoạt động trở lại/ }).click();
    assert.match(await release.innerText(), new RegExp(`lần ${rerunId}`));
    await assertReleaseLayout('Đã cho phép hoạt động trở lại');
    await release.screenshot({ path: path.join(userDataDir, 'nce-release-record.png') });
    console.log(`Ảnh cho phép hoạt động trở lại: ${path.join(userDataDir, 'nce-release-empty.png')}, ${path.join(userDataDir, 'nce-release-preview.png')}, ${path.join(userDataDir, 'nce-release-record.png')}`);
    await workflow.getByRole('button', { name: /Ghi nhận sự cố/ }).click();
    assert.equal(await identity.getByText('Chạy lại QC', { exact: true }).count(), 0, 'bước ghi nhận không chứa QC xác minh');
    assert.equal(await identity.getByText('Cho phép hoạt động trở lại', { exact: true }).count(), 0, 'bước ghi nhận không chứa quyết định về sau');
    await workflow.getByRole('button', { name: /Phê duyệt & lịch sử/ }).click();
    const reviewWorkspace = section(page, 'Phê duyệt & lịch sử');
    assert.equal(await reviewWorkspace.locator('.panel').count(), 0, 'duyệt và lịch sử trong một khung, không lồng thêm panel');
    await reviewWorkspace.getByRole('heading', { name: 'Chưa đủ điều kiện nộp duyệt', exact: true }).waitFor();
    assert.equal(await reviewWorkspace.getByRole('button', { name: 'Nộp duyệt', exact: true }).isDisabled(), true);
    const dossierTimeline = section(page, 'Lịch sử hồ sơ').getByRole('region', { name: 'Dòng thời gian hồ sơ' });
    for (const label of ['Lập hồ sơ', 'Phát hiện sự cố', 'Ghi xác minh kỹ thuật', 'Ghi quyết định ảnh hưởng bệnh nhân', 'Cho phép hoạt động trở lại']) {
      await dossierTimeline.getByText(label, { exact: true }).first().waitFor();
    }
    const rerunEvidence = dossierTimeline.locator('.nce-run', { hasText: 'Chạy lại QC' });
    await rerunEvidence.locator('summary').click();
    assert.equal(await rerunEvidence.locator('tbody tr').count(), 2, 'mở được snapshot QC xác minh từ dòng thời gian');
    await section(page, 'Lịch sử hồ sơ').screenshot({ path: path.join(userDataDir, 'nce-dossier-timeline.png') });
    console.log(`Ảnh dòng thời gian tổng thể: ${path.join(userDataDir, 'nce-dossier-timeline.png')}`);
    await reviewWorkspace.screenshot({ path: path.join(userDataDir, 'nce-review-incomplete.png') });
    for (const width of [1000, 600]) {
      await page.setViewportSize({ width, height: 900 });
      // Thu sidebar có transition khi đổi viewport. Chờ xong mới đo để
      // không nhầm phần tràn tạm thời giữa chuyển động thành lỗi bố cục.
      await page.locator('.app-shell').evaluate(async (element) => {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {})));
        await new Promise((resolve) => requestAnimationFrame(resolve));
      });
      const overflow = await reviewWorkspace.evaluate((element) => element.scrollWidth - element.clientWidth);
      assert.ok(overflow <= 1, `bước phê duyệt không tràn khung ở ${width}px: ${overflow}`);
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    // Điều kiện ngay dưới trạng thái dẫn tới phần cần bổ sung.
    await reviewWorkspace.locator('.nce-review-missing > summary').click();
    await reviewWorkspace.locator('.nce-review-missing button').first().click();
    assert.equal(await workflow.getByRole('button', { name: /Điều tra & CAPA/ }).getAttribute('aria-pressed'), 'true');

    // 5–6. Phân tầng, nguy cơ và CAPA.
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Điều tra & CAPA/ }).click();
    const tier = section(page, 'Phân tầng và đánh giá nguy cơ');
    await tier.getByRole('button', { name: 'Sửa' }).click();
    await tier.locator('#tierSel').selectOption('low');
    await tier.locator('#tierReason').fill('Lỗi đơn lẻ do lọ QC, đã khôi phục ngay.');
    await tier.locator('#riskS').selectOption('1');
    await tier.locator('#riskP').selectOption('1');
    await tier.locator('#riskL').selectOption('low');
    await tier.locator('#riskB').fill('SOP-QC-07 bảng 3');
    await tier.getByRole('button', { name: 'Lưu' }).click();
    await tier.locator('.nce-capa-overview').getByText('1 × 1', { exact: true }).waitFor();
    assert.equal(await page.locator('.nce-capa-steps').isVisible(), false, 'xử lý nhanh không bày các biểu mẫu CAPA');
    await page.locator('.nce-capa-shell').screenshot({ path: path.join(userDataDir, 'nce-low-tier-compact.png') });
    await workflow.getByRole('button', { name: /Phê duyệt & lịch sử/ }).locator('.nce-stage-status', { hasText: 'Sẵn sàng' }).waitFor();

    // 7. Nộp duyệt; người báo cáo không được duyệt.
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Phê duyệt & lịch sử/ }).click();
    await reviewWorkspace.getByRole('heading', { name: 'Sẵn sàng nộp duyệt', exact: true }).waitFor();
    assert.equal(await reviewWorkspace.locator('.nce-review-missing').count(), 0);
    await reviewWorkspace.getByRole('button', { name: 'Xem toàn bộ bằng chứng', exact: true }).click();
    assert.equal(await identity.isVisible(), true);
    await workflow.getByRole('button', { name: 'Quay về từng bước', exact: true }).click();
    await reviewWorkspace.screenshot({ path: path.join(userDataDir, 'nce-review-ready.png') });
    await page.getByRole('button', { name: 'Nộp duyệt' }).click();
    await page.locator('.tag', { hasText: 'Chờ duyệt' }).first().waitFor();
    await section(page, 'Nộp duyệt và phê duyệt').locator('.alert.info', { hasText: 'người báo cáo' }).waitFor();
    await reviewWorkspace.getByRole('heading', { name: 'Đang chờ phê duyệt', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Duyệt đóng hồ sơ' }).count(), 0);

    // KTV có quyền duyệt và không tham gia hồ sơ có thể trả lại rồi duyệt
    // lần nộp tiếp theo, ngay trong cùng một trang hồ sơ đang được gắn.
    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await login(page, TECH);
    await openPage(page, 'Khắc phục sự cố');
    await page.getByRole('group', { name: 'Lọc hồ sơ' }).getByRole('button', { name: /Chờ duyệt/ }).click();
    // Dòng hàng chờ của lần chạy cũng có nút "Mở hồ sơ"; chọn đúng dòng trong bảng hồ sơ.
    await page.locator('table.nce-table tbody tr', { hasText: 'Chờ duyệt' }).getByRole('button', { name: 'Mở hồ sơ' }).click();
    const current = await page.evaluate(async (testId) => {
      const record = (await window.qcApi.listNce()).find((item) => item.test_id === testId);
      if (!record) throw new Error('Không tìm thấy hồ sơ đang duyệt.');
      return record;
    }, seeded.testId);

    // Cửa sổ LAN có phiên ADMIN riêng để chủ hồ sơ nộp lại mà không đăng
    // xuất hay chuyển trang của KTV, tránh vô tình đặt lại noteVersion.
    const ca = readFileSync(path.join(userDataDir, 'lan-tls', 'ca-cert.pem'), 'utf8');
    const [ownerStation] = await Promise.all([
      app.waitForEvent('window'),
      app.evaluate(({ BrowserWindow, session }, { port, ca }) => {
        const { X509Certificate } = process.getBuiltinModule('node:crypto');
        const authority = new X509Certificate(ca), ownerSession = session.fromPartition('nce-review-owner');
        ownerSession.setCertificateVerifyProc((req, callback) => {
          if (req.verificationResult === 'net::OK') return callback(0);
          const leaf = new X509Certificate(req.certificate.data);
          callback(req.verificationResult === 'net::ERR_CERT_AUTHORITY_INVALID' && leaf.checkIssued(authority) && leaf.verify(authority.publicKey) ? 0 : -2);
        });
        const win = new BrowserWindow({ width: 1366, height: 900, webPreferences: { sandbox: true, contextIsolation: true, session: ownerSession } });
        void win.loadURL(`https://127.0.0.1:${port}/`);
      }, { port, ca }),
    ]);
    ownerStation.setDefaultTimeout(20_000);
    await login(ownerStation, ADMIN);
    const ownerErrors = watchErrors(ownerStation);
    const review = section(page, 'Nộp duyệt và phê duyệt');
    const returnNote = 'Đề nghị chủ hồ sơ rà soát lại bằng chứng trước khi nộp.';
    await review.locator('#revNote').fill(returnNote);
    await section(page, 'Phê duyệt & lịch sử').screenshot({ path: path.join(userDataDir, 'nce-review-pending.png') });
    await review.getByRole('button', { name: 'Trả lại', exact: true }).click();
    await page.locator('.nce-dossier-summary .tag', { hasText: 'Đã cho chạy lại' }).waitFor();
    await review.locator('.nce-review-return', { hasText: returnNote }).waitFor();
    const resubmitted = await ownerStation.evaluate(async (id) => {
      const dossier = await window.qcApi.getNce(id);
      if (dossier?.record.status !== 'released') throw new Error('Hồ sơ chưa được trả lại chủ hồ sơ.');
      const result = await window.qcApi.submitNce({ data: { id, expectedVersion: dossier.record.row_version } });
      if (!result.ok) throw new Error(JSON.stringify(result.error));
      return result.data;
    }, current.id);
    assert.equal(resubmitted.record.status, 'pending_approval');
    await review.locator('#revNote').waitFor();
    assert.equal(await review.locator('#revNote').inputValue(), '', 'ghi chú trả lại đã lưu không được trở thành bản nháp của lần duyệt mới');
    const approveNote = 'Đã đối chiếu lần nộp lại và chấp thuận đóng hồ sơ.';
    await review.locator('#revNote').fill(approveNote);
    await review.getByRole('button', { name: 'Duyệt đóng hồ sơ' }).click();
    await page.locator('.tag', { hasText: 'Đã đóng' }).first().waitFor();
    assert.equal(await page.locator('.nce-dossier-error').count(), 0, 'ghi chú lần duyệt mới phải dùng phiên bản mới, không bị stale từ lần trả lại');
    assert.equal(await page.locator('.nce-step.is-done').count(), 7);
    await section(page, 'Lịch sử hồ sơ').getByRole('region', { name: 'Dòng thời gian hồ sơ' }).getByText('Duyệt đóng hồ sơ', { exact: true }).waitFor();
    await section(page, 'Phê duyệt & lịch sử').getByRole('heading', { name: 'Đã duyệt đóng hồ sơ', exact: true }).waitFor();
    await section(page, 'Phê duyệt & lịch sử').locator('.nce-review-saved-note', { hasText: approveNote }).waitFor();
    await section(page, 'Phê duyệt & lịch sử').screenshot({ path: path.join(userDataDir, 'nce-review-closed.png') });
    const closed = await ownerStation.evaluate((id) => window.qcApi.getNce(id), current.id);
    assert.equal(closed.record.status, 'closed');
    assert.equal(JSON.parse(closed.decisions.find((item) => item.type === 'return').payload_json).note, returnNote);
    assert.equal(JSON.parse(closed.decisions.find((item) => item.type === 'approve').payload_json).note, approveNote);
    assert.deepEqual(ownerErrors, []);
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
