// Hồi quy transaction của Cấu hình chung: bản ghi cấu hình, bảng nối và
// audit phải cùng thành công hoặc cùng rollback.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test-client' };

db.exec("CREATE TRIGGER fail_instrument_audit BEFORE INSERT ON activity WHEN NEW.type='Thêm máy xét nghiệm' BEGIN SELECT RAISE(FAIL, 'instrument-audit-failed'); END");
assert.throws(() => config.saveInstrument({ data: { name: 'Máy không được lưu dở' } }, actor), /instrument-audit-failed/);
assert.equal(db.prepare('SELECT COUNT(*) n FROM instruments').get().n, 0);
db.exec('DROP TRIGGER fail_instrument_audit');

const instrument = config.saveInstrument({ data: { name: 'Máy A' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, actor).data;

// savePanel tự bắt lỗi DB và trả IpcResult; audit lỗi phải rollback cả hàng
// Panel lẫn liên kết xét nghiệm vừa tạo trong cùng lần lưu.
db.exec("CREATE TRIGGER fail_panel_audit BEFORE INSERT ON activity WHEN NEW.type='Thêm Panel QC' BEGIN SELECT RAISE(FAIL, 'panel-audit-failed'); END");
const panel = config.savePanel({ data: { name: 'Panel dở dang', instrumentId: instrument.id, testIds: [test.id] } }, actor);
assert.equal(panel.ok, false);
assert.equal(panel.error.code, 'save-failed');
assert.equal(db.prepare("SELECT COUNT(*) n FROM qc_panels WHERE name='Panel dở dang'").get().n, 0);
assert.equal(db.prepare('SELECT COUNT(*) n FROM qc_panel_tests').get().n, 0);

console.log('app config atomicity regression tests passed');
