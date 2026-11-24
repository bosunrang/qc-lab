// Lưu ý phải nhìn thấy từ chuỗi xét nghiệm, trước khi mở chi tiết đợt.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp } from './helpers.mjs';

test('ngoại kiểm: nhãn Có lưu ý và Cần xem nhất quán giữa chuỗi xét nghiệm và đợt', { timeout: 90_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const scope = await page.evaluate(async () => {
      const api = window.qcApi, must = r => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.data; };
      const machine = must(await api.saveInstrument({ data: { name: 'Máy rà soát lưu ý' } }));
      const assay = must(await api.saveTest({ data: { name: 'Oxygen partial pressure (pO2)', instrumentId: machine.id, unit: 'mmHg' } }));
      let programId;
      for (const [month, z, peer] of [[1, 1, {}], [2, 1, { instrument: { n: 17, mean: 100, sd: 1, cv: 1 } }], [3, .5, {}]]) {
        const view = must(await api.importEqaRound({ data: { source: 'pdf',
          round: { program: 'Ngoại kiểm khí máu', provider: 'Kiểm thử', programCode: 'BG', unitCode: 'TEST', year: 2026, round: `ĐỢT 0${month}`, reportDate: `2026-0${month}-20` },
          rows: [{ code: 'pO2', instrument: machine.name, result: 101, assigned: 100, sigmaP: 1, zProvider: z, sample: 'A', unit: 'mmHg', peer }],
          mappings: [{ code: 'pO2', instrument: machine.name, testId: assay.id }] } }));
        programId = view.round.program_id;
      }
      return { test: assay.id, machine: machine.id, program: programId, year: '2026' };
    });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.evaluate(scope => { location.hash = '/eqa?' + new URLSearchParams(scope); }, scope);
    const results = page.getByRole('region', { name: 'Kết quả từng đợt', exact: true });
    const rows = results.locator('tbody > tr');
    await rows.nth(2).waitFor();
    assert.equal(await results.getByText('Có lưu ý', { exact: true }).count(), 2);
    assert.equal(await rows.getByText('Chấp nhận', { exact: true }).count(), 3);
    const uncertain = rows.filter({ hasText: 'ĐỢT 02 / 2026' });
    assert.match(await uncertain.getByText('Có lưu ý', { exact: true }).getAttribute('title'), /N = 17/);
    const filter = results.getByRole('combobox', { name: 'Lọc kết quả từng đợt theo đánh giá' });
    await filter.selectOption('attention');
    assert.equal(await rows.count(), 2, 'Cần xem giữ mẫu có lưu ý dù xếp loại chấp nhận');
    await filter.selectOption('ok');
    assert.equal(await rows.count(), 3);
    await filter.selectOption('warn');
    await results.getByText('Không có kết quả phù hợp bộ lọc', { exact: true }).waitFor();
    await filter.selectOption('attention');
    for (const width of [1600, 900]) {
      await page.setViewportSize({ width, height: 1000 });
      await results.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(userDataDir, `eqa-result-notes-${width}.png`) });
    }
    await uncertain.getByRole('button', { name: 'Mở đợt báo cáo', exact: true }).click();
    const roundResults = page.getByRole('region', { name: 'Kết quả ngoại kiểm', exact: true });
    await roundResults.getByText('Có lưu ý', { exact: true }).waitFor();
    await roundResults.locator('tbody > tr').getByText('Chấp nhận', { exact: true }).waitFor();
    await roundResults.getByRole('button', { name: 'Thu gọn', exact: true }).waitFor();
    await roundResults.locator('.eqa-detail-notes').getByText(/N = 17/).waitFor();
    assert.deepEqual(errors, []);
    console.log('Ảnh lưu ý ở chuỗi xét nghiệm: ' + userDataDir);
  } finally { await app.close(); }
});
