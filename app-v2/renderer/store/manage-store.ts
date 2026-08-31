// Zustand store THẬT cho module thí điểm Cấu hình chung — component
// subscribe qua hook, tự vẽ lại đúng phần liên quan khi state đổi. Không còn
// object `state` lớn mutate tay + notify-bus thủ công như app cũ.
import { create } from 'zustand';
import type { Instrument, Test, TestLevel } from '../../shared/qc-api';

interface ManageState {
  instruments: Instrument[];
  tests: Test[];
  levelsByTestId: Record<string, TestLevel[]>;
  error: string | null;
  loadInstruments: () => Promise<void>;
  loadTests: () => Promise<void>;
  loadLevels: (testId: string) => Promise<void>;
  addInstrument: (name: string, manufacturer: string) => Promise<void>;
  addTest: (name: string, instrumentId: string, unit: string) => Promise<void>;
  addLevel: (testId: string, level: number, mean: string, sd: string) => Promise<void>;
}

export const useManageStore = create<ManageState>((set, get) => ({
  instruments: [],
  tests: [],
  levelsByTestId: {},
  error: null,

  loadInstruments: async () => {
    const instruments = await window.qcApi.listInstruments();
    set({ instruments });
  },
  loadTests: async () => {
    const tests = await window.qcApi.listTests();
    set({ tests });
  },
  loadLevels: async (testId: string) => {
    const levels = await window.qcApi.listTestLevels(testId);
    set(state => ({ levelsByTestId: { ...state.levelsByTestId, [testId]: levels } }));
  },
  addInstrument: async (name: string, manufacturer: string) => {
    const result = await window.qcApi.saveInstrument({ data: { name, manufacturer } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().loadInstruments();
  },
  addTest: async (name: string, instrumentId: string, unit: string) => {
    const result = await window.qcApi.saveTest({ data: { name, instrumentId, unit } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().loadTests();
  },
  addLevel: async (testId: string, level: number, mean: string, sd: string) => {
    const result = await window.qcApi.saveTestLevel({
      testId,
      data: { level, mean: mean === '' ? null : Number(mean), sd: sd === '' ? null : Number(sd) },
    });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().loadLevels(testId);
  },
}));
