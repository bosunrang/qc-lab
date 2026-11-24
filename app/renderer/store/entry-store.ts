// Nạp điểm và kết luận của mọi mức trong một lượt, theo tháng nhập và
// khoảng biểu đồ. Main giữ toàn bộ ngữ cảnh đánh giá Westgard.
import { create } from 'zustand';
import type { EntryWindow, EntryWindowRequest, QcPointView, IpcResult, RangeCandidateView, QcRunConclusionChange } from '../../shared/qc-api';
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
  entryWindow: EntryWindow | null;
  loadedRequest: EntryWindowRequest | null;
  windowError: string | null;
  rangeCandidate: RangeCandidateView | null;
  rangeError: string | null;
  loadTestData: (testId: string, request: EntryWindowRequest) => Promise<void>;
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
  entryWindow: null,
  loadedRequest: null,
  windowError: null,
  rangeCandidate: null,
  rangeError: null,

  loadTestData: async (testId, request) => {
    const serial = ++dataRequestSerial;
    if (get().activeTestId !== testId) set({ activeTestId: testId, entryWindow: null, loadedRequest: null });
    set({ windowError: null });
    try {
      const entryWindow = await window.qcApi.getEntryWindow(testId, request);
      if (serial === dataRequestSerial) set({ entryWindow, loadedRequest: request });
    } catch {
      if (serial === dataRequestSerial) set({ windowError: 'Không tải được dữ liệu QC trong khoảng xem.' });
    }
  },

  resetTestData: () => {
    dataRequestSerial += 1;
    rangeRequestSerial += 1;
    set({
      activeTestId: null, entryWindow: null, loadedRequest: null, windowError: null,
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
  if (state.user?.id === previous.user?.id) return;
  useEntryStore.getState().resetTestData();
  useEntryStore.setState(initialTreeView);
});


