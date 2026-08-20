export type LotGroupColumn = { level: number; lots: Array<{ id: string; lotNo: string; expiry: string; selected: boolean; depleted: boolean; locked: boolean; depletedLabel: string }> };

export function lotGroupColumnsHtml(columns: LotGroupColumn[]) {
  return columns.map(column => `<div class="lot-level-col"><div class="lot-level-title">Mức ${column.level}</div>${column.lots.map(lot => `<label class="${lot.depleted?'lot-opt-depleted':''}"${lot.locked?` title="Lô ${lot.depletedLabel} — không thể chọn"`:''}><input class="cfg-group-lot" type="checkbox" value="${lot.id}" ${lot.selected?'checked':''} ${lot.locked?'disabled':''} data-action="suggestConfigGroupName" data-action-on="change"><span><b>${lot.lotNo}</b><small>HSD ${lot.expiry}${lot.depleted?' · '+lot.depletedLabel:''}</small></span></label>`).join('')}</div>`).join('');
}
