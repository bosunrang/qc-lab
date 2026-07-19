#!/usr/bin/env node
/* Phát hành khoá kích hoạt QC Lab (chạy ở MÁY BẠN — nơi giữ khoá riêng).
 *
 * Mô hình: 1 máy = 1 license, VĨNH VIỄN (không hết hạn), khoá theo mã máy.
 *
 * Quy trình:
 *   1. Khách mở app → màn "Kích hoạt" hiện MÃ MÁY → khách gửi mã đó cho bạn.
 *   2. Bạn chạy:
 *        node tools/issue-license.js --lab "Tên phòng xét nghiệm" --machine "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
 *   3. Chép chuỗi khoá in ra, gửi lại khách. Khách dán vào ô "Khoá kích hoạt".
 *
 * BẢO MẬT: tools/qclab-license-private-key.pem là khoá bí mật để ký license —
 * KHÔNG bao giờ đóng gói vào app, KHÔNG gửi cho ai, nên sao lưu nơi an toàn.
 * Ai có khoá này là tạo được license giả cho mọi máy.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function normalizeId(v) { return String(v || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase(); }

const lab = arg('lab', '');
const machineRaw = arg('machine', '');
const keyPath = arg('key', path.join(__dirname, 'qclab-license-private-key.pem'));

if (!lab || !machineRaw) {
  console.error('Thiếu tham số.\nDùng: node tools/issue-license.js --lab "Tên lab" --machine "MÃ-MÁY"');
  process.exit(1);
}
const machineId = normalizeId(machineRaw);
if (machineId.length < 16) {
  console.error('Mã máy không hợp lệ (quá ngắn sau khi chuẩn hoá): ' + machineId);
  process.exit(1);
}

let privateKey;
try { privateKey = fs.readFileSync(keyPath, 'utf8'); }
catch (e) { console.error('Không đọc được khoá riêng tại: ' + keyPath); process.exit(1); }

const payload = {
  v: 1,
  lab: lab,
  machineId: machineId,
  licenseId: 'QCL-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
  issuedAt: new Date().toISOString()
};
const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
const signature = crypto.sign(null, Buffer.from(payloadB64), privateKey).toString('base64');
const licenseString = payloadB64 + '.' + signature;

console.log('\n=== KHOÁ KÍCH HOẠT (gửi cho khách) ===');
console.log(licenseString);
console.log('\n--- Thông tin (lưu lại để đối chiếu) ---');
console.log('Lab       : ' + payload.lab);
console.log('Mã máy    : ' + machineId);
console.log('License ID: ' + payload.licenseId);
console.log('Phát hành : ' + payload.issuedAt);
