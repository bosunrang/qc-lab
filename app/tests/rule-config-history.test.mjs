// Kết luận QC không hồi tố khi đổi cấu hình luật Westgard (gói GV2 của kế
// hoạch khắc phục 2026-10-31; ISO 15189:2022 8.4; cùng tinh thần D-03).
// Đổi luật chỉ áp cho lần chạy nhập SAU thời điểm đổi: lần chạy đã có — kể cả
// của hôm nay — và điểm nhập lùi ngày giữ cấu hình đang hiệu lực lúc đó.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { ensureUser } from './helpers/nce-flow.mjs';
import { listActivity } from './helpers/activity.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');
const { nceRejectedPoints } = require('../../app-dist/main/db/nce-evaluation.js');
const { testRuleActionOf } = require('../../app-dist/main/db/westgard-evaluation.js');
const { ruleConfigVersions, ruleVersionIndexOf } = require('../../app-dist/main/db/rule-config-history.js');
const { isoLocalDate, isoLocalDateAfter } = require('../../app-dist/main/domain/local-date.js');

const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 't' };
const today = isoLocalDate();
const yesterday = isoLocalDateAfter(-1);
const lastWeek = isoLocalDateAfter(-7);

/** Một xét nghiệm 1 mức, Mean 100 / SD 2: giá trị 107 là z = +3,5 (nổ 1-3s). */
function fixture(t) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  ensureUser(db, admin);
  const config = createConfigHandlers(db);
  const instrument = config.saveInstrument({ data: { name: 'Máy' } }, admin).data;
  const assay = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mmol/L' } }, admin).data;
  const lot = config.saveLot({ data: { lotNo: 'LOT-1', level: 1 } }, admin).data;
  assert.equal(config.saveTestLevel({ testId: assay.id, data: { level: 1, mean: 100, sd: 2, qcLotId: lot.id } }, admin).ok, true);
  makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: [{ level: 1, lotId: lot.id }] });
  const entry = createEntryHandlers(db), westgard = createWestgardHandlers(db);
  const add = (date, runId, val) => {
    const result = entry.addPoint({ data: { testId: assay.id, level: 1, date, runId, val } }, admin);
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.data.id;
  };
  const flagOf = (id) => westgard.analyzeLevel(assay.id, 1).points.find((p) => p.id === id);
  const verdictOf = (id) => flagOf(id)?.verdict;
  return { db, config, entry, westgard, assay, add, flagOf, verdictOf };
}

// Hai điểm bình thường (z = 0) đặt trước một điểm vượt ngưỡng để nó chỉ nổ
// luật một lần chạy (1-3s/1-2s), không dính 2-2s/2of3-2s với điểm trước.
const QUIET = 100, HIGH = 107, LOW = 93;

test('đổi 1-3s sang Cảnh báo không đổi kết luận của lần chạy đã có', (t) => {
  const { db, westgard, assay, add, verdictOf } = fixture(t);
  const old = add(lastWeek, 'R1', HIGH);
  assert.equal(verdictOf(old), 'rej');

  const changed = westgard.saveRuleAction(assay.id, '1-3s', 'alert', admin);
  assert.equal(changed.ok, true, JSON.stringify(changed));
  assert.equal(verdictOf(old), 'rej', 'lần chạy tuần trước vẫn Loại bỏ');
  assert.ok(nceRejectedPoints(db).some((p) => p.pointId === old), 'vẫn nằm trong hàng chờ NCE');
  assert.match(listActivity(db, 1)[0].detail, /kết luận của các lần chạy đã có giữ nguyên/);

  add(today, 'R1', QUIET); add(today, 'R2', QUIET);
  const fresh = add(today, 'R3', LOW);
  assert.equal(verdictOf(fresh), 'warn', 'lần chạy nhập sau khi đổi dùng cấu hình mới');
  assert.equal(testRuleActionOf(db, assay.id, { date: lastWeek, runId: 'R1' })('1-3s'), 'reject');
  assert.equal(testRuleActionOf(db, assay.id)('1-3s'), 'alert');
});

test('mốc theo thứ tự nhập: lần chạy đã có của hôm nay giữ cấu hình cũ, điểm nhập lùi ngày sau khi đổi dùng cấu hình mới', (t) => {
  const { westgard, assay, add, verdictOf } = fixture(t);
  const morning = add(today, 'R1', HIGH);
  assert.equal(westgard.saveRuleAction(assay.id, '1-3s', 'alert', admin).ok, true);
  add(today, 'R2', QUIET); add(today, 'R3', QUIET);
  const afternoon = add(today, 'R4', LOW);
  add(lastWeek, 'R1', QUIET); add(lastWeek, 'R2', QUIET);
  const backdated = add(lastWeek, 'R3', LOW);
  assert.equal(verdictOf(morning), 'rej', 'lần chạy R1 có trước khi đổi');
  assert.equal(verdictOf(afternoon), 'warn', 'lần chạy R4 nhập sau khi đổi');
  assert.equal(verdictOf(backdated), 'warn', 'kết luận của điểm nhập lùi ngày được đưa ra sau khi đổi');
});

