// Zustand store cho trang Six Sigma — chỉ SigmaPage.tsx dùng. `savePeriod`
// nhận nguyên `levels[]` (mỗi phần tử đã gồm eqaRounds/muBiasMode nếu có) để
// modal Bias/MU tự quản lý state của mình rồi gọi thẳng, không cần store
// biết cấu trúc modal.
import { create } from 'zustand';
import type { SigmaPeriodView, SigmaCohortView, IpcResult } from '../../shared/qc-api';

export interface SigmaLevelSaveInput {
  refreshCohort?: boolean; cohortReviewed?: boolean; cohortFingerprint?: string;
  level: number; /** TEa% snapshot của riêng mức QC (CLIA tuyệt đối phụ thuộc Mean). */ tea?: number; /** Mean mục tiêu tại thời điểm đánh giá, dùng đổi MU% sang đơn vị. */ targetMean?: number; cv?: number; biasEqa?: number; eqaRounds?: Array<{ lab: number | null; target: number | null; bias?: number }>; /** u(Cref)% - do khong dam bao cua GIA TRI GAN EQA/CRM, do nha cung cap cong bo. */ uCref?: number; uCal?: number; muBiasMode?: 'include' | 'exclude';
  cvSource?: 'manual' | 'iqc-cohort'; cohortN?: number; sourceLot?: string; sourceStart?: string; sourceEnd?: string; cohortStatus?: string;
}

interface SigmaState {
  testId: string;
  loading: boolean;
  error: string;
  setTracking: (testId: string, tracked: boolean) => Promise<IpcResult<{ testId: string; tracked: boolean }>>;
  saveTeaConfig: (input: { testId: string; source: string; tea?: number; eflmAnalyte?: string; eflmAps?: string; eflmLookupDate?: string; eflmRef?: string }) => Promise<IpcResult<unknown>>;
  periods: SigmaPeriodView[];
  loadPeriods: (testId: string) => Promise<void>;
  loadCohorts: (testId: string, period: string, levels: number[]) => Promise<SigmaCohortView[]>;
  savePeriod: (testId: string, period: string, tea: number | undefined, teaSource: string | undefined, levels: SigmaLevelSaveInput[], createOnly?: boolean) => Promise<IpcResult<SigmaPeriodView>>;
  renamePeriod: (id: string, testId: string, period: string) => Promise<IpcResult<SigmaPeriodView>>;
  removePeriod: (id: string, testId: string) => Promise<IpcResult<{ id: string }>>;
}

let requestRevision = 0;
export const useSigmaStore = create<SigmaState>((set, get) => ({
  testId: '', loading: false, error: '',
  /** Bật/tắt theo dõi Six Sigma (ghi `tests.sigma_tracked`, chỉ admin). */
  setTracking: async (testId, tracked) => {
    const result = await window.qcApi.setSigmaTracking({ testId, tracked });
    if (result.ok && get().testId === testId) await get().loadPeriods(testId);
    return result;
  },

  /** Nguồn + giá trị TEa: đổi TEa làm mọi kỳ Sigma tính lại, nên nạp lại
   * danh sách kỳ ngay sau khi lưu. */
  saveTeaConfig: async (input) => {
    const result = await window.qcApi.saveSigmaTeaConfig(input);
    if (result.ok && get().testId === input.testId) await get().loadPeriods(input.testId);
    return result;
  },

  periods: [],

  loadPeriods: async (testId) => {
    const revision = ++requestRevision;
    set({ testId, loading: !!testId, error: '', periods: [] });
    if (!testId) return;
    try {
      const periods = await window.qcApi.listSigmaPeriods(testId);
      if (revision === requestRevision) set({ periods: periods.filter(period => period.testId === testId), loading: false });
    } catch {
      if (revision === requestRevision) set({ periods: [], loading: false, error: 'Không tải được dữ liệu Sigma. Vui lòng thử lại.' });
    }
  },
  loadCohorts: (testId, period, levels) => window.qcApi.listSigmaCohorts(testId, period, levels),

  removePeriod: async (id, testId) => {
    const result = await window.qcApi.removeSigmaPeriod({ data: { id } });
    if (result.ok && get().testId === testId) await get().loadPeriods(testId);
    return result;
  },
  savePeriod: async (testId, period, tea, teaSource, levels, createOnly = false) => {
    const result = await window.qcApi.saveSigmaPeriod({ testId, period, tea, teaSource, levels, createOnly });
    if (result.ok && get().testId === testId) await get().loadPeriods(testId);
    return result;
  },
  renamePeriod: async (id, testId, period) => {
    const result = await window.qcApi.renameSigmaPeriod({ id, period });
    if (result.ok && get().testId === testId) await get().loadPeriods(testId);
    return result;
  },
}));
