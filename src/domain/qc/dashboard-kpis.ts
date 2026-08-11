export type DashboardKpiItem = { totalPoints: number; todayCount: number; s: string; missingToday: boolean };

export function dashboardKpis(items: DashboardKpiItem[], testCount: number) {
  const totalPoints = items.reduce((sum, item) => sum + item.totalPoints, 0);
  const todayPoints = items.reduce((sum, item) => sum + item.todayCount, 0);
  const rejected = items.filter(item => item.s === 'rej').length;
  const warnings = items.filter(item => item.s === 'warn').length;
  const missingToday = items.filter(item => item.missingToday).length;
  const completeTests = Math.max(0, testCount - missingToday);
  const completionPercent = testCount ? Math.round(completeTests / testCount * 100) : 0;
  return { totalPoints, todayPoints, rejected, warnings, missingToday, completeTests, completionPercent };
}
