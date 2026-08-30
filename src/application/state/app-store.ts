import { createStore } from 'zustand/vanilla';

/**
 * Notify-bus mỏng bọc quanh object `state` toàn cục hiện có — KHÔNG phải một
 * migration bất biến (immutable) thật sự. `state` vẫn được mutate tại chỗ như
 * hôm nay (xem docs/kiến trúc: 16 file gán `state.x=` trực tiếp ngoài tầm
 * dependency-injection); store này chỉ thay thế `renderBus.ts`/
 * `useRenderVersion.ts` tự viết bằng Zustand thật, dùng `revision` làm tín
 * hiệu "có gì đó đổi" để useSyncExternalStore-style subscriber vẽ lại. Đây là
 * lựa chọn thực dụng có chủ đích (xem kế hoạch kiến trúc), không phải làm dở.
 */
export interface AppStoreState {
  revision: number;
  touch: () => void;
}

export function createAppStore() {
  return createStore<AppStoreState>((set) => ({
    revision: 0,
    touch: () => set((s) => ({ revision: s.revision + 1 })),
  }));
}

export type AppStoreApi = ReturnType<typeof createAppStore>;
