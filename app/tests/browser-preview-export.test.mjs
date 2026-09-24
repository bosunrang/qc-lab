import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path) => readFileSync(resolve(import.meta.dirname, path), 'utf8');

test('bản xem trước xuất Excel và gọi hộp in PDF thay vì chặn', () => {
  const api = source('../renderer/browser-mock/real-api.ts');
  const exporter = source('../renderer/browser-mock/browser-export.ts');

  assert.match(api, /exportTableXlsx: exportTableXlsxInBrowser,/);
  assert.match(api, /printHtmlToPdf: \(\{ html \}\) => printHtmlToPdfInBrowser\(html\)/);
  assert.doesNotMatch(api, /exportTableXlsx: async \(\) => notAvailable\(\)/);
  assert.match(exporter, /new ExcelJS\.Workbook\(\)/);
  assert.match(exporter, /workbook\.xlsx\.writeBuffer\(\)/);
  assert.match(exporter, /target\.print\(\)/);
});


