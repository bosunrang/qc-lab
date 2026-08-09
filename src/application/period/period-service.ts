type AnyRecord = Record<string, any>;

export type PeriodState = {
  periodLocks?: AnyRecord[];
};

export type PeriodDependencies = {
  cleanText: (value: unknown, maximumLength?: number) => string;
};

export function createPeriodService({ cleanText }: PeriodDependencies) {
  function normalizePeriod(value: unknown) {
    const text = cleanText(value, 20).trim();
    const match = /^(\d{4})-(\d{1,2})$/.exec(text);
    if (!match) return '';
    const month = Number(match[2]);
    return month >= 1 && month <= 12 ? match[1] + '-' + String(month).padStart(2, '0') : '';
  }

  function periodForDate(value: unknown) {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(value || ''));
    return match ? match[1] + '-' + match[2] : '';
  }

  function findLock(state: PeriodState | null | undefined, yearMonth: unknown) {
    const period = normalizePeriod(yearMonth);
    return period ? ((state && state.periodLocks) || []).find(item => normalizePeriod(item && item.ym) === period) || null : null;
  }

  function lock(state: PeriodState, { ym, lockedAt, lockedBy, note, id }: AnyRecord) {
    const period = normalizePeriod(ym);
    if (!period) return { error: 'invalid-period' as const };
    if (findLock(state, period)) return { error: 'already-locked' as const };
    state.periodLocks = Array.isArray(state.periodLocks) ? state.periodLocks : [];
    const record = { id: id || '', ym: period, lockedAt: lockedAt || '',
      lockedBy: cleanText(lockedBy, 120).trim(), note: cleanText(note, 1000).trim() };
    state.periodLocks.push(record);
    return { lock: record };
  }

  function unlock(state: PeriodState, { ym, reason }: AnyRecord) {
    const period = normalizePeriod(ym), cleanReason = cleanText(reason, 1000).trim();
    if (!period) return { error: 'invalid-period' as const };
    if (cleanReason.length < 5) return { error: 'reason-too-short' as const };
    const index = ((state && state.periodLocks) || []).findIndex(item => normalizePeriod(item && item.ym) === period);
    if (index < 0) return { error: 'not-locked' as const };
    const removed = state.periodLocks!.splice(index, 1)[0];
    return { lock: removed, reason: cleanReason };
  }

  /* Đếm điểm QC rơi vào kỳ đã khóa, gồm cả điểm đã hủy vì chúng vẫn là hồ sơ
     của kỳ đó. Hàm thuần để các thao tác phá hủy hàng loạt dùng chung. */
  function lockedPoints(state: PeriodState, points: unknown) {
    const byPeriod = new Map<string, number>();
    (Array.isArray(points) ? points : []).forEach(point => {
      const yearMonth = periodForDate(point && point.date);
      if (!yearMonth || !findLock(state, yearMonth)) return;
      byPeriod.set(yearMonth, (byPeriod.get(yearMonth) || 0) + 1);
    });
    const periods = [...byPeriod.keys()].sort();
    return { count: periods.reduce((count, yearMonth) => count + (byPeriod.get(yearMonth) || 0), 0), periods, byPeriod };
  }

  return Object.freeze({ normalizePeriod, periodForDate, findLock, lock, unlock, lockedPoints });
}

export type PeriodServiceApi = ReturnType<typeof createPeriodService>;
