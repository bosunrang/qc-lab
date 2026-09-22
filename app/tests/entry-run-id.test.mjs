import assert from 'node:assert/strict';
import { nextSharedRunId } from '../renderer/lib/entry-run-id.ts';

assert.equal(nextSharedRunId('2026-09-01', [], ['2026-09-01-1']), '2026-09-01-1', 'mức chưa nhập phải lấp lần chạy 1 đang có ở mức khác');
assert.equal(nextSharedRunId('2026-09-01', ['2026-09-01-1'], ['2026-09-01-1', '2026-09-01-2']), '2026-09-01-2', 'mức đã có run 1 phải lấp run 2 đang thiếu');
assert.equal(nextSharedRunId('2026-09-01', ['2026-09-01-1', '2026-09-01-2'], ['2026-09-01-1', '2026-09-01-2']), '2026-09-01-3', 'chỉ khi mọi mức đã đủ mới mở run mới');
console.log('app shared run-id tests passed');
