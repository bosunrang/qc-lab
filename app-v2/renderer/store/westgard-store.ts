import { create } from 'zustand';
import type { TestSummary, LevelAnalysis, RuleSetting } from '../../shared/qc-api';

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
  ruleSettings: [],

  loadSummaries: async () => {
    const summaries = await window.qcApi.listTestSummaries();
    set({ summaries });
  },
  loadAnalysis: async (testId: string, levels: number[]) => {
    if (!testId || !levels.length) { set({ analysisByLevel: {} }); return; }
    const results = await Promise.all(levels.map((level) => window.qcApi.analyzeLevel(testId, level)));
    const analysisByLevel: Record<number, LevelAnalysis> = {};
    levels.forEach((level, i) => { analysisByLevel[level] = results[i]; });
    set({ analysisByLevel });
  },
  loadRuleSettings: async () => {
    set({ ruleSettings: await window.qcApi.listRuleSettings() });
  },
  // Bật/tắt 1 luật ở tầng CHUNG đổi verdict của MỌI xét nghiệm trong hệ
  // thống (đúng app cũ's `wgSet()`/`state.westgardRules`) — nạp lại cả danh
  // sách tổng quan lẫn phân tích mức đang xem để phản ánh đúng ngay.
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
