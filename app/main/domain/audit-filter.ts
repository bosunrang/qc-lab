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

/** Các trường tìm kiếm của một dòng nhật ký — cột cần có để so khớp. */
export type ActivitySearchFields = Pick<ActivityLike, 'seq' | 'ts' | 'user' | 'username' | 'role' | 'type' | 'target' | 'detail'>;

/** Chuỗi đem so khớp, đúng các giá trị người dùng thấy ở bảng Nhật ký (giờ
 * Việt Nam, nhãn vai trò), bỏ dấu. Main (`audit.query`) và hàm lọc thuần bên
 * dưới dùng chung để hai nơi không lệch nhau. */
export function activitySearchText(activity: ActivitySearchFields): string {
  return textKey([
    activity.seq, formatAuditDateTimeVN(activity.ts), activity.user, activity.username,
    roleLabel(activity.role), activity.type, activity.target, activity.detail,
  ].join(' '));
}

export function filterActivity(items: ActivityLike[], query: string, from: string, to: string): ActivityLike[] {
  const text = textKey(query);
  const start = String(from || ''), end = String(to || '');
  return items.filter(activity => {
    const date = dateKeyOf(activity);
    if (start && (!date || date < start)) return false;
    if (end && (!date || date > end)) return false;
    if (!text) return true;
    return activitySearchText(activity).includes(text);
  }).slice().reverse();
}

export interface ActivityPage<T> {
  page: number; pageCount: number; offset: number; rows: T[]; resultFrom: number; resultTo: number;
  filteredCount: number;
}

export type ActivityPageWindow = Omit<ActivityPage<never>, 'rows'> & { size: number };

/** Vị trí trang khi đã biết số dòng khớp — `audit.query` dùng để lấy đúng một
 * trang bằng SQL, `paginateActivity` dùng cho mảng đã có sẵn. */
export function activityPageWindow(count: number, page: number, pageSize: number): ActivityPageWindow {
  const size = Math.max(1, Number(pageSize) || 1);
  const pageCount = Math.max(1, Math.ceil(count / size));
  const safePage = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const offset = (safePage - 1) * size;
  return {
    page: safePage, pageCount, offset, size,
    resultFrom: count ? offset + 1 : 0, resultTo: Math.min(offset + size, count),
    filteredCount: count,
  };
}

export function paginateActivity<T>(items: T[], page: number, pageSize: number): ActivityPage<T> {
  const { size, ...window } = activityPageWindow(items.length, page, pageSize);
  return { ...window, rows: items.slice(window.offset, window.offset + size) };
}

export interface DateRange { from: string; to: string }

export function updateAuditDateRange(current: DateRange, field: 'from' | 'to', value: string): DateRange {
  let from = String(current.from || ''), to = String(current.to || ''), date = String(value || '');
  if (field === 'from') { from = date; if (from && to && from > to) to = from; }
  else { to = date; if (to && from && to < from) from = to; }
  return { from, to };
}


