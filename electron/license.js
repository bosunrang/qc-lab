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

// Dùng thử 30 ngày kể từ lần chạy đầu tiên trên máy, không cần license. Mốc thời
// gian lưu ở file RIÊNG (không phải license file) để activate() ở lượt sau không
// đụng vào nó. Cùng giới hạn trung thực như license: xoá file này sẽ reset đếm
// ngày — cơ chế chặn dùng lại tuỳ tiện, không phải khoá chống được người quyết tâm.
const TRIAL_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function trialFilePath(userDataDir) {
  return path.join(userDataDir, 'qclab-trial.dat');
}

// Đọc mốc bắt đầu dùng thử; nếu chưa có (lần chạy đầu tiên) hoặc file hỏng thì
// tạo mới NGAY LÚC NÀY — im lặng, không làm gián đoạn lần mở app đầu tiên.
function ensureTrialStarted(userDataDir) {
  const file = trialFilePath(userDataDir);
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const startedAt = new Date(raw && raw.startedAt).toISOString();
    return startedAt;
  } catch (e) {
    const startedAt = new Date().toISOString();
    try { fs.writeFileSync(file, JSON.stringify({ startedAt }), 'utf8'); } catch (e2) { /* không ghi được thì vẫn cho dùng thử phiên này */ }
    return startedAt;
  }
}

// Số ngày còn lại của dùng thử, kẹp trong [0, TRIAL_DAYS] — kể cả khi đồng hồ hệ
// thống bị lùi lại (không cho phép daysLeft vượt quá tổng số ngày cấp ban đầu).
function trialStatus(userDataDir) {
  const startedAt = ensureTrialStarted(userDataDir);
  const elapsedDays = Math.floor((Date.now() - new Date(startedAt).getTime()) / MS_PER_DAY);
  const daysLeft = Math.max(0, Math.min(TRIAL_DAYS, TRIAL_DAYS - elapsedDays));
  return { active: daysLeft > 0, daysLeft, totalDays: TRIAL_DAYS, startedAt };
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
  TRIAL_DAYS, trialStatus,
};
