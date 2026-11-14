import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { generateKeyPairSync, sign } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureUser } from './helpers/nce-flow.mjs';
import { trustedTestTls } from './helpers/lan-tls.mjs';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createLicenseService, LICENSE_META_KEY } = require('../../app-dist/main/licensing/license-service.js');
const { validateLicenseToken } = require('../../app-dist/main/licensing/license-token.js');
const { machineCodeFromIdentity } = require('../../app-dist/main/licensing/machine-code.js');
const { createAccessGate } = require('../../app-dist/main/ipc/access-gate.js');
const { cloudBackupData, MACHINE_LOCAL_META_KEYS } = require('../../app-dist/main/domain/cloud-backup.js');
const { replaceAllTables, dumpAllTables } = require('../../app-dist/main/db/table-io.js');
const { createLanInvoker } = require('../../app-dist/main/ipc/operations.js');
const { createSoftwareOperations } = require('../../app-dist/main/ipc/software-operations.js');
const { createUpdateService } = require('../../app-dist/main/updates/update-service.js');
const { LanHttpServer } = require('../../app-dist/main/lan/http-server.js');
const keys = generateKeyPairSync('ed25519');
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' });
const machineCode = machineCodeFromIdentity('máy thử nghiệm');
const now = Date.parse('2026-11-10T10:00:00.000Z');
const admin = { userId: 'lic-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
function token(over = {}, signingKey = keys.privateKey) {
  const claims = { schema: 1, product: 'vn.qclab.desktop', licenseId: 'LIC-1', licensedTo: 'Phòng xét nghiệm thử', machineCode,
    issuedAt: '2026-11-10T09:00:00.000Z', expiresAt: null, ...over };
  const message = 'QCL1.' + Buffer.from(JSON.stringify(claims)).toString('base64url');
  return message + '.' + sign(null, Buffer.from(message), signingKey).toString('base64url');
}
function setup(t) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  ensureUser(db, admin);
  const license = createLicenseService(db, { required: true, publicKey, machineCode, now: () => now });
  return { db, license };
}

test('giấy phép: chỉ mã ký đúng, đúng sản phẩm và đúng máy mới hợp lệ', () => {
  assert.equal(validateLicenseToken(token(), publicKey, machineCode, now).ok, true);
  assert.equal(validateLicenseToken(token(), publicKey, machineCodeFromIdentity('máy khác'), now).code, 'wrong-machine');
  assert.equal(validateLicenseToken(token({}, generateKeyPairSync('ed25519').privateKey), publicKey, machineCode, now).code, 'invalid-signature');
  const parts = token().split('.'); parts[1] = Buffer.from(JSON.stringify({ licensedTo: 'Tự sửa đơn vị' })).toString('base64url');
  assert.equal(validateLicenseToken(parts.join('.'), publicKey, machineCode, now).code, 'invalid-signature');
  assert.equal(validateLicenseToken(token({ product: 'sản-phẩm-khác' }), publicKey, machineCode, now).ok, false);
  for (const value of [null, {}, '', 'a.b.c', 'x'.repeat(9000)]) assert.equal(validateLicenseToken(value, publicKey, machineCode, now).ok, false);
});

test('giấy phép: hết hạn, ngày cấp tương lai và khoá công khai hỏng đều bị chặn', () => {
  assert.equal(validateLicenseToken(token({ expiresAt: '2026-11-10T09:59:59.999Z' }), publicKey, machineCode, now).code, 'license-expired');
  assert.equal(validateLicenseToken(token({ issuedAt: '2026-11-11T09:00:00.000Z' }), publicKey, machineCode, now).code, 'license-not-yet-valid');
  assert.equal(validateLicenseToken(token(), '', machineCode, now).code, 'license-key-missing');
});

test('kích hoạt: quyền trước dữ liệu, ghi nguyên tử, không làm lộ token trong trạng thái/nhật ký', (t) => {
  const { db, license } = setup(t);
  ensureUser(db, { ...admin, userId: 'tech', role: 'technician' });
  assert.equal(license.activate({}, { ...admin, userId: 'tech', role: 'admin' }).error.code, 'forbidden', 'đọc lại quyền mới nhất, không tin actor cũ');
  assert.equal(license.status().state, 'required');
  const signed = token();
  const result = license.activate({ data: { activationCode: signed } }, license.activationActor);
  assert.equal(result.ok, true); assert.equal(license.allowed(), true);
  assert.equal(result.data.licensed_to, 'Phòng xét nghiệm thử');
  assert.ok(!JSON.stringify(result.data).includes(signed));
  const audit = db.prepare('SELECT detail FROM activity ORDER BY seq DESC LIMIT 1').get();
  assert.ok(!audit.detail.includes(signed));
  assert.equal(license.activate({ data: { activationCode: token({ machineCode: machineCodeFromIdentity('khác') }) } }, admin).ok, false);
  assert.equal(db.prepare('SELECT value FROM app_meta WHERE key=?').get(LICENSE_META_KEY).value, signed);
});

