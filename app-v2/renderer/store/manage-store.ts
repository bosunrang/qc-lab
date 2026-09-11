// Zustand store THẬT cho trang Cấu hình chung — component subscribe qua
// hook, tự vẽ lại đúng phần liên quan khi state đổi. `tests`/`instruments`/
// `loadTests`/`loadInstruments`/`levelsByTestId`/`loadLevels` giữ NGUYÊN tên
// vì Entry/Sigma/Actions/Report cũng đọc qua store này (chỉ đọc `tests`,
// không đụng phần CRUD mở rộng dưới đây — xem docs/APP-V2-PLAN.md Giai đoạn
// B1). Mọi hàm `save*`/`create*` trả thẳng `IpcResult` để mỗi form tự hiển
// thị lỗi validate của MÌNH, không dùng 1 field `error` dùng chung dễ lẫn
// giữa các tab/modal đang mở.
import { create } from 'zustand';
import type { Instrument, Test, TestLevel, QcLot, LotGroup, QcPanel, LotTransition, TeaRef, RuleScopeItem, IpcResult, QcApi, QcPointView } from '../../shared/qc-api';

type ApiInputData<K extends keyof QcApi> = QcApi[K] extends (...args: infer Args) => unknown
  ? Args[0] extends { data: infer Data } ? Data : never
  : never;

interface ManageState {
  instruments: Instrument[];
  tests: Test[];
  levelsByTestId: Record<string, TestLevel[]>;
  lots: QcLot[];
  lotGroups: LotGroup[];
  panels: QcPanel[];
  lotTransitions: LotTransition[];
  teaRefs: TeaRef[];
  ruleScopesByTestId: Record<string, RuleScopeItem[]>;
  loadInstruments: () => Promise<void>;
  loadTests: () => Promise<void>;
  loadLevels: (testId: string) => Promise<void>;
  loadLots: () => Promise<void>;
  loadLotGroups: () => Promise<void>;
  loadPanels: () => Promise<void>;
  loadLotTransitions: () => Promise<void>;
  historyPointsByTestId: Record<string, QcPointView[]>;
  loadHistoryPoints: (testId: string) => Promise<void>;
  loadTeaRefs: () => Promise<void>;
  loadRuleScopes: (testId: string) => Promise<void>;

  saveInstrument: (id: string | undefined, data: ApiInputData<'saveInstrument'>) => Promise<IpcResult<Instrument>>;
  removeInstrument: (id: string) => Promise<IpcResult<{ id: string }>>;
  saveTest: (id: string | undefined, data: ApiInputData<'saveTest'>) => Promise<IpcResult<Test>>;
  saveTestLevel: (testId: string, data: ApiInputData<'saveTestLevel'>) => Promise<IpcResult<TestLevel>>;
  saveLot: (id: string | undefined, data: ApiInputData<'saveLot'>) => Promise<IpcResult<QcLot>>;
  saveLotGroup: (id: string | undefined, data: ApiInputData<'saveLotGroup'>) => Promise<IpcResult<LotGroup>>;
  setTeaRefValue: (input: { analyteId: string; field: 'clia' | 'ricos'; value: string; name?: string; unit?: string; section?: string }) => Promise<IpcResult<{ analyteId: string }>>;
  restoreTeaRefDefaults: (analyteId: string) => Promise<IpcResult<{ analyteId: string }>>;
  removeTest: (id: string, ids?: string[]) => Promise<IpcResult<{ id: string; pointsCount: number }>>;
  removePanel: (id: string) => Promise<IpcResult<{ id: string }>>;
  removeLot: (id: string) => Promise<IpcResult<{ id: string }>>;
  removeLotGroup: (id: string) => Promise<IpcResult<{ id: string }>>;
  stopLotGroup: (id: string) => Promise<IpcResult<{ id: string }>>;
  activateLotGroup: (id: string) => Promise<IpcResult<{ status: 'applied' | 'already-active' | 'unready'; applied: number; stoppedGroups: string[] }>>;
  removeLotTransition: (id: string) => Promise<IpcResult<{ id: string }>>;
  savePanel: (id: string | undefined, data: ApiInputData<'savePanel'>) => Promise<IpcResult<QcPanel>>;
  createLotTransition: (data: { panelId: string; fromLotId: string; toLotId: string; startDate?: string; note?: string; status?: 'planned' | 'active' | 'accepted' | 'rejected'; criteria?: { testId: string; level: number; mean: number; sd: number }[] }, id?: string) => Promise<IpcResult<LotTransition>>;
  saveTeaRef: (id: string | undefined, data: ApiInputData<'saveTeaRef'>) => Promise<IpcResult<TeaRef>>;
  removeTeaRef: (id: string) => Promise<IpcResult<{ id: string }>>;
  removeTeaLabProfile: (id: string) => Promise<IpcResult<{ id: string; removedRecord: boolean }>>;
  addTeaAnalyte: (input: { name: string; abbreviation?: string; matrix?: string; unit?: string; section?: string; clia?: string; ricos?: string; cliaRule?: 'percent' | 'absolute' | 'greater-of'; cliaAbsolute?: string; cliaAbsoluteUnit?: string }) => Promise<IpcResult<{ analyteId: string }>>;
  saveRuleAction: (testId: string, ruleId: string, action: 'inactive' | 'alert' | 'reject' | '') => Promise<IpcResult<{ ruleId: string; action: 'inactive' | 'alert' | 'reject' | '' }>>;
  saveRuleScope: (testId: string, ruleId: string, scope: 'within' | 'across' | 'both' | '') => Promise<IpcResult<{ ruleId: string; scope: string }>>;
}

