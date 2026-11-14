import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { historyQcConclusion } from '../renderer/lib/history-qc-conclusion.ts';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createReportHandlers } = require('../../app-dist/main/ipc/report-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');
const actor = { userId: 'history-admin', username: 'history', name: 'Quản trị lịch sử', role: 'admin', clientId: 'history' };
const must = (result) => { assert.equal(result.ok, true, JSON.stringify(result)); return result.data; };

function fixture(t) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const config = createConfigHandlers(db);
  const machine = must(config.saveInstrument({ data: { name: 'Máy lịch sử' } }, actor));
  const assay = must(config.saveTest({ data: { name: 'Natri lịch sử', instrumentId: machine.id } }, actor));
  for (const [level, mean, sd] of [[1, 100, 2], [2, 200, 4]]) must(config.saveTestLevel({ testId: assay.id, data: { level, mean, sd } }, actor));
  const operation = makeOperationalQc(db, { testId: assay.id, instrumentId: machine.id,
    assignments: [{ level: 1, lotNo: 'HIST-L1' }, { level: 2, lotNo: 'HIST-L2' }] });
  const insert = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const add = (id, level, date, val, run = '1', lot = `HIST-L${level}`, voided = 0) => insert.run(id, assay.id, level, date, run, val, lot, level === 1 ? 100 : 200, level === 1 ? 2 : 4, voided);
  const entry = createEntryHandlers(db), report = createReportHandlers(db), westgard = createWestgardHandlers(db);
  const history = () => new Map(entry.listHistoryPoints(assay.id).map((point) => [point.id, point]));
  const assertMatchesReport = () => {
    const points = history();
    for (const row of report.queryReport({ testId: assay.id }).filter((point) => !point.voided)) {
      const actual = points.get(row.id);
      for (const field of ['verdict', 'rules', 'accepted', 'run_rejected_by']) assert.deepEqual(actual[field], row[field], `${row.id}: ${field}`);
    }
  };
  return { db, config, assay, operation, add, entry, report, westgard, history, assertMatchesReport };
}

test('lịch sử: Z trong ±2s vẫn bị loại theo chuỗi 4-1s và kéo theo mức còn lại cùng lần chạy', (t) => {
  const f = fixture(t);
  for (let n = 1; n <= 4; n++) f.add(`p${n}`, 1, `2026-10-0${n}`, 102.4);
  f.add('peer', 2, '2026-10-04', 200);
  f.add('next', 1, '2026-10-05', 100);
  const points = f.history(), bad = points.get('p4'), peer = points.get('peer');
  assert.ok(bad.rules.includes('4-1s'));
  assert.equal(bad.verdict, 'rej');
  assert.equal(historyQcConclusion(bad).label, 'Loại');
  assert.deepEqual(historyQcConclusion(bad).details, ['4-1s']);
  assert.equal(bad.qc_mean, 100); assert.equal(bad.qc_sd, 2);
  assert.equal(peer.verdict, 'ok'); assert.equal(peer.accepted, false);
  assert.deepEqual(peer.run_rejected_by, [1]);
  assert.equal(historyQcConclusion(peer).label, 'Loại');
  assert.deepEqual(historyQcConclusion(peer).details, ['Bị loại theo Mức 1']);
  assert.match(historyQcConclusion(peer).title, /Mức 1/);
  assert.equal(historyQcConclusion(points.get('next')).label, 'Đạt', 'mã run giống nhau ở ngày khác không bị kéo theo');
  assert.deepEqual(historyQcConclusion(points.get('next')).details, []);
  f.assertMatchesReport();
});

