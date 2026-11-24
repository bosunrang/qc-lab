import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { request as httpRequest } from 'node:http';
import { trustedTestTls } from './helpers/lan-tls.mjs';

const require = createRequire(import.meta.url);
const { GatewayStore, LOCAL_ADMIN } = require('../../app-dist/main/gateway/store.js');
const { startGateway } = require('../../app-dist/main/gateway/server.js');
const sample = (patch = {}) => ({ messageId: 'QC-001', analyzerId: 'MAY01', testCode: 'GLU', qcLevel: 'L1',
  qcLotCode: 'LOT01', value: 5.1, unit: 'mmol/L', measuredAt: '2026-11-14T08:00:00+07:00', runId: 'RUN01', ...patch });
const mapping = (patch = {}) => ({ sourceId: 'LIS01', analyzerId: 'MAY01', testCode: 'GLU', qcLevel: 'L1',
  qcLotCode: 'LOT01', qclabTestId: 'test-glucose', level: 1, lot: 'LOT01', unit: 'mmol/L', displayName: 'Glucose', ...patch });
function setup(filePath = ':memory:') {
  const store = new GatewayStore(filePath);
  const tokens = store.initialize();
  const source = store.createToken(LOCAL_ADMIN, { role: 'ingest', sourceId: 'LIS01', label: 'LIS chính' });
  const actor = (token) => store.authenticate(`Bearer ${token}`);
  return { store, tokens, source, ingest: actor(source.token), app: actor(tokens.app.token), admin: actor(tokens.admin.token) };
}
const isCode = (code) => (error) => error.code === code;

test('Gateway: nguồn được xác thực, token chỉ lưu hash, thu hồi có hiệu lực ngay và không mất quản trị cuối', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'qclab-gateway-'));
  const file = path.join(dir, 'gateway.sqlite');
  const { store, tokens, source, ingest, app, admin } = setup(file);
  try {
    assert.throws(() => store.authenticate('Bearer wrong'), isCode('unauthorized'));
    assert.throws(() => store.ingest(app, sample()), isCode('forbidden'));
    assert.throws(() => store.saveMappings(ingest, [mapping()]), isCode('forbidden'));
    assert.throws(() => store.listQueue(ingest, 'pending', 10), isCode('forbidden'));
    assert.throws(() => store.listTokens(app), isCode('forbidden'));
    assert.throws(() => store.revokeToken(admin, tokens.admin.id), isCode('last-admin'));
    assert.throws(() => store.initialize(), isCode('already-initialized'));
    store.revokeToken(admin, source.id);
    assert.throws(() => store.authenticate(`Bearer ${source.token}`), isCode('unauthorized'));
    const replacement = store.createToken(admin, { role: 'admin', label: 'Quản trị mới' });
    store.revokeToken(admin, tokens.admin.id);
    assert.equal(store.authenticate(`Bearer ${replacement.token}`).role, 'admin');
    const metadata = JSON.stringify(store.listTokens(LOCAL_ADMIN)) + JSON.stringify(store.audit(LOCAL_ADMIN, 0, 500));
    assert.ok(!metadata.includes(source.token) && !metadata.includes(tokens.app.token));
  } finally { store.close(); }
  const bytes = readFileSync(file);
  assert.equal(bytes.includes(Buffer.from(tokens.admin.token)), false);
  assert.equal(bytes.includes(Buffer.from(source.token)), false);
});

