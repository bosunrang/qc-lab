import { DatabaseSync, backup } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, openSync, closeSync } from 'node:fs';
import * as path from 'node:path';
import type { LisMessage, LisQueueRecord, LisResolved } from '../../shared/qc-api';
import { decision, GatewayError, mapping, message, text, tokenDraft, type GatewayMapping, type GatewayRole } from './validation';

export interface GatewayActor { id: string; role: GatewayRole; sourceId: string }
/** CLI chạy tại máy chủ, quyền truy cập được hệ điều hành kiểm soát. */
export const LOCAL_ADMIN: GatewayActor = Object.freeze({ id: 'local-cli', role: 'admin', sourceId: '' });
interface MessageRow { id: string; source_id: string; source_message_id: string; message_json: string; received_at: string; status: string; resolved_json: string | null; decision_json: string | null }
interface TokenRow { id: string; role: GatewayRole; source_id: string; label: string; created_at: string; revoked_at: string | null }
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const stamp = () => new Date().toISOString();

/** CSDL Gateway độc lập; không mở hoặc ghi vào CSDL nghiệp vụ của QC Lab. */
export class GatewayStore {
  private readonly db: DatabaseSync;
  private readonly listeners = new Set<() => void>();
  readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath === ':memory:' ? filePath : path.resolve(filePath);
    if (filePath !== ':memory:') mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.db = new DatabaseSync(this.filePath);
    try {
      this.db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
      const version = Number((this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
      if (version > 1) throw new GatewayError(503, 'newer-schema', 'CSDL Gateway thuộc phiên bản mới hơn.');
      if (version === 0) this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE gateway_tokens(id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK(role IN ('admin','app','ingest')),
          source_id TEXT NOT NULL, label TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT);
        CREATE TABLE gateway_messages(id TEXT PRIMARY KEY, source_id TEXT NOT NULL, source_message_id TEXT NOT NULL, message_json TEXT NOT NULL,
          received_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','imported','rejected')), resolved_json TEXT, decision_json TEXT,
          UNIQUE(source_id,source_message_id));
        CREATE INDEX gateway_queue ON gateway_messages(status,received_at,id);
        CREATE TABLE gateway_mappings(id TEXT PRIMARY KEY, source_id TEXT NOT NULL, analyzer_id TEXT NOT NULL, test_code TEXT NOT NULL,
          qc_level TEXT NOT NULL, qc_lot_code TEXT NOT NULL, mapping_json TEXT NOT NULL,
          UNIQUE(source_id,analyzer_id,test_code,qc_level,qc_lot_code));
        CREATE TABLE gateway_audit(id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at TEXT NOT NULL, actor_id TEXT NOT NULL,
          action TEXT NOT NULL, entity_id TEXT NOT NULL, detail_json TEXT NOT NULL);
        PRAGMA user_version=1; COMMIT;`);
    } catch (error) { this.db.close(); throw error; }
  }

  close(): void { this.db.close(); }
  onChanged(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private authorize(actor: GatewayActor, roles: GatewayRole[]): void {
    if (!roles.includes(actor.role)) throw new GatewayError(403, 'forbidden', 'Token không có quyền thực hiện thao tác này.');
  }
  private writeAudit(actor: GatewayActor, action: string, entity: string, detail: unknown): void {
    this.db.prepare('INSERT INTO gateway_audit(occurred_at,actor_id,action,entity_id,detail_json) VALUES(?,?,?,?,?)').run(stamp(), actor.id, action, entity, JSON.stringify(detail));
  }
  private notifyChanged(): void {
    // Lỗi ở bên quan sát không được biến một lần ghi đã commit thành thất bại.
    for (const listener of this.listeners) { try { listener(); } catch { /* bên quan sát tự xử lý lỗi */ } }
  }
  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = work(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  private insertToken(draft: ReturnType<typeof tokenDraft>) {
    const id = randomUUID(), token = randomBytes(32).toString('base64url');
    this.db.prepare('INSERT INTO gateway_tokens(id,token_hash,role,source_id,label,created_at) VALUES(?,?,?,?,?,?)')
      .run(id, hashToken(token), draft.role, draft.sourceId, draft.label, stamp());
    return { id, token, ...draft };
  }
  initialize() {
    const result = this.transaction(() => {
      if (this.db.prepare('SELECT id FROM gateway_tokens LIMIT 1').get()) throw new GatewayError(409, 'already-initialized', 'Gateway đã được khởi tạo; token cũ được giữ nguyên.');
      const admin = this.insertToken({ role: 'admin', sourceId: '', label: 'Quản trị ban đầu' });
      const app = this.insertToken({ role: 'app', sourceId: '', label: 'QC Lab' });
      this.writeAudit(LOCAL_ADMIN, 'initialize', '', { tokenIds: [admin.id, app.id] });
      return { admin, app };
    });
    this.notifyChanged();
    return result;
  }
  get initialized(): boolean { return !!this.db.prepare("SELECT id FROM gateway_tokens WHERE role='admin' AND revoked_at IS NULL LIMIT 1").get(); }

  authenticate(authorization: string | undefined): GatewayActor {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization || '');
    const row = match ? this.db.prepare('SELECT id,role,source_id FROM gateway_tokens WHERE token_hash=? AND revoked_at IS NULL').get(hashToken(match[1])) as Pick<TokenRow, 'id' | 'role' | 'source_id'> | undefined : undefined;
    if (!row) throw new GatewayError(401, 'unauthorized', 'Token Gateway sai, đã thu hồi hoặc chưa nhập.');
    return { id: row.id, role: row.role, sourceId: row.source_id };
  }
  createToken(actor: GatewayActor, input: unknown) {
    this.authorize(actor, ['admin']);
    const draft = tokenDraft(input);
    const result = this.transaction(() => {
      const created = this.insertToken(draft);
      this.writeAudit(actor, 'create-token', created.id, { role: draft.role, sourceId: draft.sourceId, label: draft.label });
      return created;
    });
    this.notifyChanged();
    return result;
  }
  listTokens(actor: GatewayActor): TokenRow[] {
    this.authorize(actor, ['admin']);
    return this.db.prepare('SELECT id,role,source_id,label,created_at,revoked_at FROM gateway_tokens ORDER BY created_at,id').all() as unknown as TokenRow[];
  }
  revokeToken(actor: GatewayActor, value: unknown): void {
    this.authorize(actor, ['admin']);
    const id = text(value, 'tokenId', 80);
    this.transaction(() => {
      const current = this.db.prepare('SELECT role,revoked_at FROM gateway_tokens WHERE id=?').get(id) as TokenRow | undefined;
      if (!current) throw new GatewayError(404, 'missing-token', 'Không tìm thấy token.');
      if (current.revoked_at) return;
      const admins = Number((this.db.prepare("SELECT COUNT(*) AS n FROM gateway_tokens WHERE role='admin' AND revoked_at IS NULL").get() as { n: number }).n);
      if (current.role === 'admin' && admins <= 1) throw new GatewayError(409, 'last-admin', 'Tạo token quản trị thay thế trước khi thu hồi token quản trị cuối cùng.');
      this.db.prepare('UPDATE gateway_tokens SET revoked_at=? WHERE id=?').run(stamp(), id);
      this.writeAudit(actor, 'revoke-token', id, {});
    });
    this.notifyChanged();
  }

  saveMappings(actor: GatewayActor, input: unknown): void {
    this.authorize(actor, ['admin']);
    if (!Array.isArray(input) || input.length < 1 || input.length > 50) throw new GatewayError(400, 'invalid-mappings', 'Gửi từ 1 đến 50 ánh xạ mỗi lần.');
    const items = input.map(mapping);
    const keys = items.map((item) => JSON.stringify([item.sourceId, item.analyzerId, item.testCode, item.qcLevel, item.qcLotCode]));
    if (new Set(keys).size !== keys.length) throw new GatewayError(400, 'duplicate-mapping', 'Danh sách có khoá ánh xạ trùng nhau.');
    this.transaction(() => {
      for (const item of items) {
        const id = randomUUID();
        this.db.prepare(`INSERT INTO gateway_mappings(id,source_id,analyzer_id,test_code,qc_level,qc_lot_code,mapping_json) VALUES(?,?,?,?,?,?,?)
          ON CONFLICT(source_id,analyzer_id,test_code,qc_level,qc_lot_code) DO UPDATE SET mapping_json=excluded.mapping_json`)
          .run(id, item.sourceId, item.analyzerId, item.testCode, item.qcLevel, item.qcLotCode, JSON.stringify(item));
      }
      this.writeAudit(actor, 'save-mappings', '', { items });
    });
    this.notifyChanged();
  }
  listMappings(actor: GatewayActor): GatewayMapping[] {
    this.authorize(actor, ['admin']);
    return (this.db.prepare('SELECT mapping_json FROM gateway_mappings ORDER BY source_id,analyzer_id,test_code,qc_level,qc_lot_code').all() as { mapping_json: string }[]).map((row) => JSON.parse(row.mapping_json) as GatewayMapping);
  }
  private resolve(row: MessageRow): LisResolved {
    if (row.resolved_json) return JSON.parse(row.resolved_json) as LisResolved;
    const msg = JSON.parse(row.message_json) as LisMessage;
    const found = this.db.prepare(`SELECT mapping_json FROM gateway_mappings WHERE source_id=? AND analyzer_id=? AND test_code=? AND qc_level=? AND qc_lot_code=?`)
      .get(row.source_id, msg.analyzerId, msg.testCode, msg.qcLevel, msg.qcLotCode!) as { mapping_json: string } | undefined;
    if (!found) return { ok: false, code: 'UNMAPPED', reason: 'Chưa có ánh xạ chính xác cho nguồn, máy, xét nghiệm, mức và lô QC.' };
    const item = JSON.parse(found.mapping_json) as GatewayMapping;
    if (!item.active) return { ok: false, code: 'MAPPING_DISABLED', reason: 'Ánh xạ đã được tắt; cần quản trị viên đối chiếu.' };
    if (msg.unit !== item.unit) return { ok: false, code: 'UNIT_MISMATCH', reason: `Đơn vị LIS (${msg.unit}) không khớp ánh xạ (${item.unit}); không tự quy đổi.` };
    return { ok: true, code: 'RESOLVED', qclabTestId: item.qclabTestId, level: item.level, lot: item.lot, displayName: item.displayName };
  }
  private record(row: MessageRow): LisQueueRecord {
    // Mã Gateway ổn định, độc lập giữa các nguồn có cùng mã bản tin gốc.
    // `source` giữ khoá gốc để QC Lab chống nhận trùng khi Gateway được phục
    // hồi từ bản sao lưu cũ và cấp UUID mới cho cùng bản tin LIS.
    return { id: row.id, receivedAt: row.received_at, status: row.status,
      message: { ...JSON.parse(row.message_json) as LisMessage, messageId: row.id }, resolved: this.resolve(row),
      source: { sourceId: row.source_id, messageId: row.source_message_id } };
  }
  ingest(actor: GatewayActor, input: unknown) {
    this.authorize(actor, ['ingest']);
    const msg = message(input), json = JSON.stringify(msg);
    let changed = false;
    const result = this.transaction(() => {
      const existing = this.db.prepare('SELECT * FROM gateway_messages WHERE source_id=? AND source_message_id=?').get(actor.sourceId, msg.messageId) as unknown as MessageRow | undefined;
      if (existing) {
        if (existing.message_json !== json) throw new GatewayError(409, 'message-conflict', 'Mã bản tin nguồn đã được dùng với nội dung khác; bản tin cũ được giữ nguyên.');
        return { duplicate: true, messageId: existing.id, sourceMessageId: msg.messageId, status: existing.status };
      }
      const id = randomUUID();
      this.db.prepare(`INSERT INTO gateway_messages(id,source_id,source_message_id,message_json,received_at,status) VALUES(?,?,?,?,?,'pending')`)
        .run(id, actor.sourceId, msg.messageId, json, stamp());
      this.writeAudit(actor, 'receive-qc', id, { sourceId: actor.sourceId, sourceMessageId: msg.messageId });
      changed = true;
      return { duplicate: false, messageId: id, sourceMessageId: msg.messageId, status: 'pending' };
    });
    if (changed) this.notifyChanged();
    return result;
  }

  listQueue(actor: GatewayActor, status: string, limit: number, after = ''): { items: LisQueueRecord[]; nextCursor: string | null } {
    this.authorize(actor, ['app', 'admin']);
    if (!['pending', 'imported', 'rejected'].includes(status) || !Number.isInteger(limit) || limit < 1 || limit > 500) throw new GatewayError(400, 'invalid-query', 'Trạng thái hoặc giới hạn hàng chờ không hợp lệ.');
    let rows: MessageRow[];
    if (after) {
      const cursor = this.db.prepare('SELECT received_at,id FROM gateway_messages WHERE id=?').get(text(after, 'after', 80)) as { received_at: string; id: string } | undefined;
      if (!cursor) throw new GatewayError(400, 'invalid-cursor', 'Không tìm thấy mốc phân trang.');
      rows = this.db.prepare('SELECT * FROM gateway_messages WHERE status=? AND (received_at,id)>(?,?) ORDER BY received_at,id LIMIT ?')
        .all(status, cursor.received_at, cursor.id, limit + 1) as unknown as MessageRow[];
    } else rows = this.db.prepare('SELECT * FROM gateway_messages WHERE status=? ORDER BY received_at,id LIMIT ?').all(status, limit + 1) as unknown as MessageRow[];
    return { items: rows.slice(0, limit).map((row) => this.record(row)), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
  }
  decide(actor: GatewayActor, input: unknown): void {
    this.authorize(actor, ['app', 'admin']);
    const data = decision(input);
    this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM gateway_messages WHERE id=?').get(data.messageId) as unknown as MessageRow | undefined;
      if (!row) throw new GatewayError(404, 'missing-message', 'Không tìm thấy bản tin Gateway.');
      if (row.status === data.status) return;
      if (row.status !== 'pending') throw new GatewayError(409, 'decision-conflict', 'Bản tin đã được nhận hoặc bỏ; không được đổi quyết định.');
      // Xác nhận lại phải hoạt động cả khi ánh xạ đã đổi sau lúc QC Lab lưu điểm.
      this.db.prepare('UPDATE gateway_messages SET status=?,resolved_json=?,decision_json=? WHERE id=?')
        .run(data.status, JSON.stringify(this.resolve(row)), JSON.stringify({ ...data, decidedAt: stamp(), tokenId: actor.id }), row.id);
      this.writeAudit(actor, 'decide-qc', row.id, data);
    });
    this.notifyChanged();
  }
  audit(actor: GatewayActor, after: number, limit: number) {
    this.authorize(actor, ['admin']);
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 500) throw new GatewayError(400, 'invalid-query', 'Mốc hoặc giới hạn nhật ký không hợp lệ.');
    return this.db.prepare('SELECT * FROM gateway_audit WHERE id>? ORDER BY id LIMIT ?').all(after, limit);
  }
  status(actor: GatewayActor) {
    this.authorize(actor, ['admin', 'app']);
    return { initialized: this.initialized, schemaVersion: 1,
      counts: this.db.prepare('SELECT status,COUNT(*) AS count FROM gateway_messages GROUP BY status').all(),
      mappings: Number((this.db.prepare('SELECT COUNT(*) AS n FROM gateway_mappings').get() as { n: number }).n) };
  }
  async backup(actor: GatewayActor, destination: string): Promise<void> {
    this.authorize(actor, ['admin']);
    const target = path.resolve(destination);
    if (target === this.filePath) throw new GatewayError(400, 'invalid-backup', 'Tệp sao lưu phải khác CSDL đang chạy.');
    mkdirSync(path.dirname(target), { recursive: true });
    // Đặt chỗ độc quyền để không ghi đè một bản sao lưu có sẵn.
    closeSync(openSync(target, 'wx', 0o600));
    await backup(this.db, target);
    this.transaction(() => this.writeAudit(actor, 'backup', '', { fileName: path.basename(target) }));
    this.notifyChanged();
  }
}
