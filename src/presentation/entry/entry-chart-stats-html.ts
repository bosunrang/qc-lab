type EntryChartStatsInput = {
  mean: string;
  sd: string;
  cv: string;
  targetMean: string;
  targetSd: string;
};

type EntryChartStatsDependencies = { escape: (value: unknown) => string };

export function createEntryChartStatsHtml(deps: EntryChartStatsDependencies) {
  const metric = (label: string, value: string, control = false) => `<div class="lj-qc-stat${control ? ' control' : ''}"><span class="k">${label}</span><span class="v">${deps.escape(value)}</span></div>`;
  return (input: EntryChartStatsInput) => metric('Mean thực', input.mean) + metric('SD thực', input.sd) + metric('CV thực', input.cv) + metric('Mean mục tiêu', input.targetMean, true) + metric('SD mục tiêu', input.targetSd, true);
}
