import assert from 'node:assert/strict';
import test from 'node:test';
import { nceIssuePoints } from '../renderer/view-models/nce-issues-view-model.ts';

const summary = (latestVerdict = 'ok') => [{
  testId: 'na', testName: 'Sodium (Na)', instrumentName: 'Máy A', unit: 'mmol/L', decimalPlaces: 2,
  levels: [{ level: 1, mean: 140, sd: 2, qcLotId: 'lot-1', lot: '1101', exp: '', worstVerdict: 'rej', latestVerdict, latestRules: [], pointCount: 2, todayPointCount: 0, cv: null, latest: { id: 'rerun', date: '2026-09-04', runId: '2', val: 140.1 } }],
}];

const rejected = { id: 'failed', test_id: 'na', level: 1, date: '2026-09-04', run_id: '1', val: 148.3, note: '', operator_name: '', voided: 0, void_reason: '', verdict: 'rej', rules: ['1-3s'], lot: '1101' };
const rerun = { ...rejected, id: 'rerun', run_id: '2', val: 140.1, verdict: 'ok', rules: [] };

test('lần chạy lại đạt không xoá lần bị loại khỏi hàng đợi lập NCE', () => {
  const issues = nceIssuePoints(summary(), [rejected, rerun], []);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].point.id, 'failed');
  assert.equal(issues[0].openRecord, null);
});

test('chỉ hồ sơ NCE được duyệt mới khép hàng đợi của đúng điểm vi phạm', () => {
  const pending = { id: 'nce-1', point_id: 'failed', record_status: 'active', approval_status: 'pending', created_at: '2026-09-04T09:00:00Z' };
  const open = nceIssuePoints(summary(), [rejected, rerun], [pending]);
  assert.equal(open.length, 1);
  assert.equal(open[0].openRecord?.id, 'nce-1');

  const approved = { ...pending, approval_status: 'approved' };
  assert.deepEqual(nceIssuePoints(summary(), [rejected, rerun], [approved]), []);
});
