import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

test('Bias ngoại kiểm: chặn căn cứ thay đổi khi đang mở, áp dụng đúng mẫu và sửa CV giữ nguồn', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await page.setViewportSize({ width: 1680, height: 1100 });
    await bootstrapAndLogin(page);
    const seed = await page.evaluate(async () => {
      const api = window.qcApi, must = r => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.data; };
      const machine = must(await api.saveInstrument({ data: { name: 'Máy Bias EQA' } }));
      const assay = must(await api.saveTest({ data: { name: 'Glucose', unit: 'mmol/L', instrumentId: machine.id } }));
      must(await api.saveSigmaTeaConfig({ testId: assay.id, source: 'eflm', tea: 10, eflmAnalyte: 'Glucose', eflmLookupDate: '2026-09-01', eflmRef: 'Nguồn kiểm thử' }));
      must(await api.saveTestLevel({ testId: assay.id, data: { level: 1, mean: 5, sd: .1 } }));
      must(await api.saveTestLevel({ testId: assay.id, data: { level: 2, mean: 15, sd: .3 } }));
      must(await api.saveSigmaPeriod({ testId: assay.id, period: '2026-09', teaSource: 'eflm', tea: 10, levels: [{ level: 1, tea: 10, targetMean: 5, cv: 2, biasEqa: .5 },
        { level: 2, tea: 10, targetMean: 15, cv: 3, biasEqa: 1.5 }] }));
      const inputs = [], reports = [];
      for (const [month, assigned, result] of [[7, 280, 285.6], [8, 310, 306.9], [9, 295, 303.85]]) {
        const input = { source: 'pdf', round: { program: 'Chương trình Bias', provider: 'Mô phỏng', programCode: 'BIAS', unitCode: '99999', year: 2026, round: `ĐỢT 0${month}`, reportDate: `2026-0${month}-15` },
          rows: [{ code: 'GLU', instrument: machine.name, sample: 'M1', unit: 'mmol/L', result, assigned, sigmaP: assigned * .005, zProvider: (result - assigned) / (assigned * .005), peer: {} }],
          mappings: [{ code: 'GLU', instrument: machine.name, testId: assay.id }] };
        inputs.push(input); reports.push(must(await api.importEqaRound({ data: input })));
      }
      must(await api.importEqaRound({ data: { ...inputs[0], round: { ...inputs[0].round, round: 'ĐỢT 06', reportDate: '2026-06-15' } } }));
      return { assay, inputs, reports };
    });
    await openPage(page, 'Six Sigma & Sai số');
    await page.getByTitle('Nhập hoặc rà soát các vòng EQA/EQC cho mức 1', { exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Bias% cho Six Sigma', exact: true });
    const months = modal.getByRole('spinbutton', { name: 'Số tháng', exact: true });
    assert.equal(await months.inputValue(), '3');
    assert.match(await modal.innerText(), /Vòng nhập tay chỉ áp dụng cho mức 1/);
    await modal.getByRole('button', { name: 'Lấy từ ngoại kiểm', exact: true }).click();
    await modal.locator('.sg-eqa-selection').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.sg-eqa-table tbody tr').length === 3);
    assert.match(await modal.innerText(), /CV và TEa giữ riêng từng mức/);
    assert.match(await modal.innerText(), /01\/07\/2026.*30\/09\/2026/);
    assert.match(await modal.innerText(), /3\/3 tháng/);
    await months.fill('0');
    assert.equal(await modal.getByRole('button', { name: 'Lấy từ ngoại kiểm', exact: true }).isDisabled(), true);
    assert.equal(await modal.getByRole('button', { name: 'Áp dụng Bias%', exact: true }).isDisabled(), true);
    // Giữ phản hồi sáu tháng để thử đổi lựa chọn trong lúc main còn đang trả dữ liệu.
    await app.evaluate(({ ipcMain }) => {
      const original = ipcMain._invokeHandlers.get('sigma:eqaBias');
      let started;
      globalThis.__sigmaMonthsReadStarted = new Promise(resolve => { started = resolve; });
      ipcMain._invokeHandlers.set('sigma:eqaBias', (...args) => {
        if (args[4] !== 6) return original(...args);
        return new Promise(resolve => {
          globalThis.__releaseSigmaMonthsRead = () => { ipcMain._invokeHandlers.set('sigma:eqaBias', original); resolve(original(...args)); };
          started();
        });
      });
    });
    await months.fill('6');
    await modal.getByRole('button', { name: 'Lấy từ ngoại kiểm', exact: true }).click();
    await app.evaluate(() => globalThis.__sigmaMonthsReadStarted);
    await months.fill('1');
    await app.evaluate(() => globalThis.__releaseSigmaMonthsRead());
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Lấy từ ngoại kiểm' && !b.disabled));
    assert.equal(await modal.locator('.sg-eqa-table tbody tr').count(), 3, 'phản hồi sáu tháng cũ không ghi đè bản nháp khi đã chọn một tháng');
    assert.equal(await modal.locator('.sg-eqa-selection').count(), 0);
    assert.equal(await modal.getByRole('button', { name: 'Áp dụng Bias%', exact: true }).isDisabled(), true, 'không áp dụng danh sách ba tháng cho khoảng vừa đổi');
    await modal.getByRole('button', { name: 'Lấy từ ngoại kiểm', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.sg-eqa-table tbody tr').length === 1);
    assert.match(await modal.innerText(), /01\/09\/2026.*30\/09\/2026/);
    await months.fill('18');
    await modal.getByRole('button', { name: 'Lấy từ ngoại kiểm', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.sg-eqa-table tbody tr').length === 4);
    assert.match(await modal.innerText(), /01\/04\/2025/);
    await months.fill('3');
    await modal.getByRole('button', { name: 'Lấy từ ngoại kiểm', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.sg-eqa-table tbody tr').length === 3);
    await page.evaluate(async resultId => {
      const api = window.qcApi, must = r => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.data; };
      const user = await api.currentUser();
      const ev = await api.getEqaCorrectiveEvidence({ resultId, runDate: '2026-09-10' });
      const d = must(await api.createNce({ data: { source: 'eqa', eqaResultId: resultId, expectedEqaFingerprint: ev.fingerprint, eqaRunDate: ev.run_date,
        description: 'Kiểm thử căn cứ Bias thay đổi trong lúc mở hộp thoại.', correction: 'Đã đối chiếu số liệu báo cáo kiểm thử.', holdResults: false, detectedAt: '2026-09-15', ownerUserId: user.id } }));
      must(await api.updateNce({ data: { id: d.record.id, expectedVersion: d.record.row_version,
        patch: { causeStatus: 'identified', causeCategory: 'eqa_administrative', causeText: 'Đã xác định lỗi nhập số liệu báo cáo ngoại kiểm.' } } }));
    }, seed.reports[2].results[0].id);
    await modal.getByRole('button', { name: 'Áp dụng Bias%', exact: true }).click();
    const error = page.getByRole('alertdialog', { name: 'Không thể áp dụng Bias%', exact: true });
    await error.waitFor();
    assert.match(await error.innerText(), /lỗi hành chính|chương trình\/mẫu/);
    const rejected = (await page.evaluate(id => window.qcApi.listSigmaPeriods(id), seed.assay.id))[0].levels[0];
    assert.equal(rejected.biasEqa, .5); assert.deepEqual(rejected.eqaRounds, []);
    await error.getByRole('button', { name: 'Đã hiểu', exact: true }).click();
    await months.fill('6');
    await modal.getByRole('button', { name: 'Lấy từ ngoại kiểm', exact: true }).click();
    await modal.locator('.sg-eqa-selection').waitFor();
    await page.waitForFunction(() => document.querySelector('.sg-eqa-selection')?.textContent.includes('01/04/2026'));
    await modal.getByRole('button', { name: 'Áp dụng Bias%', exact: true }).click();
    await modal.waitFor({ state: 'detached' });
    const saved = (await page.evaluate(id => window.qcApi.listSigmaPeriods(id), seed.assay.id))[0];
    assert.ok(Math.abs(saved.levels[0].biasEqa - 1) < 1e-10);
    assert.ok(Math.abs(saved.levels[0].sigma.sigma - 4.5) < 1e-10);
    assert.equal(saved.levels[0].eqaRounds.length, 3);
    assert.deepEqual(saved.levels.map(l => l.eqaWindowMonths), [6, 6]);
    assert.deepEqual(saved.levels.map(l => l.cv), [2, 3]);
    assert.deepEqual(saved.levels[0].eqaRounds, saved.levels[1].eqaRounds);
    assert.ok(Math.abs(saved.levels[1].biasEqa - 1) < 1e-10);
    assert.ok(Math.abs(saved.levels[1].sigma.sigma - 3) < 1e-10);
    assert(saved.levels[0].eqaRounds.every(r => r.eqaResultId && r.label.includes('Chương trình Bias')));
    const cv = page.getByRole('spinbutton', { name: 'CV IQC mức 1', exact: true });
    await cv.fill('2.5'); await cv.blur();
    await page.waitForFunction(async id => (await window.qcApi.listSigmaPeriods(id))[0].levels[0].cv === 2.5, seed.assay.id);
    const afterCv = (await page.evaluate(id => window.qcApi.listSigmaPeriods(id), seed.assay.id))[0];
    assert.deepEqual(afterCv.levels[0].eqaRounds, saved.levels[0].eqaRounds, 'sửa CV qua UI giữ cả mã kết quả và nhãn nguồn');
    assert.equal(afterCv.levels[1].cv, 3);
    assert.deepEqual(afterCv.levels[1].eqaRounds, saved.levels[1].eqaRounds);
    assert.deepEqual(afterCv.levels.map(l => l.eqaWindowMonths), [6, 6]);
    await page.evaluate(async input => {
      const row = input.rows[0], value = row.assigned * 1.04;
      const result = await window.qcApi.importEqaRound({ data: { ...input, replaceReason: 'Báo cáo thay thế sau khi lưu Sigma.', rows: [{ ...row, result: value, zProvider: (value - row.assigned) / row.sigmaP }] } });
      if (!result.ok) throw new Error(result.error.message);
    }, seed.inputs[0]);
    await page.reload();
    await cv.waitFor();
    await cv.fill('3'); await cv.blur();
    await page.waitForFunction(async id => (await window.qcApi.listSigmaPeriods(id))[0].levels[0].cv === 3, seed.assay.id);
    assert.deepEqual((await page.evaluate(id => window.qcApi.listSigmaPeriods(id), seed.assay.id))[0].levels[0].eqaRounds, saved.levels[0].eqaRounds);
    await page.getByTitle('Nhập hoặc rà soát các vòng EQA/EQC cho mức 1', { exact: true }).click();
    assert.equal(await months.inputValue(), '6', 'mở lại giữ đúng số tháng đã áp dụng');
    assert.match(await modal.locator('.sg-eqa-table').innerText(), /Chương trình Bias/);
    await page.screenshot({ path: path.join(userDataDir, 'sigma-eqa-bias-history.png') });
    assert.deepEqual(errors, []);
    console.log(`Ảnh kiểm tra Bias ngoại kiểm: ${userDataDir}`);
  } finally { await app.close(); }
});
