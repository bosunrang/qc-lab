// Hồi quy cho bản nháp NCE: đổi bước giữ nội dung; thay đổi từ người khác
// không được nâng phiên bản của bản nháp rồi ghi đè dữ liệu đã lưu.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest, todayIn } from './helpers.mjs';

test('NCE: khung bước và nội dung thẳng hàng khi mở hoặc thu gọn menu', { timeout: 90_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    await page.evaluate(async (date) => {
      const user = await window.qcApi.currentUser();
      const result = await window.qcApi.createNce({ data: { source: 'other', description: 'Kiểm tra căn hàng hai khung hồ sơ', correction: 'Đã kiểm soát sự cố ban đầu', holdResults: false, detectedAt: date, ownerUserId: user.id } });
      if (!result.ok) throw new Error(JSON.stringify(result.error));
    }, await todayIn(page));
    await openPage(page, 'Khắc phục sự cố');
    await page.getByRole('region', { name: 'Danh sách hồ sơ NCE' }).getByRole('button', { name: 'Mở hồ sơ' }).click();
    const navigation = page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' });
    await navigation.waitFor();
    assert.equal(await page.getByText('Hướng dẫn kết hợp 6 bước — chờ thẩm định theo SOP', { exact: true }).count(), 0, 'không hiện hướng dẫn SOP dài ở đầu hồ sơ');
    assert.equal(await navigation.locator('.nce-stage-link').count(), 7, 'bảy bước thao tác tách xác minh kỹ thuật và ảnh hưởng bệnh nhân');
    for (const width of [1647, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      for (const collapsed of [false, true]) {
        const toggle = page.getByRole('button', { name: collapsed ? 'Thu gọn thanh điều hướng' : 'Mở thanh điều hướng', exact: true });
        if (await toggle.count()) await toggle.click();
        await navigation.getByRole('button', { name: /Ghi nhận sự cố/ }).click();
        // Đo ở đầu hồ sơ, trước khi điều hướng ghim lại trong lúc cuộn.
        const geometry = await page.evaluate(() => {
          document.querySelector('main').scrollTop = 0;
          const nav = document.querySelector('.nce-workflow-nav');
          const panel = document.querySelector('.nce-stage:not([hidden]) > .panel');
          return { nav: nav.getBoundingClientRect().top, panel: panel.getBoundingClientRect().top, margin: getComputedStyle(nav).marginTop };
        });
        assert.equal(geometry.margin, '0px', 'không kế thừa khoảng cách trên của menu chính');
        assert.ok(Math.abs(geometry.nav - geometry.panel) < 1, `hai khung lệch tại ${width}px, menu ${collapsed ? 'thu gọn' : 'mở'}: ${JSON.stringify(geometry)}`);
      }
    }
    // Ở màn hình hẹp, hai khung xếp dọc với đúng khoảng cách của lưới.
    await page.setViewportSize({ width: 1000, height: 900 });
    const stacked = await page.evaluate(() => {
      document.querySelector('main').scrollTop = 0;
      const nav = document.querySelector('.nce-workflow-nav').getBoundingClientRect();
      const panel = document.querySelector('.nce-stage:not([hidden]) > .panel').getBoundingClientRect();
      const workspace = document.querySelector('.nce-workspace');
      return { navBottom: nav.bottom, panelTop: panel.top, gap: parseFloat(getComputedStyle(workspace).rowGap) };
    });
    assert.ok(Math.abs(stacked.panelTop - stacked.navBottom - stacked.gap) < 1, `khoảng cách hai khung xếp dọc: ${JSON.stringify(stacked)}`);
    await page.setViewportSize({ width: 1366, height: 768 });
    await navigation.getByRole('button', { name: /Ghi nhận sự cố/ }).click();
    const identity = page.getByRole('region', { name: 'Ghi nhận và xử lý tức thời' });
    await identity.getByRole('button', { name: 'Sửa', exact: true }).click();
    await identity.locator('#idContainment').fill('Máy A, ca sáng; báo phụ trách lúc 08:15');
    await identity.locator('#idOccurred').fill('08:00 phát hiện; 08:30 xử lý xong');
    await navigation.getByRole('button', { name: /Kiểm tra nhanh/ }).click();
    await page.getByRole('region', { name: 'Kiểm tra nhanh các yếu tố thường gặp' }).waitFor();
    await navigation.getByRole('button', { name: /Ghi nhận sự cố/ }).click();
    assert.match(await identity.locator('#idContainment').inputValue(), /08:15/);
    await identity.getByRole('button', { name: 'Lưu', exact: true }).click();
    await identity.getByText('Máy A, ca sáng; báo phụ trách lúc 08:15', { exact: true }).waitFor();
    if (process.env.QCLAB_NCE_SCREENSHOT_DIR) {
      await page.screenshot({ path: `${process.env.QCLAB_NCE_SCREENSHOT_DIR}/nce-six-step-workspace.png` });
    }
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});

test('NCE: tìm không dấu, chuyển bước giữ bản nháp và chặn ghi đè nội dung/hành động', { timeout: 180_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const today = await todayIn(page);
    const created = await page.evaluate(async (date) => {
      const user = await window.qcApi.currentUser();
      const result = await window.qcApi.createNce({ data: { source: 'other', description: 'Sai sót vận chuyển mẫu xét nghiệm', correction: 'Đã kiểm soát sự cố ban đầu', holdResults: false, detectedAt: date, ownerUserId: user.id } });
      if (!result.ok) throw new Error(JSON.stringify(result.error));
      return result.data;
    }, today);
    await openPage(page, 'Khắc phục sự cố');
    const summary = page.locator('.nce-summary[aria-label="Tình hình xử lý sự cố"]');
    const cards = summary.locator('.nce-summary-card');
    await summary.waitFor();
    assert.equal(await cards.count(), 4);
    const borderTokens = ['--info-accent', '--warning-accent', '--success-accent', '--danger-accent'];
    for (const [index, token] of borderTokens.entries()) {
      const card = cards.nth(index);
      const expected = await card.evaluate((element, tokenName) => {
        // Cho trình duyệt giải CSS var lồng nhau về màu thực, không so chuỗi
        // token với rgb() hoặc tự sao chép mã màu của hệ thống thiết kế.
        const probe = document.createElement('span');
        element.append(probe);
        probe.style.borderColor = `var(${tokenName})`;
        const accent = getComputedStyle(probe).borderTopColor;
        probe.style.borderColor = 'var(--surface-border)';
        const neutral = getComputedStyle(probe).borderTopColor;
        probe.remove();
        return { accent, neutral };
      }, token);
      for (const hover of [false, true]) {
        if (hover) await card.hover();
        else await page.mouse.move(0, 0);
        await pause(200);
        const borders = await card.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            colors: [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor],
            widths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
          };
        });
        assert.deepEqual(borders.colors, [expected.neutral, expected.neutral, expected.neutral, expected.accent], `thẻ ${index + 1} chỉ có viền trái ${token}, ba cạnh trung tính khi ${hover ? 'hover' : 'bình thường'}`);
        assert.deepEqual(borders.widths, ['1px', '1px', '1px', '3px'], `thẻ ${index + 1} nhấn viền trái 3px khi ${hover ? 'hover' : 'bình thường'}`);
      }
      await page.mouse.move(0, 0);
      await pause(200);
    }
    await summary.screenshot({ path: path.join(userDataDir, 'nce-summary-border-colors.png') });
    console.log(`Ảnh màu viền tổng quan: ${path.join(userDataDir, 'nce-summary-border-colors.png')}`);
    const records = page.getByRole('region', { name: 'Danh sách hồ sơ NCE' });
    assert.equal(await records.locator('.nce-section-body > p.nce-note[role="status"]').count(), 0, 'không hiện lại dòng đếm hồ sơ thừa dưới bộ lọc');
    const search = records.locator('.panel-head').getByRole('searchbox', { name: 'Tìm hồ sơ NCE' });
    await search.fill('van chuyen');
    assert.equal(await records.getByText('Ưu tiên hồ sơ và hành động quá hạn', { exact: true }).count(), 0);
    const headingBox = await records.getByRole('heading', { name: /Hồ sơ NCE/ }).boundingBox();
    const searchBox = await search.boundingBox();
    assert.ok(searchBox.x > headingBox.x + headingBox.width, 'tìm kiếm ở bên phải tiêu đề');
    assert.ok(Math.abs(searchBox.y + searchBox.height / 2 - headingBox.y - headingBox.height / 2) < 1, 'tìm kiếm cùng hàng với tiêu đề');
    const row = records.locator('tbody tr', { hasText: created.record.nce_id });
    for (const width of [1366, 1647]) {
      await page.setViewportSize({ width, height: 900 });
      const alignment = await records.locator('.nce-record-table').evaluate((wrapper) => {
        const cells = [...wrapper.querySelectorAll('thead th, tbody td')].map((cell) => ({ column: cell.cellIndex, textAlign: getComputedStyle(cell).textAlign, verticalAlign: getComputedStyle(cell).verticalAlign }));
        const centered = [...wrapper.querySelectorAll('tbody .tag, tbody button')].map((element) => {
          const box = element.getBoundingClientRect(), cell = element.closest('td').getBoundingClientRect();
          return { label: element.textContent, offset: (box.left + box.width / 2) - (cell.left + cell.width / 2) };
        });
        return { cells, centered };
      });
      assert.ok(alignment.cells.filter((cell) => cell.column === 0).every((cell) => cell.textAlign === 'left'), `cột hồ sơ/sự kiện giữ căn trái tại ${width}px`);
      assert.ok(alignment.cells.filter((cell) => cell.column > 0).every((cell) => cell.textAlign === 'center' && cell.verticalAlign === 'middle'), `header và nội dung bốn cột sau căn giữa tại ${width}px: ${JSON.stringify(alignment.cells)}`);
      assert.ok(alignment.centered.length >= 2, 'có badge tiến độ và nút Mở hồ sơ để đo');
      assert.ok(alignment.centered.every((element) => Math.abs(element.offset) <= 1), `badge và nút nằm giữa ô tại ${width}px: ${JSON.stringify(alignment.centered)}`);
    }
    await records.locator('.nce-record-table').screenshot({ path: path.join(userDataDir, 'nce-record-table-alignment.png') });
    console.log(`Ảnh căn giữa bảng hồ sơ: ${path.join(userDataDir, 'nce-record-table-alignment.png')}`);
    await row.getByRole('button', { name: 'Mở hồ sơ' }).click();
    const navigation = page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' });
    const stage = (name) => navigation.getByRole('button', { name }).click();
    await stage(/Ghi nhận sự cố/);
    const identity = page.getByRole('region', { name: 'Ghi nhận và xử lý tức thời' });
    await identity.getByRole('button', { name: 'Sửa', exact: true }).click();
    await identity.locator('#idDesc').fill('Bản nháp A đang sửa mô tả sự kiện');
    await stage(/Điều tra & CAPA/);
    await stage(/Ghi nhận sự cố/);
    assert.equal(await identity.locator('#idDesc').inputValue(), 'Bản nháp A đang sửa mô tả sự kiện');

    const second = await page.evaluate(async ({ id, version }) => {
      const result = await window.qcApi.updateNce({ data: { id, expectedVersion: version, patch: { correction: 'Bản sửa mới của người B cần được giữ nguyên' } } });
      if (!result.ok) throw new Error(JSON.stringify(result.error));
      return result.data;
    }, { id: created.record.id, version: created.record.row_version });
    await identity.getByText('Hồ sơ đã được cập nhật ở nơi khác').waitFor();
    await identity.getByRole('button', { name: 'Lưu', exact: true }).click();
    await page.locator('.nce-dossier-error', { hasText: 'Hồ sơ vừa được người khác cập nhật' }).waitFor();
    let stored = await page.evaluate(id => window.qcApi.getNce(id), created.record.id);
    assert.equal(stored.record.correction, second.record.correction);
    assert.equal(stored.record.description, created.record.description);
    assert.equal(stored.record.row_version, second.record.row_version);
    await page.getByRole('button', { name: 'Tải dữ liệu mới', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Tải dữ liệu mới', exact: true }).click();
    await identity.getByRole('button', { name: 'Sửa', exact: true }).waitFor();
    await identity.getByText(second.record.correction, { exact: true }).waitFor();

    // Modal sửa hành động cũng phải giữ phiên bản tại lúc mở bản nháp.
    await stage(/Điều tra & CAPA/);
    const actions = page.getByRole('region', { name: 'Hành động khắc phục và phòng ngừa' });
    await actions.getByRole('button', { name: 'Thêm hành động' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.locator('#actDesc').fill('Hành động khắc phục ban đầu cần thực hiện');
    await dialog.locator('#actOwner').selectOption(created.record.owner_user_id);
    await dialog.locator('#actDue').fill(today);
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    await actions.getByRole('button', { name: 'Sửa', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.locator('#actDesc').fill('Bản nháp hành động của người A');
    await page.evaluate(async (id) => {
      const current = await window.qcApi.getNce(id), action = current.actions[0];
      const result = await window.qcApi.updateNceAction({ data: { id, expectedVersion: current.record.row_version, actionId: action.id, action: { kind: action.kind, description: 'Người B đã cập nhật hành động khắc phục', ownerUserId: action.owner_user_id, dueDate: action.due_date } } });
      if (!result.ok) throw new Error(JSON.stringify(result.error));
    }, created.record.id);
    await actions.getByText('Người B đã cập nhật hành động khắc phục', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
    stored = await page.evaluate(id => window.qcApi.getNce(id), created.record.id);
    assert.equal(stored.actions[0].description, 'Người B đã cập nhật hành động khắc phục');
    await dialog.getByRole('button', { name: 'Bỏ qua', exact: true }).click();
    await page.locator('.nce-dossier-error', { hasText: 'Hồ sơ vừa được người khác cập nhật' }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});

test('NCE: modal hoàn thành và huỷ không xác nhận hành động đã được người khác sửa', { timeout: 120_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const created = await page.evaluate(async (date) => {
      const api = window.qcApi;
      const user = await api.currentUser();
      const must = (result) => {
        if (!result.ok) throw new Error(JSON.stringify(result.error));
        return result.data;
      };
      let dossier = must(await api.createNce({ data: { source: 'other', description: 'Kiểm tra xác nhận hành động khi hồ sơ thay đổi', correction: 'Đã kiểm soát sự cố ban đầu', holdResults: false, detectedAt: date, ownerUserId: user.id } }));
      for (const description of ['Hành động kiểm tra modal hoàn thành', 'Hành động kiểm tra modal huỷ bỏ']) {
        dossier = must(await api.addNceAction({ data: { id: dossier.record.id, expectedVersion: dossier.record.row_version, action: { kind: 'corrective', description, ownerUserId: user.id, dueDate: date } } }));
      }
      return dossier;
    }, await todayIn(page));
    await openPage(page, 'Khắc phục sự cố');
    const records = page.getByRole('region', { name: 'Danh sách hồ sơ NCE' });
    await records.locator('tbody tr', { hasText: created.record.nce_id }).getByRole('button', { name: 'Mở hồ sơ' }).click();
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Điều tra & CAPA/ }).click();
    const actions = page.getByRole('region', { name: 'Hành động khắc phục và phòng ngừa' });

    for (const mode of ['complete', 'cancel']) {
      const original = mode === 'complete' ? 'Hành động kiểm tra modal hoàn thành' : 'Hành động kiểm tra modal huỷ bỏ';
      const action = created.actions.find((item) => item.description === original);
      assert.ok(action, `có hành động cho ca ${mode}`);
      const row = actions.locator('tbody tr', { hasText: original });
      await row.getByRole('button', { name: mode === 'complete' ? 'Hoàn thành' : 'Huỷ', exact: true }).click();
      let dialog = page.getByRole('dialog');
      const input = mode === 'complete' ? '#actEvidence' : '#actCancel';
      const draft = mode === 'complete' ? 'Bằng chứng đang nhập của người A' : 'Lý do đang nhập của người A để huỷ hành động';
      const confirm = mode === 'complete' ? 'Xác nhận hoàn thành' : 'Huỷ hành động';
      const close = mode === 'complete' ? 'Bỏ qua' : 'Quay lại';
      await dialog.locator(input).fill(draft);

      // Mô phỏng người B qua đúng IPC, để cả dữ liệu và thông báo thay đổi
      // chạy như một người dùng khác; modal của A không được đổi phiên bản.
      const changed = await page.evaluate(async ({ id, actionId, description }) => {
        const current = await window.qcApi.getNce(id);
        const target = current.actions.find((item) => item.id === actionId);
        const result = await window.qcApi.updateNceAction({ data: { id, expectedVersion: current.record.row_version, actionId, action: { kind: target.kind, description, ownerUserId: target.owner_user_id, dueDate: target.due_date } } });
        if (!result.ok) throw new Error(JSON.stringify(result.error));
        return result.data;
      }, { id: created.record.id, actionId: action.id, description: `${original} đã được người B sửa` });
      const changedAction = changed.actions.find((item) => item.id === action.id);
      await actions.getByText(changedAction.description, { exact: true }).waitFor();
      await dialog.getByText(/Hồ sơ đã được cập nhật ở nơi khác/).waitFor();
      assert.equal(await dialog.locator(input).inputValue(), draft, 'không làm mất bản nháp khi báo xung đột');
      await dialog.getByRole('button', { name: confirm, exact: true }).click();
      await page.locator('.nce-dossier-error', { hasText: 'Hồ sơ vừa được người khác cập nhật' }).waitFor();
      let stored = await page.evaluate((id) => window.qcApi.getNce(id), created.record.id);
      assert.equal(stored.record.row_version, changed.record.row_version, 'lệnh cũ không tạo thêm phiên bản');
      assert.deepEqual(stored.actions.find((item) => item.id === action.id), changedAction, 'lệnh cũ không hoàn thành, huỷ hoặc ghi bằng chứng lên hành động mới');
      assert.equal(changedAction.status, 'open');
      await dialog.getByRole('button', { name: close, exact: true }).click();

      // Người dùng xem lại nội dung hiện hành, mở xác nhận mới thì vẫn có
      // thể hoàn thành/huỷ bình thường, không bị kẹt bởi xung đột trước đó.
      await actions.locator('tbody tr', { hasText: changedAction.description }).getByRole('button', { name: mode === 'complete' ? 'Hoàn thành' : 'Huỷ', exact: true }).click();
      dialog = page.getByRole('dialog');
      const finalEvidence = mode === 'complete' ? 'Phiếu xác minh sau khi đã rà soát nội dung mới' : 'Đã rà soát nội dung mới và xác nhận không còn cần hành động';
      await dialog.locator(input).fill(finalEvidence);
      await dialog.getByRole('button', { name: confirm, exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      stored = await page.evaluate((id) => window.qcApi.getNce(id), created.record.id);
      const finalAction = stored.actions.find((item) => item.id === action.id);
      assert.equal(finalAction.status, mode === 'complete' ? 'done' : 'cancelled');
      assert.equal(mode === 'complete' ? finalAction.evidence : finalAction.cancel_reason, finalEvidence);
      assert.equal(finalAction.description, changedAction.description);
    }
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});

test('NCE: kiểm tra nhanh phủ đủ khung, lưu bằng chứng và không tràn khi đổi độ rộng', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const created = await page.evaluate(async ({ testId, date }) => {
      const api = window.qcApi;
      const user = await api.currentUser();
      const runId = `${date}-quick-check`;
      for (const [level, val] of [[1, 5], [2, 17.1]]) {
        const point = await api.addPoint({ data: { testId, level, date, runId, val } });
        if (!point.ok) throw new Error(JSON.stringify(point.error));
      }
      const result = await api.createNce({ data: { source: 'iqc', testId, trigger: { date, runId }, description: 'Kiểm tra bố cục checklist sự cố QC hai mức', correction: 'Đã dừng trả kết quả và kiểm soát lô QC bị loại', holdResults: true, detectedAt: date, ownerUserId: user.id } });
      if (!result.ok) throw new Error(JSON.stringify(result.error));
      return result.data;
    }, { testId: seeded.testId, date: await todayIn(page) });
    await openPage(page, 'Khắc phục sự cố');
    await page.getByRole('region', { name: 'Danh sách hồ sơ NCE' }).locator('tbody tr', { hasText: created.record.nce_id }).getByRole('button', { name: 'Mở hồ sơ' }).click();
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Kiểm tra nhanh/ }).click();
    const checks = page.getByRole('region', { name: 'Kiểm tra nhanh các yếu tố thường gặp' });
    const grid = checks.locator('.nce-checklist-grid');
    assert.equal(await grid.locator('.nce-checklist-card').count(), 7, 'IQC có sáu nhóm kiểm tra cũ và điều kiện môi trường');
    await checks.locator('.nce-checklist-summary', { hasText: '0/7 mục đã đánh giá' }).waitFor();
    assert.equal(await grid.locator('.tag', { hasText: 'Chưa đánh giá' }).count(), 7);
    assert.equal(await grid.getByText('Chưa có ghi chú', { exact: true }).count(), 0, 'không lặp ghi chú trống trên các thẻ');
    assert.equal(await checks.getByText('Hướng dẫn rà soát', { exact: true }).count(), 0, 'không đưa khối hướng dẫn dài trở lại checklist');

    // Đo cả chế độ đọc và sửa bằng hình học thật: lưới luôn phủ đủ khung,
    // chia hai cột trên desktop và nội dung dài không tràn khỏi thẻ.
    async function assertFullWidth(mode) {
      for (const width of [1647, 1366, 1265, 1110, 1000]) {
        await page.setViewportSize({ width, height: 900 });
        const geometry = await checks.evaluate((panel) => {
          const grid = panel.querySelector('.nce-checklist-grid');
          const cards = [...grid.querySelectorAll('.nce-checklist-card')];
          const gridBox = grid.getBoundingClientRect();
          const parentStyle = getComputedStyle(grid.parentElement);
          return {
            gridWidth: gridBox.width,
            contentWidth: grid.parentElement.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight),
            columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
            rowTops: [...new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top)))],
            gridOverflow: grid.scrollWidth - grid.clientWidth,
            cardOverflow: cards.map((card) => card.scrollWidth - card.clientWidth),
            controlOverflow: [...grid.querySelectorAll('textarea, select')].map((control) => control.scrollWidth - control.clientWidth),
          };
        });
        const context = `${mode} tại ${width}px: ${JSON.stringify(geometry)}`;
        assert.ok(geometry.gridWidth >= geometry.contentWidth * 0.99 && geometry.gridWidth <= geometry.contentWidth + 1, `lưới phủ đủ chiều rộng khung — ${context}`);
        assert.equal(geometry.columns, 2, `desktop giữ hai cột để giảm chiều dài — ${context}`);
        assert.equal(geometry.rowTops.length, 4, `bảy thẻ xếp thành bốn hàng — ${context}`);
        assert.ok(geometry.gridOverflow <= 1 && geometry.cardOverflow.every((overflow) => overflow <= 1) && geometry.controlOverflow.every((overflow) => overflow <= 1), `nội dung dài xuống dòng, không tràn ngang — ${context}`);
      }
    }
    await assertFullWidth('chưa đánh giá');
    await page.setViewportSize({ width: 1366, height: 900 });
    await checks.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(userDataDir, 'nce-quick-check-initial.png'), fullPage: true });
    await checks.getByRole('button', { name: 'Sửa', exact: true }).click();
    const results = checks.locator('select[aria-label^="Kết quả:"]');
    const evidence = checks.locator('textarea[aria-label^="Bằng chứng:"]');
    assert.equal(await results.count(), 7);
    assert.equal(await evidence.count(), 7, 'mọi bằng chứng được nhập bằng ô nhiều dòng');
    for (let index = 0; index < 7; index++) await results.nth(index).selectOption(index === 0 ? 'abnormal' : index === 1 ? 'na' : 'ok');
    await checks.getByRole('button', { name: 'Lưu', exact: true }).click();
    await checks.getByRole('button', { name: 'Sửa', exact: true }).waitFor();
    let stored = await page.evaluate((id) => window.qcApi.getNce(id), created.record.id);
    assert.ok(stored.missing.some((item) => item.code === 'check-note-qcMaterial'), 'bất thường vẫn bắt buộc bằng chứng trước khi qua cổng');
    assert.ok(stored.missing.some((item) => item.code === 'check-note-reagent'), 'không áp dụng vẫn bắt buộc lý do trước khi qua cổng');
    await checks.getByRole('button', { name: 'Sửa', exact: true }).click();
    const abnormalNote = `Lọ QC bất thường đã được cách ly; đối chiếu nhật ký và thay lọ mới. ${'MaThamChieuDaiKhongCoKhoangTrang'.repeat(12)}`;
    const naNote = 'Không thay đổi hoá chất trong ca; đã đối chiếu nhật ký nhận và sử dụng hoá chất.';
    await evidence.nth(0).fill(abnormalNote);
    await evidence.nth(1).fill(naNote);
    await checks.locator('.nce-checklist-summary', { hasText: '7/7 mục đã đánh giá' }).waitFor();
    await assertFullWidth('đang sửa');
    await page.setViewportSize({ width: 1366, height: 900 });
    await checks.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(userDataDir, 'nce-quick-check-edit.png'), fullPage: true });
    await checks.getByRole('button', { name: 'Lưu', exact: true }).click();
    await checks.getByRole('button', { name: 'Sửa', exact: true }).waitFor();
    await checks.locator('.nce-checklist-summary', { hasText: '7/7 mục đã đánh giá' }).waitFor();
    await grid.getByText(abnormalNote, { exact: true }).waitFor();
    await grid.getByText(naNote, { exact: true }).waitFor();
    stored = await page.evaluate((id) => window.qcApi.getNce(id), created.record.id);
    const saved = JSON.parse(stored.record.checklist_json);
    assert.deepEqual(saved.qcMaterial, { status: 'abnormal', note: abnormalNote });
    assert.deepEqual(saved.reagent, { status: 'na', note: naNote });
    assert.equal(stored.missing.filter((item) => item.code.startsWith('check-')).length, 0, 'đủ checklist vẫn được công nhận theo cổng nghiệp vụ hiện hành');
    await assertFullWidth('đã lưu bằng chứng dài');
    await page.setViewportSize({ width: 1366, height: 900 });
    await checks.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(userDataDir, 'nce-quick-check-readonly.png'), fullPage: true });
    await checks.getByRole('button', { name: 'Sửa', exact: true }).click();
    assert.equal(await evidence.nth(0).inputValue(), abnormalNote, 'mở sửa lại giữ nguyên bằng chứng bất thường');
    assert.equal(await evidence.nth(1).inputValue(), naNote, 'mở sửa lại giữ nguyên lý do không áp dụng');
    assert.deepEqual(errors, []);
    console.log(`Ảnh Kiểm tra nhanh: ${path.join(userDataDir, 'nce-quick-check-initial.png')}, ${path.join(userDataDir, 'nce-quick-check-readonly.png')} và ${path.join(userDataDir, 'nce-quick-check-edit.png')}`);
  } finally {
    await app.close();
  }
});
