import type { SigmaLevelResult, SigmaPeriodView } from '../../shared/qc-api';
import { mdcRatios, sigmaDesignEligible } from './sigma-workflow';

interface SigmaReportHeader {
  title: string;
  /** Hồ sơ đơn vị được lấy tức thời trước khi in, nên luôn theo dữ liệu đã
   * đồng bộ từ phần Cài đặt thay vì một bản sao cũ trong thẻ Sigma. */
  labName: string;
  labDept: string;
  labAddress: string;
  logoData: string;
  formCode: string;
  formVersion: string;
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

const LEVEL_COLORS = ['#0e4d4a', '#7a4f9a', '#c47d12', '#247c57'];
const SIGMA_LINES: Array<[number, string]> = [[2, '#c0362c'], [3, '#dd8b1f'], [4, '#b59a00'], [5, '#3f9a55'], [6, '#0e8f8f']];

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

function number(value: number | null | undefined, digits = 2): string {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
}

function periodLabel(period: string): string {
  return /^\d{4}-\d{2}$/.test(period) ? `Kỳ ${period.slice(5)}/${period.slice(0, 4)}` : period;
}

function reportPrintedDate(): string {
  return new Intl.DateTimeFormat('vi-VN').format(new Date());
}

/** Phần đầu biểu mẫu dùng chung cho báo cáo từng kỳ lẫn tổng hợp. Hồ sơ đơn
 * vị không bắt buộc, vì vậy khi chưa khai báo vẫn in được mà không để trống
 * một vùng nhận diện khó hiểu. */
function reportHeader(input: SigmaReportHeader, subtitle: string): string {
  const name = input.labName.trim() || 'Đơn vị xét nghiệm';
  const dept = input.labDept.trim();
  const address = input.labAddress.trim();
  const logo = input.logoData.startsWith('data:image/') ? `<div class="lab-logo"><img src="${escapeHtml(input.logoData)}" alt="Logo đơn vị"></div>` : '';
  return `<header class="report-header">${logo ? `<div class="lab-identity">${logo}<div class="lab-copy">` : '<div class="lab-identity"><div class="lab-copy">'}<div class="lab-name">${escapeHtml(name)}</div>${dept ? `<div class="lab-detail">${escapeHtml(dept)}</div>` : ''}${address ? `<div class="lab-detail lab-address">${escapeHtml(address)}</div>` : ''}</div></div><div class="document-control"><span>Mã biểu mẫu: ${escapeHtml(input.formCode)}</span><span>Phiên bản: ${escapeHtml(input.formVersion)}</span></div><div class="report-title">${escapeHtml(input.title)}</div><div class="report-subtitle">${escapeHtml(subtitle)}</div><div class="report-meta"><span>Dữ liệu Six Sigma tại thời điểm in</span><span>Ngày in: ${reportPrintedDate()}</span></div></header>`;
}

/** Chừa đủ khoảng trắng để ký tay sau khi in PDF; không gán người ký hoặc
 * xác nhận điện tử vì app hiện chưa có nghiệp vụ phê duyệt hồ sơ. */
function signatureBlock(): string {
  return `<section class="signatures" aria-label="Khu vực ký duyệt"><div><b>NGƯỜI LẬP BÁO CÁO</b><span>(Ký, ghi rõ họ tên)</span><i></i></div><div><b>NGƯỜI PHỤ TRÁCH</b><span>(Ký, ghi rõ họ tên)</span><i></i></div><div><b>PHÊ DUYỆT</b><span>(Ký, ghi rõ họ tên)</span><i></i></div></section>`;
}

const REPORT_CSS = `
  @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#183843;margin:0}.report-header{position:relative;border-bottom:2px solid #31869b;padding:0 0 8px;margin-bottom:10px;text-align:center}.lab-identity{display:flex;width:fit-content;align-items:center;gap:8px;text-align:center}.lab-logo{width:42px;height:42px;flex:0 0 42px}.lab-logo img{display:block;width:100%;height:100%;object-fit:contain}.lab-name{font-size:15px;font-weight:700;color:#215968;text-transform:uppercase}.lab-detail{margin-top:2px;color:#526975}.document-control{position:absolute;top:0;right:0;display:grid;gap:2px;text-align:right;color:#526975;font-size:8px}.report-title{font-size:18px;font-weight:700;color:#215968;margin-top:10px}.report-subtitle{margin-top:3px;color:#40515c}.report-meta{display:flex;justify-content:center;gap:12px;margin-top:7px;color:#526975;font-size:9px}h2{font-size:12px;color:#fff;background:#31869b;padding:6px 8px;margin:14px 0 0;break-after:avoid;text-align:left}h3{font-size:11px;margin:9px 0 5px;color:#215968}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #c9d9d6;padding:4px 5px;vertical-align:top;overflow-wrap:anywhere;text-align:center}th{background:#e9f1f2;font-weight:700}.setup th{width:21%;background:#f2f7f4;text-align:left}.setup td{width:29%;text-align:left}.wide{font-size:8px}.wide th{font-size:8px}tr{break-inside:avoid}.note{margin:6px 0;color:#455f69}.charts{break-before:page}.chart{break-inside:avoid;margin-top:8px}.chart svg{width:100%;height:auto;display:block}.chart svg text{font:10px Arial,sans-serif;fill:#526975}.chart svg .legend{font-weight:700;fill:#40515c}.chart svg .axis{font-weight:700;fill:#40515c}.empty-chart{padding:18px;border:1px solid #dce3e9;color:#526975}.footer{margin-top:10px;font-size:8px;color:#526975}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:22px;break-inside:avoid;text-align:center}.signatures b{display:block;font-size:9px}.signatures span{display:block;margin-top:3px;color:#526975;font-size:8px;font-style:italic}.signatures i{display:block;height:52px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

function sigmaZone(value: number | null | undefined): { label: string; color: string } {
  if (!Number.isFinite(value)) return { label: 'Chưa đủ dữ liệu', color: '#506674' };
  if (Number(value) >= 6) return { label: 'Đẳng cấp thế giới', color: '#13603f' };
  if (Number(value) >= 5) return { label: 'Xuất sắc', color: '#2c7d5c' };
  if (Number(value) >= 4) return { label: 'Tốt', color: '#3f9a55' };
  if (Number(value) >= 3) return { label: 'Cận biên', color: '#dd8b1f' };
  return { label: 'Không đạt', color: '#c0362c' };
}

function dpmo(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return '—';
  const numeric = Number(value);
  return numeric < 10 ? numeric.toFixed(2) : numeric < 1000 ? numeric.toFixed(0) : Math.round(numeric).toLocaleString('en-US');
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
  return level.eqaRounds.length ? `${level.eqaRounds.length} vòng EQA/EQC · RMS` : 'Nhập tay';
}

function designCells(level: SigmaLevelResult): [string, string, string] {
  if (!level.sigma) return ['—', 'Chưa đủ CV/Bias/TEa', 'Chưa đánh giá'];
  if (!sigmaDesignEligible(level) || !level.qualityDesign) {
    const reason = level.cvSource !== 'iqc-cohort' ? 'CV nhập tay' : level.cohortStale ? 'Cần nạp và rà soát lại' : !level.cohortReviewed ? 'Chưa xác nhận rà soát IQC' : level.cohortStatus === 'out-of-control' ? 'Mất kiểm soát chưa xử lý' : 'Chưa đủ điều kiện';
    return ['Chưa đưa gợi ý', reason, 'Không dùng để đề xuất QC'];
  }
  const design = level.qualityDesign;
  const run = `N=${design.n}${design.r > 1 ? ` · R=${design.r}` : ''}`;
  return [design.rules.join(' / '), `${design.risk} · ${run}`, design.plan];
}

function trendSvg(periods: SigmaPeriodView[]): string {
  const rows = [...periods].sort((left, right) => left.period.localeCompare(right.period)).filter((period) => period.levels.some((level) => Number.isFinite(level.sigma?.sigma)));
  if (!rows.length) return '<p class="empty-chart">Chưa có kỳ Sigma đủ dữ liệu để vẽ biểu đồ xu hướng.</p>';
  const levels = Array.from(new Set(rows.flatMap((period) => period.levels.filter((level) => Number.isFinite(level.sigma?.sigma)).map((level) => level.level)))).sort((left, right) => left - right);
  const values = rows.flatMap((period) => period.levels.flatMap((level) => Number.isFinite(level.sigma?.sigma) ? [Number(level.sigma!.sigma)] : []));
  const minimum = Math.min(0, Math.floor(Math.min(...values))), maximum = Math.max(8, Math.ceil(Math.max(...values)));
  const width = 940, height = 245, left = 44, right = 16, top = 30, bottom = 35, plotWidth = width - left - right, plotHeight = height - top - bottom;
  const x = (index: number) => rows.length === 1 ? left + plotWidth / 2 : left + 34 + index / (rows.length - 1) * (plotWidth - 68);
  const y = (value: number) => top + (maximum - value) / (maximum - minimum) * plotHeight;
  const bands = [[6, maximum, '#edf5ef'], [4, 6, '#f6faf6'], [3, 4, '#fff6df'], [minimum, 3, '#fdebea']]
    .map(([from, to, fill]) => `<rect x="${left}" y="${y(Number(to))}" width="${plotWidth}" height="${y(Number(from)) - y(Number(to))}" fill="${fill}"/>`).join('');
  const ticks = Array.from({ length: 5 }, (_, index) => minimum + (maximum - minimum) * index / 4)
    .map((value) => `<g><line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" stroke="#dde5e9"/><text x="${left - 7}" y="${y(value) + 4}" text-anchor="end">${Number(value.toFixed(1))}</text></g>`).join('');
  const references = [3, 6].map((value) => `<line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" stroke="${value === 3 ? '#cf5a52' : '#2f7d5b'}" stroke-dasharray="4 4"/>`).join('');
  const series = levels.map((level, levelIndex) => {
    const color = LEVEL_COLORS[levelIndex % LEVEL_COLORS.length];
    const points = rows.flatMap((period, index) => {
      const sigma = period.levels.find((item) => item.level === level)?.sigma?.sigma;
      return Number.isFinite(sigma) ? [{ x: x(index), y: y(Number(sigma)) }] : [];
    });
    const line = points.length > 1 ? `<polyline points="${points.map((point) => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="1.7"/>` : '';
    const dots = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}" stroke="#fff" stroke-width="1.2"/>`).join('');
    const legendX = left + levelIndex * 86;
    return `${line}${dots}<rect x="${legendX}" y="10" width="12" height="4" rx="2" fill="${color}"/><text x="${legendX + 17}" y="14" class="legend">Mức ${level}</text>`;
  }).join('');
  const labels = rows.map((period, index) => `<text x="${x(index)}" y="${height - 12}" text-anchor="middle">${escapeHtml(period.period.slice(5) + '/' + period.period.slice(0, 4))}</text>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Xu hướng Sigma theo kỳ"><rect x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}" fill="#fff" stroke="#dce3e9"/>${bands}${ticks}${references}${series}${labels}<line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" stroke="#42515b"/><line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="#42515b"/></svg>`;
}

