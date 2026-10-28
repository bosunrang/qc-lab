// Zustand store cho trang Phân tích ngoại kiểm. Mọi hàm ghi trả `IpcResult`
// để form hiện đúng lỗi của chính nó; không tự nạp lại sau khi ghi — main báo
// `eqa_rounds` sau commit và trang nạp lại qua `useStoreInvalidation`.
import { create } from 'zustand';
import type { EqaAttentionRow, EqaImportInput, EqaImportPreview, EqaRoundRow, EqaRoundView, EqaSeriesView, IpcResult } from '../../shared/qc-api';

interface EqaState {
  rounds: EqaRoundRow[];
  /** Xét nghiệm có tín hiệu hoặc không thành công ở đợt mới nhất. */
  attention: EqaAttentionRow[];
  loading: boolean;
  error: string;
  load: () => Promise<void>;
  get: (id: string) => Promise<EqaRoundView | null>;
  series: (testId: string) => Promise<EqaSeriesView | null>;
  preview: (data: EqaImportInput) => Promise<IpcResult<EqaImportPreview>>;
  importRound: (data: EqaImportInput) => Promise<IpcResult<EqaRoundView>>;
  cancel: (id: string, expectedVersion: number, reason: string) => Promise<IpcResult<EqaRoundView>>;
}

export const useEqaStore = create<EqaState>((set) => ({
  rounds: [],
  attention: [],
  loading: false,
  error: '',
  load: async () => {
    set({ loading: true, error: '' });
    try {
      const [rounds, attention] = await Promise.all([window.qcApi.listEqaRounds(), window.qcApi.listEqaAttention()]);
      set({ rounds, attention, loading: false });
    } catch (error) { set({ loading: false, error: error instanceof Error ? error.message : 'Không tải được danh sách đợt ngoại kiểm.' }); }
  },
  get: (id) => window.qcApi.getEqaRound(id),
  series: (testId) => window.qcApi.getEqaSeries(testId),
  preview: (data) => window.qcApi.previewEqaImport({ data }),
  importRound: (data) => window.qcApi.importEqaRound({ data }),
  cancel: (id, expectedVersion, reason) => window.qcApi.cancelEqaRound({ data: { id, expectedVersion, reason } }),
}));
