import { createReactPageRegistry } from './bootstrap/react-page-registry';
import { DashboardPage } from './pages/DashboardPage';
import { AuditPage } from './pages/AuditPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { ManagePage } from './pages/ManagePage';
import { ReagentPage } from './pages/ReagentPage';
import { ReportPage } from './pages/ReportPage';
import { SigmaPage } from './pages/SigmaPage';
import { WestgardPage } from './pages/WestgardPage';
import { ActionsPage } from './pages/ActionsPage';
import { EntryPage } from './pages/EntryPage';

const registry = createReactPageRegistry({
  dash: () => <DashboardPage />,
  audit: () => <AuditPage />,
  users: () => <UsersPage />,
  settings: () => <SettingsPage />,
  manage: () => <ManagePage />,
  reagent: () => <ReagentPage />,
  report: () => <ReportPage />,
  sigma: () => <SigmaPage />,
  westgard: () => <WestgardPage />,
  actions: () => <ActionsPage />,
  entry: () => <EntryPage />,
});

(window as any).QCLabReact = {
  isReactPage: registry.isReactPage,
  mountReactPage: registry.mountReactPage,
  unmountReactPageIfMounted: registry.unmountReactPageIfMounted,
};
