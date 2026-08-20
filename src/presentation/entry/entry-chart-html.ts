type EntryMetric = { label: string; value: string; control?: boolean };
type EntryLevelHead = { level: number; lot: string; parallel: boolean; tooltip: string };
type EntryLeveyJenningsMiniInput = { on: boolean; parallel: boolean; level: number; lot: string; pointCount: number; previousLot: boolean; metrics: EntryMetric[]; actionHtml: string; testId: string; mean: unknown; sd: unknown; start: string; end: string };

export function entryDayPresetButtons(days: unknown, customRange: boolean) {
  return [7, 14, 30, 60, 90].map(day => `<button class="${!customRange && days === day ? 'on' : ''}" data-action="entrySetDays" data-args="[${day}]">${day} ngày</button>`).join('');
}

export function createEntrySheetLevelHeads(deps: { escape: (value: unknown) => string; escapeAttribute: (value: unknown) => string }) {
  return (levels: EntryLevelHead[]) => levels.map(level => `<th class="qc-level-head" tabindex="0" data-qc-tooltip="${deps.escapeAttribute(level.tooltip)}" aria-label="Mức ${level.level}, lô ${deps.escapeAttribute(level.lot || '?')}. ${deps.escapeAttribute(level.tooltip)}">Mức ${level.level} · Lô ${deps.escape(level.lot || '?')}${level.parallel ? ' <span class="qc-parallel-label">Song song</span>' : ''}</th>`).join('');
}

export function createEntryLeveyJenningsMiniHtml(deps: { escape: (value: unknown) => string; escapeAttribute: (value: unknown) => string }) {
  return (input: EntryLeveyJenningsMiniInput) => {
    const metrics = input.metrics.map(metric => `<div class="lj-qc-stat${metric.control ? ' control' : ''}"><span class="k">${metric.label}</span><span class="v">${metric.value}</span></div>`).join('');
    const lot = input.lot || '?', previousLot = input.previousLot ? 'Lô cũ' : 'Lô';
    return `<div class="lj-mini ${input.on ? 'on' : ''}${input.parallel ? ' lj-mini-parallel' : ''}" data-action="entryFocusLevel" data-args="[${input.level}]" data-keydown-action="entryFocusLevel" data-keydown-args="[${input.level}]" data-keydown-keys='["Enter"," "]' role="button" tabindex="0" aria-label="Chọn mức ${input.level}, lô ${deps.escapeAttribute(lot)}, ${input.pointCount} điểm${input.parallel ? ', lô chạy song song' : ''}"><div class="lj-mini-h"><b>Mức ${input.level} · ${previousLot} ${deps.escape(lot)}${input.parallel ? ' <span class="qc-parallel-label">Song song</span>' : ''}<span class="lj-point-count">${input.pointCount} điểm</span></b>${input.actionHtml}</div><div class="lj-qc-strip" tabindex="0">${metrics}</div><div class="chart-scroll" tabindex="0"><canvas class="entryLJStack" data-render-scale="2" data-test="${deps.escapeAttribute(input.testId)}" data-level="${input.level}" data-lot="${deps.escapeAttribute(input.lot)}" data-mean="${deps.escapeAttribute(input.mean)}" data-sd="${deps.escapeAttribute(input.sd)}" data-start="${input.start}" data-end="${input.end}" width="1400" height="380"></canvas></div></div>`;
  };
}
