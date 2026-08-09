export type NceActionIdentityDeps = {
  createId: () => string;
  now: () => Date;
  isoDate: (date: Date) => string;
  isCancelled: (action: Record<string, any>) => boolean;
};

export function createNceActionIdentityService(deps: NceActionIdentityDeps) {
  const nextNceId = (actions: Record<string, any>[], today: unknown): string => {
    const day = String(today || '').replace(/-/g, '');
    let value = '';
    do {
      value = `NCE-${day}-${String(deps.createId()).replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase()}`;
    } while ((actions || []).some(action => action.nceId === value));
    return value;
  };
  const dueDate = (days = 7): string => {
    const date = deps.now();
    date.setDate(date.getDate() + days);
    return deps.isoDate(date);
  };
  const activeFollowUp = (actions: Record<string, any>[], action: Record<string, any> | null | undefined) => {
    const id = String(action?.followUpNceId || '').trim();
    return id ? (actions || []).find(candidate => candidate.nceId === id && !deps.isCancelled(candidate)) || null : null;
  };
  return Object.freeze({ nextNceId, dueDate, activeFollowUp });
}

export type NceActionIdentityService = ReturnType<typeof createNceActionIdentityService>;
