type Action = Record<string, any>;

export type ActionDetailPresentationDeps = {
  sourceLabels: Record<string, string>;
  phaseLabels: Record<string, string>;
  riskLabels: Record<string, string>;
};

export function createActionDetailPresentation(deps: ActionDetailPresentationDeps) {
  const meta = (action: Action, context: {
    testName: string; levelShort: string; verdict: string; violation: { rule: string; errorType: string };
    riskScore: unknown; dueDate: string; overdueLabel: string; workflowLabel: string;
  }) => {
    const modern = Number(action.protocolVersion) >= 2;
    const rows: Array<{ label: string; value: string; note?: string }> = [
      { label: modern ? (action.nceId || 'Mã NCE') : 'Sự cố', value: `${context.testName} · ${context.levelShort}` },
      { label: 'Kết luận / luật / loại sai số', value: `${context.verdict ? `${context.verdict} · ` : ''}${context.violation.rule} · ${context.violation.errorType}` },
    ];
    if (!modern) return rows;
    rows.push(
      { label: 'Nguồn / giai đoạn', value: `${deps.sourceLabels[action.eventSource] || '—'} · ${deps.phaseLabels[action.processPhase] || '—'}` },
      { label: 'Nguy cơ', value: `${deps.riskLabels[action.riskLevel] || 'Chưa đánh giá'} · RPN ${context.riskScore || '—'}`, note: String(action.riskBasis || '') },
      { label: 'Phụ trách / hạn xử lý', value: `${action.by || '—'} · ${context.dueDate}${context.overdueLabel ? ` · ${context.overdueLabel}` : ''}` },
      { label: 'Trạng thái', value: context.workflowLabel },
    );
    return rows;
  };
  return Object.freeze({ meta });
}

export type ActionDetailPresentation = ReturnType<typeof createActionDetailPresentation>;
