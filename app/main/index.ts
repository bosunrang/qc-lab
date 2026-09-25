import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Tray } from 'electron';
import { networkInterfaces } from 'node:os';
import * as path from 'node:path';
import { openDatabase } from './db/open-database';
import { type Actor, setBroadcastWindow, setCloudChangeNotifier, setLanChangeNotifier } from './ipc/shared';
import { createBusinessOperations, createLanInvoker, registerIpcOperations, sessionContext } from './ipc/operations';
import { createDesktopOperations, desktopActor } from './ipc/desktop-operations';
import { createConfigHandlers } from './ipc/config-handlers';
import { createEntryHandlers } from './ipc/entry-handlers';
import { createWestgardHandlers } from './ipc/westgard-handlers';
import { createSigmaHandlers } from './ipc/sigma-handlers';
import { createNceHandlers } from './ipc/nce-handlers';
import { createReagentHandlers } from './ipc/reagent-handlers';
import { createAuthHandlers, type PublicUser } from './ipc/auth-handlers';
import { createAuditHandlers } from './ipc/audit-handlers';
import { createSettingsHandlers } from './ipc/settings-handlers';
import { createReportHandlers } from './ipc/report-handlers';
import { buildXlsxBase64, printHtmlToPdf } from './ipc/export-handlers';
import { createBackupHandlers } from './ipc/backup-handlers';
import { createLisHandlers } from './ipc/lis-handlers';
import { createFirebaseHandlers } from './ipc/firebase-handlers';
import { lanAddresses } from './lan/addresses';
import { LanHttpServer } from './lan/http-server';

const LAN_PORT = 3200;
let tray: Tray | null = null;
let quitting = false;
let mainWindow: BrowserWindow | null = null;

