type RowModel = {
  testId: string;
  lotId: string;
  locked: boolean;
  checked: boolean;
  disabled: boolean;
  name: unknown;
  unit: unknown;
  mean: unknown;
  low: unknown;
  high: unknown;
  sd: unknown;
  status: 'retired' | 'linked' | 'planned' | 'other' | 'empty';
  retiredTo?: unknown;
  otherLot?: unknown;
};

export function targetMatrixRowHtml(model: RowModel, escape: (value: unknown) => string, escapeAttribute: (value: unknown) => string) {
  const statusHtml = model.status === 'retired'
    ? `<b class="tag rej">${model.retiredTo ? `Đã chuyển tiếp qua lô ${escape(model.retiredTo)}` : 'Đã chuyển tiếp'}</b>`
    : model.status === 'linked' ? '<b class="tag ok">Đã gán</b>'
      : model.status === 'planned' ? '<b class="tag warn">Dự kiến</b>'
        : model.status === 'other' ? `<b class="tag warn">Đang dùng ${escape(model.otherLot || 'lô khác')}</b>`
          : '<b class="tag none">Chưa gán</b>';
  return `<div class="target-row${model.locked ? ' target-row-locked' : ''}" data-test="${model.testId}" data-lot="${model.lotId}"${model.locked ? ' data-locked="1"' : ''}>
    <label class="lot-assay-check"><input class="tm-use" type="checkbox" ${model.checked ? 'checked' : ''} ${model.locked ? 'disabled' : ''} onchange="toggleTargetRow(this)"><span></span></label>
    <div class="lot-assay-name"><b>${escape(model.name)}</b><small>${escape(model.unit || 'Chưa có đơn vị')}</small></div>
    <input class="tm-mean" type="number" step="any" value="${escapeAttribute(model.mean)}" placeholder="Trung bình" oninput="syncTargetRange(this,'target')" ${model.disabled ? 'disabled' : ''}>
    <input class="tm-low" type="number" step="any" value="${escapeAttribute(model.low)}" placeholder="Giới hạn dưới" oninput="syncTargetRange(this,'limits')" ${model.disabled ? 'disabled' : ''}>
    <input class="tm-high" type="number" step="any" value="${escapeAttribute(model.high)}" placeholder="Giới hạn trên" oninput="syncTargetRange(this,'limits')" ${model.disabled ? 'disabled' : ''}>
    <input class="tm-sd" type="number" step="any" value="${escapeAttribute(model.sd)}" placeholder="Độ lệch chuẩn" oninput="syncTargetRange(this,'target')" ${model.disabled ? 'disabled' : ''}>
    <span>${statusHtml}</span>
  </div>`;
}
