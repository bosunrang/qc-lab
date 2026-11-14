import { app, BrowserWindow, crashReporter, dialog, ipcMain, Menu, nativeImage, safeStorage, shell, Tray, type WebContents } from 'electron';
import { writeFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDatabase } from './db/open-database';
import { type Actor, setBroadcastWindow, setCloudChangeNotifier, setLanChangeNotifier, notifyChanged } from './ipc/shared';
import { createBusinessOperations, createLanInvoker, registerIpcOperations, sessionContext } from './ipc/operations';
import { createDesktopOperations, desktopActor } from './ipc/desktop-operations';
import { createAccessGate } from './ipc/access-gate';
import { createSessionCheck } from './lan/session-check';
import { createConfigHandlers } from './ipc/config-handlers';
import { createEntryHandlers } from './ipc/entry-handlers';
import { createWestgardHandlers } from './ipc/westgard-handlers';
import { createSigmaHandlers } from './ipc/sigma-handlers';
import { createNceHandlers } from './ipc/nce-handlers';
import { createReagentHandlers } from './ipc/reagent-handlers';
import { createEqaHandlers } from './ipc/eqa-handlers';
import { createAuthHandlers, type PublicUser } from './ipc/auth-handlers';
import { createAuditHandlers } from './ipc/audit-handlers';
import { createSettingsHandlers } from './ipc/settings-handlers';
import { createReportHandlers } from './ipc/report-handlers';
import { buildXlsxBase64, printHtmlToPdf } from './ipc/export-handlers';
import { createBackupHandlers } from './ipc/backup-handlers';
import { createLisHandlers } from './ipc/lis-handlers';
import { createFirebaseHandlers } from './ipc/firebase-handlers';
import { createUtilityPushRunner } from './sync/firebase-push-runner';
import { fileSecretStore } from './sync/firebase-secret-store';
import { lanIpv4 } from './lan/addresses';
import { LanHttpServer } from './lan/http-server';
import { caCoversIp, caThumbprint, type LanCa } from './lan/tls-certs';
import { LanTlsIdentity, loadOrCreateCa, sealedKeyProtector } from './lan/tls-store';
import { classifyNavigation } from './window-guard';
import { createFileLogger } from './logging/file-logger';
import { describeError, logEvent, setLogSink } from './logging/log-sink';
import { autoUpdater } from 'electron-updater';
import licensePublicKey from './licensing/public-key.json';
import { readMachineCode } from './licensing/machine-code';
import { createLicenseService } from './licensing/license-service';
import { createUpdateService } from './updates/update-service';
import { createSoftwareOperations } from './ipc/software-operations';

// Test end-to-end (`app/e2e/`) chạy app thật trên thư mục dữ liệu tạm và một
// cổng LAN riêng, để không đụng CSDL của người dùng và chạy được cả khi
// QC Lab thật đang mở. Khoá một phiên chạy (`requestSingleInstanceLock`) gắn
// với thư mục dữ liệu, nên phải đặt trước khi xin khoá.
if (process.env.QCLAB_USER_DATA_DIR) app.setPath('userData', process.env.QCLAB_USER_DATA_DIR);
const LAN_PORT = Number(process.env.QCLAB_LAN_PORT) || 3200;

