export interface ActivityAuditPage<T> {
  page: number;
  pageCount: number;
  offset: number;
  rows: T[];
  resultFrom: number;
  resultTo: number;
}

export function activityAuditPagination<T>(items: unknown, page: unknown, pageSize: unknown): ActivityAuditPage<T> {
  const rows = Array.isArray(items) ? items as T[] : [];
  const size = Math.max(1, Number(pageSize) || 1);
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const offset = (safePage - 1) * size;
  return {
    page: safePage, pageCount, offset, rows: rows.slice(offset, offset + size),
    resultFrom: rows.length ? offset + 1 : 0, resultTo: Math.min(offset + size, rows.length),
  };
}
