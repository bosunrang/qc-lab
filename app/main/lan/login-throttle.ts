/** Giới hạn đăng nhập sai qua LAN, giữ trong bộ nhớ máy chủ.
 *
 * Hai khoá cho mỗi lần thử:
 * - `pair` = địa chỉ máy + tên đăng nhập: chặn dò mật khẩu một tài khoản mà
 *   không khoá chính chủ đang đăng nhập từ máy khác.
 * - `ip` = địa chỉ máy: chặn một máy dò lần lượt nhiều tài khoản.
 *
 * Lần thử được tính là THẤT BẠI NGAY KHI BẮT ĐẦU rồi mới hoàn lại nếu đúng
 * mật khẩu. Nếu chỉ đếm sau khi băm xong, một loạt yêu cầu gửi song song sẽ
 * cùng lọt qua kiểm tra trước khi lần sai đầu tiên kịp được ghi nhận. */
export interface LoginThrottleOptions {
  maxPerPair: number;
  maxPerIp: number;
  windowMs: number;
  lockMs: number;
}

interface Counter { count: number; firstAt: number; lockedUntil: number }

export const DEFAULT_LOGIN_THROTTLE: LoginThrottleOptions = {
  maxPerPair: 5,
  maxPerIp: 20,
  windowMs: 15 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
};

export interface LoginAttempt {
  /** Gọi đúng một lần khi đăng nhập thành công: hoàn lại lượt đã tính trước. */
  succeed(): void;
}

export class LoginThrottle {
  private readonly counters = new Map<string, Counter>();

  constructor(private readonly options: LoginThrottleOptions = DEFAULT_LOGIN_THROTTLE, private readonly now = () => Date.now()) {}

  /** Trả số ms phải chờ nếu đang bị khoá; ngược lại ghi nhận lượt thử và trả
   * handle để hoàn lại khi thành công. */
  begin(ip: string, username: string): { retryAfterMs: number } | { attempt: LoginAttempt } {
    this.purge();
    const keys = this.keys(ip, username);
    const retryAfterMs = Math.max(0, ...keys.map(([key]) => (this.counters.get(key)?.lockedUntil ?? 0) - this.now()));
    if (retryAfterMs > 0) return { retryAfterMs };
    for (const [key, max] of keys) this.bump(key, max);
    let settled = false;
    return {
      attempt: {
        succeed: () => {
          if (settled) return;
          settled = true;
          // Đúng mật khẩu thì xoá hẳn bộ đếm của cặp máy + tài khoản. Bộ đếm
          // theo máy chỉ hoàn lại một lượt: đăng nhập đúng một tài khoản của
          // mình không được xoá dấu vết đang dò tài khoản khác.
          this.counters.delete(keys[0][0]);
          // Nếu chính lượt đúng này vừa chạm ngưỡng thì cũng gỡ khoá theo.
          const [ipKey, ipMax] = keys[1];
          const ipCounter = this.counters.get(ipKey);
          if (ipCounter) {
            ipCounter.count = Math.max(0, ipCounter.count - 1);
            if (ipCounter.count < ipMax) ipCounter.lockedUntil = 0;
          }
        },
      },
    };
  }

  private keys(ip: string, username: string): Array<[string, number]> {
    const user = String(username || '').trim().toLowerCase();
    return [[`pair:${ip}|${user}`, this.options.maxPerPair], [`ip:${ip}`, this.options.maxPerIp]];
  }

  private bump(key: string, max: number): void {
    const now = this.now();
    let counter = this.counters.get(key);
    if (!counter || now - counter.firstAt > this.options.windowMs) {
      counter = { count: 0, firstAt: now, lockedUntil: 0 };
      this.counters.set(key, counter);
    }
    counter.count++;
    if (counter.count >= max) counter.lockedUntil = now + this.options.lockMs;
  }

  private purge(): void {
    const now = this.now();
    for (const [key, counter] of this.counters) {
      const expired = counter.lockedUntil ? counter.lockedUntil <= now : now - counter.firstAt > this.options.windowMs;
      if (expired) this.counters.delete(key);
    }
  }
}