test('Gateway: giữ bản tin/ánh xạ/quyết định sau khởi động lại và không nhận trùng theo từng nguồn', () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'qclab-gateway-')), 'gateway.sqlite');
  let { store, tokens, ingest, app } = setup(file);
  store.saveMappings(LOCAL_ADMIN, [mapping()]);
  const first = store.ingest(ingest, sample());
  assert.equal(first.duplicate, false);
  assert.equal(store.ingest(ingest, sample()).messageId, first.messageId);
  assert.throws(() => store.ingest(ingest, sample({ value: 7 })), isCode('message-conflict'));
  const otherSource = store.createToken(LOCAL_ADMIN, { role: 'ingest', sourceId: 'LIS02', label: 'LIS khác' });
  const other = store.ingest(store.authenticate(`Bearer ${otherSource.token}`), sample());
  assert.notEqual(first.messageId, other.messageId);
  const firstRecord = store.listQueue(app, 'pending', 500).items.find((r) => r.id === first.messageId);
  assert.equal(firstRecord.resolved.qclabTestId, 'test-glucose');
  assert.equal(firstRecord.message.measuredAt, '2026-11-14T01:00:00.000Z');
  store.decide(app, { messageId: first.messageId, status: 'imported', by: 'KTV Một' });
  store.close();
  store = new GatewayStore(file);
  try {
    app = store.authenticate(`Bearer ${tokens.app.token}`);
    assert.equal(store.listQueue(app, 'imported', 10).items[0].id, first.messageId);
    store.decide(app, { messageId: first.messageId, status: 'imported', by: 'KTV Hai' });
    assert.throws(() => store.decide(app, { messageId: first.messageId, status: 'rejected', by: 'KTV Hai' }), isCode('decision-conflict'));
    store.saveMappings(LOCAL_ADMIN, [mapping({ qclabTestId: 'test-new', lot: 'NEW' })]);
    assert.equal(store.listQueue(app, 'imported', 10).items[0].resolved.lot, 'LOT01', 'quyết định giữ ảnh chụp ánh xạ');
    const audit = store.audit(LOCAL_ADMIN, 0, 500);
    assert.equal(audit.filter((r) => r.action === 'receive-qc').length, 2);
    assert.equal(audit.filter((r) => r.action === 'decide-qc').length, 1);
  } finally { store.close(); }
});

test('Gateway: kiểm dữ liệu thuần, thời gian có múi giờ và không nhận trường ngoài hợp đồng QC', () => {
  const { store, ingest } = setup();
  try {
    for (const value of ['', null, true, NaN, Infinity, '5.1']) assert.throws(() => store.ingest(ingest, sample({ value })), isCode('invalid-value'));
    for (const measuredAt of ['2026-11-14', '2026-11-14T08:00:00', '2026-02-30T08:00:00Z', '2026-11-14T25:00:00Z', '2026-11-14T08:00:00+14:30']) {
      assert.throws(() => store.ingest(ingest, sample({ measuredAt })), isCode('invalid-time'));
    }
    assert.throws(() => store.ingest(ingest, sample({ patientName: 'Không được nhận' })), isCode('unknown-field'));
    assert.throws(() => store.ingest(ingest, sample({ resolved: { ok: true } })), isCode('unknown-field'));
    assert.throws(() => store.ingest(ingest, sample({ qcLotCode: '' })), isCode('invalid-field'));
    assert.throws(() => store.ingest(ingest, sample({ analyzerId: ' MAY01' })), isCode('invalid-field'));
    assert.equal(store.ingest(ingest, sample({ value: 0 })).duplicate, false);
  } finally { store.close(); }
});

test('Gateway: ánh xạ chính xác theo nguồn/máy/mức/lô, không quy đổi đơn vị, bản tin chờ tự khớp sau cấu hình', () => {
  const { store, ingest, app } = setup();
  try {
    store.ingest(ingest, sample());
    assert.equal(store.listQueue(app, 'pending', 10).items[0].resolved.code, 'UNMAPPED');
    store.saveMappings(LOCAL_ADMIN, [mapping({ sourceId: 'LIS02' })]);
    assert.equal(store.listQueue(app, 'pending', 10).items[0].resolved.ok, false);
    store.saveMappings(LOCAL_ADMIN, [mapping()]);
    assert.equal(store.listQueue(app, 'pending', 10).items[0].resolved.ok, true);
    store.saveMappings(LOCAL_ADMIN, [mapping({ active: false })]);
    assert.equal(store.listQueue(app, 'pending', 10).items[0].resolved.code, 'MAPPING_DISABLED');
    store.saveMappings(LOCAL_ADMIN, [mapping({ unit: 'mg/dL' })]);
    assert.equal(store.listQueue(app, 'pending', 10).items[0].resolved.code, 'UNIT_MISMATCH');
    const before = store.listMappings(LOCAL_ADMIN);
    assert.throws(() => store.saveMappings(LOCAL_ADMIN, [mapping(), mapping()]), isCode('duplicate-mapping'));
    assert.throws(() => store.saveMappings(LOCAL_ADMIN, [mapping(), mapping({ level: 0 })]), isCode('invalid-mapping'));
    assert.deepEqual(store.listMappings(LOCAL_ADMIN), before);
  } finally { store.close(); }
});

