export function entryMachineSelection(value: unknown, machines: Iterable<unknown>) {
  const selected = String(value || 'all');
  const available = new Set([...machines].map(item => String(item)));
  return selected === 'all' || available.has(selected) ? selected : 'all';
}
