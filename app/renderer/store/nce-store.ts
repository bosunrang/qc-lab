// Zustand store cho trang Khắc phục sự cố (NCE) — chỉ ActionsPage.tsx dùng.
// Mọi hàm ghi trả `IpcResult` để form hiển thị đúng lỗi validate của chính
// nó, không dùng field `error` dùng chung nữa (khác bản thí điểm cũ).
import { create } from 'zustand';
import type { NceRecord, NceDetail, IpcResult } from '../../shared/qc-api';
import { latestNceSigmaBias, type NceBiasSuggestion } from '../../main/domain/nce-bias-suggestion';

interface NceCreateData {
  testId?: string; level?: number; lot?: string; date: string; pointId?: string; rule?: string;
  errorType?: string; correction: string; dueDate?: string;
  investigation?: string; causeCategory?: string; causeDescription?: string; protocol?: Partial<NceDetail>;
}

interface NceState {
  records: NceRecord[];
  load: () => Promise<void>;
  /** Gợi ý chỉ-đọc từ kỳ Sigma gần nhất, không ghi gì vào hồ sơ NCE. */
  latestSigmaBias: (testId: string, level: number) => Promise<NceBiasSuggestion | null>;
  create: (data: NceCreateData) => Promise<IpcResult<NceRecord>>;
  saveProtocol: (id: string, dueDate: string, protocol: Partial<NceDetail>) => Promise<IpcResult<NceRecord>>;
  approve: (id: string) => Promise<IpcResult<NceRecord>>;
  returnForRevision: (id: string, note: string) => Promise<IpcResult<NceRecord>>;
  cancel: (id: string, note: string) => Promise<IpcResult<NceRecord>>;
  setCompletedDate: (id: string, date: string) => Promise<IpcResult<NceRecord>>;
  markEffectiveness: (id: string, status: 'effective' | 'ineffective', residualRisk?: string, note?: string) => Promise<IpcResult<NceRecord>>;
  setReleaseDecision: (id: string, decision: 'held' | 'released', note: string) => Promise<IpcResult<NceRecord>>;
  setRerunEvidence: (id: string, rerunPointId: string, note?: string) => Promise<IpcResult<NceRecord>>;
  reopen: (id: string, note?: string) => Promise<IpcResult<NceRecord>>;
}

export const useNceStore = create<NceState>((set, get) => ({
  records: [],

  load: async () => set({ records: await window.qcApi.listNceRecords() }),
  latestSigmaBias: async (testId, level) => latestNceSigmaBias(await window.qcApi.listSigmaPeriods(testId), level),

  // Không tự nạp lại sau khi ghi (kế hoạch kiến trúc D.1): main báo `actions`
  // sau commit và trang Khắc phục sự cố nạp lại qua `useStoreInvalidation` — tự nạp ở đây làm
  // danh sách nạp HAI lần. Không chỗ gọi nào đọc danh sách ngay sau `await`.
  create: async (data) => {
    const result = await window.qcApi.createNce({ data });
    return result;
  },
  saveProtocol: async (id, dueDate, protocol) => {
    const result = await window.qcApi.saveNceProtocol({ data: { id, dueDate, protocol } });
    return result;
  },
  approve: async (id) => {
    const result = await window.qcApi.approveNce({ data: { id } });
    return result;
  },
  returnForRevision: async (id, note) => {
    const result = await window.qcApi.returnNce({ data: { id, note } });
    return result;
  },
  cancel: async (id, note) => {
    const result = await window.qcApi.cancelNce({ data: { id, note } });
    return result;
  },
  setCompletedDate: async (id, date) => {
    const result = await window.qcApi.setNceCompletedDate({ data: { id, actionCompletedDate: date } });
    return result;
  },
  markEffectiveness: async (id, status, residualRisk, note) => {
    const result = await window.qcApi.markNceEffectiveness({ data: { id, status, residualRisk, note } });
    return result;
  },
  setReleaseDecision: async (id, decision, note) => {
    const result = await window.qcApi.setNceReleaseDecision({ data: { id, decision, note } });
    return result;
  },
  setRerunEvidence: async (id, rerunPointId, note) => {
    const result = await window.qcApi.setNceRerunEvidence({ data: { id, rerunPointId, note } });
    return result;
  },
  reopen: async (id, note) => {
    const result = await window.qcApi.reopenNce({ data: { id, note } });
    return result;
  },
}));


