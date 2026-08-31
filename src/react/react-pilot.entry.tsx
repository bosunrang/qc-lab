import { createRoot } from 'react-dom/client';
import { createReactPageRegistry } from './bootstrap/react-page-registry';
import { DialogOverlay } from './dialogs/DialogOverlay';
import { confirmDialog, infoDialog, closeDialogOverlay, reauthenticateCurrentUser } from './dialogs/dialog-store';
import { ModalOverlay } from './dialogs/ModalOverlay';
import { openModal, closeModal } from './dialogs/modal-store';
import { DatePickerPopup } from './components/DatePickerPopup';
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

/* Giai đoạn 9+ (composition root viết lại/gộp bundle, Bước 0, 2026-08-31):
   guard `typeof window!=='undefined'`/`typeof document!=='undefined'` cho
   4 chỗ đụng DOM ở top-level module scope này — khớp ĐÚNG mẫu đã dùng 6 lần
   khác trong modular-pilot.global.ts (xem dòng 5715-5719 ở đó) cho
   root.boot()'s DOMContentLoaded listener. Làm việc này TRƯỚC KHI gộp 2
   bundle Vite thành một, vì đây là nguyên nhân chính xác (không phải chính
   React) khiến 61 sandbox test (tests/helpers/sandbox.js, vm.createContext
   không có window/document) từng ném ReferenceError khi thử gộp — bản thân
   thư viện React đã tự guard qua biến nội bộ canUseDOM, không cần jsdom. */
if (typeof window !== 'undefined') {
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
}

/* #dialogRoot/#modalRoot giờ mỗi cái do MỘT React root sở hữu vĩnh viễn,
   mount một lần ngay khi react-pilot.js chạy (element tĩnh trong
   index.html, có sẵn trước khi script defer này chạy) — không mount/unmount
   theo trang như #main, vì các hàm này có thể được gọi từ bất kỳ trang nào,
   kể cả lúc không có trang React nào đang active. */
if (typeof document !== 'undefined') {
  const dialogRootEl = document.getElementById('dialogRoot');
  if (dialogRootEl) createRoot(dialogRootEl).render(<DialogOverlay />);
  const modalRootEl = document.getElementById('modalRoot');
  if (modalRootEl) createRoot(modalRootEl).render(<ModalOverlay />);
  const datePickerRootEl = document.getElementById('datePickerRoot');
  if (datePickerRootEl) createRoot(datePickerRootEl).render(<DatePickerPopup />);
}
