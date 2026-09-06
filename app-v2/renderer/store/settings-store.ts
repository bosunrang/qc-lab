import { create } from 'zustand';
import type { LabProfile, IpcResult } from '../../shared/qc-api';

interface SettingsState {
  profile: LabProfile | null;
  storage: { dbFileBytes: number; path: string } | null;
  load: () => Promise<void>;
  loadStorage: () => Promise<void>;
  save: (data: { name: string; dept: string; address: string; brandTitle: string; brandSub: string; logoText?: string; logoData?: string; clearLogo?: boolean }) => Promise<IpcResult<LabProfile>>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  profile: null,
  storage: null,

  load: async () => set({ profile: await window.qcApi.getLabProfile() }),
  loadStorage: async () => set({ storage: await window.qcApi.getStorageInfo() }),
  save: async (data) => {
    const result = await window.qcApi.saveLabProfile({ data });
    if (result.ok) set({ profile: result.data });
    return result;
  },
}));