// Log và báo crash CHỈ lưu tại máy (người dùng chốt ở kế hoạch G.2): không
// gửi đi đâu, người quản trị tự mở thư mục ở trang Cài đặt khi cần báo lỗi.
const LOG_DIR = path.join(app.getPath('userData'), 'logs');
app.setPath('crashDumps', path.join(LOG_DIR, 'crashes'));
crashReporter.start({ uploadToServer: false });
const fileLogger = createFileLogger({ dir: LOG_DIR });
setLogSink((entry) => fileLogger.write(entry));
// `uncaughtExceptionMonitor` chỉ quan sát: Electron vẫn xử lý exception như
// trước (hộp thoại lỗi của main), khác `uncaughtException` sẽ nuốt mất nó.
process.on('uncaughtExceptionMonitor', (error) => {
  const described = describeError(error);
  logEvent({ level: 'error', source: 'main', message: `Exception không được bắt: ${described.message}`, detail: described.stack });
});
process.on('unhandledRejection', (reason) => {
  const described = describeError(reason);
  logEvent({ level: 'error', source: 'main', message: `Promise bị từ chối không được bắt: ${described.message}`, detail: described.stack });
});
app.on('render-process-gone', (_event, _contents, details) => {
  logEvent({ level: 'error', source: 'main', message: `Tiến trình hiển thị dừng: ${details.reason} (mã ${details.exitCode})` });
});
app.on('child-process-gone', (_event, details) => {
  logEvent({ level: 'error', source: 'main', message: `Tiến trình phụ ${details.type} dừng: ${details.reason} (mã ${details.exitCode})` });
});
let tray: Tray | null = null;
let quitting = false;
let mainWindow: BrowserWindow | null = null;
// Bản đóng gói không nhận địa chỉ dev server từ biến môi trường: nếu không,
// ai đặt được biến môi trường là thay được toàn bộ giao diện (GV5).
const DEV_SERVER_URL = app.isPackaged ? undefined : process.env.QCLAB_DEV_SERVER_URL;
/** DevTools chỉ có khi chạy từ mã nguồn. Bản đóng gói mở được DevTools thì
 * người chưa đăng nhập gọi thẳng được IPC của máy chính (GV5). */
const DEV_TOOLS = !app.isPackaged;
const INDEX_HTML = path.join(__dirname, '..', 'renderer', 'index.html');
/** URL trang chính — mốc để quyết định điều hướng, xem `window-guard.ts`. */
const APP_ENTRY_URL = DEV_SERVER_URL || pathToFileURL(INDEX_HTML).href;
const CHILD_WINDOW_PREFERENCES = { sandbox: true, contextIsolation: true, nodeIntegration: false, devTools: DEV_TOOLS };

/** Áp cho MỌI webContents (cửa sổ chính, cửa sổ hướng dẫn, cửa sổ in PDF):
 * chỉ hiển thị trang của app; liên kết `https:` ra ngoài mở bằng trình duyệt
 * hệ thống. */
function guardNavigation(contents: WebContents): void {
  contents.on('will-navigate', (event, url) => {
    const decision = classifyNavigation(url, APP_ENTRY_URL);
    if (decision === 'app') return;
    event.preventDefault();
    if (decision === 'external') void shell.openExternal(url);
  });
  contents.setWindowOpenHandler(({ url }) => {
    const decision = classifyNavigation(url, APP_ENTRY_URL);
    // Trang của app mở ở cửa sổ con (vd hướng dẫn Firebase ở trang Cài đặt).
    if (decision === 'app') return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: CHILD_WINDOW_PREFERENCES } };
    if (decision === 'external') void shell.openExternal(url);
    return { action: 'deny' };
  });
}

