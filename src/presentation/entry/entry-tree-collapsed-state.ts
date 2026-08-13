export function entryTreeCollapsedState(cached: boolean | null, read: () => boolean) {
  return cached === null ? read() : cached;
}

export function entryTreeCollapsedToggle(collapsed: boolean) {
  return !collapsed;
}
