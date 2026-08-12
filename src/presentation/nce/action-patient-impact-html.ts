export function createActionPatientImpactHtml(deps: { escape: (value: unknown) => string }) {
  return (impact: string, action?: string) => `<li><b>Đánh giá ảnh hưởng bệnh nhân</b><div>${deps.escape(impact || 'Chưa đánh giá')}</div>${action ? `<div class="hint">${deps.escape(action)}</div>` : ''}</li>`;
}
