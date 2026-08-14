export type LotTransitionTargetRow = { testId: string; name: string; unit: string; mean: string; low: string; high: string; sd: string; assigned: boolean };
export type LotTransitionTargetsInput = { kind: 'hint' | 'rows'; message?: string; lotNo?: string; rows?: LotTransitionTargetRow[] };

export function lotTransitionTargetsHtml(input: LotTransitionTargetsInput) {
  if(input.kind==='hint')return `<div class="hint flow-section">${input.message || ''}</div>`;
  const rows=(input.rows || []).map(row => `<div class="target-row" data-test="${row.testId}">
      <label class="lot-assay-check"><input type="checkbox" checked disabled><span></span></label>
      <div class="lot-assay-name"><b>${row.name}</b><small>${row.unit || 'Chưa có đơn vị'}</small></div>
      <input class="tm-mean" type="number" step="any" value="${row.mean}" placeholder="Trung bình" oninput="syncTargetRange(this,'target')">
      <input class="tm-low" type="number" step="any" value="${row.low}" placeholder="Giới hạn dưới" oninput="syncTargetRange(this,'limits')">
      <input class="tm-high" type="number" step="any" value="${row.high}" placeholder="Giới hạn trên" oninput="syncTargetRange(this,'limits')">
      <input class="tm-sd" type="number" step="any" value="${row.sd}" placeholder="Độ lệch chuẩn" oninput="syncTargetRange(this,'target')">
      <span>${row.assigned?'<b class="tag ok">Đã nhập</b>':'<b class="tag none">Chưa nhập</b>'}</span>
    </div>`).join('');
  return `<div class="lot-trans-target-head-row"><label>Mean/SD cho lô mới ${input.lotNo || ''}</label><input type="search" class="lot-trans-target-search" placeholder="Tìm xét nghiệm..." oninput="filterLotTransitionTargets(this.value)"></div>
    <div class="target-table lot-trans-target-table"><div class="target-head"><span></span><span>Xét nghiệm</span><span>Trung bình mục tiêu</span><span>Giới hạn dưới</span><span>Giới hạn trên</span><span>Độ lệch chuẩn</span><span>Trạng thái</span></div>${rows}</div>`;
}
