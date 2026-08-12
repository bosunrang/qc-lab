export type ActionLegacyDetailModel = { action: string; owner: string; rerunLabel: string; approvalLabel: string };

export function createActionLegacyDetailHtml(deps: { escape: (value: unknown) => string }) {
  return (model: ActionLegacyDetailModel) => `<div class="action-detail-legacy"><b>Hành động đã ghi</b><div>${deps.escape(model.action || '—')}</div><div class="hint">${deps.escape(model.owner || '—')} · ${deps.escape(model.rerunLabel || 'Chưa có dữ liệu')} · ${deps.escape(model.approvalLabel)}</div></div>`;
}
