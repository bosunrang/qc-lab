// pdf.js phải chạy được trong renderer đã đóng gói (CSP chỉ cho script cùng
// nguồn, không Web Worker). Bộ đọc báo cáo đã có test trên dữ liệu thật ở
// `app/tests/eqa-pdf.test.mjs`; ca này chỉ chứng minh file PDF thật sự được
// pdf.js mở và trích chữ trên Electron: một PDF tối giản tự dựng có trang
// "THONG SO" nhưng thiếu σp, nên bộ đọc phải báo đúng mã thông số đọc được.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

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
    const modal = page.locator('.modal[role=dialog]', { hasText: 'Nhập báo cáo PDF' });
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
