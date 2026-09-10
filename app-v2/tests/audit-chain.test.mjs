// Oracle: xác nhận auditSha256/auditEntryHash/verifyAuditChain/relinkAuditChain
// mới (dùng node:crypto) cho ra CÙNG hash với bản cũ (assets/core.js, SHA-256
// tự viết tay bằng JS) trên cùng input — quan trọng vì nếu hash khác nhau,
// nhật ký audit cũ sẽ không verify được nếu có ngày cần chuyển dữ liệu.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Đọc bản ĐÃ BUILD thay vì import thẳng `.ts`: từ 2026-09-09 `audit-chain.ts`
// import `./sha256` (tách `node:crypto` ra để bản xem trước trình duyệt thay
// được bằng bản JS thuần — xem sha256.ts/sha256-browser.ts), mà Node's ESM
// type-stripping không resolve được import không có đuôi file kiểu CommonJS.
// Đây đúng là quy ước mà phần lớn test app-v2 đã dùng.
const {
  auditCanonical, auditSha256, auditEntryHash, verifyAuditChain, relinkAuditChain, lastHashOf,
} = require('../../app-v2-dist/main/domain/audit-chain.js');
const QCCore = require('../../assets/core.js');

// 1) canonicalJSON phải khớp bản cũ hệt nhau cho nhiều shape khác nhau.
const samples = [
  { b: 2, a: 1, c: [3, 2, 1] },
  { nested: { z: 1, a: 2 }, arr: [{ y: 1, x: 2 }] },
  null, 42, 'chuỗi có dấu tiếng Việt: Đông máu',
  [],
  {},
];
for (const s of samples) {
  assert.equal(auditCanonical(s), QCCore.auditCanonical(s), `auditCanonical lệch với bản cũ cho input ${JSON.stringify(s)}`);
}

// 2) sha256 phải khớp bản cũ cho nhiều chuỗi khác nhau (kể cả input rỗng, unicode).
const strings = ['', 'a', 'hello world', 'Đông máu — Đơn vị đo D-Dimer', '{"a":1,"b":[1,2,3]}'];
for (const s of strings) {
  assert.equal(auditSha256(s), QCCore.auditSha256(s), `auditSha256 lệch với bản cũ cho chuỗi "${s}"`);
}

// 3) Một chuỗi hash-chain thật: tạo entry nối tiếp bằng CẢ hai bản, hash phải khớp từng dòng.
let prevOld = '', prevNew = '';
const entriesOld = [], entriesNew = [];
for (let i = 0; i < 5; i++) {
  const payload = { id: 'e' + i, seq: i + 1, ts: '2026-08-31T0' + i + ':00:00.000Z', user: 'KTV A', username: 'ktv-a', userId: 'u1', role: 'technician', type: 'Nhập QC', detail: 'Điểm ' + i, target: 'Test', clientId: 'c1' };
  const entryOld = { ...payload, prevHash: prevOld };
  entryOld.hash = QCCore.auditEntryHash(entryOld);
  entriesOld.push(entryOld);
  prevOld = entryOld.hash;

  const entryNew = { ...payload, prevHash: prevNew };
  entryNew.hash = auditEntryHash(entryNew);
  entriesNew.push(entryNew);
  prevNew = entryNew.hash;
}
for (let i = 0; i < 5; i++) {
  assert.equal(entriesNew[i].hash, entriesOld[i].hash, `entry ${i}: hash mới lệch với bản cũ`);
}

// 4) verifyAuditChain phải xác nhận đúng chuỗi hợp lệ, và bắt đúng khi có dòng bị sửa.
const verify1 = verifyAuditChain(entriesNew, '');
assert.equal(verify1.ok, true, 'chuỗi hợp lệ phải verify OK');
assert.equal(verify1.checked, 5);

const tampered = entriesNew.map((e, i) => i === 2 ? { ...e, detail: 'BỊ SỬA' } : e);
const verify2 = verifyAuditChain(tampered, '');
assert.equal(verify2.ok, false, 'chuỗi bị sửa phải verify FAIL');
assert.equal(verify2.brokenIndex, 2);

// 5) relinkAuditChain trên cùng thứ tự phải tái tạo đúng hash gốc.
const relinked = relinkAuditChain(entriesNew.map(e => ({ ...e })), '');
for (let i = 0; i < 5; i++) assert.equal(relinked[i].hash, entriesNew[i].hash, `relink dòng ${i} phải cho lại đúng hash cũ`);

assert.equal(lastHashOf(entriesNew), entriesNew[4].hash, 'lastHashOf phải trả hash của dòng cuối có hash');

console.log('app-v2 audit-chain oracle tests passed');
