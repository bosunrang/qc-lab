// Zustand store cho trang Six Sigma — chỉ SigmaPage.tsx dùng. `savePeriod`
// nhận nguyên `levels[]` (mỗi phần tử đã gồm eqaRounds/muBiasMode nếu có) để
// modal Bias/MU tự quản lý state của mình rồi gọi thẳng, không cần store
// biết cấu trúc modal.
import { create } from 'zustand';
import type { SigmaPeriodView, IpcResult } from '../../shared/qc-api';

export interface SigmaLevelSaveInput {
  level: number; cv?: number; biasEqa?: number; eqaRounds?: number[]; uCal?: number; muBiasMode?: 'include' | 'exclude';
}

interface SigmaState {
  periods: SigmaPeriodView[];
  loadPeriods: (testId: string) => Promise<void>;
  savePeriod: (testId: string, period: string, tea: number | undefined, teaSource: string | undefined, levels: SigmaLevelSaveInput[]) => Promise<IpcResult<SigmaPeriodView>>;
  removePeriod: (id: string, testId: string) => Promise<IpcResult<{ id: string }>>;
}

export const useSigmaStore = create<SigmaState>((set, get) => ({
  periods: [],

  loadPeriods: async (testId) => set({ periods: await window.qcApi.listSigmaPeriods(testId) }),

  removePeriod: async (id, testId) => {
    const result = await window.qcApi.removeSigmaPeriod({ data: { id } });
    if (result.ok) await get().loadPeriods(testId);
    return result;
  },
  savePeriod: async (testId, period, tea, teaSource, levels) => {
    const result = await window.qcApi.saveSigmaPeriod({ testId, period, tea, teaSource, levels });
    if (result.ok) await get().loadPeriods(testId);
    return result;
  },
}));
