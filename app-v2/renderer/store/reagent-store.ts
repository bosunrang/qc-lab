// Zustand store cho trang So sánh hóa chất — chỉ ReagentPage.tsx dùng. Mọi
// hàm ghi trả `IpcResult` để form hiển thị đúng lỗi của chính nó.
import { create } from 'zustand';
import type { ReagentComparisonView, IpcResult } from '../../shared/qc-api';

interface ReagentState {
  comparisons: ReagentComparisonView[];
  load: () => Promise<void>;
  create: (name: string, unit: string) => Promise<IpcResult<ReagentComparisonView>>;
  saveMetadata: (id: string, data: Record<string, unknown>) => Promise<IpcResult<ReagentComparisonView>>;
  saveRows: (id: string, rows: [string, string][]) => Promise<IpcResult<ReagentComparisonView>>;
  remove: (id: string) => Promise<IpcResult<{ id: string }>>;
}

export const useReagentStore = create<ReagentState>((set, get) => ({
  comparisons: [],

  load: async () => set({ comparisons: await window.qcApi.listReagentComparisons() }),
  create: async (name, unit) => {
    const result = await window.qcApi.createReagentComparison({ data: { name, unit } });
    if (result.ok) await get().load();
    return result;
  },
  saveMetadata: async (id, data) => {
    const result = await window.qcApi.saveReagentMetadata({ id, data });
    if (result.ok) await get().load();
    return result;
  },
  saveRows: async (id, rows) => {
    const result = await window.qcApi.saveReagentRows({ id, rows });
    if (result.ok) await get().load();
    return result;
  },
  remove: async (id) => {
    const result = await window.qcApi.removeReagentComparison({ id });
    if (result.ok) await get().load();
    return result;
  },
}));
