import { create } from 'zustand';
import type { PeriodLockRow, IpcResult, QcMonthlyReview, QcMonthlyReviewSignature, QcReviewConclusion, ReportForm, ReportFormKind, ReportTemplateSettings } from '../../shared/qc-api';

let reviewRequestSerial = 0;

interface ReportState {
  locks: PeriodLockRow[];
  template: ReportTemplateSettings | null;
  loadLocks: () => Promise<void>;
  loadTemplate: () => Promise<void>;
  saveTemplate: (data: ReportForm & { kind: ReportFormKind }) => Promise<IpcResult<ReportTemplateSettings>>;
  lock: (ym: string, note: string, acknowledge?: boolean) => Promise<IpcResult<PeriodLockRow>>;
  unlock: (ym: string, note: string) => Promise<IpcResult<{ ym: string }>>;
  /** Biên bản xem xét QC tháng đang xem (GV4 mục 2). */
  review: QcMonthlyReview | null;
  reviewLoading: boolean;
  loadReview: (ym: string) => Promise<void>;
  signReview: (ym: string, conclusion: QcReviewConclusion, note: string) => Promise<IpcResult<QcMonthlyReviewSignature>>;
}

export const useReportStore = create<ReportState>((set, get) => ({
  locks: [],
  template: null,
  review: null,
  reviewLoading: false,

  loadLocks: async () => set({ locks: await window.qcApi.listPeriodLocks() }),
  loadTemplate: async () => set({ template: await window.qcApi.getReportTemplateSettings() }),
  saveTemplate: async (data) => {
    const result = await window.qcApi.saveReportTemplateSettings({ data });
    if (result.ok) set({ template: result.data });
    return result;
  },
  // Không tự nạp lại sau khi ghi (kế hoạch kiến trúc D.1): main báo `period_locks`
  // sau commit và trang Báo cáo nạp lại qua `useStoreInvalidation` — tự nạp ở đây làm
  // danh sách nạp HAI lần. Không chỗ gọi nào đọc danh sách ngay sau `await`.
  lock: async (ym, note, acknowledge) => {
    const result = await window.qcApi.lockPeriod({ data: { ym, note, ...(acknowledge ? { acknowledge: true } : {}) } });
    return result;
  },
  unlock: async (ym, note) => {
    const result = await window.qcApi.unlockPeriod({ data: { ym, note } });
    return result;
  },
  loadReview: async (ym) => {
    // Đổi tháng khi lượt trước chưa xong: chỉ lượt mới nhất được hiện.
    const request = ++reviewRequestSerial;
    set({ reviewLoading: true, ...(get().review?.ym === ym ? {} : { review: null }) });
    try {
      const review = await window.qcApi.getQcMonthlyReview(ym);
      if (request === reviewRequestSerial) set({ review });
    } finally {
      // Lỗi vẫn đi tới bộ báo lỗi chung; mở lại nút tải để người dùng thử lại.
      if (request === reviewRequestSerial) set({ reviewLoading: false });
    }
  },
  // Main báo `qc_month_reviews` sau khi ký; trang nạp lại qua `useStoreInvalidation`.
  signReview: async (ym, conclusion, note) => window.qcApi.signQcMonthlyReview({ data: { ym, conclusion, note } }),
}));


