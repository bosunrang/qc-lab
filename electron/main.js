// Entry point của tiến trình main Electron cho QC Lab.
// Nhiệm vụ: kiểm tra bản quyền (1 máy = 1 license, vĩnh viễn), mở cửa sổ app
// hoặc màn kích hoạt tuỳ trạng thái, nạp index.html tĩnh (không backend), khoá
// một instance duy nhất, và cung cấp hộp thoại alert native cho preload.js.
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const license = require('./license');
const { initAutoUpdate } = require('./auto-update');

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
    if (/^https?:/i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    // Cửa sổ in báo cáo: openPrint() trong reports.js gọi window.open('','_blank')
    // rồi document.write HTML vào — trước 2026-07-24 handler deny tất cả nên in
    // PDF trên bản desktop luôn báo "Trình duyệt chặn cửa sổ". Chỉ mở đúng
    // about:blank; nội dung cửa sổ do chính app sinh ra, mọi URL khác vẫn deny.
    // backgroundColor phải TRẮNG: khi in (printToPDF lẫn hộp thoại in hệ thống),
    // Blink không phủ màu nền body lên canvas in — màu nền CỬA SỔ lộ ra thành
    // nền cả trang (lỗi "viền xám phủ kín PDF" ở 2.4.2/2.4.3, đã dựng lại và
    // đo được trong content stream của PDF).
    if (url === 'about:blank' || url === '') {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 1180, height: 800, backgroundColor: '#ffffff' } };
    }
    return { action: 'deny' };
  });
  // Không còn menu ứng dụng nên phím tắt DevTools mặc định (Ctrl+Shift+I, gắn qua
  // menu) không hoạt động — tự bắt F12 để mở/đóng, phục vụ debug khi cần.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
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
  // Trạng thái dùng thử (nếu đang chạy bằng trial, không phải license) cũng
  // truyền kèm để app hiện dòng đếm ngược ở màn đăng nhập (users-auth.js).
  const trial = status.trial || { active: false, daysLeft: 0, totalDays: license.TRIAL_DAYS };
  const args = [
    '--qclab-lab=' + Buffer.from(String(status.lab || ''), 'utf8').toString('base64'),
    '--qclab-id=' + Buffer.from(String(status.licenseId || ''), 'utf8').toString('base64'),
    '--qclab-trial=' + Buffer.from(JSON.stringify({ active: !!trial.active, daysLeft: trial.daysLeft || 0, totalDays: trial.totalDays || license.TRIAL_DAYS }), 'utf8').toString('base64')
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
  const userDataDir = app.getPath('userData');
  const status = license.currentStatus(userDataDir);
  if (status.valid) { createMainWindow(status); return; }
  // Chưa có license hợp lệ: còn hạn dùng thử (14 ngày kể từ lần chạy đầu tiên
  // trên máy) thì vào thẳng app chính, không chặn — chỉ khi hết hạn mới bắt
  // buộc qua màn kích hoạt.
  const trial = license.trialStatus(userDataDir);
  if (trial.active) { createMainWindow({ lab: '', licenseId: '', trial }); return; }
  createActivationWindow();
}

// Trang kích hoạt hỏi mã máy + trạng thái license hiện tại + hạn dùng thử còn lại.
ipcMain.handle('qc-license:status', () => {
  const userDataDir = app.getPath('userData');
  return { ...license.currentStatus(userDataDir), trial: license.trialStatus(userDataDir) };
});

// Màn kích hoạt còn hạn dùng thử thì cho "Dùng thử tiếp" thay vì bắt nhập khoá
// ngay — mở cửa sổ app chính rồi đóng cửa sổ kích hoạt, không cần relaunch.
ipcMain.handle('qc-license:continue-trial', () => {
  const trial = license.trialStatus(app.getPath('userData'));
  if (!trial.active) return { ok: false };
  const oldWin = mainWindow;
  createMainWindow({ lab: '', licenseId: '', trial });
  if (oldWin && !oldWin.isDestroyed()) oldWin.close();
  return { ok: true };
});

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

// Tìm cửa sổ in (popup about:blank do openPrint mở) theo token ghi sẵn trong
// trang — nút "Lưu PDF" trong popup gọi opener.qcPrintPdf.save(token, ...).
async function findPrintWindow(token) {
  if (!token) return null;
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.isDestroyed()) continue;
    const wc = w.webContents;
    if (wc.getURL() !== 'about:blank') continue;
    try { if (await wc.executeJavaScript('window.__qcPrintToken||""') === token) return w; } catch (e) { /* cửa sổ đang đóng dở */ }
  }
  return null;
}

// Lưu PDF: printToPDF đi qua đường in headless CHUẨN của Chromium (tôn trọng
// @media print + @page) — khác hẳn hộp thoại in hệ thống của Electron/Windows
// vốn raster bằng CSS màn hình và in cả nền xám #eef2f5 vào file. Bật thêm class
// .printing phòng hờ, rồi mở hộp thoại lưu file.
ipcMain.handle('qc-print:pdf', async (event, payload) => {
  const { token, name } = payload || {};
  const win = await findPrintWindow(String(token || ''));
  if (!win) return { ok: false, reason: 'no-print-window' };
  await win.webContents.executeJavaScript('document.body&&document.body.classList.add("printing")').catch(() => {});
  const pdf = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
  const safe = (String(name || 'Bao-cao').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Bao-cao').slice(0, 120);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Lưu báo cáo PDF',
    defaultPath: /\.pdf$/i.test(safe) ? safe : safe + '.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  await fs.promises.writeFile(filePath, pdf);
  return { ok: true, path: filePath };
});

// In giấy: bật class .printing từ main process TRƯỚC khi print() — window.print()
// gọi từ renderer cũng được, nhưng đi qua đây thì thứ tự "sạch nền → in" được
// main process đảm bảo, không lệ thuộc sự kiện beforeprint vốn không đáng tin
// trên đường in hệ thống của Electron/Windows.
ipcMain.handle('qc-print:paper', async (event, token) => {
  const win = await findPrintWindow(String(token || ''));
  if (!win) return { ok: false, reason: 'no-print-window' };
  await win.webContents.executeJavaScript('document.body&&document.body.classList.add("printing")').catch(() => {});
  win.webContents.print({});
  return { ok: true };
});

app.whenReady().then(() => {
  launch();
  initAutoUpdate(app, () => mainWindow);
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

// Ctrl+P trong cửa sổ in (about:blank): chặn xử lý mặc định, bật class .printing
// từ main process rồi mới print() — cùng lý do với qc-print:paper ở trên, không
// dựa vào beforeprint của renderer. Chỉ áp cho popup in; cửa sổ app chính có URL
// file:// nên không bị ảnh hưởng.
app.on('web-contents-created', (event, contents) => {
  contents.on('before-input-event', (ev, input) => {
    if (input.type === 'keyDown' && input.control && String(input.key).toLowerCase() === 'p' && contents.getURL() === 'about:blank') {
      ev.preventDefault();
      contents.executeJavaScript('document.body&&document.body.classList.add("printing")')
        .catch(() => {})
        .finally(() => { if (!contents.isDestroyed()) contents.print({}); });
    }
  });
});
