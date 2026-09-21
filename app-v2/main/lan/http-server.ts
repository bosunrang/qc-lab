import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import type { Actor, IpcResult } from '../ipc/shared';
import { LanSessionStore } from './session-store';

type LoginResult<T> = IpcResult<T>;
export interface LanServerDeps<User> {
  login(input: unknown): Promise<LoginResult<User>> | LoginResult<User>;
  actorOf(user: User): Actor;
  currentUser(actor: Actor): User | null;
  invoke(method: string, args: unknown[], actor: Actor): Promise<unknown>;
  staticDir?: string;
}

const JSON_LIMIT = 1024 * 1024;
function cookies(req: IncomingMessage): Record<string, string> {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((part) => part.trim().split('=', 2)).filter(([key]) => key));
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

/** HTTP same-origin cho web client nội bộ. Không mở SQL hay handler tự do:
 * mọi call phải đi qua invoke() của main process với Actor lấy từ session. */
export class LanHttpServer<User> {
  private server: Server | null = null;
  private readonly eventClients = new Set<ServerResponse>();
  readonly sessions = new LanSessionStore();
  constructor(private readonly deps: LanServerDeps<User>) {}

  async start(port = 3100, host = '0.0.0.0'): Promise<number> {
    if (this.server) throw new Error('Máy chủ LAN đang chạy.');
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve, reject) => { this.server!.once('error', reject); this.server!.listen(port, host, () => resolve()); });
    const address = this.server.address();
    return typeof address === 'object' && address ? address.port : port;
  }
  async stop(): Promise<void> { if (!this.server) return; const server = this.server; this.server = null; await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  publishChanged(payload: { tables: string[]; testIds: string[] }): void { for (const client of this.eventClients) client.write(`event: store-changed\ndata: ${JSON.stringify(payload)}\n\n`); }

  private session(req: IncomingMessage) { return this.sessions.get(cookies(req).qclab_session); }
  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '/', 'http://lan.local');
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
        const served = await this.staticFile(url.pathname);
        if (served) { res.writeHead(200, { 'content-type': served.type, 'cache-control': served.html ? 'no-store' : 'public, max-age=3600', 'x-content-type-options': 'nosniff' }); res.end(served.content); return; }
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, data: { service: 'qc-lab-lan' } });
      if (req.method === 'GET' && url.pathname === '/api/events') {
        if (!this.session(req)) return send(res, 401, { ok: false, error: { code: 'unauthenticated', message: 'Cần đăng nhập.' } });
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
        res.write(': connected\n\n'); this.eventClients.add(res); req.once('close', () => this.eventClients.delete(res)); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/login') {
        const result = await this.deps.login(await body(req));
        if (!result.ok) return send(res, 401, result);
        const session = this.sessions.create(this.deps.actorOf(result.data));
        res.setHeader('set-cookie', `qclab_session=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`);
        return send(res, 200, { ok: true, data: result.data });
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/logout') { const token = cookies(req).qclab_session; this.sessions.revoke(token); res.setHeader('set-cookie', 'qclab_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'); return send(res, 200, { ok: true, data: null }); }
      const session = this.session(req);
      if (!session) return send(res, 401, { ok: false, error: { code: 'unauthenticated', message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' } });
      if (req.method === 'GET' && url.pathname === '/api/session') return send(res, 200, { ok: true, data: this.deps.currentUser(session.actor) });
      if (req.method === 'POST' && url.pathname === '/api/rpc') {
        const input = await body(req) as { method?: unknown; args?: unknown };
        if (typeof input.method !== 'string' || !Array.isArray(input.args)) return send(res, 400, { ok: false, error: { code: 'invalid-request', message: 'Yêu cầu RPC không hợp lệ.' } });
        return send(res, 200, await this.deps.invoke(input.method, input.args, session.actor));
      }
      return send(res, 404, { ok: false, error: { code: 'not-found', message: 'Không tìm thấy API.' } });
    } catch (error) { return send(res, 400, { ok: false, error: { code: 'bad-request', message: error instanceof Error ? error.message : 'Yêu cầu không hợp lệ.' } }); }
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
