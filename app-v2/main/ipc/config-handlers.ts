// IPC handler cho module thí điểm "Cấu hình chung": máy xét nghiệm, xét
// nghiệm, mức QC. Renderer KHÔNG bao giờ chạm SQLite trực tiếp — chỉ gọi các
// hàm named ở đây qua preload/ipcMain. Mỗi thao tác ghi chạy trong 1
// transaction + ghi 1 dòng audit.
import type { Db } from '../db/open-database';
import { cleanId, uid } from '../domain/text-utils';
import {
  validateInstrument, validateTest, validateTestLevel,
  type InstrumentInput, type TestInput, type TestLevelInput,
} from '../domain/manage-validation';
import { type Actor, type IpcResult, writeAudit, rowToAuditEntry } from './shared';

export function createConfigHandlers(db: Db) {
  function listInstruments() {
    return db.prepare('SELECT * FROM instruments ORDER BY name').all();
  }

  function saveInstrument(input: { id?: string; data: InstrumentInput }, actor: Actor): IpcResult<unknown> {
    const id = input.id || '';
    const existingNames = (db.prepare('SELECT name FROM instruments WHERE id != ?').all(id) as { name: string }[]).map(r => r.name);
    const result = validateInstrument(input.data, existingNames);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, manufacturer, model, serial, section, active } = result.data;
    if (id) {
      const existing = db.prepare('SELECT id FROM instruments WHERE id=?').get(id);
      if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy máy xét nghiệm cần cập nhật.' } };
      db.prepare('UPDATE instruments SET name=?,manufacturer=?,model=?,serial=?,section=?,active=? WHERE id=?')
        .run(name, manufacturer, model, serial, section, active ? 1 : 0, id);
      writeAudit(db, actor, 'Sửa máy xét nghiệm', `Cập nhật máy "${name}"`, name);
      return { ok: true, data: db.prepare('SELECT * FROM instruments WHERE id=?').get(id) };
    }
    const newId = cleanId(uid());
    db.prepare('INSERT INTO instruments(id,name,manufacturer,model,serial,section,active) VALUES (?,?,?,?,?,?,?)')
      .run(newId, name, manufacturer, model, serial, section, active ? 1 : 0);
    writeAudit(db, actor, 'Thêm máy xét nghiệm', `Tạo máy "${name}"`, name);
    return { ok: true, data: db.prepare('SELECT * FROM instruments WHERE id=?').get(newId) };
  }

  function listTests() {
    return db.prepare('SELECT * FROM tests ORDER BY name').all();
  }

  function saveTest(input: { id?: string; data: TestInput }, actor: Actor): IpcResult<unknown> {
    const id = input.id || '';
    const knownInstrumentIds = new Set((db.prepare('SELECT id FROM instruments').all() as { id: string }[]).map(r => r.id));
    const instrumentId = cleanId(input.data.instrumentId);
    const existingNames = (db.prepare('SELECT name FROM tests WHERE id != ? AND instrument_id=?').all(id, instrumentId) as { name: string }[]).map(r => r.name);
    const result = validateTest(input.data, knownInstrumentIds, existingNames);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, unit, decimalPlaces, tea, section } = result.data;
    if (id) {
      const existing = db.prepare('SELECT id FROM tests WHERE id=?').get(id);
      if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm cần cập nhật.' } };
      db.prepare('UPDATE tests SET name=?,instrument_id=?,unit=?,decimal_places=?,tea=?,section=? WHERE id=?')
        .run(name, result.data.instrumentId, unit, decimalPlaces, tea, section, id);
      writeAudit(db, actor, 'Sửa xét nghiệm', `Cập nhật xét nghiệm "${name}"`, name);
      return { ok: true, data: db.prepare('SELECT * FROM tests WHERE id=?').get(id) };
    }
    const newId = cleanId(uid());
    db.prepare('INSERT INTO tests(id,name,instrument_id,unit,decimal_places,tea,section) VALUES (?,?,?,?,?,?,?)')
      .run(newId, name, result.data.instrumentId, unit, decimalPlaces, tea, section);
    // Mức mặc định: mọi xét nghiệm mới bắt đầu với đúng 1 Mức 1, chưa gán lô
    // (tham khảo defaultAssayLevels() bản cũ) — thêm mức khác qua saveTestLevel.
    db.prepare('INSERT INTO test_levels(id,test_id,level) VALUES (?,?,1)').run(`${newId}:1`, newId);
    writeAudit(db, actor, 'Thêm xét nghiệm', `Tạo xét nghiệm "${name}"`, name);
    return { ok: true, data: db.prepare('SELECT * FROM tests WHERE id=?').get(newId) };
  }

  function listTestLevels(testId: string) {
    return db.prepare('SELECT * FROM test_levels WHERE test_id=? ORDER BY level').all(testId);
  }

  function saveTestLevel(input: { testId: string; data: TestLevelInput }, actor: Actor): IpcResult<unknown> {
    const testId = cleanId(input.testId);
    const test = db.prepare('SELECT id,name FROM tests WHERE id=?').get(testId) as { id: string; name: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    const result = validateTestLevel(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { level, mean, sd, qcLotId } = result.data;
    const levelId = `${testId}:${level}`;
    const existing = db.prepare('SELECT id FROM test_levels WHERE id=?').get(levelId);
    // UPSERT theo (testId, level): mọi xét nghiệm luôn có sẵn Mức 1 tự tạo
    // lúc thêm xét nghiệm (không có Mean/SD) — lưu lại Mean/SD cho MỘT mức
    // đã tồn tại là cập nhật, không phải tạo mới; mức KHÁC chưa có thì tạo mới.
    if (existing) {
      db.prepare('UPDATE test_levels SET mean=?,sd=?,qc_lot_id=? WHERE id=?').run(mean, sd, qcLotId || null, levelId);
    } else {
      db.prepare('INSERT INTO test_levels(id,test_id,level,mean,sd,qc_lot_id) VALUES (?,?,?,?,?,?)')
        .run(levelId, testId, level, mean, sd, qcLotId || null);
    }
    writeAudit(db, actor, existing ? 'Sửa mức QC' : 'Thêm mức QC', `Mức ${level} của xét nghiệm "${test.name}": Mean=${mean ?? '—'} SD=${sd ?? '—'}`, test.name);
    return { ok: true, data: db.prepare('SELECT * FROM test_levels WHERE id=?').get(levelId) };
  }

  function listActivity(limit = 200) {
    const rows = db.prepare('SELECT * FROM activity ORDER BY seq DESC LIMIT ?').all(limit) as Record<string, unknown>[];
    return rows.map(rowToAuditEntry);
  }

  return { listInstruments, saveInstrument, listTests, saveTest, listTestLevels, saveTestLevel, listActivity };
}

export type ConfigHandlers = ReturnType<typeof createConfigHandlers>;
