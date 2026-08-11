export type IndexedDbMirrorService = Readonly<{ mirror: (raw: string, state: unknown) => boolean }>;

export function createIndexedDbMirrorService(deps: {
  supported: () => boolean;
  writeSerialized: (raw: string) => Promise<unknown> | null;
  writeState: (state: unknown) => Promise<unknown>;
  failed: () => void;
}): IndexedDbMirrorService {
  const mirror = (raw: string, state: unknown): boolean => {
    if (!deps.supported()) return false;
    const write = deps.writeSerialized(raw) || deps.writeState(state);
    write.catch(deps.failed);
    return true;
  };
  return Object.freeze({ mirror });
}
