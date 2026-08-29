import { createReactPageRegistry } from './bootstrap/react-page-registry';
import { renderBus } from './state/renderBus';
import { DashboardPage } from './pages/DashboardPage';
import { AuditPage } from './pages/AuditPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { ManagePage } from './pages/ManagePage';
import { ReagentPage } from './pages/ReagentPage';
import { ReportPage } from './pages/ReportPage';

const registry = createReactPageRegistry({
  dash: () => <DashboardPage />,
  audit: () => <AuditPage />,
  users: () => <UsersPage />,
  settings: () => <SettingsPage />,
  manage: () => <ManagePage />,
  reagent: () => <ReagentPage />,
  report: () => <ReportPage />,
});

(window as any).QCLabReact = {
  isReactPage: registry.isReactPage,
  mountReactPage: registry.mountReactPage,
  unmountReactPageIfMounted: registry.unmountReactPageIfMounted,
  notify: renderBus.notify,
};
