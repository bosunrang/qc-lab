'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
// Trang So sánh hóa chất đã chuyển hẳn sang TypeScript (Pha G route slice 4):
// src/presentation/reagent/reagent-page-controller.ts. Controller tiêu thụ mọi
// presentation/service/domain qua `deps.*`; các hợp đồng bridge (QCLabGlobal +
// root.X=) vẫn nằm ở compat và được chốt bên dưới.
const route = fs.readFileSync(path.join(root, 'src/presentation/reagent/reagent-page-controller.ts'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'src/compat/modular-pilot.global.ts'), 'utf8');

// Controller phải tiêu thụ presentation/service/domain TypeScript qua deps, không tự dựng logic.
for (const [needle, message] of [
  [/deps\.pres\.comparisonLabel\.label\(/, 'Nhãn so sánh hóa chất phải dùng presentation TypeScript'],
  [/deps\.pres\.chart\.range\(/, 'Dải biểu đồ hóa chất phải dùng presentation TypeScript'],
  [/deps\.pres\.quickLabel\.label\(/, 'Nhãn thao tác nhanh phải dùng presentation TypeScript'],
  [/deps\.pres\.quickPickerModal\(/, 'Modal chọn nhanh hóa chất phải dùng renderer TypeScript'],
  [/deps\.pres\.quickPickerRows\(/, 'Dòng modal chọn nhanh hóa chất phải dùng renderer TypeScript'],
  [/deps\.pres\.pickerModal\(/, 'Modal chọn phép so sánh phải dùng renderer TypeScript'],
  [/deps\.pres\.pickerRows\(/, 'Dòng modal chọn phép so sánh phải dùng renderer TypeScript'],
  [/deps\.pres\.createModal\(/, 'Modal thêm hóa chất phải dùng renderer TypeScript'],
  [/deps\.pres\.createReferenceRows\(/, 'Danh mục modal thêm hóa chất phải dùng renderer TypeScript'],
  [/deps\.pres\.createTypedRow\(/, 'Nút tạo hóa chất theo truy vấn phải dùng renderer TypeScript'],
  [/deps\.pres\.resultHtml\(/, 'Kết quả so sánh hóa chất phải dùng renderer TypeScript'],
  [/deps\.pres\.reportDetailCard\(/, 'Card báo cáo hóa chất phải dùng renderer TypeScript'],
  [/deps\.pres\.reportChartGrid\(/, 'Lưới biểu đồ báo cáo phải dùng renderer TypeScript'],
  [/deps\.pres\.report\.summaryTableHtml\(/, 'Bảng tổng hợp báo cáo phải dùng presentation TypeScript'],
  [/deps\.pres\.report\.detailModel\(/, 'Chi tiết hóa chất phải dùng model TypeScript'],
  [/deps\.pres\.report\.formatNumber\(/, 'Định dạng số báo cáo phải dùng presentation TypeScript'],
  [/deps\.pres\.chartAxis\(/, 'Trục biểu đồ hóa chất phải dùng renderer TypeScript'],
  [/deps\.pres\.scatterSvg\(/, 'Biểu đồ Scatter hóa chất phải dùng renderer TypeScript'],
  [/deps\.pres\.blandSvg\(/, 'Biểu đồ Bland-Altman hóa chất phải dùng renderer TypeScript'],
  [/deps\.pres\.reportItem\.items\(/, 'Mục báo cáo hóa chất phải dùng presentation TypeScript'],
  [/deps\.pres\.pairMath\.pairCalc\(/, 'Tính từng cặp hóa chất phải dùng domain TypeScript'],
  [/deps\.pres\.calculator\.calculate\(ds, RC_MIN_PAIRS\)/, 'Calculator hóa chất phải dùng service TypeScript'],
]) assert.match(route, needle, message);
// Không giữ facade thống kê / xấp xỉ phân phối classic đã retire.
assert.doesNotMatch(route, /function rc(?:PTwo|TCrit|Betacf|Lgamma|Betai)\(/, 'Không giữ facade thống kê/beta classic đã retire');
assert.doesNotMatch(route, /globalThis\.reagent/, 'Controller không được gọi globalThis.reagent* trực tiếp — mọi thứ đi qua deps');

// Hợp đồng bridge (QCLabGlobal) vẫn bắt buộc — kiểm tại compat.
for (const contract of [
  /reagentComparisonLabelPresentation: typeof reagentComparisonLabelPresentation;/,
  /reagentQuickPickerModalPresentation: typeof reagentQuickPickerModalHtml;/,
  /reagentQuickPickerRowsHtml: typeof reagentQuickPickerRowsHtml;/,
  /reagentPickerModalPresentation: typeof reagentPickerModalHtml;/,
  /reagentPickerRowsHtml: typeof reagentPickerRowsHtml;/,
  /reagentCreateModalPresentation: typeof reagentCreateModalHtml;/,
  /reagentCreateReferenceRowsHtml: typeof reagentCreateReferenceRowsHtml;/,
  /reagentCreateTypedRowHtml: typeof reagentCreateTypedRowHtml;/,
  /reagentReportDetailCardHtml: typeof reagentReportDetailCardHtml;/,
  /reagentReportChartGridHtml: typeof reagentReportChartGridHtml;/,
  /reagentReportPresentation: typeof reagentReportPresentation;/,
  /reagentChartAxis: typeof reagentChartAxis;/,
  /reagentScatterSvg: typeof reagentScatterSvg;/,
  /reagentBlandSvg: typeof reagentBlandSvg;/,
  /reagentResultHtml: ReturnType<typeof createReagentResultHtml>;/,
  /reagentReportItemPresentation: typeof reagentReportItemPresentation;/,
  /reagentPairMath: typeof reagentPairMath;/,
  /reagentComparisonCalculator: ReturnType<typeof createReagentComparisonCalculator>;/,
]) assert.match(bridge, contract, `bridge contract thiếu: ${contract}`);
assert.doesNotMatch(bridge, /reagent(?:Statistics|TDistribution): typeof/, 'Không công bố facade thống kê hóa chất đã retire');

console.log('Reagent label TypeScript bridge tests passed');
