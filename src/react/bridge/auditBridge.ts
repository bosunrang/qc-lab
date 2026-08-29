/* Cầu nối sang các global cổ điển (window.X) cho trang Nhật ký hoạt động — xem
   ghi chú đầu dashboardBridge.ts về lý do phải đọc window.X một cách LƯỜI. */

export type AuditModel = {
  total: number;
  oversize: boolean;
  hardCap: number;
  chain: { idle: boolean; ok: boolean; checked: number; legacy: number; total?: number; brokenIndex?: number; reason?: string };
  rows: any[];
  filteredCount: number;
  page: number;
  pageCount: number;
  resultFrom: number;
  resultTo: number;
  pageSizes: number[];
  pageSize: number;
  query: string;
  from: string;
  to: string;
  hasFilter: boolean;
  brokenSeq: number | null;
};

const w = () => window as any;

export const auditModel = (): AuditModel => w().auditModel();
export const roleLabel = (role: string): string => w().roleLabel(role);
export const formatDateTimeVN = (value: string): string => w().formatDateTimeVN(value);
export const escapeHtml = (value: unknown): string => w().esc(value);
export const dateBoxHtml = (id: string, value: string, cls: string, attrs: string): string => w().dateBox(id, value, cls, attrs);
export const requireAdmin = (): boolean => w().requireAdmin();
export const headOnlyHtml = (title: string, subtitle: string): string => w().headOnly(title, subtitle);
export const auditSetQuery = (value: string) => w().auditSetQuery(value);
