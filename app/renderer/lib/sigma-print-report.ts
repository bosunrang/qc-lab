import type { SigmaLevelResult, SigmaPeriodView } from '../../shared/qc-api';
import { designBlockedReason, sigmaDesignEligible } from './sigma-workflow';
import { drawMdcChart, drawPeriodChart, levelAt, qcDesign, SIGMA_GRADE_LEGEND, sigmaOf, teaText, zone } from './sigma-summary-export';
import { DOCUMENT_CSS, documentHeader, escapeHtml, signatureBlock, type PrintIdentity } from './print-document';

interface SigmaReportHeader extends PrintIdentity {
  title: string;
}

export interface SigmaPeriodPrintInput extends SigmaReportHeader {
  testName: string;
  unit: string;
  instrumentName: string;
  teaSource: string;
  teaCriterion: string;
  period: SigmaPeriodView;
}

export interface SigmaComparisonPrintInput extends SigmaReportHeader {
  testName: string;
  unit: string;
  instrumentName: string;
  periods: SigmaPeriodView[];
}

/** Số in theo chuẩn Việt Nam (phẩy thập phân, chấm hàng nghìn), cùng cách
 * Excel hiển thị trên máy tiếng Việt. Trước 06/11/2026 in kiểu Mỹ: DPMO
 * "262,172" dễ bị đọc thành 262 phẩy 172. */
