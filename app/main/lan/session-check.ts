// Kiểm lại phiên HTTP của máy trạm LAN (GV5). Tách khỏi `ipc/access-gate.ts`
// vì dùng `node:crypto`, còn cổng quyền chạy cả trong bản xem trước qua trình duyệt.
import { createHash } from 'node:crypto';
import type { Db } from '../db/sqlite-like';
import type { Actor } from '../ipc/shared';

/** Dấu vân tay của mật khẩu hiện hành để nhận ra mật khẩu đã đổi (tự đổi,
 * admin đặt lại, hoặc phục hồi bản sao lưu) mà không giữ chính `pass_hash`
 * trong bộ nhớ phiên. */
function fingerprint(passHash: string): string {
  return createHash('sha256').update(passHash).digest('hex');
}

/** Kiểm lại phiên HTTP của máy trạm LAN ở MỖI yêu cầu. `stamp` lấy lúc đăng
 * nhập; tài khoản không còn, đã khoá hoặc đổi mật khẩu thì phiên hết hiệu lực
 * ngay ở yêu cầu kế tiếp, thay vì sống đủ 8 giờ. */
export function createSessionCheck(db: Db) {
  const read = db.prepare('SELECT id, username, name, role, active, pass_hash FROM users WHERE id=?');
  type Row = { id: string; username: string; name: string; role: string; active: number; pass_hash: string };
  return {
    stampOf(userId: string): string | null {
      const row = read.get(userId) as Row | undefined;
      return row ? fingerprint(row.pass_hash) : null;
    },
    recheck(actor: Actor, stamp: string | undefined): Actor | null {
      const row = read.get(actor.userId) as Row | undefined;
      if (!row || !row.active || !stamp || fingerprint(row.pass_hash) !== stamp) return null;
      return { ...actor, username: row.username, name: row.name, role: row.role };
    },
  };
}
