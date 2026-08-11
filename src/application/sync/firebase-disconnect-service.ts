export type FirebaseDisconnectService = Readonly<{ disconnect: (clearAuthUser?: boolean) => void }>;

export function createFirebaseDisconnectService(deps: {
  stopPolling: () => void;
  cancelPendingPush: () => void;
  resetRetry: () => void;
  detachListener: () => void;
  resetSession: (clearAuthUser: boolean) => void;
}): FirebaseDisconnectService {
  const disconnect = (clearAuthUser = false): void => {
    deps.stopPolling();
    deps.cancelPendingPush();
    deps.resetRetry();
    deps.detachListener();
    deps.resetSession(clearAuthUser);
  };
  return Object.freeze({ disconnect });
}
