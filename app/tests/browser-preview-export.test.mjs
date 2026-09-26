import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path) => readFileSync(resolve(import.meta.dirname, path), 'utf8');

test('bản xem trước xuất Excel và gọi hộp in PDF thay vì chặn', () => {
  const api = source('../renderer/browser-mock/real-api.ts');
  const exporter = source('../renderer/lib/browser-export.ts');

  assert.match(api, /exportTableXlsx: exportTableXlsxInBrowser,/);
  assert.match(api, /printHtmlToPdf: \(\{ html \}\) => printHtmlToPdfInBrowser\(html\)/);
  assert.doesNotMatch(api, /exportTableXlsx: async \(\) => notAvailable\(\)/);
  assert.match(exporter, /new ExcelJS\.Workbook\(\)/);
  assert.match(exporter, /workbook\.xlsx\.writeBuffer\(\)/);
  assert.match(exporter, /target\.print\(\)/);
});



test('máy trạm LAN xuất Excel và in PDF bằng trình duyệt của nó, không gọi máy chính', () => {
  // `exportTableXlsx`/`printHtmlToPdf` là `lan: false` (mở hộp thoại lưu tệp
  // của máy chính); gửi qua `/api/rpc` thì chắc chắn bị từ chối.
  const lan = source('../renderer/lan/http-api.ts');
  assert.match(lan, /from '\.\.\/lib\/browser-export'/);
  assert.match(lan, /if \(property === 'exportTableXlsx'\) return exportTableXlsxInBrowser;/);
  assert.match(lan, /if \(property === 'printHtmlToPdf'\) return \(\{ html \}: \{ html: string \}\) => printHtmlToPdfInBrowser\(html\);/);
});
