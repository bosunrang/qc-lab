// Tên sheet Excel lấy từ tên xét nghiệm phải được làm sạch: Excel từ chối
// `/ \ * ? : [ ]`, nháy đơn ở hai đầu và tên dài quá 31 ký tự.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { safeSheetName } = require('../../app-dist/main/domain/xlsx-sheet-name.js');
const { buildXlsxBase64 } = require('../../app-dist/main/ipc/export-handlers.js');

test('ký tự cấm được thay, tên rỗng dùng tên mặc định, cắt 31 ký tự', () => {
  assert.equal(safeSheetName('PT/INR'), 'PT-INR');
  assert.equal(safeSheetName('HbA1c [NGSP]'), 'HbA1c -NGSP-');
  assert.equal(safeSheetName("'Na:K*?'"), 'Na-K--');
  assert.equal(safeSheetName('   '), 'Sheet1');
  assert.equal(safeSheetName('A'.repeat(40)).length, 31);
});

test('xuất Excel không lỗi với tên xét nghiệm có ký tự cấm', async () => {
  const base64 = await buildXlsxBase64({ sheetName: 'PT/INR [giây]', headers: ['Ngày'], rows: [['01/09/2026']] });
  assert.ok(base64.length > 100);
});
