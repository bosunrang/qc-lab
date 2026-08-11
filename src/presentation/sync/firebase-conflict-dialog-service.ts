export function createFirebaseConflictDialogService(confirm: (options: Record<string, any>) => Promise<boolean>) {
  const ask = (labCode: string): Promise<boolean> => confirm({
    kicker: 'Thao tác không thể hoàn tác',
    title: 'Dữ liệu cục bộ khác dữ liệu trung tâm',
    message: `Phòng "${labCode || 'default'}" đã có một bộ dữ liệu khác trên đám mây.`,
    detail: 'Dùng dữ liệu trung tâm sẽ thay thế dữ liệu trên máy này; các mục chỉ có cục bộ (máy XN, panel, lô, điểm QC...) sẽ không được giữ lại. Chọn Giữ dữ liệu cục bộ để ngắt đồng bộ và bảo vệ dữ liệu trên máy này.',
    confirmLabel: 'Dùng dữ liệu trung tâm',
    cancelLabel: 'Giữ dữ liệu cục bộ',
    danger: true,
  });
  return Object.freeze({ ask });
}
