// password-hash.ts không import module nào khác trong main/ (chỉ node:crypto)
// nên test thẳng trên .ts được, không cần bản build — cùng quy ước với
// westgard-rules.test.mjs/audit-chain.test.mjs.
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, isPbkdf2Hash, PASSWORD_HASH_ITERATIONS } from '../main/domain/password-hash.ts';

// 1) hash roundtrip đúng
const stored = hashPassword('mat-khau-test-123');
assert.ok(isPbkdf2Hash(stored), `chuỗi lưu phải đúng định dạng pbkdf2$iter$salt$hash: ${stored}`);
assert.equal(verifyPassword('mat-khau-test-123', stored), true);

// 2) sai mật khẩu phải bị từ chối
assert.equal(verifyPassword('sai-mat-khau', stored), false);

// 3) 2 lần hash CÙNG 1 mật khẩu phải cho 2 chuỗi khác nhau (salt ngẫu nhiên
// mỗi lần) nhưng cả hai đều verify đúng mật khẩu gốc.
const stored2 = hashPassword('mat-khau-test-123');
assert.notEqual(stored, stored2, 'salt ngẫu nhiên mỗi lần hash phải cho chuỗi khác nhau');
assert.equal(verifyPassword('mat-khau-test-123', stored2), true);

// 4) số vòng lặp đúng chính sách OWASP tối thiểu (khớp bản cũ)
assert.equal(PASSWORD_HASH_ITERATIONS, 600000);
assert.ok(stored.startsWith(`pbkdf2$${PASSWORD_HASH_ITERATIONS}$`));

// 5) chuỗi lưu bị hỏng/định dạng lạ phải verify=false, không throw
for (const bad of ['', 'khong-phai-hash', 'pbkdf2$abc$salt$hash', 'md5$1$salt$hash', 'pbkdf2$0$salt$hash']) {
  assert.equal(isPbkdf2Hash(bad) && verifyPassword('bat-ky', bad), false, `chuỗi hỏng "${bad}" không được verify=true`);
  assert.doesNotThrow(() => verifyPassword('bat-ky', bad));
}

console.log('app-v2 password-hash tests passed');
