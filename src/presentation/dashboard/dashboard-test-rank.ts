export function dashboardTestRank(status: string, todayCount: number, levelCount: number) {
  if (status === 'rej') return 0;
  if (status === 'warn') return 1;
  if (todayCount < levelCount) return 2;
  if (status === 'ok') return 3;
  return 4;
}
