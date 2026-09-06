// Zustand store cho trang Khắc phục sự cố (NCE) — chỉ ActionsPage.tsx dùng.
// Mọi hàm ghi trả `IpcResult` để form hiển thị đúng lỗi validate của chính
// nó, không dùng field `error` dùng chung nữa (khác bản thí điểm cũ).
import { create } from 'zustand';
import type { NceRecord, IpcResult } from '../../shared/qc-api';

interface NceCreateData {
  testId?: string; level?: number; lot?: string; date: string; pointId?: string; rule?: string;
  errorType?: string; correction: string; dueDate?: string;
  investigation?: string; causeCategory?: 'SE' | 'RE' | ''; causeDescription?: string;
}

interface NceState {
  records: NceRecord[];
  load: () => Promise<void>;
  create: (data: NceCreateData) => Promise<IpcResult<NceRecord>>;
  approve: (id: string) => Promise<IpcResult<NceRecord>>;
  returnForRevision: (id: string, note: string) => Promise<IpcResult<NceRecord>>;
  cancel: (id: string, note: string) => Promise<IpcResult<NceRecord>>;
  setCompletedDate: (id: string, date: string) => Promise<IpcResult<NceRecord>>;
  markEffectiveness: (id: string, status: 'effective' | 'ineffective', residualRisk?: string, note?: string) => Promise<IpcResult<NceRecord>>;
  setReleaseDecision: (id: string, decision: 'held' | 'released', note: string) => Promise<IpcResult<NceRecord>>;
  setRerunEvidence: (id: string, rerunPointId: string, note?: string) => Promise<IpcResult<NceRecord>>;
  reopen: (id: string, note?: string) => Promise<IpcResult<NceRecord>>;
}

export const useNceStore = create<NceState>((set, get) => ({
  records: [],

  load: async () => set({ records: await window.qcApi.listNceRecords() }),

  create: async (data) => {
    const result = await window.qcApi.createNce({ data });
    if (result.ok) await get().load();
    return result;
  },
  approve: async (id) => {
    const result = await window.qcApi.approveNce({ data: { id } });
    if (result.ok) await get().load();
    return result;
  },
  returnForRevision: async (id, note) => {
    const result = await window.qcApi.returnNce({ data: { id, note } });
    if (result.ok) await get().load();
    return result;
  },
  cancel: async (id, note) => {
    const result = await window.qcApi.cancelNce({ data: { id, note } });
    if (result.ok) await get().load();
    return result;
  },
  setCompletedDate: async (id, date) => {
    const result = await window.qcApi.setNceCompletedDate({ data: { id, actionCompletedDate: date } });
    if (result.ok) await get().load();
    return result;
  },
  markEffectiveness: async (id, status, residualRisk, note) => {
    const result = await window.qcApi.markNceEffectiveness({ data: { id, status, residualRisk, note } });
    if (result.ok) await get().load();
    return result;
  },
  setReleaseDecision: async (id, decision, note) => {
    const result = await window.qcApi.setNceReleaseDecision({ data: { id, decision, note } });
    if (result.ok) await get().load();
    return result;
  },
  setRerunEvidence: async (id, rerunPointId, note) => {
    const result = await window.qcApi.setNceRerunEvidence({ data: { id, rerunPointId, note } });
    if (result.ok) await get().load();
    return result;
  },
  reopen: async (id, note) => {
    const result = await window.qcApi.reopenNce({ data: { id, note } });
    if (result.ok) await get().load();
    return result;
  },
}));
