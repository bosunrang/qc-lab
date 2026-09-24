// Dashboard KHÔNG có module/domain riêng — chỉ tổng hợp lại dữ liệu từ các
// IPC đã có. Quy tắc trình bày/ lọc nghiệp vụ thuần nằm trong view-model.
import { create } from 'zustand';
import { todayIso } from '../lib/format';
import { dashboardNceOverdue, operationalDashboardSummaries, type DashboardStatus } from '../view-models/dashboard-view-model';
import type { TestSummary, NceRecord, Test, QcLot } from '../../shared/qc-api';

export type DashboardFilterStatus = 'all' | 'missing' | DashboardStatus;
export interface OverdueAction extends NceRecord { testName: string; overdueDays: number; overdueLabel: string; owner: string }

interface DashboardState {
  testSummaries: TestSummary[];
  overdueActions: OverdueAction[];
  lots: QcLot[];
  query: string;
  status: DashboardFilterStatus;
  loading: boolean;
  setQuery: (query: string) => void;
  setStatus: (status: DashboardFilterStatus) => void;
  load: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  testSummaries: [],
  overdueActions: [],
  lots: [],
  query: '',
  status: 'all',
  loading: true,
  setQuery: (query) => set({ query }),
  setStatus: (status) => set({ status }),

  load: async () => {
    const [allSummaries, nceRecords, tests, panels, lots] = await Promise.all([
      window.qcApi.listTestSummaries(),
      window.qcApi.listNceRecords(),
      window.qcApi.listTests(),
      window.qcApi.listPanels(),
      window.qcApi.listLots(),
    ]);
    const testSummaries = operationalDashboardSummaries(allSummaries, tests, panels);
    const testNameById = new Map<string, string>(tests.map((t: Test) => [t.id, t.name]));
    const today = todayIso();
    const overdueActions = nceRecords
      .map(record => ({ record, info: dashboardNceOverdue(record, today) }))
      .filter(item => item.info.overdue)
      .sort((a, b) => b.info.days - a.info.days)
      .map(({ record, info }) => ({
        ...record,
        testName: (record.test_id && testNameById.get(record.test_id)) || '—',
        overdueDays: info.days,
        overdueLabel: info.label,
        owner: info.owner,
      }));
    set({ testSummaries, overdueActions, lots, loading: false });
  },
}));


