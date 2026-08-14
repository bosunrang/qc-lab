type ReagentResult = { level?: unknown } | null | undefined;
type ReagentPalette = { okBg: string; okFg: string; midBg: string; midFg: string; noBg: string; noFg: string; muted?: string };

export function formatReagentNumber(value: unknown, decimals = 4): string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(decimals)).toString() : '—';
}

export function formatReagentTStatistic(value: unknown): string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(4)).toString() : numeric > 0 ? '+∞' : '−∞';
}

export function reagentReportVerdict(result: ReagentResult, palette: ReagentPalette) {
  if (!result) return { text: 'Thiếu dữ liệu', cls: 'mid', bg: palette.midBg, fg: palette.midFg };
  if (result.level === 'ok') return { text: 'Đạt sàng lọc', cls: 'ok', bg: palette.okBg, fg: palette.okFg };
  if (result.level === 'mid') return { text: 'Chưa đủ điều kiện', cls: 'mid', bg: palette.midBg, fg: palette.midFg };
  return { text: 'Có khác biệt', cls: 'no', bg: palette.noBg, fg: palette.noFg };
}

export function reagentReportConclusion(result: ReagentResult): string {
  if (!result) return '';
  if (result.level === 'ok') return 'Không khác biệt có ý nghĩa theo tiêu chí sàng lọc phần mềm; trình phê duyệt theo SOP trước khi dùng lô mới.';
  if (result.level === 'mid') return 'Chưa đủ điều kiện sàng lọc phần mềm; cần bổ sung dữ liệu/xác nhận bao phủ hoặc ghi nhận ngoại lệ theo SOP.';
  return 'Có khác biệt vượt giới hạn; không dùng lô mới trước khi điều tra và xử lý.';
}

export function reagentReportPillHtml(verdict: { text: string; bg: string; fg: string }, esc: (value: unknown) => string): string {
  return `<span style="display:inline-block;border-radius:999px;padding:3px 9px;font-weight:800;font-size:var(--type-overline);background:${verdict.bg};color:${verdict.fg}">${esc(verdict.text)}</span>`;
}

export function reagentReportSubtitleHtml(subtitleHtml: string, muted: string): string {
  return `<div style="color:${muted};font-size:var(--type-meta);margin:-8px 0 14px;text-align:center">${subtitleHtml}</div>`;
}

export function reagentReportDetailMetaHtml(metadata: { lotOld: string; lotNew: string; dateText: string; operator: string; sampleType: string; biasTarget: string; alpha: string }, esc: (value: unknown) => string): string {
  return `<div class="hint space-after-control">Lô cũ: <b>${esc(metadata.lotOld)}</b> · Lô mới: <b>${esc(metadata.lotNew)}</b> · Ngày: ${esc(metadata.dateText)} · Người thực hiện: ${esc(metadata.operator)} · Loại mẫu: ${esc(metadata.sampleType)} · Giới hạn chênh lệch &lt; ${esc(metadata.biasTarget)}% · α = ${esc(metadata.alpha)}</div>`;
}

type ReagentReportMetrics = { meanOld: string; meanNew: string; correlation: string; tStatistic: string; df: unknown; p2: string; bias: string; olsSlope: string; olsInterceptSign: string; olsIntercept: string; olsR2: string; pbSlope: string; pbInterceptSign: string; pbIntercept: string };

export function reagentReportMetricsHtml(metrics: ReagentReportMetrics): string {
  return `<div style="display:flex;flex-wrap:wrap;gap:6px 24px;font-size:var(--type-meta);margin:10px 0 12px">
    <span>Trung bình: <b>${metrics.meanOld} / ${metrics.meanNew}</b></span>
    <span>Pearson r: <b>${metrics.correlation}</b></span>
    <span>t Stat: <b>${metrics.tStatistic}</b> (df ${metrics.df})</span>
    <span>P hai phía: <b>${metrics.p2}</b></span>
    <span>%Bias: <b>${metrics.bias}%</b></span>
    <span>OLS: <b>y=${metrics.olsSlope}x${metrics.olsInterceptSign}${metrics.olsIntercept}</b>, R²=${metrics.olsR2}</span>
    <span>Passing-Bablok: <b>y=${metrics.pbSlope}x${metrics.pbInterceptSign}${metrics.pbIntercept}</b></span>
  </div>`;
}

export function reagentReportConclusionHtml(conclusionHtml: string, muted: string): string {
  return `<p><b>Kết luận:</b> ${conclusionHtml}</p><p style="color:${muted}"><i>P-value, R² và slope là thông tin mô tả; không dùng riêng các chỉ số này để tự chấp nhận lô mới.</i></p>`;
}

type ReagentReportPair = { index: number; oldValue: unknown; newValue: unknown; average: string; difference: string };

