// Kiểm tra bản quyền phía tiến trình main (Node) — khó vá hơn nhiều so với chạy
// trong renderer. Mô hình: 1 MÁY = 1 LICENSE, key VĨNH VIỄN (không hết hạn).
//
// Cách hoạt động:
//  - Mỗi máy có một "mã máy" ổn định (băm từ Windows MachineGuid; dự phòng: MAC +
//    hostname). Khách gửi mã máy này cho bạn.
//  - Bạn ký một license bằng KHOÁ RIÊNG (tools/issue-license.js) chứa {tên lab,
//    mã máy}. App xác minh bằng KHOÁ CÔNG KHAI nhúng dưới đây.
//  - License chỉ chạy đúng trên máy có mã khớp → copy sang máy khác là hỏng.
//  - Không có khoá riêng thì KHÔNG thể tạo license hợp lệ (chữ ký Ed25519).
//
// Giới hạn trung thực: đây là phần mềm chạy trên máy khách, người quyết tâm vẫn
// có thể giải nén asar và vá. Cơ chế này chặn sao chép/bán lại tuỳ tiện, phần còn
// lại dựa vào thoả thuận bản quyền và watermark tên lab trên báo cáo.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Khoá CÔNG KHAI — an toàn khi nhúng/đóng gói. Khoá RIÊNG tương ứng giữ bí mật ở
// máy phát hành (xem tools/). Nếu đổi cặp khoá, mọi license cũ sẽ mất hiệu lực.
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA2z1KH1b4ljCGKkN/mPFqpJjVIlqmaa/X2r2uDdGjINk=
-----END PUBLIC KEY-----`;

// Chuẩn hoá mã máy/ID để so khớp bất kể dấu gạch hay hoa/thường.
function normalizeId(value) {
  return String(value == null ? '' : value).replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

// Nguồn định danh máy ổn định nhất trên Windows: MachineGuid trong registry
// (sống qua khởi động lại; chỉ đổi khi cài lại HĐH). Dự phòng cho môi trường
// không đọc được registry: MAC card mạng vật lý đầu tiên + hostname.
function rawMachineSource() {
  try {
    const out = require('child_process')
      .execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { windowsHide: true })
      .toString();
    const m = /MachineGuid\s+REG_SZ\s+([\w-]+)/i.exec(out);
    if (m && m[1]) return 'guid:' + m[1];
  } catch (e) { /* rơi xuống dự phòng */ }
  const macs = []
    .concat(...Object.values(os.networkInterfaces() || {}))
    .filter(n => n && !n.internal && n.mac && n.mac !== '00:00:00:00:00:00')
    .map(n => n.mac)
    .sort();
  return 'fb:' + (macs[0] || 'nomac') + '|' + os.hostname();
}

// Mã máy chuẩn tắc: 24 ký tự hex (96 bit) từ SHA-256 nguồn trên. Đủ duy nhất để
// khoá máy; tính an toàn của license nằm ở chữ ký, không phải ở độ khó đoán mã.
function machineIdCanonical() {
  return crypto.createHash('sha256').update(rawMachineSource()).digest('hex').slice(0, 24).toUpperCase();
}

// Bản hiển thị cho khách đọc/sao chép: nhóm 4 ký tự cho dễ đọc.
function machineIdDisplay() {
  return machineIdCanonical().match(/.{1,4}/g).join('-');
}

function licenseFilePath(userDataDir) {
  return path.join(userDataDir, 'qclab-license.dat');
}

// Tách "payloadB64.sigB64", xác minh chữ ký rồi khớp mã máy. Trả về thông tin đã
// xác minh (tên lab, mã license) để watermark, hoặc {valid:false, reason}.
function verifyLicenseString(licenseString) {
  const raw = String(licenseString || '').trim();
  if (!raw) return { valid: false, reason: 'empty' };
  const dot = raw.indexOf('.');
  if (dot <= 0) return { valid: false, reason: 'format' };
  const payloadB64 = raw.slice(0, dot), sigB64 = raw.slice(dot + 1);
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
  } catch (e) { return { valid: false, reason: 'payload' }; }
  let signatureOk = false;
  try {
    signatureOk = crypto.verify(null, Buffer.from(payloadB64), PUBLIC_KEY_PEM, Buffer.from(sigB64, 'base64'));
  } catch (e) { return { valid: false, reason: 'signature' }; }
  if (!signatureOk) return { valid: false, reason: 'signature' };
  if (normalizeId(payload.machineId) !== normalizeId(machineIdCanonical())) return { valid: false, reason: 'machine' };
  return { valid: true, lab: String(payload.lab || ''), licenseId: String(payload.licenseId || ''), issuedAt: String(payload.issuedAt || '') };
}

function readStoredLicense(userDataDir) {
  try { return fs.readFileSync(licenseFilePath(userDataDir), 'utf8'); }
  catch (e) { return ''; }
}

function saveLicense(userDataDir, licenseString) {
  fs.writeFileSync(licenseFilePath(userDataDir), String(licenseString || '').trim(), 'utf8');
}

// Trạng thái bản quyền hiện tại của máy: đọc license đã lưu rồi xác minh.
function currentStatus(userDataDir) {
  const stored = readStoredLicense(userDataDir);
  if (!stored) return { valid: false, reason: 'none', machineId: machineIdDisplay() };
  const result = verifyLicenseString(stored);
  return { ...result, machineId: machineIdDisplay() };
}

module.exports = {
  machineIdCanonical, machineIdDisplay,
  verifyLicenseString, readStoredLicense, saveLicense, currentStatus,
};
