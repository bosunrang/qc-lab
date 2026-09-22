// Oracle test cho tab "Bảng TEa tham chiếu" — 6 điều kiện bắt buộc y hệt thứ
// tự kiểm tra của teaLabProfileSave() bản cũ, xem CLAUDE.md.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateTeaRef } = require('../../app-dist/main/domain/tea-ref-validation.js');

const BASE = {
  // 'regulation' — khoá hợp lệ trong danh sách ĐÓNG 6 nguồn (TEA_LAB_SOURCES);
  // 'CLIA 2024' (chuỗi tự do trước đây) giờ bị chặn bởi cổng 'invalid-source'.
  name: 'Glucose', labValue: 10, labSource: 'regulation', reference: 'CLIA 2024 final rule',
  reason: 'Áp dụng theo quy định mới nhất của CLIA', effectiveDate: '2026-01-01',
  approvedDate: '2025-12-15', nextReviewDate: '2027-01-01', preparedBy: 'KTV A', approvedBy: 'Trưởng khoa B',
};

{
  const missingValue = validateTeaRef({ ...BASE, labValue: 0 });
  assert.equal(missingValue.ok, false);
  assert.equal(missingValue.code, 'invalid-value');
}
{
  const missingSource = validateTeaRef({ ...BASE, labSource: '' });
  assert.equal(missingSource.ok, false);
  assert.equal(missingSource.code, 'missing-source');
}
{
  // Danh sách ĐÓNG 6 nguồn (port `TEA_LAB_BASIS_SOURCES` app cũ) — một chuỗi
  // tự do không nằm trong đó (kể cả không rỗng) phải bị chặn riêng, khác
  // 'missing-source' (rỗng).
  const invalidSource = validateTeaRef({ ...BASE, labSource: 'CLIA 2024' });
  assert.equal(invalidSource.ok, false);
  assert.equal(invalidSource.code, 'invalid-source');
}
{
  const shortRef = validateTeaRef({ ...BASE, reference: 'ab' });
  assert.equal(shortRef.ok, false);
  assert.equal(shortRef.code, 'invalid-reference');
}
{
  const shortReason = validateTeaRef({ ...BASE, reason: 'qua ngan' });
  assert.equal(shortReason.ok, false);
  assert.equal(shortReason.code, 'invalid-reason');
}
{
  const approvedAfter = validateTeaRef({ ...BASE, approvedDate: '2026-02-01' });
  assert.equal(approvedAfter.ok, false);
  assert.equal(approvedAfter.code, 'approved-after-effective', 'ngày duyệt không được sau ngày hiệu lực');
}
{
  const reviewBefore = validateTeaRef({ ...BASE, nextReviewDate: '2025-01-01' });
  assert.equal(reviewBefore.ok, false);
  assert.equal(reviewBefore.code, 'review-before-effective');
}
{
  const missingSignoff = validateTeaRef({ ...BASE, approvedBy: '' });
  assert.equal(missingSignoff.ok, false);
  assert.equal(missingSignoff.code, 'missing-signoff');
}
{
  const ok = validateTeaRef(BASE);
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(ok.data.name, 'Glucose');
}

console.log('app tea-ref-validation oracle tests passed');