test('cổng kích hoạt chặn đọc, ghi, đăng nhập và khởi tạo bằng IPC; LAN không nhận lệnh kích hoạt/cập nhật', async (t) => {
  const { db, license } = setup(t);
  const gate = createAccessGate(db, license.allowed), ctx = { actor: () => admin };
  for (const channel of ['config:listTests', 'entry:addPoint', 'auth:login', 'auth:bootstrapAdmin']) {
    assert.throws(() => gate.guard(channel, ctx), (error) => error.code === 'activation-required');
  }
  assert.doesNotThrow(() => gate.guard('software:getLicenseStatus', ctx));
  assert.doesNotThrow(() => gate.guard('software:activate', ctx));
  const updates = createUpdateService(null, { currentVersion: '1.0.9', changed() {}, async prepareInstall() {}, beforeInstall() {} });
  const operations = createSoftwareOperations(db, license, updates, { get: () => null, set() {} });
  const lan = createLanInvoker([operations], gate);
  for (const method of ['activateSoftware', 'checkSoftwareUpdate', 'downloadSoftwareUpdate', 'installSoftwareUpdate']) {
    assert.equal((await lan(method, [], admin)).error.code, 'unknown-operation');
  }
  assert.equal((await lan('getLicenseStatus', [], admin)).state, 'required');
  assert.equal(license.activate({ data: { activationCode: token() } }, admin).ok, true);
  assert.doesNotThrow(() => gate.guard('config:listTests', ctx));
});

test('giấy phép thuộc máy: không lên đám mây, phục hồi giữ giấy phép của máy hiện tại', (t) => {
  const { db, license } = setup(t);
  const oldData = dumpAllTables(db), signed = token();
  license.activate({ data: { activationCode: signed } }, admin);
  assert.ok(!cloudBackupData(dumpAllTables(db)).app_meta.some((row) => row.key === LICENSE_META_KEY));
  replaceAllTables(db, { kind: 'json', data: oldData }, { keepMetaKeys: MACHINE_LOCAL_META_KEYS });
  assert.equal(license.status().state, 'active');
});

test('giấy phép hết hạn trong phiên bị chặn ngay; nhật ký lỗi làm huỷ toàn bộ kích hoạt', (t) => {
  const { db } = setup(t);
  let clock = now;
  const license = createLicenseService(db, { required: true, publicKey, machineCode, now: () => clock });
  db.exec("CREATE TRIGGER fail_license_audit BEFORE INSERT ON activity BEGIN SELECT RAISE(ABORT,'audit-failed'); END");
  assert.throws(() => license.activate({ data: { activationCode: token() } }, admin), /audit-failed/);
  assert.equal(license.status().state, 'required');
  db.exec('DROP TRIGGER fail_license_audit');
  const expiry = '2026-11-10T11:00:00.000Z';
  assert.equal(license.activate({ data: { activationCode: token({ expiresAt: expiry }) } }, admin).ok, true);
  assert.equal(license.allowed(), true);
  clock = Date.parse(expiry);
  assert.equal(license.status().state, 'expired'); assert.equal(license.allowed(), false);
});

test('máy chủ LAN công khai trạng thái nhưng chặn đăng nhập trước bước xác thực khi chưa kích hoạt', async (t) => {
  let logins = 0;
  const server = new LanHttpServer({
    tls: trustedTestTls().source, getLicenseStatus: () => ({ state: 'required', runtime: 'lan' }), licenseAllowed: () => false,
    login: () => { logins++; return { ok: false, error: { code: 'invalid', message: 'invalid' } }; },
    actorOf: () => admin, currentUser: () => null, invoke: async () => null,
  });
  const port = await server.start(0, '127.0.0.1'); t.after(() => server.stop());
  assert.equal((await (await fetch(`https://127.0.0.1:${port}/api/license`)).json()).state, 'required');
  const response = await fetch(`https://127.0.0.1:${port}/api/auth/login`, { method: 'POST', body: '{}' });
  assert.equal(response.status, 403); assert.equal((await response.json()).error.code, 'activation-required');
  assert.equal(logins, 0);
});

test('công cụ cấp mã tạo khoá riêng, cấp mã tương thích và không ghi đè khoá', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qclab-issuer-'));
  const privatePath = path.join(dir, 'issuer.private.pem'), publicPath = path.join(dir, 'public.json'), output = path.join(dir, 'license.txt');
  const script = new URL('../scripts/license-issuer.cjs', import.meta.url);
  // URL có khoảng trắng phải được giải mã trước khi truyền cho tiến trình.
  const issuer = fileURLToPath(script);
  const execute = (...args) => spawnSync(process.execPath, [issuer, ...args], { encoding: 'utf8' });
  const created = execute('keygen', '--private-key', privatePath, '--public-key', publicPath);
  assert.equal(created.status, 0, created.stderr); assert.equal(existsSync(privatePath), true);
  assert.ok(!created.stdout.includes('BEGIN PRIVATE KEY'));
  assert.notEqual(execute('keygen', '--private-key', privatePath, '--public-key', publicPath).status, 0);
  const issued = execute('issue', '--private-key', privatePath, '--public-key', publicPath, '--machine', machineCode, '--customer', 'Đơn vị thử', '--out', output);
  assert.equal(issued.status, 0, issued.stderr);
  assert.equal(validateLicenseToken(readFileSync(output, 'utf8'), JSON.parse(readFileSync(publicPath, 'utf8')).publicKey, machineCode).ok, true);
});
