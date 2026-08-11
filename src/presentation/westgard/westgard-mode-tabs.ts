type WestgardViewMode = 'current'|'archived';
type WestgardChartMode = 'lj'|'cusum';

export const westgardModeTabs = Object.freeze({
  view(mode: WestgardViewMode, archivedCount: number) {
    if (!archivedCount) return '';
    return `<div class="dayseg wg-view-mode"><button class="${mode==='current'?'on':''}" onclick="wgSetViewMode('current')">Xét nghiệm đang vận hành</button><button class="${mode==='archived'?'on':''}" onclick="wgSetViewMode('archived')">Nhóm lô đã dừng/lưu trữ (${archivedCount})</button></div>`;
  },
  chart(mode: WestgardChartMode) {
    return `<div class="dayseg wg-view-mode"><button class="${mode==='lj'?'on':''}" onclick="wgSetChartMode('lj')">Levey-Jennings</button><button class="${mode==='cusum'?'on':''}" onclick="wgSetChartMode('cusum')">Xu hướng CUSUM</button></div>`;
  },
});
