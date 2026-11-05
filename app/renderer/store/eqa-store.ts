// Zustand store cho trang Phân tích ngoại kiểm. Mọi hàm ghi trả `IpcResult`
// để form hiện đúng lỗi của chính nó; không tự nạp lại sau khi ghi — main báo
// `eqa_rounds` sau commit và trang nạp lại qua `useStoreInvalidation`.
import { create } from 'zustand';
import type { EqaImportInput, EqaInstrumentGridRow, EqaImportPreview, EqaProgramOption, EqaRoundRow, EqaRoundView, EqaScheduleInput, EqaScheduleRow, EqaSeriesView, IpcResult } from '../../shared/qc-api';

interface EqaState {
  rounds: EqaRoundRow[];
  /** Lịch đợt và hạn nộp; trạng thái do main suy ra. */
  schedule: EqaScheduleRow[];
  programs: EqaProgramOption[];
  /** Vị trí cuộn của danh sách xét nghiệm trong màn phân tích. */
  analysisListScroll: number;
  analysisListScrollTarget: number | null;
  setAnalysisListScroll: (top: number) => void;
  rememberAnalysisListScroll: (top: number) => void;
  finishAnalysisListScrollRestore: () => void;
  loading: boolean;
  /** Đã nạp xong ít nhất một lần (thành công hay lỗi): trước đó danh sách rỗng
   * nghĩa là "chưa biết", không phải "chưa có kỳ nào". */
  loaded: boolean;
  error: string;
  load: () => Promise<void>;
  get: (id: string) => Promise<EqaRoundView | null>;
  series: (testId: string) => Promise<EqaSeriesView | null>;
  /** Lưới z của một máy trong một chương trình–năm (bản đồ z). */
  instrumentGrid: (programId: string, year: number, instrumentId: string) => Promise<EqaInstrumentGridRow[]>;
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
  schedule: [],
  programs: [],
  analysisListScroll: 0,
  analysisListScrollTarget: null,
  setAnalysisListScroll: (analysisListScroll) => set({ analysisListScroll }),
  rememberAnalysisListScroll: (top) => set({ analysisListScroll: top, analysisListScrollTarget: top }),
  finishAnalysisListScrollRestore: () => set({ analysisListScrollTarget: null }),
  loading: false,
  loaded: false,
  error: '',
  load: async () => {
    set({ loading: true, error: '' });
    try {
      const [rounds, schedule, programs] = await Promise.all([
        window.qcApi.listEqaRounds(), window.qcApi.listEqaSchedule(), window.qcApi.listEqaPrograms(),
      ]);
      set({ rounds, schedule, programs, loading: false, loaded: true });
    } catch (error) { set({ loading: false, loaded: true, error: error instanceof Error ? error.message : 'Không tải được danh sách đợt ngoại kiểm.' }); }
  },
  get: (id) => window.qcApi.getEqaRound(id),
  series: (testId) => window.qcApi.getEqaSeries(testId),
  instrumentGrid: (programId, year, instrumentId) => window.qcApi.getEqaInstrumentGrid({ programId, year, instrumentId }),
  preview: (data) => window.qcApi.previewEqaImport({ data }),
  importRound: (data) => window.qcApi.importEqaRound({ data }),
  cancel: (id, expectedVersion, reason) => window.qcApi.cancelEqaRound({ data: { id, expectedVersion, reason } }),
  saveSchedule: (data, id) => window.qcApi.saveEqaSchedule({ ...(id ? { id } : {}), data }),
  markSubmitted: (id, submitted) => window.qcApi.markEqaSubmitted({ data: Array.isArray(submitted) ? { id, instrumentIds: submitted } : { id, submitted } }),
  removeSchedule: (id) => window.qcApi.removeEqaSchedule({ data: { id } }),
}));
