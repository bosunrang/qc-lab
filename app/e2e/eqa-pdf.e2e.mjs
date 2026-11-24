// pdf.js phải chạy được trong renderer đã đóng gói (CSP chỉ cho script cùng
// nguồn, không Web Worker). Bộ đọc báo cáo đã có test trên dữ liệu thật ở
// `app/tests/eqa-pdf.test.mjs`; ca này chỉ chứng minh file PDF thật sự được
// pdf.js mở và trích chữ trên Electron: một PDF tối giản tự dựng có trang
// "THONG SO" nhưng thiếu σp, nên bộ đọc phải báo đúng mã thông số đọc được.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

const RIQAS = JSON.parse(readFileSync(new URL('../tests/fixtures/riqas-mc-cycle23-sample7.json', import.meta.url), 'utf8'));

/** PDF 1 trang, chữ ASCII bằng phông Helvetica có sẵn, đúng bảng xref. */
function minimalPdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const content = lines.map(([x, y, text]) => `BT /F1 10 Tf ${x} ${y} Td (${esc(text)}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => { const at = Buffer.byteLength(body); body += `${i + 1} 0 obj\n${object}\nendobj\n`; return at; });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

test('nhập báo cáo PDF: pdf.js mở file và trích chữ trong app đóng gói', { timeout: 120_000 }, async () => {
  const { app, page, errors } = await launchApp();
  try {
    await bootstrapAndLogin(page);
    await openPage(page, 'Phân tích ngoại kiểm');
    await page.getByRole('button', { name: 'Nhập báo cáo PDF' }).first().click();
    const modal = page.locator('.modal[role=dialog]', { hasText: 'Nhập báo cáo ngoại kiểm' });
    await modal.locator('#eqaFile').setInputFiles({
      name: 'VEQAS_TEST_01_01-01_10026_May thu.pdf', mimeType: 'application/pdf',
      buffer: minimalPdf([[27, 754, 'THONG SO:'], [84, 754, 'Glucose (GLUC) mmol/L'], [488, 754, 'Ma don vi: 10026'], [49, 639, 'Ket qua don vi:'], [230, 639, '15.240']]),
    });
    const alert = modal.locator('.alert.rej');
    await alert.waitFor();
    const text = await alert.innerText();
    assert.match(text, /GLUC/, `pdf.js phải trích được chữ của trang thông số: ${text}`);
    assert.doesNotMatch(text, /không đọc được file PDF/);
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});

/** PDF nhiều trang dựng lại từ lớp chữ của báo cáo RIQAS thật, đổi số sample. */
function riqasPdf(sample) {
  const esc = (t) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids = [];
  for (const page of RIQAS.pages) {
    const content = page.map((item) => `BT /F1 9 Tf ${item.x} ${item.y} Td (${esc(item.str.replace('SAMPLE 7', `SAMPLE ${sample}`))}) Tj ET`).join('\n');
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${objects.length} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`);
    kids.push(`${objects.length} 0 R`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => { const at = Buffer.byteLength(body); body += `${i + 1} 0 obj\n${object}\nendobj\n`; return at; });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

