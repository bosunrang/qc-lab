type Value = Record<string, any>;

export type ActionCurrentIssue = { t: Value; l: Value; p: Value; f: Value; rules: any[] };
export type ActionCurrentIssuesApi = ReturnType<typeof createActionCurrentIssues>;

export function createActionCurrentIssues(deps: {
  operationalTests: () => Value[];
  activeWestgard: (test: Value) => { views: { l: Value; pts?: Value[] }[]; byPoint: Map<any, Value> };
  pointWorkflowComplete: (pointId: unknown) => boolean;
}) {
  return () => {
    const output: ActionCurrentIssue[] = [];
    const rank: Record<string, number> = { rej: 2, warn: 1, ok: 0 };
    deps.operationalTests().forEach(test => {
      const westgard = deps.activeWestgard(test);
      westgard.views.forEach(view => {
        (view.pts || []).forEach(point => {
          const finding = westgard.byPoint.get(point.id);
          if (!finding || finding.level === 'ok' || deps.pointWorkflowComplete(point.id)) return;
          output.push({ t: test, l: view.l, p: point, f: finding, rules: finding.rules });
        });
      });
    });
    return output.sort((left, right) => (rank[right.f.level] || 0) - (rank[left.f.level] || 0) || String(right.p.date || '').localeCompare(String(left.p.date || '')));
  };
}
