// Mô hình hiển thị trang Khắc phục sự cố (`main/domain/nce/presentation.ts`).
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  filterNceRecords, nceFilterCounts, nceHistory, nceRerunOptions, nceRiskText, nceRunLabel, nceSteps,
} = require('../../app-dist/main/domain/nce/presentation.js');

const rec = (over) => ({ id: over.id, status: 'open', owner_user_id: 'u-o', reported_by_user_id: 'u-r', overdue_days: 0, overdue_actions: 0, ...over });

test('thẻ lọc danh sách hồ sơ', () => {
  const records = [
    rec({ id: 'a', status: 'open', owner_user_id: 'me' }),
    rec({ id: 'b', status: 'released', reported_by_user_id: 'me', overdue_actions: 1 }),
    rec({ id: 'c', status: 'pending_approval', overdue_days: 2 }),
    rec({ id: 'd', status: 'closed', owner_user_id: 'me' }),
    rec({ id: 'e', status: 'cancelled' }),
  ];
  const ids = (filter) => filterNceRecords(records, filter, 'me').map((r) => r.id);
  assert.deepEqual(ids('active'), ['a', 'b', 'c']);
  assert.deepEqual(ids('mine'), ['a', 'b'], 'hồ sơ đã đóng của tôi không còn là việc phải làm');
  assert.deepEqual(ids('approve'), ['c']);
  assert.deepEqual(ids('overdue'), ['b', 'c'], 'quá hạn gồm cả hồ sơ có hành động quá hạn');
  assert.deepEqual(ids('closed'), ['d', 'e']);
  assert.equal(ids('all').length, 5);
  assert.deepEqual(nceFilterCounts(records, 'me'), { active: 3, mine: 2, approve: 1, overdue: 2, closed: 2, all: 5 });
});

test('ứng viên lần rerun: sau lần hỏng muộn nhất, bỏ điểm đã hủy, mới nhất trước', () => {
  const p = (date, run_id, level, voided = 0) => ({ date, run_id, level, voided });
  const points = [p('2026-09-02', 'r1', 1), p('2026-09-02', 'r2', 1), p('2026-09-02', 'r2', 2), p('2026-09-02', 'r10', 1), p('2026-09-03', 'r1', 2, 1), p('2026-09-01', 'r9', 1)];
  const options = nceRerunOptions(points, [{ date: '2026-09-02', runId: 'r1' }, { date: '2026-09-02', runId: 'r2' }], '2026-09-02');
  assert.deepEqual(options.map((o) => o.label), ['02/09/2026 · lần r10'], 'r10 sau r2 theo thứ tự tự nhiên; lần chỉ có điểm đã hủy không vào');
  const verify = nceRerunOptions(points, [], '2026-09-02');
  assert.deepEqual(verify.map((o) => `${o.runId}:${o.levels.join('')}`), ['r10:1', 'r2:12', 'r1:1'], 'không có lần hỏng: từ ngày phát hiện');
});

test('thanh bước theo trạng thái', () => {
  const states = (status) => nceSteps(status).map((s) => s.state).join(',');
  assert.equal(states('open'), 'done,current,todo,todo');
  assert.equal(states('released'), 'done,done,current,todo');
  assert.equal(states('pending_approval'), 'done,done,done,current');
  assert.equal(states('closed'), 'done,done,done,done');
  assert.equal(states('cancelled'), 'todo,todo,todo,todo');
});

test('lịch sử hồ sơ: quyết định và lần sửa, mới nhất trước, đọc ra nhãn', () => {
  const history = nceHistory({
    decisions: [
      { id: 'd1', type: 'release', payload_json: JSON.stringify({ reason: 'QC đạt', rerun: { date: '2026-09-03', runId: '1' } }), actor_name: 'Trưởng ca', decided_at: '2026-09-03T03:00:00Z' },
      { id: 'd2', type: 'patient_impact', payload_json: JSON.stringify({ outcome: 'not_reported' }), actor_name: 'KTV', decided_at: '2026-09-02T03:00:00Z' },
    ],
    revisions: [{ id: 'r1', changes_json: JSON.stringify({ riskSeverity: [0, 3], 'action:x': [null, {}] }), actor_name: 'KTV', at: '2026-09-04T01:00:00Z' }],
  });
  assert.deepEqual(history.map((h) => h.title), ['Cập nhật hồ sơ', 'Cho phép hoạt động trở lại', 'Đánh giá ảnh hưởng bệnh nhân']);
  assert.equal(history[0].detail, 'sửa mức độ nghiêm trọng, thêm hành động');
  assert.equal(history[1].detail, 'rerun 03/09/2026 · lần 1 · QC đạt');
  assert.match(history[2].detail, /Chưa trả kết quả/);
});

test('nhãn lần chạy và điểm nguy cơ', () => {
  assert.equal(nceRunLabel({ date: '2026-10-12', runId: '3' }), '12/10/2026 · lần 3');
  assert.equal(nceRunLabel({ date: '2026-10-12', runId: '' }), '12/10/2026');
  assert.equal(nceRiskText(3, 2), '6');
  assert.equal(nceRiskText(0, 2), '—');
});