test('Gateway: lỗi ghi nhật ký huỷ cả bản tin/quyết định và không phát thông báo thay đổi', () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'qclab-gateway-')), 'gateway.sqlite');
  const { store, ingest, app } = setup(file);
  const fault = new DatabaseSync(file);
  let events = 0;
  store.onChanged(() => { events++; });
  try {
    fault.exec("CREATE TRIGGER fail_gateway_audit BEFORE INSERT ON gateway_audit BEGIN SELECT RAISE(ABORT,'test-audit-failed'); END;");
    assert.throws(() => store.ingest(ingest, sample()), /test-audit-failed/);
    assert.equal(store.listQueue(app, 'pending', 10).items.length, 0);
    assert.equal(events, 0);
    fault.exec('DROP TRIGGER fail_gateway_audit');
    const received = store.ingest(ingest, sample());
    assert.equal(events, 1);
    fault.exec("CREATE TRIGGER fail_gateway_audit BEFORE INSERT ON gateway_audit BEGIN SELECT RAISE(ABORT,'test-audit-failed'); END;");
    assert.throws(() => store.decide(app, { messageId: received.messageId, status: 'imported', by: 'KTV' }), /test-audit-failed/);
    assert.equal(store.listQueue(app, 'pending', 10).items.length, 1);
    assert.equal(events, 1);
  } finally { fault.close(); store.close(); }
});

test('Gateway: phân trang ổn định và sao lưu SQLite đọc được cả dữ liệu lẫn token', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'qclab-gateway-'));
  const { store, ingest, app, tokens } = setup(path.join(dir, 'gateway.sqlite'));
  const target = path.join(dir, 'backup.sqlite');
  try {
    for (let i = 0; i < 5; i++) store.ingest(ingest, sample({ messageId: `QC-${i}` }));
    const first = store.listQueue(app, 'pending', 2);
    const second = store.listQueue(app, 'pending', 2, first.nextCursor);
    const third = store.listQueue(app, 'pending', 2, second.nextCursor);
    assert.equal(new Set([...first.items, ...second.items, ...third.items].map((r) => r.id)).size, 5);
    assert.equal(third.nextCursor, null);
    await store.backup(LOCAL_ADMIN, target);
    await assert.rejects(store.backup(LOCAL_ADMIN, target), /EEXIST/);
    const restored = new GatewayStore(target);
    try { assert.equal(restored.listQueue(restored.authenticate(`Bearer ${tokens.app.token}`), 'pending', 10).items.length, 5); }
    finally { restored.close(); }
  } finally { store.close(); }
});

