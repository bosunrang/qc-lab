import assert from 'node:assert/strict';
import test from 'node:test';
import { decisionPayload } from '../renderer/pages/actions/decision-data.ts';

test('quyết định NCE: giữ nguyên nội dung và bằng chứng đã chụp', () => {
  const data = { result: 'effective', evidence: 'Đối chiếu nhật ký QC', coverage: { date: '2026-11-10', runIds: ['1', '2'] } };
  const row = { payload_json: JSON.stringify(data) };
  assert.deepEqual(decisionPayload(row), data);
  assert.equal(row.payload_json, JSON.stringify(data));
});

test('quyết định NCE: JSON rỗng, lỗi hoặc khác dạng không làm vỡ phần xem hồ sơ', () => {
  for (const payload_json of ['', '{dang-do', 'null', 'false', '42', '"chuỗi"', '[]', '[{"result":"effective"}]']) {
    assert.deepEqual(decisionPayload({ payload_json }), {}, payload_json);
  }
});
