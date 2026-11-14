'use strict';
const { app, BrowserWindow, ipcMain, dialog, clipboard, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { readSigningKey, issueLicense } = require('./license-core.cjs');
const publicKey = JSON.parse(fs.readFileSync(path.join(__dirname, 'public-key.json'), 'utf8')).publicKey;

// Profile riêng, không mở CSDL hoặc cổng LAN của ứng dụng phòng xét nghiệm.
const testProfile = !app.isPackaged ? process.env.QCLAB_ISSUER_TEST_USER_DATA : undefined;
if (testProfile) app.setPath('userData', testProfile);
const settingsPath = path.join(app.getPath('userData'), 'issuer-settings.json');
let keyPath = testProfile ? path.join(testProfile, 'license-private.pem') : path.join(os.homedir(), '.qclab-license-issuer', 'license-private.pem');
try { const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); if (typeof saved.keyPath === 'string') keyPath = saved.keyPath; } catch { /* Lần đầu dùng khoá mặc định. */ }
/** @type {import('../shared/qc-api').LicenseIssuerLicense | null} Mã được giữ trong bộ nhớ. */
let issued = null;
/** @type {import('electron').BrowserWindow | null} Cửa sổ duy nhất của công cụ. */
let window = null;
const entry = pathToFileURL(path.join(__dirname, 'index.html')).href;

/** @returns {import('../shared/qc-api').LicenseIssuerStatus} Trạng thái khoá cấp phép. */
function keyStatus() {
  try { readSigningKey(keyPath, publicKey); return { key_path: keyPath, key_ready: true, key_message: 'Khoá cấp phép đã sẵn sàng' }; }
  catch (error) { return { key_path: keyPath, key_ready: false, key_message: error instanceof Error ? error.message : 'Không đọc được khoá cấp phép.' }; }
}

/** @param {import('electron').IpcMainInvokeEvent} event Sự kiện cần kiểm tra nguồn gửi. */
function guard(event) {
  // Chỉ trang chính của công cụ được cấp mã; không nhận iframe/trang ngoài.
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== entry) {
    throw new Error('Yêu cầu không đến từ công cụ cấp key.');
  }
}
/** @param {string} channel @param {(...args: any[]) => any} action Thao tác tại máy cấp mã. */
function handle(channel, action) {
  ipcMain.handle(channel, async (event, ...args) => {
    guard(event);
    try { return { ok: true, data: await action(...args) }; }
    catch (error) { return { ok: false, error: { code: 'issuer-failed', message: error instanceof Error ? error.message : 'Không thực hiện được thao tác.' } }; }
  });
}

async function start() {
  Menu.setApplicationMenu(null);
  window = new BrowserWindow({
    width: 1000, height: 830, minWidth: 800, minHeight: 730, title: 'QC Lab · Cấp key',
    icon: path.join(__dirname, 'icon.png'), backgroundColor: '#f4f7fa', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: !app.isPackaged },
  });
  const issuerWindow = window;
  issuerWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  issuerWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  issuerWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  issuerWindow.on('closed', () => { window = null; });
  issuerWindow.once('ready-to-show', () => issuerWindow.show());
  ipcMain.handle('issuer:status', (event) => { guard(event); return keyStatus(); });
  ipcMain.handle('issuer:discard', (event) => { guard(event); issued = null; });
  handle('issuer:chooseKey', async () => {
    const selected = await dialog.showOpenDialog(issuerWindow, { title: 'Chọn khoá bí mật cấp phép QC Lab', properties: ['openFile'], filters: [{ name: 'Khoá cấp phép', extensions: ['pem', 'key'] }] });
    if (selected.canceled || !selected.filePaths[0]) return null;
    const selectedPath = selected.filePaths[0];
    readSigningKey(selectedPath, publicKey);
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    // Chỉ lưu đường dẫn. Nội dung khoá không đi vào profile hoặc renderer.
    fs.writeFileSync(settingsPath, JSON.stringify({ keyPath: selectedPath }) + '\n', { mode: 0o600 });
    keyPath = selectedPath; issued = null;
    return keyStatus();
  });
  handle('issuer:issue', (input) => { issued = null; issued = issueLicense(input, keyPath, publicKey); return issued; });
  handle('issuer:copy', () => {
    if (!issued) throw new Error('Hãy tạo mã kích hoạt trước.');
    clipboard.writeText(issued.activation_code);
    return null;
  });
  handle('issuer:save', async () => {
    if (!issued) throw new Error('Hãy tạo mã kích hoạt trước.');
    // Giữ đúng mã tại thời điểm mở hộp thoại, không lấy nội dung do renderer gửi.
    const snapshot = issued;
    const name = snapshot.licensed_to.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 60);
    const selected = await dialog.showSaveDialog(issuerWindow, { title: 'Lưu mã kích hoạt', defaultPath: path.join(app.getPath('desktop'), `QC-Lab-Key-${name}-${snapshot.license_id.slice(0, 8)}.txt`), filters: [{ name: 'Mã kích hoạt', extensions: ['txt'] }] });
    if (selected.canceled || !selected.filePath) return null;
    if (issued !== snapshot) throw new Error('Thông tin đã đổi. Hãy tạo lại mã trước khi lưu.');
    try { fs.writeFileSync(selected.filePath, snapshot.activation_code + '\n', { flag: 'wx' }); }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') throw new Error('Tệp đã tồn tại. Hãy chọn tên tệp khác.');
      throw new Error('Không lưu được tệp. Hãy chọn thư mục có quyền ghi.');
    }
    return { path: selected.filePath };
  });
  await issuerWindow.loadFile(path.join(__dirname, 'index.html'));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(start).catch(() => { dialog.showErrorBox('Không mở được công cụ', 'Hãy mở lại công cụ cấp key hoặc tạo lại bản đóng gói.'); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
