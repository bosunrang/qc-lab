// HTTPS của máy chủ LAN: CA do app tạo, chứng chỉ máy chủ cấp theo IP, giới
// hạn dải của CA có hiệu lực khi bắt tay TLS thật, CA lưu/đọc lại được, và
// cổng LAN không nhận đăng nhập hay API qua HTTP thường.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { createServer as createHttpsServer, request as httpsRequest } from 'node:https';
import { connect as tlsConnect, checkServerIdentity } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { trustedTestTls } from './helpers/lan-tls.mjs';

const require = createRequire(import.meta.url);
const { createLanCa, issueServerCredentials, caCoversIp, caThumbprint, CA_VALIDITY_DAYS, SERVER_VALIDITY_DAYS } = require('../../app-dist/main/lan/tls-certs.js');
const { loadOrCreateCa, sealedKeyProtector, LanTlsIdentity } = require('../../app-dist/main/lan/tls-store.js');
const { LanHttpServer } = require('../../app-dist/main/lan/http-server.js');

const DAY = 24 * 60 * 60 * 1000;

/** Bắt tay TLS với một máy chủ dùng `credentials`, tin `ca`, kiểm tên `host`. */
async function handshake(credentials, ca, host = '127.0.0.1') {
  const server = createHttpsServer({ cert: credentials.cert, key: credentials.key }, (_req, res) => res.end('ok'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await new Promise((resolve) => {
      const req = httpsRequest({
        host: '127.0.0.1', port: server.address().port, ca: ca.certPem, agent: false,
        checkServerIdentity: (_name, cert) => checkServerIdentity(host, cert),
      }, (res) => { res.resume(); res.on('end', () => resolve({ ok: true })); });
      req.on('error', (error) => resolve({ ok: false, error }));
      req.end();
    });
  } finally {
    server.close();
  }
}

/** Yêu cầu HTTP thường (không TLS) tới cổng LAN. */
function plainRequest(port, method, pathname, body) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, method, path: pathname, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

/** Chứng chỉ máy chủ mà một kết nối TLS mới nhận được. */
function peerCertificate(port, ca) {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect({ host: '127.0.0.1', port, ca: ca.certPem }, () => {
      const cert = new X509Certificate(socket.getPeerX509Certificate().raw);
      socket.end();
      resolve(cert);
    });
    socket.on('error', reject);
  });
}

test('CA và chứng chỉ máy chủ có đúng các trường trình duyệt đòi', () => {
  const now = new Date('2026-09-26T08:00:00Z');
  const ca = createLanCa(now);
  assert.equal(ca.cert.ca, true);
  assert.equal(ca.cert.checkIssued(ca.cert), true, 'CA tự ký');
  assert.ok(Math.abs(new Date(ca.cert.validTo) - now - CA_VALIDITY_DAYS * DAY) < 1000);
  assert.match(caThumbprint(ca), /^([0-9a-f]{4} ){9}[0-9a-f]{4}$/);
  assert.equal(caThumbprint(ca).replaceAll(' ', ''), ca.cert.fingerprint.replaceAll(':', '').toLowerCase(), 'đúng Thumbprint SHA-1 Windows hiện');

  const credentials = issueServerCredentials(ca, ['192.168.1.20', '127.0.0.1', '8.8.8.8', '192.168.1.20'], now);
  const leaf = new X509Certificate(credentials.cert);
  assert.deepEqual(credentials.ips, ['127.0.0.1', '192.168.1.20'], 'bỏ IP ngoài dải nội bộ và IP trùng');
  assert.equal(leaf.subjectAltName, 'IP Address:127.0.0.1, IP Address:192.168.1.20');
  assert.equal(leaf.ca, false);
  assert.equal(leaf.checkIssued(ca.cert), true);
  assert.equal(leaf.verify(ca.cert.publicKey), true);
  assert.deepEqual(leaf.keyUsage, ['1.3.6.1.5.5.7.3.1'], 'chỉ dùng cho máy chủ web');
  assert.ok(new Date(leaf.validTo) - now <= 397 * DAY + 1000, 'dưới 398 ngày');
  assert.equal(SERVER_VALIDITY_DAYS, 397);
  assert.ok(new Date(leaf.validFrom) < now, 'lùi ngày bắt đầu để đỡ lệch đồng hồ máy nhân viên');
  assert.throws(() => issueServerCredentials(ca, ['8.8.8.8'], now), /IPv4 nội bộ/);
});

