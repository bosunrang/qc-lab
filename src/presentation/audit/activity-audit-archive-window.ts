export interface ActivityAuditArchiveWindow {
  months: number;
  cutoffIso: string;
}

export function activityAuditArchiveWindow(value: unknown, now: Date = new Date()): ActivityAuditArchiveWindow {
  const months = Math.max(1, Math.floor(Number(value) || 24));
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return { months, cutoffIso: cutoff.toISOString() };
}
