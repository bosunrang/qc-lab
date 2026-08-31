import { create } from 'zustand';
import type { TestSummary, LevelAnalysis } from '../../shared/qc-api';

interface WestgardState {
  summaries: TestSummary[];
  analysis: LevelAnalysis | null;
  loadSummaries: () => Promise<void>;
  loadAnalysis: (testId: string, level: number) => Promise<void>;
  toggleRule: (testId: string, level: number, ruleId: string, on: boolean) => Promise<void>;
}

export const useWestgardStore = create<WestgardState>((set, get) => ({
  summaries: [],
  analysis: null,

  loadSummaries: async () => {
    const summaries = await window.qcApi.listTestSummaries();
    set({ summaries });
  },
  loadAnalysis: async (testId: string, level: number) => {
    const analysis = await window.qcApi.analyzeLevel(testId, level);
    set({ analysis });
  },
  toggleRule: async (testId: string, level: number, ruleId: string, on: boolean) => {
    await window.qcApi.saveRuleAction(testId, ruleId, on);
    await get().loadAnalysis(testId, level);
    await get().loadSummaries();
  },
}));
