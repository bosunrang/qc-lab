// Bộ nhớ đệm tóm tắt Westgard theo xét nghiệm (kế hoạch kiến trúc E.6 bước
// 3): chỉ tính lại xét nghiệm có thay đổi, nhưng KHÔNG BAO GIỜ trả kết quả
// cũ. Phần 2 đối chiếu từng thao tác ghi thật với một lượt tính mới hoàn toàn.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { TestSummaryCache, SUMMARY_PER_TEST_TABLES, SUMMARY_IGNORED_TABLES } = require('../../app-dist/main/ipc/summary-cache.js');
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { writeAudit, notifyChanged } = require('../../app-dist/main/ipc/shared.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
const reviewer = { ...actor, userId: 'u2', username: 'duyet', name: 'Người duyệt' };

test('quy tắc bỏ kết quả đã giữ', () => {
  const cache = new TestSummaryCache();
  let computed = [];
  const read = (id, day = '2026-09-26') => cache.get(id, day, () => { computed.push(id); return { id, n: computed.length }; });
  const fill = () => { read('A'); read('B'); computed = []; };

  fill();
  read('A'); read('B');
  assert.deepEqual(computed, [], 'không có thay đổi thì không tính lại');

  cache.onChanged({ tables: ['qc_points'], testIds: ['A'] });
  read('A'); read('B');
  assert.deepEqual(computed, ['A'], 'điểm QC của A đổi: chỉ tính lại A');

  fill();
  cache.onChanged({ tables: ['qc_points', 'actions'], testIds: ['A', 'B'] });
  read('A'); read('B');
  assert.deepEqual(computed, ['A', 'B']);

  for (const payload of [
    { tables: ['qc_points'], testIds: [] }, // bảng theo xét nghiệm nhưng không nói xét nghiệm nào
    { tables: ['qc_lots'], testIds: ['A'] }, // lô dùng chung cho nhiều xét nghiệm
    { tables: ['tests', 'qc_panels'], testIds: ['A'] },
    { tables: ['app_meta'], testIds: [] }, // luật Westgard chung
    { tables: ['bang_moi_chua_biet'], testIds: ['A'] }, // bảng lạ: không đoán
  ]) {
    fill();
    cache.onChanged(payload);
    read('A'); read('B');
    assert.deepEqual(computed, ['A', 'B'], `bỏ hết với ${JSON.stringify(payload)}`);
  }

  fill();
  for (const table of ['users', 'tea_refs', 'sigma_data', 'period_locks']) cache.onChanged({ tables: [table], testIds: ['A'] });
  read('A'); read('B');
  assert.deepEqual(computed, [], 'bảng tóm tắt không đọc tới thì giữ nguyên');

  // Handler ghi nhật ký mà quên báo bảng đổi: lần đọc sau bỏ hết.
  fill();
  cache.onChanged({ tables: ['activity'], testIds: [] });
  read('A'); read('B');
  assert.deepEqual(computed, ['A', 'B']);
  // Ghi nhật ký rồi báo đúng bảng: chỉ theo lời báo đó.
  fill();
  cache.onChanged({ tables: ['activity'], testIds: [] });
  cache.onChanged({ tables: ['qc_points'], testIds: ['B'] });
  read('A'); read('B');
  assert.deepEqual(computed, ['B']);

  fill();
  read('A', '2026-09-27'); read('B', '2026-09-27');
  assert.deepEqual(computed, ['A', 'B'], 'qua ngày thì số điểm hôm nay đổi: tính lại hết');

  cache.retain(['A']);
  assert.equal(cache.size, 1, 'xét nghiệm đã xoá không còn giữ');

  for (const table of SUMMARY_PER_TEST_TABLES) assert.equal(SUMMARY_IGNORED_TABLES.has(table), false, table);
});

test('mọi thao tác ghi thật: kết quả có bộ nhớ đệm trùng lượt tính mới hoàn toàn', () => {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const entry = createEntryHandlers(db);
  const westgard = createWestgardHandlers(db);
  const nce = createNceHandlers(db);
  const must = (result, step) => { assert.equal(result?.ok, true, `${step}: ${JSON.stringify(result?.error)}`); return result.data; };

  const instrument = must(config.saveInstrument({ data: { name: 'Máy A' } }, actor), 'máy');
  const tests = ['Glucose', 'Ure', 'Creatinin'].map((name) => must(config.saveTest({ data: { name, instrumentId: instrument.id, unit: 'mmol/L' } }, actor), name));
  const [A, B, C] = tests;
  // Hai xét nghiệm dùng CHUNG lô: đổi lô phải tính lại cả hai.
  const lot1 = must(config.saveLot({ data: { lotNo: 'L1', level: 1 } }, actor), 'lô 1');
  const lot2 = must(config.saveLot({ data: { lotNo: 'L2', level: 2 } }, actor), 'lô 2');
  const group = must(config.saveLotGroup({ data: { name: 'Nhóm', lotIds: [lot1.id, lot2.id] } }, actor), 'nhóm lô');
  for (const t of [A, B]) {
    must(config.saveTestLevel({ testId: t.id, data: { level: 1, mean: 5, sd: 0.2, qcLotId: lot1.id } }, actor), 'mức 1');
    must(config.saveTestLevel({ testId: t.id, data: { level: 2, mean: 15, sd: 0.5, qcLotId: lot2.id } }, actor), 'mức 2');
  }
  must(config.savePanel({ data: { name: 'Panel', instrumentId: instrument.id, testIds: [A.id, B.id, C.id] } }, actor), 'panel');

  const steps = [];
  const check = (label) => {
    const cached = westgard.listTestSummaries();
    const fresh = createWestgardHandlers(db).listTestSummaries();
    assert.deepEqual(cached, fresh, `sau "${label}" kết quả giữ lại phải trùng lượt tính mới`);
    steps.push(label);
    return cached;
  };

  check('dựng cấu hình');
  const p1 = must(entry.addPoint({ data: { testId: A.id, level: 1, date: '2026-09-01', runId: '2026-09-01-1', val: 5.1 } }, actor), 'điểm');
  check('nhập điểm A');
  const beforeB = check('đọc lại không đổi');
  must(entry.addPoint({ data: { testId: A.id, level: 1, date: '2026-09-02', runId: '2026-09-02-1', val: 5.9 } }, actor), 'điểm 1-3s');
  const afterA = check('nhập điểm vi phạm ở A');
  assert.equal(afterA[1].levels, beforeB[1].levels, 'B không bị tính lại khi chỉ A đổi');
  assert.notEqual(afterA[0].levels, beforeB[0].levels);
  must(entry.addPoint({ data: { testId: B.id, level: 2, date: '2026-09-02', runId: '2026-09-02-1', val: 15.2 } }, actor), 'điểm B');
  check('nhập điểm B');
  must(entry.voidPoint({ data: { pointId: p1.id, reason: 'Nhập sai giá trị' } }, actor), 'huỷ điểm');
  check('huỷ điểm A');
  must(config.saveTestLevel({ testId: A.id, data: { level: 1, mean: 5.5, sd: 0.2, qcLotId: lot1.id } }, actor), 'đổi Mean');
  check('đổi Mean/SD của A');
  must(westgard.saveRuleAction(A.id, '1-2s', 'reject', actor), 'luật riêng');
  check('luật riêng của A');
  must(westgard.saveRuleSetting('1-2s', false, actor), 'luật chung');
  check('tắt luật chung');
  must(config.saveRuleScope(B.id, '2-2s', 'within', actor), 'phạm vi luật');
  check('phạm vi luật của B');
  must(config.saveInstrument({ id: instrument.id, data: { name: 'Máy A mới' } }, actor), 'đổi tên máy');
  check('đổi tên máy');
  must(config.saveLot({ id: lot1.id, data: { lotNo: 'L1-MOI', level: 1 } }, actor), 'đổi số lô');
  check('đổi số lô dùng chung');

  const record = must(nce.create({ data: { testId: A.id, level: 1, lot: 'L1-MOI', date: '2026-09-02', rule: '1-3s', errorType: 'RE', correction: 'Giữ kết quả, kiểm tra lại máy và làm lại QC', dueDate: '2026-09-10' } }, actor), 'NCE');
  must(nce.setActionCompletedDate({ data: { id: record.id, actionCompletedDate: '2026-09-02' } }, actor), 'ngày khắc phục');
  must(nce.saveProtocol({ data: { id: record.id, dueDate: '2026-09-10', protocol: {
    eventSource: 'iqc', processPhase: 'exam', owner: 'KTV A', containmentStatus: 'none', correction: 'Giữ kết quả, kiểm tra lại máy và làm lại QC',
    riskSeverity: 2, riskOccurrence: 2, riskDetectability: 2, riskLevel: 'low', riskBasis: 'SOP-QC-07',
    qcMaterialStatus: 'ok', instrumentStatus: 'ok', reagentStatus: 'ok', calibrationStatus: 'ok', lotToLotStatus: 'not-needed',
    causeCategory: 'instrument', cause: 'Máy bắt đầu lệch sau bảo trì', action: 'Bảo trì máy và xác nhận lại hiệu chuẩn',
    patientImpact: 'none', effectivenessStatus: 'pending',
    residualSeverity: 1, residualOccurrence: 1, residualDetectability: 1, residualRiskLevel: 'low', residualRiskBasis: 'Theo dõi sau bảo trì',
  } } }, actor), 'hồ sơ NCE');
  must(nce.markEffectiveness({ data: { id: record.id, status: 'effective', residualRisk: 'Rủi ro còn lại thấp', note: 'Không tái diễn' } }, actor), 'hiệu quả');
  must(nce.approve({ data: { id: record.id } }, reviewer), 'duyệt NCE');
  check('NCE khắc phục hiệu quả (mốc bắt đầu lại luật)');

  // Handler quên báo bảng đổi (chỉ ghi nhật ký): vẫn không trả kết quả cũ.
  db.prepare('UPDATE qc_points SET val=6.5 WHERE test_id=? AND voided=0').run(B.id);
  writeAudit(db, actor, 'Sửa tay', 'mô phỏng handler quên notifyChanged', B.id);
  check('ghi mà chỉ có nhật ký');

  must(config.removeTest({ id: C.id }, actor), 'xoá xét nghiệm');
  assert.equal(check('xoá xét nghiệm C').length, 2);
  must(config.stopLotGroup({ id: group.id }, actor), 'dừng nhóm lô');
  const stopped = check('dừng nhóm lô');
  assert.deepEqual(stopped.map((s) => s.levels.length), [0, 0], 'nhóm lô dừng thì không còn mức vận hành');
  notifyChanged(['activity']);
  check('lời báo lạc (chỉ activity)');
  assert.equal(steps.length, 17, 'chạy đủ mọi bước');
  db.close();
});
