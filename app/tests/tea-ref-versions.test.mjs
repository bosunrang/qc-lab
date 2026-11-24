// N8 (2026-11-03): hồ sơ TEa của PXN là căn cứ của cổng lập dải và ngoại kiểm,
// nên mỗi lần lưu/xoá giữ lại một phiên bản (ISO 15189:2022 8.3), và ngày
// hiệu lực không được sau hôm nay vì chỉ có một phiên bản hiện hành.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { must } from './helpers/nce-flow.mjs';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { validateTeaRef } = require('../../app-dist/main/domain/tea-ref-validation.js');
const { isoLocalDate } = require('../../app-dist/main/domain/local-date.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
const today = isoLocalDate();
const profile = (over = {}) => ({
  analyteId: 'qclab-sodium', name: 'Sodium', unit: 'mmol/L', labValue: '2.9', labSource: 'regulation', reference: 'CLIA 2024',
  reason: 'Áp dụng tiêu chí CLIA cho Natri', effectiveDate: '2026-01-01', approvedDate: '2026-01-01', nextReviewDate: '2027-01-01',
  preparedBy: 'KTV A', approvedBy: 'Trưởng khoa', ...over,
});

test('ngày hiệu lực không được sau hôm nay', () => {
  assert.equal(validateTeaRef(profile({ effectiveDate: '2026-06-02', approvedDate: '2026-06-01', nextReviewDate: '' }), '2026-06-01').code, 'effective-in-future');
  assert.equal(validateTeaRef(profile({ effectiveDate: '2026-06-01', approvedDate: '2026-06-01', nextReviewDate: '' }), '2026-06-01').ok, true);
});

test('mỗi lần lưu và xoá ghi một phiên bản', () => {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const ref = must(config.saveTeaRef({ data: profile() }, actor), 'lập hồ sơ');
  assert.deepEqual(ref.lab_versions.map((v) => [v.action, v.lab, v.saved_by]), [['save', 2.9, 'Quản trị']]);

  const again = must(config.saveTeaRef({ id: ref.id, data: profile() }, actor), 'lưu lại y nguyên');
  assert.equal(again.lab_versions.length, 1, 'không đổi gì thì không có phiên bản mới');

  const edited = must(config.saveTeaRef({ id: ref.id, data: profile({ labValue: '', levelValues: [{ level: 1, tea: 3.1 }, { level: 2, tea: 2.6 }], reason: 'Khai riêng theo mức QC' }) }, actor), 'sửa');
  assert.equal(edited.lab_versions.length, 2);
  const [first, second] = edited.lab_versions;
  assert.equal(first.lab, 2.9, 'phiên bản cũ giữ nguyên giá trị cũ');
  assert.deepEqual([second.lab, second.levels], [null, [{ level: 1, tea: 3.1 }, { level: 2, tea: 2.6 }]]);
  assert.equal(JSON.parse(second.sources_json).reason, 'Khai riêng theo mức QC');

  must(config.removeTeaLabProfile({ id: ref.id }, actor), 'xoá TEa PXN');
  // Hồ sơ không còn ghi đè CLIA/Ricos nên dòng bị xoá hẳn; lập lại cho cùng
  // analyte vẫn thấy toàn bộ lịch sử.
  const recreated = must(config.saveTeaRef({ data: profile({ labValue: '3', reason: 'Lập lại sau khi xem xét' }) }, actor), 'lập lại');
  assert.notEqual(recreated.id, ref.id);
  assert.deepEqual(recreated.lab_versions.map((v) => v.action), ['save', 'save', 'remove', 'save']);
});

test('hồ sơ có từ trước khi lưu phiên bản được chụp làm phiên bản gốc', () => {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  db.prepare(`INSERT INTO tea_refs(id,analyte_id,name,lab,lab_source,lab_prepared_by,sources_json)
    VALUES ('old','qclab-sodium','Sodium',0.73,'ricos','KTV cũ',?)`).run(JSON.stringify({ reference: 'Ricos', reason: 'Dùng từ trước', effectiveDate: '2025-01-01', approvedDate: '2025-01-01', approvedBy: 'X' }));
  const saved = must(config.saveTeaRef({ id: 'old', data: profile() }, actor), 'sửa hồ sơ cũ');
  assert.deepEqual(saved.lab_versions.map((v) => [v.action, v.lab, v.saved_at === '']), [['baseline', 0.73, true], ['save', 2.9, false]]);
});

test('lịch sử phiên bản không làm bộ nhớ đệm Westgard bỏ kết quả', () => {
  const { SUMMARY_IGNORED_TABLES } = require('../../app-dist/main/ipc/summary-cache.js');
  const { PREVIOUS_LOT_IGNORED_TABLES } = require('../../app-dist/main/ipc/previous-lot-cache.js');
  assert.equal(SUMMARY_IGNORED_TABLES.has('tea_ref_versions'), true);
  assert.equal(PREVIOUS_LOT_IGNORED_TABLES.has('tea_ref_versions'), true);
  assert.ok(today);
});
