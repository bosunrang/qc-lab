type Test = Record<string, any>;
type Issue = { t: Test; p: Record<string, any>; f: Record<string, any> };

export type ActionListPresentationDeps = {
  levelFor: (test: Test, level: number) => Record<string, any> | null;
};

export function createActionListPresentation(deps: ActionListPresentationDeps) {
  const levelShort = (test: Test | null | undefined, level: unknown, lotSnapshot?: unknown) => {
    const number = parseInt(String(level), 10);
    if (!Number.isFinite(number) || number <= 0) return 'Không gắn mức QC';
    const configured = test ? deps.levelFor(test, number) : null;
    const lot = lotSnapshot || configured?.lot || '?';
    return `M${number} · Lô ${lot}`;
  };
  const groupIssuesByTestDate = (issues: Issue[]) => {
    const groups: Array<{ t: Test; date: string; items: Issue[]; worst: string }> = [], byKey = new Map<string, typeof groups[number]>();
    issues.forEach(issue => {
      const key = `${issue.t.id}|${issue.p.date}`;
      let group = byKey.get(key);
      if (!group) { group = { t: issue.t, date: issue.p.date, items: [], worst: 'warn' }; byKey.set(key, group); groups.push(group); }
      group.items.push(issue);
      if (issue.f.level === 'rej') group.worst = 'rej';
    });
    return groups;
  };
  return Object.freeze({ levelShort, groupIssuesByTestDate });
}

export type ActionListPresentation = ReturnType<typeof createActionListPresentation>;
