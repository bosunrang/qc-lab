export type BackupInfo = { never: boolean; ts?: number; days: number };

export function createBackupReminder(deps: { now: () => number; dayMs?: number }) {
  const dayMs = deps.dayMs || 86400000;
  const lastBackupInfo = (raw: unknown): BackupInfo => {
    if (!raw) return { never: true, days: Infinity };
    const timestamp = new Date(String(raw)).getTime();
    if (Number.isNaN(timestamp)) return { never: true, days: Infinity };
    return { never: false, ts: timestamp, days: Math.floor((deps.now() - timestamp) / dayMs) };
  };
  const statusText = (cloudReady: unknown, info: BackupInfo): string => {
    if (cloudReady) return 'Đang đồng bộ đám mây — đã có bản sao từ xa.';
    if (info.never) return 'Chưa sao lưu trên máy này.';
    if (info.days <= 0) return 'Sao lưu gần nhất: hôm nay.';
    return 'Sao lưu gần nhất: ' + info.days + ' ngày trước.';
  };
  const capacityText = (bytes: unknown, maxBytes: unknown, sizeMb: (value: number) => unknown, warning: (value: number) => unknown): string => {
    const value = Number(bytes) || 0;
    const limit = Number(maxBytes) / 1024 / 1024;
    if (!value) return `Khuyến nghị dưới ${limit} MB.`;
    return `Backup gần nhất ${sizeMb(value)} MB (khuyến nghị dưới ${limit} MB).` + (warning(value) ? ' Gần mức khuyến nghị.' : '');
  };
  const overdue = (cloudReady: unknown, info: BackupInfo, remindDays: unknown): boolean => !cloudReady && info.days >= Number(remindDays);
  const banner = (cloudReady: unknown, currentUser: unknown, info: BackupInfo, remindDays: unknown) => {
    if (!currentUser || !overdue(cloudReady, info, remindDays)) return { hidden: true, className: '', text: '', title: '' };
    const text = info.never ? 'Chưa sao lưu' : 'Sao lưu: ' + info.days + ' ngày';
    const title = (info.never ? 'Bạn chưa sao lưu dữ liệu trên máy này.' : 'Đã ' + info.days + ' ngày chưa sao lưu dữ liệu.') + ' Dữ liệu lưu trong trình duyệt — nhấn để xuất backup ngay.';
    return { hidden: false, className: 'backup-dot' + (info.never ? ' crit' : ''), text, title };
  };
  return { lastBackupInfo, statusText, capacityText, overdue, banner };
}
