import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

test('Sigma: chọn CLIA giải TEa đang thiếu dù kỳ từng khóa null, không đổi snapshot số', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const assay = await page.evaluate(async () => {
      const must = (result) => { if (!result.ok) throw new Error(result.error.message); return result.data; };
      const machine = must(await window.qcApi.saveInstrument({ data: { name: 'Máy CLIA' } }));
      const assay = must(await window.qcApi.saveTest({ data: { name: 'Sodium (Na)', instrumentId: machine.id, unit: 'mmol/L', teaRefKey: 'qclab-sodium', operationalTeaSource: 'lab' } }));
      for (const [level, mean] of [[1, 140], [2, 200]]) must(await window.qcApi.saveTestLevel({ testId: assay.id, data: { level, mean, sd: 2 } }));
      must(await window.qcApi.saveSigmaPeriod({ testId: assay.id, period: '2026-11', teaSource: 'lab', levels: [
        { level: 1, cv: 1.85, biasEqa: 0.01 }, { level: 2, cv: 0.38, biasEqa: 0.02 },
      ] }));
      return assay;
    });
    // Chỉ ghi vào CSDL tạm của phiên kiểm thử để tái hiện dữ liệu bản lỗi.
    const db = new DatabaseSync(path.join(userDataDir, 'qclab.sqlite'));
    try {
      const id = `${assay.id}:2026-11`;
      const levels = JSON.parse(db.prepare('SELECT lv_json FROM sigma_data WHERE id=?').get(id).lv_json);
      db.prepare('UPDATE sigma_data SET lv_json=? WHERE id=?').run(JSON.stringify(levels.map(level => ({ ...level, teaLocked: true }))), id);
    } finally { db.close(); }
    await page.setViewportSize({ width: 1665, height: 1000 });
    await openPage(page, 'Six Sigma & Sai số');
    const source = page.getByRole('combobox', { name: 'Nguồn TEa vận hành', exact: true });
    await page.getByText('Thiếu TEa', { exact: true }).first().waitFor();
    await source.selectOption('clia');
    await page.waitForFunction(() => [...document.querySelectorAll('.sg-level-sigma b')].map(element => element.textContent).join(',') === '1.54,5.21');
    const resolved = (await page.evaluate((id) => window.qcApi.listSigmaPeriods(id), assay.id))[0];
    assert.ok(Math.abs(resolved.levels[0].tea - 4 / 140 * 100) < 1e-10);
    assert.equal(resolved.levels[1].tea, 2);
    assert.equal(await page.locator('#sg-tea-value').inputValue(), '±4.0000 mmol/L', 'tiêu chí CLIA gốc giữ nguyên phía trên');
    const identities = page.locator('.sg-level-identity');
    assert.match(await identities.nth(0).innerText(), /TEa% quy đổi: 2.86%/);
    assert.match(await identities.nth(0).innerText(), /Mean quy đổi: 140 mmol\/L/);
    assert.match(await identities.nth(1).innerText(), /TEa% quy đổi: 2.00%/);
    assert.match(await identities.nth(1).innerText(), /Mean quy đổi: 200 mmol\/L/);
    await page.reload();
    await page.waitForFunction(() => [...document.querySelectorAll('.sg-level-sigma b')].map(element => element.textContent).join(',') === '1.54,5.21');
    assert.equal(await source.inputValue(), 'clia', 'mở lại với CLIA đã chọn vẫn tính được');
    await page.screenshot({ path: path.join(userDataDir, 'sigma-clia-resolved.png') });
    await source.selectOption('ricos');
    await page.waitForFunction(async (id) => (await window.qcApi.listTests()).find(test => test.id === id)?.operational_tea_source === 'ricos', assay.id);
    const frozen = (await page.evaluate((id) => window.qcApi.listSigmaPeriods(id), assay.id))[0];
    assert.deepEqual(frozen.levels.map(level => level.tea), resolved.levels.map(level => level.tea), 'TEa đã có số được giữ trước lần đổi tiếp theo');
    assert.deepEqual(frozen.levels.map(level => level.teaConversion), resolved.levels.map(level => level.teaConversion), 'đổi nguồn không đổi Mean đã dùng để quy đổi kỳ cũ');
    await page.waitForFunction(() => [...document.querySelectorAll('#sgStatus .v')].map(element => element.textContent).join(',') === '0.39,1.87');
    assert.deepEqual(await page.locator('.sg-level-sigma b').allTextContents(), ['0.39', '1.87'], 'bảng và Tình trạng tự tính theo Ricos vừa chọn');
    assert.deepEqual(errors, []);
    console.log(`Ảnh kiểm tra Sigma CLIA: ${userDataDir}`);
  } finally { await app.close(); }
});

