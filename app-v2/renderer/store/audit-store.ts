import { create } from 'zustand';
import type { ActivityPage, IpcResult } from '../../shared/qc-api';

const EMPTY_PAGE: ActivityPage = { page: 1, pageCount: 1, offset: 0, rows: [], resultFrom: 0, resultTo: 0, filteredCount: 0, total: 0 };

interface AuditState {
  result: ActivityPage;
  query: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  load: () => Promise<void>;
  setQuery: (query: string) => void;
  setRange: (from: string, to: string) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  clearFilters: () => void;
  exportCsv: () => Promise<string>;
  verifyChainNow: () => Promise<{ ok: boolean; checked: number; legacy: number; brokenIndex: number; reason: string }>;
  archive: (months: 12 | 24 | 36) => Promise<IpcResult<{ removedCount: number }>>;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  result: EMPTY_PAGE,
  query: '',
  from: '',
  to: '',
  page: 1,
  pageSize: 25,

  load: async () => {
    const { query, from, to, page, pageSize } = get();
    const result = await window.qcApi.queryActivity({ query, from, to, page, pageSize });
    set({ result });
  },
  setQuery: (query) => { set({ query, page: 1 }); get().load(); },
  setRange: (from, to) => { set({ from, to, page: 1 }); get().load(); },
  setPage: (page) => { set({ page }); get().load(); },
  setPageSize: (pageSize) => { set({ pageSize, page: 1 }); get().load(); },
  clearFilters: () => { set({ query: '', from: '', to: '', page: 1 }); get().load(); },
  exportCsv: async () => {
    const { query, from, to } = get();
    return window.qcApi.exportActivityCsv({ query, from, to });
  },
  verifyChainNow: () => window.qcApi.verifyActivityChainNow(),
  archive: async (months) => {
    const result = await window.qcApi.archiveActivity({ data: { months } });
    if (result.ok) await get().load();
    return result;
  },
}));
