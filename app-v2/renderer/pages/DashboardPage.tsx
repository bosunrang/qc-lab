import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardStore, worstVerdictAlerts } from '../store/dashboard-store';

const VERDICT_COLOR: Record<string, string> = { warn: 'orange', rej: 'red' };
const VERDICT_LABEL: Record<string, string> = { warn: 'Cảnh báo', rej: 'Vi phạm' };

export function DashboardPage() {
  const { testSummaries, overdueActions, recentActivity, loading, load } = useDashboardStore();

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 24, fontFamily: 'sans-serif' }}>Đang tải…</div>;

  const alerts = worstVerdictAlerts(testSummaries);
  const totalLevels = testSummaries.reduce((n, t) => n + t.levels.length, 0);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Tổng quan (thí điểm)</h1>
      <p>{testSummaries.length} xét nghiệm, {totalLevels} mức QC đang theo dõi — {alerts.length} mức đang cảnh báo/vi phạm, {overdueActions.length} sự cố quá hạn xử lý.</p>

      <h2>Cảnh báo Westgard ({alerts.length})</h2>
      {alerts.length === 0 ? <p>Không có mức nào đang cảnh báo hoặc vi phạm.</p> : (
        <table style={{ borderCollapse: 'collapse' }}>
          <thead><tr><th>Xét nghiệm</th><th>Mức</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {alerts.map(a => (
              <tr key={`${a.testId}:${a.level}`} style={{ color: VERDICT_COLOR[a.worstVerdict] }}>
                <td>{a.testName}</td><td>{a.level}</td><td>{VERDICT_LABEL[a.worstVerdict]}</td>
                <td><Link to="/westgard">Xem chi tiết →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Sự cố quá hạn xử lý ({overdueActions.length})</h2>
      {overdueActions.length === 0 ? <p>Không có hồ sơ NCE nào quá hạn.</p> : (
        <table style={{ borderCollapse: 'collapse' }}>
          <thead><tr><th>Mã NCE</th><th>Xét nghiệm</th><th>Hạn xử lý</th><th></th></tr></thead>
          <tbody>
            {overdueActions.map(a => (
              <tr key={a.id} style={{ color: 'red' }}>
                <td>{a.nce_id}</td><td>{a.testName}</td><td>{a.due_date}</td>
                <td><Link to="/actions">Xem chi tiết →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Hoạt động gần đây</h2>
      <ul>
        {recentActivity.map(a => <li key={a.id}>{a.ts} — {a.user}: {a.type} ({a.detail})</li>)}
      </ul>
      <Link to="/audit">Xem toàn bộ nhật ký →</Link>
    </div>
  );
}
