import { textKey } from './text-utils';
import { roleLabel } from './page-roles';
import { formatAuditDateTimeVN } from './audit-format';

export interface ActivityLike {
  seq: number; ts: string; user: string; username: string; role: string;
  type: string; detail: string; target: string; prevHash: string; hash: string;
}

function dateKeyOf(activity: ActivityLike): string {
  const date = new Date(activity?.ts);
  return Number.isFinite(+date) ? date.toISOString().slice(0, 10) : '';
}

export function filterActivity(items: ActivityLike[], query: string, from: string, to: string): ActivityLike[] {
  const text = textKey(query);
  const start = String(from || ''), end = String(to || '');
  return items.filter(activity => {
    const date = dateKeyOf(activity);
    if (start && (!date || date < start)) return false;
    if (end && (!date || date > end)) return false;
    if (!text) return true;
    return textKey([
      activity.seq, formatAuditDateTimeVN(activity.ts), activity.user, activity.username,
      roleLabel(activity.role), activity.type, activity.target, activity.detail,
    ].join(' ')).includes(text);
  }).slice().reverse();
}

export interface ActivityPage<T> {
  page: number; pageCount: number; offset: number; rows: T[]; resultFrom: number; resultTo: number;
  filteredCount: number;
}

export function paginateActivity<T>(items: T[], page: number, pageSize: number): ActivityPage<T> {
  const size = Math.max(1, Number(pageSize) || 1);
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const safePage = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const offset = (safePage - 1) * size;
  return {
    page: safePage, pageCount, offset, rows: items.slice(offset, offset + size),
    resultFrom: items.length ? offset + 1 : 0, resultTo: Math.min(offset + size, items.length),
    filteredCount: items.length,
  };
}

export interface DateRange { from: string; to: string }

export function updateAuditDateRange(current: DateRange, field: 'from' | 'to', value: string): DateRange {
  let from = String(current.from || ''), to = String(current.to || ''), date = String(value || '');
  if (field === 'from') { from = date; if (from && to && from > to) to = from; }
  else { to = date; if (to && from && to < from) from = to; }
  return { from, to };
}


