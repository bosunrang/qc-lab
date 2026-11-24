import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { issueLicense } = require('../license-issuer/license-core.cjs');
const { validateLicenseToken } = require('../../app-dist/main/licensing/license-token.js');
const machine = 'QC-01234567-89ABCDEF-01234567-89ABCDEF';
const now = Date.parse('2026-11-11T02:00:00.000Z');
function setup() {
  const keys = generateKeyPairSync('ed25519');
  const keyPath = path.join(mkdtempSync(path.join(os.tmpdir(), 'issuer-core-')), 'issuer.private.pem');
  writeFileSync(keyPath, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }));
  return { keyPath, publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }) };
}
test('giao diện và CLI cấp cùng giao thức: app nhận mã vĩnh viễn, chuẩn hoá mã máy và đơn vị', () => {
  const { keyPath, publicKey } = setup();
  const issued = issueLicense({ machineCode: ` ${machine.toLowerCase()} `, licensedTo: ' Đơn vị thử ', expiresOn: null }, keyPath, publicKey, now);
  const result = validateLicenseToken(issued.activation_code, publicKey, machine, now);
  assert.equal(result.ok, true); assert.equal(result.claims.licensedTo, 'Đơn vị thử'); assert.equal(result.claims.expiresAt, null);
  assert.ok(!JSON.stringify(issued).includes('PRIVATE KEY'));
  assert.equal(validateLicenseToken(issued.activation_code, publicKey, 'QC-AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD', now).ok, false);
});
test('cấp mã tới hết ngày Việt Nam, ngày sau không còn hiệu lực', () => {
  const { keyPath, publicKey } = setup();
  const issued = issueLicense({ machineCode: machine, licensedTo: 'Đơn vị', expiresOn: '2026-12-31' }, keyPath, publicKey, now);
  assert.equal(issued.expires_at, '2026-12-31T16:59:59.999Z');
  assert.equal(validateLicenseToken(issued.activation_code, publicKey, machine, Date.parse('2026-12-31T16:59:59.998Z')).ok, true);
  assert.equal(validateLicenseToken(issued.activation_code, publicKey, machine, Date.parse('2026-12-31T17:00:00.000Z')).ok, false);
});
test('không ký dữ liệu sai hoặc khoá của bên khác', () => {
  const { keyPath, publicKey } = setup();
  const valid = { machineCode: machine, licensedTo: 'Đơn vị', expiresOn: null };
  for (const patch of [{ machineCode: 'máy sai' }, { licensedTo: ' ' }, { licensedTo: 'x'.repeat(201) }, { expiresOn: '2026-02-30' }, { expiresOn: '2000-01-01' }, { expiresOn: undefined }]) {
    assert.throws(() => issueLicense({ ...valid, ...patch }, '/missing-key', publicKey, now), /Mã máy|Tên đơn vị|Ngày hết hạn/);
  }
  assert.throws(() => issueLicense(valid, setup().keyPath, publicKey, now), /không khớp/);
  const invalidKey = path.join(path.dirname(keyPath), 'invalid.pem'); writeFileSync(invalidKey, 'không phải khoá');
  assert.throws(() => issueLicense(valid, invalidKey, publicKey, now), /không phải khoá bí mật/);
});
