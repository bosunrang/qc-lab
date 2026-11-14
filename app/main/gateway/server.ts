import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { randomUUID } from 'node:crypto';
import { TextDecoder } from 'node:util';
import type { GatewayStore, GatewayActor } from './store';
import { GatewayError, integer, object } from './validation';

interface GatewayServerOptions {
  store: GatewayStore; port?: number; host?: string; surface?: 'local' | 'ingress';
  tls?: { cert: string; key: string }; requestsPerMinute?: number;
  log?: (entry: { requestId: string; code: string }) => void;
}

const MAX_BODY = 64 * 1024;
async function readJson(req: IncomingMessage): Promise<unknown> {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new GatewayError(415, 'json-required', 'Chỉ nhận Content-Type application/json.');
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') throw new GatewayError(415, 'encoding-not-supported', 'Không nhận nội dung nén.');
  if (Number(req.headers['content-length']) > MAX_BODY) throw new GatewayError(413, 'body-too-large', 'Nội dung vượt quá 64 KiB.');
  const chunks = await new Promise<Buffer[]>((resolve, reject) => {
    const parts: Buffer[] = [];
    let size = 0;
    const cleanup = () => { req.off('data', onData); req.off('end', onEnd); req.off('error', onError); req.off('aborted', onAborted); };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onAborted = () => onError(new GatewayError(400, 'request-aborted', 'Yêu cầu đã bị ngắt.'));
    const onEnd = () => { cleanup(); resolve(parts); };
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        req.pause(); cleanup(); reject(new GatewayError(413, 'body-too-large', 'Nội dung vượt quá 64 KiB.'));
      } else parts.push(chunk);
    };
    req.on('data', onData); req.once('end', onEnd); req.once('error', onError); req.once('aborted', onAborted);
  });
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
  catch { throw new GatewayError(400, 'invalid-json', 'Nội dung JSON không hợp lệ.'); }
}

