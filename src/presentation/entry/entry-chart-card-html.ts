type EntryChartCardInput = {
  active: boolean;
  parallel: boolean;
  level: number;
  lot: string;
  previousLot: boolean;
  pointCount: number;
  headerActionHtml: string;
  statsHtml: string;
  testId: string;
  mean: string;
  sd: string;
  start: string;
  end: string;
};

type EntryChartCardDependencies = { escape: (value: unknown) => string };

export function createEntryChartCardHtml(deps: EntryChartCardDependencies) {
  return (input: EntryChartCardInput) => `<div class="lj-mini ${input.active ? 'on' : ''}${input.parallel ? ' lj-mini-parallel' : ''}" onclick="entryFocusLevel(${input.level})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();entryFocusLevel(${input.level})}" role="button" tabindex="0" aria-label="Chọn mức ${input.level}, lô ${deps.escape(input.lot || '?')}, ${input.pointCount} điểm${input.parallel ? ', lô chạy song song' : ''}"><div class="lj-mini-h"><b>Mức ${input.level} · ${input.previousLot ? 'Lô cũ' : 'Lô'} ${deps.escape(input.lot || '?')}${input.parallel ? ' <span class="qc-parallel-label">Song song</span>' : ''}<span class="lj-point-count">${input.pointCount} điểm</span></b>${input.headerActionHtml}</div><div class="lj-qc-strip" tabindex="0">${input.statsHtml}</div><div class="chart-scroll" tabindex="0"><canvas class="entryLJStack" data-render-scale="2" data-test="${deps.escape(input.testId)}" data-level="${input.level}" data-lot="${deps.escape(input.lot)}" data-mean="${deps.escape(input.mean)}" data-sd="${deps.escape(input.sd)}" data-start="${deps.escape(input.start)}" data-end="${deps.escape(input.end)}" width="1400" height="380"></canvas></div></div>`;
}
