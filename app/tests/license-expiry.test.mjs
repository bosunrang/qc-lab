import assert from 'node:assert/strict';
import test from 'node:test';
import { presentLicenseExpiry } from '../renderer/lib/license-expiry.ts';

const active = (expires_at) => ({ state: 'active', expires_at });
test('hạn dùng: chỉ hiển thị giấy phép hợp lệ, vĩnh viễn không cảnh báo', () => {
  assert.equal(presentLicenseExpiry(null), null);
  for (const state of ['development', 'required', 'expired', 'invalid', 'unavailable']) assert.equal(presentLicenseExpiry({ state, expires_at: null }), null);
  assert.equal(presentLicenseExpiry(active(null)).label, 'Hạn dùng: Vĩnh viễn');
  assert.equal(presentLicenseExpiry(active(null)).notice, null);
  assert.equal(presentLicenseExpiry(active('sai ngày')), null);
});
test('hạn dùng: cảnh báo đúng biên 7 ngày lịch Việt Nam, không làm tròn lên thành 8', () => {
  const expiry = active('2026-11-19T16:59:59.999Z');
  assert.equal(presentLicenseExpiry(expiry, Date.parse('2026-11-11T16:59:59.999Z')).daysLeft, 8);
  assert.equal(presentLicenseExpiry(expiry, Date.parse('2026-11-11T16:59:59.999Z')).notice, null);
  const seven = presentLicenseExpiry(expiry, Date.parse('2026-11-11T17:00:00.000Z'));
  assert.equal(seven.label, 'Hạn dùng: 19/11/2026'); assert.equal(seven.daysLeft, 7);
  assert.match(seven.notice, /còn 7 ngày/);
});
test('hạn dùng: hôm nay và trạng thái đang chờ main cập nhật không hiển thị số ngày âm', () => {
  const expiry = active('2026-11-19T16:59:59.999Z');
  assert.match(presentLicenseExpiry(expiry, Date.parse('2026-11-19T00:00:00.000Z')).notice, /hết hạn hôm nay/);
  const ended = presentLicenseExpiry(expiry, Date.parse('2026-11-19T17:00:00.000Z'));
  assert.equal(ended.daysLeft, 0); assert.match(ended.notice, /đã hết hạn/);
  // Thời điểm UTC sang ngày mới tại Việt Nam vẫn phải hiện đúng ngày địa phương.
  assert.equal(presentLicenseExpiry(active('2026-11-18T18:00:00.000Z'), Date.parse('2026-11-18T00:00:00.000Z')).label, 'Hạn dùng: 19/11/2026');
});
