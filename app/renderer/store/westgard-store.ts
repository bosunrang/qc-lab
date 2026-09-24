import { create } from 'zustand';
import type { TestSummary, LevelAnalysis, RuleSetting, ArchivedBlock } from '../../shared/qc-api';

// `analysisByLevel` + `loadAnalysis(testId, levels)` nạp MỌI mức của một xét
// nghiệm trong 1 lượt — cùng quy ước `entry-store.ts` đã dùng, vì trang
// Phân tích Westgard hiển thị 1 panel cho mỗi mức chứ không phải 1 mức đang
// chọn. `ruleSettings` là cấu hình luật CHUNG toàn phòng xét nghiệm (panel
// "Cấu hình chung của luật" + bảng hướng dẫn) — KHÔNG phụ thuộc xét nghiệm
// đang chọn; vì thế không dùng thay cho `analysisByLevel`.
interface WestgardState {
  summaries: TestSummary[];
  analysisTestId: string;
  analysisLoading: boolean;
  analysisError: string;
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

let analysisRevision = 0;
let summaryRevision = 0;

export const useWestgardStore = create<WestgardState>((set, get) => ({
  summaries: [],
  analysisTestId: '',
  analysisLoading: false,
  analysisError: '',
  analysisByLevel: {},
  previousLotBlocks: [],
  ruleSettings: [],

  loadSummaries: async () => {
    const revision = ++summaryRevision;
    const summaries = await window.qcApi.listTestSummaries();
    if (revision === summaryRevision) set({ summaries });
  },
  loadAnalysis: async (testId: string, levels: number[]) => {
    const revision = ++analysisRevision;
    set({ analysisTestId: testId, analysisLoading: !!testId && !!levels.length, analysisError: '', analysisByLevel: {}, previousLotBlocks: [] });
    if (!testId || !levels.length) return;
    try {
      const [results, previousLotBlocks] = await Promise.all([
        Promise.all(levels.map((level) => window.qcApi.analyzeLevel(testId, level))),
        window.qcApi.listPreviousLotBlocks(testId),
      ]);
      if (revision !== analysisRevision) return;
      const analysisByLevel: Record<number, LevelAnalysis> = {};
      levels.forEach((level, i) => { analysisByLevel[level] = results[i]; });
      set({ analysisByLevel, previousLotBlocks, analysisLoading: false });
    } catch {
      if (revision === analysisRevision) set({ analysisLoading: false, analysisError: 'Không tải được phân tích. Vui lòng thử lại.' });
    }
  },
  loadRuleSettings: async () => {
    set({ ruleSettings: await window.qcApi.listRuleSettings() });
  },
  // Bật/tắt 1 luật ở tầng CHUNG đổi verdict của MỌI xét nghiệm trong hệ
  // thống. Store nạp lại
  // danh sách tổng quan; WestgardPage nạp lại phân tích các mức đang xem vì
  // chỉ trang đó biết test/mức hiện hành.
  saveRuleSetting: async (ruleId: string, on: boolean) => {
    const result = await window.qcApi.saveRuleSetting(ruleId, on);
    if (!result.ok) throw new Error(result.error.message);
    await get().loadRuleSettings();
    await get().loadSummaries();
  },
  resetRuleSettings: async () => {
    const result = await window.qcApi.resetRuleSettings();
    if (!result.ok) throw new Error(result.error.message);
    set({ ruleSettings: result.data });
    await get().loadSummaries();
  },
}));