/** API cục bộ phục vụ QC Lab; cổng ingress qua HTTPS có thể bật riêng sau này. */
export async function startGateway(options: GatewayServerOptions) {
  const { store, port = 8787, host = '127.0.0.1', surface = 'local', tls, requestsPerMinute = 600 } = options;
  if (!store.initialized) throw new GatewayError(503, 'not-initialized', 'Chạy lệnh init trước khi mở Gateway.');
  if (surface === 'local' && host !== '127.0.0.1') throw new GatewayError(400, 'local-only', 'Cổng QC Lab/quản trị chỉ được nghe trên 127.0.0.1.');
  if (surface === 'ingress' && !tls) throw new GatewayError(400, 'tls-required', 'Cổng tiếp nhận từ mạng phải có chứng chỉ và khoá HTTPS.');
  if (!Number.isInteger(port) || port < 0 || port > 65535 || !Number.isInteger(requestsPerMinute) || requestsPerMinute < 1) throw new GatewayError(400, 'invalid-server-options', 'Cổng hoặc giới hạn yêu cầu không hợp lệ.');
  const rates = new Map<string, { resetAt: number; count: number }>();
  const send = (res: ServerResponse, status: number, body: unknown, requestId: string) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
      'x-content-type-options': 'nosniff', 'x-request-id': requestId, ...(status >= 400 ? { connection: 'close' } : {}), ...(status === 429 ? { 'retry-after': '60' } : {}) });
    res.end(JSON.stringify(body));
  };
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    const requestId = randomUUID();
    try {
      const now = Date.now();
      for (const [ip, rate] of rates) if (rate.resetAt <= now) rates.delete(ip);
      const ip = req.socket.remoteAddress || 'unknown';
      let rate = rates.get(ip);
      if (!rate) {
        if (rates.size >= 1024) throw new GatewayError(429, 'rate-limit', 'Gateway đang bận; thử lại sau.');
        rate = { resetAt: now + 60_000, count: 0 }; rates.set(ip, rate);
      }
      if (++rate.count > requestsPerMinute) throw new GatewayError(429, 'rate-limit', 'Vượt giới hạn yêu cầu; thử lại sau.');
      if (req.headers.origin) throw new GatewayError(403, 'browser-origin', 'API này dành cho QC Lab và bộ kết nối LIS, không nhận yêu cầu từ trang web.');
      const requestHost = req.headers.host || '';
      if (surface === 'local' && !/^(127\.0\.0\.1|localhost):\d+$/.test(requestHost)) throw new GatewayError(403, 'invalid-host', 'Host cục bộ không hợp lệ.');
      let actor: GatewayActor = store.authenticate(req.headers.authorization);
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (surface === 'ingress' && actor.role !== 'ingest') throw new GatewayError(403, 'ingress-only', 'Cổng mạng chỉ dành cho token nguồn LIS.');
      if (req.method === 'GET' && url.pathname === '/health') {
        return send(res, 200, { ok: true, mode: 'gateway', version: 1 }, requestId);
      }
      if (surface === 'ingress' && !(req.method === 'POST' && url.pathname === '/api/v1/qc-results')) throw new GatewayError(403, 'ingress-only', 'Cổng mạng chỉ nhận bản tin QC.');
      if (req.method === 'GET' && url.pathname === '/api/v1/qc-results') {
        const result = store.listQueue(actor, url.searchParams.get('status') || 'pending', integer(url.searchParams.get('limit') || '500', 'limit', 1, 500), url.searchParams.get('after') || '');
        return send(res, 200, result, requestId);
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/status') return send(res, 200, store.status(actor), requestId);
      if (req.method === 'GET' && url.pathname === '/api/v1/mappings') return send(res, 200, { items: store.listMappings(actor) }, requestId);
      if (req.method === 'GET' && url.pathname === '/api/v1/tokens') return send(res, 200, { items: store.listTokens(actor) }, requestId);
      if (req.method === 'GET' && url.pathname === '/api/v1/audit') {
        return send(res, 200, { items: store.audit(actor, integer(url.searchParams.get('after') || '0', 'after', 0, Number.MAX_SAFE_INTEGER), integer(url.searchParams.get('limit') || '100', 'limit', 1, 500)) }, requestId);
      }
      const allowedRole = url.pathname === '/api/v1/qc-results' && req.method === 'POST' ? ['ingest']
        : url.pathname === '/api/v1/qc-results/decide' && req.method === 'POST' ? ['app', 'admin']
          : (url.pathname === '/api/v1/mappings' && req.method === 'PUT') || (url.pathname === '/api/v1/tokens' && req.method === 'POST')
            || (/^\/api\/v1\/tokens\/[^/]+\/revoke$/.test(url.pathname) && req.method === 'POST') ? ['admin'] : null;
      if (!allowedRole) throw new GatewayError(404, 'not-found', 'Không có đường dẫn hoặc phương thức này.');
      if (!allowedRole.includes(actor.role)) throw new GatewayError(403, 'forbidden', 'Token không có quyền thực hiện thao tác này.');
      const body = await readJson(req);
      // Token có thể bị thu hồi trong lúc bên gửi đang tải nội dung lên.
      actor = store.authenticate(req.headers.authorization);
      if (req.method === 'POST' && url.pathname === '/api/v1/qc-results') {
        const result = store.ingest(actor, body);
        return send(res, result.duplicate ? 200 : 201, result, requestId);
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/qc-results/decide') {
        store.decide(actor, body); return send(res, 200, { ok: true }, requestId);
      }
      if (req.method === 'PUT' && url.pathname === '/api/v1/mappings') {
        store.saveMappings(actor, body); return send(res, 200, { ok: true }, requestId);
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/tokens') return send(res, 201, store.createToken(actor, body), requestId);
      const revoke = /^\/api\/v1\/tokens\/([^/]+)\/revoke$/.exec(url.pathname);
      if (revoke) { object(body, []); store.revokeToken(actor, revoke[1]); return send(res, 200, { ok: true }, requestId); }
      throw new GatewayError(404, 'not-found', 'Không có đường dẫn này.');
    } catch (error) {
      const known = error instanceof GatewayError;
      try { options.log?.({ requestId, code: known ? error.code : 'internal-error' }); } catch { /* lỗi ghi log không được làm hỏng phản hồi HTTP */ }
      if (!res.headersSent && !res.destroyed) send(res, known ? error.status : 500,
        { code: known ? error.code : 'internal-error', message: known ? error.message : 'Không xử lý được yêu cầu. Tra nhật ký bằng requestId.', requestId }, requestId);
    }
  };
  const server: Server = tls ? createHttpsServer(tls, (req, res) => { void handler(req, res); }) : createServer((req, res) => { void handler(req, res); });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.maxHeadersCount = 64;
  server.keepAliveTimeout = 2_000;
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once('error', onError);
    server.listen(port, host, () => { server.removeListener('error', onError); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Không xác định được cổng Gateway.');
  let closing: Promise<void> | undefined;
  return { server, url: `${tls ? 'https' : 'http'}://${host}:${address.port}`,
    close: () => closing ??= new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeIdleConnections();
      // Không giữ tiến trình mãi vì một kết nối tải chậm lúc quản trị viên dừng dịch vụ.
      const timer = setTimeout(() => server.closeAllConnections(), 10_000);
      timer.unref();
      server.once('close', () => clearTimeout(timer));
    }) };
}