const VI = 'vi-VN';
function number(value: number | null | undefined, digits = 2): string {
  return Number.isFinite(value) ? Number(value).toLocaleString(VI, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
}

/** "2026-11" → "11/2026" (cột Kỳ của bảng tổng hợp, giống Excel). */
function shortPeriod(period: string): string {
  return /^\d{4}-\d{2}$/.test(period) ? `${period.slice(5)}/${period.slice(0, 4)}` : period;
}

function periodLabel(period: string): string {
  return /^\d{4}-\d{2}$/.test(period) ? `Kỳ ${shortPeriod(period)}` : period;
}

/** Phần đầu biểu mẫu dùng chung cho báo cáo từng kỳ lẫn tổng hợp. */
function reportHeader(input: SigmaReportHeader, subtitle: string): string {
  return documentHeader(input, input.title, subtitle, ['Dữ liệu Six Sigma tại thời điểm in']);
}

/* Bố cục theo bản Excel (bảng tổng hợp mỗi kỳ một dòng, mỗi mức một nhóm cột,
   ô Sigma/Xếp loại tô theo bậc), nhưng tông màu xanh nhạt như PDF Westgard:
   đầu bảng và tiêu đề mục nền #e9f1f2, chữ đậm màu, viền #c9d9d6. */
const REPORT_CSS = `
  @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#183843;margin:0}
  h2{font-size:11.5px;color:#215968;background:#e9f1f2;border:1px solid #c9d9d6;border-bottom:0;padding:5px 8px;margin:14px 0 0;break-after:avoid;text-align:left}
  h3{font-size:11px;margin:9px 0 5px;color:#215968;break-after:avoid}
  table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #c9d9d6;padding:4px 5px;vertical-align:middle;overflow-wrap:anywhere;text-align:center}
  th{background:#e9f1f2;font-weight:700}thead{display:table-header-group}tr{break-inside:avoid}
  .setup th{width:21%;background:#f2f7f4;text-align:left}.setup td{width:29%;text-align:left}
  .appx,.appx th{font-size:8.5px}
  .sum{font-size:8.5px}.sum th{font-size:8px}.sum tbody tr:nth-child(even) td{background:#f7fbfb}
  .sum td.assay{font-weight:700;text-align:left;background:#fff}.sum .lv-start{border-left:2px solid #9fc3c8}.sum td.grade{font-weight:700}
  .sum+.sum{margin-top:8px}
  .grades{width:42%;margin-top:10px;break-inside:avoid}.grades td{text-align:left;padding-left:8px}.grades td.grade{width:45%;text-align:center;font-weight:700}
  td.period{text-align:center;font-weight:700;background:#fff}
  .note{margin:6px 0;color:#455f69}
  .charts,.appendix{break-before:page}.chart{break-inside:avoid;margin-top:8px}.chart img{display:block;max-width:100%;max-height:80mm;margin:0 auto}
  .empty-chart{padding:18px;border:1px solid #dce3e9;color:#526975}.footer{margin-top:10px;font-size:8px;color:#526975}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}${DOCUMENT_CSS}
`;

function dpmo(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return '—';
  const numeric = Number(value);
  return numeric < 10 ? number(numeric) : number(Math.round(numeric), 0);
}

function table(headers: string[], rows: string[][], className = ''): string {
  return `<table class="${className}"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

/** Gộp ô kỳ theo các mức QC trong cùng kỳ, để bảng nhiều kỳ không lặp nhãn. */
function groupedPeriodTable(headers: string[], groups: Array<{ period: string; rows: string[][] }>, className = ''): string {
  const body = groups.map((group) => group.rows.map((row, index) => `<tr>${index === 0 ? `<td class="period" rowspan="${group.rows.length}">${escapeHtml(group.period)}</td>` : ''}${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')).join('');
  return `<table class="${className}"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
}

function setupTable(input: SigmaPeriodPrintInput): string {
  const fields = [
    ['Xét nghiệm', input.testName], ['Đơn vị', input.unit || '—'], ['Thiết bị', input.instrumentName || '—'],
    ['Nguồn TEa', input.teaSource || '—'], ['Tiêu chí TEa hiện hành', input.teaCriterion || '—'], ['Kỳ đánh giá', periodLabel(input.period.period)],
  ];
  return `<table class="setup"><tbody>${fields.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody></table>`;
}

function comparisonSetupTable(input: SigmaComparisonPrintInput, periods: SigmaPeriodView[], today: string): string {
  const first = periods[0]?.period, last = periods[periods.length - 1]?.period;
  const span = first && last ? first === last ? periodLabel(first) : `${periodLabel(first)} – ${periodLabel(last)}` : '—';
  const fields = [
    ['Xét nghiệm', input.testName], ['Đơn vị', input.unit || '—'], ['Thiết bị', input.instrumentName || '—'],
    ['Phạm vi kỳ đánh giá', span], ['Số kỳ tổng hợp', String(periods.length)], ['Ngày in', today],
  ];
  return `<table class="setup"><tbody>${fields.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody></table>`;
}

function cvSource(level: SigmaLevelResult): string {
  return level.cvSource === 'iqc-cohort'
    ? `IQC: lô ${level.sourceLot || '—'} · n=${level.cohortN ?? 0}${level.cohortReviewed ? ' · đã rà soát' : ' · chưa xác nhận rà soát'}`
    : 'Nhập tay';
}

function biasSource(level: SigmaLevelResult): string {
  return level.eqaRounds.length ? `${level.eqaRounds.length} ${level.eqaRounds.some((r) => r.eqaResultId) ? 'mẫu ngoại kiểm' : 'vòng EQA/EQC'} · TB có dấu` : 'Nhập tay';
}

function designCells(level: SigmaLevelResult): [string, string, string] {
  if (!level.sigma) return ['—', 'Chưa đủ CV/Bias/TEa', 'Chưa đánh giá'];
  if (!sigmaDesignEligible(level) || !level.qualityDesign) {
    return ['Chưa đưa gợi ý', designBlockedReason(level), 'Không dùng để đề xuất QC'];
  }
  const design = level.qualityDesign;
  const run = `N=${design.n}${design.r > 1 ? ` · R=${design.r}` : ''}`;
  return [design.rules.join(' / '), `${design.risk} · ${run}`, design.plan];
}

const LEVEL_COLUMNS = ['Sigma', 'Xếp loại', 'CV (%)', 'Bias (%)', 'DPMO', 'Yield (%)', 'Thiết kế QC'];

function levelsOf(periods: SigmaPeriodView[]): number[] {
  return Array.from(new Set(periods.flatMap((period) => period.levels.map((level) => level.level)))).sort((left, right) => left - right);
}

/** Màu nền/chữ của một bậc, lấy từ `zone()` của bản Excel (ARGB → #RRGGBB). */
function gradeStyle(sigma: number | null): string {
  const grade = zone(sigma);
  return `background:#${grade.fill.slice(2)};color:#${grade.ink.slice(2)}`;
}

/** Bảng tổng hợp giống trang Excel: mỗi kỳ một dòng, mỗi mức QC một nhóm
 * 7 cột. Trên 3 mức thì tách thành nhiều bảng, mỗi bảng 2 mức, để A4 ngang
 * không bị ép chữ quá nhỏ; mỗi bảng lặp lại Xét nghiệm, Kỳ và TEa. */
function summaryTables(testName: string, periods: SigmaPeriodView[]): string {
  const levels = levelsOf(periods);
  if (!periods.length || !levels.length) return '<p class="empty-chart">Chưa có dữ liệu Six Sigma.</p>';
  const size = levels.length <= 3 ? levels.length : 2;
  const chunks: number[][] = [];
  for (let index = 0; index < levels.length; index += size) chunks.push(levels.slice(index, index + size));
  return chunks.map((chunk) => {
    const head = `<tr><th rowspan="2" style="width:11%">Xét nghiệm</th><th rowspan="2" style="width:6%">Kỳ</th><th rowspan="2" style="width:5%">TEa (%)</th>${chunk.map((level) => `<th colspan="${LEVEL_COLUMNS.length}" class="lv-start">Mức ${level}</th>`).join('')}</tr>`
      + `<tr>${chunk.map(() => LEVEL_COLUMNS.map((column, index) => `<th${index === 0 ? ' class="lv-start"' : ''}>${column}</th>`).join('')).join('')}</tr>`;
    const body = periods.map((period, index) => {
      const tea = teaText(period);
      const cells = chunk.map((level) => {
        const item = levelAt(period, level), sigma = sigmaOf(item), style = gradeStyle(sigma);
        return `<td class="lv-start grade" style="${style}">${number(sigma)}</td><td class="grade" style="${style}">${escapeHtml(zone(sigma).label)}</td>`
          + `<td>${number(item?.cv)}</td><td>${number(item?.biasEqa)}</td><td>${dpmo(item?.sigma?.dpmo)}</td><td>${number(item?.sigma?.yieldPercent)}</td><td>${escapeHtml(qcDesign(item))}</td>`;
      }).join('');
      const assay = index === 0 ? `<td class="assay" rowspan="${periods.length}">${escapeHtml(testName)}</td>` : '';
      return `<tr>${assay}<td>${escapeHtml(shortPeriod(period.period))}</td><td>${escapeHtml(typeof tea === 'number' ? number(tea) : tea)}</td>${cells}</tr>`;
    }).join('');
    return `<table class="sum"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }).join('');
}

/** "Giải thích bậc Sigma" như trang Excel, cùng nhãn và màu. */
function gradeLegend(): string {
  const rows = SIGMA_GRADE_LEGEND.map(({ sample, range }) => `<tr><td class="grade" style="${gradeStyle(sample)}">${escapeHtml(zone(sample).label)}</td><td>${escapeHtml(range)}</td></tr>`).join('');
  return `<table class="grades"><thead><tr><th colspan="2">Giải thích bậc Sigma</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** Hai biểu đồ vẽ bằng đúng hàm của bản Excel (ảnh raster hoá 4×), nên PDF và
 * Excel luôn cùng một hình. */
function chartsSection(periods: SigmaPeriodView[]): string {
  const levels = levelsOf(periods);
  const image = (png: string | null, alt: string, empty: string) => png
    ? `<img src="data:image/png;base64,${png}" alt="${alt}">` : `<p class="empty-chart">${empty}</p>`;
  return '<section class="charts"><h2>Biểu đồ Sigma &amp; MDC</h2>'
    + `<div class="chart"><h3>Biểu đồ Sigma – so sánh các mức QC</h3>${image(drawPeriodChart(periods, levels), 'Biểu đồ Sigma theo mức QC', 'Chưa có kỳ Sigma đủ dữ liệu để vẽ biểu đồ.')}</div>`
    + `<div class="chart"><h3>Biểu đồ quyết định phương pháp (MDC)</h3>${image(drawMdcChart(periods, levels), 'Biểu đồ quyết định phương pháp MDC', 'Chưa có TEa, CV IQC và Bias EQA/EQC đầy đủ để vẽ biểu đồ MDC.')}</div></section>`;
}

const DESIGN_NOTE = '<p class="note">Gợi ý theo Westgard Sigma Rules là điểm khởi đầu; người phụ trách vẫn cần rà soát nguy cơ, độ ổn định hệ thống, khối lượng mẫu và hậu quả lâm sàng trước khi cấu hình luật QC.</p>';
const DPMO_NOTE = '<p class="note">DPMO là quy đổi tham khảo với dịch 1,5σ.</p>';
const MU_HEADERS = ['u(Rw)', 'u(Cref)', 'u(bias)', 'u(cal)', 'u_c', 'U (k=2)', 'U / TEa', 'Trạng thái', 'Thành phần thiếu'];

function muCells(level: SigmaLevelResult): string[] {
  const mu = level.mu;
  const state = !mu ? 'Chưa có CV IQC' : !mu.complete ? 'Chưa đủ thành phần' : mu.withinTea === false ? 'U vượt TEa' : 'Đủ thành phần';
  return [number(mu?.uRw, 4), number(mu?.uCref, 4), number(mu?.uBias, 4), number(mu?.uCal, 4), number(mu?.uc, 4), mu?.complete ? number(mu.U, 4) : '—', mu?.complete && mu.teaRatio != null ? `${number(mu.teaRatio * 100, 1)}%` : '—', state, mu?.missing?.join(', ') || '—'];
}

/** Báo cáo một kỳ: thiết lập, bảng tổng hợp kiểu Excel, biểu đồ; các bảng
 * truy vết (số liệu kỳ, thiết kế QC, MU) để ở phụ lục các trang sau. */
export function buildSigmaPeriodPrintHtml(input: SigmaPeriodPrintInput): string {
  const levels = [...input.period.levels].sort((left, right) => left.level - right.level);
  const dataRows = levels.map((level) => [
    `Mức ${level.level}`, `${number(level.tea)}%`, level.targetMean == null ? '—' : `${level.targetMean.toLocaleString(VI, { maximumFractionDigits: 4 })}${input.unit ? ` ${input.unit}` : ''}`,
    `${number(level.cv)}%`, cvSource(level), `${number(level.biasEqa)}%`, biasSource(level), level.eqaRounds.length > 1 && level.biasRms != null ? `${number(level.biasRms)}%` : '—', level.teaCriterion || '—',
  ]);
  const designRows = levels.map((level) => [`Mức ${level.level}`, number(level.sigma?.sigma), ...designCells(level)]);
  const muRows = levels.map((level) => [`Mức ${level.level}`, ...muCells(level)]);
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title><style>${REPORT_CSS}</style></head><body>${reportHeader(input, `${input.testName}${input.unit ? ` (${input.unit})` : ''} · ${periodLabel(input.period.period)}`)}
  <h2>Thiết lập phân tích</h2>${setupTable(input)}
  <h2>Kết quả theo mức QC</h2>${summaryTables(input.testName, [input.period])}${DPMO_NOTE}${gradeLegend()}
  ${chartsSection([input.period])}
  <section class="appendix"><h2>Phụ lục A. Số liệu kỳ</h2>${table(['Mức', 'TEa', 'Mean mục tiêu', 'CV IQC', 'Nguồn CV', 'Bias', 'Nguồn Bias', 'Bias RMS (cho MU)', 'Tiêu chí TEa'], dataRows, 'appx')}
  <h2>Phụ lục B. Thiết kế QC theo Westgard Sigma Rules</h2>${table(['Mức', 'Sigma', 'Bộ quy tắc QC gợi ý', 'Mức nguy cơ tham khảo', 'Hành động'], designRows, 'appx')}${DESIGN_NOTE}
  <h2>Phụ lục C. Độ không đảm bảo đo (MU)</h2>${table(['Mức', ...MU_HEADERS], muRows, 'appx')}</section>
  <p class="footer">Báo cáo được tạo từ dữ liệu Six Sigma đã lưu tại thời điểm in.</p>${signatureBlock()}</body></html>`;
}

/** Bản in tổng hợp cùng bố cục với báo cáo một kỳ; bảng tổng hợp mỗi kỳ một
 * dòng, các phụ lục gộp ô kỳ theo các mức QC trong cùng kỳ. */
export function buildSigmaComparisonPrintHtml(input: SigmaComparisonPrintInput): string {
  const periods = [...input.periods].sort((left, right) => left.period.localeCompare(right.period));
  const groups = (row: (level: SigmaLevelResult) => string[]) => periods.map((period) => ({
    period: periodLabel(period.period),
    rows: [...period.levels].sort((left, right) => left.level - right.level).map((level) => [`Mức ${level.level}`, ...row(level)]),
  }));
  const sourceGroups = groups((level) => [level.teaCriterion || '—', cvSource(level), biasSource(level), level.eqaRounds.length > 1 && level.biasRms != null ? `${number(level.biasRms)}%` : '—']);
  const designGroups = groups((level) => [number(level.sigma?.sigma), ...designCells(level)]);
  const muGroups = groups(muCells);
  const today = new Intl.DateTimeFormat('vi-VN').format(new Date());
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title><style>${REPORT_CSS}</style></head><body>${reportHeader(input, `${input.testName}${input.unit ? ` (${input.unit})` : ''} · Báo cáo so sánh các kỳ`)}
  <h2>Thiết lập báo cáo tổng hợp</h2>${comparisonSetupTable(input, periods, today)}
  <h2>Kết quả theo mức QC</h2>${summaryTables(input.testName, periods)}${DPMO_NOTE}${gradeLegend()}
  ${chartsSection(periods)}
  <section class="appendix"><h2>Phụ lục A. Số liệu kỳ</h2>${groupedPeriodTable(['Kỳ', 'Mức', 'Tiêu chí TEa đã chốt', 'Nguồn CV', 'Nguồn Bias', 'Bias RMS (cho MU)%'], sourceGroups, 'appx')}
  <h2>Phụ lục B. Thiết kế QC theo Westgard Sigma Rules</h2>${groupedPeriodTable(['Kỳ', 'Mức', 'Sigma', 'Bộ quy tắc QC gợi ý', 'Mức nguy cơ tham khảo', 'Hành động'], designGroups, 'appx')}${DESIGN_NOTE}
  <h2>Phụ lục C. Độ không đảm bảo đo (MU)</h2>${groupedPeriodTable(['Kỳ', 'Mức', ...MU_HEADERS], muGroups, 'appx')}</section>
  <p class="footer">Báo cáo được tạo từ dữ liệu Six Sigma đã lưu tại thời điểm in.</p>${signatureBlock()}</body></html>`;
}
