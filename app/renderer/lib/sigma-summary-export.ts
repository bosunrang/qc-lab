// Báo cáo Six Sigma dạng bảng: một kỳ để lưu hồ sơ, hoặc nhiều kỳ để so sánh
// cùng một xét nghiệm. Dùng ExcelJS ở renderer để chạy được cả Electron và
// bản xem trước trên localhost.
import type { SigmaLevelResult, SigmaPeriodView, Test } from '../../shared/qc-api';
import { mdcRatios } from './sigma-workflow';

export interface SigmaReportInput {
  test: Pick<Test, 'name' | 'unit'>;
  instrumentName: string;
  periods: SigmaPeriodView[];
  mode: 'period' | 'comparison';
}

type Zone = { label: string; fill: string; ink: string };

function zone(value: number | null | undefined): Zone {
  if (!Number.isFinite(value)) return { label: 'Chưa đủ dữ liệu', fill: 'FFF2F7F4', ink: 'FF506674' };
  if (Number(value) >= 6) return { label: 'Đẳng cấp thế giới', fill: 'FF1F5C3A', ink: 'FFFFFFFF' };
  if (Number(value) >= 5) return { label: 'Xuất sắc', fill: 'FF5D926E', ink: 'FFFFFFFF' };
  if (Number(value) >= 4) return { label: 'Tốt', fill: 'FF9AC6A4', ink: 'FF173C25' };
  if (Number(value) >= 3) return { label: 'Cận biên', fill: 'FFF2C96D', ink: 'FF543B00' };
  return { label: 'Không đạt', fill: 'FFD9776B', ink: 'FF5A1712' };
}

function currentDate(): string { return new Intl.DateTimeFormat('vi-VN').format(new Date()); }

function columnName(index: number): string {
  let name = '';
  for (let value = index; value > 0; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + (value - 1) % 26) + name;
  return name;
}

function numberOrBlank(value: number | null | undefined): number | '' { return Number.isFinite(value) ? Number(value) : ''; }
function levelAt(period: SigmaPeriodView, level: number): SigmaLevelResult | undefined { return period.levels.find((item) => item.level === level); }
function sigmaOf(level: SigmaLevelResult | undefined): number | null { return Number.isFinite(level?.sigma?.sigma) ? Number(level!.sigma!.sigma) : null; }
function periodLabel(period: string): string { return /^\d{4}-\d{2}$/.test(period) ? `${period.slice(5, 7)}/${period.slice(0, 4)}` : period; }

function teaText(period: SigmaPeriodView): string | number {
  const values = Array.from(new Set(period.levels.map((level) => level.tea).filter((tea): tea is number => Number.isFinite(tea))));
  return values.length === 1 ? values[0] : values.length > 1 ? 'Theo mức QC' : '—';
}

function qcDesign(level: SigmaLevelResult | undefined): string {
  return level?.qualityDesign ? `N=${level.qualityDesign.n}, R=${level.qualityDesign.r}` : '—';
}

const LEVEL_COLORS = ['#0E4D4A', '#7A4F9A', '#C47D12', '#247C57'];
const SIGMA_BOUNDS: Array<[number, string]> = [[2, '#C0362C'], [3, '#DD8B1F'], [4, '#B59A00'], [5, '#3F9A55'], [6, '#0E8F8F']];
const REPORT_TEAL = 'FF215968';
// Hàng tiêu đề bảng và bảng chú thích theo màu xanh lam trong mẫu báo cáo.
const SECTION_TEAL = 'FF31869B';

/** Vẽ MỘT biểu đồ nhóm cho toàn bộ mức QC. Canvas được raster hoá 4× để ảnh
 * nhúng trong Excel vẫn rõ khi xem và in ở kích thước báo cáo. */
