export function entryExtraRunState(keys: Iterable<unknown>, request: { key: unknown; focus: unknown }) {
  const next = new Set(keys);
  next.add(request.key);
  return { keys: next, focus: String(request.focus || '') };
}
