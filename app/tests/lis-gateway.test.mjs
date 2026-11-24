import assert from 'node:assert/strict';
import test from 'node:test';
import { createSampleRecords, startMockGateway } from '../scripts/lis-gateway.mjs';

test('Gateway giả lập: xác thực HTTP, quyết định nhận/bỏ và giữ nguyên quyết định đã chốt', async () => {
  const records = createSampleRecords('demo-test');
  const gateway = await startMockGateway({ records, port: 0 });
  const request = (route, body) => fetch(gateway.url + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${gateway.token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const decide = (index, status) => request('/api/v1/qc-results/decide', { messageId: records[index].message.messageId, status, by: 'Quản trị demo' });
  try {
    assert.equal(gateway.server.address().address, '127.0.0.1');
    assert.equal((await fetch(gateway.url + '/health')).status, 401);
    assert.equal((await request('/health')).status, 200);
    const initial = await (await request('/api/v1/qc-results?status=pending&limit=500')).json();
    assert.equal(initial.items.length, 6);
    assert.equal((await decide(0, 'imported')).status, 200);
    assert.equal((await decide(0, 'imported')).status, 200);
    assert.equal((await decide(0, 'rejected')).status, 409);
    assert.equal((await decide(2, 'rejected')).status, 200);
    const remaining = await (await request('/api/v1/qc-results?status=pending')).json();
    assert.equal(remaining.items.length, 4);
    assert.equal((await request('/api/v1/qc-results?limit=oops')).status, 400);
    assert.equal((await request('/api/v1/qc-results/decide', null)).status, 400);
    assert.equal((await request('/api/v1/qc-results/decide', { messageId: 'missing', status: 'imported', by: 'Demo' })).status, 404);
    const malformed = await fetch(gateway.url + '/api/v1/qc-results/decide', {
      method: 'POST', headers: { authorization: `Bearer ${gateway.token}` }, body: '{',
    });
    assert.equal(malformed.status, 400);
    assert.equal(records[0].status, 'pending', 'Gateway không sửa bộ dữ liệu đầu vào');
  } finally { await gateway.close(); }
});

test('Gateway giả lập: lỗi xác nhận một lần giữ bản tin để thử lại, phiên mới dùng mã mới', async () => {
  const records = createSampleRecords('demo-test');
  const gateway = await startMockGateway({ records, port: 0, failAckOnce: true });
  const headers = { authorization: `Bearer ${gateway.token}`, 'content-type': 'application/json' };
  const decide = () => fetch(gateway.url + '/api/v1/qc-results/decide', { method: 'POST', headers,
    body: JSON.stringify({ messageId: records[0].message.messageId, status: 'imported', by: 'Demo' }) });
  try {
    assert.equal((await decide()).status, 503);
    const pending = await (await fetch(gateway.url + '/api/v1/qc-results?status=pending', { headers })).json();
    assert.equal(pending.items.length, 6);
    assert.equal((await decide()).status, 200);
    const ids = new Set(records.map((record) => record.message.messageId));
    assert.equal(ids.size, 6);
    assert.ok(createSampleRecords('demo-test').every((record) => !ids.has(record.message.messageId)));
  } finally { await gateway.close(); }
});
