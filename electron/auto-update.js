// Tự kiểm tra + tải bản cập nhật mới qua GitHub Releases (electron-updater),
// đọc owner/repo từ app-update.yml mà electron-builder nhúng sẵn lúc build
// (xem "publish" trong package.json). Không chặn khởi động, không tự ép cài
// lại — hỏi trước khi restart để không ngắt ngang lúc lab đang nhập liệu QC.
const { dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

function initAutoUpdate(app, getWindow) {
  if (!app.isPackaged) return; // dev/chưa đóng gói: không có bản build để so, bỏ qua

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // lỡ chọn "Để sau" thì vẫn tự cài ở lần thoát kế tiếp

  autoUpdater.on('error', (err) => {
    console.error('[auto-update]', (err && err.message) || err);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const win = getWindow();
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Cài đặt và khởi động lại', 'Để sau'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: 'Đã có bản cập nhật',
      message: `QC Lab ${info.version} đã sẵn sàng.`,
      detail: 'Chọn "Để sau" để tiếp tục làm việc — bản cập nhật sẽ tự cài ở lần mở ứng dụng kế tiếp.'
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[auto-update] check failed', (err && err.message) || err);
  });
}

module.exports = { initAutoUpdate };
