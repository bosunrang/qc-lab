import { create } from 'zustand';
import type { ReagentComparisonView } from '../../shared/qc-api';

interface ReagentState {
  comparisons: ReagentComparisonView[];
  error: string | null;
  load: () => Promise<void>;
  create: (name: string, unit: string) => Promise<void>;
  saveMetadata: (id: string, data: Record<string, unknown>) => Promise<void>;
  saveRows: (id: string, rows: [string, string][]) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useReagentStore = create<ReagentState>((set, get) => ({
  comparisons: [],
  error: null,

  load: async () => {
    const comparisons = await window.qcApi.listReagentComparisons();
    set({ comparisons });
  },
  create: async (name, unit) => {
    const result = await window.qcApi.createReagentComparison({ data: { name, unit } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().load();
  },
  saveMetadata: async (id, data) => {
    const result = await window.qcApi.saveReagentMetadata({ id, data });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().load();
  },
  saveRows: async (id, rows) => {
    const result = await window.qcApi.saveReagentRows({ id, rows });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().load();
  },
  remove: async (id) => {
    const result = await window.qcApi.removeReagentComparison({ id });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().load();
  },
}));
