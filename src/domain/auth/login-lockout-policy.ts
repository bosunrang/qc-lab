export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_LOCKOUT_MILLISECONDS = 30000;

export interface LoginLockoutState {
  fails: number;
  until: number;
}

export interface LoginLockoutPolicy {
  isLocked(until: unknown, now: number): boolean;
  remainingSeconds(until: unknown, now: number): number;
  recordFailure(current: Partial<LoginLockoutState>, now: number): LoginLockoutState;
  reset(): LoginLockoutState;
  message(until: unknown, now: number): string;
}

export function normalizeLoginLockoutState(value: unknown): LoginLockoutState {
  const lockout = value as Partial<LoginLockoutState> | null;
  return { fails: lockout && Number(lockout.fails) || 0, until: lockout && Number(lockout.until) || 0 };
}

export function createLoginLockoutPolicy(): LoginLockoutPolicy {
  const numberOrZero = (value: unknown): number => Number(value) || 0;
  return {
    isLocked(until, now) {
      return now < numberOrZero(until);
    },
    remainingSeconds(until, now) {
      return Math.ceil((numberOrZero(until) - now) / 1000);
    },
    recordFailure(current, now) {
      const fails = numberOrZero(current.fails) + 1;
      return fails >= LOGIN_FAILURE_LIMIT
        ? { fails: 0, until: now + LOGIN_LOCKOUT_MILLISECONDS }
        : { fails, until: numberOrZero(current.until) };
    },
    reset() {
      return { fails: 0, until: 0 };
    },
    message(until, now) {
      return `Sai mật khẩu quá nhiều lần. Thử lại sau ${Math.ceil((numberOrZero(until) - now) / 1000)} giây.`;
    },
  };
}
