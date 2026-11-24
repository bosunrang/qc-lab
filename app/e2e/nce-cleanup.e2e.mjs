// Hồi quy các lỗi tìm thấy khi dọn NCE: gửi trùng, kẹt biểu mẫu khi mất phản
// hồi và bằng chứng có điểm đã huỷ rồi nhập lại cùng mức/lô.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest, todayIn } from './helpers.mjs';

test('NCE: lập hồ sơ chặn gửi trùng, giữ nháp và thoát được khi mất phản hồi', { timeout: 90_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    await openPage(page, 'Khắc phục sự cố');
    // Thay transport riêng trong profile kiểm thử; không ghi hồ sơ giả vào CSDL.
    await app.evaluate(({ ipcMain }) => {
      globalThis.__nceCreateCalls = 0;
      ipcMain.removeHandler('nce:create');
      ipcMain.handle('nce:create', () => {
        globalThis.__nceCreateCalls++;
        return new Promise((resolve, reject) => {
          globalThis.__nceCreateResolve = resolve;
          globalThis.__nceCreateReject = reject;
        });
      });
    });
    await page.getByRole('button', { name: '+ Lập hồ sơ từ nguồn khác', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Lập hồ sơ NCE từ nguồn khác' });
    const description = 'Nội dung sự cố đang nhập cần được giữ lại';
    await modal.locator('#nceDescription').fill(description);
    await modal.locator('#nceCorrection').fill('Đã kiểm soát sự cố ban đầu');
    await modal.getByLabel('Không cần', { exact: true }).check();
    await modal.getByRole('button', { name: 'Lập hồ sơ', exact: true }).evaluate((button) => { button.click(); button.click(); });
    await modal.getByRole('button', { name: 'Đang lưu…', exact: true }).waitFor();
    assert.equal(await modal.getByRole('button', { name: 'Bỏ qua', exact: true }).isDisabled(), true);
    await page.keyboard.press('Escape');
    assert.equal(await modal.isVisible(), true, 'không đóng nhầm khi lệnh ghi còn chờ');
    assert.equal(await app.evaluate(() => globalThis.__nceCreateCalls), 1);
    await app.evaluate(() => globalThis.__nceCreateResolve({ ok: false, error: { code: 'missing-description', message: 'Lỗi nhập liệu kiểm thử' } }));
    await modal.getByRole('alert').filter({ hasText: 'Lỗi nhập liệu kiểm thử' }).waitFor();
    assert.equal(await modal.getByRole('button', { name: 'Lập hồ sơ', exact: true }).isEnabled(), true, 'lỗi đã xác nhận từ chối cho phép sửa và gửi lại');
    assert.equal(await modal.locator('#nceDescription').inputValue(), description);
    await modal.getByRole('button', { name: 'Lập hồ sơ', exact: true }).click();
    await modal.getByRole('button', { name: 'Đang lưu…', exact: true }).waitFor();
    await app.evaluate(async () => {
      const deadline = Date.now() + 5_000;
      while (globalThis.__nceCreateCalls !== 2 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
      if (globalThis.__nceCreateCalls !== 2) throw new Error('Lệnh lập hồ sơ thứ hai chưa tới transport kiểm thử');
    });
    await app.evaluate(() => globalThis.__nceCreateReject(new Error('Giả lập mất phản hồi sau khi gửi')));
    await modal.getByRole('alert').filter({ hasText: 'Chưa xác nhận được hồ sơ' }).waitFor();
    assert.equal(await modal.getByRole('button', { name: 'Lập hồ sơ', exact: true }).isDisabled(), true);
    assert.equal(await modal.locator('#nceDescription').inputValue(), description);
    assert.equal(await app.evaluate(() => globalThis.__nceCreateCalls), 2, 'không tự gửi lại lệnh chưa rõ kết quả');
    await modal.getByRole('button', { name: 'Về danh sách', exact: true }).click();
    assert.equal(await modal.count(), 0, 'không kẹt trong trạng thái lưu');
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});

test('NCE: bảng bằng chứng giữ cả điểm đã huỷ và điểm nhập lại; gắn lần chạy xử lý lỗi đọc/ghi', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const seeded = await seedOperationalTest(page);
    const date = await todayIn(page);
    const created = await page.evaluate(async ({ testId, date }) => {
      const api = window.qcApi;
      const must = (r) => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.data; };
      for (const [level, val] of [[1, 5], [2, 17.1]]) must(await api.addPoint({ data: { testId, date, runId: '1', level, val } }));
      const [first] = await api.queryPoints(testId, 1);
      must(await api.voidPoint({ data: { pointId: first.id, reason: 'Nhập nhầm, cần ghi lại đúng giá trị', kind: 'data-entry' } }));
      must(await api.addPoint({ data: { testId, date, runId: '1', level: 1, val: 5.1 } }));
      const user = await api.currentUser();
      const dossier = must(await api.createNce({ data: { source: 'iqc', testId, trigger: { date, runId: '1' }, description: 'Kiểm tra bằng chứng điểm đã huỷ và điểm mới', correction: 'Đã dừng trả kết quả liên quan', holdResults: true, detectedAt: date, ownerUserId: user.id } }));
      for (const [level, val] of [[1, 5], [2, 17.2]]) must(await api.addPoint({ data: { testId, date, runId: '2', level, val } }));
      return dossier;
    }, { testId: seeded.testId, date });
    await openPage(page, 'Khắc phục sự cố');
    const records = page.getByRole('region', { name: 'Danh sách hồ sơ NCE' });
    await records.locator('tbody tr', { hasText: created.record.nce_id }).getByRole('button', { name: 'Mở hồ sơ', exact: true }).click();
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Ghi nhận sự cố/ }).click();
    const identity = page.getByRole('region', { name: 'Ghi nhận và xử lý tức thời' });
    await identity.locator('.nce-timeline-disclosure > summary').click();
    const run = identity.locator('details.nce-run').first();
    await run.locator('summary').click();
    assert.equal(await run.locator('tbody tr').count(), 3, 'giữ nguyên điểm đã huỷ và hai điểm còn hiệu lực');
    assert.equal(await run.getByText('Đã huỷ', { exact: true }).count(), 1);
    const table = await run.locator('table').evaluate((element) => ({
      display: getComputedStyle(element).display,
      headers: [...element.querySelectorAll('th')].every((cell) => cell.scope === 'col'),
      cells: [...element.querySelectorAll('th,td')].every((cell) => getComputedStyle(cell).textAlign === 'center'),
    }));
    assert.equal(table.display, 'table');
    assert.equal(table.headers, true);
    assert.equal(table.cells, true);
    for (const width of [1647, 1000, 600]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.locator('.nce-workspace').evaluate((element) => element.scrollWidth - element.clientWidth);
      assert.ok(overflow <= 1, `khung hồ sơ không tràn ngang ở ${width}px: ${overflow}`);
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await identity.screenshot({ path: path.join(userDataDir, 'nce-cleanup-snapshot.png') });
    console.log(`Ảnh rà soát bảng NCE: ${path.join(userDataDir, 'nce-cleanup-snapshot.png')}`);
    await page.getByRole('button', { name: '← Danh sách', exact: true }).click();
    const attach = page.getByRole('button', { name: `Gắn vào ${created.record.nce_id}`, exact: true });
    await attach.waitFor();
    await app.evaluate(({ ipcMain }) => {
      const original = ipcMain._invokeHandlers.get('nce:get');
      globalThis.__nceOriginalGet = original;
      ipcMain.removeHandler('nce:get');
      ipcMain.handle('nce:get', () => { throw new Error('Giả lập không tải được hồ sơ'); });
    });
    await attach.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Gắn vào hồ sơ', exact: true }).click();
    await page.getByRole('alertdialog').getByText('Không tải được hồ sơ để gắn lần chạy. Thử lại sau khi kết nối ổn định.', { exact: true }).waitFor();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Đã hiểu', exact: true }).click();
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('nce:get');
      ipcMain.handle('nce:get', globalThis.__nceOriginalGet);
      globalThis.__nceAttachCalls = 0;
      ipcMain.removeHandler('nce:attachRun');
      ipcMain.handle('nce:attachRun', () => { globalThis.__nceAttachCalls++; throw new Error('Giả lập mất phản hồi gắn lần chạy'); });
    });
    await attach.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Gắn vào hồ sơ', exact: true }).click();
    await page.getByRole('alertdialog').getByText(/Chưa xác nhận được lần chạy đã được gắn/).waitFor();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Đã hiểu', exact: true }).click();
    await page.locator('.nce-dossier').waitFor();
    assert.equal(await app.evaluate(() => globalThis.__nceAttachCalls), 1, 'không tự gửi lại lệnh gắn lần chạy');
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});

