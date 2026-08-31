// Dashboard KHÔNG có module/domain riêng — chỉ tổng hợp lại dữ liệu đã có
// sẵn từ 3 IPC đã tồn tại (westgard:listTestSummaries, nce:listRecords,
// audit:query), đúng tinh thần "thí điểm": không phát minh domain mới cho
// một trang chỉ đọc và gộp lại.
import { create } from 'zustand';
import type { TestSummary, NceRecord, ActivityEntry, Test } from '../../shared/qc-api';

export interface AlertLevel { testId: string; testName: string; level: number; worstVerdict: 'warn' | 'rej' }
export interface OverdueAction extends NceRecord { testName: string }

interface DashboardState {
  testSummaries: TestSummary[];
  overdueActions: OverdueAction[];
  recentActivity: ActivityEntry[];
  loading: boolean;
  load: () => Promise<void>;
}

const VERDICT_RANK: Record<string, number> = { ok: 0, warn: 1, rej: 2 };

export const useDashboardStore = create<DashboardState>((set) => ({
  testSummaries: [],
  overdueActions: [],
  recentActivity: [],
  loading: true,

  load: async () => {
    const [testSummaries, nceRecords, tests, activityPage] = await Promise.all([
      window.qcApi.listTestSummaries(),
      window.qcApi.listNceRecords(),
      window.qcApi.listTests(),
      window.qcApi.queryActivity({ page: 1, pageSize: 5 }),
    ]);
    const testNameById = new Map<string, string>(tests.map((t: Test) => [t.id, t.name]));
    const today = new Date().toISOString().slice(0, 10);
    const overdueActions = nceRecords
      .filter(r => r.record_status === 'active' && r.approval_status === 'pending' && r.due_date && r.due_date < today)
      .map(r => ({ ...r, testName: (r.test_id && testNameById.get(r.test_id)) || '—' }))
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    set({ testSummaries, overdueActions, recentActivity: activityPage.rows, loading: false });
  },
}));

export function worstVerdictAlerts(testSummaries: TestSummary[]): AlertLevel[] {
  const alerts: AlertLevel[] = [];
  for (const t of testSummaries) {
    for (const lv of t.levels) {
      if (lv.worstVerdict !== 'ok') alerts.push({ testId: t.testId, testName: t.testName, level: lv.level, worstVerdict: lv.worstVerdict as 'warn' | 'rej' });
    }
  }
  return alerts.sort((a, b) => VERDICT_RANK[b.worstVerdict] - VERDICT_RANK[a.worstVerdict]);
}
