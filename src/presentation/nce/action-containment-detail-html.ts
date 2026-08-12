export type ActionContainmentDetailModel = { status: string; correction?: string; note?: string; modern: boolean };

export function createActionContainmentDetailHtml(deps: { escape: (value: unknown) => string }) {
  return (model: ActionContainmentDetailModel) => `<li><b>Kiểm soát tức thời</b><div>${deps.escape(model.status || 'Chưa ghi')}</div>${model.modern ? `<div>${deps.escape(model.correction || 'Chưa ghi xử lý tức thời')}</div>` : ''}${model.note ? `<div class="hint">${deps.escape(model.note)}</div>` : ''}</li>`;
}
