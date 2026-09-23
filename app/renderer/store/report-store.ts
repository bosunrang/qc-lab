import { create } from 'zustand';
import type { PeriodLockRow, IpcResult } from '../../shared/qc-api';

interface ReportState {
  locks: PeriodLockRow[];
  loadLocks: () => Promise<void>;
  lock: (ym: string, note: string) => Promise<IpcResult<PeriodLockRow>>;
  unlock: (ym: string, note: string) => Promise<IpcResult<{ ym: string }>>;
}

export const useReportStore = create<ReportState>((set, get) => ({
  locks: [],

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
}));
