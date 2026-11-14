// Cùng một bộ cấp mã cho giao diện và dòng lệnh; không đổi giao thức QCL1.
'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');

/** @param {string | import('node:crypto').KeyObject} key Khoá cần lấy dấu vân tay. */
function fingerprint(key) {
  return crypto.createHash('sha256').update(crypto.createPublicKey(key).export({ type: 'spki', format: 'der' })).digest('hex');
}

/** @param {string} privatePath @param {string} publicKey Khoá dùng đối chiếu chữ ký. */
function readSigningKey(privatePath, publicKey) {
  let pem;
  try {
    if (fs.statSync(privatePath).size > 16_384) throw new Error('too-large');
    pem = fs.readFileSync(privatePath, 'utf8');
  } catch { throw new Error('Không đọc được khoá bí mật. Hãy chọn lại tệp khoá cấp phép (.pem).'); }
  let key;
  try { key = crypto.createPrivateKey(pem); }
  catch { throw new Error('Tệp đã chọn không phải khoá bí mật hợp lệ.'); }
  if (key.asymmetricKeyType !== 'ed25519' || fingerprint(key) !== fingerprint(publicKey)) {
    throw new Error('Khoá bí mật không khớp khoá công khai của bản cài.');
  }
  return key;
}

/** @param {import('../shared/qc-api').LicenseIssuerInput} input @param {number} [now] Thời điểm kiểm tra. */
function validateIssueInput(input, now = Date.now()) {
  if (!input || typeof input !== 'object') throw new Error('Thông tin cấp mã không hợp lệ.');
  const machineCode = typeof input.machineCode === 'string' ? input.machineCode.trim().toUpperCase() : '';
  const licensedTo = typeof input.licensedTo === 'string' ? input.licensedTo.trim() : '';
  if (!/^QC(?:-[A-F0-9]{8}){4}$/.test(machineCode)) throw new Error('Mã máy không đúng định dạng QC-xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx.');
  if (!licensedTo || licensedTo.length > 200) throw new Error('Tên đơn vị phải có từ 1 đến 200 ký tự.');
  let expiresAt = null;
  if (input.expiresOn !== null && input.expiresOn !== '') {
    const date = input.expiresOn;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
      throw new Error('Ngày hết hạn phải là ngày YYYY-MM-DD hợp lệ.');
    }
    // Hết hạn vào cuối ngày được chọn theo giờ Việt Nam.
    expiresAt = new Date(`${date}T23:59:59.999+07:00`).toISOString();
    if (Date.parse(expiresAt) <= now) throw new Error('Ngày hết hạn phải sau thời điểm cấp.');
  }
  return { machineCode, licensedTo, expiresAt };
}

/** @param {import('../shared/qc-api').LicenseIssuerInput} input @param {string} privatePath @param {string} publicKey @param {number} [now] Thời điểm cấp.
 * @returns {import('../shared/qc-api').LicenseIssuerLicense} Mã đã ký và thông tin cấp phép. */
function issueLicense(input, privatePath, publicKey, now = Date.now()) {
  const data = validateIssueInput(input, now);
  const key = readSigningKey(privatePath, publicKey);
  const claims = { schema: 1, product: 'vn.qclab.desktop', licenseId: crypto.randomUUID(), licensedTo: data.licensedTo,
    machineCode: data.machineCode, issuedAt: new Date(now).toISOString(), expiresAt: data.expiresAt };
  const message = 'QCL1.' + Buffer.from(JSON.stringify(claims)).toString('base64url');
  const activationCode = message + '.' + crypto.sign(null, Buffer.from(message), key).toString('base64url');
  return { activation_code: activationCode, license_id: claims.licenseId, licensed_to: claims.licensedTo,
    machine_code: claims.machineCode, issued_at: claims.issuedAt, expires_at: claims.expiresAt };
}

module.exports = { fingerprint, readSigningKey, validateIssueInput, issueLicense };
