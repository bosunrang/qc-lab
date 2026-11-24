// Chỉ giữ bản nháp trong phiên ứng dụng; lưu nghiệp vụ phải qua ký xem xét.
import { create } from 'zustand';
import type { EqaReviewDraft } from '../../shared/qc-api';

export const useEqaReportDraftStore = create<{
  drafts: Record<string, EqaReviewDraft>;
  put: (key: string, draft: EqaReviewDraft) => void;
  remove: (key: string) => void;
}>((set) => ({
  drafts: {},
  put: (key, draft) => set((s) => ({ drafts: { ...s.drafts, [key]: draft } })),
  remove: (key) => set((s) => {
    const drafts = { ...s.drafts };
    delete drafts[key];
    return { drafts };
  }),
}));
