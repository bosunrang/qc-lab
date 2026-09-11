// IPC handler cho module thí điểm "Cấu hình chung": máy xét nghiệm, xét
// nghiệm, mức QC. Renderer KHÔNG bao giờ chạm SQLite trực tiếp — chỉ gọi các
// hàm named ở đây qua preload/ipcMain. Mỗi thao tác ghi chạy trong 1
// transaction + ghi 1 dòng audit.
import type { Db } from '../db/sqlite-like';
// Kiểu dữ liệu trả về lấy từ HỢP ĐỒNG dùng chung, không khai lại: trước
// 2026-09-10 các hàm này khai `IpcResult<unknown>` nên renderer tin vào
// một hình dạng mà không gì bảo đảm.
import type { Instrument, LotGroup, LotTransition, QcLot, QcPanel, TeaRef, Test, TestLevel } from '../../shared/qc-api';

import { cleanId, cleanText, uid, sameText } from '../domain/text-utils';
import {
  validateInstrument, validateTest, validateTestLevel, appendMeanSdHistory,
  validateLot, validateLotGroup, validatePanel, validateLotTransition,
  type InstrumentInput, type TestInput, type PreparedTest, type TestLevelInput,
  type LotInput, type LotGroupInput, type PanelInput, type LotTransitionInput, type PreparedLotTransition,
} from '../domain/manage-validation';
import { validateTeaRef, TEA_LAB_SOURCE_LABELS, type TeaRefInput } from '../domain/tea-ref-validation';
import { parseRuleScopes, serializeRuleScopes, parseRuleActions, effectiveRuleConfigList, type RuleScopesMap } from '../domain/rule-config';
import { RULE_SCOPES, WG_RULE_REGISTRY, type RuleScope } from '../domain/westgard-rules';
import { readGlobalRules } from '../db/rule-settings';
import { countOperationalLevels } from '../db/operational-levels';
import { isoLocalDate } from '../domain/local-date';
import { type Actor, type IpcResult, nowIso, writeAudit, rowToAuditEntry, notifyChanged, requireAdmin } from './shared';
import { ymOfDate } from '../domain/period-lock-validation';

