// Entry point của tiến trình main Electron cho QC Lab.
// Nhiệm vụ: kiểm tra bản quyền (1 máy = 1 license, vĩnh viễn), mở cửa sổ app
// hoặc màn kích hoạt tuỳ trạng thái, nạp index.html tĩnh (không backend), khoá
// một instance duy nhất, và cung cấp hộp thoại alert native cho preload.js.
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const license = require('./license');

// Chỉ cho phép một tiến trình chạy: mở app lần hai sẽ focus cửa sổ đang có.
if (!app.requestSingleInstanceLock()) { app.quit(); }

let mainWindow = null;

function webPrefs(extraArgs) {
  return {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,    // cô lập trang khỏi Node; API duy nhất qua preload
    nodeIntegration: false,
    spellcheck: false,
    additionalArguments: extraArgs || []
  };
}

// show() thôi chưa đủ: lúc khởi động nguội cửa sổ có thể chưa được OS focus,
// khiến input.focus() trong trang không "ăn" (con trỏ hiện ở ô đăng nhập nhưng
// Tab không chạy). Ép focus cả cửa sổ lẫn webContents để DOM nhận bàn phím ngay.
function applyChrome(win) {
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.show(); win.focus(); win.webContents.focus(); });
  // Liên kết ngoài (http/https) mở bằng trình duyệt OS; không bao giờ đẻ cửa sổ Electron mới.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createActivationWindow() {
  mainWindow = new BrowserWindow({
    width: 640, height: 660, resizable: false,
    show: false, backgroundColor: '#f2f5f7', autoHideMenuBar: true,
    webPreferences: webPrefs()
  });
  applyChrome(mainWindow);
  mainWindow.loadFile(path.join(__dirname, 'activation.html'));
}

function createMainWindow(status) {
  // Tên lab + mã license đã xác minh, truyền cho preload (đọc từ process.argv,
  // mã hoá base64 để an toàn với dấu cách/tiếng Việt) để watermark trong app.
  const args = [
    '--qclab-lab=' + Buffer.from(String(status.lab || ''), 'utf8').toString('base64'),
    '--qclab-id=' + Buffer.from(String(status.licenseId || ''), 'utf8').toString('base64')
  ];
  mainWindow = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    show: false, backgroundColor: '#f2f5f7', autoHideMenuBar: true,
    webPreferences: webPrefs(args)
  });
  applyChrome(mainWindow);
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
}

function launch() {
  const status = license.currentStatus(app.getPath('userData'));
  if (status.valid) createMainWindow(status);
  else createActivationWindow();
}

// Trang kích hoạt hỏi mã máy + trạng thái license hiện tại.
ipcMain.handle('qc-license:status', () => license.currentStatus(app.getPath('userData')));

// Nhận khoá dán vào: xác minh chữ ký + khớp máy; hợp lệ thì lưu rồi khởi động lại
// sạch để nạp app chính (tránh mọi vấn đề truyền trạng thái vào cửa sổ cũ).
ipcMain.handle('qc-license:activate', (event, licenseString) => {
  const result = license.verifyLicenseString(licenseString);
  if (result.valid) {
    try { license.saveLicense(app.getPath('userData'), licenseString); } catch (e) { return { valid: false, reason: 'save' }; }
    setTimeout(() => { app.relaunch(); app.exit(0); }, 600); // để renderer kịp báo thành công
  }
  return result;
});

// Hộp thoại alert native (thay window.alert của Chromium) — xem preload.js.
ipcMain.handle('qc-dialog:alert', async (event, message) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['OK'],
    defaultId: 0,
    noLink: true,
    message: message == null ? '' : String(message)
  });
});

app.whenReady().then(() => {
  launch();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) launch();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