function drawPeriodChart(periods: SigmaPeriodView[], levels: number[]): string | null {
  if (typeof document === 'undefined' || !periods.length) return null;
  const values = periods.flatMap((period) => levels.map((level) => sigmaOf(levelAt(period, level))).filter((value): value is number => value != null));
  if (!values.length) return null;
  const width = Math.max(960, Math.min(1600, 160 * periods.length + 300));
  const height = 420, left = 60, right = 28, top = 42, bottom = 62, renderScale = 4;
  const chartWidth = width - left - right, chartHeight = height - top - bottom;
  const maxSigma = Math.max(8, Math.ceil(Math.max(...values) * 1.08));
  const canvas = document.createElement('canvas'); canvas.width = width * renderScale; canvas.height = height * renderScale;
  const context = canvas.getContext('2d'); if (!context) return null;
  context.scale(renderScale, renderScale); context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height);
  const y = (value: number) => top + chartHeight - value / maxSigma * chartHeight;
  [[0, 3, '#f6d9d3'], [3, 4, '#faedc9'], [4, 6, '#e5f0e7'], [6, maxSigma, '#d7eadb']].forEach(([from, to, color]) => {
    context.fillStyle = String(color); context.fillRect(left, y(Number(to)), chartWidth, y(Number(from)) - y(Number(to)));
  });
  context.strokeStyle = '#d5dfdb'; context.lineWidth = 1; context.fillStyle = '#425750'; context.font = '11px Arial'; context.textAlign = 'right';
  for (let tick = 0; tick <= maxSigma; tick += 2) { const py = y(tick); context.beginPath(); context.moveTo(left, py); context.lineTo(width - right, py); context.stroke(); context.fillText(String(tick), left - 8, py + 4); }
  [3, 6].forEach((threshold) => { context.strokeStyle = threshold === 3 ? '#bb4c42' : '#1f5c3a'; context.setLineDash([5, 4]); context.beginPath(); context.moveTo(left, y(threshold)); context.lineTo(width - right, y(threshold)); context.stroke(); context.setLineDash([]); });
  const slot = chartWidth / periods.length;
  const groupWidth = Math.min(slot * .76, Math.max(58, levels.length * 46));
  const gap = Math.min(9, Math.max(4, groupWidth * .08));
  const barWidth = Math.max(12, (groupWidth - gap * Math.max(0, levels.length - 1)) / levels.length);
  periods.forEach((period, index) => {
    const groupLeft = left + slot * index + (slot - groupWidth) / 2;
    levels.forEach((level, levelIndex) => {
      const sigma = sigmaOf(levelAt(period, level)); if (sigma == null) return;
      const x = groupLeft + levelIndex * (barWidth + gap), barTop = y(sigma), color = LEVEL_COLORS[levelIndex % LEVEL_COLORS.length];
      context.fillStyle = color; context.fillRect(x, barTop, barWidth, y(0) - barTop);
      context.fillStyle = '#173c25'; context.font = 'bold 11px Arial'; context.textAlign = 'center'; context.fillText(sigma.toFixed(2), x + barWidth / 2, barTop - 7);
    });
    context.fillStyle = '#425750'; context.font = '10px Arial'; context.fillText(periodLabel(period.period), left + slot * index + slot / 2, height - bottom + 18);
  });
  context.strokeStyle = '#425750'; context.lineWidth = 1.2; context.beginPath(); context.moveTo(left, top); context.lineTo(left, height - bottom); context.lineTo(width - right, height - bottom); context.stroke();
  let legendX = left;
  levels.forEach((level, index) => {
    const label = `Mức ${level}`;
    context.fillStyle = LEVEL_COLORS[index % LEVEL_COLORS.length]; context.fillRect(legendX, 14, 12, 12);
    context.fillStyle = '#425750'; context.font = 'bold 11px Arial'; context.textAlign = 'left'; context.fillText(label, legendX + 18, 24);
    legendX += 18 + context.measureText(label).width + 24;
  });
  return canvas.toDataURL('image/png').split(',')[1] || null;
}