export function reagentReportPairTableHtml(pairs: ReagentReportPair[]): string {
  const rows = pairs.map(row => `<tr><td>${row.index}</td><td class="num">${row.oldValue}</td><td class="num">${row.newValue}</td><td class="num">${row.average}</td><td class="num">${row.difference}</td></tr>`).join('');
  return '<table><thead><tr><th>Mẫu</th><th class="num">Lô cũ</th><th class="num">Lô mới</th><th class="num">Trung bình</th><th class="num">Hiệu số</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

export function reagentReportMissingDataHtml(minPairs: number): string {
  return `<p><i>Chưa đủ dữ liệu (cần tối thiểu ${minPairs} cặp).</i></p>`;
}

export function reagentReportSummaryTableHtml(items: Array<{ ds?: { test?: Record<string, any> }; R?: Record<string, any> | null }>, palette: ReagentPalette, esc: (value: unknown) => string): string {
  const rows = reagentReportSummaryRows(items, palette);
  const body = rows.map(row => `<tr><td class="num">${row.index}</td><td><b>${esc(row.reagent)}</b>${row.unit ? ` <span style="color:${palette.muted || ''}">(${esc(row.unit)})</span>` : ''}</td><td>${esc(row.lotOld)} → ${esc(row.lotNew)}</td><td class="num">${row.n}</td><td class="num">${row.r}</td><td class="num">${row.bias}</td><td class="num">${row.p2}</td><td>${reagentReportPillHtml(reagentReportVerdict(row.result, palette), esc)}</td></tr>`).join('');
  return '<table><thead><tr><th>STT</th><th>Hóa chất</th><th>Lô cũ → Lô mới</th><th class="num">n</th><th class="num">r</th><th class="num">%Bias</th><th class="num">P hai phía</th><th>Kết luận</th></tr></thead><tbody>' + body + '</tbody></table>';
}

export function reagentReportSummaryRows(items: Array<{ ds?: { test?: Record<string, any> }; R?: Record<string, any> | null }>, palette: ReagentPalette) {
  return (items || []).map((item, index) => {
    const test = item?.ds?.test || {}, result = item?.R || null;
    return {
      index: index + 1,
      reagent: String(test.reagent || 'Hóa chất mới'), unit: String(test.unit || ''),
      lotOld: String(test.lotOld || '?'), lotNew: String(test.lotNew || '?'), result,
      n: result ? result.N : '—', r: result ? formatReagentNumber(result.r, 4) : '—',
      bias: result ? `${formatReagentNumber(result.bias, 2)}%` : '—',
      p2: result ? formatReagentNumber(result.p2, 4) : '—', verdict: reagentReportVerdict(result, palette),
    };
  });
}

export function reagentReportDetailModel(result: Record<string, any> | null | undefined, test: Record<string, any>, minPairs: number, dateText: string) {
  const metadata = {
    reagent: String(test?.reagent || 'Hóa chất mới'), lotOld: String(test?.lotOld || '—'), lotNew: String(test?.lotNew || '—'),
    dateText, operator: String(test?.operator || '—'), sampleType: String(test?.sampleType || '—'),
    biasTarget: String(test?.biasTarget || 6), alpha: String(test?.alpha || 0.05),
  };
  if (!result) return { complete: false, minPairs, metadata, pairs: [], metrics: null, conclusion: '' };
  const pairs = (result.o || []).map((oldValue: number, index: number) => {
    const newValue = result.n[index];
    return { index: index + 1, oldValue, newValue, average: ((oldValue + newValue) / 2).toFixed(3), difference: (oldValue - newValue).toFixed(3) };
  });
  return {
    complete: true, minPairs, metadata, pairs,
    metrics: {
      meanOld: formatReagentNumber(result.mO, 2), meanNew: formatReagentNumber(result.mN, 2),
      correlation: formatReagentNumber(result.r, 5), tStatistic: formatReagentTStatistic(result.tStat), df: result.df,
      p2: formatReagentNumber(result.p2, 5), bias: formatReagentNumber(result.bias, 3),
      olsSlope: formatReagentNumber(result.fit.b, 3), olsIntercept: formatReagentNumber(Math.abs(result.fit.a), 3), olsInterceptSign: result.fit.a >= 0 ? '+' : '−', olsR2: formatReagentNumber(result.fit.r2, 4),
      pbSlope: formatReagentNumber(result.pb.b, 3), pbIntercept: formatReagentNumber(Math.abs(result.pb.a), 3), pbInterceptSign: result.pb.a >= 0 ? '+' : '−',
    },
    conclusion: reagentReportConclusion(result),
  };
}

export const reagentReportPresentation = Object.freeze({
  formatNumber: formatReagentNumber,
  formatTStatistic: formatReagentTStatistic,
  verdict: reagentReportVerdict,
  conclusion: reagentReportConclusion,
  pillHtml: reagentReportPillHtml,
  subtitleHtml: reagentReportSubtitleHtml,
  detailMetaHtml: reagentReportDetailMetaHtml,
  metricsHtml: reagentReportMetricsHtml,
  conclusionHtml: reagentReportConclusionHtml,
  pairTableHtml: reagentReportPairTableHtml,
  missingDataHtml: reagentReportMissingDataHtml,
  summaryTableHtml: reagentReportSummaryTableHtml,
  summaryRows: reagentReportSummaryRows,
  detailModel: reagentReportDetailModel,
});
