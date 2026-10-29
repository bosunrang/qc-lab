import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateTeaRef } = require('../../app-dist/main/domain/tea-ref-validation.js');

const BASE = {
  // 'regulation' — khoá hợp lệ trong danh sách ĐÓNG 6 nguồn (TEA_LAB_SOURCES);
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
{
  const levelOnly = validateTeaRef({ ...BASE, labValue: '', levelValues: [{ level: 1, tea: 8.5 }] });
  assert.equal(levelOnly.ok, true, JSON.stringify(levelOnly));
  assert.equal(levelOnly.data.labValue, null);
  assert.equal(levelOnly.data.levelValues[0].tea, 8.5);
}
{
  const invalidLevel = validateTeaRef({ ...BASE, levelValues: [{ level: 1, tea: 0 }] });
  assert.equal(invalidLevel.ok, false);
  assert.equal(invalidLevel.code, 'invalid-level-value');
  const emptyLevel = validateTeaRef({ ...BASE, levelValues: [{ level: 1, tea: 5 }, { level: 3, tea: '' }] });
  assert.equal(emptyLevel.ok, false);
  assert.match(emptyLevel.message, /mức 3/, 'thông báo phải chỉ rõ mức còn trống');
}
{
  const duplicateLevel = validateTeaRef({ ...BASE, levelValues: [
    { level: 1, tea: 8 }, { level: 1, tea: 9 },
  ] });
  assert.equal(duplicateLevel.ok, false);
  assert.equal(duplicateLevel.code, 'duplicate-level');
}

console.log('app tea-ref-validation oracle tests passed');


