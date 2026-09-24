import { sha256Hex } from './sha256';

export interface AuditEntry {
  id: string;
  seq: number;
  ts: string;
  user: string;
  username: string;
  userId: string;
  role: string;
  type: string;
  detail: string;
  target: string;
  clientId: string;
  prevHash: string;
  hash: string;
}

/** JSON hoá tất định: khoá object luôn sắp xếp theo alphabet, để hash không
 * đổi chỉ vì thứ tự khoá khác nhau giữa hai lần build cùng payload. */
export function auditCanonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(auditCanonical).join(',') + ']';
  const obj = value as Record<string, unknown>;
  return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + auditCanonical(obj[k])).join(',') + '}';
}

export function auditSha256(text: string): string {
  return sha256Hex(text);
}

/** hash = sha256(prevHash + '|' + canonicalJSON(payload không gồm hash/prevHash)). */
export function auditEntryHash(entry: Partial<AuditEntry>): string {
  const { hash, prevHash, ...payload } = entry;
  void hash;
  return auditSha256(String(entry.prevHash || '') + '|' + auditCanonical(payload));
}

export interface ChainVerifyResult {
  ok: boolean;
  checked: number;
  unhashed: number;
  brokenIndex: number;
  reason: string;
}

/** Xác nhận chuỗi hash liên tục từ `anchor`; dòng chưa có hash được bỏ qua. */
export function verifyAuditChain(activity: readonly Partial<AuditEntry>[] = [], anchor = ''): ChainVerifyResult {
  let prev = String(anchor || ''), checked = 0, unhashed = 0;
  for (let i = 0; i < activity.length; i++) {
    const a = activity[i] || {};
    if (!a.hash && !a.prevHash) { unhashed++; continue; }
    if (a.prevHash !== prev) return { ok: false, checked, unhashed, brokenIndex: i, reason: 'prevHash không khớp' };
    if (a.hash !== auditEntryHash(a)) return { ok: false, checked, unhashed, brokenIndex: i, reason: 'hash không khớp' };
    prev = a.hash;
    checked++;
  }
  return { ok: true, checked, unhashed, brokenIndex: -1, reason: '' };
}

/** Tính lại toàn bộ prevHash/hash theo ĐÚNG thứ tự mảng hiện tại (không sắp
 * xếp lại theo ts/seq) — dùng sau khi merge nhật ký từ nhiều nguồn (Firebase
 * sync) hoặc sau khi archive/rotate cắt bớt phần đầu. */
export function relinkAuditChain(activity: readonly Partial<AuditEntry>[] = [], anchor = ''): AuditEntry[] {
  let previous = String(anchor || '');
  return activity.map(entry => {
    if (!entry || (!entry.hash && !entry.prevHash)) return entry as AuditEntry;
    const relinked = { ...entry, prevHash: previous } as AuditEntry;
    relinked.hash = auditEntryHash(relinked);
    previous = relinked.hash;
    return relinked;
  });
}

export function lastHashOf(activity: readonly Partial<AuditEntry>[] = []): string {
  for (let i = activity.length - 1; i >= 0; i--) {
    const hash = activity[i] && activity[i].hash;
    if (hash) return hash;
  }
  return '';
}


