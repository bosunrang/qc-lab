import { getKernel } from '../state/kernel';

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

export const auditModel = (): AuditModel => getKernel().audit.auditModel();
export const roleLabel = (role: string): string => getKernel().pres.roleLabel(role);
export const formatDateTimeVN = (value: string): string => getKernel().pres.formatDateTimeVN(value);
export const escapeHtml = (value: unknown): string => getKernel().pres.esc(value);
export const dateBoxHtml = (id: string, value: string, cls: string, attrs: string): string => getKernel().pres.dateBox(id, value, cls, attrs);
export const requireAdmin = (): boolean => getKernel().pres.requireAdmin();
export const headOnlyHtml = (title: string, subtitle: string): string => getKernel().pres.headOnly(title, subtitle);
export const auditSetQuery = (value: string) => getKernel().audit.auditSetQuery(value);
