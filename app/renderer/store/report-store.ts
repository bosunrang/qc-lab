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
  // Không tự nạp lại sau khi ghi (kế hoạch kiến trúc D.1): main báo `period_locks`
  // sau commit và trang Báo cáo nạp lại qua `useStoreInvalidation` — tự nạp ở đây làm
  // danh sách nạp HAI lần. Không chỗ gọi nào đọc danh sách ngay sau `await`.
  lock: async (ym, note) => {
    const result = await window.qcApi.lockPeriod({ data: { ym, note } });
    return result;
  },
  unlock: async (ym, note) => {
    const result = await window.qcApi.unlockPeriod({ data: { ym, note } });
    return result;
  },
}));


