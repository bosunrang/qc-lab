import { create } from 'zustand';
import type { TestSummary, LevelAnalysis, RuleSetting } from '../../shared/qc-api';

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
  ruleSettings: RuleSetting[];
  /** Số mức QC của xét nghiệm đang xem: luật chưa đặt riêng theo mặc định của nhóm số mức này (WG-26). */
  ruleLevelCount: number;
  loadSummaries: () => Promise<void>;
  loadAnalysis: (testId: string, levels: number[]) => Promise<void>;
  loadRuleSettings: (levelCount?: number) => Promise<void>;
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
  ruleSettings: [], ruleLevelCount: 2,

  loadSummaries: async () => {
    const revision = ++summaryRevision;
    const summaries = await window.qcApi.listTestSummaries();
    if (revision === summaryRevision) set({ summaries });
  },
  loadAnalysis: async (testId: string, levels: number[]) => {
    const revision = ++analysisRevision;
    // Nạp lại CÙNG xét nghiệm (vừa có điểm mới, đổi luật…) thì giữ phân tích
    // đang hiện cho tới khi bản mới về: xoá trắng làm cả trang đổi sang
    // "Đang tải phân tích…" và mất vị trí cuộn. Chỉ xoá khi đổi xét nghiệm.
    if (get().analysisTestId === testId && !get().analysisError) set({ analysisLoading: false });
    else set({ analysisTestId: testId, analysisLoading: !!testId && !!levels.length, analysisError: '', analysisByLevel: {} });
    if (!testId || !levels.length) { set({ analysisByLevel: {}, analysisLoading: false }); return; }
    try {
      const results = await Promise.all(levels.map((level) => window.qcApi.analyzeLevel(testId, level)));
      if (revision !== analysisRevision) return;
      const analysisByLevel: Record<number, LevelAnalysis> = {};
      levels.forEach((level, i) => { analysisByLevel[level] = results[i]; });
      set({ analysisByLevel, analysisLoading: false });
    } catch {
      if (revision === analysisRevision) set({ analysisLoading: false, analysisError: 'Không tải được phân tích. Vui lòng thử lại.' });
    }
  },
  loadRuleSettings: async (levelCount) => {
    const count = levelCount ?? get().ruleLevelCount;
    const ruleSettings = await window.qcApi.listRuleSettings(count);
    // Bỏ phản hồi cũ khi người dùng đã chuyển sang xét nghiệm khác số mức.
    if (levelCount === undefined || count === get().ruleLevelCount) set({ ruleSettings });
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
    const result = await window.qcApi.resetRuleSettings(get().ruleLevelCount);
    if (!result.ok) throw new Error(result.error.message);
    set({ ruleSettings: result.data });
    await get().loadSummaries();
  },
}));


