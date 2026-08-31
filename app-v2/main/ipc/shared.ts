// Tiện ích dùng chung cho MỌI IPC handler: Actor/IpcResult, và writeAudit
// (ghi 1 dòng vào chuỗi hash tamper-evident `activity`). Trước khi có file
// này, config/entry/nce/reagent/sigma/westgard-handlers.ts mỗi file tự khai
// báo lại y hệt — gom về đây khi thêm handler thứ 7 (auth-handlers.ts) thay
// vì nhân bản lần nữa.
import type { Db } from '../db/open-database';
import { uid } from '../domain/text-utils';
import { auditEntryHash } from '../domain/audit-chain';

export interface Actor { userId: string; username: string; name: string; role: string; clientId: string }

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export function nowIso(): string { return new Date().toISOString(); }

/** SQLite trả cột snake_case (`prev_hash`, `user_id`...) — chuyển về camelCase
 * đúng shape `AuditEntry` mà audit-chain.ts (hash/verify/relink) mong đợi.
 * Đây là ranh giới DUY NHẤT cần ánh xạ; mọi nơi khác đọc activity qua hàm
 * này, không tự SELECT * rồi dùng thẳng. */
export function rowToAuditEntry(row: Record<string, unknown>) {
  return {
    id: row.id, seq: row.seq, ts: row.ts, user: row.user, username: row.username,
    userId: row.user_id, role: row.role, type: row.type, detail: row.detail, target: row.target,
    clientId: row.client_id, prevHash: row.prev_hash, hash: row.hash,
  };
}

export function writeAudit(db: Db, actor: Actor, type: string, detail: string, target = ''): void {
  const row = db.prepare('SELECT hash FROM activity ORDER BY seq DESC LIMIT 1').get() as { hash: string } | undefined;
  const seqRow = db.prepare('SELECT COALESCE(MAX(seq),0) as maxSeq FROM activity').get() as { maxSeq: number };
  const entry = {
    id: uid(), seq: seqRow.maxSeq + 1, ts: nowIso(), user: actor.name, username: actor.username,
    userId: actor.userId, role: actor.role, type, detail, target, clientId: actor.clientId,
    prevHash: row ? row.hash : '', hash: '',
  };
  entry.hash = auditEntryHash(entry);
  db.prepare(`INSERT INTO activity(id,seq,ts,user,username,user_id,role,type,detail,target,client_id,prev_hash,hash)
    VALUES (@id,@seq,@ts,@user,@username,@userId,@role,@type,@detail,@target,@clientId,@prevHash,@hash)`)
    .run({
      id: entry.id, seq: entry.seq, ts: entry.ts, user: entry.user, username: entry.username,
      userId: entry.userId, role: entry.role, type: entry.type, detail: entry.detail, target: entry.target,
      clientId: entry.clientId, prevHash: entry.prevHash, hash: entry.hash,
    });
}
