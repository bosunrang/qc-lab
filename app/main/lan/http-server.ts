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
  login(input: unknown): Promise<LoginResult<User>> | LoginResult<User>;
  /** Nhận diện công khai cho màn hình đăng nhập; không có cài đặt nội bộ. */
  getLoginBrand?(): Promise<unknown> | unknown;
  actorOf(user: User): Actor;
  currentUser(actor: Actor): User | null;
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

  private session(req: IncomingMessage) { return this.sessions.get(cookies(req).qclab_session); }
  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '/', 'https://lan.local');
      if (req.method === 'GET' && url.pathname === CA_DOWNLOAD_PATH) return sendCaCertificate(res, this.deps.tls.caCertificate());
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
        const served = await this.staticFile(url.pathname);
        if (served) { res.writeHead(200, { 'content-type': served.type, 'cache-control': served.html ? 'no-store' : 'public, max-age=3600', 'x-content-type-options': 'nosniff' }); res.end(served.content); return; }
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, data: { service: 'qc-lab-lan' } });
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
        const input = await body(req);
        const username = String((input as { data?: { username?: unknown } })?.data?.username ?? '');
        const gate = this.loginThrottle.begin(remoteAddress(req), username);
        if ('retryAfterMs' in gate) {
          const minutes = Math.ceil(gate.retryAfterMs / 60000);
          res.setHeader('retry-after', String(Math.ceil(gate.retryAfterMs / 1000)));
          return send(res, 429, { ok: false, error: { code: 'too-many-attempts', message: `Đăng nhập sai quá nhiều lần. Thử lại sau ${minutes} phút.` } });
        }
        const result = await this.deps.login(input);
        if (!result.ok) return send(res, 401, result);
        gate.attempt.succeed();
        const session = this.sessions.create(this.deps.actorOf(result.data));
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
        return send(res, 200, await this.deps.invoke(input.method, input.args, session.actor));
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


