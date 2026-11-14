import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { bootstrapAndLogin, launchApp, openPage } from './helpers.mjs';

test('In PDF hoá chất đang chọn: đủ nội dung, hai biểu đồ và dữ liệu vừa nhập', { timeout: 120_000 }, async () => {
  const { app, page, errors, userDataDir } = await launchApp();
  const output = path.join(userDataDir, 'reagent-complete.pdf');
  try {
    await bootstrapAndLogin(page);
    const selectedId = await page.evaluate(async () => {
      const api = window.qcApi;
      const selected = await api.createReagentComparison({ data: { name: 'Glucose chọn in', unit: 'mmol/L' } });
      if (!selected.ok) throw new Error(selected.error.message);
      const id = selected.data.id;
      const metadata = await api.saveReagentMetadata({ id, data: { lotOld: 'LO-CU-001', lotNew: 'LO-MOI-002', date: '2026-11-11',
        operator: 'Người thực hiện ban đầu', sampleType: 'Huyết thanh', biasTarget: 6, alpha: 0.05, coverageConfirmed: true } });
      if (!metadata.ok) throw new Error(metadata.error.message);
      const rows = Array.from({ length: 20 }, (_, i) => [String(10 + i * 5), String((10 + i * 5) * 1.01 + (i % 3) * 0.1)]);
      const saved = await api.saveReagentRows({ id, rows });
      if (!saved.ok) throw new Error(saved.error.message);
      await api.createReagentComparison({ data: { name: 'Creatinine không chọn', unit: 'µmol/L' } });
      return id;
    });
    await openPage(page, 'So sánh hoá chất');
    await page.locator('#rcSel').selectOption(selectedId);
    await page.locator('#rc-reagent').waitFor();
    await app.evaluate(({ dialog }, outputPath) => {
      // Chỉ phiên kiểm thử dùng đường dẫn tạm, không mở hộp thoại lưu của người dùng.
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: outputPath });
    }, output);
    // Bấm in trực tiếp từ ô đang sửa để kiểm tra lần lưu do blur trước click.
    await page.locator('#rc-operator').fill('Nguyễn Văn Vừa Nhập');
    await page.getByRole('button', { name: 'In PDF', exact: true }).click();
    await page.getByRole('button', { name: 'In PDF', exact: true }).waitFor();
    const bytes = await readFile(output);
    assert.ok(bytes.length > 10_000);
    const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
    const document = await task.promise;
    const texts = [];
    for (let number = 1; number <= document.numPages; number++) {
      const pdfPage = await document.getPage(number);
      texts.push((await pdfPage.getTextContent()).items.map((item) => item.str).join(' '));
    }
    const text = texts.join('\n');
    for (const expected of ['Glucose chọn in', 'LO-CU-001', 'LO-MOI-002', 'Nguyễn Văn Vừa Nhập', 'Huyết thanh', 'mmol/L',
      'Thông tin đánh giá', 'Dữ liệu đo bắt cặp', 'Kết quả thống kê', 'Phương sai', 'Passing-Bablok',
      'Tiêu chí chấp nhận', 'Kết luận:', 'Biểu đồ tương quan', 'Biểu đồ Bland-Altman', 'Bias', '1.96SD', 'PHÊ DUYỆT']) {
      assert.ok(text.includes(expected), expected);
    }
    assert.ok(!text.includes('Creatinine không chọn'));
    assert.ok(!text.includes('Người thực hiện ban đầu'));
    assert.equal(document.numPages, 3, '20 cặp: dữ liệu, thống kê/tiêu chí, rồi hai biểu đồ');
    assert.ok(texts[0].includes('Dữ liệu đo bắt cặp'));
    assert.ok(texts[1].includes('Kết quả thống kê'));
    assert.ok(texts[2].includes('Biểu đồ tương quan') && texts[2].includes('Biểu đồ Bland-Altman'));
    await task.destroy();
    assert.deepEqual(errors, []);
    if (process.env.QCLAB_REAGENT_PDF_QA_DIR) {
      await mkdir(process.env.QCLAB_REAGENT_PDF_QA_DIR, { recursive: true });
      await copyFile(output, path.join(process.env.QCLAB_REAGENT_PDF_QA_DIR, 'reagent-complete.pdf'));
    }
  } finally {
    await app.close();
  }
});
