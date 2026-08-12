export function createAdminToolsHtml(button: (label: string, action: string, variant: string) => string) {
  return (backupStatus: unknown, backupCapacity: unknown): string => `<div class="panel"><h2 class="panel-title">Quản trị dữ liệu</h2>
     <div class="admin-tools">
        <div class="admin-tool"><b>Xuất backup</b><span>Lưu dữ liệu hiện tại ra file. ${backupStatus} ${backupCapacity}</span>${button('Xuất backup', 'exportData()', 'ghost')}</div>
        <div class="admin-tool"><b>Nhập backup</b><span>Khôi phục dữ liệu từ file backup đã xuất. Chỉ quản trị viên được nhập.</span>${button('Chọn file backup', "document.getElementById('imp').click()", 'ghost')}<input id="imp" type="file" accept="application/json" style="display:none" onchange="importData(event)"></div>
        <div class="admin-tool"><b>Kiểm tra backup</b><span>Kiểm tra checksum, cấu trúc và số điểm — không ảnh hưởng dữ liệu đang dùng.</span>${button('Chọn file để kiểm tra', "document.getElementById('verifyBackup').click()", 'ghost')}<input id="verifyBackup" type="file" accept="application/json" style="display:none" onchange="verifyBackupFile(event)"></div>
        <div class="admin-tool"><b>Dung lượng cục bộ</b><span>Xem số điểm QC và dung lượng trình duyệt đang dùng.</span>${button('Kiểm tra dung lượng', 'checkStorageUsage()', 'ghost')}</div>
        <div class="admin-tool"><b>Xóa sạch dữ liệu test</b><span>Xóa toàn bộ dữ liệu, giữ lại tài khoản đang đăng nhập.</span>${button('Xóa sạch dữ liệu', 'resetAllData()', 'danger')}</div>
      </div></div>`;
}
