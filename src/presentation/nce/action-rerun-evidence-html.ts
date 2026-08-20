type Evidence = { kind: string; cls: string; heading: string; label: string; context?: string; point?: Record<string, any> };

export function createActionRerunEvidenceHtml<T>(deps: {
  escape: (value: unknown) => string;
  pointValue: (point: unknown, test: T) => string;
  date: (value: unknown) => string;
  button: (label: string, action: string | { action: string; args?: unknown[] } | null, variant: string, title: string) => string;
}) {
  return (evidence: Evidence | null, testId: unknown, test: T) => {
    if (!evidence) return '';
    if (evidence.kind === 'pending') return `<div class="action-rerun-evidence ${evidence.cls}"><div class="action-rerun-mark" aria-hidden="true">QC</div><div class="action-rerun-copy"><small>Bằng chứng QC chạy lại</small><b>${deps.escape(evidence.heading)}</b><span>${deps.escape(evidence.label)}</span></div></div>`;
    const point = evidence.point!;
    const viewButton = deps.button('Xem điểm QC', { action: 'openActionQcEvidence', args: [testId, Number(point.level) || 0, point.id, point.date || '', point.lot || ''] }, 'ghost sm', 'Mở đúng điểm QC được dùng làm bằng chứng');
    return `<div class="action-rerun-evidence ${evidence.cls}"><div class="action-rerun-mark" aria-hidden="true">QC</div><div class="action-rerun-copy"><small>Bằng chứng QC chạy lại</small><b>${deps.escape(evidence.heading)}</b><span>${deps.pointValue(point, test)} ${deps.escape((test as any)?.unit || '')} · ${deps.date(point.date)} · ${deps.escape(point.runId || 'Không có mã lần chạy')}</span><span>${deps.escape(evidence.context || '')}</span></div><div class="action-rerun-actions">${viewButton}</div></div>`;
  };
}
