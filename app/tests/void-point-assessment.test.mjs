import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { nceErrorClass } = require('../../app-dist/main/domain/nce/tier.js');
const actor = { userId: 'void-user', username: 'void-admin', name: 'Người kiểm tra', role: 'admin', clientId: 'void-test' };
const must = (result) => { assert.equal(result.ok, true, JSON.stringify(result)); return result.data; };

function fixture(t) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const config = createConfigHandlers(db), entry = createEntryHandlers(db), nce = createNceHandlers(db);
  const machine = must(config.saveInstrument({ data: { name: 'Máy phân loại' } }, actor));
  const assay = must(config.saveTest({ data: { name: 'Xét nghiệm phân loại', instrumentId: machine.id } }, actor));
  for (const [level, mean] of [[1, 100], [2, 200]]) must(config.saveTestLevel({ testId: assay.id, data: { level, mean, sd: 1 } }, actor));
  const operation = makeOperationalQc(db, { testId: assay.id, instrumentId: machine.id,
    assignments: [{ level: 1, lotNo: 'CLASS-L1' }, { level: 2, lotNo: 'CLASS-L2' }] });
  const add = (id, level, date, val, run = '1', lot = `CLASS-L${level}`) => db.prepare(`INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd)
    VALUES (?,?,?,?,?,?,?,?,1)`).run(id, assay.id, level, date, run, val, lot, level === 1 ? 100 : 200);
  const assessment = (id) => must(entry.getVoidPointAssessment(id));
  return { db, config, entry, nce, assay, operation, add, assessment };
}

test('huỷ điểm: phân loại theo mức khác cùng lần chạy và giữ nguyên căn cứ trong NCE', (t) => {
  const f = fixture(t);
  f.add('good', 1, '2026-10-01', 100);
  f.add('bad', 2, '2026-10-01', 204);
  f.add('next-day', 1, '2026-10-02', 100);
  const before = f.db.prepare('SELECT COUNT(*) AS n FROM activity').get().n;
  assert.deepEqual(f.assessment('good'), { error_class: 'RE', rules: ['1-3s'], run_rejected: true, rejected_levels: [2] });
  assert.equal(f.assessment('next-day').error_class, '', 'trùng mã run khác ngày không được ghép');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM activity').get().n, before, 'xem trước không ghi dữ liệu');
  const saved = must(f.entry.voidPoint({ data: { pointId: 'good', kind: 'analytical', reason: 'Huỷ để đối chiếu bằng chứng từ máy.' } }, actor));
  const record = f.nce.listNce().find((r) => r.nce_id === saved.nceId);
  assert.equal(record.error_class, 'RE');
  assert.equal(f.entry.getVoidPointAssessment('good').error.code, 'already-voided');
  assert.equal(f.entry.getVoidPointAssessment('missing').error.code, 'not-found');
});

test('huỷ điểm: luật chuỗi SE và thiếu căn cứ không bị suy thành RE', (t) => {
  const f = fixture(t);
  f.add('warn', 1, '2026-10-01', 102.5);
  assert.deepEqual(f.assessment('warn'), { error_class: '', rules: [], run_rejected: false, rejected_levels: [] });
  f.add('systematic', 1, '2026-10-02', 102.5);
  assert.equal(f.assessment('systematic').error_class, 'SE');
  assert.deepEqual(f.assessment('systematic').rules, ['2-2s'], 'không coi cảnh báo 1-2s là căn cứ SE');
  f.db.prepare('UPDATE test_levels SET mean=NULL,sd=NULL WHERE test_id=?').run(f.assay.id);
  assert.equal(f.assessment('systematic').error_class, '', 'thiếu Mean/SD không tự kết luận loại sai số');
});

test('huỷ điểm: luật SE chỉ cảnh báo không che luật RE gây loại trên cùng điểm', (t) => {
  const f = fixture(t);
  // Cấu hình tại fixture trước mọi điểm để giữ cùng một giai đoạn luật.
  f.db.prepare('UPDATE tests SET rule_actions_json=? WHERE id=?').run(JSON.stringify({ '2-2s': 'alert' }), f.assay.id);
  f.add('first', 1, '2026-10-01', 102.5);
  f.add('second', 1, '2026-10-02', 104);
  const result = f.assessment('second');
  assert.equal(result.error_class, 'RE');
  assert.deepEqual(result.rules, ['1-3s']);
  const saved = must(f.entry.voidPoint({ data: { pointId: 'second', kind: 'analytical', reason: 'Huỷ sau khi đối chiếu lỗi chạy QC.' } }, actor));
  assert.equal(f.nce.listNce().find((r) => r.nce_id === saved.nceId).error_class, result.error_class);
  const oldSnapshot = { points: [{ verdict: 'rej', rules: ['1-3s'], voided: false }] };
  assert.equal(nceErrorClass([{ role: 'trigger', snapshot: oldSnapshot }]), 'RE', 'snapshot cũ chưa có rejectRules vẫn đọc được');
});

test('huỷ điểm: R4s trên lô song song không làm lô chính cùng mã run bị phân loại sai', (t) => {
  const f = fixture(t);
  for (const [level, mean] of [[1, 100], [2, 200]]) {
    const next = must(f.config.saveLot({ data: { lotNo: `PAR-L${level}`, level } }, actor));
    must(f.config.createLotTransition({ data: { panelId: f.operation.panelId, fromLotId: f.operation.lotIds[level - 1], toLotId: next.id,
      startDate: '2026-10-01', status: 'active', criteria: [{ testId: f.assay.id, level, mean, sd: 1 }] } }, actor));
  }
  f.add('main', 1, '2026-10-02', 100);
  f.add('parallel1', 1, '2026-10-02', 102.5, '1', 'PAR-L1');
  f.add('parallel2', 2, '2026-10-02', 197.5, '1', 'PAR-L2');
  assert.equal(f.assessment('main').error_class, '');
  assert.equal(f.assessment('main').run_rejected, false);
  assert.equal(f.assessment('parallel1').error_class, 'RE');
  assert.deepEqual(f.assessment('parallel1').rules, ['R4s']);
});

test('huỷ điểm: lô cũ và mức còn gán sau khi thay riêng một lô vẫn lấy đủ căn cứ liên mức', (t) => {
  const f = fixture(t);
  f.add('old1', 1, '2026-10-02', 102.5);
  f.add('old2', 2, '2026-10-02', 197.5);
  const next = must(f.config.saveLot({ data: { lotNo: 'NEW-L1', level: 1 } }, actor));
  const next2 = must(f.config.saveLot({ data: { lotNo: 'NEW-L2', level: 2 } }, actor));
  must(f.config.saveLotGroup({ data: { name: 'Nhóm mới', lotIds: [next.id, next2.id] } }, actor));
  f.db.prepare('UPDATE test_levels SET qc_lot_id=? WHERE test_id=? AND level=1').run(next.id, f.assay.id);
  for (const id of ['old1', 'old2']) {
    assert.equal(f.assessment(id).error_class, 'RE');
    assert.deepEqual(f.assessment(id).rules, ['R4s']);
  }
});
