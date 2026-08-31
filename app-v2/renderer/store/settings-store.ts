import { create } from 'zustand';
import type { LabProfile } from '../../shared/qc-api';

interface SettingsState {
  profile: LabProfile | null;
  error: string | null;
  saved: boolean;
  load: () => Promise<void>;
  save: (name: string, dept: string, address: string, brandTitle: string, brandSub: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  profile: null,
  error: null,
  saved: false,

  load: async () => {
    const profile = await window.qcApi.getLabProfile();
    set({ profile, error: null });
  },
  save: async (name, dept, address, brandTitle, brandSub) => {
    const result = await window.qcApi.saveLabProfile({ data: { name, dept, address, brandTitle, brandSub } });
    if (!result.ok) { set({ error: result.error.message, saved: false }); return; }
    set({ profile: result.data, error: null, saved: true });
  },
}));
