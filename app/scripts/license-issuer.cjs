// Công cụ của bên cấp phần mềm. Khoá bí mật luôn ở tệp riêng ngoài repo và
// không bao giờ được đưa vào bộ cài, log hoặc mã kích hoạt gửi khách hàng.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fingerprint, issueLicense } = require('../license-issuer/license-core.cjs');
const root = path.resolve(__dirname, '..', '..');
const command = process.argv[2];
const opts = {};
for (let i = 3; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  if (!key?.startsWith('--') || !value || value.startsWith('--') || Object.hasOwn(opts, key)) throw new Error('Tham số phải có dạng --tên giá-trị, không lặp.');
  opts[key] = value;
}
function required(name) { if (!opts[name]?.trim()) throw new Error(`Thiếu ${name}.`); return opts[name].trim(); }
const publicPath = path.resolve(opts['--public-key'] || path.join(root, 'app/main/licensing/public-key.json'));
const publicConfig = () => JSON.parse(fs.readFileSync(publicPath, 'utf8'));

try {
  if (command === 'keygen') {
    const privatePath = path.resolve(required('--private-key'));
    if (privatePath === publicPath) throw new Error('Khoá công khai và khoá bí mật phải nằm ở hai tệp khác nhau.');
    // Chặn việc vô tình tạo khoá bí mật trong cây được đóng gói/phát hành.
    const relative = path.relative(root, privatePath);
    if (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) throw new Error('Chọn nơi lưu khoá bí mật ngoài thư mục dự án.');
    if (fs.existsSync(privatePath)) throw new Error('Tệp khoá bí mật đã tồn tại; không ghi đè.');
    if (fs.existsSync(publicPath) && publicConfig().publicKey) throw new Error('Dự án đã có khoá công khai. Giữ nguyên cặp khoá để các mã đã cấp tiếp tục dùng được.');
    const keys = crypto.generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    fs.mkdirSync(path.dirname(privatePath), { recursive: true });
    fs.writeFileSync(privatePath, keys.privateKey, { flag: 'wx', mode: 0o600 });
    fs.mkdirSync(path.dirname(publicPath), { recursive: true });
    fs.writeFileSync(publicPath, JSON.stringify({ algorithm: 'Ed25519', publicKey: keys.publicKey }, null, 2) + '\n');
    process.stdout.write(`Đã tạo cặp khoá. Khoá bí mật: ${privatePath}\nDấu vân tay khoá công khai: ${fingerprint(keys.publicKey)}\n`);
  } else if (command === 'check') {
    const config = publicConfig(), key = crypto.createPublicKey(config.publicKey);
    if (config.algorithm !== 'Ed25519' || key.asymmetricKeyType !== 'ed25519') throw new Error('Bản cài cần khoá công khai Ed25519 hợp lệ.');
    process.stdout.write(`Khoá công khai hợp lệ: ${fingerprint(config.publicKey)}\n`);
  } else if (command === 'issue') {
    const issued = issueLicense({ machineCode: required('--machine'), licensedTo: required('--customer'), expiresOn: opts['--expires'] || null }, path.resolve(required('--private-key')), publicConfig().publicKey);
    const token = issued.activation_code;
    if (opts['--out']) {
      fs.writeFileSync(path.resolve(opts['--out']), token + '\n', { flag: 'wx' });
      process.stdout.write(`Đã cấp mã cho ${issued.licensed_to}: ${path.resolve(opts['--out'])}\n`);
    } else process.stdout.write(token + '\n');
  } else throw new Error('Dùng keygen --private-key <tệp ngoài repo>, check, hoặc issue --private-key <tệp> --machine <mã máy> --customer <đơn vị> [--expires YYYY-MM-DD] [--out <tệp>].');
} catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