test('nhập nhiều đợt một lần: ánh xạ ở đợt đầu, các đợt sau nhập hàng loạt', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await bootstrapAndLogin(page);
    await page.evaluate(async () => {
      const must = (r) => { if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.data; };
      const machine = must(await window.qcApi.saveInstrument({ data: { name: 'EasyLyte Plus' } }));
      for (const name of ['Chloride', 'Potassium', 'Sodium']) must(await window.qcApi.saveTest({ data: { name, instrumentId: machine.id, unit: 'mmol/L' } }));
      for (let i = 1; i <= 20; i++) must(await window.qcApi.saveTest({ data: { name: `Xét nghiệm bổ sung ${String(i).padStart(2, '0')}`, instrumentId: machine.id, unit: 'mmol/L' } }));
    });
    await openPage(page, 'Phân tích ngoại kiểm');
    await page.locator('.eqa-scope-controls').getByRole('button', { name: 'Nhập báo cáo PDF', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Nhập báo cáo ngoại kiểm' });
    await modal.locator('#eqaFile').setInputFiles([1, 2, 3].map((n) => ({ name: `RIQAS_C23_S${n}.pdf`, mimeType: 'application/pdf', buffer: riqasPdf(n) })));
    await modal.getByText('3 tệp thuộc 3 đợt', { exact: false }).waitFor();
    const files = modal.getByRole('region', { name: 'Danh sách báo cáo PDF đã đọc', exact: true });
    const assertColumns = async () => {
      const layout = await files.evaluate(el => {
        const table = el.querySelector('table').getBoundingClientRect();
        const cells = [...el.querySelectorAll('tbody tr:first-child td')].map(cell => cell.getBoundingClientRect());
        const headersFit = [...el.querySelectorAll('th')].every(th => {
          const range = document.createRange(); range.selectNodeContents(th);
          const style = getComputedStyle(th), available = th.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
          return range.getClientRects().length === 1 && range.getBoundingClientRect().width <= available + 1;
        });
        return { count: cells.length, machine: cells[6].width, status: cells[7].width,
          headersFit,
          inside: cells.every(cell => cell.left >= table.left - 1 && cell.right <= table.right + 1),
          wrapperFits: el.getBoundingClientRect().right <= el.closest('.modal-b').getBoundingClientRect().right };
      });
      assert.equal(layout.count, 8);
      assert(layout.machine >= 175, 'ô chọn máy có đủ chiều rộng');
      assert(layout.status >= 85, 'trạng thái đọc tệp không bị mất');
      assert(layout.inside && layout.wrapperFits);
      assert(layout.headersFit, 'tiêu đề cả tám cột nằm trên một dòng và không bị cắt');
    };
    await assertColumns();
    assert(await files.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'bảng vừa khung ở kích thước modal đầy đủ');
    await modal.screenshot({ path: path.join(userDataDir, 'eqa-pdf-columns.png') });
    await page.setViewportSize({ width: 1024, height: 800 });
    await assertColumns();
    assert(await files.evaluate(el => el.scrollWidth > el.clientWidth), 'bảng cuộn ngang ở cửa sổ nhỏ');
    await files.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    assert(await files.getByText('Đọc được', { exact: true }).first().isVisible());
    await files.evaluate(el => { el.scrollLeft = 0; });
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const n of [1, 2, 3]) await modal.getByRole('combobox', { name: `Máy của PXN cho RIQAS_C23_S${n}.pdf` }).selectOption({ label: 'EasyLyte Plus' });
    await modal.getByRole('button', { name: 'Kiểm tra 3 đợt', exact: true }).click();
    // Lần đầu gặp mã thông số: cả ba đợt chờ ánh xạ; ánh xạ ở đợt đầu rồi ghi.
    await modal.getByText('Cần xem trước', { exact: true }).nth(2).waitFor();
    await modal.getByRole('button', { name: 'Xem trước', exact: true }).first().click();
    // Danh sách ở hàng cuối phải vượt mép bảng và cuộn tới lựa chọn cuối.
    const mapping = modal.getByRole('region', { name: 'Ánh xạ xét nghiệm', exact: true });
    const picker = mapping.getByRole('combobox').last();
    const originalLabel = await picker.inputValue();
    for (const viewport of [{ width: 1280, height: 900 }, { width: 1024, height: 720 }]) {
      await page.setViewportSize(viewport);
      await picker.click();
      const menu = mapping.getByRole('listbox');
      await menu.waitFor();
      const unclipped = await menu.evaluate(el => {
        const box = el.getBoundingClientRect();
        const table = el.closest('table').getBoundingClientRect();
        const body = el.closest('.modal-b').getBoundingClientRect();
        const x = box.left + box.width / 2;
        const y = Math.min(box.bottom - 8, body.bottom - 8);
        return { extendsTable: y > table.bottom, receivesPointer: el.contains(document.elementFromPoint(x, y)) };
      });
      assert(unclipped.extendsTable && unclipped.receivesPointer, 'danh sách nhận được chuột ở phần vượt khỏi bảng');
      await menu.hover();
      await page.mouse.wheel(0, 600);
      await page.waitForFunction(id => document.getElementById(id)?.scrollTop > 0, await menu.getAttribute('id'));
      const lastChoice = menu.getByRole('option').last();
      const lastLabel = await lastChoice.locator('span').innerText();
      await modal.screenshot({ path: path.join(userDataDir, `eqa-mapping-scroll-${viewport.width}.png`) });
      await lastChoice.click();
      assert.equal(await picker.inputValue(), lastLabel, 'chọn được xét nghiệm cuối sau khi cuộn');
      await picker.click();
      assert.equal(await picker.evaluate(el => el.selectionStart === 0 && el.selectionEnd === el.value.length), true);
      await picker.locator('..').getByRole('button', { name: 'Xoá nội dung tìm kiếm xét nghiệm', exact: true }).click();
      assert.equal(await picker.inputValue(), '');
      await picker.press('Escape');
      assert.equal(await picker.inputValue(), lastLabel, 'xoá nội dung tìm rồi huỷ không mất ánh xạ đã chọn');
      await picker.fill(originalLabel);
      await mapping.getByRole('option').filter({ hasText: originalLabel }).first().click();
    }
    await modal.getByRole('button', { name: 'Ghi đợt ngoại kiểm', exact: true }).click({ timeout: 20_000 });
    // Quay về danh sách: hai đợt còn lại dùng ánh xạ vừa lưu nên đã sẵn sàng.
    await modal.getByRole('button', { name: 'Nhập 2 đợt sẵn sàng', exact: true }).click();
    await modal.getByRole('button', { name: 'Xong', exact: true }).waitFor();
    assert.equal(await modal.getByText('Đã nhập', { exact: true }).count(), 3);
    const sources = await page.evaluate(async () => {
      const views = await Promise.all((await window.qcApi.listEqaRounds()).map((r) => window.qcApi.getEqaRound(r.id)));
      return views.flatMap((view) => view.decisions.filter((d) => d.type === 'import').flatMap((d) => JSON.parse(d.payload_json).sourceFiles || []));
    });
    assert.equal(sources.length, 3, 'mỗi báo cáo PDF giữ mã băm của đúng tệp gốc');
    for (const file of sources) {
      const sample = Number(file.fileName.match(/_S(\d+)\.pdf$/)[1]);
      assert.equal(file.sha256, createHash('sha256').update(riqasPdf(sample)).digest('hex'));
      assert.equal(file.creationDate, '', 'không tự đoán ngày tạo khi PDF không có siêu dữ liệu');
    }
    const rounds = await page.evaluate(() => window.qcApi.listEqaRounds());
    assert.deepEqual(rounds.map((r) => r.round).sort(), ['CYCLE 23 SAMPLE 1', 'CYCLE 23 SAMPLE 2', 'CYCLE 23 SAMPLE 3']);
    assert.deepEqual(errors, []);
    console.log(`Ảnh kiểm tra bảng nhập PDF: ${userDataDir}`);
  } finally {
    await app.close();
  }
});

