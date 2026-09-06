// Dashboard KHÔNG có module/domain riêng — chỉ tổng hợp lại dữ liệu đã có
// sẵn từ 3 IPC đã tồn tại (westgard:listTestSummaries, nce:listRecords,
// audit:query), đúng tinh thần "thí điểm": không phát minh domain mới cho
// một trang chỉ đọc và gộp lại.
import { create } from 'zustand';
import type { TestSummary, NceRecord, ActivityEntry, Test, QcLot } from '../../shared/qc-api';

export interface OverdueAction extends NceRecord { testName: string }

interface DashboardState {
  testSummaries: TestSummary[];
  overdueActions: OverdueAction[];
  recentActivity: ActivityEntry[];
  lots: QcLot[];
  loading: boolean;
  load: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  testSummaries: [],
  overdueActions: [],
  recentActivity: [],
  lots: [],
  loading: true,

  load: async () => {
    const [testSummaries, nceRecords, tests, activityPage, lots] = await Promise.all([
      window.qcApi.listTestSummaries(),
      window.qcApi.listNceRecords(),
      window.qcApi.listTests(),
      window.qcApi.queryActivity({ page: 1, pageSize: 5 }),
      window.qcApi.listLots(),
    ]);
    const testNameById = new Map<string, string>(tests.map((t: Test) => [t.id, t.name]));
    const today = new Date().toISOString().slice(0, 10);
    const overdueActions = nceRecords
      .filter(r => r.record_status === 'active' && r.approval_status === 'pending' && r.due_date && r.due_date < today)
      .map(r => ({ ...r, testName: (r.test_id && testNameById.get(r.test_id)) || '—' }))
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    set({ testSummaries, overdueActions, recentActivity: activityPage.rows, lots, loading: false });
  },
}));