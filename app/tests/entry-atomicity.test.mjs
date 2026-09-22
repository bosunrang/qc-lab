// Hồi quy tính nguyên tử của Nhập QC: dữ liệu QC, audit và NCE phải cùng
// thành công hoặc cùng rollback; mã NCE lấy hậu tố lớn nhất để không trùng
// khi dữ liệu nhập từ backup có khoảng trống.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test-client' };

const instrument = config.saveInstrument({ data: { name: 'Máy nguyên tử' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose nguyên tử', instrumentId: instrument.id } }, actor).data;
config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 10, sd: 1 } }, actor);
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });

// Cố ý làm bước ghi audit thất bại. INSERT điểm phải được rollback theo.
db.exec("CREATE TRIGGER fail_entry_audit BEFORE INSERT ON activity WHEN NEW.type='Nhập QC' BEGIN SELECT RAISE(FAIL, 'audit-failed'); END");
assert.throws(
  () => entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-01', val: 10.1 } }, actor),
  /audit-failed/,
);
assert.equal(db.prepare('SELECT COUNT(*) n FROM qc_points').get().n, 0, 'audit lỗi không được để lại điểm QC mồ côi');
db.exec('DROP TRIGGER fail_entry_audit');

const point = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-02', val: 14 } }, actor).data;

// Tạo khoảng trống 01,03. Cách COUNT(*) cũ sẽ sinh lại 03 và đụng UNIQUE;
// cách mới phải lấy MAX suffix + 1 = 04.
const today = new Date().toISOString().slice(0, 10);
const prefix = `NCE-${today.replace(/-/g, '')}`;
db.prepare('INSERT INTO actions(id,nce_id) VALUES (?,?)').run('gap-01', `${prefix}-01`);
db.prepare('INSERT INTO actions(id,nce_id) VALUES (?,?)').run('gap-03', `${prefix}-03`);
const voided = entry.voidPoint({ data: { pointId: point.id, kind: 'analytical' } }, actor);
assert.equal(voided.ok, true, JSON.stringify(voided));
assert.equal(voided.data.nceId, `${prefix}-04`);

// Nếu audit của thao tác hủy lỗi, cả cờ voided và NCE mới đều phải rollback.
const second = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-03', val: 14.2 } }, actor).data;
const actionCount = db.prepare('SELECT COUNT(*) n FROM actions').get().n;
db.exec("CREATE TRIGGER fail_void_audit BEFORE INSERT ON activity WHEN NEW.type='Hủy điểm QC' BEGIN SELECT RAISE(FAIL, 'void-audit-failed'); END");
assert.throws(() => entry.voidPoint({ data: { pointId: second.id, kind: 'analytical' } }, actor), /void-audit-failed/);
assert.equal(db.prepare('SELECT voided FROM qc_points WHERE id=?').get(second.id).voided, 0);
assert.equal(db.prepare('SELECT COUNT(*) n FROM actions').get().n, actionCount, 'hủy lỗi không được tạo NCE dở dang');

console.log('app entry atomicity + NCE id regression tests passed');
