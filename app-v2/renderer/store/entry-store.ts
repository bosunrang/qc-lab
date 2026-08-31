import { create } from 'zustand';
import type { QcPointView } from '../../shared/qc-api';

interface EntryState {
  points: QcPointView[];
  error: string | null;
  loadPoints: (testId: string, level: number) => Promise<void>;
  addPoint: (testId: string, level: number, date: string, val: number, runId: string) => Promise<void>;
  voidPoint: (testId: string, level: number, pointId: string, reason: string) => Promise<void>;
}

export const useEntryStore = create<EntryState>((set, get) => ({
  points: [],
  error: null,

  loadPoints: async (testId: string, level: number) => {
    const points = await window.qcApi.queryPoints(testId, level);
    set({ points });
  },
  addPoint: async (testId: string, level: number, date: string, val: number, runId: string) => {
    const result = await window.qcApi.addPoint({ data: { testId, level, date, val, runId } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().loadPoints(testId, level);
  },
  voidPoint: async (testId: string, level: number, pointId: string, reason: string) => {
    const result = await window.qcApi.voidPoint({ data: { pointId, reason } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().loadPoints(testId, level);
  },
}));
