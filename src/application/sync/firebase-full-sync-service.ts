export type FirebaseFullSyncService = Readonly<{ sync: (connection: any) => Promise<boolean> }>;

export function createFirebaseFullSyncService(deps: {
  canSync: (connection: any) => boolean;
  auditMaySync: () => boolean;
  prepare: () => { payload: any; draftStamp: number };
  beforeWrite: () => void;
  write: (ref: any, payload: any) => Promise<unknown>;
  succeeded: (payload: any, draftStamp: number) => void;
  failed: () => void;
}): FirebaseFullSyncService {
  const sync = async (connection: any): Promise<boolean> => {
    if (!deps.canSync(connection) || !deps.auditMaySync()) return false;
    const prepared = deps.prepare();
    deps.beforeWrite();
    try {
      await deps.write(connection.ref, prepared.payload);
      deps.succeeded(prepared.payload, prepared.draftStamp);
      return true;
    } catch (error) {
      deps.failed();
      throw error;
    }
  };
  return Object.freeze({ sync });
}
