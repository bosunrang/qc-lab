export function createReportUnlockReason(deps: { clean: (value: unknown, maxLength: number) => string }) {
  return (value: unknown) => {
    const reason = deps.clean(value, 1000).trim();
    return reason.length >= 5 ? { valid: true, reason, error: '' } : { valid: false, reason, error: 'Cần ghi lý do mở khóa tối thiểu 5 ký tự.' };
  };
}