test('Sigma: kỳ đã lưu Ricos tự tính lại Tình trạng và bảng khi đổi CLIA, giữ CV/Bias', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const assay = await page.evaluate(async () => {
      const must = (result) => { if (!result.ok) throw new Error(result.error.message); return result.data; };
      const machine = must(await window.qcApi.saveInstrument({ data: { name: 'Máy Ricos CLIA' } }));
      const assay = must(await window.qcApi.saveTest({ data: { name: 'Sodium (Na)', instrumentId: machine.id, unit: 'mmol/L', teaRefKey: 'qclab-sodium', operationalTeaSource: 'ricos' } }));
      for (const [level, mean] of [[1, 140], [2, 200]]) must(await window.qcApi.saveTestLevel({ testId: assay.id, data: { level, mean, sd: 2 } }));
      must(await window.qcApi.saveSigmaPeriod({ testId: assay.id, period: '2026-11', tea: 0.73, teaSource: 'ricos', levels: [
        { level: 1, tea: 0.73, targetMean: 140, cv: 1.85, biasEqa: 0.01 }, { level: 2, tea: 0.73, targetMean: 200, cv: 0.38, biasEqa: 0.02 },
      ] }));
      return assay;
    });
    await page.setViewportSize({ width: 1665, height: 1100 });
    await openPage(page, 'Six Sigma & Sai số');
    await page.waitForFunction(() => [...document.querySelectorAll('#sgStatus .v')].map(element => element.textContent).join(',') === '0.39,1.87');
    const source = page.getByRole('combobox', { name: 'Nguồn TEa vận hành', exact: true });
    await source.selectOption('clia');
    await page.waitForFunction(() => [...document.querySelectorAll('#sgStatus .v')].map(element => element.textContent).join(',') === '1.54,5.21');
    assert.deepEqual(await page.locator('.sg-level-sigma b').allTextContents(), ['1.54', '5.21']);
    assert.equal(await page.getByRole('spinbutton', { name: 'CV IQC mức 1', exact: true }).inputValue(), '1.85');
    assert.equal(await page.getByRole('spinbutton', { name: 'CV IQC mức 2', exact: true }).inputValue(), '0.38');
    assert.match(await page.locator('.sg-level-identity').first().innerText(), /TEa% quy đổi: 2.86%/);
    await page.screenshot({ path: path.join(userDataDir, 'sigma-ricos-to-clia-live.png') });
    const original = (await page.evaluate(id => window.qcApi.listSigmaPeriods(id), assay.id))[0];
    assert.equal(original.teaSource, 'ricos');
    assert.deepEqual(original.levels.map(level => level.teaSnapshot), [0.73, 0.73]);
    const cv = page.getByRole('spinbutton', { name: 'CV IQC mức 1', exact: true });
    await cv.fill('2');
    await cv.blur();
    await page.waitForFunction(() => document.querySelector('#sgStatus .v')?.textContent === '1.42');
    const edited = (await page.evaluate(id => window.qcApi.listSigmaPeriods(id), assay.id))[0];
    assert.equal(edited.teaSource, 'ricos', 'sửa CV không ghi nguồn tính hiện hành vào lịch sử');
    assert.deepEqual(edited.levels.map(level => level.teaSnapshot), [0.73, 0.73]);
    assert.equal(edited.levels[0].cv, 2);
    assert.deepEqual(edited.levels.map(level => level.biasEqa), [0.01, 0.02]);
    await page.reload();
    await page.waitForFunction(() => [...document.querySelectorAll('#sgStatus .v')].map(element => element.textContent).join(',') === '1.42,5.21');
    assert.deepEqual(errors, []);
    console.log(`Ảnh đối chiếu Ricos → CLIA: ${userDataDir}`);
  } finally { await app.close(); }
});

