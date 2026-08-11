export type FirebasePushService = Readonly<{ flush: (connection: any) => Promise<boolean> }>;

export function createFirebasePushService(deps: {
  canPush: (connection: any) => boolean;
  auditMaySync: () => boolean;
  prepare: () => { current: any; payload: Record<string, any>; draftStamp: number };
  noChanges: (draftStamp: number) => void;
  beforeWrite: () => void;
  update: (ref: any, payload: Record<string, any>) => Promise<unknown>;
  succeeded: (current: any, draftStamp: number) => void;
  failed: () => void;
}): FirebasePushService {
  const flush = async (connection: any): Promise<boolean> => {
    if (!deps.canPush(connection) || !deps.auditMaySync()) return false;
    const prepared = deps.prepare();
    if (!Object.keys(prepared.payload).length) { deps.noChanges(prepared.draftStamp); return true; }
    deps.beforeWrite();
    try {
      await deps.update(connection.ref, prepared.payload);
      deps.succeeded(prepared.current, prepared.draftStamp);
      return true;
    } catch {
      deps.failed();
      return false;
    }
  };
  return Object.freeze({ flush });
}
