export type SigmaBiasSummaryInput = { validCount: number; signedMeanText: string; rmsText: string; mixedSigns: boolean };

export function sigmaBiasSummaryHtml(input: SigmaBiasSummaryInput) {
  if(!input.validCount)return '<span class="sg-eqa-empty">Chưa có vòng hợp lệ.</span>';
  const warning=input.mixedSigns?'<div class="sg-eqa-warning">Bias đổi dấu giữa các vòng — RMS giúp tránh triệt tiêu.</div>':'';
  return `<div><span>Số vòng hợp lệ</span><b>${input.validCount}</b></div><div><span>Bias có dấu TB</span><b>${input.signedMeanText}%</b></div><div><span>Bias RMS dùng tính Sigma</span><b class="sg-eqa-average">${input.rmsText}%</b></div>${warning}`;
}