test('lịch sử: phân biệt cảnh báo, chưa đánh giá và không đưa điểm đã huỷ vào chuỗi', (t) => {
  const f = fixture(t);
  f.add('warn', 1, '2026-10-01', 105);
  f.add('orphan', 1, '2026-10-02', 100, '1', 'LO-KHONG-CO-NGU-CANH');
  f.add('void', 1, '2026-10-03', 120, '1', 'HIST-L1', 1);
  const points = f.history();
  assert.equal(historyQcConclusion(points.get('warn')).label, 'Cảnh báo');
  assert.ok(points.get('warn').rules.includes('1-2s'));
  assert.equal(points.get('orphan').verdict, 'none');
  assert.equal(historyQcConclusion(points.get('orphan')).label, 'Chưa đánh giá');
  assert.equal(historyQcConclusion(points.get('orphan')).tone, 'none');
  assert.equal(points.has('void'), false);
  f.db.prepare('UPDATE test_levels SET mean=NULL,sd=NULL WHERE test_id=?').run(f.assay.id);
  assert.equal(f.history().get('warn').verdict, 'none', 'thiếu cấu hình không tự hiện đạt theo Z');
});

test('lịch sử: đổi riêng mức 1 giữ R4s ở cả mức cũ và mức 2 vẫn gán hiện hành', (t) => {
  const f = fixture(t);
  f.add('old1', 1, '2026-10-01', 105); f.add('old2', 2, '2026-10-01', 190);
  const replacement = must(f.config.saveLot({ data: { lotNo: 'HIST-NEW-L1', level: 1 } }, actor));
  f.db.prepare('UPDATE qc_lots SET group_id=? WHERE id=?').run(f.operation.groupId, replacement.id);
  f.db.prepare('UPDATE test_levels SET qc_lot_id=?,mean_sd_history_json=? WHERE test_id=? AND level=1')
    .run(replacement.id, JSON.stringify([{ at: '2026-10-02', qcLotId: f.operation.lotIds[0], mean: 100, sd: 2 }]), f.assay.id);
  f.add('new1', 1, '2026-10-03', 100, '1', 'HIST-NEW-L1'); f.add('new2', 2, '2026-10-03', 200);
  const points = f.history();
  for (const id of ['old1', 'old2']) {
    assert.ok(points.get(id).rules.includes('R4s'), id);
    assert.equal(historyQcConclusion(points.get(id)).label, 'Loại');
  }
  for (const id of ['new1', 'new2']) assert.equal(historyQcConclusion(points.get(id)).label, 'Đạt');
  f.assertMatchesReport();
  f.db.prepare("UPDATE lot_groups SET active=0,status='stopped' WHERE id=?").run(f.operation.groupId);
  const archived = new Map(f.westgard.listArchivedBlocks(f.assay.id, f.operation.groupId).flatMap((block) => block.analysis.points.map((point) => [point.id, point])));
  for (const point of f.history().values()) {
    assert.equal(point.verdict, archived.get(point.id).verdict);
    assert.deepEqual(point.rules, archived.get(point.id).rules);
  }
});

test('lịch sử: lô song song có R4s riêng, không trộn với lô chính cùng mã lần chạy', (t) => {
  const f = fixture(t);
  for (const [level, mean, sd] of [[1, 100, 2], [2, 200, 4]]) {
    const next = must(f.config.saveLot({ data: { lotNo: `PARALLEL-L${level}`, level } }, actor));
    must(f.config.createLotTransition({ data: { panelId: f.operation.panelId, fromLotId: f.operation.lotIds[level - 1], toLotId: next.id,
      startDate: '2026-10-01', status: 'active', criteria: [{ testId: f.assay.id, level, mean, sd }] } }, actor));
  }
  f.add('main', 1, '2026-10-02', 100);
  f.add('parallel1', 1, '2026-10-02', 105, '1', 'PARALLEL-L1');
  f.add('parallel2', 2, '2026-10-02', 190, '1', 'PARALLEL-L2');
  const points = f.history();
  assert.equal(historyQcConclusion(points.get('main')).label, 'Đạt');
  for (const id of ['parallel1', 'parallel2']) {
    assert.ok(points.get(id).rules.includes('R4s'));
    assert.equal(historyQcConclusion(points.get(id)).label, 'Loại');
  }
  f.assertMatchesReport();
});
