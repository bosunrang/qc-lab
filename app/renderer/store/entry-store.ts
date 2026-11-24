// Zustand store cho trang Nhập QC — chỉ EntryPage.tsx dùng, tự do đổi hình
// dạng. Viết lại để nạp điểm QC + phân tích cho TẤT CẢ mức của 1 xét nghiệm
// cùng lúc (bảng worksheet + biểu đồ LJ hiển thị mọi mức song
// song, không chỉ 1 mức đang chọn như bản thí điểm trước). `loadAnalysis`
// gọi `westgard:analyzeLevel` (đã có sẵn từ module Westgard) để lấy z-score/
// CUSUM cho `<QcChart>`, không tính lại ở renderer.
import { create } from 'zustand';
import type { QcPointView, LevelAnalysis, IpcResult, RangeCandidateView, ParallelEntryColumn, PreviousLotSeries, VoidedQcPointView, QcRunConclusionChange } from '../../shared/qc-api';
import { useAuthStore } from './auth-store';

let rangeRequestSerial = 0;
let dataRequestSerial = 0;

// Trạng thái xem danh mục thuộc phiên đăng nhập, độc lập với bộ đệm điểm QC.
const initialTreeView = {
  selectedTestId: '',
  closedTreeMachines: new Set<string>(),
  openTreeGroups: new Set<string>(),
};

function toggleTreeKey(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(keys);
  if (!next.delete(key)) next.add(key);
  return next;
}

interface EntryState {
  selectedTestId: string;
  closedTreeMachines: ReadonlySet<string>;
  openTreeGroups: ReadonlySet<string>;
  selectTreeTest: (testId: string, machineKey: string, groupKey: string) => void;
  toggleTreeMachine: (key: string) => void;
  toggleTreeGroup: (key: string) => void;
  activeTestId: string | null;
  loadedLevelKey: string | null;
  pointsByLevel: Record<number, QcPointView[]>;
  analysisByLevel: Record<number, LevelAnalysis>;
  parallelColumns: ParallelEntryColumn[];
  previousLotSeries: PreviousLotSeries[];
  voidedPoints: VoidedQcPointView[];
  rangeCandidate: RangeCandidateView | null;
  rangeError: string | null;
  loadTestData: (testId: string, levels: number[]) => Promise<void>;
  resetTestData: () => void;
  addPoint: (data: { testId: string; level: number; date: string; val: number; runId?: string; lotNo?: string; note?: string; operatorName?: string; retroReason?: string }) => Promise<IpcResult<QcPointView & { retroChanges: QcRunConclusionChange[] }>>;
  setDayNote: (testId: string, date: string, note: string) => Promise<IpcResult<{ note: string; updated: number }>>;
  voidPoint: (
    pointId: string, reason: string, kind: 'analytical' | 'data-entry' | 'other', openNce: boolean,
  ) => Promise<IpcResult<{ id: string; nceId: string | null; reusedAction: boolean; retroChanges: QcRunConclusionChange[] }>>;
  loadRangeCandidate: (testId: string, level: number) => Promise<void>;
  applyLabRange: (testId: string, level: number, reason: string, causeConfirmed?: boolean, bias?: number, mean?: number, sd?: number) => Promise<IpcResult<RangeCandidateView>>;
  revertManufacturerRange: (testId: string, level: number, reason: string) => Promise<IpcResult<RangeCandidateView>>;
}

export const useEntryStore = create<EntryState>((set, get) => ({
  ...initialTreeView,
  selectTreeTest: (testId, machineKey, groupKey) => set((state) => {
    const closedTreeMachines = new Set(state.closedTreeMachines);
    closedTreeMachines.delete(machineKey);
    return { selectedTestId: testId, closedTreeMachines, openTreeGroups: new Set(state.openTreeGroups).add(groupKey) };
  }),
  toggleTreeMachine: (key) => set((state) => ({ closedTreeMachines: toggleTreeKey(state.closedTreeMachines, key) })),
  toggleTreeGroup: (key) => set((state) => ({ openTreeGroups: toggleTreeKey(state.openTreeGroups, key) })),

  activeTestId: null,
  loadedLevelKey: null,
  pointsByLevel: {},
  analysisByLevel: {},
  parallelColumns: [],
  previousLotSeries: [],
  voidedPoints: [],
  rangeCandidate: null,
  rangeError: null,

  loadTestData: async (testId, levels) => {
    const request = ++dataRequestSerial;
    // Đổi sang xét nghiệm khác thì bỏ ngay dữ liệu của xét nghiệm cũ: giữ lại
    // thì điểm cũ hiện dưới cột mức cùng số của xét nghiệm mới cho tới khi
    // IPC trả về. Nạp lại CÙNG xét nghiệm thì vẫn giữ để bảng không chớp trống.
    if (get().activeTestId !== testId) {
      set({ activeTestId: testId, loadedLevelKey: null, pointsByLevel: {}, analysisByLevel: {}, parallelColumns: [], previousLotSeries: [], voidedPoints: [] });
    } else {
      set({ loadedLevelKey: null });
    }
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
    set({ loadedLevelKey: levels.join(','), pointsByLevel, analysisByLevel, parallelColumns, previousLotSeries, voidedPoints });
  },

  resetTestData: () => {
    dataRequestSerial += 1;
    rangeRequestSerial += 1;
    set({
      activeTestId: null, loadedLevelKey: null,
      pointsByLevel: {}, analysisByLevel: {}, parallelColumns: [], previousLotSeries: [], voidedPoints: [],
      rangeCandidate: null, rangeError: null,
    });
  },

  // Ba lệnh ghi dưới đây KHÔNG tự nạp lại. Main báo `qc_points` đổi kèm
  // testId, và EntryPage nạp lại toàn bộ mức của xét nghiệm (một điểm mới có
  // thể kích hoạt luật chéo mức ở mức kia), dải QC và cây xét nghiệm qua
  // `useStoreInvalidation`. Trước 2026-09-26 store tự nạp thêm một lượt, kèm
  // một lần `listTestSummaries()` chỉ để lấy danh sách mức: mỗi điểm nhập vào
  // làm main tính Westgard cho mọi xét nghiệm hai lần.
  setDayNote: async (testId, date, note) => window.qcApi.setDayNote({ data: { testId, date, note } }),
  addPoint: async (data) => window.qcApi.addPoint({ data }),
  voidPoint: async (pointId, reason, kind, openNce) => window.qcApi.voidPoint({ data: { pointId, reason, kind, openNce } }),
  loadRangeCandidate: async (testId, level) => {
    const request = ++rangeRequestSerial;
    // Nạp lại cùng mức sau một lần ghi thì giữ dải đang hiện tới khi có kết
    // quả mới, để khung dải QC không chớp trống. Đổi mức thì mới xoá.
    const current = get().rangeCandidate;
    if (!current || current.testId !== testId || current.level !== level) set({ rangeCandidate: null, rangeError: null });
    const result = await window.qcApi.getRangeCandidate(testId, level);
    if (request !== rangeRequestSerial) return;
    set(result.ok ? { rangeCandidate: result.data, rangeError: null } : { rangeCandidate: null, rangeError: result.error.message });
  },
  applyLabRange: async (testId, level, reason, causeConfirmed, bias, mean, sd) => {
    const result = await window.qcApi.applyLabRange({ data: { testId, level, reason, causeConfirmed, bias, mean, sd } });
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

useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) useEntryStore.setState(initialTreeView);
});


