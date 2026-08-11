import { firebaseEmptySnapshotPlan } from '../../domain/sync/firebase-empty-snapshot';

export type FirebaseEmptySnapshotService = Readonly<{ handle: (input: { initialized: boolean; dirty: boolean; hasLocalContent: boolean; silent: boolean }) => void }>;

export function createFirebaseEmptySnapshotService(deps: {
  setReady: () => void;
  clearSynced: () => void;
  connected: () => void;
  schedulePush: () => void;
  readyWithoutPush: () => void;
}): FirebaseEmptySnapshotService {
  const handle = (input: { initialized: boolean; dirty: boolean; hasLocalContent: boolean; silent: boolean }): void => {
    const plan = firebaseEmptySnapshotPlan(input.initialized, input.dirty, input.hasLocalContent);
    deps.setReady();
    deps.clearSynced();
    deps.connected();
    if (plan.push) deps.schedulePush();
    else if (!input.silent) deps.readyWithoutPush();
  };
  return Object.freeze({ handle });
}
