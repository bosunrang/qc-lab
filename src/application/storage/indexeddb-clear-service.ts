export type IndexedDbClearService = Readonly<{ clear: (read: (key: string) => Promise<any>, remove: (key: string) => Promise<any>) => Promise<boolean> }>;

export function createIndexedDbClearService(deps: {
  supported: () => boolean;
  key: (slot: string, type: string, id?: string) => string;
  keys: (manifests: any[]) => string[];
}): IndexedDbClearService {
  const clear = async (read: (key: string) => Promise<any>, remove: (key: string) => Promise<any>): Promise<boolean> => {
    if (!deps.supported()) return false;
    const manifests = await Promise.all(['a','b'].map(slot => read(deps.key(slot,'manifest'))));
    await Promise.all(deps.keys(manifests).map(remove));
    return true;
  };
  return Object.freeze({ clear });
}