test('đổi TEa tại danh mục: Sigma tự cập nhật khi đang mở và khi quay lại từ form', { timeout: 180_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const assay = await page.evaluate(async () => {
      const must = result => { if (!result.ok) throw new Error(result.error.message); return result.data; };
      const machine = must(await window.qcApi.saveInstrument({ data: { name: 'Máy TEa danh mục' } }));
      const assay = must(await window.qcApi.saveTest({ data: { name: 'Sodium (Na)', instrumentId: machine.id, unit: 'mmol/L', teaRefKey: 'qclab-sodium', operationalTeaSource: 'ricos' } }));
      for (const [level, mean] of [[1, 140], [2, 200]]) must(await window.qcApi.saveTestLevel({ testId: assay.id, data: { level, mean, sd: 2 } }));
      must(await window.qcApi.saveSigmaPeriod({ testId: assay.id, period: '2026-11', tea: 0.73, teaSource: 'ricos', levels: [
        { level: 1, tea: 0.73, targetMean: 140, cv: 1.85, biasEqa: 0.01 }, { level: 2, tea: 0.73, targetMean: 200, cv: 0.38, biasEqa: 0.02 },
      ] }));
      return assay;
    });
    const original = (await page.evaluate(id => window.qcApi.listSigmaPeriods(id), assay.id))[0];
    await page.setViewportSize({ width: 1665, height: 1100 });
    await openPage(page, 'Six Sigma & Sai số');
    const status = page.locator('#sgStatus .v');
    const source = page.getByRole('combobox', { name: 'Nguồn TEa vận hành', exact: true });
    const trend = page.getByRole('img', { name: 'Xu hướng Sigma theo kỳ', exact: true });
    await page.waitForFunction(() => [...document.querySelectorAll('#sgStatus .v')].map(element => element.textContent).join(',') === '0.39,1.87');
    const mdcPoints = () => page.locator('.sg-mdc-point').evaluateAll(points => points.map(point => [point.getAttribute('cx'), point.getAttribute('cy')]));
    const ricosPoints = await mdcPoints();
    assert.equal(ricosPoints.length, 2);

    // Gọi đúng handler mà form danh mục dùng, giữ Sigma đang mở để kiểm
    // thông báo tự nạp lại, không tự gọi loadPeriods hoặc tải lại trang.
    const saved = await page.evaluate(async assay => {
      const result = await window.qcApi.saveTest({ id: assay.id, data: {
        name: assay.name, instrumentId: assay.instrument_id, unit: assay.unit, teaRefKey: assay.tea_ref_key, operationalTeaSource: 'clia',
      } });
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    }, assay);
    assert.equal(saved.operational_tea_source, 'clia');
    await page.waitForFunction(() => document.querySelector('#sg-tea-source')?.value === 'clia' && [...document.querySelectorAll('#sgStatus .v')].map(element => element.textContent).join(',') === '1.54,5.21');
    assert.deepEqual(await page.locator('.sg-level-sigma b').allTextContents(), ['1.54', '5.21']);
    assert.match(await trend.locator('circle title').allTextContents().then(items => items.join(' | ')), /Sigma 1.54.*Sigma 5.21/);
    assert.equal(await page.locator('#sg-tea-value').inputValue(), '±4.0000 mmol/L');
    const cliaPoints = await mdcPoints();
    assert.notDeepEqual(cliaPoints, ricosPoints, 'MDC cũng cập nhật theo TEa CLIA');

    // Đổi bằng chính giao diện danh mục, rồi quay lại Sigma như người dùng.
    for (const [nextSource, expected] of [['ricos', ['0.39', '1.87']], ['lab', ['—', '—']], ['clia', ['1.54', '5.21']]]) {
      await openPage(page, 'Cấu hình chung');
      await page.getByRole('button', { name: /^Danh mục xét nghiệm/ }).click();
      await page.getByRole('button', { name: 'Sửa Sodium (Na) trên Máy TEa danh mục', exact: true }).click();
      const modal = page.locator('.rcfg-assay-modal');
      await modal.getByRole('combobox', { name: 'Nguồn TEa vận hành', exact: true }).selectOption(nextSource);
      await modal.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
      await modal.waitFor({ state: 'detached' });
      await openPage(page, 'Six Sigma & Sai số');
      await page.waitForFunction(({ nextSource, expected }) => document.querySelector('#sg-tea-source')?.value === nextSource && [...document.querySelectorAll('#sgStatus .v')].map(element => element.textContent).join(',') === expected.join(','), { nextSource, expected });
      assert.equal(await source.inputValue(), nextSource);
      assert.deepEqual(await status.allTextContents(), expected);
      assert.deepEqual(await page.locator('.sg-level-sigma b').allTextContents(), expected);
      assert.equal(await page.getByRole('spinbutton', { name: 'CV IQC mức 1', exact: true }).inputValue(), '1.85');
      assert.equal(await page.getByRole('spinbutton', { name: 'CV IQC mức 2', exact: true }).inputValue(), '0.38');
      assert.equal(await page.getByRole('spinbutton', { name: 'Bias EQA mức 1', exact: true }).inputValue(), '0.01');
      assert.equal(await page.getByRole('spinbutton', { name: 'Bias EQA mức 2', exact: true }).inputValue(), '0.02');
      if (nextSource === 'lab') assert.equal(await page.locator('#sg-tea-value').inputValue(), 'Chưa có');
      assert.deepEqual(await mdcPoints(), nextSource === 'lab' ? [] : nextSource === 'clia' ? cliaPoints : ricosPoints, 'MDC dùng đúng nguồn như Tình trạng và bảng');
    }
    assert.deepEqual((await page.evaluate(id => window.qcApi.listSigmaPeriods(id), assay.id))[0], original, 'các lần đổi danh mục không sửa dữ liệu kỳ đã lưu');
    await page.screenshot({ path: path.join(userDataDir, 'sigma-after-catalog-tea-change.png') });
    assert.deepEqual(errors, []);
    console.log(`Ảnh kiểm tra danh mục → Sigma: ${userDataDir}`);
  } finally { await app.close(); }
});
