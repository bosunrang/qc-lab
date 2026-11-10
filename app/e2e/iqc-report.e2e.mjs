// In báo cáo thật qua Electron; chỉ thay hộp thoại chọn nơi lưu trong profile
// tạm để tự kiểm PDF và bố cục, không chạm dữ liệu hay đường lưu của người dùng.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { readFileSync, statSync } from 'node:fs';
import { bootstrapAndLogin, launchApp, openPage, seedOperationalTest } from './helpers.mjs';

test('báo cáo nội kiểm: biểu đồ đúng khoảng ngày và bảng riêng từng mức trong PDF', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    const { testId } = await seedOperationalTest(page);
    await page.evaluate(async (testId) => {
      const api = window.qcApi;
      const must = (r) => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.data; };
      for (let day = 1; day <= 24; day++) for (const run of [1, 2]) for (const level of [1, 2]) {
        const date = `2026-10-${String(day).padStart(2, '0')}`;
        const val = level === 1 ? 5 + (day % 3) * 0.03 : day === 15 && run === 1 ? 17.1 : 15 + (day % 4) * 0.05;
        must(await api.addPoint({ data: { testId, level, date, runId: `${date}-${run}`, val } }));
      }
      const old = (await api.queryPoints(testId, 1)).find((point) => point.date === '2026-10-10' && point.run_id.endsWith('-2'));
      must(await api.voidPoint({ data: { pointId: old.id, reason: 'Nhập nhầm, lưu dấu vết và nhập lại đúng giá trị', kind: 'data-entry' } }));
      must(await api.addPoint({ data: { testId, level: 1, date: old.date, runId: old.run_id, val: 5.03 } }));
    }, testId);
    const pdfPath = path.join(userDataDir, 'iqc-report.pdf');
    const htmlPath = path.join(userDataDir, 'iqc-report.html');
    await app.evaluate(({ dialog, ipcMain }, paths) => {
      const fs = process.getBuiltinModule('node:fs');
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.pdfPath });
      const original = ipcMain._invokeHandlers.get('print:htmlToPdf');
      ipcMain.removeHandler('print:htmlToPdf');
      ipcMain.handle('print:htmlToPdf', async (event, input) => {
        fs.writeFileSync(paths.htmlPath, input.html, 'utf8');
        globalThis.__iqcReportResult = await original(event, input);
        return globalThis.__iqcReportResult;
      });
    }, { pdfPath, htmlPath });
    await openPage(page, 'Báo cáo & Biểu mẫu');
    await page.locator('#rStartDate').fill('05/10/2026');
    await page.locator('#rStartDate').blur();
    await page.locator('#rEndDate').fill('20/10/2026');
    await page.locator('#rEndDate').blur();
    await page.locator('#reportNceAppendix').uncheck();
    await page.getByRole('button', { name: 'In PDF', exact: true }).click();
    const result = await app.evaluate(async () => {
      const deadline = Date.now() + 30_000;
      while (!globalThis.__iqcReportResult && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
      return globalThis.__iqcReportResult;
    });
    assert.equal(result?.ok, true, JSON.stringify(result));
    assert.equal(readFileSync(pdfPath).subarray(0, 5).toString(), '%PDF-');
    assert.ok(statSync(pdfPath).size > 20_000);
    const html = readFileSync(htmlPath, 'utf8');
    const [preview] = await Promise.all([
      app.waitForEvent('window'),
      app.evaluate(async ({ BrowserWindow }, html) => {
        const preview = new BrowserWindow({ show: false, width: 1240, height: 900, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
        await preview.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      }, html),
    ]);
    await preview.waitForLoadState('load');
    await preview.locator('figure.lj img').waitFor();
    assert.equal(await preview.locator('figure.lj img').count(), 1);
    assert.equal(await preview.locator('figure.lj img').evaluate((image) => image.naturalWidth), 3300);
    const m1 = preview.locator('[data-qc-level="1"]'), m2 = preview.locator('[data-qc-level="2"]');
    assert.equal(await m1.locator('tbody tr').count(), 33);
    assert.equal(await m2.locator('tbody tr').count(), 32);
    assert.equal(await m1.locator('tr.voided').count(), 1);
    assert.equal(await m2.locator('tr.voided').count(), 0);
    for (const [table, level] of [[m1, 1], [m2, 2]]) {
      const rows = await table.locator('tbody tr').evaluateAll((rows) => rows.map((row) => [...row.cells].map((cell) => cell.textContent)));
      assert.ok(rows.every((row) => row.length === 8));
      assert.ok(rows.every((row) => level === 1 ? Number(row[3]) < 8 : Number(row[3]) > 14), 'không gộp giá trị hai mức trong cùng bảng');
      assert.ok(rows.every((row) => { const day = Number(row[0].split('/')[0]); return day >= 5 && day <= 20; }), 'không có dòng ngoài khoảng đã chọn');
      await table.locator('thead .level-heading').getByText(`Mức ${level}`, { exact: true }).waitFor();
    }
    assert.match(await m2.innerText(), /Loại bỏ.*1-3s/s);
    assert.match(await m1.innerText(), /Lần chạy bị loại ở Mức 2/);
    assert.equal(await preview.getByText('Phụ lục NCE', { exact: true }).count(), 0);
    await preview.screenshot({ path: path.join(userDataDir, 'iqc-report-preview.png'), fullPage: true });
    console.log(`PDF báo cáo nội kiểm: ${pdfPath}`);
    console.log(`HTML và ảnh kiểm tra: ${userDataDir}`);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
