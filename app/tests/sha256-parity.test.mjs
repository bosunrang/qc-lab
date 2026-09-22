// Chốt rằng bản SHA-256 JS thuần dùng trong trình duyệt
// (`main/domain/sha256-browser.ts`) cho ra hash GIỐNG HỆT bản `node:crypto`
// dùng ở main process (`main/domain/sha256.ts`).
//
// Đây là bài test quan trọng nhất của bước 2 (gỡ bản giả lập viết tay): nếu
// hai bản lệch dù chỉ một bit thì chuỗi hash tamper-evident của nhật ký hoạt
// động tạo ở bản xem trước sẽ KHÔNG verify được ở bản Electron thật, và
// ngược lại — một lệch âm thầm, không có gì trên giao diện báo.
//
// `node:crypto` được dùng làm ORACLE (nguồn đúng), không phải so hai bản tự
// viết với nhau.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { sha256Hex: nodeSha256 } = require('../../app-dist/main/domain/sha256.js');
const { sha256Hex: browserSha256 } = require('../../app-dist/main/domain/sha256-browser.js');
const { auditEntryHash, verifyAuditChain, relinkAuditChain } = require('../../app-dist/main/domain/audit-chain.js');

function oracle(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

test('vector chuẩn FIPS/NIST', () => {
  assert.equal(browserSha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(browserSha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(
    browserSha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  );
});

test('khớp node:crypto trên mọi lớp input đáng lo', () => {
  const cases = [
    '',
    'a',
    'abc',
    // Tiếng Việt nhiều byte — chuỗi audit thật của app này toàn tiếng Việt.
    'Nhập QC',
    'Điểm QC mức 1, ngày 2026-09-09, giá trị 109.5',
    'Máy Hóa sinh AU680 · Khoa Xét nghiệm · Bệnh viện Đa khoa',
    'Hủy điểm QC · Lý do: Kết quả QC thực tế không hợp lệ',
    // Emoji (4 byte UTF-8, surrogate pair trong JS).
    'kết quả 🧪 đạt',
    // Đúng biên block: 55/56/57 byte là 3 nhánh đệm khác nhau.
    'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(57),
    'x'.repeat(63), 'x'.repeat(64), 'x'.repeat(65),
    // Dài hơn nhiều block.
    'y'.repeat(1000),
    'Ế'.repeat(200),
    // Ký tự điều khiển + dấu ngoặc kép, xuất hiện thật trong canonical JSON.
    '{"detail":"a\\"b","ts":"2026-09-09T01:02:03.000Z"}\n\t',
  ];
  for (const input of cases) {
    const expected = oracle(input);
    assert.equal(browserSha256(input), expected, `bản browser lệch với input ${JSON.stringify(input.slice(0, 40))}`);
    assert.equal(nodeSha256(input), expected, `bản node lệch với input ${JSON.stringify(input.slice(0, 40))}`);
  }
});

test('khớp trên input ngẫu nhiên (mọi độ dài 0..300)', () => {
  // Quét biên đệm một cách hệ thống thay vì chỉ vài mẫu chọn tay.
  const alphabet = 'aáàâãäbcđeéèêiíoóôơuúưyýỳ0123456789 ·—"\\n\t{}[]:,';
  let seed = 20260909;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let len = 0; len <= 300; len++) {
    let s = '';
    for (let i = 0; i < len; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
    assert.equal(browserSha256(s), oracle(s), `lệch ở độ dài ${len}`);
  }
});

test('chuỗi audit vẫn verify được — dùng qua audit-chain thật', () => {
  // Không chỉ so hàm băm: chốt cả đường mà writeAudit() thật đi qua.
  const rows = relinkAuditChain([
    { id: 'a1', seq: 1, ts: '2026-09-09T01:00:00.000Z', user: 'Quản trị', username: 'admin', userId: 'u1', role: 'admin', type: 'Nhập QC', detail: 'Điểm QC mức 1, giá trị 109.5', target: 'Natri (Na)', clientId: 'c1', prevHash: '', hash: 'x' },
    { id: 'a2', seq: 2, ts: '2026-09-09T01:05:00.000Z', user: 'Quản trị', username: 'admin', userId: 'u1', role: 'admin', type: 'Hủy điểm QC', detail: 'Lý do: nhập sai · Máy Hóa sinh', target: 'Natri (Na)', clientId: 'c1', prevHash: '', hash: 'x' },
  ], '');
  const result = verifyAuditChain(rows, '');
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.checked, 2);
  // Hash phải khớp đúng công thức tính bằng oracle, không chỉ "tự nhất quán".
  assert.equal(rows[0].hash, auditEntryHash(rows[0]));
  assert.equal(rows[1].prevHash, rows[0].hash);

  // Sửa một ký tự trong nội dung tiếng Việt phải phá chuỗi.
  const tampered = rows.map((r, i) => (i === 0 ? { ...r, detail: r.detail.replace('109.5', '109.6') } : r));
  assert.equal(verifyAuditChain(tampered, '').ok, false);
});
