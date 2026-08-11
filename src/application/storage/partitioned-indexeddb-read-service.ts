export type PartitionedIndexedDbReadService = Readonly<{ read: (slot: string | undefined, get: (key: string) => Promise<any>) => Promise<any> }>;

export function createPartitionedIndexedDbReadService(deps: {
  supported: () => boolean;
  key: (slot: string, type: string, id?: string) => string;
  slots: (preferred: string) => string[];
  recover: (slot: string, manifest: any, shell: any, rows: any[]) => any;
}): PartitionedIndexedDbReadService {
  const readSlot = async (slot: string, get: (key: string) => Promise<any>): Promise<any> => {
    if (slot !== 'a' && slot !== 'b') return null;
    const manifest = await get(deps.key(slot,'manifest')), shell = await get(deps.key(slot,'shell'));
    const testIds = manifest && Array.isArray(manifest.testIds) ? manifest.testIds : [];
    const rows = await Promise.all(testIds.map((testId: string) => get(deps.key(slot,'data',testId))));
    return deps.recover(slot, manifest, shell, rows);
  };
  const read = async (slot: string | undefined, get: (key: string) => Promise<any>): Promise<any> => {
    if (!deps.supported()) return null;
    if (slot) return readSlot(slot,get);
    const latest = await get('partition:latest'), slots = deps.slots(latest && latest.slot);
    return await readSlot(slots[0],get) || await readSlot(slots[1],get);
  };
  return Object.freeze({ read });
}