test('cấu hình chung: tắt 1-3s chỉ áp cho lần chạy sau; bật lại cũng vậy', (t) => {
  const { db, westgard, assay, add, flagOf, verdictOf } = fixture(t);
  const before = add(lastWeek, 'R1', HIGH);
  assert.equal(westgard.saveRuleSetting('1-3s', false, admin).ok, true);
  add(yesterday, 'R1', QUIET); add(yesterday, 'R2', QUIET);
  // Điểm của hôm qua nhưng nhập SAU khi tắt → cấu hình mới.
  const during = add(yesterday, 'R3', LOW);
  assert.ok(!flagOf(during).rules.includes('1-3s'));
  add(today, 'R1', QUIET); add(today, 'R2', QUIET);
  const off = add(today, 'R3', LOW);
  assert.ok(!flagOf(off).rules.includes('1-3s'), '1-3s đã tắt cho lần chạy sau thời điểm đổi');
  assert.equal(verdictOf(off), 'warn', 'chỉ còn 1-2s');
  assert.equal(westgard.saveRuleSetting('1-3s', true, admin).ok, true);
  add(today, 'R4', QUIET); add(today, 'R5', QUIET);
  const on = add(today, 'R6', HIGH);
  assert.equal(verdictOf(before), 'rej');
  assert.equal(verdictOf(off), 'warn', 'bật lại không đổi kết luận của R3 hôm nay');
  assert.equal(verdictOf(on), 'rej');
  assert.equal(ruleConfigVersions(db, assay.id).length, 3, 'gốc + tắt + bật');
});

test('lưu lại đúng cấu hình đang dùng không ghi phiên bản hay nhật ký', (t) => {
  const { db, config, westgard, assay } = fixture(t);
  const rows = () => db.prepare('SELECT COUNT(*) AS n FROM rule_config_history').get().n;
  const audits = () => listActivity(db).length;
  const start = audits();
  assert.equal(westgard.saveRuleSetting('1-3s', true, admin).ok, true);
  assert.equal(westgard.resetRuleSettings(admin).ok, true);
  assert.equal(westgard.saveRuleAction(assay.id, '1-3s', '', admin).ok, true);
  assert.equal(config.saveRuleScope(assay.id, '2-2s', '', admin).ok, true);
  assert.equal(rows(), 0);
  assert.equal(audits(), start);
});

test('đổi phạm vi luật cũng ghi phiên bản; dòng gốc giữ cấu hình trước lần đổi đầu', (t) => {
  const { db, config, assay } = fixture(t);
  assert.equal(config.saveRuleScope(assay.id, '2-2s', 'within', admin).ok, true);
  const versions = ruleConfigVersions(db, assay.id);
  assert.equal(versions.length, 2);
  assert.equal(versions[0].afterEntrySeq, null);
  assert.deepEqual(versions[0].scopes, {});
  assert.deepEqual(versions[1].scopes, { '2-2s': 'within' });
  assert.equal(versions[1].afterEntrySeq, 0, 'chưa có điểm nào lúc đổi');
  assert.match(listActivity(db, 1)[0].detail, /phạm vi SOP khuyến nghị → phạm vi within/);
});

test('thứ tự nhập: trigger tự đánh số; phiên bản chọn theo điểm nhập đầu tiên của lần chạy', (t) => {
  const { db, add } = fixture(t);
  const first = add(lastWeek, 'R1', QUIET), second = add(lastWeek, 'R2', QUIET);
  const seqOf = (id) => db.prepare('SELECT entry_seq FROM qc_points WHERE id=?').get(id).entry_seq;
  assert.ok(seqOf(first) > 0);
  assert.equal(seqOf(second), seqOf(first) + 1);
  const versions = [{ afterEntrySeq: null }, { afterEntrySeq: 5 }, { afterEntrySeq: 9 }];
  assert.equal(ruleVersionIndexOf(versions, 5), 0);
  assert.equal(ruleVersionIndexOf(versions, 6), 1);
  assert.equal(ruleVersionIndexOf(versions, 10), 2);
  assert.equal(ruleVersionIndexOf(versions, undefined), 2, 'lần chạy chưa nhập là lần chạy mới');
});
