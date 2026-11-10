import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDossier } from '../renderer/pages/actions/dossier-data.ts';

test('phản hồi NCE: lập mới phải có mã và phiên bản; sửa phải đúng hồ sơ đang mở', () => {
  const view = { record: { id: 'nce-1', row_version: 2 } };
  assert.doesNotThrow(() => assertDossier(view));
  assert.doesNotThrow(() => assertDossier(view, 'nce-1'));
  assert.throws(() => assertDossier(view, 'nce-other'), /không hợp lệ/);
  for (const record of [{}, { id: '' }, { id: 3, row_version: 1 }, { id: 'nce-1' }, { id: 'nce-1', row_version: 0 }, { id: 'nce-1', row_version: 1.5 }]) {
    assert.throws(() => assertDossier({ record }), /không hợp lệ/);
  }
});

test('phản hồi NCE: không nhận envelope lỗi hoặc dữ liệu thiếu như hồ sơ thành công', () => {
  for (const value of [undefined, null, [], true, { ok: true }]) assert.throws(() => assertDossier(value));
  assert.throws(() => assertDossier({ ok: false, error: { message: 'Phiên làm việc đã kết thúc' } }), /Phiên làm việc đã kết thúc/);
});
