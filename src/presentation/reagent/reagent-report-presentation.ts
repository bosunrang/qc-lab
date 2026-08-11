type ReagentResult = { level?: unknown } | null | undefined;
type ReagentPalette = { okBg: string; okFg: string; midBg: string; midFg: string; noBg: string; noFg: string };

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
  summaryRows: reagentReportSummaryRows,
  detailModel: reagentReportDetailModel,
});
