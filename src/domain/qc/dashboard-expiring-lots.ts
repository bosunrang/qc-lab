type Value = Record<string, any>;

export function dashboardExpiringLots(entries: Value[]) {
  const grouped = new Map<string, Value>();
  entries.forEach(entry => {
    const key = entry.l.qcLotId || (entry.l.lot || '') + '|' + entry.l.level;
    const current = grouped.get(key);
    if (!current || entry.d < current.d) grouped.set(key, { ...entry, count: (current ? current.count : 0) + 1 });
    else current.count++;
  });
  return grouped;
}
