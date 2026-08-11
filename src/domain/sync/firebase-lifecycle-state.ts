export function firebaseDisconnectedState(current:any, clearAuthUser:boolean) {
  return { ...current, ready: false, initialized: false, ref: null, synced: null, seenSig: null, ...(clearAuthUser ? { authUser: null } : {}) };
}
