type TimelineItem = { label: string; value: string; note?: string };

export function createActionEvidenceTimelineHtml(deps: { escape: (value: unknown) => string }) {
  return (items: TimelineItem[]) => `<div class="action-evidence-timeline" aria-label="Các mốc thời gian hồ sơ">${items.map(item => `<div><span>${deps.escape(item.label)}</span><b>${deps.escape(item.value)}</b>${item.note ? `<small>${deps.escape(item.note)}</small>` : ''}</div>`).join('')}</div>`;
}
