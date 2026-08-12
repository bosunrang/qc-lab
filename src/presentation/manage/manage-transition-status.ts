export function manageTransitionStatus(status: string) {
  if (status === 'active') return { text: 'Đang chạy song song', cls: 'warn' };
  if (status === 'accepted') return { text: 'Chấp nhận lô mới', cls: 'ok' };
  if (status === 'rejected') return { text: 'Không chấp nhận', cls: 'rej' };
  return { text: 'Dự kiến', cls: 'none' };
}
