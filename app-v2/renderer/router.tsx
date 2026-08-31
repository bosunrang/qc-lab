import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { ManagePage } from './pages/ManagePage';
import { EntryPage } from './pages/EntryPage';
import { WestgardPage } from './pages/WestgardPage';
import { SigmaPage } from './pages/SigmaPage';
import { ActionsPage } from './pages/ActionsPage';
import { ReagentPage } from './pages/ReagentPage';
import { UsersPage } from './pages/UsersPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { ReportPage } from './pages/ReportPage';
import { LoginPage } from './pages/LoginPage';
import { useAuthStore } from './store/auth-store';

// HashRouter — app đóng gói thành file:// trong Electron, không có server để
// phục vụ route dạng path thật. Đủ 11/11 trang (2026-08-31).
export function AppRouter() {
  const { status, user, init, logout } = useAuthStore();

  useEffect(() => { init(); }, [init]);

  if (status === 'checking') return <div style={{ padding: 24, fontFamily: 'sans-serif' }}>Đang tải…</div>;
  if (status !== 'logged-in') return <LoginPage />;

  return (
    <HashRouter>
      <nav style={{ padding: 12, fontFamily: 'sans-serif' }}>
        <Link to="/dashboard">Tổng quan</Link> | <Link to="/manage">Cấu hình chung</Link> | <Link to="/entry">Nhập QC</Link> | <Link to="/westgard">Phân tích Westgard</Link> | <Link to="/sigma">Six Sigma</Link> | <Link to="/actions">Khắc phục sự cố</Link> | <Link to="/reagent">So sánh hóa chất</Link> | <Link to="/report">Báo cáo</Link> | <Link to="/audit">Nhật ký hoạt động</Link> | <Link to="/settings">Cài đặt</Link>
        {user?.role === 'admin' && <> | <Link to="/users">Người dùng</Link></>}
        {' '}— {user?.name} ({user?.role}) <button onClick={logout}>Đăng xuất</button>
      </nav>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/manage" element={<ManagePage />} />
        <Route path="/entry" element={<EntryPage />} />
        <Route path="/westgard" element={<WestgardPage />} />
        <Route path="/sigma" element={<SigmaPage />} />
        <Route path="/actions" element={<ActionsPage />} />
        <Route path="/reagent" element={<ReagentPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/users" element={user?.role === 'admin' ? <UsersPage /> : <Navigate to="/manage" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
}
