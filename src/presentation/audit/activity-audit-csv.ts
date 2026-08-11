export interface ActivityAuditCsvDependencies {
  formatDateTime(value: unknown): string;
  roleLabel(value: unknown): string;
}

export function createActivityAuditCsv(dependencies: ActivityAuditCsvDependencies) {
  return (items: unknown): unknown[][] => {
    const rows: unknown[][] = [['Seq', 'Thời gian', 'Người dùng', 'Tên đăng nhập', 'Vai trò', 'Hành động', 'Đối tượng', 'Chi tiết', 'PrevHash', 'Hash']];
    (Array.isArray(items) ? items : []).forEach((activity: Record<string, any>) => rows.push([
      activity.seq || '', dependencies.formatDateTime(activity.ts), activity.user || '', activity.username || '',
      dependencies.roleLabel(activity.role || 'viewer'), activity.type || '', activity.target || '', activity.detail || '',
      activity.prevHash || '', activity.hash || '',
    ]));
    return rows;
  };
}
