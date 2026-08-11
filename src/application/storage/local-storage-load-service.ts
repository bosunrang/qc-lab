export type LocalStorageLoadService = Readonly<{ load: () => boolean }>;

export function createLocalStorageLoadService(deps: {
  read: () => string | null;
  adoptEmpty: () => boolean;
  adopt: (value: unknown) => void;
  accepted: () => void;
  rejectedRead: (error: unknown) => void;
  rejectedInvalid: (raw: string, error: unknown) => void;
}): LocalStorageLoadService {
  const load = (): boolean => {
    let raw: string | null;
    try { raw = deps.read(); }
    catch (error) { deps.rejectedRead(error); return false; }
    if (!raw) return deps.adoptEmpty();
    try {
      deps.adopt(JSON.parse(raw));
      deps.accepted();
      return true;
    } catch (error) {
      deps.rejectedInvalid(raw, error);
      return false;
    }
  };
  return Object.freeze({ load });
}