export function createConfigHandlers(db: Db) {
  function inTransaction<T>(work: () => T): T {
    db.exec('BEGIN');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function listInstruments() {
    return db.prepare('SELECT * FROM instruments ORDER BY name').all();
  }

  function saveInstrument(input: { id?: string; data: InstrumentInput }, actor: Actor): IpcResult<Instrument> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = input.id || '';
    const existingNames = (db.prepare('SELECT name FROM instruments WHERE id != ?').all(id) as { name: string }[]).map(r => r.name);
    const result = validateInstrument(input.data, existingNames);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, manufacturer, model, serial, section, active } = result.data;
    if (id) {
      const existing = db.prepare('SELECT id FROM instruments WHERE id=?').get(id);
      if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy máy xét nghiệm cần cập nhật.' } };
      const saved = inTransaction(() => {
        db.prepare('UPDATE instruments SET name=?,manufacturer=?,model=?,serial=?,section=?,active=? WHERE id=?')
          .run(name, manufacturer, model, serial, section, active ? 1 : 0, id);
        writeAudit(db, actor, 'Sửa máy xét nghiệm', `Cập nhật máy "${name}"`, name);
        return db.prepare('SELECT * FROM instruments WHERE id=?').get(id);
      });
      notifyChanged(['instruments']);
      return { ok: true, data: saved };
    }
    const newId = cleanId(uid());
    const saved = inTransaction(() => {
      db.prepare('INSERT INTO instruments(id,name,manufacturer,model,serial,section,active) VALUES (?,?,?,?,?,?,?)')
        .run(newId, name, manufacturer, model, serial, section, active ? 1 : 0);
      writeAudit(db, actor, 'Thêm máy xét nghiệm', `Tạo máy "${name}"`, name);
      return db.prepare('SELECT * FROM instruments WHERE id=?').get(newId);
    });
    notifyChanged(['instruments']);
    return { ok: true, data: saved };
  }

  function removeInstrument(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name FROM instruments WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy máy xét nghiệm.' } };
    const testCount = (db.prepare('SELECT COUNT(*) AS n FROM tests WHERE instrument_id=?').get(id) as { n: number }).n;
    if (testCount > 0) return { ok: false, error: { code: 'in-use', message: `Không thể xoá — máy này đang gắn với ${testCount} xét nghiệm. Xoá/chuyển các xét nghiệm đó trước.` } };
    // Port `instrumentRemoval()` app cũ — 2 cổng ĐỘC LẬP (xét nghiệm VÀ Panel
    // QC có thể gắn trực tiếp vào máy mà không qua xét nghiệm nào, vd Panel
    // tạo trước khi thêm xét nghiệm). Thiếu cổng này thì xoá máy còn Panel
    // gắn sẽ ném lỗi FOREIGN KEY constraint thô (schema bật `PRAGMA
    // foreign_keys=ON`, `qc_panels.instrument_id` không có ON DELETE CASCADE)
    // thay vì trả `IpcResult` báo lỗi rõ ràng như mọi handler khác.
    const panelCount = (db.prepare('SELECT COUNT(*) AS n FROM qc_panels WHERE instrument_id=?').get(id) as { n: number }).n;
    if (panelCount > 0) return { ok: false, error: { code: 'in-use', message: `Không thể xoá — máy này đang gắn với ${panelCount} Panel QC. Xoá/chuyển các Panel QC đó trước.` } };
    inTransaction(() => {
      db.prepare('DELETE FROM instruments WHERE id=?').run(id);
      writeAudit(db, actor, 'Xoá máy xét nghiệm', `Xoá "${existing.name}"`, existing.name);
    });
    notifyChanged(['instruments']);
    return { ok: true, data: { id } };
  }

  // App cũ KHÔNG sắp xếp `state.tests` ở đâu cả (`manageAssaysModel()`/
  // `PanelModal.tsx`'s `allTests` chỉ `.filter()`/`.map()` thẳng lên mảng) —
  // thứ tự hiển thị (danh mục xét nghiệm, danh sách chọn trong Panel QC...)
  // LÀ thứ tự tạo (xét nghiệm thêm trước nằm trước). `ORDER BY name` trước
  // đây tự sắp lại theo alphabet, sai với hành vi app cũ. `rowid` (ngầm định
  // của SQLite cho bảng có PK dạng TEXT) chính là thứ tự chèn.
  function listTests() {
    return db.prepare('SELECT * FROM tests ORDER BY rowid').all();
  }

  /** Form danh mục mới cho phép gán một analyte vào nhiều máy. Mỗi máy vẫn
   * là một hàng `tests` riêng để Mean/SD, lô, điểm QC và Westgard không bị
   * trộn; `analyte_id` chỉ gom các hàng đó thành một mục ở giao diện. */
  function saveTestAssignments(input: { id?: string; data: TestInput }, actor: Actor): IpcResult<Test> {
    const instrumentIds = [...new Set((Array.isArray(input.data.instrumentIds) ? input.data.instrumentIds : [])
      .map(cleanId).filter(Boolean))];
    if (!instrumentIds.length) return { ok: false, error: { code: 'missing-instrument', message: 'Chọn ít nhất một máy xét nghiệm.' } };

    const instruments = db.prepare('SELECT id, section FROM instruments').all() as { id: string; section: string }[];
    const instrumentById = new Map(instruments.map(row => [row.id, row]));
    if (instrumentIds.some(instrumentId => !instrumentById.has(instrumentId))) {
      return { ok: false, error: { code: 'missing-instrument', message: 'Có máy xét nghiệm đã chọn không còn tồn tại.' } };
    }

    const assignmentIds = [...new Set((Array.isArray(input.data.assignmentIds) ? input.data.assignmentIds : [])
      .map(cleanId).filter(Boolean))];
    if (input.id && !assignmentIds.includes(input.id)) assignmentIds.push(input.id);
    // Nếu người dùng bấm "Thêm" rồi chọn một analyte đã có trên máy khác,
    // tự nối vào đúng danh mục hiện hữu thay vì tạo một nhóm trùng tên.
    if (!input.id && !assignmentIds.length) {
      const name = cleanText(input.data.name).trim();
      const unit = cleanText(input.data.unit).trim();
      const teaRefKey = cleanText(input.data.teaRefKey, 80).trim();
      const catalogMatches = db.prepare('SELECT id, name, unit, tea_ref_key FROM tests').all() as
        { id: string; name: string; unit: string; tea_ref_key: string }[];
      for (const row of catalogMatches) {
        const matchesCatalog = teaRefKey
          ? row.tea_ref_key === teaRefKey
          : sameText(row.name, name) && sameText(row.unit, unit);
        if (matchesCatalog) assignmentIds.push(row.id);
      }
    }
    const existingAssignments = assignmentIds.length
      ? db.prepare(`SELECT * FROM tests WHERE id IN (${assignmentIds.map(() => '?').join(',')})`).all(...assignmentIds) as Record<string, unknown>[]
      : [];
    if (input.id && !existingAssignments.some(row => row.id === input.id)) {
      return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm cần cập nhật.' } };
    }

    // Máy đã có dữ liệu luôn được giữ lại. Việc gỡ một cấu hình máy phải đi
    // qua thao tác xoá có xác thực và cổng kỳ khoá, không được âm thầm xoá
    // điểm QC chỉ vì bỏ dấu tick trong một form cấu hình chung.
    const targetInstrumentIds = [...new Set([
      ...existingAssignments.map(row => String(row.instrument_id || '')),
      ...instrumentIds,
    ].filter(Boolean))];
    const managedIds = new Set(existingAssignments.map(row => String(row.id)));
    const prepared: { instrumentId: string; section: string; data: PreparedTest }[] = [];
    for (const instrumentId of targetInstrumentIds) {
      const duplicateRows = db.prepare('SELECT id, name, tea_ref_key FROM tests WHERE instrument_id=?').all(instrumentId) as
        { id: string; name: string; tea_ref_key: string }[];
      const outsideGroup = duplicateRows.filter(row => !managedIds.has(row.id));
      const result = validateTest({ ...input.data, instrumentId, section: instrumentById.get(instrumentId)?.section || '' },
        new Set(instrumentById.keys()), outsideGroup.map(row => row.name), outsideGroup.map(row => row.tea_ref_key).filter(Boolean));
      if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
      prepared.push({ instrumentId, section: instrumentById.get(instrumentId)?.section || '', data: result.data });
    }

    const firstExisting = existingAssignments[0];
    const analyteId = cleanId(input.data.analyteId)
      || cleanId(firstExisting?.analyte_id)
      || cleanId(input.data.teaRefKey)
      || cleanId(uid());
    const savedIds: string[] = [];
    const preserveExisting = input.data.preserveExistingAssignments === true;
    const saved = inTransaction(() => {
      for (const item of prepared) {
        const current = existingAssignments.find(row => row.instrument_id === item.instrumentId);
        const d = item.data;
        if (current) {
          const currentId = String(current.id);
          if (!preserveExisting) {
            db.prepare(`UPDATE tests SET analyte_id=?,name=?,instrument_id=?,unit=?,decimal_places=?,tea=?,section=?,
              tea_source=?,tea_ref_key=?,method=?,reagent=?,cusum_on=?,cusum_k=?,cusum_h=?,active=? WHERE id=?`)
              .run(analyteId, d.name, item.instrumentId, d.unit, d.decimalPlaces, d.tea, item.section,
                d.teaSource, d.teaRefKey, d.method, d.reagent, d.cusumOn ? 1 : 0, d.cusumK, d.cusumH, d.active ? 1 : 0, currentId);
          }
          savedIds.push(currentId);
        } else {
          const newId = cleanId(uid());
          db.prepare(`INSERT INTO tests(id,analyte_id,name,instrument_id,unit,decimal_places,tea,section,tea_source,tea_ref_key,method,reagent,cusum_on,cusum_k,cusum_h,active)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(newId, analyteId, d.name, item.instrumentId, d.unit, d.decimalPlaces, d.tea, item.section,
              d.teaSource, d.teaRefKey, d.method, d.reagent, d.cusumOn ? 1 : 0, d.cusumK, d.cusumH, d.active ? 1 : 0);
          db.prepare('INSERT INTO test_levels(id,test_id,level) VALUES (?,?,1)').run(`${newId}:1`, newId);
          savedIds.push(newId);
        }
      }
      const action = preserveExisting ? 'Gán thêm máy xét nghiệm' : existingAssignments.length ? 'Sửa xét nghiệm' : 'Thêm xét nghiệm';
      const detail = preserveExisting
        ? `Gán thêm máy cho xét nghiệm "${prepared[0].data.name}"`
        : `${existingAssignments.length ? 'Cập nhật' : 'Tạo'} xét nghiệm "${prepared[0].data.name}" trên ${savedIds.length} máy`;
      writeAudit(db, actor, action, detail, prepared[0].data.name);
      const representativeId = input.id && savedIds.includes(input.id) ? input.id : savedIds[0];
      return db.prepare('SELECT * FROM tests WHERE id=?').get(representativeId) as Test;
    });
    notifyChanged(['tests', 'test_levels'], savedIds);
    return { ok: true, data: { ...saved, assignment_ids: savedIds } };
  }

  function saveTest(input: { id?: string; data: TestInput }, actor: Actor): IpcResult<Test> {
    const denied = requireAdmin(actor); if (denied) return denied;
    if (Array.isArray(input.data.instrumentIds)) return saveTestAssignments(input, actor);
    const id = input.id || '';
    const knownInstrumentIds = new Set((db.prepare('SELECT id FROM instruments').all() as { id: string }[]).map(r => r.id));
    const instrumentId = cleanId(input.data.instrumentId);
    const existingTests = db.prepare('SELECT name, tea_ref_key FROM tests WHERE id != ? AND instrument_id=?').all(id, instrumentId) as
      { name: string; tea_ref_key: string }[];
    const result = validateTest(input.data, knownInstrumentIds,
      existingTests.map(row => row.name), existingTests.map(row => row.tea_ref_key).filter(Boolean));
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, unit, decimalPlaces, tea, section, teaSource, teaRefKey, method, reagent, cusumOn, cusumK, cusumH, active } = result.data;
    if (id) {
      const existing = db.prepare('SELECT id, instrument_id FROM tests WHERE id=?').get(id) as
        { id: string; instrument_id: string } | undefined;
      if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm cần cập nhật.' } };
      let removedPanelMemberships = 0;
      db.exec('BEGIN');
      try {
        db.prepare(`UPDATE tests SET name=?,instrument_id=?,unit=?,decimal_places=?,tea=?,section=?,
          tea_source=?,tea_ref_key=?,method=?,reagent=?,cusum_on=?,cusum_k=?,cusum_h=?,active=? WHERE id=?`)
          .run(name, result.data.instrumentId, unit, decimalPlaces, tea, section,
            teaSource, teaRefKey, method, reagent, cusumOn ? 1 : 0, cusumK, cusumH, active ? 1 : 0, id);
        // Port đúng `saveAssay()` app cũ: khi đổi máy của xét nghiệm, tự gỡ
        // xét nghiệm khỏi mọi Panel QC thuộc máy KHÁC máy mới. Nếu không,
        // thao tác sửa xét nghiệm tự tạo ra trạng thái mà `savePanel()` vốn
        // từ chối (`wrong-instrument`) và Panel vẫn âm thầm chứa dữ liệu sai.
        if (existing.instrument_id !== result.data.instrumentId) {
          removedPanelMemberships = Number(db.prepare(`DELETE FROM qc_panel_tests
            WHERE test_id=? AND panel_id IN (SELECT id FROM qc_panels WHERE instrument_id!=?)`)
            .run(id, result.data.instrumentId).changes);
        }
        writeAudit(db, actor, 'Sửa xét nghiệm', `Cập nhật xét nghiệm "${name}"`, name);
        db.exec('COMMIT');
      } catch (e) {
        try { db.exec('ROLLBACK'); } catch { /* transaction đã đóng */ }
        return { ok: false, error: { code: 'save-failed', message: e instanceof Error ? e.message : 'Cập nhật xét nghiệm thất bại.' } };
      }
      notifyChanged(removedPanelMemberships ? ['tests', 'qc_panels', 'qc_panel_tests'] : ['tests'], [id]);
      return { ok: true, data: db.prepare('SELECT * FROM tests WHERE id=?').get(id) };
    }
    const newId = cleanId(uid());
    db.exec('BEGIN');
    try {
      db.prepare(`INSERT INTO tests(id,name,instrument_id,unit,decimal_places,tea,section,tea_source,tea_ref_key,method,reagent,cusum_on,cusum_k,cusum_h,active)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(newId, name, result.data.instrumentId, unit, decimalPlaces, tea, section, teaSource, teaRefKey, method, reagent, cusumOn ? 1 : 0, cusumK, cusumH, active ? 1 : 0);
      // Mức mặc định: mọi xét nghiệm mới bắt đầu với đúng 1 Mức 1, chưa gán lô
      // (tham khảo defaultAssayLevels() bản cũ) — thêm mức khác qua saveTestLevel.
      db.prepare('INSERT INTO test_levels(id,test_id,level) VALUES (?,?,1)').run(`${newId}:1`, newId);
      writeAudit(db, actor, 'Thêm xét nghiệm', `Tạo xét nghiệm "${name}"`, name);
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* transaction đã đóng */ }
      return { ok: false, error: { code: 'save-failed', message: e instanceof Error ? e.message : 'Tạo xét nghiệm thất bại.' } };
    }
    notifyChanged(['tests'], [newId]);
    return { ok: true, data: db.prepare('SELECT * FROM tests WHERE id=?').get(newId) };
  }

  function listTestLevels(testId: string) {
    return db.prepare('SELECT * FROM test_levels WHERE test_id=? ORDER BY level').all(testId);
  }

  function saveTestLevel(input: { testId: string; data: TestLevelInput }, actor: Actor): IpcResult<TestLevel> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const testId = cleanId(input.testId);
    const test = db.prepare('SELECT id,name FROM tests WHERE id=?').get(testId) as { id: string; name: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    const result = validateTestLevel(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { level, mean, sd, low, high, qcLotId } = result.data;
    const selectedLot = qcLotId ? db.prepare('SELECT id, lot_no, level, depleted, opened, exp FROM qc_lots WHERE id=?').get(qcLotId) as
      { id: string; lot_no: string; level: number; depleted: number; opened: string; exp: string } | undefined : undefined;
    if (qcLotId) {
      if (!selectedLot) return { ok: false, error: { code: 'missing-lot', message: 'Không tìm thấy lô QC đã chọn.' } };
      if (selectedLot.level !== level) {
        return { ok: false, error: { code: 'wrong-lot-level', message: `Lô QC đã chọn thuộc Mức ${selectedLot.level}, không thể gán cho Mức ${level}.` } };
      }
      // `targetRowState()` app cũ khoá toàn bộ hàng của lô đã hết dùng.
      if (selectedLot.depleted) return { ok: false, error: { code: 'depleted-lot', message: 'Lô QC đã hết dùng, không thể gán Mean/SD mới.' } };
    }
    const levelId = `${testId}:${level}`;
    const existing = db.prepare('SELECT id, mean, sd, low, high, qc_lot_id, mfg_mean, mfg_sd, applied, mean_sd_history_json, mean_sd_effective_from FROM test_levels WHERE id=?').get(levelId) as
      { id: string; mean: number | null; sd: number | null; low: number | null; high: number | null; qc_lot_id: string | null; mfg_mean: number | null; mfg_sd: number | null; applied: 'mfg' | 'lab'; mean_sd_history_json: string; mean_sd_effective_from: string } | undefined;
    // UPSERT theo (testId, level): mọi xét nghiệm luôn có sẵn Mức 1 tự tạo
    // lúc thêm xét nghiệm (không có Mean/SD) — lưu lại Mean/SD cho MỘT mức
    // đã tồn tại là cập nhật, không phải tạo mới; mức KHÁC chưa có thì tạo mới.
    // Trang "Lịch sử dữ liệu" đọc `mean_sd_history_json` — chốt giá trị CŨ
    // vào lịch sử trước khi ghi đè, không âm thầm mất dấu vết thay đổi target.
    const today = isoLocalDate();
    const saved = inTransaction(() => {
      if (existing) {
        const lotChanged = existing.qc_lot_id !== (qcLotId || null);
        const changed = lotChanged || existing.mean !== mean || existing.sd !== sd || existing.low !== low || existing.high !== high;
        const oldLot = existing.qc_lot_id ? db.prepare('SELECT lot_no, opened, exp FROM qc_lots WHERE id=?').get(existing.qc_lot_id) as
          { lot_no: string; opened: string; exp: string } | undefined : undefined;
        const nextEffectiveFrom = lotChanged
          ? (selectedLot?.opened || today)
          : changed ? today : (existing.mean_sd_effective_from || selectedLot?.opened || today);
        const historyJson = changed
          ? appendMeanSdHistory(existing.mean_sd_history_json, {
            mean: existing.mean, sd: existing.sd, low: existing.low, high: existing.high,
            qcLotId: existing.qc_lot_id || '', lot: oldLot?.lot_no || '',
            effectiveFrom: existing.mean_sd_effective_from || oldLot?.opened || '',
            effectiveTo: lotChanged ? nextEffectiveFrom : today,
            source: existing.applied,
          }, nowIso())
          : existing.mean_sd_history_json;
        // Nếu đang dùng dải NSX, giá trị vừa lưu là mốc để quy trình
        // "Hoàn dải" phục hồi; dải PXN giữ nguyên mốc NSX dự phòng.
        const mfgMean = existing.applied === 'mfg' ? mean : existing.mfg_mean;
        const mfgSd = existing.applied === 'mfg' ? sd : existing.mfg_sd;
        db.prepare('UPDATE test_levels SET mean=?,sd=?,low=?,high=?,qc_lot_id=?,mfg_mean=?,mfg_sd=?,mean_sd_history_json=?,mean_sd_effective_from=? WHERE id=?')
          .run(mean, sd, low, high, qcLotId || null, mfgMean, mfgSd, historyJson, nextEffectiveFrom, levelId);
      } else {
        db.prepare("INSERT INTO test_levels(id,test_id,level,mean,sd,low,high,qc_lot_id,mfg_mean,mfg_sd,applied,mean_sd_effective_from) VALUES (?,?,?,?,?,?,?,?,?,?,'mfg',?)")
          .run(levelId, testId, level, mean, sd, low, high, qcLotId || null, mean, sd, selectedLot?.opened || today);
      }
      writeAudit(db, actor, existing ? 'Sửa mức QC' : 'Thêm mức QC', `Mức ${level} của xét nghiệm "${test.name}": Mean=${mean ?? '—'} SD=${sd ?? '—'}`, test.name);
      return db.prepare('SELECT * FROM test_levels WHERE id=?').get(levelId);
    });
    notifyChanged(['test_levels'], [testId]);
    return { ok: true, data: saved };
  }

  function listActivity(limit = 200) {
    const rows = db.prepare('SELECT * FROM activity ORDER BY seq DESC LIMIT ?').all(limit) as Record<string, unknown>[];
    return rows.map(rowToAuditEntry);
  }

  /** Phạm vi áp dụng (within/across) từng luật, theo xét nghiệm — lưu ở
   * `tests.rule_scopes_json` và được Entry/Westgard thực thi. Chuỗi rỗng xoá
   * ghi đè để quay lại phạm vi SOP khuyến nghị. */
  function listRuleScopes(testId: string, levelCount?: number) {
    const row = db.prepare('SELECT rule_scopes_json, rule_actions_json FROM tests WHERE id=?').get(testId) as
      { rule_scopes_json: string; rule_actions_json: string } | undefined;
    // Số mức do MAIN tự đếm, không nhận từ renderer: phạm vi khuyến nghị phụ
    // thuộc số mức ĐANG VẬN HÀNH (`operational-levels.ts`, dùng chung với
    // Entry/Westgard), thứ renderer không có cách nào biết đúng. Tham số chỉ
    // để test bơm số mức giả khi kiểm nhánh sanitize.
    const levels = levelCount ?? countOperationalLevels(db, testId);
    return effectiveRuleConfigList(
      parseRuleScopes(row ? row.rule_scopes_json : null), levels,
      readGlobalRules(db), parseRuleActions(row ? row.rule_actions_json : null),
    );
  }

  function saveRuleScope(testId: string, ruleId: string, scope: RuleScope | '', actor: Actor): IpcResult<{ ruleId: string; scope: RuleScope | '' }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const test = db.prepare('SELECT id, name, rule_scopes_json FROM tests WHERE id=?').get(testId) as { id: string; name: string; rule_scopes_json: string } | undefined;
    if (!test) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    if (!WG_RULE_REGISTRY.some(r => r.id === ruleId)) return { ok: false, error: { code: 'invalid-rule', message: 'Mã luật không hợp lệ.' } };
    if (scope !== '' && !RULE_SCOPES.includes(scope)) return { ok: false, error: { code: 'invalid-scope', message: 'Phạm vi luật không hợp lệ.' } };
    const overrides: RuleScopesMap = parseRuleScopes(test.rule_scopes_json);
    if (scope) overrides[ruleId] = scope; else delete overrides[ruleId];
    inTransaction(() => {
      db.prepare('UPDATE tests SET rule_scopes_json=? WHERE id=?').run(serializeRuleScopes(overrides), testId);
      writeAudit(db, actor, 'Sửa phạm vi luật Westgard', `Luật ${ruleId} chuyển thành ${scope ? `phạm vi ${scope}` : 'phạm vi SOP khuyến nghị'}`, test.name);
    });
    notifyChanged(['tests'], [testId]);
    return { ok: true, data: { ruleId, scope } };
  }

  // ---- Lô QC ("Lô & nhóm lô QC") ----
  function listLots() {
    return db.prepare('SELECT * FROM qc_lots ORDER BY lot_no').all();
  }

  /** Kế hoạch đổi số lô: ĐẾM điểm QC sẽ bị viết lại + soi kỳ đã khoá, KHÔNG
   * ghi gì. Điểm QC lưu số lô dạng CHUỖI TĨNH chụp lúc nhập (`qc_points.lot`,
   * xem `entry-handlers.ts` Giai đoạn B2), không tham chiếu `qc_lots.id` —
   * nên đổi `lot_no` mà không cập nhật lại điểm cũ sẽ khiến chúng "biến mất"
   * khỏi mọi bộ lọc theo lô (Nhập QC/Westgard/Sigma): không khớp lô hiện tại
   * (chuỗi đã đổi) mà cũng không hiện ở "lô cũ" (không có hồ sơ chuyển tiếp
   * nào giữa 2 TÊN GỌI của cùng một lô). Đây là VIẾT LẠI HÀNG LOẠT bản ghi
   * lịch sử, nên người dùng phải thấy con số TRƯỚC khi làm — đúng cách app cũ
   * hỏi trong `saveConfigLot()`. */
  function previewLotRename(input: { id: string; lotNo: unknown }): IpcResult<
    { rename: null } | { rename: { oldLotNo: string; newLotNo: string; affected: number; lockedCount: number; lockedPeriods: string[] } }
  > {
    const existing = db.prepare('SELECT lot_no, level FROM qc_lots WHERE id=?').get(input.id) as
      { lot_no: string; level: number } | undefined;
    if (!existing) return { ok: true, data: { rename: null } };
    const newLotNo = cleanText(input.lotNo, 120).trim();
    if (!newLotNo || newLotNo === existing.lot_no) return { ok: true, data: { rename: null } };
    // Quét MỌI xét nghiệm: một lô có thể dùng chung qua Panel QC, và có thể
    // còn nằm trong lịch sử của xét nghiệm giờ đã gắn lô khác.
    const rows = db.prepare('SELECT date FROM qc_points WHERE level=? AND lot=?')
      .all(existing.level, existing.lot_no) as { date: string }[];
    const lockedPeriods = [...new Set(rows.map(row => ymOfDate(row.date)))].filter(ym => isPeriodLocked(ym)).sort();
    const lockedCount = rows.filter(row => lockedPeriods.includes(ymOfDate(row.date))).length;
    return { ok: true, data: { rename: { oldLotNo: existing.lot_no, newLotNo, affected: rows.length, lockedCount, lockedPeriods } } };
  }

  function saveLot(input: { id?: string; data: LotInput }, actor: Actor): IpcResult<QcLot> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = input.id || '';
    const result = validateLot(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { groupId, lotNo, level, description, supplier, program, exp, opened, active, depleted, note } = result.data;
    let before: { lot_no: string; level: number; group_id: string | null } | undefined;
    if (id) {
      before = db.prepare('SELECT lot_no, level, group_id FROM qc_lots WHERE id=?').get(id) as { lot_no: string; level: number; group_id: string | null } | undefined;
      if (!before) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy lô QC cần cập nhật.' } };
      // Đổi mức của lô đang gán Mean/SD cho xét nghiệm — chặn TRƯỚC cổng
      // trùng số lô để người dùng nhận đúng hướng dẫn gỡ liên kết trước.
      if (before.level !== level && db.prepare('SELECT 1 FROM test_levels WHERE qc_lot_id=? LIMIT 1').get(id)) {
        return { ok: false, error: { code: 'level-in-use', message: 'Lô QC đang gắn với xét nghiệm nên không thể đổi mức QC. Hãy bỏ gán lô trong Mean/SD trước.' } };
      }
    }
    // Chặn trùng số lô ở CÙNG mức — port đúng `validateLot()` app cũ
    // (`sameText()`, không phân biệt hoa/thường/dấu).
    const sameLevelLots = db.prepare('SELECT id, lot_no FROM qc_lots WHERE level=?').all(level) as { id: string; lot_no: string }[];
    if (sameLevelLots.some(row => row.id !== id && sameText(row.lot_no, lotNo))) {
      return { ok: false, error: { code: 'duplicate-lot', message: 'Số lô QC này đã tồn tại ở cùng mức QC.' } };
    }
    if (id) {
      // Đổi số lô thì ghi lại nhãn lô trên MỌI điểm QC cũ của lô đó, trong
      // CÙNG transaction với việc sửa cấu hình — nửa vời (đổi cấu hình mà
      // không đổi điểm, hoặc ngược lại) là trạng thái không thể tự phục hồi.
      const renaming = !!before?.lot_no && before.lot_no !== lotNo;
      let renamed = 0;
      db.exec('BEGIN');
      try {
        // KHÔNG gửi `groupId` nghĩa là "giữ nguyên nhóm", không phải "gỡ khỏi
        // nhóm" — cùng ngữ nghĩa `prepareLabProfile(existing)` dùng cho logo.
        // Form "Sửa lô QC" không có ô chọn nhóm (membership do modal Nhóm lô
        // QC quản lý), nên nó không gửi trường này; trước bản sửa, mỗi lần
        // sửa một lô là `group_id` bị ghi NULL và lô LẶNG LẼ rơi khỏi nhóm.
        // Hậu quả không dừng ở thẻ nhóm lô thiếu một lô: mức QC gắn lô đó lập
        // tức hết "đang vận hành", nên biến mất khỏi Tổng quan/Westgard và
        // ngừng được đánh giá ở Nhập QC. Đo được: nhóm 2 lô còn 1 lô sau khi
        // chỉ sửa mỗi ô Nhà cung cấp.
        db.prepare(`UPDATE qc_lots SET group_id=?,lot_no=?,level=?,description=?,supplier=?,program=?,exp=?,opened=?,active=?,depleted=?,note=? WHERE id=?`)
          .run(groupId || before?.group_id || null, lotNo, level, description, supplier, program, exp, opened, active ? 1 : 0, depleted ? 1 : 0, note, id);
        if (renaming) {
          renamed = Number(db.prepare('UPDATE qc_points SET lot=? WHERE level=? AND lot=?')
            .run(lotNo, before!.level, before!.lot_no).changes || 0);
        }
        writeAudit(db, actor, 'Sửa lô QC',
          renaming ? `Đổi số lô "${before!.lot_no}" → "${lotNo}" mức ${level}, cập nhật ${renamed} điểm QC`
            : `Cập nhật lô "${lotNo}" mức ${level}`, lotNo);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      notifyChanged(renaming ? ['qc_lots', 'qc_points'] : ['qc_lots']);
      return { ok: true, data: db.prepare('SELECT * FROM qc_lots WHERE id=?').get(id) };
    }
    const newId = cleanId(uid());
    const savedLot = inTransaction(() => {
      db.prepare(`INSERT INTO qc_lots(id,group_id,lot_no,level,description,supplier,program,exp,opened,active,depleted,note)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(newId, groupId || null, lotNo, level, description, supplier, program, exp, opened, active ? 1 : 0, depleted ? 1 : 0, note);
      writeAudit(db, actor, 'Thêm lô QC', `Tạo lô "${lotNo}" mức ${level}`, lotNo);
      return db.prepare('SELECT * FROM qc_lots WHERE id=?').get(newId);
    });
    notifyChanged(['qc_lots']);
    return { ok: true, data: savedLot };
  }

  // ---- Nhóm lô QC ----
  /** "Đang hoạt động" là trạng thái SUY, không lưu cứng — port
   * `lotGroupInUse()` app cũ: true khi có ÍT NHẤT 1 lô của nhóm đang được
   * gán (`test_levels.qc_lot_id`) cho xét nghiệm nào đó. */
  function lotGroupInUse(lotIds: string[]): boolean {
    if (!lotIds.length) return false;
    const placeholders = lotIds.map(() => '?').join(',');
    return !!db.prepare(`SELECT 1 FROM test_levels WHERE qc_lot_id IN (${placeholders}) LIMIT 1`).get(...lotIds);
  }

  function listLotGroups() {
    const groups = db.prepare('SELECT * FROM lot_groups ORDER BY name').all() as (Omit<LotGroup, 'lotIds' | 'inUse'> & { archived_lot_ids_json: string })[];
    return groups.map(g => {
      const liveLotIds = (db.prepare('SELECT id FROM qc_lots WHERE group_id=?').all(g.id) as { id: string }[]).map(r => r.id);
      // Nhóm "Đã lưu trữ" hiện lotIds từ ẢNH CHỤP đã chốt lúc lưu trữ (giữ
      // NGUYÊN mọi thành viên cũ, kể cả lô không hề chuyển tiếp — xem
      // schema.ts's comment ở cột `archived_lot_ids_json`), không phải từ
      // group_id SỐNG của qc_lots — lô không chuyển tiếp đã thật sự đổi
      // sang group_id của nhóm ĐANG hoạt động rồi, live-derive sẽ chỉ còn
      // đúng 1 lô dù tên nhóm vẫn ngụ ý đủ 2+.
      let lotIds = liveLotIds;
      if (g.archived_lot_ids_json) {
        try {
          const parsed = JSON.parse(g.archived_lot_ids_json);
          if (Array.isArray(parsed)) lotIds = parsed;
        } catch { /* JSON hỏng thì rơi về danh sách sống */ }
      }
      return { ...g, lotIds, inUse: lotGroupInUse(liveLotIds) };
    });
  }

  function saveLotGroup(input: { id?: string; data: LotGroupInput }, actor: Actor): IpcResult<LotGroup> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = input.id || '';
    const lotRows = db.prepare('SELECT id, lot_no FROM qc_lots').all() as { id: string; lot_no: string }[];
    const lotNoById = new Map(lotRows.map(row => [row.id, row.lot_no]));
    const requestedLotIds = Array.isArray(input.data.lotIds)
      ? [...new Set(input.data.lotIds.map(cleanId).filter(Boolean))]
      : [];
    // `prepareLotGroup()` app cũ: tên trống tự ghép từ số lô theo đúng thứ
    // tự người dùng chọn, ví dụ 1101/1102.
    const fallbackName = requestedLotIds.map(lotId => lotNoById.get(lotId)).filter(Boolean).join('/');
    const result = validateLotGroup(input.data, fallbackName);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, manufacturer, material, catalog, note, active, status, lotIds } = result.data;
    const knownLots = new Set(lotRows.map(r => r.id));
    const validLotIds = lotIds.filter(l => knownLots.has(l));
    if (validLotIds.length < 2) return { ok: false, error: { code: 'not-enough-lots', message: 'Nhóm lô QC cần ít nhất 2 lô hợp lệ.' } };
    // Chặn trùng nhóm lô — port đúng `validateLotGroup()` app cũ: trùng TÊN
    // (không phân biệt hoa/thường/dấu) HOẶC trùng NGUYÊN BỘ LÔ (không kể thứ
    // tự) với một nhóm khác đã có.
    const otherGroups = (db.prepare('SELECT id, name FROM lot_groups WHERE id!=?').all(id || '') as { id: string; name: string }[]);
    const validLotIdSet = new Set(validLotIds);
    const sameLotSet = (otherId: string) => {
      const otherLotIds = (db.prepare('SELECT id FROM qc_lots WHERE group_id=?').all(otherId) as { id: string }[]).map(r => r.id);
      return otherLotIds.length === validLotIdSet.size && otherLotIds.every(l => validLotIdSet.has(l));
    };
    if (otherGroups.some(group => sameText(group.name, name) || sameLotSet(group.id))) {
      return { ok: false, error: { code: 'duplicate-group', message: 'Nhóm lô này đã tồn tại hoặc trùng danh sách lô.' } };
    }
    let groupId = id;
    if (id && !db.prepare('SELECT id FROM lot_groups WHERE id=?').get(id)) {
      return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy nhóm lô cần cập nhật.' } };
    }
    if (!id) groupId = cleanId(uid());
    // Hàng nhóm và việc gỡ/gán lại TẤT CẢ lô là một lần lưu nghiệp vụ. Nếu
    // lỗi ở giữa, rollback nguyên khối để không còn nhóm có danh sách thành
    // viên dở dang hoặc lô bị gỡ khỏi nhóm cũ mà chưa vào nhóm mới.
    db.exec('BEGIN');
    try {
      if (id) {
        db.prepare('UPDATE lot_groups SET name=?,manufacturer=?,material=?,catalog=?,note=?,active=?,status=? WHERE id=?')
          .run(name, manufacturer, material, catalog, note, active ? 1 : 0, status, id);
      } else {
        db.prepare('INSERT INTO lot_groups(id,name,manufacturer,material,catalog,note,active,status) VALUES (?,?,?,?,?,?,?,?)')
          .run(groupId, name, manufacturer, material, catalog, note, active ? 1 : 0, status);
      }
      // Gỡ các lô KHÔNG còn thuộc nhóm này nữa, rồi gán lại đúng danh sách mới —
      // 1 lô chỉ thuộc 1 nhóm tại 1 thời điểm (qc_lots.group_id, không phải bảng
      // junction nhiều-nhiều).
      db.prepare('UPDATE qc_lots SET group_id=NULL WHERE group_id=?').run(groupId);
      for (const lotId of validLotIds) db.prepare('UPDATE qc_lots SET group_id=? WHERE id=?').run(groupId, lotId);
      writeAudit(db, actor, id ? 'Sửa nhóm lô QC' : 'Thêm nhóm lô QC', `Nhóm "${name}" (${validLotIds.length} lô)`, name);
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* transaction đã đóng */ }
      return { ok: false, error: { code: 'save-failed', message: e instanceof Error ? e.message : 'Lưu nhóm lô QC thất bại.' } };
    }
    notifyChanged(['lot_groups', 'qc_lots']);
    // Ép về đúng kiểu hợp đồng thay vì `as object`: spread một `object` cho ra
    // `{}` nên TypeScript không còn thấy field nào, và hợp đồng
    // `IpcResult<LotGroup>` trở thành vô nghĩa.
    const groupRow = db.prepare('SELECT * FROM lot_groups WHERE id=?').get(groupId) as Omit<LotGroup, 'lotIds' | 'inUse'>;
    return { ok: true, data: { ...groupRow, lotIds: validLotIds, inUse: lotGroupInUse(validLotIds) } };
  }

  // ---- Panel QC ----
  function listPanels() {
    const panels = db.prepare('SELECT * FROM qc_panels ORDER BY name').all() as Omit<QcPanel, 'testIds'>[];
    return panels.map(p => ({ ...p, testIds: (db.prepare('SELECT test_id FROM qc_panel_tests WHERE panel_id=?').all(p.id) as { test_id: string }[]).map(r => r.test_id) }));
  }

  function savePanel(input: { id?: string; data: PanelInput }, actor: Actor): IpcResult<QcPanel> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = input.id || '';
    const knownInstrumentIds = new Set((db.prepare('SELECT id FROM instruments').all() as { id: string }[]).map(r => r.id));
    const result = validatePanel(input.data, knownInstrumentIds);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, instrumentId, note, active, testIds } = result.data;
    // Các cổng còn lại: không lưu Panel QC rỗng xét nghiệm hoặc chứa xét
    // nghiệm KHÁC máy đã chọn (im lặng, không báo).
    if (!testIds.length) return { ok: false, error: { code: 'missing-tests', message: 'Chọn ít nhất một xét nghiệm.' } };
    const testRows = db.prepare(`SELECT id, instrument_id FROM tests WHERE id IN (${testIds.map(() => '?').join(',')})`).all(...testIds) as { id: string; instrument_id: string }[];
    const knownTests = new Set(testRows.map((t) => t.id));
    const validTestIds = testIds.filter((t) => knownTests.has(t));
    if (!validTestIds.length) return { ok: false, error: { code: 'missing-tests', message: 'Chọn ít nhất một xét nghiệm hợp lệ.' } };
    // App cũ coi MỌI id không tồn tại như một xét nghiệm không thuộc máy đã
    // chọn và từ chối TOÀN BỘ lần lưu. Không được âm thầm bỏ id hỏng rồi lưu
    // phần còn lại: kết quả sẽ khác với lựa chọn mà người dùng vừa xác nhận.
    if (validTestIds.length !== testIds.length) {
      return { ok: false, error: { code: 'wrong-instrument', message: 'Panel QC chỉ được chứa xét nghiệm thuộc máy đã chọn.' } };
    }
    if (testRows.some((t) => t.instrument_id !== instrumentId)) {
      return { ok: false, error: { code: 'wrong-instrument', message: 'Panel QC chỉ được chứa xét nghiệm thuộc máy đã chọn.' } };
    }
    const sameInstrumentNames = (db.prepare('SELECT name FROM qc_panels WHERE id!=? AND instrument_id=?').all(id || '', instrumentId) as { name: string }[]).map((panel) => panel.name);
    if (sameInstrumentNames.some((existingName) => sameText(existingName, name))) {
      return { ok: false, error: { code: 'duplicate-panel', message: 'Panel QC này đã tồn tại trên máy đã chọn.' } };
    }
    let panelId = id;
    if (id && !db.prepare('SELECT id FROM qc_panels WHERE id=?').get(id)) {
      return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy Panel QC cần cập nhật.' } };
    }
    if (!id) panelId = cleanId(uid());
    // Hàng Panel và toàn bộ bảng nối là MỘT lần lưu nghiệp vụ. Transaction
    // ngăn trạng thái nửa vời nếu một insert bảng nối thất bại sau khi hàng
    // Panel đã cập nhật hoặc sau khi liên kết cũ đã bị xoá.
    db.exec('BEGIN');
    try {
      if (id) {
        db.prepare('UPDATE qc_panels SET name=?,instrument_id=?,note=?,active=? WHERE id=?').run(name, instrumentId, note, active ? 1 : 0, id);
      } else {
        db.prepare('INSERT INTO qc_panels(id,name,instrument_id,note,active) VALUES (?,?,?,?,?)').run(panelId, name, instrumentId, note, active ? 1 : 0);
      }
      db.prepare('DELETE FROM qc_panel_tests WHERE panel_id=?').run(panelId);
      for (const testId of validTestIds) db.prepare('INSERT INTO qc_panel_tests(panel_id,test_id) VALUES (?,?)').run(panelId, testId);
      writeAudit(db, actor, id ? 'Sửa Panel QC' : 'Thêm Panel QC', `Panel "${name}" (${validTestIds.length} xét nghiệm)`, name);
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* transaction đã đóng */ }
      return { ok: false, error: { code: 'save-failed', message: e instanceof Error ? e.message : 'Lưu Panel QC thất bại.' } };
    }
    notifyChanged(['qc_panels', 'qc_panel_tests']);
    const panelRow = db.prepare('SELECT * FROM qc_panels WHERE id=?').get(panelId) as Omit<QcPanel, 'testIds'>;
    return { ok: true, data: { ...panelRow, testIds: validTestIds } };
  }

  // ---- Chuyển tiếp lô ----
  function listLotTransitions() {
    return db.prepare('SELECT * FROM lot_transitions ORDER BY start_date DESC').all();
  }

  const LOT_TRANSITION_STATUS_TEXT: Record<string, string> = {
    planned: 'Dự kiến', active: 'Đang chạy song song', accepted: 'Chấp nhận lô mới', rejected: 'Không chấp nhận',
  };

  /** Hồ sơ chuyển lô — MỘT hàm lưu duy nhất, đúng mô hình app cũ
   * (`saveLotTransitionV2`/`ManageLotTransitionCommand.prepare/acceptanceGate/
   * execute`): modal có 1 ô "Trạng thái" chọn được cả 4 giá trị + 1 nút Lưu
   * duy nhất, KHÔNG phải các nút hành động tách rời (Kích hoạt/Chấp nhận/
   * Không chấp nhận) như bản trước trong phiên này — bản đó tự nghĩ ra một
   * luồng khác app cũ, người dùng đã yêu cầu sửa lại cho giống.
   * `finalChanged` (đang chuyển SANG accepted/rejected LẦN ĐẦU) là điều
   * kiện duy nhất cần re-auth (đã kiểm tra ở phía renderer TRƯỚC khi gọi
   * hàm này, giống app cũ gọi `reauthenticateCurrentUser()` trước khi lưu).
   * Chỉ 'accepted' mới thật sự áp Mean/SD ứng viên (`criteria`) vào
   * `test_levels`, đánh dấu lô cũ hết dùng (`depleted`), và chuyển lô mới
   * vào đúng nhóm lô của lô cũ — port `applyAcceptedLotTransition` app cũ,
   * rút gọn theo mô hình FK `qc_lots.group_id` của app-v2. Một khi đã
   * 'accepted' thì KHÔNG đổi được status nữa (`accepted-immutable`, đúng
   * `validateLotTransition()` app cũ: `switchesLot(old) && status!=='accepted'`)
   * — 'rejected' thì KHÔNG khoá (app cũ cho sửa lại một hồ sơ đã từ chối). */
  function createLotTransition(
    input: { id?: string; data: LotTransitionInput & { criteria?: { testId: string; level: number; mean: number; sd: number; low?: number | null; high?: number | null }[] } },
    actor: Actor,
  ): IpcResult<LotTransition> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const result = validateLotTransition(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { panelId, fromLotId, toLotId, startDate, note } = result.data;
    const panel = db.prepare('SELECT id, name FROM qc_panels WHERE id=?').get(panelId) as { id: string; name: string } | undefined;
    if (!panel) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy Panel QC.' } };
    const fromLot = db.prepare('SELECT id, lot_no, level, group_id, opened, exp FROM qc_lots WHERE id=?').get(fromLotId) as { id: string; lot_no: string; level: number; group_id: string | null; opened: string; exp: string } | undefined;
    const toLot = db.prepare('SELECT id, lot_no, level, opened, exp FROM qc_lots WHERE id=?').get(toLotId) as { id: string; lot_no: string; level: number; opened: string; exp: string } | undefined;
    if (!fromLot || !toLot) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy lô QC đã chọn.' } };
    if (fromLot.level !== toLot.level) return { ok: false, error: { code: 'different-levels', message: 'Lô cũ và lô mới phải cùng mức QC để chuyển tiếp.' } };

    const existing = input.id ? db.prepare('SELECT * FROM lot_transitions WHERE id=?').get(input.id) as
      { id: string; status: string; approved_at: string; approved_by: string } | undefined : undefined;
    if (input.id && !existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ chuyển lô.' } };
    // `status` thiếu (không phải chuỗi) khi SỬA thì giữ nguyên trạng thái cũ
    // (không âm thầm lùi về 'planned') — modal thật luôn gửi kèm giá trị
    // <select> hiện tại nên trường hợp này chỉ xảy ra với caller lập trình
    // quên truyền, an toàn hơn là coi đó là ý định lùi trạng thái.
    const status = typeof input.data.status === 'string' && input.data.status
      ? result.data.status
      : existing ? (existing.status as PreparedLotTransition['status']) : 'planned';
    if (existing && existing.status === 'accepted' && status !== 'accepted') {
      return { ok: false, error: { code: 'accepted-immutable', message: 'Hồ sơ đã chấp nhận lô mới và đã áp dụng vào nhóm lô/Mean-SD, không thể đổi ngược trạng thái.' } };
    }
    const dup = db.prepare('SELECT id FROM lot_transitions WHERE panel_id=? AND from_lot_id=? AND to_lot_id=? AND id!=?')
      .get(panelId, fromLotId, toLotId, input.id || '');
    if (dup) return { ok: false, error: { code: 'duplicate-transition', message: 'Chuyển tiếp lô này đã tồn tại.' } };

    const finalChanged = (status === 'accepted' || status === 'rejected') && (!existing || existing.status !== status);
    const criteria = input.data.criteria || [];

    if (status === 'accepted' && finalChanged) {
      // Cổng "acceptanceGate": mọi xét nghiệm trong Panel ĐANG DÙNG lô cũ
      // phải có Mean/SD ứng viên hợp lệ mới cho chấp nhận — port nguyên văn
      // 2 nhánh lỗi của `ManageLotTransitionCommand.acceptanceGate()`.
      const panelTests = db.prepare(`SELECT t.id, t.name FROM tests t
        JOIN qc_panel_tests pt ON pt.test_id=t.id WHERE pt.panel_id=?`).all(panelId) as { id: string; name: string }[];
      const rows = panelTests
        .map((t) => ({ t, level: db.prepare('SELECT level FROM test_levels WHERE test_id=? AND qc_lot_id=?').get(t.id, fromLotId) as { level: number } | undefined }))
        .filter((row) => row.level);
      if (!rows.length) return { ok: false, error: { code: 'no-target-tests', message: 'Panel đã chọn không có xét nghiệm nào đang sử dụng lô cũ. Hãy kiểm tra lại Panel và lô chuyển tiếp.' } };
      // Mean có thể bằng 0 hoặc âm (ví dụ Base excess); chỉ SD bắt buộc >0.
      // App cũ kiểm `Number.isFinite(mean)` qua snapshot Mean/SD, không kiểm
      // `mean > 0`. Điều kiện cũ làm hồ sơ hợp lệ không thể được chấp nhận.
      const missing = rows.filter((row) => !criteria.some((c) => c.testId === row.t.id
        && c.level === row.level!.level && Number.isFinite(Number(c.mean))
        && Number.isFinite(Number(c.sd)) && Number(c.sd) > 0));
      if (missing.length) {
        return { ok: false, error: { code: 'missing-target', message: `Chưa thể chấp nhận lô mới: ${missing.map((row) => row.t.name).join(', ')} chưa có Mean/SD hợp lệ cho lô ${toLot.lot_no}. Hãy điền đủ ở bảng Mean/SD phía trên rồi lưu lại.` } };
      }
    }

    const at = nowIso();
    const criteriaJson = JSON.stringify(criteria);
    const applyCascade = () => {
      for (const item of criteria) {
        const level = db.prepare('SELECT * FROM test_levels WHERE test_id=? AND level=?').get(item.testId, item.level) as
          { id: string; qc_lot_id: string | null; mean: number | null; sd: number | null; low: number | null; high: number | null; applied: 'mfg' | 'lab'; mean_sd_history_json: string | null; mean_sd_effective_from: string } | undefined;
        if (!level || level.qc_lot_id !== fromLotId) continue;
        // Nguồn 'mfg' (NSX) — KHÔNG phải 'lab' (PXN). Mean/SD ứng viên nhập
        // trong modal chuyển lô là số của NHÀ SẢN XUẤT cho lô mới, không đi
        // qua luồng "Xây dựng dải PXN" riêng (`rangeCandidate()`/
        // `applyNewRange()` ở trang Nhập QC & Biểu đồ) — đúng
        // `applyPlannedTarget()` app cũ luôn ghi `source:'mfg'` cho Mean/SD
        // nhập trong modal chuyển lô. Ghi 'lab' ở đây là bug thật (người
        // dùng phát hiện qua cột "Nguồn" của tab Lịch sử dữ liệu hiện PXN
        // cho lô vừa chuyển tiếp, dù chưa hề qua trang Nhập QC).
        db.prepare('UPDATE test_levels SET qc_lot_id=?, mean=?, sd=?, low=?, high=?, applied=?, mean_sd_history_json=?, mean_sd_effective_from=? WHERE id=?')
          .run(toLotId, item.mean, item.sd, item.low ?? null, item.high ?? null, 'mfg',
            appendMeanSdHistory(level.mean_sd_history_json, {
              mean: level.mean, sd: level.sd, low: level.low, high: level.high,
              qcLotId: level.qc_lot_id || '', lot: fromLot.lot_no,
              effectiveFrom: level.mean_sd_effective_from || fromLot.opened || '',
              effectiveTo: startDate || toLot.opened || at.slice(0, 10), source: level.applied,
            }, at),
            toLot.opened || startDate || at.slice(0, 10), level.id);
      }
      db.prepare('UPDATE qc_lots SET depleted=1 WHERE id=?').run(fromLotId);
      // Port ĐÚNG `applyAcceptedLotTransition()` app cũ — KHÔNG chỉ đơn
      // giản là "gỡ group_id của lô cũ": app cũ LƯU TRỮ nguyên trạng thái
      // CŨ của nhóm thành một bản ghi RIÊNG (tên/hãng/vật liệu/mã hàng cũ,
      // vẫn giữ lô cũ làm thành viên, đánh dấu "Đã lưu trữ" kèm ghi chú
      // "Đã dùng khi chuyển tiếp lô X sang Y"), còn nhóm ĐANG HOẠT ĐỘNG giữ
      // NGUYÊN id gốc — chỉ thay lô cũ bằng lô mới trong danh sách thành
      // viên (các lô KHÁC trong nhóm không phải di chuyển đi đâu vì nhóm
      // gốc vẫn còn đó) và tự đổi tên theo tổ hợp lô mới NẾU tên đang là tên
      // tự đặt (không đổi nếu người dùng đã đặt tên riêng). Bản trước trong
      // phiên này chỉ gỡ group_id của lô cũ về NULL — sai theo ảnh chụp
      // người dùng gửi (app cũ giữ lô cũ lại trong một nhóm "Đã lưu trữ",
      // không thả nó ra khỏi mọi nhóm).
      if (fromLot.group_id) {
        const group = db.prepare('SELECT * FROM lot_groups WHERE id=?').get(fromLot.group_id) as
          { id: string; name: string; manufacturer: string; material: string; catalog: string } | undefined;
        if (group) {
          const members = db.prepare('SELECT id, lot_no FROM qc_lots WHERE group_id=?').all(group.id) as { id: string; lot_no: string }[];
          const oldName = members.map((m) => m.lot_no).join('/');
          const autoNamed = !group.name || group.name === oldName;
          const archivedId = cleanId(uid());
          // Ảnh chụp NGUYÊN VẸN thành viên cũ (kể cả lô KHÔNG chuyển tiếp,
          // vd lô B khi A→C) — port đúng `applyAcceptedLotTransition()` app
          // cũ (`lotIds: oldIds`). Không chốt lại thì card "Đã lưu trữ" chỉ
          // còn đúng lô đã chuyển tiếp, thiếu lô B dù tên nhóm vẫn "A/B".
          const archivedLotIdsJson = JSON.stringify(members.map((m) => m.id));
          db.prepare(`INSERT INTO lot_groups(id,name,manufacturer,material,catalog,note,active,status,stopped_at,archived_lot_ids_json)
            VALUES (?,?,?,?,?,?,0,'stopped',?,?)`)
            .run(archivedId, group.name, group.manufacturer, group.material, group.catalog,
              `Đã dùng khi chuyển tiếp lô ${fromLot.lot_no} sang ${toLot.lot_no}`, startDate || at, archivedLotIdsJson);
          db.prepare('UPDATE qc_lots SET group_id=? WHERE id=?').run(archivedId, fromLotId);
          db.prepare('UPDATE qc_lots SET group_id=? WHERE id=?').run(group.id, toLotId);
          if (autoNamed) {
            const newName = members.map((m) => (m.id === fromLotId ? toLot.lot_no : m.lot_no)).join('/');
            if (newName !== group.name) db.prepare('UPDATE lot_groups SET name=? WHERE id=?').run(newName, group.id);
          }
        }
      }
    };

    const approvedAt = finalChanged ? at : existing?.approved_at || '';
    const approvedBy = finalChanged ? actor.username : existing?.approved_by || '';

    db.exec('BEGIN');
    try {
      let id = input.id || '';
      if (existing) {
        db.prepare('UPDATE lot_transitions SET panel_id=?, from_lot_id=?, to_lot_id=?, start_date=?, status=?, note=?, criteria_json=?, approved_at=?, approved_by=? WHERE id=?')
          .run(panelId, fromLotId, toLotId, startDate, status, note, criteriaJson, approvedAt, approvedBy, id);
      } else {
        id = cleanId(uid());
        db.prepare(`INSERT INTO lot_transitions(id,panel_id,from_lot_id,to_lot_id,start_date,status,note,criteria_json,approved_at,approved_by)
          VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, panelId, fromLotId, toLotId, startDate, status, note, criteriaJson, approvedAt, approvedBy);
      }
      if (status === 'accepted' && finalChanged) applyCascade();
      db.exec('COMMIT');

      const detail = `${panel.name}: ${fromLot.lot_no} → ${toLot.lot_no} · ${LOT_TRANSITION_STATUS_TEXT[status]}`;
      writeAudit(db, actor, existing ? 'Sửa hồ sơ chuyển lô' : 'Thêm hồ sơ chuyển lô', detail, panel.name);
      if (status === 'accepted' && finalChanged) {
        writeAudit(db, actor, 'Áp dụng chuyển tiếp lô', `${panel.name} · ${fromLot.lot_no} → ${toLot.lot_no} · ${criteria.length} xét nghiệm`, panel.name);
        notifyChanged(['lot_transitions', 'qc_lots', 'lot_groups', 'test_levels', 'tests']);
      } else {
        notifyChanged(['lot_transitions']);
      }
      return { ok: true, data: db.prepare('SELECT * FROM lot_transitions WHERE id=?').get(id) };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  // ---- Bảng TEa tham chiếu ----
  function listTeaRefs() {
    return db.prepare('SELECT * FROM tea_refs ORDER BY name').all();
  }

  /** dd/mm/yyyy — audit log của hồ sơ TEa PXN đọc lại bởi người phụ trách
   * tuân thủ, ISO thô khó đọc hơn hẳn so với các dòng audit khác trong file
   * này (phần lớn không có ngày trong `detail`). */
  function dmy(value: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
  }

  function saveTeaRef(input: { id?: string; data: TeaRefInput }, actor: Actor): IpcResult<TeaRef> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = input.id || '';
    const result = validateTeaRef(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, unit, section, labValue, labSource, reference, reason, effectiveDate, approvedDate, nextReviewDate, preparedBy, approvedBy } = result.data;
    const sourcesJson = JSON.stringify({ reference, reason, effectiveDate, approvedDate, approvedBy });
    const sourceLabel = TEA_LAB_SOURCE_LABELS[labSource] || labSource;
    // Đầy đủ trường tuân thủ trong `detail` — port đúng `saveLabProfile()`
    // app cũ. Trước đây chỉ ghi "Cập nhật X"/"Tạo X", không có gì để đối
    // chiếu khi rà soát ISO 15189 dù toàn bộ các trường này đã có sẵn lúc
    // lưu (nguồn/tham chiếu/lý do/ngày hiệu lực-duyệt/người chuẩn bị-duyệt).
    const detailOf = (before: number | null) =>
      `${name} · ${before ?? '—'}% → ${labValue}% · ${sourceLabel} · ${reference} · Hiệu lực ${dmy(effectiveDate)}`
      + ` · Xây dựng: ${preparedBy} · Phê duyệt: ${approvedBy} (${dmy(approvedDate)})`
      + `${nextReviewDate ? ' · Xem xét lại ' + dmy(nextReviewDate) : ''} · Lý do: ${reason}`;
    if (id) {
      const existing = db.prepare('SELECT id, lab FROM tea_refs WHERE id=?').get(id) as { id: string; lab: number | null } | undefined;
      if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ TEa cần cập nhật.' } };
      const saved = inTransaction(() => {
        db.prepare(`UPDATE tea_refs SET name=?,unit=?,section=?,lab=?,lab_source=?,lab_prepared_by=?,lab_next_review_date=?,sources_json=? WHERE id=?`)
          .run(name, unit, section, labValue, labSource, preparedBy, nextReviewDate, sourcesJson, id);
        writeAudit(db, actor, existing.lab == null ? 'Thiết lập TEa chuẩn hóa' : 'Cập nhật TEa chuẩn hóa', detailOf(existing.lab), name);
        return db.prepare('SELECT * FROM tea_refs WHERE id=?').get(id);
      });
      notifyChanged(['tea_refs']);
      return { ok: true, data: saved };
    }
    const newId = cleanId(uid());
    const saved = inTransaction(() => {
      db.prepare(`INSERT INTO tea_refs(id,name,unit,section,lab,lab_source,lab_prepared_by,lab_next_review_date,sources_json)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(newId, name, unit, section, labValue, labSource, preparedBy, nextReviewDate, sourcesJson);
      writeAudit(db, actor, 'Thiết lập TEa chuẩn hóa', detailOf(null), name);
      return db.prepare('SELECT * FROM tea_refs WHERE id=?').get(newId);
    });
    notifyChanged(['tea_refs']);
    return { ok: true, data: saved };
  }

  /** Sửa trực tiếp TEa CLIA%/Ricos% của MỘT analyte trong danh mục tích hợp
   * — port `teaRefEdit(analyteId, field, value)` app cũ. Ghi đè được lưu
   * thành 1 hàng `tea_refs` khoá theo `analyte_id`; để trống ô = xoá ghi đè
   * (nếu hàng đó cũng không có hồ sơ TEa PXN thì xoá luôn hàng, để bảng quay
   * về đúng giá trị mặc định của danh mục thay vì giữ một hàng rỗng). */
  function setTeaRefValue(
    input: { analyteId: unknown; field: unknown; value: unknown; name?: unknown; unit?: unknown; section?: unknown },
    actor: Actor,
  ): IpcResult<{ analyteId: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const analyteId = cleanId(String(input.analyteId || ''));
    const field = String(input.field || '');
    if (!analyteId) return { ok: false, error: { code: 'invalid-analyte', message: 'Thiếu mã analyte.' } };
    if (field !== 'clia' && field !== 'ricos') return { ok: false, error: { code: 'invalid-field', message: 'Chỉ sửa được TEa CLIA% hoặc Ricos%.' } };
    const raw = String(input.value ?? '').trim();
    let value: number | null = null;
    if (raw !== '') {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { ok: false, error: { code: 'invalid-value', message: 'TEa phải là số lớn hơn 0.' } };
      }
      value = parsed;
    }
    const name = String(input.name || analyteId);
    const existing = db.prepare('SELECT * FROM tea_refs WHERE analyte_id=?').get(analyteId) as
      { id: string; clia: number | null; ricos: number | null; lab: number | null; clia_absolute: number | null } | undefined;
    if (!existing && value == null) return { ok: true, data: { analyteId } };
    const label = field === 'clia' ? 'CLIA' : 'Ricos';
    inTransaction(() => {
      if (existing) {
        db.prepare(`UPDATE tea_refs SET ${field}=? WHERE id=?`).run(value, existing.id);
        const after = db.prepare('SELECT clia, ricos, lab, clia_absolute FROM tea_refs WHERE id=?').get(existing.id) as
          { clia: number | null; ricos: number | null; lab: number | null; clia_absolute: number | null };
        if (after.clia == null && after.ricos == null && after.lab == null && after.clia_absolute == null) db.prepare('DELETE FROM tea_refs WHERE id=?').run(existing.id);
      } else {
        const newId = cleanId(uid());
        db.prepare(`INSERT INTO tea_refs(id,analyte_id,name,unit,section,${field}) VALUES (?,?,?,?,?,?)`)
          .run(newId, analyteId, name, String(input.unit || ''), String(input.section || ''), value);
      }
      writeAudit(db, actor, 'Sửa bảng TEa tham chiếu',
        value == null ? `Bỏ ghi đè TEa ${label} của "${name}"` : `Đặt TEa ${label} của "${name}" = ${value}%`, name);
    });
    notifyChanged(['tea_refs']);
    return { ok: true, data: { analyteId } };
  }

  /** Thêm một DÒNG analyte mới vào bảng TEa tham chiếu (nút "＋ Thêm xét
   * nghiệm" ở tab TEa, modal "Thêm xét nghiệm tham chiếu" của app cũ —
   * `teaRefAddSubmit()`). Khác hẳn `saveTeaRef` (hồ sơ TEa CHUẨN HOÁ của
   * PXN, bắt buộc 6 trường gồm giá trị > 0 và lý do ≥10 ký tự): ở đây chỉ
   * khai một analyte danh mục mới, TEa CLIA%/Ricos% đều có thể để trống.
   * app-v2 trước đó thiếu hẳn nghiệp vụ này và nút toolbar mở sai modal (mở
   * "Thêm hồ sơ TEa"), phát hiện khi dò trigger modal cho gate parity. */
  function addTeaAnalyte(
    input: { name: unknown; abbreviation?: unknown; matrix?: unknown; unit?: unknown; section?: unknown; clia?: unknown; ricos?: unknown; cliaRule?: unknown; cliaAbsolute?: unknown; cliaAbsoluteUnit?: unknown },
    actor: Actor,
  ): IpcResult<{ analyteId: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const name = cleanText(input.name, 120).trim();
    if (!name) return { ok: false, error: { code: 'missing-name', message: 'Nhập tên xét nghiệm.' } };
    const num = (value: unknown): number | null => {
      const raw = String(value ?? '').trim();
      if (raw === '') return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };
    // Khoá analyte suy từ tên (bỏ dấu, gạch nối) — cùng quy ước
    // `teaAnalyteKey()` app cũ để hồ sơ PXN và ghi đè CLIA/Ricos khớp nhau.
    const analyteId = cleanId(name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || uid());
    const existing = db.prepare('SELECT id FROM tea_refs WHERE analyte_id=?').get(analyteId) as { id: string } | undefined;
    if (existing) return { ok: false, error: { code: 'duplicate', message: `Đã có xét nghiệm tham chiếu "${name}".` } };
    const cliaRule = ['percent', 'absolute', 'greater-of'].includes(String(input.cliaRule || '')) ? String(input.cliaRule) : '';
    const cliaAbsolute = num(input.cliaAbsolute);
    if (cliaRule === 'absolute' && cliaAbsolute == null) return { ok: false, error: { code: 'missing-clia-absolute', message: 'Nhập giới hạn CLIA tuyệt đối khi chọn quy tắc tuyệt đối.' } };
    inTransaction(() => {
      db.prepare(`INSERT INTO tea_refs(id,analyte_id,name,abbreviation,matrix,unit,section,clia,ricos,clia_rule,clia_absolute,clia_absolute_unit)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        cleanId(uid()), analyteId, name, cleanText(input.abbreviation, 40).trim(), cleanText(input.matrix, 80).trim(),
        cleanText(input.unit, 40).trim(), cleanText(input.section, 80).trim(), num(input.clia), num(input.ricos), cliaRule, cliaAbsolute,
        cleanText(input.cliaAbsoluteUnit, 40).trim() || cleanText(input.unit, 40).trim(),
      );
      writeAudit(db, actor, 'Thêm xét nghiệm tham chiếu', `Thêm "${name}" vào bảng TEa tham chiếu`, name);
    });
    notifyChanged(['tea_refs']);
    return { ok: true, data: { analyteId } };
  }

  /** Bỏ MỌI ghi đè CLIA/Ricos của 1 analyte (nút "Khôi phục" app cũ) — giữ
   * lại hồ sơ TEa PXN nếu có, chỉ trả 2 giá trị tham chiếu về mặc định. */
  function restoreTeaRefDefaults(input: { analyteId: unknown }, actor: Actor): IpcResult<{ analyteId: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const analyteId = cleanId(String(input.analyteId || ''));
    const existing = db.prepare('SELECT id, name, lab FROM tea_refs WHERE analyte_id=?').get(analyteId) as
      { id: string; name: string; lab: number | null } | undefined;
    if (!existing) return { ok: true, data: { analyteId } };
    inTransaction(() => {
      if (existing.lab == null) db.prepare('DELETE FROM tea_refs WHERE id=?').run(existing.id);
      else db.prepare('UPDATE tea_refs SET clia=NULL, ricos=NULL, clia_rule=\'\', clia_absolute=NULL, clia_absolute_unit=\'\' WHERE id=?').run(existing.id);
      writeAudit(db, actor, 'Khôi phục TEa tham chiếu', `Bỏ ghi đè CLIA/Ricos của "${existing.name}"`, existing.name);
    });
    notifyChanged(['tea_refs']);
    return { ok: true, data: { analyteId } };
  }

  function removeTeaRef(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name FROM tea_refs WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ TEa.' } };
    inTransaction(() => {
      db.prepare('DELETE FROM tea_refs WHERE id=?').run(id);
      writeAudit(db, actor, 'Xoá hồ sơ TEa', `Xoá "${existing.name}"`, existing.name);
    });
    notifyChanged(['tea_refs']);
    return { ok: true, data: { id } };
  }

  /** Xoá RIÊNG hồ sơ TEa PXN (khác `removeTeaRef` — xoá cả dòng analyte) —
   * port `teaLabProfileRemove()`/`removeLabProfile()` app cũ: chỉ xoá 5 cột
   * `lab*`/`sources_json`, GIỮ LẠI dòng nếu nó còn mang thông tin khác
   * (CLIA/Ricos% ghi đè, HOẶC `abbreviation`/`matrix` — 2 cột chỉ được ghi
   * qua `addTeaAnalyte()`, tức đây là 1 analyte TỰ THÊM, không phải chỉ tồn
   * tại vì có hồ sơ PXN). Trước đây app-v2 KHÔNG có đường nào xoá hồ sơ PXN
   * của một analyte có sẵn trong danh mục tích hợp — chỉ xoá được cả dòng
   * (`removeTeaRef`, dùng cho analyte tự thêm) hoặc "Khôi phục" (chỉ xoá
   * CLIA/Ricos% ghi đè, không đụng hồ sơ PXN). */
  function removeTeaLabProfile(input: { id: unknown }, actor: Actor): IpcResult<{ id: string; removedRecord: boolean }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name, clia, ricos, clia_absolute, abbreviation, matrix, lab FROM tea_refs WHERE id=?').get(id) as
      { id: string; name: string; clia: number | null; ricos: number | null; clia_absolute: number | null; abbreviation: string; matrix: string; lab: number | null } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ TEa.' } };
    if (existing.lab == null) return { ok: true, data: { id, removedRecord: false } };
    const isCustomAnalyte = !!(existing.abbreviation || existing.matrix);
    const removedRecord = !isCustomAnalyte && existing.clia == null && existing.ricos == null && existing.clia_absolute == null;
    inTransaction(() => {
      db.prepare(`UPDATE tea_refs SET lab=NULL, lab_source='', lab_prepared_by='', lab_next_review_date='', sources_json='{}' WHERE id=?`).run(id);
      if (removedRecord) db.prepare('DELETE FROM tea_refs WHERE id=?').run(id);
      writeAudit(db, actor, 'Xóa TEa chuẩn hóa', `${existing.name} · ${Number(existing.lab).toFixed(2)}%`, existing.name);
    });
    notifyChanged(['tea_refs']);
    return { ok: true, data: { id, removedRecord } };
  }

  // ── Xoá lô / nhóm lô / hồ sơ chuyển lô (Giai đoạn D3.4) ──────────────────
  // App cũ có nút "Xóa" trên từng dòng ở cả 3 chỗ này; app-v2 trước đó KHÔNG
  // có đường nào xoá. Cổng chặn port nguyên văn cả thông báo từ
  // `lotRemoval()`/`lotGroupRemoval()` của `manage-config-service.ts` app cũ
  // — đây là lời giải thích cho người dùng biết phải sửa gì trước khi xoá,
  // không phải chuỗi tuỳ ý.

  /** Chặn xoá lô đang được gán Mean/SD cho một mức QC, hoặc lô đã đi qua một
   * hồ sơ chuyển tiếp ĐÃ KẾT LUẬN (app cũ: "đã CHẤP NHẬN", tức đã áp vào
   * cấu hình/Mean-SD) — xoá thẳng sẽ để lại mức QC trỏ vào lô không còn tồn
   * tại. Xoá được thì dọn luôn các hồ sơ chuyển lô còn dở dang trỏ tới nó,
   * đúng như `removeLot()` app cũ làm. */
  /** Kỳ báo cáo đã khoá hay chưa — đọc thẳng `period_locks` bằng SQL RIÊNG
   * của handler này, chỉ dùng chung hàm thuần `ymOfDate()` với
   * entry-handlers (quy ước "handler không import handler khác", xem
   * CLAUDE.md mục Giai đoạn B11). */
  function isPeriodLocked(ym: string): boolean {
    return !!db.prepare('SELECT id FROM period_locks WHERE ym=?').get(ym);
  }

  /** Chỉ xoá cấu hình xét nghiệm hoàn toàn mới, chưa phát sinh dữ liệu.
   * Điểm QC (kể cả đã huỷ), Mean/SD, lô đang gán, lịch sử Mean/SD, Sigma hay
   * hồ sơ NCE đều là hồ sơ chất lượng phải giữ lại. Khi đã có một trong các
   * dấu vết đó, đường đúng là chuyển xét nghiệm sang `active=0`; tuyệt đối
   * không xoá dữ liệu để làm biến mất lịch sử. */
  function removeTest(input: { id: unknown; ids?: unknown }, actor: Actor): IpcResult<{ id: string; pointsCount: number }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const ids = [...new Set([id, ...(Array.isArray(input.ids) ? input.ids.map(String) : [])].filter(Boolean))];
    const placeholders = ids.map(() => '?').join(',');
    const existingRows = ids.length ? db.prepare(`SELECT id, name FROM tests WHERE id IN (${placeholders})`).all(...ids) as { id: string; name: string }[] : [];
    const existing = existingRows.find(row => row.id === id);
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy xét nghiệm.' } };
    const existingIds = existingRows.map(row => row.id);
    const existingPlaceholders = existingIds.map(() => '?').join(',');
    const points = db.prepare(`SELECT test_id, date FROM qc_points WHERE test_id IN (${existingPlaceholders})`).all(...existingIds) as { test_id: string; date: string }[];
    const configuredLevels = Number((db.prepare(`SELECT COUNT(*) AS n FROM test_levels WHERE test_id IN (${existingPlaceholders})
      AND (mean IS NOT NULL OR sd IS NOT NULL OR qc_lot_id IS NOT NULL OR TRIM(COALESCE(mean_sd_history_json,'')) NOT IN ('','[]'))`)
      .get(...existingIds) as { n: number }).n);
    const sigmaCount = Number((db.prepare(`SELECT COUNT(*) AS n FROM sigma_data WHERE test_id IN (${existingPlaceholders})`)
      .get(...existingIds) as { n: number }).n);
    const actionCount = Number((db.prepare(`SELECT COUNT(*) AS n FROM actions WHERE test_id IN (${existingPlaceholders})`)
      .get(...existingIds) as { n: number }).n);
    if (points.length || configuredLevels || sigmaCount || actionCount) {
      return {
        ok: false,
        error: {
          code: 'has-history',
          message: `Không thể xoá "${existing.name}" vì đã có dữ liệu QC hoặc lịch sử cấu hình. Hãy chọn “Ngừng sử dụng” để giữ nguyên hồ sơ.`,
        },
      };
    }
    db.exec('BEGIN');
    try {
      db.prepare(`DELETE FROM test_levels WHERE test_id IN (${existingPlaceholders})`).run(...existingIds);
      db.prepare(`DELETE FROM qc_panel_tests WHERE test_id IN (${existingPlaceholders})`).run(...existingIds);
      db.prepare(`DELETE FROM tests WHERE id IN (${existingPlaceholders})`).run(...existingIds);
      writeAudit(db, actor, 'Xoá xét nghiệm', `Xoá cấu hình chưa phát sinh dữ liệu "${existing.name}" trên ${existingIds.length} máy`, existing.name);
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* transaction đã đóng */ }
      return { ok: false, error: { code: 'delete-failed', message: e instanceof Error ? e.message : 'Xoá xét nghiệm thất bại.' } };
    }
    notifyChanged(['tests', 'test_levels', 'qc_panels'], existingIds);
    return { ok: true, data: { id, pointsCount: 0 } };
  }

  /** Xoá Panel QC — port `panelRemoval()` app cũ: chặn khi panel còn hồ sơ
   * chuyển tiếp lô. Các xét nghiệm bên trong GIỮ NGUYÊN (chỉ gỡ bảng nối),
   * đúng chi tiết app cũ ghi trong hộp xác nhận. */
  function removePanel(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name FROM qc_panels WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy Panel QC.' } };
    const usedByTransition = (db.prepare('SELECT COUNT(*) as c FROM lot_transitions WHERE panel_id=?').get(id) as { c: number }).c;
    if (usedByTransition) {
      return {
        ok: false,
        error: { code: 'used-by-transition', message: 'Panel này đang có lịch sử chuyển tiếp lô. Hãy xóa/chuyển các dòng chuyển tiếp trước.' },
      };
    }
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM qc_panel_tests WHERE panel_id=?').run(id);
      db.prepare('DELETE FROM qc_panels WHERE id=?').run(id);
      writeAudit(db, actor, 'Xoá Panel QC', `Xoá Panel QC "${existing.name}"`, existing.name);
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* transaction đã đóng */ }
      return { ok: false, error: { code: 'delete-failed', message: e instanceof Error ? e.message : 'Xoá Panel QC thất bại.' } };
    }
    notifyChanged(['qc_panels']);
    return { ok: true, data: { id } };
  }

  function removeLot(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, lot_no FROM qc_lots WHERE id=?').get(id) as { id: string; lot_no: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy lô QC.' } };
    const usedByLevel = (db.prepare('SELECT COUNT(*) as c FROM test_levels WHERE qc_lot_id=?').get(id) as { c: number }).c;
    if (usedByLevel) {
      return { ok: false, error: { code: 'used-by-assay', message: 'Lô QC này đang được gắn với xét nghiệm. Hãy đổi lô trong xét nghiệm trước.' } };
    }
    const accepted = (db.prepare("SELECT COUNT(*) as c FROM lot_transitions WHERE (from_lot_id=? OR to_lot_id=?) AND status='accepted'").get(id, id) as { c: number }).c;
    if (accepted) {
      return { ok: false, error: { code: 'used-by-accepted-transition', message: 'Lô QC này có hồ sơ chuyển tiếp đã kết luận (đã áp vào cấu hình/Mean-SD). Không thể xoá lô trực tiếp — nếu thực sự cần, hãy xử lý hồ sơ chuyển tiếp đó trước.' } };
    }
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM lot_transitions WHERE from_lot_id=? OR to_lot_id=?').run(id, id);
      db.prepare('DELETE FROM qc_lots WHERE id=?').run(id);
      writeAudit(db, actor, 'Xoá lô QC', `Xoá lô "${existing.lot_no}"`, existing.lot_no);
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* transaction đã đóng */ }
      return { ok: false, error: { code: 'delete-failed', message: e instanceof Error ? e.message : 'Xoá lô QC thất bại.' } };
    }
    notifyChanged(['qc_lots', 'lot_groups', 'lot_transitions']);
    return { ok: true, data: { id } };
  }

  /** Xoá NHÓM lô nhưng GIỮ NGUYÊN các lô bên trong (chỉ gỡ `group_id`) —
   * đúng chi tiết app cũ hiện trong hộp xác nhận: "Các lô QC bên trong vẫn
   * được giữ nguyên." */
  function removeLotGroup(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name FROM lot_groups WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy nhóm lô QC.' } };
    const usedByLevel = (db.prepare('SELECT COUNT(*) as c FROM test_levels WHERE qc_lot_id IN (SELECT id FROM qc_lots WHERE group_id=?)').get(id) as { c: number }).c;
    if (usedByLevel) {
      return { ok: false, error: { code: 'used-by-assay', message: 'Nhóm lô này đang được gán Mean/SD cho xét nghiệm. Hãy đổi nhóm/lô ở thẻ Mean/SD trước khi xoá nhóm.' } };
    }
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE qc_lots SET group_id=NULL WHERE group_id=?').run(id);
      db.prepare('DELETE FROM lot_groups WHERE id=?').run(id);
      writeAudit(db, actor, 'Xoá nhóm lô QC', `Xoá nhóm "${existing.name}" (các lô bên trong được giữ lại)`, existing.name);
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* transaction đã đóng */ }
      return { ok: false, error: { code: 'delete-failed', message: e instanceof Error ? e.message : 'Xoá nhóm lô thất bại.' } };
    }
    notifyChanged(['qc_lots', 'lot_groups']);
    return { ok: true, data: { id } };
  }

  /** Dừng một nhóm lô đang chạy. CHỈ đổi trạng thái; chiều ngược lại nằm ở
   * `activateLotGroup()` bên dưới và áp lại Mean/SD đã lưu của nhóm. */
  function stopLotGroup(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, name, status FROM lot_groups WHERE id=?').get(id) as { id: string; name: string; status: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy nhóm lô QC.' } };
    // Chỉ dừng được nhóm đang THẬT SỰ hoạt động — port `lotGroupToggleAction()`
    // app cũ: nút "Dừng" chỉ hiện khi status không phải 'stopped'/'planned' VÀ
    // nhóm đang được dùng (`inUse`). Trước đây kiểm `status==='active'`, một
    // literal KHÔNG BAO GIỜ được lưu nữa từ khi sửa mô hình trạng thái.
    const lotIds = (db.prepare('SELECT id FROM qc_lots WHERE group_id=?').all(id) as { id: string }[]).map(r => r.id);
    if (existing.status === 'stopped' || existing.status === 'planned' || !lotGroupInUse(lotIds)) {
      return { ok: false, error: { code: 'not-stoppable', message: 'Chỉ dừng được nhóm lô đang chạy.' } };
    }
    inTransaction(() => {
      db.prepare("UPDATE lot_groups SET status='stopped', stopped_at=? WHERE id=?").run(nowIso(), id);
      writeAudit(db, actor, 'Dừng nhóm lô QC', `Dừng nhóm "${existing.name}"`, existing.name);
    });
    notifyChanged(['lot_groups']);
    return { ok: true, data: { id } };
  }

  /** Ảnh chụp Mean/SD đã lưu cho ĐÚNG lô này — port `qcLotTargetSnapshot()`
   * app cũ: ưu tiên giá trị đang gắn nếu mức đang dùng chính lô đó, nếu không
   * thì tìm NGƯỢC trong `mean_sd_history_json` bản ghi khớp `qcLotId`. Không
   * suy ra từ điểm QC — kích hoạt nhóm lô phải dùng Mean/SD ĐÃ ĐƯỢC PHÊ
   * DUYỆT, không phải số tính lại. */
  function lotTargetSnapshot(level: { qc_lot_id?: string | null; mean: number | null; sd: number | null; low: number | null; high: number | null; mean_sd_history_json?: string | null }, lotId: string) {
    const finite = (value: unknown) => Number.isFinite(Number(value));
    if (level.qc_lot_id === lotId && finite(level.mean) && finite(level.sd)) {
      return { mean: Number(level.mean), sd: Number(level.sd), low: level.low, high: level.high };
    }
    let history: { qcLotId?: string; mean?: number | null; sd?: number | null; low?: number | null; high?: number | null }[] = [];
    try { const parsed = JSON.parse(level.mean_sd_history_json || '[]'); if (Array.isArray(parsed)) history = parsed; } catch { history = []; }
    const found = [...history].reverse().find(entry => entry.qcLotId === lotId && finite(entry.mean) && finite(entry.sd));
    return found ? { mean: Number(found.mean), sd: Number(found.sd), low: found.low ?? null, high: found.high ?? null } : null;
  }

  /** Kích hoạt nhóm lô: áp Mean/SD ĐÃ LƯU của từng lô trong nhóm sang các mức
   * QC tương ứng, chuyển các mức đó sang dùng lô của nhóm này, và DỪNG những
   * nhóm lô bị thay thế. Port `activateLotGroup`/`applyLotGroupActivation` app
   * cũ — app-v2 trước đó chỉ có `stopLotGroup` (một chiều), nên một nhóm đã
   * dừng không có đường bật lại và nhóm mới không có đường áp Mean/SD.
   *
   * 3 trạng thái trả về, y hệt app cũ vì mỗi cái cần một thông báo khác:
   * `applied` (đã áp N mức), `already-active` (không có gì mới để áp nhưng
   * nhóm đang được dùng — vẫn gỡ nhãn "đã dừng"), `unready` (chưa mức nào có
   * Mean/SD hợp lệ cho lô của nhóm, KHÔNG đụng gì). */
  function activateLotGroup(input: { id: unknown }, actor: Actor): IpcResult<{ status: 'applied' | 'already-active' | 'unready'; applied: number; stoppedGroups: string[] }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const group = db.prepare('SELECT id, name FROM lot_groups WHERE id=?').get(id) as { id: string; name: string } | undefined;
    if (!group) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy nhóm lô QC.' } };
    const lots = db.prepare('SELECT id, lot_no, level, opened FROM qc_lots WHERE group_id=?').all(id) as
      { id: string; lot_no: string; level: number; opened: string }[];
    if (!lots.length) return { ok: false, error: { code: 'empty-group', message: 'Nhóm lô này chưa có lô QC nào.' } };

    type Candidate = { levelId: string; testId: string; lotId: string; lotNo: string; level: number;
      mean: number; sd: number; low: number | null; high: number | null; prevLotId: string | null;
      prevMean: number | null; prevSd: number | null; prevLow: number | null; prevHigh: number | null;
      prevApplied: 'mfg' | 'lab'; prevEffectiveFrom: string; historyJson: string | null };
    const candidates: Candidate[] = [];
    for (const lot of lots) {
      const levels = db.prepare(`SELECT tl.id, tl.test_id, tl.qc_lot_id, tl.mean, tl.sd, tl.low, tl.high, tl.applied, tl.mean_sd_effective_from, tl.mean_sd_history_json
        FROM test_levels tl WHERE tl.level=?`).all(lot.level) as {
          id: string; test_id: string; qc_lot_id: string | null; mean: number | null; sd: number | null;
          low: number | null; high: number | null; applied: 'mfg' | 'lab'; mean_sd_effective_from: string; mean_sd_history_json: string | null }[];
      for (const level of levels) {
        if (level.qc_lot_id === lot.id) continue; // đã dùng đúng lô này
        const snapshot = lotTargetSnapshot(level, lot.id);
        if (!snapshot || !(snapshot.sd > 0)) continue;
        candidates.push({
          levelId: level.id, testId: level.test_id, lotId: lot.id, lotNo: lot.lot_no, level: lot.level,
          mean: snapshot.mean, sd: snapshot.sd, low: snapshot.low, high: snapshot.high,
          prevLotId: level.qc_lot_id, prevMean: level.mean, prevSd: level.sd, prevLow: level.low, prevHigh: level.high,
          prevApplied: level.applied, prevEffectiveFrom: level.mean_sd_effective_from, historyJson: level.mean_sd_history_json,
        });
      }
    }

    if (!candidates.length) {
      // Không có gì mới để áp: nếu nhóm đang thực sự được dùng (có mức nào
      // trỏ vào lô của nó) thì chỉ cần gỡ nhãn "đã dừng".
      if (!lotGroupInUse(lots.map(lot => lot.id))) {
        return { ok: false, error: { code: 'unready', message: 'Chưa mức QC nào có Mean/SD đã lưu cho lô của nhóm này. Hãy nhập Mean/SD cho lô mới trước khi kích hoạt.' } };
      }
      // status='' (không phải 'active') — "Đang hoạt động" giờ SUY từ
      // `inUse`, không phải literal lưu cứng (port đúng app cũ).
      inTransaction(() => {
        db.prepare("UPDATE lot_groups SET status='', stopped_at='' WHERE id=?").run(id);
        writeAudit(db, actor, 'Kích hoạt nhóm lô QC', `Nhóm "${group.name}" đã đang được dùng, không có mức nào cần áp thêm`, group.name);
      });
      notifyChanged(['lot_groups']);
      return { ok: true, data: { status: 'already-active', applied: 0, stoppedGroups: [] } };
    }

    // Nhóm lô nào đang giữ các mức bị thay thế thì bị DỪNG — một mức chỉ
    // thuộc một nhóm lô đang chạy tại một thời điểm.
    const stoppedIds = new Set<string>();
    for (const candidate of candidates) {
      if (!candidate.prevLotId) continue;
      const owner = db.prepare('SELECT group_id FROM qc_lots WHERE id=?').get(candidate.prevLotId) as { group_id: string | null } | undefined;
      if (owner && owner.group_id && owner.group_id !== id) stoppedIds.add(owner.group_id);
    }
    const at = nowIso();
    db.exec('BEGIN');
    try {
      for (const candidate of candidates) {
        const oldLot = candidate.prevLotId ? db.prepare('SELECT lot_no, opened FROM qc_lots WHERE id=?').get(candidate.prevLotId) as
          { lot_no: string; opened: string } | undefined : undefined;
        const nextFrom = lots.find((lot) => lot.id === candidate.lotId)?.opened || at.slice(0, 10);
        // `test_levels` KHÔNG có cột `lot` — số lô lấy qua `qc_lot_id`
        // (khác app cũ, nơi mức QC giữ cả nhãn lô dạng chuỗi).
        // Nguồn 'mfg' (NSX), KHÔNG phải 'lab' — cùng bug/lý do đã sửa ở
        // `createLotTransition`'s cascade: `applyTargetPick()` app cũ (dùng
        // chung bởi Mean/SD tab VÀ kích hoạt nhóm lô) LUÔN ghi `source:'mfg'`;
        // 'lab' (PXN) chỉ dành riêng cho luồng "Xây dựng dải PXN" ở trang
        // Nhập QC & Biểu đồ (`RangeWorkflowCommand`).
        db.prepare('UPDATE test_levels SET qc_lot_id=?, mean=?, sd=?, low=?, high=?, applied=?, mean_sd_history_json=?, mean_sd_effective_from=? WHERE id=?')
          .run(candidate.lotId, candidate.mean, candidate.sd, candidate.low, candidate.high, 'mfg',
            appendMeanSdHistory(candidate.historyJson,
              { mean: candidate.prevMean, sd: candidate.prevSd, low: candidate.prevLow, high: candidate.prevHigh,
                qcLotId: candidate.prevLotId || '', lot: oldLot?.lot_no || '',
                effectiveFrom: candidate.prevEffectiveFrom || oldLot?.opened || '', effectiveTo: nextFrom,
                source: candidate.prevApplied }, at),
            nextFrom, candidate.levelId);
      }
      for (const stoppedId of stoppedIds) {
        db.prepare("UPDATE lot_groups SET status='stopped', stopped_at=? WHERE id=?").run(at, stoppedId);
      }
      db.prepare("UPDATE lot_groups SET status='', stopped_at='' WHERE id=?").run(id);
      writeAudit(db, actor, 'Kích hoạt nhóm lô QC',
        `Nhóm "${group.name}": áp Mean/SD cho ${candidates.length} mức QC`
        + (stoppedIds.size ? `, dừng ${stoppedIds.size} nhóm lô bị thay thế` : ''), group.name);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    notifyChanged(['lot_groups', 'qc_lots', 'test_levels', 'tests']);
    return { ok: true, data: { status: 'applied', applied: candidates.length, stoppedGroups: [...stoppedIds] } };
  }

  /** Xoá hồ sơ chuyển lô. Hồ sơ ĐÃ KẾT LUẬN không xoá được: kết luận là bản
   * ghi đã áp vào cấu hình, xoá đi thì mất dấu vết vì sao Mean/SD đổi. */
  /** Nhãn lô đọc được ("1101 · Mức 1"), thay id thô — port `manageLotLabel()`
   * app cũ, dùng cho mọi dòng audit liên quan tới lô/hồ sơ chuyển lô. */
  function lotLabel(lotId: string): string {
    const lot = db.prepare('SELECT lot_no, level FROM qc_lots WHERE id=?').get(lotId) as { lot_no: string; level: number } | undefined;
    return lot ? `${lot.lot_no} · Mức ${lot.level}` : 'Chưa chọn lô';
  }

  function removeLotTransition(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = String(input.id || '');
    const existing = db.prepare('SELECT id, status, from_lot_id, to_lot_id FROM lot_transitions WHERE id=?').get(id) as
      { id: string; status: string; from_lot_id: string; to_lot_id: string } | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ chuyển lô.' } };
    if (existing.status === 'accepted') {
      return { ok: false, error: { code: 'accepted-applied', message: 'Hồ sơ đã chấp nhận lô mới và đã áp dụng vào nhóm lô/Mean-SD, không nên xóa trực tiếp. Nếu nhập sai, hãy tạo hồ sơ chuyển tiếp mới hoặc chỉnh nhóm lô/Mean-SD thủ công.' } };
    }
    // Nhãn lô đọc được thay id thô — port đúng app cũ (`lotLabel()`, xem
    // manage-lot-transition-command.ts: target là tên loại thao tác tĩnh,
    // detail nêu rõ lô nào → lô nào, không phải id nội bộ không ai đọc được.
    const detail = `${lotLabel(existing.from_lot_id)} → ${lotLabel(existing.to_lot_id)}`;
    inTransaction(() => {
      db.prepare('DELETE FROM lot_transitions WHERE id=?').run(id);
      writeAudit(db, actor, 'Xoá hồ sơ chuyển lô', detail, 'Chuyển tiếp lô');
    });
    notifyChanged(['lot_transitions']);
    return { ok: true, data: { id } };
  }

  return {
    listInstruments, saveInstrument, removeInstrument, listTests, saveTest, listTestLevels, saveTestLevel, listActivity,
    listRuleScopes, saveRuleScope,
    setTeaRefValue, restoreTeaRefDefaults, addTeaAnalyte, removeTest, removePanel, listLots, saveLot, previewLotRename, removeLot, listLotGroups, saveLotGroup, removeLotGroup, stopLotGroup, activateLotGroup, listPanels, savePanel,
    listLotTransitions, createLotTransition, removeLotTransition,
    listTeaRefs, saveTeaRef, removeTeaRef, removeTeaLabProfile,
  };
}

export type ConfigHandlers = ReturnType<typeof createConfigHandlers>;
