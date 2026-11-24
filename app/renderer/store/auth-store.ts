// Zustand store cho phiên đăng nhập — nguồn sự thật DUY NHẤT trong renderer
// cho "ai đang đăng nhập". main process cũng tự giữ actor riêng (index.ts) để
// đứng tên audit log; store này chỉ phản ánh lại cho UI, không phải nơi ra
// quyết định quyền (mọi gate thật nằm ở main/ipc/auth-handlers.ts).
import { create } from 'zustand';
import type { PublicUser, IpcResult } from '../../shared/qc-api';
import { onSessionEnded, SESSION_ENDED_MESSAGE } from '../lib/session-events';

type Status = 'checking' | 'needs-bootstrap' | 'logged-out' | 'logged-in';
export interface AuthFormError { code: string; message: string }

interface AuthState {
  status: Status;
  user: PublicUser | null;
  error: AuthFormError | null;
  init: () => Promise<void>;
  bootstrapAdmin: (username: string, name: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAvatar: (dataUrl: string) => Promise<IpcResult<{ avatar: string }>>;
  clearAvatar: () => Promise<IpcResult<{ avatar: string }>>;
  clearError: () => void;
  /** Đọc lại tài khoản đang đăng nhập từ DB — dùng sau khi đổi/xoá ảnh đại
   * diện (main không trả lại toàn bộ `PublicUser`, chỉ trả avatar mới). */
  refreshUser: () => Promise<void>;
  /** Phiên kết thúc từ phía main: về màn đăng nhập kèm lý do; không còn tài
   * khoản nào (vd vừa phục hồi bản sao lưu không kèm tài khoản) thì sang khởi tạo quản trị. */
  endSession: (message: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // App desktop luôn bắt đầu ở form đăng nhập; `init()` sẽ thay trạng thái
  // này bằng khởi tạo admin hoặc phiên đã xác thực ngay khi IPC phản hồi.
  status: 'logged-out',
  user: null,
  error: null,

  init: async () => {
    const hasAny = await window.qcApi.hasAnyUsers();
    if (!hasAny) { set({ status: 'needs-bootstrap' }); return; }
    const user = await window.qcApi.currentUser();
    set(user ? { status: 'logged-in', user } : { status: 'logged-out' });
  },

  bootstrapAdmin: async (username, name, password) => {
    const result = await window.qcApi.bootstrapAdmin({ data: { username, name, password } });
    if (!result.ok) { set({ error: result.error }); return; }
    set({ error: null, status: 'logged-out' });
  },

  login: async (username, password) => {
    const result = await window.qcApi.login({ data: { username, password } });
    if (!result.ok) { set({ error: result.error }); return; }
    set({ error: null, status: 'logged-in', user: result.data });
  },

  /** Ảnh đại diện LUÔN tự phục vụ (chỉ đổi của chính mình — xem
   * auth-handlers). Nạp lại `user` để avatar trên mọi trang đổi ngay. */
  setAvatar: async (dataUrl) => {
    const result = await window.qcApi.setAvatar({ data: { dataUrl } });
    if (result.ok) await get().refreshUser();
    return result;
  },
  clearAvatar: async () => {
    const result = await window.qcApi.clearAvatar();
    if (result.ok) await get().refreshUser();
    return result;
  },

  logout: async () => {
    await window.qcApi.logout();
    set({ status: 'logged-out', user: null, error: null });
  },

  clearError: () => set({ error: null }),

  refreshUser: async () => {
    const user = await window.qcApi.currentUser();
    if (user) set({ user });
  },

  endSession: async (message) => {
    set({ status: 'logged-out', user: null, error: { code: 'session-ended', message } });
    if (!(await window.qcApi.hasAnyUsers())) set({ status: 'needs-bootstrap' });
  },
}));

// Máy chủ LAN báo phiên kết thúc (401): về màn đăng nhập kèm lý do (GV5).
onSessionEnded(() => {
  if (useAuthStore.getState().status !== 'logged-in') return;
  void useAuthStore.getState().endSession(SESSION_ENDED_MESSAGE);
});


