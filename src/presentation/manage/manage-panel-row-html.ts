export type ManagePanelRowModel = { id: string; name: string; instrument: string; testsHtml: string; testCount: number; active: boolean };

export function createManagePanelRowHtml(deps: { escape: (value: unknown) => string; button: (label: string, action: string, variant: string) => string; quote: (value: unknown) => string }) {
  return (model: ManagePanelRowModel) => `<tr><td><b>${deps.escape(model.name)}</b></td><td>${deps.escape(model.instrument)}</td><td>${model.testsHtml || '—'}</td><td class="num">${model.testCount}</td><td><span class="tag ${model.active ? 'ok' : 'none'}">${model.active ? 'Đang dùng' : 'Tạm ngưng'}</span></td><td><div class="manage-actions">${deps.button('Sửa', `openConfigPanel('${deps.quote(model.id)}')`, 'ghost sm')}${deps.button('Xóa', `deleteConfigPanel('${deps.quote(model.id)}')`, 'danger sm')}</div></td></tr>`;
}