test('NCE: mất phản hồi hoàn thành hành động không nhốt người dùng trong hộp thoại', { timeout: 90_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    await page.evaluate(async (date) => {
      const api = window.qcApi;
      const user = await api.currentUser();
      const created = await api.createNce({ data: { source: 'other', description: 'Kiểm tra phục hồi hộp thoại hành động', correction: 'Đã kiểm soát sự cố ban đầu', holdResults: false, detectedAt: date, ownerUserId: user.id } });
      if (!created.ok) throw new Error(JSON.stringify(created.error));
      const result = await api.addNceAction({ data: { id: created.data.record.id, expectedVersion: created.data.record.row_version, action: { kind: 'corrective', description: 'Rà soát quy trình và lưu bằng chứng', ownerUserId: user.id, dueDate: date } } });
      if (!result.ok) throw new Error(JSON.stringify(result.error));
    }, await todayIn(page));
    await openPage(page, 'Khắc phục sự cố');
    await page.getByRole('region', { name: 'Danh sách hồ sơ NCE' }).getByRole('button', { name: 'Mở hồ sơ', exact: true }).click();
    await page.getByRole('navigation', { name: 'Các bước xử lý hồ sơ' }).getByRole('button', { name: /Điều tra & CAPA/ }).click();
    const actions = page.getByRole('region', { name: 'Hành động khắc phục và phòng ngừa' });
    assert.equal(await actions.getByRole('heading', { level: 3 }).count(), 1, 'nhóm con CAPA có tiêu đề đúng cấp');
    await actions.getByRole('button', { name: 'Hoàn thành', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Hoàn thành hành động' });
    const evidence = 'Nội dung bằng chứng đang nhập trước khi mất phản hồi';
    await modal.locator('#actEvidence').fill(evidence);
    await app.evaluate(({ ipcMain }) => {
      globalThis.__nceCompleteCalls = 0;
      ipcMain.removeHandler('nce:completeAction');
      ipcMain.handle('nce:completeAction', () => { globalThis.__nceCompleteCalls++; throw new Error('Giả lập mất phản hồi hoàn thành'); });
    });
    await modal.getByRole('button', { name: 'Xác nhận hoàn thành', exact: true }).click();
    await modal.getByRole('alert').filter({ hasText: 'Chưa xác nhận được thao tác' }).waitFor();
    assert.equal(await modal.locator('#actEvidence').inputValue(), evidence);
    assert.equal(await modal.getByRole('button', { name: 'Xác nhận hoàn thành', exact: true }).isDisabled(), true);
    assert.equal(await app.evaluate(() => globalThis.__nceCompleteCalls), 1);
    await modal.getByRole('button', { name: 'Bỏ qua', exact: true }).click();
    assert.equal(await modal.count(), 0);
    await page.locator('.nce-dossier-error').getByRole('button', { name: 'Tải dữ liệu mới', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Tải dữ liệu mới', exact: true }).click();
    await actions.getByRole('button', { name: 'Hoàn thành', exact: true }).waitFor({ state: 'visible' });
    assert.equal(await actions.getByRole('button', { name: 'Hoàn thành', exact: true }).isEnabled(), true);
    assert.equal(await page.locator('.nce-dossier-error').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
