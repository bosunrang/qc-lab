import { create } from 'zustand';
import type { PeriodLockRow, IpcResult, ReportTemplateSettings } from '../../shared/qc-api';

interface ReportState {
  locks: PeriodLockRow[];
  template: ReportTemplateSettings | null;
  loadLocks: () => Promise<void>;
  loadTemplate: () => Promise<void>;
  saveTemplate: (data: { formCode: string; version: string }) => Promise<IpcResult<ReportTemplateSettings>>;
  lock: (ym: string, note: string) => Promise<IpcResult<PeriodLockRow>>;
  unlock: (ym: string, note: string) => Promise<IpcResult<{ ym: string }>>;
}

export const useReportStore = create<ReportState>((set, get) => ({
  locks: [],
  template: null,

  loadLocks: async () => set({ locks: await window.qcApi.listPeriodLocks() }),
  loadTemplate: async () => set({ template: await window.qcApi.getReportTemplateSettings() }),
  saveTemplate: async (data) => {
    const result = await window.qcApi.saveReportTemplateSettings({ data });
    if (result.ok) set({ template: result.data });
    return result;
  },
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


