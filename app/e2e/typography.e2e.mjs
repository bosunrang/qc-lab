// Thang chữ dùng chung phải đọc được trên mọi trang và không làm cắt nhãn
// trong control khi cửa sổ hẹp. Dữ liệu chỉ nằm trong phiên Electron tạm.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest } from './helpers.mjs';

test('thang chữ 14/13.5/13: các trang và nhãn control không bị cắt', { timeout: 180_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await page.setViewportSize({ width: 1680, height: 1050 });
    await bootstrapAndLogin(page);
    const seed = await seedOperationalTest(page);
    await page.evaluate(async ({ testId, instrumentId }) => {
      const api = window.qcApi, must = r => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.data; };
      must(await api.saveSigmaTeaConfig({ testId, source: 'eflm', tea: 10, eflmAnalyte: 'Glucose', eflmLookupDate: '2026-11-01', eflmRef: 'Nguồn kiểm thử giao diện' }));
      for (const period of ['2026-10', '2026-11']) must(await api.saveSigmaPeriod({ testId, period, teaSource: 'eflm', tea: 10,
        levels: [{ level: 1, cv: 1.2, biasEqa: .5 }, { level: 2, cv: 1.5, biasEqa: .8 }] }));
      const machine = (await api.listInstruments()).find(i => i.id === instrumentId);
      for (const month of [9, 10, 11]) must(await api.importEqaRound({ data: { source: 'pdf',
        round: { program: 'Chương trình ngoại kiểm Sinh hoá có tên dài để kiểm tra xuống dòng và dấu tiếng Việt', provider: 'Dữ liệu kiểm thử', year: 2026, round: `ĐỢT ${month}`, reportDate: `2026-${String(month).padStart(2, '0')}-16` },
        rows: [{ code: 'GLU', instrument: machine.name, sample: `Mẫu thử ${month}`, result: 5.05, assigned: 5, sigmaP: .1, zProvider: .5, unit: 'mmol/L', peer: {} }],
        mappings: [{ code: 'GLU', instrument: machine.name, testId }] } }));
    }, seed);
    const labels = (await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link').allInnerTexts()).map(s => s.trim());
    const clipped = [];
    for (const width of [1680, 1366, 1050]) {
      await page.setViewportSize({ width, height: 1050 });
      for (const label of labels) {
        await openPage(page, label);
        await page.locator('main .head').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(120);
        const result = await page.evaluate(() => {
          const flat = token => getComputedStyle(document.body).getPropertyValue(token).trim();
          const problems = [];
          for (const el of document.querySelectorAll('label, th, button.btn, .hint, .meta, .hint-inline, .sg-level-source, .cell-missing, nav a')) {
            const rect = (el.matches('.cell-missing') ? el.closest('td') : el).getBoundingClientRect(), style = getComputedStyle(el);
            if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight || style.visibility === 'hidden') continue;
            if (style.textOverflow === 'ellipsis' || el.closest('.sr-only') || el.querySelector('input,select,textarea')) continue;
            const textNodes = [...el.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
            for (const node of textNodes) {
              const range = document.createRange(); range.selectNodeContents(node);
              for (const ink of range.getClientRects()) {
                if (ink.left < rect.left - 1 || ink.right > rect.right + 1 || ink.top < rect.top - 1 || ink.bottom > rect.bottom + 1)
                  problems.push({ selector: el.className || el.tagName, text: node.textContent.trim(), box: [rect.width, rect.height], textBox: [ink.width, ink.height] });
              }
            }
          }
          return { body: getComputedStyle(document.body).fontSize, table: flat('--table-body-size'), label: flat('--text-sm'), caption: flat('--text-xs'), problems };
        });
        assert.equal(result.body, '14px');
        assert.equal(result.label, '13.5px');
        assert.equal(result.caption, '13px');
        clipped.push(...result.problems.map(problem => ({ width, page: label, ...problem })));
        if (['Nhập QC & Biểu đồ', 'Six Sigma & Sai số', 'Cấu hình chung'].includes(label) && width !== 1050)
          await page.screenshot({ path: path.join(userDataDir, `type-${width}-${label.startsWith('Six') ? 'sigma' : label.startsWith('Cấu') ? 'manage' : 'entry'}.png`) });
      }
    }
    await page.setViewportSize({ width: 1366, height: 1050 });
    await openPage(page, 'Six Sigma & Sai số');
    const divider = page.getByRole('separator', { name: 'Độ rộng danh sách kỳ Sigma', exact: true });
    await divider.focus(); await divider.press('Home');
    const filters = await page.locator('.sg-period-history-filter select').evaluateAll(fields => fields.map(field => {
      const style = getComputedStyle(field), icon = getComputedStyle(field, '::picker-icon');
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return { size: style.fontSize, height: field.getBoundingClientRect().height,
        text: ctx.measureText(field.selectedOptions[0].textContent).width,
        available: field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - parseFloat(icon.width) - parseFloat(icon.marginLeft) };
    }));
    assert.ok(filters.every(field => field.size === '13.5px' && field.height === 32 && field.text <= field.available), 'khung hẹp nhất vẫn đọc đủ nhãn kỳ/năm và giữ control 32px');
    await page.getByTitle('Nhập hoặc rà soát các vòng EQA/EQC cho mức 1', { exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Bias% cho Six Sigma', exact: true });
    await modal.getByRole('button', { name: 'Lấy từ ngoại kiểm', exact: true }).click();
    await modal.locator('.sg-eqa-selection').waitFor();
    const sourceCells = await modal.locator('.sg-eqa-label').evaluateAll(cells => cells.map(cell => ({
      size: getComputedStyle(cell).fontSize, full: cell.scrollHeight, visible: cell.clientHeight,
    })));
    assert.equal(sourceCells.length, 3);
    assert.ok(sourceCells.every(cell => cell.size === '13.5px' && cell.full <= cell.visible + 1), 'nguồn ngoại kiểm dài xuống dòng đủ, không cắt chữ');
    assert.equal(await modal.locator('.sg-eqa-summary span').first().evaluate(el => getComputedStyle(el).fontSize), '13px');
    await modal.screenshot({ path: path.join(userDataDir, 'type-bias-long-source.png') });
    assert.deepEqual(clipped, [], JSON.stringify(clipped, null, 2));
    assert.deepEqual(errors, []);
    console.log(`Ảnh rà soát thang chữ: ${userDataDir}`);
  } finally { await app.close(); }
});