function showMainWindow(): void {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function showLanAddresses(port: number): void {
  const addresses = lanAddresses(port, networkInterfaces());
  void dialog.showMessageBox({
    type: 'info',
    title: 'Địa chỉ truy cập',
    message: 'Nhân viên mở trình duyệt và gõ một trong các địa chỉ sau:',
    detail: (addresses.length
      ? addresses.join('\n')
      : `Không tìm thấy địa chỉ IPv4 trong mạng nội bộ. Kiểm tra kết nối mạng của máy chủ rồi thử lại.\n\nCổng cố định: ${port}`)
      // Máy chủ LAN chạy HTTP thường: mật khẩu và phiên đăng nhập đi qua mạng
      // không mã hoá. Nói rõ ngay tại chỗ người quản trị phát địa chỉ cho máy trạm.
      + '\n\nLưu ý bảo mật: kết nối này KHÔNG mã hoá (HTTP). Chỉ dùng trong mạng nội bộ tin cậy của phòng xét nghiệm, '
      + `không dùng qua Wi-Fi khách hay Wi-Fi công cộng, và không mở cổng ${port} ra Internet.`,
    buttons: ['Đóng'],
  });
}

function createTray(port: number): void {
  tray?.destroy();
  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), 'build', 'icon.png'));
  tray = new Tray(icon);
  tray.setToolTip(`QC Lab — máy chủ LAN đang chạy tại cổng ${port}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở QC Lab', click: showMainWindow },
    { label: `Máy chủ LAN · cổng ${port}`, enabled: false },
    { label: 'Địa chỉ cho máy nhân viên…', click: () => showLanAddresses(port) },
    { type: 'separator' },
    { label: 'Thoát QC Lab (máy nhân viên sẽ mất kết nối)', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('double-click', showMainWindow);
}

async function createWindow(): Promise<void> {
  const userDataDir = app.getPath('userData');
  const dbPath = path.join(userDataDir, 'qclab.sqlite');
  const db = openDatabase(dbPath);
  const config = createConfigHandlers(db);
  const entry = createEntryHandlers(db);
  const westgard = createWestgardHandlers(db);
  const sigma = createSigmaHandlers(db);
  const nce = createNceHandlers(db);
  const reagent = createReagentHandlers(db);
  const auth = createAuthHandlers(db);
  const audit = createAuditHandlers(db);
  const settings = createSettingsHandlers(db, dbPath);
  const report = createReportHandlers(db);
  const backup = createBackupHandlers(db, userDataDir);
  const lis = createLisHandlers(db);
  const firebase = createFirebaseHandlers(db, userDataDir);
  setCloudChangeNotifier(firebase.onDataChanged);

  // Phiên của máy chính: app một cửa sổ nên giữ ngay trong bộ nhớ main
  // process, không cần session token/cookie. Chỉ `login`/`logout` của máy
  // chính đổi biến này; máy trạm LAN mang actor riêng theo từng lời gọi.
  let sessionActor: Actor | null = null;

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    // app là ứng dụng DESKTOP: không hỗ trợ bố cục mobile/tablet.
    // Toàn bộ CSS `@media(max-width:N)` với N <= 980 đã bị gỡ (2026-09-11),
    // nên cửa sổ hẹp hơn mức này sẽ không có bố cục nào đỡ. Chặn ở đây là
    // thứ làm cho việc gỡ đó AN TOÀN, không chỉ là chưa ai thử.
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  setBroadcastWindow(win);

  // Mọi kênh IPC và mọi tuyến RPC của LAN sinh từ CÙNG hai bảng này — xem
  // `ipc/operations.ts`. Không gọi `ipcMain.handle` trực tiếp ở nơi khác.
  const operationTables = [
    createBusinessOperations({ auth, config, audit, entry, westgard, sigma, nce, reagent, settings, report, lis }),
    createDesktopOperations({ db, auth, backup, firebase }, {
      session: { get: () => sessionActor, set: (actor) => { sessionActor = actor; } },
      pickBackupSavePath: async (defaultName) => {
        const picked = await dialog.showSaveDialog(win, {
          title: 'Xuất backup QC Lab',
          defaultPath: defaultName,
          filters: [{ name: 'Backup QC Lab', extensions: ['sqlite'] }],
        });
        return picked.canceled || !picked.filePath ? null : picked.filePath;
      },
      pickBackupOpenPath: async () => {
        const picked = await dialog.showOpenDialog(win, {
          title: 'Chọn tệp backup để phục hồi',
          properties: ['openFile'],
          filters: [{ name: 'Backup QC Lab', extensions: ['sqlite', 'json'] }],
        });
        return picked.canceled || !picked.filePaths[0] ? null : picked.filePaths[0];
      },
      buildXlsxBase64,
      printHtmlToPdf: (input) => printHtmlToPdf(win, input.html, input.defaultFileName, input.pageNumbers),
      basename: (filePath) => path.basename(filePath),
    }),
  ];
  registerIpcOperations(ipcMain, operationTables, sessionContext(() => sessionActor));

  const lan = new LanHttpServer<PublicUser>({
    login: (input) => auth.login(input as { data: { username: string; password: string } }),
    getLoginBrand: () => settings.getLoginBrand(),
    actorOf: desktopActor,
    currentUser: (actor) => auth.getUser(actor.userId),
    invoke: createLanInvoker(operationTables),
    staticDir: path.join(__dirname, '..', 'renderer'),
  });
  mainWindow = win;
  let lanPort: number;
  try {
    lanPort = await lan.start(LAN_PORT);
  } catch (error) {
    const detail = error instanceof Error ? `\n\n${error.message}` : '';
    throw new Error(`Cổng cố định ${LAN_PORT} đang được chương trình khác sử dụng. Hãy đóng chương trình đó rồi mở lại QC Lab.${detail}`);
  }
  setLanChangeNotifier((payload) => lan.publishChanged(payload));
  console.log(`QC Lab LAN server is listening on port ${lanPort}`);

  createTray(lanPort);
  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });

  const devServerUrl = process.env.APP_V2_DEV_SERVER_URL;
  if (devServerUrl) win.loadURL(devServerUrl);
  else win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

// Một lần bấm icon thứ hai không được tạo thêm server LAN. Cổng 3200 là cố
// định cho các máy trạm, vì vậy ta chuyển yêu cầu đó cho bản QC Lab đang chạy.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);
  app.whenReady().then(createWindow).catch((error) => {
    dialog.showErrorBox('Không khởi động được QC Lab', error instanceof Error ? error.message : 'Không thể khởi động máy chủ LAN.');
    app.quit();
  });

  app.on('window-all-closed', () => {
    // Máy chủ LAN phải tiếp tục chạy khi cửa sổ chỉ được ẩn xuống khay.
  });
  app.on('before-quit', () => { quitting = true; });
}


