import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { normalizeGatewayUrl, resultToPointInput } = require('../../app-dist/main/domain/lis-client.js');

// 1) Allowlist origin — chỉ 2 origin cố định của gateway
assert.equal(normalizeGatewayUrl('http://127.0.0.1:8787'), 'http://127.0.0.1:8787');
assert.equal(normalizeGatewayUrl('http://localhost:8787/api/v1/status'), 'http://localhost:8787', 'giu path phai bi bo, chi lay origin');
assert.equal(normalizeGatewayUrl('https://example.com'), '');
assert.equal(normalizeGatewayUrl('http://127.0.0.1:9999'), '', 'sai port cung phai bi tu choi');
assert.equal(normalizeGatewayUrl('khong-phai-url'), '');
assert.equal(normalizeGatewayUrl(''), '');

function localYmd(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const record = {
  message: { messageId: 'm1', analyzerId: 'AU480', testCode: 'GLU', qcLevel: '1', value: 101, measuredAt: '2026-08-01T23:05:00Z', runId: 'r1', operator: 'ktv1' },
  resolved: { ok: true, code: 'RESOLVED', qclabTestId: 't1', level: 1, lot: 'L1', displayName: 'Glucose' },
};
const input = resultToPointInput(record);
assert.equal(input.date, localYmd('2026-08-01T23:05:00Z'), 'phai dung getter gio dia phuong, khong cat UTC');
assert.equal(input.testId, 't1');
assert.equal(input.level, 1);
assert.equal(input.val, 101);
assert.equal(input.runId, 'r1');
assert.equal(input.operatorName, 'ktv1');

assert.equal(resultToPointInput({ message: { measuredAt: 'khong-phai-ngay' }, resolved: { ok: true, qclabTestId: 't1', level: 1 } }), null);

assert.equal(resultToPointInput({ message: { measuredAt: '2026-08-01T00:00:00Z' }, resolved: { ok: false, code: 'UNMAPPED_TEST', reason: 'chua mapping' } }), null);

console.log('app lis-client oracle tests passed');


