type WestgardViewMode = 'current'|'archived';
type WestgardChartMode = 'lj'|'cusum';

export const westgardModeTabs = Object.freeze({
  view(mode: WestgardViewMode, archivedCount: number) {
    if (!archivedCount) return '';
    return `<div class="dayseg wg-view-mode"><button class="${mode==='current'?'on':''}" data-action="wgSetViewMode" data-args='["current"]'>Xét nghiệm đang vận hành</button><button class="${mode==='archived'?'on':''}" data-action="wgSetViewMode" data-args='["archived"]'>Nhóm lô đã dừng/lưu trữ (${archivedCount})</button></div>`;
  },
  chart(mode: WestgardChartMode) {
    return `<div class="dayseg wg-view-mode"><button class="${mode==='lj'?'on':''}" data-action="wgSetChartMode" data-args='["lj"]'>Levey-Jennings</button><button class="${mode==='cusum'?'on':''}" data-action="wgSetChartMode" data-args='["cusum"]'>Xu hướng CUSUM</button></div>`;
  },
});
