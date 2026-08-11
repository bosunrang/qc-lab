export function syncSnapshotSignature(value:any) {
  if (!value) return 'empty';
  const text = JSON.stringify(value); let hash = 0;
  for (let index = 0; index < text.length; index++) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return text.length + ':' + hash.toString(36);
}
