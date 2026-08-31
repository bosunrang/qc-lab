import { create } from 'zustand';
import type { NceRecord } from '../../shared/qc-api';

interface NceState {
  records: NceRecord[];
  error: string | null;
  load: () => Promise<void>;
  create: (input: { testId?: string; level?: number; lot?: string; date: string; rule?: string; errorType?: string; correction: string; dueDate?: string }) => Promise<boolean>;
  approve: (id: string) => Promise<void>;
  returnForRevision: (id: string, note: string) => Promise<void>;
  cancel: (id: string, note: string) => Promise<void>;
  setCompletedDate: (id: string, date: string) => Promise<void>;
  markEffectiveness: (id: string, status: 'effective' | 'ineffective', note?: string) => Promise<void>;
}

export const useNceStore = create<NceState>((set, get) => ({
  records: [],
  error: null,

  load: async () => {
    const records = await window.qcApi.listNceRecords();
    set({ records });
  },
  create: async (input) => {
    const result = await window.qcApi.createNce({ data: input });
    if (!result.ok) { set({ error: result.error.message }); return false; }
    set({ error: null });
    await get().load();
    return true;
  },
  approve: async (id) => {
    const result = await window.qcApi.approveNce({ data: { id } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().load();
  },
  returnForRevision: async (id, note) => {
    const result = await window.qcApi.returnNce({ data: { id, note } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().load();
  },
  cancel: async (id, note) => {
    const result = await window.qcApi.cancelNce({ data: { id, note } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().load();
  },
  setCompletedDate: async (id, date) => {
    const result = await window.qcApi.setNceCompletedDate({ data: { id, actionCompletedDate: date } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().load();
  },
  markEffectiveness: async (id, status, note) => {
    const result = await window.qcApi.markNceEffectiveness({ data: { id, status, note } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().load();
  },
}));
