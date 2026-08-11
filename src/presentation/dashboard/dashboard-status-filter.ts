export const DASH_TEST_STATUSES = Object.freeze(['all', 'missing', 'rej', 'warn', 'ok'] as const);
export type DashboardTestStatus = typeof DASH_TEST_STATUSES[number];

export function createDashboardStatusFilter() {
  const normalize = (value: unknown): DashboardTestStatus => DASH_TEST_STATUSES.includes(value as DashboardTestStatus) ? value as DashboardTestStatus : 'all';
  const matches = (item: { s: string; missingToday: boolean }, value: unknown) => {
    const status = normalize(value);
    return status === 'all' || (status === 'missing' ? item.missingToday : item.s === status);
  };
  return Object.freeze({ normalize, matches });
}
