type Stats = { linked: number; other: number; empty: number; missing: number };

export function targetSummaryHtml(stats: Stats) {
  return `<div class="target-summary"><span class="ok"><b>${stats.linked}</b> đã gán mức này</span><span class="${stats.other ? 'warn' : 'none'}"><b>${stats.other}</b> đang dùng lô khác</span><span class="${stats.empty ? 'warn' : 'none'}"><b>${stats.empty}</b> chưa gán lô</span><span class="${stats.missing ? 'warn' : 'ok'}"><b>${stats.missing}</b> thiếu Mean/SD</span></div>`;
}
