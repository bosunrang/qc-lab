export type FirebaseOwnSnapshotService = Readonly<{ handle: (remote: any, silent: boolean) => void }>;

export function createFirebaseOwnSnapshotService(deps: {
  setReady: () => void;
  setBaseline: (remote: any) => void;
  clearDirty: () => void;
  resetRetry: () => void;
  connected: () => void;
  synchronized: () => void;
}): FirebaseOwnSnapshotService {
  const handle = (remote: any, silent: boolean): void => {
    deps.setReady();
    deps.setBaseline(remote);
    deps.clearDirty();
    deps.resetRetry();
    deps.connected();
    if (!silent) deps.synchronized();
  };
  return Object.freeze({ handle });
}
