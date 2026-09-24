import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (path) => readFileSync(resolve(import.meta.dirname, path), 'utf8');

test('In PDF kỳ Sigma có đầy đủ các bảng và biểu đồ của báo cáo', () => {
  const page = source('../renderer/pages/SigmaPage.tsx');
  const report = source('../renderer/lib/sigma-print-report.ts');

  assert.match(page, /buildSigmaPeriodPrintHtml\(\{/);
  assert.match(page, /const \[lab, template\] = await Promise\.all\(\[window\.qcApi\.getLabProfile\(\), window\.qcApi\.getReportTemplateSettings\(\)\]\);/);
  assert.match(page, /labName: lab\.name/);
  assert.match(page, /labDept: lab\.dept/);
  assert.match(page, /labAddress: lab\.address/);
  assert.match(page, /logoData: lab\.logo_data/);
  assert.match(page, /formCode: template\.formCode/);
  assert.match(page, /formVersion: template\.version/);
  assert.match(page, /pageNumbers: true/);
  assert.match(report, /Thiết lập phân tích/);
  assert.match(report, /Kết quả theo mức QC/);
  assert.match(report, /Số liệu kỳ/);
  assert.match(report, /\['Mức', 'TEa', 'Mean mục tiêu'/);
  assert.doesNotMatch(report, /TEa snapshot/);
  assert.match(report, /Thiết kế QC theo Sigma \(OPSpecs\)/);
  assert.match(report, /Độ không đảm bảo đo \(MU\)/);
  assert.match(report, /Biểu đồ Sigma &amp; MDC/);
  assert.match(report, /Sigma theo mức QC/);
  assert.match(report, /trendSvg\(\[input\.period\]\)/);
  assert.match(report, /mdcSvg\(\[input\.period\]\)/);
  assert.doesNotMatch(report, /chartPeriods/);
  assert.match(report, /mu\?\.complete \? number\(mu\.U, 4\) : '—'/);
  assert.match(report, /break-after:avoid;text-align:left/);
  assert.match(report, /overflow-wrap:anywhere;text-align:center/);
  assert.match(report, /\.setup th\{width:21%;background:#f2f7f4;text-align:left\}/);
  assert.match(report, /\.setup td\{width:29%;text-align:left\}/);
  assert.match(report, /function reportHeader/);
  assert.match(report, /Đơn vị xét nghiệm/);
  assert.match(report, /lab-detail lab-address/);
  assert.doesNotMatch(report, /labDept\.trim\(\), input\.labAddress\.trim\(\)\]\.filter/);
  assert.match(report, /function signatureBlock/);
  assert.match(report, /NGƯỜI LẬP BÁO CÁO/);
  assert.match(report, /NGƯỜI PHỤ TRÁCH/);
  assert.match(report, /PHÊ DUYỆT/);
  assert.match(report, /\.report-header\{[^}]*text-align:center/);
  assert.match(report, /class="lab-identity"/);
  assert.match(report, /\.lab-identity\{display:flex;width:fit-content;align-items:center;gap:8px;text-align:center/);
  assert.match(report, /Mã biểu mẫu: \$\{escapeHtml\(input\.formCode\)\}/);
  assert.match(report, /Phiên bản: \$\{escapeHtml\(input\.formVersion\)\}/);
  assert.match(report, /class="lab-logo"/);
  assert.match(report, /\.report-meta\{display:flex;justify-content:center/);
});

test('In PDF tổng hợp Sigma dùng bảng so sánh theo kỳ và biểu đồ toàn chuỗi', () => {
  const page = source('../renderer/pages/SigmaPage.tsx');
  const report = source('../renderer/lib/sigma-print-report.ts');

  assert.match(page, /buildSigmaComparisonPrintHtml\(\{/);
  assert.match(page, /const \[lab, template\] = await Promise\.all\(\[window\.qcApi\.getLabProfile\(\), window\.qcApi\.getReportTemplateSettings\(\)\]\);/);
  assert.match(page, /periods,/);
  assert.match(report, /export function buildSigmaComparisonPrintHtml/);
  assert.match(report, /Thiết lập báo cáo tổng hợp/);
  assert.match(report, /Kết quả theo mức QC/);
  assert.match(report, /Số liệu kỳ/);
  assert.match(report, /Thiết kế QC theo Sigma \(OPSpecs\)/);
  assert.match(report, /Độ không đảm bảo đo \(MU\)/);
  assert.match(report, /Biểu đồ Sigma &amp; MDC/);
  assert.match(report, /rowspan="\$\{group\.rows\.length\}"/);
  assert.match(report, /td\.period\{vertical-align:middle;text-align:center;font-weight:700;background:#fff\}/);
  assert.match(report, /trendSvg\(periods\)/);
  assert.match(report, /mdcSvg\(periods\)/);
  assert.match(report, /@page\{size:A4 landscape/);
  assert.match(report, /reportHeader\(input,/);
  assert.match(report, /signatureBlock\(\)/);
});


