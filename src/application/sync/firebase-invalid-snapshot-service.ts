export type FirebaseInvalidSnapshotService = Readonly<{ handle: (firstError: string) => void }>;

export function createFirebaseInvalidSnapshotService(deps: {
  setReady: () => void;
  report: (firstError: string) => void;
}): FirebaseInvalidSnapshotService {
  const handle = (firstError: string): void => {
    deps.setReady();
    deps.report(firstError);
  };
  return Object.freeze({ handle });
}
