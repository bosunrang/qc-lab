export interface ActivityAuditFilterDependencies {
  searchText(value: unknown): string;
  isoDate(value: Date): string;
  formatDateTime(value: unknown): string;
  roleLabel(value: unknown): string;
}

export function createActivityAuditFilter(dependencies: ActivityAuditFilterDependencies) {
  const dateKey = (activity: Record<string, any> | null | undefined): string => {
    const date = new Date(activity && activity.ts);
    return Number.isFinite(+date) ? dependencies.isoDate(date) : '';
  };
  return {
    dateKey,
    filter(items: unknown, query: unknown, from: unknown, to: unknown): Record<string, any>[] {
      const text = dependencies.searchText(query);
      const start = String(from || ''), end = String(to || '');
      return (Array.isArray(items) ? items : []).filter(activity => {
        const date = dateKey(activity);
        if (start && (!date || date < start)) return false;
        if (end && (!date || date > end)) return false;
        if (!text) return true;
        return dependencies.searchText([
          activity.seq, dependencies.formatDateTime(activity.ts), activity.user, activity.username,
          dependencies.roleLabel(activity.role || 'viewer'), activity.type, activity.target, activity.detail,
        ].join(' ')).includes(text);
      }).slice().reverse();
    },
  };
}
