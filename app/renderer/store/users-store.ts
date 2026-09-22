import { create } from 'zustand';
import type { PublicUser, IpcResult } from '../../shared/qc-api';

interface CreateUserInput { username: string; name: string; initials: string; role: string; password: string; pagePerms: string[] }
/** `initials`/`pagePerms` bỏ trống = giữ nguyên (xem qc-api.d.ts) — nhờ vậy
 * nút Khoá/Mở khoá chỉ gửi đúng `active` mà không cần biết quyền hiện tại. */
interface UpdateUserInput { name: string; role: string; active: boolean; initials?: string; pagePerms?: string[] }

interface UsersState {
  users: PublicUser[];
  load: () => Promise<void>;
  create: (input: CreateUserInput) => Promise<IpcResult<PublicUser>>;
  update: (id: string, input: UpdateUserInput) => Promise<IpcResult<PublicUser>>;
  remove: (id: string) => Promise<IpcResult<{ id: string }>>;
  resetPassword: (id: string, newPassword: string) => Promise<IpcResult<{ id: string }>>;
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],

  load: async () => {
    const result = await window.qcApi.listUsers();
    if (result.ok) set({ users: result.data });
  },
  create: async (input) => {
    const result = await window.qcApi.createUser({ data: input });
    if (result.ok) await get().load();
    return result;
  },
  update: async (id, input) => {
    const result = await window.qcApi.updateUser({ id, data: input });
    if (result.ok) await get().load();
    return result;
  },
  remove: async (id) => {
    const result = await window.qcApi.deleteUser({ id });
    if (result.ok) await get().load();
    return result;
  },
  resetPassword: async (id, newPassword) => {
    return window.qcApi.resetUserPassword({ id, data: { newPassword } });
  },
}));