/** Dùng cùng tỷ lệ CV/TEa và |Bias|/TEa với biểu đồ MDC trong ứng dụng. */
function drawMdcChart(periods: SigmaPeriodView[], levels: number[]): string | null {
  if (typeof document === 'undefined') return null;
  const points = levels.flatMap((level, levelIndex) => periods.flatMap((period, periodIndex) => {
    const levelData = levelAt(period, level), ratios = levelData ? mdcRatios(levelData) : null;
    return ratios ? [{ ...ratios, level, levelIndex, periodIndex }] : [];
  }));
  if (!points.length) return null;
  const width = 760, height = 380, left = 58, right = 18, top = 42, bottom = 50, renderScale = 4;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const axis = (observed: number, floor: number) => {
    const target = Math.max(floor, observed), raw = target / 6;
    const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const step = [1, 2, 2.5, 5, 10].map((multiplier) => multiplier * pow).find((candidate) => candidate >= raw) ?? 10 * pow;
    return { max: Math.ceil(target / step) * step, step };
  };
  const xAxis = axis(Math.max(0, ...points.map((point) => point.cvRatio)), 60);
  const yAxis = axis(Math.max(0, ...points.map((point) => point.biasRatio)), 100);
  const ticks = ({ max, step }: { max: number; step: number }) => Array.from({ length: Math.round(max / step) + 1 }, (_, index) => Number((index * step).toFixed(4)));
  const px = (value: number) => left + value / xAxis.max * plotWidth;
  const py = (value: number) => height - bottom - value / yAxis.max * plotHeight;
  const canvas = document.createElement('canvas'); canvas.width = width * renderScale; canvas.height = height * renderScale;
  const context = canvas.getContext('2d'); if (!context) return null;
  context.scale(renderScale, renderScale); context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height);
  context.fillStyle = '#ffffff'; context.strokeStyle = '#dce3e9'; context.strokeRect(left, top, plotWidth, plotHeight);
  context.strokeStyle = '#e5ecef'; context.lineWidth = .7; context.fillStyle = '#70818d'; context.font = '10px Arial'; context.textAlign = 'right';
  ticks(yAxis).forEach((value) => { const y = py(value); context.beginPath(); context.moveTo(left, y); context.lineTo(width - right, y); context.stroke(); context.fillText(String(value), left - 7, y + 3); });
  context.textAlign = 'center'; ticks(xAxis).forEach((value) => context.fillText(String(value), px(value), height - bottom + 15));
  context.save(); context.beginPath(); context.rect(left, top, plotWidth, plotHeight); context.clip();
  SIGMA_BOUNDS.forEach(([sigma, color]) => {
    const endX = Math.min(xAxis.max, 100 / sigma), endY = 100 - sigma * endX;
    context.strokeStyle = color; context.lineWidth = 1; context.beginPath(); context.moveTo(px(0), py(100)); context.lineTo(px(endX), py(endY)); context.stroke();
  });
  levels.forEach((level, levelIndex) => {
    const series = points.filter((point) => point.level === level).sort((a, b) => a.periodIndex - b.periodIndex);
    if (series.length > 1) { context.strokeStyle = LEVEL_COLORS[levelIndex % LEVEL_COLORS.length]; context.globalAlpha = .35; context.setLineDash([3, 3]); context.beginPath(); series.forEach((point, index) => index ? context.lineTo(px(point.cvRatio), py(point.biasRatio)) : context.moveTo(px(point.cvRatio), py(point.biasRatio))); context.stroke(); context.setLineDash([]); context.globalAlpha = 1; }
    series.forEach((point, index) => { context.fillStyle = LEVEL_COLORS[levelIndex % LEVEL_COLORS.length]; context.beginPath(); context.arc(px(point.cvRatio), py(point.biasRatio), index === series.length - 1 ? 5 : 3.5, 0, Math.PI * 2); context.fill(); context.strokeStyle = '#ffffff'; context.lineWidth = 1.2; context.stroke(); });
  });
  context.restore();
  SIGMA_BOUNDS.forEach(([sigma, color]) => { const endX = Math.min(xAxis.max, 100 / sigma), endY = 100 - sigma * endX; context.fillStyle = color; context.font = 'bold 10px Arial'; context.textAlign = 'left'; context.fillText(`${sigma}σ`, px(endX) + 4, py(endY) - 5); });
  context.strokeStyle = '#42515b'; context.lineWidth = .9; context.beginPath(); context.moveTo(left, height - bottom); context.lineTo(width - right, height - bottom); context.moveTo(left, top); context.lineTo(left, height - bottom); context.stroke();
  let legendX = left;
  levels.forEach((level, index) => { const label = `Mức ${level}`; context.fillStyle = LEVEL_COLORS[index % LEVEL_COLORS.length]; context.fillRect(legendX, 14, 11, 11); context.fillStyle = '#425750'; context.font = 'bold 10px Arial'; context.fillText(label, legendX + 16, 24); legendX += 16 + context.measureText(label).width + 18; });
  context.fillStyle = '#40515c'; context.font = 'bold 10px Arial'; context.textAlign = 'center'; context.fillText('CV / TEA (%)', left + plotWidth / 2, height - 7);
  context.save(); context.translate(14, top + plotHeight / 2); context.rotate(-Math.PI / 2); context.fillText('|BIAS| / TEA (%)', 0, 0); context.restore();
  return canvas.toDataURL('image/png').split(',')[1] || null;
}

function download(bytes: ArrayBuffer, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}

/** Mẫu báo cáo giống file Six Sigma người dùng cung cấp. `comparison` giữ một
 * xét nghiệm, nhưng mỗi dòng là một kỳ để bảng và biểu đồ cho thấy xu hướng. */
