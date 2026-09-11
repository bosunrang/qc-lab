import { create } from 'zustand';
import type { TestSummary, LevelAnalysis, RuleSetting, ArchivedBlock } from '../../shared/qc-api';

// `analysisByLevel` + `loadAnalysis(testId, levels)` nạp MỌI mức của một xét
// nghiệm trong 1 lượt — cùng quy ước `entry-store.ts` đã dùng, vì trang
// Phân tích Westgard hiển thị 1 panel cho mỗi mức chứ không phải 1 mức đang
// chọn. `ruleSettings` là cấu hình luật CHUNG toàn phòng xét nghiệm (panel
// "Cấu hình chung của luật" + bảng hướng dẫn) — KHÔNG phụ thuộc xét nghiệm
// đang chọn, khác hẳn `analysisByLevel` (đọc theo giọng nói `saveRuleAction`
// cũ trước đây nhầm lẫn 2 khái niệm này, xem westgard-handlers.ts).
interface WestgardState {
  summaries: TestSummary[];
  analysisByLevel: Record<number, LevelAnalysis>;
  /** Chuỗi lô cũ của xét nghiệm đang xem (công tắc "Xem lô cũ"). Nạp cùng
   * nhịp với `analysisByLevel` để `useStoreInvalidation` của trang chạm tới
   * được — thêm/huỷ điểm hay đổi Mean/SD đều làm số liệu lô cũ đổi theo. */
  previousLotBlocks: ArchivedBlock[];
  ruleSettings: RuleSetting[];
  loadSummaries: () => Promise<void>;
  loadAnalysis: (testId: string, levels: number[]) => Promise<void>;
  loadRuleSettings: () => Promise<void>;
  saveRuleSetting: (ruleId: string, on: boolean) => Promise<void>;
  resetRuleSettings: () => Promise<void>;
}

export const useWestgardStore = create<WestgardState>((set, get) => ({
  summaries: [],
  analysisByLevel: {},
  previousLotBlocks: [],
  ruleSettings: [],

  loadSummaries: async () => {
    const summaries = await window.qcApi.listTestSummaries();
    set({ summaries });
  },
  loadAnalysis: async (testId: string, levels: number[]) => {
    if (!testId || !levels.length) { set({ analysisByLevel: {}, previousLotBlocks: [] }); return; }
    const [results, previousLotBlocks] = await Promise.all([
      Promise.all(levels.map((level) => window.qcApi.analyzeLevel(testId, level))),
      window.qcApi.listPreviousLotBlocks(testId),
    ]);
    const analysisByLevel: Record<number, LevelAnalysis> = {};
    levels.forEach((level, i) => { analysisByLevel[level] = results[i]; });
    set({ analysisByLevel, previousLotBlocks });
  },
  loadRuleSettings: async () => {
    set({ ruleSettings: await window.qcApi.listRuleSettings() });
  },
  // Bật/tắt 1 luật ở tầng CHUNG đổi verdict của MỌI xét nghiệm trong hệ
  // thống (đúng app cũ's `wgSet()`/`state.westgardRules`). Store nạp lại
  // danh sách tổng quan; WestgardPage nạp lại phân tích các mức đang xem vì
  // chỉ trang đó biết test/mức hiện hành.
  saveRuleSetting: async (ruleId: string, on: boolean) => {
    await window.qcApi.saveRuleSetting(ruleId, on);
    await get().loadRuleSettings();
    await get().loadSummaries();
  },
  resetRuleSettings: async () => {
    const result = await window.qcApi.resetRuleSettings();
    if (result.ok) set({ ruleSettings: result.data });
    await get().loadSummaries();
  },
}));
