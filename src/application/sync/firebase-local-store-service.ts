export type FirebaseLocalStoreService = Readonly<{ store: (state: unknown) => void }>;

export function createFirebaseLocalStoreService(deps: {
  persistSnapshot: () => boolean;
  serialize: (state: unknown) => string;
  writeLocal: (raw: string) => void;
  mirror: (raw: string) => void;
}): FirebaseLocalStoreService {
  const store = (state: unknown): void => {
    if (deps.persistSnapshot()) return;
    const raw = deps.serialize(state);
    try { deps.writeLocal(raw); } catch {}
    deps.mirror(raw);
  };
  return Object.freeze({ store });
}
