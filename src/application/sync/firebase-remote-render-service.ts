export type FirebaseRemoteRenderService = Readonly<{ apply: () => void }>;

export function createFirebaseRemoteRenderService(deps: {
  loggedIn: () => boolean;
  focusLogin: () => void;
  unsafe: () => boolean;
  clearPending: () => void;
  defer: (fn: () => void, delay: number) => void;
  received: () => void;
  deferred: () => void;
  rerender: () => void;
}): FirebaseRemoteRenderService {
  const apply = (): void => {
    if (!deps.loggedIn()) { deps.received(); deps.focusLogin(); return; }
    if (deps.unsafe()) { deps.deferred(); deps.clearPending(); deps.defer(apply, 1500); return; }
    deps.clearPending();
    deps.received();
    deps.rerender();
  };
  return Object.freeze({ apply });
}
