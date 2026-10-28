// Zustand store cho trang Phân tích ngoại kiểm. Mọi hàm ghi trả `IpcResult`
// để form hiện đúng lỗi của chính nó; không tự nạp lại sau khi ghi — main báo
// `eqa_rounds` sau commit và trang nạp lại qua `useStoreInvalidation`.
import { create } from 'zustand';
import type { EqaImportInput, EqaImportPreview, EqaRoundRow, EqaRoundView, IpcResult } from '../../shared/qc-api';

interface EqaState {
  rounds: EqaRoundRow[];
  loading: boolean;
  error: string;
  load: () => Promise<void>;
  get: (id: string) => Promise<EqaRoundView | null>;
  preview: (data: EqaImportInput) => Promise<IpcResult<EqaImportPreview>>;
  importRound: (data: EqaImportInput) => Promise<IpcResult<EqaRoundView>>;
  cancel: (id: string, expectedVersion: number, reason: string) => Promise<IpcResult<EqaRoundView>>;
}

export const useEqaStore = create<EqaState>((set) => ({
  rounds: [],
  loading: false,
  error: '',
  load: async () => {
    set({ loading: true, error: '' });
    try { set({ rounds: await window.qcApi.listEqaRounds(), loading: false }); }
    catch (error) { set({ loading: false, error: error instanceof Error ? error.message : 'Không tải được danh sách kỳ ngoại kiểm.' }); }
  },
  get: (id) => window.qcApi.getEqaRound(id),
  preview: (data) => window.qcApi.previewEqaImport({ data }),
  importRound: (data) => window.qcApi.importEqaRound({ data }),
  cancel: (id, expectedVersion, reason) => window.qcApi.cancelEqaRound({ data: { id, expectedVersion, reason } }),
}));
