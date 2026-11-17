import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { registerHooks } from 'node:module';

// Mã renderer import tương đối không ghi đuôi (Vite tự nối `.ts`). Để dựng
// HTML bản in thật trong Node, thử thêm `.ts` khi import tương đối không có đuôi.
registerHooks({
  resolve(specifier, context, next) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try { return next(`${specifier}.ts`, context); } catch { /* rơi về cách tìm mặc định */ }
    }
    return next(specifier, context);
  },
});

const source = (path) => readFileSync(resolve(import.meta.dirname, path), 'utf8');
const LOAD_IDENTITY = /const identity = await loadPrintIdentity\('sigma'\);/;

test('In PDF kỳ Sigma có đầy đủ các bảng và biểu đồ của báo cáo', () => {
  const page = source('../renderer/pages/SigmaPage.tsx');
  const report = source('../renderer/lib/sigma-print-report.ts');
  // Phần đầu biểu mẫu, khu vực ký và CSS của chúng dùng chung với các PDF khác.
  const doc = source('../renderer/lib/print-document.ts');

  assert.match(page, /buildSigmaPeriodPrintHtml\(\{/);
  assert.match(page, LOAD_IDENTITY);
  assert.match(page, /\.\.\.identity,/);
  assert.match(doc, /const \[lab, templates\] = await Promise\.all\(\[window\.qcApi\.getLabProfile\(\), window\.qcApi\.getReportTemplateSettings\(\)\]\);/);
  assert.match(doc, /labName: lab\.name, labDept: lab\.dept, labAddress: lab\.address, logoData: lab\.logo_data, form: templates\[kind\]/);
  assert.match(page, /pageNumbers: true/);
  assert.match(report, /Thiết lập phân tích/);
  assert.match(report, /Kết quả theo mức QC/);
  assert.match(report, /Số liệu kỳ/);
  assert.match(report, /\['Mức', 'TEa', 'Mean mục tiêu'/);
  assert.doesNotMatch(report, /TEa snapshot/);
  assert.match(report, /Thiết kế QC theo Westgard Sigma Rules/);
  assert.match(report, /Độ không đảm bảo đo \(MU\)/);
  assert.match(report, /Biểu đồ Sigma &amp; MDC/);
  assert.match(report, /chartsSection\(\[input\.period\]\)/);
  // Biểu đồ dùng đúng hàm vẽ của bản Excel, không còn bản vẽ SVG riêng.
  assert.match(report, /drawPeriodChart\(periods, levels\)/);
  assert.match(report, /drawMdcChart\(periods, levels\)/);
  assert.doesNotMatch(report, /function trendSvg|function mdcSvg/);
  assert.doesNotMatch(report, /chartPeriods/);
  assert.match(report, /mu\?\.complete \? number\(mu\.U, 4\) : '—'/);
  assert.match(report, /break-after:avoid;text-align:left/);
  assert.match(report, /overflow-wrap:anywhere;text-align:center/);
  assert.match(report, /\.setup th\{width:21%;background:#f2f7f4;text-align:left\}/);
  assert.match(report, /\.setup td\{width:29%;text-align:left\}/);
  assert.match(report, /function reportHeader/);
  assert.match(report, /\$\{DOCUMENT_CSS\}/);
  assert.match(report, /\$\{signatureBlock\(\)\}/);
  assert.match(doc, /Đơn vị xét nghiệm/);
  assert.match(doc, /lab-detail lab-address/);
  assert.match(doc, /export function signatureBlock/);
  assert.match(doc, /NGƯỜI LẬP BÁO CÁO/);
  assert.match(doc, /NGƯỜI PHỤ TRÁCH/);
  assert.match(doc, /PHÊ DUYỆT/);
  assert.match(doc, /\.report-header\{[^}]*text-align:center/);
  assert.match(doc, /class="lab-identity"/);
  assert.match(doc, /\.lab-identity\{display:flex;width:fit-content;align-items:center;gap:8px;text-align:center/);
  assert.match(doc, /`Mã biểu mẫu: \$\{escapeHtml\(formCode\)\}`, `Phiên bản: \$\{escapeHtml\(version\)\}`/);
  assert.match(doc, /Ngày hiệu lực: /);
  assert.match(doc, /class="lab-logo"/);
  assert.match(doc, /\.report-meta\{display:flex;justify-content:center/);
});

test('In PDF tổng hợp Sigma dùng bảng so sánh theo kỳ và biểu đồ toàn chuỗi', () => {
  const page = source('../renderer/pages/SigmaPage.tsx');
  const report = source('../renderer/lib/sigma-print-report.ts');

  assert.match(page, /buildSigmaComparisonPrintHtml\(\{/);
  assert.match(page, LOAD_IDENTITY);
  assert.match(page, /periods,/);
  assert.match(report, /export function buildSigmaComparisonPrintHtml/);
  assert.match(report, /Thiết lập báo cáo tổng hợp/);
  assert.match(report, /Kết quả theo mức QC/);
  assert.match(report, /Số liệu kỳ/);
  assert.match(report, /Thiết kế QC theo Westgard Sigma Rules/);
  assert.match(report, /Độ không đảm bảo đo \(MU\)/);
  assert.match(report, /Biểu đồ Sigma &amp; MDC/);
  assert.match(report, /rowspan="\$\{group\.rows\.length\}"/);
  assert.match(report, /td\.period\{text-align:center;font-weight:700;background:#fff\}/);
  assert.match(report, /chartsSection\(periods\)/);
  assert.match(report, /@page\{size:A4 landscape/);
  assert.match(report, /reportHeader\(input,/);
  assert.match(report, /signatureBlock\(\)/);
});



// Kỳ giả lập đủ trường mà bản in đọc tới; không có `document` nên hai biểu
// đồ rơi về dòng "chưa có dữ liệu" thay vì ảnh.
function fakePeriod(period, sigmas, tea = 0.73) {
  return {
    period, tea, levels: sigmas.map((sigma, index) => ({
      level: index + 1, tea, cv: 0.3, biasEqa: 0.01, targetMean: 140, eqaRounds: [], mu: null, cvSource: 'manual',
      sigma: sigma == null ? null : { sigma, dpmo: 1000, yieldPercent: 99.9 }, qualityDesign: null,
    })),
  };
}
const IDENTITY = { labName: 'Phòng xét nghiệm', labDept: '', labAddress: '', logoData: '', form: { formCode: 'BM-SS-01', version: '1.0', effectiveDate: '' } };

test('PDF Sigma theo bố cục Excel: bảng tổng hợp tô bậc, giải thích bậc, phụ lục sau biểu đồ', async () => {
  const { buildSigmaComparisonPrintHtml, buildSigmaPeriodPrintHtml } = await import('../renderer/lib/sigma-print-report.ts');
  const html = buildSigmaComparisonPrintHtml({ ...IDENTITY, title: 'Tổng hợp', testName: 'Sodium (Na)', unit: 'mmol/L', instrumentName: 'EasyLyte', periods: [fakePeriod('2026-11', [2.14, 3.13])] });
  // Ô Sigma và Xếp loại tô cùng màu với bản Excel (`zone()`).
  assert.match(html, /style="background:#D9776B;color:#5A1712">2,14<\/td><td class="grade" style="background:#D9776B;color:#5A1712">Không đạt</);
  assert.match(html, /style="background:#F2C96D;color:#543B00">3,13</);
  assert.match(html, /<th colspan="7" class="lv-start">Mức 1<\/th><th colspan="7" class="lv-start">Mức 2<\/th>/);
  assert.match(html, /<td>11\/2026<\/td><td>0,73<\/td>/, 'cột Kỳ và TEa như Excel');
  // Số theo chuẩn Việt Nam: chấm hàng nghìn, phẩy thập phân (DPMO 1000 → "1.000").
  assert.match(html, /<td>1\.000<\/td><td>99,90<\/td>/);
  assert.doesNotMatch(html, /\d,\d{3}<\/td>/, 'không còn dấu phẩy hàng nghìn kiểu Mỹ');
  // Ba phụ lục cùng một cỡ chữ.
  assert.equal(html.match(/<table class="appx">/g)?.length, 3);
  assert.match(html, /Giải thích bậc Sigma[\s\S]*Đẳng cấp thế giới[\s\S]*Sigma ≥ 6[\s\S]*Không đạt[\s\S]*Sigma &lt; 3/);
  // Thứ tự: tổng hợp → biểu đồ → phụ lục.
  const order = ['Kết quả theo mức QC', 'Biểu đồ Sigma &amp; MDC', 'Phụ lục A. Số liệu kỳ', 'Phụ lục B.', 'Phụ lục C.'].map((label) => html.indexOf(label));
  assert.ok(order.every((index, i) => index > 0 && (i === 0 || index > order[i - 1])), order.join(','));
  // Tông xanh nhạt như PDF Westgard, không còn dải tiêu đề đậm chữ trắng.
  assert.match(html, /th\{background:#e9f1f2;font-weight:700\}/);
  assert.doesNotMatch(html, /color:#fff;background:#31869b/);

  const single = buildSigmaPeriodPrintHtml({ ...IDENTITY, title: 'Kỳ', testName: 'Na', unit: '', instrumentName: '', teaSource: 'Ricos', teaCriterion: '', period: fakePeriod('2026-11', [null]) });
  assert.match(single, /class="grade" style="background:#F2F7F4;color:#506674">Chưa đủ dữ liệu</);
  assert.equal(single.match(/<table class="appx">/g)?.length, 3);
  assert.match(single, /<td>140<\/td>/, 'Mean mục tiêu không in số 0 thừa');
});

test('PDF Sigma trên 3 mức tách bảng tổng hợp, mỗi bảng 2 mức', async () => {
  const { buildSigmaComparisonPrintHtml } = await import('../renderer/lib/sigma-print-report.ts');
  const html = buildSigmaComparisonPrintHtml({ ...IDENTITY, title: 'Tổng hợp', testName: 'X', unit: '', instrumentName: '', periods: [fakePeriod('2026-10', [4, 5, 6, 7])] });
  assert.equal(html.match(/<table class="sum">/g)?.length, 2);
  const three = buildSigmaComparisonPrintHtml({ ...IDENTITY, title: 'Tổng hợp', testName: 'X', unit: '', instrumentName: '', periods: [fakePeriod('2026-10', [4, 5, 6])] });
  assert.equal(three.match(/<table class="sum">/g)?.length, 1);
});
