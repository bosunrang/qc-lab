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
  /** Lỗi của lần nạp gần nhất; trang hiện thông báo kèm nút Thử lại. */
  error: string | null;
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
  error: null,
  setQuery: (query) => set({ query }),
  setStatus: (status) => set({ status }),

  // Bắt lỗi tại đây: `loading` khởi tạo `true`, nên nếu một lệnh IPC lỗi mà
  // không hạ cờ này thì Tổng quan treo mãi ở màn hình "Đang chuẩn bị dữ liệu".
  load: async () => {
    try {
      await loadDashboard(set);
    } catch (error) {
      set({ loading: false, error: error instanceof Error && error.message ? error.message : 'Không rõ nguyên nhân.' });
    }
  },
}));

async function loadDashboard(set: (partial: Partial<DashboardState>) => void): Promise<void> {
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
  set({ testSummaries, overdueActions, lots, loading: false, error: null });
}


