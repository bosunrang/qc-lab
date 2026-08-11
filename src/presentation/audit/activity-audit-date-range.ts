export interface ActivityAuditDateRange {
  from: string;
  to: string;
}

export function updateActivityAuditDateRange(current: ActivityAuditDateRange, field: unknown, value: unknown): ActivityAuditDateRange {
  let from = String(current.from || ''), to = String(current.to || ''), date = String(value || '');
  if (field === 'from') {
    from = date;
    if (from && to && from > to) to = from;
  } else {
    to = date;
    if (to && from && to < from) from = to;
  }
  return { from, to };
}
