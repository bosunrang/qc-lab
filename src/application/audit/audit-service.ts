type AuditEntry = Record<string, any>;

export type AuditState = { activity?: AuditEntry[]; activityAnchor?: string };

export type AuditServiceDeps = {
  getState: () => AuditState;
  uid: () => string;
  nowIso: () => string;
  actor: () => { user: string; username: string; userId: string; role: string; clientId: string };
  entryHash: (entry: AuditEntry) => string;
  verifyChain: (activity: AuditEntry[], anchor: string) => Record<string, any>;
  limits: () => { hardCap: number; rotateTo: number };
  autoVerifyMax: number;
};

export type AuditServiceApi = ReturnType<typeof createAuditService>;

export function createAuditService(deps: AuditServiceDeps) {
  let chainCache: { sig: string; result: Record<string, any> | null } = { sig: '', result: null };
  const list = () => deps.getState().activity || [];
  const lastHashOf = (activity: AuditEntry[] = []) => {
    for (let i = activity.length - 1; i >= 0; i--) { const hash = activity[i] && activity[i].hash; if (hash) return hash; }
    return '';
  };
  const lastHash = () => lastHashOf(list());
  const nextSeq = () => list().reduce((max, entry) => Math.max(max, Number(entry.seq) || 0), 0) + 1;
  const archiveCut = (activity: AuditEntry[] = [], cutoffIso: unknown) => {
    const cutoff = String(cutoffIso || ''), segment: AuditEntry[] = [], retained: AuditEntry[] = [];
    activity.forEach(entry => { const ts = String(entry && entry.ts || ''); if (ts && ts < cutoff) segment.push(entry); else retained.push(entry); });
    return { segment, retained, tipHash: lastHashOf(segment) };
  };
  const pushRaw = (type: string, detail: string, target = '') => {
    const state = deps.getState();
    state.activity = state.activity || [];
    if (!state.activity.length && state.activityAnchor) state.activityAnchor = '';
    const actor = deps.actor();
    const entry: AuditEntry = {
      id: deps.uid(), seq: nextSeq(), ts: deps.nowIso(), user: actor.user, username: actor.username,
      userId: actor.userId, role: actor.role, type, detail, target, clientId: actor.clientId, prevHash: lastHash(),
    };
    entry.hash = deps.entryHash(entry);
    state.activity.push(entry);
  };
  const rotateOverflow = () => {
    const state = deps.getState(), activity = list(), limits = deps.limits();
    if (activity.length <= limits.hardCap) return;
    const dropped = activity.slice(0, activity.length - limits.rotateTo), tip = lastHashOf(dropped);
    state.activity = activity.slice(-limits.rotateTo);
    if (tip) state.activityAnchor = tip;
    pushRaw('Xoay vòng nhật ký hoạt động', `Nhật ký vượt ${limits.hardCap} dòng: tự động loại ${dropped.length} dòng cũ nhất, giữ lại ${limits.rotateTo} dòng mới nhất (không xuất CSV). Hash đỉnh phần đã loại: ${tip || '—'}. Nên dùng "Lưu trữ nhật ký cũ" ở trang Nhật ký để có file CSV trước khi cắt.`, 'Nhật ký');
  };
  const log = (type: string, detail: string, target = '') => { pushRaw(type, detail, target); rotateOverflow(); };
  const chainSignature = () => { const activity = list(), last = activity[activity.length - 1] || {}; return `${activity.length}|${last.hash || ''}|${deps.getState().activityAnchor || ''}`; };
  const chainStatus = (force = false) => {
    const sig = chainSignature();
    if (chainCache.sig === sig && chainCache.result) return chainCache.result;
    const activity = list();
    if (!force && activity.length > deps.autoVerifyMax) return { idle: true, total: activity.length };
    const result = { ...deps.verifyChain(activity, deps.getState().activityAnchor || ''), idle: false };
    chainCache = { sig, result };
    return result;
  };
  const resetChainCache = () => { chainCache = { sig: '', result: null }; };
  const relinkChain = (activity: AuditEntry[] = [], anchor = '') => {
    let previous = String(anchor || '');
    return activity.map(entry => {
      if (!entry || (!entry.hash && !entry.prevHash)) return entry;
      const relinked: AuditEntry = { ...entry, prevHash: previous };
      relinked.hash = deps.entryHash(relinked);
      previous = relinked.hash;
      return relinked;
    });
  };
  return Object.freeze({ lastHashOf, lastHash, nextSeq, archiveCut, pushRaw, rotateOverflow, log, chainSignature, chainStatus, resetChainCache, relinkChain });
}