test('Gateway HTTP: phân quyền, dữ liệu trùng/xung đột, ánh xạ, quyết định và giới hạn đầu vào', async () => {
  const { store, tokens, source } = setup();
  const service = await startGateway({ store, port: 0 });
  const request = (route, token, method = 'GET', body) => fetch(service.url + route, { method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try {
    assert.equal((await request('/health', 'bad')).status, 401);
    assert.equal((await request('/health', tokens.app.token)).status, 200);
    assert.equal((await request('/api/v1/qc-results', tokens.app.token, 'POST', sample())).status, 403);
    assert.equal((await request('/api/v1/qc-results', source.token)).status, 403);
    assert.equal((await request('/api/v1/tokens', tokens.app.token)).status, 403);
    assert.equal((await request('/api/v1/mappings', tokens.admin.token, 'PUT', [mapping()])).status, 200);
    const response = await request('/api/v1/qc-results', source.token, 'POST', sample());
    assert.equal(response.status, 201);
    const received = await response.json();
    assert.equal((await request('/api/v1/qc-results', source.token, 'POST', sample())).status, 200);
    assert.equal((await request('/api/v1/qc-results', source.token, 'POST', sample({ value: 10 }))).status, 409);
    const queue = await (await request('/api/v1/qc-results?status=pending', tokens.app.token)).json();
    assert.equal(queue.items[0].resolved.ok, true);
    assert.equal((await request('/api/v1/qc-results/decide', tokens.app.token, 'POST', { messageId: received.messageId, status: 'imported', by: 'KTV Nguyễn' })).status, 200);
    assert.equal((await request('/api/v1/qc-results/decide', tokens.app.token, 'POST', { messageId: received.messageId, status: 'rejected', by: 'KTV Nguyễn' })).status, 409);
    assert.equal((await request('/api/v1/qc-results?limit=no', tokens.app.token)).status, 400);
    assert.equal((await request('/api/v1/qc-results', source.token, 'POST', { ...sample(), unexpected: 'x' })).status, 400);
    const huge = await request('/api/v1/qc-results', source.token, 'POST', { extra: 'x'.repeat(70_000) });
    assert.equal(huge.status, 413);
    const origin = await fetch(service.url + '/health', { headers: { authorization: `Bearer ${tokens.app.token}`, origin: 'https://example.com' } });
    assert.equal(origin.status, 403);
    store.revokeToken(LOCAL_ADMIN, source.id);
    assert.equal((await request('/api/v1/qc-results', source.token, 'POST', sample())).status, 401);
  } finally { await service.close(); store.close(); }
});

test('Gateway HTTP: giới hạn tần suất và không bật cổng LAN không mã hoá', async () => {
  const { store, tokens } = setup();
  try {
    await assert.rejects(startGateway({ store, host: '0.0.0.0', port: 0 }), isCode('local-only'));
    await assert.rejects(startGateway({ store, host: '0.0.0.0', port: 0, surface: 'ingress' }), isCode('tls-required'));
    const service = await startGateway({ store, port: 0, requestsPerMinute: 2 });
    try {
      const request = () => fetch(service.url + '/health', { headers: { authorization: `Bearer ${tokens.app.token}` } });
      assert.equal((await request()).status, 200);
      assert.equal((await request()).status, 200);
      const blocked = await request();
      assert.equal(blocked.status, 429);
      assert.equal(blocked.headers.get('retry-after'), '60');
    } finally { await service.close(); }
  } finally { store.close(); }
});

test('Gateway HTTPS: cổng ingress chỉ cho nguồn gửi QC, không lộ API quản trị hoặc hàng chờ', async () => {
  const { store, tokens, source } = setup();
  const tls = trustedTestTls();
  const service = await startGateway({ store, port: 0, surface: 'ingress', tls: tls.source.credentials() });
  const request = (route, token, method = 'GET', body) => fetch(service.url + route, { method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try {
    assert.equal((await request('/health', source.token)).status, 200);
    assert.equal((await request('/health', tokens.admin.token)).status, 403);
    assert.equal((await request('/api/v1/qc-results', source.token, 'POST', sample())).status, 201);
    assert.equal((await request('/api/v1/qc-results', source.token)).status, 403);
    assert.equal((await request('/api/v1/tokens', source.token)).status, 403);
    assert.equal((await request('/api/v1/qc-results', tokens.app.token, 'POST', sample())).status, 403);
  } finally { await service.close(); store.close(); }
});

test('Gateway HTTP: giới hạn body không có Content-Length, giữ nguyên UTF-8 và phản hồi an toàn khi log lỗi', async () => {
  const { store, tokens, source, app } = setup();
  const service = await startGateway({ store, port: 0, log: () => { throw new Error('Đĩa log lỗi'); } });
  const requestChunks = (chunks) => new Promise((resolve, reject) => {
    const url = new URL(service.url);
    const req = httpRequest({ hostname: url.hostname, port: url.port, path: '/api/v1/qc-results', method: 'POST',
      headers: { authorization: `Bearer ${source.token}`, 'content-type': 'application/json', 'transfer-encoding': 'chunked' } }, (res) => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    for (const chunk of chunks) req.write(chunk);
    req.end();
  });
  try {
    assert.equal(await requestChunks([Buffer.from('x'.repeat(40_000)), Buffer.from('x'.repeat(40_000))]), 413);
    const bytes = Buffer.from(JSON.stringify(sample({ operator: 'Nguyễn Thị Ánh' })));
    const accent = bytes.indexOf(Buffer.from('ễ'));
    assert.equal(await requestChunks([bytes.subarray(0, accent + 1), bytes.subarray(accent + 1)]), 201);
    assert.equal(store.listQueue(app, 'pending', 10).items[0].message.operator, 'Nguyễn Thị Ánh');
    assert.equal(await requestChunks([Buffer.from('{"messageId":"'), Buffer.from([0xff]), Buffer.from('"}')]), 400);
    const invalidHost = await new Promise((resolve, reject) => {
      const url = new URL(service.url);
      const req = httpRequest({ hostname: url.hostname, port: url.port, path: '/health',
        headers: { authorization: `Bearer ${tokens.app.token}`, host: 'untrusted.example:8787' } }, (res) => {
        res.resume(); res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject); req.end();
    });
    assert.equal(invalidHost, 403);
  } finally { await service.close(); store.close(); }
});

test('Gateway CLI: khởi tạo một lần, cấp/thu hồi token, nhập ánh xạ và sao lưu dùng chung kho bền vững', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'qclab-gateway-cli-'));
  const cli = path.resolve(import.meta.dirname, '../../app-dist/main/gateway/cli.js');
  const run = (...args) => spawnSync(process.execPath, [cli, ...args, '--data-dir', dir], { encoding: 'utf8' });
  const initialized = run('init');
  assert.equal(initialized.status, 0, initialized.stderr);
  const original = JSON.parse(initialized.stdout);
  assert.equal(run('init').status, 1);
  const created = run('token-create', '--role', 'ingest', '--source', 'LIS01', '--label', 'LIS chính');
  assert.equal(created.status, 0, created.stderr);
  const source = JSON.parse(created.stdout);
  const file = path.join(dir, 'mappings.json');
  writeFileSync(file, JSON.stringify([mapping()]), 'utf8');
  assert.equal(run('mappings-import', '--file', file).status, 0);
  assert.equal(JSON.parse(run('mappings-list').stdout)[0].qclabTestId, 'test-glucose');
  const metadata = run('token-list').stdout;
  assert.ok(!metadata.includes(original.app.token) && !metadata.includes(source.token));
  assert.equal(run('token-revoke', '--id', source.id).status, 0);
  assert.equal(run('backup', '--file', path.join(dir, 'backup.sqlite')).status, 0);
  const store = new GatewayStore(path.join(dir, 'backup.sqlite'));
  try {
    assert.equal(store.authenticate(`Bearer ${original.app.token}`).role, 'app');
    assert.throws(() => store.authenticate(`Bearer ${source.token}`), isCode('unauthorized'));
  } finally { store.close(); }
});

test('Gateway: hàng chờ trả khoá nguồn gốc và nhận tên người quyết định tới 200 ký tự', () => {
  const { store, ingest, app } = setup();
  try {
    store.ingest(ingest, sample({ messageId: 'QC-SRC-1' }));
    store.ingest(ingest, sample({ messageId: 'QC-SRC-2' }));
    // Cùng mili-giây thì thứ tự theo UUID ngẫu nhiên; tìm theo mã gốc.
    const items = store.listQueue(app, 'pending', 10).items;
    const first = items.find((item) => item.source.messageId === 'QC-SRC-1');
    const second = items.find((item) => item.source.messageId === 'QC-SRC-2');
    assert.deepEqual(first.source, { sourceId: 'LIS01', messageId: 'QC-SRC-1' });
    assert.notEqual(first.message.messageId, 'QC-SRC-1');
    store.decide(app, { messageId: first.id, status: 'imported', by: 'A'.repeat(200) });
    assert.throws(() => store.decide(app, { messageId: second.id, status: 'rejected', by: 'A'.repeat(201) }), isCode('invalid-field'));
  } finally { store.close(); }
});
