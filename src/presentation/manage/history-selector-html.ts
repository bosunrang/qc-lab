export function historySelectorHtml(optionsHtml: string, rowCount: number, pointCount: number) {
  return `<div class="target-selector history-selector">
      <div><label>Xét nghiệm</label><select onchange="setHistoryTest(this.value)">${optionsHtml}</select></div>
      <div class="target-lot-info"><b>${rowCount}</b><span>mốc lô/Mean-SD</span></div>
      <div class="target-lot-info"><b>${pointCount}</b><span>điểm QC đã nhập</span></div>
    </div>`;
}
