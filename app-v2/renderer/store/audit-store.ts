import { create } from 'zustand';
import type { ActivityPage } from '../../shared/qc-api';

const EMPTY_PAGE: ActivityPage = { page: 1, pageCount: 1, offset: 0, rows: [], resultFrom: 0, resultTo: 0 };

interface AuditState {
  result: ActivityPage;
  query: string;
  from: string;
  to: string;
  page: number;
  load: () => Promise<void>;
  setQuery: (query: string) => void;
  setRange: (from: string, to: string) => void;
  setPage: (page: number) => void;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  result: EMPTY_PAGE,
  query: '',
  from: '',
  to: '',
  page: 1,

  load: async () => {
    const { query, from, to, page } = get();
    const result = await window.qcApi.queryActivity({ query, from, to, page, pageSize: 25 });
    set({ result });
  },
  setQuery: (query: string) => { set({ query, page: 1 }); get().load(); },
  setRange: (from: string, to: string) => { set({ from, to, page: 1 }); get().load(); },
  setPage: (page: number) => { set({ page }); get().load(); },
}));
