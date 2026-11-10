// Lời nhắc cho checklist "Kiểm tra nhanh" từ dữ liệu sẵn có (đánh giá giao
// diện 09/11/2026): lô QC của lần khởi đầu đã/sắp hết hạn, hoặc mới bắt đầu
// dùng ngay trước sự cố. Chỉ nhắc, không tự chọn kết quả checklist.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { ensureUser, must, createIqcNce } from './helpers/nce-flow.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { nceChecklistHints } = require('../../app-dist/main/domain/nce/checklist-hints.js');

const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 't' };

test('hàm thuần: lô hết hạn, sắp hết hạn và lô mới dùng gần đây', () => {
  assert.deepEqual(nceChecklistHints('2026-10-10', [{ lotNo: 'A', exp: '2026-10-01', firstUsed: '2026-01-01' }]),
    { qcMaterial: 'Lô QC A đã hết hạn ngày 01/10/2026, trước ngày sự cố.' });
  assert.match(nceChecklistHints('2026-10-10', [{ lotNo: 'B', exp: '2026-10-20', firstUsed: '2026-01-01' }]).qcMaterial, /còn 10 ngày/);
  assert.match(nceChecklistHints('2026-10-10', [{ lotNo: 'C', exp: '', firstUsed: '2026-10-03' }]).lotChange, /mới bắt đầu dùng từ 03\/10\/2026 \(7 ngày trước sự cố\)/);
  assert.deepEqual(nceChecklistHints('2026-10-10', [{ lotNo: 'D', exp: '2027-06-30', firstUsed: '2026-05-01' }]), {}, 'lô ổn định, còn hạn xa: không nhắc');
});

test('hồ sơ IQC thật: nhắc ở đúng mục khi lô QC mới dùng và sắp hết hạn; không tự chọn kết quả', (t) => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  ensureUser(db, admin);
  const config = createConfigHandlers(db), entry = createEntryHandlers(db), nce = createNceHandlers(db);
  const instrument = config.saveInstrument({ data: { name: 'Máy A' } }, admin).data;
  const assay = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, admin).data;
  for (const level of [1, 2]) config.saveTestLevel({ testId: assay.id, data: { level, mean: 100, sd: 2 } }, admin);
  makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: [{ level: 1, lotNo: 'LOT-MOI' }, { level: 2, lotNo: 'LOT-CU' }] });
  db.prepare("UPDATE qc_lots SET exp='2026-09-30' WHERE lot_no='LOT-MOI'").run();
  for (const [date, z] of [['2026-09-20', 0], ['2026-09-21', 3.5]]) {
    for (const level of [1, 2]) must(entry.addPoint({ data: { testId: assay.id, level, date, runId: `${date}-1`, val: 100 + (level === 1 ? z : 0) * 2 } }, admin), `${date} M${level}`);
  }
  const dossier = createIqcNce(nce, admin, assay.id, { date: '2026-09-21', runId: '2026-09-21-1' });
  assert.match(dossier.checklist_hints.qcMaterial, /Lô QC LOT-MOI hết hạn ngày 30\/09\/2026 \(còn 9 ngày/);
  assert.match(dossier.checklist_hints.lotChange, /LOT-MOI mới bắt đầu dùng từ 20\/09\/2026/);
  const checklist = JSON.parse(dossier.record.checklist_json || '{}');
  assert.ok(Object.values(checklist).every((item) => !item.status), 'lời nhắc không tự chọn kết quả checklist');
});
