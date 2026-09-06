// Zustand store cho trang Nhập QC — chỉ EntryPage.tsx dùng, tự do đổi hình
// dạng. Viết lại để nạp điểm QC + phân tích cho TẤT CẢ mức của 1 xét nghiệm
// cùng lúc (bảng worksheet + biểu đồ LJ dạng bản cũ hiển thị mọi mức song
// song, không chỉ 1 mức đang chọn như bản thí điểm trước). `loadAnalysis`
// gọi `westgard:analyzeLevel` (đã có sẵn từ module Westgard) để lấy z-score/
// CUSUM cho `<QcChart>`, không tính lại ở renderer.
import { create } from 'zustand';
import type { QcPointView, LevelAnalysis, IpcResult, RangeCandidateView, ParallelEntryColumn, PreviousLotSeries, VoidedQcPointView } from '../../shared/qc-api';

let rangeRequestSerial = 0;
let dataRequestSerial = 0;

interface EntryState {
  activeTestId: string | null;
  pointsByLevel: Record<number, QcPointView[]>;
  analysisByLevel: Record<number, LevelAnalysis>;
  parallelColumns: ParallelEntryColumn[];
  previousLotSeries: PreviousLotSeries[];
  voidedPoints: VoidedQcPointView[];
  rangeCandidate: RangeCandidateView | null;
  rangeError: string | null;
  loadTestData: (testId: string, levels: number[]) => Promise<void>;
  resetTestData: () => void;
  addPoint: (data: { testId: string; level: number; date: string; val: number; runId?: string; lotNo?: string; note?: string; operatorName?: string }) => Promise<IpcResult<QcPointView>>;
  voidPoint: (
    pointId: string, reason: string, kind: 'analytical' | 'data-entry' | 'other', openNce: boolean, testId: string, level: number,
  ) => Promise<IpcResult<{ id: string; nceId: string | null; reusedAction: boolean }>>;
  loadRangeCandidate: (testId: string, level: number) => Promise<void>;
  applyLabRange: (testId: string, level: number, reason: string, causeConfirmed?: boolean, bias?: number) => Promise<IpcResult<RangeCandidateView>>;
  revertManufacturerRange: (testId: string, level: number, reason: string) => Promise<IpcResult<RangeCandidateView>>;
}

export const useEntryStore = create<EntryState>((set, get) => ({
  activeTestId: null,
  pointsByLevel: {},
  analysisByLevel: {},
  parallelColumns: [],
  previousLotSeries: [],
  voidedPoints: [],
  rangeCandidate: null,
  rangeError: null,

  loadTestData: async (testId, levels) => {
    const request = ++dataRequestSerial;
    set({ activeTestId: testId });
    const [pairs, parallelColumns, previousLotSeries, voidedPoints] = await Promise.all([Promise.all(levels.map(async (level) => {
      const [points, analysis] = await Promise.all([
        window.qcApi.queryPoints(testId, level),
        window.qcApi.analyzeLevel(testId, level),
      ]);
      return [level, points, analysis] as const;
    })), window.qcApi.listParallelEntryColumns(testId), window.qcApi.listPreviousEntryLotSeries(testId), window.qcApi.listVoidedEntryPoints(testId)]);
    const pointsByLevel: Record<number, QcPointView[]> = {};
    const analysisByLevel: Record<number, LevelAnalysis> = {};
    for (const [level, points, analysis] of pairs) { pointsByLevel[level] = points; analysisByLevel[level] = analysis; }
    // Người dùng có thể đổi xét nghiệm khi các IPC trên còn đang chạy. Chỉ
    // yêu cầu mới nhất được phép thay dữ liệu đang hiển thị.
    if (request !== dataRequestSerial || get().activeTestId !== testId) return;
    set({ pointsByLevel, analysisByLevel, parallelColumns, previousLotSeries, voidedPoints });
  },

  resetTestData: () => {
    dataRequestSerial += 1;
    rangeRequestSerial += 1;
    set({
      activeTestId: null,
      pointsByLevel: {}, analysisByLevel: {}, parallelColumns: [], previousLotSeries: [], voidedPoints: [],
      rangeCandidate: null, rangeError: null,
    });
  },

  addPoint: async (data) => {
    const result = await window.qcApi.addPoint({ data });
    if (result.ok) {
      // Một điểm mới có thể kích hoạt luật CHÉO MỨC (R4s/2-2s...) cho điểm
      // ở mức khác trong cùng run, nên phải nạp lại toàn bộ mức của xét
      // nghiệm. Chỉ cập nhật mức vừa nhập sẽ để badge/biểu đồ mức kia bị cũ.
      const summaries = await window.qcApi.listTestSummaries();
      const levels = summaries.find((item) => item.testId === data.testId)?.levels.map((item) => item.level) || [data.level];
      if (get().activeTestId === data.testId) await get().loadTestData(data.testId, levels);
      const range = await window.qcApi.getRangeCandidate(data.testId, data.level);
      if (range.ok && get().rangeCandidate?.testId === data.testId && get().rangeCandidate?.level === data.level) set({ rangeCandidate: range.data });
    }
    return result;
  },
  voidPoint: async (pointId, reason, kind, openNce, testId, level) => {
    const result = await window.qcApi.voidPoint({ data: { pointId, reason, kind, openNce } });
    if (result.ok) {
      // Hủy một điểm cũng có thể gỡ vi phạm chéo khỏi mức còn lại.
      const summaries = await window.qcApi.listTestSummaries();
      const levels = summaries.find((item) => item.testId === testId)?.levels.map((item) => item.level) || [level];
      if (get().activeTestId === testId) await get().loadTestData(testId, levels);
      const range = await window.qcApi.getRangeCandidate(testId, level);
      if (range.ok && get().rangeCandidate?.testId === testId && get().rangeCandidate?.level === level) set({ rangeCandidate: range.data });
    }
    return result;
  },
  loadRangeCandidate: async (testId, level) => {
    const request = ++rangeRequestSerial;
    set({ rangeCandidate: null, rangeError: null });
    const result = await window.qcApi.getRangeCandidate(testId, level);
    if (request !== rangeRequestSerial) return;
    set(result.ok ? { rangeCandidate: result.data, rangeError: null } : { rangeCandidate: null, rangeError: result.error.message });
  },
  applyLabRange: async (testId, level, reason, causeConfirmed, bias) => {
    const result = await window.qcApi.applyLabRange({ data: { testId, level, reason, causeConfirmed, bias } });
    if (result.ok) set({ rangeCandidate: result.data, rangeError: null });
    else set({ rangeError: result.error.message });
    return result;
  },
  revertManufacturerRange: async (testId, level, reason) => {
    const result = await window.qcApi.revertManufacturerRange({ data: { testId, level, reason } });
    if (result.ok) set({ rangeCandidate: result.data, rangeError: null });
    else set({ rangeError: result.error.message });
    return result;
  },
}));
