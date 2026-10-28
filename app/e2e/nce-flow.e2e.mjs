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
    const queueRow = page.locator('article.nce-queue-item', { hasText: seeded.testName }).first();
    await queueRow.getByRole('button', { name: 'Lập hồ sơ' }).click();
    const modal = page.locator('.modal[role=dialog]', { hasText: 'Lập hồ sơ NCE' });
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
    assert.equal(await identity.locator('.nce-identity-card').count(), 2);
    assert.equal(await identity.locator('.nce-identity-status > div').count(), 4);
    const initialRun = identity.locator('details.nce-run').first();
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
    await identity.getByRole('button', { name: 'Sửa' }).click();
    await identity.locator('#idContainment').fill('Đã giữ kết quả của xét nghiệm và thông báo phụ trách ca lúc 08:15.');
    await identity.locator('#idOccurred').fill('08:00 phát hiện, 08:15 dừng trả kết quả, 09:00 hoàn tất xử lý.');
    await identity.getByRole('button', { name: 'Lưu' }).click();
    await identity.getByRole('button', { name: 'Sửa' }).waitFor();

    // Checklist là cổng trước release, không chờ tới nộp duyệt mới kiểm.
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Kiểm tra nhanh/ }).click();
    const investigation = section(page, 'Kiểm tra nhanh các yếu tố thường gặp');
    await investigation.getByRole('button', { name: 'Sửa' }).click();
    const checks = investigation.locator('select[aria-label^="Kết quả"]');
    for (let i = 0; i < await checks.count(); i++) await checks.nth(i).selectOption('ok');
    await investigation.getByRole('button', { name: 'Lưu' }).click();
    await investigation.getByRole('button', { name: 'Sửa' }).waitFor();

    // 2. Xác minh kỹ thuật sau xử lý; tín hiệu này không tự thay quyết định
    // ảnh hưởng bệnh nhân ở bước kế tiếp.
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Xác minh kỹ thuật/ }).click();
    const technical = section(page, 'Xác minh kỹ thuật IQC');
    await technical.getByRole('button', { name: 'Ghi đánh giá' }).click();
    await technical.locator('#techNature').selectOption('random');
    await technical.locator('#techMethod').fill('Đối chiếu vật liệu, máy và nhật ký thao tác của ca chạy.');
    await technical.locator('#techEvidence').fill('Đã thay lọ QC, vệ sinh kim hút và chạy lại đủ hai mức.');
    await technical.locator('#techMetricReason').fill('Sai số ngẫu nhiên, không đủ nhóm dữ liệu độc lập để ước lượng Bias tin cậy.');
    await technical.locator('#techConclusion').fill('QC sau xử lý ổn định, chưa ghi nhận lệch hệ thống.');
    await technical.getByRole('button', { name: 'Ghi đánh giá kỹ thuật' }).click();
    await technical.locator('.nce-technical-record', { hasText: 'Sai số ngẫu nhiên' }).waitFor();
    await technical.screenshot({ path: path.join(userDataDir, 'nce-technical-assessment.png') });
    console.log(`Ảnh xác minh kỹ thuật: ${path.join(userDataDir, 'nce-technical-assessment.png')}`);

    // 3. Ảnh hưởng kết quả bệnh nhân.
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Ảnh hưởng bệnh nhân/ }).click();
    const impact = section(page, 'Ảnh hưởng kết quả bệnh nhân');
    await impact.getByRole('button', { name: 'Ghi quyết định' }).click();
    await impact.locator('#impOutcome').selectOption('not_reported');
    await impact.locator('#impDesc').fill('Đã giữ toàn bộ kết quả trong khoảng nghi ngờ.');
    await impact.locator('#impCount').fill('0');
    await impact.getByRole('button', { name: 'Ghi quyết định' }).click();
    await impact.locator('.nce-impact-decision', { hasText: 'Chưa trả kết quả nào' }).waitFor();

    // 4. Cho phép hoạt động trở lại bằng lần rerun, xem trước kết quả đánh giá.
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Cho hoạt động trở lại/ }).click();
    const release = section(page, 'Cho phép hoạt động trở lại');
    const option = release.locator('#relRun option', { hasText: 'chay-lai' });
    await option.waitFor({ state: 'attached' });
    await release.locator('#relRun').selectOption(await option.getAttribute('value'));
    await release.locator('.alert.ok', { hasText: 'Lần chạy đạt khi đánh giá trong giai đoạn mới' }).waitFor();
    await release.locator('#relReason').fill('QC chạy lại đạt cả hai mức sau khi thay lọ.');
    await release.getByRole('button', { name: 'Cho phép hoạt động trở lại' }).click();
    await page.locator('.modal[role=dialog]', { hasText: 'luật Westgard nhiều lần chạy và CUSUM bắt đầu chuỗi mới' }).getByRole('button', { name: 'Cho phép' }).click();
    await page.locator('.tag', { hasText: 'Đã cho chạy lại' }).first().waitFor();
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Cho hoạt động trở lại/ }).click();
    assert.match(await release.innerText(), new RegExp(`lần ${rerunId}`));

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
    await tier.locator('.nce-capa-summary-card', { hasText: 'Nguy cơ ban đầu' }).getByText('Mức độ 1 × khả năng 1 = 1', { exact: true }).waitFor();
    await workflow.getByRole('button', { name: /Phê duyệt & lịch sử/ }).locator('.nce-stage-status', { hasText: 'Sẵn sàng' }).waitFor();

    // 7. Nộp duyệt; người báo cáo không được duyệt.
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Phê duyệt & lịch sử/ }).click();
    await page.getByRole('button', { name: 'Nộp duyệt' }).click();
    await page.locator('.tag', { hasText: 'Chờ duyệt' }).first().waitFor();
    await section(page, 'Nộp duyệt và phê duyệt').locator('.alert.info', { hasText: 'người báo cáo' }).waitFor();
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
    await review.getByRole('button', { name: 'Trả lại', exact: true }).click();
    await page.locator('.nce-dossier-summary .tag', { hasText: 'Đã cho chạy lại' }).waitFor();
    await review.locator('.alert.warn', { hasText: returnNote }).waitFor();
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
    await section(page, 'Lịch sử hồ sơ').locator('b', { hasText: 'Duyệt đóng hồ sơ' }).waitFor();
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