test('dải của CA: chỉ IPv4 nội bộ', () => {
  for (const ip of ['10.1.2.3', '172.16.0.1', '172.31.255.254', '192.168.0.10', '100.64.1.1', '169.254.3.4', '127.0.0.1']) assert.equal(caCoversIp(ip), true, ip);
  for (const ip of ['8.8.8.8', '172.32.0.1', '172.15.255.255', '192.169.0.1', '100.128.0.1', '1.1.1.1', 'fe80::1', 'abc']) assert.equal(caCoversIp(ip), false, ip);
});

test('bắt tay TLS: tin CA thì qua; CA lạ, IP Internet hay tên miền thật đều bị từ chối', async () => {
  const ca = createLanCa();
  assert.equal((await handshake(issueServerCredentials(ca, ['127.0.0.1']), ca)).ok, true);

  const stranger = createLanCa();
  const untrusted = await handshake(issueServerCredentials(ca, ['127.0.0.1']), stranger);
  assert.equal(untrusted.ok, false, 'máy chưa cài chứng chỉ gốc thì không tin');

  // Khoá CA có lộ thì cũng không giả được trang Internet: Name Constraints
  // của CA chặn ngay khi kiểm chuỗi chứng chỉ.
  const publicIp = await handshake(issueServerCredentials(ca, ['8.8.8.8'], new Date(), { unchecked: true }), ca, '8.8.8.8');
  assert.equal(publicIp.ok, false);
  assert.match(publicIp.error.message, /subtree/);
  const realDomain = await handshake(issueServerCredentials(ca, ['127.0.0.1'], new Date(), { dnsNames: ['example.com'] }), ca, 'example.com');
  assert.equal(realDomain.ok, false);
  assert.match(realDomain.error.message, /subtree/);
});

test('CA lưu xuống đĩa đã mã hoá, đọc lại đúng CA cũ, hỏng hoặc sắp hết hạn thì tạo mới', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qclab-tls-'));
  // Bản giả của safeStorage: đảo từng byte, đủ để thấy tệp không chứa khoá thô.
  const flip = (buffer) => Buffer.from(buffer.map((byte) => byte ^ 0xff));
  const sealer = { isEncryptionAvailable: () => true, encryptString: (text) => flip(Buffer.from(text)), decryptString: (buffer) => flip(buffer).toString() };
  const protector = sealedKeyProtector(sealer);
  const now = new Date('2026-09-26T08:00:00Z');

  const first = loadOrCreateCa(dir, protector, now);
  assert.equal(first.created, true);
  const keyFile = readFileSync(path.join(dir, 'ca-key.bin'));
  assert.equal(keyFile.subarray(0, 2).toString(), 'S1');
  assert.equal(keyFile.includes(Buffer.from('PRIVATE KEY')), false, 'khoá CA không nằm thô trên đĩa');

  const again = loadOrCreateCa(dir, protector, new Date(now.getTime() + 100 * DAY));
  assert.equal(again.created, false);
  assert.equal(caThumbprint(again.ca), caThumbprint(first.ca), 'mở lại app vẫn là CA cũ: máy nhân viên không phải cài lại');

  const nearExpiry = loadOrCreateCa(dir, protector, new Date(now.getTime() + (CA_VALIDITY_DAYS - 10) * DAY));
  assert.equal(nearExpiry.created, true);
  assert.equal(nearExpiry.reason, 'CA sắp hết hạn');

  writeFileSync(path.join(dir, 'ca-key.bin'), Buffer.from('XXhỏng'));
  const broken = loadOrCreateCa(dir, protector, now);
  assert.equal(broken.created, true);
  assert.match(broken.reason, /không đọc được CA/);
  assert.notEqual(caThumbprint(broken.ca), caThumbprint(nearExpiry.ca));

  // Hệ điều hành không cho mã hoá: vẫn chạy, khoá lưu kèm nhãn "P1".
  const plain = sealedKeyProtector({ isEncryptionAvailable: () => false, encryptString: () => { throw new Error('không gọi'); }, decryptString: () => { throw new Error('không gọi'); } });
  assert.equal(plain.sealed, false);
  const plainDir = mkdtempSync(path.join(os.tmpdir(), 'qclab-tls-plain-'));
  const created = loadOrCreateCa(plainDir, plain, now);
  assert.equal(loadOrCreateCa(plainDir, plain, now).created, false);
  assert.equal(caThumbprint(loadOrCreateCa(plainDir, plain, now).ca), caThumbprint(created.ca));
});

