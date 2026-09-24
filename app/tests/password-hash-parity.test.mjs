// Chốt rằng PBKDF2 JS thuần dùng ở bản xem trước
// (`main/domain/password-hash-browser.ts`) là PBKDF2-HMAC-SHA256 THẬT, khớp
// `node:crypto`'s `pbkdf2Sync`, và TƯƠNG THÍCH HAI CHIỀU với bản main process.
//
// Vì sao tương thích hai chiều là điều kiện bắt buộc: hai bản dùng số vòng
// khác nhau (600.000 ở main process, 20.000 ở trình duyệt — 600k bằng JS
// thuần mất ~5,3 giây mỗi lần đăng nhập), nhưng số vòng được ghi NGAY TRONG
// chuỗi lưu trữ. Nếu `verifyPassword()` của bên nào đó giả định hằng số của
// chính nó thay vì đọc từ chuỗi, một tài khoản tạo ở bên này sẽ không đăng
// nhập được ở bên kia — lỗi im lặng, chỉ hiện ra là "sai mật khẩu".
import assert from 'node:assert/strict';
import test from 'node:test';
import { pbkdf2Sync } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const nodeImpl = require('../../app-dist/main/domain/password-hash.js');
const browserImpl = require('../../app-dist/main/domain/password-hash-browser.js');

test('PBKDF2 JS thuần khớp node:crypto pbkdf2Sync', () => {
  for (const password of ['abc123', '', 'mật khẩu Tiếng Việt', 'x'.repeat(200), 'p@ss🧪word']) {
    const stored = browserImpl.hashPassword(password);
    const [prefix, iterations, salt, hash] = stored.split('$');
    assert.equal(prefix, 'pbkdf2');
    const expected = pbkdf2Sync(password, salt, Number(iterations), 32, 'sha256').toString('hex');
    assert.equal(hash, expected, `lệch với mật khẩu ${JSON.stringify(password.slice(0, 20))}`);
  }
});

test('số vòng của bản trình duyệt thấp hơn có chủ đích, và được ghi vào chuỗi', () => {
  assert.equal(browserImpl.PASSWORD_HASH_ITERATIONS, 20000);
  assert.equal(nodeImpl.PASSWORD_HASH_ITERATIONS, 600000);
  assert.ok(browserImpl.hashPassword('x').startsWith('pbkdf2$20000$'));
  assert.ok(nodeImpl.hashPassword('x').startsWith('pbkdf2$600000$'));
});

test('tương thích hai chiều giữa hai bản', () => {
  const fromNode = nodeImpl.hashPassword('mật khẩu 600k');
  const fromBrowser = browserImpl.hashPassword('mật khẩu 20k');
  assert.equal(browserImpl.verifyPassword('mật khẩu 600k', fromNode), true, 'browser phải kiểm được hash 600.000 vòng');
  assert.equal(nodeImpl.verifyPassword('mật khẩu 20k', fromBrowser), true, 'main process phải kiểm được hash 20.000 vòng');
  assert.equal(browserImpl.verifyPassword('sai', fromNode), false);
  assert.equal(nodeImpl.verifyPassword('sai', fromBrowser), false);
});

test('salt ngẫu nhiên mỗi lần, cùng mật khẩu ra hash khác nhau', () => {
  const a = browserImpl.hashPassword('trùng nhau');
  const b = browserImpl.hashPassword('trùng nhau');
  assert.notEqual(a, b);
  assert.equal(browserImpl.verifyPassword('trùng nhau', a), true);
  assert.equal(browserImpl.verifyPassword('trùng nhau', b), true);
});

test('từ chối chuỗi lưu trữ hỏng, không ném lỗi', () => {
  for (const bad of ['', 'x', 'pbkdf2$$$', 'pbkdf2$0$aa$bb', 'pbkdf2$abc$aa$bb', 'md5$1$aa$bb',
                     'pbkdf2$1000$aa$zz', 'pbkdf2$1000$aa$abc', null, undefined]) {
    assert.equal(browserImpl.verifyPassword('bất kỳ', bad), false, `phải từ chối ${JSON.stringify(bad)}`);
    assert.equal(nodeImpl.verifyPassword('bất kỳ', bad), false, `bản node phải từ chối ${JSON.stringify(bad)}`);
  }
});

test('isPbkdf2Hash khớp nhau giữa hai bản', () => {
  const cases = ['pbkdf2$20000$ab$cd', 'pbkdf2$600000$ab$cd', 'nope', '', 'pbkdf2$x$ab$cd'];
  for (const c of cases) assert.equal(browserImpl.isPbkdf2Hash(c), nodeImpl.isPbkdf2Hash(c), c);
});


