import { createRoot } from 'react-dom/client';
import { createReactPageRegistry } from './bootstrap/react-page-registry';
import { DialogOverlay } from './dialogs/DialogOverlay';
import { confirmDialog, infoDialog, closeDialogOverlay, reauthenticateCurrentUser } from './dialogs/dialog-store';
import { ModalOverlay } from './dialogs/ModalOverlay';
import { openModal, closeModal } from './dialogs/modal-store';
import { openConfigInstrument } from './bridge/manageBridge';
import { sgOpenAddTest, sgOpenMU } from './bridge/sigmaBridge';
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
  confirmDialog, infoDialog, closeDialogOverlay, reauthenticateCurrentUser,
  openModal, closeModal,
  openConfigInstrument,
  sgOpenAddTest,
  sgOpenMU,
};

/* #dialogRoot/#modalRoot giờ mỗi cái do MỘT React root sở hữu vĩnh viễn,
   mount một lần ngay khi react-pilot.js chạy (element tĩnh trong
   index.html, có sẵn trước khi script defer này chạy) — không mount/unmount
   theo trang như #main, vì các hàm này có thể được gọi từ bất kỳ trang nào,
   kể cả lúc không có trang React nào đang active. */
const dialogRootEl = document.getElementById('dialogRoot');
if (dialogRootEl) createRoot(dialogRootEl).render(<DialogOverlay />);
const modalRootEl = document.getElementById('modalRoot');
if (modalRootEl) createRoot(modalRootEl).render(<ModalOverlay />);
