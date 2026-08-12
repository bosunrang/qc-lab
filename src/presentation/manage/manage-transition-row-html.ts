export type ManageTransitionRowModel = { id: string; panel: string; fromLot: string; toLot: string; startDate?: string; status: { cls: string; text: string }; movedHtml: string; approvalHtml: string };

export function createManageTransitionRowHtml(deps: { escape: (value: unknown) => string; button: (label: string, action: string, variant: string) => string; quote: (value: unknown) => string }) {
  return (model: ManageTransitionRowModel) => `<tr><td><b>${deps.escape(model.panel)}</b></td><td><div><b>${deps.escape(model.fromLot)}</b></div><div class="hint">→ ${deps.escape(model.toLot)}</div></td><td>${deps.escape(model.startDate || '—')}</td><td><span class="tag ${model.status.cls}">${deps.escape(model.status.text)}</span>${model.movedHtml}${model.approvalHtml}</td><td><div class="manage-actions">${deps.button('Sửa', `openLotTransitionV2('${deps.quote(model.id)}')`, 'ghost sm')}${deps.button('Xóa', `deleteLotTransition('${deps.quote(model.id)}')`, 'danger sm')}</div></td></tr>`;
}
