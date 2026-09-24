// Giai đoạn C1: kiểm chứng buildXlsxBase64() tạo ra file .xlsx THẬT (đọc lại
// bằng chính exceljs để xác nhận header/hàng đúng, không chỉ kiểm tra chuỗi
// base64 không rỗng). printHtmlToPdf() cần BrowserWindow thật (Electron),
// không test được ở Node thuần — đã xác nhận qua Playwright `_electron` tạm
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const exportHandlerSource = require('node:fs').readFileSync(new URL('../../app/main/ipc/export-handlers.ts', import.meta.url), 'utf8');
assert.match(exportHandlerSource, /displayHeaderFooter: pageNumbers/);
assert.match(exportHandlerSource, /class="pageNumber"/);
assert.match(exportHandlerSource, /class="totalPages"/);

const { buildXlsxBase64 } = require('../../app-dist/main/ipc/export-handlers.js');
const ExcelJS = require('exceljs');

const base64 = await buildXlsxBase64({
  sheetName: 'Báo cáo test',
  headers: ['Ngày', 'Giá trị'],
  rows: [['2026-01-01', 5.5], ['2026-01-02', 5.6]],
});
assert.ok(base64.length > 0, 'phải trả về chuỗi base64 không rỗng');

const buffer = Buffer.from(base64, 'base64');
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(buffer);
const sheet = workbook.worksheets[0];
assert.equal(sheet.name, 'Báo cáo test');
assert.deepEqual(sheet.getRow(1).values.slice(1), ['Ngày', 'Giá trị']);
assert.deepEqual(sheet.getRow(2).values.slice(1), ['2026-01-01', 5.5]);
assert.deepEqual(sheet.getRow(3).values.slice(1), ['2026-01-02', 5.6]);

// Tên sheet quá 31 ký tự (giới hạn thật của định dạng Excel) phải bị cắt,
// không được để exceljs tự ném lỗi khi ghi.
const longName = await buildXlsxBase64({ sheetName: 'X'.repeat(50), headers: ['A'], rows: [[1]] });
const wb2 = new ExcelJS.Workbook();
await wb2.xlsx.load(Buffer.from(longName, 'base64'));
assert.ok(wb2.worksheets[0].name.length <= 31);

console.log('app export-handlers oracle tests passed');


