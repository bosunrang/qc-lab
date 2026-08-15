type RecordValue = Record<string, any>;
type User = { id?: string; username?: string; name?: string };
type ReviewService = {
  reviewToken: (record: RecordValue) => string;
  cancelReadiness: (record: RecordValue) => { ok: boolean };
  approvalReadiness: (record: RecordValue, user: User) => { ok: boolean };
  returnReadiness: (record: RecordValue) => { ok: boolean };
  canReopen: (record: RecordValue) => boolean;
  cancel: (record: RecordValue, note: string, by: string) => boolean;
  approve: (record: RecordValue, note: string, by: string) => boolean;
  returnForRevision: (record: RecordValue, note: string, by: string) => boolean;
  reopen: (record: RecordValue, note: string) => boolean;
};
type EscalationService = {
  canEscalate: (records: RecordValue[], record: RecordValue) => boolean;
  createFollowUp: (records: RecordValue[], record: RecordValue, user: User) => RecordValue | null;
};

export type NceLifecycleCommandDeps = { review: ReviewService; escalation: EscalationService };
export type NceLifecycleKind = 'cancel' | 'approve' | 'return' | 'reopen' | 'escalate';

/* Cổng mutation duy nhất cho lifecycle NCE. Adapter chỉ giữ re-auth/modal vì đó là
   tương tác trình duyệt; token, readiness và thay đổi record phải cùng một transaction. */
export function createNceLifecycleCommand(deps: NceLifecycleCommandDeps) {
  const execute = (input: { kind: NceLifecycleKind; actions: RecordValue[]; id: string; token?: string; note?: string; user?: User }) => {
    const record = (input.actions || []).find(item => item.id === input.id);
    if (!record) return { ok: false as const, reason: 'missing' };
    if (input.token != null && deps.review.reviewToken(record) !== input.token) return { ok: false as const, reason: 'stale' };
    const note = String(input.note || '').trim(), user = input.user || {};
    if (input.kind === 'cancel') {
      if (!deps.review.cancelReadiness(record).ok) return { ok: false as const, reason: 'not-ready' };
      return deps.review.cancel(record, note, user.name || '') ? { ok: true as const, record } : { ok: false as const, reason: 'not-ready' };
    }
    if (input.kind === 'approve') {
      if (!deps.review.approvalReadiness(record, user).ok) return { ok: false as const, reason: 'not-ready' };
      return deps.review.approve(record, note, user.name || '') ? { ok: true as const, record } : { ok: false as const, reason: 'not-ready' };
    }
    if (input.kind === 'return') {
      if (!deps.review.returnReadiness(record).ok) return { ok: false as const, reason: 'not-ready' };
      return deps.review.returnForRevision(record, note, user.name || '') ? { ok: true as const, record } : { ok: false as const, reason: 'not-ready' };
    }
    if (input.kind === 'reopen') {
      if (!deps.review.canReopen(record)) return { ok: false as const, reason: 'not-ready' };
      return deps.review.reopen(record, note) ? { ok: true as const, record } : { ok: false as const, reason: 'not-ready' };
    }
    if (!deps.escalation.canEscalate(input.actions || [], record)) return { ok: false as const, reason: 'not-ready' };
    const followUp = deps.escalation.createFollowUp(input.actions || [], record, user);
    return followUp ? { ok: true as const, record: followUp } : { ok: false as const, reason: 'not-ready' };
  };
  return Object.freeze({ execute });
}

export type NceLifecycleCommand = ReturnType<typeof createNceLifecycleCommand>;
