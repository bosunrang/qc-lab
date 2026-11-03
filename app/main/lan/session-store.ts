import { randomBytes } from 'node:crypto';
import type { Actor } from '../ipc/shared';

/** Phiên HTTP chỉ sống tại máy chủ; trình duyệt chỉ giữ mã ngẫu nhiên trong
 * cookie HttpOnly. Không đưa Actor, quyền hay mật khẩu xuống phía client.
 * `stamp` là dấu vân tay mật khẩu lúc đăng nhập (GV5): máy chủ so lại ở mỗi
 * yêu cầu để thu hồi phiên khi mật khẩu đổi. `actor` được làm mới theo CSDL
 * ở mỗi yêu cầu, không giữ vai trò lúc đăng nhập. */
export interface LanSession { token: string; actor: Actor; stamp?: string; expiresAt: number; }

export class LanSessionStore {
  private readonly sessions = new Map<string, LanSession>();

  constructor(private readonly ttlMs = 8 * 60 * 60 * 1000, private readonly now = () => Date.now()) {}

  create(actor: Actor, stamp?: string): LanSession {
    this.purge();
    const session: LanSession = { token: randomBytes(32).toString('base64url'), actor, stamp, expiresAt: this.now() + this.ttlMs };
    this.sessions.set(session.token, session);
    return session;
  }

  get(token: string | undefined): LanSession | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= this.now()) { this.sessions.delete(token); return null; }
    return session;
  }

  revoke(token: string | undefined): void { if (token) this.sessions.delete(token); }
  purge(): void { for (const [token, session] of this.sessions) if (session.expiresAt <= this.now()) this.sessions.delete(token); }
}


