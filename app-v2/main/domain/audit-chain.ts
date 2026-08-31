// Chuỗi hash tamper-evident cho nhật ký hoạt động — tham khảo thuật toán từ
// bản cũ (src/domain/core/qc-core.ts's auditCanonicalCore/auditSha256Core/
// verifyAuditChain), nhưng dùng `node:crypto` thật thay vì SHA-256 tự viết
// tay bằng JS (bản cũ phải tự viết vì core.js còn chạy trong trình duyệt;
// app mới CHỈ chạy trong main process Electron/Node nên dùng crypto chuẩn
// của Node — nhanh hơn, ít rủi ro sai sót hơn, cùng thuật toán SHA-256 tiêu
// chuẩn nên cho ra hash giống hệt bản cũ với cùng input).
import { createHash } from 'node:crypto';

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
  return createHash('sha256').update(text, 'utf8').digest('hex');
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
  legacy: number;
  brokenIndex: number;
  reason: string;
}

/** Xác nhận chuỗi hash liên tục từ `anchor`. Dòng "legacy" (không có hash lẫn
 * prevHash) được bỏ qua, không phá chuỗi — cho phép xen giữa các dòng đã hash. */
export function verifyAuditChain(activity: readonly Partial<AuditEntry>[] = [], anchor = ''): ChainVerifyResult {
  let prev = String(anchor || ''), checked = 0, legacy = 0;
  for (let i = 0; i < activity.length; i++) {
    const a = activity[i] || {};
    if (!a.hash && !a.prevHash) { legacy++; continue; }
    if (a.prevHash !== prev) return { ok: false, checked, legacy, brokenIndex: i, reason: 'prevHash không khớp' };
    if (a.hash !== auditEntryHash(a)) return { ok: false, checked, legacy, brokenIndex: i, reason: 'hash không khớp' };
    prev = a.hash;
    checked++;
  }
  return { ok: true, checked, legacy, brokenIndex: -1, reason: '' };
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
