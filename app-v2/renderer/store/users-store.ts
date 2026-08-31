import { create } from 'zustand';
import type { PublicUser } from '../../shared/qc-api';

interface UsersState {
  users: PublicUser[];
  error: string | null;
  load: () => Promise<void>;
  create: (username: string, name: string, role: string, password: string) => Promise<void>;
  update: (id: string, name: string, role: string, active: boolean) => Promise<void>;
  resetPassword: (id: string, newPassword: string) => Promise<void>;
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  error: null,

  load: async () => {
    const result = await window.qcApi.listUsers();
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null, users: result.data });
  },
  create: async (username, name, role, password) => {
    const result = await window.qcApi.createUser({ data: { username, name, role, password } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().load();
  },
  update: async (id, name, role, active) => {
    const result = await window.qcApi.updateUser({ id, data: { name, role, active } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
    await get().load();
  },
  resetPassword: async (id, newPassword) => {
    const result = await window.qcApi.resetUserPassword({ id, data: { newPassword } });
    if (!result.ok) { set({ error: result.error.message }); return; }
    set({ error: null });
  },
}));