test('chứng chỉ máy chủ chỉ cấp lại khi IP nội bộ đổi hoặc sắp hết hạn', () => {
  const ca = createLanCa();
  let now = new Date('2026-09-26T08:00:00Z');
  const identity = new LanTlsIdentity(ca, ['192.168.1.20'], () => now);
  assert.deepEqual(identity.credentials.ips, ['127.0.0.1', '192.168.1.20'], 'luôn kèm 127.0.0.1');
  assert.equal(identity.refresh(['192.168.1.20']), false);
  assert.equal(identity.refresh(['192.168.1.20', '8.8.8.8']), false, 'IP ngoài dải không làm cấp lại');
  assert.equal(identity.refresh(['192.168.1.35']), true);
  assert.deepEqual(identity.credentials.ips, ['127.0.0.1', '192.168.1.35']);
  now = new Date(now.getTime() + (SERVER_VALIDITY_DAYS - 20) * DAY);
  assert.equal(identity.refresh(['192.168.1.35']), true, 'còn dưới 30 ngày thì cấp lại');
});

test('cổng LAN: HTTPS phục vụ app; HTTP thường chỉ có trang hướng dẫn và chứng chỉ gốc', async () => {
  const tls = trustedTestTls();
  let loginCalls = 0;
  const user = { id: 'u1', username: 'ktv', name: 'KTV', role: 'technician', active: true };
  const server = new LanHttpServer({
    login: () => { loginCalls++; return { ok: true, data: user }; },
    actorOf: (row) => ({ userId: row.id, username: row.username, name: row.name, role: row.role, clientId: 'lan-web' }),
    currentUser: () => user,
    invoke: async () => ({ ok: true, data: 'rpc' }),
    tls: tls.source,
  });
  const port = await server.start(0, '127.0.0.1');
  try {
    assert.equal((await fetch(`https://127.0.0.1:${port}/api/health`)).status, 200);

    // HTTP thường: không đăng nhập, không API — kể cả khi gửi đúng mật khẩu.
    const login = await plainRequest(port, 'POST', '/api/auth/login', JSON.stringify({ data: { username: 'ktv', password: 'secret' } }));
    assert.equal(login.status, 403);
    assert.equal(JSON.parse(login.body).error.code, 'https-required');
    assert.equal(login.headers['set-cookie'], undefined);
    assert.equal(loginCalls, 0, 'mật khẩu gửi qua HTTP không được kiểm, dù đúng hay sai');
    for (const [method, pathname] of [['GET', '/api/session'], ['POST', '/api/rpc'], ['GET', '/api/events'], ['GET', '/api/brand']]) {
      assert.equal((await plainRequest(port, method, pathname)).status, 403, `${method} ${pathname}`);
    }

    const page = await plainRequest(port, 'GET', '/');
    assert.equal(page.status, 200);
    assert.match(page.headers['content-type'], /text\/html/);
    const html = page.body.toString();
    assert.match(html, /Tải chứng chỉ gốc/);
    assert.match(html, /'https:\/\/' \+ location\.host/, 'địa chỉ HTTPS lấy từ trình duyệt, không từ máy chủ');
    assert.equal(html.includes(caThumbprint(tls.ca)), false, 'không đưa dấu vân tay qua kết nối có thể bị sửa');
    assert.equal((await plainRequest(port, 'GET', '/index.html')).body.toString(), html, 'mọi trang qua HTTP đều là trang hướng dẫn');

    const certificate = await plainRequest(port, 'GET', '/qclab-ca.crt');
    assert.equal(certificate.status, 200);
    assert.equal(certificate.headers['content-type'], 'application/x-x509-ca-cert');
    assert.deepEqual(certificate.body, tls.ca.certDer);
    assert.deepEqual(Buffer.from(await (await fetch(`https://127.0.0.1:${port}/qclab-ca.crt`)).arrayBuffer()), tls.ca.certDer);

    const secureLogin = await fetch(`https://127.0.0.1:${port}/api/auth/login`, { method: 'POST', body: JSON.stringify({ data: { username: 'ktv', password: 'secret' } }) });
    assert.equal(secureLogin.status, 200);
    assert.equal(loginCalls, 1);
    assert.match(secureLogin.headers.get('set-cookie'), /; Secure;/);

    // IP đổi: kết nối mới nhận chứng chỉ mới mà không phải khởi động lại.
    assert.match((await peerCertificate(port, tls.ca)).subjectAltName, /^IP Address:127\.0\.0\.1$/);
    tls.reissue(['127.0.0.1', '10.20.30.40']);
    server.reloadTls();
    assert.equal((await peerCertificate(port, tls.ca)).subjectAltName, 'IP Address:10.20.30.40, IP Address:127.0.0.1');

    // Luồng sự kiện đang mở không giữ máy chủ lại khi dừng.
    const cookie = secureLogin.headers.get('set-cookie').split(';')[0];
    const events = await fetch(`https://127.0.0.1:${port}/api/events`, { headers: { cookie } });
    assert.equal(events.status, 200);
  } finally {
    await server.stop();
  }
});
