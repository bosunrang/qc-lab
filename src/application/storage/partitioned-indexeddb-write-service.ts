export type PartitionedIndexedDbWriteService = Readonly<{ write: (input: { state: any; currentSlot: string; dirtyTestIds: string[] | null; read: (key: string) => Promise<any>; put: (record: any) => Promise<any>; remove: (key: string) => Promise<any> }) => Promise<any> }>;

export function createPartitionedIndexedDbWriteService(deps: {
  supported: () => boolean;
  key: (slot: string, type: string, id?: string) => string;
  draft: (state: any, currentSlot: string, dirtyTestIds: string[] | null, manifest: any) => any;
  finalize: (state: any, manifest: any, slotManifest: any, draft: any) => any;
}): PartitionedIndexedDbWriteService {
  const write = async (input: { state: any; currentSlot: string; dirtyTestIds: string[] | null; read: (key: string) => Promise<any>; put: (record: any) => Promise<any>; remove: (key: string) => Promise<any> }): Promise<any> => {
    if (!deps.supported()) return false;
    const manifest = input.currentSlot === 'a' || input.currentSlot === 'b' ? await input.read(deps.key(input.currentSlot, 'manifest')) : null;
    const draft = deps.draft(input.state, input.currentSlot, input.dirtyTestIds, manifest);
    const slotManifest = draft.incremental ? manifest : await input.read(deps.key(draft.slot, 'manifest'));
    const plan = deps.finalize(input.state, manifest, slotManifest, draft);
    await Promise.all([
      input.put({key:deps.key(plan.slot,'shell'),savedAt:plan.savedAt,state:plan.shell}),
      ...plan.partitions.map((testId: string) => input.put({key:deps.key(plan.slot,'data',testId),savedAt:plan.savedAt,testId,points:plan.data[testId] || []})),
    ]);
    await input.put({key:deps.key(plan.slot,'manifest'),savedAt:plan.savedAt,slot:plan.slot,testIds:plan.testIds});
    await input.put({key:'partition:latest',savedAt:plan.savedAt,slot:plan.slot});
    await Promise.all(plan.removedTestIds.map((testId: string) => input.remove(deps.key(plan.slot,'data',testId))));
    return {slot:plan.slot,savedAt:plan.savedAt,shell:plan.shell,mode:plan.incremental?'incremental':'full',partitionsWritten:plan.partitions.length};
  };
  return Object.freeze({ write });
}
