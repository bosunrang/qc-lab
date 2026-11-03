// Zustand store cho trang Phân tích ngoại kiểm. Mọi hàm ghi trả `IpcResult`
// để form hiện đúng lỗi của chính nó; không tự nạp lại sau khi ghi — main báo
// `eqa_rounds` sau commit và trang nạp lại qua `useStoreInvalidation`.
import { create } from 'zustand';
import type { EqaAttentionRow, EqaImportInput, EqaImportPreview, EqaProgramOption, EqaRoundRow, EqaRoundView, EqaScheduleInput, EqaScheduleRow, EqaSeriesView, Instrument, IpcResult } from '../../shared/qc-api';

interface EqaState {
  rounds: EqaRoundRow[];
  /** Xét nghiệm có tín hiệu hoặc không thành công ở đợt mới nhất. */
  attention: EqaAttentionRow[];
  /** Lịch đợt và hạn nộp; trạng thái do main suy ra. */
  schedule: EqaScheduleRow[];
  programs: EqaProgramOption[];
  /** Máy ở Cấu hình chung, để chọn máy chạy mẫu của đợt. */
  instruments: Instrument[];
  loading: boolean;
  error: string;
  load: () => Promise<void>;
  get: (id: string) => Promise<EqaRoundView | null>;
  series: (testId: string) => Promise<EqaSeriesView | null>;
  preview: (data: EqaImportInput) => Promise<IpcResult<EqaImportPreview>>;
  importRound: (data: EqaImportInput) => Promise<IpcResult<EqaRoundView>>;
  cancel: (id: string, expectedVersion: number, reason: string) => Promise<IpcResult<EqaRoundView>>;
  saveSchedule: (data: EqaScheduleInput, id?: string) => Promise<IpcResult<EqaScheduleRow>>;
  /** `true`/`false` cho cả đợt; danh sách máy = các máy đã nộp của đợt có khai máy. */
  markSubmitted: (id: string, submitted: boolean | string[]) => Promise<IpcResult<EqaScheduleRow>>;
  removeSchedule: (id: string) => Promise<IpcResult<{ id: string }>>;
}

export const useEqaStore = create<EqaState>((set) => ({
  rounds: [],
  attention: [],
  schedule: [],
  programs: [],
  instruments: [],
  loading: false,
  error: '',
  load: async () => {
    set({ loading: true, error: '' });
    try {
      const [rounds, attention, schedule, programs, instruments] = await Promise.all([
        window.qcApi.listEqaRounds(), window.qcApi.listEqaAttention(), window.qcApi.listEqaSchedule(), window.qcApi.listEqaPrograms(), window.qcApi.listInstruments(),
      ]);
      set({ rounds, attention, schedule, programs, instruments, loading: false });
    } catch (error) { set({ loading: false, error: error instanceof Error ? error.message : 'Không tải được danh sách đợt ngoại kiểm.' }); }
  },
  get: (id) => window.qcApi.getEqaRound(id),
  series: (testId) => window.qcApi.getEqaSeries(testId),
  preview: (data) => window.qcApi.previewEqaImport({ data }),
  importRound: (data) => window.qcApi.importEqaRound({ data }),
  cancel: (id, expectedVersion, reason) => window.qcApi.cancelEqaRound({ data: { id, expectedVersion, reason } }),
  saveSchedule: (data, id) => window.qcApi.saveEqaSchedule({ ...(id ? { id } : {}), data }),
  markSubmitted: (id, submitted) => window.qcApi.markEqaSubmitted({ data: Array.isArray(submitted) ? { id, instrumentIds: submitted } : { id, submitted } }),
  removeSchedule: (id) => window.qcApi.removeEqaSchedule({ data: { id } }),
}));
