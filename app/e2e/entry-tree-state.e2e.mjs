import assert from 'node:assert/strict';
import test from 'node:test';
import { ADMIN, bootstrapAndLogin, launchApp, login, openPage, seedOperationalTest } from './helpers.mjs';

test('danh mục nội kiểm giữ nhánh và xét nghiệm khi rời trang rồi quay lại', { timeout: 90_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootstrapAndLogin(page);
    const first = await seedOperationalTest(page);
    const second = { machineName: 'Máy điện giải E2E', testName: 'Natri E2E' };
    await page.evaluate(async ({ firstId, machineName, testName }) => {
      const api = window.qcApi;
      const must = (result) => {
        if (!result.ok) throw new Error(result.error.message);
        return result.data;
      };
      const levels = await api.listTestLevels(firstId);
      const machine = must(await api.saveInstrument({ data: { name: machineName } }));
      const assay = must(await api.saveTest({ data: { name: testName, instrumentId: machine.id, unit: 'mmol/L' } }));
      // Dùng cùng nhóm lô trên hai máy để kiểm tra mỗi nhánh mở độc lập.
      const lotId = levels.find((level) => level.level === 1).qc_lot_id;
      must(await api.saveTestLevel({ testId: assay.id, data: { level: 1, mean: 140, sd: 2, qcLotId: lotId } }));
      must(await api.savePanel({ data: { name: 'Panel điện giải E2E', instrumentId: machine.id, testIds: [assay.id] } }));
    }, { firstId: first.testId, ...second });

    const machine = (name) => page.getByRole('treeitem', { name, exact: true });
    const group = (name) => machine(name).locator('..').getByRole('treeitem', { name: /^Nhóm lô E2E/ });
    const firstMachine = machine('Máy E2E');
    const secondMachine = machine(second.machineName);
    const firstGroup = group('Máy E2E');
    const secondGroup = group(second.machineName);
    const currentTest = (name) => page.locator('.qc-sheet-title').getByText(name, { exact: true });
    const navigateBackToEntry = async () => {
      await openPage(page, 'Tổng quan');
      await openPage(page, 'Nhập QC & Biểu đồ');
    };

    await openPage(page, 'Nhập QC & Biểu đồ');
    await currentTest(first.testName).waitFor();
    assert.equal(await firstGroup.getAttribute('aria-expanded'), 'true');
    assert.equal(await secondGroup.getAttribute('aria-expanded'), 'false');
    await secondGroup.click();
    await page.locator('.tn-config').filter({ hasText: second.testName }).click();
    await currentTest(second.testName).waitFor();
    await firstMachine.click();

    await navigateBackToEntry();
    await currentTest(second.testName).waitFor();
    assert.equal(await firstMachine.getAttribute('aria-expanded'), 'false');
    assert.equal(await secondGroup.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('.tn-config[aria-current="true"] .config-name').textContent(), second.testName);
    await firstMachine.click();
    assert.equal(await firstGroup.getAttribute('aria-expanded'), 'true');

    // Khi thu gọn chính nhóm chứa xét nghiệm đang xem, bảng nhập vẫn giữ
    // xét nghiệm đó. Quay lại trang không tự mở nhóm lần nữa.
    await secondGroup.click();
    await openPage(page, 'Tổng quan');
    await page.goBack();
    await currentTest(second.testName).waitFor();
    assert.equal(await secondGroup.getAttribute('aria-expanded'), 'false');

    await secondMachine.click();
    await openPage(page, 'Tổng quan');
    await page.getByRole('row', { name: new RegExp(second.testName) }).getByRole('button', { name: 'Xem QC' }).click();
    await currentTest(second.testName).waitFor();
    await page.locator('.tn-config[aria-current="true"]').getByText(second.testName, { exact: true }).waitFor();
    assert.equal(await secondMachine.getAttribute('aria-expanded'), 'true');
    assert.equal(await secondGroup.getAttribute('aria-expanded'), 'true');

    await openPage(page, 'Tổng quan');
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await login(page, ADMIN);
    await openPage(page, 'Nhập QC & Biểu đồ');
    await currentTest(first.testName).waitFor();
    assert.equal(await secondGroup.getAttribute('aria-expanded'), 'false');
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
