export function createManageLotStatus(deps: { daysToExpiry: (value?: string) => number | null }) {
  return (lot: { depleted?: boolean; exp?: string }, nextLot?: string) => {
    if (lot && lot.depleted) return { text: nextLot ? `Đã chuyển tiếp qua lô ${nextLot}` : 'Đã chuyển tiếp', cls: 'rej' };
    const days = deps.daysToExpiry(lot.exp);
    if (days == null) return { text: 'Chưa có HSD', cls: 'none' };
    if (days < 0) return { text: 'Hết hạn', cls: 'rej' };
    if (days <= 30) return { text: `Còn ${days} ngày`, cls: 'warn' };
    return { text: 'Đang hoạt động', cls: 'ok' };
  };
}
