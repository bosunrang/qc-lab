import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path) => readFileSync(resolve(import.meta.dirname, path), 'utf8');

test('xuất Sigma phân biệt báo cáo kỳ, bảng dữ liệu thô và so sánh các kỳ', () => {
  const page = source('../renderer/pages/SigmaPage.tsx');
  const exporter = source('../renderer/lib/sigma-summary-export.ts');

  assert.match(page, /exportSigmaReportXlsx\(\{ test, instrumentName, periods: \[period\], mode: 'period' \}\)/);
  assert.match(page, /exportSigmaReportXlsx\(\{ test, instrumentName, periods, mode: 'comparison' \}\)/);
  assert.doesNotMatch(page, /comparisonExporting|exportSummary/);
  assert.match(exporter, /BÁO CÁO THEO DÕI SIX SIGMA/);
  assert.match(exporter, /SO SÁNH CÁC KỲ/);
  assert.match(exporter, /const sheetName = onePeriod \? `Kỳ \$\{displayedPeriod\.replace\('\/', '-'\)\}` : 'So sánh các kỳ'/);
  assert.match(exporter, /Báo cáo Six Sigma - Kỳ \$\{displayedPeriod\.replace\('\/', '-'\)\}\.xlsx/);
  assert.doesNotMatch(exporter, /sheet\.autoFilter/);
  assert.match(exporter, /const REPORT_TEAL = 'FF215968'/);
  assert.match(exporter, /const SECTION_TEAL = 'FF31869B'/);
  assert.match(exporter, /size: 10, bold: true, color: \{ argb: 'FFFFFFFF' \}.*fgColor: \{ argb: SECTION_TEAL \}/);
  assert.match(exporter, /GIẢI THÍCH BẬC SIGMA/);
  assert.match(exporter, /sheet\.mergeCells\(`A\$\{legendStart\}:C\$\{legendStart\}`\)/);
  assert.match(exporter, /sheet\.mergeCells\(row, 2, row, 3\)/);
  assert.match(exporter, /sheet\.mergeCells\(4, 1, periods\.length \+ 3, 1\)/);
  assert.match(exporter, /pattern: 'none'/);
  assert.doesNotMatch(exporter, /style: 'hair'/);
  assert.match(exporter, /Mức \$\{level\}\\nBias RMS/);
  assert.match(exporter, /Mức \$\{level\}\\nYield/);
  assert.match(exporter, /function drawPeriodChart\(periods: SigmaPeriodView\[\], levels: number\[\]\)/);
  const sigmaChartRenderer = exporter.slice(exporter.indexOf('function drawPeriodChart'), exporter.indexOf('function drawMdcChart'));
  assert.doesNotMatch(sigmaChartRenderer, /strokeRect\(x, barTop, barWidth/);
  assert.match(exporter, /function drawMdcChart\(periods: SigmaPeriodView\[\], levels: number\[\]\)/);
  assert.match(exporter, /const label = `Mức \$\{level\}`/);
  assert.doesNotMatch(exporter, /Mỗi màu là một mức QC/);
  assert.match(exporter, /mdcRatios\(levelData\)/);
  assert.match(exporter, /renderScale = 4/);
  assert.match(exporter, /BIỂU ĐỒ SIGMA – SO SÁNH CÁC MỨC QC/);
  assert.match(exporter, /BIỂU ĐỒ QUYẾT ĐỊNH PHƯƠNG PHÁP \(MDC\)/);
  assert.match(exporter, /color: \{ argb: REPORT_TEAL \}/);
  assert.match(exporter, /chartRow \+= 23/);
  assert.match(exporter, /workbook\.addImage\(\{ base64: sigmaChart, extension: 'png' \}\)/);
  assert.match(exporter, /workbook\.addImage\(\{ base64: mdcChart, extension: 'png' \}\)/);
});

test('trạng thái trống Sigma dùng thông báo hệ thống và cho phép thêm kỳ khi có quyền', () => {
  const page = source('../renderer/pages/SigmaPage.tsx');

  assert.match(page, /className="empty sg-period-empty"/);
  assert.match(page, /Chưa có kỳ đánh giá/);
  assert.match(page, /Cần cấu hình ít nhất một mức QC đang vận hành trước khi thêm kỳ đánh giá/);
  assert.match(page, /Thêm kỳ đánh giá để ghi nhận CV IQC, Bias EQA\/EQC và theo dõi Sigma/);
  assert.match(page, /className="empty-actions">\s*<button className="btn teal" onClick=\{\(\) => setAddPeriodOpen\(true\)\}>\+ Thêm kỳ<\/button>/);
});


