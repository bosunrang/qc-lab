export function historyPeriodLabel(from: string | undefined, to: string | undefined, formatDate: (date: string) => string) {
  return `${from ? formatDate(from) : 'Không giới hạn'} → ${to ? formatDate(to) : 'Không giới hạn'}`;
}
