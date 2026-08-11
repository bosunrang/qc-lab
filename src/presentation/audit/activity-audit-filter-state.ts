export interface ActivityAuditFilterState {
  query: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
}

export const ACTIVITY_AUDIT_PAGE_SIZES = Object.freeze([25, 50, 100]);

export const activityAuditFilterState = Object.freeze({
  withQuery(state: ActivityAuditFilterState, value: unknown): ActivityAuditFilterState {
    return { ...state, query: String(value || ''), page: 1 };
  },
  withPageSize(state: ActivityAuditFilterState, value: unknown, allowedSizes: unknown): ActivityAuditFilterState {
    const allowed = Array.isArray(allowedSizes) ? allowedSizes.map(Number) : [];
    const size = Number(value);
    return { ...state, pageSize: allowed.includes(size) ? size : 25, page: 1 };
  },
  withPage(state: ActivityAuditFilterState, value: unknown): ActivityAuditFilterState {
    return { ...state, page: Math.max(1, Number(value) || 1) };
  },
  cleared(state: ActivityAuditFilterState): ActivityAuditFilterState {
    return { ...state, query: '', from: '', to: '', page: 1 };
  },
});