function mdcSvg(periods: SigmaPeriodView[]): string {
  const rows = [...periods].sort((left, right) => left.period.localeCompare(right.period));
  const points = rows.flatMap((period, periodIndex) => period.levels.flatMap((level) => {
    const ratios = mdcRatios(level);
    return ratios ? [{ ...ratios, level: level.level, periodIndex }] : [];
  }));
  if (!points.length) return '<p class="empty-chart">Chưa có TEa, CV IQC và Bias RMS EQA/EQC đầy đủ để vẽ biểu đồ MDC.</p>';
  const levels = Array.from(new Set(points.map((point) => point.level))).sort((left, right) => left - right);
  const scale = (observed: number, floor: number) => Math.ceil(Math.max(floor, observed) / 20) * 20;
  const xMax = scale(Math.max(...points.map((point) => point.cvRatio)), 60), yMax = scale(Math.max(...points.map((point) => point.biasRatio)), 100);
  const width = 940, height = 265, left = 48, right = 16, top = 30, bottom = 42, plotWidth = width - left - right, plotHeight = height - top - bottom;
  const x = (value: number) => left + value / xMax * plotWidth, y = (value: number) => height - bottom - value / yMax * plotHeight;
  const ticks = [0, .25, .5, .75, 1].map((ratio) => {
    const value = Number((ratio * yMax).toFixed(1));
    return `<g><line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" stroke="#e5ecef"/><text x="${left - 7}" y="${y(value) + 4}" text-anchor="end">${value}</text></g>`;
  }).join('');
  const lines = SIGMA_LINES.map(([sigma, color]) => {
    const endX = Math.min(xMax, 100 / sigma), endY = 100 - sigma * endX;
    return `<line x1="${x(0)}" y1="${y(100)}" x2="${x(endX)}" y2="${y(endY)}" stroke="${color}"/><text x="${x(endX) + 4}" y="${y(endY) - 5}" fill="${color}" font-weight="700">${sigma}σ</text>`;
  }).join('');
  const marks = points.map((point) => {
    const color = LEVEL_COLORS[levels.indexOf(point.level) % LEVEL_COLORS.length];
    return `<circle cx="${x(point.cvRatio)}" cy="${y(point.biasRatio)}" r="4.5" fill="${color}" stroke="#fff" stroke-width="1.2"/>`;
  }).join('');
  const legend = levels.map((level, index) => { const color = LEVEL_COLORS[index % LEVEL_COLORS.length], legendX = left + index * 86; return `<rect x="${legendX}" y="10" width="12" height="4" rx="2" fill="${color}"/><text x="${legendX + 17}" y="14" class="legend">Mức ${level}</text>`; }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ quyết định phương pháp MDC"><rect x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}" fill="#fff" stroke="#dce3e9"/>${ticks}${lines}${marks}${legend}<line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" stroke="#42515b"/><line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="#42515b"/><text x="${left + plotWidth / 2}" y="${height - 8}" text-anchor="middle" class="axis">CV / TEA (%)</text><text transform="translate(14 ${top + plotHeight / 2}) rotate(-90)" text-anchor="middle" class="axis">|BIAS| / TEA (%)</text></svg>`;
}

export function buildSigmaPeriodPrintHtml(input: SigmaPeriodPrintInput): string {
  const statusRows = input.period.levels.map((level) => {
    const zone = sigmaZone(level.sigma?.sigma);
    return [`Mức ${level.level}`, `${number(level.tea)}%`, `${number(level.cv)}%`, `${number(level.biasEqa)}%`, number(level.sigma?.sigma), zone.label, dpmo(level.sigma?.dpmo), `${number(level.sigma?.yieldPercent, 2)}%`];
  });
  const dataRows = input.period.levels.map((level) => [
    `Mức ${level.level}`, `${number(level.tea)}%`, level.targetMean == null ? '—' : `${number(level.targetMean, 4)}${input.unit ? ` ${input.unit}` : ''}`,
    `${number(level.cv)}%`, cvSource(level), `${number(level.biasEqa)}%`, biasSource(level), level.eqaRounds.length > 1 && level.biasMean != null ? `${number(level.biasMean)}%` : '—', level.teaCriterion || '—',
  ]);
  const designRows = input.period.levels.map((level) => {
    const [rules, risk, action] = designCells(level);
    return [`Mức ${level.level}`, number(level.sigma?.sigma), rules, risk, action];
  });
  const muRows = input.period.levels.map((level) => {
    const mu = level.mu;
    const state = !mu ? 'Chưa có CV IQC' : !mu.complete ? 'Chưa đủ thành phần' : mu.withinTea === false ? 'U vượt TEa' : 'Đủ thành phần';
    return [`Mức ${level.level}`, number(mu?.uRw, 4), number(mu?.uCref, 4), number(mu?.uBias, 4), number(mu?.uCal, 4), number(mu?.uc, 4), mu?.complete ? number(mu.U, 4) : '—', mu?.complete && mu.teaRatio != null ? `${number(mu.teaRatio * 100, 1)}%` : '—', state, mu?.missing?.join(', ') || '—'];
  });
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title><style>${REPORT_CSS}.status td:nth-child(5),.status td:nth-child(6){font-weight:700}</style></head><body>${reportHeader(input, `${input.testName}${input.unit ? ` (${input.unit})` : ''} · ${periodLabel(input.period.period)}`)}
  <h2>Thiết lập phân tích</h2>${setupTable(input)}
  <h2>Kết quả theo mức QC</h2>${table(['Mức', 'TEa', 'CV IQC', 'Bias RMS EQA/EQC', 'Sigma', 'Xếp loại', 'DPMO', 'Yield'], statusRows, 'status')}
  <h2>Số liệu kỳ</h2>${table(['Mức', 'TEa', 'Mean mục tiêu', 'CV IQC', 'Nguồn CV', 'Bias RMS', 'Nguồn Bias', 'Bias TB có dấu', 'Tiêu chí TEa'], dataRows, 'wide')}
  <h2>Thiết kế QC theo Sigma (OPSpecs)</h2>${table(['Mức', 'Sigma', 'Bộ quy tắc QC gợi ý', 'Mức nguy cơ tham khảo', 'Hành động'], designRows)}<p class="note">Gợi ý theo Westgard Sigma Rules là điểm khởi đầu; người phụ trách vẫn cần rà soát nguy cơ, độ ổn định hệ thống, khối lượng mẫu và hậu quả lâm sàng trước khi cấu hình luật QC.</p>
  <h2>Độ không đảm bảo đo (MU)</h2>${table(['Mức', 'u(Rw)', 'u(Cref)', 'u(bias)', 'u(cal)', 'u_c', 'U (k=2)', 'U / TEa', 'Trạng thái', 'Thành phần thiếu'], muRows, 'wide')}
  <section class="charts"><h2>Biểu đồ Sigma &amp; MDC</h2><div class="chart"><h3>Sigma theo mức QC</h3>${trendSvg([input.period])}</div><div class="chart"><h3>Biểu đồ quyết định phương pháp (MDC)</h3>${mdcSvg([input.period])}</div></section>
  <p class="footer">Báo cáo được tạo từ dữ liệu Six Sigma đã lưu tại thời điểm in.</p>${signatureBlock()}</body></html>`;
}

/** Bản in tổng hợp giữ cùng cấu trúc với báo cáo một kỳ: thiết lập, kết quả,
 * số liệu và biểu đồ; bảng kết quả dùng một dòng cho mỗi kỳ × mức QC. */
export function buildSigmaComparisonPrintHtml(input: SigmaComparisonPrintInput): string {
  const periods = [...input.periods].sort((left, right) => left.period.localeCompare(right.period));
  const detailGroups = periods.map((period) => ({ period: periodLabel(period.period), rows: period.levels
    .slice()
    .sort((left, right) => left.level - right.level)
    .map((level) => {
      const zone = sigmaZone(level.sigma?.sigma);
      return [
        `Mức ${level.level}`, `${number(level.tea ?? period.tea)}%`, `${number(level.cv)}%`, `${number(level.biasEqa)}%`,
        number(level.sigma?.sigma), zone.label, dpmo(level.sigma?.dpmo), `${number(level.sigma?.yieldPercent, 2)}%`,
      ];
    }) }));
  const sourceGroups = periods.map((period) => ({ period: periodLabel(period.period), rows: period.levels
    .slice()
    .sort((left, right) => left.level - right.level)
    .map((level) => [`Mức ${level.level}`, level.teaCriterion || '—', cvSource(level), biasSource(level), level.eqaRounds.length > 1 && level.biasMean != null ? `${number(level.biasMean)}%` : '—']) }));
  const designGroups = periods.map((period) => ({ period: periodLabel(period.period), rows: period.levels
    .slice()
    .sort((left, right) => left.level - right.level)
    .map((level) => {
      const [rules, risk, action] = designCells(level);
      return [`Mức ${level.level}`, number(level.sigma?.sigma), rules, risk, action];
    }) }));
  const muGroups = periods.map((period) => ({ period: periodLabel(period.period), rows: period.levels
    .slice()
    .sort((left, right) => left.level - right.level)
    .map((level) => {
      const mu = level.mu;
      const state = !mu ? 'Chưa có CV IQC' : !mu.complete ? 'Chưa đủ thành phần' : mu.withinTea === false ? 'U vượt TEa' : 'Đủ thành phần';
      return [`Mức ${level.level}`, number(mu?.uRw, 4), number(mu?.uCref, 4), number(mu?.uBias, 4), number(mu?.uCal, 4), number(mu?.uc, 4), mu?.complete ? number(mu.U, 4) : '—', mu?.complete && mu.teaRatio != null ? `${number(mu.teaRatio * 100, 1)}%` : '—', state, mu?.missing?.join(', ') || '—'];
    }) }));
  const today = new Intl.DateTimeFormat('vi-VN').format(new Date());
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title><style>${REPORT_CSS}td.period{vertical-align:middle;text-align:center;font-weight:700;background:#fff}thead{display:table-header-group}.summary{font-size:8px}.summary th{font-size:8px}.trace{font-size:8.4px}</style></head><body>${reportHeader(input, `${input.testName}${input.unit ? ` (${input.unit})` : ''} · Báo cáo so sánh các kỳ`)}
  <h2>Thiết lập báo cáo tổng hợp</h2>${comparisonSetupTable(input, periods, today)}
  <h2>Kết quả theo mức QC</h2>${groupedPeriodTable(['Kỳ', 'Mức', 'TEa', 'CV IQC', 'Bias RMS EQA/EQC', 'Sigma', 'Xếp loại', 'DPMO', 'Yield'], detailGroups, 'summary')}
  <p class="note">DPMO là quy đổi tham khảo với dịch 1,5σ.</p>
  <h2>Số liệu kỳ</h2>${groupedPeriodTable(['Kỳ', 'Mức', 'Tiêu chí TEa đã chốt', 'Nguồn CV', 'Nguồn Bias', 'Bias TB có dấu%'], sourceGroups, 'trace')}
  <h2>Thiết kế QC theo Sigma (OPSpecs)</h2>${groupedPeriodTable(['Kỳ', 'Mức', 'Sigma', 'Bộ quy tắc QC gợi ý', 'Mức nguy cơ tham khảo', 'Hành động'], designGroups, 'trace')}<p class="note">Gợi ý theo Westgard Sigma Rules là điểm khởi đầu; người phụ trách vẫn cần rà soát nguy cơ, độ ổn định hệ thống, khối lượng mẫu và hậu quả lâm sàng trước khi cấu hình luật QC.</p>
  <h2>Độ không đảm bảo đo (MU)</h2>${groupedPeriodTable(['Kỳ', 'Mức', 'u(Rw)', 'u(Cref)', 'u(bias)', 'u(cal)', 'u_c', 'U (k=2)', 'U / TEa', 'Trạng thái', 'Thành phần thiếu'], muGroups, 'summary')}
  <section class="charts"><h2>Biểu đồ Sigma &amp; MDC</h2><div class="chart"><h3>Xu hướng Sigma theo kỳ</h3>${trendSvg(periods)}</div><div class="chart"><h3>Biểu đồ quyết định phương pháp (MDC)</h3>${mdcSvg(periods)}</div></section>
  <p class="footer">Báo cáo được tạo từ dữ liệu Six Sigma đã lưu tại thời điểm in.</p>${signatureBlock()}</body></html>`;
}


