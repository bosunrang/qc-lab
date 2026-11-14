import { createServer as createPlainServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createServer as createSecureServer, type Server as SecureServer } from 'node:https';
import { createServer as createTcpServer, type Server as TcpServer, type Socket } from 'node:net';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import type { Actor, IpcResult } from '../ipc/shared';
import { LanSessionStore } from './session-store';
import { describeError, logEvent } from '../logging/log-sink';
import { DEFAULT_LOGIN_THROTTLE, LoginThrottle, type LoginThrottleOptions } from './login-throttle';
import { CA_DOWNLOAD_PATH, PLAIN_HTTP_PAGE } from './plain-http-page';

type LoginResult<T> = IpcResult<T>;
/** Chứng chỉ của máy chủ LAN — xem `tls-store.ts`. */
export interface LanTlsSource {
  /** Chứng chỉ máy chủ đang dùng (PEM); đọc lại mỗi lần `reloadTls()`. */
  credentials(): { cert: string; key: string };
  /** Chứng chỉ gốc (DER) cho máy nhân viên tải về và cài. */
  caCertificate(): Buffer;
}
export interface LanServerDeps<User> {
  /** `clientId` = `lan:<ip>` của máy trạm, để nhật ký đăng nhập (kể cả lần
   * sai) ghi đúng máy đã thử. */
  login(input: unknown, clientId: string): Promise<LoginResult<User>> | LoginResult<User>;
  /** Nhận diện công khai cho màn hình đăng nhập; không có cài đặt nội bộ. */
  getLoginBrand?(): Promise<unknown> | unknown;
  getLicenseStatus?(): unknown;
  licenseAllowed?(): boolean;
  actorOf(user: User, clientId: string): Actor;
  currentUser(actor: Actor): User | null;
  /** Kiểm lại phiên ở mỗi yêu cầu (GV5, xem `ipc/access-gate.ts`). Không khai
   * thì phiên giữ nguyên actor lúc đăng nhập — chỉ dùng trong test. */
  sessionCheck?: {
    /** Dấu vân tay mật khẩu hiện hành của tài khoản, chụp lúc đăng nhập. */
    stampOf(userId: string): string | null;
    /** Actor mới nhất, hoặc `null` khi tài khoản không còn, đã khoá hay đổi mật khẩu. */
    recheck(actor: Actor, stamp: string | undefined): Actor | null;
  };
  /** Trả `{ ok:false, error:{ code:'unauthenticated' } }` khi cổng quyền thấy
   * tài khoản không còn dùng được; máy chủ đổi thành 401 và thu hồi phiên. */
  invoke(method: string, args: unknown[], actor: Actor): Promise<unknown>;
  staticDir?: string;
  tls: LanTlsSource;
}

const JSON_LIMIT = 1024 * 1024;
/** Kết nối mở mà không gửi byte nào thì đóng, không giữ socket treo mãi. */
const FIRST_BYTE_TIMEOUT_MS = 10_000;
/** Byte đầu của bản ghi TLS "handshake" (ClientHello). */
const TLS_HANDSHAKE = 0x16;
const TLS_OPTIONS = { minVersion: 'TLSv1.2' } as const;
function cookies(req: IncomingMessage): Record<string, string> {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((part) => part.trim().split('=', 2)).filter(([key]) => key));
}
/** Địa chỉ máy trạm để đếm lượt đăng nhập. Khi nghe dual-stack (`::`), cùng
 * một máy IPv4 hiện dạng `::ffff:192.168.1.5`; gộp về một khoá. */
function remoteAddress(req: IncomingMessage): string {
  return String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}
