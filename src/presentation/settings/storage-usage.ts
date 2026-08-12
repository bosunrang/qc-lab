export type StorageEstimate = {
  usage?: unknown;
  quota?: unknown;
  usageDetails?: { indexedDB?: unknown };
};

export function storageBytesText(bytes: unknown): string {
  const amount = Math.max(0, Number(bytes) || 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = amount;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return (value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value).toLocaleString('vi-VN')) + ' ' + units[unit];
}

export function storageUsageText(data: Record<string, unknown> | null | undefined, estimate: StorageEstimate | null | undefined): string {
  const points = Object.values(data || {}).reduce<number>((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  if (!estimate || typeof estimate !== 'object') {
    return `Số điểm QC: ${points.toLocaleString('vi-VN')}.\n\nTrình duyệt này không cung cấp thông tin hạn mức lưu trữ.`;
  }
  const usage = Math.max(0, Number(estimate.usage) || 0);
  const quota = Math.max(0, Number(estimate.quota) || 0);
  const indexed = estimate.usageDetails && Number.isFinite(Number(estimate.usageDetails.indexedDB))
    ? Math.max(0, Number(estimate.usageDetails.indexedDB)) : null;
  const ratio = quota ? Math.min(100, usage / quota * 100) : null;
  return `Số điểm QC: ${points.toLocaleString('vi-VN')}.\nDung lượng IndexedDB: ${indexed == null ? 'trình duyệt không tách riêng' : storageBytesText(indexed)}.\nTổng dung lượng app đang dùng: ${storageBytesText(usage)}${quota ? ' / ' + storageBytesText(quota) : ''}${ratio == null ? '' : ' (' + ratio.toFixed(2) + '%)'}.`;
}