export const useManageStore = create<ManageState>((set, get) => ({
  instruments: [], tests: [], levelsByTestId: {},
  lots: [], lotGroups: [], panels: [], lotTransitions: [], teaRefs: [], ruleScopesByTestId: {},

  loadInstruments: async () => set({ instruments: await window.qcApi.listInstruments() }),
  loadTests: async () => set({ tests: await window.qcApi.listTests() }),
  loadLevels: async (testId) => {
    const levels = await window.qcApi.listTestLevels(testId);
    set((s) => ({ levelsByTestId: { ...s.levelsByTestId, [testId]: levels } }));
  },
  loadLots: async () => set({ lots: await window.qcApi.listLots() }),
  loadLotGroups: async () => set({ lotGroups: await window.qcApi.listLotGroups() }),
  loadPanels: async () => set({ panels: await window.qcApi.listPanels() }),
  loadLotTransitions: async () => set({ lotTransitions: await window.qcApi.listLotTransitions() }),
  /** Mọi điểm QC chưa huỷ của một xét nghiệm — tab "Lịch sử dữ liệu" dùng,
   * và CỐ Ý khác `entry:queryPoints` (chỉ trả điểm của lô đang vận hành):
   * ở đây phải thấy cả điểm của lô đã chuyển tiếp. Để trong store để điểm
   * nhập ở trang Nhập QC làm tab này tự cập nhật. */
  historyPointsByTestId: {},
  loadHistoryPoints: async (testId: string) => {
    const points = await window.qcApi.listEntryHistoryPoints(testId);
    set((state) => ({ historyPointsByTestId: { ...state.historyPointsByTestId, [testId]: points } }));
  },

  loadTeaRefs: async () => set({ teaRefs: await window.qcApi.listTeaRefs() }),
  loadRuleScopes: async (testId) => {
    const scopes = await window.qcApi.listRuleScopes(testId);
    set((s) => ({ ruleScopesByTestId: { ...s.ruleScopesByTestId, [testId]: scopes } }));
  },

  saveInstrument: async (id, data) => {
    const result = await window.qcApi.saveInstrument({ id, data });
    if (result.ok) await get().loadInstruments();
    return result;
  },
  removeInstrument: async (id) => {
    const result = await window.qcApi.removeInstrument({ id });
    if (result.ok) await get().loadInstruments();
    return result;
  },
  saveTest: async (id, data) => {
    const result = await window.qcApi.saveTest({ id, data });
    if (result.ok) await get().loadTests();
    return result;
  },
  saveTestLevel: async (testId, data) => {
    const result = await window.qcApi.saveTestLevel({ testId, data });
    if (result.ok) await get().loadLevels(testId);
    return result;
  },
  saveLot: async (id, data) => {
    const result = await window.qcApi.saveLot({ id, data });
    if (result.ok) await get().loadLots();
    return result;
  },
  setTeaRefValue: async (input) => {
    const result = await window.qcApi.setTeaRefValue(input);
    if (result.ok) await get().loadTeaRefs();
    return result;
  },
  addTeaAnalyte: async (input) => {
    const result = await window.qcApi.addTeaAnalyte(input);
    if (result.ok) await get().loadTeaRefs();
    return result;
  },
  restoreTeaRefDefaults: async (analyteId) => {
    const result = await window.qcApi.restoreTeaRefDefaults({ analyteId });
    if (result.ok) await get().loadTeaRefs();
    return result;
  },
  removeTest: async (id, ids) => {
    const result = await window.qcApi.removeTest({ id, ids });
    if (result.ok) { await get().loadTests(); await get().loadPanels(); }
    return result;
  },
  removePanel: async (id) => {
    const result = await window.qcApi.removePanel({ id });
    if (result.ok) await get().loadPanels();
    return result;
  },
  removeLot: async (id) => {
    const result = await window.qcApi.removeLot({ id });
    if (result.ok) { await get().loadLots(); await get().loadLotGroups(); await get().loadLotTransitions(); }
    return result;
  },
  removeLotGroup: async (id) => {
    const result = await window.qcApi.removeLotGroup({ id });
    if (result.ok) { await get().loadLotGroups(); await get().loadLots(); }
    return result;
  },
  activateLotGroup: async (id) => {
    const result = await window.qcApi.activateLotGroup({ id });
    // Kích hoạt đổi cả nhóm lô LẪN Mean/SD của các mức → nạp lại cả 3.
    if (result.ok) { await get().loadLotGroups(); await get().loadLots(); await get().loadTests(); }
    return result;
  },
  stopLotGroup: async (id) => {
    const result = await window.qcApi.stopLotGroup({ id });
    if (result.ok) await get().loadLotGroups();
    return result;
  },
  removeLotTransition: async (id) => {
    const result = await window.qcApi.removeLotTransition({ id });
    if (result.ok) await get().loadLotTransitions();
    return result;
  },
  saveLotGroup: async (id, data) => {
    const result = await window.qcApi.saveLotGroup({ id, data });
    if (result.ok) { await get().loadLotGroups(); await get().loadLots(); }
    return result;
  },
  savePanel: async (id, data) => {
    const result = await window.qcApi.savePanel({ id, data });
    if (result.ok) await get().loadPanels();
    return result;
  },
  createLotTransition: async (data, id) => {
    const result = await window.qcApi.createLotTransition({ id, data });
    if (result.ok) {
      await get().loadLotTransitions();
      // 'accepted' áp Mean/SD ứng viên + đánh dấu lô cũ hết dùng + đổi nhóm
      // lô — nạp lại cả 3 để trang khác (Mean/SD, Lô & Nhóm QC) tự cập nhật.
      if (data.status === 'accepted') { await get().loadLots(); await get().loadLotGroups(); await get().loadTests(); }
    }
    return result;
  },
  saveTeaRef: async (id, data) => {
    const result = await window.qcApi.saveTeaRef({ id, data });
    if (result.ok) await get().loadTeaRefs();
    return result;
  },
  removeTeaRef: async (id) => {
    const result = await window.qcApi.removeTeaRef({ id });
    if (result.ok) await get().loadTeaRefs();
    return result;
  },
  removeTeaLabProfile: async (id) => {
    const result = await window.qcApi.removeTeaLabProfile({ id });
    if (result.ok) await get().loadTeaRefs();
    return result;
  },
  saveRuleAction: async (testId, ruleId, action) => {
    const result = await window.qcApi.saveRuleAction(testId, ruleId, action);
    if (result.ok) await get().loadTests();
    return result;
  },
  saveRuleScope: async (testId, ruleId, scope) => {
    const result = await window.qcApi.saveRuleScope(testId, ruleId, scope);
    if (result.ok) await get().loadRuleScopes(testId);
    return result;
  },
}));
