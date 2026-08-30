import { useStore } from 'zustand';
import type { AppStoreState } from '../../application/state/app-store';

/* Kernel — thay cho `const w = () => window as any;` từng file bridge tự viết
   (xem kế hoạch kiến trúc "gỡ bỏ global bridge"). Vẫn đọc qua `window` (2
   bundle Vite tách biệt không chia sẻ module registry), nhưng qua ĐÚNG MỘT
   điểm, có kiểu rõ ràng theo từng miền — không còn `window.tenHamRoiRac`.
   Đọc LƯỜI (bên trong hàm, không phải top-level module) vì react-pilot.js
   chạy trước modular-pilot.js theo thứ tự script trong index.html; tới lúc
   một component thật sự gọi getKernel() thì modular-pilot.js đã chạy xong
   (boot() luôn ở sau DOMContentLoaded), nên không có rủi ro thứ tự. */
export interface QCKernel {
  store: { getState: () => AppStoreState; setState: (partial: Partial<AppStoreState>) => void; subscribe: (listener: () => void) => () => void };
  entry: any;
  actions: any;
  actionForm: any;
  sigma: any;
  westgard: any;
  reagent: any;
  report: any;
  settings: any;
  manage: any;
  dash: any;
  audit: any;
  users: any;
  pres: any;
}

export function getKernel(): QCKernel {
  const kernel = (window as any).__QC_KERNEL__;
  if (!kernel) throw new Error('window.__QC_KERNEL__ chưa sẵn sàng — component gọi getKernel() trước khi modular-pilot.js chạy xong boot().');
  return kernel;
}

/** Đọc `kernel.store` (Zustand vanilla) qua binding React thật — thay
 * `useRenderVersion()` cũ. `selector` mặc định lấy `revision` (đổi gì cũng vẽ
 * lại, đúng hành vi renderBus.ts cũ) — trang nào cần chọn lọc hơn có thể tự
 * truyền selector khác một khi kernel giữ thêm dữ liệu ngoài revision. */
export function useAppStore<T = number>(selector: (s: AppStoreState) => T = (s) => s.revision as unknown as T): T {
  return useStore(getKernel().store as any, selector as any);
}
