type EntryCumulativeStatsInput = { endDate: string; count: number; mean: string; sd: string; cv: string };

type EntryCumulativeStatsDependencies = { escape: (value: unknown) => string };

export function createEntryCumulativeStatsHtml(deps: EntryCumulativeStatsDependencies) {
  return (input: EntryCumulativeStatsInput) => `<div class="qc-cumulative" title="Tính từ đầu LOT đến ${deps.escape(input.endDate)}"><div><span>N tích lũy</span><b>${deps.escape(input.count)}</b></div><div><span>Mean tích lũy</span><b>${deps.escape(input.mean)}</b></div><div><span>SD tích lũy</span><b>${deps.escape(input.sd)}</b></div><div><span>CV tích lũy</span><b>${deps.escape(input.cv)}</b></div></div>`;
}
