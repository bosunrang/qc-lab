import { create } from 'zustand';
import type { PeriodLockRow, ReportPointRow } from '../../shared/qc-api';

interface ReportState {
  locks: PeriodLockRow[];
  points: ReportPointRow[];
  error: string | null;
  loadLocks: () => Promise<void>;
  lock: (ym: string, note: string) => Promise<void>;
  unlock: (ym: string, note: string) => Promise<void>;
  loadPoints: (testId: string, from: string, to: string) => Promise<void>;
}

export const useReportStore = create<ReportState>((set, get) => ({
  locks: [],
  points: [],
  error: null,

  loadLocks: async () => {
    const locks = await window.qcApi.listPeriodLocks();
    set({ locks });
  },
  lock: async (ym, note) => {
    const result = await window.qcApi.lockPeriod({ data: { ym, note } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().loadLocks();
  },
  unlock: async (ym, note) => {
    const result = await window.qcApi.unlockPeriod({ data: { ym, note } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().loadLocks();
  },
  loadPoints: async (testId, from, to) => {
    const points = await window.qcApi.queryReport({ testId, from, to });
    set({ points });
  },
}));