function showMainWindow(): void {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/**
 * CA và chứng chỉ HTTPS của máy chủ LAN, lưu ở `userData/lan-tls`. Khoá CA
 * được `safeStorage` (DPAPI) mã hoá. Tạo CA mới nghĩa là mọi máy nhân viên
 * phải cài lại chứng chỉ gốc, nên luôn ghi log kèm lý do.
 */
function startLanTls(userDataDir: string): LanTlsIdentity {
  const protector = sealedKeyProtector(safeStorage);
  if (!protector.sealed) logEvent({ level: 'warn', source: 'lan', message: 'Hệ điều hành không cho mã hoá khoá CA; khoá được lưu không mã hoá.' });
  const loaded = loadOrCreateCa(path.join(userDataDir, 'lan-tls'), protector);
  if (loaded.created) logEvent({ level: 'warn', source: 'lan', message: `Tạo CA mới cho HTTPS của LAN (${loaded.reason}); máy nhân viên cần cài chứng chỉ gốc ${caThumbprint(loaded.ca)}` });
  return new LanTlsIdentity(loaded.ca, lanIpv4(networkInterfaces()));
}

async function saveCaCertificate(ca: LanCa): Promise<void> {
  const picked = await dialog.showSaveDialog({
    title: 'Lưu chứng chỉ gốc cho máy nhân viên',
    defaultPath: 'QC-Lab-CA.crt',
    filters: [{ name: 'Chứng chỉ', extensions: ['crt'] }],
  });
  if (picked.canceled || !picked.filePath) return;
  await writeFile(picked.filePath, ca.certDer);
}

function showLanAddresses(port: number, ca: LanCa): void {
  const ips = lanIpv4(networkInterfaces());
  const usable = ips.filter(caCoversIp);
  const outside = ips.filter((ip) => !caCoversIp(ip));
  const lines = usable.length
    ? usable.map((ip) => `https://${ip}:${port}`).join('\n')
    : `Không tìm thấy địa chỉ IPv4 trong mạng nội bộ. Kiểm tra kết nối mạng của máy chủ rồi thử lại.\n\nCổng cố định: ${port}`;
  // Địa chỉ ngoài dải nội bộ: CA bị giới hạn ở dải nội bộ (xem tls-certs.ts)
  // nên trình duyệt sẽ từ chối; nói rõ thay vì phát một địa chỉ không dùng được.
  const outsideNote = outside.length
    ? `\n\nKhông dùng được (không thuộc dải mạng nội bộ): ${outside.join(', ')}`
    : '';
  void dialog.showMessageBox({
    type: 'info',
    title: 'Địa chỉ truy cập',
    message: 'Nhân viên mở trình duyệt và gõ một trong các địa chỉ sau:',
    detail: lines + outsideNote
      + '\n\nLần đầu trên mỗi máy nhân viên: mở địa chỉ trên bằng http:// thay cho https://, làm theo hướng dẫn để tải '
      + 'và cài chứng chỉ gốc (hoặc chép tệp chứng chỉ bằng nút bên dưới). Khi Windows hỏi xác nhận, Thumbprint phải trùng:\n\n'
      + `${caThumbprint(ca)}\n\n`
      + `Không mở cổng ${port} ra Internet.`,
    buttons: ['Lưu chứng chỉ gốc…', 'Đóng'],
    defaultId: 1,
    cancelId: 1,
  }).then(({ response }) => { if (response === 0) return saveCaCertificate(ca); })
    .catch((error) => logEvent({ level: 'error', source: 'lan', message: `Không lưu được chứng chỉ gốc: ${describeError(error).message}` }));
}

function createTray(port: number, ca: LanCa): void {
  tray?.destroy();
  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), 'build', 'icon.png'));
  tray = new Tray(icon);
  tray.setToolTip(`QC Lab — máy chủ LAN đang chạy tại cổng ${port}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở QC Lab', click: showMainWindow },
    { label: `Máy chủ LAN · cổng ${port}`, enabled: false },
    { label: 'Địa chỉ cho máy nhân viên…', click: () => showLanAddresses(port, ca) },
    { type: 'separator' },
    { label: 'Thoát QC Lab (máy nhân viên sẽ mất kết nối)', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('double-click', showMainWindow);
}

async function createWindow(): Promise<void> {
  const userDataDir = app.getPath('userData');
  const dbPath = path.join(userDataDir, 'qclab.sqlite');
  const db = openDatabase(dbPath);
  // Đóng kết nối khi thoát để SQLite gộp tệp `-wal` vào `qclab.sqlite`: người
  // dùng chép tay riêng tệp chính sau khi tắt app vẫn có đủ dữ liệu.
  app.once('will-quit', () => {
    try { db.close(); } catch { /* đã đóng */ }
  });
  const config = createConfigHandlers(db);
  const entry = createEntryHandlers(db);
  const westgard = createWestgardHandlers(db);
  const sigma = createSigmaHandlers(db);
  const nce = createNceHandlers(db);
  const reagent = createReagentHandlers(db);
  const eqa = createEqaHandlers(db);
  const auth = createAuthHandlers(db);
  const audit = createAuditHandlers(db);
  const settings = createSettingsHandlers(db, dbPath);
  const report = createReportHandlers(db);
  const backup = createBackupHandlers(db, userDataDir);
  const lis = createLisHandlers(db);
  // Gói sao lưu Firebase dựng và gửi ở tiến trình phụ (đọc tệp CSDL bằng kết
  // nối chỉ đọc riêng), không chặn cửa sổ và máy trạm LAN.
  // Refresh token của phiên Firebase lưu mã hoá ngoài CSDL, để sao lưu tự
  // động chạy tiếp sau khi mở lại app (GV6).
  const firebase = createFirebaseHandlers(db, userDataDir, undefined, {
    dbPath,
    pushRunner: createUtilityPushRunner(path.join(__dirname, 'sync', 'firebase-push-worker.js')),
    secretStore: fileSecretStore(path.join(userDataDir, 'firebase-session.bin'), sealedKeyProtector(safeStorage)),
  });
  // Đóng app mà còn thay đổi chưa đẩy lên Firebase: đẩy nốt rồi mới thoát,
  // chờ tối đa 30 giây để một mạng chậm không giữ app mãi.
  let flushedBeforeQuit = false;
  app.on('before-quit', (event) => {
    if (flushedBeforeQuit || !firebase.hasPendingPush()) return;
    event.preventDefault();
    flushedBeforeQuit = true;
    logEvent({ level: 'info', source: 'app', message: 'Đẩy nốt thay đổi lên Firebase trước khi thoát' });
    void Promise.race([firebase.flushPending(), new Promise((resolve) => setTimeout(resolve, 30_000))]).finally(() => app.quit());
  });
  setCloudChangeNotifier(firebase.onDataChanged);

  // Phiên của máy chính: app một cửa sổ nên giữ ngay trong bộ nhớ main
  // process, không cần session token/cookie. Chỉ `login`/`logout` của máy
  // chính đổi biến này; máy trạm LAN mang actor riêng theo từng lời gọi.
  let sessionActor: Actor | null = null;
  let machineCode = '', identityError = '';
  try { machineCode = readMachineCode(); } catch { identityError = 'Không đọc được mã máy. Kiểm tra quyền đọc định danh Windows rồi mở lại ứng dụng.'; }
  // Chỉ bản chạy từ mã nguồn được nhận khoá/điều kiện thử nghiệm. Biến môi
  // trường không thể vô hiệu hoá kích hoạt hoặc thay khoá của bản đã cài.
  const license = createLicenseService(db, {
    required: app.isPackaged || process.env.QCLAB_REQUIRE_ACTIVATION === '1', machineCode, identityError,
    publicKey: !app.isPackaged && process.env.QCLAB_LICENSE_PUBLIC_KEY ? process.env.QCLAB_LICENSE_PUBLIC_KEY : licensePublicKey.publicKey,
  });
  // Bộ cập nhật của bản cài chạy ở máy chính, không phụ thuộc tài khoản QC
  // đang đăng nhập. Actor nội bộ chỉ dùng cho sao lưu và nhật ký cài đặt.
  const updateActor: Actor = { userId: '', username: 'updater', name: 'Cập nhật phần mềm', role: 'admin', clientId: 'app-desktop' };
  let updatePromptOpen = false;
  const updates = createUpdateService(app.isPackaged && process.platform === 'win32' ? autoUpdater : null, {
    currentVersion: app.getVersion(), changed: () => {
      notifyChanged(['software_update']);
      if (updates.status().phase === 'downloaded') void promptInstall();
    },
    prepareInstall: async () => {
      // Chụp bản an toàn ngay trước khi cài; không đổi tệp SQLite đang dùng.
      const snapshot = backup.exportBackupTo(path.join(userDataDir, `before-update-${Date.now()}.sqlite`), updateActor);
      if (!snapshot.ok) throw new Error('Không tạo được bản sao lưu trước cập nhật.');
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([firebase.flushPending(), new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('Đồng bộ trước cập nhật quá thời gian.')), 30_000);
        })]);
      } finally { if (timeout) clearTimeout(timeout); }
    },
    beforeInstall: () => { quitting = true; flushedBeforeQuit = true; },
    installFailed: () => { quitting = false; flushedBeforeQuit = false; showMainWindow(); },
  });

  async function promptInstall() {
    if (updatePromptOpen || updates.status().phase !== 'downloaded') return;
    updatePromptOpen = true;
    try {
      const result = await dialog.showMessageBox({
        type: 'info', title: 'Cập nhật QC Lab',
        message: `Đã tải phiên bản QC Lab ${updates.status().available_version}.`,
        detail: 'Hoàn tất các biểu mẫu đang nhập trước khi cập nhật. Ứng dụng sẽ sao lưu dữ liệu rồi khởi động lại để cài bản mới. Máy trạm LAN sẽ tạm mất kết nối.',
        buttons: ['Khởi động lại và cập nhật', 'Để sau'], defaultId: 1, cancelId: 1, noLink: true,
      });
      if (result.response !== 0) return;
      const installed = await softwareOperations.installSoftwareUpdate.run({ actor: () => updateActor });
      if (!installed.ok) await dialog.showMessageBox({ type: 'error', title: 'Chưa cập nhật được', message: installed.error.message });
    } catch (error) {
      logEvent({ level: 'error', source: 'updater', message: 'Không mở được thông báo cập nhật', detail: describeError(error).message });
    } finally { updatePromptOpen = false; }
  }

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
      sandbox: true,
      devTools: DEV_TOOLS,
    },
  });

  setBroadcastWindow(win);

  // Mọi kênh IPC và mọi tuyến RPC của LAN sinh từ cùng các bảng này — xem
  // `ipc/operations.ts`. Không gọi `ipcMain.handle` trực tiếp ở nơi khác.
  const softwareOperations = createSoftwareOperations(db, license, updates,
    { get: () => sessionActor, set: (actor) => { sessionActor = actor; } },
    () => { if (app.isPackaged && process.platform === 'win32') void updates.check(); });
  const operationTables = [
    createBusinessOperations({ auth, config, audit, entry, westgard, sigma, nce, reagent, eqa, settings, report, lis }),
    createDesktopOperations({ db, auth, backup, firebase }, {
      session: { get: () => sessionActor, set: (actor) => { sessionActor = actor; } },
      pickBackupSavePath: async (defaultName) => {
        const picked = await dialog.showSaveDialog(win, {
          title: 'Xuất bản sao lưu QC Lab',
          defaultPath: defaultName,
          filters: [{ name: 'Backup QC Lab', extensions: ['sqlite'] }],
        });
        return picked.canceled || !picked.filePath ? null : picked.filePath;
      },
      pickBackupOpenPath: async () => {
        const picked = await dialog.showOpenDialog(win, {
          title: 'Chọn tệp sao lưu để phục hồi',
          properties: ['openFile'],
          filters: [{ name: 'Backup QC Lab', extensions: ['sqlite', 'json'] }],
        });
        return picked.canceled || !picked.filePaths[0] ? null : picked.filePaths[0];
      },
      buildXlsxBase64,
      printHtmlToPdf: (input) => printHtmlToPdf(win, input.html, input.defaultFileName, input.pageNumbers),
      basename: (filePath) => path.basename(filePath),
      logDir: LOG_DIR,
      openFolder: (folder) => shell.openPath(folder),
      pickLogBundleSavePath: async (defaultName) => {
        const picked = await dialog.showSaveDialog(win, {
          title: 'Xuất gói log để gửi khi báo lỗi',
          defaultPath: defaultName,
          filters: [{ name: 'Tệp nén', extensions: ['zip'] }],
        });
        return picked.canceled || !picked.filePath ? null : picked.filePath;
      },
      writeFile: (filePath, data) => writeFile(filePath, data),
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
    }),
    softwareOperations,
  ];
  // Cổng quyền đọc lại tài khoản ở MỖI lời gọi, cho cả máy chính lẫn máy trạm.
  const accessGate = createAccessGate(db, license.allowed);
  registerIpcOperations(ipcMain, operationTables, sessionContext(() => sessionActor), accessGate);

  const lanTls = startLanTls(userDataDir);
  const lan = new LanHttpServer<PublicUser>({
    login: (input, clientId) => auth.login(input as { data: { username: string; password: string } }, clientId),
    getLoginBrand: () => settings.getLoginBrand(),
    getLicenseStatus: () => ({ ...license.status(), runtime: 'lan' }),
    licenseAllowed: license.allowed,
    actorOf: desktopActor,
    currentUser: (actor) => auth.getUser(actor.userId),
    sessionCheck: createSessionCheck(db),
    invoke: createLanInvoker(operationTables, accessGate),
    staticDir: path.join(__dirname, '..', 'renderer'),
    tls: { credentials: () => lanTls.credentials, caCertificate: () => lanTls.ca.certDer },
  });
  // Máy chính đổi IP (DHCP, cắm mạng khác) thì cấp chứng chỉ máy chủ mới cho
  // địa chỉ mới; máy nhân viên không phải cài lại vì vẫn cùng CA.
  setInterval(() => {
    if (!lanTls.refresh(lanIpv4(networkInterfaces()))) return;
    lan.reloadTls();
    logEvent({ level: 'info', source: 'lan', message: `Cấp lại chứng chỉ HTTPS cho ${lanTls.credentials.ips.join(', ')}` });
  }, 60_000).unref();
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

  createTray(lanPort, lanTls.ca);
  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });

  if (DEV_SERVER_URL) win.loadURL(DEV_SERVER_URL);
  else win.loadFile(INDEX_HTML);
  if (app.isPackaged && process.platform === 'win32') {
    setTimeout(() => { if (license.allowed()) void updates.check(); }, 30_000).unref();
    setInterval(() => { if (license.allowed()) void updates.check(); }, 6 * 60 * 60_000).unref();
  }
}

// Một lần bấm icon thứ hai không được tạo thêm server LAN. Cổng 3200 là cố
// định cho các máy trạm, vì vậy ta chuyển yêu cầu đó cho bản QC Lab đang chạy.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);
  app.on('web-contents-created', (_event, contents) => guardNavigation(contents));
  app.whenReady().then(() => {
    // Bản đóng gói bỏ menu mặc định của Electron (có mục mở DevTools, tải lại).
    if (app.isPackaged) Menu.setApplicationMenu(null);
    logEvent({ level: 'info', source: 'app', message: `Khởi động QC Lab ${app.getVersion()} · Electron ${process.versions.electron}` });
    return createWindow();
  }).catch((error) => {
    logEvent({ level: 'error', source: 'app', message: `Không khởi động được: ${describeError(error).message}` });
    dialog.showErrorBox('Không khởi động được QC Lab', error instanceof Error ? error.message : 'Không thể khởi động máy chủ LAN.');
    app.quit();
  });

  app.on('window-all-closed', () => {
    // Máy chủ LAN phải tiếp tục chạy khi cửa sổ chỉ được ẩn xuống khay.
  });
  app.on('before-quit', () => { quitting = true; });
}


