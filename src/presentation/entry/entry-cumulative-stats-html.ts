type EntryCumulativeStatsInput = { endDateText: string; count: number; mean: string; sd: string; cv: string };

export function entryCumulativeStatsHtml(input: EntryCumulativeStatsInput) {
  return `<div class="qc-cumulative" title="Tính từ đầu LOT đến ${input.endDateText}"><div><span>N tích lũy</span><b>${input.count}</b></div><div><span>Mean tích lũy</span><b>${input.mean}</b></div><div><span>SD tích lũy</span><b>${input.sd}</b></div><div><span>CV tích lũy</span><b>${input.cv}</b></div></div>`;
}
