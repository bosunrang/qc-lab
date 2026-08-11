export function createLocalPartitionHelpers() {
  const key = (slot:any, type:any, id:any) => 'partition:' + slot + ':' + type + (id == null ? '' : ':' + id);
  const nextSlot = (current:any) => current === 'a' ? 'b' : 'a';
  const shell = (state:any) => ({ ...state, data: {} });
  return Object.freeze({ key, nextSlot, shell });
}
