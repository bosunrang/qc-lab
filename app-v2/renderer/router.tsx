import { useEffect, type ReactElement } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { AppShell } from './components/AppShell';
import { useAuthStore } from './store/auth-store';
import { PAGE_DEFS, canUserAccessPage, firstAccessPath } from './lib/permissions';

// Trang nào ứng với id nào — id/route/nhãn/vai trò đọc từ PAGE_DEFS
// (lib/permissions.ts), file này chỉ ghép id → component. Thiếu 1 id ở đây
// mà PAGE_DEFS có sẽ bị TypeScript bắt ngay (Record<string, ...> đủ chặt vì
// truy cập bên dưới luôn theo def.id đã có trong bảng).
const PAGE_ELEMENTS: Record<string, ReactElement> = {
  dash: <DashboardPage />,
  entry: <EntryPage />,
  westgard: <WestgardPage />,
  sigma: <SigmaPage />,
  reagent: <ReagentPage />,
  actions: <ActionsPage />,
  report: <ReportPage />,
  manage: <ManagePage />,
  users: <UsersPage />,
  audit: <AuditPage />,
  settings: <SettingsPage />,
};

// HashRouter — app đóng gói thành file:// trong Electron, không có server để
// phục vụ route dạng path thật. Đủ 11/11 trang (2026-08-31). Từ Giai đoạn A1
// (docs/APP-V2-PLAN.md), mọi route con nằm trong <AppShell/> (sidebar +
// topbar + <Outlet/>) thay vì <nav> phẳng viết tay trực tiếp trong file này.
//
// MỌI route đều qua `canAccessPage()` — trước đây chỉ `/users` tự kiểm
// riêng, nên gõ thẳng `#/manage`/`#/audit`/`#/settings` vào URL là vào được
// trang admin với vai trò KTV hoặc chỉ-xem (sidebar ẩn mục đó nhưng route
// vẫn mở). Không có quyền thì điều hướng về trang đầu tiên vai trò đó vào
// được, không hiện trang trắng.
export function AppRouter() {
  const { status, user, init } = useAuthStore();

  useEffect(() => { init(); }, [init]);

  if (status === 'checking') return <div style={{ padding: 24 }}>Đang tải…</div>;
  if (status !== 'logged-in') return <LoginPage />;

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          {PAGE_DEFS.map((def) => (
            <Route
              key={def.id}
              path={def.path}
              element={canUserAccessPage(def.id, user) ? PAGE_ELEMENTS[def.id] : <Navigate to={firstAccessPath(user)} replace />}
            />
          ))}
          <Route path="*" element={<Navigate to={firstAccessPath(user)} replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
