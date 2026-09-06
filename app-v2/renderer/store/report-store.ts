import { create } from 'zustand';
import type { PeriodLockRow, ReportPointRow, IpcResult } from '../../shared/qc-api';

interface ReportState {
  locks: PeriodLockRow[];
  points: ReportPointRow[];
  loadLocks: () => Promise<void>;
  lock: (ym: string, note: string) => Promise<IpcResult<PeriodLockRow>>;
  unlock: (ym: string, note: string) => Promise<IpcResult<{ ym: string }>>;
  loadPoints: (testId: string, from: string, to: string) => Promise<void>;
}

export const useReportStore = create<ReportState>((set, get) => ({
  locks: [],
  points: [],

  loadLocks: async () => set({ locks: await window.qcApi.listPeriodLocks() }),
  lock: async (ym, note) => {
    const result = await window.qcApi.lockPeriod({ data: { ym, note } });
    if (result.ok) await get().loadLocks();
    return result;
  },
  unlock: async (ym, note) => {
    const result = await window.qcApi.unlockPeriod({ data: { ym, note } });
    if (result.ok) await get().loadLocks();
    return result;
  },
  loadPoints: async (testId, from, to) => set({ points: await window.qcApi.queryReport({ testId, from, to }) }),
}));
