import { create } from 'zustand';
import type { SigmaPeriodView } from '../../shared/qc-api';

interface SigmaState {
  periods: SigmaPeriodView[];
  error: string | null;
  loadPeriods: (testId: string) => Promise<void>;
  savePeriod: (testId: string, period: string, tea: string, cv: string, biasEqa: string, uCal: string) => Promise<void>;
}

export const useSigmaStore = create<SigmaState>((set, get) => ({
  periods: [],
  error: null,

  loadPeriods: async (testId: string) => {
    const periods = await window.qcApi.listSigmaPeriods(testId);
    set({ periods });
  },
  savePeriod: async (testId, period, tea, cv, biasEqa, uCal) => {
    const result = await window.qcApi.saveSigmaPeriod({
      testId, period,
      tea: tea === '' ? undefined : Number(tea),
      levels: [{
        level: 1,
        cv: cv === '' ? undefined : Number(cv),
        biasEqa: biasEqa === '' ? undefined : Number(biasEqa),
        uCal: uCal === '' ? undefined : Number(uCal),
      }],
    });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().loadPeriods(testId);
  },
}));
