export type FirebasePushScheduler = Readonly<{ schedule: (connection: any, timer: any) => any }>;

export function createFirebasePushScheduler(deps: {
  canWrite: (connection: any) => boolean;
  networkOnline: () => boolean;
  resetRetry: () => void;
  clearTimer: (timer: any) => void;
  setTimer: (fn: () => void, delay: number) => any;
  flush: () => void;
  offline: () => void;
  queued: () => void;
}): FirebasePushScheduler {
  const schedule = (connection: any, timer: any): any => {
    if (!deps.canWrite(connection)) return timer;
    if (!deps.networkOnline()) { deps.offline(); return timer; }
    deps.resetRetry();
    deps.clearTimer(timer);
    deps.queued();
    return deps.setTimer(deps.flush, 500);
  };
  return Object.freeze({ schedule });
}
