import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

/** Mỗi phiên dùng mã mới để không trùng dấu vết bản tin của phiên trước. */
export function createSampleRecords(testId, { lot1 = 'LIS-DEMO-L1', lot2 = 'LIS-DEMO-L2' } = {}) {
  const session = randomUUID();
  const measuredAt = new Date().toISOString();
  const make = (suffix, level, value, lot) => {
    const id = `${session}-${suffix}`;
    return { id, receivedAt: measuredAt, status: 'pending',
      message: { messageId: id, analyzerId: 'MAY-LIS-DEMO', testCode: 'GLU', qcLevel: String(level),
        qcLotCode: lot, value, unit: 'mmol/L', measuredAt, runId: id, operator: 'LIS giả lập' },
      resolved: { ok: true, code: 'RESOLVED', qclabTestId: testId, level, lot, displayName: 'Glucose LIS Demo' } };
  };
  const good1 = make('hop-le-L1', 1, 5.1, lot1);
  const good2 = make('hop-le-L2', 2, 15.2, lot2);
  const discard = make('thu-bo-L1', 1, 4.9, lot1);
  const badUnit = make('sai-don-vi', 1, 90, lot1);
  badUnit.message.unit = 'mg/dL';
  const badLot = make('sai-lo', 1, 5, 'LO-KHONG-KHOP');
  const unknown = make('chua-anh-xa', 1, 5, lot1);
  unknown.message.testCode = 'UNKNOWN';
  unknown.resolved = { ok: false, code: 'UNMAPPED_TEST', reason: 'Dữ liệu mẫu: mã UNKNOWN chưa được ánh xạ xét nghiệm.' };
  return [good1, good2, discard, badUnit, badLot, unknown];
}

/** Gateway giả lập chỉ giữ hàng chờ trong bộ nhớ và chỉ nghe trên loopback. */
export async function startMockGateway({ records, port = 8787, token = randomBytes(24).toString('hex'), failAckOnce = false }) {
  const queue = structuredClone(records);
  let failNextAck = failAckOnce;
  const send = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const server = createServer(async (req, res) => {
    try {
      if (req.headers.authorization !== `Bearer ${token}`) return send(res, 401, { message: 'Token Gateway sai hoặc chưa nhập.' });
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, mode: 'mock' });
      if (req.method === 'GET' && url.pathname === '/api/v1/qc-results') {
        const status = url.searchParams.get('status') || 'pending';
        const limit = Number(url.searchParams.get('limit') || 500);
        if (!['pending', 'imported', 'rejected'].includes(status) || !Number.isInteger(limit) || limit < 1 || limit > 500) {
          return send(res, 400, { message: 'Trạng thái hoặc giới hạn hàng chờ không hợp lệ.' });
        }
        return send(res, 200, { items: queue.filter((record) => record.status === status).slice(0, limit) });
      }
      if (req.method === 'POST' && url.pathname === '/api/v1/qc-results/decide') {
        let body = '';
        for await (const chunk of req) {
          body += chunk.toString('utf8');
          if (Buffer.byteLength(body) > 16_384) return send(res, 413, { message: 'Bản tin quá lớn.' });
        }
        let decision;
        try { decision = JSON.parse(body); } catch { return send(res, 400, { message: 'Nội dung JSON không hợp lệ.' }); }
        if (!decision || typeof decision.messageId !== 'string' || !['imported', 'rejected'].includes(decision.status)
          || typeof decision.by !== 'string' || !decision.by.trim()
          || (decision.note !== undefined && typeof decision.note !== 'string')) {
          return send(res, 400, { message: 'Quyết định nhận/bỏ không hợp lệ.' });
        }
        const record = queue.find((item) => item.message.messageId === decision.messageId);
        if (!record) return send(res, 404, { message: 'Không tìm thấy bản tin.' });
        if (record.status !== 'pending' && record.status !== decision.status) return send(res, 409, { message: 'Bản tin đã được quyết định trước đó.' });
        if (failNextAck && decision.status === 'imported') {
          failNextAck = false;
          return send(res, 503, { message: 'Lỗi xác nhận giả lập một lần. Bấm Làm mới để thử lại.' });
        }
        record.status = decision.status;
        record.decision = { ...decision, decidedAt: new Date().toISOString() };
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { message: 'Không có đường dẫn này trong Gateway giả lập.' });
    } catch {
      if (!res.headersSent) send(res, 500, { message: 'Gateway giả lập không xử lý được yêu cầu.' });
      else res.end();
    }
  });
  server.requestTimeout = 10_000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  let closing;
  return { server, token, url: `http://127.0.0.1:${server.address().port}`,
    close: () => closing ??= new Promise((resolve, reject) => { server.close((error) => error ? reject(error) : resolve()); server.closeIdleConnections(); }) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argument = (name) => process.argv[process.argv.indexOf(name) + 1];
  if (!process.argv.includes('--test-id') || !argument('--test-id') || argument('--test-id').startsWith('--')) {
    console.error('Dùng: npm.cmd run lis:mock -- --test-id <ID-xét-nghiệm> [--fail-ack-once]');
    console.error('Để tự tạo danh mục mẫu và mở Electron, chạy: npm.cmd run lis:demo');
    process.exitCode = 1;
  } else {
    try {
      const records = createSampleRecords(argument('--test-id'));
      const gateway = await startMockGateway({ records, failAckOnce: process.argv.includes('--fail-ack-once') });
      console.log(`Gateway GIẢ LẬP: ${gateway.url}\nBearer token: ${gateway.token}\n6 bản tin mẫu; lô LIS-DEMO-L1/LIS-DEMO-L2, đơn vị mmol/L.\nCtrl+C để dừng.`);
      process.once('SIGINT', () => { void gateway.close(); });
      process.once('SIGTERM', () => { void gateway.close(); });
    } catch (error) { console.error(`Không mở được Gateway: ${error.message}`); process.exitCode = 1; }
  }
}
