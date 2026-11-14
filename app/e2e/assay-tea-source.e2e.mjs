import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

test('form xét nghiệm: hai ô TEa thẳng cột, nằm trên Hoá chất và lưu đúng nguồn vận hành', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const machineId = await page.evaluate(async () => {
      const must = (result) => { if (!result.ok) throw new Error(result.error.message); return result.data; };
      const machine = must(await window.qcApi.saveInstrument({ data: { name: 'Máy TEa', section: 'Điện giải' } }));
      must(await window.qcApi.saveTeaRef({ data: {
        analyteId: 'qclab-sodium', name: 'Sodium', unit: 'mmol/L', labValue: 3, levelValues: [{ level: 1, tea: 2.8 }],
        labSource: 'regulation', reference: 'CLIA 2024', reason: 'Tiêu chí TEa đã xem xét cho xét nghiệm Natri',
        effectiveDate: '2026-01-01', approvedDate: '2026-01-01', nextReviewDate: '2027-01-01', preparedBy: 'KTV A', approvedBy: 'Trưởng khoa',
      } }));
      return machine.id;
    });
    await page.setViewportSize({ width: 1366, height: 900 });
    await openPage(page, 'Cấu hình chung');
    await page.getByRole('button', { name: /^Danh mục xét nghiệm/ }).click();
    await page.getByRole('button', { name: /Thêm xét nghiệm/ }).click();
    const modal = page.locator('.rcfg-assay-modal');
    assert.equal(await modal.locator('#test-tea').inputValue(), 'Chưa có');
    assert.equal(await modal.locator('#test-tea-hint').count(), 0);
    await modal.locator('#test-name').fill('Sodium');
    await modal.locator('#assayTeaSuggestions').getByRole('option', { name: /^Sodium \(Na\)/ }).click();
    const source = modal.locator('#test-tea-source'), criterion = modal.locator('#test-tea');
    assert.deepEqual(await source.locator('option').evaluateAll((items) => items.map((item) => item.value)), ['lab', 'clia', 'ricos', 'eflm']);
    await modal.getByText('Nguồn TEa vận hành', { exact: true }).waitFor();
    assert.equal(await source.inputValue(), 'lab');
    assert.equal(await source.locator('option').first().innerText(), 'TEa chuẩn hoá của phòng xét nghiệm');
    await source.selectOption('clia');
    assert.equal(await criterion.inputValue(), '±4.0000 mmol/L');
    await modal.getByText('Tiêu chí CLIA', { exact: true }).waitFor();
    const name = await modal.locator('#test-name').boundingBox(), unit = await modal.locator('#test-unit').boundingBox();
    const selectBox = await source.boundingBox(), criterionBox = await criterion.boundingBox(), reagent = await modal.locator('#test-reagent').boundingBox();
    assert.ok(Math.abs(selectBox.x - name.x) < 1 && Math.abs(selectBox.width - name.width) < 1, 'nguồn TEa thẳng cột Tên/Phương pháp');
    assert.ok(Math.abs(criterionBox.x - unit.x) < 1 && Math.abs(criterionBox.width - unit.width) < 1, 'tiêu chí thẳng cột Đơn vị/Số thập phân');
    assert.ok(Math.abs(selectBox.y - criterionBox.y) < 1);
    assert.ok(reagent.y > criterionBox.y + criterionBox.height, 'Hoá chất nằm dưới hai ô TEa');
    await modal.screenshot({ path: path.join(userDataDir, 'assay-tea-clia.png') });
    await source.selectOption('ricos');
    assert.equal(await criterion.inputValue(), '0.73%');
    await source.selectOption('lab');
    assert.match(await criterion.inputValue(), /3%.*M1 2.8%/);
    await source.selectOption('clia');
    await modal.locator('.assay-machine-picker input[type=checkbox]').check();
    await modal.getByRole('button', { name: 'Thêm xét nghiệm', exact: true }).click();
    await modal.waitFor({ state: 'detached' });
    const selected = await page.evaluate(async () => (await window.qcApi.listTests()).find((item) => item.tea_ref_key === 'qclab-sodium'));
    assert.equal(selected.operational_tea_source, 'clia');
    const originalPeriod = await page.evaluate(async ({ testId, instrumentId }) => {
      const must = (result) => { if (!result.ok) throw new Error(result.error.message); return result.data; };
      const lots = [];
      for (const level of [1, 2]) lots.push(must(await window.qcApi.saveLot({ data: { lotNo: `TEA-L${level}`, level } })));
      must(await window.qcApi.saveLotGroup({ data: { name: 'Nhóm TEa', lotIds: lots.map((lot) => lot.id) } }));
      for (const [index, mean] of [140, 200].entries()) must(await window.qcApi.saveTestLevel({ testId, data: { level: index + 1, mean, sd: 2, qcLotId: lots[index].id } }));
      must(await window.qcApi.savePanel({ data: { name: 'Panel TEa', instrumentId, testIds: [testId] } }));
      return must(await window.qcApi.saveSigmaPeriod({ testId, period: '2026-10', teaSource: 'clia', levels: [{ level: 1, cv: 1, biasEqa: 0 }, { level: 2, cv: 1, biasEqa: 0 }] }));
    }, { testId: selected.id, instrumentId: machineId });
    await openPage(page, 'Six Sigma & Sai số');
    await page.locator('#sg-tea-source').waitFor();
    assert.equal(await page.locator('#sg-tea-source').inputValue(), 'clia', 'Sigma mở theo CLIA đã chọn, không bị hồ sơ PXN ghi đè');
    const sigmaSource = page.getByRole('combobox', { name: 'Nguồn TEa vận hành', exact: true });
    const choices = await sourceChoices(sigmaSource);
    assert.equal(choices[1].text, 'CLIA PT (CMS-3355-F)');
    assert.equal(choices[2].text, 'Ricos / Westgard biological variation');
    await sigmaSource.selectOption('lab');
    await page.waitForFunction(async (id) => (await window.qcApi.listTests()).find((item) => item.id === id)?.operational_tea_source === 'lab', selected.id);
    await page.waitForFunction(() => !document.querySelector('#sg-tea-source').disabled);
    await openPage(page, 'Cấu hình chung');
    await page.getByRole('button', { name: /^Danh mục xét nghiệm/ }).click();
    await page.getByRole('button', { name: /^Sửa Sodium \(Na\) trên Máy TEa$/ }).click();
    assert.equal(await source.inputValue(), 'lab', 'đổi ở Sigma đồng bộ sang danh mục');
    assert.deepEqual(await sourceChoices(source), choices, 'hai ô dùng đúng cùng tên và thứ tự nguồn của Sigma');
    assert.equal(await source.locator('option').filter({ hasText: 'Nguồn hiện tại:' }).count(), 0);
    await source.selectOption('ricos');
    await modal.screenshot({ path: path.join(userDataDir, 'assay-tea-ricos.png') });
    await modal.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await modal.waitFor({ state: 'detached' });
    const after = await page.evaluate(async (id) => (await window.qcApi.listTests()).find((item) => item.id === id), selected.id);
    assert.equal(after.operational_tea_source, 'ricos');
    assert.equal(after.tea_source, 'ricos');
    await openPage(page, 'Six Sigma & Sai số');
    await page.locator('#sg-tea-source').waitFor();
    assert.equal(await page.locator('#sg-tea-source').inputValue(), 'ricos');
    await sigmaSource.selectOption('eflm');
    await page.waitForFunction(async (id) => (await window.qcApi.listTests()).find((item) => item.id === id)?.operational_tea_source === 'eflm', selected.id);
    await page.waitForFunction(() => document.querySelector('#sg-tea-value').placeholder === 'Chưa có');
    assert.equal(await page.locator('#sg-tea-value').inputValue(), '', 'EFLM thiếu dữ liệu không mượn TEa nguồn khác');
    await openPage(page, 'Cấu hình chung');
    await page.getByRole('button', { name: /^Danh mục xét nghiệm/ }).click();
    await page.getByRole('button', { name: /^Sửa Sodium \(Na\) trên Máy TEa$/ }).click();
    assert.equal(await source.inputValue(), 'eflm');
    assert.equal(await criterion.inputValue(), 'Chưa có');
    const historical = await page.evaluate(async (id) => (await window.qcApi.listSigmaPeriods(id))[0], selected.id);
    assert.deepEqual(historical, originalPeriod, 'đổi nguồn qua cả hai giao diện không đổi kỳ đã lưu');
    assert.deepEqual(errors, []);
    console.log(`Ảnh kiểm tra hai ô TEa: ${userDataDir}`);
  } finally { await app.close(); }
});

function sourceChoices(source) {
  return source.locator('option').evaluateAll((items) => items.map((item) => ({ value: item.value, text: item.textContent })));
}
