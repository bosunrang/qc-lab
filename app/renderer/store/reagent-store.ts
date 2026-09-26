// Zustand store cho trang So sánh hóa chất — chỉ ReagentPage.tsx dùng. Mọi
// hàm ghi trả `IpcResult` để form hiển thị đúng lỗi của chính nó.
import { create } from 'zustand';
import type { ReagentComparisonView, IpcResult } from '../../shared/qc-api';

interface ReagentState {
  quickValues: { operator: string[]; sampleType: string[] };
  loadQuickValues: () => Promise<void>;
  addQuickValue: (type: 'operator' | 'sampleType', value: string) => Promise<IpcResult<{ items: string[]; value: string }>>;
  /** Xoá theo VỊ TRÍ, không theo giá trị — khớp `reagent-handlers`. */
  removeQuickValue: (type: 'operator' | 'sampleType', index: number) => Promise<IpcResult<{ items: string[] }>>;
  comparisons: ReagentComparisonView[];
  load: () => Promise<void>;
  create: (name: string, unit: string) => Promise<IpcResult<ReagentComparisonView>>;
  saveMetadata: (id: string, data: Record<string, unknown>) => Promise<IpcResult<ReagentComparisonView>>;
  saveRows: (id: string, rows: [string, string][]) => Promise<IpcResult<ReagentComparisonView>>;
  remove: (id: string) => Promise<IpcResult<{ id: string }>>;
}

export const useReagentStore = create<ReagentState>((set, get) => ({
  /** "Chọn nhanh" người thực hiện / loại mẫu — 1 danh sách CHUNG toàn app,
   * lưu ở `app_meta` (xem reagent-handlers). */
  quickValues: { operator: [], sampleType: [] },
  loadQuickValues: async () => {
    const [operator, sampleType] = await Promise.all([
      window.qcApi.listReagentQuickValues({ type: 'operator' }),
      window.qcApi.listReagentQuickValues({ type: 'sampleType' }),
    ]);
    set({ quickValues: {
      operator: operator.ok ? operator.data : [],
      sampleType: sampleType.ok ? sampleType.data : [],
    } });
  },
  addQuickValue: async (type, value) => {
    const result = await window.qcApi.addReagentQuickValue({ type, value });
    if (result.ok) await get().loadQuickValues();
    return result;
  },
  removeQuickValue: async (type, index) => {
    const result = await window.qcApi.removeReagentQuickValue({ type, index });
    if (result.ok) await get().loadQuickValues();
    return result;
  },

  comparisons: [],

  load: async () => set({ comparisons: await window.qcApi.listReagentComparisons() }),
  create: async (name, unit) => {
    const result = await window.qcApi.createReagentComparison({ data: { name, unit } });
    if (result.ok) await get().load();
    return result;
  },
  // Không tự nạp lại sau khi ghi (kế hoạch kiến trúc D.1): main báo `reagent_tests`
  // sau commit và trang So sánh hoá chất nạp lại qua `useStoreInvalidation` — tự nạp ở đây làm
  // danh sách nạp HAI lần. Không chỗ gọi nào đọc danh sách ngay sau `await`.
  // Riêng `create` vẫn tự nạp: trang chọn ngay phép so sánh mới theo id.
  saveMetadata: async (id, data) => {
    const result = await window.qcApi.saveReagentMetadata({ id, data });
    return result;
  },
  saveRows: async (id, rows) => {
    const result = await window.qcApi.saveReagentRows({ id, rows });
    return result;
  },
  remove: async (id) => {
    const result = await window.qcApi.removeReagentComparison({ id });
    return result;
  },
}));


