export type ManageLotGroupCardModel = { archived: boolean; name: string; note?: string; status: { cls: string; text: string }; lotsHtml: string; actionsHtml: string };

export function createManageLotGroupCardHtml(deps: { escape: (value: unknown) => string }) {
  return (model: ManageLotGroupCardModel) => `<div class="lot-group-card${model.archived ? ' lot-opt-depleted' : ''}"><div class="lot-group-card-h"><div><b>${deps.escape(model.name)}</b><small>${deps.escape(model.note || 'Nhóm lô để gán Mean/SD theo Panel')}</small></div><span class="tag ${model.status.cls}">${deps.escape(model.status.text)}</span></div><div class="lot-group-chipline">${model.lotsHtml || '<span class="hint">Chưa chọn lô</span>'}</div><div class="lot-group-actions">${model.actionsHtml}</div></div>`;
}
