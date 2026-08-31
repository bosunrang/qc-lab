import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { ManagePage } from './pages/ManagePage';
import { EntryPage } from './pages/EntryPage';
import { WestgardPage } from './pages/WestgardPage';
import { SigmaPage } from './pages/SigmaPage';
import { ActionsPage } from './pages/ActionsPage';
import { ReagentPage } from './pages/ReagentPage';
import { UsersPage } from './pages/UsersPage';
import { AuditPage } from './pages/AuditPage';
import { LoginPage } from './pages/LoginPage';
import { useAuthStore } from './store/auth-store';

// HashRouter — app đóng gói thành file:// trong Electron, không có server để
// phục vụ route dạng path thật. Sau này thêm route thật cho từng trang trong
// số 11 trang khi module tương ứng được xây (xem thứ tự triển khai kế hoạch).
export function AppRouter() {
  const { status, user, init, logout } = useAuthStore();

  useEffect(() => { init(); }, [init]);

  if (status === 'checking') return <div style={{ padding: 24, fontFamily: 'sans-serif' }}>Đang tải…</div>;
  if (status !== 'logged-in') return <LoginPage />;

  return (
    <HashRouter>
      <nav style={{ padding: 12, fontFamily: 'sans-serif' }}>
        <Link to="/manage">Cấu hình chung</Link> | <Link to="/entry">Nhập QC</Link> | <Link to="/westgard">Phân tích Westgard</Link> | <Link to="/sigma">Six Sigma</Link> | <Link to="/actions">Khắc phục sự cố</Link> | <Link to="/reagent">So sánh hóa chất</Link> | <Link to="/audit">Nhật ký hoạt động</Link>
        {user?.role === 'admin' && <> | <Link to="/users">Người dùng</Link></>}
        {' '}— {user?.name} ({user?.role}) <button onClick={logout}>Đăng xuất</button>
      </nav>
      <Routes>
        <Route path="/manage" element={<ManagePage />} />
        <Route path="/entry" element={<EntryPage />} />
        <Route path="/westgard" element={<WestgardPage />} />
        <Route path="/sigma" element={<SigmaPage />} />
        <Route path="/actions" element={<ActionsPage />} />
        <Route path="/reagent" element={<ReagentPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/users" element={user?.role === 'admin' ? <UsersPage /> : <Navigate to="/manage" replace />} />
        <Route path="*" element={<Navigate to="/manage" replace />} />
      </Routes>
    </HashRouter>
  );
}