export async function exportSigmaReportXlsx(input: SigmaReportInput): Promise<string | null> {
  try {
    const { default: ExcelJS } = await import('exceljs');
    const periods = [...input.periods].sort((left, right) => left.period.localeCompare(right.period));
    const levels = Array.from(new Set(periods.flatMap((period) => period.levels.map((level) => level.level)))).sort((left, right) => left - right);
    if (!periods.length || !levels.length) return 'Chưa có dữ liệu Six Sigma để xuất báo cáo.';
    const workbook = new ExcelJS.Workbook(); workbook.creator = 'QC Lab'; workbook.created = new Date();
    const columnsPerLevel = 7, baseColumns = 3, lastColumn = baseColumns + levels.length * columnsPerLevel, lastName = columnName(lastColumn);
    const onePeriod = input.mode === 'period';
    const displayedPeriod = periodLabel(periods[0].period);
    const sheetName = onePeriod ? `Kỳ ${displayedPeriod.replace('/', '-')}` : 'So sánh các kỳ';
    const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 3, activeCell: 'A4', showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .25, right: .25, top: .35, bottom: .35, header: .2, footer: .2 } } });
    const title = onePeriod ? `BÁO CÁO THEO DÕI SIX SIGMA – KỲ ${displayedPeriod}` : 'BÁO CÁO TỔNG HỢP THEO DÕI SIX SIGMA – SO SÁNH CÁC KỲ';
    sheet.mergeCells(`A1:${lastName}1`); sheet.getCell('A1').value = title;
    sheet.getCell('A1').font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REPORT_TEAL } }; sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }; sheet.getRow(1).height = 28;
    sheet.mergeCells(`A2:${lastName}2`); sheet.getCell('A2').value = `Xét nghiệm: ${input.test.name}${input.test.unit ? ` (${input.test.unit})` : ''}${input.instrumentName ? ` · Máy: ${input.instrumentName}` : ''} · Xuất ngày ${currentDate()} · ${periods.length} kỳ`;
    sheet.getCell('A2').font = { name: 'Arial', size: 9, color: { argb: 'FF40515C' }, italic: true }; sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' }; sheet.getRow(2).height = 17;
    const headers = ['Xét nghiệm', onePeriod ? 'Kỳ' : 'Kỳ đánh giá', 'TEa (%)'];
    levels.forEach((level) => headers.push(`Mức ${level}\nSigma`, `Mức ${level}\nXếp loại`, `Mức ${level}\nCV (%)`, `Mức ${level}\nBias RMS (%)`, `Mức ${level}\nDPMO`, `Mức ${level}\nYield (%)`, `Mức ${level}\nThiết kế QC`));
    const header = sheet.getRow(3); header.values = headers; header.height = 40;
    header.eachCell({ includeEmpty: true }, (cell) => { cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_TEAL } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = { top: { style: 'thin', color: { argb: 'FFB8D1C0' } }, bottom: { style: 'thin', color: { argb: 'FFB8D1C0' } }, left: { style: 'thin', color: { argb: 'FFB8D1C0' } }, right: { style: 'thin', color: { argb: 'FFB8D1C0' } } }; });
    periods.forEach((period, index) => {
      const row = sheet.getRow(index + 4); const values: (string | number)[] = [onePeriod || index === 0 ? input.test.name : '', periodLabel(period.period), teaText(period)];
      levels.forEach((level) => { const item = levelAt(period, level), sigma = sigmaOf(item), grade = zone(sigma); values.push(numberOrBlank(sigma), sigma == null ? 'Chưa đủ dữ liệu' : grade.label, numberOrBlank(item?.cv), numberOrBlank(item?.biasEqa), numberOrBlank(item?.sigma?.dpmo), numberOrBlank(item?.sigma?.yieldPercent), qcDesign(item)); });
      row.values = values; row.height = 24;
      row.eachCell({ includeEmpty: true }, (cell) => { cell.font = { name: 'Arial', size: 9, color: { argb: 'FF233640' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 ? 'FFFFFFFF' : 'FFF2F7F4' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = { bottom: { style: 'thin', color: { argb: 'FFD0DED5' } }, left: { style: 'thin', color: { argb: 'FFD0DED5' } }, right: { style: 'thin', color: { argb: 'FFD0DED5' } } }; });
      row.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF173C25' } }; row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      levels.forEach((level, levelIndex) => { const sigmaColumn = baseColumns + levelIndex * columnsPerLevel + 1, gradeColumn = sigmaColumn + 1, grade = zone(sigmaOf(levelAt(period, level))); [sigmaColumn, gradeColumn].forEach((column) => { row.getCell(column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: grade.fill } }; row.getCell(column).font = { name: 'Arial', size: 9, bold: true, color: { argb: grade.ink } }; }); });
    });
    if (!onePeriod && periods.length > 1) {
      sheet.mergeCells(4, 1, periods.length + 3, 1);
      const assayCell = sheet.getCell(4, 1);
      assayCell.alignment = { horizontal: 'left', vertical: 'middle' };
      assayCell.fill = { type: 'pattern', pattern: 'none' };
    }
    const widths = [26, 13, 10]; levels.forEach(() => widths.push(10, 20, 10, 13, 12, 11, 15)); widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    for (let row = 4; row <= periods.length + 3; row++) { levels.forEach((_, index) => { const start = baseColumns + index * columnsPerLevel + 1; [start, start + 2, start + 3, start + 5].forEach((column) => { sheet.getCell(row, column).numFmt = '0.00'; }); sheet.getCell(row, start + 4).numFmt = '#,##0'; }); if (typeof sheet.getCell(row, 3).value === 'number') sheet.getCell(row, 3).numFmt = '0.00'; }
    const legendStart = periods.length + 5;
    sheet.mergeCells(`A${legendStart}:C${legendStart}`);
    sheet.getCell(`A${legendStart}`).value = 'GIẢI THÍCH BẬC SIGMA';
    sheet.getCell(`A${legendStart}`).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell(`A${legendStart}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_TEAL } };
    sheet.getCell(`A${legendStart}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(legendStart).height = 22;
    const legend = [['Đẳng cấp thế giới', 'Sigma ≥ 6'], ['Xuất sắc', '5 ≤ Sigma < 6'], ['Tốt', '4 ≤ Sigma < 5'], ['Cận biên', '3 ≤ Sigma < 4'], ['Không đạt', 'Sigma < 3']];
    legend.forEach(([label, explanation], index) => {
      const row = legendStart + index + 1;
      const grade = zone(index === 0 ? 6 : index === 1 ? 5 : index === 2 ? 4 : index === 3 ? 3 : 2);
      sheet.mergeCells(row, 2, row, 3);
      sheet.getCell(row, 1).value = label;
      sheet.getCell(row, 2).value = explanation;
      sheet.getRow(row).height = 22;
      for (let column = 1; column <= 3; column++) {
        const cell = sheet.getCell(row, column);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD6E2DA' } }, bottom: { style: 'thin', color: { argb: 'FFD6E2DA' } },
          left: { style: 'thin', color: { argb: 'FFD6E2DA' } }, right: { style: 'thin', color: { argb: 'FFD6E2DA' } },
        };
      }
      const labelCell = sheet.getCell(row, 1), explanationCell = sheet.getCell(row, 2);
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: grade.fill } };
      labelCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: grade.ink } };
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
      explanationCell.font = { name: 'Arial', size: 10, color: { argb: 'FF40515C' } };
      explanationCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    });
    let chartRow = legendStart + legend.length + 3;
    const sigmaChart = drawPeriodChart(periods, levels);
    if (sigmaChart) {
      sheet.mergeCells(chartRow, 1, chartRow, lastColumn);
      sheet.getCell(chartRow, 1).value = 'BIỂU ĐỒ SIGMA – SO SÁNH CÁC MỨC QC';
      sheet.getCell(chartRow, 1).font = { name: 'Arial', size: 10, bold: true, color: { argb: REPORT_TEAL } };
      const image = workbook.addImage({ base64: sigmaChart, extension: 'png' });
      sheet.addImage(image, { tl: { col: 0, row: chartRow }, ext: { width: Math.max(960, Math.min(1600, 160 * periods.length + 300)), height: 420 } });
      chartRow += 23;
    }
    const mdcChart = drawMdcChart(periods, levels);
    if (mdcChart) {
      sheet.mergeCells(chartRow, 1, chartRow, lastColumn);
      sheet.getCell(chartRow, 1).value = 'BIỂU ĐỒ QUYẾT ĐỊNH PHƯƠNG PHÁP (MDC)';
      sheet.getCell(chartRow, 1).font = { name: 'Arial', size: 10, bold: true, color: { argb: REPORT_TEAL } };
      const image = workbook.addImage({ base64: mdcChart, extension: 'png' });
      sheet.addImage(image, { tl: { col: 0, row: chartRow }, ext: { width: 760, height: 380 } });
    }
    const bytes = await workbook.xlsx.writeBuffer();
    download(bytes, onePeriod ? `Báo cáo Six Sigma - Kỳ ${displayedPeriod.replace('/', '-')}.xlsx` : `Báo cáo tổng hợp Six Sigma - ${input.test.name}.xlsx`);
    return null;
  } catch (error) { return error instanceof Error ? error.message : 'Không tạo được báo cáo Six Sigma.'; }
}


