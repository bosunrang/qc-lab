import assert from 'node:assert/strict';
import { latestNceSigmaBias } from '../main/domain/nce-bias-suggestion.ts';

const periods = [
  { period: '2026-03', levels: [{ level: 1, biasEqa: 4.2 }, { level: 2, biasEqa: 2.1 }] },
  { period: '2026-05', levels: [{ level: 1, biasEqa: 1.8 }, { level: 2, biasEqa: null }] },
];

assert.deepEqual(latestNceSigmaBias(periods, 1), { value: 1.8, period: '2026-05' }, 'lấy Bias EQA của đúng mức ở kỳ mới nhất');
assert.equal(latestNceSigmaBias(periods, 2), null, 'kỳ mới nhất chưa có Bias thì không lùi về kỳ cũ');
assert.equal(latestNceSigmaBias(periods, 0), null, 'mức QC không hợp lệ không được gợi ý');
console.log('app nce-bias-suggestion tests passed');
