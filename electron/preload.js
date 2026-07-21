// Preload chạy trong ngữ cảnh đặc quyền, cô lập khỏi trang (contextIsolation).
// Chỉ phơi ra đúng một API tối thiểu: qcDialog.alert — index.html dùng nó để
// định tuyến window.alert() qua hộp thoại OS native thay cho hộp thoại của
// Chromium (bản Chromium có lỗi chỉ trên Windows: sau khi đóng alert, các ô
// nhập của renderer ngừng nhận sự kiện). Trình duyệt thường không có preload
// nên window.qcDialog không tồn tại và app tự no-op nhánh này.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qcDialog', {
  // Trả về Promise (invoke bất đồng bộ). Các call site của alert() trong app
  // không dùng giá trị trả về và không dựa vào tính chặn đồng bộ, nên an toàn.
  alert: (message) => ipcRenderer.invoke('qc-dialog:alert', message == null ? '' : String(message))
});

// Cầu nối cho trang kích hoạt (activation.html): đọc mã máy + gửi khoá để xác minh,
// hoặc "Dùng thử tiếp" khi còn hạn 30 ngày.
contextBridge.exposeInMainWorld('qcActivation', {
  status: () => ipcRenderer.invoke('qc-license:status'),
  activate: (licenseString) => ipcRenderer.invoke('qc-license:activate', String(licenseString || '')),
  continueTrial: () => ipcRenderer.invoke('qc-license:continue-trial')
});

// Thông tin license đã xác minh (main truyền qua additionalArguments, base64),
// để app (renderer) watermark tên lab lên giao diện và báo cáo in/xuất. Trình
// duyệt thường không có preload nên window.qcLicense không tồn tại và app tự bỏ qua.
function argVal(prefix) {
  const found = process.argv.find(a => a.startsWith(prefix));
  if (!found) return '';
  try { return Buffer.from(found.slice(prefix.length), 'base64').toString('utf8'); } catch (e) { return ''; }
}
function trialArg() {
  try { return JSON.parse(argVal('--qclab-trial=')) || { active: false, daysLeft: 0 }; }
  catch (e) { return { active: false, daysLeft: 0 }; }
}
contextBridge.exposeInMainWorld('qcLicense', {
  lab: argVal('--qclab-lab='),
  licenseId: argVal('--qclab-id='),
  trial: trialArg()
});
