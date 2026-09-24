// password-hash.ts không import module nào khác trong main/ (chỉ node:crypto)
// nên test thẳng trên .ts được, không cần bản build — cùng quy ước với
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, verifyPasswordAsync, isPbkdf2Hash, PASSWORD_HASH_ITERATIONS } from '../main/domain/password-hash.ts';

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

assert.equal(PASSWORD_HASH_ITERATIONS, 600000);
assert.ok(stored.startsWith(`pbkdf2$${PASSWORD_HASH_ITERATIONS}$`));

// 5) chuỗi lưu bị hỏng/định dạng lạ phải verify=false, không throw
for (const bad of ['', 'khong-phai-hash', 'pbkdf2$abc$salt$hash', 'md5$1$salt$hash', 'pbkdf2$0$salt$hash']) {
  assert.equal(isPbkdf2Hash(bad) && verifyPassword('bat-ky', bad), false, `chuỗi hỏng "${bad}" không được verify=true`);
  assert.doesNotThrow(() => verifyPassword('bat-ky', bad));
}

// 6) bản bất đồng bộ cho cùng kết luận, và không chặn event loop trong lúc
// băm 600.000 vòng — đó là lý do tồn tại của nó (đường đăng nhập qua LAN).
assert.equal(await verifyPasswordAsync('mat-khau-test-123', stored), true);
assert.equal(await verifyPasswordAsync('sai-mat-khau', stored), false);
let ticked = false;
setImmediate(() => { ticked = true; });
await verifyPasswordAsync('mat-khau-test-123', stored);
assert.equal(ticked, true, 'event loop phải chạy được việc khác trong lúc chờ băm');

// 7) phần hash rỗng sau khi giải mã hex (vd "zz") từng so khớp hai buffer rỗng
// với nhau; cả hai bản phải từ chối.
for (const bad of ['pbkdf2$1$salt$zz', 'khong-phai-hash', 'pbkdf2$0$salt$hash']) {
  assert.equal(verifyPassword('bat-ky', bad), false, `sync: "${bad}"`);
  assert.equal(await verifyPasswordAsync('bat-ky', bad), false, `async: "${bad}"`);
}

console.log('app password-hash tests passed');