async function body(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let bytes = 0;
  for await (const chunk of req) { const data = Buffer.from(chunk); bytes += data.length; if (bytes > JSON_LIMIT) throw new Error('Nội dung yêu cầu quá lớn.'); chunks.push(data); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('JSON không hợp lệ.'); }
}
function send(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function sendCaCertificate(res: ServerResponse, der: Buffer): void {
  res.writeHead(200, { 'content-type': 'application/x-x509-ca-cert', 'content-disposition': 'attachment; filename="QC-Lab-CA.crt"', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(der);
}

/** HTTPS same-origin cho web client nội bộ. Không mở SQL hay handler tự do:
 * mọi call phải đi qua invoke() của main process với Actor lấy từ session.
 *
 * Một cổng nhận cả hai giao thức: byte đầu là bản ghi TLS thì chuyển cho máy
 * chủ HTTPS, còn lại cho máy chủ HTTP thường — nơi CHỈ có trang hướng dẫn và
 * tệp chứng chỉ gốc, không đăng nhập, không API. Nhờ vậy địa chỉ `http://` cũ
 * của máy nhân viên dẫn tới hướng dẫn thay vì báo lỗi kết nối. */
export class LanHttpServer<User> {
  private listener: TcpServer | null = null;
  private secure: SecureServer | null = null;
  private plain: Server | null = null;
  private readonly sockets = new Set<Socket>();
  private readonly eventClients = new Set<ServerResponse>();
  readonly sessions = new LanSessionStore();
  readonly loginThrottle: LoginThrottle;
  constructor(private readonly deps: LanServerDeps<User>, throttle: LoginThrottleOptions = DEFAULT_LOGIN_THROTTLE) {
    this.loginThrottle = new LoginThrottle(throttle);
  }

  async start(port = 3200, host = '0.0.0.0'): Promise<number> {
    if (this.listener) throw new Error('Máy chủ LAN đang chạy.');
    const secure = createSecureServer({ ...this.deps.tls.credentials(), ...TLS_OPTIONS }, (req, res) => void this.handle(req, res));
    const plain = createPlainServer((req, res) => this.handlePlain(req, res));
    const listener = createTcpServer((socket) => this.route(socket));
    this.listener = listener; this.secure = secure; this.plain = plain;
    try {
      await new Promise<void>((resolve, reject) => { listener.once('error', reject); listener.listen(port, host, () => resolve()); });
    } catch (error) {
      this.listener = null; this.secure = null; this.plain = null;
      listener.close();
      throw error;
    }
    const address = listener.address();
    return typeof address === 'object' && address ? address.port : port;
  }
  async stop(): Promise<void> {
    if (!this.listener) return;
    const listener = this.listener;
    // Luồng sự kiện (SSE) và kết nối keep-alive không tự đóng; `close()` của
    // cổng chờ tới khi hết kết nối, nên đóng hẳn các socket thô.
    for (const socket of this.sockets) socket.destroy();
    this.sockets.clear();
    this.eventClients.clear();
    this.listener = null; this.secure = null; this.plain = null;
    await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  }
  /** Nạp chứng chỉ máy chủ mới (vd khi IP đổi); kết nối đang mở giữ chứng chỉ cũ. */
  reloadTls(): void { this.secure?.setSecureContext({ ...this.deps.tls.credentials(), ...TLS_OPTIONS }); }
  publishChanged(payload: { tables: string[]; testIds: string[] }): void { for (const client of this.eventClients) client.write(`event: store-changed\ndata: ${JSON.stringify(payload)}\n\n`); }

  /** Xem byte đầu rồi trả nguyên socket (kèm byte đó) cho đúng máy chủ. Máy
   * chủ TLS và HTTP của Node đều đọc tiếp phần dữ liệu đã `unshift()`. */
  private route(socket: Socket): void {
    const secure = this.secure; const plain = this.plain;
    if (!secure || !plain) { socket.destroy(); return; }
    const drop = () => socket.destroy();
    this.sockets.add(socket);
    socket.once('close', () => this.sockets.delete(socket));
    socket.on('error', drop);
    socket.setTimeout(FIRST_BYTE_TIMEOUT_MS, drop);
    socket.once('data', (chunk: Buffer) => {
      socket.setTimeout(0);
      socket.removeListener('timeout', drop);
      socket.pause();
      socket.unshift(chunk);
      (chunk[0] === TLS_HANDSHAKE ? secure : plain).emit('connection', socket);
      process.nextTick(() => socket.resume());
    });
  }

  /** HTTP thường: không đọc thân yêu cầu, không đăng nhập, không API. */
  private handlePlain(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url || '/', 'http://lan.local');
    if (req.method === 'GET' && url.pathname === CA_DOWNLOAD_PATH) return sendCaCertificate(res, this.deps.tls.caCertificate());
    if (url.pathname.startsWith('/api/')) return send(res, 403, { ok: false, error: { code: 'https-required', message: 'Máy chủ QC Lab chỉ nhận kết nối bảo mật. Mở lại địa chỉ bằng https://.' } });
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(PLAIN_HTTP_PAGE);
  }

  /** Phiên của yêu cầu sau khi đối chiếu lại với CSDL. Tài khoản đã khoá, bị
   * xoá hoặc đổi mật khẩu (kể cả do phục hồi bản sao lưu) thì thu hồi phiên
   * ngay; còn lại cập nhật vai trò mới nhất vào phiên. */
  private session(req: IncomingMessage) {
    const token = cookies(req).qclab_session;
    const session = this.sessions.get(token);
    if (!session || !this.deps.sessionCheck) return session;
    const actor = this.deps.sessionCheck.recheck(session.actor, session.stamp);
    if (!actor) { this.sessions.revoke(token); return null; }
    session.actor = actor;
    return session;
  }
  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '/', 'https://lan.local');
      if (req.method === 'GET' && url.pathname === CA_DOWNLOAD_PATH) return sendCaCertificate(res, this.deps.tls.caCertificate());
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
        const served = await this.staticFile(url.pathname);
        if (served) { res.writeHead(200, { 'content-type': served.type, 'cache-control': served.html ? 'no-store' : 'public, max-age=3600', 'x-content-type-options': 'nosniff' }); res.end(served.content); return; }
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, data: { service: 'qc-lab-lan' } });
      if (req.method === 'GET' && url.pathname === '/api/license') return send(res, 200, this.deps.getLicenseStatus?.() ?? null);
      if (req.method === 'GET' && url.pathname === '/api/brand') {
        if (!this.deps.getLoginBrand) return send(res, 404, { ok: false, error: { code: 'not-found', message: 'Chưa có thông tin thương hiệu.' } });
        return send(res, 200, await this.deps.getLoginBrand());
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        if (!this.session(req)) return send(res, 401, { ok: false, error: { code: 'unauthenticated', message: 'Cần đăng nhập.' } });
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
        res.write(': connected\n\n'); this.eventClients.add(res); req.once('close', () => this.eventClients.delete(res)); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/login') {
        if (this.deps.licenseAllowed && !this.deps.licenseAllowed()) return send(res, 403, { ok: false, error: { code: 'activation-required', message: 'Máy chủ QC Lab chưa được kích hoạt.' } });
        const input = await body(req);
        const username = String((input as { data?: { username?: unknown } })?.data?.username ?? '');
        const gate = this.loginThrottle.begin(remoteAddress(req), username);
        if ('retryAfterMs' in gate) {
          const minutes = Math.ceil(gate.retryAfterMs / 60000);
          res.setHeader('retry-after', String(Math.ceil(gate.retryAfterMs / 1000)));
          return send(res, 429, { ok: false, error: { code: 'too-many-attempts', message: `Đăng nhập sai quá nhiều lần. Thử lại sau ${minutes} phút.` } });
        }
        const clientId = `lan:${remoteAddress(req)}`;
        const result = await this.deps.login(input, clientId);
        if (!result.ok) return send(res, 401, result);
        gate.attempt.succeed();
        const actor = this.deps.actorOf(result.data, clientId);
        const session = this.sessions.create(actor, this.deps.sessionCheck?.stampOf(actor.userId) ?? undefined);
        res.setHeader('set-cookie', `qclab_session=${session.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
        return send(res, 200, { ok: true, data: result.data });
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/logout') { const token = cookies(req).qclab_session; this.sessions.revoke(token); res.setHeader('set-cookie', 'qclab_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'); return send(res, 200, { ok: true, data: null }); }
      const session = this.session(req);
      if (!session) return send(res, 401, { ok: false, error: { code: 'unauthenticated', message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' } });
      if (req.method === 'GET' && url.pathname === '/api/session') return send(res, 200, { ok: true, data: this.deps.currentUser(session.actor) });
      if (req.method === 'POST' && url.pathname === '/api/rpc') {
        const input = await body(req) as { method?: unknown; args?: unknown };
        if (typeof input.method !== 'string' || !Array.isArray(input.args)) return send(res, 400, { ok: false, error: { code: 'invalid-request', message: 'Yêu cầu RPC không hợp lệ.' } });
        const result = await this.deps.invoke(input.method, input.args, session.actor) as { ok?: unknown; error?: { code?: unknown } } | null;
        // Cổng quyền thấy tài khoản không còn dùng được: thu hồi phiên và trả
        // 401 để máy trạm quay về màn đăng nhập.
        if (result?.ok === false && result.error?.code === 'unauthenticated') {
          this.sessions.revoke(session.token);
          return send(res, 401, result);
        }
        // Tự đổi mật khẩu đổi luôn dấu vân tay: giữ phiên đang dùng, mọi phiên
        // khác của tài khoản này hết hiệu lực ở yêu cầu kế tiếp.
        if (input.method === 'changeOwnPassword' && result?.ok === true && this.deps.sessionCheck) {
          session.stamp = this.deps.sessionCheck.stampOf(session.actor.userId) ?? undefined;
        }
        return send(res, 200, result);
      }
      return send(res, 404, { ok: false, error: { code: 'not-found', message: 'Không tìm thấy API.' } });
    } catch (error) {
      // Yêu cầu hỏng từ máy trạm (JSON sai, thân quá lớn…) hoặc lỗi của chính
      // máy chủ: ghi lại để lần được sự cố mạng nội bộ; không ghi nội dung yêu cầu.
      logEvent({ level: 'warn', source: 'lan', message: `${req.method || '?'} ${(req.url || '').split('?')[0]}: ${describeError(error).message}` });
      return send(res, 400, { ok: false, error: { code: 'bad-request', message: error instanceof Error ? error.message : 'Yêu cầu không hợp lệ.' } });
    }
  }

  private async staticFile(pathname: string): Promise<{ content: Buffer; type: string; html: boolean } | null> {
    if (!this.deps.staticDir) return null;
    const root = resolve(this.deps.staticDir);
    const decoded = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const candidate = resolve(join(root, normalize(decoded).replace(/^[/\\]+/, '')));
    if (!candidate.startsWith(`${root}${process.platform === 'win32' ? '\\' : '/'}`) && candidate !== root) return null;
    try {
      const content = await readFile(candidate);
      const extension = extname(candidate).toLowerCase();
      const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
      return { content, type: types[extension] || 'application/octet-stream', html: extension === '.html' };
    } catch { return null; }
  }
}


