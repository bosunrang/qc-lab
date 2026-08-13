export function entrySheetMonthState(month: string | null) {
  return month ? { month, jumpToday: false, message: '' } : null;
}

export function entrySheetTodayState(month: string) {
  return { month, jumpToday: true, message: '' };
}
